package playlistimpl

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/user"
)

// This is a playlist implementation that will:
// 1. CREATE/UPDATE/DELETE everythign with existing direct SQL store
// 2. CREATE/UPDATE/DELETE same items to the object store
// 3. Use the object store for all read operations
// This givs us a safe test bed to work with the store but still roll back without any lost work
type entityStoreImpl struct {
	sess    *session.SessionDB
	sqlimpl *Service
	store   entity.EntityStoreServer
}

var _ playlist.Service = &entityStoreImpl{}

func (s *entityStoreImpl) sync() {
	type Info struct {
		OrgID int64  `db:"org_id"`
		UID   string `db:"uid"`
	}
	results := []Info{}
	err := s.sess.Select(context.Background(), &results, "SELECT org_id,uid FROM playlist ORDER BY org_id asc")
	if err != nil {
		fmt.Printf("error loading playlists")
		return
	}

	// Change the org_id with each row
	rowUser := &user.SignedInUser{
		OrgID:          0, // gets filled in from each row
		UserID:         0, // Admin user
		IsGrafanaAdmin: true,
	}
	ctx := appcontext.WithUser(context.Background(), rowUser)
	for _, info := range results {
		dto, err := s.sqlimpl.Get(ctx, &playlist.GetPlaylistByUidQuery{
			OrgId: info.OrgID,
			UID:   info.UID,
		})
		if err != nil {
			fmt.Printf("error loading playlist: %v", err)
			return
		}
		body, _ := json.Marshal(dto)
		_, _ = s.store.Write(ctx, &entity.WriteEntityRequest{
			GRN: &entity.GRN{
				TenantId: info.OrgID,
				UID:      info.UID,
				Kind:     entity.StandardKindPlaylist,
			},
			Body: body,
		})
	}
}

func (s *entityStoreImpl) Create(ctx context.Context, cmd *playlist.CreatePlaylistCommand) (*playlist.Playlist, error) {
	rsp, err := s.sqlimpl.store.Insert(ctx, cmd)
	if err == nil && rsp != nil {
		body, err := json.Marshal(cmd)
		if err != nil {
			return rsp, fmt.Errorf("unable to write playlist to store")
		}
		_, err = s.store.Write(ctx, &entity.WriteEntityRequest{
			GRN: &entity.GRN{
				Kind: entity.StandardKindPlaylist,
				UID:  rsp.UID,
			},
			Body: body,
		})
		if err != nil {
			return rsp, fmt.Errorf("unable to write playlist to store")
		}
	}
	return rsp, err
}

func (s *entityStoreImpl) Update(ctx context.Context, cmd *playlist.UpdatePlaylistCommand) (*playlist.PlaylistDTO, error) {
	rsp, err := s.sqlimpl.store.Update(ctx, cmd)
	if err == nil {
		body, err := json.Marshal(cmd)
		if err != nil {
			return rsp, fmt.Errorf("unable to write playlist to store")
		}
		_, err = s.store.Write(ctx, &entity.WriteEntityRequest{
			GRN: &entity.GRN{
				UID:  rsp.Uid,
				Kind: entity.StandardKindPlaylist,
			},
			Body: body,
		})
		if err != nil {
			return rsp, fmt.Errorf("unable to write playlist to store")
		}
	}
	return rsp, err
}

func (s *entityStoreImpl) Delete(ctx context.Context, cmd *playlist.DeletePlaylistCommand) error {
	err := s.sqlimpl.store.Delete(ctx, cmd)
	if err == nil {
		_, err = s.store.Delete(ctx, &entity.DeleteEntityRequest{
			GRN: &entity.GRN{
				UID:  cmd.UID,
				Kind: entity.StandardKindPlaylist,
			},
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

func (s *entityStoreImpl) GetWithoutItems(ctx context.Context, q *playlist.GetPlaylistByUidQuery) (*playlist.Playlist, error) {
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

func (s *entityStoreImpl) Get(ctx context.Context, q *playlist.GetPlaylistByUidQuery) (*playlist.PlaylistDTO, error) {
	rsp, err := s.store.Read(ctx, &entity.ReadEntityRequest{
		GRN: &entity.GRN{
			UID:  q.UID,
			Kind: entity.StandardKindPlaylist,
		},
		WithBody: true,
	})
	if err != nil {
		return nil, err
	}
	if rsp == nil || rsp.Body == nil {
		return nil, fmt.Errorf("missing object")
	}

	// Get the object from payload
	found := &playlist.PlaylistDTO{}
	err = json.Unmarshal(rsp.Body, found)
	return found, err
}

func (s *entityStoreImpl) Search(ctx context.Context, q *playlist.GetPlaylistsQuery) (playlist.Playlists, error) {
	playlists := make(playlist.Playlists, 0)

	rsp, err := s.store.Search(ctx, &entity.EntitySearchRequest{
		Kind:     []string{entity.StandardKindPlaylist},
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
			UID:      res.GRN.UID,
			Name:     res.Name,
			Interval: found.Interval,
		})
	}
	return playlists, err
}
