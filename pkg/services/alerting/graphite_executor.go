package alerting

import (
	"encoding/json"
	"fmt"
	"github.com/franela/goreq"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	"net/http"
	"net/url"
	"time"
)

type GraphiteExecutor struct{}

type Series struct {
	Datapoints []DataPoint
	Target     string
}

type Response []Series
type DataPoint []json.Number

func (this *GraphiteExecutor) Execute(rule m.AlertRule, responseQueue chan *AlertResult) {
	response, err := this.getSeries(rule)

	if err != nil {
		responseQueue <- &AlertResult{State: "CRITICAL", Id: rule.Id}
	}

	responseQueue <- this.executeRules(response, rule)
}

func (this *GraphiteExecutor) executeRules(series []Series, rule m.AlertRule) *AlertResult {
	for _, v := range series {
		var avg float64
		var sum float64
		for _, dp := range v.Datapoints {
			i, _ := dp[0].Float64()
			sum += i
		}

		avg = sum / float64(len(v.Datapoints))

		if float64(rule.CritLevel) < avg {
			return &AlertResult{State: m.AlertStateCritical, Id: rule.Id, ActualValue: avg}
		}

		if float64(rule.WarnLevel) < avg {
			return &AlertResult{State: m.AlertStateWarn, Id: rule.Id, ActualValue: avg}
		}

		if float64(rule.CritLevel) < sum {
			return &AlertResult{State: m.AlertStateCritical, Id: rule.Id, ActualValue: sum}
		}

		if float64(rule.WarnLevel) < sum {
			return &AlertResult{State: m.AlertStateWarn, Id: rule.Id, ActualValue: sum}
		}
	}

	return &AlertResult{State: m.AlertStateOk, Id: rule.Id}
}

func (this *GraphiteExecutor) getSeries(rule m.AlertRule) (Response, error) {
	query := &m.GetDataSourceByIdQuery{Id: rule.DatasourceId, OrgId: rule.OrgId}
	if err := bus.Dispatch(query); err != nil {
		return nil, err
	}

	v := url.Values{
		"format": []string{"json"},
		"target": []string{getTargetFromQuery(rule)},
	}

	v.Add("from", "-"+rule.QueryRange)
	v.Add("until", "now")

	req := goreq.Request{
		Method:  "POST",
		Uri:     query.Result.Url + "/render",
		Body:    v.Encode(),
		Timeout: 500 * time.Millisecond,
	}

	res, err := req.Do()

	response := Response{}
	res.Body.FromJsonTo(&response)

	if err != nil {
		return nil, err
	}

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("error!")
	}

	return response, nil
}

func getTargetFromQuery(rule m.AlertRule) string {
	json, _ := simplejson.NewJson([]byte(rule.Query))

	return json.Get("target").MustString()
}
