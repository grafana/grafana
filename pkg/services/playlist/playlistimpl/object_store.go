package playlistimpl

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/store/object"
)

// This is a playlist implementation that will:
// 1. CREATE/UPDATE/DELETE everythign with existing direct SQL store
// 2. CREATE/UPDATE/DELETE same items to the object store
// 3. Use the object store for all read operations
// This givs us a safe test bed to work with the store but still roll back without any lost work
type objectStoreImpl struct {
	sess   *session.SessionDB
	backup store // raw SQL store
	server object.ObjectStoreServer
}

var _ playlist.Service = &objectStoreImpl{}

func (s *objectStoreImpl) sync() {
	rows, err := s.sess.Query(context.Background(), "SELECT orgId,uid FROM playlist ORDER BY orgId asc")
	if err != nil {
		fmt.Printf("error loading playlists")
		return
	}
	orgId := int64(0)
	uid := ""
	for rows.Next() {
		err = rows.Scan(&orgId, &uid)
		if err != nil {
			fmt.Printf("error loading playlists")
			return
		}
		fmt.Printf("GOT: %d/%s\n", orgId, uid)
	}
}

func (s *objectStoreImpl) Create(ctx context.Context, cmd *playlist.CreatePlaylistCommand) (*playlist.Playlist, error) {
	rsp, err := s.backup.Insert(ctx, cmd)
	if err == nil && rsp != nil {
		body, err := json.Marshal(cmd)
		if err != nil {
			return rsp, fmt.Errorf("unable to write playlist to store")
		}
		_, err = s.server.Write(ctx, &object.WriteObjectRequest{
			UID:  rsp.UID,
			Kind: models.StandardKindPlaylist,
			Body: body,
		})
		if err != nil {
			return rsp, fmt.Errorf("unable to write playlist to store")
		}
	}
	return rsp, err
}

func (s *objectStoreImpl) Update(ctx context.Context, cmd *playlist.UpdatePlaylistCommand) (*playlist.PlaylistDTO, error) {
	rsp, err := s.backup.Update(ctx, cmd)
	if err == nil {
		body, err := json.Marshal(rsp)
		if err != nil {
			return rsp, fmt.Errorf("unable to write playlist to store")
		}
		_, err = s.server.Write(ctx, &object.WriteObjectRequest{
			UID:  rsp.Uid,
			Kind: models.StandardKindPlaylist,
			Body: body,
		})
		if err != nil {
			return rsp, fmt.Errorf("unable to write playlist to store")
		}
	}
	return rsp, err
}

func (s *objectStoreImpl) Delete(ctx context.Context, cmd *playlist.DeletePlaylistCommand) error {
	err := s.backup.Delete(ctx, cmd)
	if err == nil {
		_, err = s.server.Delete(ctx, &object.DeleteObjectRequest{
			UID:  cmd.UID,
			Kind: models.StandardKindPlaylist,
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
	rsp, err := s.server.Read(ctx, &object.ReadObjectRequest{
		UID:      q.UID,
		Kind:     models.StandardKindPlaylist,
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

	rsp, err := s.server.Search(ctx, &object.ObjectSearchRequest{
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
