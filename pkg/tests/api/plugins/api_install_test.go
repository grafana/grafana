package plugins

import (
	"bytes"
	"context"
	"fmt"
	"io/ioutil"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/tests/testinfra"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var (
	usernameAdmin    = "admin"
	usernameNonAdmin = "nonAdmin"
	defaultPassword  = "password"
)

func TestPluginInstallAccess(t *testing.T) {
	dir, path := testinfra.CreateGrafDir(t)
	store := testinfra.SetUpDatabase(t, dir)
	store.Bus = bus.GetBus()
	grafanaListedAddr := testinfra.StartGrafana(t, dir, path, store)

	require.NoError(t, createUser(t, store, usernameNonAdmin, defaultPassword, false))
	require.NoError(t, createUser(t, store, usernameAdmin, defaultPassword, true))

	t.Run("Cannot install or uninstall plugin if request is not from an admin", func(t *testing.T) {
		statusCode, body, err := makePOSTRequest(t, grafanaAPIURL(usernameNonAdmin, grafanaListedAddr, "plugins/grafana-plugin/install"))
		require.NoError(t, err)

		assert.Equal(t, 403, statusCode)
		assert.Equal(t, "{\n  \"message\": \"Permission denied\"\n}", body)

		statusCode, body, err = makePOSTRequest(t, grafanaAPIURL(usernameNonAdmin, grafanaListedAddr, "plugins/grafana-plugin/uninstall"))
		require.NoError(t, err)

		assert.Equal(t, 403, statusCode)
		assert.Equal(t, "{\n  \"message\": \"Permission denied\"\n}", body)
	})

	t.Run("Can install or uninstall plugin if request is from an admin", func(t *testing.T) {
		statusCode, body, err := makePOSTRequest(t, grafanaAPIURL(usernameAdmin, grafanaListedAddr, "plugins/test/install"))
		require.NoError(t, err)

		assert.Equal(t, 404, statusCode)
		assert.Nil(t, body)
	})
}

func createUser(t *testing.T, store *sqlstore.SQLStore, username, password string, isAdmin bool) error {
	t.Helper()

	cmd := models.CreateUserCommand{
		Login:    username,
		Password: password,
		IsAdmin:  isAdmin,
	}
	_, err := store.CreateUser(context.Background(), cmd)
	return err
}

func makePOSTRequest(t *testing.T, URL string) (int, string, error) {
	resp, err := http.Post(URL, "application/json", bytes.NewBufferString(""))
	require.NoError(t, err)
	t.Cleanup(func() {
		err := resp.Body.Close()
		require.NoError(t, err)
	})
	b, err := ioutil.ReadAll(resp.Body)

	return resp.StatusCode, string(b), err
}

func grafanaAPIURL(username string, grafanaListedAddr string, path string) string {
	return fmt.Sprintf("http://%s:%s@%s/api/%s", username, defaultPassword, grafanaListedAddr, path)
}
