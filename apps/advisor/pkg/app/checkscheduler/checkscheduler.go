package checkscheduler

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"time"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checkregistry"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const defaultEvaluationInterval = 24 * time.Hour
const defaultMaxHistory = 10

// Runner is a "runnable" app used to be able to expose and API endpoint
// with the existing checks types. This does not need to be a CRUD resource, but it is
// the only way existing at the moment to expose the check types.
type Runner struct {
	checkRegistry      checkregistry.CheckService
	client             resource.Client
	evaluationInterval time.Duration
	maxHistory         int
	namespace          string
	log                logging.Logger
}

// NewRunner creates a new Runner.
func New(cfg app.Config, log logging.Logger) (app.Runnable, error) {
	// Read config
	specificConfig, ok := cfg.SpecificConfig.(checkregistry.AdvisorAppConfig)
	if !ok {
		return nil, fmt.Errorf("invalid config type")
	}
	checkRegistry := specificConfig.CheckRegistry
	evalInterval, err := getEvaluationInterval(specificConfig.PluginConfig)
	if err != nil {
		return nil, err
	}
	maxHistory, err := getMaxHistory(specificConfig.PluginConfig)
	if err != nil {
		return nil, err
	}
	namespace, err := checks.GetNamespace(specificConfig.StackID)
	if err != nil {
		return nil, err
	}

	// Prepare storage client
	clientGenerator := k8s.NewClientRegistry(cfg.KubeConfig, k8s.ClientConfig{})
	client, err := clientGenerator.ClientFor(advisorv0alpha1.CheckKind())
	if err != nil {
		return nil, err
	}

	return &Runner{
		checkRegistry:      checkRegistry,
		client:             client,
		evaluationInterval: evalInterval,
		maxHistory:         maxHistory,
		namespace:          namespace,
		log:                log.With("runner", "advisor.checkscheduler"),
	}, nil
}

func (r *Runner) Run(ctx context.Context) error {
	lastCreated, err := r.checkLastCreated(ctx)
	logger := r.log.WithContext(ctx)
	if err != nil {
		logger.Error("Error getting last check creation time", "error", err)
		// Wait for interval to create the next scheduled check
		lastCreated = time.Now()
	} else {
		// do an initial creation if necessary
		if lastCreated.IsZero() {
			err = r.createChecks(ctx)
			if err != nil {
				logger.Error("Error creating new check reports", "error", err)
			} else {
				lastCreated = time.Now()
			}
		}
	}

	nextSendInterval := time.Until(lastCreated.Add(r.evaluationInterval))
	if nextSendInterval < time.Minute {
		nextSendInterval = 1 * time.Minute
	}

	ticker := time.NewTicker(nextSendInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			err = r.createChecks(ctx)
			if err != nil {
				logger.Error("Error creating new check reports", "error", err)
			}

			err = r.cleanupChecks(ctx, logger)
			if err != nil {
				logger.Error("Error cleaning up old check reports", "error", err)
			}

			if nextSendInterval != r.evaluationInterval {
				nextSendInterval = r.evaluationInterval
			}
			ticker.Reset(nextSendInterval)
		case <-ctx.Done():
			r.markUnprocessedChecksAsErrored(ctx, logger)
			return ctx.Err()
		}
	}
}

// checkLastCreated returns the creation time of the last check created
// regardless of its ID. This assumes that the checks are created in batches
// so a batch will have a similar creation time.
func (r *Runner) checkLastCreated(ctx context.Context) (time.Time, error) {
	list, err := r.client.List(ctx, r.namespace, resource.ListOptions{})
	if err != nil {
		return time.Time{}, err
	}
	lastCreated := time.Time{}
	for _, item := range list.GetItems() {
		itemCreated := item.GetCreationTimestamp().Time
		if itemCreated.After(lastCreated) {
			lastCreated = itemCreated
		}
	}
	return lastCreated, nil
}

// createChecks creates a new check for each check type in the registry.
func (r *Runner) createChecks(ctx context.Context) error {
	for _, check := range r.checkRegistry.Checks() {
		obj := &advisorv0alpha1.Check{
			ObjectMeta: metav1.ObjectMeta{
				GenerateName: "check-",
				Namespace:    r.namespace,
				Labels: map[string]string{
					checks.TypeLabel: check.ID(),
				},
			},
			Spec: advisorv0alpha1.CheckSpec{},
		}
		id := obj.GetStaticMetadata().Identifier()
		_, err := r.client.Create(ctx, id, obj, resource.CreateOptions{})
		if err != nil {
			return fmt.Errorf("error creating check: %w", err)
		}
	}
	return nil
}

// cleanupChecks deletes the olders checks if the number of checks exceeds the limit.
func (r *Runner) cleanupChecks(ctx context.Context, logger logging.Logger) error {
	list, err := r.client.List(ctx, r.namespace, resource.ListOptions{Limit: -1})
	if err != nil {
		return err
	}

	// organize checks by type
	checksByType := map[string][]resource.Object{}
	for _, check := range list.GetItems() {
		labels := check.GetLabels()
		checkType, ok := labels[checks.TypeLabel]
		if !ok {
			logger.Error("Check type not found in labels", "check", check)
			continue
		}
		checksByType[checkType] = append(checksByType[checkType], check)
	}

	for _, checks := range checksByType {
		if len(checks) > r.maxHistory {
			// Sort checks by creation time
			sort.Slice(checks, func(i, j int) bool {
				ti := checks[i].GetCreationTimestamp().Time
				tj := checks[j].GetCreationTimestamp().Time
				return ti.Before(tj)
			})
			// Delete the oldest checks
			for i := 0; i < len(checks)-r.maxHistory; i++ {
				check := checks[i]
				id := check.GetStaticMetadata().Identifier()
				err := r.client.Delete(ctx, id, resource.DeleteOptions{})
				if err != nil {
					return fmt.Errorf("error deleting check: %w", err)
				}
			}
		}
	}

	return nil
}

func getEvaluationInterval(pluginConfig map[string]string) (time.Duration, error) {
	evaluationInterval := defaultEvaluationInterval
	configEvaluationInterval, ok := pluginConfig["evaluation_interval"]
	if ok {
		var err error
		evaluationInterval, err = gtime.ParseDuration(configEvaluationInterval)
		if err != nil {
			return 0, fmt.Errorf("invalid evaluation interval: %w", err)
		}
	}
	return evaluationInterval, nil
}

func getMaxHistory(pluginConfig map[string]string) (int, error) {
	maxHistory := defaultMaxHistory
	configMaxHistory, ok := pluginConfig["max_history"]
	if ok {
		var err error
		maxHistory, err = strconv.Atoi(configMaxHistory)
		if err != nil {
			return 0, fmt.Errorf("invalid max history: %w", err)
		}
	}
	return maxHistory, nil
}

func (r *Runner) markUnprocessedChecksAsErrored(ctx context.Context, log logging.Logger) {
	list, err := r.client.List(ctx, r.namespace, resource.ListOptions{})
	if err != nil {
		log.Error("Error getting checks", "error", err)
		return
	}

	for _, check := range list.GetItems() {
		if checks.GetStatusAnnotation(check) == "" {
			log.Error("Check is unprocessed", "check", check.GetStaticMetadata().Identifier())
			err := checks.SetStatusAnnotation(ctx, r.client, check, checks.StatusAnnotationError)
			if err != nil {
				log.Error("Error setting check status to error", "error", err)
			}
		}
	}
}
