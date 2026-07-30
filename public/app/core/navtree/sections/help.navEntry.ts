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
