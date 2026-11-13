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

const WideEnvironmentVersion = lazy(async () => {
  const { WideEnvironmentView } = await import(
    /* webpackChunkName: "DrilldownWideNarrow"*/ '../widenarrow/WideNarrowViews'
  );
  return { default: WideEnvironmentView };
});

const WideTeamVersion = lazy(async () => {
  const { WideTeamView } = await import(/* webpackChunkName: "DrilldownWideNarrow"*/ '../widenarrow/WideNarrowViews');
  return { default: WideTeamView };
});

const WideServiceVersion = lazy(async () => {
  const { WideServiceView } = await import(
    /* webpackChunkName: "DrilldownWideNarrow"*/ '../widenarrow/WideNarrowViews'
  );
  return { default: WideServiceView };
});

const ReadinessHomeVersion = lazy(
  () => import(/* webpackChunkName: "DrilldownReadinessHome"*/ '../readiness/ReadinessHomePage')
);

const ReadinessDiagnoseVersion = lazy(
  () => import(/* webpackChunkName: "DrilldownReadiness"*/ '../readiness/ReadinessDiagnosePage')
);

// Versions kept in the code but not shown as tabs.
const HIDDEN_VERSION_IDS = ['nadine', 'readiness', 'wide-narrow'];

// Each version is one tab on /drilldown. Add a version by adding an entry here; the first entry is the default.
export function getDrilldownVersions(): DrilldownVersion[] {
  const home = t('drilldown-versions.views.home', 'Home');
  return getAllVersions(home).filter((version) => !HIDDEN_VERSION_IDS.includes(version.id));
}

function getAllVersions(home: string): DrilldownVersion[] {
  return [
    {
      id: 'nadine',
      label: t('drilldown-versions.tabs.nadine', "Nadine's prototype"),
      views: [{ id: 'home', label: home, component: NadineVersion }],
    },
    {
      id: 'nadine-real',
      label: t('drilldown-versions.tabs.nadine-real', "Nadine's design"),
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
      id: 'wide-narrow',
      label: t('drilldown-versions.tabs.wide-narrow', 'Start wide, then narrow'),
      views: [
        {
          id: 'home',
          label: t('drilldown-versions.views.wide-environment', 'Environment, ranked by change'),
          component: WideEnvironmentVersion,
        },
        {
          id: 'team',
          label: t('drilldown-versions.views.wide-team', 'Namespace with scenario lens'),
          component: WideTeamVersion,
        },
        {
          id: 'service',
          label: t('drilldown-versions.views.wide-service', 'Narrowed to a service'),
          component: WideServiceVersion,
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
