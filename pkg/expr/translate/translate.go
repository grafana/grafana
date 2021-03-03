package translate

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/expr/classic"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
)

// Decide on input (model or json, and from where?)
// Decide on output (model or json)
// This package is probably the wrong place, will worry about that later

/*
Main Goals:
 - Take an existing Dashboard Alert and Generate SSE queries with a classic conditions operation

Need To:
 - Check for queries that share a refId within the conditions
 - For each of those, create new queries with new refIds for each unique timerange case. If the timerange is the same, the same refId can be used
 - Add a refId for the classic condition
 - Convert the "now" style timerange to relativeTime (From and To in seconds).
 - DatasourceID to Datasource UID (need OrgID)
*/

// DashboardAlertConditions turns dashboard alerting conditions into a server side expression conditions.
func DashboardAlertConditions(rawDCondJSON []byte, orgID int64) (*eval.Condition, error) {
	oldCond := dashConditionsJSON{}

	err := json.Unmarshal(rawDCondJSON, &oldCond)
	if err != nil {
		return nil, err
	}

	// TODO OrgID
	ngCond, err := oldCond.GetNew(orgID)
	if err != nil {
		return nil, err
	}

	return ngCond, nil

	// backendReq, err := ngCond.GetQueryDataRequest(eval.AlertExecCtx{ExpressionsEnabled: true}, time.Unix(500, 0))

	// if err != nil {
	// 	return nil, err
	// }

	// svc := &expr.Service{}
	// _, err = svc.BuildPipeline(backendReq)
	// if err != nil {
	// 	return nil, err
	// }
	//return nil, nil
}

type dashConditionsJSON struct {
	Conditions []dashAlertingConditionJSON `json:"conditions"`
}

type dashAlertingConditionJSON struct {
	Evaluator conditionEvalJSON `json:"evaluator"`

	Operator struct {
		Type string `json:"type"`
	} `json:"operator"`

	Query struct {
		Params       []string
		DatasourceID int64 `json:""`
		Model        json.RawMessage
	} `json:"query"`

	Reducer struct {
		// Params []interface{} `json:"params"` (Unused)
		Type string `json:"type"`
	}
}

type conditionEvalJSON struct {
	Params []float64 `json:"params"`
	Type   string    `json:"type"` // e.g. "gt"
}

