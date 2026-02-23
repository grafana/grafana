import { api } from './baseAPI';
export const addTagTypes = [
  'enterprise',
  'access_control',
  'admin_ldap',
  'admin_provisioning',
  'admin',
  'admin_users',
  'quota',
  'annotations',
  'devices',
  'migrations',
  'convert_prometheus',
  'dashboards',
  'snapshots',
  'dashboard_public',
  'permissions',
  'versions',
  'datasources',
  'correlations',
  'health',
  'folders',
  'group_attribute_sync',
  'library_elements',
  'licensing',
  'saml',
  'org',
  'invites',
  'preferences',
  'orgs',
  'query_history',
  'recording_rules',
  'reports',
  'search',
  'service_accounts',
  'signing_keys',
  'teams',
  'sync_team_groups',
  'signed_in_user',
  'user',
  'users',
  'provisioning',
  'sso_settings',
] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      searchResult: build.mutation<SearchResultApiResponse, SearchResultApiArg>({
        query: () => ({ url: `/access-control/assignments/search`, method: 'POST' }),
        invalidatesTags: ['enterprise'],
      }),
      listRoles: build.query<ListRolesApiResponse, ListRolesApiArg>({
        query: (queryArg) => ({
          url: `/access-control/roles`,
          params: {
            delegatable: queryArg.delegatable,
            includeHidden: queryArg.includeHidden,
            targetOrgId: queryArg.targetOrgId,
          },
        }),
        providesTags: ['access_control', 'enterprise'],
      }),
      createRole: build.mutation<CreateRoleApiResponse, CreateRoleApiArg>({
        query: (queryArg) => ({ url: `/access-control/roles`, method: 'POST', body: queryArg.createRoleForm }),
        invalidatesTags: ['access_control', 'enterprise'],
      }),
      deleteRole: build.mutation<DeleteRoleApiResponse, DeleteRoleApiArg>({
        query: (queryArg) => ({
          url: `/access-control/roles/${queryArg.roleUid}`,
          method: 'DELETE',
          params: {
            force: queryArg.force,
            global: queryArg['global'],
          },
        }),
        invalidatesTags: ['access_control', 'enterprise'],
      }),
      getRole: build.query<GetRoleApiResponse, GetRoleApiArg>({
        query: (queryArg) => ({ url: `/access-control/roles/${queryArg.roleUid}` }),
        providesTags: ['access_control', 'enterprise'],
      }),
      updateRole: build.mutation<UpdateRoleApiResponse, UpdateRoleApiArg>({
        query: (queryArg) => ({
          url: `/access-control/roles/${queryArg.roleUid}`,
          method: 'PUT',
          body: queryArg.updateRoleCommand,
        }),
        invalidatesTags: ['access_control', 'enterprise'],
      }),
      getRoleAssignments: build.query<GetRoleAssignmentsApiResponse, GetRoleAssignmentsApiArg>({
        query: (queryArg) => ({ url: `/access-control/roles/${queryArg.roleUid}/assignments` }),
        providesTags: ['access_control', 'enterprise'],
      }),
      setRoleAssignments: build.mutation<SetRoleAssignmentsApiResponse, SetRoleAssignmentsApiArg>({
        query: (queryArg) => ({
          url: `/access-control/roles/${queryArg.roleUid}/assignments`,
          method: 'PUT',
          body: queryArg.setRoleAssignmentsCommand,
        }),
        invalidatesTags: ['access_control', 'enterprise'],
      }),
      getAccessControlStatus: build.query<GetAccessControlStatusApiResponse, GetAccessControlStatusApiArg>({
        query: () => ({ url: `/access-control/status` }),
        providesTags: ['access_control', 'enterprise'],
      }),
      listTeamsRoles: build.query<ListTeamsRolesApiResponse, ListTeamsRolesApiArg>({
        query: (queryArg) => ({
          url: `/access-control/teams/roles/search`,
          method: 'POST',
          body: queryArg.rolesSearchQuery,
        }),
        providesTags: ['access_control', 'enterprise'],
      }),
      listTeamRoles: build.query<ListTeamRolesApiResponse, ListTeamRolesApiArg>({
        query: (queryArg) => ({
          url: `/access-control/teams/${queryArg.teamId}/roles`,
          params: {
            targetOrgId: queryArg.targetOrgId,
          },
        }),
        providesTags: ['access_control', 'enterprise'],
      }),
      addTeamRole: build.mutation<AddTeamRoleApiResponse, AddTeamRoleApiArg>({
        query: (queryArg) => ({
          url: `/access-control/teams/${queryArg.teamId}/roles`,
          method: 'POST',
          body: queryArg.addTeamRoleCommand,
        }),
        invalidatesTags: ['access_control', 'enterprise'],
      }),
      setTeamRoles: build.mutation<SetTeamRolesApiResponse, SetTeamRolesApiArg>({
        query: (queryArg) => ({
          url: `/access-control/teams/${queryArg.teamId}/roles`,
          method: 'PUT',
          body: queryArg.setTeamRolesCommand,
          params: {
            targetOrgId: queryArg.targetOrgId,
          },
        }),
        invalidatesTags: ['access_control', 'enterprise'],
      }),
      removeTeamRole: build.mutation<RemoveTeamRoleApiResponse, RemoveTeamRoleApiArg>({
        query: (queryArg) => ({
          url: `/access-control/teams/${queryArg.teamId}/roles/${queryArg.roleUid}`,
          method: 'DELETE',
        }),
        invalidatesTags: ['access_control', 'enterprise'],
      }),
      listUsersRoles: build.mutation<ListUsersRolesApiResponse, ListUsersRolesApiArg>({
        query: (queryArg) => ({
          url: `/access-control/users/roles/search`,
          method: 'POST',
          body: queryArg.rolesSearchQuery,
        }),
        invalidatesTags: ['access_control', 'enterprise'],
      }),
      listUserRoles: build.query<ListUserRolesApiResponse, ListUserRolesApiArg>({
        query: (queryArg) => ({
          url: `/access-control/users/${queryArg.userId}/roles`,
          params: {
            includeHidden: queryArg.includeHidden,
            includeMapped: queryArg.includeMapped,
            targetOrgId: queryArg.targetOrgId,
          },
        }),
        providesTags: ['access_control', 'enterprise'],
      }),
      addUserRole: build.mutation<AddUserRoleApiResponse, AddUserRoleApiArg>({
        query: (queryArg) => ({
          url: `/access-control/users/${queryArg.userId}/roles`,
          method: 'POST',
          body: queryArg.addUserRoleCommand,
        }),
        invalidatesTags: ['access_control', 'enterprise'],
      }),
      setUserRoles: build.mutation<SetUserRolesApiResponse, SetUserRolesApiArg>({
        query: (queryArg) => ({
          url: `/access-control/users/${queryArg.userId}/roles`,
          method: 'PUT',
          body: queryArg.setUserRolesCommand,
          params: {
            targetOrgId: queryArg.targetOrgId,
          },
        }),
        invalidatesTags: ['access_control', 'enterprise'],
      }),
      removeUserRole: build.mutation<RemoveUserRoleApiResponse, RemoveUserRoleApiArg>({
        query: (queryArg) => ({
          url: `/access-control/users/${queryArg.userId}/roles/${queryArg.roleUid}`,
          method: 'DELETE',
          params: {
            global: queryArg['global'],
          },
        }),
        invalidatesTags: ['access_control', 'enterprise'],
      }),
      getResourceDescription: build.query<GetResourceDescriptionApiResponse, GetResourceDescriptionApiArg>({
        query: (queryArg) => ({ url: `/access-control/${queryArg.resource}/description` }),
        providesTags: ['access_control'],
      }),
      getResourcePermissions: build.query<GetResourcePermissionsApiResponse, GetResourcePermissionsApiArg>({
        query: (queryArg) => ({ url: `/access-control/${queryArg.resource}/${queryArg.resourceId}` }),
        providesTags: ['access_control'],
      }),
      setResourcePermissions: build.mutation<SetResourcePermissionsApiResponse, SetResourcePermissionsApiArg>({
        query: (queryArg) => ({
          url: `/access-control/${queryArg.resource}/${queryArg.resourceId}`,
          method: 'POST',
          body: queryArg.setPermissionsCommand,
        }),
        invalidatesTags: ['access_control'],
      }),
      setResourcePermissionsForBuiltInRole: build.mutation<
        SetResourcePermissionsForBuiltInRoleApiResponse,
        SetResourcePermissionsForBuiltInRoleApiArg
      >({
        query: (queryArg) => ({
          url: `/access-control/${queryArg.resource}/${queryArg.resourceId}/builtInRoles/${queryArg.builtInRole}`,
          method: 'POST',
          body: queryArg.setPermissionCommand,
        }),
        invalidatesTags: ['access_control'],
      }),
      setResourcePermissionsForTeam: build.mutation<
        SetResourcePermissionsForTeamApiResponse,
        SetResourcePermissionsForTeamApiArg
      >({
        query: (queryArg) => ({
          url: `/access-control/${queryArg.resource}/${queryArg.resourceId}/teams/${queryArg.teamId}`,
          method: 'POST',
          body: queryArg.setPermissionCommand,
        }),
        invalidatesTags: ['access_control'],
      }),
      setResourcePermissionsForUser: build.mutation<
        SetResourcePermissionsForUserApiResponse,
        SetResourcePermissionsForUserApiArg
      >({
        query: (queryArg) => ({
          url: `/access-control/${queryArg.resource}/${queryArg.resourceId}/users/${queryArg.userId}`,
          method: 'POST',
          body: queryArg.setPermissionCommand,
        }),
        invalidatesTags: ['access_control'],
      }),
      getSyncStatus: build.query<GetSyncStatusApiResponse, GetSyncStatusApiArg>({
        query: () => ({ url: `/admin/ldap-sync-status` }),
        providesTags: ['admin_ldap', 'enterprise'],
      }),
      reloadLdapCfg: build.mutation<ReloadLdapCfgApiResponse, ReloadLdapCfgApiArg>({
        query: () => ({ url: `/admin/ldap/reload`, method: 'POST' }),
        invalidatesTags: ['admin_ldap'],
      }),
      getLdapStatus: build.query<GetLdapStatusApiResponse, GetLdapStatusApiArg>({
        query: () => ({ url: `/admin/ldap/status` }),
        providesTags: ['admin_ldap'],
      }),
      postSyncUserWithLdap: build.mutation<PostSyncUserWithLdapApiResponse, PostSyncUserWithLdapApiArg>({
        query: (queryArg) => ({ url: `/admin/ldap/sync/${queryArg.userId}`, method: 'POST' }),
        invalidatesTags: ['admin_ldap'],
      }),
      getUserFromLdap: build.query<GetUserFromLdapApiResponse, GetUserFromLdapApiArg>({
        query: (queryArg) => ({ url: `/admin/ldap/${queryArg.userName}` }),
        providesTags: ['admin_ldap'],
      }),
      adminProvisioningReloadAccessControl: build.mutation<
        AdminProvisioningReloadAccessControlApiResponse,
        AdminProvisioningReloadAccessControlApiArg
      >({
        query: () => ({ url: `/admin/provisioning/access-control/reload`, method: 'POST' }),
        invalidatesTags: ['admin_provisioning', 'access_control', 'enterprise'],
      }),
      adminProvisioningReloadDashboards: build.mutation<
        AdminProvisioningReloadDashboardsApiResponse,
        AdminProvisioningReloadDashboardsApiArg
      >({
        query: () => ({ url: `/admin/provisioning/dashboards/reload`, method: 'POST' }),
        invalidatesTags: ['admin_provisioning'],
      }),
      adminProvisioningReloadDatasources: build.mutation<
        AdminProvisioningReloadDatasourcesApiResponse,
        AdminProvisioningReloadDatasourcesApiArg
      >({
        query: () => ({ url: `/admin/provisioning/datasources/reload`, method: 'POST' }),
        invalidatesTags: ['admin_provisioning'],
      }),
      adminProvisioningReloadPlugins: build.mutation<
        AdminProvisioningReloadPluginsApiResponse,
        AdminProvisioningReloadPluginsApiArg
      >({
        query: () => ({ url: `/admin/provisioning/plugins/reload`, method: 'POST' }),
        invalidatesTags: ['admin_provisioning'],
      }),
      adminGetSettings: build.query<AdminGetSettingsApiResponse, AdminGetSettingsApiArg>({
        query: () => ({ url: `/admin/settings` }),
        providesTags: ['admin'],
      }),
      adminGetStats: build.query<AdminGetStatsApiResponse, AdminGetStatsApiArg>({
        query: () => ({ url: `/admin/stats` }),
        providesTags: ['admin'],
      }),
      adminCreateUser: build.mutation<AdminCreateUserApiResponse, AdminCreateUserApiArg>({
        query: (queryArg) => ({ url: `/admin/users`, method: 'POST', body: queryArg.adminCreateUserForm }),
        invalidatesTags: ['admin_users'],
      }),
      adminDeleteUser: build.mutation<AdminDeleteUserApiResponse, AdminDeleteUserApiArg>({
        query: (queryArg) => ({ url: `/admin/users/${queryArg.userId}`, method: 'DELETE' }),
        invalidatesTags: ['admin_users'],
      }),
      adminGetUserAuthTokens: build.query<AdminGetUserAuthTokensApiResponse, AdminGetUserAuthTokensApiArg>({
        query: (queryArg) => ({ url: `/admin/users/${queryArg.userId}/auth-tokens` }),
        providesTags: ['admin_users'],
      }),
      adminDisableUser: build.mutation<AdminDisableUserApiResponse, AdminDisableUserApiArg>({
        query: (queryArg) => ({ url: `/admin/users/${queryArg.userId}/disable`, method: 'POST' }),
        invalidatesTags: ['admin_users'],
      }),
      adminEnableUser: build.mutation<AdminEnableUserApiResponse, AdminEnableUserApiArg>({
        query: (queryArg) => ({ url: `/admin/users/${queryArg.userId}/enable`, method: 'POST' }),
        invalidatesTags: ['admin_users'],
      }),
      adminLogoutUser: build.mutation<AdminLogoutUserApiResponse, AdminLogoutUserApiArg>({
        query: (queryArg) => ({ url: `/admin/users/${queryArg.userId}/logout`, method: 'POST' }),
        invalidatesTags: ['admin_users'],
      }),
      adminUpdateUserPassword: build.mutation<AdminUpdateUserPasswordApiResponse, AdminUpdateUserPasswordApiArg>({
        query: (queryArg) => ({
          url: `/admin/users/${queryArg.userId}/password`,
          method: 'PUT',
          body: queryArg.adminUpdateUserPasswordForm,
        }),
        invalidatesTags: ['admin_users'],
      }),
      adminUpdateUserPermissions: build.mutation<
        AdminUpdateUserPermissionsApiResponse,
        AdminUpdateUserPermissionsApiArg
      >({
        query: (queryArg) => ({
          url: `/admin/users/${queryArg.userId}/permissions`,
          method: 'PUT',
          body: queryArg.adminUpdateUserPermissionsForm,
        }),
        invalidatesTags: ['admin_users'],
      }),
      getUserQuota: build.query<GetUserQuotaApiResponse, GetUserQuotaApiArg>({
        query: (queryArg) => ({ url: `/admin/users/${queryArg.userId}/quotas` }),
        providesTags: ['quota', 'admin_users'],
      }),
      updateUserQuota: build.mutation<UpdateUserQuotaApiResponse, UpdateUserQuotaApiArg>({
        query: (queryArg) => ({
          url: `/admin/users/${queryArg.userId}/quotas/${queryArg.quotaTarget}`,
          method: 'PUT',
          body: queryArg.updateQuotaCmd,
        }),
        invalidatesTags: ['quota', 'admin_users'],
      }),
      adminRevokeUserAuthToken: build.mutation<AdminRevokeUserAuthTokenApiResponse, AdminRevokeUserAuthTokenApiArg>({
        query: (queryArg) => ({
          url: `/admin/users/${queryArg.userId}/revoke-auth-token`,
          method: 'POST',
          body: queryArg.revokeAuthTokenCmd,
        }),
        invalidatesTags: ['admin_users'],
      }),
      getAnnotations: build.query<GetAnnotationsApiResponse, GetAnnotationsApiArg>({
        query: (queryArg) => ({
          url: `/annotations`,
          params: {
            from: queryArg['from'],
            to: queryArg.to,
            userId: queryArg.userId,
            alertId: queryArg.alertId,
            alertUID: queryArg.alertUid,
            dashboardId: queryArg.dashboardId,
            dashboardUID: queryArg.dashboardUid,
            panelId: queryArg.panelId,
            limit: queryArg.limit,
            tags: queryArg.tags,
            type: queryArg['type'],
            matchAny: queryArg.matchAny,
          },
        }),
        providesTags: ['annotations'],
      }),
      postAnnotation: build.mutation<PostAnnotationApiResponse, PostAnnotationApiArg>({
        query: (queryArg) => ({ url: `/annotations`, method: 'POST', body: queryArg.postAnnotationsCmd }),
        invalidatesTags: ['annotations'],
      }),
      postGraphiteAnnotation: build.mutation<PostGraphiteAnnotationApiResponse, PostGraphiteAnnotationApiArg>({
        query: (queryArg) => ({
          url: `/annotations/graphite`,
          method: 'POST',
          body: queryArg.postGraphiteAnnotationsCmd,
        }),
        invalidatesTags: ['annotations'],
      }),
      massDeleteAnnotations: build.mutation<MassDeleteAnnotationsApiResponse, MassDeleteAnnotationsApiArg>({
        query: (queryArg) => ({
          url: `/annotations/mass-delete`,
          method: 'POST',
          body: queryArg.massDeleteAnnotationsCmd,
        }),
        invalidatesTags: ['annotations'],
      }),
      getAnnotationTags: build.query<GetAnnotationTagsApiResponse, GetAnnotationTagsApiArg>({
        query: (queryArg) => ({
          url: `/annotations/tags`,
          params: {
            tag: queryArg.tag,
            limit: queryArg.limit,
          },
        }),
        providesTags: ['annotations'],
      }),
      deleteAnnotationById: build.mutation<DeleteAnnotationByIdApiResponse, DeleteAnnotationByIdApiArg>({
        query: (queryArg) => ({ url: `/annotations/${queryArg.annotationId}`, method: 'DELETE' }),
        invalidatesTags: ['annotations'],
      }),
      getAnnotationById: build.query<GetAnnotationByIdApiResponse, GetAnnotationByIdApiArg>({
        query: (queryArg) => ({ url: `/annotations/${queryArg.annotationId}` }),
        providesTags: ['annotations'],
      }),
      patchAnnotation: build.mutation<PatchAnnotationApiResponse, PatchAnnotationApiArg>({
        query: (queryArg) => ({
          url: `/annotations/${queryArg.annotationId}`,
          method: 'PATCH',
          body: queryArg.patchAnnotationsCmd,
        }),
        invalidatesTags: ['annotations'],
      }),
      updateAnnotation: build.mutation<UpdateAnnotationApiResponse, UpdateAnnotationApiArg>({
        query: (queryArg) => ({
          url: `/annotations/${queryArg.annotationId}`,
          method: 'PUT',
          body: queryArg.updateAnnotationsCmd,
        }),
        invalidatesTags: ['annotations'],
      }),
      listDevices: build.query<ListDevicesApiResponse, ListDevicesApiArg>({
        query: () => ({ url: `/anonymous/devices` }),
        providesTags: ['devices'],
      }),
      searchDevices: build.query<SearchDevicesApiResponse, SearchDevicesApiArg>({
        query: () => ({ url: `/anonymous/search` }),
        providesTags: ['devices'],
      }),
      getSessionList: build.query<GetSessionListApiResponse, GetSessionListApiArg>({
        query: () => ({ url: `/cloudmigration/migration` }),
        providesTags: ['migrations'],
      }),
      createSession: build.mutation<CreateSessionApiResponse, CreateSessionApiArg>({
        query: (queryArg) => ({
          url: `/cloudmigration/migration`,
          method: 'POST',
          body: queryArg.cloudMigrationSessionRequestDto,
        }),
        invalidatesTags: ['migrations'],
      }),
      deleteSession: build.mutation<DeleteSessionApiResponse, DeleteSessionApiArg>({
        query: (queryArg) => ({ url: `/cloudmigration/migration/${queryArg.uid}`, method: 'DELETE' }),
        invalidatesTags: ['migrations'],
      }),
      getSession: build.query<GetSessionApiResponse, GetSessionApiArg>({
        query: (queryArg) => ({ url: `/cloudmigration/migration/${queryArg.uid}` }),
        providesTags: ['migrations'],
      }),
      createSnapshot: build.mutation<CreateSnapshotApiResponse, CreateSnapshotApiArg>({
        query: (queryArg) => ({
          url: `/cloudmigration/migration/${queryArg.uid}/snapshot`,
          method: 'POST',
          body: queryArg.createSnapshotRequestDto,
        }),
        invalidatesTags: ['migrations'],
      }),
      getSnapshot: build.query<GetSnapshotApiResponse, GetSnapshotApiArg>({
        query: (queryArg) => ({
          url: `/cloudmigration/migration/${queryArg.uid}/snapshot/${queryArg.snapshotUid}`,
          params: {
            resultPage: queryArg.resultPage,
            resultLimit: queryArg.resultLimit,
            resultSortColumn: queryArg.resultSortColumn,
            resultSortOrder: queryArg.resultSortOrder,
            errorsOnly: queryArg.errorsOnly,
          },
        }),
        providesTags: ['migrations'],
      }),
      cancelSnapshot: build.mutation<CancelSnapshotApiResponse, CancelSnapshotApiArg>({
        query: (queryArg) => ({
          url: `/cloudmigration/migration/${queryArg.uid}/snapshot/${queryArg.snapshotUid}/cancel`,
          method: 'POST',
        }),
        invalidatesTags: ['migrations'],
      }),
      uploadSnapshot: build.mutation<UploadSnapshotApiResponse, UploadSnapshotApiArg>({
        query: (queryArg) => ({
          url: `/cloudmigration/migration/${queryArg.uid}/snapshot/${queryArg.snapshotUid}/upload`,
          method: 'POST',
        }),
        invalidatesTags: ['migrations'],
      }),
      getShapshotList: build.query<GetShapshotListApiResponse, GetShapshotListApiArg>({
        query: (queryArg) => ({
          url: `/cloudmigration/migration/${queryArg.uid}/snapshots`,
          params: {
            page: queryArg.page,
            limit: queryArg.limit,
            sort: queryArg.sort,
          },
        }),
        providesTags: ['migrations'],
      }),
      getResourceDependencies: build.query<GetResourceDependenciesApiResponse, GetResourceDependenciesApiArg>({
        query: () => ({ url: `/cloudmigration/resources/dependencies` }),
        providesTags: ['migrations'],
      }),
      getCloudMigrationToken: build.query<GetCloudMigrationTokenApiResponse, GetCloudMigrationTokenApiArg>({
        query: () => ({ url: `/cloudmigration/token` }),
        providesTags: ['migrations'],
      }),
      createCloudMigrationToken: build.mutation<CreateCloudMigrationTokenApiResponse, CreateCloudMigrationTokenApiArg>({
        query: () => ({ url: `/cloudmigration/token`, method: 'POST' }),
        invalidatesTags: ['migrations'],
      }),
      deleteCloudMigrationToken: build.mutation<DeleteCloudMigrationTokenApiResponse, DeleteCloudMigrationTokenApiArg>({
        query: (queryArg) => ({ url: `/cloudmigration/token/${queryArg.uid}`, method: 'DELETE' }),
        invalidatesTags: ['migrations'],
      }),
      routeConvertPrometheusCortexGetRules: build.query<
        RouteConvertPrometheusCortexGetRulesApiResponse,
        RouteConvertPrometheusCortexGetRulesApiArg
      >({
        query: () => ({ url: `/convert/api/prom/rules` }),
        providesTags: ['convert_prometheus'],
      }),
      routeConvertPrometheusCortexPostRuleGroups: build.mutation<
        RouteConvertPrometheusCortexPostRuleGroupsApiResponse,
        RouteConvertPrometheusCortexPostRuleGroupsApiArg
      >({
        query: () => ({ url: `/convert/api/prom/rules`, method: 'POST' }),
        invalidatesTags: ['convert_prometheus'],
      }),
      routeConvertPrometheusCortexDeleteNamespace: build.mutation<
        RouteConvertPrometheusCortexDeleteNamespaceApiResponse,
        RouteConvertPrometheusCortexDeleteNamespaceApiArg
      >({
        query: (queryArg) => ({ url: `/convert/api/prom/rules/${queryArg.namespaceTitle}`, method: 'DELETE' }),
        invalidatesTags: ['convert_prometheus'],
      }),
      routeConvertPrometheusCortexGetNamespace: build.query<
        RouteConvertPrometheusCortexGetNamespaceApiResponse,
        RouteConvertPrometheusCortexGetNamespaceApiArg
      >({
        query: (queryArg) => ({ url: `/convert/api/prom/rules/${queryArg.namespaceTitle}` }),
        providesTags: ['convert_prometheus'],
      }),
      routeConvertPrometheusCortexPostRuleGroup: build.mutation<
        RouteConvertPrometheusCortexPostRuleGroupApiResponse,
        RouteConvertPrometheusCortexPostRuleGroupApiArg
      >({
        query: (queryArg) => ({
          url: `/convert/api/prom/rules/${queryArg.namespaceTitle}`,
          method: 'POST',
          body: queryArg.prometheusRuleGroup,
          headers: {
            'x-grafana-alerting-datasource-uid': queryArg['x-grafana-alerting-datasource-uid'],
            'x-grafana-alerting-recording-rules-paused': queryArg['x-grafana-alerting-recording-rules-paused'],
            'x-grafana-alerting-alert-rules-paused': queryArg['x-grafana-alerting-alert-rules-paused'],
            'x-grafana-alerting-target-datasource-uid': queryArg['x-grafana-alerting-target-datasource-uid'],
            'x-grafana-alerting-folder-uid': queryArg['x-grafana-alerting-folder-uid'],
            'x-grafana-alerting-notification-settings': queryArg['x-grafana-alerting-notification-settings'],
          },
        }),
        invalidatesTags: ['convert_prometheus'],
      }),
      routeConvertPrometheusCortexDeleteRuleGroup: build.mutation<
        RouteConvertPrometheusCortexDeleteRuleGroupApiResponse,
        RouteConvertPrometheusCortexDeleteRuleGroupApiArg
      >({
        query: (queryArg) => ({
          url: `/convert/api/prom/rules/${queryArg.namespaceTitle}/${queryArg.group}`,
          method: 'DELETE',
        }),
        invalidatesTags: ['convert_prometheus'],
      }),
      routeConvertPrometheusCortexGetRuleGroup: build.query<
        RouteConvertPrometheusCortexGetRuleGroupApiResponse,
        RouteConvertPrometheusCortexGetRuleGroupApiArg
      >({
        query: (queryArg) => ({ url: `/convert/api/prom/rules/${queryArg.namespaceTitle}/${queryArg.group}` }),
        providesTags: ['convert_prometheus'],
      }),
      routeConvertPrometheusGetRules: build.query<
        RouteConvertPrometheusGetRulesApiResponse,
        RouteConvertPrometheusGetRulesApiArg
      >({
        query: () => ({ url: `/convert/prometheus/config/v1/rules` }),
        providesTags: ['convert_prometheus'],
      }),
      routeConvertPrometheusPostRuleGroups: build.mutation<
        RouteConvertPrometheusPostRuleGroupsApiResponse,
        RouteConvertPrometheusPostRuleGroupsApiArg
      >({
        query: () => ({ url: `/convert/prometheus/config/v1/rules`, method: 'POST' }),
        invalidatesTags: ['convert_prometheus'],
      }),
      routeConvertPrometheusDeleteNamespace: build.mutation<
        RouteConvertPrometheusDeleteNamespaceApiResponse,
        RouteConvertPrometheusDeleteNamespaceApiArg
      >({
        query: (queryArg) => ({
          url: `/convert/prometheus/config/v1/rules/${queryArg.namespaceTitle}`,
          method: 'DELETE',
        }),
        invalidatesTags: ['convert_prometheus'],
      }),
      routeConvertPrometheusGetNamespace: build.query<
        RouteConvertPrometheusGetNamespaceApiResponse,
        RouteConvertPrometheusGetNamespaceApiArg
      >({
        query: (queryArg) => ({ url: `/convert/prometheus/config/v1/rules/${queryArg.namespaceTitle}` }),
        providesTags: ['convert_prometheus'],
      }),
      routeConvertPrometheusPostRuleGroup: build.mutation<
        RouteConvertPrometheusPostRuleGroupApiResponse,
        RouteConvertPrometheusPostRuleGroupApiArg
      >({
        query: (queryArg) => ({
          url: `/convert/prometheus/config/v1/rules/${queryArg.namespaceTitle}`,
          method: 'POST',
          body: queryArg.prometheusRuleGroup,
          headers: {
            'x-grafana-alerting-datasource-uid': queryArg['x-grafana-alerting-datasource-uid'],
            'x-grafana-alerting-recording-rules-paused': queryArg['x-grafana-alerting-recording-rules-paused'],
            'x-grafana-alerting-alert-rules-paused': queryArg['x-grafana-alerting-alert-rules-paused'],
            'x-grafana-alerting-target-datasource-uid': queryArg['x-grafana-alerting-target-datasource-uid'],
            'x-grafana-alerting-folder-uid': queryArg['x-grafana-alerting-folder-uid'],
            'x-grafana-alerting-notification-settings': queryArg['x-grafana-alerting-notification-settings'],
          },
        }),
        invalidatesTags: ['convert_prometheus'],
      }),
      routeConvertPrometheusDeleteRuleGroup: build.mutation<
        RouteConvertPrometheusDeleteRuleGroupApiResponse,
        RouteConvertPrometheusDeleteRuleGroupApiArg
      >({
        query: (queryArg) => ({
          url: `/convert/prometheus/config/v1/rules/${queryArg.namespaceTitle}/${queryArg.group}`,
          method: 'DELETE',
        }),
        invalidatesTags: ['convert_prometheus'],
      }),
      routeConvertPrometheusGetRuleGroup: build.query<
        RouteConvertPrometheusGetRuleGroupApiResponse,
        RouteConvertPrometheusGetRuleGroupApiArg
      >({
        query: (queryArg) => ({
          url: `/convert/prometheus/config/v1/rules/${queryArg.namespaceTitle}/${queryArg.group}`,
        }),
        providesTags: ['convert_prometheus'],
      }),
      searchDashboardSnapshots: build.query<SearchDashboardSnapshotsApiResponse, SearchDashboardSnapshotsApiArg>({
        query: (queryArg) => ({
          url: `/dashboard/snapshots`,
          params: {
            query: queryArg.query,
            limit: queryArg.limit,
          },
        }),
        providesTags: ['dashboards', 'snapshots'],
      }),
      postDashboard: build.mutation<PostDashboardApiResponse, PostDashboardApiArg>({
        query: (queryArg) => ({ url: `/dashboards/db`, method: 'POST', body: queryArg.saveDashboardCommand }),
        invalidatesTags: ['dashboards'],
      }),
      importDashboard: build.mutation<ImportDashboardApiResponse, ImportDashboardApiArg>({
        query: (queryArg) => ({ url: `/dashboards/import`, method: 'POST', body: queryArg.importDashboardRequest }),
        invalidatesTags: ['dashboards'],
      }),
      interpolateDashboard: build.mutation<InterpolateDashboardApiResponse, InterpolateDashboardApiArg>({
        query: () => ({ url: `/dashboards/interpolate`, method: 'POST' }),
        invalidatesTags: ['dashboards'],
      }),
      listPublicDashboards: build.query<ListPublicDashboardsApiResponse, ListPublicDashboardsApiArg>({
        query: () => ({ url: `/dashboards/public-dashboards` }),
        providesTags: ['dashboards', 'dashboard_public'],
      }),
      getDashboardTags: build.query<GetDashboardTagsApiResponse, GetDashboardTagsApiArg>({
        query: () => ({ url: `/dashboards/tags` }),
        providesTags: ['dashboards'],
      }),
      getPublicDashboard: build.query<GetPublicDashboardApiResponse, GetPublicDashboardApiArg>({
        query: (queryArg) => ({ url: `/dashboards/uid/${queryArg.dashboardUid}/public-dashboards` }),
        providesTags: ['dashboards', 'dashboard_public'],
      }),
      createPublicDashboard: build.mutation<CreatePublicDashboardApiResponse, CreatePublicDashboardApiArg>({
        query: (queryArg) => ({
          url: `/dashboards/uid/${queryArg.dashboardUid}/public-dashboards`,
          method: 'POST',
          body: queryArg.publicDashboardDto,
        }),
        invalidatesTags: ['dashboards', 'dashboard_public'],
      }),
      deletePublicDashboard: build.mutation<DeletePublicDashboardApiResponse, DeletePublicDashboardApiArg>({
        query: (queryArg) => ({
          url: `/dashboards/uid/${queryArg.dashboardUid}/public-dashboards/${queryArg.uid}`,
          method: 'DELETE',
        }),
        invalidatesTags: ['dashboards', 'dashboard_public'],
      }),
      updatePublicDashboard: build.mutation<UpdatePublicDashboardApiResponse, UpdatePublicDashboardApiArg>({
        query: (queryArg) => ({
          url: `/dashboards/uid/${queryArg.dashboardUid}/public-dashboards/${queryArg.uid}`,
          method: 'PATCH',
          body: queryArg.publicDashboardDto,
        }),
        invalidatesTags: ['dashboards', 'dashboard_public'],
      }),
      deleteDashboardByUid: build.mutation<DeleteDashboardByUidApiResponse, DeleteDashboardByUidApiArg>({
        query: (queryArg) => ({ url: `/dashboards/uid/${queryArg.uid}`, method: 'DELETE' }),
        invalidatesTags: ['dashboards'],
      }),
      getDashboardByUid: build.query<GetDashboardByUidApiResponse, GetDashboardByUidApiArg>({
        query: (queryArg) => ({ url: `/dashboards/uid/${queryArg.uid}` }),
        providesTags: ['dashboards'],
      }),
      getDashboardPermissionsListByUid: build.query<
        GetDashboardPermissionsListByUidApiResponse,
        GetDashboardPermissionsListByUidApiArg
      >({
        query: (queryArg) => ({ url: `/dashboards/uid/${queryArg.uid}/permissions` }),
        providesTags: ['dashboards', 'permissions'],
      }),
      updateDashboardPermissionsByUid: build.mutation<
        UpdateDashboardPermissionsByUidApiResponse,
        UpdateDashboardPermissionsByUidApiArg
      >({
        query: (queryArg) => ({
          url: `/dashboards/uid/${queryArg.uid}/permissions`,
          method: 'POST',
          body: queryArg.updateDashboardAclCommand,
        }),
        invalidatesTags: ['dashboards', 'permissions'],
      }),
      getDashboardVersionsByUid: build.query<GetDashboardVersionsByUidApiResponse, GetDashboardVersionsByUidApiArg>({
        query: (queryArg) => ({
          url: `/dashboards/uid/${queryArg.uid}/versions`,
          params: {
            limit: queryArg.limit,
            start: queryArg.start,
          },
        }),
        providesTags: ['dashboards', 'versions'],
      }),
      getDashboardVersionByUid: build.query<GetDashboardVersionByUidApiResponse, GetDashboardVersionByUidApiArg>({
        query: (queryArg) => ({ url: `/dashboards/uid/${queryArg.uid}/versions/${queryArg.dashboardVersionId}` }),
        providesTags: ['dashboards', 'versions'],
      }),
      getDataSources: build.query<GetDataSourcesApiResponse, GetDataSourcesApiArg>({
        query: () => ({ url: `/datasources` }),
        providesTags: ['datasources'],
      }),
      addDataSource: build.mutation<AddDataSourceApiResponse, AddDataSourceApiArg>({
        query: (queryArg) => ({ url: `/datasources`, method: 'POST', body: queryArg.addDataSourceCommand }),
        invalidatesTags: ['datasources'],
      }),
      getCorrelations: build.query<GetCorrelationsApiResponse, GetCorrelationsApiArg>({
        query: (queryArg) => ({
          url: `/datasources/correlations`,
          params: {
            limit: queryArg.limit,
            page: queryArg.page,
            sourceUID: queryArg.sourceUid,
          },
        }),
        providesTags: ['datasources', 'correlations'],
      }),
      datasourceProxyDeleteByUiDcalls: build.mutation<
        DatasourceProxyDeleteByUiDcallsApiResponse,
        DatasourceProxyDeleteByUiDcallsApiArg
      >({
        query: (queryArg) => ({
          url: `/datasources/proxy/uid/${queryArg.uid}/${queryArg.datasourceProxyRoute}`,
          method: 'DELETE',
        }),
        invalidatesTags: ['datasources'],
      }),
      datasourceProxyGetByUiDcalls: build.query<
        DatasourceProxyGetByUiDcallsApiResponse,
        DatasourceProxyGetByUiDcallsApiArg
      >({
        query: (queryArg) => ({ url: `/datasources/proxy/uid/${queryArg.uid}/${queryArg.datasourceProxyRoute}` }),
        providesTags: ['datasources'],
      }),
      datasourceProxyPostByUiDcalls: build.mutation<
        DatasourceProxyPostByUiDcallsApiResponse,
        DatasourceProxyPostByUiDcallsApiArg
      >({
        query: (queryArg) => ({
          url: `/datasources/proxy/uid/${queryArg.uid}/${queryArg.datasourceProxyRoute}`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['datasources'],
      }),
      getCorrelationsBySourceUid: build.query<GetCorrelationsBySourceUidApiResponse, GetCorrelationsBySourceUidApiArg>({
        query: (queryArg) => ({ url: `/datasources/uid/${queryArg.sourceUid}/correlations` }),
        providesTags: ['datasources', 'correlations'],
      }),
      createCorrelation: build.mutation<CreateCorrelationApiResponse, CreateCorrelationApiArg>({
        query: (queryArg) => ({
          url: `/datasources/uid/${queryArg.sourceUid}/correlations`,
          method: 'POST',
          body: queryArg.createCorrelationCommand,
        }),
        invalidatesTags: ['datasources', 'correlations'],
      }),
      getCorrelation: build.query<GetCorrelationApiResponse, GetCorrelationApiArg>({
        query: (queryArg) => ({
          url: `/datasources/uid/${queryArg.sourceUid}/correlations/${queryArg.correlationUid}`,
        }),
        providesTags: ['datasources', 'correlations'],
      }),
      updateCorrelation: build.mutation<UpdateCorrelationApiResponse, UpdateCorrelationApiArg>({
        query: (queryArg) => ({
          url: `/datasources/uid/${queryArg.sourceUid}/correlations/${queryArg.correlationUid}`,
          method: 'PATCH',
          body: queryArg.updateCorrelationCommand,
        }),
        invalidatesTags: ['datasources', 'correlations'],
      }),
      deleteDataSourceByUid: build.mutation<DeleteDataSourceByUidApiResponse, DeleteDataSourceByUidApiArg>({
        query: (queryArg) => ({ url: `/datasources/uid/${queryArg.uid}`, method: 'DELETE' }),
        invalidatesTags: ['datasources'],
      }),
      getDataSourceByUid: build.query<GetDataSourceByUidApiResponse, GetDataSourceByUidApiArg>({
        query: (queryArg) => ({ url: `/datasources/uid/${queryArg.uid}` }),
        providesTags: ['datasources'],
      }),
      updateDataSourceByUid: build.mutation<UpdateDataSourceByUidApiResponse, UpdateDataSourceByUidApiArg>({
        query: (queryArg) => ({
          url: `/datasources/uid/${queryArg.uid}`,
          method: 'PUT',
          body: queryArg.updateDataSourceCommand,
        }),
        invalidatesTags: ['datasources'],
      }),
      deleteCorrelation: build.mutation<DeleteCorrelationApiResponse, DeleteCorrelationApiArg>({
        query: (queryArg) => ({
          url: `/datasources/uid/${queryArg.uid}/correlations/${queryArg.correlationUid}`,
          method: 'DELETE',
        }),
        invalidatesTags: ['datasources', 'correlations'],
      }),
      checkDatasourceHealthWithUid: build.query<
        CheckDatasourceHealthWithUidApiResponse,
        CheckDatasourceHealthWithUidApiArg
      >({
        query: (queryArg) => ({ url: `/datasources/uid/${queryArg.uid}/health` }),
        providesTags: ['datasources', 'health'],
      }),
      getTeamLbacRulesApi: build.query<GetTeamLbacRulesApiApiResponse, GetTeamLbacRulesApiApiArg>({
        query: (queryArg) => ({ url: `/datasources/uid/${queryArg.uid}/lbac/teams` }),
        providesTags: ['enterprise'],
      }),
      updateTeamLbacRulesApi: build.mutation<UpdateTeamLbacRulesApiApiResponse, UpdateTeamLbacRulesApiApiArg>({
        query: (queryArg) => ({
          url: `/datasources/uid/${queryArg.uid}/lbac/teams`,
          method: 'PUT',
          body: queryArg.updateTeamLbacCommand,
        }),
        invalidatesTags: ['enterprise'],
      }),
      callDatasourceResourceWithUid: build.query<
        CallDatasourceResourceWithUidApiResponse,
        CallDatasourceResourceWithUidApiArg
      >({
        query: (queryArg) => ({ url: `/datasources/uid/${queryArg.uid}/resources/${queryArg.datasourceProxyRoute}` }),
        providesTags: ['datasources'],
      }),
      getDataSourceCacheConfig: build.query<GetDataSourceCacheConfigApiResponse, GetDataSourceCacheConfigApiArg>({
        query: (queryArg) => ({
          url: `/datasources/${queryArg.dataSourceUid}/cache`,
          params: {
            dataSourceType: queryArg.dataSourceType,
          },
        }),
        providesTags: ['enterprise'],
      }),
      setDataSourceCacheConfig: build.mutation<SetDataSourceCacheConfigApiResponse, SetDataSourceCacheConfigApiArg>({
        query: (queryArg) => ({
          url: `/datasources/${queryArg.dataSourceUid}/cache`,
          method: 'POST',
          body: queryArg.cacheConfigSetter,
          params: {
            dataSourceType: queryArg.dataSourceType,
          },
        }),
        invalidatesTags: ['enterprise'],
      }),
      cleanDataSourceCache: build.mutation<CleanDataSourceCacheApiResponse, CleanDataSourceCacheApiArg>({
        query: (queryArg) => ({ url: `/datasources/${queryArg.dataSourceUid}/cache/clean`, method: 'POST' }),
        invalidatesTags: ['enterprise'],
      }),
      disableDataSourceCache: build.mutation<DisableDataSourceCacheApiResponse, DisableDataSourceCacheApiArg>({
        query: (queryArg) => ({
          url: `/datasources/${queryArg.dataSourceUid}/cache/disable`,
          method: 'POST',
          params: {
            dataSourceType: queryArg.dataSourceType,
          },
        }),
        invalidatesTags: ['enterprise'],
      }),
      enableDataSourceCache: build.mutation<EnableDataSourceCacheApiResponse, EnableDataSourceCacheApiArg>({
        query: (queryArg) => ({
          url: `/datasources/${queryArg.dataSourceUid}/cache/enable`,
          method: 'POST',
          params: {
            dataSourceType: queryArg.dataSourceType,
          },
        }),
        invalidatesTags: ['enterprise'],
      }),
      queryMetricsWithExpressions: build.mutation<
        QueryMetricsWithExpressionsApiResponse,
        QueryMetricsWithExpressionsApiArg
      >({
        query: (queryArg) => ({ url: `/ds/query`, method: 'POST', body: queryArg.metricRequest }),
        invalidatesTags: ['datasources'],
      }),
      getFolders: build.query<GetFoldersApiResponse, GetFoldersApiArg>({
        query: (queryArg) => ({
          url: `/folders`,
          params: {
            limit: queryArg.limit,
            page: queryArg.page,
            parentUid: queryArg.parentUid,
            permission: queryArg.permission,
          },
        }),
        providesTags: ['folders'],
      }),
      createFolder: build.mutation<CreateFolderApiResponse, CreateFolderApiArg>({
        query: (queryArg) => ({ url: `/folders`, method: 'POST', body: queryArg.createFolderCommand }),
        invalidatesTags: ['folders'],
      }),
      deleteFolder: build.mutation<DeleteFolderApiResponse, DeleteFolderApiArg>({
        query: (queryArg) => ({
          url: `/folders/${queryArg.folderUid}`,
          method: 'DELETE',
          params: {
            forceDeleteRules: queryArg.forceDeleteRules,
          },
        }),
        invalidatesTags: ['folders'],
      }),
      getFolderByUid: build.query<GetFolderByUidApiResponse, GetFolderByUidApiArg>({
        query: (queryArg) => ({ url: `/folders/${queryArg.folderUid}` }),
        providesTags: ['folders'],
      }),
      updateFolder: build.mutation<UpdateFolderApiResponse, UpdateFolderApiArg>({
        query: (queryArg) => ({
          url: `/folders/${queryArg.folderUid}`,
          method: 'PUT',
          body: queryArg.updateFolderCommand,
        }),
        invalidatesTags: ['folders'],
      }),
      getFolderDescendantCounts: build.query<GetFolderDescendantCountsApiResponse, GetFolderDescendantCountsApiArg>({
        query: (queryArg) => ({ url: `/folders/${queryArg.folderUid}/counts` }),
        providesTags: ['folders'],
      }),
      moveFolder: build.mutation<MoveFolderApiResponse, MoveFolderApiArg>({
        query: (queryArg) => ({
          url: `/folders/${queryArg.folderUid}/move`,
          method: 'POST',
          body: queryArg.moveFolderCommand,
        }),
        invalidatesTags: ['folders'],
      }),
      getFolderPermissionList: build.query<GetFolderPermissionListApiResponse, GetFolderPermissionListApiArg>({
        query: (queryArg) => ({ url: `/folders/${queryArg.folderUid}/permissions` }),
        providesTags: ['folders', 'permissions'],
      }),
      updateFolderPermissions: build.mutation<UpdateFolderPermissionsApiResponse, UpdateFolderPermissionsApiArg>({
        query: (queryArg) => ({
          url: `/folders/${queryArg.folderUid}/permissions`,
          method: 'POST',
          body: queryArg.updateDashboardAclCommand,
        }),
        invalidatesTags: ['folders', 'permissions'],
      }),
      getMappedGroups: build.query<GetMappedGroupsApiResponse, GetMappedGroupsApiArg>({
        query: () => ({ url: `/groupsync/groups` }),
        providesTags: ['group_attribute_sync', 'enterprise'],
      }),
      deleteGroupMappings: build.mutation<DeleteGroupMappingsApiResponse, DeleteGroupMappingsApiArg>({
        query: (queryArg) => ({ url: `/groupsync/groups/${queryArg.groupId}`, method: 'DELETE' }),
        invalidatesTags: ['group_attribute_sync', 'enterprise'],
      }),
      createGroupMappings: build.mutation<CreateGroupMappingsApiResponse, CreateGroupMappingsApiArg>({
        query: (queryArg) => ({
          url: `/groupsync/groups/${queryArg.groupId}`,
          method: 'POST',
          body: queryArg.groupAttributes,
        }),
        invalidatesTags: ['group_attribute_sync', 'enterprise'],
      }),
      updateGroupMappings: build.mutation<UpdateGroupMappingsApiResponse, UpdateGroupMappingsApiArg>({
        query: (queryArg) => ({
          url: `/groupsync/groups/${queryArg.groupId}`,
          method: 'PUT',
          body: queryArg.groupAttributes,
        }),
        invalidatesTags: ['group_attribute_sync', 'enterprise'],
      }),
      getGroupRoles: build.query<GetGroupRolesApiResponse, GetGroupRolesApiArg>({
        query: (queryArg) => ({ url: `/groupsync/groups/${queryArg.groupId}/roles` }),
        providesTags: ['group_attribute_sync', 'enterprise'],
      }),
      getHealth: build.query<GetHealthApiResponse, GetHealthApiArg>({
        query: () => ({ url: `/health` }),
        providesTags: ['health'],
      }),
      getLibraryElements: build.query<GetLibraryElementsApiResponse, GetLibraryElementsApiArg>({
        query: (queryArg) => ({
          url: `/library-elements`,
          params: {
            searchString: queryArg.searchString,
            kind: queryArg.kind,
            sortDirection: queryArg.sortDirection,
            typeFilter: queryArg.typeFilter,
            excludeUid: queryArg.excludeUid,
            folderFilter: queryArg.folderFilter,
            folderFilterUIDs: queryArg.folderFilterUiDs,
            perPage: queryArg.perPage,
            page: queryArg.page,
          },
        }),
        providesTags: ['library_elements'],
      }),
      createLibraryElement: build.mutation<CreateLibraryElementApiResponse, CreateLibraryElementApiArg>({
        query: (queryArg) => ({ url: `/library-elements`, method: 'POST', body: queryArg.createLibraryElementCommand }),
        invalidatesTags: ['library_elements'],
      }),
      getLibraryElementByName: build.query<GetLibraryElementByNameApiResponse, GetLibraryElementByNameApiArg>({
        query: (queryArg) => ({ url: `/library-elements/name/${queryArg.libraryElementName}` }),
        providesTags: ['library_elements'],
      }),
      deleteLibraryElementByUid: build.mutation<DeleteLibraryElementByUidApiResponse, DeleteLibraryElementByUidApiArg>({
        query: (queryArg) => ({ url: `/library-elements/${queryArg.libraryElementUid}`, method: 'DELETE' }),
        invalidatesTags: ['library_elements'],
      }),
      getLibraryElementByUid: build.query<GetLibraryElementByUidApiResponse, GetLibraryElementByUidApiArg>({
        query: (queryArg) => ({ url: `/library-elements/${queryArg.libraryElementUid}` }),
        providesTags: ['library_elements'],
      }),
      updateLibraryElement: build.mutation<UpdateLibraryElementApiResponse, UpdateLibraryElementApiArg>({
        query: (queryArg) => ({
          url: `/library-elements/${queryArg.libraryElementUid}`,
          method: 'PATCH',
          body: queryArg.patchLibraryElementCommand,
        }),
        invalidatesTags: ['library_elements'],
      }),
      getLibraryElementConnections: build.query<
        GetLibraryElementConnectionsApiResponse,
        GetLibraryElementConnectionsApiArg
      >({
        query: (queryArg) => ({ url: `/library-elements/${queryArg.libraryElementUid}/connections/` }),
        providesTags: ['library_elements'],
      }),
      getStatus: build.query<GetStatusApiResponse, GetStatusApiArg>({
        query: () => ({ url: `/licensing/check` }),
        providesTags: ['licensing', 'enterprise'],
      }),
      refreshLicenseStats: build.query<RefreshLicenseStatsApiResponse, RefreshLicenseStatsApiArg>({
        query: () => ({ url: `/licensing/refresh-stats` }),
        providesTags: ['licensing', 'enterprise'],
      }),
      deleteLicenseToken: build.mutation<DeleteLicenseTokenApiResponse, DeleteLicenseTokenApiArg>({
        query: (queryArg) => ({ url: `/licensing/token`, method: 'DELETE', body: queryArg.deleteTokenCommand }),
        invalidatesTags: ['licensing', 'enterprise'],
      }),
      getLicenseToken: build.query<GetLicenseTokenApiResponse, GetLicenseTokenApiArg>({
        query: () => ({ url: `/licensing/token` }),
        providesTags: ['licensing', 'enterprise'],
      }),
      postLicenseToken: build.mutation<PostLicenseTokenApiResponse, PostLicenseTokenApiArg>({
        query: (queryArg) => ({ url: `/licensing/token`, method: 'POST', body: queryArg.deleteTokenCommand }),
        invalidatesTags: ['licensing', 'enterprise'],
      }),
      postRenewLicenseToken: build.mutation<PostRenewLicenseTokenApiResponse, PostRenewLicenseTokenApiArg>({
        query: (queryArg) => ({ url: `/licensing/token/renew`, method: 'POST', body: queryArg.body }),
        invalidatesTags: ['licensing', 'enterprise'],
      }),
      getSamlLogout: build.query<GetSamlLogoutApiResponse, GetSamlLogoutApiArg>({
        query: () => ({ url: `/logout/saml` }),
        providesTags: ['saml', 'enterprise'],
      }),
      getCurrentOrg: build.query<GetCurrentOrgApiResponse, GetCurrentOrgApiArg>({
        query: () => ({ url: `/org` }),
        providesTags: ['org'],
      }),
      updateCurrentOrg: build.mutation<UpdateCurrentOrgApiResponse, UpdateCurrentOrgApiArg>({
        query: (queryArg) => ({ url: `/org`, method: 'PUT', body: queryArg.updateOrgForm }),
        invalidatesTags: ['org'],
      }),
      updateCurrentOrgAddress: build.mutation<UpdateCurrentOrgAddressApiResponse, UpdateCurrentOrgAddressApiArg>({
        query: (queryArg) => ({ url: `/org/address`, method: 'PUT', body: queryArg.updateOrgAddressForm }),
        invalidatesTags: ['org'],
      }),
      getPendingOrgInvites: build.query<GetPendingOrgInvitesApiResponse, GetPendingOrgInvitesApiArg>({
        query: () => ({ url: `/org/invites` }),
        providesTags: ['org', 'invites'],
      }),
      addOrgInvite: build.mutation<AddOrgInviteApiResponse, AddOrgInviteApiArg>({
        query: (queryArg) => ({ url: `/org/invites`, method: 'POST', body: queryArg.addInviteForm }),
        invalidatesTags: ['org', 'invites'],
      }),
      revokeInvite: build.mutation<RevokeInviteApiResponse, RevokeInviteApiArg>({
        query: (queryArg) => ({ url: `/org/invites/${queryArg.invitationCode}/revoke`, method: 'DELETE' }),
        invalidatesTags: ['org', 'invites'],
      }),
      getOrgPreferences: build.query<GetOrgPreferencesApiResponse, GetOrgPreferencesApiArg>({
        query: () => ({ url: `/org/preferences` }),
        providesTags: ['org', 'preferences'],
      }),
      patchOrgPreferences: build.mutation<PatchOrgPreferencesApiResponse, PatchOrgPreferencesApiArg>({
        query: (queryArg) => ({ url: `/org/preferences`, method: 'PATCH', body: queryArg.patchPrefsCmd }),
        invalidatesTags: ['org', 'preferences'],
      }),
      updateOrgPreferences: build.mutation<UpdateOrgPreferencesApiResponse, UpdateOrgPreferencesApiArg>({
        query: (queryArg) => ({ url: `/org/preferences`, method: 'PUT', body: queryArg.updatePrefsCmd }),
        invalidatesTags: ['org', 'preferences'],
      }),
      getCurrentOrgQuota: build.query<GetCurrentOrgQuotaApiResponse, GetCurrentOrgQuotaApiArg>({
        query: () => ({ url: `/org/quotas` }),
        providesTags: ['quota', 'org'],
      }),
      getOrgUsersForCurrentOrg: build.query<GetOrgUsersForCurrentOrgApiResponse, GetOrgUsersForCurrentOrgApiArg>({
        query: (queryArg) => ({
          url: `/org/users`,
          params: {
            query: queryArg.query,
            limit: queryArg.limit,
          },
        }),
        providesTags: ['org'],
      }),
      addOrgUserToCurrentOrg: build.mutation<AddOrgUserToCurrentOrgApiResponse, AddOrgUserToCurrentOrgApiArg>({
        query: (queryArg) => ({ url: `/org/users`, method: 'POST', body: queryArg.addOrgUserCommand }),
        invalidatesTags: ['org'],
      }),
      getOrgUsersForCurrentOrgLookup: build.query<
        GetOrgUsersForCurrentOrgLookupApiResponse,
        GetOrgUsersForCurrentOrgLookupApiArg
      >({
        query: (queryArg) => ({
          url: `/org/users/lookup`,
          params: {
            query: queryArg.query,
            limit: queryArg.limit,
          },
        }),
        providesTags: ['org'],
      }),
      removeOrgUserForCurrentOrg: build.mutation<
        RemoveOrgUserForCurrentOrgApiResponse,
        RemoveOrgUserForCurrentOrgApiArg
      >({
        query: (queryArg) => ({ url: `/org/users/${queryArg.userId}`, method: 'DELETE' }),
        invalidatesTags: ['org'],
      }),
      updateOrgUserForCurrentOrg: build.mutation<
        UpdateOrgUserForCurrentOrgApiResponse,
        UpdateOrgUserForCurrentOrgApiArg
      >({
        query: (queryArg) => ({
          url: `/org/users/${queryArg.userId}`,
          method: 'PATCH',
          body: queryArg.updateOrgUserCommand,
        }),
        invalidatesTags: ['org'],
      }),
      searchOrgs: build.query<SearchOrgsApiResponse, SearchOrgsApiArg>({
        query: (queryArg) => ({
          url: `/orgs`,
          params: {
            page: queryArg.page,
            perpage: queryArg.perpage,
            name: queryArg.name,
            query: queryArg.query,
          },
        }),
        providesTags: ['orgs'],
      }),
      createOrg: build.mutation<CreateOrgApiResponse, CreateOrgApiArg>({
        query: (queryArg) => ({ url: `/orgs`, method: 'POST', body: queryArg.createOrgCommand }),
        invalidatesTags: ['orgs'],
      }),
      getOrgByName: build.query<GetOrgByNameApiResponse, GetOrgByNameApiArg>({
        query: (queryArg) => ({ url: `/orgs/name/${queryArg.orgName}` }),
        providesTags: ['orgs'],
      }),
      deleteOrgById: build.mutation<DeleteOrgByIdApiResponse, DeleteOrgByIdApiArg>({
        query: (queryArg) => ({ url: `/orgs/${queryArg.orgId}`, method: 'DELETE' }),
        invalidatesTags: ['orgs'],
      }),
      getOrgById: build.query<GetOrgByIdApiResponse, GetOrgByIdApiArg>({
        query: (queryArg) => ({ url: `/orgs/${queryArg.orgId}` }),
        providesTags: ['orgs'],
      }),
      updateOrg: build.mutation<UpdateOrgApiResponse, UpdateOrgApiArg>({
        query: (queryArg) => ({ url: `/orgs/${queryArg.orgId}`, method: 'PUT', body: queryArg.updateOrgForm }),
        invalidatesTags: ['orgs'],
      }),
      updateOrgAddress: build.mutation<UpdateOrgAddressApiResponse, UpdateOrgAddressApiArg>({
        query: (queryArg) => ({
          url: `/orgs/${queryArg.orgId}/address`,
          method: 'PUT',
          body: queryArg.updateOrgAddressForm,
        }),
        invalidatesTags: ['orgs'],
      }),
      getOrgQuota: build.query<GetOrgQuotaApiResponse, GetOrgQuotaApiArg>({
        query: (queryArg) => ({ url: `/orgs/${queryArg.orgId}/quotas` }),
        providesTags: ['quota', 'orgs'],
      }),
      updateOrgQuota: build.mutation<UpdateOrgQuotaApiResponse, UpdateOrgQuotaApiArg>({
        query: (queryArg) => ({
          url: `/orgs/${queryArg.orgId}/quotas/${queryArg.quotaTarget}`,
          method: 'PUT',
          body: queryArg.updateQuotaCmd,
        }),
        invalidatesTags: ['quota', 'orgs'],
      }),
      getOrgUsers: build.query<GetOrgUsersApiResponse, GetOrgUsersApiArg>({
        query: (queryArg) => ({ url: `/orgs/${queryArg.orgId}/users` }),
        providesTags: ['orgs'],
      }),
      addOrgUser: build.mutation<AddOrgUserApiResponse, AddOrgUserApiArg>({
        query: (queryArg) => ({
          url: `/orgs/${queryArg.orgId}/users`,
          method: 'POST',
          body: queryArg.addOrgUserCommand,
        }),
        invalidatesTags: ['orgs'],
      }),
      searchOrgUsers: build.query<SearchOrgUsersApiResponse, SearchOrgUsersApiArg>({
        query: (queryArg) => ({ url: `/orgs/${queryArg.orgId}/users/search` }),
        providesTags: ['orgs'],
      }),
      removeOrgUser: build.mutation<RemoveOrgUserApiResponse, RemoveOrgUserApiArg>({
        query: (queryArg) => ({ url: `/orgs/${queryArg.orgId}/users/${queryArg.userId}`, method: 'DELETE' }),
        invalidatesTags: ['orgs'],
      }),
      updateOrgUser: build.mutation<UpdateOrgUserApiResponse, UpdateOrgUserApiArg>({
        query: (queryArg) => ({
          url: `/orgs/${queryArg.orgId}/users/${queryArg.userId}`,
          method: 'PATCH',
          body: queryArg.updateOrgUserCommand,
        }),
        invalidatesTags: ['orgs'],
      }),
      viewPublicDashboard: build.query<ViewPublicDashboardApiResponse, ViewPublicDashboardApiArg>({
        query: (queryArg) => ({ url: `/public/dashboards/${queryArg.accessToken}` }),
        providesTags: ['dashboards', 'dashboard_public'],
      }),
      getPublicAnnotations: build.query<GetPublicAnnotationsApiResponse, GetPublicAnnotationsApiArg>({
        query: (queryArg) => ({ url: `/public/dashboards/${queryArg.accessToken}/annotations` }),
        providesTags: ['dashboards', 'annotations', 'dashboard_public'],
      }),
      queryPublicDashboard: build.mutation<QueryPublicDashboardApiResponse, QueryPublicDashboardApiArg>({
        query: (queryArg) => ({
          url: `/public/dashboards/${queryArg.accessToken}/panels/${queryArg.panelId}/query`,
          method: 'POST',
        }),
        invalidatesTags: ['dashboards', 'dashboard_public'],
      }),
      searchQueries: build.query<SearchQueriesApiResponse, SearchQueriesApiArg>({
        query: (queryArg) => ({
          url: `/query-history`,
          params: {
            datasourceUid: queryArg.datasourceUid,
            searchString: queryArg.searchString,
            onlyStarred: queryArg.onlyStarred,
            sort: queryArg.sort,
            page: queryArg.page,
            limit: queryArg.limit,
            from: queryArg['from'],
            to: queryArg.to,
          },
        }),
        providesTags: ['query_history'],
      }),
      createQuery: build.mutation<CreateQueryApiResponse, CreateQueryApiArg>({
        query: (queryArg) => ({
          url: `/query-history`,
          method: 'POST',
          body: queryArg.createQueryInQueryHistoryCommand,
        }),
        invalidatesTags: ['query_history'],
      }),
      unstarQuery: build.mutation<UnstarQueryApiResponse, UnstarQueryApiArg>({
        query: (queryArg) => ({ url: `/query-history/star/${queryArg.queryHistoryUid}`, method: 'DELETE' }),
        invalidatesTags: ['query_history'],
      }),
      starQuery: build.mutation<StarQueryApiResponse, StarQueryApiArg>({
        query: (queryArg) => ({ url: `/query-history/star/${queryArg.queryHistoryUid}`, method: 'POST' }),
        invalidatesTags: ['query_history'],
      }),
      deleteQuery: build.mutation<DeleteQueryApiResponse, DeleteQueryApiArg>({
        query: (queryArg) => ({ url: `/query-history/${queryArg.queryHistoryUid}`, method: 'DELETE' }),
        invalidatesTags: ['query_history'],
      }),
      patchQueryComment: build.mutation<PatchQueryCommentApiResponse, PatchQueryCommentApiArg>({
        query: (queryArg) => ({
          url: `/query-history/${queryArg.queryHistoryUid}`,
          method: 'PATCH',
          body: queryArg.patchQueryCommentInQueryHistoryCommand,
        }),
        invalidatesTags: ['query_history'],
      }),
      listRecordingRules: build.query<ListRecordingRulesApiResponse, ListRecordingRulesApiArg>({
        query: () => ({ url: `/recording-rules` }),
        providesTags: ['recording_rules', 'enterprise'],
      }),
      createRecordingRule: build.mutation<CreateRecordingRuleApiResponse, CreateRecordingRuleApiArg>({
        query: (queryArg) => ({ url: `/recording-rules`, method: 'POST', body: queryArg.recordingRuleJson }),
        invalidatesTags: ['recording_rules', 'enterprise'],
      }),
      updateRecordingRule: build.mutation<UpdateRecordingRuleApiResponse, UpdateRecordingRuleApiArg>({
        query: (queryArg) => ({ url: `/recording-rules`, method: 'PUT', body: queryArg.recordingRuleJson }),
        invalidatesTags: ['recording_rules', 'enterprise'],
      }),
      testCreateRecordingRule: build.mutation<TestCreateRecordingRuleApiResponse, TestCreateRecordingRuleApiArg>({
        query: (queryArg) => ({ url: `/recording-rules/test`, method: 'POST', body: queryArg.recordingRuleJson }),
        invalidatesTags: ['recording_rules', 'enterprise'],
      }),
      deleteRecordingRuleWriteTarget: build.mutation<
        DeleteRecordingRuleWriteTargetApiResponse,
        DeleteRecordingRuleWriteTargetApiArg
      >({
        query: () => ({ url: `/recording-rules/writer`, method: 'DELETE' }),
        invalidatesTags: ['recording_rules', 'enterprise'],
      }),
      getRecordingRuleWriteTarget: build.query<
        GetRecordingRuleWriteTargetApiResponse,
        GetRecordingRuleWriteTargetApiArg
      >({
        query: () => ({ url: `/recording-rules/writer` }),
        providesTags: ['recording_rules', 'enterprise'],
      }),
      createRecordingRuleWriteTarget: build.mutation<
        CreateRecordingRuleWriteTargetApiResponse,
        CreateRecordingRuleWriteTargetApiArg
      >({
        query: (queryArg) => ({
          url: `/recording-rules/writer`,
          method: 'POST',
          body: queryArg.prometheusRemoteWriteTargetJson,
        }),
        invalidatesTags: ['recording_rules', 'enterprise'],
      }),
      deleteRecordingRule: build.mutation<DeleteRecordingRuleApiResponse, DeleteRecordingRuleApiArg>({
        query: (queryArg) => ({ url: `/recording-rules/${queryArg.recordingRuleId}`, method: 'DELETE' }),
        invalidatesTags: ['recording_rules', 'enterprise'],
      }),
      getReports: build.query<GetReportsApiResponse, GetReportsApiArg>({
        query: () => ({ url: `/reports` }),
        providesTags: ['reports', 'enterprise'],
      }),
      createReport: build.mutation<CreateReportApiResponse, CreateReportApiArg>({
        query: (queryArg) => ({ url: `/reports`, method: 'POST', body: queryArg.createOrUpdateReport }),
        invalidatesTags: ['reports', 'enterprise'],
      }),
      getReportsByDashboardUid: build.query<GetReportsByDashboardUidApiResponse, GetReportsByDashboardUidApiArg>({
        query: (queryArg) => ({ url: `/reports/dashboards/${queryArg.uid}` }),
        providesTags: ['reports', 'enterprise'],
      }),
      sendReport: build.mutation<SendReportApiResponse, SendReportApiArg>({
        query: (queryArg) => ({ url: `/reports/email`, method: 'POST', body: queryArg.reportEmail }),
        invalidatesTags: ['reports', 'enterprise'],
      }),
      getSettingsImage: build.query<GetSettingsImageApiResponse, GetSettingsImageApiArg>({
        query: () => ({ url: `/reports/images/:image` }),
        providesTags: ['reports', 'enterprise'],
      }),
      renderReportCsVs: build.query<RenderReportCsVsApiResponse, RenderReportCsVsApiArg>({
        query: (queryArg) => ({
          url: `/reports/render/csvs`,
          params: {
            dashboards: queryArg.dashboards,
            title: queryArg.title,
          },
        }),
        providesTags: ['reports', 'enterprise'],
      }),
      renderReportPdFs: build.query<RenderReportPdFsApiResponse, RenderReportPdFsApiArg>({
        query: (queryArg) => ({
          url: `/reports/render/pdfs`,
          params: {
            dashboards: queryArg.dashboards,
            orientation: queryArg.orientation,
            layout: queryArg.layout,
            title: queryArg.title,
            scaleFactor: queryArg.scaleFactor,
            includeTables: queryArg.includeTables,
          },
        }),
        providesTags: ['reports', 'enterprise'],
      }),
      getReportSettings: build.query<GetReportSettingsApiResponse, GetReportSettingsApiArg>({
        query: () => ({ url: `/reports/settings` }),
        providesTags: ['reports', 'enterprise'],
      }),
      saveReportSettings: build.mutation<SaveReportSettingsApiResponse, SaveReportSettingsApiArg>({
        query: (queryArg) => ({ url: `/reports/settings`, method: 'POST', body: queryArg.reportSettings }),
        invalidatesTags: ['reports', 'enterprise'],
      }),
      sendTestEmail: build.mutation<SendTestEmailApiResponse, SendTestEmailApiArg>({
        query: (queryArg) => ({ url: `/reports/test-email`, method: 'POST', body: queryArg.createOrUpdateReport }),
        invalidatesTags: ['reports', 'enterprise'],
      }),
      postAcs: build.mutation<PostAcsApiResponse, PostAcsApiArg>({
        query: (queryArg) => ({
          url: `/saml/acs`,
          method: 'POST',
          params: {
            RelayState: queryArg.relayState,
          },
        }),
        invalidatesTags: ['saml', 'enterprise'],
      }),
      getMetadata: build.query<GetMetadataApiResponse, GetMetadataApiArg>({
        query: () => ({ url: `/saml/metadata` }),
        providesTags: ['saml', 'enterprise'],
      }),
      getSlo: build.query<GetSloApiResponse, GetSloApiArg>({
        query: () => ({ url: `/saml/slo` }),
        providesTags: ['saml', 'enterprise'],
      }),
      postSlo: build.mutation<PostSloApiResponse, PostSloApiArg>({
        query: (queryArg) => ({
          url: `/saml/slo`,
          method: 'POST',
          params: {
            SAMLRequest: queryArg.samlRequest,
            SAMLResponse: queryArg.samlResponse,
          },
        }),
        invalidatesTags: ['saml', 'enterprise'],
      }),
      search: build.query<SearchApiResponse, SearchApiArg>({
        query: (queryArg) => ({
          url: `/search`,
          params: {
            query: queryArg.query,
            tag: queryArg.tag,
            type: queryArg['type'],
            dashboardIds: queryArg.dashboardIds,
            dashboardUIDs: queryArg.dashboardUiDs,
            folderIds: queryArg.folderIds,
            folderUIDs: queryArg.folderUiDs,
            starred: queryArg.starred,
            limit: queryArg.limit,
            page: queryArg.page,
            permission: queryArg.permission,
            sort: queryArg.sort,
            deleted: queryArg.deleted,
          },
        }),
        providesTags: ['search'],
      }),
      listSortOptions: build.query<ListSortOptionsApiResponse, ListSortOptionsApiArg>({
        query: () => ({ url: `/search/sorting` }),
        providesTags: ['search'],
      }),
      createServiceAccount: build.mutation<CreateServiceAccountApiResponse, CreateServiceAccountApiArg>({
        query: (queryArg) => ({ url: `/serviceaccounts`, method: 'POST', body: queryArg.createServiceAccountForm }),
        invalidatesTags: ['service_accounts'],
      }),
      searchOrgServiceAccountsWithPaging: build.query<
        SearchOrgServiceAccountsWithPagingApiResponse,
        SearchOrgServiceAccountsWithPagingApiArg
      >({
        query: (queryArg) => ({
          url: `/serviceaccounts/search`,
          params: {
            Disabled: queryArg.disabled,
            expiredTokens: queryArg.expiredTokens,
            query: queryArg.query,
            perpage: queryArg.perpage,
            page: queryArg.page,
          },
        }),
        providesTags: ['service_accounts'],
      }),
      deleteServiceAccount: build.mutation<DeleteServiceAccountApiResponse, DeleteServiceAccountApiArg>({
        query: (queryArg) => ({ url: `/serviceaccounts/${queryArg.serviceAccountId}`, method: 'DELETE' }),
        invalidatesTags: ['service_accounts'],
      }),
      retrieveServiceAccount: build.query<RetrieveServiceAccountApiResponse, RetrieveServiceAccountApiArg>({
        query: (queryArg) => ({ url: `/serviceaccounts/${queryArg.serviceAccountId}` }),
        providesTags: ['service_accounts'],
      }),
      updateServiceAccount: build.mutation<UpdateServiceAccountApiResponse, UpdateServiceAccountApiArg>({
        query: (queryArg) => ({
          url: `/serviceaccounts/${queryArg.serviceAccountId}`,
          method: 'PATCH',
          body: queryArg.updateServiceAccountForm,
        }),
        invalidatesTags: ['service_accounts'],
      }),
      listTokens: build.query<ListTokensApiResponse, ListTokensApiArg>({
        query: (queryArg) => ({ url: `/serviceaccounts/${queryArg.serviceAccountId}/tokens` }),
        providesTags: ['service_accounts'],
      }),
      createToken: build.mutation<CreateTokenApiResponse, CreateTokenApiArg>({
        query: (queryArg) => ({
          url: `/serviceaccounts/${queryArg.serviceAccountId}/tokens`,
          method: 'POST',
          body: queryArg.addServiceAccountTokenCommand,
        }),
        invalidatesTags: ['service_accounts'],
      }),
      deleteToken: build.mutation<DeleteTokenApiResponse, DeleteTokenApiArg>({
        query: (queryArg) => ({
          url: `/serviceaccounts/${queryArg.serviceAccountId}/tokens/${queryArg.tokenId}`,
          method: 'DELETE',
        }),
        invalidatesTags: ['service_accounts'],
      }),
      retrieveJwks: build.query<RetrieveJwksApiResponse, RetrieveJwksApiArg>({
        query: () => ({ url: `/signing-keys/keys` }),
        providesTags: ['signing_keys'],
      }),
      getSharingOptions: build.query<GetSharingOptionsApiResponse, GetSharingOptionsApiArg>({
        query: () => ({ url: `/snapshot/shared-options` }),
        providesTags: ['snapshots'],
      }),
      createDashboardSnapshot: build.mutation<CreateDashboardSnapshotApiResponse, CreateDashboardSnapshotApiArg>({
        query: (queryArg) => ({ url: `/snapshots`, method: 'POST', body: queryArg.createDashboardSnapshotCommand }),
        invalidatesTags: ['dashboards', 'snapshots'],
      }),
      deleteDashboardSnapshotByDeleteKey: build.query<
        DeleteDashboardSnapshotByDeleteKeyApiResponse,
        DeleteDashboardSnapshotByDeleteKeyApiArg
      >({
        query: (queryArg) => ({ url: `/snapshots-delete/${queryArg.deleteKey}` }),
        providesTags: ['dashboards', 'snapshots'],
      }),
      deleteDashboardSnapshot: build.mutation<DeleteDashboardSnapshotApiResponse, DeleteDashboardSnapshotApiArg>({
        query: (queryArg) => ({ url: `/snapshots/${queryArg.key}`, method: 'DELETE' }),
        invalidatesTags: ['dashboards', 'snapshots'],
      }),
      getDashboardSnapshot: build.query<GetDashboardSnapshotApiResponse, GetDashboardSnapshotApiArg>({
        query: (queryArg) => ({ url: `/snapshots/${queryArg.key}` }),
        providesTags: ['dashboards', 'snapshots'],
      }),
      createTeam: build.mutation<CreateTeamApiResponse, CreateTeamApiArg>({
        query: (queryArg) => ({ url: `/teams`, method: 'POST', body: queryArg.createTeamCommand }),
        invalidatesTags: ['teams'],
      }),
      searchTeams: build.query<SearchTeamsApiResponse, SearchTeamsApiArg>({
        query: (queryArg) => ({
          url: `/teams/search`,
          params: {
            page: queryArg.page,
            perpage: queryArg.perpage,
            name: queryArg.name,
            query: queryArg.query,
            accesscontrol: queryArg.accesscontrol,
            sort: queryArg.sort,
          },
        }),
        providesTags: ['teams'],
      }),
      removeTeamGroupApiQuery: build.mutation<RemoveTeamGroupApiQueryApiResponse, RemoveTeamGroupApiQueryApiArg>({
        query: (queryArg) => ({
          url: `/teams/${queryArg.teamId}/groups`,
          method: 'DELETE',
          params: {
            groupId: queryArg.groupId,
          },
        }),
        invalidatesTags: ['sync_team_groups', 'enterprise'],
      }),
      getTeamGroupsApi: build.query<GetTeamGroupsApiApiResponse, GetTeamGroupsApiApiArg>({
        query: (queryArg) => ({ url: `/teams/${queryArg.teamId}/groups` }),
        providesTags: ['sync_team_groups', 'enterprise'],
      }),
      addTeamGroupApi: build.mutation<AddTeamGroupApiApiResponse, AddTeamGroupApiApiArg>({
        query: (queryArg) => ({
          url: `/teams/${queryArg.teamId}/groups`,
          method: 'POST',
          body: queryArg.teamGroupMapping,
        }),
        invalidatesTags: ['sync_team_groups', 'enterprise'],
      }),
      searchTeamGroups: build.query<SearchTeamGroupsApiResponse, SearchTeamGroupsApiArg>({
        query: (queryArg) => ({
          url: `/teams/${queryArg.teamId}/groups/search`,
          params: {
            page: queryArg.page,
            perpage: queryArg.perpage,
            query: queryArg.query,
            name: queryArg.name,
          },
        }),
        providesTags: ['sync_team_groups', 'enterprise'],
      }),
      deleteTeamById: build.mutation<DeleteTeamByIdApiResponse, DeleteTeamByIdApiArg>({
        query: (queryArg) => ({ url: `/teams/${queryArg.teamId}`, method: 'DELETE' }),
        invalidatesTags: ['teams'],
      }),
      getTeamById: build.query<GetTeamByIdApiResponse, GetTeamByIdApiArg>({
        query: (queryArg) => ({
          url: `/teams/${queryArg.teamId}`,
          params: {
            accesscontrol: queryArg.accesscontrol,
          },
        }),
        providesTags: ['teams'],
      }),
      updateTeam: build.mutation<UpdateTeamApiResponse, UpdateTeamApiArg>({
        query: (queryArg) => ({ url: `/teams/${queryArg.teamId}`, method: 'PUT', body: queryArg.updateTeamCommand }),
        invalidatesTags: ['teams'],
      }),
      getTeamMembers: build.query<GetTeamMembersApiResponse, GetTeamMembersApiArg>({
        query: (queryArg) => ({ url: `/teams/${queryArg.teamId}/members` }),
        providesTags: ['teams'],
      }),
      addTeamMember: build.mutation<AddTeamMemberApiResponse, AddTeamMemberApiArg>({
        query: (queryArg) => ({
          url: `/teams/${queryArg.teamId}/members`,
          method: 'POST',
          body: queryArg.addTeamMemberCommand,
        }),
        invalidatesTags: ['teams'],
      }),
      setTeamMemberships: build.mutation<SetTeamMembershipsApiResponse, SetTeamMembershipsApiArg>({
        query: (queryArg) => ({
          url: `/teams/${queryArg.teamId}/members`,
          method: 'PUT',
          body: queryArg.setTeamMembershipsCommand,
        }),
        invalidatesTags: ['teams'],
      }),
      removeTeamMember: build.mutation<RemoveTeamMemberApiResponse, RemoveTeamMemberApiArg>({
        query: (queryArg) => ({ url: `/teams/${queryArg.teamId}/members/${queryArg.userId}`, method: 'DELETE' }),
        invalidatesTags: ['teams'],
      }),
      updateTeamMember: build.mutation<UpdateTeamMemberApiResponse, UpdateTeamMemberApiArg>({
        query: (queryArg) => ({
          url: `/teams/${queryArg.teamId}/members/${queryArg.userId}`,
          method: 'PUT',
          body: queryArg.updateTeamMemberCommand,
        }),
        invalidatesTags: ['teams'],
      }),
      getTeamPreferences: build.query<GetTeamPreferencesApiResponse, GetTeamPreferencesApiArg>({
        query: (queryArg) => ({ url: `/teams/${queryArg.teamId}/preferences` }),
        providesTags: ['teams', 'preferences'],
      }),
      updateTeamPreferences: build.mutation<UpdateTeamPreferencesApiResponse, UpdateTeamPreferencesApiArg>({
        query: (queryArg) => ({
          url: `/teams/${queryArg.teamId}/preferences`,
          method: 'PUT',
          body: queryArg.updatePrefsCmd,
        }),
        invalidatesTags: ['teams', 'preferences'],
      }),
      getSignedInUser: build.query<GetSignedInUserApiResponse, GetSignedInUserApiArg>({
        query: () => ({ url: `/user` }),
        providesTags: ['signed_in_user'],
      }),
      updateSignedInUser: build.mutation<UpdateSignedInUserApiResponse, UpdateSignedInUserApiArg>({
        query: (queryArg) => ({ url: `/user`, method: 'PUT', body: queryArg.updateUserCommand }),
        invalidatesTags: ['signed_in_user'],
      }),
      getUserAuthTokens: build.query<GetUserAuthTokensApiResponse, GetUserAuthTokensApiArg>({
        query: () => ({ url: `/user/auth-tokens` }),
        providesTags: ['signed_in_user'],
      }),
      updateUserEmail: build.query<UpdateUserEmailApiResponse, UpdateUserEmailApiArg>({
        query: () => ({ url: `/user/email/update` }),
        providesTags: ['user'],
      }),
      clearHelpFlags: build.query<ClearHelpFlagsApiResponse, ClearHelpFlagsApiArg>({
        query: () => ({ url: `/user/helpflags/clear` }),
        providesTags: ['signed_in_user'],
      }),
      setHelpFlag: build.mutation<SetHelpFlagApiResponse, SetHelpFlagApiArg>({
        query: (queryArg) => ({ url: `/user/helpflags/${queryArg.flagId}`, method: 'PUT' }),
        invalidatesTags: ['signed_in_user'],
      }),
      getSignedInUserOrgList: build.query<GetSignedInUserOrgListApiResponse, GetSignedInUserOrgListApiArg>({
        query: () => ({ url: `/user/orgs` }),
        providesTags: ['signed_in_user'],
      }),
      changeUserPassword: build.mutation<ChangeUserPasswordApiResponse, ChangeUserPasswordApiArg>({
        query: (queryArg) => ({ url: `/user/password`, method: 'PUT', body: queryArg.changeUserPasswordCommand }),
        invalidatesTags: ['signed_in_user'],
      }),
      getUserPreferences: build.query<GetUserPreferencesApiResponse, GetUserPreferencesApiArg>({
        query: () => ({ url: `/user/preferences` }),
        providesTags: ['signed_in_user', 'preferences'],
      }),
      patchUserPreferences: build.mutation<PatchUserPreferencesApiResponse, PatchUserPreferencesApiArg>({
        query: (queryArg) => ({ url: `/user/preferences`, method: 'PATCH', body: queryArg.patchPrefsCmd }),
        invalidatesTags: ['signed_in_user', 'preferences'],
      }),
      updateUserPreferences: build.mutation<UpdateUserPreferencesApiResponse, UpdateUserPreferencesApiArg>({
        query: (queryArg) => ({ url: `/user/preferences`, method: 'PUT', body: queryArg.updatePrefsCmd }),
        invalidatesTags: ['signed_in_user', 'preferences'],
      }),
      getUserQuotas: build.query<GetUserQuotasApiResponse, GetUserQuotasApiArg>({
        query: () => ({ url: `/user/quotas` }),
        providesTags: ['quota', 'signed_in_user'],
      }),
      revokeUserAuthToken: build.mutation<RevokeUserAuthTokenApiResponse, RevokeUserAuthTokenApiArg>({
        query: (queryArg) => ({ url: `/user/revoke-auth-token`, method: 'POST', body: queryArg.revokeAuthTokenCmd }),
        invalidatesTags: ['signed_in_user'],
      }),
      unstarDashboardByUid: build.mutation<UnstarDashboardByUidApiResponse, UnstarDashboardByUidApiArg>({
        query: (queryArg) => ({ url: `/user/stars/dashboard/uid/${queryArg.dashboardUid}`, method: 'DELETE' }),
        invalidatesTags: ['signed_in_user'],
      }),
      starDashboardByUid: build.mutation<StarDashboardByUidApiResponse, StarDashboardByUidApiArg>({
        query: (queryArg) => ({ url: `/user/stars/dashboard/uid/${queryArg.dashboardUid}`, method: 'POST' }),
        invalidatesTags: ['signed_in_user'],
      }),
      getSignedInUserTeamList: build.query<GetSignedInUserTeamListApiResponse, GetSignedInUserTeamListApiArg>({
        query: () => ({ url: `/user/teams` }),
        providesTags: ['signed_in_user'],
      }),
      userSetUsingOrg: build.mutation<UserSetUsingOrgApiResponse, UserSetUsingOrgApiArg>({
        query: (queryArg) => ({ url: `/user/using/${queryArg.orgId}`, method: 'POST' }),
        invalidatesTags: ['signed_in_user'],
      }),
      searchUsers: build.query<SearchUsersApiResponse, SearchUsersApiArg>({
        query: (queryArg) => ({
          url: `/users`,
          params: {
            perpage: queryArg.perpage,
            page: queryArg.page,
          },
        }),
        providesTags: ['users'],
      }),
      getUserByLoginOrEmail: build.query<GetUserByLoginOrEmailApiResponse, GetUserByLoginOrEmailApiArg>({
        query: (queryArg) => ({
          url: `/users/lookup`,
          params: {
            loginOrEmail: queryArg.loginOrEmail,
          },
        }),
        providesTags: ['users'],
      }),
      searchUsersWithPaging: build.query<SearchUsersWithPagingApiResponse, SearchUsersWithPagingApiArg>({
        query: () => ({ url: `/users/search` }),
        providesTags: ['users'],
      }),
      getUserById: build.query<GetUserByIdApiResponse, GetUserByIdApiArg>({
        query: (queryArg) => ({ url: `/users/${queryArg.userId}` }),
        providesTags: ['users'],
      }),
      updateUser: build.mutation<UpdateUserApiResponse, UpdateUserApiArg>({
        query: (queryArg) => ({ url: `/users/${queryArg.userId}`, method: 'PUT', body: queryArg.updateUserCommand }),
        invalidatesTags: ['users'],
      }),
      getUserOrgList: build.query<GetUserOrgListApiResponse, GetUserOrgListApiArg>({
        query: (queryArg) => ({ url: `/users/${queryArg.userId}/orgs` }),
        providesTags: ['users'],
      }),
      getUserTeams: build.query<GetUserTeamsApiResponse, GetUserTeamsApiArg>({
        query: (queryArg) => ({ url: `/users/${queryArg.userId}/teams` }),
        providesTags: ['users'],
      }),
      routeGetAlertRules: build.query<RouteGetAlertRulesApiResponse, RouteGetAlertRulesApiArg>({
        query: () => ({ url: `/v1/provisioning/alert-rules` }),
        providesTags: ['provisioning'],
      }),
      routePostAlertRule: build.mutation<RoutePostAlertRuleApiResponse, RoutePostAlertRuleApiArg>({
        query: (queryArg) => ({
          url: `/v1/provisioning/alert-rules`,
          method: 'POST',
          body: queryArg.provisionedAlertRule,
          headers: {
            'X-Disable-Provenance': queryArg['X-Disable-Provenance'],
          },
        }),
        invalidatesTags: ['provisioning'],
      }),
      routeGetAlertRulesExport: build.query<RouteGetAlertRulesExportApiResponse, RouteGetAlertRulesExportApiArg>({
        query: (queryArg) => ({
          url: `/v1/provisioning/alert-rules/export`,
          params: {
            download: queryArg.download,
            format: queryArg.format,
            folderUid: queryArg.folderUid,
            group: queryArg.group,
            ruleUid: queryArg.ruleUid,
          },
        }),
        providesTags: ['provisioning'],
      }),
      routeDeleteAlertRule: build.mutation<RouteDeleteAlertRuleApiResponse, RouteDeleteAlertRuleApiArg>({
        query: (queryArg) => ({
          url: `/v1/provisioning/alert-rules/${queryArg.uid}`,
          method: 'DELETE',
          headers: {
            'X-Disable-Provenance': queryArg['X-Disable-Provenance'],
          },
        }),
        invalidatesTags: ['provisioning'],
      }),
      routeGetAlertRule: build.query<RouteGetAlertRuleApiResponse, RouteGetAlertRuleApiArg>({
        query: (queryArg) => ({ url: `/v1/provisioning/alert-rules/${queryArg.uid}` }),
        providesTags: ['provisioning'],
      }),
      routePutAlertRule: build.mutation<RoutePutAlertRuleApiResponse, RoutePutAlertRuleApiArg>({
        query: (queryArg) => ({
          url: `/v1/provisioning/alert-rules/${queryArg.uid}`,
          method: 'PUT',
          body: queryArg.provisionedAlertRule,
          headers: {
            'X-Disable-Provenance': queryArg['X-Disable-Provenance'],
          },
        }),
        invalidatesTags: ['provisioning'],
      }),
      routeGetAlertRuleExport: build.query<RouteGetAlertRuleExportApiResponse, RouteGetAlertRuleExportApiArg>({
        query: (queryArg) => ({
          url: `/v1/provisioning/alert-rules/${queryArg.uid}/export`,
          params: {
            download: queryArg.download,
            format: queryArg.format,
          },
        }),
        providesTags: ['provisioning'],
      }),
      routeGetContactpoints: build.query<RouteGetContactpointsApiResponse, RouteGetContactpointsApiArg>({
        query: (queryArg) => ({
          url: `/v1/provisioning/contact-points`,
          params: {
            name: queryArg.name,
          },
        }),
        providesTags: ['provisioning'],
      }),
      routePostContactpoints: build.mutation<RoutePostContactpointsApiResponse, RoutePostContactpointsApiArg>({
        query: (queryArg) => ({
          url: `/v1/provisioning/contact-points`,
          method: 'POST',
          body: queryArg.embeddedContactPoint,
          headers: {
            'X-Disable-Provenance': queryArg['X-Disable-Provenance'],
          },
        }),
        invalidatesTags: ['provisioning'],
      }),
      routeGetContactpointsExport: build.query<
        RouteGetContactpointsExportApiResponse,
        RouteGetContactpointsExportApiArg
      >({
        query: (queryArg) => ({
          url: `/v1/provisioning/contact-points/export`,
          params: {
            download: queryArg.download,
            format: queryArg.format,
            decrypt: queryArg.decrypt,
            name: queryArg.name,
          },
        }),
        providesTags: ['provisioning'],
      }),
      routeDeleteContactpoints: build.mutation<RouteDeleteContactpointsApiResponse, RouteDeleteContactpointsApiArg>({
        query: (queryArg) => ({ url: `/v1/provisioning/contact-points/${queryArg.uid}`, method: 'DELETE' }),
        invalidatesTags: ['provisioning'],
      }),
      routePutContactpoint: build.mutation<RoutePutContactpointApiResponse, RoutePutContactpointApiArg>({
        query: (queryArg) => ({
          url: `/v1/provisioning/contact-points/${queryArg.uid}`,
          method: 'PUT',
          body: queryArg.embeddedContactPoint,
          headers: {
            'X-Disable-Provenance': queryArg['X-Disable-Provenance'],
          },
        }),
        invalidatesTags: ['provisioning'],
      }),
      routeDeleteAlertRuleGroup: build.mutation<RouteDeleteAlertRuleGroupApiResponse, RouteDeleteAlertRuleGroupApiArg>({
        query: (queryArg) => ({
          url: `/v1/provisioning/folder/${queryArg.folderUid}/rule-groups/${queryArg.group}`,
          method: 'DELETE',
        }),
        invalidatesTags: ['provisioning'],
      }),
      routeGetAlertRuleGroup: build.query<RouteGetAlertRuleGroupApiResponse, RouteGetAlertRuleGroupApiArg>({
        query: (queryArg) => ({ url: `/v1/provisioning/folder/${queryArg.folderUid}/rule-groups/${queryArg.group}` }),
        providesTags: ['provisioning'],
      }),
      routePutAlertRuleGroup: build.mutation<RoutePutAlertRuleGroupApiResponse, RoutePutAlertRuleGroupApiArg>({
        query: (queryArg) => ({
          url: `/v1/provisioning/folder/${queryArg.folderUid}/rule-groups/${queryArg.group}`,
          method: 'PUT',
          body: queryArg.alertRuleGroup,
          headers: {
            'X-Disable-Provenance': queryArg['X-Disable-Provenance'],
          },
        }),
        invalidatesTags: ['provisioning'],
      }),
      routeGetAlertRuleGroupExport: build.query<
        RouteGetAlertRuleGroupExportApiResponse,
        RouteGetAlertRuleGroupExportApiArg
      >({
        query: (queryArg) => ({
          url: `/v1/provisioning/folder/${queryArg.folderUid}/rule-groups/${queryArg.group}/export`,
          params: {
            download: queryArg.download,
            format: queryArg.format,
          },
        }),
        providesTags: ['provisioning'],
      }),
      routeGetMuteTimings: build.query<RouteGetMuteTimingsApiResponse, RouteGetMuteTimingsApiArg>({
        query: () => ({ url: `/v1/provisioning/mute-timings` }),
        providesTags: ['provisioning'],
      }),
      routePostMuteTiming: build.mutation<RoutePostMuteTimingApiResponse, RoutePostMuteTimingApiArg>({
        query: (queryArg) => ({
          url: `/v1/provisioning/mute-timings`,
          method: 'POST',
          body: queryArg.muteTimeInterval,
          headers: {
            'X-Disable-Provenance': queryArg['X-Disable-Provenance'],
          },
        }),
        invalidatesTags: ['provisioning'],
      }),
      routeExportMuteTimings: build.query<RouteExportMuteTimingsApiResponse, RouteExportMuteTimingsApiArg>({
        query: (queryArg) => ({
          url: `/v1/provisioning/mute-timings/export`,
          params: {
            download: queryArg.download,
            format: queryArg.format,
          },
        }),
        providesTags: ['provisioning'],
      }),
      routeDeleteMuteTiming: build.mutation<RouteDeleteMuteTimingApiResponse, RouteDeleteMuteTimingApiArg>({
        query: (queryArg) => ({
          url: `/v1/provisioning/mute-timings/${queryArg.name}`,
          method: 'DELETE',
          headers: {
            'X-Disable-Provenance': queryArg['X-Disable-Provenance'],
          },
          params: {
            version: queryArg.version,
          },
        }),
        invalidatesTags: ['provisioning'],
      }),
      routeGetMuteTiming: build.query<RouteGetMuteTimingApiResponse, RouteGetMuteTimingApiArg>({
        query: (queryArg) => ({ url: `/v1/provisioning/mute-timings/${queryArg.name}` }),
        providesTags: ['provisioning'],
      }),
      routePutMuteTiming: build.mutation<RoutePutMuteTimingApiResponse, RoutePutMuteTimingApiArg>({
        query: (queryArg) => ({
          url: `/v1/provisioning/mute-timings/${queryArg.name}`,
          method: 'PUT',
          body: queryArg.muteTimeInterval,
          headers: {
            'X-Disable-Provenance': queryArg['X-Disable-Provenance'],
          },
        }),
        invalidatesTags: ['provisioning'],
      }),
      routeExportMuteTiming: build.query<RouteExportMuteTimingApiResponse, RouteExportMuteTimingApiArg>({
        query: (queryArg) => ({
          url: `/v1/provisioning/mute-timings/${queryArg.name}/export`,
          params: {
            download: queryArg.download,
            format: queryArg.format,
          },
        }),
        providesTags: ['provisioning'],
      }),
      routeResetPolicyTree: build.mutation<RouteResetPolicyTreeApiResponse, RouteResetPolicyTreeApiArg>({
        query: () => ({ url: `/v1/provisioning/policies`, method: 'DELETE' }),
        invalidatesTags: ['provisioning'],
      }),
      routeGetPolicyTree: build.query<RouteGetPolicyTreeApiResponse, RouteGetPolicyTreeApiArg>({
        query: () => ({ url: `/v1/provisioning/policies` }),
        providesTags: ['provisioning'],
      }),
      routePutPolicyTree: build.mutation<RoutePutPolicyTreeApiResponse, RoutePutPolicyTreeApiArg>({
        query: (queryArg) => ({
          url: `/v1/provisioning/policies`,
          method: 'PUT',
          body: queryArg.route,
          headers: {
            'X-Disable-Provenance': queryArg['X-Disable-Provenance'],
          },
        }),
        invalidatesTags: ['provisioning'],
      }),
      routeGetPolicyTreeExport: build.query<RouteGetPolicyTreeExportApiResponse, RouteGetPolicyTreeExportApiArg>({
        query: () => ({ url: `/v1/provisioning/policies/export` }),
        providesTags: ['provisioning'],
      }),
      routeGetTemplates: build.query<RouteGetTemplatesApiResponse, RouteGetTemplatesApiArg>({
        query: () => ({ url: `/v1/provisioning/templates` }),
        providesTags: ['provisioning'],
      }),
      routeDeleteTemplate: build.mutation<RouteDeleteTemplateApiResponse, RouteDeleteTemplateApiArg>({
        query: (queryArg) => ({
          url: `/v1/provisioning/templates/${queryArg.name}`,
          method: 'DELETE',
          params: {
            version: queryArg.version,
          },
        }),
        invalidatesTags: ['provisioning'],
      }),
      routeGetTemplate: build.query<RouteGetTemplateApiResponse, RouteGetTemplateApiArg>({
        query: (queryArg) => ({ url: `/v1/provisioning/templates/${queryArg.name}` }),
        providesTags: ['provisioning'],
      }),
      routePutTemplate: build.mutation<RoutePutTemplateApiResponse, RoutePutTemplateApiArg>({
        query: (queryArg) => ({
          url: `/v1/provisioning/templates/${queryArg.name}`,
          method: 'PUT',
          body: queryArg.notificationTemplateContent,
          headers: {
            'X-Disable-Provenance': queryArg['X-Disable-Provenance'],
          },
        }),
        invalidatesTags: ['provisioning'],
      }),
      listAllProvidersSettings: build.query<ListAllProvidersSettingsApiResponse, ListAllProvidersSettingsApiArg>({
        query: () => ({ url: `/v1/sso-settings` }),
        providesTags: ['sso_settings'],
      }),
      removeProviderSettings: build.mutation<RemoveProviderSettingsApiResponse, RemoveProviderSettingsApiArg>({
        query: (queryArg) => ({ url: `/v1/sso-settings/${queryArg.key}`, method: 'DELETE' }),
        invalidatesTags: ['sso_settings'],
      }),
      getProviderSettings: build.query<GetProviderSettingsApiResponse, GetProviderSettingsApiArg>({
        query: (queryArg) => ({ url: `/v1/sso-settings/${queryArg.key}` }),
        providesTags: ['sso_settings'],
      }),
      patchProviderSettings: build.mutation<PatchProviderSettingsApiResponse, PatchProviderSettingsApiArg>({
        query: (queryArg) => ({ url: `/v1/sso-settings/${queryArg.key}`, method: 'PATCH', body: queryArg.body }),
        invalidatesTags: ['sso_settings'],
      }),
      updateProviderSettings: build.mutation<UpdateProviderSettingsApiResponse, UpdateProviderSettingsApiArg>({
        query: (queryArg) => ({ url: `/v1/sso-settings/${queryArg.key}`, method: 'PUT', body: queryArg.body }),
        invalidatesTags: ['sso_settings'],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as generatedAPI };
export type SearchResultApiResponse = /** status 200 (empty) */ SearchResult;
export type SearchResultApiArg = void;
export type ListRolesApiResponse = /** status 200 (empty) */ RoleDto[];
export type ListRolesApiArg = {
  delegatable?: boolean;
  includeHidden?: boolean;
  targetOrgId?: number;
};
export type CreateRoleApiResponse = /** status 201 (empty) */ RoleDto;
export type CreateRoleApiArg = {
  createRoleForm: CreateRoleForm;
};
export type DeleteRoleApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type DeleteRoleApiArg = {
  force?: boolean;
  global?: boolean;
  roleUid: string;
};
export type GetRoleApiResponse = /** status 200 (empty) */ RoleDto;
export type GetRoleApiArg = {
  roleUid: string;
};
export type UpdateRoleApiResponse = /** status 200 (empty) */ RoleDto;
export type UpdateRoleApiArg = {
  roleUid: string;
  updateRoleCommand: UpdateRoleCommand;
};
export type GetRoleAssignmentsApiResponse = /** status 200 (empty) */ RoleAssignmentsDto;
export type GetRoleAssignmentsApiArg = {
  roleUid: string;
};
export type SetRoleAssignmentsApiResponse = /** status 200 (empty) */ RoleAssignmentsDto;
export type SetRoleAssignmentsApiArg = {
  roleUid: string;
  setRoleAssignmentsCommand: SetRoleAssignmentsCommand;
};
export type GetAccessControlStatusApiResponse = /** status 200 (empty) */ Status;
export type GetAccessControlStatusApiArg = void;
export type ListTeamsRolesApiResponse = /** status 200 (empty) */ {
  [key: string]: RoleDto[];
};
export type ListTeamsRolesApiArg = {
  rolesSearchQuery: RolesSearchQuery;
};
export type ListTeamRolesApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type ListTeamRolesApiArg = {
  teamId: number;
  targetOrgId?: number;
};
export type AddTeamRoleApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type AddTeamRoleApiArg = {
  teamId: number;
  addTeamRoleCommand: AddTeamRoleCommand;
};
export type SetTeamRolesApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type SetTeamRolesApiArg = {
  teamId: number;
  targetOrgId?: number;
  setTeamRolesCommand: SetTeamRolesCommand;
};
export type RemoveTeamRoleApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type RemoveTeamRoleApiArg = {
  roleUid: string;
  teamId: number;
};
export type ListUsersRolesApiResponse = /** status 200 (empty) */ {
  [key: string]: RoleDto[];
};
export type ListUsersRolesApiArg = {
  rolesSearchQuery: RolesSearchQuery;
};
export type ListUserRolesApiResponse = /** status 200 (empty) */ RoleDto[];
export type ListUserRolesApiArg = {
  userId: number;
  includeHidden?: boolean;
  includeMapped?: boolean;
  targetOrgId?: number;
};
export type AddUserRoleApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type AddUserRoleApiArg = {
  userId: number;
  addUserRoleCommand: AddUserRoleCommand;
};
export type SetUserRolesApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type SetUserRolesApiArg = {
  userId: number;
  targetOrgId?: number;
  setUserRolesCommand: SetUserRolesCommand;
};
export type RemoveUserRoleApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type RemoveUserRoleApiArg = {
  /** A flag indicating if the assignment is global or not. If set to false, the default org ID of the authenticated user will be used from the request to remove assignment. */
  global?: boolean;
  roleUid: string;
  userId: number;
};
export type GetResourceDescriptionApiResponse = /** status 200 (empty) */ Description;
export type GetResourceDescriptionApiArg = {
  resource: string;
};
export type GetResourcePermissionsApiResponse = /** status 200 (empty) */ ResourcePermissionDto[];
export type GetResourcePermissionsApiArg = {
  resource: string;
  resourceId: string;
};
export type SetResourcePermissionsApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type SetResourcePermissionsApiArg = {
  resource: string;
  resourceId: string;
  setPermissionsCommand: SetPermissionsCommand;
};
export type SetResourcePermissionsForBuiltInRoleApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type SetResourcePermissionsForBuiltInRoleApiArg = {
  resource: string;
  resourceId: string;
  builtInRole: string;
  setPermissionCommand: SetPermissionCommand;
};
export type SetResourcePermissionsForTeamApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type SetResourcePermissionsForTeamApiArg = {
  resource: string;
  resourceId: string;
  teamId: number;
  setPermissionCommand: SetPermissionCommand;
};
export type SetResourcePermissionsForUserApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type SetResourcePermissionsForUserApiArg = {
  resource: string;
  resourceId: string;
  userId: number;
  setPermissionCommand: SetPermissionCommand;
};
export type GetSyncStatusApiResponse = /** status 200 (empty) */ ActiveSyncStatusDto;
export type GetSyncStatusApiArg = void;
export type ReloadLdapCfgApiResponse = unknown;
export type ReloadLdapCfgApiArg = void;
export type GetLdapStatusApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type GetLdapStatusApiArg = void;
export type PostSyncUserWithLdapApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type PostSyncUserWithLdapApiArg = {
  userId: number;
};
export type GetUserFromLdapApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type GetUserFromLdapApiArg = {
  userName: string;
};
export type AdminProvisioningReloadAccessControlApiResponse = /** status 202 AcceptedResponse */ ErrorResponseBody;
export type AdminProvisioningReloadAccessControlApiArg = void;
export type AdminProvisioningReloadDashboardsApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type AdminProvisioningReloadDashboardsApiArg = void;
export type AdminProvisioningReloadDatasourcesApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type AdminProvisioningReloadDatasourcesApiArg = void;
export type AdminProvisioningReloadPluginsApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type AdminProvisioningReloadPluginsApiArg = void;
export type AdminGetSettingsApiResponse = /** status 200 (empty) */ SettingsBag;
export type AdminGetSettingsApiArg = void;
export type AdminGetStatsApiResponse = /** status 200 (empty) */ AdminStats;
export type AdminGetStatsApiArg = void;
export type AdminCreateUserApiResponse = /** status 200 (empty) */ AdminCreateUserResponse;
export type AdminCreateUserApiArg = {
  adminCreateUserForm: AdminCreateUserForm;
};
export type AdminDeleteUserApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type AdminDeleteUserApiArg = {
  userId: number;
};
export type AdminGetUserAuthTokensApiResponse = /** status 200 (empty) */ UserToken[];
export type AdminGetUserAuthTokensApiArg = {
  userId: number;
};
export type AdminDisableUserApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type AdminDisableUserApiArg = {
  userId: number;
};
export type AdminEnableUserApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type AdminEnableUserApiArg = {
  userId: number;
};
export type AdminLogoutUserApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type AdminLogoutUserApiArg = {
  userId: number;
};
export type AdminUpdateUserPasswordApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type AdminUpdateUserPasswordApiArg = {
  userId: number;
  adminUpdateUserPasswordForm: AdminUpdateUserPasswordForm;
};
export type AdminUpdateUserPermissionsApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type AdminUpdateUserPermissionsApiArg = {
  userId: number;
  adminUpdateUserPermissionsForm: AdminUpdateUserPermissionsForm;
};
export type GetUserQuotaApiResponse = /** status 200 (empty) */ QuotaDto[];
export type GetUserQuotaApiArg = {
  userId: number;
};
export type UpdateUserQuotaApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type UpdateUserQuotaApiArg = {
  quotaTarget: string;
  userId: number;
  updateQuotaCmd: UpdateQuotaCmd;
};
export type AdminRevokeUserAuthTokenApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type AdminRevokeUserAuthTokenApiArg = {
  userId: number;
  revokeAuthTokenCmd: RevokeAuthTokenCmd;
};
export type GetAnnotationsApiResponse = /** status 200 (empty) */ Annotation[];
export type GetAnnotationsApiArg = {
  /** Find annotations created after specific epoch datetime in milliseconds. */
  from?: number;
  /** Find annotations created before specific epoch datetime in milliseconds. */
  to?: number;
  /** Limit response to annotations created by specific user. */
  userId?: number;
  /** Find annotations for a specified alert rule by its ID.
    deprecated: AlertID is deprecated and will be removed in future versions. Please use AlertUID instead. */
  alertId?: number;
  /** Find annotations for a specified alert rule by its UID. */
  alertUid?: string;
  /** Find annotations that are scoped to a specific dashboard */
  dashboardId?: number;
  /** Find annotations that are scoped to a specific dashboard */
  dashboardUid?: string;
  /** Find annotations that are scoped to a specific panel */
  panelId?: number;
  /** Max limit for results returned. */
  limit?: number;
  /** Use this to filter organization annotations. Organization annotations are annotations from an annotation data source that are not connected specifically to a dashboard or panel. You can filter by multiple tags. */
  tags?: string[];
  /** Return alerts or user created annotations */
  type?: 'alert' | 'annotation';
  /** Match any or all tags */
  matchAny?: boolean;
};
export type PostAnnotationApiResponse = /** status 200 (empty) */ {
  /** ID Identifier of the created annotation. */
  id: number;
  /** Message Message of the created annotation. */
  message: string;
};
export type PostAnnotationApiArg = {
  postAnnotationsCmd: PostAnnotationsCmd;
};
export type PostGraphiteAnnotationApiResponse = /** status 200 (empty) */ {
  /** ID Identifier of the created annotation. */
  id: number;
  /** Message Message of the created annotation. */
  message: string;
};
export type PostGraphiteAnnotationApiArg = {
  postGraphiteAnnotationsCmd: PostGraphiteAnnotationsCmd;
};
export type MassDeleteAnnotationsApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type MassDeleteAnnotationsApiArg = {
  massDeleteAnnotationsCmd: MassDeleteAnnotationsCmd;
};
export type GetAnnotationTagsApiResponse =
  /** status 200 (empty) */ GetAnnotationTagsResponseIsAResponseStructForFindTagsResult;
export type GetAnnotationTagsApiArg = {
  /** Tag is a string that you can use to filter tags. */
  tag?: string;
  /** Max limit for results returned. */
  limit?: string;
};
export type DeleteAnnotationByIdApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type DeleteAnnotationByIdApiArg = {
  annotationId: string;
};
export type GetAnnotationByIdApiResponse = /** status 200 (empty) */ Annotation;
export type GetAnnotationByIdApiArg = {
  annotationId: string;
};
export type PatchAnnotationApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type PatchAnnotationApiArg = {
  annotationId: string;
  patchAnnotationsCmd: PatchAnnotationsCmd;
};
export type UpdateAnnotationApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type UpdateAnnotationApiArg = {
  annotationId: string;
  updateAnnotationsCmd: UpdateAnnotationsCmd;
};
export type ListDevicesApiResponse = /** status 200 (empty) */ DeviceDto[];
export type ListDevicesApiArg = void;
export type SearchDevicesApiResponse = /** status 200 (empty) */ SearchDeviceQueryResult;
export type SearchDevicesApiArg = void;
export type GetSessionListApiResponse = /** status 200 (empty) */ CloudMigrationSessionListResponseDto;
export type GetSessionListApiArg = void;
export type CreateSessionApiResponse = /** status 200 (empty) */ CloudMigrationSessionResponseDto;
export type CreateSessionApiArg = {
  cloudMigrationSessionRequestDto: CloudMigrationSessionRequestDto;
};
export type DeleteSessionApiResponse = unknown;
export type DeleteSessionApiArg = {
  /** UID of a migration session */
  uid: string;
};
export type GetSessionApiResponse = /** status 200 (empty) */ CloudMigrationSessionResponseDto;
export type GetSessionApiArg = {
  /** UID of a migration session */
  uid: string;
};
export type CreateSnapshotApiResponse = /** status 200 (empty) */ CreateSnapshotResponseDto;
export type CreateSnapshotApiArg = {
  /** UID of a session */
  uid: string;
  createSnapshotRequestDto: CreateSnapshotRequestDto;
};
export type GetSnapshotApiResponse = /** status 200 (empty) */ GetSnapshotResponseDto;
export type GetSnapshotApiArg = {
  /** ResultPage is used for pagination with ResultLimit */
  resultPage?: number;
  /** Max limit for snapshot results returned. */
  resultLimit?: number;
  /** ResultSortColumn can be used to override the default system sort. Valid values are "name", "resource_type", and "status". */
  resultSortColumn?: string;
  /** ResultSortOrder is used with ResultSortColumn. Valid values are ASC and DESC. */
  resultSortOrder?: string;
  /** ErrorsOnly is used to only return resources with error statuses */
  errorsOnly?: boolean;
  /** Session UID of a session */
  uid: string;
  /** UID of a snapshot */
  snapshotUid: string;
};
export type CancelSnapshotApiResponse = unknown;
export type CancelSnapshotApiArg = {
  /** Session UID of a session */
  uid: string;
  /** UID of a snapshot */
  snapshotUid: string;
};
export type UploadSnapshotApiResponse = unknown;
export type UploadSnapshotApiArg = {
  /** Session UID of a session */
  uid: string;
  /** UID of a snapshot */
  snapshotUid: string;
};
export type GetShapshotListApiResponse = /** status 200 (empty) */ SnapshotListResponseDto;
export type GetShapshotListApiArg = {
  /** Page is used for pagination with limit */
  page?: number;
  /** Max limit for results returned. */
  limit?: number;
  /** Session UID of a session */
  uid: string;
  /** Sort with value latest to return results sorted in descending order. */
  sort?: string;
};
export type GetResourceDependenciesApiResponse = /** status 200 (empty) */ ResourceDependenciesResponseDto;
export type GetResourceDependenciesApiArg = void;
export type GetCloudMigrationTokenApiResponse = /** status 200 (empty) */ GetAccessTokenResponseDto;
export type GetCloudMigrationTokenApiArg = void;
export type CreateCloudMigrationTokenApiResponse = /** status 200 (empty) */ CreateAccessTokenResponseDto;
export type CreateCloudMigrationTokenApiArg = void;
export type DeleteCloudMigrationTokenApiResponse = unknown;
export type DeleteCloudMigrationTokenApiArg = {
  /** UID of a cloud migration token */
  uid: string;
};
export type RouteConvertPrometheusCortexGetRulesApiResponse = unknown;
export type RouteConvertPrometheusCortexGetRulesApiArg = void;
export type RouteConvertPrometheusCortexPostRuleGroupsApiResponse =
  /** status 202 ConvertPrometheusResponse */ ConvertPrometheusResponse;
export type RouteConvertPrometheusCortexPostRuleGroupsApiArg = void;
export type RouteConvertPrometheusCortexDeleteNamespaceApiResponse =
  /** status 202 ConvertPrometheusResponse */ ConvertPrometheusResponse;
export type RouteConvertPrometheusCortexDeleteNamespaceApiArg = {
  namespaceTitle: string;
};
export type RouteConvertPrometheusCortexGetNamespaceApiResponse = unknown;
export type RouteConvertPrometheusCortexGetNamespaceApiArg = {
  namespaceTitle: string;
};
export type RouteConvertPrometheusCortexPostRuleGroupApiResponse =
  /** status 202 ConvertPrometheusResponse */ ConvertPrometheusResponse;
export type RouteConvertPrometheusCortexPostRuleGroupApiArg = {
  namespaceTitle: string;
  'x-grafana-alerting-datasource-uid'?: string;
  'x-grafana-alerting-recording-rules-paused'?: boolean;
  'x-grafana-alerting-alert-rules-paused'?: boolean;
  'x-grafana-alerting-target-datasource-uid'?: string;
  'x-grafana-alerting-folder-uid'?: string;
  'x-grafana-alerting-notification-settings'?: string;
  prometheusRuleGroup: PrometheusRuleGroup;
};
export type RouteConvertPrometheusCortexDeleteRuleGroupApiResponse =
  /** status 202 ConvertPrometheusResponse */ ConvertPrometheusResponse;
export type RouteConvertPrometheusCortexDeleteRuleGroupApiArg = {
  namespaceTitle: string;
  group: string;
};
export type RouteConvertPrometheusCortexGetRuleGroupApiResponse = unknown;
export type RouteConvertPrometheusCortexGetRuleGroupApiArg = {
  namespaceTitle: string;
  group: string;
};
export type RouteConvertPrometheusGetRulesApiResponse = unknown;
export type RouteConvertPrometheusGetRulesApiArg = void;
export type RouteConvertPrometheusPostRuleGroupsApiResponse =
  /** status 202 ConvertPrometheusResponse */ ConvertPrometheusResponse;
export type RouteConvertPrometheusPostRuleGroupsApiArg = void;
export type RouteConvertPrometheusDeleteNamespaceApiResponse =
  /** status 202 ConvertPrometheusResponse */ ConvertPrometheusResponse;
export type RouteConvertPrometheusDeleteNamespaceApiArg = {
  namespaceTitle: string;
};
export type RouteConvertPrometheusGetNamespaceApiResponse = unknown;
export type RouteConvertPrometheusGetNamespaceApiArg = {
  namespaceTitle: string;
};
export type RouteConvertPrometheusPostRuleGroupApiResponse =
  /** status 202 ConvertPrometheusResponse */ ConvertPrometheusResponse;
export type RouteConvertPrometheusPostRuleGroupApiArg = {
  namespaceTitle: string;
  'x-grafana-alerting-datasource-uid'?: string;
  'x-grafana-alerting-recording-rules-paused'?: boolean;
  'x-grafana-alerting-alert-rules-paused'?: boolean;
  'x-grafana-alerting-target-datasource-uid'?: string;
  'x-grafana-alerting-folder-uid'?: string;
  'x-grafana-alerting-notification-settings'?: string;
  prometheusRuleGroup: PrometheusRuleGroup;
};
export type RouteConvertPrometheusDeleteRuleGroupApiResponse =
  /** status 202 ConvertPrometheusResponse */ ConvertPrometheusResponse;
export type RouteConvertPrometheusDeleteRuleGroupApiArg = {
  namespaceTitle: string;
  group: string;
};
export type RouteConvertPrometheusGetRuleGroupApiResponse = unknown;
export type RouteConvertPrometheusGetRuleGroupApiArg = {
  namespaceTitle: string;
  group: string;
};
export type SearchDashboardSnapshotsApiResponse = /** status 200 (empty) */ DashboardSnapshotDto[];
export type SearchDashboardSnapshotsApiArg = {
  /** Search Query */
  query?: string;
  /** Limit the number of returned results */
  limit?: number;
};
export type PostDashboardApiResponse = /** status 200 (empty) */ {
  /** FolderUID The unique identifier (uid) of the folder the dashboard belongs to. */
  folderUid?: string;
  /** ID The unique identifier (id) of the created/updated dashboard. */
  id: number;
  /** Status status of the response. */
  status: string;
  /** Slug The slug of the dashboard. */
  title: string;
  /** UID The unique identifier (uid) of the created/updated dashboard. */
  uid: string;
  /** URL The relative URL for accessing the created/updated dashboard. */
  url: string;
  /** Version The version of the dashboard. */
  version: number;
};
export type PostDashboardApiArg = {
  saveDashboardCommand: SaveDashboardCommand;
};
export type ImportDashboardApiResponse =
  /** status 200 (empty) */ ImportDashboardResponseResponseObjectReturnedWhenImportingADashboard;
export type ImportDashboardApiArg = {
  importDashboardRequest: ImportDashboardRequestRequestObjectForImportingADashboard;
};
export type InterpolateDashboardApiResponse = /** status 200 (empty) */ any;
export type InterpolateDashboardApiArg = void;
export type ListPublicDashboardsApiResponse = /** status 200 (empty) */ PublicDashboardListResponseWithPagination;
export type ListPublicDashboardsApiArg = void;
export type GetDashboardTagsApiResponse = /** status 200 (empty) */ DashboardTagCloudItem[];
export type GetDashboardTagsApiArg = void;
export type GetPublicDashboardApiResponse = /** status 200 (empty) */ PublicDashboard;
export type GetPublicDashboardApiArg = {
  dashboardUid: string;
};
export type CreatePublicDashboardApiResponse = /** status 200 (empty) */ PublicDashboard;
export type CreatePublicDashboardApiArg = {
  dashboardUid: string;
  publicDashboardDto: PublicDashboardDto;
};
export type DeletePublicDashboardApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type DeletePublicDashboardApiArg = {
  dashboardUid: string;
  uid: string;
};
export type UpdatePublicDashboardApiResponse = /** status 200 (empty) */ PublicDashboard;
export type UpdatePublicDashboardApiArg = {
  dashboardUid: string;
  uid: string;
  publicDashboardDto: PublicDashboardDto;
};
export type DeleteDashboardByUidApiResponse = /** status 200 (empty) */ {
  /** Message Message of the deleted dashboard. */
  message: string;
  /** Title Title of the deleted dashboard. */
  title: string;
  /** UID Identifier of the deleted dashboard. */
  uid: string;
};
export type DeleteDashboardByUidApiArg = {
  uid: string;
};
export type GetDashboardByUidApiResponse = /** status 200 (empty) */ DashboardFullWithMeta;
export type GetDashboardByUidApiArg = {
  uid: string;
};
export type GetDashboardPermissionsListByUidApiResponse = /** status 200 (empty) */ DashboardAclInfoDto[];
export type GetDashboardPermissionsListByUidApiArg = {
  uid: string;
};
export type UpdateDashboardPermissionsByUidApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type UpdateDashboardPermissionsByUidApiArg = {
  uid: string;
  updateDashboardAclCommand: UpdateDashboardAclCommand;
};
export type GetDashboardVersionsByUidApiResponse = /** status 200 (empty) */ DashboardVersionResponseMeta;
export type GetDashboardVersionsByUidApiArg = {
  uid: string;
  /** Maximum number of results to return */
  limit?: number;
  /** Version to start from when returning queries */
  start?: number;
};
export type GetDashboardVersionByUidApiResponse = /** status 200 (empty) */ DashboardVersionMeta;
export type GetDashboardVersionByUidApiArg = {
  dashboardVersionId: number;
  uid: string;
};
export type GetDataSourcesApiResponse = /** status 200 (empty) */ DataSourceList;
export type GetDataSourcesApiArg = void;
export type AddDataSourceApiResponse = /** status 200 (empty) */ {
  datasource: DataSource;
  /** ID Identifier of the new data source. */
  id: number;
  /** Message Message of the deleted dashboard. */
  message: string;
  /** Name of the new data source. */
  name: string;
};
export type AddDataSourceApiArg = {
  addDataSourceCommand: AddDataSourceCommand;
};
export type GetCorrelationsApiResponse = /** status 200 (empty) */ Correlation[];
export type GetCorrelationsApiArg = {
  /** Limit the maximum number of correlations to return per page */
  limit?: number;
  /** Page index for starting fetching correlations */
  page?: number;
  /** Source datasource UID filter to be applied to correlations */
  sourceUid?: string[];
};
export type DatasourceProxyDeleteByUiDcallsApiResponse = unknown;
export type DatasourceProxyDeleteByUiDcallsApiArg = {
  uid: string;
  datasourceProxyRoute: string;
};
export type DatasourceProxyGetByUiDcallsApiResponse = unknown;
export type DatasourceProxyGetByUiDcallsApiArg = {
  datasourceProxyRoute: string;
  uid: string;
};
export type DatasourceProxyPostByUiDcallsApiResponse = unknown;
export type DatasourceProxyPostByUiDcallsApiArg = {
  datasourceProxyRoute: string;
  uid: string;
  body: any;
};
export type GetCorrelationsBySourceUidApiResponse = /** status 200 (empty) */ Correlation[];
export type GetCorrelationsBySourceUidApiArg = {
  sourceUid: string;
};
export type CreateCorrelationApiResponse = /** status 200 (empty) */ CreateCorrelationResponseBody;
export type CreateCorrelationApiArg = {
  sourceUid: string;
  createCorrelationCommand: CreateCorrelationCommand;
};
export type GetCorrelationApiResponse = /** status 200 (empty) */ Correlation;
export type GetCorrelationApiArg = {
  sourceUid: string;
  correlationUid: string;
};
export type UpdateCorrelationApiResponse = /** status 200 (empty) */ UpdateCorrelationResponseBody;
export type UpdateCorrelationApiArg = {
  sourceUid: string;
  correlationUid: string;
  updateCorrelationCommand: UpdateCorrelationCommand;
};
export type DeleteDataSourceByUidApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type DeleteDataSourceByUidApiArg = {
  uid: string;
};
export type GetDataSourceByUidApiResponse = /** status 200 (empty) */ DataSource;
export type GetDataSourceByUidApiArg = {
  uid: string;
};
export type UpdateDataSourceByUidApiResponse = /** status 200 (empty) */ {
  datasource: DataSource;
  /** ID Identifier of the new data source. */
  id: number;
  /** Message Message of the deleted dashboard. */
  message: string;
  /** Name of the new data source. */
  name: string;
};
export type UpdateDataSourceByUidApiArg = {
  uid: string;
  updateDataSourceCommand: UpdateDataSourceCommand;
};
export type DeleteCorrelationApiResponse = /** status 200 (empty) */ DeleteCorrelationResponseBody;
export type DeleteCorrelationApiArg = {
  uid: string;
  correlationUid: string;
};
export type CheckDatasourceHealthWithUidApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type CheckDatasourceHealthWithUidApiArg = {
  uid: string;
};
export type GetTeamLbacRulesApiApiResponse = /** status 200 (empty) */ TeamLbacRules;
export type GetTeamLbacRulesApiApiArg = {
  uid: string;
};
export type UpdateTeamLbacRulesApiApiResponse = /** status 200 (empty) */ {
  id?: number;
  message?: string;
  name?: string;
  rules?: TeamLbacRule[];
  uid?: string;
};
export type UpdateTeamLbacRulesApiApiArg = {
  uid: string;
  updateTeamLbacCommand: UpdateTeamLbacCommand;
};
export type CallDatasourceResourceWithUidApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type CallDatasourceResourceWithUidApiArg = {
  datasourceProxyRoute: string;
  uid: string;
};
export type GetDataSourceCacheConfigApiResponse = /** status 200 CacheConfigResponse */ CacheConfigResponse;
export type GetDataSourceCacheConfigApiArg = {
  dataSourceUid: string;
  dataSourceType?: string;
};
export type SetDataSourceCacheConfigApiResponse = /** status 200 CacheConfigResponse */ CacheConfigResponse;
export type SetDataSourceCacheConfigApiArg = {
  dataSourceUid: string;
  dataSourceType?: string;
  cacheConfigSetter: CacheConfigSetter;
};
export type CleanDataSourceCacheApiResponse = /** status 200 CacheConfigResponse */ CacheConfigResponse;
export type CleanDataSourceCacheApiArg = {
  dataSourceUid: string;
};
export type DisableDataSourceCacheApiResponse = /** status 200 CacheConfigResponse */ CacheConfigResponse;
export type DisableDataSourceCacheApiArg = {
  dataSourceUid: string;
  dataSourceType?: string;
};
export type EnableDataSourceCacheApiResponse = /** status 200 CacheConfigResponse */ CacheConfigResponse;
export type EnableDataSourceCacheApiArg = {
  dataSourceUid: string;
  dataSourceType?: string;
};
export type QueryMetricsWithExpressionsApiResponse = /** status 200 (empty) */
  | QueryDataResponseContainsTheResultsFromAQueryDataRequest
  | /** status 207 (empty) */ QueryDataResponseContainsTheResultsFromAQueryDataRequest;
export type QueryMetricsWithExpressionsApiArg = {
  metricRequest: MetricRequest;
};
export type GetFoldersApiResponse = /** status 200 (empty) */ FolderSearchHit[];
export type GetFoldersApiArg = {
  /** Limit the maximum number of folders to return */
  limit?: number;
  /** Page index for starting fetching folders */
  page?: number;
  /** The parent folder UID */
  parentUid?: string;
  /** Set to `Edit` to return folders that the user can edit */
  permission?: 'Edit' | 'View';
};
export type CreateFolderApiResponse = /** status 200 (empty) */ Folder;
export type CreateFolderApiArg = {
  createFolderCommand: CreateFolderCommand;
};
export type DeleteFolderApiResponse = /** status 200 (empty) */ {
  /** ID Identifier of the deleted folder. */
  id: number;
  /** Message Message of the deleted folder. */
  message: string;
  /** Title of the deleted folder. */
  title: string;
};
export type DeleteFolderApiArg = {
  folderUid: string;
  /** If `true` any Grafana 8 Alerts under this folder will be deleted.
    Set to `false` so that the request will fail if the folder contains any Grafana 8 Alerts. */
  forceDeleteRules?: boolean;
};
export type GetFolderByUidApiResponse = /** status 200 (empty) */ Folder;
export type GetFolderByUidApiArg = {
  folderUid: string;
};
export type UpdateFolderApiResponse = /** status 200 (empty) */ Folder;
export type UpdateFolderApiArg = {
  folderUid: string;
  /** To change the unique identifier (uid), provide another one.
    To overwrite an existing folder with newer version, set `overwrite` to `true`.
    Provide the current version to safelly update the folder: if the provided version differs from the stored one the request will fail, unless `overwrite` is `true`. */
  updateFolderCommand: UpdateFolderCommand;
};
export type GetFolderDescendantCountsApiResponse = /** status 200 (empty) */ DescendantCounts;
export type GetFolderDescendantCountsApiArg = {
  folderUid: string;
};
export type MoveFolderApiResponse = /** status 200 (empty) */ Folder;
export type MoveFolderApiArg = {
  folderUid: string;
  moveFolderCommand: MoveFolderCommand;
};
export type GetFolderPermissionListApiResponse = /** status 200 (empty) */ DashboardAclInfoDto[];
export type GetFolderPermissionListApiArg = {
  folderUid: string;
};
export type UpdateFolderPermissionsApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type UpdateFolderPermissionsApiArg = {
  folderUid: string;
  updateDashboardAclCommand: UpdateDashboardAclCommand;
};
export type GetMappedGroupsApiResponse = /** status 200 (empty) */ GetGroupsResponse;
export type GetMappedGroupsApiArg = void;
export type DeleteGroupMappingsApiResponse =
  /** status 204 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type DeleteGroupMappingsApiArg = {
  groupId: string;
};
export type CreateGroupMappingsApiResponse = /** status 201 (empty) */ MessageResponse;
export type CreateGroupMappingsApiArg = {
  groupId: string;
  groupAttributes: GroupAttributes;
};
export type UpdateGroupMappingsApiResponse = /** status 201 (empty) */ MessageResponse;
export type UpdateGroupMappingsApiArg = {
  groupId: string;
  groupAttributes: GroupAttributes;
};
export type GetGroupRolesApiResponse = /** status 200 (empty) */ RoleDto[];
export type GetGroupRolesApiArg = {
  groupId: string;
};
export type GetHealthApiResponse = /** status 200 healthResponse */ HealthResponse;
export type GetHealthApiArg = void;
export type GetLibraryElementsApiResponse =
  /** status 200 (empty) */ LibraryElementSearchResponseIsAResponseStructForLibraryElementSearchResult;
export type GetLibraryElementsApiArg = {
  /** Part of the name or description searched for. */
  searchString?: string;
  /** Kind of element to search for. */
  kind?: 1;
  /** Sort order of elements. */
  sortDirection?: 'alpha-asc' | 'alpha-desc';
  /** A comma separated list of types to filter the elements by */
  typeFilter?: string;
  /** Element UID to exclude from search results. */
  excludeUid?: string;
  /** A comma separated list of folder ID(s) to filter the elements by.
    Deprecated: Use FolderFilterUIDs instead. */
  folderFilter?: string;
  /** A comma separated list of folder UID(s) to filter the elements by. */
  folderFilterUiDs?: string;
  /** The number of results per page. */
  perPage?: number;
  /** The page for a set of records, given that only perPage records are returned at a time. Numbering starts at 1. */
  page?: number;
};
export type CreateLibraryElementApiResponse =
  /** status 200 (empty) */ LibraryElementResponseIsAResponseStructForLibraryElementDto;
export type CreateLibraryElementApiArg = {
  createLibraryElementCommand: CreateLibraryElementCommand;
};
export type GetLibraryElementByNameApiResponse =
  /** status 200 (empty) */ LibraryElementArrayResponseIsAResponseStructForAnArrayOfLibraryElementDto;
export type GetLibraryElementByNameApiArg = {
  libraryElementName: string;
};
export type DeleteLibraryElementByUidApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type DeleteLibraryElementByUidApiArg = {
  libraryElementUid: string;
};
export type GetLibraryElementByUidApiResponse =
  /** status 200 (empty) */ LibraryElementResponseIsAResponseStructForLibraryElementDto;
export type GetLibraryElementByUidApiArg = {
  libraryElementUid: string;
};
export type UpdateLibraryElementApiResponse =
  /** status 200 (empty) */ LibraryElementResponseIsAResponseStructForLibraryElementDto;
export type UpdateLibraryElementApiArg = {
  libraryElementUid: string;
  patchLibraryElementCommand: PatchLibraryElementCommand;
};
export type GetLibraryElementConnectionsApiResponse =
  /** status 200 (empty) */ LibraryElementConnectionsResponseIsAResponseStructForAnArrayOfLibraryElementConnectionDto;
export type GetLibraryElementConnectionsApiArg = {
  libraryElementUid: string;
};
export type GetStatusApiResponse = unknown;
export type GetStatusApiArg = void;
export type RefreshLicenseStatsApiResponse = /** status 200 (empty) */ ActiveUserStats;
export type RefreshLicenseStatsApiArg = void;
export type DeleteLicenseTokenApiResponse = /** status 202 AcceptedResponse */ ErrorResponseBody;
export type DeleteLicenseTokenApiArg = {
  deleteTokenCommand: DeleteTokenCommand;
};
export type GetLicenseTokenApiResponse = /** status 200 (empty) */ Token;
export type GetLicenseTokenApiArg = void;
export type PostLicenseTokenApiResponse = /** status 200 (empty) */ Token;
export type PostLicenseTokenApiArg = {
  deleteTokenCommand: DeleteTokenCommand;
};
export type PostRenewLicenseTokenApiResponse = unknown;
export type PostRenewLicenseTokenApiArg = {
  body: object;
};
export type GetSamlLogoutApiResponse = unknown;
export type GetSamlLogoutApiArg = void;
export type GetCurrentOrgApiResponse = /** status 200 (empty) */ OrgDetailsDto;
export type GetCurrentOrgApiArg = void;
export type UpdateCurrentOrgApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type UpdateCurrentOrgApiArg = {
  updateOrgForm: UpdateOrgForm;
};
export type UpdateCurrentOrgAddressApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type UpdateCurrentOrgAddressApiArg = {
  updateOrgAddressForm: UpdateOrgAddressForm;
};
export type GetPendingOrgInvitesApiResponse = /** status 200 (empty) */ TempUserDto[];
export type GetPendingOrgInvitesApiArg = void;
export type AddOrgInviteApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type AddOrgInviteApiArg = {
  addInviteForm: AddInviteForm;
};
export type RevokeInviteApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type RevokeInviteApiArg = {
  invitationCode: string;
};
export type GetOrgPreferencesApiResponse = /** status 200 (empty) */ PreferencesSpec;
export type GetOrgPreferencesApiArg = void;
export type PatchOrgPreferencesApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type PatchOrgPreferencesApiArg = {
  patchPrefsCmd: PatchPrefsCmd;
};
export type UpdateOrgPreferencesApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type UpdateOrgPreferencesApiArg = {
  updatePrefsCmd: UpdatePrefsCmd;
};
export type GetCurrentOrgQuotaApiResponse = /** status 200 (empty) */ QuotaDto[];
export type GetCurrentOrgQuotaApiArg = void;
export type GetOrgUsersForCurrentOrgApiResponse = /** status 200 (empty) */ OrgUserDto[];
export type GetOrgUsersForCurrentOrgApiArg = {
  query?: string;
  limit?: number;
};
export type AddOrgUserToCurrentOrgApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type AddOrgUserToCurrentOrgApiArg = {
  addOrgUserCommand: AddOrgUserCommand;
};
export type GetOrgUsersForCurrentOrgLookupApiResponse = /** status 200 (empty) */ UserLookupDto[];
export type GetOrgUsersForCurrentOrgLookupApiArg = {
  query?: string;
  limit?: number;
};
export type RemoveOrgUserForCurrentOrgApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type RemoveOrgUserForCurrentOrgApiArg = {
  userId: number;
};
export type UpdateOrgUserForCurrentOrgApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type UpdateOrgUserForCurrentOrgApiArg = {
  userId: number;
  updateOrgUserCommand: UpdateOrgUserCommand;
};
export type SearchOrgsApiResponse = /** status 200 (empty) */ OrgDto[];
export type SearchOrgsApiArg = {
  page?: number;
  /** Number of items per page
    The totalCount field in the response can be used for pagination list E.g. if totalCount is equal to 100 teams and the perpage parameter is set to 10 then there are 10 pages of teams. */
  perpage?: number;
  name?: string;
  /** If set it will return results where the query value is contained in the name field. Query values with spaces need to be URL encoded. */
  query?: string;
};
export type CreateOrgApiResponse = /** status 200 (empty) */ {
  /** Message Message of the created org. */
  message: string;
  /** ID Identifier of the created org. */
  orgId: number;
};
export type CreateOrgApiArg = {
  createOrgCommand: CreateOrgCommand;
};
export type GetOrgByNameApiResponse = /** status 200 (empty) */ OrgDetailsDto;
export type GetOrgByNameApiArg = {
  orgName: string;
};
export type DeleteOrgByIdApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type DeleteOrgByIdApiArg = {
  orgId: number;
};
export type GetOrgByIdApiResponse = /** status 200 (empty) */ OrgDetailsDto;
export type GetOrgByIdApiArg = {
  orgId: number;
};
export type UpdateOrgApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type UpdateOrgApiArg = {
  orgId: number;
  updateOrgForm: UpdateOrgForm;
};
export type UpdateOrgAddressApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type UpdateOrgAddressApiArg = {
  orgId: number;
  updateOrgAddressForm: UpdateOrgAddressForm;
};
export type GetOrgQuotaApiResponse = /** status 200 (empty) */ QuotaDto[];
export type GetOrgQuotaApiArg = {
  orgId: number;
};
export type UpdateOrgQuotaApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type UpdateOrgQuotaApiArg = {
  quotaTarget: string;
  orgId: number;
  updateQuotaCmd: UpdateQuotaCmd;
};
export type GetOrgUsersApiResponse = /** status 200 (empty) */ OrgUserDto[];
export type GetOrgUsersApiArg = {
  orgId: number;
};
export type AddOrgUserApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type AddOrgUserApiArg = {
  orgId: number;
  addOrgUserCommand: AddOrgUserCommand;
};
export type SearchOrgUsersApiResponse = /** status 200 (empty) */ SearchOrgUsersQueryResult;
export type SearchOrgUsersApiArg = {
  orgId: number;
};
export type RemoveOrgUserApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type RemoveOrgUserApiArg = {
  orgId: number;
  userId: number;
};
export type UpdateOrgUserApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type UpdateOrgUserApiArg = {
  orgId: number;
  userId: number;
  updateOrgUserCommand: UpdateOrgUserCommand;
};
export type ViewPublicDashboardApiResponse = /** status 200 (empty) */ DashboardFullWithMeta;
export type ViewPublicDashboardApiArg = {
  accessToken: string;
};
export type GetPublicAnnotationsApiResponse = /** status 200 (empty) */ AnnotationEvent[];
export type GetPublicAnnotationsApiArg = {
  accessToken: string;
};
export type QueryPublicDashboardApiResponse =
  /** status 200 (empty) */ QueryDataResponseContainsTheResultsFromAQueryDataRequest;
export type QueryPublicDashboardApiArg = {
  accessToken: string;
  panelId: number;
};
export type SearchQueriesApiResponse = /** status 200 (empty) */ QueryHistorySearchResponse;
export type SearchQueriesApiArg = {
  /** List of data source UIDs to search for */
  datasourceUid?: string[];
  /** Text inside query or comments that is searched for */
  searchString?: string;
  /** Flag indicating if only starred queries should be returned */
  onlyStarred?: boolean;
  /** Sort method */
  sort?: 'time-desc' | 'time-asc';
  /** Use this parameter to access hits beyond limit. Numbering starts at 1. limit param acts as page size. */
  page?: number;
  /** Limit the number of returned results */
  limit?: number;
  /** From range for the query history search */
  from?: number;
  /** To range for the query history search */
  to?: number;
};
export type CreateQueryApiResponse = /** status 200 (empty) */ QueryHistoryResponse;
export type CreateQueryApiArg = {
  createQueryInQueryHistoryCommand: CreateQueryInQueryHistoryCommand;
};
export type UnstarQueryApiResponse = /** status 200 (empty) */ QueryHistoryResponse;
export type UnstarQueryApiArg = {
  queryHistoryUid: string;
};
export type StarQueryApiResponse = /** status 200 (empty) */ QueryHistoryResponse;
export type StarQueryApiArg = {
  queryHistoryUid: string;
};
export type DeleteQueryApiResponse = /** status 200 (empty) */ QueryHistoryDeleteQueryResponse;
export type DeleteQueryApiArg = {
  queryHistoryUid: string;
};
export type PatchQueryCommentApiResponse = /** status 200 (empty) */ QueryHistoryResponse;
export type PatchQueryCommentApiArg = {
  queryHistoryUid: string;
  patchQueryCommentInQueryHistoryCommand: PatchQueryCommentInQueryHistoryCommand;
};
export type ListRecordingRulesApiResponse = /** status 200 (empty) */ RecordingRuleJson[];
export type ListRecordingRulesApiArg = void;
export type CreateRecordingRuleApiResponse = /** status 200 (empty) */ RecordingRuleJson;
export type CreateRecordingRuleApiArg = {
  recordingRuleJson: RecordingRuleJson;
};
export type UpdateRecordingRuleApiResponse = /** status 200 (empty) */ RecordingRuleJson;
export type UpdateRecordingRuleApiArg = {
  recordingRuleJson: RecordingRuleJson;
};
export type TestCreateRecordingRuleApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type TestCreateRecordingRuleApiArg = {
  recordingRuleJson: RecordingRuleJson;
};
export type DeleteRecordingRuleWriteTargetApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type DeleteRecordingRuleWriteTargetApiArg = void;
export type GetRecordingRuleWriteTargetApiResponse = /** status 200 (empty) */ PrometheusRemoteWriteTargetJson;
export type GetRecordingRuleWriteTargetApiArg = void;
export type CreateRecordingRuleWriteTargetApiResponse = /** status 200 (empty) */ PrometheusRemoteWriteTargetJson;
export type CreateRecordingRuleWriteTargetApiArg = {
  prometheusRemoteWriteTargetJson: PrometheusRemoteWriteTargetJson;
};
export type DeleteRecordingRuleApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type DeleteRecordingRuleApiArg = {
  recordingRuleId: number;
};
export type GetReportsApiResponse = /** status 200 (empty) */ Report[];
export type GetReportsApiArg = void;
export type CreateReportApiResponse = /** status 200 (empty) */ {
  id?: number;
  message?: string;
};
export type CreateReportApiArg = {
  createOrUpdateReport: CreateOrUpdateReport;
};
export type GetReportsByDashboardUidApiResponse = /** status 200 (empty) */ Report[];
export type GetReportsByDashboardUidApiArg = {
  uid: string;
};
export type SendReportApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type SendReportApiArg = {
  reportEmail: ReportEmail;
};
export type GetSettingsImageApiResponse = /** status 200 (empty) */ number[];
export type GetSettingsImageApiArg = void;
export type RenderReportCsVsApiResponse = /** status 200 (empty) */ number[] | /** status 204 (empty) */ object;
export type RenderReportCsVsApiArg = {
  dashboards?: string;
  title?: string;
};
export type RenderReportPdFsApiResponse = /** status 200 (empty) */ number[];
export type RenderReportPdFsApiArg = {
  dashboards?: string;
  orientation?: string;
  layout?: string;
  title?: string;
  scaleFactor?: string;
  includeTables?: string;
};
export type GetReportSettingsApiResponse = /** status 200 (empty) */ ReportSettings;
export type GetReportSettingsApiArg = void;
export type SaveReportSettingsApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type SaveReportSettingsApiArg = {
  reportSettings: ReportSettings;
};
export type SendTestEmailApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type SendTestEmailApiArg = {
  createOrUpdateReport: CreateOrUpdateReport;
};
export type PostAcsApiResponse = unknown;
export type PostAcsApiArg = {
  relayState?: string;
};
export type GetMetadataApiResponse = /** status 200 (empty) */ number[];
export type GetMetadataApiArg = void;
export type GetSloApiResponse = unknown;
export type GetSloApiArg = void;
export type PostSloApiResponse = unknown;
export type PostSloApiArg = {
  samlRequest?: string;
  samlResponse?: string;
};
export type SearchApiResponse = /** status 200 (empty) */ HitList;
export type SearchApiArg = {
  /** Search Query */
  query?: string;
  /** List of tags to search for */
  tag?: string[];
  /** Type to search for, dash-folder or dash-db */
  type?: 'dash-folder' | 'dash-db';
  /** List of dashboard id’s to search for
    This is deprecated: users should use the `dashboardUIDs` query parameter instead */
  dashboardIds?: number[];
  /** List of dashboard uid’s to search for */
  dashboardUiDs?: string[];
  /** List of folder id’s to search in for dashboards
    If it's `0` then it will query for the top level folders
    This is deprecated: users should use the `folderUIDs` query parameter instead */
  folderIds?: number[];
  /** List of folder UID’s to search in for dashboards
    If it's an empty string then it will query for the top level folders */
  folderUiDs?: string[];
  /** Flag indicating if only starred Dashboards should be returned */
  starred?: boolean;
  /** Limit the number of returned results (max 5000) */
  limit?: number;
  /** Use this parameter to access hits beyond limit. Numbering starts at 1. limit param acts as page size. Only available in Grafana v6.2+. */
  page?: number;
  /** Set to `Edit` to return dashboards/folders that the user can edit */
  permission?: 'Edit' | 'View';
  /** Sort method; for listing all the possible sort methods use the search sorting endpoint. */
  sort?: 'alpha-asc' | 'alpha-desc';
  /** Flag indicating if only soft deleted Dashboards should be returned */
  deleted?: boolean;
};
export type ListSortOptionsApiResponse = /** status 200 (empty) */ {
  description?: string;
  displayName?: string;
  meta?: string;
  name?: string;
};
export type ListSortOptionsApiArg = void;
export type CreateServiceAccountApiResponse = /** status 201 (empty) */ ServiceAccountDto;
export type CreateServiceAccountApiArg = {
  createServiceAccountForm: CreateServiceAccountForm;
};
export type SearchOrgServiceAccountsWithPagingApiResponse = /** status 200 (empty) */ SearchOrgServiceAccountsResult;
export type SearchOrgServiceAccountsWithPagingApiArg = {
  disabled?: boolean;
  expiredTokens?: boolean;
  /** It will return results where the query value is contained in one of the name.
    Query values with spaces need to be URL encoded. */
  query?: string;
  /** The default value is 1000. */
  perpage?: number;
  /** The default value is 1. */
  page?: number;
};
export type DeleteServiceAccountApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type DeleteServiceAccountApiArg = {
  serviceAccountId: number;
};
export type RetrieveServiceAccountApiResponse = /** status 200 (empty) */ ServiceAccountDto;
export type RetrieveServiceAccountApiArg = {
  serviceAccountId: number;
};
export type UpdateServiceAccountApiResponse = /** status 200 (empty) */ {
  id?: number;
  message?: string;
  name?: string;
  serviceaccount?: ServiceAccountProfileDto;
};
export type UpdateServiceAccountApiArg = {
  serviceAccountId: number;
  updateServiceAccountForm: UpdateServiceAccountForm;
};
export type ListTokensApiResponse = /** status 200 (empty) */ TokenDto[];
export type ListTokensApiArg = {
  serviceAccountId: number;
};
export type CreateTokenApiResponse = /** status 200 (empty) */ NewApiKeyResult;
export type CreateTokenApiArg = {
  serviceAccountId: number;
  addServiceAccountTokenCommand: AddServiceAccountTokenCommand;
};
export type DeleteTokenApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type DeleteTokenApiArg = {
  tokenId: number;
  serviceAccountId: number;
};
export type RetrieveJwksApiResponse = /** status 200 (empty) */ {
  keys?: JsonWebKey[];
};
export type RetrieveJwksApiArg = void;
export type GetSharingOptionsApiResponse = /** status 200 (empty) */ {
  externalEnabled?: boolean;
  externalSnapshotName?: string;
  externalSnapshotURL?: string;
};
export type GetSharingOptionsApiArg = void;
export type CreateDashboardSnapshotApiResponse = /** status 200 (empty) */ {
  /** Unique key used to delete the snapshot. It is different from the key so that only the creator can delete the snapshot. */
  deleteKey?: string;
  deleteUrl?: string;
  /** Snapshot id */
  id?: number;
  /** Unique key */
  key?: string;
  url?: string;
};
export type CreateDashboardSnapshotApiArg = {
  createDashboardSnapshotCommand: CreateDashboardSnapshotCommand;
};
export type DeleteDashboardSnapshotByDeleteKeyApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type DeleteDashboardSnapshotByDeleteKeyApiArg = {
  deleteKey: string;
};
export type DeleteDashboardSnapshotApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type DeleteDashboardSnapshotApiArg = {
  key: string;
};
export type GetDashboardSnapshotApiResponse = unknown;
export type GetDashboardSnapshotApiArg = {
  key: string;
};
export type CreateTeamApiResponse = /** status 200 (empty) */ {
  message?: string;
  teamId?: number;
  uid?: string;
};
export type CreateTeamApiArg = {
  createTeamCommand: CreateTeamCommand;
};
export type SearchTeamsApiResponse = /** status 200 (empty) */ SearchTeamQueryResult;
export type SearchTeamsApiArg = {
  page?: number;
  /** Number of items per page
    The totalCount field in the response can be used for pagination list E.g. if totalCount is equal to 100 teams and the perpage parameter is set to 10 then there are 10 pages of teams. */
  perpage?: number;
  name?: string;
  /** If set it will return results where the query value is contained in the name field. Query values with spaces need to be URL encoded. */
  query?: string;
  accesscontrol?: boolean;
  sort?: string;
};
export type RemoveTeamGroupApiQueryApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type RemoveTeamGroupApiQueryApiArg = {
  groupId?: string;
  teamId: string;
};
export type GetTeamGroupsApiApiResponse = /** status 200 (empty) */ TeamGroupDto[];
export type GetTeamGroupsApiApiArg = {
  teamId: string;
};
export type AddTeamGroupApiApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type AddTeamGroupApiApiArg = {
  teamId: string;
  teamGroupMapping: TeamGroupMapping;
};
export type SearchTeamGroupsApiResponse = /** status 200 (empty) */ SearchTeamGroupsQueryResult[];
export type SearchTeamGroupsApiArg = {
  teamId: number;
  page?: number;
  /** Number of items per page */
  perpage?: number;
  /** If set it will return results where the query value is contained in the name field. Query values with spaces need to be URL encoded. */
  query?: string;
  /** Filter by exact name match */
  name?: string;
};
export type DeleteTeamByIdApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type DeleteTeamByIdApiArg = {
  teamId: string;
};
export type GetTeamByIdApiResponse = /** status 200 (empty) */ TeamDto;
export type GetTeamByIdApiArg = {
  teamId: string;
  accesscontrol?: boolean;
};
export type UpdateTeamApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type UpdateTeamApiArg = {
  teamId: string;
  updateTeamCommand: UpdateTeamCommand;
};
export type GetTeamMembersApiResponse = /** status 200 (empty) */ TeamMemberDto[];
export type GetTeamMembersApiArg = {
  teamId: string;
};
export type AddTeamMemberApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type AddTeamMemberApiArg = {
  teamId: string;
  addTeamMemberCommand: AddTeamMemberCommand;
};
export type SetTeamMembershipsApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type SetTeamMembershipsApiArg = {
  teamId: string;
  setTeamMembershipsCommand: SetTeamMembershipsCommand;
};
export type RemoveTeamMemberApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type RemoveTeamMemberApiArg = {
  teamId: string;
  userId: number;
};
export type UpdateTeamMemberApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type UpdateTeamMemberApiArg = {
  teamId: string;
  userId: number;
  updateTeamMemberCommand: UpdateTeamMemberCommand;
};
export type GetTeamPreferencesApiResponse = /** status 200 (empty) */ PreferencesSpec;
export type GetTeamPreferencesApiArg = {
  teamId: string;
};
export type UpdateTeamPreferencesApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type UpdateTeamPreferencesApiArg = {
  teamId: string;
  updatePrefsCmd: UpdatePrefsCmd;
};
export type GetSignedInUserApiResponse = /** status 200 (empty) */ UserProfileDto;
export type GetSignedInUserApiArg = void;
export type UpdateSignedInUserApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type UpdateSignedInUserApiArg = {
  /** To change the email, name, login, theme, provide another one. */
  updateUserCommand: UpdateUserCommand;
};
export type GetUserAuthTokensApiResponse = /** status 200 (empty) */ UserToken[];
export type GetUserAuthTokensApiArg = void;
export type UpdateUserEmailApiResponse = unknown;
export type UpdateUserEmailApiArg = void;
export type ClearHelpFlagsApiResponse = /** status 200 (empty) */ {
  helpFlags1?: number;
  message?: string;
};
export type ClearHelpFlagsApiArg = void;
export type SetHelpFlagApiResponse = /** status 200 (empty) */ {
  helpFlags1?: number;
  message?: string;
};
export type SetHelpFlagApiArg = {
  flagId: string;
};
export type GetSignedInUserOrgListApiResponse = /** status 200 (empty) */ UserOrgDto[];
export type GetSignedInUserOrgListApiArg = void;
export type ChangeUserPasswordApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type ChangeUserPasswordApiArg = {
  /** To change the email, name, login, theme, provide another one. */
  changeUserPasswordCommand: ChangeUserPasswordCommand;
};
export type GetUserPreferencesApiResponse = /** status 200 (empty) */ PreferencesSpec;
export type GetUserPreferencesApiArg = void;
export type PatchUserPreferencesApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type PatchUserPreferencesApiArg = {
  patchPrefsCmd: PatchPrefsCmd;
};
export type UpdateUserPreferencesApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type UpdateUserPreferencesApiArg = {
  updatePrefsCmd: UpdatePrefsCmd;
};
export type GetUserQuotasApiResponse = /** status 200 (empty) */ QuotaDto[];
export type GetUserQuotasApiArg = void;
export type RevokeUserAuthTokenApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type RevokeUserAuthTokenApiArg = {
  revokeAuthTokenCmd: RevokeAuthTokenCmd;
};
export type UnstarDashboardByUidApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type UnstarDashboardByUidApiArg = {
  dashboardUid: string;
};
export type StarDashboardByUidApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type StarDashboardByUidApiArg = {
  dashboardUid: string;
};
export type GetSignedInUserTeamListApiResponse = /** status 200 (empty) */ TeamDto[];
export type GetSignedInUserTeamListApiArg = void;
export type UserSetUsingOrgApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type UserSetUsingOrgApiArg = {
  orgId: number;
};
export type SearchUsersApiResponse = /** status 200 (empty) */ UserSearchHitDto[];
export type SearchUsersApiArg = {
  /** Limit the maximum number of users to return per page */
  perpage?: number;
  /** Page index for starting fetching users */
  page?: number;
};
export type GetUserByLoginOrEmailApiResponse = /** status 200 (empty) */ UserProfileDto;
export type GetUserByLoginOrEmailApiArg = {
  /** loginOrEmail of the user */
  loginOrEmail: string;
};
export type SearchUsersWithPagingApiResponse = /** status 200 (empty) */ SearchUserQueryResult;
export type SearchUsersWithPagingApiArg = void;
export type GetUserByIdApiResponse = /** status 200 (empty) */ UserProfileDto;
export type GetUserByIdApiArg = {
  userId: number;
};
export type UpdateUserApiResponse =
  /** status 200 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type UpdateUserApiArg = {
  userId: number;
  /** To change the email, name, login, theme, provide another one. */
  updateUserCommand: UpdateUserCommand;
};
export type GetUserOrgListApiResponse = /** status 200 (empty) */ UserOrgDto[];
export type GetUserOrgListApiArg = {
  userId: number;
};
export type GetUserTeamsApiResponse = /** status 200 (empty) */ TeamDto[];
export type GetUserTeamsApiArg = {
  userId: number;
};
export type RouteGetAlertRulesApiResponse = /** status 200 ProvisionedAlertRules */ ProvisionedAlertRulesRead;
export type RouteGetAlertRulesApiArg = void;
export type RoutePostAlertRuleApiResponse = /** status 201 ProvisionedAlertRule */ ProvisionedAlertRuleRead;
export type RoutePostAlertRuleApiArg = {
  'X-Disable-Provenance'?: string;
  provisionedAlertRule: ProvisionedAlertRule;
};
export type RouteGetAlertRulesExportApiResponse =
  /** status 200 AlertingFileExport */ AlertingFileExportIsTheFullProvisionedFileExport;
export type RouteGetAlertRulesExportApiArg = {
  /** Whether to initiate a download of the file or not. */
  download?: boolean;
  /** Format of the downloaded file. Supported yaml, json or hcl. Accept header can also be used, but the query parameter will take precedence. */
  format?: 'yaml' | 'json' | 'hcl';
  /** UIDs of folders from which to export rules */
  folderUid?: string[];
  /** Name of group of rules to export. Must be specified only together with a single folder UID */
  group?: string;
  /** UID of alert rule to export. If specified, parameters folderUid and group must be empty. */
  ruleUid?: string;
};
export type RouteDeleteAlertRuleApiResponse = unknown;
export type RouteDeleteAlertRuleApiArg = {
  /** Alert rule UID */
  uid: string;
  'X-Disable-Provenance'?: string;
};
export type RouteGetAlertRuleApiResponse = /** status 200 ProvisionedAlertRule */ ProvisionedAlertRuleRead;
export type RouteGetAlertRuleApiArg = {
  /** Alert rule UID */
  uid: string;
};
export type RoutePutAlertRuleApiResponse = /** status 200 ProvisionedAlertRule */ ProvisionedAlertRuleRead;
export type RoutePutAlertRuleApiArg = {
  /** Alert rule UID */
  uid: string;
  'X-Disable-Provenance'?: string;
  provisionedAlertRule: ProvisionedAlertRule;
};
export type RouteGetAlertRuleExportApiResponse =
  /** status 200 AlertingFileExport */ AlertingFileExportIsTheFullProvisionedFileExport;
export type RouteGetAlertRuleExportApiArg = {
  /** Whether to initiate a download of the file or not. */
  download?: boolean;
  /** Format of the downloaded file. Supported yaml, json or hcl. Accept header can also be used, but the query parameter will take precedence. */
  format?: 'yaml' | 'json' | 'hcl';
  /** Alert rule UID */
  uid: string;
};
export type RouteGetContactpointsApiResponse = /** status 200 ContactPoints */ ContactPointsRead;
export type RouteGetContactpointsApiArg = {
  /** Filter by name */
  name?: string;
};
export type RoutePostContactpointsApiResponse = /** status 202 EmbeddedContactPoint */ EmbeddedContactPointRead;
export type RoutePostContactpointsApiArg = {
  'X-Disable-Provenance'?: string;
  embeddedContactPoint: EmbeddedContactPoint;
};
export type RouteGetContactpointsExportApiResponse =
  /** status 200 AlertingFileExport */ AlertingFileExportIsTheFullProvisionedFileExport;
export type RouteGetContactpointsExportApiArg = {
  /** Whether to initiate a download of the file or not. */
  download?: boolean;
  /** Format of the downloaded file. Supported yaml, json or hcl. Accept header can also be used, but the query parameter will take precedence. */
  format?: 'yaml' | 'json' | 'hcl';
  /** Whether any contained secure settings should be decrypted or left redacted. Redacted settings will contain RedactedValue instead. Currently, only org admin can view decrypted secure settings. */
  decrypt?: boolean;
  /** Filter by name */
  name?: string;
};
export type RouteDeleteContactpointsApiResponse = unknown;
export type RouteDeleteContactpointsApiArg = {
  /** UID is the contact point unique identifier */
  uid: string;
};
export type RoutePutContactpointApiResponse = /** status 202 Ack */ Ack;
export type RoutePutContactpointApiArg = {
  /** UID is the contact point unique identifier */
  uid: string;
  'X-Disable-Provenance'?: string;
  embeddedContactPoint: EmbeddedContactPoint;
};
export type RouteDeleteAlertRuleGroupApiResponse = unknown;
export type RouteDeleteAlertRuleGroupApiArg = {
  folderUid: string;
  group: string;
};
export type RouteGetAlertRuleGroupApiResponse = /** status 200 AlertRuleGroup */ AlertRuleGroupRead;
export type RouteGetAlertRuleGroupApiArg = {
  folderUid: string;
  group: string;
};
export type RoutePutAlertRuleGroupApiResponse = /** status 200 AlertRuleGroup */ AlertRuleGroupRead;
export type RoutePutAlertRuleGroupApiArg = {
  'X-Disable-Provenance'?: string;
  folderUid: string;
  group: string;
  alertRuleGroup: AlertRuleGroup;
};
export type RouteGetAlertRuleGroupExportApiResponse =
  /** status 200 AlertingFileExport */ AlertingFileExportIsTheFullProvisionedFileExport;
export type RouteGetAlertRuleGroupExportApiArg = {
  /** Whether to initiate a download of the file or not. */
  download?: boolean;
  /** Format of the downloaded file. Supported yaml, json or hcl. Accept header can also be used, but the query parameter will take precedence. */
  format?: 'yaml' | 'json' | 'hcl';
  folderUid: string;
  group: string;
};
export type RouteGetMuteTimingsApiResponse = /** status 200 MuteTimings */ MuteTimings;
export type RouteGetMuteTimingsApiArg = void;
export type RoutePostMuteTimingApiResponse =
  /** status 201 MuteTimeInterval */ MuteTimeIntervalRepresentsANamedSetOfTimeIntervalsForWhichARouteShouldBeMuted;
export type RoutePostMuteTimingApiArg = {
  'X-Disable-Provenance'?: string;
  muteTimeInterval: MuteTimeIntervalRepresentsANamedSetOfTimeIntervalsForWhichARouteShouldBeMuted;
};
export type RouteExportMuteTimingsApiResponse =
  /** status 200 AlertingFileExport */ AlertingFileExportIsTheFullProvisionedFileExport;
export type RouteExportMuteTimingsApiArg = {
  /** Whether to initiate a download of the file or not. */
  download?: boolean;
  /** Format of the downloaded file. Supported yaml, json or hcl. Accept header can also be used, but the query parameter will take precedence. */
  format?: 'yaml' | 'json' | 'hcl';
};
export type RouteDeleteMuteTimingApiResponse = unknown;
export type RouteDeleteMuteTimingApiArg = {
  /** Mute timing name */
  name: string;
  /** Version of mute timing to use for optimistic concurrency. Leave empty to disable validation */
  version?: string;
  'X-Disable-Provenance'?: string;
};
export type RouteGetMuteTimingApiResponse =
  /** status 200 MuteTimeInterval */ MuteTimeIntervalRepresentsANamedSetOfTimeIntervalsForWhichARouteShouldBeMuted;
export type RouteGetMuteTimingApiArg = {
  /** Mute timing name */
  name: string;
};
export type RoutePutMuteTimingApiResponse =
  /** status 202 MuteTimeInterval */ MuteTimeIntervalRepresentsANamedSetOfTimeIntervalsForWhichARouteShouldBeMuted;
export type RoutePutMuteTimingApiArg = {
  /** Mute timing name */
  name: string;
  'X-Disable-Provenance'?: string;
  muteTimeInterval: MuteTimeIntervalRepresentsANamedSetOfTimeIntervalsForWhichARouteShouldBeMuted;
};
export type RouteExportMuteTimingApiResponse =
  /** status 200 AlertingFileExport */ AlertingFileExportIsTheFullProvisionedFileExport;
export type RouteExportMuteTimingApiArg = {
  /** Whether to initiate a download of the file or not. */
  download?: boolean;
  /** Format of the downloaded file. Supported yaml, json or hcl. Accept header can also be used, but the query parameter will take precedence. */
  format?: 'yaml' | 'json' | 'hcl';
  /** Mute timing name */
  name: string;
};
export type RouteResetPolicyTreeApiResponse = /** status 202 Ack */ Ack;
export type RouteResetPolicyTreeApiArg = void;
export type RouteGetPolicyTreeApiResponse = /** status 200 Route */ Route;
export type RouteGetPolicyTreeApiArg = void;
export type RoutePutPolicyTreeApiResponse = /** status 202 Ack */ Ack;
export type RoutePutPolicyTreeApiArg = {
  'X-Disable-Provenance'?: string;
  /** The new notification routing tree to use */
  route: Route;
};
export type RouteGetPolicyTreeExportApiResponse =
  /** status 200 AlertingFileExport */ AlertingFileExportIsTheFullProvisionedFileExport;
export type RouteGetPolicyTreeExportApiArg = void;
export type RouteGetTemplatesApiResponse = /** status 200 NotificationTemplates */ NotificationTemplates;
export type RouteGetTemplatesApiArg = void;
export type RouteDeleteTemplateApiResponse = unknown;
export type RouteDeleteTemplateApiArg = {
  /** Template group name */
  name: string;
  /** Version of template to use for optimistic concurrency. Leave empty to disable validation */
  version?: string;
};
export type RouteGetTemplateApiResponse = /** status 200 NotificationTemplate */ NotificationTemplate;
export type RouteGetTemplateApiArg = {
  /** Template group name */
  name: string;
};
export type RoutePutTemplateApiResponse = /** status 202 NotificationTemplate */ NotificationTemplate;
export type RoutePutTemplateApiArg = {
  /** Template group name */
  name: string;
  'X-Disable-Provenance'?: string;
  notificationTemplateContent: NotificationTemplateContent;
};
export type ListAllProvidersSettingsApiResponse = /** status 200 (empty) */ {
  id?: string;
  provider?: string;
  settings?: {
    [key: string]: any;
  };
  source?: string;
}[];
export type ListAllProvidersSettingsApiArg = void;
export type RemoveProviderSettingsApiResponse =
  /** status 204 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type RemoveProviderSettingsApiArg = {
  key: string;
};
export type GetProviderSettingsApiResponse = /** status 200 (empty) */ {
  id?: string;
  provider?: string;
  settings?: {
    [key: string]: any;
  };
  source?: string;
};
export type GetProviderSettingsApiArg = {
  key: string;
};
export type PatchProviderSettingsApiResponse =
  /** status 204 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type PatchProviderSettingsApiArg = {
  key: string;
  body: {
    settings?: {
      [key: string]: any;
    };
  };
};
export type UpdateProviderSettingsApiResponse =
  /** status 204 An OKResponse is returned if the request was successful. */ SuccessResponseBody;
export type UpdateProviderSettingsApiArg = {
  key: string;
  body: {
    id?: string;
    provider?: string;
    settings?: {
      [key: string]: any;
    };
  };
};
export type SearchResultItem = {
  action?: string;
  basicRole?: string;
  orgId?: number;
  roleName?: string;
  scope?: string;
  teamId?: number;
  userId?: number;
  version?: number;
};
export type SearchResult = {
  result?: SearchResultItem[];
};
export type ErrorResponseBody = {
  /** Error An optional detailed description of the actual error. Only included if running in developer mode. */
  error?: string;
  /** a human readable version of the error */
  message: string;
  /** Status An optional status to denote the cause of the error.
    
    For example, a 412 Precondition Failed error may include additional information of why that error happened. */
  status?: string;
};
export type Permission = {
  action?: string;
  created?: string;
  scope?: string;
  updated?: string;
};
export type RoleDto = {
  created: string;
  delegatable?: boolean;
  description: string;
  displayName: string;
  global?: boolean;
  group: string;
  hidden?: boolean;
  mapped?: boolean;
  name: string;
  permissions?: Permission[];
  uid: string;
  updated: string;
  version: number;
};
export type CreateRoleForm = {
  description?: string;
  displayName?: string;
  global?: boolean;
  group?: string;
  hidden?: boolean;
  name?: string;
  permissions?: Permission[];
  uid?: string;
  version?: number;
};
export type SuccessResponseBody = {
  message?: string;
};
export type UpdateRoleCommand = {
  description: string;
  displayName: string;
  global?: boolean;
  group: string;
  hidden?: boolean;
  name?: string;
  permissions?: Permission[];
  version?: number;
};
export type RoleAssignmentsDto = {
  role_uid?: string;
  service_accounts?: number[];
  teams?: number[];
  users?: number[];
};
export type SetRoleAssignmentsCommand = {
  service_accounts?: number[];
  teams?: number[];
  users?: number[];
};
export type Status = number;
export type RolesSearchQuery = {
  includeHidden?: boolean;
  orgId?: number;
  teamIds?: number[];
  userIds?: number[];
};
export type AddTeamRoleCommand = {
  roleUid?: string;
};
export type SetTeamRolesCommand = {
  includeHidden?: boolean;
  roleUids?: string[];
};
export type AddUserRoleCommand = {
  global?: boolean;
  roleUid?: string;
};
export type SetUserRolesCommand = {
  global?: boolean;
  includeHidden?: boolean;
  roleUids?: string[];
};
export type Assignments = {
  builtInRoles?: boolean;
  serviceAccounts?: boolean;
  teams?: boolean;
  users?: boolean;
};
export type Description = {
  assignments?: Assignments;
  permissions?: string[];
};
export type ResourcePermissionDto = {
  actions?: string[];
  builtInRole?: string;
  id?: number;
  isInherited?: boolean;
  isManaged?: boolean;
  isServiceAccount?: boolean;
  permission?: string;
  roleName?: string;
  team?: string;
  teamAvatarUrl?: string;
  teamId?: number;
  teamUid?: string;
  userAvatarUrl?: string;
  userId?: number;
  userLogin?: string;
  userUid?: string;
};
export type SetResourcePermissionCommand = {
  builtInRole?: string;
  permission?: string;
  teamId?: number;
  userId?: number;
};
export type SetPermissionsCommand = {
  permissions?: SetResourcePermissionCommand[];
};
export type SetPermissionCommand = {
  permission?: string;
};
export type Duration = number;
export type FailedUser = {
  Error?: string;
  Login?: string;
};
export type SyncResultHoldsTheResultOfASyncWithLdapThisGivesUsInformationOnWhichUsersWereUpdatedAndHow = {
  Elapsed?: Duration;
  FailedUsers?: FailedUser[];
  MissingUserIds?: number[];
  Started?: string;
  UpdatedUserIds?: number[];
};
export type ActiveSyncStatusDto = {
  enabled?: boolean;
  nextSync?: string;
  prevSync?: SyncResultHoldsTheResultOfASyncWithLdapThisGivesUsInformationOnWhichUsersWereUpdatedAndHow;
  schedule?: string;
};
export type SettingsBag = {
  [key: string]: {
    [key: string]: string;
  };
};
export type AdminStats = {
  activeAdmins?: number;
  activeDevices?: number;
  activeEditors?: number;
  activeSessions?: number;
  activeUsers?: number;
  activeViewers?: number;
  admins?: number;
  alerts?: number;
  dailyActiveAdmins?: number;
  dailyActiveEditors?: number;
  dailyActiveSessions?: number;
  dailyActiveUsers?: number;
  dailyActiveViewers?: number;
  dashboards?: number;
  datasources?: number;
  editors?: number;
  monthlyActiveUsers?: number;
  orgs?: number;
  playlists?: number;
  snapshots?: number;
  stars?: number;
  tags?: number;
  users?: number;
  viewers?: number;
};
export type AdminCreateUserResponse = {
  id?: number;
  message?: string;
  uid?: string;
};
export type Password = string;
export type AdminCreateUserForm = {
  email?: string;
  login?: string;
  name?: string;
  orgId?: number;
  password?: Password;
};
export type UserToken = {
  AuthToken?: string;
  AuthTokenSeen?: boolean;
  ClientIp?: string;
  CreatedAt?: number;
  ExternalSessionId?: number;
  Id?: number;
  PrevAuthToken?: string;
  RevokedAt?: number;
  RotatedAt?: number;
  SeenAt?: number;
  UnhashedToken?: string;
  UpdatedAt?: number;
  UserAgent?: string;
  UserId?: number;
};
export type AdminUpdateUserPasswordForm = {
  password?: Password;
};
export type AdminUpdateUserPermissionsForm = {
  isGrafanaAdmin?: boolean;
};
export type QuotaDto = {
  limit?: number;
  org_id?: number;
  target?: string;
  used?: number;
  user_id?: number;
};
export type UpdateQuotaCmd = {
  limit?: number;
  target?: string;
};
export type RevokeAuthTokenCmd = {
  authTokenId?: number;
};
export type Json = object;
export type Annotation = {
  alertId?: number;
  alertName?: string;
  avatarUrl?: string;
  created?: number;
  /** Deprecated: Use DashboardUID and OrgID instead */
  dashboardId?: number;
  dashboardUID?: string;
  data?: Json;
  email?: string;
  id?: number;
  login?: string;
  newState?: string;
  panelId?: number;
  prevState?: string;
  tags?: string[];
  text?: string;
  time?: number;
  timeEnd?: number;
  updated?: number;
  userId?: number;
};
export type PostAnnotationsCmd = {
  dashboardId?: number;
  dashboardUID?: string;
  data?: Json;
  panelId?: number;
  tags?: string[];
  text: string;
  time?: number;
  timeEnd?: number;
};
export type PostGraphiteAnnotationsCmd = {
  data?: string;
  tags?: any;
  what?: string;
  when?: number;
};
export type MassDeleteAnnotationsCmd = {
  annotationId?: number;
  dashboardId?: number;
  dashboardUID?: string;
  panelId?: number;
};
export type TagsDtoIsTheFrontendDtoForTag = {
  count?: number;
  tag?: string;
};
export type FindTagsResultIsTheResultOfATagsSearch = {
  tags?: TagsDtoIsTheFrontendDtoForTag[];
};
export type GetAnnotationTagsResponseIsAResponseStructForFindTagsResult = {
  result?: FindTagsResultIsTheResultOfATagsSearch;
};
export type PatchAnnotationsCmd = {
  data?: Json;
  id?: number;
  tags?: string[];
  text?: string;
  time?: number;
  timeEnd?: number;
};
export type UpdateAnnotationsCmd = {
  data?: Json;
  id?: number;
  tags?: string[];
  text?: string;
  time?: number;
  timeEnd?: number;
};
export type DeviceDto = {
  avatarUrl?: string;
  clientIp?: string;
  createdAt?: string;
  deviceId?: string;
  lastSeenAt?: string;
  updatedAt?: string;
  userAgent?: string;
};
export type DeviceSearchHitDto = {
  clientIp?: string;
  createdAt?: string;
  deviceId?: string;
  lastSeenAt?: string;
  updatedAt?: string;
  userAgent?: string;
};
export type SearchDeviceQueryResult = {
  devices?: DeviceSearchHitDto[];
  page?: number;
  perPage?: number;
  totalCount?: number;
};
export type CloudMigrationSessionResponseDto = {
  created?: string;
  slug?: string;
  uid?: string;
  updated?: string;
};
export type CloudMigrationSessionListResponseDto = {
  sessions?: CloudMigrationSessionResponseDto[];
};
export type CloudMigrationSessionRequestDto = {
  authToken?: string;
};
export type CreateSnapshotResponseDto = {
  uid?: string;
};
export type CreateSnapshotRequestDto = {
  resourceTypes?: (
    | 'DASHBOARD'
    | 'DATASOURCE'
    | 'FOLDER'
    | 'LIBRARY_ELEMENT'
    | 'ALERT_RULE'
    | 'ALERT_RULE_GROUP'
    | 'CONTACT_POINT'
    | 'NOTIFICATION_POLICY'
    | 'NOTIFICATION_TEMPLATE'
    | 'MUTE_TIMING'
    | 'PLUGIN'
  )[];
};
export type MigrateDataResponseItemDto = {
  errorCode?:
    | 'ALERT_RULES_QUOTA_REACHED'
    | 'ALERT_RULES_GROUP_QUOTA_REACHED'
    | 'DATASOURCE_NAME_CONFLICT'
    | 'DATASOURCE_INVALID_URL'
    | 'DATASOURCE_ALREADY_MANAGED'
    | 'FOLDER_NAME_CONFLICT'
    | 'DASHBOARD_ALREADY_MANAGED'
    | 'LIBRARY_ELEMENT_NAME_CONFLICT'
    | 'UNSUPPORTED_DATA_TYPE'
    | 'RESOURCE_CONFLICT'
    | 'UNEXPECTED_STATUS_CODE'
    | 'INTERNAL_SERVICE_ERROR'
    | 'GENERIC_ERROR';
  message?: string;
  name?: string;
  parentName?: string;
  refId: string;
  status: 'OK' | 'WARNING' | 'ERROR' | 'PENDING' | 'UNKNOWN';
  type:
    | 'DASHBOARD'
    | 'DATASOURCE'
    | 'FOLDER'
    | 'LIBRARY_ELEMENT'
    | 'ALERT_RULE'
    | 'ALERT_RULE_GROUP'
    | 'CONTACT_POINT'
    | 'NOTIFICATION_POLICY'
    | 'NOTIFICATION_TEMPLATE'
    | 'MUTE_TIMING'
    | 'PLUGIN';
};
export type SnapshotResourceStats = {
  statuses?: {
    [key: string]: number;
  };
  total?: number;
  types?: {
    [key: string]: number;
  };
};
export type GetSnapshotResponseDto = {
  created?: string;
  finished?: string;
  results?: MigrateDataResponseItemDto[];
  sessionUid?: string;
  stats?: SnapshotResourceStats;
  status?:
    | 'INITIALIZING'
    | 'CREATING'
    | 'PENDING_UPLOAD'
    | 'UPLOADING'
    | 'PENDING_PROCESSING'
    | 'PROCESSING'
    | 'FINISHED'
    | 'CANCELED'
    | 'ERROR'
    | 'UNKNOWN';
  uid?: string;
};
export type SnapshotDto = {
  created?: string;
  finished?: string;
  sessionUid?: string;
  status?:
    | 'INITIALIZING'
    | 'CREATING'
    | 'PENDING_UPLOAD'
    | 'UPLOADING'
    | 'PENDING_PROCESSING'
    | 'PROCESSING'
    | 'FINISHED'
    | 'CANCELED'
    | 'ERROR'
    | 'UNKNOWN';
  uid?: string;
};
export type SnapshotListResponseDto = {
  snapshots?: SnapshotDto[];
};
export type ResourceDependencyDto = {
  dependencies?: (
    | 'DASHBOARD'
    | 'DATASOURCE'
    | 'FOLDER'
    | 'LIBRARY_ELEMENT'
    | 'ALERT_RULE'
    | 'ALERT_RULE_GROUP'
    | 'CONTACT_POINT'
    | 'NOTIFICATION_POLICY'
    | 'NOTIFICATION_TEMPLATE'
    | 'MUTE_TIMING'
    | 'PLUGIN'
  )[];
  resourceType?:
    | 'DASHBOARD'
    | 'DATASOURCE'
    | 'FOLDER'
    | 'LIBRARY_ELEMENT'
    | 'ALERT_RULE'
    | 'ALERT_RULE_GROUP'
    | 'CONTACT_POINT'
    | 'NOTIFICATION_POLICY'
    | 'NOTIFICATION_TEMPLATE'
    | 'MUTE_TIMING'
    | 'PLUGIN';
};
export type ResourceDependenciesResponseDto = {
  resourceDependencies?: ResourceDependencyDto[];
};
export type GetAccessTokenResponseDto = {
  createdAt?: string;
  displayName?: string;
  expiresAt?: string;
  firstUsedAt?: string;
  id?: string;
  lastUsedAt?: string;
};
export type CreateAccessTokenResponseDto = {
  token?: string;
};
export type ConvertPrometheusResponse = {
  error?: string;
  errorType?: string;
  status?: string;
};
export type PublicError = {
  extra?: {
    [key: string]: any;
  };
  message?: string;
  messageId?: string;
  statusCode?: number;
};
export type ForbiddenError = {
  body?: PublicError;
};
export type PrometheusRule = {
  alert?: string;
  annotations?: {
    [key: string]: string;
  };
  expr?: string;
  for?: string;
  keep_firing_for?: string;
  labels?: {
    [key: string]: string;
  };
  record?: string;
};
export type PrometheusRuleGroup = {
  interval?: Duration;
  labels?: {
    [key: string]: string;
  };
  limit?: number;
  name?: string;
  query_offset?: string;
  rules?: PrometheusRule[];
};
export type DashboardSnapshotDto = {
  created?: string;
  expires?: string;
  external?: boolean;
  externalUrl?: string;
  key?: string;
  name?: string;
  updated?: string;
};
export type SaveDashboardCommand = {
  UpdatedAt?: string;
  dashboard?: Json;
  /** Deprecated: use FolderUID instead */
  folderId?: number;
  folderUid?: string;
  isFolder?: boolean;
  message?: string;
  overwrite?: boolean;
  userId?: number;
};
export type ImportDashboardResponseResponseObjectReturnedWhenImportingADashboard = {
  dashboardId?: number;
  description?: string;
  /** Deprecated: use FolderUID instead */
  folderId?: number;
  folderUid?: string;
  imported?: boolean;
  importedRevision?: number;
  importedUri?: string;
  importedUrl?: string;
  path?: string;
  pluginId?: string;
  removed?: boolean;
  revision?: number;
  slug?: string;
  title?: string;
  uid?: string;
};
export type ImportDashboardInputDefinitionOfInputParametersWhenImportingADashboard = {
  name?: string;
  pluginId?: string;
  type?: string;
  value?: string;
};
export type ImportDashboardRequestRequestObjectForImportingADashboard = {
  dashboard?: Json;
  /** Deprecated: use FolderUID instead */
  folderId?: number;
  folderUid?: string;
  inputs?: ImportDashboardInputDefinitionOfInputParametersWhenImportingADashboard[];
  overwrite?: boolean;
  path?: string;
  pluginId?: string;
};
export type PublicDashboardListResponse = {
  accessToken?: string;
  dashboardUid?: string;
  isEnabled?: boolean;
  slug?: string;
  title?: string;
  uid?: string;
};
export type PublicDashboardListResponseWithPagination = {
  page?: number;
  perPage?: number;
  publicDashboards?: PublicDashboardListResponse[];
  totalCount?: number;
};
export type PublicError2 = {
  /** Extra Additional information about the error */
  extra?: {
    [key: string]: any;
  };
  /** Message A human readable message */
  message?: string;
  /** MessageID A unique identifier for the error */
  messageId: string;
  /** StatusCode The HTTP status code returned */
  statusCode: number;
};
export type DashboardTagCloudItem = {
  count?: number;
  term?: string;
};
export type EmailDto = {
  recipient?: string;
  uid?: string;
};
export type ShareType = string;
export type PublicDashboard = {
  accessToken?: string;
  annotationsEnabled?: boolean;
  createdAt?: string;
  createdBy?: number;
  dashboardUid?: string;
  isEnabled?: boolean;
  recipients?: EmailDto[];
  share?: ShareType;
  timeSelectionEnabled?: boolean;
  uid?: string;
  updatedAt?: string;
  updatedBy?: number;
};
export type PublicDashboardDto = {
  accessToken?: string;
  annotationsEnabled?: boolean;
  isEnabled?: boolean;
  share?: ShareType;
  timeSelectionEnabled?: boolean;
  uid?: string;
};
export type AnnotationActions = {
  canAdd?: boolean;
  canDelete?: boolean;
  canEdit?: boolean;
};
export type AnnotationPermission = {
  dashboard?: AnnotationActions;
  organization?: AnnotationActions;
};
export type DashboardMeta = {
  annotationsPermissions?: AnnotationPermission;
  apiVersion?: string;
  canAdmin?: boolean;
  canDelete?: boolean;
  canEdit?: boolean;
  canSave?: boolean;
  canStar?: boolean;
  created?: string;
  createdBy?: string;
  expires?: string;
  /** Deprecated: use FolderUID instead */
  folderId?: number;
  folderTitle?: string;
  folderUid?: string;
  folderUrl?: string;
  hasAcl?: boolean;
  isFolder?: boolean;
  isSnapshot?: boolean;
  isStarred?: boolean;
  provisioned?: boolean;
  provisionedExternalId?: string;
  publicDashboardEnabled?: boolean;
  slug?: string;
  type?: string;
  updated?: string;
  updatedBy?: string;
  url?: string;
  version?: number;
};
export type DashboardFullWithMeta = {
  dashboard?: Json;
  meta?: DashboardMeta;
};
export type PermissionType = number;
export type DashboardAclInfoDto = {
  created?: string;
  dashboardId?: number;
  /** Deprecated: use FolderUID instead */
  folderId?: number;
  folderUid?: string;
  inherited?: boolean;
  isFolder?: boolean;
  permission?: PermissionType;
  permissionName?: string;
  role?: 'None' | 'Viewer' | 'Editor' | 'Admin';
  slug?: string;
  team?: string;
  teamAvatarUrl?: string;
  teamEmail?: string;
  teamId?: number;
  teamUid?: string;
  title?: string;
  uid?: string;
  updated?: string;
  url?: string;
  userAvatarUrl?: string;
  userEmail?: string;
  userId?: number;
  userLogin?: string;
  userUid?: string;
};
export type DashboardAclUpdateItem = {
  permission?: PermissionType;
  role?: 'None' | 'Viewer' | 'Editor' | 'Admin';
  teamId?: number;
  userId?: number;
};
export type UpdateDashboardAclCommand = {
  items?: DashboardAclUpdateItem[];
};
export type DashboardVersionMeta = {
  created?: string;
  createdBy?: string;
  dashboardId?: number;
  data?: Json;
  id?: number;
  message?: string;
  parentVersion?: number;
  restoredFrom?: number;
  uid?: string;
  version?: number;
};
export type DashboardVersionResponseMeta = {
  continueToken?: string;
  versions?: DashboardVersionMeta[];
};
export type DsAccess = string;
export type DataSourceListItemDto = {
  access?: DsAccess;
  basicAuth?: boolean;
  database?: string;
  id?: number;
  isDefault?: boolean;
  jsonData?: Json;
  name?: string;
  orgId?: number;
  readOnly?: boolean;
  type?: string;
  typeLogoUrl?: string;
  typeName?: string;
  uid?: string;
  url?: string;
  user?: string;
};
export type DataSourceList = DataSourceListItemDto[];
export type Metadata = {
  [key: string]: boolean;
};
export type DataSource = {
  access?: DsAccess;
  accessControl?: Metadata;
  basicAuth?: boolean;
  basicAuthUser?: string;
  database?: string;
  id?: number;
  isDefault?: boolean;
  jsonData?: Json;
  name?: string;
  orgId?: number;
  readOnly?: boolean;
  secureJsonFields?: {
    [key: string]: boolean;
  };
  type?: string;
  typeLogoUrl?: string;
  uid?: string;
  url?: string;
  user?: string;
  version?: number;
  withCredentials?: boolean;
};
export type AddDataSourceCommand = {
  access?: DsAccess;
  basicAuth?: boolean;
  basicAuthUser?: string;
  database?: string;
  isDefault?: boolean;
  jsonData?: Json;
  name?: string;
  secureJsonData?: {
    [key: string]: string;
  };
  type?: string;
  uid?: string;
  url?: string;
  user?: string;
  withCredentials?: boolean;
};
export type Transformation = {
  expression?: string;
  field?: string;
  mapValue?: string;
  type?: 'regex' | 'logfmt';
};
export type Transformations = Transformation[];
export type CorrelationType = string;
export type CorrelationConfig = {
  /** Field used to attach the correlation link */
  field: string;
  /** Target data query */
  target: {
    [key: string]: any;
  };
  transformations?: Transformations;
  type?: CorrelationType;
};
export type Correlation = {
  config?: CorrelationConfig;
  /** Description of the correlation */
  description?: string;
  /** Label identifying the correlation */
  label?: string;
  /** OrgID of the data source the correlation originates from */
  orgId?: number;
  /** Provisioned True if the correlation was created during provisioning */
  provisioned?: boolean;
  /** UID of the data source the correlation originates from */
  sourceUID?: string;
  /** UID of the data source the correlation points to */
  targetUID?: string;
  type?: CorrelationType;
  /** Unique identifier of the correlation */
  uid?: string;
};
export type CreateCorrelationResponseBody = {
  message?: string;
  result?: Correlation;
};
export type CreateCorrelationCommand = {
  config?: CorrelationConfig;
  /** Optional description of the correlation */
  description?: string;
  /** Optional label identifying the correlation */
  label?: string;
  /** True if correlation was created with provisioning. This makes it read-only. */
  provisioned?: boolean;
  /** Target data source UID to which the correlation is created. required if type = query */
  targetUID?: string;
  type?: CorrelationType;
};
export type UpdateCorrelationResponseBody = {
  message?: string;
  result?: Correlation;
};
export type CorrelationConfigUpdateDto = {
  /** Field used to attach the correlation link */
  field?: string;
  /** Target data query */
  target?: {
    [key: string]: any;
  };
  /** Source data transformations */
  transformations?: Transformation[];
};
export type UpdateCorrelationCommand = {
  config?: CorrelationConfigUpdateDto;
  /** Optional description of the correlation */
  description?: string;
  /** Optional label identifying the correlation */
  label?: string;
  type?: CorrelationType;
};
export type UpdateDataSourceCommand = {
  access?: DsAccess;
  basicAuth?: boolean;
  basicAuthUser?: string;
  database?: string;
  isDefault?: boolean;
  jsonData?: Json;
  name?: string;
  secureJsonData?: {
    [key: string]: string;
  };
  type?: string;
  uid?: string;
  url?: string;
  user?: string;
  /** The previous version -- used for optimistic locking */
  version?: number;
  withCredentials?: boolean;
};
export type DeleteCorrelationResponseBody = {
  message?: string;
};
export type TeamLbacRule = {
  rules?: string[];
  teamId?: string;
  teamUid?: string;
};
export type TeamLbacRules = {
  rules?: TeamLbacRule[];
};
export type UpdateTeamLbacCommand = {
  rules?: TeamLbacRule[];
};
export type CacheConfigResponse = {
  created?: string;
  /** Fields that can be set by the API caller - read/write */
  dataSourceID?: number;
  dataSourceUID?: string;
  /** These are returned by the HTTP API, but are managed internally - read-only
    Note: 'created' and 'updated' are special properties managed automatically by xorm, but we are setting them manually */
  defaultTTLMs?: number;
  enabled?: boolean;
  message?: string;
  /** TTL MS, or "time to live", is how long a cached item will stay in the cache before it is removed (in milliseconds) */
  ttlQueriesMs?: number;
  ttlResourcesMs?: number;
  updated?: string;
  /** If UseDefaultTTL is enabled, then the TTLQueriesMS and TTLResourcesMS in this object is always sent as the default TTL located in grafana.ini */
  useDefaultTTL?: boolean;
};
export type CacheConfigSetter = {
  dataSourceID?: number;
  dataSourceUID?: string;
  enabled?: boolean;
  /** TTL MS, or "time to live", is how long a cached item will stay in the cache before it is removed (in milliseconds) */
  ttlQueriesMs?: number;
  ttlResourcesMs?: number;
  /** If UseDefaultTTL is enabled, then the TTLQueriesMS and TTLResourcesMS in this object is always sent as the default TTL located in grafana.ini */
  useDefaultTTL?: boolean;
};
export type SourceTypeDefinesTheStatusSource = string;
export type ExplorePanelsState = any;
export type TimeRange = {
  from?: string;
  to?: string;
};
export type SupportedTransformationTypes = string;
export type LinkTransformationConfig = {
  expression?: string;
  field?: string;
  mapValue?: string;
  type?: SupportedTransformationTypes;
};
export type InternalDataLink = {
  datasourceName?: string;
  datasourceUid?: string;
  panelsState?: ExplorePanelsState;
  query?: any;
  timeRange?: TimeRange;
  transformations?: LinkTransformationConfig[];
};
export type DataLink = {
  internal?: InternalDataLink;
  targetBlank?: boolean;
  title?: string;
  url?: string;
};
export type ValueMapping = object;
export type ValueMappings = ValueMapping[];
export type ConfFloat64 = number;
export type ThresholdsMode = string;
export type Threshold = {
  color?: string;
  state?: string;
  value?: ConfFloat64;
};
export type ThresholdsConfig = {
  mode?: ThresholdsMode;
  /** Must be sorted by 'value', first value is always -Infinity */
  steps?: Threshold[];
};
export type EnumFieldConfig = {
  /** Color is the color value for a given index (empty is undefined) */
  color?: string[];
  /** Description of the enum state */
  description?: string[];
  /** Icon supports setting an icon for a given index value */
  icon?: string[];
  /** Value is the string display value for a given index */
  text?: string[];
};
export type FieldTypeConfig = {
  enum?: EnumFieldConfig;
};
export type FieldConfigRepresentsTheDisplayPropertiesForAField = {
  /** Map values to a display color
    NOTE: this interface is under development in the frontend... so simple map for now */
  color?: {
    [key: string]: any;
  };
  /** Panel Specific Values */
  custom?: {
    [key: string]: any;
  };
  decimals?: number;
  /** Description is human readable field metadata */
  description?: string;
  /** DisplayName overrides Grafana default naming, should not be used from a data source */
  displayName?: string;
  /** DisplayNameFromDS overrides Grafana default naming strategy. */
  displayNameFromDS?: string;
  /** Filterable indicates if the Field's data can be filtered by additional calls. */
  filterable?: boolean;
  /** Interval indicates the expected regular step between values in the series.
    When an interval exists, consumers can identify "missing" values when the expected value is not present.
    The grafana timeseries visualization will render disconnected values when missing values are found it the time field.
    The interval uses the same units as the values.  For time.Time, this is defined in milliseconds. */
  interval?: number;
  /** The behavior when clicking on a result */
  links?: DataLink[];
  mappings?: ValueMappings;
  max?: ConfFloat64;
  min?: ConfFloat64;
  /** Alternative to empty string */
  noValue?: string;
  /** Path is an explicit path to the field in the datasource. When the frame meta includes a path,
    this will default to `${frame.meta.path}/${field.name}
    
    When defined, this value can be used as an identifier within the datasource scope, and
    may be used as an identifier to update values in a subsequent request */
  path?: string;
  thresholds?: ThresholdsConfig;
  type?: FieldTypeConfig;
  /** Numeric Options */
  unit?: string;
  /** Writeable indicates that the datasource knows how to update this value */
  writeable?: boolean;
};
export type FrameLabels = {
  [key: string]: string;
};
export type FieldRepresentsATypedColumnOfDataWithinAFrame = {
  config?: FieldConfigRepresentsTheDisplayPropertiesForAField;
  labels?: FrameLabels;
  /** Name is default identifier of the field. The name does not have to be unique, but the combination
    of name and Labels should be unique for proper behavior in all situations. */
  name?: string;
};
export type DataTopicIsUsedToIdentifyWhichTopicTheFrameShouldBeAssignedTo = string;
export type InspectTypeIsATypeForTheInspectPropertyOfANotice = number;
export type NoticeSeverityIsATypeForTheSeverityPropertyOfANotice = number;
export type NoticeProvidesAStructureForPresentingNotificationsInGrafanasUserInterface = {
  inspect?: InspectTypeIsATypeForTheInspectPropertyOfANotice;
  /** Link is an optional link for display in the user interface and can be an
    absolute URL or a path relative to Grafana's root url. */
  link?: string;
  severity?: NoticeSeverityIsATypeForTheSeverityPropertyOfANotice;
  /** Text is freeform descriptive text for the notice. */
  text?: string;
};
export type VisTypeIsUsedToIndicateHowTheDataShouldBeVisualizedInExplore = string;
export type QueryStatIsUsedForStoringArbitraryStatisticsMetadataRelatedToAQueryAndItsResultEGTotalRequestTimeDataProcessingTime =
  {
    /** Map values to a display color
    NOTE: this interface is under development in the frontend... so simple map for now */
    color?: {
      [key: string]: any;
    };
    /** Panel Specific Values */
    custom?: {
      [key: string]: any;
    };
    decimals?: number;
    /** Description is human readable field metadata */
    description?: string;
    /** DisplayName overrides Grafana default naming, should not be used from a data source */
    displayName?: string;
    /** DisplayNameFromDS overrides Grafana default naming strategy. */
    displayNameFromDS?: string;
    /** Filterable indicates if the Field's data can be filtered by additional calls. */
    filterable?: boolean;
    /** Interval indicates the expected regular step between values in the series.
    When an interval exists, consumers can identify "missing" values when the expected value is not present.
    The grafana timeseries visualization will render disconnected values when missing values are found it the time field.
    The interval uses the same units as the values.  For time.Time, this is defined in milliseconds. */
    interval?: number;
    /** The behavior when clicking on a result */
    links?: DataLink[];
    mappings?: ValueMappings;
    max?: ConfFloat64;
    min?: ConfFloat64;
    /** Alternative to empty string */
    noValue?: string;
    /** Path is an explicit path to the field in the datasource. When the frame meta includes a path,
    this will default to `${frame.meta.path}/${field.name}
    
    When defined, this value can be used as an identifier within the datasource scope, and
    may be used as an identifier to update values in a subsequent request */
    path?: string;
    thresholds?: ThresholdsConfig;
    type?: FieldTypeConfig;
    /** Numeric Options */
    unit?: string;
    value?: number;
    /** Writeable indicates that the datasource knows how to update this value */
    writeable?: boolean;
  };
export type FrameType = string;
export type FrameTypeIsA2NumberVersionMajorMinor = number[];
export type FrameMetaMatches = {
  /** Channel is the path to a stream in grafana live that has real-time updates for this data. */
  channel?: string;
  /** Custom datasource specific values. */
  custom?: any;
  dataTopic?: DataTopicIsUsedToIdentifyWhichTopicTheFrameShouldBeAssignedTo;
  /** ExecutedQueryString is the raw query sent to the underlying system. All macros and templating
    have been applied.  When metadata contains this value, it will be shown in the query inspector. */
  executedQueryString?: string;
  /** Notices provide additional information about the data in the Frame that
    Grafana can display to the user in the user interface. */
  notices?: NoticeProvidesAStructureForPresentingNotificationsInGrafanasUserInterface[];
  /** Path is a browsable path on the datasource. */
  path?: string;
  /** PathSeparator defines the separator pattern to decode a hierarchy. The default separator is '/'. */
  pathSeparator?: string;
  /** PreferredVisualizationPluginId sets the panel plugin id to use to render the data when using Explore. If
    the plugin cannot be found will fall back to PreferredVisualization. */
  preferredVisualisationPluginId?: string;
  preferredVisualisationType?: VisTypeIsUsedToIndicateHowTheDataShouldBeVisualizedInExplore;
  /** Stats is an array of query result statistics. */
  stats?: QueryStatIsUsedForStoringArbitraryStatisticsMetadataRelatedToAQueryAndItsResultEGTotalRequestTimeDataProcessingTime[];
  type?: FrameType;
  typeVersion?: FrameTypeIsA2NumberVersionMajorMinor;
  /** Array of field indices which values create a unique id for each row. Ideally this should be globally unique ID
    but that isn't guarantied. Should help with keeping track and deduplicating rows in visualizations, especially
    with streaming data with frequent updates. */
  uniqueRowIdFields?: number[];
};
export type FrameIsAColumnarDataStructureWhereEachColumnIsAField = {
  /** Fields are the columns of a frame.
    All Fields must be of the same the length when marshalling the Frame for transmission.
    There should be no `nil` entries in the Fields slice (making them pointers was a mistake). */
  Fields?: FieldRepresentsATypedColumnOfDataWithinAFrame[];
  Meta?: FrameMetaMatches;
  /** Name is used in some Grafana visualizations. */
  Name?: string;
  /** RefID is a property that can be set to match a Frame to its originating query. */
  RefID?: string;
};
export type FramesIsASliceOfFramePointers = FrameIsAColumnarDataStructureWhereEachColumnIsAField[];
export type DataResponseContainsTheResultsFromADataQuery = {
  /** Error is a property to be set if the corresponding DataQuery has an error. */
  Error?: string;
  ErrorSource?: SourceTypeDefinesTheStatusSource;
  Frames?: FramesIsASliceOfFramePointers;
  Status?: Status;
};
export type ResponsesIsAMapOfRefIDsUniqueQueryIdToDataResponses = {
  [key: string]: DataResponseContainsTheResultsFromADataQuery;
};
export type QueryDataResponseContainsTheResultsFromAQueryDataRequest = {
  results?: ResponsesIsAMapOfRefIDsUniqueQueryIdToDataResponses;
};
export type MetricRequest = {
  debug?: boolean;
  /** From Start time in epoch timestamps in milliseconds or relative using Grafana time units. */
  from: string;
  /** queries.refId – Specifies an identifier of the query. Is optional and default to “A”.
    queries.datasourceId – Specifies the data source to be queried. Each query in the request must have an unique datasourceId.
    queries.maxDataPoints - Species maximum amount of data points that dashboard panel can render. Is optional and default to 100.
    queries.intervalMs - Specifies the time interval in milliseconds of time series. Is optional and defaults to 1000. */
  queries: Json[];
  /** To End time in epoch timestamps in milliseconds or relative using Grafana time units. */
  to: string;
};
export type ManagerKindIsTheTypeOfManagerWhichIsResponsibleForManagingTheResource = string;
export type FolderSearchHit = {
  id?: number;
  managedBy?: ManagerKindIsTheTypeOfManagerWhichIsResponsibleForManagingTheResource;
  parentUid?: string;
  title?: string;
  uid?: string;
};
export type Folder = {
  accessControl?: Metadata;
  canAdmin?: boolean;
  canDelete?: boolean;
  canEdit?: boolean;
  canSave?: boolean;
  created?: string;
  createdBy?: string;
  hasAcl?: boolean;
  /** Deprecated: use UID instead */
  id?: number;
  managedBy?: ManagerKindIsTheTypeOfManagerWhichIsResponsibleForManagingTheResource;
  orgId?: number;
  /** only used if nested folders are enabled */
  parentUid?: string;
  /** the parent folders starting from the root going down */
  parents?: Folder[];
  title?: string;
  uid?: string;
  updated?: string;
  updatedBy?: string;
  url?: string;
  version?: number;
};
export type CreateFolderCommand = {
  description?: string;
  parentUid?: string;
  title?: string;
  uid?: string;
};
export type UpdateFolderCommand = {
  /** NewDescription it's an optional parameter used for overriding the existing folder description */
  description?: string;
  /** Overwrite only used by the legacy folder implementation */
  overwrite?: boolean;
  /** NewTitle it's an optional parameter used for overriding the existing folder title */
  title?: string;
  /** Version only used by the legacy folder implementation */
  version?: number;
};
export type DescendantCounts = {
  [key: string]: number;
};
export type MoveFolderCommand = {
  parentUid?: string;
};
export type Group = {
  groupID?: string;
  mappings?: any;
};
export type GetGroupsResponse = {
  groups?: Group[];
  total?: number;
};
export type MessageResponse = {
  message?: string;
};
export type GroupAttributes = {
  roles?: string[];
};
export type HealthResponse = {
  commit?: string;
  database?: string;
  enterpriseCommit?: string;
  version?: string;
};
export type LibraryElementDtoMetaUser = {
  avatarUrl?: string;
  id?: number;
  name?: string;
};
export type LibraryElementDtoMetaIsTheMetaInformationForLibraryElementDto = {
  connectedDashboards?: number;
  created?: string;
  createdBy?: LibraryElementDtoMetaUser;
  folderName?: string;
  folderUid?: string;
  updated?: string;
  updatedBy?: LibraryElementDtoMetaUser;
};
export type LibraryElementDtoIsTheFrontendDtoForEntities = {
  description?: string;
  /** Deprecated: use FolderUID instead */
  folderId?: number;
  folderUid?: string;
  id?: number;
  kind?: number;
  meta?: LibraryElementDtoMetaIsTheMetaInformationForLibraryElementDto;
  model?: object;
  name?: string;
  orgId?: number;
  schemaVersion?: number;
  type?: string;
  uid?: string;
  version?: number;
};
export type LibraryElementSearchResultIsTheSearchResultForEntities = {
  elements?: LibraryElementDtoIsTheFrontendDtoForEntities[];
  page?: number;
  perPage?: number;
  totalCount?: number;
};
export type LibraryElementSearchResponseIsAResponseStructForLibraryElementSearchResult = {
  result?: LibraryElementSearchResultIsTheSearchResultForEntities;
};
export type LibraryElementResponseIsAResponseStructForLibraryElementDto = {
  result?: LibraryElementDtoIsTheFrontendDtoForEntities;
};
export type CreateLibraryElementCommand = {
  /** ID of the folder where the library element is stored.
    
    Deprecated: use FolderUID instead */
  folderId?: number;
  /** UID of the folder where the library element is stored. */
  folderUid?: string;
  /** Kind of element to create, Use 1 for library panels or 2 for c.
    Description:
    1 - library panels */
  kind?: 1;
  /** The JSON model for the library element. */
  model?: object;
  /** Name of the library element. */
  name?: string;
  uid?: string;
};
export type LibraryElementArrayResponseIsAResponseStructForAnArrayOfLibraryElementDto = {
  result?: LibraryElementDtoIsTheFrontendDtoForEntities[];
};
export type PatchLibraryElementCommand = {
  /** ID of the folder where the library element is stored.
    
    Deprecated: use FolderUID instead */
  folderId?: number;
  /** UID of the folder where the library element is stored. */
  folderUid?: string;
  /** Kind of element to create, Use 1 for library panels or 2 for c.
    Description:
    1 - library panels */
  kind?: 1;
  /** The JSON model for the library element. */
  model?: object;
  /** Name of the library element. */
  name?: string;
  uid?: string;
  /** Version of the library element you are updating. */
  version?: number;
};
export type LibraryElementConnectionDtoIsTheFrontendDtoForElementConnections = {
  connectionId?: number;
  connectionUid?: string;
  created?: string;
  createdBy?: LibraryElementDtoMetaUser;
  elementId?: number;
  /** Deprecated: this field will be removed in the future */
  id?: number;
  kind?: number;
};
export type LibraryElementConnectionsResponseIsAResponseStructForAnArrayOfLibraryElementConnectionDto = {
  result?: LibraryElementConnectionDtoIsTheFrontendDtoForElementConnections[];
};
export type ActiveUserStats = {
  active_admins_and_editors?: number;
  active_anonymous_devices?: number;
  active_users?: number;
  active_viewers?: number;
};
export type DeleteTokenCommand = {
  instance?: string;
};
export type TokenStatus = number;
export type Token = {
  account?: string;
  anonymousRatio?: number;
  company?: string;
  details_url?: string;
  exp?: number;
  iat?: number;
  included_users?: number;
  iss?: string;
  jti?: string;
  lexp?: number;
  lic_exp_warn_days?: number;
  lid?: string;
  limit_by?: string;
  max_concurrent_user_sessions?: number;
  nbf?: number;
  prod?: string[];
  slug?: string;
  status?: TokenStatus;
  sub?: string;
  tok_exp_warn_days?: number;
  trial?: boolean;
  trial_exp?: number;
  update_days?: number;
  usage_billing?: boolean;
};
export type Address = {
  address1?: string;
  address2?: string;
  city?: string;
  country?: string;
  state?: string;
  zipCode?: string;
};
export type OrgDetailsDto = {
  address?: Address;
  id?: number;
  name?: string;
};
export type UpdateOrgForm = {
  name?: string;
};
export type UpdateOrgAddressForm = {
  address1?: string;
  address2?: string;
  city?: string;
  country?: string;
  state?: string;
  zipcode?: string;
};
export type TempUserStatus = string;
export type TempUserDto = {
  code?: string;
  createdOn?: string;
  email?: string;
  emailSent?: boolean;
  emailSentOn?: string;
  id?: number;
  invitedByEmail?: string;
  invitedByLogin?: string;
  invitedByName?: string;
  name?: string;
  orgId?: number;
  role?: 'None' | 'Viewer' | 'Editor' | 'Admin';
  status?: TempUserStatus;
  url?: string;
};
export type AddInviteForm = {
  loginOrEmail?: string;
  name?: string;
  role?: 'None' | 'Viewer' | 'Editor' | 'Admin';
  sendEmail?: boolean;
};
export type PreferencesNavbarPreference = {
  bookmarkUrls?: string[];
};
export type PreferencesQueryHistoryPreference = {
  /** one of: '' | 'query' | 'starred'; */
  homeTab?: string;
};
export type PreferencesSpec = {
  /** UID for the home dashboard */
  homeDashboardUID?: string;
  /** Selected language (beta) */
  language?: string;
  navbar?: PreferencesNavbarPreference;
  queryHistory?: PreferencesQueryHistoryPreference;
  /** Selected locale (beta) */
  regionalFormat?: string;
  /** light, dark, empty is default */
  theme?: string;
  /** The timezone selection
    TODO: this should use the timezone defined in common */
  timezone?: string;
  /** day of the week (sunday, monday, etc) */
  weekStart?: string;
};
export type NavbarPreference = {
  bookmarkUrls?: string[];
};
export type QueryHistoryPreference = {
  homeTab?: string;
};
export type PatchPrefsCmd = {
  /** The numerical :id of a favorited dashboard */
  homeDashboardId?: number;
  homeDashboardUID?: string;
  language?: string;
  navbar?: NavbarPreference;
  queryHistory?: QueryHistoryPreference;
  regionalFormat?: string;
  theme?: 'light' | 'dark';
  /** Any IANA timezone string (e.g. America/New_York), 'utc', 'browser', or empty string */
  timezone?: string;
  weekStart?: string;
};
export type UpdatePrefsCmd = {
  /** The numerical :id of a favorited dashboard */
  homeDashboardId?: number;
  homeDashboardUID?: string;
  language?: string;
  navbar?: NavbarPreference;
  queryHistory?: QueryHistoryPreference;
  regionalFormat?: string;
  theme?: 'light' | 'dark' | 'system';
  /** Any IANA timezone string (e.g. America/New_York), 'utc', 'browser', or empty string */
  timezone?: string;
  weekStart?: string;
};
export type OrgUserDto = {
  accessControl?: {
    [key: string]: boolean;
  };
  authLabels?: string[];
  avatarUrl?: string;
  created?: string;
  email?: string;
  isDisabled?: boolean;
  isExternallySynced?: boolean;
  isProvisioned?: boolean;
  lastSeenAt?: string;
  lastSeenAtAge?: string;
  login?: string;
  name?: string;
  orgId?: number;
  role?: string;
  uid?: string;
  userId?: number;
};
export type AddOrgUserCommand = {
  loginOrEmail?: string;
  role?: 'None' | 'Viewer' | 'Editor' | 'Admin';
};
export type UserLookupDto = {
  avatarUrl?: string;
  login?: string;
  uid?: string;
  userId?: number;
};
export type UpdateOrgUserCommand = {
  role?: 'None' | 'Viewer' | 'Editor' | 'Admin';
};
export type OrgDto = {
  id?: number;
  name?: string;
};
export type CreateOrgCommand = {
  name?: string;
};
export type SearchOrgUsersQueryResult = {
  orgUsers?: OrgUserDto[];
  page?: number;
  perPage?: number;
  totalCount?: number;
};
export type DataSourceRef = {
  /** The plugin type-id */
  type?: string;
  /** Specific datasource instance */
  uid?: string;
};
export type AnnotationPanelFilter = {
  /** Should the specified panels be included or excluded */
  exclude?: boolean;
  /** Panel IDs that should be included or excluded */
  ids?: number[];
};
export type AnnotationTarget = {
  /** Only required/valid for the grafana datasource...
    but code+tests is already depending on it so hard to change */
  limit?: number;
  /** Only required/valid for the grafana datasource...
    but code+tests is already depending on it so hard to change */
  matchAny?: boolean;
  /** Only required/valid for the grafana datasource...
    but code+tests is already depending on it so hard to change */
  tags?: string[];
  /** Only required/valid for the grafana datasource...
    but code+tests is already depending on it so hard to change */
  type?: string;
};
export type AnnotationQuery = {
  /** Set to 1 for the standard annotation query all dashboards have by default. */
  builtIn?: number;
  datasource?: DataSourceRef;
  /** When enabled the annotation query is issued with every dashboard refresh */
  enable?: boolean;
  filter?: AnnotationPanelFilter;
  /** Annotation queries can be toggled on or off at the top of the dashboard.
    When hide is true, the toggle is not shown in the dashboard. */
  hide?: boolean;
  /** Color to use for the annotation event markers */
  iconColor?: string;
  /** Name of annotation. */
  name?: string;
  /** Placement can be used to display the annotation query somewhere else on the dashboard other than the default location. */
  placement?: string;
  target?: AnnotationTarget;
  /** TODO -- this should not exist here, it is based on the --grafana-- datasource */
  type?: string;
};
export type AnnotationEvent = {
  color?: string;
  dashboardId?: number;
  dashboardUID?: string;
  id?: number;
  isRegion?: boolean;
  panelId?: number;
  source?: AnnotationQuery;
  tags?: string[];
  text?: string;
  time?: number;
  timeEnd?: number;
};
export type QueryHistoryDto = {
  comment?: string;
  createdAt?: number;
  createdBy?: number;
  datasourceUid?: string;
  queries?: Json;
  starred?: boolean;
  uid?: string;
};
export type QueryHistorySearchResult = {
  page?: number;
  perPage?: number;
  queryHistory?: QueryHistoryDto[];
  totalCount?: number;
};
export type QueryHistorySearchResponse = {
  result?: QueryHistorySearchResult;
};
export type QueryHistoryResponse = {
  result?: QueryHistoryDto;
};
export type CreateQueryInQueryHistoryCommand = {
  /** UID of the data source for which are queries stored. */
  datasourceUid?: string;
  queries: Json;
};
export type QueryHistoryDeleteQueryResponse = {
  id?: number;
  message?: string;
};
export type PatchQueryCommentInQueryHistoryCommand = {
  /** Updated comment */
  comment?: string;
};
export type RecordingRuleJson = {
  active?: boolean;
  count?: boolean;
  description?: string;
  dest_data_source_uid?: string;
  id?: string;
  interval?: number;
  name?: string;
  prom_name?: string;
  queries?: {
    [key: string]: any;
  }[];
  range?: number;
  target_ref_id?: string;
};
export type PrometheusRemoteWriteTargetJson = {
  data_source_uid?: string;
  id?: string;
  remote_write_path?: string;
};
export type ReportDashboardId = {
  id?: number;
  name?: string;
  uid?: string;
};
export type ReportTimeRange = {
  from?: string;
  to?: string;
};
export type ReportDashboard = {
  dashboard?: ReportDashboardId;
  reportVariables?: object;
  timeRange?: ReportTimeRange;
};
export type Type = string;
export type ReportOptions = {
  csvEncoding?: string;
  layout?: string;
  orientation?: string;
  pdfCombineOneFile?: boolean;
  pdfShowTemplateVariables?: boolean;
  timeRange?: ReportTimeRange;
};
export type ReportSchedule = {
  dayOfMonth?: string;
  endDate?: string;
  frequency?: string;
  intervalAmount?: number;
  intervalFrequency?: string;
  startDate?: string;
  timeZone?: string;
  workdaysOnly?: boolean;
};
export type State = string;
export type Report = {
  created?: string;
  dashboards?: ReportDashboard[];
  enableCsv?: boolean;
  enableDashboardUrl?: boolean;
  formats?: Type[];
  id?: number;
  message?: string;
  name?: string;
  options?: ReportOptions;
  orgId?: number;
  recipients?: string;
  replyTo?: string;
  scaleFactor?: number;
  schedule?: ReportSchedule;
  state?: State;
  subject?: string;
  uid?: string;
  updated?: string;
  userId?: number;
};
export type CreateOrUpdateReport = {
  dashboards?: ReportDashboard[];
  enableCsv?: boolean;
  enableDashboardUrl?: boolean;
  formats?: Type[];
  message?: string;
  name?: string;
  options?: ReportOptions;
  recipients?: string;
  replyTo?: string;
  scaleFactor?: number;
  schedule?: ReportSchedule;
  state?: State;
  subject?: string;
};
export type ReportEmail = {
  /** Comma-separated list of emails to which to send the report to. */
  emails?: string;
  /** Send the report to the emails specified in the report. Required if emails is not present. */
  id?: string;
  /** Send the report to the emails specified in the report. Required if emails is not present. */
  useEmailsFromReport?: boolean;
};
export type ReportBrandingOptions = {
  emailFooterLink?: string;
  emailFooterMode?: string;
  emailFooterText?: string;
  emailLogoUrl?: string;
  reportLogoUrl?: string;
};
export type ReportSettings = {
  branding?: ReportBrandingOptions;
  embeddedImageTheme?: string;
  id?: number;
  orgId?: number;
  pdfTheme?: string;
  userId?: number;
};
export type HitType = string;
export type Hit = {
  description?: string;
  folderId?: number;
  folderTitle?: string;
  folderUid?: string;
  folderUrl?: string;
  id?: number;
  isDeleted?: boolean;
  isStarred?: boolean;
  orgId?: number;
  permanentlyDeleteDate?: string;
  slug?: string;
  sortMeta?: number;
  sortMetaName?: string;
  tags?: string[];
  title?: string;
  type?: HitType;
  uid?: string;
  uri?: string;
  url?: string;
};
export type HitList = Hit[];
export type ServiceAccountDto = {
  accessControl?: {
    [key: string]: boolean;
  };
  avatarUrl?: string;
  id?: number;
  isDisabled?: boolean;
  isExternal?: boolean;
  login?: string;
  name?: string;
  orgId?: number;
  role?: string;
  tokens?: number;
  uid?: string;
};
export type CreateServiceAccountForm = {
  isDisabled?: boolean;
  name?: string;
  role?: 'None' | 'Viewer' | 'Editor' | 'Admin';
};
export type SearchOrgServiceAccountsResult = {
  page?: number;
  perPage?: number;
  serviceAccounts?: ServiceAccountDto[];
  /** It can be used for pagination of the user list
    E.g. if totalCount is equal to 100 users and
    the perpage parameter is set to 10 then there are 10 pages of users. */
  totalCount?: number;
};
export type ServiceAccountProfileDto = {
  accessControl?: {
    [key: string]: boolean;
  };
  avatarUrl?: string;
  createdAt?: string;
  id?: number;
  isDisabled?: boolean;
  isExternal?: boolean;
  login?: string;
  name?: string;
  orgId?: number;
  requiredBy?: string;
  role?: string;
  teams?: string[];
  tokens?: number;
  uid?: string;
  updatedAt?: string;
};
export type UpdateServiceAccountForm = {
  isDisabled?: boolean;
  name?: string;
  role?: 'None' | 'Viewer' | 'Editor' | 'Admin';
  serviceAccountId?: number;
};
export type TokenDto = {
  created?: string;
  expiration?: string;
  hasExpired?: boolean;
  id?: number;
  isRevoked?: boolean;
  lastUsedAt?: string;
  name?: string;
  secondsUntilExpiration?: number;
};
export type NewApiKeyResult = {
  id?: number;
  key?: string;
  name?: string;
};
export type AddServiceAccountTokenCommand = {
  name?: string;
  secondsToLive?: number;
};
export type AnIpMaskIsABitmaskThatCanBeUsedToManipulateIpAddressesForIpAddressingAndRouting = number[];
export type AnIpNetRepresentsAnIpNetwork = {
  IP?: string;
  Mask?: AnIpMaskIsABitmaskThatCanBeUsedToManipulateIpAddressesForIpAddressingAndRouting;
};
export type ExtKeyUsageRepresentsAnExtendedSetOfActionsThatAreValidForAGivenKey = number;
export type AnObjectIdentifierRepresentsAnAsn1ObjectIdentifier = number[];
export type Extension = {
  Critical?: boolean;
  Id?: AnObjectIdentifierRepresentsAnAsn1ObjectIdentifier;
  Value?: number[];
};
export type AttributeTypeAndValue = {
  Type?: AnObjectIdentifierRepresentsAnAsn1ObjectIdentifier;
  Value?: any;
};
export type Name = {
  Country?: string[];
  /** ExtraNames contains attributes to be copied, raw, into any marshaled
    distinguished names. Values override any attributes with the same OID.
    The ExtraNames field is not populated when parsing, see Names. */
  ExtraNames?: AttributeTypeAndValue[];
  Locality?: string[];
  /** Names contains all parsed attributes. When parsing distinguished names,
    this can be used to extract non-standard attributes that are not parsed
    by this package. When marshaling to RDNSequences, the Names field is
    ignored, see ExtraNames. */
  Names?: AttributeTypeAndValue[];
  SerialNumber?: string;
  StreetAddress?: string[];
};
export type KeyUsage = number;
export type PolicyMappingRepresentsAPolicyMappingEntryInThePolicyMappingsExtension = {
  /** IssuerDomainPolicy contains a policy OID the issuing certificate considers
    equivalent to SubjectDomainPolicy in the subject certificate. */
  IssuerDomainPolicy?: string;
  /** SubjectDomainPolicy contains a OID the issuing certificate considers
    equivalent to IssuerDomainPolicy in the subject certificate. */
  SubjectDomainPolicy?: string;
};
export type PublicKeyAlgorithm = number;
export type SignatureAlgorithm = number;
export type Userinfo = object;
export type AUrlRepresentsAParsedUrlTechnicallyAUriReference = {
  ForceQuery?: boolean;
  Fragment?: string;
  Host?: string;
  OmitHost?: boolean;
  Opaque?: string;
  Path?: string;
  RawFragment?: string;
  RawPath?: string;
  RawQuery?: string;
  Scheme?: string;
  User?: Userinfo;
};
export type ACertificateRepresentsAnX509Certificate = {
  AuthorityKeyId?: number[];
  /** BasicConstraintsValid indicates whether IsCA, MaxPathLen,
    and MaxPathLenZero are valid. */
  BasicConstraintsValid?: boolean;
  /** CRL Distribution Points */
  CRLDistributionPoints?: string[];
  /** Subject Alternate Name values. (Note that these values may not be valid
    if invalid values were contained within a parsed certificate. For
    example, an element of DNSNames may not be a valid DNS domain name.) */
  DNSNames?: string[];
  EmailAddresses?: string[];
  ExcludedDNSDomains?: string[];
  ExcludedEmailAddresses?: string[];
  ExcludedIPRanges?: AnIpNetRepresentsAnIpNetwork[];
  ExcludedURIDomains?: string[];
  ExtKeyUsage?: ExtKeyUsageRepresentsAnExtendedSetOfActionsThatAreValidForAGivenKey[];
  /** Extensions contains raw X.509 extensions. When parsing certificates,
    this can be used to extract non-critical extensions that are not
    parsed by this package. When marshaling certificates, the Extensions
    field is ignored, see ExtraExtensions. */
  Extensions?: Extension[];
  /** ExtraExtensions contains extensions to be copied, raw, into any
    marshaled certificates. Values override any extensions that would
    otherwise be produced based on the other fields. The ExtraExtensions
    field is not populated when parsing certificates, see Extensions. */
  ExtraExtensions?: Extension[];
  IPAddresses?: string[];
  /** InhibitAnyPolicy and InhibitAnyPolicyZero indicate the presence and value
    of the inhibitAnyPolicy extension.
    
    The value of InhibitAnyPolicy indicates the number of additional
    certificates in the path after this certificate that may use the
    anyPolicy policy OID to indicate a match with any other policy.
    
    When parsing a certificate, a positive non-zero InhibitAnyPolicy means
    that the field was specified, -1 means it was unset, and
    InhibitAnyPolicyZero being true mean that the field was explicitly set to
    zero. The case of InhibitAnyPolicy==0 with InhibitAnyPolicyZero==false
    should be treated equivalent to -1 (unset). */
  InhibitAnyPolicy?: number;
  /** InhibitAnyPolicyZero indicates that InhibitAnyPolicy==0 should be
    interpreted as an actual maximum path length of zero. Otherwise, that
    combination is interpreted as InhibitAnyPolicy not being set. */
  InhibitAnyPolicyZero?: boolean;
  /** InhibitPolicyMapping and InhibitPolicyMappingZero indicate the presence
    and value of the inhibitPolicyMapping field of the policyConstraints
    extension.
    
    The value of InhibitPolicyMapping indicates the number of additional
    certificates in the path after this certificate that may use policy
    mapping.
    
    When parsing a certificate, a positive non-zero InhibitPolicyMapping
    means that the field was specified, -1 means it was unset, and
    InhibitPolicyMappingZero being true mean that the field was explicitly
    set to zero. The case of InhibitPolicyMapping==0 with
    InhibitPolicyMappingZero==false should be treated equivalent to -1
    (unset). */
  InhibitPolicyMapping?: number;
  /** InhibitPolicyMappingZero indicates that InhibitPolicyMapping==0 should be
    interpreted as an actual maximum path length of zero. Otherwise, that
    combination is interpreted as InhibitAnyPolicy not being set. */
  InhibitPolicyMappingZero?: boolean;
  IsCA?: boolean;
  Issuer?: Name;
  IssuingCertificateURL?: string[];
  KeyUsage?: KeyUsage;
  /** MaxPathLen and MaxPathLenZero indicate the presence and
    value of the BasicConstraints' "pathLenConstraint".
    
    When parsing a certificate, a positive non-zero MaxPathLen
    means that the field was specified, -1 means it was unset,
    and MaxPathLenZero being true mean that the field was
    explicitly set to zero. The case of MaxPathLen==0 with MaxPathLenZero==false
    should be treated equivalent to -1 (unset).
    
    When generating a certificate, an unset pathLenConstraint
    can be requested with either MaxPathLen == -1 or using the
    zero value for both MaxPathLen and MaxPathLenZero. */
  MaxPathLen?: number;
  /** MaxPathLenZero indicates that BasicConstraintsValid==true
    and MaxPathLen==0 should be interpreted as an actual
    maximum path length of zero. Otherwise, that combination is
    interpreted as MaxPathLen not being set. */
  MaxPathLenZero?: boolean;
  NotBefore?: string;
  /** RFC 5280, 4.2.2.1 (Authority Information Access) */
  OCSPServer?: string[];
  PermittedDNSDomains?: string[];
  /** Name constraints */
  PermittedDNSDomainsCritical?: boolean;
  PermittedEmailAddresses?: string[];
  PermittedIPRanges?: AnIpNetRepresentsAnIpNetwork[];
  PermittedURIDomains?: string[];
  /** Policies contains all policy identifiers included in the certificate.
    See CreateCertificate for context about how this field and the PolicyIdentifiers field
    interact.
    In Go 1.22, encoding/gob cannot handle and ignores this field. */
  Policies?: string[];
  /** PolicyIdentifiers contains asn1.ObjectIdentifiers, the components
    of which are limited to int32. If a certificate contains a policy which
    cannot be represented by asn1.ObjectIdentifier, it will not be included in
    PolicyIdentifiers, but will be present in Policies, which contains all parsed
    policy OIDs.
    See CreateCertificate for context about how this field and the Policies field
    interact. */
  PolicyIdentifiers?: AnObjectIdentifierRepresentsAnAsn1ObjectIdentifier[];
  /** PolicyMappings contains a list of policy mappings included in the certificate. */
  PolicyMappings?: PolicyMappingRepresentsAPolicyMappingEntryInThePolicyMappingsExtension[];
  PublicKey?: any;
  PublicKeyAlgorithm?: PublicKeyAlgorithm;
  Raw?: number[];
  RawIssuer?: number[];
  RawSubject?: number[];
  RawSubjectPublicKeyInfo?: number[];
  RawTBSCertificate?: number[];
  /** RequireExplicitPolicy and RequireExplicitPolicyZero indicate the presence
    and value of the requireExplicitPolicy field of the policyConstraints
    extension.
    
    The value of RequireExplicitPolicy indicates the number of additional
    certificates in the path after this certificate before an explicit policy
    is required for the rest of the path. When an explicit policy is required,
    each subsequent certificate in the path must contain a required policy OID,
    or a policy OID which has been declared as equivalent through the policy
    mapping extension.
    
    When parsing a certificate, a positive non-zero RequireExplicitPolicy
    means that the field was specified, -1 means it was unset, and
    RequireExplicitPolicyZero being true mean that the field was explicitly
    set to zero. The case of RequireExplicitPolicy==0 with
    RequireExplicitPolicyZero==false should be treated equivalent to -1
    (unset). */
  RequireExplicitPolicy?: number;
  /** RequireExplicitPolicyZero indicates that RequireExplicitPolicy==0 should be
    interpreted as an actual maximum path length of zero. Otherwise, that
    combination is interpreted as InhibitAnyPolicy not being set. */
  RequireExplicitPolicyZero?: boolean;
  SerialNumber?: string;
  Signature?: number[];
  SignatureAlgorithm?: SignatureAlgorithm;
  Subject?: Name;
  SubjectKeyId?: number[];
  URIs?: AUrlRepresentsAParsedUrlTechnicallyAUriReference[];
  /** UnhandledCriticalExtensions contains a list of extension IDs that
    were not (fully) processed when parsing. Verify will fail if this
    slice is non-empty, unless verification is delegated to an OS
    library which understands all the critical extensions.
    
    Users can access these extensions using Extensions and can remove
    elements from this slice if they believe that they have been
    handled. */
  UnhandledCriticalExtensions?: AnObjectIdentifierRepresentsAnAsn1ObjectIdentifier[];
  UnknownExtKeyUsage?: AnObjectIdentifierRepresentsAnAsn1ObjectIdentifier[];
  Version?: number;
};
export type JsonWebKey = {
  /** Key algorithm, parsed from `alg` header. */
  Algorithm?: string;
  /** X.509 certificate thumbprint (SHA-1), parsed from `x5t` header. */
  CertificateThumbprintSHA1?: number[];
  /** X.509 certificate thumbprint (SHA-256), parsed from `x5t#S256` header. */
  CertificateThumbprintSHA256?: number[];
  /** X.509 certificate chain, parsed from `x5c` header. */
  Certificates?: ACertificateRepresentsAnX509Certificate[];
  CertificatesURL?: AUrlRepresentsAParsedUrlTechnicallyAUriReference;
  /** Key is the Go in-memory representation of this key. It must have one
    of these types:
    ed25519.PublicKey
    ed25519.PrivateKey
    ecdsa.PublicKey
    ecdsa.PrivateKey
    rsa.PublicKey
    rsa.PrivateKey
    []byte (a symmetric key)
    
    When marshaling this JSONWebKey into JSON, the "kty" header parameter
    will be automatically set based on the type of this field. */
  Key?: any;
  /** Key identifier, parsed from `kid` header. */
  KeyID?: string;
  /** Key use, parsed from `use` header. */
  Use?: string;
};
export type Unstructured = {
  /** Object is a JSON compatible map with string, float, int, bool, []any,
    or map[string]any children. */
  Object?: {
    [key: string]: any;
  };
};
export type CreateDashboardSnapshotCommand = {
  /** APIVersion defines the versioned schema of this representation of an object.
    Servers should convert recognized schemas to the latest internal value, and
    may reject unrecognized values.
    More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources
    +optional */
  apiVersion?: string;
  dashboard: Unstructured;
  /** Unique key used to delete the snapshot. It is different from the `key` so that only the creator can delete the snapshot. Required if `external` is `true`. */
  deleteKey?: string;
  /** When the snapshot should expire in seconds in seconds. Default is never to expire. */
  expires?: number;
  /** these are passed when storing an external snapshot ref
    Save the snapshot on an external server rather than locally. */
  external?: boolean;
  /** Define the unique key. Required if `external` is `true`. */
  key?: string;
  /** Kind is a string value representing the REST resource this object represents.
    Servers may infer this from the endpoint the client submits requests to.
    Cannot be updated.
    In CamelCase.
    More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
    +optional */
  kind?: string;
  /** Snapshot name */
  name?: string;
};
export type CreateTeamCommand = {
  email?: string;
  name: string;
};
export type TeamDto = {
  accessControl?: {
    [key: string]: boolean;
  };
  avatarUrl?: string;
  email?: string;
  externalUID?: string;
  /** @deprecated Use UID instead */
  id: number;
  isProvisioned: boolean;
  memberCount: number;
  name: string;
  orgId: number;
  permission?: PermissionType;
  uid: string;
};
export type SearchTeamQueryResult = {
  page?: number;
  perPage?: number;
  teams?: TeamDto[];
  totalCount?: number;
};
export type TeamGroupDto = {
  groupId?: string;
  orgId?: number;
  teamId?: number;
  teamUid?: string;
  uid?: string;
};
export type TeamGroupMapping = {
  groupId?: string;
};
export type SearchTeamGroupsQueryResult = {
  page?: number;
  perPage?: number;
  teamGroups?: TeamGroupDto[];
  totalCount?: number;
};
export type UpdateTeamCommand = {
  email?: string;
  name?: string;
};
export type TeamMemberDto = {
  auth_module?: string;
  avatarUrl?: string;
  email?: string;
  labels?: string[];
  login?: string;
  name?: string;
  orgId?: number;
  permission?: PermissionType;
  teamId?: number;
  teamUID?: string;
  uid?: string;
  userId?: number;
  userUID?: string;
};
export type AddTeamMemberCommand = {
  userId: number;
};
export type SetTeamMembershipsCommand = {
  admins?: string[];
  members?: string[];
};
export type UpdateTeamMemberCommand = {
  permission?: PermissionType;
};
export type UserProfileDto = {
  accessControl?: {
    [key: string]: boolean;
  };
  authLabels?: string[];
  avatarUrl?: string;
  createdAt?: string;
  email?: string;
  id?: number;
  isDisabled?: boolean;
  isExternal?: boolean;
  isExternallySynced?: boolean;
  isGrafanaAdmin?: boolean;
  isGrafanaAdminExternallySynced?: boolean;
  isProvisioned?: boolean;
  login?: string;
  name?: string;
  orgId?: number;
  theme?: string;
  uid?: string;
  updatedAt?: string;
};
export type UpdateUserCommand = {
  email?: string;
  login?: string;
  name?: string;
  theme?: string;
};
export type UserOrgDto = {
  name?: string;
  orgId?: number;
  role?: 'None' | 'Viewer' | 'Editor' | 'Admin';
};
export type ChangeUserPasswordCommand = {
  newPassword?: Password;
  oldPassword?: Password;
};
export type UserSearchHitDto = {
  authLabels?: string[];
  avatarUrl?: string;
  created?: string;
  email?: string;
  id?: number;
  isAdmin?: boolean;
  isDisabled?: boolean;
  isProvisioned?: boolean;
  lastSeenAt?: string;
  lastSeenAtAge?: string;
  login?: string;
  name?: string;
  uid?: string;
};
export type SearchUserQueryResult = {
  page?: number;
  perPage?: number;
  totalCount?: number;
  users?: UserSearchHitDto[];
};
export type RelativeTimeRange = {
  from?: Duration;
  to?: Duration;
};
export type AlertQueryRepresentsASingleQueryAssociatedWithAnAlertDefinition = {
  /** Grafana data source unique identifier; it should be '__expr__' for a Server Side Expression operation. */
  datasourceUid?: string;
  /** JSON is the raw JSON query and includes the above properties as well as custom properties. */
  model?: object;
  /** QueryType is an optional identifier for the type of query.
    It can be used to distinguish different types of queries. */
  queryType?: string;
  /** RefID is the unique identifier of the query, set by the frontend call. */
  refId?: string;
  relativeTimeRange?: RelativeTimeRange;
};
export type AlertRuleNotificationSettings = {
  /** Override the times when notifications should not be muted. These must match the name of a mute time interval defined
    in the alertmanager configuration time_intervals section. All notifications will be suppressed unless they are sent
    at the time that matches any interval. */
  active_time_intervals?: string[];
  /** Override the labels by which incoming alerts are grouped together. For example, multiple alerts coming in for
    cluster=A and alertname=LatencyHigh would be batched into a single group. To aggregate by all possible labels
    use the special value '...' as the sole label name.
    This effectively disables aggregation entirely, passing through all alerts as-is. This is unlikely to be what
    you want, unless you have a very low alert volume or your upstream notification system performs its own grouping.
    Must include 'alertname' and 'grafana_folder' if not using '...'. */
  group_by?: string[];
  /** Override how long to wait before sending a notification about new alerts that are added to a group of alerts for
    which an initial notification has already been sent. (Usually ~5m or more.) */
  group_interval?: string;
  /** Override how long to initially wait to send a notification for a group of alerts. Allows to wait for an
    inhibiting alert to arrive or collect more initial alerts for the same group. (Usually ~0s to few minutes.) */
  group_wait?: string;
  /** Override the times when notifications should be muted. These must match the name of a mute time interval defined
    in the alertmanager configuration time_intervals section. When muted it will not send any notifications, but
    otherwise acts normally. */
  mute_time_intervals?: string[];
  /** Name of the receiver to send notifications to. */
  receiver: string;
  /** Override how long to wait before sending a notification again if it has already been sent successfully for an
    alert. (Usually ~3h or more).
    Note that this parameter is implicitly bound by Alertmanager's `--data.retention` configuration flag.
    Notifications will be resent after either repeat_interval or the data retention period have passed, whichever
    occurs first. `repeat_interval` should not be less than `group_interval`. */
  repeat_interval?: string;
};
export type Provenance = string;
export type Record = {
  /** Which expression node should be used as the input for the recorded metric. */
  from: string;
  /** Name of the recorded metric. */
  metric: string;
  /** Which data source should be used to write the output of the recording rule, specified by UID. */
  target_datasource_uid?: string;
};
export type ProvisionedAlertRule = {
  annotations?: {
    [key: string]: string;
  };
  condition: string;
  data: AlertQueryRepresentsASingleQueryAssociatedWithAnAlertDefinition[];
  execErrState: 'OK' | 'Alerting' | 'Error';
  folderUID: string;
  for: string;
  id?: number;
  isPaused?: boolean;
  keep_firing_for?: string;
  labels?: {
    [key: string]: string;
  };
  missingSeriesEvalsToResolve?: number;
  noDataState: 'Alerting' | 'NoData' | 'OK';
  notification_settings?: AlertRuleNotificationSettings;
  orgID: number;
  provenance?: Provenance;
  record?: Record;
  ruleGroup: string;
  title: string;
  uid?: string;
};
export type ProvisionedAlertRuleRead = {
  annotations?: {
    [key: string]: string;
  };
  condition: string;
  data: AlertQueryRepresentsASingleQueryAssociatedWithAnAlertDefinition[];
  execErrState: 'OK' | 'Alerting' | 'Error';
  folderUID: string;
  for: string;
  id?: number;
  isPaused?: boolean;
  keep_firing_for?: string;
  labels?: {
    [key: string]: string;
  };
  missingSeriesEvalsToResolve?: number;
  noDataState: 'Alerting' | 'NoData' | 'OK';
  notification_settings?: AlertRuleNotificationSettings;
  orgID: number;
  provenance?: Provenance;
  record?: Record;
  ruleGroup: string;
  title: string;
  uid?: string;
  updated?: string;
};
export type ProvisionedAlertRules = ProvisionedAlertRule[];
export type ProvisionedAlertRulesRead = ProvisionedAlertRuleRead[];
export type ValidationError = {
  message?: string;
};
export type RawMessage = object;
export type ReceiverExportIsTheProvisionedFileExportOfAlertingReceiverV1 = {
  disableResolveMessage?: boolean;
  settings?: RawMessage;
  type?: string;
  uid?: string;
};
export type ContactPointExportIsTheProvisionedFileExportOfAlertingContactPointV1 = {
  name?: string;
  orgId?: number;
  receivers?: ReceiverExportIsTheProvisionedFileExportOfAlertingReceiverV1[];
};
export type RelativeTimeRangeExport = {
  from?: number;
  to?: number;
};
export type AlertQueryExportIsTheProvisionedExportOfModelsAlertQuery = {
  datasourceUid?: string;
  model?: {
    [key: string]: any;
  };
  queryType?: string;
  refId?: string;
  relativeTimeRange?: RelativeTimeRangeExport;
};
export type AlertRuleNotificationSettingsExportIsTheProvisionedExportOfModelsNotificationSettings = {
  active_time_intervals?: string[];
  group_by?: string[];
  group_interval?: string;
  group_wait?: string;
  mute_time_intervals?: string[];
  receiver?: string;
  repeat_interval?: string;
};
export type RecordIsTheProvisionedExportOfModelsRecord = {
  from?: string;
  metric?: string;
  targetDatasourceUid?: string;
};
export type AlertRuleExportIsTheProvisionedFileExportOfModelsAlertRule = {
  annotations?: {
    [key: string]: string;
  };
  condition?: string;
  dashboardUid?: string;
  data?: AlertQueryExportIsTheProvisionedExportOfModelsAlertQuery[];
  execErrState?: 'OK' | 'Alerting' | 'Error';
  for?: Duration;
  isPaused?: boolean;
  keepFiringFor?: Duration;
  labels?: {
    [key: string]: string;
  };
  missing_series_evals_to_resolve?: number;
  noDataState?: 'Alerting' | 'NoData' | 'OK';
  notification_settings?: AlertRuleNotificationSettingsExportIsTheProvisionedExportOfModelsNotificationSettings;
  panelId?: number;
  record?: RecordIsTheProvisionedExportOfModelsRecord;
  title?: string;
  uid?: string;
};
export type AlertRuleGroupExportIsTheProvisionedFileExportOfAlertRuleGroupV1 = {
  folder?: string;
  interval?: Duration;
  name?: string;
  orgId?: number;
  rules?: AlertRuleExportIsTheProvisionedFileExportOfModelsAlertRule[];
};
export type TimeIntervalRepresentsANamedSetOfTimeIntervalsForWhichARouteShouldBeMuted = {
  name?: string;
  time_intervals?: TimeIntervalRepresentsANamedSetOfTimeIntervalsForWhichARouteShouldBeMuted[];
};
export type MuteTimeIntervalExport = {
  name?: string;
  orgId?: number;
  time_intervals?: TimeIntervalRepresentsANamedSetOfTimeIntervalsForWhichARouteShouldBeMuted[];
};
export type MatchRegexpsRepresentsAMapOfRegexp = {
  [key: string]: string;
};
export type MatchTypeIsAnEnumForLabelMatchingTypes = number;
export type MatcherModelsTheMatchingOfALabel = {
  Name?: string;
  Type?: MatchTypeIsAnEnumForLabelMatchingTypes;
  Value?: string;
};
export type Matchers = MatcherModelsTheMatchingOfALabel[];
export type ObjectMatcherIsAMatcherThatCanBeUsedToFilterAlerts = string[];
export type ObjectMatchersIsAListOfMatchersThatCanBeUsedToFilterAlerts =
  ObjectMatcherIsAMatcherThatCanBeUsedToFilterAlerts[];
export type RouteExport = {
  active_time_intervals?: string[];
  continue?: boolean;
  group_by?: string[];
  group_interval?: string;
  group_wait?: string;
  /** Deprecated. Remove before v1.0 release. */
  match?: {
    [key: string]: string;
  };
  match_re?: MatchRegexpsRepresentsAMapOfRegexp;
  matchers?: Matchers;
  mute_time_intervals?: string[];
  object_matchers?: ObjectMatchersIsAListOfMatchersThatCanBeUsedToFilterAlerts;
  receiver?: string;
  repeat_interval?: string;
  routes?: RouteExport[];
};
export type NotificationPolicyExportIsTheProvisionedFileExportOfAlertingNotificiationPolicyV1 = {
  active_time_intervals?: string[];
  continue?: boolean;
  group_by?: string[];
  group_interval?: string;
  group_wait?: string;
  /** Deprecated. Remove before v1.0 release. */
  match?: {
    [key: string]: string;
  };
  match_re?: MatchRegexpsRepresentsAMapOfRegexp;
  matchers?: Matchers;
  mute_time_intervals?: string[];
  object_matchers?: ObjectMatchersIsAListOfMatchersThatCanBeUsedToFilterAlerts;
  orgId?: number;
  receiver?: string;
  repeat_interval?: string;
  routes?: RouteExport[];
};
export type AlertingFileExportIsTheFullProvisionedFileExport = {
  apiVersion?: number;
  contactPoints?: ContactPointExportIsTheProvisionedFileExportOfAlertingContactPointV1[];
  groups?: AlertRuleGroupExportIsTheProvisionedFileExportOfAlertRuleGroupV1[];
  muteTimes?: MuteTimeIntervalExport[];
  policies?: NotificationPolicyExportIsTheProvisionedFileExportOfAlertingNotificiationPolicyV1[];
};
export type EmbeddedContactPoint = {
  disableResolveMessage?: boolean;
  /** Name is used as grouping key in the UI. Contact points with the
    same name will be grouped in the UI. */
  name?: string;
  settings: Json;
  type:
    | 'alertmanager'
    | 'dingding'
    | 'discord'
    | 'email'
    | 'googlechat'
    | 'kafka'
    | 'line'
    | 'opsgenie'
    | 'pagerduty'
    | 'pushover'
    | 'sensugo'
    | 'slack'
    | 'teams'
    | 'telegram'
    | 'threema'
    | 'victorops'
    | 'webhook'
    | 'wecom';
  /** UID is the unique identifier of the contact point. The UID can be
    set by the user. */
  uid?: string;
};
export type EmbeddedContactPointRead = {
  disableResolveMessage?: boolean;
  /** Name is used as grouping key in the UI. Contact points with the
    same name will be grouped in the UI. */
  name?: string;
  provenance?: string;
  settings: Json;
  type:
    | 'alertmanager'
    | 'dingding'
    | 'discord'
    | 'email'
    | 'googlechat'
    | 'kafka'
    | 'line'
    | 'opsgenie'
    | 'pagerduty'
    | 'pushover'
    | 'sensugo'
    | 'slack'
    | 'teams'
    | 'telegram'
    | 'threema'
    | 'victorops'
    | 'webhook'
    | 'wecom';
  /** UID is the unique identifier of the contact point. The UID can be
    set by the user. */
  uid?: string;
};
export type ContactPoints = EmbeddedContactPoint[];
export type ContactPointsRead = EmbeddedContactPointRead[];
export type PermissionDenied = object;
export type Ack = object;
export type NotFound = object;
export type AlertRuleGroup = {
  folderUid?: string;
  interval?: number;
  rules?: ProvisionedAlertRule[];
  title?: string;
};
export type AlertRuleGroupRead = {
  folderUid?: string;
  interval?: number;
  rules?: ProvisionedAlertRuleRead[];
  title?: string;
};
export type MuteTimeIntervalRepresentsANamedSetOfTimeIntervalsForWhichARouteShouldBeMuted = {
  name?: string;
  time_intervals?: TimeIntervalRepresentsANamedSetOfTimeIntervalsForWhichARouteShouldBeMuted[];
};
export type MuteTimings = MuteTimeIntervalRepresentsANamedSetOfTimeIntervalsForWhichARouteShouldBeMuted[];
export type Route = {
  active_time_intervals?: string[];
  continue?: boolean;
  group_by?: string[];
  group_interval?: string;
  group_wait?: string;
  /** Deprecated. Remove before v1.0 release. */
  match?: {
    [key: string]: string;
  };
  match_re?: MatchRegexpsRepresentsAMapOfRegexp;
  matchers?: Matchers;
  mute_time_intervals?: string[];
  object_matchers?: ObjectMatchersIsAListOfMatchersThatCanBeUsedToFilterAlerts;
  provenance?: Provenance;
  receiver?: string;
  repeat_interval?: string;
  routes?: Route[];
};
export type NotificationTemplate = {
  name?: string;
  provenance?: Provenance;
  template?: string;
  version?: string;
};
export type NotificationTemplates = NotificationTemplate[];
export type NotificationTemplateContent = {
  template?: string;
  version?: string;
};
export const {
  useSearchResultMutation,
  useListRolesQuery,
  useLazyListRolesQuery,
  useCreateRoleMutation,
  useDeleteRoleMutation,
  useGetRoleQuery,
  useLazyGetRoleQuery,
  useUpdateRoleMutation,
  useGetRoleAssignmentsQuery,
  useLazyGetRoleAssignmentsQuery,
  useSetRoleAssignmentsMutation,
  useGetAccessControlStatusQuery,
  useLazyGetAccessControlStatusQuery,
  useListTeamsRolesQuery,
  useLazyListTeamsRolesQuery,
  useListTeamRolesQuery,
  useLazyListTeamRolesQuery,
  useAddTeamRoleMutation,
  useSetTeamRolesMutation,
  useRemoveTeamRoleMutation,
  useListUsersRolesMutation,
  useListUserRolesQuery,
  useLazyListUserRolesQuery,
  useAddUserRoleMutation,
  useSetUserRolesMutation,
  useRemoveUserRoleMutation,
  useGetResourceDescriptionQuery,
  useLazyGetResourceDescriptionQuery,
  useGetResourcePermissionsQuery,
  useLazyGetResourcePermissionsQuery,
  useSetResourcePermissionsMutation,
  useSetResourcePermissionsForBuiltInRoleMutation,
  useSetResourcePermissionsForTeamMutation,
  useSetResourcePermissionsForUserMutation,
  useGetSyncStatusQuery,
  useLazyGetSyncStatusQuery,
  useReloadLdapCfgMutation,
  useGetLdapStatusQuery,
  useLazyGetLdapStatusQuery,
  usePostSyncUserWithLdapMutation,
  useGetUserFromLdapQuery,
  useLazyGetUserFromLdapQuery,
  useAdminProvisioningReloadAccessControlMutation,
  useAdminProvisioningReloadDashboardsMutation,
  useAdminProvisioningReloadDatasourcesMutation,
  useAdminProvisioningReloadPluginsMutation,
  useAdminGetSettingsQuery,
  useLazyAdminGetSettingsQuery,
  useAdminGetStatsQuery,
  useLazyAdminGetStatsQuery,
  useAdminCreateUserMutation,
  useAdminDeleteUserMutation,
  useAdminGetUserAuthTokensQuery,
  useLazyAdminGetUserAuthTokensQuery,
  useAdminDisableUserMutation,
  useAdminEnableUserMutation,
  useAdminLogoutUserMutation,
  useAdminUpdateUserPasswordMutation,
  useAdminUpdateUserPermissionsMutation,
  useGetUserQuotaQuery,
  useLazyGetUserQuotaQuery,
  useUpdateUserQuotaMutation,
  useAdminRevokeUserAuthTokenMutation,
  useGetAnnotationsQuery,
  useLazyGetAnnotationsQuery,
  usePostAnnotationMutation,
  usePostGraphiteAnnotationMutation,
  useMassDeleteAnnotationsMutation,
  useGetAnnotationTagsQuery,
  useLazyGetAnnotationTagsQuery,
  useDeleteAnnotationByIdMutation,
  useGetAnnotationByIdQuery,
  useLazyGetAnnotationByIdQuery,
  usePatchAnnotationMutation,
  useUpdateAnnotationMutation,
  useListDevicesQuery,
  useLazyListDevicesQuery,
  useSearchDevicesQuery,
  useLazySearchDevicesQuery,
  useGetSessionListQuery,
  useLazyGetSessionListQuery,
  useCreateSessionMutation,
  useDeleteSessionMutation,
  useGetSessionQuery,
  useLazyGetSessionQuery,
  useCreateSnapshotMutation,
  useGetSnapshotQuery,
  useLazyGetSnapshotQuery,
  useCancelSnapshotMutation,
  useUploadSnapshotMutation,
  useGetShapshotListQuery,
  useLazyGetShapshotListQuery,
  useGetResourceDependenciesQuery,
  useLazyGetResourceDependenciesQuery,
  useGetCloudMigrationTokenQuery,
  useLazyGetCloudMigrationTokenQuery,
  useCreateCloudMigrationTokenMutation,
  useDeleteCloudMigrationTokenMutation,
  useRouteConvertPrometheusCortexGetRulesQuery,
  useLazyRouteConvertPrometheusCortexGetRulesQuery,
  useRouteConvertPrometheusCortexPostRuleGroupsMutation,
  useRouteConvertPrometheusCortexDeleteNamespaceMutation,
  useRouteConvertPrometheusCortexGetNamespaceQuery,
  useLazyRouteConvertPrometheusCortexGetNamespaceQuery,
  useRouteConvertPrometheusCortexPostRuleGroupMutation,
  useRouteConvertPrometheusCortexDeleteRuleGroupMutation,
  useRouteConvertPrometheusCortexGetRuleGroupQuery,
  useLazyRouteConvertPrometheusCortexGetRuleGroupQuery,
  useRouteConvertPrometheusGetRulesQuery,
  useLazyRouteConvertPrometheusGetRulesQuery,
  useRouteConvertPrometheusPostRuleGroupsMutation,
  useRouteConvertPrometheusDeleteNamespaceMutation,
  useRouteConvertPrometheusGetNamespaceQuery,
  useLazyRouteConvertPrometheusGetNamespaceQuery,
  useRouteConvertPrometheusPostRuleGroupMutation,
  useRouteConvertPrometheusDeleteRuleGroupMutation,
  useRouteConvertPrometheusGetRuleGroupQuery,
  useLazyRouteConvertPrometheusGetRuleGroupQuery,
  useSearchDashboardSnapshotsQuery,
  useLazySearchDashboardSnapshotsQuery,
  usePostDashboardMutation,
  useImportDashboardMutation,
  useInterpolateDashboardMutation,
  useListPublicDashboardsQuery,
  useLazyListPublicDashboardsQuery,
  useGetDashboardTagsQuery,
  useLazyGetDashboardTagsQuery,
  useGetPublicDashboardQuery,
  useLazyGetPublicDashboardQuery,
  useCreatePublicDashboardMutation,
  useDeletePublicDashboardMutation,
  useUpdatePublicDashboardMutation,
  useDeleteDashboardByUidMutation,
  useGetDashboardByUidQuery,
  useLazyGetDashboardByUidQuery,
  useGetDashboardPermissionsListByUidQuery,
  useLazyGetDashboardPermissionsListByUidQuery,
  useUpdateDashboardPermissionsByUidMutation,
  useGetDashboardVersionsByUidQuery,
  useLazyGetDashboardVersionsByUidQuery,
  useGetDashboardVersionByUidQuery,
  useLazyGetDashboardVersionByUidQuery,
  useGetDataSourcesQuery,
  useLazyGetDataSourcesQuery,
  useAddDataSourceMutation,
  useGetCorrelationsQuery,
  useLazyGetCorrelationsQuery,
  useDatasourceProxyDeleteByUiDcallsMutation,
  useDatasourceProxyGetByUiDcallsQuery,
  useLazyDatasourceProxyGetByUiDcallsQuery,
  useDatasourceProxyPostByUiDcallsMutation,
  useGetCorrelationsBySourceUidQuery,
  useLazyGetCorrelationsBySourceUidQuery,
  useCreateCorrelationMutation,
  useGetCorrelationQuery,
  useLazyGetCorrelationQuery,
  useUpdateCorrelationMutation,
  useDeleteDataSourceByUidMutation,
  useGetDataSourceByUidQuery,
  useLazyGetDataSourceByUidQuery,
  useUpdateDataSourceByUidMutation,
  useDeleteCorrelationMutation,
  useCheckDatasourceHealthWithUidQuery,
  useLazyCheckDatasourceHealthWithUidQuery,
  useGetTeamLbacRulesApiQuery,
  useLazyGetTeamLbacRulesApiQuery,
  useUpdateTeamLbacRulesApiMutation,
  useCallDatasourceResourceWithUidQuery,
  useLazyCallDatasourceResourceWithUidQuery,
  useGetDataSourceCacheConfigQuery,
  useLazyGetDataSourceCacheConfigQuery,
  useSetDataSourceCacheConfigMutation,
  useCleanDataSourceCacheMutation,
  useDisableDataSourceCacheMutation,
  useEnableDataSourceCacheMutation,
  useQueryMetricsWithExpressionsMutation,
  useGetFoldersQuery,
  useLazyGetFoldersQuery,
  useCreateFolderMutation,
  useDeleteFolderMutation,
  useGetFolderByUidQuery,
  useLazyGetFolderByUidQuery,
  useUpdateFolderMutation,
  useGetFolderDescendantCountsQuery,
  useLazyGetFolderDescendantCountsQuery,
  useMoveFolderMutation,
  useGetFolderPermissionListQuery,
  useLazyGetFolderPermissionListQuery,
  useUpdateFolderPermissionsMutation,
  useGetMappedGroupsQuery,
  useLazyGetMappedGroupsQuery,
  useDeleteGroupMappingsMutation,
  useCreateGroupMappingsMutation,
  useUpdateGroupMappingsMutation,
  useGetGroupRolesQuery,
  useLazyGetGroupRolesQuery,
  useGetHealthQuery,
  useLazyGetHealthQuery,
  useGetLibraryElementsQuery,
  useLazyGetLibraryElementsQuery,
  useCreateLibraryElementMutation,
  useGetLibraryElementByNameQuery,
  useLazyGetLibraryElementByNameQuery,
  useDeleteLibraryElementByUidMutation,
  useGetLibraryElementByUidQuery,
  useLazyGetLibraryElementByUidQuery,
  useUpdateLibraryElementMutation,
  useGetLibraryElementConnectionsQuery,
  useLazyGetLibraryElementConnectionsQuery,
  useGetStatusQuery,
  useLazyGetStatusQuery,
  useRefreshLicenseStatsQuery,
  useLazyRefreshLicenseStatsQuery,
  useDeleteLicenseTokenMutation,
  useGetLicenseTokenQuery,
  useLazyGetLicenseTokenQuery,
  usePostLicenseTokenMutation,
  usePostRenewLicenseTokenMutation,
  useGetSamlLogoutQuery,
  useLazyGetSamlLogoutQuery,
  useGetCurrentOrgQuery,
  useLazyGetCurrentOrgQuery,
  useUpdateCurrentOrgMutation,
  useUpdateCurrentOrgAddressMutation,
  useGetPendingOrgInvitesQuery,
  useLazyGetPendingOrgInvitesQuery,
  useAddOrgInviteMutation,
  useRevokeInviteMutation,
  useGetOrgPreferencesQuery,
  useLazyGetOrgPreferencesQuery,
  usePatchOrgPreferencesMutation,
  useUpdateOrgPreferencesMutation,
  useGetCurrentOrgQuotaQuery,
  useLazyGetCurrentOrgQuotaQuery,
  useGetOrgUsersForCurrentOrgQuery,
  useLazyGetOrgUsersForCurrentOrgQuery,
  useAddOrgUserToCurrentOrgMutation,
  useGetOrgUsersForCurrentOrgLookupQuery,
  useLazyGetOrgUsersForCurrentOrgLookupQuery,
  useRemoveOrgUserForCurrentOrgMutation,
  useUpdateOrgUserForCurrentOrgMutation,
  useSearchOrgsQuery,
  useLazySearchOrgsQuery,
  useCreateOrgMutation,
  useGetOrgByNameQuery,
  useLazyGetOrgByNameQuery,
  useDeleteOrgByIdMutation,
  useGetOrgByIdQuery,
  useLazyGetOrgByIdQuery,
  useUpdateOrgMutation,
  useUpdateOrgAddressMutation,
  useGetOrgQuotaQuery,
  useLazyGetOrgQuotaQuery,
  useUpdateOrgQuotaMutation,
  useGetOrgUsersQuery,
  useLazyGetOrgUsersQuery,
  useAddOrgUserMutation,
  useSearchOrgUsersQuery,
  useLazySearchOrgUsersQuery,
  useRemoveOrgUserMutation,
  useUpdateOrgUserMutation,
  useViewPublicDashboardQuery,
  useLazyViewPublicDashboardQuery,
  useGetPublicAnnotationsQuery,
  useLazyGetPublicAnnotationsQuery,
  useQueryPublicDashboardMutation,
  useSearchQueriesQuery,
  useLazySearchQueriesQuery,
  useCreateQueryMutation,
  useUnstarQueryMutation,
  useStarQueryMutation,
  useDeleteQueryMutation,
  usePatchQueryCommentMutation,
  useListRecordingRulesQuery,
  useLazyListRecordingRulesQuery,
  useCreateRecordingRuleMutation,
  useUpdateRecordingRuleMutation,
  useTestCreateRecordingRuleMutation,
  useDeleteRecordingRuleWriteTargetMutation,
  useGetRecordingRuleWriteTargetQuery,
  useLazyGetRecordingRuleWriteTargetQuery,
  useCreateRecordingRuleWriteTargetMutation,
  useDeleteRecordingRuleMutation,
  useGetReportsQuery,
  useLazyGetReportsQuery,
  useCreateReportMutation,
  useGetReportsByDashboardUidQuery,
  useLazyGetReportsByDashboardUidQuery,
  useSendReportMutation,
  useGetSettingsImageQuery,
  useLazyGetSettingsImageQuery,
  useRenderReportCsVsQuery,
  useLazyRenderReportCsVsQuery,
  useRenderReportPdFsQuery,
  useLazyRenderReportPdFsQuery,
  useGetReportSettingsQuery,
  useLazyGetReportSettingsQuery,
  useSaveReportSettingsMutation,
  useSendTestEmailMutation,
  usePostAcsMutation,
  useGetMetadataQuery,
  useLazyGetMetadataQuery,
  useGetSloQuery,
  useLazyGetSloQuery,
  usePostSloMutation,
  useSearchQuery,
  useLazySearchQuery,
  useListSortOptionsQuery,
  useLazyListSortOptionsQuery,
  useCreateServiceAccountMutation,
  useSearchOrgServiceAccountsWithPagingQuery,
  useLazySearchOrgServiceAccountsWithPagingQuery,
  useDeleteServiceAccountMutation,
  useRetrieveServiceAccountQuery,
  useLazyRetrieveServiceAccountQuery,
  useUpdateServiceAccountMutation,
  useListTokensQuery,
  useLazyListTokensQuery,
  useCreateTokenMutation,
  useDeleteTokenMutation,
  useRetrieveJwksQuery,
  useLazyRetrieveJwksQuery,
  useGetSharingOptionsQuery,
  useLazyGetSharingOptionsQuery,
  useCreateDashboardSnapshotMutation,
  useDeleteDashboardSnapshotByDeleteKeyQuery,
  useLazyDeleteDashboardSnapshotByDeleteKeyQuery,
  useDeleteDashboardSnapshotMutation,
  useGetDashboardSnapshotQuery,
  useLazyGetDashboardSnapshotQuery,
  useCreateTeamMutation,
  useSearchTeamsQuery,
  useLazySearchTeamsQuery,
  useRemoveTeamGroupApiQueryMutation,
  useGetTeamGroupsApiQuery,
  useLazyGetTeamGroupsApiQuery,
  useAddTeamGroupApiMutation,
  useSearchTeamGroupsQuery,
  useLazySearchTeamGroupsQuery,
  useDeleteTeamByIdMutation,
  useGetTeamByIdQuery,
  useLazyGetTeamByIdQuery,
  useUpdateTeamMutation,
  useGetTeamMembersQuery,
  useLazyGetTeamMembersQuery,
  useAddTeamMemberMutation,
  useSetTeamMembershipsMutation,
  useRemoveTeamMemberMutation,
  useUpdateTeamMemberMutation,
  useGetTeamPreferencesQuery,
  useLazyGetTeamPreferencesQuery,
  useUpdateTeamPreferencesMutation,
  useGetSignedInUserQuery,
  useLazyGetSignedInUserQuery,
  useUpdateSignedInUserMutation,
  useGetUserAuthTokensQuery,
  useLazyGetUserAuthTokensQuery,
  useUpdateUserEmailQuery,
  useLazyUpdateUserEmailQuery,
  useClearHelpFlagsQuery,
  useLazyClearHelpFlagsQuery,
  useSetHelpFlagMutation,
  useGetSignedInUserOrgListQuery,
  useLazyGetSignedInUserOrgListQuery,
  useChangeUserPasswordMutation,
  useGetUserPreferencesQuery,
  useLazyGetUserPreferencesQuery,
  usePatchUserPreferencesMutation,
  useUpdateUserPreferencesMutation,
  useGetUserQuotasQuery,
  useLazyGetUserQuotasQuery,
  useRevokeUserAuthTokenMutation,
  useUnstarDashboardByUidMutation,
  useStarDashboardByUidMutation,
  useGetSignedInUserTeamListQuery,
  useLazyGetSignedInUserTeamListQuery,
  useUserSetUsingOrgMutation,
  useSearchUsersQuery,
  useLazySearchUsersQuery,
  useGetUserByLoginOrEmailQuery,
  useLazyGetUserByLoginOrEmailQuery,
  useSearchUsersWithPagingQuery,
  useLazySearchUsersWithPagingQuery,
  useGetUserByIdQuery,
  useLazyGetUserByIdQuery,
  useUpdateUserMutation,
  useGetUserOrgListQuery,
  useLazyGetUserOrgListQuery,
  useGetUserTeamsQuery,
  useLazyGetUserTeamsQuery,
  useRouteGetAlertRulesQuery,
  useLazyRouteGetAlertRulesQuery,
  useRoutePostAlertRuleMutation,
  useRouteGetAlertRulesExportQuery,
  useLazyRouteGetAlertRulesExportQuery,
  useRouteDeleteAlertRuleMutation,
  useRouteGetAlertRuleQuery,
  useLazyRouteGetAlertRuleQuery,
  useRoutePutAlertRuleMutation,
  useRouteGetAlertRuleExportQuery,
  useLazyRouteGetAlertRuleExportQuery,
  useRouteGetContactpointsQuery,
  useLazyRouteGetContactpointsQuery,
  useRoutePostContactpointsMutation,
  useRouteGetContactpointsExportQuery,
  useLazyRouteGetContactpointsExportQuery,
  useRouteDeleteContactpointsMutation,
  useRoutePutContactpointMutation,
  useRouteDeleteAlertRuleGroupMutation,
  useRouteGetAlertRuleGroupQuery,
  useLazyRouteGetAlertRuleGroupQuery,
  useRoutePutAlertRuleGroupMutation,
  useRouteGetAlertRuleGroupExportQuery,
  useLazyRouteGetAlertRuleGroupExportQuery,
  useRouteGetMuteTimingsQuery,
  useLazyRouteGetMuteTimingsQuery,
  useRoutePostMuteTimingMutation,
  useRouteExportMuteTimingsQuery,
  useLazyRouteExportMuteTimingsQuery,
  useRouteDeleteMuteTimingMutation,
  useRouteGetMuteTimingQuery,
  useLazyRouteGetMuteTimingQuery,
  useRoutePutMuteTimingMutation,
  useRouteExportMuteTimingQuery,
  useLazyRouteExportMuteTimingQuery,
  useRouteResetPolicyTreeMutation,
  useRouteGetPolicyTreeQuery,
  useLazyRouteGetPolicyTreeQuery,
  useRoutePutPolicyTreeMutation,
  useRouteGetPolicyTreeExportQuery,
  useLazyRouteGetPolicyTreeExportQuery,
  useRouteGetTemplatesQuery,
  useLazyRouteGetTemplatesQuery,
  useRouteDeleteTemplateMutation,
  useRouteGetTemplateQuery,
  useLazyRouteGetTemplateQuery,
  useRoutePutTemplateMutation,
  useListAllProvidersSettingsQuery,
  useLazyListAllProvidersSettingsQuery,
  useRemoveProviderSettingsMutation,
  useGetProviderSettingsQuery,
  useLazyGetProviderSettingsQuery,
  usePatchProviderSettingsMutation,
  useUpdateProviderSettingsMutation,
} = injectedRtkApi;
