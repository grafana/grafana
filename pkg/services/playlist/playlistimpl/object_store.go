package playlistimpl

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/grn"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	objectstore "github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/store/object"
	"github.com/grafana/grafana/pkg/services/user"
)

// This is a playlist implementation that will:
// 1. CREATE/UPDATE/DELETE everythign with existing direct SQL store
// 2. CREATE/UPDATE/DELETE same items to the object store
// 3. Use the object store for all read operations
// This givs us a safe test bed to work with the store but still roll back without any lost work
type objectStoreImpl struct {
	sess        *session.SessionDB
	sqlimpl     *Service
	objectstore object.ObjectStoreServer
}

var _ playlist.Service = &objectStoreImpl{}

func (s *objectStoreImpl) sync() {
	rows, err := s.sess.Query(context.Background(), "SELECT org_id,uid FROM playlist ORDER BY org_id asc")
	if err != nil {
		fmt.Printf("error loading playlists")
		return
	}

	// Change the org_id with each row
	rowUser := &user.SignedInUser{
		Login:  "?",
		OrgID:  0, // gets filled in from each row
		UserID: 0,
	}
	ctx := objectstore.ContextWithUser(context.Background(), rowUser)
	uid := ""
	for rows.Next() {
		err = rows.Scan(&rowUser.OrgID, &uid)
		if err != nil {
			fmt.Printf("error loading playlists: %v", err)
			return
		}

		dto, err := s.sqlimpl.Get(ctx, &playlist.GetPlaylistByUidQuery{
			OrgId: rowUser.OrgID,
			UID:   uid,
		})
		if err != nil {
			fmt.Printf("error loading playlist: %v", err)
			return
		}
		body, _ := json.Marshal(dto)
		_, _ = s.objectstore.Write(ctx, &object.WriteObjectRequest{
			GRN: grn.GRN{
				TenantID:           rowUser.OrgID,
				ResourceKind:       models.StandardKindPlaylist,
				ResourceIdentifier: uid,
			}.String(),
			Body: body,
		})
	}
}

func (s *objectStoreImpl) Create(ctx context.Context, cmd *playlist.CreatePlaylistCommand) (*playlist.Playlist, error) {
	rsp, err := s.sqlimpl.store.Insert(ctx, cmd)
	if err == nil && rsp != nil {
		body, err := json.Marshal(cmd)
		if err != nil {
			return rsp, fmt.Errorf("unable to write playlist to store")
		}
		_, err = s.objectstore.Write(ctx, &object.WriteObjectRequest{
			GRN: grn.GRN{
				TenantID:           cmd.OrgId,
				ResourceKind:       models.StandardKindPlaylist,
				ResourceIdentifier: rsp.UID,
			}.String(),
			Body: body,
		})
		if err != nil {
			return rsp, fmt.Errorf("unable to write playlist to store")
		}
	}
	return rsp, err
}

func (s *objectStoreImpl) Update(ctx context.Context, cmd *playlist.UpdatePlaylistCommand) (*playlist.PlaylistDTO, error) {
	rsp, err := s.sqlimpl.store.Update(ctx, cmd)
	if err == nil {
		body, err := json.Marshal(cmd)
		if err != nil {
			return rsp, fmt.Errorf("unable to write playlist to store")
		}
		_, err = s.objectstore.Write(ctx, &object.WriteObjectRequest{
			GRN: grn.GRN{
				TenantID:           cmd.OrgId,
				ResourceKind:       models.StandardKindPlaylist,
				ResourceIdentifier: rsp.Uid,
			}.String(),
			Body: body,
		})
		if err != nil {
			return rsp, fmt.Errorf("unable to write playlist to store")
		}
	}
	return rsp, err
}

func (s *objectStoreImpl) Delete(ctx context.Context, cmd *playlist.DeletePlaylistCommand) error {
	err := s.sqlimpl.store.Delete(ctx, cmd)
	if err == nil {
		_, err = s.objectstore.Delete(ctx, &object.DeleteObjectRequest{
			GRN: grn.GRN{
				TenantID:           cmd.OrgId,
				ResourceKind:       models.StandardKindPlaylist,
				ResourceIdentifier: cmd.UID,
			}.String(),
		})
		if err != nil {
			return fmt.Errorf("unable to delete playlist to store")
		}
	}
	return err
}

//------------------------------------------------------
// Read access is managed entirely by the object store
//------------------------------------------------------

func (s *objectStoreImpl) GetWithoutItems(ctx context.Context, q *playlist.GetPlaylistByUidQuery) (*playlist.Playlist, error) {
	p, err := s.Get(ctx, q) // OrgID is actually picked from the user!
	if err != nil {
		return nil, err
	}
	return &playlist.Playlist{
		UID:      p.Uid,
		OrgId:    q.OrgId,
		Name:     p.Name,
		Interval: p.Interval,
	}, nil
}

func (s *objectStoreImpl) Get(ctx context.Context, q *playlist.GetPlaylistByUidQuery) (*playlist.PlaylistDTO, error) {
	rsp, err := s.objectstore.Read(ctx, &object.ReadObjectRequest{
		GRN: grn.GRN{
			TenantID:           q.OrgId,
			ResourceKind:       models.StandardKindPlaylist,
			ResourceIdentifier: q.UID,
		}.String(),
		WithBody: true,
	})
	if err != nil {
		return nil, err
	}
	if rsp.Object == nil || rsp.Object.Body == nil {
		return nil, fmt.Errorf("missing object")
	}

	// Get the object from payload
	found := &playlist.PlaylistDTO{}
	err = json.Unmarshal(rsp.Object.Body, found)
	return found, err
}

func (s *objectStoreImpl) Search(ctx context.Context, q *playlist.GetPlaylistsQuery) (playlist.Playlists, error) {
	playlists := make(playlist.Playlists, 0)

	rsp, err := s.objectstore.Search(ctx, &object.ObjectSearchRequest{
		Kind:     []string{models.StandardKindPlaylist},
		WithBody: true,
		Limit:    1000,
	})
	if err != nil {
		return nil, err
	}
	for _, res := range rsp.Results {
		found := &playlist.PlaylistDTO{}
		if res.Body != nil {
			err = json.Unmarshal(res.Body, found)
		}
		playlists = append(playlists, &playlist.Playlist{
			UID:      res.UID,
			Name:     res.Name,
			Interval: found.Interval,
		})
	}
	return playlists, err
}
