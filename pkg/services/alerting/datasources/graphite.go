package graphite

import (
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/franela/goreq"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/log"
	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

type GraphiteClient struct{}

type GraphiteSerie struct {
	Datapoints [][2]float64
	Target     string
}

type GraphiteResponse []GraphiteSerie

func (client GraphiteClient) GetSeries(rule m.AlertJob, datasource m.DataSource) (m.TimeSeriesSlice, error) {
	v := url.Values{
		"format": []string{"json"},
		"target": []string{getTargetFromRule(rule.Rule)},
		"until":  []string{"now"},
		"from":   []string{"-" + strconv.Itoa(rule.Rule.QueryRange) + "s"},
	}

	log.Debug("Graphite: sending request with querystring: ", v.Encode())

	req := goreq.Request{
		Method:  "POST",
		Uri:     datasource.Url + "/render",
		Body:    v.Encode(),
		Timeout: 5 * time.Second,
	}

	if datasource.BasicAuth {
		req.AddHeader("Authorization", util.GetBasicAuthHeader(datasource.User, datasource.Password))
	}

	res, err := req.Do()

	if err != nil {
		return nil, err
	}

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("expected httpstatus 200, found %d", res.StatusCode)
	}

	response := GraphiteResponse{}
	res.Body.FromJsonTo(&response)

	timeSeries := make([]*m.TimeSeries, 0)

	for _, v := range response {
		timeSeries = append(timeSeries, m.NewTimeSeries(v.Target, v.Datapoints))
	}

	return timeSeries, nil
}

func getTargetFromRule(rule m.AlertRule) string {
	json, _ := simplejson.NewJson([]byte(rule.Query))

	return json.Get("target").MustString()
}
