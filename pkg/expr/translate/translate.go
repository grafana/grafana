package translate

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/expr/classic"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

// DashboardAlertConditions turns dashboard alerting conditions into server side expression queries and a
// classic conditions operation. A Condition from the ngalert model's package will be returned if the
// translation is successful in creating an expression that can be parsed.
// A query is created for each unique referenced query in the dashboard. Each query is considered to be unique
// based on the RefID and the Time Range. Therefore, if the same RefID has multiple time ranges in the dashboard
// condition, new RefIDs will be created.
func DashboardAlertConditions(rawDCondJSON []byte, orgID int64) (*ngmodels.Condition, error) {
	oldCond := dashConditionsJSON{}

	err := json.Unmarshal(rawDCondJSON, &oldCond)
	if err != nil {
		return nil, err
	}

	ngCond, err := oldCond.GetNew(orgID)
	if err != nil {
		return nil, err
	}

	backendReq, err := eval.GetExprRequest(eval.AlertExecCtx{ExpressionsEnabled: true, Log: log.New("translate")}, ngCond.Data, time.Unix(500, 0))

	if err != nil {
		return nil, err
	}

	svc := &expr.Service{}
	_, err = svc.BuildPipeline(backendReq)
	if err != nil {
		return nil, err
	}
	return ngCond, nil
}

type dashConditionsJSON struct {
	Conditions []dashAlertingConditionJSON `json:"conditions"`
}

