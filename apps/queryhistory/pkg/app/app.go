package app

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/queryhistory/pkg/apis/queryhistory/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

const (
	LabelCreatedBy     = "grafana.app/created-by"
	LabelDatasourceUID = "grafana.app/datasource-uid"
	LabelExpiresAt     = "grafana.app/expires-at"
	DefaultTTL         = 14 * 24 * time.Hour
)

func New(cfg app.Config) (app.App, error) {
	simpleConfig := simple.AppConfig{
		Name:       "queryhistory",
		KubeConfig: cfg.KubeConfig,
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind:      v0alpha1.QueryHistoryKind(),
				Mutator:   &queryHistoryMutator{},
				Validator: &queryHistoryValidator{},
			},
		},
	}

	a, err := simple.NewApp(simpleConfig)
	if err != nil {
		return nil, err
	}

	if err := a.ValidateManifest(cfg.ManifestData); err != nil {
		return nil, err
	}

	return a, nil
}

func GetKinds() map[schema.GroupVersion][]resource.Kind {
	gv := schema.GroupVersion{
		Group:   v0alpha1.QueryHistoryKind().Group(),
		Version: v0alpha1.QueryHistoryKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {v0alpha1.QueryHistoryKind()},
	}
}

// queryHistoryMutator sets system labels on create.
type queryHistoryMutator struct{}

func (m *queryHistoryMutator) Mutate(ctx context.Context, req *app.AdmissionRequest) (*app.MutatingResponse, error) {
	if req.Action != resource.AdmissionActionCreate {
		return &app.MutatingResponse{UpdatedObject: req.Object}, nil
	}

	obj := req.Object

	// Set created-by from request context identity
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get user identity: %w", err)
	}

	labels := obj.GetLabels()
	if labels == nil {
		labels = make(map[string]string)
	}

	labels[LabelCreatedBy] = user.GetUID()

	// Set datasource-uid from spec
	qh, ok := obj.(*v0alpha1.QueryHistory)
	if ok {
		labels[LabelDatasourceUID] = qh.Spec.DatasourceUid
	}

	// Set TTL expiry
	expiresAt := time.Now().Add(DefaultTTL).Unix()
	labels[LabelExpiresAt] = strconv.FormatInt(expiresAt, 10)

	obj.SetLabels(labels)

	return &app.MutatingResponse{UpdatedObject: obj}, nil
}

// queryHistoryValidator validates spec fields.
type queryHistoryValidator struct{}

func (v *queryHistoryValidator) Validate(ctx context.Context, req *app.AdmissionRequest) error {
	qh, ok := req.Object.(*v0alpha1.QueryHistory)
	if !ok {
		return fmt.Errorf("expected QueryHistory object, got %T", req.Object)
	}

	if qh.Spec.DatasourceUid == "" {
		return fmt.Errorf("spec.datasourceUid is required")
	}

	// Validate queries is non-empty valid JSON
	if qh.Spec.Queries == nil {
		return fmt.Errorf("spec.queries is required")
	}

	queriesJSON, err := json.Marshal(qh.Spec.Queries)
	if err != nil {
		return fmt.Errorf("spec.queries must be valid JSON: %w", err)
	}
	if string(queriesJSON) == "null" || string(queriesJSON) == "[]" {
		return fmt.Errorf("spec.queries must not be empty")
	}

	// On update: prevent changes to immutable fields
	if req.Action == resource.AdmissionActionUpdate && req.OldObject != nil {
		oldLabels := req.OldObject.GetLabels()
		newLabels := req.Object.GetLabels()
		if oldLabels[LabelCreatedBy] != newLabels[LabelCreatedBy] {
			return fmt.Errorf("label %s is immutable", LabelCreatedBy)
		}

		oldQH, ok := req.OldObject.(*v0alpha1.QueryHistory)
		if ok {
			if qh.Spec.DatasourceUid != oldQH.Spec.DatasourceUid {
				return fmt.Errorf("spec.datasourceUid is immutable after creation")
			}
			oldJSON, _ := json.Marshal(oldQH.Spec.Queries)
			newJSON, _ := json.Marshal(qh.Spec.Queries)
			if string(oldJSON) != string(newJSON) {
				return fmt.Errorf("spec.queries is immutable after creation")
			}
		}
	}

	return nil
}
