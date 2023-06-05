package export

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/kinds/librarypanel"
	"github.com/grafana/grafana/pkg/kinds/team"
	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/playlist"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/kind/folder"
	"github.com/grafana/grafana/pkg/services/store/kind/snapshot"
	"github.com/grafana/grafana/pkg/services/user"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var _ Job = new(entityStoreJob)

type entityStoreJob struct {
	logger log.Logger

	statusMu      sync.Mutex
	status        ExportStatus
	cfg           ExportConfig
	broadcaster   statusBroadcaster
	stopRequested bool
	ctx           context.Context

	sess               *session.SessionDB
	playlistService    playlist.Service
	store              entity.EntityStoreServer
	dashboardsnapshots dashboardsnapshots.Service
	preferenceService  pref.Service
}

func startEntityStoreJob(ctx context.Context,
	cfg ExportConfig,
	broadcaster statusBroadcaster,
	db db.DB,
	playlistService playlist.Service,
	store entity.EntityStoreServer,
	dashboardsnapshots dashboardsnapshots.Service,
	preferenceService pref.Service,
) (Job, error) {
	job := &entityStoreJob{
		logger:      log.New("export_to_object_store_job"),
		cfg:         cfg,
		ctx:         ctx,
		broadcaster: broadcaster,
		status: ExportStatus{
			Running: true,
			Target:  "object store export",
			Started: time.Now().UnixMilli(),
			Count:   make(map[string]int, 10),
			Index:   0,
		},
		sess:               db.GetSqlxSession(),
		playlistService:    playlistService,
		store:              store,
		dashboardsnapshots: dashboardsnapshots,
		preferenceService:  preferenceService,
	}

	broadcaster(job.status)
	go job.start(ctx)
	return job, nil
}

func (e *entityStoreJob) requestStop() {
	e.stopRequested = true
}

