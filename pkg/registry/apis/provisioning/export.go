package provisioning

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
)

type exportConnector struct {
	repoGetter RepoGetter
	exporter   jobs.Exporter
}

func (*exportConnector) New() runtime.Object {
	// This is added as the "ResponseType" regardless what ProducesObject() returns
	return &provisioning.JobProgressMessage{}
}

func (*exportConnector) Destroy() {}

func (*exportConnector) ProducesMIMETypes(verb string) []string {
	return []string{"text/plain"} // could be application/x-ndjson, but that rarely helps anything
}

func (c *exportConnector) ProducesObject(verb string) any {
	return c.New()
}

func (*exportConnector) ConnectMethods() []string {
	return []string{http.MethodPost}
}

func (*exportConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (c *exportConnector) Connect(
	ctx context.Context,
	name string,
	opts runtime.Object,
	responder rest.Responder,
) (http.Handler, error) {
	repo, err := c.repoGetter.GetRepository(ctx, name)
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		options := provisioning.ExportOptions{}
		err := json.NewDecoder(r.Body).Decode(&options)
		if err != nil {
			responder.Error(apierrors.NewBadRequest("error decoding request"))
			return
		}

		flusher, ok := w.(http.Flusher)
		if !ok {
			responder.Error(fmt.Errorf("expected http flusher"))
			return
		}

		header := w.Header()
		header.Set("Cache-Control", "no-store")
		header.Set("X-Content-Type-Options", "nosniff")
		header.Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusAccepted)

		cb := func(msg *provisioning.JobProgressMessage) {
			body, _ := json.Marshal(msg)
			body = append(body, []byte("\n")...)
			_, _ = w.Write(body)
			flusher.Flush()
		}
		msg, err := c.exporter.Export(ctx, repo, options, cb)
		if err != nil {
			msg = &provisioning.JobProgressMessage{
				State:   provisioning.JobStateError,
				Message: err.Error(),
			}
		}
		cb(msg)
	}), nil
}

var (
	_ rest.Connecter       = (*exportConnector)(nil)
	_ rest.Storage         = (*exportConnector)(nil)
	_ rest.StorageMetadata = (*exportConnector)(nil)
)
