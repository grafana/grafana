import { config } from '@grafana/runtime';
import { AccessControlAction } from 'app/types/accessControl';

import { NavID, NavWeight } from '../constants';
import { has, type NavEntryBuilder } from '../utils';

// Page-access predicate shared with the route guards in
// public/app/routes/routes.tsx, so nav visibility and route access can't drift.
const dataSourcesExploreAccess = () => has(AccessControlAction.DataSourcesExplore);

export const exploreNavEntry: NavEntryBuilder = {
  when: () => config.exploreEnabled && dataSourcesExploreAccess(),
  build: () => ({
    text: 'Explore',
    id: NavID.explore,
    subTitle: 'Explore your data',
    icon: 'compass',
    sortWeight: NavWeight.explore,
    url: '/explore',
  }),
};

export const drilldownNavEntry: NavEntryBuilder = {
  when: dataSourcesExploreAccess,
  build: () => ({
    text: 'Drilldown',
    id: NavID.drilldown,
    subTitle: "Drill down into your data using Grafana's powerful queryless apps",
    icon: 'drilldown',
    sortWeight: NavWeight.drilldown,
    url: '/drilldown',
  }),
};
