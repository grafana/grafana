package snapshots

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
)

type subDeleteREST struct {
	service dashboardsnapshots.Service
}

var _ = rest.Connecter(&subDeleteREST{})

func (r *subDeleteREST) New() runtime.Object {
	return &metav1.Status{}
}

func (r *subDeleteREST) Destroy() {
}

func (r *subDeleteREST) ConnectMethods() []string {
	return []string{"DELETE"}
}

func (r *subDeleteREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, true, ""
}

func (r *subDeleteREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	snap, err := r.service.GetDashboardSnapshot(ctx, &dashboardsnapshots.GetDashboardSnapshotQuery{
		Key: name,
	})
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		_, deleteKey, _ := strings.Cut(req.URL.RawPath, "/delete/")
		if len(deleteKey) < 2 {
			responder.Error(fmt.Errorf("missing delete key"))
			return
		}

		if snap.DeleteKey != deleteKey {
			responder.Error(fmt.Errorf("delete key mismatch"))
			return
		}

		if snap.External {
			s := &metav1.Status{}
			s.Message = fmt.Sprintf("TODO, external delete: %s", snap.Name)
			s.Code = 501
			return
		}

		err = r.service.DeleteDashboardSnapshot(ctx, &dashboardsnapshots.DeleteDashboardSnapshotCommand{
			DeleteKey: deleteKey,
		})
		if err != nil {
			responder.Error(err)
			return
		}

		s := &metav1.Status{}
		s.Message = fmt.Sprintf("%s deleted", snap.Name)
		s.Code = 200
		responder.Object(http.StatusOK, s)
	}), nil
}
