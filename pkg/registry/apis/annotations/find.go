package annotations

import (
	"fmt"
	"net/url"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	"github.com/grafana/grafana/apps/annotations/pkg/apis/annotations/v0alpha1"
)

// For testing.
var now = time.Now

func parseQuery(values url.Values) (v0alpha1.ItemQuery, error) {
	query := v0alpha1.ItemQuery{}
	timeRange := gtime.TimeRange{
		From: values.Get("from"),
		To:   values.Get("to"),
		Now:  now(),
	}

	t, err := timeRange.ParseFrom()
	if err != nil {
		return query, apierrors.NewBadRequest(fmt.Sprintf("invalid 'from' time: %s", err.Error()))
	}
	query.From = t.UnixMilli()

	t, err = timeRange.ParseTo()
	if err != nil {
		return query, apierrors.NewBadRequest(fmt.Sprintf("invalid 'to' time: %s", err.Error()))
	}
	query.To = t.UnixMilli()

	query.Tags = values["tags"]
	query.DashboardUID = values.Get("dashboardUID")
	query.AlertUID = values.Get("alertUID")

	return query, nil
}
