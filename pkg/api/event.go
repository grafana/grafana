package api

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
)

func GetEvents(c *middleware.Context, query m.GetEventsQuery) Response {
	query.OrgId = c.OrgId

	if query.End == 0 {
		query.End = time.Now().Unix() * 1000
	}
	if query.Start == 0 {
		query.Start = query.End - (60 * 60 * 1000) //1hour
	}

	if query.Size == 0 {
		query.Size = 10
	}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "Failed to query events", err)
	}

	return Json(200, query.Result)
}
