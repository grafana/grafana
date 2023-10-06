package extsvcaccounts

// {
// 	name: "should create a service account",
// 	init: func(env *TestEnv) {
// 		// No client at the beginning
// 		env.OAuthStore.On("GetExternalServiceByName", mock.Anything, mock.Anything).Return(nil, oauthserver.ErrClientNotFound(serviceName))
// 		env.OAuthStore.On("SaveExternalService", mock.Anything, mock.Anything).Return(nil)
// 		// Service account and permission creation
// 		env.SAService.On("CreateServiceAccount", mock.Anything, mock.Anything, mock.Anything).Return(&sa1, nil)
// 		env.AcStore.On("SaveExternalServiceRole", mock.Anything, mock.Anything).Return(nil)
// 	},
// 	cmd: &extsvcauth.ExternalServiceRegistration{
// 		Name:             serviceName,
// 		OAuthProviderCfg: &extsvcauth.OAuthProviderCfg{Key: &extsvcauth.KeyOption{Generate: true}},
// 		Self: extsvcauth.SelfCfg{
// 			Enabled:     true,
// 			Permissions: []ac.Permission{{Action: "users:read", Scope: "users:*"}},
// 		},
// 	},
// 	mockChecks: func(t *testing.T, env *TestEnv) {
// 		// Check that the client has a service account and the correct grant type
// 		env.OAuthStore.AssertCalled(t, "SaveExternalService", mock.Anything, mock.MatchedBy(func(client *oauthserver.OAuthExternalService) bool {
// 			return client.Name == serviceName &&
// 				client.GrantTypes == "client_credentials" && client.ServiceAccountID == sa1.Id
// 		}))
// 		// Check that the service account is created in the correct org with the correct role
// 		env.SAService.AssertCalled(t, "CreateServiceAccount", mock.Anything,
// 			mock.MatchedBy(func(orgID int64) bool { return orgID == oauthserver.TmpOrgID }),
// 			mock.MatchedBy(func(cmd *sa.CreateServiceAccountForm) bool {
// 				return cmd.Name == serviceName && *cmd.Role == roletype.RoleNone
// 			}),
// 		)
// 	},
// },
// {
// 	name: "should delete the service account",
// 	init: func(env *TestEnv) {
// 		// Existing client (with a service account hence a role)
// 		env.OAuthStore.On("GetExternalServiceByName", mock.Anything, mock.Anything).Return(client1(), nil)
// 		env.OAuthStore.On("SaveExternalService", mock.Anything, mock.Anything).Return(nil)
// 		env.SAService.On("RetrieveServiceAccount", mock.Anything, mock.Anything, mock.Anything).Return(&sa1Profile, nil)
// 		// No permission anymore will trigger deletion of the service account and its role
// 		env.SAService.On("DeleteServiceAccount", mock.Anything, mock.Anything, mock.Anything).Return(nil)
// 		env.AcStore.On("DeleteExternalServiceRole", mock.Anything, mock.Anything).Return(nil)
// 	},
// 	cmd: &extsvcauth.ExternalServiceRegistration{
// 		Name:             serviceName,
// 		OAuthProviderCfg: &extsvcauth.OAuthProviderCfg{Key: &extsvcauth.KeyOption{Generate: true}},
// 		Self: extsvcauth.SelfCfg{
// 			Enabled: false,
// 		},
// 	},
// 	mockChecks: func(t *testing.T, env *TestEnv) {
// 		// Check that the service has no service account anymore
// 		env.OAuthStore.AssertCalled(t, "SaveExternalService", mock.Anything, mock.MatchedBy(func(client *oauthserver.OAuthExternalService) bool {
// 			return client.Name == serviceName && client.ServiceAccountID == oauthserver.NoServiceAccountID
// 		}))
// 		// Check that the service account is retrieved with the correct ID
// 		env.SAService.AssertCalled(t, "RetrieveServiceAccount", mock.Anything,
// 			mock.MatchedBy(func(orgID int64) bool { return orgID == oauthserver.TmpOrgID }),
// 			mock.MatchedBy(func(saID int64) bool { return saID == prevSaID }))
// 		// Check that the service account is deleted in the correct org
// 		env.SAService.AssertCalled(t, "DeleteServiceAccount", mock.Anything,
// 			mock.MatchedBy(func(orgID int64) bool { return orgID == oauthserver.TmpOrgID }),
// 			mock.MatchedBy(func(saID int64) bool { return saID == sa1.Id }))
// 		// Check that the associated role is deleted
// 		env.AcStore.AssertCalled(t, "DeleteExternalServiceRole", mock.Anything,
// 			mock.MatchedBy(func(extSvcName string) bool { return extSvcName == serviceName }))
// 	},
// },
// {
// 	name: "should update the service account",
// 	init: func(env *TestEnv) {
// 		// Existing client (with a service account hence a role)
// 		env.OAuthStore.On("GetExternalServiceByName", mock.Anything, mock.Anything).Return(client1(), nil)
// 		env.OAuthStore.On("SaveExternalService", mock.Anything, mock.Anything).Return(nil)
// 		env.SAService.On("RetrieveServiceAccount", mock.Anything, mock.Anything, mock.Anything).Return(&sa1Profile, nil)
// 		// Update the service account permissions
// 		env.AcStore.On("SaveExternalServiceRole", mock.Anything, mock.Anything).Return(nil)
// 	},
// 	cmd: &extsvcauth.ExternalServiceRegistration{
// 		Name:             serviceName,
// 		OAuthProviderCfg: &extsvcauth.OAuthProviderCfg{Key: &extsvcauth.KeyOption{Generate: true}},
// 		Self: extsvcauth.SelfCfg{
// 			Enabled:     true,
// 			Permissions: []ac.Permission{{Action: "dashboards:create", Scope: "folders:uid:general"}},
// 		},
// 	},
// 	mockChecks: func(t *testing.T, env *TestEnv) {
// 		// Ensure new permissions are in place
// 		env.AcStore.AssertCalled(t, "SaveExternalServiceRole", mock.Anything,
// 			mock.MatchedBy(func(cmd ac.SaveExternalServiceRoleCommand) bool {
// 				return cmd.ServiceAccountID == sa1.Id && cmd.ExternalServiceID == client1().Name &&
// 					cmd.OrgID == int64(ac.GlobalOrgID) && len(cmd.Permissions) == 1 &&
// 					cmd.Permissions[0] == ac.Permission{Action: "dashboards:create", Scope: "folders:uid:general"}
// 			}))
// 	},
// },
