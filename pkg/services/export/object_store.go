package export

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	xctx "github.com/grafana/grafana/pkg/infra/x/context"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/store/object"
	"github.com/grafana/grafana/pkg/services/user"
)

var _ Job = new(objectStoreJob)

type objectStoreJob struct {
	logger log.Logger

	statusMu      sync.Mutex
	status        ExportStatus
	cfg           ExportConfig
	broadcaster   statusBroadcaster
	stopRequested bool

	sess            *session.SessionDB
	playlistService playlist.Service
	store           object.ObjectStoreClient
}

func startObjectStoreJob(cfg ExportConfig, broadcaster statusBroadcaster, db db.DB, playlistService playlist.Service, store object.ObjectStoreClient) (Job, error) {
	job := &objectStoreJob{
		logger:      log.New("export_to_object_store_job"),
		cfg:         cfg,
		broadcaster: broadcaster,
		status: ExportStatus{
			Running: true,
			Target:  "object store export",
			Started: time.Now().UnixMilli(),
			Count:   make(map[string]int, 10),
			Index:   0,
		},
		sess:            db.GetSqlxSession(),
		playlistService: playlistService,
		store:           store,
	}

	broadcaster(job.status)
	go job.start()
	return job, nil
}

func (e *objectStoreJob) requestStop() {
	e.stopRequested = true
}

func (e *objectStoreJob) start() {
	defer func() {
		e.logger.Info("Finished dummy export job")

		e.statusMu.Lock()
		defer e.statusMu.Unlock()
		s := e.status
		if err := recover(); err != nil {
			e.logger.Error("export panic", "error", err)
			s.Status = fmt.Sprintf("ERROR: %v", err)
		}
		// Make sure it finishes OK
		if s.Finished < 10 {
			s.Finished = time.Now().UnixMilli()
		}
		s.Running = false
		if s.Status == "" {
			s.Status = "done"
		}
		e.status = s
		e.broadcaster(s)
	}()

	e.logger.Info("Starting dummy export job")
	// Select all dashboards
	rowUser := &user.SignedInUser{
		Login:  "?",
		OrgID:  0, // gets filled in from each row
		UserID: 0,
	}
	ctx := xctx.ContextWithUser(context.Background(), rowUser)

	what := models.StandardKindDashboard
	e.status.Count[what] = 0

	// TODO paging etc
	// NOTE: doing work inside rows.Next() leads to database locked
	dashInfo, err := e.getDashboards(ctx)
	if err != nil {
		e.status.Status = "error: " + err.Error()
		return
	}

	for _, dash := range dashInfo {
		rowUser.OrgID = dash.OrgID
		rowUser.UserID = dash.UpdatedBy
		if dash.UpdatedBy < 0 {
			rowUser.UserID = 0 // avoid Uint64Val issue????
		}

		_, err = e.store.Write(ctx, &object.WriteObjectRequest{
			UID:     fmt.Sprintf("export/%s", dash.UID),
			Kind:    models.StandardKindDashboard,
			Body:    dash.Body,
			Comment: "export from dashboard table",
		})
		if err != nil {
			e.status.Status = "error: " + err.Error()
			return
		}
		e.status.Changed = time.Now().UnixMilli()
		e.status.Index++
		e.status.Count[what] += 1
		e.status.Last = fmt.Sprintf("ITEM: %s", dash.UID)
		e.broadcaster(e.status)
	}

	// Playlists
	what = models.StandardKindPlaylist
	e.status.Count[what] = 0
	rowUser.OrgID = 1
	rowUser.UserID = 1
	res, err := e.playlistService.Search(ctx, &playlist.GetPlaylistsQuery{
		OrgId: rowUser.OrgID, // TODO... all or orgs
		Limit: 5000,
	})
	if err != nil {
		e.status.Status = "error: " + err.Error()
		return
	}
	for _, item := range res {
		playlist, err := e.playlistService.Get(ctx, &playlist.GetPlaylistByUidQuery{
			UID:   item.UID,
			OrgId: rowUser.OrgID,
		})
		if err != nil {
			e.status.Status = "error: " + err.Error()
			return
		}

		_, err = e.store.Write(ctx, &object.WriteObjectRequest{
			UID:     fmt.Sprintf("export/%s", playlist.Uid),
			Kind:    models.StandardKindPlaylist,
			Body:    prettyJSON(playlist),
			Comment: "export from playlists",
		})
		if err != nil {
			e.status.Status = "error: " + err.Error()
			return
		}
		e.status.Changed = time.Now().UnixMilli()
		e.status.Index++
		e.status.Count[what] += 1
		e.status.Last = fmt.Sprintf("ITEM: %s", playlist.Uid)
		e.broadcaster(e.status)
	}
}

type dashInfo struct {
	OrgID     int64
	UID       string
	Body      []byte
	UpdatedBy int64
}

func (e *objectStoreJob) getDashboards(ctx context.Context) ([]dashInfo, error) {
	e.status.Last = "find dashbaords...."
	e.broadcaster(e.status)

	dash := make([]dashInfo, 0)
	rows, err := e.sess.Query(ctx, "SELECT org_id,uid,data,updated_by FROM dashboard WHERE is_folder=0")
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		if e.stopRequested {
			return dash, nil
		}

		row := dashInfo{}
		err = rows.Scan(&row.OrgID, &row.UID, &row.Body, &row.UpdatedBy)
		if err != nil {
			return nil, err
		}
		dash = append(dash, row)
	}
	return dash, nil
}

func (e *objectStoreJob) getStatus() ExportStatus {
	e.statusMu.Lock()
	defer e.statusMu.Unlock()

	return e.status
}

func (e *objectStoreJob) getConfig() ExportConfig {
	e.statusMu.Lock()
	defer e.statusMu.Unlock()

	return e.cfg
}