func (dc *dashConditionsJSON) GetNew(orgID int64) (*eval.Condition, error) {
	refIDtoCondIdx := make(map[string][]int)
	for i, cond := range dc.Conditions {
		if len(cond.Query.Params) != 3 {
			return nil, fmt.Errorf("unexpected number of query parameters in cond %v, want 3 got %v", i+1, len(cond.Query.Params))
		}
		refID := cond.Query.Params[0]
		refIDtoCondIdx[refID] = append(refIDtoCondIdx[refID], i)
	}

	newRefIDs := make(map[string][]int)
	newRefIDsToTimeRanges := make(map[string][2]string)

	for refID, condIdxes := range refIDtoCondIdx {
		if len(condIdxes) == 1 {
			newRefIDs[refID] = append(newRefIDs[refID], condIdxes[0])
			newRefIDsToTimeRanges[refID] = [2]string{dc.Conditions[condIdxes[0]].Query.Params[1], dc.Conditions[condIdxes[0]].Query.Params[2]}
			continue
		}

		// track unique time ranges within the same refId
		timeRanges := make(map[[2]string][]int)
		for i, idx := range condIdxes {
			timeParamFrom := dc.Conditions[i].Query.Params[1]
			timeParamTo := dc.Conditions[i].Query.Params[2]
			key := [2]string{timeParamFrom, timeParamTo}
			timeRanges[key] = append(timeRanges[key], idx)
		}

		if len(timeRanges) == 1 {
			// all shared time range, no need to create refIds
			newRefIDs[refID] = append(newRefIDs[refID], condIdxes[0])
			newRefIDsToTimeRanges[refID] = [2]string{dc.Conditions[condIdxes[0]].Query.Params[1], dc.Conditions[condIdxes[0]].Query.Params[2]}
			continue
		}

		for _, idxes := range timeRanges {
			for i := 0; i < len(idxes); i++ {
				newLetter, err := getLetter(newRefIDs)
				if err != nil {
					return nil, err
				}
				newRefIDs[newLetter] = append(newRefIDs[newLetter], idxes[i])
				newRefIDsToTimeRanges[newLetter] = [2]string{dc.Conditions[idxes[i]].Query.Params[1], dc.Conditions[idxes[i]].Query.Params[2]}
			}
		}
	}

	ngCond := &eval.Condition{}
	// will need to sort for stable output
	condIdxToNewRefID := make(map[int]string)
	for refId, condIdxes := range newRefIDs {
		for _, condIdx := range condIdxes {
			condIdxToNewRefID[condIdx] = refId
			var queryObj map[string]interface{}
			err := json.Unmarshal(dc.Conditions[condIdx].Query.Model, &queryObj)
			if err != nil {
				return nil, err
			}

			getDsInfo := &models.GetDataSourceQuery{
				OrgId: orgID,
				Id:    dc.Conditions[condIdx].Query.DatasourceID,
			}

			if err := bus.Dispatch(getDsInfo); err != nil {
				return nil, fmt.Errorf("could not find datasource: %w", err)
			}

			//queryObj["datasourceId"] = getDsInfo.Result.Id
			queryObj["datasource"] = getDsInfo.Result.Name
			queryObj["datasourceUid"] = getDsInfo.Result.Uid
			queryObj["refId"] = refId

			if _, found := queryObj["maxDataPoints"]; !found {
				queryObj["maxDataPoints"] = 100
			}
			if _, found := queryObj["intervalMs"]; !found {
				queryObj["intervalMs"] = 1000
			}

			encodedObj, err := json.Marshal(queryObj)
			if err != nil {
				return nil, err
			}

			rawFrom := newRefIDsToTimeRanges[refId][0]
			rawTo := newRefIDsToTimeRanges[refId][1]

			rTR, err := getRelativeDuration(rawFrom, rawTo)
			if err != nil {
				return nil, err
			}

			alertQuery := eval.AlertQuery{
				RefID:             refId,
				Model:             encodedObj,
				RelativeTimeRange: *rTR,
				DatasourceUID:     getDsInfo.Uid,
			}
			ngCond.QueriesAndExpressions = append(ngCond.QueriesAndExpressions, alertQuery)
		}
	}

	conditions := make([]classic.ClassicConditionJSON, len(dc.Conditions))
	for i, cond := range dc.Conditions {
		newCond := classic.ClassicConditionJSON{}
		newCond.Evaluator = classic.ConditionEvalJSON{
			Type:   cond.Evaluator.Type,
			Params: cond.Evaluator.Params,
		}
		newCond.Operator.Type = cond.Operator.Type
		newCond.Query.Params = append(newCond.Query.Params, condIdxToNewRefID[i])
		newCond.Reducer.Type = cond.Reducer.Type

		conditions[i] = newCond
	}

	ccRefID, err := getLetter(newRefIDs)
	if err != nil {
		return nil, err
	}
	ngCond.RefID = ccRefID
	ngCond.OrgID = orgID

	exprModel := struct {
		Type       string                         `json:"type"`
		RefID      string                         `json:"refId"`
		Datasource string                         `json:"datasource"`
		Conditions []classic.ClassicConditionJSON `json:"conditions"`
	}{
		"classic_conditions",
		ccRefID,
		"__expr__",
		conditions,
	}

	exprModelJSON, err := json.Marshal(&exprModel)
	if err != nil {
		return nil, err
	}

	ccAlertQuery := eval.AlertQuery{
		RefID: ccRefID,
		Model: exprModelJSON,
	}

	ngCond.QueriesAndExpressions = append(ngCond.QueriesAndExpressions, ccAlertQuery)

	for i := range ngCond.QueriesAndExpressions {
		err := ngCond.QueriesAndExpressions[i].PreSave()
		if err != nil {
			return nil, err
		}
	}

	b, err := json.MarshalIndent(ngCond, "", " ")
	if err != nil {
		return nil, err
	}
	fmt.Println(string(b))

	return ngCond, nil
}

const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

func getLetter(refIDs map[string][]int) (string, error) {
	for _, r := range alpha {
		sR := string(r)
		if _, ok := refIDs[sR]; ok {
			continue
		}
		return sR, nil
	}
	return "", fmt.Errorf("ran out of letters when creating expression")
}

func getRelativeDuration(rawFrom, rawTo string) (*eval.RelativeTimeRange, error) {
	fromD, err := getFrom(rawFrom)
	if err != nil {
		return nil, err
	}

	toD, err := getTo(rawTo)
	if err != nil {
		return nil, err
	}
	return &eval.RelativeTimeRange{
		From: eval.Duration(fromD),
		To:   eval.Duration(toD),
	}, nil
}

func getFrom(from string) (time.Duration, error) {
	fromRaw := strings.Replace(from, "now-", "", 1)

	d, err := time.ParseDuration("-" + fromRaw)
	if err != nil {
		return 0, err
	}
	return -d, err
}

func getTo(to string) (time.Duration, error) {
	if to == "now" {
		return 0, nil
	} else if strings.HasPrefix(to, "now-") {
		withoutNow := strings.Replace(to, "now-", "", 1)

		d, err := time.ParseDuration("-" + withoutNow)
		if err != nil {
			return 0, err
		}
		return -d, nil
	}

	d, err := time.ParseDuration(to)
	if err != nil {
		return 0, err
	}
	return -d, nil
}
