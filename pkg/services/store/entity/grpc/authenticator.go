package grpc

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"

	authnlib "github.com/grafana/authlib/authn"
)

type Authenticator struct {
	verifier authnlib.Verifier[authnlib.IDTokenClaims]
}

func ProvideAuthenticator(cfg *setting.Cfg) *Authenticator {
	section := cfg.SectionWithEnvOverrides("entity_authn")

	// TODO modify the authzlib to use a key retriever
	// share it with the authenticator
	keyConfig := authnlib.KeyRetrieverConfig{
		SigningKeysURL: section.Key("signing_keys_url").MustString("https://localhost:3000/api/signing-keys/keys"),
	}

	// Allow insecure skip verify in dev mode
	retrieverClient := http.DefaultClient
	if cfg.Env == setting.Dev {
		retrieverClient = &http.Client{
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
			},
		}
	}
	retriever := authnlib.NewKeyRetriever(keyConfig, authnlib.WithHTTPClientKeyRetrieverOpt(retrieverClient))

	// TODO specify the allowed audience?
	return &Authenticator{
		verifier: authnlib.NewIDTokenVerifier(authnlib.VerifierConfig{}, retriever),
	}
}

func (f *Authenticator) Authenticate(ctx context.Context) (context.Context, error) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, fmt.Errorf("no metadata found")
	}

	// TODO: use id token instead of these fields
	// login := md.Get("grafana-login")[0]
	// if login == "" {
	// 	return nil, fmt.Errorf("no login found in context")
	// }
	// userID, err := strconv.ParseInt(md.Get("grafana-userid")[0], 10, 64)
	// if err != nil {
	// 	return nil, fmt.Errorf("invalid user id: %w", err)
	// }
	// orgID, err := strconv.ParseInt(md.Get("grafana-orgid")[0], 10, 64)
	// if err != nil {
	// 	return nil, fmt.Errorf("invalid org id: %w", err)
	// }

	// TODO: validate grafana access token as well

	// Validate ID token
	idToken := md.Get("grafana-idtoken")[0]
	if idToken == "" {
		return nil, fmt.Errorf("no id token found in context")
	}

	claims, err := f.verifier.Verify(ctx, idToken)
	if err != nil {
		return nil, fmt.Errorf("failed to verify id token: %w", err)
	}

	id := authn.MustParseNamespaceID(claims.Subject)

	if !id.IsNamespace(authn.NamespaceUser, authn.NamespaceServiceAccount) {
		return nil, fmt.Errorf("invalid namespace: %s", id.Namespace().String())
	}

	userID, err := id.UserID()
	if err != nil {
		return nil, fmt.Errorf("invalid user id: %w", err)
	}

	// TODO add orgID to claims ?
	orgID, err := strconv.ParseInt(md.Get("grafana-orgid")[0], 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid org id: %w", err)
	}

	return appcontext.WithUser(ctx, &user.SignedInUser{
		Login:  claims.Rest.Email,
		UserID: userID,
		OrgID:  orgID,
	}), nil
}

var _ interceptors.Authenticator = (*Authenticator)(nil)

func UnaryClientInterceptor(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
	ctx, err := WrapContext(ctx)
	if err != nil {
		return err
	}
	return invoker(ctx, method, req, reply, cc, opts...)
}

var _ grpc.UnaryClientInterceptor = UnaryClientInterceptor

func StreamClientInterceptor(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
	ctx, err := WrapContext(ctx)
	if err != nil {
		return nil, err
	}
	return streamer(ctx, desc, cc, method, opts...)
}

var _ grpc.StreamClientInterceptor = StreamClientInterceptor

func WrapContext(ctx context.Context) (context.Context, error) {
	user, err := appcontext.User(ctx)
	if err != nil {
		return ctx, err
	}

	// set grpc metadata into the context to pass to the grpc server
	return metadata.NewOutgoingContext(ctx, metadata.Pairs(
		"grafana-idtoken", user.IDToken,
		"grafana-userid", strconv.FormatInt(user.UserID, 10),
		"grafana-orgid", strconv.FormatInt(user.OrgID, 10),
		"grafana-login", user.Login,
	)), nil
}
