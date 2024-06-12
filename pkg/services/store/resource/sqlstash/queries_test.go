package sqlstash

import (
	"context"
	"embed"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	playlist "github.com/grafana/grafana/pkg/apis/playlist/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/services/store/resource"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestSQLCommands(t *testing.T) {
	ctx := appcontext.WithUser(context.Background(), &user.SignedInUser{
		UserID:  123,
		UserUID: "u123",
		OrgRole: roletype.RoleAdmin,
	})
	validator := resource.NewEventValidator(resource.EventValidatorOptions{
		// no folders for now
	})

	t.Run("insert playlist SQL", func(t *testing.T) {
		input := testdataFromJSON(t, "01_create_playlist.json", &playlist.Playlist{})
		key, err := resource.ObjectKey(playlist.PlaylistResourceInfo.GroupResource(), input)
		require.NoError(t, err)

		req := &resource.CreateRequest{Key: key, Message: "test commit"}
		req.Value, err = json.Marshal(input)
		require.NoError(t, err)
		require.Equal(t, "default/playlist.grafana.app/playlists/fdgsv37qslr0ga", key.NamespacedPath())

		evt, err := validator.PrepareCreate(ctx, req)
		require.NoError(t, err)
		require.NoError(t, evt.Error)
		require.Nil(t, evt.Error)
	})
}

//go:embed testdata/*
var testdataFS embed.FS

func testdata(t *testing.T, filename string) []byte {
	t.Helper()
	b, err := testdataFS.ReadFile(`testdata/` + filename)
	require.NoError(t, err)

	return b
}

func testdataFromJSON[T any](t *testing.T, filename string, dest T) T {
	t.Helper()
	b := testdata(t, filename)
	err := json.Unmarshal(b, dest)
	require.NoError(t, err)
	return dest
}
