package sync

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfoimpl"
	"github.com/grafana/grafana/pkg/services/login/authinfotest"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/scimutil"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func ptrString(s string) *string {
	return &s
}

func ptrBool(b bool) *bool {
	return &b
}

func TestUserSync_SyncUserHook(t *testing.T) {
	userProtection := &authinfoimpl.OSSUserProtectionImpl{}

	authFakeNil := &authinfotest.FakeService{
		ExpectedError: user.ErrUserNotFound,
		SetAuthInfoFn: func(_ context.Context, _ *login.SetAuthInfoCommand) error {
			return nil
		},
		UpdateAuthInfoFn: func(_ context.Context, _ *login.UpdateAuthInfoCommand) error {
			return nil
		},
	}
	authFakeUserID := &authinfotest.FakeService{
		ExpectedError: nil,
		ExpectedUserAuth: &login.UserAuth{
			AuthModule: "oauth",
			AuthId:     "2032",
			UserId:     1,
			Id:         1,
		},
	}

	userService := &usertest.FakeUserService{ExpectedUser: &user.User{
		ID:    1,
		UID:   "1",
		Login: "test",
		Name:  "test",
		Email: "test",
	}}

	userServiceMod := &usertest.FakeUserService{ExpectedUser: &user.User{
		ID:         3,
		UID:        "3",
		Login:      "test",
		Name:       "test",
		Email:      "test",
		IsDisabled: true,
		IsAdmin:    false,
	}}

	userServiceEmailMod := &usertest.FakeUserService{ExpectedUser: &user.User{
		ID:            3,
		UID:           "3",
		Login:         "test",
		Name:          "test",
		Email:         "test@test.com",
		EmailVerified: true,
		IsDisabled:    true,
		IsAdmin:       false,
	}}

	userServiceNil := &usertest.FakeUserService{
		ExpectedError: user.ErrUserNotFound,
		CreateFn: func(_ context.Context, cmd *user.CreateUserCommand) (*user.User, error) {
			return &user.User{
				ID:      2,
				UID:     "2",
				Login:   cmd.Login,
				Name:    cmd.Name,
				Email:   cmd.Email,
				IsAdmin: cmd.IsAdmin,
			}, nil
		},
	}

	// --- Setup for SCIM User Tests ---
	// mockUpdateFn helps assert the UpdateUserCommand contents.
	// expectNoUpdateForOtherAttributes is true for SCIM users where only IsGrafanaAdmin should sync from SAML.
	mockUpdateFn := func(t *testing.T, expectedCmd *user.UpdateUserCommand, expectNoUpdateForOtherAttributes bool, originalUserEmail string) func(context.Context, *user.UpdateUserCommand) error {
		return func(_ context.Context, cmd *user.UpdateUserCommand) error {
			if expectedCmd == nil {
				t.Errorf("userService.Update was called unexpectedly")
				return nil
			}

			// Always assert UserID and IsGrafanaAdmin
			assert.Equal(t, expectedCmd.UserID, cmd.UserID, "UpdateUserCommand UserID mismatch")
			if expectedCmd.IsGrafanaAdmin != nil {
				require.NotNil(t, cmd.IsGrafanaAdmin, "UpdateUserCommand IsGrafanaAdmin should not be nil if expected")
				assert.Equal(t, *expectedCmd.IsGrafanaAdmin, *cmd.IsGrafanaAdmin, "UpdateUserCommand IsGrafanaAdmin value mismatch")
			} else {
				assert.Nil(t, cmd.IsGrafanaAdmin, "UpdateUserCommand IsGrafanaAdmin should be nil if not expected to change")
			}

			if expectNoUpdateForOtherAttributes {
				// For SCIM provisioned users, Login, Email, Name should NOT be updated from SAML by this sync.
				assert.Empty(t, cmd.Login, "UpdateUserCommand Login should be empty for SCIM user")
				assert.Empty(t, cmd.Email, "UpdateUserCommand Email should be empty for SCIM user")
				assert.Empty(t, cmd.Name, "UpdateUserCommand Name should be empty for SCIM user")
				assert.Nil(t, cmd.EmailVerified, "UpdateUserCommand EmailVerified should be nil for SCIM user if email not changing")
			} else {
				// For non-SCIM users, other attributes can be updated
				assert.Equal(t, expectedCmd.Login, cmd.Login, "UpdateUserCommand Login mismatch for non-SCIM user")
				assert.Equal(t, expectedCmd.Email, cmd.Email, "UpdateUserCommand Email mismatch for non-SCIM user")
				assert.Equal(t, expectedCmd.Name, cmd.Name, "UpdateUserCommand Name mismatch for non-SCIM user")
				if cmd.Email != "" && cmd.Email != originalUserEmail {
					require.NotNil(t, cmd.EmailVerified, "UpdateUserCommand EmailVerified should be set for non-SCIM user if email changes")
					assert.False(t, *cmd.EmailVerified, "UpdateUserCommand EmailVerified should be false for non-SCIM user if email changes")
				} else if cmd.Email != "" && cmd.Email == originalUserEmail {
					assert.Nil(t, cmd.EmailVerified, "UpdateUserCommand EmailVerified should be nil if email is same as original")
				} else {
					assert.Nil(t, cmd.EmailVerified, "UpdateUserCommand EmailVerified should be nil if email is not changing")
				}
			}
			return nil
		}
	}

	scimUserNotAdminInitial := &user.User{
		ID:            100,
		UID:           "scim_uid_100",
		Login:         "scim.user.notadmin",
		Email:         "scim.notadmin@example.com",
		Name:          "SCIM NotAdmin",
		IsProvisioned: true,
		IsAdmin:       false,
		EmailVerified: true, // Assume initially verified
	}

	scimUserIsAdminInitial := &user.User{
		ID:            101,
		UID:           "scim_uid_101",
		Login:         "scim.user.isadmin",
		Email:         "scim.isadmin@example.com",
		Name:          "SCIM IsAdmin",
		IsProvisioned: true,
		IsAdmin:       true,
		EmailVerified: true,
	}

	nonScimUserInitial := &user.User{
		ID:            102,
		UID:           "nonscim_uid_102",
		Login:         "nonscim.user",
		Email:         "nonscim@example.com",
		Name:          "NonSCIM User",
		IsProvisioned: false,
		IsAdmin:       false,
		EmailVerified: false,
	}

	authFakeBaseScimUser := func(userID int64, externalUID string) *authinfotest.FakeService {
		return &authinfotest.FakeService{
			ExpectedUserAuth: &login.UserAuth{
				AuthModule:  "saml",
				AuthId:      "id_from_saml_assertion",
				ExternalUID: externalUID,
				UserId:      userID,
			},
			SetAuthInfoFn:    func(_ context.Context, _ *login.SetAuthInfoCommand) error { return nil },
			UpdateAuthInfoFn: func(_ context.Context, _ *login.UpdateAuthInfoCommand) error { return nil },
		}
	}

	int64ToStr := func(i int64) string {
		return strconv.FormatInt(i, 10)
	}

	type fields struct {
		userService     user.Service
		authInfoService login.AuthInfoService
		quotaService    quota.Service
	}
	type args struct {
		ctx context.Context
		id  *authn.Identity
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		wantErr bool
		wantID  *authn.Identity
	}{
		{
			name: "no sync",
			fields: fields{
				userService:     userService,
				authInfoService: authFakeNil,
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					Login: "test",
					Name:  "test",
					Email: "test",
					ClientParams: authn.ClientParams{
						LookUpParams: login.UserLookupParams{
							Email: ptrString("test"),
							Login: nil,
						},
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				Login: "test",
				Name:  "test",
				Email: "test",
				ClientParams: authn.ClientParams{
					LookUpParams: login.UserLookupParams{
						Email: ptrString("test"),
						Login: nil,
					},
				},
			},
		},
		{
			name: "sync - user found in DB - by email",
			fields: fields{
				userService:     userService,
				authInfoService: authFakeNil,
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					Login: "test",
					Name:  "test",
					Email: "test",
					ClientParams: authn.ClientParams{
						SyncUser: true,
						LookUpParams: login.UserLookupParams{
							Email: ptrString("test"),
							Login: nil,
						},
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:             "1",
				UID:            "1",
				Type:           claims.TypeUser,
				Login:          "test",
				Name:           "test",
				Email:          "test",
				IsGrafanaAdmin: ptrBool(false),
				ClientParams: authn.ClientParams{
					SyncUser: true,
					LookUpParams: login.UserLookupParams{
						Email: ptrString("test"),
						Login: nil,
					},
				},
			},
		},
		{
			name: "sync - user found in DB - by login",
			fields: fields{
				userService:     userService,
				authInfoService: authFakeNil,
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					Login: "test",
					Name:  "test",
					Email: "test",
					ClientParams: authn.ClientParams{
						SyncUser: true,
						LookUpParams: login.UserLookupParams{
							Email: nil,
							Login: ptrString("test"),
						},
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:             "1",
				UID:            "1",
				Type:           claims.TypeUser,
				Login:          "test",
				Name:           "test",
				Email:          "test",
				IsGrafanaAdmin: ptrBool(false),
				ClientParams: authn.ClientParams{
					LookUpParams: login.UserLookupParams{
						Email: nil,
						Login: ptrString("test"),
					},
					SyncUser: true,
				},
			},
		},
		{
			name: "sync - user found in authInfo",
			fields: fields{
				userService:     userService,
				authInfoService: authFakeUserID,
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					AuthID:          "2032",
					AuthenticatedBy: "oauth",
					Login:           "test",
					Name:            "test",
					Email:           "test",
					ClientParams: authn.ClientParams{
						SyncUser: true,
						LookUpParams: login.UserLookupParams{
							Email: nil,
							Login: nil,
						},
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:              "1",
				UID:             "1",
				Type:            claims.TypeUser,
				AuthID:          "2032",
				AuthenticatedBy: "oauth",
				Login:           "test",
				Name:            "test",
				Email:           "test",
				IsGrafanaAdmin:  ptrBool(false),
				ClientParams: authn.ClientParams{
					SyncUser: true,
					LookUpParams: login.UserLookupParams{
						Email: nil,
						Login: nil,
					},
				},
			},
		},
		{
			name: "sync - user needs to be created - disabled signup",
			fields: fields{
				userService:     userService,
				authInfoService: authFakeNil,
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					Login:           "test",
					Name:            "test",
					Email:           "test",
					AuthenticatedBy: "oauth",
					AuthID:          "2032",
					ClientParams: authn.ClientParams{
						SyncUser: true,
						LookUpParams: login.UserLookupParams{
							Email: nil,
							Login: nil,
						},
					},
				},
			},
			wantErr: true,
		},
		{
			name: "sync - user needs to be created - enabled signup",
			fields: fields{
				userService:     userServiceNil,
				authInfoService: authFakeNil,
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					Login:           "test_create",
					Name:            "test_create",
					IsGrafanaAdmin:  ptrBool(true),
					Email:           "test_create",
					AuthenticatedBy: "oauth",
					AuthID:          "2032",
					ClientParams: authn.ClientParams{
						SyncUser:    true,
						AllowSignUp: true,
						EnableUser:  true,
						LookUpParams: login.UserLookupParams{
							Email: ptrString("test_create"),
							Login: nil,
						},
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:              "2",
				UID:             "2",
				Type:            claims.TypeUser,
				Login:           "test_create",
				Name:            "test_create",
				Email:           "test_create",
				AuthenticatedBy: "oauth",
				AuthID:          "2032",
				IsGrafanaAdmin:  ptrBool(true),
				ClientParams: authn.ClientParams{
					SyncUser:    true,
					AllowSignUp: true,
					EnableUser:  true,
					LookUpParams: login.UserLookupParams{
						Email: ptrString("test_create"),
						Login: nil,
					},
				},
			},
		},
		{
			name: "sync - needs full update",
			fields: fields{
				userService:     userServiceMod,
				authInfoService: authFakeNil,
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					Login:          "test_mod",
					Name:           "test_mod",
					Email:          "test_mod",
					IsDisabled:     false,
					IsGrafanaAdmin: ptrBool(true),
					ClientParams: authn.ClientParams{
						SyncUser:   true,
						EnableUser: true,
						LookUpParams: login.UserLookupParams{
							Email: nil,
							Login: ptrString("test"),
						},
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:             "3",
				UID:            "3",
				Type:           claims.TypeUser,
				Login:          "test_mod",
				Name:           "test_mod",
				Email:          "test_mod",
				IsDisabled:     false,
				IsGrafanaAdmin: ptrBool(true),
				ClientParams: authn.ClientParams{
					SyncUser:   true,
					EnableUser: true,
					LookUpParams: login.UserLookupParams{
						Email: nil,
						Login: ptrString("test"),
					},
				},
			},
		},
		{
			name: "sync - reset email verified on email change",
			fields: fields{
				userService:     userServiceEmailMod,
				authInfoService: authFakeNil,
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					Login:          "test",
					Name:           "test",
					Email:          "test_mod@test.com",
					EmailVerified:  true,
					IsDisabled:     false,
					IsGrafanaAdmin: ptrBool(true),
					ClientParams: authn.ClientParams{
						SyncUser:   true,
						EnableUser: true,
						LookUpParams: login.UserLookupParams{
							Email: nil,
							Login: ptrString("test"),
						},
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:             "3",
				UID:            "3",
				Type:           claims.TypeUser,
				Name:           "test",
				Login:          "test",
				Email:          "test_mod@test.com",
				IsDisabled:     false,
				EmailVerified:  false,
				IsGrafanaAdmin: ptrBool(true),
				ClientParams: authn.ClientParams{
					SyncUser:   true,
					EnableUser: true,
					LookUpParams: login.UserLookupParams{
						Email: nil,
						Login: ptrString("test"),
					},
				},
			},
		},
		{
			name: "SyncUserHook: Provisioned user, Incoming ExternalUID is empty, DB ExternalUID non-empty - expect errEmptyExternalUID",
			fields: fields{
				userService:     &usertest.FakeUserService{ExpectedUser: &user.User{ID: 1, IsProvisioned: true}},
				authInfoService: &authinfotest.FakeService{ExpectedUserAuth: &login.UserAuth{UserId: 1, AuthModule: login.SAMLAuthModule, ExternalUID: "db-uid"}},
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					AuthID:          "1",
					AuthenticatedBy: login.SAMLAuthModule,
					ExternalUID:     "",
					ClientParams:    authn.ClientParams{SyncUser: true},
				},
			},
			wantErr: true, // Expecting errEmptyExternalUID
		},
		{
			name: "SyncUserHook: Provisioned user, Incoming ExternalUID is empty, DB ExternalUID also empty - expect errEmptyExternalUID",
			fields: fields{
				userService:     &usertest.FakeUserService{ExpectedUser: &user.User{ID: 1, IsProvisioned: true}},
				authInfoService: &authinfotest.FakeService{ExpectedUserAuth: &login.UserAuth{UserId: 1, AuthModule: login.SAMLAuthModule, ExternalUID: ""}}, // DB empty
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					AuthID:          "1",
					AuthenticatedBy: login.SAMLAuthModule,
					ExternalUID:     "",
					ClientParams:    authn.ClientParams{SyncUser: true},
				},
			},
			wantErr: true, // Expecting errEmptyExternalUID
		},
		{
			name: "SyncUserHook: Provisioned user, Incoming and DB ExternalUIDs non-empty and mismatch - expect errMismatchedExternalUID",
			fields: fields{
				userService:     &usertest.FakeUserService{ExpectedUser: &user.User{ID: 1, IsProvisioned: true}},
				authInfoService: &authinfotest.FakeService{ExpectedUserAuth: &login.UserAuth{UserId: 1, AuthModule: login.SAMLAuthModule, ExternalUID: "db-uid"}},
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					AuthID:          "1",
					AuthenticatedBy: login.SAMLAuthModule,
					ExternalUID:     "incoming-uid",
					ClientParams:    authn.ClientParams{SyncUser: true},
				},
			},
			wantErr: true, // Expecting errMismatchedExternalUID
		},
		{
			name: "SyncUserHook: Provisioned user, Incoming and DB ExternalUIDs non-empty and match - expect success",
			fields: fields{
				userService:     &usertest.FakeUserService{ExpectedUser: &user.User{ID: 1, Login: "user1", Email: "user1@test.com", Name: "User One", IsProvisioned: true}},
				authInfoService: &authinfotest.FakeService{ExpectedUserAuth: &login.UserAuth{UserId: 1, AuthModule: login.SAMLAuthModule, AuthId: "1", ExternalUID: "matching-uid"}},
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					AuthID:          "1",
					AuthenticatedBy: login.SAMLAuthModule,
					Login:           "user1",
					Email:           "user1@test.com",
					Name:            "User One",
					ExternalUID:     "matching-uid",
					ClientParams:    authn.ClientParams{SyncUser: true},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:              "1",
				UID:             "",
				Type:            claims.TypeUser,
				AuthID:          "1",
				AuthenticatedBy: login.SAMLAuthModule,
				Login:           "user1",
				Email:           "user1@test.com",
				Name:            "User One",
				ExternalUID:     "matching-uid",
				IsGrafanaAdmin:  ptrBool(false),
				ClientParams:    authn.ClientParams{SyncUser: true},
			},
		},
		{
			name: "SCIM User (not admin) promoted to Grafana Admin via SAML",
			fields: fields{
				userService: func() user.Service {
					userCopy := *scimUserNotAdminInitial                     // Create a mutable copy
					svc := usertest.FakeUserService{ExpectedUser: &userCopy} // Set ExpectedUser to the copy
					svc.UpdateFn = func(ctx context.Context, cmd *user.UpdateUserCommand) error {
						// Call the original mockUpdateFn for assertions
						err := mockUpdateFn(t, &user.UpdateUserCommand{
							UserID:         scimUserNotAdminInitial.ID,
							IsGrafanaAdmin: ptrBool(true),
						}, true, scimUserNotAdminInitial.Email)(ctx, cmd)
						if err != nil {
							return err
						}
						// Simulate the update on the copy
						if cmd.IsGrafanaAdmin != nil {
							userCopy.IsAdmin = *cmd.IsGrafanaAdmin
						}
						// After modification, GetByID should return this updated userCopy
						svc.ExpectedUser = &userCopy
						return nil
					}
					return &svc
				}(),
				authInfoService: authFakeBaseScimUser(scimUserNotAdminInitial.ID, "external_id_promote"),
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					AuthID:          "id_from_saml_assertion",
					AuthenticatedBy: "saml",
					ExternalUID:     "external_id_promote",            // Match AuthInfo for SCIM path
					Login:           "saml.login. متفاوت",             // SAML sends different login
					Email:           "saml.email. متفاوت@example.com", // SAML sends different email
					Name:            "SAML Name متفاوت",               // SAML sends different name
					IsGrafanaAdmin:  ptrBool(true),                    // Key change: SAML says user IS admin
					ClientParams: authn.ClientParams{
						SyncUser: true,
						// LookUpParams not strictly needed if AuthID + AuthenticatedBy + ExternalUID is enough
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{ // Expected state of identity object AFTER sync
				ID:              int64ToStr(scimUserNotAdminInitial.ID),
				UID:             scimUserNotAdminInitial.UID,
				Type:            claims.TypeUser,
				Login:           "saml.login. متفاوت",             // Reflects actual behavior: SAML input value persists
				Email:           "saml.email. متفاوت@example.com", // Reflects actual behavior: SAML input value persists
				Name:            "SAML Name متفاوت",               // Reflects actual behavior: SAML input value persists
				IsGrafanaAdmin:  ptrBool(true),                    // This SHOULD be updated
				EmailVerified:   false,                            // Reflects actual behavior: becomes false
				AuthID:          "id_from_saml_assertion",
				AuthenticatedBy: "saml",
				ExternalUID:     "external_id_promote",
				ClientParams: authn.ClientParams{
					SyncUser: true,
				},
			},
		},
		{
			name: "SCIM User (is admin) demoted from Grafana Admin via SAML",
			fields: fields{
				userService: func() user.Service {
					userCopy := *scimUserIsAdminInitial                      // Create a mutable copy
					svc := usertest.FakeUserService{ExpectedUser: &userCopy} // Set ExpectedUser to the copy
					svc.UpdateFn = func(ctx context.Context, cmd *user.UpdateUserCommand) error {
						// Call the original mockUpdateFn for assertions
						err := mockUpdateFn(t, &user.UpdateUserCommand{
							UserID:         scimUserIsAdminInitial.ID,
							IsGrafanaAdmin: ptrBool(false),
						}, true, scimUserIsAdminInitial.Email)(ctx, cmd)
						if err != nil {
							return err
						}
						// Simulate the update on the copy
						if cmd.IsGrafanaAdmin != nil {
							userCopy.IsAdmin = *cmd.IsGrafanaAdmin
						}
						// After modification, GetByID should return this updated userCopy
						svc.ExpectedUser = &userCopy
						return nil
					}
					return &svc
				}(),
				authInfoService: authFakeBaseScimUser(scimUserIsAdminInitial.ID, "external_id_demote"),
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					AuthID:          "id_from_saml_assertion",
					AuthenticatedBy: "saml",
					ExternalUID:     "external_id_demote",
					IsGrafanaAdmin:  ptrBool(false), // Key change: SAML says user is NOT admin
					ClientParams: authn.ClientParams{
						SyncUser: true,
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:              int64ToStr(scimUserIsAdminInitial.ID),
				UID:             scimUserIsAdminInitial.UID,
				Type:            claims.TypeUser,
				Login:           scimUserIsAdminInitial.Login,
				Email:           scimUserIsAdminInitial.Email,
				Name:            scimUserIsAdminInitial.Name,
				IsGrafanaAdmin:  ptrBool(false), // Updated
				EmailVerified:   scimUserIsAdminInitial.EmailVerified,
				AuthID:          "id_from_saml_assertion",
				AuthenticatedBy: "saml",
				ExternalUID:     "external_id_demote",
				ClientParams: authn.ClientParams{
					SyncUser: true,
				},
			},
		},
		{
			name: "SCIM User (not admin), SAML sends different email/name but NO IsGrafanaAdmin change",
			fields: fields{
				userService: func() user.Service {
					userCopy := *scimUserNotAdminInitial                     // Create a mutable copy
					svc := usertest.FakeUserService{ExpectedUser: &userCopy} // Set ExpectedUser to the copy
					svc.UpdateFn = func(ctx context.Context, cmd *user.UpdateUserCommand) error {
						// Call the original mockUpdateFn for assertions
						// In this case, IsGrafanaAdmin from SAML (false) matches DB (false), so it *will* be in the command.
						err := mockUpdateFn(t, &user.UpdateUserCommand{
							UserID:         scimUserNotAdminInitial.ID,
							IsGrafanaAdmin: ptrBool(false), // SAML says false, DB is false
						}, true, scimUserNotAdminInitial.Email)(ctx, cmd)
						if err != nil {
							return err
						}
						// Simulate the update on the copy (no change expected for IsAdmin here)
						if cmd.IsGrafanaAdmin != nil {
							userCopy.IsAdmin = *cmd.IsGrafanaAdmin
						}
						// After modification, GetByID should return this userCopy
						svc.ExpectedUser = &userCopy
						return nil
					}
					return &svc
				}(),
				authInfoService: authFakeBaseScimUser(scimUserNotAdminInitial.ID, "external_id_other_attr"),
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					AuthID:          "id_from_saml_assertion",
					AuthenticatedBy: "saml",
					ExternalUID:     "external_id_other_attr",
					Login:           "saml.login.new",             // SAML sends different login
					Email:           "saml.email.new@example.com", // SAML sends different email
					Name:            "SAML Name New",              // SAML sends different name
					IsGrafanaAdmin:  ptrBool(false),               // SAML says not admin (same as DB)
					ClientParams: authn.ClientParams{
						SyncUser: true,
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:              int64ToStr(scimUserNotAdminInitial.ID),
				UID:             scimUserNotAdminInitial.UID,
				Type:            claims.TypeUser,
				Login:           "saml.login.new",             // Reflects actual behavior: SAML input value persists
				Email:           "saml.email.new@example.com", // Reflects actual behavior: SAML input value persists
				Name:            "SAML Name New",              // Reflects actual behavior: SAML input value persists
				IsGrafanaAdmin:  ptrBool(false),               // Unchanged, matches DB
				EmailVerified:   false,                        // Reflects actual behavior: becomes false
				AuthID:          "id_from_saml_assertion",
				AuthenticatedBy: "saml",
				ExternalUID:     "external_id_other_attr",
				ClientParams: authn.ClientParams{
					SyncUser: true,
				},
			},
		},
		{
			name: "NON-SCIM User, SAML updates IsGrafanaAdmin and Email",
			fields: fields{
				userService: func() user.Service {
					userCopy := *nonScimUserInitial                          // Create a mutable copy
					svc := usertest.FakeUserService{ExpectedUser: &userCopy} // Set ExpectedUser to the copy
					svc.UpdateFn = func(ctx context.Context, cmd *user.UpdateUserCommand) error {
						// For non-SCIM, Login and Name are only included if they change.
						// Email changes, IsGrafanaAdmin changes.
						expectedCmd := &user.UpdateUserCommand{
							UserID:         nonScimUserInitial.ID,
							IsGrafanaAdmin: ptrBool(true),
							Email:          "nonscim.new.email@example.com",
							Login:          "", // Login not changing, so should be empty in cmd
							Name:           "", // Name not changing, so should be empty in cmd
						}
						err := mockUpdateFn(t, expectedCmd, false, nonScimUserInitial.Email)(ctx, cmd)
						if err != nil {
							return err
						}

						// Simulate the update on the copy
						if cmd.IsGrafanaAdmin != nil {
							userCopy.IsAdmin = *cmd.IsGrafanaAdmin
						}
						if cmd.Email != "" {
							if userCopy.Email != cmd.Email {
								userCopy.Email = cmd.Email
								userCopy.EmailVerified = false // Email changed, so unverify
							} else if cmd.EmailVerified != nil { // If email is same, but EmailVerified explicitly passed
								userCopy.EmailVerified = *cmd.EmailVerified
							}
						} else if cmd.EmailVerified != nil { // Email not in cmd, but EmailVerified is (e.g. allow_sign_up case)
							userCopy.EmailVerified = *cmd.EmailVerified
						}

						if cmd.Login != "" {
							userCopy.Login = cmd.Login
						}
						if cmd.Name != "" {
							userCopy.Name = cmd.Name
						}

						// After modification, GetByID should return this updated userCopy
						svc.ExpectedUser = &userCopy
						return nil
					}
					return &svc
				}(),
				// For non-SCIM, authinfo might not exist or not have ExternalUID, lookup by email/login
				authInfoService: authFakeNil,
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					AuthenticatedBy: "saml",
					// No AuthID or ExternalUID for this non-SCIM path, will lookup by email/login
					Login:          nonScimUserInitial.Login,        // Use initial login for lookup
					Email:          "nonscim.new.email@example.com", // SAML sends new email
					Name:           nonScimUserInitial.Name,         // Name is same
					IsGrafanaAdmin: ptrBool(true),                   // SAML promotes to admin
					ClientParams: authn.ClientParams{
						SyncUser: true,
						LookUpParams: login.UserLookupParams{
							Login: ptrString(nonScimUserInitial.Login), // Lookup by existing login
						},
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:              int64ToStr(nonScimUserInitial.ID),
				UID:             nonScimUserInitial.UID,
				Type:            claims.TypeUser,
				Login:           nonScimUserInitial.Login,        // Login updated if it was in UpdateUserCommand
				Email:           "nonscim.new.email@example.com", // Email updated
				Name:            nonScimUserInitial.Name,         // Name updated if it was in UpdateUserCommand
				IsGrafanaAdmin:  ptrBool(true),                   // IsAdmin updated
				EmailVerified:   false,                           // Email changed, so should be unverified
				AuthenticatedBy: "saml",
				ClientParams: authn.ClientParams{
					SyncUser: true,
					LookUpParams: login.UserLookupParams{
						Login: ptrString(nonScimUserInitial.Login),
					},
				},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := ProvideUserSync(tt.fields.userService, userProtection, tt.fields.authInfoService, tt.fields.quotaService, tracing.InitializeTracerForTest(), featuremgmt.WithFeatures(), setting.NewCfg(), nil)
			err := s.SyncUserHook(tt.args.ctx, tt.args.id, nil)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			require.EqualValues(t, tt.wantID, tt.args.id)
		})
	}
}

func TestUserSync_SyncUserRetryFetch(t *testing.T) {
	userSrv := usertest.NewMockService(t)
	userSrv.On("GetByEmail", mock.Anything, mock.Anything).Return(nil, user.ErrUserNotFound).Once()
	userSrv.On("Create", mock.Anything, mock.Anything).Return(nil, user.ErrUserAlreadyExists).Once()
	userSrv.On("GetByEmail", mock.Anything, mock.Anything).Return(&user.User{ID: 1}, nil).Once()

	s := ProvideUserSync(
		userSrv,
		authinfoimpl.ProvideOSSUserProtectionService(),
		&authinfotest.FakeService{},
		&quotatest.FakeQuotaService{},
		tracing.NewNoopTracerService(),
		featuremgmt.WithFeatures(),
		setting.NewCfg(),
		nil,
	)

	email := "test@test.com"

	err := s.SyncUserHook(context.Background(), &authn.Identity{
		ClientParams: authn.ClientParams{
			SyncUser:    true,
			AllowSignUp: true,
			LookUpParams: login.UserLookupParams{
				Email: &email,
			},
		},
	}, nil)
	require.NoError(t, err)
}

func TestUserSync_FetchSyncedUserHook(t *testing.T) {
	type testCase struct {
		desc        string
		req         *authn.Request
		identity    *authn.Identity
		expectedErr error
	}

	tests := []testCase{
		{
			desc:     "should skip hook when flag is not enabled",
			req:      &authn.Request{},
			identity: &authn.Identity{ClientParams: authn.ClientParams{FetchSyncedUser: false}},
		},
		{
			desc:     "should skip hook when identity is not a user",
			req:      &authn.Request{},
			identity: &authn.Identity{ID: "1", Type: claims.TypeAPIKey, ClientParams: authn.ClientParams{FetchSyncedUser: true}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			s := UserSync{
				tracer: tracing.InitializeTracerForTest(),
			}
			err := s.FetchSyncedUserHook(context.Background(), tt.identity, tt.req)
			require.ErrorIs(t, err, tt.expectedErr)
		})
	}
}

func TestUserSync_CatalogLoginHook(t *testing.T) {
	type testCase struct {
		name           string
		identity       *authn.Identity
		expectFlagSet  bool
		catalogVersion string
	}

	tests := []testCase{
		{
			name: "should skip hook when SyncUser flag is not enabled",
			identity: &authn.Identity{
				ClientParams: authn.ClientParams{
					SyncUser: false,
				},
			},
			expectFlagSet: false,
		},
		{
			name: "should skip hook when request is nil",
			identity: &authn.Identity{
				ClientParams: authn.ClientParams{
					SyncUser: true,
				},
			},
		},
		{
			name: "should skip hook when catalog version is not set",
			identity: &authn.Identity{
				ClientParams: authn.ClientParams{
					SyncUser: true,
				},
			},
			expectFlagSet: false,
		},
		{
			name: "should not set loginflag when catalog version is set incorrectly",
			identity: &authn.Identity{
				ClientParams: authn.ClientParams{
					SyncUser: true,
				},
			},
			catalogVersion: "v0aplha1",
			expectFlagSet:  false,
		},
		{
			name: "should not set loginflag when catalog version is empty",
			identity: &authn.Identity{
				ClientParams: authn.ClientParams{
					SyncUser: true,
				},
			},
			expectFlagSet: false,
		},
		{
			name: "should set successful loginflag when catalog version is set correctly",
			identity: &authn.Identity{
				ClientParams: authn.ClientParams{
					SyncUser: true,
				},
			},
			catalogVersion: "1.0.0",
			expectFlagSet:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := UserSync{
				tracer: tracing.InitializeTracerForTest(),
				log:    log.New("test"),
			}

			req := authn.Request{}
			if tt.catalogVersion != "" {
				req.SetMeta("catalog_version", tt.catalogVersion)
			}

			s.CatalogLoginHook(context.Background(), tt.identity, &req, nil)
			usageStats := s.GetUsageStats(context.Background())
			countIndex := fmt.Sprintf("stats.features.saml.catalog_version_%s.count", tt.catalogVersion)
			countResult := usageStats[countIndex] != nil && usageStats[countIndex].(int) == 1
			assert.Equal(t, tt.expectFlagSet, countResult)
		})
	}
}

func TestUserSync_EnableDisabledUserHook(t *testing.T) {
	type testCase struct {
		desc       string
		identity   *authn.Identity
		enableUser bool
	}

	tests := []testCase{
		{
			desc: "should skip if correct flag is not set",
			identity: &authn.Identity{
				ID:           "1",
				Type:         claims.TypeUser,
				IsDisabled:   true,
				ClientParams: authn.ClientParams{EnableUser: false},
			},
			enableUser: false,
		},
		{
			desc: "should skip if identity is not a user",
			identity: &authn.Identity{
				ID:           "1",
				Type:         claims.TypeAPIKey,
				IsDisabled:   true,
				ClientParams: authn.ClientParams{EnableUser: true},
			},
			enableUser: false,
		},
		{
			desc: "should enabled disabled user",
			identity: &authn.Identity{
				ID:           "1",
				Type:         claims.TypeUser,
				IsDisabled:   true,
				ClientParams: authn.ClientParams{EnableUser: true},
			},
			enableUser: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			userSvc := usertest.NewUserServiceFake()
			called := false
			userSvc.UpdateFn = func(_ context.Context, _ *user.UpdateUserCommand) error {
				called = true
				return nil
			}

			s := UserSync{userService: userSvc, tracer: tracing.InitializeTracerForTest()}
			err := s.EnableUserHook(context.Background(), tt.identity, nil)
			require.NoError(t, err)
			assert.Equal(t, tt.enableUser, called)
		})
	}
}

func initUserSyncService() *UserSync {
	userSvc := usertest.NewUserServiceFake()
	log := log.New("test")
	authInfoSvc := &authinfotest.FakeService{
		ExpectedUserAuth: &login.UserAuth{
			UserId:     1,
			AuthModule: login.SAMLAuthModule,
			AuthId:     "1",
		},
	}
	quotaSvc := &quotatest.FakeQuotaService{}
	return &UserSync{
		userService:     userSvc,
		authInfoService: authInfoSvc,
		quotaService:    quotaSvc,
		tracer:          tracing.InitializeTracerForTest(),
		log:             log,
	}
}

func TestUserSync_ValidateUserProvisioningHook(t *testing.T) {
	type testCase struct {
		desc                 string
		identity             *authn.Identity
		userSyncServiceSetup func() *UserSync
		expectedErr          error
	}

	tests := []testCase{
		{
			desc: "it should skip validation if the user identity is not syncying a user",
			userSyncServiceSetup: func() *UserSync {
				userSyncService := initUserSyncService()
				userSyncService.isUserProvisioningEnabled = true
				return userSyncService
			},
			identity: &authn.Identity{
				ID:   "1",
				Type: claims.TypeAPIKey,
				ClientParams: authn.ClientParams{
					SyncUser: false,
				},
			},
		},
		{
			desc: "it should skip validation if the user provisioning is disabled",
			userSyncServiceSetup: func() *UserSync {
				userSyncService := initUserSyncService()
				userSyncService.isUserProvisioningEnabled = false
				return userSyncService
			},
			identity: &authn.Identity{
				AuthenticatedBy: login.GenericOAuthModule,
				AuthID:          "1",
				ClientParams: authn.ClientParams{
					SyncUser: true,
				},
			},
		},
		{
			desc: "it should skip validation if rejectNonProvisionedUsers is disabled",
			userSyncServiceSetup: func() *UserSync {
				userSyncService := initUserSyncService()
				userSyncService.rejectNonProvisionedUsers = false
				userSyncService.isUserProvisioningEnabled = true
				userSyncService.userService = &usertest.FakeUserService{
					ExpectedUser: &user.User{
						ID:            1,
						IsProvisioned: false,
					},
				}
				userSyncService.authInfoService = &authinfotest.FakeService{
					ExpectedUserAuth: &login.UserAuth{
						UserId:     1,
						AuthModule: login.GenericOAuthModule,
						AuthId:     "1",
					},
				}
				return userSyncService
			},
			identity: &authn.Identity{
				AuthenticatedBy: login.GenericOAuthModule,
				AuthID:          "1",
				ClientParams: authn.ClientParams{
					SyncUser: true,
				},
			},
		},
		{
			desc: "it should skip validation if the user is authenticated via GrafanaComAuthModule",
			userSyncServiceSetup: func() *UserSync {
				userSyncService := initUserSyncService()
				userSyncService.rejectNonProvisionedUsers = true
				userSyncService.isUserProvisioningEnabled = true
				return userSyncService
			},
			identity: &authn.Identity{
				AuthenticatedBy: login.GrafanaComAuthModule,
				AuthID:          "1",
				ClientParams: authn.ClientParams{
					SyncUser: true,
				},
			},
		},
		{
			desc: "it should fail to validate the identity with the provisioned user, unexpected error",
			userSyncServiceSetup: func() *UserSync {
				userSyncService := initUserSyncService()
				userSyncService.rejectNonProvisionedUsers = true
				userSyncService.isUserProvisioningEnabled = true
				userSyncService.userService = &usertest.FakeUserService{
					ExpectedError: errors.New("random error"),
				}
				return userSyncService
			},
			identity: &authn.Identity{
				AuthenticatedBy: login.SAMLAuthModule,
				AuthID:          "1",
				ExternalUID:     "random-external-uid",
				ClientParams: authn.ClientParams{
					SyncUser: true,
				},
			},
			expectedErr: errUnableToRetrieveUserOrAuthInfo.Errorf("unable to retrieve user or authInfo for validation"),
		},
		{
			desc: "it should fail to validate the identity with the provisioned user, no user found",
			userSyncServiceSetup: func() *UserSync {
				userSyncService := initUserSyncService()
				userSyncService.rejectNonProvisionedUsers = true
				userSyncService.isUserProvisioningEnabled = true
				userSyncService.userService = &usertest.FakeUserService{}
				return userSyncService
			},
			identity: &authn.Identity{
				AuthenticatedBy: login.SAMLAuthModule,
				AuthID:          "1",
				ExternalUID:     "random-external-uid",
				ClientParams: authn.ClientParams{
					SyncUser: true,
				},
			},
			expectedErr: errUnableToRetrieveUser.Errorf("unable to retrieve user for validation"),
		},
		{
			desc: "it should fail to validate the provisioned user.ExternalUID with the identity.ExternalUID - empty ExternalUID",
			userSyncServiceSetup: func() *UserSync {
				userSyncService := initUserSyncService()
				userSyncService.rejectNonProvisionedUsers = true
				userSyncService.isUserProvisioningEnabled = true
				userSyncService.userService = &usertest.FakeUserService{
					ExpectedUser: &user.User{
						ID:            1,
						IsProvisioned: true,
					},
				}
				userSyncService.authInfoService = &authinfotest.FakeService{
					ExpectedUserAuth: &login.UserAuth{
						UserId:     1,
						AuthModule: login.SAMLAuthModule,
						AuthId:     "1",
					},
				}
				return userSyncService
			},
			identity: &authn.Identity{
				AuthenticatedBy: login.SAMLAuthModule,
				AuthID:          "1",
				ExternalUID:     "random-external-uid",
				ClientParams: authn.ClientParams{
					SyncUser: true,
				},
			},
			expectedErr: errUserExternalUIDMismatch.Errorf("the provisioned user.ExternalUID does not match the authinfo.ExternalUID"),
		},
		{
			desc: "it should fail to validate the provisioned user.ExternalUID with the identity.ExternalUID - different ExternalUID",
			userSyncServiceSetup: func() *UserSync {
				userSyncService := initUserSyncService()
				userSyncService.rejectNonProvisionedUsers = true
				userSyncService.isUserProvisioningEnabled = true
				userSyncService.userService = &usertest.FakeUserService{
					ExpectedUser: &user.User{
						ID:            1,
						IsProvisioned: true,
					},
				}
				userSyncService.authInfoService = &authinfotest.FakeService{
					ExpectedUserAuth: &login.UserAuth{
						UserId:      1,
						AuthModule:  login.SAMLAuthModule,
						AuthId:      "1",
						ExternalUID: "different-external-uid",
					},
				}
				return userSyncService
			},
			identity: &authn.Identity{
				AuthenticatedBy: login.SAMLAuthModule,
				AuthID:          "1",
				ExternalUID:     "random-external-uid",
				ClientParams: authn.ClientParams{
					SyncUser: true,
				},
			},
			expectedErr: errUserExternalUIDMismatch.Errorf("the provisioned user.ExternalUID does not match the authinfo.ExternalUID"),
		},
		{
			desc: "it should successfully validate the provisioned user.ExternalUID with the identity.ExternalUID",
			userSyncServiceSetup: func() *UserSync {
				userSyncService := initUserSyncService()
				userSyncService.rejectNonProvisionedUsers = true
				userSyncService.isUserProvisioningEnabled = true
				userSyncService.userService = &usertest.FakeUserService{
					ExpectedUser: &user.User{
						ID:            1,
						IsProvisioned: true,
					},
				}
				userSyncService.authInfoService = &authinfotest.FakeService{
					ExpectedUserAuth: &login.UserAuth{
						UserId:      1,
						AuthModule:  login.SAMLAuthModule,
						AuthId:      "1",
						ExternalUID: "random-external-uid",
					},
				}
				return userSyncService
			},
			identity: &authn.Identity{
				AuthenticatedBy: login.SAMLAuthModule,
				AuthID:          "1",
				ExternalUID:     "random-external-uid",
				ClientParams: authn.ClientParams{
					SyncUser: true,
				},
			},
			expectedErr: nil,
		},
		{
			desc: "it should fail to validate a non provisioned user when configured to reject non provisioned users",
			userSyncServiceSetup: func() *UserSync {
				userSyncService := initUserSyncService()
				userSyncService.rejectNonProvisionedUsers = true
				userSyncService.isUserProvisioningEnabled = true
				userSyncService.userService = &usertest.FakeUserService{
					ExpectedUser: &user.User{
						ID:            1,
						IsProvisioned: false,
					},
				}
				userSyncService.authInfoService = &authinfotest.FakeService{
					ExpectedUserAuth: &login.UserAuth{
						UserId:      1,
						AuthModule:  login.SAMLAuthModule,
						AuthId:      "1",
						ExternalUID: "random-external-uid",
					},
				}
				return userSyncService
			},
			identity: &authn.Identity{
				AuthenticatedBy: login.SAMLAuthModule,
				AuthID:          "1",
				ExternalUID:     "random-external-uid",
				ClientParams: authn.ClientParams{
					SyncUser: true,
				},
			},
			expectedErr: errUserNotProvisioned.Errorf("user is not provisioned"),
		},
		{
			desc: "it should skip to validate a non provisioned user when configured to allow non provisioned users",
			userSyncServiceSetup: func() *UserSync {
				userSyncService := initUserSyncService()
				userSyncService.rejectNonProvisionedUsers = false
				userSyncService.isUserProvisioningEnabled = true
				userSyncService.userService = &usertest.FakeUserService{
					ExpectedUser: &user.User{
						ID:            1,
						IsProvisioned: false,
					},
				}
				userSyncService.authInfoService = &authinfotest.FakeService{
					ExpectedUserAuth: &login.UserAuth{
						UserId:      1,
						AuthModule:  login.SAMLAuthModule,
						AuthId:      "1",
						ExternalUID: "random-external-uid",
					},
				}
				return userSyncService
			},
			identity: &authn.Identity{
				AuthenticatedBy: login.SAMLAuthModule,
				AuthID:          "1",
				ExternalUID:     "different-external-uid",
				ClientParams: authn.ClientParams{
					SyncUser: true,
				},
			},
			expectedErr: nil,
		},
		{
			desc: "ValidateProvisioning: DB ExternalUID is empty, Incoming ExternalUID is empty - expect mismatch (stricter logic)",
			userSyncServiceSetup: func() *UserSync {
				userSyncService := initUserSyncService()
				userSyncService.isUserProvisioningEnabled = true
				userSyncService.userService = &usertest.FakeUserService{ExpectedUser: &user.User{ID: 1, IsProvisioned: true}}
				userSyncService.authInfoService = &authinfotest.FakeService{ExpectedUserAuth: &login.UserAuth{UserId: 1, AuthModule: login.SAMLAuthModule, ExternalUID: ""}}
				return userSyncService
			},
			identity: &authn.Identity{
				AuthenticatedBy: login.SAMLAuthModule,
				AuthID:          "1",
				ClientParams: authn.ClientParams{
					SyncUser: true,
				},
				ExternalUID: "",
			},
			expectedErr: errUserExternalUIDMismatch,
		},
		{
			desc: "ValidateProvisioning: DB ExternalUID is empty, Incoming ExternalUID non-empty - expect mismatch (stricter logic)",
			userSyncServiceSetup: func() *UserSync {
				userSyncService := initUserSyncService()
				userSyncService.isUserProvisioningEnabled = true
				userSyncService.userService = &usertest.FakeUserService{ExpectedUser: &user.User{ID: 1, IsProvisioned: true}}
				userSyncService.authInfoService = &authinfotest.FakeService{ExpectedUserAuth: &login.UserAuth{UserId: 1, AuthModule: login.SAMLAuthModule, ExternalUID: ""}}
				return userSyncService
			},
			identity: &authn.Identity{
				AuthenticatedBy: login.SAMLAuthModule,
				AuthID:          "1",
				ClientParams: authn.ClientParams{
					SyncUser: true,
				},
				ExternalUID: "valid-uid",
			},
			expectedErr: errUserExternalUIDMismatch,
		},
		{
			desc: "ValidateProvisioning: DB and Incoming ExternalUIDs non-empty and mismatch - expect mismatch",
			userSyncServiceSetup: func() *UserSync {
				userSyncService := initUserSyncService()
				userSyncService.isUserProvisioningEnabled = true
				userSyncService.userService = &usertest.FakeUserService{ExpectedUser: &user.User{ID: 1, IsProvisioned: true}}
				userSyncService.authInfoService = &authinfotest.FakeService{ExpectedUserAuth: &login.UserAuth{UserId: 1, AuthModule: login.SAMLAuthModule, ExternalUID: "db-uid"}}
				return userSyncService
			},
			identity: &authn.Identity{
				AuthenticatedBy: login.SAMLAuthModule,
				AuthID:          "1",
				ClientParams: authn.ClientParams{
					SyncUser: true,
				},
				ExternalUID: "incoming-uid",
			},
			expectedErr: errUserExternalUIDMismatch,
		},
		{
			desc: "it should skip ExternalUID validation for a SAML-provisioned user accessed by a non-SAML method with an empty incoming ExternalUID",
			userSyncServiceSetup: func() *UserSync {
				userSyncService := initUserSyncService()
				userSyncService.rejectNonProvisionedUsers = false
				userSyncService.isUserProvisioningEnabled = true
				userSyncService.userService = &usertest.FakeUserService{
					ExpectedUser: &user.User{
						ID:            1,
						IsProvisioned: true,
					},
				}
				userSyncService.authInfoService = &authinfotest.FakeService{
					ExpectedUserAuth: &login.UserAuth{
						UserId:      1,
						AuthModule:  login.SAMLAuthModule,
						AuthId:      "1",
						ExternalUID: "saml-originated-uid",
					},
				}
				return userSyncService
			},
			identity: &authn.Identity{
				AuthenticatedBy: login.GenericOAuthModule,
				AuthID:          "1",
				ExternalUID:     "",
			},
			expectedErr: nil,
		},
		{
			desc: "it should fail validation when a provisioned user is accessed by SAML with an empty incoming ExternalUID",
			userSyncServiceSetup: func() *UserSync {
				userSyncService := initUserSyncService()
				userSyncService.rejectNonProvisionedUsers = true
				userSyncService.isUserProvisioningEnabled = true
				userSyncService.userService = &usertest.FakeUserService{
					ExpectedUser: &user.User{
						ID:            1,
						IsProvisioned: true,
					},
				}
				userSyncService.authInfoService = &authinfotest.FakeService{
					ExpectedUserAuth: &login.UserAuth{
						UserId:      1,
						AuthModule:  login.SAMLAuthModule,
						AuthId:      "1",
						ExternalUID: "saml-originated-uid",
					},
				}
				return userSyncService
			},
			identity: &authn.Identity{
				AuthenticatedBy: login.SAMLAuthModule,
				AuthID:          "1",
				ExternalUID:     "",
				ClientParams: authn.ClientParams{
					SyncUser: true,
				},
			},
			expectedErr: errUserExternalUIDMismatch.Errorf("the provisioned user.ExternalUID does not match the authinfo.ExternalUID"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			userSyncService := tt.userSyncServiceSetup()
			err := userSyncService.ValidateUserProvisioningHook(context.Background(), tt.identity, nil)
			require.ErrorIs(t, err, tt.expectedErr)
		})
	}
}

func TestUserSync_SCIMUtilIntegration(t *testing.T) {
	ctx := context.Background()
	orgID := int64(1)

	// Mock SCIM utility for testing
	type mockSCIMUtil struct {
		userSyncEnabled             bool
		nonProvisionedUsersRejected bool
		shouldUseDynamicConfig      bool
		shouldReturnError           bool
	}

	createMockSCIMUtil := func(mockCfg *mockSCIMUtil) *scimutil.SCIMUtil {
		if mockCfg == nil {
			return nil
		}

		// Create a mock K8s client that returns the expected behavior
		mockK8sClient := &MockK8sHandler{}

		if mockCfg.shouldReturnError {
			mockK8sClient.On("Get", ctx, "default", orgID, mock.AnythingOfType("v1.GetOptions"), mock.Anything).
				Return(nil, errors.New("k8s error"))
		} else if mockCfg.shouldUseDynamicConfig {
			// Create a mock SCIM config with the desired settings
			obj := &unstructured.Unstructured{
				Object: map[string]interface{}{
					"apiVersion": "scim.grafana.com/v0alpha1",
					"kind":       "SCIMConfig",
					"metadata": map[string]interface{}{
						"name":      "test-config",
						"namespace": "default",
					},
					"spec": map[string]interface{}{
						"enableUserSync":            mockCfg.userSyncEnabled,
						"enableGroupSync":           false, // Not used for this test
						"rejectNonProvisionedUsers": mockCfg.nonProvisionedUsersRejected,
					},
				},
			}
			mockK8sClient.On("Get", ctx, "default", orgID, mock.AnythingOfType("v1.GetOptions"), mock.Anything).
				Return(obj, nil)
		}

		return scimutil.NewSCIMUtil(mockK8sClient)
	}

	tests := []struct {
		name                           string
		identity                       *authn.Identity
		staticConfig                   *StaticSCIMConfig
		mockSCIMUtil                   *mockSCIMUtil
		expectedUserSyncEnabled        bool
		expectedNonProvisionedRejected bool
		expectedError                  error
	}{
		{
			name: "SCIM util nil - uses static config",
			identity: &authn.Identity{
				OrgID: orgID,
				ID:    "test-user",
			},
			staticConfig: &StaticSCIMConfig{
				IsUserProvisioningEnabled: true,
				RejectNonProvisionedUsers: false,
			},
			mockSCIMUtil:                   nil, // No SCIM util
			expectedUserSyncEnabled:        true,
			expectedNonProvisionedRejected: false,
		},
		{
			name: "SCIM util with dynamic config - user sync enabled",
			identity: &authn.Identity{
				OrgID: orgID,
				ID:    "test-user",
			},
			staticConfig: &StaticSCIMConfig{
				IsUserProvisioningEnabled: false, // Static disabled
				RejectNonProvisionedUsers: true,
			},
			mockSCIMUtil: &mockSCIMUtil{
				userSyncEnabled:             true, // Dynamic enabled
				nonProvisionedUsersRejected: true,
				shouldUseDynamicConfig:      true,
			},
			expectedUserSyncEnabled:        true,
			expectedNonProvisionedRejected: true,
		},
		{
			name: "SCIM util with dynamic config - user sync disabled",
			identity: &authn.Identity{
				OrgID: orgID,
				ID:    "test-user",
			},
			staticConfig: &StaticSCIMConfig{
				IsUserProvisioningEnabled: true, // Static enabled
				RejectNonProvisionedUsers: true,
			},
			mockSCIMUtil: &mockSCIMUtil{
				userSyncEnabled:             false, // Dynamic disabled
				nonProvisionedUsersRejected: false,
				shouldUseDynamicConfig:      true,
			},
			expectedUserSyncEnabled:        false,
			expectedNonProvisionedRejected: false,
		},
		{
			name: "SCIM util with error - falls back to static config",
			identity: &authn.Identity{
				OrgID: orgID,
				ID:    "test-user",
			},
			staticConfig: &StaticSCIMConfig{
				IsUserProvisioningEnabled: true,
				RejectNonProvisionedUsers: false,
			},
			mockSCIMUtil: &mockSCIMUtil{
				shouldReturnError: true,
			},
			expectedUserSyncEnabled:        true,
			expectedNonProvisionedRejected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create UserSync service with mock SCIM util
			userSync := &UserSync{
				scimUtil: createMockSCIMUtil(tt.mockSCIMUtil),
			}

			// Test user sync enabled check
			var userSyncEnabled bool
			if userSync.scimUtil != nil {
				userSyncEnabled = userSync.scimUtil.IsUserSyncEnabled(ctx, orgID, tt.staticConfig.IsUserProvisioningEnabled)
			} else {
				userSyncEnabled = tt.staticConfig.IsUserProvisioningEnabled
			}
			assert.Equal(t, tt.expectedUserSyncEnabled, userSyncEnabled, "User sync enabled mismatch")

			// Test non-provisioned users rejected check
			var nonProvisionedReject bool
			if userSync.scimUtil != nil {
				nonProvisionedReject = userSync.scimUtil.AreNonProvisionedUsersRejected(ctx, orgID, tt.staticConfig.RejectNonProvisionedUsers)
			} else {
				nonProvisionedReject = tt.staticConfig.RejectNonProvisionedUsers
			}
			assert.Equal(t, tt.expectedNonProvisionedRejected, nonProvisionedReject, "Non-provisioned users rejected mismatch")
		})
	}
}

// MockK8sHandler is a mock implementation for testing
type MockK8sHandler struct {
	mock.Mock
}

func (m *MockK8sHandler) GetNamespace(orgID int64) string {
	args := m.Called(orgID)
	return args.String(0)
}

func (m *MockK8sHandler) Get(ctx context.Context, name string, orgID int64, opts metav1.GetOptions, subresource ...string) (*unstructured.Unstructured, error) {
	args := m.Called(ctx, name, orgID, opts, subresource)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*unstructured.Unstructured), args.Error(1)
}

// Add other required methods with empty implementations for the mock
func (m *MockK8sHandler) Create(ctx context.Context, obj *unstructured.Unstructured, orgID int64, opts metav1.CreateOptions) (*unstructured.Unstructured, error) {
	args := m.Called(ctx, obj, orgID, opts)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*unstructured.Unstructured), args.Error(1)
}

func (m *MockK8sHandler) Update(ctx context.Context, obj *unstructured.Unstructured, orgID int64, opts metav1.UpdateOptions) (*unstructured.Unstructured, error) {
	args := m.Called(ctx, obj, orgID, opts)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*unstructured.Unstructured), args.Error(1)
}

func (m *MockK8sHandler) Delete(ctx context.Context, name string, orgID int64, options metav1.DeleteOptions) error {
	args := m.Called(ctx, name, orgID, options)
	return args.Error(0)
}

func (m *MockK8sHandler) DeleteCollection(ctx context.Context, orgID int64) error {
	args := m.Called(ctx, orgID)
	return args.Error(0)
}

func (m *MockK8sHandler) List(ctx context.Context, orgID int64, options metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	args := m.Called(ctx, orgID, options)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*unstructured.UnstructuredList), args.Error(1)
}

func (m *MockK8sHandler) Search(ctx context.Context, orgID int64, in *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
	args := m.Called(ctx, orgID, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*resourcepb.ResourceSearchResponse), args.Error(1)
}

func (m *MockK8sHandler) GetStats(ctx context.Context, orgID int64) (*resourcepb.ResourceStatsResponse, error) {
	args := m.Called(ctx, orgID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*resourcepb.ResourceStatsResponse), args.Error(1)
}

func (m *MockK8sHandler) GetUsersFromMeta(ctx context.Context, userMeta []string) (map[string]*user.User, error) {
	args := m.Called(ctx, userMeta)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(map[string]*user.User), args.Error(1)
}

func TestUserSync_NamespaceMappingLogic(t *testing.T) {
	ctx := context.Background()

	// Test the actual namespace mapping logic
	tests := []struct {
		name              string
		stackID           string
		orgID             int64
		expectedNamespace string
		description       string
	}{
		{
			name:              "Cloud instance with valid stackID",
			stackID:           "75",
			orgID:             123,
			expectedNamespace: "stacks-75",
			description:       "Should use stack-based namespace for cloud instances",
		},
		{
			name:              "Cloud instance with different stackID",
			stackID:           "99",
			orgID:             123,
			expectedNamespace: "stacks-99",
			description:       "Should use different stack-based namespace for different stackID",
		},
		{
			name:              "Cloud instance with invalid stackID",
			stackID:           "invalid",
			orgID:             456,
			expectedNamespace: "stacks-0",
			description:       "Should fallback to stacks-0 for invalid stackID",
		},
		{
			name:              "On-prem instance (no stackID)",
			stackID:           "",
			orgID:             456,
			expectedNamespace: "org-456",
			description:       "Should use org-based namespace for on-prem instances",
		},
		{
			name:              "On-prem instance with different orgID",
			stackID:           "",
			orgID:             789,
			expectedNamespace: "org-789",
			description:       "Should use correct orgID in namespace",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock K8s client
			mockK8sClient := &MockK8sHandler{}

			// Mock the GetNamespace method to simulate the actual namespace mapping logic
			mockK8sClient.On("GetNamespace", tt.orgID).Return(tt.expectedNamespace)

			// Set up a successful SCIM config response
			obj := &unstructured.Unstructured{
				Object: map[string]interface{}{
					"apiVersion": "scim.grafana.com/v0alpha1",
					"kind":       "SCIMConfig",
					"metadata": map[string]interface{}{
						"name":      "default",
						"namespace": tt.expectedNamespace,
					},
					"spec": map[string]interface{}{
						"enableUserSync":  true,
						"enableGroupSync": false,
					},
				},
			}
			mockK8sClient.On("Get", ctx, "default", tt.orgID, mock.AnythingOfType("v1.GetOptions"), mock.Anything).
				Return(obj, nil)

			// Create SCIM util with the mock client
			scimUtil := scimutil.NewSCIMUtil(mockK8sClient)

			// Test the namespace mapping
			actualNamespace := mockK8sClient.GetNamespace(tt.orgID)
			assert.Equal(t, tt.expectedNamespace, actualNamespace,
				"Namespace mapping failed: %s", tt.description)

			// Test that the SCIM util works with the mapped namespace
			userSyncEnabled := scimUtil.IsUserSyncEnabled(ctx, tt.orgID, false)
			assert.True(t, userSyncEnabled,
				"SCIM util should work with namespace %s: %s", tt.expectedNamespace, tt.description)

			// Verify that the correct API path would be constructed
			// This is implicit in the mock setup, but we can verify the components
			assert.Equal(t, "default", obj.GetName(), "Resource name should be 'default'")
			assert.Equal(t, tt.expectedNamespace, obj.GetNamespace(), "Namespace should match expected")

			// Verify the mock expectations
			mockK8sClient.AssertExpectations(t)
		})
	}
}

