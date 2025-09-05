package signature

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

//go:generate mockery --name Signer --structname MockSigner --inpackage --filename signer_mock.go --with-expecter
type Signer interface {
	Sign(ctx context.Context, item utils.GrafanaMetaAccessor) (context.Context, error)
}

type SignOptions struct {
	Namespace string
	History   bool
}

// SignerFactory is a factory for creating Signers
//
//go:generate mockery --name SignerFactory --structname MockSignerFactory --inpackage --filename signature_factory_mock.go --with-expecter
type SignerFactory interface {
	New(ctx context.Context, opts SignOptions) (Signer, error)
}

type signerFactory struct {
	clients resources.ClientFactory
}

func NewSignerFactory(clients resources.ClientFactory) SignerFactory {
	return &signerFactory{clients}
}

func (f *signerFactory) New(ctx context.Context, opts SignOptions) (Signer, error) {
	if !opts.History {
		return NewGrafanaSigner(), nil
	}

	clients, err := f.clients.Clients(ctx, opts.Namespace)
	if err != nil {
		return nil, fmt.Errorf("get clients: %w", err)
	}

	userClient, err := clients.User(ctx)
	if err != nil {
		return nil, fmt.Errorf("get user client: %w", err)
	}

	return NewLoadUsersOnceSigner(userClient), nil
}
