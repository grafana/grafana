package checkscheduler

import (
	"context"
	"fmt"
	"math/rand"
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

const defaultMaxHistory = 10

var (
	waitInterval   = 5 * time.Second
	waitMaxRetries = 3
)

// Runner is a "runnable" app used to be able to expose and API endpoint
// with the existing checks types. This does not need to be a CRUD resource, but it is
// the only way existing at the moment to expose the check types.
type Runner struct {
	checkRegistry      checkregistry.CheckService
	checkClient        resource.Client
	typesClient        resource.Client
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
	evalInterval, err := checks.GetDefaultEvaluationInterval(specificConfig.PluginConfig)
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
	checkClient, err := clientGenerator.ClientFor(advisorv0alpha1.CheckKind())
	if err != nil {
		return nil, err
	}
	typesClient, err := clientGenerator.ClientFor(advisorv0alpha1.CheckTypeKind())
	if err != nil {
		return nil, err
	}

	return &Runner{
		checkRegistry:      checkRegistry,
		checkClient:        checkClient,
		typesClient:        typesClient,
		evaluationInterval: evalInterval,
		maxHistory:         maxHistory,
		namespace:          namespace,
		log:                log.With("runner", "advisor.checkscheduler"),
	}, nil
}

func (r *Runner) Run(ctx context.Context) error {
	logger := r.log.WithContext(ctx)
	// We still need the context to eventually be cancelled to exit this function
	// but we don't want the requests to fail because of it
	ctxWithoutCancel := context.WithoutCancel(ctx)
	lastCreated, err := r.checkLastCreated(ctxWithoutCancel, logger)
	if err != nil {
		logger.Error("Error getting last check creation time", "error", err)
	}
	// If there is no last created check, set it to now
	if lastCreated.IsZero() {
		lastCreated = time.Now()
	} else {
		// Run an initial cleanup to remove old checks
		err = r.cleanupChecks(ctxWithoutCancel, logger)
		if err != nil {
			logger.Error("Error cleaning up old check reports", "error", err)
		}
	}

	checkTypes, err := r.listCheckTypes(ctxWithoutCancel, logger)
	if err != nil {
		logger.Error("Error listing check types", "error", err)
	}

	nextSendInterval := getNextSendInterval(lastCreated, r.evaluationInterval, checkTypes, logger)
	ticker := time.NewTicker(nextSendInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			lastCreated, err := r.checkLastCreated(ctxWithoutCancel, logger)
			if err == nil && !lastCreated.IsZero() {
				// only create checks if there already checks created
				err = r.createChecks(ctxWithoutCancel, checkTypes)
				if err != nil {
					logger.Error("Error creating new check reports", "error", err)
				}

				err = r.cleanupChecks(ctxWithoutCancel, logger)
				if err != nil {
					logger.Error("Error cleaning up old check reports", "error", err)
				}
			}

			// Refresh check types in case there are changes in the schedule
			checkTypes, err = r.listCheckTypes(ctxWithoutCancel, logger)
			if err != nil {
				logger.Error("Error listing check types", "error", err)
			}

			// Reset the ticker to the next send interval
			ticker.Reset(getNextSendInterval(lastCreated, r.evaluationInterval, checkTypes, logger))
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (r *Runner) listChecks(ctx context.Context, logger logging.Logger) ([]resource.Object, error) {
	list, err := r.checkClient.List(ctx, r.namespace, resource.ListOptions{
		Limit: 1000, // Avoid pagination for normal uses cases, which is a costly operation
	})
	if err != nil {
		return nil, err
	}

	checks := list.GetItems()
	for list.GetContinue() != "" {
		logger.Debug("List has continue token, listing next page", "continue", list.GetContinue())
		list, err = r.checkClient.List(ctx, r.namespace, resource.ListOptions{Continue: list.GetContinue(), Limit: 1000})
		if err != nil {
			return nil, err
		}
		checks = append(checks, list.GetItems()...)
	}
	return checks, nil
}

// checkLastCreated returns the creation time of the last check created
// regardless of its ID. This assumes that the checks are created in batches
// so a batch will have a similar creation time.
// In case it finds an unprocessed check from a previous run, it will set it to error.
func (r *Runner) checkLastCreated(ctx context.Context, log logging.Logger) (time.Time, error) {
	checkList, err := r.listChecks(ctx, log)
	if err != nil {
		return time.Time{}, err
	}
	lastCreated := time.Time{}
	for _, item := range checkList {
		itemCreated := item.GetCreationTimestamp().Time
		if itemCreated.After(lastCreated) {
			lastCreated = itemCreated
		}

		// If the check is unprocessed, set it to error
		if checks.GetStatusAnnotation(item) == "" {
			log.Info("Check is unprocessed, marking as error", "check", item.GetStaticMetadata().Identifier())
			err := checks.SetStatusAnnotation(ctx, r.checkClient, item, checks.StatusAnnotationError)
			if err != nil {
				log.Error("Error setting check status to error", "error", err)
			}
		}
	}
	return lastCreated, nil
}

func (r *Runner) listCheckTypes(ctx context.Context, logger logging.Logger) ([]resource.Object, error) {
	// List existing CheckType objects
	list, err := r.typesClient.List(ctx, r.namespace, resource.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("error listing check types: %w", err)
	}
	// This may be run before the check types are registered, so we need to wait for them to be registered.
	allChecksRegistered := len(list.GetItems()) == len(r.checkRegistry.Checks())
	retryCount := 0
	for !allChecksRegistered && retryCount < waitMaxRetries {
		logger.Info("Waiting for all check types to be registered", "retryCount", retryCount, "waitInterval", waitInterval)
		time.Sleep(waitInterval)
		list, err = r.typesClient.List(ctx, r.namespace, resource.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("error listing check types: %w", err)
		}
		allChecksRegistered = len(list.GetItems()) == len(r.checkRegistry.Checks())
		retryCount++
	}
	return list.GetItems(), nil
}

// createChecks creates a new check for each check type in the registry.
func (r *Runner) createChecks(ctx context.Context, checkTypes []resource.Object) error {
	// Create checks for each CheckType
	for _, item := range checkTypes {
		checkType, ok := item.(*advisorv0alpha1.CheckType)
		if !ok {
			continue
		}

		obj := &advisorv0alpha1.Check{
			ObjectMeta: metav1.ObjectMeta{
				GenerateName: "check-",
				Namespace:    r.namespace,
				Labels: map[string]string{
					checks.TypeLabel: checkType.Spec.Name,
				},
			},
			Spec: advisorv0alpha1.CheckSpec{},
		}
		id := obj.GetStaticMetadata().Identifier()
		_, err := r.checkClient.Create(ctx, id, obj, resource.CreateOptions{})
		if err != nil {
			return fmt.Errorf("error creating check: %w", err)
		}
	}
	return nil
}

// cleanupChecks deletes the olders checks if the number of checks exceeds the limit.
func (r *Runner) cleanupChecks(ctx context.Context, logger logging.Logger) error {
	checkList, err := r.listChecks(ctx, logger)
	if err != nil {
		return err
	}

	logger.Debug("Cleaning up checks", "numChecks", len(checkList))

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
				err := r.checkClient.Delete(ctx, id, resource.DeleteOptions{})
				if err != nil {
					return fmt.Errorf("error deleting check: %w", err)
				}
				logger.Debug("Deleted check", "check", check.GetStaticMetadata().Identifier())
			}
		}
	}

	return nil
}

func getNextSendInterval(lastCreated time.Time, defaultEvaluationInterval time.Duration, checkTypes []resource.Object, logger logging.Logger) time.Duration {
	evaluationInterval := defaultEvaluationInterval
	if len(checkTypes) > 0 && checkTypes[0].GetAnnotations()[checks.EvaluationIntervalAnnotation] != "" {
		configuredEvaluationInterval := checkTypes[0].GetAnnotations()[checks.EvaluationIntervalAnnotation]
		parsedEvaluationInterval, err := gtime.ParseDuration(configuredEvaluationInterval)
		if err != nil {
			logger.Error("Error parsing evaluation interval", "error", err)
		} else {
			evaluationInterval = parsedEvaluationInterval
		}
	}

	nextSendInterval := time.Until(lastCreated.Add(evaluationInterval))
	// Add random variation of one hour
	randomVariation := time.Duration(rand.Int63n(time.Hour.Nanoseconds()))
	nextSendInterval += randomVariation
	if nextSendInterval < time.Minute {
		nextSendInterval = 1 * time.Minute
	}
	return nextSendInterval
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
