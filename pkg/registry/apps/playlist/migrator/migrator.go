package playlist

import (
	"context"
	"database/sql"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"text/template"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	playlistv1 "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

//go:embed query_playlists.sql
var playlistSQLTemplatesFS embed.FS

var sqlQueryPlaylists = template.Must(
	template.New("sql").ParseFS(playlistSQLTemplatesFS, "query_playlists.sql"),
).Lookup("query_playlists.sql")

type PlaylistMigrator interface {
	MigratePlaylists(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error
}

// playlistMigrator handles migrating playlists from legacy SQL storage.
type playlistMigrator struct {
	sql legacysql.LegacyDatabaseProvider
}

// ProvidePlaylistMigrator creates a playlistMigrator for use in wire DI.
func ProvidePlaylistMigrator(sql legacysql.LegacyDatabaseProvider) PlaylistMigrator {
	return &playlistMigrator{sql: sql}
}

// MigratePlaylists reads playlists from legacy SQL storage and streams them as
// Kubernetes resources to the unified storage bulk process API.
func (m *playlistMigrator) MigratePlaylists(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
	opts.Progress(-1, "migrating playlists...")
	rows, err := m.listPlaylists(ctx, orgId)
	if rows != nil {
		defer func() {
			_ = rows.Close()
		}()
	}
	if err != nil {
		return err
	}

	// Group playlist items by playlist ID while preserving order
	type playlistData struct {
		id        int64
		uid       string
		name      string
		interval  string
		items     []playlistv1.PlaylistItem
		createdAt int64
		updatedAt int64
	}

	playlistIndex := make(map[int64]int) // maps playlist ID to index in playlists slice
	playlists := []*playlistData{}
	var currentID int64
	var orgID int64
	var uid, name, interval string
	var createdAt, updatedAt int64
	var itemType, itemValue sql.NullString

	count := 0
	for rows.Next() {
		err = rows.Scan(&currentID, &orgID, &uid, &name, &interval, &createdAt, &updatedAt, &itemType, &itemValue)
		if err != nil {
			return err
		}

		// Get or create playlist entry
		idx, exists := playlistIndex[currentID]
		var pl *playlistData
		if !exists {
			pl = &playlistData{
				id:        currentID,
				uid:       uid,
				name:      name,
				interval:  interval,
				items:     []playlistv1.PlaylistItem{},
				createdAt: createdAt,
				updatedAt: updatedAt,
			}
			playlistIndex[currentID] = len(playlists)
			playlists = append(playlists, pl)
		} else {
			pl = playlists[idx]
		}

		// Add item if it exists (LEFT JOIN can return NULL for playlists without items)
		if itemType.Valid && itemValue.Valid {
			pl.items = append(pl.items, playlistv1.PlaylistItem{
				Type:  playlistv1.PlaylistPlaylistItemType(itemType.String),
				Value: itemValue.String,
			})
		}
	}

	if err = rows.Err(); err != nil {
		return err
	}

	// Convert to K8s objects and send to stream (order is preserved)
	for _, pl := range playlists {
		playlist := &playlistv1.Playlist{
			TypeMeta: metav1.TypeMeta{
				APIVersion: playlistv1.GroupVersion.String(),
				Kind:       "Playlist",
			},
			ObjectMeta: metav1.ObjectMeta{
				Name:              pl.uid,
				Namespace:         opts.Namespace,
				CreationTimestamp: metav1.NewTime(time.UnixMilli(pl.createdAt)),
			},
			Spec: playlistv1.PlaylistSpec{
				Title:    pl.name,
				Interval: pl.interval,
				Items:    pl.items,
			},
		}

		// Set updated timestamp if different from created
		if pl.updatedAt != pl.createdAt {
			meta, err := utils.MetaAccessor(playlist)
			if err != nil {
				return err
			}
			updatedTime := time.UnixMilli(pl.updatedAt)
			meta.SetUpdatedTimestamp(&updatedTime)
		}

		body, err := json.Marshal(playlist)
		if err != nil {
			return err
		}

		req := &resourcepb.BulkRequest{
			Key: &resourcepb.ResourceKey{
				Namespace: opts.Namespace,
				Group:     "playlist.grafana.app",
				Resource:  "playlists",
				Name:      pl.uid,
			},
			Value:  body,
			Action: resourcepb.BulkRequest_ADDED,
		}

		opts.Progress(count, fmt.Sprintf("%s (%d)", pl.name, len(req.Value)))
		count++

		err = stream.Send(req)
		if err != nil {
			if errors.Is(err, io.EOF) {
				err = nil
			}
			return err
		}
	}
	opts.Progress(-2, fmt.Sprintf("finished playlists... (%d)", len(playlists)))
	return nil
}

type playlistQuery struct {
	OrgID int64
}

type sqlPlaylistQuery struct {
	sqltemplate.SQLTemplate
	Query *playlistQuery

	PlaylistTable     string
	PlaylistItemTable string
}

func (r sqlPlaylistQuery) Validate() error {
	return nil
}

func newPlaylistQueryReq(sql *legacysql.LegacyDatabaseHelper, query *playlistQuery) sqlPlaylistQuery {
	return sqlPlaylistQuery{
		SQLTemplate: sqltemplate.New(sql.DialectForDriver()),
		Query:       query,

		PlaylistTable:     sql.Table("playlist"),
		PlaylistItemTable: sql.Table("playlist_item"),
	}
}

func (m *playlistMigrator) listPlaylists(ctx context.Context, orgID int64) (*sql.Rows, error) {
	helper, err := m.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newPlaylistQueryReq(helper, &playlistQuery{
		OrgID: orgID,
	})

	rawQuery, err := sqltemplate.Execute(sqlQueryPlaylists, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQueryPlaylists.Name(), err)
	}

	return helper.DB.GetSqlxSession().Query(ctx, rawQuery, req.GetArgs()...)
}
