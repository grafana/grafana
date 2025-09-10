package historian

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	historianModels "github.com/grafana/grafana/pkg/services/ngalert/schedule/historian/models"
)

func TestPrepareStream(t *testing.T) {
	defaultLabels := map[string]string{
		"env": "test",
	}
	h := &Historian{
		externalLabels: defaultLabels,
		log:            &logtest.Fake{},
	}

	tickTime := time.Unix(123423, 0)
	evalTime := time.Unix(123123, 0)

	record := historianModels.Record{
		Attempt:     10,
		RuleUID:     "rule-uid-213",
		RuleVersion: 22,
		GroupKey: models.AlertRuleGroupKey{
			OrgID:        4,
			NamespaceUID: "folder-uid-123",
			RuleGroup:    "rule-group-123",
		},
		RuleFingerprint: "fingerprint-123",
		Status:          historianModels.EvalStatusSuccess,
		Error:           "test-error",
		Duration:        152 * time.Millisecond,
		Tick:            tickTime,
		EvaluationTime:  evalTime,
	}

	streams := h.prepareStream(record, h.log)

	require.Len(t, streams, 1)
	stream := streams[0]
	require.Len(t, stream.Values, 1)
	value := stream.Values[0]

	assert.Equal(t, stream.Stream, map[string]string{
		"env":       "test",
		"orgID":     "4",
		"from":      "evaluation-history",
		"folderUID": "folder-uid-123",
		"group":     "rule-group-123",
	})
	assert.Equal(t, value.T, tickTime)
	assert.JSONEq(t, `{
		"schemaVersion":1,
		"evaluationTime": 123123,
		"ruleUID":"rule-uid-213",
		"version":"22",
		"fingerprint":"fingerprint-123",
		"attempt":10,
		"duration":152,
		"status":"success",
		"error":"test-error"       
	}`, value.V)
}
