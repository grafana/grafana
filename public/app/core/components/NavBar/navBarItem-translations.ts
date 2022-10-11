// Maps the ID of the nav item to a translated phrase to later pass to <Trans />
// Because the navigation content is dynamic (defined in the backend), we can not use
// the normal inline message definition method.

import { t } from 'app/core/internationalization';

// The keys of the TRANSLATED_MENU_ITEMS object (NOT the id inside the defineMessage function)
// must match the ID of the navigation item, as defined in the backend nav model

// see pkg/api/index.go
export default function getNavTranslation(navId: string | undefined) {
  switch (navId) {
    case 'home':
      return t('nav.home', 'Home');
    case 'create':
      return t('nav.create', 'Create');
    case 'create-dashboard':
      return t('nav.create-dashboard', 'Dashboard');
    case 'folder':
      return t('nav.create-folder', 'Folder');
    case 'import':
      return t('nav.create-import', 'Import');
    case 'alert':
      return t('nav.create-alert', 'New alert rule');
    case 'starred':
      return t('nav.starred', 'Starred');
    case 'starred-empty':
      return t('nav.starred-empty', 'Your starred dashboards will appear here');
    case 'dashboards':
      return t('nav.dashboards', 'Dashboards');
    case 'dashboards/browse':
      return t('nav.manage-dashboards', 'Browse');
    case 'dashboards/playlists':
      return t('nav.playlists', 'Playlists');
    case 'dashboards/snapshots':
      return t('nav.snapshots', 'Snapshots');
    case 'dashboards/library-panels':
      return t('nav.library-panels', 'Library panels');
    case 'dashboards/new':
      return t('nav.new-dashboard', 'New dashboard');
    case 'dashboards/folder/new':
      return t('nav.new-folder', 'New folder');
    case 'explore':
      return t('nav.explore', 'Explore');
    case 'alerting':
      return t('nav.alerting', 'Alerting');
    case 'alerting-legacy':
      return t('nav.alerting-legacy', 'Alerting (legacy)');
    case 'alert-list':
      return t('nav.alerting-list', 'Alert rules');
    case 'receivers':
      return t('nav.alerting-receivers', 'Contact points');
    case 'am-routes':
      return t('nav.alerting-am-routes', 'Notification policies');
    case 'channels':
      return t('nav.alerting-channels', 'Notification channels');
    case 'silences':
      return t('nav.alerting-silences', 'Silences');
    case 'groups':
      return t('nav.alerting-groups', 'Groups');
    case 'alerting-admin':
      return t('nav.alerting-admin', 'Admin');
    case 'cfg':
      return t('nav.config', 'Configuration');
    case 'datasources':
      return t('nav.datasources', 'Data sources');
    case 'correlations':
      return t('nav.correlations', 'Correlations');
    case 'users':
      return t('nav.users', 'Users');
    case 'teams':
      return t('nav.teams', 'Teams');
    case 'plugins':
      return t('nav.plugins', 'Plugins');
    case 'org-settings':
      return t('nav.org-settings', 'Preferences');
    case 'apikeys':
      return t('nav.api-keys', 'API keys');
    case 'serviceaccounts':
      return t('nav.service-accounts', 'Service accounts');
    case 'live':
      return t('nav.live', 'Event streaming');
    case 'live-status':
      return t('nav.live-status', 'Status');
    case 'live-pipeline':
      return t('nav.live-pipeline', 'Pipeline');
    case 'live-cloud':
      return t('nav.live-cloud', 'Cloud');
    case 'help':
      return t('nav.help', 'Help');
    case 'profile-settings':
      return t('nav.profile/settings', 'Preferences');
    case 'change-password':
      return t('nav.profile/password', 'Change password');
    case 'sign-out':
      return t('nav.sign-out', 'Sign out');
    default:
      return undefined;
  }
}
