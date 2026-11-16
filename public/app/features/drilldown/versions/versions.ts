import { type ComponentType, lazy } from 'react';

import { t } from '@grafana/i18n';

export interface DrilldownView {
  id: string;
  label: string;
  component: ComponentType;
}

// A version is one idea. Its first view is the home view and the default. A version with more than one view
// shows its views in a dropdown on its tab.
export interface DrilldownVersion {
  id: string;
  label: string;
  views: DrilldownView[];
}

const NadineRealDataVersion = lazy(
  () => import(/* webpackChunkName: "DrilldownRealData"*/ '../realdata/RealDataDrilldownPage')
);

// Each version is one tab on /drilldown. Add a version by adding an entry here; the first entry is the default.
export function getDrilldownVersions(): DrilldownVersion[] {
  const home = t('drilldown-versions.views.home', 'Home');
  return getAllVersions(home);
}

function getAllVersions(home: string): DrilldownVersion[] {
  return [
    {
      id: 'nadine-real',
      label: t('drilldown-versions.tabs.nadine-real', "Nadine's design"),
      views: [{ id: 'home', label: home, component: NadineRealDataVersion }],
    },
  ];
}