func (e *entityStoreJob) start(ctx context.Context) {
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
		Login:  "",
		OrgID:  0, // gets filled in from each row
		UserID: 0,
	}
	ctx = appcontext.WithUser(ctx, rowUser)

	what := entity.StandardKindFolder
	e.status.Count[what] = 0

	folders := make(map[int64]string)
	folderInfo, err := e.getFolders(ctx)
	if err != nil {
		e.status.Status = "error: " + err.Error()
		return
	}
	e.status.Last = fmt.Sprintf("export %d folders", len(folderInfo))
	e.broadcaster(e.status)

	for _, dash := range folderInfo {
		folders[dash.ID] = dash.UID
	}

	for idx, dash := range folderInfo {
		rowUser.OrgID = dash.OrgID
		rowUser.UserID = dash.UpdatedBy
		if dash.UpdatedBy < 0 {
			rowUser.UserID = 0 // avoid Uint64Val issue????
		}
		f := folder.Model{Name: dash.Title}
		d, _ := json.Marshal(f)

		_, err = e.store.AdminWrite(ctx, &entity.AdminWriteEntityRequest{
			GRN: &entity.GRN{
				UID:  dash.UID,
				Kind: entity.StandardKindFolder,
			},
			ClearHistory: true,
			CreatedAt:    dash.Created.UnixMilli(),
			UpdatedAt:    dash.Updated.UnixMilli(),
			UpdatedBy:    fmt.Sprintf("user:%d", dash.UpdatedBy),
			CreatedBy:    fmt.Sprintf("user:%d", dash.CreatedBy),
			Body:         d,
			Folder:       folders[dash.FolderID],
			Comment:      "(exported from SQL)",
			Origin: &entity.EntityOriginInfo{
				Source: "export-from-sql",
			},
		})
		if err != nil {
			e.status.Status = fmt.Sprintf("error exporting folder[%d]%s: %s", idx, dash.Title, err.Error())
			return
		}
		e.status.Changed = time.Now().UnixMilli()
		e.status.Index++
		e.status.Count[what] += 1
		e.status.Last = fmt.Sprintf("FOLDER: %s", dash.UID)
		e.broadcaster(e.status)
	}

	what = entity.StandardKindDashboard
	e.status.Count[what] = 0

	// TODO paging etc
	// NOTE: doing work inside rows.Next() leads to database locked
	dashInfo, err := e.getDashboards(ctx)
	if err != nil {
		e.status.Status = "error: " + err.Error()
		return
	}
	e.status.Last = fmt.Sprintf("export %d dashboards", len(dashInfo))
	e.broadcaster(e.status)

	for _, dash := range dashInfo {
		rowUser.OrgID = dash.OrgID
		rowUser.UserID = dash.UpdatedBy
		if dash.UpdatedBy < 0 {
			rowUser.UserID = 0 // avoid Uint64Val issue????
		}

		_, err = e.store.AdminWrite(ctx, &entity.AdminWriteEntityRequest{
			GRN: &entity.GRN{
				UID:  dash.UID,
				Kind: entity.StandardKindDashboard,
			},
			ClearHistory: true,
			Version:      uint64(dash.Version),
			CreatedAt:    dash.Created.UnixMilli(),
			UpdatedAt:    dash.Updated.UnixMilli(),
			UpdatedBy:    fmt.Sprintf("user:%d", dash.UpdatedBy),
			CreatedBy:    fmt.Sprintf("user:%d", dash.CreatedBy),
			Body:         dash.Data,
			Folder:       folders[dash.FolderID],
			Comment:      "(exported from SQL)",
			Origin: &entity.EntityOriginInfo{
				Source: "export-from-sql",
			},
		})
		if err != nil {
			e.status.Status = "error: " + err.Error()
			return
		}
		e.status.Changed = time.Now().UnixMilli()
		e.status.Index++
		e.status.Count[what] += 1
		e.status.Last = fmt.Sprintf("DASH: %s", dash.UID)
		e.broadcaster(e.status)
	}

	// TODO.. query lookup
	orgIDs := []int64{1}

	// Playlists
	what = entity.StandardKindPlaylist
	e.status.Count[what] = 0

	for _, orgId := range orgIDs {
		rowUser.OrgID = orgId
		rowUser.UserID = 1
		res, err := e.playlistService.Search(ctx, &playlist.GetPlaylistsQuery{
			OrgId: orgId,
			Limit: 5000,
		})
		if err != nil {
			e.status.Status = "error: " + err.Error()
			return
		}
		for _, item := range res {
			rowUser.OrgID = orgId
			rowUser.UserID = 1

			playlist, err := e.playlistService.Get(ctx, &playlist.GetPlaylistByUidQuery{
				UID:   item.UID,
				OrgId: orgId,
			})
			if err != nil {
				e.status.Status = "error: " + err.Error()
				return
			}

			_, err = e.store.Write(ctx, &entity.WriteEntityRequest{
				GRN: &entity.GRN{
					UID:  playlist.Uid,
					Kind: entity.StandardKindPlaylist,
				},
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
			e.status.Last = fmt.Sprintf("PLAYLIST: %s", playlist.Uid)
			e.broadcaster(e.status)
		}
	}

	// Load access policies
	what = "accesspolicies"
	for _, orgId := range orgIDs {
		e.status.Last = "starting access policies"
		e.status.Status = "getting access policies"
		e.broadcaster(e.status)
		rowUser.OrgID = orgId
		rowUser.UserID = 1
		policies, err := database.GetAccessPolicies(ctx, orgId, e.sess,
			func(ctx context.Context, orgID int64, scope string) ([]string, error) {
				return strings.Split(scope, ":"), nil
			})
		if err != nil {
			e.status.Status = "error: " + err.Error()
			return
		}
		for _, policy := range policies {
			_, err = e.store.Write(ctx, &entity.WriteEntityRequest{
				GRN: &entity.GRN{
					UID:  policy.Metadata.Name,
					Kind: "accesspolicy",
				},
				Body:    prettyJSON(policy.Spec),
				Meta:    prettyJSON(policy.Metadata),
				Comment: "export from sql",
			})
			if err != nil {
				e.status.Status = "error: " + err.Error()
				return
			}
			e.status.Changed = time.Now().UnixMilli()
			e.status.Index++
			e.status.Count[what] += 1
			e.status.Last = fmt.Sprintf("ROLE: %s", policy.Spec.Role.Xname)
			e.broadcaster(e.status)
		}
	}

	// Playlists
	what = entity.StandardKindPreferences
	e.status.Count[what] = 0

	for _, orgId := range orgIDs {
		rowUser.OrgID = orgId
		rowUser.UserID = 1
		res, err := e.preferenceService.GetPreferences(ctx, orgId)
		if err != nil {
			e.status.Status = "error: " + err.Error()
			return
		}
		for _, p := range res {
			_, err = e.store.Write(ctx, &entity.WriteEntityRequest{
				GRN: &entity.GRN{
					UID:  p.Metadata.Name,
					Kind: what,
				},
				Meta:    prettyJSON(p.Metadata),
				Body:    prettyJSON(p.Spec),
				Comment: "export from snapshtts",
			})
			if err != nil {
				e.status.Status = "error: " + err.Error()
				return
			}
			e.status.Changed = time.Now().UnixMilli()
			e.status.Index++
			e.status.Count[what] += 1
			e.status.Last = fmt.Sprintf("PREFERENCES: %s", p.Metadata.Name)
			e.broadcaster(e.status)
		}
	}

	// Load snapshots
	what = entity.StandardKindSnapshot
	for _, orgId := range orgIDs {
		rowUser.OrgID = orgId
		rowUser.UserID = 1
		cmd := &dashboardsnapshots.GetDashboardSnapshotsQuery{
			OrgID:        orgId,
			Limit:        500000,
			SignedInUser: rowUser,
		}

		result, err := e.dashboardsnapshots.SearchDashboardSnapshots(ctx, cmd)
		if err != nil {
			e.status.Status = "error: " + err.Error()
			return
		}

		for _, dto := range result {
			m := snapshot.Model{
				Name:        dto.Name,
				ExternalURL: dto.ExternalURL,
				Expires:     dto.Expires.UnixMilli(),
			}

			//			team.Metadata.Namespace = orgIdToNamespace(info.OrgID)

			rowUser.OrgID = dto.OrgID
			rowUser.UserID = dto.UserID

			snapcmd := &dashboardsnapshots.GetDashboardSnapshotQuery{
				Key: dto.Key,
			}
			snapcmdResult, err := e.dashboardsnapshots.GetDashboardSnapshot(ctx, snapcmd)
			if err == nil {
				res := snapcmdResult
				m.DeleteKey = res.DeleteKey
				m.ExternalURL = res.ExternalURL

				snap := res.Dashboard
				m.DashboardUID = snap.Get("uid").MustString("")
				snap.Del("uid")
				snap.Del("id")

				b, _ := snap.MarshalJSON()
				m.Snapshot = b
			}

			_, err = e.store.Write(ctx, &entity.WriteEntityRequest{
				GRN: &entity.GRN{
					UID:  dto.Key,
					Kind: entity.StandardKindSnapshot,
				},
				Body:    prettyJSON(m),
				Comment: "export from snapshtts",
			})
			if err != nil {
				e.status.Status = "error: " + err.Error()
				return
			}
			e.status.Changed = time.Now().UnixMilli()
			e.status.Index++
			e.status.Count[what] += 1
			e.status.Last = fmt.Sprintf("SNAPSHOT: %s", dto.Name)
			e.broadcaster(e.status)
		}
	}

	// Load teams
	what = "teams"
	rowUser.OrgID = 0   // admin
	rowUser.UserID = -1 // admin
	type teamInfoType struct {
		Id      int64
		Name    string
		OrgID   int64     `db:"org_id"`
		Created time.Time `db:"created"`
		Updated time.Time `db:"updated"`
		UID     string    `db:"uid"`
		Email   string
	}
	teams := []teamInfoType{}

	e.status.Last = "starting teams"
	e.status.Status = "executing team query"
	e.broadcaster(e.status)
	err = e.sess.Select(ctx, &teams, "SELECT * FROM team")
	if err != nil {
		e.status.Status = "team error: " + err.Error()
		return
	}
	for _, info := range teams {
		team := team.NewK8sResource(info.UID, &team.Spec{
			Name: info.Name,
		})
		if info.Email != "" {
			team.Spec.Email = &info.Email
		}
		rowUser.OrgID = info.OrgID
		_, err = e.store.Write(ctx, &entity.WriteEntityRequest{
			GRN: &entity.GRN{
				UID:  info.UID,
				Kind: "team",
			},
			Body:    prettyJSON(team.Spec),
			Meta:    prettyJSON(team.Metadata),
			Comment: "export from sql",
		})
		if err != nil {
			e.status.Status = "error: " + err.Error()
			return
		}
		e.status.Changed = time.Now().UnixMilli()
		e.status.Index++
		e.status.Count[what] += 1
		e.status.Last = fmt.Sprintf("TEAM: %s", team.Spec.Name)
		e.broadcaster(e.status)
	}

	// Load snapshots
	what = "librarypanel"
	e.status.Last = "starting library panels"
	for _, orgId := range orgIDs {
		rowUser.OrgID = orgId
		type libraryPanelInfo struct {
			FolderUID   *string `db:"folder_uid"`
			FolderID    int64   `db:"folder_id"`
			UID         string
			Name        string
			Description string
			Model       []byte
			Created     time.Time
			CreatedBy   int64 `db:"created_by"`
			Updated     time.Time
			UpdatedBy   int64 `db:"updated_by"`
		}
		info := []libraryPanelInfo{}

		e.status.Status = fmt.Sprintf("loading panels for: %d", orgId)
		e.broadcaster(e.status)
		err = e.sess.Select(ctx, &info, `SELECT 
			dashboard.uid as folder_uid,
			library_element.folder_id as folder_id, 
			library_element.uid, 
			library_element.name, 
			library_element.description, 
			library_element.model, 
			library_element.created, 
			library_element.created_by, 
			library_element.updated, 
			library_element.updated_by 
		FROM library_element 
		LEFT JOIN dashboard ON dashboard.id =library_element.folder_id
		WHERE library_element.org_id=?
		`, orgId)
		if err != nil {
			e.status.Status = "library panel error: " + err.Error()
			return
		}

		for _, panel := range info {
			res := librarypanel.NewK8sResource(panel.UID, &librarypanel.Spec{
				Name: panel.Name,
			})
			res.Metadata.CreationTimestamp = v1.NewTime(panel.Created)
			res.Metadata.SetUpdatedTimestamp(&panel.Updated)
			if panel.CreatedBy > 0 {
				res.Metadata.SetCreatedBy(fmt.Sprintf("user:%d:", panel.CreatedBy))
			}
			if panel.UpdatedBy > 0 {
				res.Metadata.SetUpdatedBy(fmt.Sprintf("user:%d:", panel.UpdatedBy))
			}
			if panel.FolderUID != nil {
				res.Metadata.SetFolder(*panel.FolderUID)
			}

			err = json.Unmarshal(panel.Model, &res.Spec.Model)
			if err != nil {
				e.status.Status = "library panel error: " + err.Error()
				return
			}
			delete(res.Spec.Model, "uid")
			delete(res.Spec.Model, "version")

			_, err = e.store.Write(ctx, &entity.WriteEntityRequest{
				GRN: &entity.GRN{
					UID:  panel.UID,
					Kind: what,
				},
				Body:    prettyJSON(res.Spec),
				Meta:    prettyJSON(res.Metadata),
				Comment: "export from sql",
			})
			if err != nil {
				e.status.Status = "error: " + err.Error()
				return
			}
			e.status.Changed = time.Now().UnixMilli()
			e.status.Index++
			e.status.Count[what] += 1
			e.status.Last = fmt.Sprintf("LIBRARY PANEL: %s", res.Spec.Name)
			e.broadcaster(e.status)
		}
	}

}

type dashInfo struct {
	OrgID     int64 `db:"org_id"`
	UID       string
	Version   int64
	Slug      string
	Data      []byte
	Created   time.Time
	Updated   time.Time
	CreatedBy int64 `db:"created_by"`
	UpdatedBy int64 `db:"updated_by"`
	FolderID  int64 `db:"folder_id"`
}

type folderInfo struct {
	ID        int64 `db:"id"`
	OrgID     int64 `db:"org_id"`
	UID       string
	Title     string
	Created   time.Time
	Updated   time.Time
	CreatedBy int64 `db:"created_by"`
	UpdatedBy int64 `db:"updated_by"`
	FolderID  int64 `db:"folder_id"`
}

// TODO, paging etc
func (e *entityStoreJob) getDashboards(ctx context.Context) ([]dashInfo, error) {
	e.status.Last = "find dashbaords...."
	e.broadcaster(e.status)

	dash := make([]dashInfo, 0)
	err := e.sess.Select(ctx, &dash, "SELECT org_id,uid,version,slug,data,folder_id,created,updated,created_by,updated_by FROM dashboard WHERE is_folder=false")
	return dash, err
}

// TODO, paging etc
func (e *entityStoreJob) getFolders(ctx context.Context) ([]folderInfo, error) {
	e.status.Last = "find dashbaords...."
	e.broadcaster(e.status)

	dash := make([]folderInfo, 0)
	err := e.sess.Select(ctx, &dash, "SELECT id,org_id,uid,title,folder_id,created,updated,created_by,updated_by FROM dashboard WHERE is_folder=true")
	return dash, err
}

func (e *entityStoreJob) getStatus() ExportStatus {
	e.statusMu.Lock()
	defer e.statusMu.Unlock()

	return e.status
}

func (e *entityStoreJob) getConfig() ExportConfig {
	e.statusMu.Lock()
	defer e.statusMu.Unlock()

	return e.cfg
}
