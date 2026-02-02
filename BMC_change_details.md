# **_Change details in Grafana v9.3.0-beta1_**

# **_Build:_**

#### Separate bundles

- …/scripts/webpack -> ‘webpack.common.js’

#### Docker

- …/Dockerfile

#### Configuration

- …/conf -> 'custom.ini'

# **_Rebranding:_**

#### Theme, Logo, and App name

- …/public/img -> ‘apple-touch-icon.png’, ‘fav32.png’, ‘grafana_com_auth_icon.svg’, ‘grafana_mask_icon_white.svg’, ‘grafana_mask_icon.svg’, 'bmc_helix_dark.png', 'bmc_helix_dark.svg', 'bmc_helix_light.svg', 'bmc_page_failure_icon.svg', 'bmc_page_not_found_icon.svg', 'bmc_app_failure_icon.svg', 'bmc-logo.svg', 'home_icon.svg'
- …/public/views -> ‘index-template.html’
- …/public/app/core/components/Branding -> ‘Branding.tsx’
- …/pkg/api -> ‘index.go’
- …/public/sass/components -> '\_sidemenu.scss'

#### Error Pages

- …/pkg/middleware -> 'recovery.go'
- …/public/views -> 'index-template.html', 'error-template.html'
- …/public/app/core/components/ErrorPage -> 'ErrorPage.tsx'
- …/public/app/core/components/DynamicImports -> 'ErrorLoadingChunk.tsx'
- …/public/sass/pages -> '\_errorpage.scss'
- …/public/img -> 'bmc_page_not_found_icon.svg', 'bmc_app_failure_icon.svg', 'bmc_page_failure_icon.svg'

# **_Export to PDF:_**

- …/public/app/features/dashboard/components/ShareModal -> ‘ShareModal.tsx’ , ‘ExportUtility.tsx’
- …/grafana -> ‘package.json’
- …/public/img -> ‘bmc-logo.svg’

# **_Weoclome/Landing page:_**

### New dashboard

- …/public/dashboards -> 'bmc_home.json'

### New bmc helix logo

- …/public/img -> ‘bmc_helix_dark.svg’
- …/public/img -> ‘bmc_helix_light.svg’

### New 'Native' Panels

- …/public/app/plugins/panel/bmcvideo/
- …/public/app/plugins/panel/bmcwelcome/

### Other Changes

- …/pkg/api -> 'dashboard.go'
- …/public/app/features/plugins -> 'built_in_plugins.ts'

# **_Hide/Disable Features from Grafana UI:_**

### Document, Community, Support

- …/public/app/core/components/Footer -> ‘Footer.tsx’
- …/public/app/core/components/sidemenu -> ‘BottomNavLinks.tsx’

### Change Password

- …/pkg/api -> ‘index.go’
- …/public/app/routes -> ‘routes.ts’

### User Preferences

- …/public/app/features/profile -> ‘UserProfileEditForm.tsx’, ‘UserOrganizations.tsx'
- …/public/app/features/profile/partials -> 'profile.html'

### Organization Profile

- …/public/app/features/org -> 'OrgProfile.tsx'

### Datasources (Configuration)

- …/public/app/routes -> ‘routes.ts’
- …/public/app/features/datasources -> 'DataSourcesListPage.tsx', 'DataSourcesListItem.tsx', 'NewDataSourcePage.tsx'

### Teams (Configuration)

- …/public/app/routes -> ‘routes.ts’
- …/public/app/features/teams -> 'TeamList.tsx’, 'TeamMembers.tsx', 'TeamMemberRow.tsx', 'TeamSettings.tsx'

### Users (Configuration)

- …/public/app/routes -> ‘routes.ts’
- …/public/app/features/users -> 'UsersActionBar.tsx', 'UsersTable.tsx'

### Plugins (Configuration)

- …/public/app/features/plugins -> 'PluginListPage.tsx'

### API Keys (Configuration)

- …/public/app/routes/routes.ts
- …/pkg/api/index.go

### Upgrade (Server Admin)

- …/public/app/routes -> 'routes.ts'
- …/pkg/services/licensing -> 'oss.go'

### Orgs (Server Admin)

- …/public/app/routes -> 'routes.ts'
- …/public/app/features/admin -> 'AdminListOrgsPage.tsx', 'AdminOrgsTable.tsx', 'AdminEditOrgPage.tsx'

### Users (Server Admin)

- …/public/app/routes -> 'routes.ts'
- …/public/app/features/admin -> 'UserProfile.tsx’, 'UserPermissions.tsx', 'UserOrgs.tsx', 'AdminListOrgsPage.tsx', 'UserListAdminPage.tsx', 'UserAdminPage.tsx'

### Permission list while assigning permissions for new dashbaord, Dashboard will be private by default so hiding Role based permission from the list

- …/public/app/types -> 'acl.ts'

### Import dashboards via Grafana.com

