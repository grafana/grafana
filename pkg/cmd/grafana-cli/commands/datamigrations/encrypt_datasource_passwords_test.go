package datamigrations

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/commands/commandstest"
	"github.com/grafana/grafana/pkg/components/securejsondata"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/assert"
)

func TestPasswordMigrationCommand(t *testing.T) {
	//setup datasources with password, basic_auth and none
	sqlstore := sqlstore.InitTestDB(t)
	session := sqlstore.NewSession()
	defer session.Close()

	datasources := []*models.DataSource{
		{Type: "influxdb", Name: "influxdb", Password: "foobar"},
		{Type: "graphite", Name: "graphite", BasicAuthPassword: "foobar"},
		{Type: "prometheus", Name: "prometheus", SecureJsonData: securejsondata.GetEncryptedJsonData(map[string]string{})},
	}

	// set required default values
	for _, ds := range datasources {
		ds.Created = time.Now()
		ds.Updated = time.Now()
		ds.SecureJsonData = securejsondata.GetEncryptedJsonData(map[string]string{})
	}

	_, err := session.Insert(&datasources)
	assert.Nil(t, err)

	//run migration
	err = EncryptDatasourcePaswords(&commandstest.FakeCommandLine{}, sqlstore)
	assert.Nil(t, err)

	//verify that no datasources still have password or basic_auth
	var dss []*models.DataSource
	err = session.SQL("select * from data_source").Find(&dss)
	assert.Nil(t, err)
	assert.Equal(t, len(dss), 3)

	for _, ds := range dss {
		sj := ds.SecureJsonData.Decrypt()

		if ds.Name == "influxdb" {
			assert.Equal(t, ds.Password, "")
			v, exist := sj["password"]
			assert.True(t, exist)
			assert.Equal(t, v, "foobar", "expected password to be moved to securejson")
		}

		if ds.Name == "graphite" {
			assert.Equal(t, ds.BasicAuthPassword, "")
			v, exist := sj["basicAuthPassword"]
			assert.True(t, exist)
			assert.Equal(t, v, "foobar", "expected basic_auth_password to be moved to securejson")
		}

		if ds.Name == "prometheus" {
			assert.Equal(t, len(sj), 0)
		}
	}
}
