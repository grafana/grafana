package fsql

import (
	"context"
	"database/sql"
	"encoding/json"
	"net"
	"testing"

	"github.com/apache/arrow-go/v18/arrow/flight"
	"github.com/apache/arrow-go/v18/arrow/flight/flightsql"
	"github.com/apache/arrow-go/v18/arrow/flight/flightsql/example"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/proxy"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"

	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
)

type FSQLTestSuite struct {
	suite.Suite
	db     *sql.DB
	server flight.Server
	addr   string
}

func (suite *FSQLTestSuite) SetupTest() {
	addr, _ := freeport(suite.T())

	suite.addr = addr

	db, err := example.CreateDB()
	require.NoError(suite.T(), err)

	sqliteServer, err := example.NewSQLiteFlightSQLServer(db)
	require.NoError(suite.T(), err)
	sqliteServer.Alloc = memory.NewCheckedAllocator(memory.DefaultAllocator)
	server := flight.NewServerWithMiddleware(nil)
	server.RegisterFlightService(flightsql.NewFlightServer(sqliteServer))
	err = server.Init(suite.addr)
	require.NoError(suite.T(), err)
	go func() {
		err := server.Serve()
		require.NoError(suite.T(), err)
	}()
	suite.db = db
	suite.server = server
}

func (suite *FSQLTestSuite) AfterTest(suiteName, testName string) {
	err := suite.db.Close()
	require.NoError(suite.T(), err)
	suite.server.Shutdown()
}

func TestIntegrationFSQLTestSuite(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	suite.Run(t, new(FSQLTestSuite))
}

func (suite *FSQLTestSuite) TestIntegration_QueryData() {
	suite.Run("should run simple query data", func() {
		resp, err := Query(
			context.Background(),
			&models.DatasourceInfo{
				HTTPClient:   nil,
				Token:        "secret",
				URL:          "http://" + suite.addr,
				DbName:       "influxdb",
				Version:      "test",
				HTTPMode:     "proxy",
				InsecureGrpc: true,
				ProxyClient:  proxy.New(nil),
			},
			backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						RefID: "A",
						JSON:  mustQueryJSON(suite.T(), "A", "select * from intTable"),
					},
					{
						RefID: "B",
						JSON:  mustQueryJSON(suite.T(), "B", "select 1"),
					},
				},
			},
		)

		require.NoError(suite.T(), err)
		require.Len(suite.T(), resp.Responses, 2)

		respA := resp.Responses["A"]
		require.NoError(suite.T(), respA.Error)
		frame := respA.Frames[0]

		require.Equal(suite.T(), "id", frame.Fields[0].Name)
		require.Equal(suite.T(), "keyName", frame.Fields[1].Name)
		require.Equal(suite.T(), "value", frame.Fields[2].Name)
		require.Equal(suite.T(), "foreignId", frame.Fields[3].Name)
		for _, f := range frame.Fields {
			require.Equal(suite.T(), 4, f.Len())
		}
	})
}

func mustQueryJSON(t *testing.T, refID, sql string) []byte {
	t.Helper()

	b, err := json.Marshal(queryRequest{
		RefID:    refID,
		RawQuery: sql,
		Format:   "table",
	})
	if err != nil {
		panic(err)
	}
	return b
}

func freeport(t *testing.T) (addr string, err error) {
	l, err := net.ListenTCP("tcp", &net.TCPAddr{IP: net.ParseIP("127.0.0.1")})
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		err = l.Close()
	}()
	a := l.Addr().(*net.TCPAddr)
	return a.String(), nil
}

func TestInvalidSchema(t *testing.T) {
	resp, _ := Query(
		context.Background(),
		&models.DatasourceInfo{
			HTTPClient:   nil,
			Token:        "secret",
			URL:          "http://127.0.0.1:1234",
			DbName:       "influxdb",
			Version:      "test",
			HTTPMode:     "proxy",
			InsecureGrpc: true,
			ProxyClient:  proxy.New(nil),
		},
		backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{
					RefID: "A",
					JSON:  []byte(`this is not valid JSON`),
				},
			},
		},
	)
	require.Equal(t, backend.ErrorSourceDownstream, resp.Responses["A"].ErrorSource)
}

func TestParseURL(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
		hasError bool
	}{
		{
			name:     "empty URL",
			input:    "",
			expected: "",
			hasError: true,
		},
		{
			name:     "URL without scheme",
			input:    "example.com",
			expected: "example.com",
			hasError: false,
		},
		{
			name:     "URL without scheme and with port",
			input:    "example.com:8181",
			expected: "example.com:8181",
			hasError: false,
		},
		{
			name:     "URL without port",
			input:    "http://example.com",
			expected: "example.com:443",
			hasError: false,
		},
		{
			name:     "URL with http scheme",
			input:    "http://example.com:8080",
			expected: "example.com:8080",
			hasError: false,
		},
		{
			name:     "URL with https scheme",
			input:    "https://example.com:8443",
			expected: "example.com:8443",
			hasError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseURL(tt.input)
			if tt.hasError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.expected, result)
			}
		})
	}
}
