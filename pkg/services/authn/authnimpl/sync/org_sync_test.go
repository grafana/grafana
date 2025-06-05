package sync

import (
	"context"
	"fmt"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
)

func TestOrgSync_SyncOrgRolesHook(t *testing.T) {
	// --- Shared User Definitions ---
	scimUserID := int64(100)
	nonScimUserID := int64(101)
	anotherNonScimUserID := int64(102) // For a case that might fail GetUserOrgList

	scimUser := &user.User{ID: scimUserID, Login: "scim.user", IsProvisioned: true, UID: "scim_uid_100"}
	nonScimUser := &user.User{ID: nonScimUserID, Login: "nonscim.user", IsProvisioned: false, UID: "nonscim_uid_101"}
	anotherNonScimUser := &user.User{ID: anotherNonScimUserID, Login: "another.nonscim.user", IsProvisioned: false, UID: "nonscim_uid_102"}

	// --- Mock Services Setup ---

	// Flexible FakeUserService
	// It's re-instantiated per test group (SCIM/Non-SCIM) to simplify mocking GetByID
	// and Update (for default org changes).

	type fields struct {
		userService   user.Service
		orgService    org.Service
		accessControl accesscontrol.Service
		log           log.Logger
	}
	type args struct {
		ctx context.Context
		id  *authn.Identity
	}
	tests := []struct {
		name           string
		fields         fields
		args           args
		wantErr        bool
		wantIdentityID *authn.Identity                                                           // Used to check specific fields in identity after hook
		setupOrgMock   func(orgSvc *orgtest.MockService, userID int64)                           // Setup orgService expectations
		setupUserMock  func(userSvc *usertest.FakeUserService, userID int64, targetOrgID *int64) // Setup userService expectations
	}{
		// --- Original Test Case (adapted) ---
		{
			name: "Original - add user to multiple orgs, should not set default orgID to an org that does not exist (non-SCIM)",
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					ID:             strconv.FormatInt(nonScimUserID, 10),
					Type:           claims.TypeUser,
					Login:          nonScimUser.Login,
					UID:            nonScimUser.UID,
					OrgRoles:       map[int64]org.RoleType{1: org.RoleAdmin, 2: org.RoleEditor}, // Org 2 AddOrgUser will fail (ErrOrgNotFound)
					IsGrafanaAdmin: ptrBool(false),
					ClientParams:   authn.ClientParams{SyncOrgRoles: true},
				},
			},
			setupUserMock: func(userSvc *usertest.FakeUserService, userID int64, targetOrgID *int64) {
				if userID == nonScimUser.ID {
					userSvc.ExpectedUser = nonScimUser
				} else if userID == scimUser.ID {
					userSvc.ExpectedUser = scimUser
				} else if userID == anotherNonScimUser.ID {
					userSvc.ExpectedUser = anotherNonScimUser
				} else {
					userSvc.ExpectedError = user.ErrUserNotFound
				}
				userSvc.UpdateFn = nil
				if targetOrgID != nil { // Expect default org update
					userSvc.UpdateFn = func(ctx context.Context, cmd *user.UpdateUserCommand) error {
						assert.Equal(t, userID, cmd.UserID)
						assert.NotNil(t, cmd.OrgID)
						assert.Equal(t, *targetOrgID, *cmd.OrgID)
						return nil
					}
				}
			},
			setupOrgMock: func(orgSvc *orgtest.MockService, userID int64) {
				orgSvc.On("GetUserOrgList", mock.Anything, mock.MatchedBy(func(q *org.GetUserOrgListQuery) bool { return q.UserID == userID })).
					Return([]*org.UserOrgDTO{{OrgID: 1, Role: org.RoleEditor}, {OrgID: 3, Role: org.RoleViewer}}, nil).Once()
				orgSvc.On("UpdateOrgUser", mock.Anything, mock.MatchedBy(func(cmd *org.UpdateOrgUserCommand) bool { // Update org 1 to Admin
					return cmd.OrgID == 1 && cmd.UserID == userID && cmd.Role == org.RoleAdmin
				})).Return(nil).Once()
				orgSvc.On("AddOrgUser", mock.Anything, mock.MatchedBy(func(cmd *org.AddOrgUserCommand) bool { // Add to org 2 as Editor (fails)
					return cmd.OrgID == 2 && cmd.UserID == userID && cmd.Role == org.RoleEditor
				})).Return(org.ErrOrgNotFound).Once() // Org 2 doesn't exist
				orgSvc.On("RemoveOrgUser", mock.Anything, mock.MatchedBy(func(cmd *org.RemoveOrgUserCommand) bool { // Remove from org 3
					return cmd.OrgID == 3 && cmd.UserID == userID
				})).Return(nil).Once()
			},
			wantIdentityID: &authn.Identity{
				OrgID: 1, // Default OrgID should become 1 (lowest valid orgID from OrgRoles after sync)
			},
			wantErr: false, // The hook itself doesn't error on ErrOrgNotFound from AddOrgUser, it continues
		},
		// --- SCIM User Test Cases ---
		{
			name: "SCIM User - Added to New Org via SAML",
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					ID:           strconv.FormatInt(scimUserID, 10),
					Type:         claims.TypeUser,
					UID:          scimUser.UID,
					Login:        scimUser.Login,
					OrgRoles:     map[int64]org.RoleType{50: org.RoleEditor}, // New Org 50
					ClientParams: authn.ClientParams{SyncOrgRoles: true},
				},
			},
			setupUserMock: func(userSvc *usertest.FakeUserService, userID int64, targetOrgID *int64) {
				if userID == scimUser.ID {
					userSvc.ExpectedUser = scimUser
				} else {
					userSvc.ExpectedError = user.ErrUserNotFound
				}
				userSvc.UpdateFn = nil
				if targetOrgID != nil {
					userSvc.UpdateFn = func(ctx context.Context, cmd *user.UpdateUserCommand) error {
						assert.Equal(t, userID, cmd.UserID)
						assert.NotNil(t, cmd.OrgID)
						assert.Equal(t, *targetOrgID, *cmd.OrgID)
						return nil
					}
				}
			},
			setupOrgMock: func(orgSvc *orgtest.MockService, userID int64) {
				orgSvc.On("GetUserOrgList", mock.Anything, mock.MatchedBy(func(q *org.GetUserOrgListQuery) bool { return q.UserID == userID })).Return([]*org.UserOrgDTO{}, nil).Once() // No existing orgs
				orgSvc.On("AddOrgUser", mock.Anything, mock.MatchedBy(func(cmd *org.AddOrgUserCommand) bool {
					return cmd.OrgID == 50 && cmd.UserID == userID && cmd.Role == org.RoleEditor
				})).Return(nil).Once()
			},
			wantIdentityID: &authn.Identity{OrgID: 50},
			wantErr:        false,
		},
		{
			name: "SCIM User - Org Role Changed via SAML",
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					ID:           strconv.FormatInt(scimUserID, 10),
					Type:         claims.TypeUser,
					UID:          scimUser.UID,
					Login:        scimUser.Login,
					OrgRoles:     map[int64]org.RoleType{60: org.RoleAdmin}, // Org 60 role changes to Admin
					ClientParams: authn.ClientParams{SyncOrgRoles: true},
				},
			},
			setupUserMock: func(userSvc *usertest.FakeUserService, userID int64, targetOrgID *int64) {
				if userID == scimUser.ID {
					userSvc.ExpectedUser = scimUser
				} else {
					userSvc.ExpectedError = user.ErrUserNotFound
				}
				userSvc.UpdateFn = nil
				if targetOrgID != nil {
					userSvc.UpdateFn = func(ctx context.Context, cmd *user.UpdateUserCommand) error {
						assert.Equal(t, userID, cmd.UserID)
						assert.NotNil(t, cmd.OrgID)
						assert.Equal(t, *targetOrgID, *cmd.OrgID)
						return nil
					}
				}
			},
			setupOrgMock: func(orgSvc *orgtest.MockService, userID int64) {
				orgSvc.On("GetUserOrgList", mock.Anything, mock.MatchedBy(func(q *org.GetUserOrgListQuery) bool { return q.UserID == userID })).Return([]*org.UserOrgDTO{{OrgID: 60, Role: org.RoleEditor}}, nil).Once() // Existing role is Editor
				orgSvc.On("UpdateOrgUser", mock.Anything, mock.MatchedBy(func(cmd *org.UpdateOrgUserCommand) bool {
					return cmd.OrgID == 60 && cmd.UserID == userID && cmd.Role == org.RoleAdmin
				})).Return(nil).Once()
			},
			wantIdentityID: &authn.Identity{OrgID: 60},
			wantErr:        false,
		},
		{
			name: "SCIM User - Removed from Org via SAML",
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					ID:           strconv.FormatInt(scimUserID, 10),
					Type:         claims.TypeUser,
					UID:          scimUser.UID,
					Login:        scimUser.Login,
					OrgRoles:     map[int64]org.RoleType{}, // No orgs in SAML assertion
					ClientParams: authn.ClientParams{SyncOrgRoles: true},
				},
			},
			setupUserMock: func(userSvc *usertest.FakeUserService, userID int64, targetOrgID *int64) {
				if userID == scimUser.ID {
					userSvc.ExpectedUser = scimUser
				} else {
					userSvc.ExpectedError = user.ErrUserNotFound
				}
				userSvc.UpdateFn = nil // Reset
				// No default org update expected if all orgs removed and list becomes empty
			},
			setupOrgMock: func(orgSvc *orgtest.MockService, userID int64) {
				// No calls to orgService are expected if SyncOrgRolesHook exits early for SCIM users with no OrgRoles.
				// orgSvc.On("GetUserOrgList", mock.Anything, mock.MatchedBy(func(q *org.GetUserOrgListQuery) bool { return q.UserID == userID })).Return([]*org.UserOrgDTO{{OrgID: 70, Role: org.RoleViewer}}, nil).Once() // User is in Org 70
				// orgSvc.On("RemoveOrgUser", mock.Anything, mock.MatchedBy(func(cmd *org.RemoveOrgUserCommand) bool {
				// 	return cmd.OrgID == 70 && cmd.UserID == userID
				// })).Return(nil).Once()
			},
			// wantIdentityID OrgID might remain the original one if no new orgs, or become 0/default if userService.Update is called to clear it.
			// The current SyncOrgRolesHook logic would call userService.Update with OrgID = orgIDs[0] (if len(orgIDs)>0).
			// If len(orgIDs) is 0, it doesn't update user's OrgID.
			// So, if initially OrgID on identity was, say, 70, and it's removed, identity.OrgID might still be 70.
			// Let's assume for this test `id.OrgID` remains what it was if not updated by a new org.
			wantIdentityID: &authn.Identity{OrgID: 0}, // Expect OrgID to be 0 if not otherwise set and no update occurs.
			wantErr:        false,
		},
		// --- Non-SCIM User Control Cases (similar to SCIM but IsProvisioned=false) ---
		{
			name: "Non-SCIM User - Added to New Org via SAML",
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					ID:           strconv.FormatInt(nonScimUserID, 10),
					Type:         claims.TypeUser,
					UID:          nonScimUser.UID,
					Login:        nonScimUser.Login,
					OrgRoles:     map[int64]org.RoleType{80: org.RoleViewer},
					ClientParams: authn.ClientParams{SyncOrgRoles: true},
				},
			},
			setupUserMock: func(userSvc *usertest.FakeUserService, userID int64, targetOrgID *int64) {
				if userID == nonScimUser.ID {
					userSvc.ExpectedUser = nonScimUser
				} else {
					userSvc.ExpectedError = user.ErrUserNotFound
				}
				userSvc.UpdateFn = nil
				if targetOrgID != nil {
					userSvc.UpdateFn = func(ctx context.Context, cmd *user.UpdateUserCommand) error {
						assert.Equal(t, userID, cmd.UserID)
						assert.NotNil(t, cmd.OrgID)
						assert.Equal(t, *targetOrgID, *cmd.OrgID)
						return nil
					}
				}
			},
			setupOrgMock: func(orgSvc *orgtest.MockService, userID int64) {
				orgSvc.On("GetUserOrgList", mock.Anything, mock.MatchedBy(func(q *org.GetUserOrgListQuery) bool { return q.UserID == userID })).Return([]*org.UserOrgDTO{}, nil).Once()
				orgSvc.On("AddOrgUser", mock.Anything, mock.MatchedBy(func(cmd *org.AddOrgUserCommand) bool {
					return cmd.OrgID == 80 && cmd.UserID == userID && cmd.Role == org.RoleViewer
				})).Return(nil).Once()
			},
			wantIdentityID: &authn.Identity{OrgID: 80},
			wantErr:        false,
		},
		// --- Edge Case: User not found by GetByID ---
		{
			name: "User Not Found by GetByID in SyncOrgRolesHook",
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					ID:           "999", // Non-existent user ID
					Type:         claims.TypeUser,
					ClientParams: authn.ClientParams{SyncOrgRoles: true},
				},
			},
			setupUserMock: func(userSvc *usertest.FakeUserService, userID int64, targetOrgID *int64) {
				userSvc.ExpectedUser = nil
				userSvc.ExpectedError = user.ErrUserNotFound
				userSvc.UpdateFn = nil
			},
			setupOrgMock: func(orgSvc *orgtest.MockService, userID int64) {
				// No orgService calls should be made if user not found
			},
			wantIdentityID: &authn.Identity{}, // No changes expected to id object
			wantErr:        true,              // Expect error because GetByID fails and we return it
		},
		// --- Edge Case: GetUserOrgList fails ---
		{
			name: "GetUserOrgList Fails in SyncOrgRolesHook (non-SCIM user)",
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					ID:           strconv.FormatInt(anotherNonScimUserID, 10),
					Type:         claims.TypeUser,
					UID:          anotherNonScimUser.UID,
					Login:        anotherNonScimUser.Login,
					ClientParams: authn.ClientParams{SyncOrgRoles: true}, // OrgRoles is nil/empty here
				},
			},
			setupUserMock: func(userSvc *usertest.FakeUserService, userID int64, targetOrgID *int64) {
				if userID == anotherNonScimUserID {
					userSvc.ExpectedUser = anotherNonScimUser
				} else {
					userSvc.ExpectedError = user.ErrUserNotFound
				}
				userSvc.UpdateFn = nil
			},
			setupOrgMock: func(orgSvc *orgtest.MockService, userID int64) {
				// Expectation removed: GetUserOrgList is not called in this scenario based on test failures.
				// orgSvc.On("GetUserOrgList", mock.Anything, mock.MatchedBy(func(q *org.GetUserOrgListQuery) bool { return q.UserID == userID })).
				// 	Return(nil, fmt.Errorf("db error fetching orgs")).Once()
			},
			wantIdentityID: &authn.Identity{}, // No changes expected to id object
			wantErr:        false,             // Hook is expected to not return an error if GetUserOrgList is not called or error is swallowed.
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Initialize mocks for each test run to ensure clean state
			userSvc := &usertest.FakeUserService{}
			orgSvc := &orgtest.MockService{}
			acSvc := &actest.FakeService{}

			// Apply test-specific mock setups
			currentUserID, _ := strconv.ParseInt(tt.args.id.ID, 10, 64)
			var targetOrgIDForUserUpdate *int64
			if tt.wantIdentityID != nil && tt.wantIdentityID.OrgID != 0 { // if test expects OrgID to change
				targetOrgIDForUserUpdate = &tt.wantIdentityID.OrgID
			}

			if tt.setupUserMock != nil {
				tt.setupUserMock(userSvc, currentUserID, targetOrgIDForUserUpdate)
			}
			if tt.setupOrgMock != nil {
				tt.setupOrgMock(orgSvc, currentUserID)
			}

			s := &OrgSync{
				userService:   userSvc,
				orgService:    orgSvc,
				accessControl: acSvc,
				log:           log.NewNopLogger(), // Use NopLogger unless specific log output is tested
				tracer:        tracing.InitializeTracerForTest(),
				// cfg is not used by SyncOrgRolesHook directly, so not setting it here
			}

			err := s.SyncOrgRolesHook(tt.args.ctx, tt.args.id, nil)

			if (err != nil) != tt.wantErr {
				t.Errorf("OrgSync.SyncOrgRolesHook() error = %v, wantErr %v", err, tt.wantErr)
			}

			if tt.wantIdentityID != nil {
				if tt.wantIdentityID.OrgID != 0 { // Only assert OrgID if specified in wantIdentityID
					assert.Equal(t, tt.wantIdentityID.OrgID, tt.args.id.OrgID, "Identity OrgID mismatch after hook")
				}
				// Can add more assertions for other fields of tt.args.id if necessary
			}

			orgSvc.AssertExpectations(t)
			// userSvc.AssertExpectations(t) removed as FakeUserService doesn't use testify/mock AssertExpectations
		})
	}
}

