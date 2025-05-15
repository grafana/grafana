//go:build enterprise
// +build enterprise

package encryption

import (
	"encoding/base64"
	"fmt"
	"hash/fnv"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestIntegration_AdminApiReencrypt_Enterprise(t *testing.T) {
	t.Skip("This test is currently broken, investigating...")

	getSecretsFunctions := map[string]func(*testing.T, *server.TestEnv) map[int]secret{}
	getSecretsFunctions["settings"] = func(t *testing.T, env *server.TestEnv) map[int]secret {
		return getSettingSecrets(t, env.SQLStore)
	}

	setup := func(t *testing.T, env *server.TestEnv, grafanaListenAddr string) {
		createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
			DefaultOrgRole: string(org.RoleAdmin),
			Password:       "admin",
			Login:          "admin",
			IsAdmin:        true,
		})

		addSetting(t, grafanaListenAddr)
	}

	RunAdminApiReencryptTest(t, setup, getSecretsFunctions)
}

func addSetting(t *testing.T, grafanaListenAddr string) {
	body := `
		{
		  "updates": {
			"auth.saml": {
			  "enabled": "true",
			  "single_logout": "false"
			}
		  }
		}
	`

	url := fmt.Sprintf("http://admin:admin@%s/api/admin/settings", grafanaListenAddr)

	req, err := http.NewRequest("PUT", url, strings.NewReader(body))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	require.NoError(t, resp.Body.Close())
	require.Equal(t, http.StatusOK, resp.StatusCode)
}

func getSettingSecrets(t *testing.T, store db.DB) map[int]secret {
	var rows []struct {
		Section        string
		Key            string
		EncryptedValue string
	}

	err := store.WithDbSession(t.Context(), func(sess *db.Session) error {
		return sess.Table("setting").Select("section, key, encrypted_value").OrderBy("section, key").Find(&rows)
	})
	require.NoError(t, err)

	result := map[int]secret{}
	for _, r := range rows {
		d, err := base64.StdEncoding.DecodeString(r.EncryptedValue)
		require.NoError(t, err)

		// we don't care about hash collisions, as long as we use the same ordering, we check the same values.
		id := int(hash(r.Section + ":" + r.Key))
		result[id] = secret{
			id:     id,
			secret: d,
			// no update time
		}
	}
	return result
}

func hash(s string) uint32 {
	h := fnv.New32a()
	_, _ = h.Write([]byte(s))
	return h.Sum32()
}
