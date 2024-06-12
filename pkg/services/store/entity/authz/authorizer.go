package authz

// // NOTE: this whole thing should be moved into a separate package (e.g. multi-tenant authz)

// type Authorizer interface {
// 	Authorize(ctx context.Context, authzParams *AuthZParams) (context.Context, error)
// }

// type AuthorizerImpl struct {
// 	logger      log.Logger
// 	authZClient authzlib.EnforcementClient
// }

// var _ Authorizer = (*AuthorizerImpl)(nil)

// func ProvideAuthorizer(cfg *setting.Cfg) Authorizer {
// 	config := AuthZConfig(cfg)
// 	// TODO handle error
// 	authZClient, _ := authzlib.NewEnforcementClient(*config)
// 	return &AuthorizerImpl{
// 		logger:      log.New("grpc-server-authorizer"),
// 		authZClient: authZClient,
// 	}
// }

// func AuthZConfig(cfg *setting.Cfg) *authzlib.Config {
// 	section := cfg.SectionWithEnvOverrides("entity_authz")
// 	// TODO inject an EnforcementClient interface instead of instantiating it here
// 	//      so that we can have a local or remote implementation
// 	// TODO handle missing config
// 	// TODO handle cap token / sa token
// 	//      (on prem chicken/egg problem? storage <-needs-> stored token)
// 	// TODO add grpc interface? (or wait for the zanzana implementation to be merged)
// 	config := authzlib.Config{
// 		APIURL:  section.Key("api_url").MustString("https://localhost:3000"),
// 		Token:   section.Key("token").MustString("changeme"),
// 		JWKsURL: section.Key("jwks_url").MustString("https://localhost:3000/api/signing-keys/keys"),
// 	}
// 	return &config
// }

// func (f *AuthorizerImpl) Authorize(ctx context.Context, authzParams *AuthZParams) (context.Context, error) {
// 	// TODO: authlib magic here

// 	// Special treatment is required for:
// 	// - list and watch: permission checks have to be done inside storage implementation. Set the fetched
// 	//   rules in the context to be used in storage implementation.
// 	// - read: permission checks have to be postponed for after the data is loaded from storage, possibly inside
// 	//   the interceptor, by inspecting the response and extracting the necessary information from the Entity.

// 	// Assuming uid is the key for now
// 	// Assuming we deal with one resource for now
// 	action, scope := toRBAC(authzParams.Kind[0], authzParams.Key[0].String(), authzParams.Folder, authzParams.Method)

// 	idToken := "changeme" // TODO: get the id token from the context

// 	hasAccess, err := f.authZClient.HasAccess(ctx, idToken, action, scope)
// 	if !hasAccess {
// 		if err != nil {
// 			f.logger.FromContext(ctx).Error("Failed to check access", "error", err)
// 		}
// 		return ctx, status.Error(codes.PermissionDenied, "permission denied")
// 	}

// 	return ctx, nil
// }
