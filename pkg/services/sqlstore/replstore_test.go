package sqlstore

import (
	"fmt"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/setting"
)

func TestReplStore_ReadReplica(t *testing.T) {
	// Using the connection strings to differentiate between the replicas
	replStore, _ := InitTestReplDB(t)
	replStore.repls[0].dbCfg.ConnectionString = "repl0"

	repl1 := &SQLStore{dbCfg: &DatabaseConfig{ConnectionString: "repl1"}}
	repl2 := &SQLStore{dbCfg: &DatabaseConfig{ConnectionString: "repl2"}}
	replStore.repls = append(replStore.repls, repl1, repl2)

	got := make([]string, 5)
	for i := 0; i < 5; i++ {
		got[i] = replStore.ReadReplica().dbCfg.ConnectionString
	}

	want := []string{"repl0", "repl1", "repl2", "repl0", "repl1"}
	if cmp.Equal(got, want) == false {
		t.Fatal("wrong result. Got:", got, "Want:", want)
	}
}

func TestNewRODatabaseConfig(t *testing.T) {
	t.Run("valid config", func(t *testing.T) {
		inicfg, err := ini.Load([]byte(testReplCfg))
		require.NoError(t, err)
		cfg, err := setting.NewCfgFromINIFile(inicfg)
		require.NoError(t, err)

		dbCfgs, err := NewRODatabaseConfigs(cfg, nil)
		require.NoError(t, err)

		var connStr = func(port int) string {
			return fmt.Sprintf("grafana:password@tcp(127.0.0.1:%d)/grafana?collation=utf8mb4_unicode_ci&allowNativePasswords=true&clientFoundRows=true", port)
		}

		for i, c := range dbCfgs {
			if !cmp.Equal(c.ConnectionString, connStr(i+3306)) {
				t.Errorf("wrong result for connection string %d.\nGot: %s,\nWant: %s", i, c.ConnectionString, connStr(i+3306))
			}
		}
	})
}

var testReplCfg = `
[database_replicas]
type = mysql
name = grafana
user = grafana
password = password
host = 127.0.0.1:3306
[database_replicas.one] =
host = 127.0.0.1:3307
[database_replicas.two] =
host = 127.0.0.1:3308`