// dashAlertingConditionJSON is like classic.ClassicConditionJSON except that it
// includes the model property with the query.
type dashAlertingConditionJSON struct {
	Evaluator conditionEvalJSON `json:"evaluator"`

	Operator struct {
		Type string `json:"type"`
	} `json:"operator"`

	Query struct {
		Params       []string `json:"params"`
		DatasourceID int64    `json:""`
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

func (dc *dashConditionsJSON) GetNew(orgID int64) (*ngmodels.Condition, error) {
	refIDtoCondIdx := make(map[string][]int) // a map of original refIds to their corresponding condition index
	for i, cond := range dc.Conditions {
		if len(cond.Query.Params) != 3 {
			return nil, fmt.Errorf("unexpected number of query parameters in cond %v, want 3 got %v", i+1, len(cond.Query.Params))
		}
		refID := cond.Query.Params[0]
		refIDtoCondIdx[refID] = append(refIDtoCondIdx[refID], i)
	}

	newRefIDstoCondIdx := make(map[string][]int) // a map of the new refIds to their coresponding condition index

	refIDs := make([]string, 0, len(refIDtoCondIdx)) // a unique sorted list of the original refIDs
	for refID := range refIDtoCondIdx {
		refIDs = append(refIDs, refID)
	}
	sort.Strings(refIDs)

	newRefIDsToTimeRanges := make(map[string][2]string) // a map of new RefIDs to their time range string tuple representation
	for _, refID := range refIDs {
		condIdxes := refIDtoCondIdx[refID]

		if len(condIdxes) == 1 {
			// If the refID is used in only condition, keep the letter a new refID
			newRefIDstoCondIdx[refID] = append(newRefIDstoCondIdx[refID], condIdxes[0])
			newRefIDsToTimeRanges[refID] = [2]string{dc.Conditions[condIdxes[0]].Query.Params[1], dc.Conditions[condIdxes[0]].Query.Params[2]}
			continue
		}

		// track unique time ranges within the same refID
		timeRangesToCondIdx := make(map[[2]string][]int) // a map of the time range tuple to the condition index
		for _, idx := range condIdxes {
			timeParamFrom := dc.Conditions[idx].Query.Params[1]
			timeParamTo := dc.Conditions[idx].Query.Params[2]
			key := [2]string{timeParamFrom, timeParamTo}
			timeRangesToCondIdx[key] = append(timeRangesToCondIdx[key], idx)
		}

		if len(timeRangesToCondIdx) == 1 {
			// if all shared time range, no need to create a new query with a new RefID
			for i := range condIdxes {
				newRefIDstoCondIdx[refID] = append(newRefIDstoCondIdx[refID], condIdxes[i])
				newRefIDsToTimeRanges[refID] = [2]string{dc.Conditions[condIdxes[i]].Query.Params[1], dc.Conditions[condIdxes[i]].Query.Params[2]}
			}
			continue
		}

		// This referenced query/refID has different time ranges, so new queries are needed for each unique time range.

		timeRanges := make([][2]string, 0, len(timeRangesToCondIdx)) // a sorted list of unique time ranges for the query
		for tr := range timeRangesToCondIdx {
			timeRanges = append(timeRanges, tr)
		}

		sort.Slice(timeRanges, func(i, j int) bool {
			switch {
			case timeRanges[i][0] < timeRanges[j][0]:
				return true
			case timeRanges[i][0] > timeRanges[j][0]:
				return false
			default:
				return timeRanges[i][1] < timeRanges[j][1]
			}
		})

		for _, tr := range timeRanges {
			idxes := timeRangesToCondIdx[tr]
			for i := 0; i < len(idxes); i++ {
				newLetter, err := getNewRefID(newRefIDstoCondIdx)
				if err != nil {
					return nil, err
				}
				newRefIDstoCondIdx[newLetter] = append(newRefIDstoCondIdx[newLetter], idxes[i])
				newRefIDsToTimeRanges[newLetter] = [2]string{dc.Conditions[idxes[i]].Query.Params[1], dc.Conditions[idxes[i]].Query.Params[2]}
			}
		}
	}

	newRefIDs := make([]string, 0, len(newRefIDstoCondIdx)) // newRefIds is a sorted list of the unique refIds of new queries
	for refID := range newRefIDstoCondIdx {
		newRefIDs = append(newRefIDs, refID)
	}
	sort.Strings(newRefIDs)

	ngCond := &ngmodels.Condition{}
	condIdxToNewRefID := make(map[int]string) // a map of condition indices to the RefIDs of new queries

	// build the new data source queries
	for _, refID := range newRefIDs {
		condIdxes := newRefIDstoCondIdx[refID]
		for i, condIdx := range condIdxes {
			condIdxToNewRefID[condIdx] = refID
			if i > 0 {
				// only create each unique query once
				continue
			}

			var queryObj map[string]interface{} // copy the model
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

			queryObj["datasource"] = getDsInfo.Result.Name
			queryObj["refId"] = refID

			encodedObj, err := json.Marshal(queryObj)
			if err != nil {
				return nil, err
			}

			rawFrom := newRefIDsToTimeRanges[refID][0]
			rawTo := newRefIDsToTimeRanges[refID][1]

			rTR, err := getRelativeDuration(rawFrom, rawTo)
			if err != nil {
				return nil, err
			}

			alertQuery := ngmodels.AlertQuery{
				RefID:             refID,
				Model:             encodedObj,
				RelativeTimeRange: *rTR,
				DatasourceUID:     getDsInfo.Result.Uid,
			}
			ngCond.Data = append(ngCond.Data, alertQuery)
		}
	}

	// build the new classic condition pointing our new equivalent queries
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

	ccRefID, err := getNewRefID(newRefIDstoCondIdx) // get refID for the classic condition
	if err != nil {
		return nil, err
	}
	ngCond.Condition = ccRefID // set the alert condition to point to the classic condition
	ngCond.OrgID = orgID

	exprModel := struct {
		Type       string                         `json:"type"`
		RefID      string                         `json:"refId"`
		Conditions []classic.ClassicConditionJSON `json:"conditions"`
	}{
		"classic_conditions",
		ccRefID,
		conditions,
	}

	exprModelJSON, err := json.Marshal(&exprModel)
	if err != nil {
		return nil, err
	}

	ccAlertQuery := ngmodels.AlertQuery{
		RefID:         ccRefID,
		Model:         exprModelJSON,
		DatasourceUID: expr.DatasourceUID,
	}

	ngCond.Data = append(ngCond.Data, ccAlertQuery)

	for i := range ngCond.Data {
		err := ngCond.Data[i].PreSave() // Set query model properties
		if err != nil {
			return nil, err
		}
	}

	sort.Slice(ngCond.Data, func(i, j int) bool {
		return ngCond.Data[i].RefID < ngCond.Data[j].RefID
	})

	return ngCond, nil
}

const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

// getNewRefID finds first capital letter in the alphabet not in use
// to use for a new RefID. It errors if it runs out of letters.
func getNewRefID(refIDs map[string][]int) (string, error) {
	for _, r := range alpha {
		sR := string(r)
		if _, ok := refIDs[sR]; ok {
			continue
		}
		return sR, nil
	}
	for i := 0; i < 20; i++ {
		sR := util.GenerateShortUID()
		if _, ok := refIDs[sR]; ok {
			continue
		}
		return sR, nil
	}
	return "", fmt.Errorf("failed to generate unique RefID")
}

// getRelativeDuration turns the alerting durations for dashboard conditions
// into a relative time range.
func getRelativeDuration(rawFrom, rawTo string) (*ngmodels.RelativeTimeRange, error) {
	fromD, err := getFrom(rawFrom)
	if err != nil {
		return nil, err
	}

	toD, err := getTo(rawTo)
	if err != nil {
		return nil, err
	}
	return &ngmodels.RelativeTimeRange{
		From: ngmodels.Duration(fromD),
		To:   ngmodels.Duration(toD),
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
