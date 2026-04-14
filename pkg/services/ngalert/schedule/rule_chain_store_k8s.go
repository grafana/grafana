package schedule

import (
	"context"
	"fmt"
	"sync"

	"github.com/grafana/grafana-app-sdk/resource"
	alertingv0alpha1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

var _ RuleChainStore = (*K8sRuleChainStore)(nil)

// K8sRuleChainStore implements RuleChainStore by listing RuleChain resources
// from the k8s API (unified storage). It converts each RuleChain spec into
// the models.SchedulableRuleChain that the scheduler expects.
//
// The underlying client is created lazily on the first successful call to
// getClient because the resource.ClientGenerator blocks until the apiserver
// is ready. Transient initialization failures are retried on the next call.
type K8sRuleChainStore struct {
	clientGenerator resource.ClientGenerator
	log             log.Logger

	mu     sync.Mutex
	client *alertingv0alpha1.RuleChainClient
}

// NewK8sRuleChainStore creates a RuleChainStore backed by the k8s RuleChain
// resource. The clientGenerator is used lazily: the actual k8s client is not
// created until the first scheduling poll.
func NewK8sRuleChainStore(clientGenerator resource.ClientGenerator, log log.Logger) *K8sRuleChainStore {
	return &K8sRuleChainStore{
		clientGenerator: clientGenerator,
		log:             log,
	}
}

func (s *K8sRuleChainStore) getClient() (*alertingv0alpha1.RuleChainClient, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.client != nil {
		return s.client, nil
	}
	c, err := alertingv0alpha1.NewRuleChainClientFromGenerator(s.clientGenerator)
	if err != nil {
		return nil, err
	}
	s.client = c
	return s.client, nil
}

func (s *K8sRuleChainStore) GetRuleChainForScheduling(ctx context.Context) ([]models.SchedulableRuleChain, error) {
	client, err := s.getClient()
	if err != nil {
		return nil, fmt.Errorf("initializing rule chain client: %w", err)
	}

	// Empty namespace lists across all namespaces so the scheduler sees
	// chains from every org.
	list, err := client.ListAll(ctx, "", resource.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("listing rule chains: %w", err)
	}

	result := make([]models.SchedulableRuleChain, 0, len(list.Items))
	for _, chain := range list.Items {
		sc, err := convertRuleChain(chain)
		if err != nil {
			s.log.Warn("Skipping rule chain with invalid spec", "uid", chain.Name, "error", err)
			continue
		}
		result = append(result, sc)
	}

	return result, nil
}

// convertRuleChain maps a k8s RuleChain resource into the
// models.SchedulableRuleChain the scheduler expects.
func convertRuleChain(chain alertingv0alpha1.RuleChain) (models.SchedulableRuleChain, error) {
	interval, err := chain.Spec.Trigger.Interval.ToDuration()
	if err != nil {
		return models.SchedulableRuleChain{}, fmt.Errorf("invalid interval: %w", err)
	}

	recRefs := make([]string, 0, len(chain.Spec.RecordingRules))
	for _, ref := range chain.Spec.RecordingRules {
		recRefs = append(recRefs, string(ref.Uid))
	}
	alertRefs := make([]string, 0, len(chain.Spec.AlertingRules))
	for _, ref := range chain.Spec.AlertingRules {
		alertRefs = append(alertRefs, string(ref.Uid))
	}

	return models.SchedulableRuleChain{
		UID:               chain.Name,
		IntervalSeconds:   int64(interval.Seconds()),
		RecordingRuleRefs: recRefs,
		AlertRuleRefs:     alertRefs,
	}, nil
}
