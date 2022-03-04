package datasource

import (
	"context"
	"errors"
	"time"

	kerrors "k8s.io/apimachinery/pkg/api/errors"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"

	"github.com/grafana/grafana/internal/components"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/schema"
)

// Coremodel is the coremodel for Datasource component.
type Coremodel struct {
	schema schema.ObjectSchema
	store  components.Store
	client client.Client
	logger log.Logger
}

// ProvideCoremodel provides a new Coremodel with store and schema loaded from loader.
//
// TODO: this is currently done manually and is statically enumerated in the registry.
// We should figure out a way to dynamically register this to registry and automate schema loading too,
// since the loading process will be exactly the same for all components (except for schema options).
func ProvideCoremodel(store components.Store, loader components.SchemaLoader) (*Coremodel, error) {
	schema, err := loader.LoadSchema(context.TODO(), schema.SchemaTypeThema, schema.ThemaLoaderOpts{
		SchemaFS:         cueFS,
		SchemaPath:       cuePath,
		SchemaVersion:    schemaVersion,
		GroupName:        groupName,
		GroupVersion:     groupVersion,
		SchemaOpenapi:    schemaOpenapi,
		SchemaType:       &DatasourceSpec{},
		SchemaObject:     &Datasource{},
		SchemaListObject: &DatasourceList{},
	}, schema.GoLoaderOpts{})
	if err != nil {
		return nil, err
	}

	return &Coremodel{
		store:  store,
		schema: schema,
		logger: log.New("components.datasource.coremodel"),
	}, nil
}

// Schema returns the object schema for this Coremodel.
func (m *Coremodel) Schema() schema.ObjectSchema {
	return m.schema
}

// RegisterController registers the controller for this coremodel.
// Not all coremodels are required to have controllers,
// so if we don't need to register anything, we can just return immediately.
func (m *Coremodel) RegisterController(mgr ctrl.Manager) error {
	m.client = mgr.GetClient()

	return ctrl.NewControllerManagedBy(mgr).
		For(&Datasource{}).
		Complete(m)
}

// Reconcile implements Kubernetes controller reconciliation logic.
func (m *Coremodel) Reconcile(ctx context.Context, req reconcile.Request) (reconcile.Result, error) {
	m.logger.Debug(
		"received reconciliation request",
		"request", req.String(),
	)

	var kubeVal Datasource
	if err := m.client.Get(ctx, req.NamespacedName, &kubeVal); kerrors.IsNotFound(err) {
		m.logger.Debug(
			"removing resource from local store",
			"request", req.String(),
		)

		// Since the object cannot be found in k8s anymore, it means it has been deleted.
		// We should reconcile this by deleting it from local storage as well.
		if err := m.store.Delete(ctx, req.NamespacedName); err != nil {
			m.logger.Error(
				"error removing resource from local store",
				"request", req.String(),
				"error", err,
			)

			return reconcile.Result{
				Requeue:      true,
				RequeueAfter: 1 * time.Minute,
			}, err
		}

		return reconcile.Result{}, nil
	} else if err != nil {
		m.logger.Error(
			"error fetching resource from kubernetes",
			"request", req.String(),
			"error", err,
		)

		return reconcile.Result{
			Requeue:      true,
			RequeueAfter: 1 * time.Minute,
		}, err
	}

	var storeVal Datasource
	if err := m.store.Get(ctx, req.NamespacedName, &storeVal); errors.Is(err, models.ErrDataSourceNotFound) {
		m.logger.Debug(
			"inserting resource to local store",
			"request", req.String(),
		)

		// Since the object cannot be found in local storage, it means we need to create it.
		if err := m.store.Insert(ctx, &kubeVal); err != nil {
			m.logger.Error(
				"error inserting resource to local store",
				"request", req.String(),
				"error", err,
			)

			return reconcile.Result{
				Requeue:      true,
				RequeueAfter: 1 * time.Minute,
			}, err
		}

		return reconcile.Result{}, nil
	} else if err != nil {
		m.logger.Error(
			"error fetching resource from local store",
			"request", req.String(),
			"error", err,
		)

		return reconcile.Result{
			Requeue:      true,
			RequeueAfter: 1 * time.Minute,
		}, err
	}

	m.logger.Debug(
		"updating resource in local store",
		"request", req.String(),
	)

	// Make sure we merge values from both stores accordingly,
	// to account for any dynamic variables changing around.
	var resVal Datasource
	if err := mergeVals(storeVal, kubeVal, &resVal); err != nil {
		m.logger.Error(
			"error merging kubernetes and local values",
			"request", req.String(),
			"error", err,
		)

		return reconcile.Result{
			Requeue:      true,
			RequeueAfter: 1 * time.Minute,
		}, err
	}

	if err := m.store.Update(ctx, &resVal); err != nil {
		m.logger.Error(
			"error updating resource in local store",
			"request", req.String(),
			"error", err,
		)

		return reconcile.Result{
			Requeue:      true,
			RequeueAfter: 1 * time.Minute,
		}, err
	}

	return reconcile.Result{}, nil
}

func mergeVals(store, kube Datasource, result *Datasource) error {
	// TODO: merge the values.
	*result = kube
	return nil
}
