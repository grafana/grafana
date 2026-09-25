package provisioning

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/apps/provisioning/pkg/connection"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

// buildEphemeralRepository parses the POST body into a Repository spec and builds an
// in-memory, non-persisted repository.Repository from it - the same "temporary repository"
// construction the /test subresource uses (see testConnector.Connect). It never reads from
// or writes to storage, so it's safe to call before a Repository object exists.
//
// The built config is run through validator (the same RepositoryValidator used for real
// admission) before being returned, so callers can't use this to reach a repository host
// that real create/update would reject - e.g. one resolving to a private/internal address
// (see RepositoryValidator.validatePrivateEndpoint).
func buildEphemeralRepository(ctx context.Context, r *http.Request, name, ns string, connectionGetter ConnectionGetter, repoFactory repository.Factory, validator repository.Validator) (repository.Repository, error) {
	body, err := readBody(r, defaultMaxBodySize)
	if err != nil {
		return nil, err
	}

	var cfg provisioning.Repository
	if err := json.Unmarshal(body, &cfg); err != nil {
		return nil, err
	}

	// "new" is the frontend's placeholder for "no repository exists yet" (see
	// useCreateOrUpdateRepository.ts), but it's a reserved word that fails Build - same
	// substitution testConnector.Connect uses for the same reason.
	if name == "new" {
		name = "hack-on-hack-for-new"
	}
	cfg.SetName(name)
	cfg.SetNamespace(ns)
	if len(cfg.GetFinalizers()) == 0 {
		cfg.SetFinalizers([]string{
			repository.RemoveOrphanResourcesFinalizer,
			repository.RemovePendingJobsFinalizer,
			repository.CleanFinalizer,
		})
	}

	if cfg.Spec.Connection != nil && cfg.Spec.Connection.Name != "" {
		conn, err := connectionGetter.GetConnection(ctx, cfg.Spec.Connection.Name)
		if err != nil {
			return nil, &k8serrors.StatusError{
				ErrStatus: metav1.Status{
					Status:  metav1.StatusFailure,
					Code:    http.StatusPreconditionFailed,
					Reason:  "PreconditionFailed",
					Message: fmt.Sprintf("connection '%s' not found", cfg.Spec.Connection.Name),
				},
			}
		}

		token, err := conn.GenerateRepositoryToken(ctx, &cfg)
		if err != nil {
			return nil, connectionTokenError(err)
		}
		cfg.Secure.Token.Create = token.Token
	}

	// Build the temporary repository before clearing Connection so provider extras
	// still see it (e.g. bitbucket derives the git token user from it) - see
	// testConnector.Connect for the same ordering and why it matters.
	repo, err := repoFactory.Build(ctx, &cfg)
	if err != nil {
		return nil, err
	}
	cfg.Spec.Connection = nil

	if list := validator.Validate(ctx, repo.Config()); len(list) > 0 {
		return nil, k8serrors.NewInvalid(provisioning.RepositoryResourceInfo.GroupVersionKind().GroupKind(), repo.Config().Name, list)
	}

	return repo, nil
}

// connectionTokenError maps a connection.GenerateRepositoryToken error to the same HTTP
// status codes testConnector.Connect uses for the equivalent errors.
func connectionTokenError(err error) error {
	switch {
	case errors.Is(err, connection.ErrNotImplemented):
		return &k8serrors.StatusError{ErrStatus: metav1.Status{
			Status: metav1.StatusFailure, Code: http.StatusNotImplemented, Reason: "NotImplemented",
			Message: "token generation not implemented for given connection type",
		}}
	case errors.Is(err, connection.ErrRepositoryAccess):
		return &k8serrors.StatusError{ErrStatus: metav1.Status{
			Status: metav1.StatusFailure, Code: http.StatusUnprocessableEntity, Reason: "UnprocessableEntity",
			Message: err.Error(),
		}}
	case errors.Is(err, connection.ErrNotFound):
		return &k8serrors.StatusError{ErrStatus: metav1.Status{
			Status: metav1.StatusFailure, Code: http.StatusNotFound, Reason: metav1.StatusReasonNotFound,
			Message: err.Error(),
		}}
	case errors.Is(err, connection.ErrAuthentication):
		return &k8serrors.StatusError{ErrStatus: metav1.Status{
			Status: metav1.StatusFailure, Code: http.StatusUnauthorized, Reason: metav1.StatusReasonUnauthorized,
			Message: fmt.Sprintf("failed to generate repository token from connection: %v", err),
		}}
	default:
		return &k8serrors.StatusError{ErrStatus: metav1.Status{
			Status: metav1.StatusFailure, Code: http.StatusInternalServerError, Reason: metav1.StatusReasonInternalError,
			Message: fmt.Sprintf("failed to generate repository token from connection: %v", err),
		}}
	}
}

// FiletreeConnectorDependencies is satisfied by APIBuilder.
type FiletreeConnectorDependencies interface {
	ConnectionGetter
	GetRepoFactory() repository.Factory
	GetRepoValidator() repository.Validator
}

