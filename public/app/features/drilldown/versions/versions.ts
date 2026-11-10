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

const NadineVersion = lazy(() => import(/* webpackChunkName: "DrilldownPage"*/ '../DrilldownPage'));

const NadineRealDataVersion = lazy(
  () => import(/* webpackChunkName: "DrilldownRealData"*/ '../realdata/RealDataDrilldownPage')
);

const OtelFirstVersion = lazy(
  () => import(/* webpackChunkName: "DrilldownOtelFirst"*/ '../otelfirst/OtelFirstHomePage')
);

const OtelFirstScopeVersion = lazy(async () => {
  const { OtelFirstScopeView } = await import(
    /* webpackChunkName: "DrilldownOtelFirstViews"*/ '../otelfirst/OtelFirstViews'
  );
  return { default: OtelFirstScopeView };
});

const OtelFirstMappingVersion = lazy(async () => {
  const { OtelFirstMappingView } = await import(
    /* webpackChunkName: "DrilldownOtelFirstViews"*/ '../otelfirst/OtelFirstViews'
  );
  return { default: OtelFirstMappingView };
});

const OtelFirstTraceVersion = lazy(async () => {
  const { OtelFirstTraceView } = await import(
    /* webpackChunkName: "DrilldownOtelFirstTrace"*/ '../otelfirst/OtelFirstTrace'
  );
  return { default: OtelFirstTraceView };
});

const ReadinessHomeVersion = lazy(
  () => import(/* webpackChunkName: "DrilldownReadinessHome"*/ '../readiness/ReadinessHomePage')
);

const ReadinessDiagnoseVersion = lazy(
  () => import(/* webpackChunkName: "DrilldownReadiness"*/ '../readiness/ReadinessDiagnosePage')
);

// Each version is one tab on /drilldown. Add a version by adding an entry here; the first entry is the default.
export function getDrilldownVersions(): DrilldownVersion[] {
  const home = t('drilldown-versions.views.home', 'Home');
  return [
    {
      id: 'nadine',
      label: t('drilldown-versions.tabs.nadine', "Nadine's prototype"),
      views: [{ id: 'home', label: home, component: NadineVersion }],
    },
    {
      id: 'nadine-real',
      label: t('drilldown-versions.tabs.nadine-real', "Nadine's design, real data"),
      views: [{ id: 'home', label: home, component: NadineRealDataVersion }],
    },
    {
      id: 'otel-first',
      label: t('drilldown-versions.tabs.otel-first', 'OTel first'),
      views: [
        { id: 'home', label: home, component: OtelFirstVersion },
        {
          id: 'scope',
          label: t('drilldown-versions.views.otel-first-scope', 'Service scope'),
          component: OtelFirstScopeVersion,
        },
        {
          id: 'mapping',
          label: t('drilldown-versions.views.otel-first-mapping', 'Attribute mapping'),
          component: OtelFirstMappingVersion,
        },
        {
          id: 'trace',
          label: t('drilldown-versions.views.otel-first-trace', 'One trace end to end'),
          component: OtelFirstTraceVersion,
        },
      ],
    },
    {
      id: 'readiness',
      label: t('drilldown-versions.tabs.readiness', 'Readiness'),
      views: [
        { id: 'home', label: home, component: ReadinessHomeVersion },
        {
          id: 'diagnose',
          label: t('drilldown-versions.views.readiness-diagnose', 'Diagnose'),
          component: ReadinessDiagnoseVersion,
        },
      ],
    },
  ];
}
