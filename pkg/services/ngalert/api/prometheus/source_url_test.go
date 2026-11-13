package api

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestToRuleGroupSourceURL(t *testing.T) {
	rule := &ngmodels.AlertRule{UID: "rule-1", Title: "rule", NamespaceUID: "folder", RuleGroup: "group"}
	const sourceURL = "https://example.com/alerts/rule.yaml"
	provenance := map[string]ngmodels.Provenance{rule.UID: ngmodels.ProvenanceAPI}
	urls := map[string]string{rule.UID: sourceURL}
	mutator := func(context.Context, *ngmodels.AlertRule, *apimodels.AlertingRule, map[eval.State]struct{}, labels.Matchers, []ngmodels.LabelOption, int64) (map[string]int64, map[string]int64) {
		return nil, nil
	}

	group, _ := toRuleGroup(context.Background(), log.New("test"), rule.GetGroupKey(), "Folder", []*ngmodels.AlertRule{rule}, provenance, urls, 0, nil, nil, nil, mutator, false, false)
	require.Len(t, group.Rules, 1)
	require.Equal(t, sourceURL, group.Rules[0].SourceURL)
	encoded, err := json.Marshal(group.Rules[0])
	require.NoError(t, err)
	require.Contains(t, string(encoded), `"sourceUrl":"`+sourceURL+`"`)

	missing, _ := toRuleGroup(context.Background(), log.New("test"), rule.GetGroupKey(), "Folder", []*ngmodels.AlertRule{rule}, provenance, nil, 0, nil, nil, nil, mutator, false, false)
	require.Empty(t, missing.Rules[0].SourceURL)
	encoded, err = json.Marshal(missing.Rules[0])
	require.NoError(t, err)
	require.NotContains(t, string(encoded), "sourceUrl")

	// metadata_only responses stay beside the provenance-free payload and omit the URL.
	metadataOnly, _ := toRuleGroup(context.Background(), log.New("test"), rule.GetGroupKey(), "Folder", []*ngmodels.AlertRule{rule}, provenance, urls, 0, nil, nil, nil, nil, false, true)
	require.Empty(t, metadataOnly.Rules[0].SourceURL)
	require.Empty(t, metadataOnly.Rules[0].Provenance)
}
