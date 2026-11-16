package schedule

import (
	"context"
	"fmt"
	"sync"

	"github.com/grafana/grafana-app-sdk/resource"
	alertingv0alpha1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	reqns "github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
)

var _ RuleSequenceStore = (*K8sRuleSequenceStore)(nil)

// K8sRuleSequenceStore implements RuleSequenceStore by listing RuleSequence
// resources from the k8s API (unified storage). It converts each RuleSequence
// spec into the models.SchedulableRuleSequence that the scheduler expects.
//
// The underlying client is created lazily on the first successful call to
// getClient because the resource.ClientGenerator blocks until the apiserver
// is ready. Transient initialization failures are retried on the next call.
type K8sRuleSequenceStore struct {
	clientGenerator resource.ClientGenerator
	namespace       string
	log             log.Logger

	mu     sync.Mutex
	client *alertingv0alpha1.RuleSequenceClient
}

// RuleSequenceNamespace returns the namespace the scheduler lists RuleSequences
// in, mirroring how the app scopes its informer.
func RuleSequenceNamespace(cfg *setting.Cfg) string {
	if cfg == nil || cfg.StackID == "" {
		return ""
	}
	// The cloud mapper ignores the org ID and returns the stack namespace.
	return reqns.GetNamespaceMapper(cfg)(0)
}

// NewK8sRuleSequenceStore creates a RuleSequenceStore backed by the k8s
// RuleSequence resource. The clientGenerator is used lazily: the actual k8s
// client is not created until the first scheduling poll. namespace comes from
// RuleSequenceNamespace.
func NewK8sRuleSequenceStore(clientGenerator resource.ClientGenerator, namespace string, log log.Logger) *K8sRuleSequenceStore {
	return &K8sRuleSequenceStore{
		clientGenerator: clientGenerator,
		namespace:       namespace,
		log:             log,
	}
}

func (s *K8sRuleSequenceStore) getClient() (*alertingv0alpha1.RuleSequenceClient, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.client != nil {
		return s.client, nil
	}
	c, err := alertingv0alpha1.NewRuleSequenceClientFromGenerator(s.clientGenerator)
	if err != nil {
		return nil, err
	}
	s.client = c
	return s.client, nil
}

func (s *K8sRuleSequenceStore) GetRuleSequencesForScheduling(ctx context.Context) ([]models.SchedulableRuleSequence, error) {
	client, err := s.getClient()
	if err != nil {
		return nil, fmt.Errorf("initializing rule sequence client: %w", err)
	}

	list, err := client.ListAll(ctx, s.namespace, resource.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("listing rule sequences: %w", err)
	}

	result := make([]models.SchedulableRuleSequence, 0, len(list.Items))
	for _, seq := range list.Items {
		sc, err := convertRuleSequence(seq)
		if err != nil {
			s.log.Warn("Skipping rule sequence with invalid spec", "uid", seq.Name, "error", err)
			continue
		}
		result = append(result, sc)
	}

	return result, nil
}

// convertRuleSequence maps a k8s RuleSequence resource into the
// models.SchedulableRuleSequence the scheduler expects.
func convertRuleSequence(seq alertingv0alpha1.RuleSequence) (models.SchedulableRuleSequence, error) {
	interval, err := seq.Spec.Trigger.Interval.ToDuration()
	if err != nil {
		return models.SchedulableRuleSequence{}, fmt.Errorf("invalid interval: %w", err)
	}

	recRefs := make([]string, 0, len(seq.Spec.RecordingRules))
	for _, ref := range seq.Spec.RecordingRules {
		recRefs = append(recRefs, string(ref.Name))
	}
	alertRefs := make([]string, 0, len(seq.Spec.AlertingRules))
	for _, ref := range seq.Spec.AlertingRules {
		alertRefs = append(alertRefs, string(ref.Name))
	}

	return models.SchedulableRuleSequence{
		UID:               seq.Name,
		IntervalSeconds:   int64(interval.Seconds()),
		RecordingRuleRefs: recRefs,
		AlertRuleRefs:     alertRefs,
	}, nil
}