// filetreeConnector handles the /filetree subresource for repositories: it builds a
// non-persisted repository from the POST body and lists its file tree, so the onboarding
// wizard can populate folder suggestions before a Repository object exists.
type filetreeConnector struct {
	connectionGetter ConnectionGetter
	repoFactory      repository.Factory
	repoValidator    repository.Validator
}

func NewFiletreeConnector(deps FiletreeConnectorDependencies) *filetreeConnector {
	return &filetreeConnector{
		connectionGetter: deps,
		repoFactory:      deps.GetRepoFactory(),
		repoValidator:    deps.GetRepoValidator(),
	}
}

func (*filetreeConnector) New() runtime.Object {
	return &provisioning.FileList{}
}

func (*filetreeConnector) Destroy() {}

func (*filetreeConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (*filetreeConnector) ProducesObject(verb string) any {
	return &provisioning.FileList{}
}

func (*filetreeConnector) ConnectMethods() []string {
	return []string{http.MethodPost}
}

func (*filetreeConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (c *filetreeConnector) Connect(ctx context.Context, name string, _ runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ns, ok := request.NamespaceFrom(ctx)
		if !ok {
			responder.Error(k8serrors.NewBadRequest("missing namespace"))
			return
		}

		repo, err := buildEphemeralRepository(ctx, r, name, ns, c.connectionGetter, c.repoFactory, c.repoValidator)
		if err != nil {
			responder.Error(err)
			return
		}

		reader, ok := repo.(repository.Reader)
		if !ok {
			responder.Error(k8serrors.NewBadRequest("repository does not support reading files"))
			return
		}

		entries, err := reader.ReadTree(ctx, r.URL.Query().Get("ref"))
		if err != nil {
			responder.Error(err)
			return
		}

		items := make([]provisioning.FileItem, 0, len(entries))
		for _, v := range entries {
			if !v.Blob {
				continue
			}
			items = append(items, provisioning.FileItem{Path: v.Path, Size: v.Size, Hash: v.Hash})
		}

		responder.Object(http.StatusOK, &provisioning.FileList{Items: items})
	}), nil
}

var (
	_ rest.Storage         = (*filetreeConnector)(nil)
	_ rest.Connecter       = (*filetreeConnector)(nil)
	_ rest.StorageMetadata = (*filetreeConnector)(nil)
)

// ReftreeConnectorDependencies is satisfied by APIBuilder.
type ReftreeConnectorDependencies interface {
	ConnectionGetter
	GetRepoFactory() repository.Factory
	GetRepoValidator() repository.Validator
}

// reftreeConnector handles the /reftree subresource for repositories: it builds a
// non-persisted repository from the POST body and lists its refs, so the onboarding
// wizard can populate the branch dropdown before a Repository object exists.
//
// This is a separate connector from refs (rather than a POST branch on it, as originally
// tried) because the apiserver's OpenAPI generation only produces one operation per
// subresource path - adding POST to refsConnector's existing GET path silently dropped
// the POST operation from the generated spec and TS client.
type reftreeConnector struct {
	connectionGetter ConnectionGetter
	repoFactory      repository.Factory
	repoValidator    repository.Validator
}

func NewReftreeConnector(deps ReftreeConnectorDependencies) *reftreeConnector {
	return &reftreeConnector{
		connectionGetter: deps,
		repoFactory:      deps.GetRepoFactory(),
		repoValidator:    deps.GetRepoValidator(),
	}
}

func (*reftreeConnector) New() runtime.Object {
	return &provisioning.RefList{}
}

func (*reftreeConnector) Destroy() {}

func (*reftreeConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (*reftreeConnector) ProducesObject(verb string) any {
	return &provisioning.RefList{}
}

func (*reftreeConnector) ConnectMethods() []string {
	return []string{http.MethodPost}
}

func (*reftreeConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (c *reftreeConnector) Connect(ctx context.Context, name string, _ runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ns, ok := request.NamespaceFrom(ctx)
		if !ok {
			responder.Error(k8serrors.NewBadRequest("missing namespace"))
			return
		}

		repo, err := buildEphemeralRepository(ctx, r, name, ns, c.connectionGetter, c.repoFactory, c.repoValidator)
		if err != nil {
			responder.Error(err)
			return
		}

		versionedRepo, ok := repo.(repository.Versioned)
		if !ok {
			responder.Error(k8serrors.NewBadRequest("repository does not support versioned operations"))
			return
		}

		refs, err := versionedRepo.ListRefs(ctx)
		if err != nil {
			responder.Error(err)
			return
		}

		responder.Object(http.StatusOK, &provisioning.RefList{Items: refs})
	}), nil
}

var (
	_ rest.Storage         = (*reftreeConnector)(nil)
	_ rest.Connecter       = (*reftreeConnector)(nil)
	_ rest.StorageMetadata = (*reftreeConnector)(nil)
)
