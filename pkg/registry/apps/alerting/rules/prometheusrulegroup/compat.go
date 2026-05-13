package prometheusrulegroup

import (
	"errors"
	"fmt"
	"time"

	"go.yaml.in/yaml/v3"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	prom_model "github.com/prometheus/common/model"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasources"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/prom"
)

var (
	errInvalidGroup        = errors.New("group is not a converted Prometheus rule group")
	errMissingOriginalRule = errors.New("rule is missing the original Prometheus definition needed for round-trip")
)

const (
	// defaultDatasourceUID matches the well-known Grafana Cloud Mimir datasource UID.
	// Override per resource via the DatasourceUIDAnnotationKey annotation.
	defaultDatasourceUID = "grafanacloud-prom"
)

// convertToDomainGroup translates the k8s PrometheusRuleGroup into a Grafana AlertRuleGroup
// by running it through the existing /api/convert path's converter. KeepOriginalRuleDefinition
// is forced on so GET can losslessly round-trip via the per-rule YAML stored in metadata.
func convertToDomainGroup(
	orgID int64,
	folderUID string,
	datasourceUID string,
	defaultInterval time.Duration,
	g *model.PrometheusRuleGroup,
) (*ngmodels.AlertRuleGroup, ngmodels.Provenance, error) {
	if datasourceUID == "" {
		datasourceUID = defaultDatasourceUID
	}

	promGroup := specToPromGroup(g.Spec)

	keep := true
	cfg := prom.Config{
		DatasourceUID:              datasourceUID,
		DatasourceType:             datasources.DS_PROMETHEUS,
		DefaultInterval:            defaultInterval,
		KeepOriginalRuleDefinition: &keep,
	}
	converter, err := prom.NewConverter(cfg)
	if err != nil {
		return nil, "", fmt.Errorf("failed to build converter: %w", err)
	}

	grafGroup, err := converter.PrometheusRulesToGrafana(orgID, folderUID, promGroup)
	if err != nil {
		return nil, "", err
	}

	provenance := ngmodels.ProvenanceConvertedPrometheus
	sourceProv := g.GetProvenanceStatus()
	if sourceProv != "" && sourceProv != model.ProvenanceStatusNone {
		provenance = ngmodels.Provenance(sourceProv)
	}
	return grafGroup, provenance, nil
}

func specToPromGroup(spec model.PrometheusRuleGroupSpec) prom.PrometheusRuleGroup {
	rules := make([]prom.PrometheusRule, 0, len(spec.Rules))
	for _, r := range spec.Rules {
		pr := prom.PrometheusRule{
			Expr:        r.Expr,
			Labels:      r.Labels,
			Annotations: r.Annotations,
		}
		if r.Alert != nil {
			pr.Alert = *r.Alert
		}
		if r.Record != nil {
			pr.Record = *r.Record
		}
		if r.For != nil {
			if d, err := prom_model.ParseDuration(string(*r.For)); err == nil {
				pr.For = &d
			}
		}
		if r.KeepFiringFor != nil {
			if d, err := prom_model.ParseDuration(string(*r.KeepFiringFor)); err == nil {
				pr.KeepFiringFor = &d
			}
		}
		rules = append(rules, pr)
	}

	g := prom.PrometheusRuleGroup{
		Name:   spec.Name,
		Rules:  rules,
		Labels: spec.Labels,
	}
	if spec.Interval != nil {
		if d, err := prom_model.ParseDuration(string(*spec.Interval)); err == nil {
			g.Interval = d
		}
	}
	if spec.QueryOffset != nil {
		if d, err := prom_model.ParseDuration(string(*spec.QueryOffset)); err == nil {
			g.QueryOffset = &d
		}
	}
	if spec.Limit != nil {
		g.Limit = int(*spec.Limit)
	}
	return g
}

// convertToK8sResource reassembles a PrometheusRuleGroup from the AlertRuleGroup that
// holds the converted Grafana rules. It depends on every rule having
// rule.Metadata.PrometheusStyleRule.OriginalRuleDefinition populated (which the
// convertToDomainGroup path guarantees, since KeepOriginalRuleDefinition is forced on).
func convertToK8sResource(
	orgID int64,
	group *ngmodels.AlertRuleGroup,
	provenance ngmodels.Provenance,
	namespaceMapper request.NamespaceMapper,
) (*model.PrometheusRuleGroup, error) {
	if group == nil || len(group.Rules) == 0 {
		return nil, errInvalidGroup
	}

	rules := make([]model.PrometheusRuleGroupPrometheusRule, 0, len(group.Rules))
	for i, rule := range group.Rules {
		if rule.Metadata.PrometheusStyleRule == nil || rule.Metadata.PrometheusStyleRule.OriginalRuleDefinition == "" {
			return nil, fmt.Errorf("rule[%d] %q: %w", i, rule.UID, errMissingOriginalRule)
		}
		var promRule prom.PrometheusRule
		if err := yaml.Unmarshal([]byte(rule.Metadata.PrometheusStyleRule.OriginalRuleDefinition), &promRule); err != nil {
			return nil, fmt.Errorf("rule[%d] %q: failed to parse original rule definition: %w", i, rule.UID, err)
		}
		rules = append(rules, promRuleToSpec(promRule))
	}

	interval, err := prom_model.ParseDuration(fmt.Sprintf("%ds", group.Interval))
	if err != nil {
		return nil, fmt.Errorf("failed to parse interval: %w", err)
	}
	intervalStr := model.PrometheusRuleGroupPromDuration(interval.String())

	k8s := &model.PrometheusRuleGroup{
		ObjectMeta: metav1.ObjectMeta{
			Name:      group.Title,
			UID:       types.UID(group.Title),
			Namespace: namespaceMapper(orgID),
			Labels:    make(map[string]string),
		},
		Spec: model.PrometheusRuleGroupSpec{
			Name:     group.Title,
			Interval: &intervalStr,
			Rules:    rules,
		},
	}

	meta, err := utils.MetaAccessor(k8s)
	if err != nil {
		return nil, fmt.Errorf("failed to get metadata accessor: %w", err)
	}
	meta.SetFolder(group.FolderUID)
	if group.FolderUID != "" {
		k8s.Labels[model.FolderLabelKey] = group.FolderUID
	}

	if err := k8s.SetProvenanceStatus(string(provenance)); err != nil {
		return nil, fmt.Errorf("failed to set provenance status: %w", err)
	}

	return k8s, nil
}

func promRuleToSpec(r prom.PrometheusRule) model.PrometheusRuleGroupPrometheusRule {
	spec := model.PrometheusRuleGroupPrometheusRule{
		Expr:        r.Expr,
		Labels:      r.Labels,
		Annotations: r.Annotations,
	}
	if r.Alert != "" {
		a := r.Alert
		spec.Alert = &a
	}
	if r.Record != "" {
		rec := r.Record
		spec.Record = &rec
	}
	if r.For != nil {
		f := model.PrometheusRuleGroupPromDuration(r.For.String())
		spec.For = &f
	}
	if r.KeepFiringFor != nil {
		k := model.PrometheusRuleGroupPromDuration(r.KeepFiringFor.String())
		spec.KeepFiringFor = &k
	}
	return spec
}
