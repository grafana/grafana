package provisioning

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os/exec"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/rendering"
)

type helloWorldSubresource struct {
	getter        rest.Getter
	statusUpdater rest.Updater
	// for our hacky test access right now
	parent *ProvisioningAPIBuilder
}

func (*helloWorldSubresource) New() runtime.Object {
	// This is added as the "ResponseType" regardless what ProducesObject() returns
	return &v0alpha1.HelloWorld{}
}

func (*helloWorldSubresource) Destroy() {}

func (*helloWorldSubresource) NamespaceScoped() bool {
	return true
}

func (*helloWorldSubresource) GetSingularName() string {
	return "HelloWorld"
}

func (*helloWorldSubresource) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (*helloWorldSubresource) ProducesObject(verb string) any {
	return &v0alpha1.HelloWorld{}
}

func (*helloWorldSubresource) ConnectMethods() []string {
	return []string{http.MethodGet}
}

func (*helloWorldSubresource) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (s *helloWorldSubresource) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	obj, err := s.getter.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	repo, ok := obj.(*v0alpha1.Repository)
	if !ok {
		return nil, fmt.Errorf("expected repository, but got %t", obj)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		whom := r.URL.Query().Get("whom")
		if whom == "" {
			whom = "World"
		}

		// Exercise rendering
		renderPath := r.URL.Query().Get("render")
		if renderPath != "" {
			if !s.parent.render.IsAvailable(ctx) {
				responder.Error(fmt.Errorf("render not available"))
				return
			}

			// Get a worker identity
			id, err := s.parent.client.identities.WorkerIdentity(ctx, repo.Namespace)
			if err != nil {
				responder.Error(err)
				return
			}

			ref := r.URL.Query().Get("ref")
			url := fmt.Sprintf("dashboard/provisioning/%s/%s?kiosk&ref=%s", name, renderPath, ref)
			fmt.Printf("RENDER: http://localhost:3000/render/%s\n", url)

			renderContext := identity.WithRequester(context.Background(), id)
			result, err := s.parent.render.Render(renderContext, rendering.RenderPNG, rendering.Opts{
				CommonOpts: rendering.CommonOpts{
					Path: url,
					AuthOpts: rendering.AuthOpts{ // TODO!!!, use the context token/credentials
						OrgID:   1,
						UserID:  1,
						OrgRole: identity.RoleAdmin,
					},
					TimeoutOpts: rendering.TimeoutOpts{
						Timeout: time.Second * 30,
					},
				},
				Theme:  models.ThemeDark, // from config?
				Width:  1024,
				Height: -1, // full page height
			}, nil)
			if err != nil {
				responder.Error(err)
				return
			}

			// Show the result
			w.Write([]byte(result.FilePath))

			// Try opening the file path... HACK HACK HACK!
			cmd := exec.Command("open", result.FilePath)
			_ = cmd.Run()
			return
		}

		newCommit := r.URL.Query().Get("commit")
		if newCommit != "" {
			repo.Status.CurrentGitCommit = newCommit
			obj, b, err := s.statusUpdater.Update(
				ctx,
				name, // resource name
				rest.DefaultUpdatedObjectInfo(obj, func(ctx context.Context, newObj, oldObj runtime.Object) (transformedNewObj runtime.Object, err error) {
					newObj.(*v0alpha1.Repository).Status.CurrentGitCommit = newCommit
					slog.InfoContext(ctx, "updated the commit", "newObj", newObj, "newCommit", newCommit)
					return newObj, nil
				}),
				func(ctx context.Context, obj runtime.Object) error { return nil },      // createValidation
				func(ctx context.Context, obj, old runtime.Object) error { return nil }, // updateValidation
				false,                   // forceAllowCreate
				&metav1.UpdateOptions{}, // options
			)
			if err != nil {
				responder.Error(err)
				return
			}
			repo = obj.(*v0alpha1.Repository)
			slog.InfoContext(ctx, "the conspicuous boolean", "bool", b)
		}

		slog.InfoContext(ctx, "Got a repository",
			"name", repo.Name,
			"type", repo.Spec.Type,
			"status", repo.Status,
			"local", repo.Spec.Local,
			"github", repo.Spec.GitHub,
			"s3", repo.Spec.S3)

		responder.Object(http.StatusOK, &v0alpha1.HelloWorld{Whom: whom})
	}), nil
}

var (
	_ rest.Storage              = (*helloWorldSubresource)(nil)
	_ rest.Connecter            = (*helloWorldSubresource)(nil)
	_ rest.Scoper               = (*helloWorldSubresource)(nil)
	_ rest.SingularNameProvider = (*helloWorldSubresource)(nil)
	_ rest.StorageMetadata      = (*helloWorldSubresource)(nil)
)
