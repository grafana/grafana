import { config } from '@grafana/runtime';

import { NavID, NavWeight } from '../constants';
import { dataSourcesExploreAccess } from '../pageAccess';
import { buildEntries, isSignedIn, type NavEntryBuilder } from '../utils';

// Learning exercise (apps/colorshapes/plan.md), disabled by default on the backend
// (served: false) — kept as a static child here rather than the plugin-applinks
// mechanism real Drilldown family members use (pkg/services/navtree/navtreeimpl/applinks.go),
// since this isn't an installed plugin.
const DRILLDOWN_CHILDREN: NavEntryBuilder[] = [
  {
    when: isSignedIn,
    build: () => ({
      text: 'Errors',
      id: 'drilldown/colorshapes',
      url: '/colorshapes',
    }),
  },
];

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
    children: buildEntries(DRILLDOWN_CHILDREN),
  }),
};
