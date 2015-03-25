package api

import (
	"bytes"
	"encoding/json"
	"io/ioutil"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func CreateDashboardSnapshot(c *middleware.Context, cmd m.CreateDashboardSnapshotCommand) {
	if cmd.External {
		createExternalSnapshot(c, cmd)
		return
	}

	cmd.Key = util.GetRandomString(32)
	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to create snaphost", err)
		return
	}

	metrics.M_Api_Dashboard_Snapshot_Create.Inc(1)

	c.JSON(200, util.DynMap{"key": cmd.Key, "url": setting.ToAbsUrl("/dashboard/snapshot")})
}

func createExternalSnapshot(c *middleware.Context, cmd m.CreateDashboardSnapshotCommand) {
	metrics.M_Api_Dashboard_Snapshot_External.Inc(1)

	cmd.External = false
	json, _ := json.Marshal(cmd)
	jsonData := bytes.NewBuffer(json)

	client := http.Client{Timeout: time.Duration(5 * time.Second)}
	resp, err := client.Post("http://snapshots-origin.raintank.io/api/snapshots", "application/json", jsonData)

	if err != nil {
		c.JsonApiErr(500, "Failed to publish external snapshot", err)
		return
	}

	c.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	c.WriteHeader(resp.StatusCode)

	if resp.ContentLength > 0 {
		bytes, _ := ioutil.ReadAll(resp.Body)
		c.Write(bytes)
	}
}

func GetDashboardSnapshot(c *middleware.Context) {
	key := c.Params(":key")

	query := &m.GetDashboardSnapshotQuery{Key: key}

	err := bus.Dispatch(query)
	if err != nil {
		c.JsonApiErr(500, "Failed to get dashboard snapshot", err)
		return
	}

	dto := dtos.Dashboard{
		Model: query.Result.Dashboard,
		Meta:  dtos.DashboardMeta{IsSnapshot: true},
	}

	metrics.M_Api_Dashboard_Snapshot_Get.Inc(1)

	c.Resp.Header().Set("Cache-Control", "public, max-age=31536000")

	c.JSON(200, dto)
}
