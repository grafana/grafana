package graphite

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

type GraphiteClient struct{}

type GraphiteSerie struct {
	Datapoints [][2]float64
	Target     string
}

var DefaultClient = &http.Client{
	Timeout: time.Minute,
}

type GraphiteResponse []GraphiteSerie

func (client GraphiteClient) GetSeries(rule m.AlertJob, datasource m.DataSource) (m.TimeSeriesSlice, error) {
	v := url.Values{
		"format": []string{"json"},
		"target": []string{getTargetFromRule(rule.Rule)},
		"until":  []string{"now"},
		"from":   []string{"-" + strconv.Itoa(rule.Rule.QueryRange) + "s"},
	}

	log.Trace("Graphite: sending request with querystring: ", v.Encode())

	req, err := http.NewRequest("POST", datasource.Url+"/render", nil)

	if err != nil {
		return nil, fmt.Errorf("Could not create request")
	}

	req.Body = ioutil.NopCloser(bytes.NewReader([]byte(v.Encode())))

	if datasource.BasicAuth {
		req.Header.Add("Authorization", util.GetBasicAuthHeader(datasource.User, datasource.Password))
	}

	res, err := DefaultClient.Do(req)

	if err != nil {
		return nil, err
	}

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("expected httpstatus 200, found %d", res.StatusCode)
	}

	response := GraphiteResponse{}

	json.NewDecoder(res.Body).Decode(&response)

	var timeSeries []*m.TimeSeries
	for _, v := range response {
		timeSeries = append(timeSeries, m.NewTimeSeries(v.Target, v.Datapoints))
	}

	return timeSeries, nil
}

func getTargetFromRule(rule m.AlertRule) string {
	json, _ := simplejson.NewJson([]byte(rule.Query))

	return json.Get("target").MustString()
}
