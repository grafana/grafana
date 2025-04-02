package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/login/social/socialtest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/auth/idtest"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfoimpl"
	"github.com/grafana/grafana/pkg/services/login/authinfotest"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/searchusers"
	"github.com/grafana/grafana/pkg/services/searchusers/filters"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	tempuser "github.com/grafana/grafana/pkg/services/temp_user"
	"github.com/grafana/grafana/pkg/services/temp_user/tempuserimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

const newEmail = "newemail@localhost"

func TestUserAPIEndpoint_userLoggedIn(t *testing.T) {
	settings := setting.NewCfg()
	sqlStore := db.InitTestDB(t, sqlstore.InitTestDBOpt{Cfg: settings})
	hs := &HTTPServer{
		Cfg:           settings,
		SQLStore:      sqlStore,
		AccessControl: acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
	}

	mockResult := user.SearchUserQueryResult{
		Users: []*user.UserSearchHitDTO{
			{Name: "user1"},
			{Name: "user2"},
		},
		TotalCount: 2,
	}
	mock := dbtest.NewFakeDB()
	userMock := usertest.NewUserServiceFake()

	loggedInUserScenario(t, "When calling GET on", "api/users/1", "api/users/:id", func(sc *scenarioContext) {
		fakeNow := time.Date(2019, 2, 11, 17, 30, 40, 0, time.UTC)
		secretsService := secretsManager.SetupTestService(t, database.ProvideSecretsStore(sqlStore))
		authInfoStore := authinfoimpl.ProvideStore(sqlStore, secretsService)
		srv := authinfoimpl.ProvideService(
			authInfoStore, remotecache.NewFakeCacheStorage(), secretsService)
		hs.authInfoService = srv
		orgSvc, err := orgimpl.ProvideService(sqlStore, settings, quotatest.New(false, nil))
		require.NoError(t, err)
		userSvc, err := userimpl.ProvideService(
			sqlStore, orgSvc, sc.cfg, nil, nil, tracing.InitializeTracerForTest(),
			quotatest.New(false, nil), supportbundlestest.NewFakeBundleService(),
		)
		require.NoError(t, err)
		hs.userService = userSvc

		createUserCmd := user.CreateUserCommand{
			Email:      fmt.Sprint("user", "@test.com"),
			Name:       "user",
			Login:      "loginuser",
			IsAdmin:    true,
			IsDisabled: true,
		}
		usr, err := userSvc.Create(context.Background(), &createUserCmd)
		require.NoError(t, err)
		theUserUID := usr.UID

		sc.handlerFunc = hs.GetUserByID

		token := &oauth2.Token{
			AccessToken:  "testaccess",
			RefreshToken: "testrefresh",
			Expiry:       time.Now(),
			TokenType:    "Bearer",
		}
		idToken := "testidtoken"
		token = token.WithExtra(map[string]any{"id_token": idToken})
		userlogin := "loginuser"
		query := &login.GetUserByAuthInfoQuery{AuthModule: "test", AuthId: "test", UserLookupParams: login.UserLookupParams{Login: &userlogin}}
		cmd := &login.UpdateAuthInfoCommand{
			UserId:     usr.ID,
			AuthId:     query.AuthId,
			AuthModule: query.AuthModule,
			OAuthToken: token,
		}
		err = srv.UpdateAuthInfo(context.Background(), cmd)
		require.NoError(t, err)
		avatarUrl := dtos.GetGravatarUrl(hs.Cfg, "@test.com")
		sc.fakeReqWithParams("GET", sc.url, map[string]string{"id": fmt.Sprintf("%v", usr.ID)}).exec()

		expected := user.UserProfileDTO{
			ID:             1,
			UID:            theUserUID, // from original request
			Email:          "user@test.com",
			Name:           "user",
			Login:          "loginuser",
			OrgID:          1,
			IsGrafanaAdmin: true,
			IsDisabled:     true,
			AuthLabels:     []string{},
			CreatedAt:      fakeNow,
			UpdatedAt:      fakeNow,
			AvatarURL:      avatarUrl,
		}

		var resp user.UserProfileDTO
		require.Equal(t, http.StatusOK, sc.resp.Code)
		err = json.Unmarshal(sc.resp.Body.Bytes(), &resp)
		require.NoError(t, err)
		resp.CreatedAt = fakeNow
		resp.UpdatedAt = fakeNow
		resp.AvatarURL = avatarUrl
		require.EqualValues(t, expected, resp)
	}, mock)

	loggedInUserScenario(t, "When calling GET on", "/api/users/lookup", "/api/users/lookup", func(sc *scenarioContext) {
		createUserCmd := user.CreateUserCommand{
			Email:   fmt.Sprint("admin", "@test.com"),
			Name:    "admin",
			Login:   "admin",
			IsAdmin: true,
		}
		orgSvc, err := orgimpl.ProvideService(sqlStore, sc.cfg, quotatest.New(false, nil))
		require.NoError(t, err)
		userSvc, err := userimpl.ProvideService(
			sqlStore, orgSvc, sc.cfg, nil, nil, tracing.InitializeTracerForTest(),
			quotatest.New(false, nil), supportbundlestest.NewFakeBundleService(),
		)
		require.NoError(t, err)
		_, err = userSvc.Create(context.Background(), &createUserCmd)
		require.Nil(t, err)

		sc.handlerFunc = hs.GetUserByLoginOrEmail

		userMock := usertest.NewUserServiceFake()
		userMock.ExpectedUser = &user.User{ID: 2}
		sc.userService = userMock
		hs.userService = userMock
		sc.fakeReqWithParams("GET", sc.url, map[string]string{"loginOrEmail": "admin@test.com"}).exec()

		var resp user.UserProfileDTO
		require.Equal(t, http.StatusOK, sc.resp.Code)
		err = json.Unmarshal(sc.resp.Body.Bytes(), &resp)
		require.NoError(t, err)
	}, mock)

	loggedInUserScenario(t, "When calling GET on", "/api/users", "/api/users", func(sc *scenarioContext) {
		userMock.ExpectedSearchUsers = mockResult

		searchUsersService := searchusers.ProvideUsersService(sc.cfg, filters.ProvideOSSSearchUserFilter(), userMock)
		sc.handlerFunc = searchUsersService.SearchUsers
		sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

		respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
		require.NoError(t, err)

		assert.Equal(t, 2, len(respJSON.MustArray()))
	}, mock)

	loggedInUserScenario(t, "When calling GET with page and limit querystring parameters on", "/api/users", "/api/users", func(sc *scenarioContext) {
		userMock.ExpectedSearchUsers = mockResult

		searchUsersService := searchusers.ProvideUsersService(sc.cfg, filters.ProvideOSSSearchUserFilter(), userMock)
		sc.handlerFunc = searchUsersService.SearchUsers
		sc.fakeReqWithParams("GET", sc.url, map[string]string{"perpage": "10", "page": "2"}).exec()

		respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
		require.NoError(t, err)

		assert.Equal(t, 2, len(respJSON.MustArray()))
	}, mock)

	loggedInUserScenario(t, "When calling GET on", "/api/users/search", "/api/users/search", func(sc *scenarioContext) {
		userMock.ExpectedSearchUsers = mockResult

		searchUsersService := searchusers.ProvideUsersService(sc.cfg, filters.ProvideOSSSearchUserFilter(), userMock)
		sc.handlerFunc = searchUsersService.SearchUsersWithPaging
		sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

		respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
		require.NoError(t, err)

		assert.Equal(t, 1, respJSON.Get("page").MustInt())
		assert.Equal(t, 1000, respJSON.Get("perPage").MustInt())
		assert.Equal(t, 2, respJSON.Get("totalCount").MustInt())
		assert.Equal(t, 2, len(respJSON.Get("users").MustArray()))
	}, mock)

	loggedInUserScenario(t, "When calling GET with page and perpage querystring parameters on", "/api/users/search", "/api/users/search", func(sc *scenarioContext) {
		userMock.ExpectedSearchUsers = mockResult

		searchUsersService := searchusers.ProvideUsersService(sc.cfg, filters.ProvideOSSSearchUserFilter(), userMock)
		sc.handlerFunc = searchUsersService.SearchUsersWithPaging
		sc.fakeReqWithParams("GET", sc.url, map[string]string{"perpage": "10", "page": "2"}).exec()

		respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
		require.NoError(t, err)

		assert.Equal(t, 2, respJSON.Get("page").MustInt())
		assert.Equal(t, 10, respJSON.Get("perPage").MustInt())
	}, mock)
}

