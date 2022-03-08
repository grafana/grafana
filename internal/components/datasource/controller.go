package datasource

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/internal/components/store"
	"github.com/grafana/grafana/pkg/models"
	"k8s.io/client-go/rest"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
)

// requeueAfter can be overidden by the tests
var requeueAfter = 1 * time.Minute

type DatasourceReconciler struct {
	cli rest.Interface
	sto store.Store
}


// We could also accept Bridge instead
func ProvideDatasourceController(mgr ctrl.Manager, cli rest.Interface, stor store.Store) (*DatasourceReconciler, error) {
	d := &DatasourceReconciler{
		cli: cli,
	}

	// TODO should Thema-based approaches differ from pure k8s here? (research!)
	if err := ctrl.NewControllerManagedBy(mgr).
		Named("datasource-controller").
		For(&Datasource{}).
		Complete(reconcile.Func(d.Reconcile)); err != nil {
			return nil, err
		}

	return d, nil
}

var errNotFound = errors.New("k8s obj not found")

func (d *DatasourceReconciler) Reconcile(ctx context.Context, req reconcile.Request) (reconcile.Result, error) {
	ds := Datasource{}

	err := d.cli.Get().Namespace(req.Namespace).Resource("datasources").Name(req.Name).Do(ctx).Into(&ds)

	// TODO: check ACTUAL error
	if errors.Is(err, errNotFound) {
		return reconcile.Result{}, d.sto.Delete(ctx, ds.ObjectMeta.Name)
	}

	if err != nil {
		return reconcile.Result{
			Requeue:      true,
			RequeueAfter: requeueAfter,
		}, err
	}

	_, err = d.sto.Get(ctx, string(ds.ObjectMeta.Name))
	if err != nil {
		if !errors.Is(err, models.ErrDataSourceNotFound) {
			return reconcile.Result{
				Requeue:      true,
				RequeueAfter: requeueAfter,
			}, err 
		}

		if err := d.sto.Insert(ctx, &ds); err != nil {
			return reconcile.Result{
				Requeue:      true,
				RequeueAfter: requeueAfter,
			}, err
		}
	}

	if err := d.sto.Update(ctx, &ds); err != nil {
		return reconcile.Result{
			Requeue:      true,
			RequeueAfter: requeueAfter,
		}, err
	}

	return reconcile.Result{}, nil
}
