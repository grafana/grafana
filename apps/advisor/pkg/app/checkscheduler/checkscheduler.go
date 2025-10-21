package checkscheduler

import (
	"context"
	"fmt"
	"math/rand"
	"sort"
	"strconv"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checkregistry"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/services/org"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const defaultEvaluationInterval = 7 * 24 * time.Hour // 7 days
const defaultMaxHistory = 10

var (
	waitInterval                = 5 * time.Second
	waitMaxRetries              = 3
	evalIntervalRandomVariation = 1 * time.Hour
)

// Runner is a "runnable" app used to be able to expose and API endpoint
// with the existing checks types. This does not need to be a CRUD resource, but it is
// the only way existing at the moment to expose the check types.
type Runner struct {
	checkRegistry       checkregistry.CheckService
	checksClient        resource.Client
	typesClient         resource.Client
	defaultEvalInterval time.Duration
	maxHistory          int
	log                 logging.Logger
	orgService          org.Service
	stackID             string
}

// NewRunner creates a new Runner.
func New(cfg app.Config, log logging.Logger) (app.Runnable, error) {
	// Read config
	specificConfig, ok := cfg.SpecificConfig.(checkregistry.AdvisorAppConfig)
	if !ok {
		return nil, fmt.Errorf("invalid config type")
	}
	checkRegistry := specificConfig.CheckRegistry
	orgService := specificConfig.OrgService
	evalInterval, err := getEvaluationInterval(specificConfig.PluginConfig)
	if err != nil {
		return nil, err
	}
	maxHistory, err := getMaxHistory(specificConfig.PluginConfig)
	if err != nil {
		return nil, err
	}

	// Prepare storage client
	clientGenerator := k8s.NewClientRegistry(cfg.KubeConfig, k8s.ClientConfig{})
	client, err := clientGenerator.ClientFor(advisorv0alpha1.CheckKind())
	if err != nil {
		return nil, err
	}
	typesClient, err := clientGenerator.ClientFor(advisorv0alpha1.CheckTypeKind())
	if err != nil {
		return nil, err
	}

	return &Runner{
		checkRegistry:       checkRegistry,
		checksClient:        client,
		typesClient:         typesClient,
		defaultEvalInterval: evalInterval,
		maxHistory:          maxHistory,
		log:                 log.With("runner", "advisor.checkscheduler"),
		orgService:          orgService,
		stackID:             specificConfig.StackID,
	}, nil
}

func (r *Runner) Run(ctx context.Context) error {
	logger := r.log.WithContext(ctx)
	// We still need the context to eventually be cancelled to exit this function
	// but we don't want the requests to fail because of it
	ctxWithoutCancel := context.WithoutCancel(ctx)

	// Determine namespaces based on StackID or OrgID
	namespaces, err := checks.GetNamespaces(ctxWithoutCancel, r.stackID, r.orgService)
	if err != nil {
		return fmt.Errorf("failed to get namespaces: %w", err)
	}

	logger.Debug("Scheduling checks", "namespaces", len(namespaces))

	// Start a goroutine for each namespace
	var wg sync.WaitGroup
	errChan := make(chan error, len(namespaces))

	for _, namespace := range namespaces {
		wg.Add(1)
		go func(ns string) {
			defer wg.Done()
			if err := r.runScheduler(ctxWithoutCancel, logger, ns); err != nil {
				errChan <- err
			}
		}(namespace)
	}

	// Wait for all namespace goroutines to complete
	go func() {
		wg.Wait()
		close(errChan)
	}()

	// Check for any errors from the goroutines
	select {
	case err := <-errChan:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}

// runScheduler runs the check scheduler for a single namespace
func (r *Runner) runScheduler(ctx context.Context, logger logging.Logger, namespace string) error {
	logger = logger.With("namespace", namespace)

	// Get the last created time for this specific namespace
	lastCreated, err := r.checkLastCreated(ctx, logger, namespace)
	if err != nil {
		logger.Error("Error getting last check creation time", "error", err)
		return err
	}

	// If there are checks already created, run an initial cleanup
	if !lastCreated.IsZero() {
		err = r.cleanupChecks(ctx, logger, namespace)
		if err != nil {
			logger.Error("Error cleaning up old check reports", "error", err)
			return err
		}
	}

	nextEvalTime := r.getNextEvalTime(r.defaultEvalInterval, lastCreated)
	ticker := time.NewTicker(nextEvalTime)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// Get the current last created time for this namespace
			lastCreated, err := r.checkLastCreated(ctx, logger, namespace)
			if err != nil {
				logger.Error("Error getting last check creation time", "error", err)
				return err
			}

			// If there are checks already created, then we can automatically create more
			if !lastCreated.IsZero() {
				err = r.createChecks(ctx, logger, namespace)
				if err != nil {
					logger.Error("Error creating new check reports", "error", err)
					return err
				}

				// Clean up old checks to avoid going over the limit
				err = r.cleanupChecks(ctx, logger, namespace)
				if err != nil {
					logger.Error("Error cleaning up old check reports", "error", err)
					return err
				}
			}

			// Reset the ticker to the next send interval
			nextEvalTime = r.getNextEvalTime(r.defaultEvalInterval, lastCreated)
			ticker.Reset(nextEvalTime)
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (r *Runner) listChecks(ctx context.Context, logger logging.Logger, namespace string) ([]resource.Object, error) {
	list, err := r.checksClient.List(ctx, namespace, resource.ListOptions{
		Limit: 1000, // Avoid pagination for normal uses cases, which is a costly operation
	})
	if err != nil {
		return nil, err
	}

	checks := list.GetItems()
	for list.GetContinue() != "" {
		logger.Debug("List has continue token, listing next page", "continue", list.GetContinue())
		list, err = r.checksClient.List(ctx, namespace, resource.ListOptions{Continue: list.GetContinue(), Limit: 1000})
		if err != nil {
			return nil, err
		}
		checks = append(checks, list.GetItems()...)
	}
	return checks, nil
}

// checkLastCreated returns the creation time of the last check created for a specific namespace.
// This assumes that the checks are created in batches so a batch will have a similar creation time.
// In case it finds an unprocessed check from a previous run, it will set it to error.
func (r *Runner) checkLastCreated(ctx context.Context, log logging.Logger, namespace string) (time.Time, error) {
	lastCreated := time.Time{}
	checkList, err := r.listChecks(ctx, log, namespace)
	if err != nil {
		return time.Time{}, err
	}
	for _, item := range checkList {
		itemCreated := item.GetCreationTimestamp().Time
		if itemCreated.After(lastCreated) {
			lastCreated = itemCreated
		}

		// If the check is unprocessed, set it to error
		if checks.GetStatusAnnotation(item) == "" {
			log.Info("Check is unprocessed, marking as error", "check", item.GetStaticMetadata().Identifier())
			err := checks.SetStatusAnnotation(ctx, r.checksClient, item, checks.StatusAnnotationError)
			if err != nil {
				log.Error("Error setting check status to error", "error", err)
			}
		}
	}
	return lastCreated, nil
}

// createChecks creates a new check for each check type in the registry.
func (r *Runner) createChecks(ctx context.Context, logger logging.Logger, namespace string) error {
	// List existing CheckType objects
	list, err := r.typesClient.List(ctx, namespace, resource.ListOptions{})
	if err != nil {
		return fmt.Errorf("error listing check types: %w", err)
	}
	// This may be run before the check types are registered, so we need to wait for them to be registered.
	allChecksRegistered := len(list.GetItems()) == len(r.checkRegistry.Checks())
	retryCount := 0
	for !allChecksRegistered && retryCount < waitMaxRetries {
		logger.Info("Waiting for all check types to be registered", "retryCount", retryCount, "waitInterval", waitInterval)
		time.Sleep(waitInterval)
		list, err = r.typesClient.List(ctx, namespace, resource.ListOptions{})
		if err != nil {
			return fmt.Errorf("error listing check types: %w", err)
		}
		allChecksRegistered = len(list.GetItems()) == len(r.checkRegistry.Checks())
		retryCount++
	}

	// Create checks for each CheckType
	for _, item := range list.GetItems() {
		checkType, ok := item.(*advisorv0alpha1.CheckType)
		if !ok {
			continue
		}

		obj := &advisorv0alpha1.Check{
			ObjectMeta: metav1.ObjectMeta{
				GenerateName: "check-",
				Namespace:    namespace,
				Labels: map[string]string{
					checks.TypeLabel: checkType.Spec.Name,
				},
			},
			Spec: advisorv0alpha1.CheckSpec{},
		}
		id := obj.GetStaticMetadata().Identifier()
		_, err := r.checksClient.Create(ctx, id, obj, resource.CreateOptions{})
		if err != nil {
			return fmt.Errorf("error creating check: %w", err)
		}
	}
	return nil
}

// cleanupChecks deletes the olders checks if the number of checks exceeds the limit.
func (r *Runner) cleanupChecks(ctx context.Context, logger logging.Logger, namespace string) error {
	checkList, err := r.listChecks(ctx, logger, namespace)
	if err != nil {
		return err
	}

	logger.Debug("Cleaning up checks", "namespace", namespace, "numChecks", len(checkList))

	// organize checks by type
	checksByType := map[string][]resource.Object{}
	for _, check := range checkList {
		labels := check.GetLabels()
		checkType, ok := labels[checks.TypeLabel]
		if !ok {
			logger.Error("Check type not found in labels", "check", check)
			continue
		}
		checksByType[checkType] = append(checksByType[checkType], check)
	}

	for checkType, checks := range checksByType {
		logger.Debug("Checking checks", "checkType", checkType, "numChecks", len(checks))
		if len(checks) > r.maxHistory {
			logger.Debug("Deleting old checks", "checkType", checkType, "maxHistory", r.maxHistory, "numChecks", len(checks))
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
				err := r.checksClient.Delete(ctx, id, resource.DeleteOptions{})
				if err != nil {
					return fmt.Errorf("error deleting check: %w", err)
				}
				logger.Debug("Deleted check", "check", check.GetStaticMetadata().Identifier())
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

func (r *Runner) getNextEvalTime(defaultEvaluationInterval time.Duration, lastCreated time.Time) time.Duration {
	nextEvalTime := defaultEvaluationInterval

	baseTime := lastCreated
	if lastCreated.IsZero() {
		baseTime = time.Now()
	}

	// Calculate the next evaluation time and add random variation
	nextEvalTime = time.Until(baseTime.Add(nextEvalTime))
	randomVariation := time.Duration(rand.Int63n(evalIntervalRandomVariation.Nanoseconds()))
	nextEvalTime += randomVariation

	// Ensure we always return a positive duration to avoid ticker panics
	if nextEvalTime <= 0 {
		nextEvalTime = 1 * time.Millisecond
	}

	return nextEvalTime
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
