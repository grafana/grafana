package provisioning

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
)

type healthChecker struct {
	getter RepoGetter
	client dynamic.ResourceInterface
	logger *slog.Logger
}

func (h *healthChecker) check(ctx context.Context, cfg *provisioning.Repository) error {
	repo, err := h.getter.AsRepository(ctx, cfg)
	if err != nil {
		return err
	}

	h.logger.Info("running health check on", "repo", cfg.Name)
	now := time.Now().UnixMilli()
	rsp, err := TestRepository(ctx, repo, h.logger)
	if err != nil {
		return err
	}
	cfg.Status.Health = provisioning.HealthStatus{
		Checked: now,
		Healthy: rsp.Success,
		Message: rsp.Errors,
	}
	return nil
}

func toRepository(obj *unstructured.Unstructured) (*provisioning.Repository, error) {
	jj, err := obj.MarshalJSON()
	if err != nil {
		return nil, err
	}
	repo := &provisioning.Repository{}
	err = json.Unmarshal(jj, repo)
	return repo, err
}

func (h *healthChecker) checkAndUpdate(ctx context.Context, obj *unstructured.Unstructured) error {
	cfg, err := toRepository(obj)
	if err != nil {
		return err
	}

	err = h.check(ctx, cfg)
	if err != nil {
		return err
	}

	// Write the health status as map
	jj, _ := json.Marshal(cfg.Status.Health)
	tmp := map[string]any{}
	_ = json.Unmarshal(jj, &tmp)

	// Set the nested health check field
	err = unstructured.SetNestedMap(obj.Object, tmp, "status", "health")
	if err != nil {
		return err
	}

	_, err = h.client.UpdateStatus(ctx, obj, v1.UpdateOptions{}) // << allowed to edit status
	return err
}

func ToPtr[T any](v T) *T {
	return &v
}

// Runs at startup to see when
func (h *healthChecker) start(ctx context.Context) error {
	fmt.Printf("INITIAL check!\n")

	// initial values
	vals, err := h.client.List(ctx, v1.ListOptions{Limit: 1000})
	if err != nil {
		return err
	}
	for idx := range vals.Items {
		err = h.checkAndUpdate(ctx, &vals.Items[idx])
		if err != nil {
			logger.Warn("error running health check", "repo", vals.Items[idx].GetName(), "err", err)
		}
	}

	fmt.Printf("WATCHING!\n")
	watcher, err := h.client.Watch(ctx, v1.ListOptions{
		// Watch:             true,
		// SendInitialEvents: ToPtr(true),
	})
	if err != nil {
		return err
	}
	for event := range watcher.ResultChan() {
		item, ok := event.Object.(*unstructured.Unstructured)
		if !ok {
			h.logger.Warn("expected unstructured event object")
			continue
		}

		switch event.Type {
		case watch.Added, watch.Modified:
			now := time.Now().UnixMilli()
			last, _, err := unstructured.NestedInt64(item.Object, "status", "health", "checked")
			if err != nil {
				h.logger.Warn("error reading status")
				continue
			}

			if (time.Microsecond * time.Duration(now-last)) > (time.Second * 60) {
				err = h.checkAndUpdate(ctx, item)
				if err != nil {
					logger.Warn("error running health check", "repo", item.GetName(), "err", err)
				}
			} else {

				fmt.Printf("Skip health check: %s\n", item.GetName())
			}

		default:
			fmt.Printf("WATCHER: %+v, %s\n", event.Type, item.GetName())
		}
	}
	watcher.Stop()
	return nil
}
