import { config } from '@grafana/runtime';
import { AccessControlAction } from 'app/types/accessControl';

import { NavID, NavWeight } from '../constants';
import { buildEntries, hasAny, type NavEntryBuilder } from '../utils';

const HELP_CHILDREN: NavEntryBuilder[] = [
  {
    when: () =>
      config.supportBundlesEnabled &&
      hasAny(AccessControlAction.ActionSupportBundlesRead, AccessControlAction.ActionSupportBundlesCreate),
    build: () => ({
      text: 'Support bundles',
      id: 'support-bundles',
      url: '/support-bundles',
      icon: 'wrench',
      sortWeight: NavWeight.help,
    }),
  },
];

// hideFromTabs is deliberately not set here, even though the server-built tree
// sets it when an interactive learning plugin is installed (and the top bar
// keys off it to open interactive learning instead of the Help dropdown).
// Whether those plugins are installed is async plugin data, so it cannot be
// resolved in this synchronous static build; the plugin nav phase applies it as
// a PLUGIN_NAV_OVERRIDES entry once the installed app set is known. Until that
// phase is enabled the Help button falls back to the dropdown.
export const helpNavEntry: NavEntryBuilder = {
  when: () => config.helpEnabled,
  build: () => ({
    text: 'Help',
    id: NavID.help,
    url: '#',
    icon: 'question-circle',
    sortWeight: NavWeight.help,
    children: buildEntries(HELP_CHILDREN),
  }),
};
