package sqlstore

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"database/sql"
	"encoding/binary"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

func workloadIdentitySettings() *azsettings.AzureSettings {
	return &azsettings.AzureSettings{
		WorkloadIdentityEnabled:  true,
		WorkloadIdentitySettings: &azsettings.WorkloadIdentitySettings{},
	}
}

func TestConfigureAzureEntraAuth(t *testing.T) {
	cloudWithoutOssrdbms := workloadIdentitySettings()
	cloudWithoutOssrdbms.Cloud = "custom"
	require.NoError(t, cloudWithoutOssrdbms.SetCustomClouds(`[{"name": "custom", "aadAuthority": "https://login.custom/", "properties": {}}]`))

	entra := func(dbCfg DatabaseConfig) DatabaseConfig {
		dbCfg.AzureEntraAuth = true
		if dbCfg.Type == "" {
			dbCfg.Type = migrator.MySQL
		}
		return dbCfg
	}

	testCases := []struct {
		name  string
		dbCfg DatabaseConfig
		azure *azsettings.AzureSettings
		err   string
	}{
		{
			name:  "disabled",
			dbCfg: DatabaseConfig{Type: migrator.Postgres, Pwd: "password"},
		},
		{
			name:  "workload identity",
			dbCfg: entra(DatabaseConfig{SslMode: "true"}),
			azure: workloadIdentitySettings(),
		},
		{
			name:  "managed identity",
			dbCfg: entra(DatabaseConfig{SslMode: "true"}),
			azure: &azsettings.AzureSettings{ManagedIdentityEnabled: true, ManagedIdentityClientId: "client-id"},
		},
		{
			name:  "TLS without certificate verification",
			dbCfg: entra(DatabaseConfig{SslMode: "skip-verify"}),
			azure: workloadIdentitySettings(),
		},
		{
			name:  "Postgres",
			dbCfg: entra(DatabaseConfig{Type: migrator.Postgres, SslMode: "verify-full"}),
			azure: workloadIdentitySettings(),
			err:   `only supported with database type "mysql", not "postgres"`,
		},
		{
			name:  "SQLite",
			dbCfg: entra(DatabaseConfig{Type: migrator.SQLite}),
			azure: workloadIdentitySettings(),
			err:   `only supported with database type "mysql", not "sqlite3"`,
		},
		{
			name:  "password set",
			dbCfg: entra(DatabaseConfig{SslMode: "true", Pwd: "password"}),
			azure: workloadIdentitySettings(),
			err:   "remove the database password",
		},
		{
			name:  "connection_string set",
			dbCfg: entra(DatabaseConfig{SslMode: "true", ConnectionString: "grafana@tcp(localhost)/grafana"}),
			azure: workloadIdentitySettings(),
			err:   "can't be combined with connection_string",
		},
		{
			name:  "TLS not configured",
			dbCfg: entra(DatabaseConfig{}),
			azure: workloadIdentitySettings(),
			err:   "requires ssl_mode = true",
		},
		{
			name:  "TLS disabled",
			dbCfg: entra(DatabaseConfig{SslMode: "false"}),
			azure: workloadIdentitySettings(),
			err:   "requires ssl_mode = true",
		},
		{
			name:  "no identity enabled in [azure]",
			dbCfg: entra(DatabaseConfig{SslMode: "true"}),
			azure: &azsettings.AzureSettings{},
			err:   "enable workload_identity_enabled or managed_identity_enabled in [azure]",
		},
		{
			name:  "no Azure settings",
			dbCfg: entra(DatabaseConfig{SslMode: "true"}),
			err:   "azure settings are missing",
		},
		{
			name:  "cloud without a database resource ID",
			dbCfg: entra(DatabaseConfig{SslMode: "true"}),
			azure: cloudWithoutOssrdbms,
			err:   `the Azure cloud "custom" has no "ossrdbmsResourceId" property`,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.Azure = tc.azure
			dbCfg := tc.dbCfg

			err := dbCfg.configureAzureEntraAuth(cfg)

			if tc.err != "" {
				require.ErrorContains(t, err, tc.err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, dbCfg.AzureEntraAuth, dbCfg.azureEntraToken != nil)
		})
	}
}