func Test_GetUserByID(t *testing.T) {
	testcases := []struct {
		name                         string
		authModule                   string
		allowAssignGrafanaAdmin      bool
		authEnabled                  bool
		skipOrgRoleSync              bool
		expectedIsGrafanaAdminSynced bool
		expectedIsExternallySynced   bool
	}{
		{
			name:                         "Should return IsGrafanaAdminExternallySynced = false for an externally synced OAuth user if Grafana Admin role is not synced",
			authModule:                   login.GenericOAuthModule,
			authEnabled:                  true,
			allowAssignGrafanaAdmin:      false,
			skipOrgRoleSync:              false,
			expectedIsGrafanaAdminSynced: false,
			expectedIsExternallySynced:   true,
		},
		{
			name:                         "Should return IsGrafanaAdminExternallySynced = false for an externally synced OAuth user if OAuth provider is not enabled",
			authModule:                   login.GenericOAuthModule,
			authEnabled:                  false,
			allowAssignGrafanaAdmin:      true,
			skipOrgRoleSync:              false,
			expectedIsGrafanaAdminSynced: false,
			expectedIsExternallySynced:   false,
		},
		{
			name:                         "Should return IsGrafanaAdminExternallySynced = false for an externally synced OAuth user if org roles are not being synced",
			authModule:                   login.GenericOAuthModule,
			authEnabled:                  true,
			allowAssignGrafanaAdmin:      true,
			skipOrgRoleSync:              true,
			expectedIsGrafanaAdminSynced: false,
			expectedIsExternallySynced:   false,
		},
		{
			name:                         "Should return IsGrafanaAdminExternallySynced = true for an externally synced OAuth user",
			authModule:                   login.GenericOAuthModule,
			authEnabled:                  true,
			allowAssignGrafanaAdmin:      true,
			skipOrgRoleSync:              false,
			expectedIsGrafanaAdminSynced: true,
			expectedIsExternallySynced:   true,
		},
		{
			name:                         "Should return IsGrafanaAdminExternallySynced = false for an externally synced JWT user if Grafana Admin role is not synced",
			authModule:                   login.JWTModule,
			authEnabled:                  true,
			allowAssignGrafanaAdmin:      false,
			skipOrgRoleSync:              false,
			expectedIsGrafanaAdminSynced: false,
			expectedIsExternallySynced:   true,
		},
		{
			name:                         "Should return IsGrafanaAdminExternallySynced = false for an externally synced JWT user if JWT provider is not enabled",
			authModule:                   login.JWTModule,
			authEnabled:                  false,
			allowAssignGrafanaAdmin:      true,
			skipOrgRoleSync:              false,
			expectedIsGrafanaAdminSynced: false,
			expectedIsExternallySynced:   false,
		},
		{
			name:                         "Should return IsGrafanaAdminExternallySynced = false for an externally synced JWT user if org roles are not being synced",
			authModule:                   login.JWTModule,
			authEnabled:                  true,
			allowAssignGrafanaAdmin:      true,
			skipOrgRoleSync:              true,
			expectedIsGrafanaAdminSynced: false,
			expectedIsExternallySynced:   false,
		},
		{
			name:                         "Should return IsGrafanaAdminExternallySynced = true for an externally synced JWT user",
			authModule:                   login.JWTModule,
			authEnabled:                  true,
			allowAssignGrafanaAdmin:      true,
			skipOrgRoleSync:              false,
			expectedIsGrafanaAdminSynced: true,
			expectedIsExternallySynced:   true,
		},
		{
			name:                         "Should return IsExternallySynced = true for an externally synced SAML user",
			authModule:                   login.SAMLAuthModule,
			authEnabled:                  true,
			skipOrgRoleSync:              false,
			expectedIsGrafanaAdminSynced: false,
			expectedIsExternallySynced:   true,
		},
		{
			name:                         "Should return IsExternallySynced = false for an externally synced SAML user if SAML provider is not enabled",
			authModule:                   login.SAMLAuthModule,
			authEnabled:                  false,
			skipOrgRoleSync:              false,
			expectedIsGrafanaAdminSynced: false,
			expectedIsExternallySynced:   false,
		},
		{
			name:                         "Should return IsExternallySynced = false for an externally synced SAML user if  if org roles are not being synced",
			authModule:                   login.SAMLAuthModule,
			authEnabled:                  true,
			skipOrgRoleSync:              true,
			expectedIsGrafanaAdminSynced: false,
			expectedIsExternallySynced:   false,
		},
	}
	for _, tc := range testcases {
		t.Run(tc.name, func(t *testing.T) {
			userAuth := &login.UserAuth{AuthModule: tc.authModule}
			authInfoService := &authinfotest.FakeService{ExpectedUserAuth: userAuth}
			socialService := &socialtest.FakeSocialService{}
			userService := &usertest.FakeUserService{ExpectedUserProfileDTO: &user.UserProfileDTO{}}
			authnService := &authntest.FakeService{
				ExpectedClientConfig: &authntest.FakeSSOClientConfig{
					ExpectedIsSkipOrgRoleSyncEnabled:         tc.skipOrgRoleSync,
					ExpectedIsAllowAssignGrafanaAdminEnabled: tc.allowAssignGrafanaAdmin,
				},
				EnabledClients: []string{},
			}
			cfg := setting.NewCfg()

			switch tc.authModule {
			case login.GenericOAuthModule:
				if tc.authEnabled {
					authnService.EnabledClients = []string{authn.ClientWithPrefix("generic_oauth")}
				}
			case login.JWTModule:
				cfg.JWTAuth.Enabled = tc.authEnabled
				cfg.JWTAuth.SkipOrgRoleSync = tc.skipOrgRoleSync
				cfg.JWTAuth.AllowAssignGrafanaAdmin = tc.allowAssignGrafanaAdmin
			case login.SAMLAuthModule:
				if tc.authEnabled {
					authnService.EnabledClients = []string{authn.ClientSAML}
				}
			}

			hs := &HTTPServer{
				Cfg:             cfg,
				authInfoService: authInfoService,
				SocialService:   socialService,
				userService:     userService,
				authnService:    authnService,
			}

			sc := setupScenarioContext(t, "/api/users/1")
			sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
				sc.context = c
				return hs.GetUserByID(c)
			})

			sc.m.Get("/api/users/:id", sc.defaultHandler)
			sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

			var resp user.UserProfileDTO
			require.Equal(t, http.StatusOK, sc.resp.Code)
			err := json.Unmarshal(sc.resp.Body.Bytes(), &resp)
			require.NoError(t, err)

			assert.Equal(t, tc.expectedIsGrafanaAdminSynced, resp.IsGrafanaAdminExternallySynced)
			assert.Equal(t, tc.expectedIsExternallySynced, resp.IsExternallySynced)
		})
	}
}