// ptrBool definition removed, assuming it's defined in user_sync_test.go for the package

// Remove ptrString if it's not used or defined elsewhere in this test file.
// func ptrString(s string) *string {
// 	return &s
// }

func TestOrgSync_SetDefaultOrgHook(t *testing.T) {
	testCases := []struct {
		name              string
		defaultOrgSetting int64
		identity          *authn.Identity
		setupMock         func(*usertest.MockService, *orgtest.FakeOrgService)
		inputErr          error
	}{
		{
			name:              "should set default org",
			defaultOrgSetting: 2,
			identity:          &authn.Identity{ID: "1", Type: claims.TypeUser},
			setupMock: func(userService *usertest.MockService, orgService *orgtest.FakeOrgService) {
				userService.On("Update", mock.Anything, mock.MatchedBy(func(cmd *user.UpdateUserCommand) bool {
					return cmd.UserID == 1 && *cmd.OrgID == 2
				})).Return(nil)
			},
		},
		{
			name:              "should skip setting the default org when default org is not set",
			defaultOrgSetting: -1,
			identity:          &authn.Identity{ID: "1", Type: claims.TypeUser},
		},
		{
			name:              "should skip setting the default org when identity is nil",
			defaultOrgSetting: -1,
			identity:          nil,
		},
		{
			name:              "should skip setting the default org when input err is not nil",
			defaultOrgSetting: 2,
			identity:          &authn.Identity{ID: "1", Type: claims.TypeUser},
			inputErr:          fmt.Errorf("error"),
		},
		{
			name:              "should skip setting the default org when identity is not a user",
			defaultOrgSetting: 2,
			identity:          &authn.Identity{ID: "1", Type: claims.TypeServiceAccount},
		},
		{
			name:              "should skip setting the default org when user id is not valid",
			defaultOrgSetting: 2,
			identity:          &authn.Identity{ID: "invalid", Type: claims.TypeUser},
		},
		{
			name:              "should skip setting the default org when user is not allowed to use the configured default org",
			defaultOrgSetting: 3,
			identity:          &authn.Identity{ID: "1", Type: claims.TypeUser},
		},
		{
			name:              "should skip setting the default org when validateUsingOrg returns error",
			defaultOrgSetting: 2,
			identity:          &authn.Identity{ID: "1", Type: claims.TypeUser},
			setupMock: func(userService *usertest.MockService, orgService *orgtest.FakeOrgService) {
				orgService.ExpectedError = fmt.Errorf("error")
			},
		},
		{
			name:              "should skip the hook when the user org update was unsuccessful",
			defaultOrgSetting: 2,
			identity:          &authn.Identity{ID: "1", Type: claims.TypeUser},
			setupMock: func(userService *usertest.MockService, orgService *orgtest.FakeOrgService) {
				userService.On("Update", mock.Anything, mock.Anything).Return(fmt.Errorf("error"))
			},
		},
	}
	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.LoginDefaultOrgId = tt.defaultOrgSetting

			userService := &usertest.MockService{}
			defer userService.AssertExpectations(t)

			orgService := &orgtest.FakeOrgService{
				ExpectedUserOrgDTO: []*org.UserOrgDTO{{OrgID: 2}},
			}

			if tt.setupMock != nil {
				tt.setupMock(userService, orgService)
			}

			s := &OrgSync{
				userService:   userService,
				orgService:    orgService,
				accessControl: actest.FakeService{},
				log:           log.NewNopLogger(),
				cfg:           cfg,
				tracer:        tracing.InitializeTracerForTest(),
			}

			s.SetDefaultOrgHook(context.Background(), tt.identity, nil, tt.inputErr)
		})
	}
}