func TestNewDatabaseConfigWithAzureEntraAuth(t *testing.T) {
	t.Run("builds a connection string without a password", func(t *testing.T) {
		cfg := makeAzureEntraTestConfig(t, map[string]string{
			"ssl_mode":         "true",
			"ca_cert_path":     writeTestCACert(t),
			"server_cert_name": "grafana.mysql.database.azure.com",
		})

		dbCfg, err := NewDatabaseConfig(cfg, nil)
		require.NoError(t, err)

		assert.True(t, dbCfg.AzureEntraAuth)
		assert.NotNil(t, dbCfg.azureEntraToken)
		assert.True(t, strings.HasPrefix(dbCfg.ConnectionString, "grafana:@tcp(grafana.mysql.database.azure.com:3306)/grafana?"), dbCfg.ConnectionString)
		assert.Contains(t, dbCfg.ConnectionString, "&tls=custom")
	})

	t.Run("names the setting in errors", func(t *testing.T) {
		cfg := makeAzureEntraTestConfig(t, map[string]string{"password": "password", "ssl_mode": "true"})

		_, err := NewDatabaseConfig(cfg, nil)
		require.ErrorContains(t, err, "[database] azure_entra_auth_enabled: remove the database password")
	})
}

func makeAzureEntraTestConfig(t *testing.T, keys map[string]string) *setting.Cfg {
	t.Helper()

	cfg := makeDatabaseTestConfig(t, databaseConfigTest{
		dbType: migrator.MySQL,
		dbHost: "grafana.mysql.database.azure.com:3306",
		dbUser: "grafana",
	})
	sec := cfg.Raw.Section("database")
	sec.Key("name").SetValue("grafana")
	sec.Key("azure_entra_auth_enabled").SetValue("true")
	for k, v := range keys {
		sec.Key(k).SetValue(v)
	}
	cfg.Azure = workloadIdentitySettings()
	return cfg
}

func TestAzureEntraMySQLDriver(t *testing.T) {
	t.Run("signs in with a new token for every connection", func(t *testing.T) {
		server := newFakeAzureMySQL(t)
		tokens := &countingTokens{}

		connector, err := azureEntraMySQLDriver{getToken: tokens.next}.OpenConnector(server.dsn("grafana"))
		require.NoError(t, err)
		db := sql.OpenDB(connector)
		t.Cleanup(func() { require.NoError(t, db.Close()) })
		// Close each connection after use, so that every Ping opens a new one.
		db.SetMaxIdleConns(0)

		require.NoError(t, db.Ping())
		require.NoError(t, db.Ping())

		assert.Equal(t, []string{"token-1", "token-2"}, server.passwords())
	})

	t.Run("sends a token as long as a real one", func(t *testing.T) {
		server := newFakeAzureMySQL(t)
		token := strings.Repeat("x", 3000)

		connector, err := azureEntraMySQLDriver{getToken: staticToken(token)}.OpenConnector(server.dsn("grafana"))
		require.NoError(t, err)
		db := sql.OpenDB(connector)
		t.Cleanup(func() { require.NoError(t, db.Close()) })

		require.NoError(t, db.Ping())
		assert.Equal(t, []string{token}, server.passwords())
	})

	t.Run("ignores a password in the data source name", func(t *testing.T) {
		server := newFakeAzureMySQL(t)

		connector, err := azureEntraMySQLDriver{getToken: staticToken("token")}.OpenConnector(server.dsn("grafana:password"))
		require.NoError(t, err)
		db := sql.OpenDB(connector)
		t.Cleanup(func() { require.NoError(t, db.Close()) })

		require.NoError(t, db.Ping())
		assert.Equal(t, []string{"token"}, server.passwords())
	})

	t.Run("fails the connection when there is no token", func(t *testing.T) {
		server := newFakeAzureMySQL(t)
		getToken := func(context.Context) (string, error) { return "", errors.New("token endpoint unreachable") }

		connector, err := azureEntraMySQLDriver{getToken: getToken}.OpenConnector(server.dsn("grafana"))
		require.NoError(t, err)
		db := sql.OpenDB(connector)
		t.Cleanup(func() { require.NoError(t, db.Close()) })

		err = db.Ping()
		require.ErrorContains(t, err, "failed to get a Microsoft Entra ID access token for the database: token endpoint unreachable")
		assert.Empty(t, server.passwords())
	})

	t.Run("works behind the instrument_queries hooks", func(t *testing.T) {
		server := newFakeAzureMySQL(t)
		tokens := &countingTokens{}
		wrapped := wrapDriverWithHooks(azureEntraMySQLDriver{getToken: tokens.next}, tracing.InitializeTracerForTest())

		db := sql.OpenDB(dsnConnector{dsn: server.dsn("grafana"), drv: wrapped})
		t.Cleanup(func() { require.NoError(t, db.Close()) })
		db.SetMaxIdleConns(0)

		require.NoError(t, db.Ping())
		require.NoError(t, db.Ping())
		assert.Equal(t, []string{"token-1", "token-2"}, server.passwords())
	})
}

