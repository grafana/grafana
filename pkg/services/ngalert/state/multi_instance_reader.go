package state

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// MultiInstanceReader merges results from two InstanceReaders.
//
// For each rule, it picks the state that has the newer LastEvalTime.
type MultiInstanceReader struct {
	ProtoDBReader InstanceReader
	DBReader      InstanceReader
	logger        log.Logger
}

func NewMultiInstanceReader(logger log.Logger, r1, r2 InstanceReader) *MultiInstanceReader {
	return &MultiInstanceReader{
		ProtoDBReader: r1,
		DBReader:      r2,
		logger:        logger,
	}
}

// ListAlertInstances fetches alert instances for a query from both readers,
// groups them by rule UID, and returns the newest instances for each rule as a
// single slice.
func (m *MultiInstanceReader) ListAlertInstances(ctx context.Context, cmd *models.ListAlertInstancesQuery) ([]*models.AlertInstance, error) {
	instancesOne, err := m.ProtoDBReader.ListAlertInstances(ctx, cmd)
	if err != nil {
		return nil, fmt.Errorf("failed to list alert instances from ProtoDBReader: %w", err)
	}

	instancesTwo, err := m.DBReader.ListAlertInstances(ctx, cmd)
	if err != nil {
		return nil, fmt.Errorf("failed to list alert instances from DBReader: %w", err)
	}

	byRuleOne := groupByRuleUID(instancesOne)
	byRuleTwo := groupByRuleUID(instancesTwo)

	ruleSet := make(map[string]struct{})
	for uid := range byRuleOne {
		ruleSet[uid] = struct{}{}
	}
	for uid := range byRuleTwo {
		ruleSet[uid] = struct{}{}
	}

	merged := make([]*models.AlertInstance, 0)
	for ruleUID := range ruleSet {
		sliceA := byRuleOne[ruleUID]
		sliceB := byRuleTwo[ruleUID]
		newer := getNewestAlertInstances(m.logger, sliceA, sliceB)
		merged = append(merged, newer...)
	}

	return merged, nil
}

func groupByRuleUID(instances []*models.AlertInstance) map[string][]*models.AlertInstance {
	result := make(map[string][]*models.AlertInstance)
	for _, inst := range instances {
		if inst == nil {
			continue
		}
		result[inst.RuleUID] = append(result[inst.RuleUID], inst)
	}
	return result
}

// getNewestAlertInstances returns the newest alert instances slice
// by comparing the maximum LastEvalTime in each of them. If one is empty, returns the other.
func getNewestAlertInstances(logger log.Logger, firstInstances, secondInstances []*models.AlertInstance) []*models.AlertInstance {
	if len(firstInstances) == 0 {
		return secondInstances
	}
	if len(secondInstances) == 0 {
		return firstInstances
	}

	maxFirst := maxLastEvalTime(firstInstances)
	maxSecond := maxLastEvalTime(secondInstances)

	if maxSecond.After(maxFirst) {
		logger.Debug("Newer alert instances found", "first_last_eval_time", maxFirst, "second_last_eval_time", maxSecond, "rule_uid", firstInstances[0].RuleUID)
		return secondInstances
	}
	return firstInstances
}

// maxLastEvalTime finds the maximum LastEvalTime among a slice of alert instances.
func maxLastEvalTime(instances []*models.AlertInstance) time.Time {
	var max time.Time

	for _, i := range instances {
		if i != nil && i.LastEvalTime.After(max) {
			max = i.LastEvalTime
		}
	}

	return max
}
