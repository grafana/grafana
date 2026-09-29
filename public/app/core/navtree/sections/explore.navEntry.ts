import { config } from '@grafana/runtime';

import { NavID, NavWeight } from '../constants';
import { dataSourcesExploreAccess } from '../pageAccess';
import { type NavEntryBuilder } from '../utils';

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