func TestDatabaseConfigOpenEngine(t *testing.T) {
	t.Run("with Microsoft Entra ID authentication", func(t *testing.T) {
		server := newFakeAzureMySQL(t)
		dbCfg := &DatabaseConfig{
			Type:             migrator.MySQL,
			ConnectionString: server.dsn("grafana") + "?parseTime=true",
			AzureEntraAuth:   true,
			azureEntraToken:  staticToken("token"),
		}

		engine, err := dbCfg.OpenEngine()
		require.NoError(t, err)
		t.Cleanup(func() { require.NoError(t, engine.Close()) })

		// The dialects are looked up by driver name, so it must not change.
		assert.Equal(t, migrator.MySQL, engine.DriverName())
		require.NoError(t, engine.DB().Ping())
		assert.Equal(t, []string{"token"}, server.passwords())
	})

	t.Run("without a token source", func(t *testing.T) {
		dbCfg := &DatabaseConfig{Type: migrator.MySQL, ConnectionString: "grafana@tcp(localhost)/grafana", AzureEntraAuth: true}

		_, err := dbCfg.OpenEngine()
		require.Error(t, err)
	})

	t.Run("without Microsoft Entra ID authentication", func(t *testing.T) {
		dbCfg := &DatabaseConfig{Type: migrator.SQLite, ConnectionString: "file::memory:"}

		engine, err := dbCfg.OpenEngine()
		require.NoError(t, err)
		t.Cleanup(func() { require.NoError(t, engine.Close()) })

		assert.Equal(t, migrator.SQLite, engine.DriverName())
		require.NoError(t, engine.DB().Ping())
	})
}

func staticToken(token string) azureEntraTokenFunc {
	return func(context.Context) (string, error) { return token, nil }
}

type countingTokens struct {
	mu sync.Mutex
	n  int
}

func (c *countingTokens) next(context.Context) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.n++
	return fmt.Sprintf("token-%d", c.n), nil
}

// fakeAzureMySQL signs clients in the way Azure Database for MySQL does for a
// Microsoft Entra ID user: the handshake offers mysql_native_password, then the server
// switches the client to mysql_clear_password and takes the password it sends as the
// access token. It records those passwords and answers every command with OK.
type fakeAzureMySQL struct {
	listener net.Listener

	mu       sync.Mutex
	received []string
}

func newFakeAzureMySQL(t *testing.T) *fakeAzureMySQL {
	t.Helper()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	t.Cleanup(func() { _ = listener.Close() })

	s := &fakeAzureMySQL{listener: listener}
	go s.serve()
	return s
}

func (s *fakeAzureMySQL) dsn(userInfo string) string {
	return fmt.Sprintf("%s@tcp(%s)/grafana", userInfo, s.listener.Addr())
}

func (s *fakeAzureMySQL) passwords() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]string(nil), s.received...)
}

func (s *fakeAzureMySQL) serve() {
	for {
		conn, err := s.listener.Accept()
		if err != nil {
			return
		}
		go s.handle(conn)
	}
}

