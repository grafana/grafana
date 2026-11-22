package provisioning

import (
	"context"
	"fmt"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

// maxSubmissionBodySize leaves room for the longest description GitHub accepts (65536 characters).
const maxSubmissionBodySize = 256 * 1024

//go:generate mockery --name=SubmitAccess --structname=MockSubmitAccess --inpackage --filename=submit_access_mock.go --with-expecter
type SubmitAccess interface {
	RepoGetter
}

type submitConnector struct {
	access SubmitAccess
}

func NewSubmitConnector(access SubmitAccess) *submitConnector {
	return &submitConnector{access: access}
}

func (*submitConnector) New() runtime.Object {
	return &provisioning.PullRequestSubmission{}
}

func (*submitConnector) Destroy() {}

func (*submitConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (*submitConnector) ProducesObject(verb string) any {
	return &provisioning.PullRequestSubmission{}
}

func (*submitConnector) ConnectMethods() []string {
	return []string{http.MethodPost}
}

func (*submitConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (c *submitConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logger := logging.FromContext(ctx).With("logger", "submit-connector", "repository_name", name)
		ctx := logging.Context(ctx, logger)

		if r.Method != http.MethodPost {
			responder.Error(apierrors.NewMethodNotSupported(provisioning.RepositoryResourceInfo.GroupResource(), r.Method))
			return
		}

		var req provisioning.PullRequestSubmission
		if err := unmarshalJSON(r, maxSubmissionBodySize, &req); err != nil {
			logger.Warn("failed to decode submit request", "error", err, "content_length", r.ContentLength)
			responder.Error(newDecodeError("PullRequestSubmission", err))
			return
		}
		if err := validateSubmission(req.Spec); err != nil {
			responder.Error(err)
			return
		}

		repo, err := c.access.GetRepository(ctx, name)
		if err != nil {
			logger.Debug("failed to find repository", "error", err)
			responder.Error(err)
			return
		}

		submitter, ok := repo.(repository.PullRequestSubmitter)
		if !ok {
			responder.Error(notImplemented("Submitting pull requests is not supported for this repository type"))
			return
		}

		if branch := repo.Config().Branch(); req.Spec.Ref == branch {
			responder.Error(apierrors.NewBadRequest(fmt.Sprintf("spec.ref must differ from the repository branch %q", branch)))
			return
		}

		submitted, err := submitter.SubmitPullRequest(ctx, repository.NewPullRequest{
			Head:  req.Spec.Ref,
			Title: req.Spec.Title,
			Body:  req.Spec.Description,
		})
		if err != nil {
			logger.Warn("failed to submit pull request", "ref", req.Spec.Ref, "error", err)
			respondWithError(responder, err)
			return
		}

		req.Status = provisioning.PullRequestSubmissionStatus{
			Number: submitted.Number,
			URL:    submitted.URL,
		}
		responder.Object(http.StatusOK, &req)
	}), nil
}

func validateSubmission(spec provisioning.PullRequestSubmissionSpec) error {
	switch {
	case spec.Ref == "":
		return apierrors.NewBadRequest("spec.ref is required")
	case spec.Title == "":
		return apierrors.NewBadRequest("spec.title is required")
	}
	return nil
}

func notImplemented(message string) error {
	return &apierrors.StatusError{ErrStatus: metav1.Status{
		Status:  metav1.StatusFailure,
		Code:    http.StatusNotImplemented,
		Reason:  "NotImplemented",
		Message: message,
	}}
}

var (
	_ rest.Storage         = (*submitConnector)(nil)
	_ rest.Connecter       = (*submitConnector)(nil)
	_ rest.StorageMetadata = (*submitConnector)(nil)
)
