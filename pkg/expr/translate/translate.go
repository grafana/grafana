package translate

import (
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/expr/classic"
	"github.com/grafana/grafana/pkg/models"
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
func DashboardAlertConditions(rawDCondJSON []byte, orgID int64) (expr.DataPipeline, error) {
	oldCond := dashConditionsJSON{}

	err := json.Unmarshal(rawDCondJSON, &oldCond)
	if err != nil {
		return nil, err
	}

	// TODO OrgID
	req, err := oldCond.GetNew(orgID)
	if err != nil {
		return nil, err
	}
	svc := &expr.Service{}
	return svc.BuildPipeline(req)
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

func (dc *dashConditionsJSON) GetNew(orgID int64) (*backend.QueryDataRequest, error) {
	refIDtoCondIdx := make(map[string][]int)
	for i, cond := range dc.Conditions {
		if len(cond.Query.Params) != 3 {
			return nil, fmt.Errorf("unexpected number of query parameters in cond %v, want 3 got %v", i+1, len(cond.Query.Params))
		}
		refID := cond.Query.Params[0]
		refIDtoCondIdx[refID] = append(refIDtoCondIdx[refID], i)
	}

	newRefIDs := make(map[string][]int)

	for refID, condIdxes := range refIDtoCondIdx {
		if len(condIdxes) == 1 {
			newRefIDs[refID] = append(newRefIDs[refID], condIdxes[0])
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
			continue
		}

		for _, idxes := range timeRanges {
			for i := 0; i < len(idxes); i++ {
				newLetter, err := getLetter(newRefIDs)
				if err != nil {
					return nil, err
				}
				newRefIDs[newLetter] = append(newRefIDs[newLetter], idxes[i])
			}
		}
	}

	req := &backend.QueryDataRequest{}
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

			queryObj["datasourceId"] = getDsInfo.Id
			queryObj["datasource"] = getDsInfo.Name
			queryObj["datasourceUid"] = getDsInfo.Uid
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
			query := backend.DataQuery{
				RefID: refId,
				JSON:  encodedObj,
				// TODO TimeRange: ,
			}
			req.Queries = append(req.Queries, query)
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

	exprModel := struct {
		Type       string `json:"type"`
		RefID      string `json:"refId"`
		Datasource string `json:"datasource"`
		Conditions []classic.ClassicConditionJSON
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

	exprQuery := backend.DataQuery{
		RefID: ccRefID,
		JSON:  exprModelJSON,
	}

	req.Queries = append(req.Queries, exprQuery)

	return req, nil
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