const (
	fakeClientLongPassword  = 0x00000001
	fakeClientProtocol41    = 0x00000200
	fakeClientTransactions  = 0x00002000
	fakeClientSecureConn    = 0x00008000
	fakeClientPluginAuth    = 0x00080000
	fakeServerAutocommit    = 0x0002
	fakeComQuit             = 0x01
	fakeAuthSwitchRequest   = 0xfe
	fakeCollationUTF8MB4Bin = 0x2e
)

// fakeOKPacket is an OK packet: no affected rows, no insert ID, autocommit, no warnings.
var fakeOKPacket = []byte{0x00, 0x00, 0x00, fakeServerAutocommit, 0x00, 0x00, 0x00}

func (s *fakeAzureMySQL) handle(conn net.Conn) {
	defer func() { _ = conn.Close() }()

	capabilities := uint32(fakeClientLongPassword | fakeClientProtocol41 | fakeClientTransactions | fakeClientSecureConn | fakeClientPluginAuth)
	authData := []byte("abcdefghijklmnopqrst")

	// Initial handshake, protocol version 10.
	handshake := []byte{10}
	handshake = append(handshake, "8.0.0-fake\x00"...)
	handshake = binary.LittleEndian.AppendUint32(handshake, 1) // connection ID
	handshake = append(handshake, authData[:8]...)
	handshake = append(handshake, 0)
	handshake = binary.LittleEndian.AppendUint16(handshake, uint16(capabilities))
	handshake = append(handshake, fakeCollationUTF8MB4Bin)
	handshake = binary.LittleEndian.AppendUint16(handshake, fakeServerAutocommit)
	handshake = binary.LittleEndian.AppendUint16(handshake, uint16(capabilities>>16))
	handshake = append(handshake, byte(len(authData)+1))
	handshake = append(handshake, make([]byte, 10)...)
	handshake = append(handshake, authData[8:]...)
	handshake = append(handshake, 0)
	handshake = append(handshake, "mysql_native_password\x00"...)
	if writeFakePacket(conn, 0, handshake) != nil {
		return
	}

	// The handshake response: the password scrambled for mysql_native_password.
	if _, err := readFakePacket(conn); err != nil {
		return
	}

	switchRequest := append([]byte{fakeAuthSwitchRequest}, "mysql_clear_password\x00"...)
	if writeFakePacket(conn, 2, switchRequest) != nil {
		return
	}
	password, err := readFakePacket(conn)
	if err != nil {
		return
	}
	s.mu.Lock()
	s.received = append(s.received, strings.TrimSuffix(string(password), "\x00"))
	s.mu.Unlock()
	if writeFakePacket(conn, 4, fakeOKPacket) != nil {
		return
	}

	for {
		command, err := readFakePacket(conn)
		if err != nil || len(command) == 0 || command[0] == fakeComQuit {
			return
		}
		if writeFakePacket(conn, 1, fakeOKPacket) != nil {
			return
		}
	}
}

func readFakePacket(r io.Reader) ([]byte, error) {
	var header [4]byte
	if _, err := io.ReadFull(r, header[:]); err != nil {
		return nil, err
	}
	payload := make([]byte, int(header[0])|int(header[1])<<8|int(header[2])<<16)
	_, err := io.ReadFull(r, payload)
	return payload, err
}

func writeFakePacket(w io.Writer, sequence byte, payload []byte) error {
	header := []byte{byte(len(payload)), byte(len(payload) >> 8), byte(len(payload) >> 16), sequence}
	_, err := w.Write(append(header, payload...))
	return err
}

func writeTestCACert(t *testing.T) string {
	t.Helper()

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	template := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "Test CA"},
		NotBefore:             time.Now(),
		NotAfter:              time.Now().Add(time.Hour),
		IsCA:                  true,
		BasicConstraintsValid: true,
	}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	require.NoError(t, err)

	path := filepath.Join(t.TempDir(), "ca.pem")
	require.NoError(t, os.WriteFile(path, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0o600))
	return path
}
