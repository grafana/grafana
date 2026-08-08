import { type NavModelItem } from '@grafana/data';
import { AccessControlAction } from 'app/types/accessControl';

import { NavID, NavWeight } from '../constants';
import { buildEntries, has, type NavEntryBuilder } from '../utils';

const connectionsConfigPageAccess = () =>
  has(AccessControlAction.DataSourcesCreate) ||
  (has(AccessControlAction.DataSourcesRead) &&
    (has(AccessControlAction.DataSourcesDelete) || has(AccessControlAction.DataSourcesWrite)));

const CONNECTIONS_CHILDREN: NavEntryBuilder[] = [
  {
    when: connectionsConfigPageAccess,
    build: () => ({
      id: 'connections-add-new-connection',
      text: 'Add new connection',
      subTitle: 'Browse and create new connections',
      url: '/connections/add-new-connection',
      children: [],
      keywords: ['csv', 'graphite', 'json', 'loki', 'prometheus', 'sql', 'tempo'],
    }),
  },
  {
    when: connectionsConfigPageAccess,
    build: () => ({
      id: 'connections-datasources',
      text: 'Data sources',
      subTitle: 'View and manage your connected data source connections',
      url: '/connections/datasources',
      children: [],
    }),
  },
];

export const connectionsNavEntry: NavEntryBuilder = {
  // Always present so plugin pages can attach to it; pruned by
  // pruneEmptyNavSections if it still has no children after the merge.
  when: () => true,
  build: (): NavModelItem => ({
    text: 'Connections',
    icon: 'adjust-circle',
    id: NavID.connections,
    url: '/connections',
    children: buildEntries(CONNECTIONS_CHILDREN),
    sortWeight: NavWeight.dataConnections,
  }),
};