func TestHTTPServer_UpdateUser(t *testing.T) {
	settings := setting.NewCfg()
	sqlStore := db.InitTestDB(t)

	hs := &HTTPServer{
		Cfg:           settings,
		SQLStore:      sqlStore,
		AccessControl: acmock.New(),
		SocialService: &socialtest.FakeSocialService{ExpectedAuthInfoProvider: &social.OAuthInfo{Enabled: true}},
		authnService: &authntest.FakeService{
			EnabledClients: []string{authn.ClientSAML},
		},
	}

	updateUserCommand := user.UpdateUserCommand{
		Email:  fmt.Sprint("admin", "@test.com"),
		Name:   "admin",
		Login:  "admin",
		UserID: 1,
	}

	updateUserScenario(t, updateUserContext{
		desc:         "Should return 403 when the current User is an external user",
		url:          "/api/users/1",
		routePattern: "/api/users/:id",
		cmd:          updateUserCommand,
		fn: func(sc *scenarioContext) {
			sc.authInfoService.ExpectedUserAuth = &login.UserAuth{AuthModule: login.SAMLAuthModule}

			sc.fakeReqWithParams("PUT", sc.url, map[string]string{"id": "1"}).exec()
			assert.Equal(t, 403, sc.resp.Code)
		},
	}, hs)
}