- …/pkg/api -> 'index.go'
- …/public/app/features/manage-dashboards -> 'DashboardImportPage.tsx'
- …/public/app/features/manage-dashboards/state -> 'actions.ts'

### Enterprise data source plugins

- …/public/app/features/datasources/state -> 'buildCategories.ts'

# **_Report Distribution_**

### Grafana source code change to support the new report distribution feature

- …/pkg/api -> 'index.go', 'report_scheduler.go', 'report_scheduler_settings.go', 'scheduler_api.go'
- …/pkg/api/dtos -> 'index.go', 'report_scheduler.go'
- …/pkg/util -> 'strings.go'
- …/pkg/models -> 'report_scheduler_setting.go'
- …/public/app/core/components/sidemenu -> 'TopSection.tsx'
- …/public/app/features/reports/…
- …/pkg/services/cleanup -> 'cleanup.go'
- …/pkg/services/rendering -> 'interface.go'
- …/pkg/services/rendering -> 'rendering.go'
- …/pkg/services/scheduler -> 'service.go'
- …/pkg/services/sqlstore/migrations -> 'report_scheduler_mig.go'
- …/pkg/services/sqlstore -> 'report_scheduler_settings.go'
- …/pkg/util -> 'report_scheduler.go'
- …/public/app/core/reducers -> 'root.ts'
- …/public/app/core/services -> 'reports_srv.ts'
- …/public/app/features/dashboard/components/DashNav -> 'DashNav.tsx'
- …/public/app/routes -> 'routes.scheduler.ts'

# **_Feature Flag_**

- …/conf -> 'custom.ini'
- …/pkg/api -> 'index.go'
- …/pkg/api -> 'api.go'
- …/pkg/api -> 'feature_flag.go '
- …/pkg/setting -> 'setting.go'
- …/pkg/api -> 'frontendsettings.go'
- …/packages/grafana-data/src/types -> 'config.ts'
- …/packages/grafana-runtime/src -> 'config.ts'
- …/public/app/features/dashboard/services -> 'featureFlagSrv.ts'

# **_DRJ71-730: Tenants onboarded with same name_**

- …/pkg/services/sqlstore/migrations -> 'org_mig.go'
- …/pkg/services/sqlstore -> 'org.go'
- …/public/app/features/org -> 'NewOrgPage.tsx'

# **_Configurable Links_**

- …/pkg/api/dtos -> 'configuration.go'
- …/pkg/api -> 'configuration.go'
- …/pkg/models -> 'configuration.go'
- …/pkg/services/sqlstore/migrations -> 'configuration_mig.go'
- …/public/app/features/org/state -> 'configuration.ts'
- …/public/app/features/org -> 'OrgCustomConfiguration.tsx'
- …/public/app/core/components/SharedPreferences -> 'SharedPreferences.tsx'

# **_Table Old plugin_**

- …/public/app/plugins/panel/table-old -> 'column_options.ts'
- …/public/app/plugins/panel/table-old -> 'module.ts'
- …/public/app/plugins/panel/table-old -> 'plugin.json'
- …/public/app/plugins/panel/table-old -> 'render_json.ts'
- …/public/app/plugins/panel/table-old -> 'renderer.ts'

# **_Advanced functions_**

- …/packages/grafana-data/src/transformations -> 'transformers.ts'
- …/packages/grafana-data/src/transformations/transformers -> 'advanceFunctions.ts'
- …/packages/grafana-data/src/transformations/transformers -> 'ids.ts'
- …/public/app/core/components/TransformersUI -> 'AdvanceFunctionsTransformerEditor.tsx'
- …/public/app/core/utils -> 'standardTransformers.ts'

# **_Other:_**

# Fixes

- DRE21-2059 - …/public/sass/components -> '\_submenu.scss'

### Table Panel (fix issue: 'No Data' is not displayed)

- …/public/app/pluginspanel/table -> 'TablePanel.tsx'

### Panel Header to show tooltip (fix issue: when panel header text is truncated there is no tooltip to show the full text)

- …/public/app/features/dashboard/dashgrid/PanelHeader -> 'PanelHeader.tsx'

### New folder creation (fix issue: DRE21-3602 - New folder creation is giving 404 error however folder is created successfully)

- …/pkg/models -> 'dashboards.go'

### Snapshot URL (fix issue: DRE21-3576 - [SolQABugHunt2008]{Grafana] local snapshot link point to different tenant)

- …/public/app/features/dashboard/components/ShareModal -> 'ShareSnapshot.tsx'
- …/public/app/features/dashboard/components/ShareModal -> 'utils.ts'

### Short URL feature - remove short url feature becuase Grafana bug when using PoastgreSql DB

- …/public/app/features/dashboard/components/ShareModal -> 'ShareLink.tsx'
- …/public/app/features/explore' -> 'ExploreToolbar.ts'
