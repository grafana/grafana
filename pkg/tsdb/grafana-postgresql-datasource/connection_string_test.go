package postgres

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/tsdb/grafana-postgresql-datasource/sqleng"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGenerateConnectionString(t *testing.T) {
	tests := []struct {
		name        string
		dsInfo      sqleng.DataSourceInfo
		tlsSettings *tlsSettings
		want        string
		wantErr     error
	}{
		{
			name: "default settings shouldn't throw error",
			want: "user='' password='' host='' dbname='' sslmode=''",
		},
		{
			name:        "default settings with host, port, dbname",
			dsInfo:      sqleng.DataSourceInfo{URL: "host:1234", User: "user", Database: "db", DecryptedSecureJSONData: map[string]string{"password": "pass"}},
			tlsSettings: &tlsSettings{Mode: "require"},
			want:        "user='user' password='pass' host='host' dbname='db' port=1234 sslmode='require'",
		},
		{
			name:        "default settings with host, port, dbname",
			dsInfo:      sqleng.DataSourceInfo{URL: "host:1234", User: "user", Database: "db", DecryptedSecureJSONData: map[string]string{"password": "pass"}},
			tlsSettings: &tlsSettings{Mode: "verify-ca", ConfigurationMethod: "file-content", RootCertFile: "root", CertFile: "cert", CertKeyFile: "key"},
			want:        "user='user' password='pass' host='host' dbname='db' port=1234 sslmode='verify-ca' sslsni=0 sslrootcert='root' sslcert='cert' sslkey='key'",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tlssettings := tt.tlsSettings
			if tlssettings == nil {
				tlssettings = &tlsSettings{}
			}
			tlsManager := &tlsTestManager{settings: *tlssettings}
			got, err := GenerateConnectionString(tt.dsInfo, tlsManager, log.DefaultLogger)
			if tt.wantErr != nil {
				require.NotNil(t, err)
				assert.Equal(t, tt.wantErr, err)
				return
			}
			require.Nil(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}

func Test_removeTLSSettingsFromConnectionString(t *testing.T) {
	tests := []struct {
		name    string
		connStr string
		want    string
		wantErr error
	}{
		{
			name:    "should send original connection string if no ssl settings present",
			connStr: "postgres://bob:secret@1.2.3.4:5432/mydb",
			want:    "dbname='mydb' host='1.2.3.4' password='secret' port='5432' user='bob'",
		},
		{
			name:    "should remove sslmode",
			connStr: "postgres://bob:secret@1.2.3.4:5432/mydb?sslmode=verify-full",
			want:    "dbname='mydb' host='1.2.3.4' password='secret' port='5432' user='bob'",
		},
		{
			name:    "should respect case sensitive password",
			connStr: "postgres://bob:sEcret@1.2.3.4:5432/mydb?sslmode=verify-full",
			want:    "dbname='mydb' host='1.2.3.4' password='sEcret' port='5432' user='bob'",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := removeTLSSettingsFromConnectionString(tt.connStr)
			if tt.wantErr != nil {
				require.NotNil(t, err)
				assert.Equal(t, tt.wantErr, err)
				return
			}
			require.Nil(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}