func setupUpdateEmailTests(t *testing.T, cfg *setting.Cfg) (*user.User, *HTTPServer, *notifications.NotificationServiceMock) {
	t.Helper()

	sqlStore := db.InitTestDB(t, sqlstore.InitTestDBOpt{Cfg: cfg})

	tempUserService := tempuserimpl.ProvideService(sqlStore, cfg)
	orgSvc, err := orgimpl.ProvideService(sqlStore, cfg, quotatest.New(false, nil))
	require.NoError(t, err)
	userSvc, err := userimpl.ProvideService(
		sqlStore, orgSvc, cfg, nil, nil, tracing.InitializeTracerForTest(),
		quotatest.New(false, nil), supportbundlestest.NewFakeBundleService(),
	)
	require.NoError(t, err)

	// Create test user
	createUserCmd := user.CreateUserCommand{
		Email:   "testuser@localhost",
		Name:    "testuser",
		Login:   "loginuser",
		Company: "testCompany",
		IsAdmin: true,
	}
	usr, err := userSvc.Create(context.Background(), &createUserCmd)
	require.NoError(t, err)

	nsMock := notifications.MockNotificationService()
	verifier := userimpl.ProvideVerifier(cfg, userSvc, tempUserService, nsMock, &idtest.FakeService{})

	hs := &HTTPServer{
		Cfg:                 cfg,
		SQLStore:            sqlStore,
		userService:         userSvc,
		tempUserService:     tempUserService,
		NotificationService: nsMock,
		userVerifier:        verifier,
	}
	return usr, hs, nsMock
}