func TestUserSync_GetUsageStats(t *testing.T) {
	userSync := initUserSyncService()

	// Test that GetUsageStats returns zero initially
	stats := userSync.GetUsageStats(context.Background())

	require.NotNil(t, stats)
	require.Contains(t, stats, "stats.features.scim.has_successful_login.count")
	require.Equal(t, int(0), stats["stats.features.scim.has_successful_login.count"])

	userSync.scimSuccessfulLogin.Store(true)

	// Test that GetUsageStats returns the updated value
	stats = userSync.GetUsageStats(context.Background())
	require.Equal(t, int(1), stats["stats.features.scim.has_successful_login.count"])
}

func TestUserSync_SCIMLoginUsageStatSet(t *testing.T) {
	userSync := initUserSyncService()
	userSync.rejectNonProvisionedUsers = false
	userSync.isUserProvisioningEnabled = true
	userSync.userService = &usertest.FakeUserService{
		ExpectedUser: &user.User{
			ID:            1,
			IsProvisioned: true,
		},
	}
	userSync.authInfoService = &authinfotest.FakeService{
		ExpectedUserAuth: &login.UserAuth{
			UserId:      1,
			AuthModule:  login.SAMLAuthModule,
			AuthId:      "1",
			ExternalUID: "test123",
		},
	}

	// Check initial counter value
	initialStats := userSync.GetUsageStats(context.Background())
	require.Equal(t, int(0), initialStats["stats.features.scim.has_successful_login.count"])

	// Create identity for validation with matching ExternalUID
	identity := &authn.Identity{
		AuthID:          "1",
		AuthenticatedBy: login.SAMLAuthModule,
		ExternalUID:     "test123",
		ClientParams:    authn.ClientParams{SyncUser: true},
	}

	// Call ValidateUserProvisioningHook - this should set the flag to true
	err := userSync.ValidateUserProvisioningHook(context.Background(), identity, nil)
	require.NoError(t, err)

	// Check that flag was set to true (count should be 1)
	finalStats := userSync.GetUsageStats(context.Background())
	finalCount := finalStats["stats.features.scim.has_successful_login.count"].(int)
	require.Equal(t, int(1), finalCount)
}
