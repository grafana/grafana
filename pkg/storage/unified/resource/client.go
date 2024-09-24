package resource

import (
	"context"
	"fmt"
	"time"

	"github.com/fullstorydev/grpchan"
	"github.com/fullstorydev/grpchan/inprocgrpc"
	"github.com/go-jose/go-jose/v3"
	"github.com/go-jose/go-jose/v3/jwt"
	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/claims"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn/grpcutils"
	grpcUtils "github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
)

type ResourceClient interface {
	ResourceStoreClient
	ResourceIndexClient
	DiagnosticsClient
}

// Internal implementation
type resourceClient struct {
	ResourceStoreClient
	ResourceIndexClient
	DiagnosticsClient
}

func NewResourceClient(channel *grpc.ClientConn) ResourceClient {
	cc := grpchan.InterceptClientConn(channel, grpcUtils.UnaryClientInterceptor, grpcUtils.StreamClientInterceptor)
	return &resourceClient{
		ResourceStoreClient: NewResourceStoreClient(cc),
		ResourceIndexClient: NewResourceIndexClient(cc),
		DiagnosticsClient:   NewDiagnosticsClient(cc),
	}
}

func NewLocalResourceClient(server ResourceServer) ResourceClient {
	channel := &inprocgrpc.Channel{}

	grpcAuthInt := grpcutils.NewInProcGrpcAuthenticator()
	for _, desc := range []*grpc.ServiceDesc{
		&ResourceStore_ServiceDesc,
		&ResourceIndex_ServiceDesc,
		&Diagnostics_ServiceDesc,
	} {
		channel.RegisterService(
			grpchan.InterceptServer(
				desc,
				grpcAuth.UnaryServerInterceptor(grpcAuthInt.Authenticate),
				grpcAuth.StreamServerInterceptor(grpcAuthInt.Authenticate),
			),
			server,
		)
	}

	clientInt, _ := authnlib.NewGrpcClientInterceptor(
		&authnlib.GrpcClientConfig{},
		authnlib.WithDisableAccessTokenOption(),
		authnlib.WithIDTokenExtractorOption(idTokenExtractor),
	)

	cc := grpchan.InterceptClientConn(channel, clientInt.UnaryClientInterceptor, clientInt.StreamClientInterceptor)
	return &resourceClient{
		ResourceStoreClient: NewResourceStoreClient(cc),
		ResourceIndexClient: NewResourceIndexClient(cc),
		DiagnosticsClient:   NewDiagnosticsClient(cc),
	}
}

func idTokenExtractor(ctx context.Context) (string, error) {
	authInfo, ok := claims.From(ctx)
	if !ok {
		return "", fmt.Errorf("no claims found")
	}

	extra := authInfo.GetExtra()
	if token, exists := extra["id-token"]; exists && len(token) != 0 && token[0] != "" {
		return token[0], nil
	}

	// If no token is found, create an internal token.
	// This is a workaround for StaticRequester not having a signed ID token.
	if staticRequester, ok := authInfo.(*identity.StaticRequester); ok {
		token, idClaims, err := createInternalToken(staticRequester)
		if err != nil {
			return "", fmt.Errorf("failed to create internal token: %w", err)
		}

		staticRequester.IDToken = token
		staticRequester.IDTokenClaims = idClaims
		return token, nil
	}

	return "", fmt.Errorf("id-token not found")
}

// createInternalToken creates a symmetrically signed token for using in in-proc mode only.
func createInternalToken(authInfo claims.AuthInfo) (string, *authnlib.Claims[authnlib.IDTokenClaims], error) {
	signerOpts := jose.SignerOptions{}
	signerOpts.WithType("jwt") // Should be uppercase, but this is what authlib expects
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.HS256, Key: []byte("internal key")}, &signerOpts)
	if err != nil {
		return "", nil, err
	}

	identity := authInfo.GetIdentity()
	now := time.Now()
	tokenTTL := 10 * time.Minute
	idClaims := &auth.IDClaims{
		Claims: &jwt.Claims{
			Audience: identity.Audience(),
			Subject:  identity.Subject(),
			Expiry:   jwt.NewNumericDate(now.Add(tokenTTL)),
			IssuedAt: jwt.NewNumericDate(now),
		},
		Rest: authnlib.IDTokenClaims{
			Namespace:  identity.Namespace(),
			Identifier: identity.Identifier(),
			Type:       identity.IdentityType(),
		},
	}

	if claims.IsIdentityType(identity.IdentityType(), claims.TypeUser) {
		idClaims.Rest.Email = identity.Email()
		idClaims.Rest.EmailVerified = identity.EmailVerified()
		idClaims.Rest.AuthenticatedBy = identity.AuthenticatedBy()
		idClaims.Rest.Username = identity.Username()
		idClaims.Rest.DisplayName = identity.DisplayName()
	}

	builder := jwt.Signed(signer).Claims(&idClaims.Rest).Claims(idClaims.Claims)
	token, err := builder.CompactSerialize()
	if err != nil {
		return "", nil, err
	}

	return token, idClaims, nil
}