func TestUser_UpdateEmail(t *testing.T) {
	cases := []struct {
		Name  string
		Field user.UpdateEmailActionType
	}{
		{
			Name:  "Updating Email field",
			Field: user.EmailUpdateAction,
		},
		{
			Name:  "Updating Login (username) field",
			Field: user.LoginUpdateAction,
		},
	}

	for _, tt := range cases {
		t.Run(tt.Name, func(t *testing.T) {
			t.Run("With verification disabled should update without verifying", func(t *testing.T) {
				tests := []struct {
					name               string
					smtpConfigured     bool
					verifyEmailEnabled bool
				}{
					{
						name:               "SMTP not configured",
						smtpConfigured:     false,
						verifyEmailEnabled: true,
					},
					{
						name:               "config verify_email_enabled = false",
						smtpConfigured:     true,
						verifyEmailEnabled: false,
					},
					{
						name:               "config verify_email_enabled = false and SMTP not configured",
						smtpConfigured:     false,
						verifyEmailEnabled: false,
					},
				}
				for _, ttt := range tests {
					settings := setting.NewCfg()
					settings.Smtp.Enabled = ttt.smtpConfigured
					settings.VerifyEmailEnabled = ttt.verifyEmailEnabled

					usr, hs, nsMock := setupUpdateEmailTests(t, settings)

					updateUserCommand := user.UpdateUserCommand{
						Email:  usr.Email,
						Name:   "newName",
						Login:  usr.Login,
						UserID: usr.ID,
					}

					switch tt.Field {
					case user.LoginUpdateAction:
						updateUserCommand.Login = newEmail
					case user.EmailUpdateAction:
						updateUserCommand.Email = newEmail
					}

					fn := func(sc *scenarioContext) {
						// User is internal
						sc.authInfoService.ExpectedError = user.ErrUserNotFound

						sc.fakeReqWithParams("PUT", sc.url, nil).exec()
						assert.Equal(t, http.StatusOK, sc.resp.Code)

						// Verify that no email has been sent after update
						require.False(t, nsMock.EmailVerified)

						userQuery := user.GetUserByIDQuery{ID: usr.ID}
						updatedUsr, err := hs.userService.GetByID(context.Background(), &userQuery)
						require.NoError(t, err)

						// Verify fields have been updated
						require.NotEqual(t, usr.Name, updatedUsr.Name)
						require.Equal(t, updateUserCommand.Name, updatedUsr.Name)

						switch tt.Field {
						case user.LoginUpdateAction:
							require.Equal(t, usr.Email, updatedUsr.Email)
							require.NotEqual(t, usr.Login, updatedUsr.Login)
							require.Equal(t, updateUserCommand.Login, updatedUsr.Login)
						case user.EmailUpdateAction:
							require.Equal(t, usr.Login, updatedUsr.Login)
							require.NotEqual(t, usr.Email, updatedUsr.Email)
							require.Equal(t, updateUserCommand.Email, updatedUsr.Email)
						}

						// Verify other fields have been kept
						require.Equal(t, usr.Company, updatedUsr.Company)
					}

					updateUserScenario(t, updateUserContext{
						desc:         ttt.name,
						url:          fmt.Sprintf("/api/users/%d", usr.ID),
						routePattern: "/api/users/:id",
						cmd:          updateUserCommand,
						fn:           fn,
					}, hs)

					updateSignedInUserScenario(t, updateUserContext{
						desc:         ttt.name,
						url:          "/api/user",
						routePattern: "/api/user",
						cmd:          updateUserCommand,
						fn:           fn,
					}, hs)
				}
			})
		})
	}

	doReq := func(req *http.Request, usr *user.User) (*http.Response, error) {
		r := webtest.RequestWithSignedInUser(
			req,
			authedUserWithPermissions(
				usr.ID,
				usr.OrgID,
				[]accesscontrol.Permission{
					{
						Action: accesscontrol.ActionUsersWrite,
						Scope:  accesscontrol.ScopeGlobalUsersAll,
					},
				},
			),
		)
		client := &http.Client{
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse
			}}
		return client.Do(r)
	}

	sendUpdateReq := func(server *webtest.Server, usr *user.User, body string) {
		req := server.NewRequest(
			http.MethodPut,
			"/api/user",
			strings.NewReader(body),
		)
		req.Header.Add("Content-Type", "application/json")
		res, err := doReq(req, usr)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	}

	sendVerificationReq := func(server *webtest.Server, usr *user.User, code string) {
		url := fmt.Sprintf("/user/email/update?code=%s", url.QueryEscape(code))
		req := server.NewGetRequest(url)
		res, err := doReq(req, usr)
		require.NoError(t, err)
		assert.Equal(t, http.StatusFound, res.StatusCode)
		require.NoError(t, res.Body.Close())
	}

	getVerificationTempUser := func(tempUserSvc tempuser.Service, code string) *tempuser.TempUserDTO {
		tmpUserQuery := tempuser.GetTempUserByCodeQuery{Code: code}
		tmpUser, err := tempUserSvc.GetTempUserByCode(context.Background(), &tmpUserQuery)
		require.NoError(t, err)
		return tmpUser
	}

	verifyEmailData := func(tempUserSvc tempuser.Service, nsMock *notifications.NotificationServiceMock, originalUsr *user.User, newEmail string) {
		verification := nsMock.EmailVerification
		tmpUsr := getVerificationTempUser(tempUserSvc, verification.Code)

		require.True(t, nsMock.EmailVerified)
		require.Equal(t, newEmail, verification.Email)
		require.Equal(t, originalUsr.ID, verification.User.ID)
		require.Equal(t, tmpUsr.Code, verification.Code)
	}

	verifyUserNotUpdated := func(userSvc user.Service, usr *user.User) {
		userQuery := user.GetUserByIDQuery{ID: usr.ID}
		checkUsr, err := userSvc.GetByID(context.Background(), &userQuery)
		require.NoError(t, err)
		require.Equal(t, usr.Email, checkUsr.Email)
		require.Equal(t, usr.Login, checkUsr.Login)
		require.Equal(t, usr.Name, checkUsr.Name)
	}

	setupScenario := func(cfg *setting.Cfg) (*webtest.Server, user.Service, tempuser.Service, *notifications.NotificationServiceMock) {
		settings := setting.NewCfg()
		settings.Smtp.Enabled = true
		settings.VerificationEmailMaxLifetime = 1 * time.Hour
		settings.VerifyEmailEnabled = true

		if cfg != nil {
			settings = cfg
		}

		nsMock := notifications.MockNotificationService()
		sqlStore := db.InitTestDB(t, sqlstore.InitTestDBOpt{Cfg: settings})

		tempUserSvc := tempuserimpl.ProvideService(sqlStore, settings)
		orgSvc, err := orgimpl.ProvideService(sqlStore, settings, quotatest.New(false, nil))
		require.NoError(t, err)
		userSvc, err := userimpl.ProvideService(
			sqlStore, orgSvc, settings, nil, nil, tracing.InitializeTracerForTest(),
			quotatest.New(false, nil), supportbundlestest.NewFakeBundleService(),
		)
		require.NoError(t, err)

		server := SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.Cfg = settings

			hs.SQLStore = sqlStore
			hs.userService = userSvc
			hs.tempUserService = tempUserSvc
			hs.NotificationService = nsMock
			hs.SecretsService = fakes.NewFakeSecretsService()
			hs.userVerifier = userimpl.ProvideVerifier(settings, userSvc, tempUserSvc, nsMock, &idtest.FakeService{})
			// User is internal
			hs.authInfoService = &authinfotest.FakeService{ExpectedError: user.ErrUserNotFound}
		})

		return server, userSvc, tempUserSvc, nsMock
	}

	createUser := func(userSvc user.Service, name string, email string, login string) *user.User {
		createUserCmd := user.CreateUserCommand{
			Email:   email,
			Name:    name,
			Login:   login,
			Company: "testCompany",
			IsAdmin: true,
		}
		usr, err := userSvc.Create(context.Background(), &createUserCmd)
		require.NoError(t, err)
		return usr
	}

	t.Run("Update Email and disregard other fields", func(t *testing.T) {
		server, userSvc, tempUserSvc, nsMock := setupScenario(nil)

		originalUsr := createUser(userSvc, "name", "email@localhost", "login")

		// Verify that no email has been sent yet
		require.False(t, nsMock.EmailVerified)

		// Start email update
		newName := "newname"
		body := fmt.Sprintf(`{"email": "%s", "name": "%s"}`, newEmail, newName)
		sendUpdateReq(server, originalUsr, body)

		// Verify email data
		verifyEmailData(tempUserSvc, nsMock, originalUsr, newEmail)

		// Verify user has not been updated yet
		verifyUserNotUpdated(userSvc, originalUsr)

		// Second part of the verification flow, when user clicks email button
		code := nsMock.EmailVerification.Code
		sendVerificationReq(server, originalUsr, code)

		// Verify Email has been updated
		userQuery := user.GetUserByIDQuery{ID: originalUsr.ID}
		updatedUsr, err := userSvc.GetByID(context.Background(), &userQuery)
		require.NoError(t, err)
		require.NotEqual(t, originalUsr.Email, updatedUsr.Email)
		require.Equal(t, newEmail, updatedUsr.Email)
		// Fields unchanged
		require.Equal(t, originalUsr.Login, updatedUsr.Login)
		require.Equal(t, originalUsr.Name, updatedUsr.Name)
		require.NotEqual(t, newName, updatedUsr.Name)
	})

	t.Run("Update Email when Login was also an email should update both", func(t *testing.T) {
		server, userSvc, tempUserSvc, nsMock := setupScenario(nil)

		originalUsr := createUser(userSvc, "name", "email@localhost", "email@localhost")

		// Verify that no email has been sent yet
		require.False(t, nsMock.EmailVerified)

		// Start email update
		body := fmt.Sprintf(`{"email": "%s"}`, newEmail)
		sendUpdateReq(server, originalUsr, body)

		// Verify email data
		verifyEmailData(tempUserSvc, nsMock, originalUsr, newEmail)

		// Verify user has not been updated yet
		verifyUserNotUpdated(userSvc, originalUsr)

		// Second part of the verification flow, when user clicks email button
		code := nsMock.EmailVerification.Code
		sendVerificationReq(server, originalUsr, code)

		// Verify Email and Login have been updated
		userQuery := user.GetUserByIDQuery{ID: originalUsr.ID}
		updatedUsr, err := userSvc.GetByID(context.Background(), &userQuery)
		require.NoError(t, err)
		require.NotEqual(t, originalUsr.Email, updatedUsr.Email)
		require.Equal(t, newEmail, updatedUsr.Email)
		require.Equal(t, newEmail, updatedUsr.Login)
		// Fields unchanged
		require.Equal(t, originalUsr.Name, updatedUsr.Name)
	})

	t.Run("Update Login with an email should update Email too", func(t *testing.T) {
		server, userSvc, tempUserSvc, nsMock := setupScenario(nil)

		originalUsr := createUser(userSvc, "name", "email@localhost", "login")

		// Verify that no email has been sent yet
		require.False(t, nsMock.EmailVerified)

		// Start email update
		body := fmt.Sprintf(`{"login": "%s"}`, newEmail)
		sendUpdateReq(server, originalUsr, body)

		// Verify email data
		verifyEmailData(tempUserSvc, nsMock, originalUsr, newEmail)

		// Verify user has not been updated yet
		verifyUserNotUpdated(userSvc, originalUsr)

		// Second part of the verification flow, when user clicks email button
		code := nsMock.EmailVerification.Code
		sendVerificationReq(server, originalUsr, code)

		// Verify Email and Login have been updated
		userQuery := user.GetUserByIDQuery{ID: originalUsr.ID}
		updatedUsr, err := userSvc.GetByID(context.Background(), &userQuery)
		require.NoError(t, err)
		require.NotEqual(t, originalUsr.Email, updatedUsr.Email)
		require.NotEqual(t, originalUsr.Login, updatedUsr.Login)
		require.Equal(t, newEmail, updatedUsr.Email)
		require.Equal(t, newEmail, updatedUsr.Login)
		// Fields unchanged
		require.Equal(t, originalUsr.Name, updatedUsr.Name)
	})

	t.Run("Update Login should not need verification if it is not an email", func(t *testing.T) {
		server, userSvc, _, nsMock := setupScenario(nil)

		originalUsr := createUser(userSvc, "name", "email@localhost", "login")

		// Verify that no email has been sent yet
		require.False(t, nsMock.EmailVerified)

		// Start email update
		newLogin := "newlogin"
		newName := "newname"
		body := fmt.Sprintf(`{"login": "%s", "name": "%s"}`, newLogin, newName)
		sendUpdateReq(server, originalUsr, body)

		// Verify that email has not been sent
		require.False(t, nsMock.EmailVerified)

		// Verify Login has been updated
		userQuery := user.GetUserByIDQuery{ID: originalUsr.ID}
		updatedUsr, err := userSvc.GetByID(context.Background(), &userQuery)
		require.NoError(t, err)
		require.NotEqual(t, originalUsr.Login, updatedUsr.Login)
		require.NotEqual(t, originalUsr.Name, updatedUsr.Name)
		require.Equal(t, newLogin, updatedUsr.Login)
		require.Equal(t, newName, updatedUsr.Name)
		// Fields unchanged
		require.Equal(t, originalUsr.Email, updatedUsr.Email)
	})

	t.Run("Update Login should not need verification if it is being updated to the already configured email", func(t *testing.T) {
		server, userSvc, _, nsMock := setupScenario(nil)

		originalUsr := createUser(userSvc, "name", "email@localhost", "login")

		// Verify that no email has been sent yet
		require.False(t, nsMock.EmailVerified)

		// Start email update
		body := fmt.Sprintf(`{"login": "%s"}`, originalUsr.Email)
		sendUpdateReq(server, originalUsr, body)

		// Verify that email has not been sent
		require.False(t, nsMock.EmailVerified)

		// Verify Login has been updated
		userQuery := user.GetUserByIDQuery{ID: originalUsr.ID}
		updatedUsr, err := userSvc.GetByID(context.Background(), &userQuery)
		require.NoError(t, err)
		require.NotEqual(t, originalUsr.Login, updatedUsr.Login)
		require.Equal(t, originalUsr.Email, updatedUsr.Login)
		require.Equal(t, originalUsr.Email, updatedUsr.Email)
	})

	t.Run("Update Login and Email with different email values at once should disregard the Login update", func(t *testing.T) {
		server, userSvc, tempUserSvc, nsMock := setupScenario(nil)

		originalUsr := createUser(userSvc, "name", "email@localhost", "login")

		// Verify that no email has been sent yet
		require.False(t, nsMock.EmailVerified)

		// Start email update
		newLogin := "newemail2@localhost"
		body := fmt.Sprintf(`{"email": "%s", "login": "%s"}`, newEmail, newLogin)
		sendUpdateReq(server, originalUsr, body)

		// Verify email data
		verifyEmailData(tempUserSvc, nsMock, originalUsr, newEmail)

		// Verify user has not been updated yet
		verifyUserNotUpdated(userSvc, originalUsr)

		// Second part of the verification flow, when user clicks email button
		code := nsMock.EmailVerification.Code
		sendVerificationReq(server, originalUsr, code)

		// Verify only Email has been updated
		userQuery := user.GetUserByIDQuery{ID: originalUsr.ID}
		updatedUsr, err := userSvc.GetByID(context.Background(), &userQuery)
		require.NoError(t, err)
		require.NotEqual(t, originalUsr.Email, updatedUsr.Email)
		require.Equal(t, newEmail, updatedUsr.Email)
		// Fields unchanged
		require.NotEqual(t, newLogin, updatedUsr.Login)
		require.Equal(t, originalUsr.Login, updatedUsr.Login)
		require.Equal(t, originalUsr.Name, updatedUsr.Name)
	})

	t.Run("Update Login and Email with different email values at once when Login was already an email should update both with Email", func(t *testing.T) {
		server, userSvc, tempUserSvc, nsMock := setupScenario(nil)

		originalUsr := createUser(userSvc, "name", "email@localhost", "email@localhost")

		// Verify that no email has been sent yet
		require.False(t, nsMock.EmailVerified)

		// Start email update
		newLogin := "newemail2@localhost"
		body := fmt.Sprintf(`{"email": "%s", "login": "%s"}`, newEmail, newLogin)
		sendUpdateReq(server, originalUsr, body)

		// Verify email data
		verifyEmailData(tempUserSvc, nsMock, originalUsr, newEmail)

		// Verify user has not been updated yet
		verifyUserNotUpdated(userSvc, originalUsr)

		// Second part of the verification flow, when user clicks email button
		code := nsMock.EmailVerification.Code
		sendVerificationReq(server, originalUsr, code)

		// Verify only Email has been updated
		userQuery := user.GetUserByIDQuery{ID: originalUsr.ID}
		updatedUsr, err := userSvc.GetByID(context.Background(), &userQuery)
		require.NoError(t, err)
		require.NotEqual(t, originalUsr.Email, updatedUsr.Email)
		require.NotEqual(t, originalUsr.Login, updatedUsr.Login)
		require.NotEqual(t, newLogin, updatedUsr.Login)
		require.Equal(t, newEmail, updatedUsr.Email)
		require.Equal(t, newEmail, updatedUsr.Login)
		// Fields unchanged
		require.Equal(t, originalUsr.Name, updatedUsr.Name)
	})

	t.Run("Email verification should expire", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.Smtp.Enabled = true
		cfg.VerificationEmailMaxLifetime = 0 // Expire instantly
		cfg.VerifyEmailEnabled = true

		server, userSvc, tempUserSvc, nsMock := setupScenario(cfg)

		originalUsr := createUser(userSvc, "name", "email@localhost", "login")

		// Verify that no email has been sent yet
		require.False(t, nsMock.EmailVerified)

		// Start email update
		body := fmt.Sprintf(`{"email": "%s"}`, newEmail)
		sendUpdateReq(server, originalUsr, body)

		// Verify email data
		verifyEmailData(tempUserSvc, nsMock, originalUsr, newEmail)

		// Verify user has not been updated yet
		verifyUserNotUpdated(userSvc, originalUsr)

		// Second part of the verification flow, when user clicks email button
		code := nsMock.EmailVerification.Code
		sendVerificationReq(server, originalUsr, code)

		// Verify user has not been updated
		userQuery := user.GetUserByIDQuery{ID: originalUsr.ID}
		updatedUsr, err := userSvc.GetByID(context.Background(), &userQuery)
		require.NoError(t, err)
		require.NotEqual(t, newEmail, updatedUsr.Email)
		require.Equal(t, originalUsr.Email, updatedUsr.Email)
		require.Equal(t, originalUsr.Login, updatedUsr.Login)
	})

	t.Run("A new verification should revoke other pending verifications", func(t *testing.T) {
		server, userSvc, tempUserSvc, nsMock := setupScenario(nil)

		originalUsr := createUser(userSvc, "name", "email@localhost", "login")

		// Verify that no email has been sent yet
		require.False(t, nsMock.EmailVerified)

		// First email verification
		firstNewEmail := "newemail1@localhost"
		body := fmt.Sprintf(`{"email": "%s"}`, firstNewEmail)
		sendUpdateReq(server, originalUsr, body)
		verifyEmailData(tempUserSvc, nsMock, originalUsr, firstNewEmail)
		firstCode := nsMock.EmailVerification.Code

		// Second email verification
		secondNewEmail := "newemail2@localhost"
		body = fmt.Sprintf(`{"email": "%s"}`, secondNewEmail)
		sendUpdateReq(server, originalUsr, body)
		verifyEmailData(tempUserSvc, nsMock, originalUsr, secondNewEmail)
		secondCode := nsMock.EmailVerification.Code

		// Verify user has not been updated yet
		verifyUserNotUpdated(userSvc, originalUsr)

		// Try to follow through with the first verification unsuccessfully
		sendVerificationReq(server, originalUsr, firstCode)
		verifyUserNotUpdated(userSvc, originalUsr)

		// Follow through with second verification successfully
		sendVerificationReq(server, originalUsr, secondCode)

		userQuery := user.GetUserByIDQuery{ID: originalUsr.ID}
		updatedUsr, err := userSvc.GetByID(context.Background(), &userQuery)
		require.NoError(t, err)
		require.NotEqual(t, originalUsr.Email, updatedUsr.Email)
		require.Equal(t, secondNewEmail, updatedUsr.Email)
		// Fields unchanged
		require.Equal(t, originalUsr.Login, updatedUsr.Login)
	})

	t.Run("Email verification should fail if code is not valid", func(t *testing.T) {
		server, userSvc, tempUserSvc, nsMock := setupScenario(nil)

		originalUsr := createUser(userSvc, "name", "email@localhost", "login")

		// Verify that no email has been sent yet
		require.False(t, nsMock.EmailVerified)

		// Start email update
		body := fmt.Sprintf(`{"email": "%s"}`, newEmail)
		sendUpdateReq(server, originalUsr, body)

		// Verify email data
		verifyEmailData(tempUserSvc, nsMock, originalUsr, newEmail)

		// Verify user has not been updated yet
		verifyUserNotUpdated(userSvc, originalUsr)

		// Second part of the verification flow should fail if using the wrong code
		sendVerificationReq(server, originalUsr, "notTheRightCode")
		verifyUserNotUpdated(userSvc, originalUsr)
	})

	t.Run("Email verification code can only be used once", func(t *testing.T) {
		server, userSvc, _, nsMock := setupScenario(nil)

		originalUsr := createUser(userSvc, "name", "email@localhost", "login")

		// Start email update
		require.NotEqual(t, originalUsr.Email, newEmail)

		body := fmt.Sprintf(`{"email": "%s"}`, newEmail)
		sendUpdateReq(server, originalUsr, body)

		// Verify user has not been updated yet
		verifyUserNotUpdated(userSvc, originalUsr)

		// Use code to verify successfully
		codeToReuse := nsMock.EmailVerification.Code
		sendVerificationReq(server, originalUsr, codeToReuse)

		// User should have an updated Email
		userQuery := user.GetUserByIDQuery{ID: originalUsr.ID}
		updatedUsr, err := userSvc.GetByID(context.Background(), &userQuery)
		require.NoError(t, err)
		require.Equal(t, newEmail, updatedUsr.Email)

		// Change email back to what it was
		body = fmt.Sprintf(`{"email": "%s"}`, originalUsr.Email)
		sendUpdateReq(server, originalUsr, body)
		sendVerificationReq(server, originalUsr, nsMock.EmailVerification.Code)
		verifyUserNotUpdated(userSvc, originalUsr)

		// Re-use code to verify new email again, unsuccessfully
		sendVerificationReq(server, originalUsr, codeToReuse)
		verifyUserNotUpdated(userSvc, originalUsr)
	})

	t.Run("Update Email with an email that is already being used should fail", func(t *testing.T) {
		testCases := []struct {
			description string
			clashLogin  bool
		}{
			{
				description: "when Email clashes",
				clashLogin:  false,
			},
			{
				description: "when Login clashes",
				clashLogin:  true,
			},
		}
		for _, tt := range testCases {
			t.Run(tt.description, func(t *testing.T) {
				server, userSvc, _, nsMock := setupScenario(nil)

				originalUsr := createUser(userSvc, "name1", "email1@localhost", "login1@localhost")
				badUsr := createUser(userSvc, "name2", "email2@localhost", "login2")

				// Verify that no email has been sent yet
				require.False(t, nsMock.EmailVerified)

				// Update `badUsr` to use the same email as `originalUsr`
				body := fmt.Sprintf(`{"email": "%s"}`, originalUsr.Email)
				if tt.clashLogin {
					body = fmt.Sprintf(`{"login": "%s"}`, originalUsr.Login)
				}
				req := server.NewRequest(
					http.MethodPut,
					"/api/user",
					strings.NewReader(body),
				)
				req.Header.Add("Content-Type", "application/json")
				res, err := doReq(req, badUsr)
				require.NoError(t, err)
				assert.Equal(t, http.StatusConflict, res.StatusCode)
				require.NoError(t, res.Body.Close())

				// Verify that no email has been sent
				require.False(t, nsMock.EmailVerified)

				// Verify user has not been updated
				verifyUserNotUpdated(userSvc, badUsr)
			})
		}
	})
}

