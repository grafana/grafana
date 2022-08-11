import { MessageDescriptor } from '@lingui/core';
import { defineMessage } from '@lingui/macro';

// Maps the ID of the nav item to a translated phrase to later pass to <Trans />
// Because the navigation content is dynamic (defined in the backend), we can not use
// the normal inline message definition method.

// The keys of the TRANSLATED_MENU_ITEMS object (NOT the id inside the defineMessage function)
// must match the ID of the navigation item, as defined in the backend nav model

// see pkg/api/index.go
const TRANSLATED_MENU_ITEMS: Record<string, MessageDescriptor> = {
  home: defineMessage({ id: 'nav.home', message: 'Home' }),

  create: defineMessage({ id: 'nav.create', message: 'Create' }),
  'create-dashboard': defineMessage({ id: 'nav.create-dashboard', message: 'Dashboard' }),
  folder: defineMessage({ id: 'nav.create-folder', message: 'Folder' }),
  import: defineMessage({ id: 'nav.create-import', message: 'Import' }),
  alert: defineMessage({ id: 'nav.create-alert', message: 'New alert rule' }),

  starred: defineMessage({ id: 'nav.starred', message: 'Starred' }),
  'starred-empty': defineMessage({ id: 'nav.starred-empty', message: 'Your starred dashboards will appear here' }),
  dashboards: defineMessage({ id: 'nav.dashboards', message: 'Dashboards' }),
  'dashboards/browse': defineMessage({ id: 'nav.manage-dashboards', message: 'Browse' }),
  'dashboards/playlists': defineMessage({ id: 'nav.playlists', message: 'Playlists' }),
  'dashboards/snapshots': defineMessage({ id: 'nav.snapshots', message: 'Snapshots' }),
  'dashboards/library-panels': defineMessage({ id: 'nav.library-panels', message: 'Library panels' }),
  'dashboards/new': defineMessage({ id: 'nav.new-dashboard', message: 'New dashboard' }),
  'dashboards/folder/new': defineMessage({ id: 'nav.new-folder', message: 'New folder' }),

  explore: defineMessage({ id: 'nav.explore', message: 'Explore' }),

  alerting: defineMessage({ id: 'nav.alerting', message: 'Alerting' }),
  'alerting-legacy': defineMessage({ id: 'nav.alerting-legacy', message: 'Alerting (legacy)' }),
  'alert-list': defineMessage({ id: 'nav.alerting-list', message: 'Alert rules' }),
  receivers: defineMessage({ id: 'nav.alerting-receivers', message: 'Contact points' }),
  'am-routes': defineMessage({ id: 'nav.alerting-am-routes', message: 'Notification policies' }),
  channels: defineMessage({ id: 'nav.alerting-channels', message: 'Notification channels' }),

  silences: defineMessage({ id: 'nav.alerting-silences', message: 'Silences' }),
  groups: defineMessage({ id: 'nav.alerting-groups', message: 'Groups' }),
  'alerting-admin': defineMessage({ id: 'nav.alerting-admin', message: 'Admin' }),

  cfg: defineMessage({ id: 'nav.config', message: 'Configuration' }),
  datasources: defineMessage({ id: 'nav.datasources', message: 'Data sources' }),
  correlations: defineMessage({ id: 'nav.correlations', message: 'Correlations' }),
  users: defineMessage({ id: 'nav.users', message: 'Users' }),
  teams: defineMessage({ id: 'nav.teams', message: 'Teams' }),
  plugins: defineMessage({ id: 'nav.plugins', message: 'Plugins' }),
  'org-settings': defineMessage({ id: 'nav.org-settings', message: 'Preferences' }),
  apikeys: defineMessage({ id: 'nav.api-keys', message: 'API keys' }),
  serviceaccounts: defineMessage({ id: 'nav.service-accounts', message: 'Service accounts' }),

  live: defineMessage({ id: 'nav.live', message: 'Event streaming' }),
  'live-status': defineMessage({ id: 'nav.live-status', message: 'Status' }),
  'live-pipeline': defineMessage({ id: 'nav.live-pipeline', message: 'Pipeline' }),
  'live-cloud': defineMessage({ id: 'nav.live-cloud', message: 'Cloud' }),

  help: defineMessage({ id: 'nav.help', message: 'Help' }),

  'profile-settings': defineMessage({ id: 'nav.profile/settings', message: 'Preferences' }),
  'change-password': defineMessage({ id: 'nav.profile/password', message: 'Change password' }),
  'sign-out': defineMessage({ id: 'nav.sign-out', message: 'Sign out' }),
};

export default TRANSLATED_MENU_ITEMS;