type updateUserContext struct {
	desc         string
	url          string
	routePattern string
	cmd          user.UpdateUserCommand
	fn           scenarioFunc
}

func updateUserScenario(t *testing.T, ctx updateUserContext, hs *HTTPServer) {
	t.Run(fmt.Sprintf("%s %s", ctx.desc, ctx.url), func(t *testing.T) {
		sc := setupScenarioContext(t, ctx.url)

		sc.authInfoService = &authinfotest.FakeService{}
		hs.authInfoService = sc.authInfoService

		sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
			c.Req.Body = mockRequestBody(ctx.cmd)
			c.Req.Header.Add("Content-Type", "application/json")
			sc.context = c
			sc.context.OrgID = testOrgID
			sc.context.UserID = testUserID

			return hs.UpdateUser(c)
		})

		sc.m.Put(ctx.routePattern, sc.defaultHandler)

		ctx.fn(sc)
	})
}

func TestHTTPServer_UpdateSignedInUser(t *testing.T) {
	settings := setting.NewCfg()
	sqlStore := db.InitTestDB(t)

	hs := &HTTPServer{
		Cfg:           settings,
		SQLStore:      sqlStore,
		AccessControl: acmock.New(),
		SocialService: &socialtest.FakeSocialService{},
		authnService: &authntest.FakeService{
			EnabledClients: []string{authn.ClientSAML},
		},
	}

	updateUserCommand := user.UpdateUserCommand{
		Email:  fmt.Sprint("admin", "@test.com"),
		Name:   "admin",
		Login:  "admin",
		UserID: 1,
	}

	updateSignedInUserScenario(t, updateUserContext{
		desc:         "Should return 403 when the current User is an external user",
		url:          "/api/users/",
		routePattern: "/api/users/",
		cmd:          updateUserCommand,
		fn: func(sc *scenarioContext) {
			sc.authInfoService.ExpectedUserAuth = &login.UserAuth{AuthModule: login.SAMLAuthModule}
			sc.fakeReqWithParams("PUT", sc.url, map[string]string{"id": "1"}).exec()
			assert.Equal(t, 403, sc.resp.Code)
		},
	}, hs)
}

func updateSignedInUserScenario(t *testing.T, ctx updateUserContext, hs *HTTPServer) {
	t.Run(fmt.Sprintf("%s %s", ctx.desc, ctx.url), func(t *testing.T) {
		sc := setupScenarioContext(t, ctx.url)

		sc.authInfoService = &authinfotest.FakeService{}
		hs.authInfoService = sc.authInfoService

		sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
			c.Req.Body = mockRequestBody(ctx.cmd)
			c.Req.Header.Add("Content-Type", "application/json")
			sc.context = c
			sc.context.OrgID = testOrgID
			sc.context.UserID = testUserID

			return hs.UpdateSignedInUser(c)
		})

		sc.m.Put(ctx.routePattern, sc.defaultHandler)

		ctx.fn(sc)
	})
}
