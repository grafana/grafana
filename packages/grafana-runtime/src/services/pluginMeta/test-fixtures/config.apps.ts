import { cloneDeep } from 'lodash';

import { AngularMeta, AppPluginConfig, PluginLoadingStrategy } from '@grafana/data';

import { AppPluginMetas } from '../types';

export const app: AppPluginConfig = cloneDeep({
  id: 'myorg-someplugin-app',
  path: 'public/plugins/myorg-someplugin-app/module.js',
  version: '1.0.0',
  preload: false,
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  angular: { detected: false } as AngularMeta,
  loadingStrategy: PluginLoadingStrategy.script,
  extensions: {
    addedLinks: [],
    addedComponents: [],
    exposedComponents: [],
    extensionPoints: [],
    addedFunctions: [],
  },
  dependencies: {
    grafanaDependency: '>=10.4.0',
    grafanaVersion: '*',
    plugins: [],
    extensions: {
      exposedComponents: [],
    },
  },
  buildMode: 'production',
});

export const apps: AppPluginMetas = cloneDeep({
  'grafana-exploretraces-app': {
    id: 'grafana-exploretraces-app',
    path: 'public/plugins/grafana-exploretraces-app/module.js',
    version: '1.2.2',
    preload: true,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    angular: { detected: false } as AngularMeta,
    loadingStrategy: PluginLoadingStrategy.script,
    extensions: {
      addedLinks: [
        {
          targets: ['grafana/dashboard/panel/menu'],
          title: 'Open in Traces Drilldown',
          description: 'Open current query in the Traces Drilldown app',
        },
        {
          targets: ['grafana/explore/toolbar/action'],
          title: 'Open in Grafana Traces Drilldown',
          description: 'Try our new queryless experience for traces',
        },
      ],
      addedComponents: [
        {
          targets: ['grafana-asserts-app/entity-assertions-widget/v1'],
          title: 'Asserts widget',
          description: 'A block with assertions for a given service',
        },
        {
          targets: ['grafana-asserts-app/insights-timeline-widget/v1'],
          title: 'Insights Timeline Widget',
          description: 'Widget for displaying insights timeline in other apps',
        },
      ],
      exposedComponents: [
        {
          id: 'grafana-exploretraces-app/open-in-explore-traces-button/v1',
          title: 'Open in Traces Drilldown button',
          description: 'A button that opens a traces view in the Traces Drilldown app.',
        },
        {
          id: 'grafana-exploretraces-app/embedded-trace-exploration/v1',
          title: 'Embedded Trace Exploration',
          description:
            'A component that renders a trace exploration view that can be embedded in other parts of Grafana.',
        },
      ],
      extensionPoints: [
        {
          id: 'grafana-exploretraces-app/investigation/v1',
          title: '',
          description: '',
        },
        {
          id: 'grafana-exploretraces-app/get-logs-drilldown-link/v1',
          title: '',
          description: '',
        },
      ],
      addedFunctions: [],
    },
    dependencies: {
      grafanaDependency: '>=11.5.0',
      grafanaVersion: '*',
      plugins: [],
      extensions: {
        exposedComponents: [
          'grafana-asserts-app/entity-assertions-widget/v1',
          'grafana-asserts-app/insights-timeline-widget/v1',
        ],
      },
    },
    buildMode: 'production',
  },
  'grafana-lokiexplore-app': {
    id: 'grafana-lokiexplore-app',
    path: 'public/plugins/grafana-lokiexplore-app/module.js',
    version: '1.0.32',
    preload: true,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    angular: { detected: false } as AngularMeta,
    loadingStrategy: PluginLoadingStrategy.script,
    extensions: {
      addedLinks: [
        {
          targets: [
            'grafana/dashboard/panel/menu',
            'grafana/explore/toolbar/action',
            'grafana-metricsdrilldown-app/open-in-logs-drilldown/v1',
            'grafana-assistant-app/navigateToDrilldown/v1',
          ],
          title: 'Open in Grafana Logs Drilldown',
          description: 'Open current query in the Grafana Logs Drilldown view',
        },
      ],
      addedComponents: [
        {
          targets: ['grafana-asserts-app/insights-timeline-widget/v1'],
          title: 'Insights Timeline Widget',
          description: 'Widget for displaying insights timeline in other apps',
        },
      ],
      exposedComponents: [
        {
          id: 'grafana-lokiexplore-app/open-in-explore-logs-button/v1',
          title: 'Open in Logs Drilldown button',
          description: 'A button that opens a logs view in the Logs Drilldown app.',
        },
        {
          id: 'grafana-lokiexplore-app/embedded-logs-exploration/v1',
          title: 'Embedded Logs Exploration',
          description:
            'A component that renders a logs exploration view that can be embedded in other parts of Grafana.',
        },
      ],
      extensionPoints: [
        {
          id: 'grafana-lokiexplore-app/investigation/v1',
          title: '',
          description: '',
        },
      ],
      addedFunctions: [
        {
          targets: ['grafana-exploretraces-app/get-logs-drilldown-link/v1'],
          title: 'Open Logs Drilldown',
          description: 'Returns url to logs drilldown app',
        },
      ],
    },
    dependencies: {
      grafanaDependency: '>=11.6.0',
      grafanaVersion: '*',
      plugins: [],
      extensions: {
        exposedComponents: [
          'grafana-adaptivelogs-app/temporary-exemptions/v1',
          'grafana-lokiexplore-app/embedded-logs-exploration/v1',
          'grafana-asserts-app/insights-timeline-widget/v1',
          'grafana/add-to-dashboard-form/v1',
        ],
      },
    },
    buildMode: 'production',
  },
  'grafana-metricsdrilldown-app': {
    id: 'grafana-metricsdrilldown-app',
    path: 'public/plugins/grafana-metricsdrilldown-app/module.js',
    version: '1.0.26',
    preload: true,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    angular: { detected: false } as AngularMeta,
    loadingStrategy: PluginLoadingStrategy.script,
    extensions: {
      addedLinks: [
        {
          targets: [
            'grafana/dashboard/panel/menu',
            'grafana/explore/toolbar/action',
            'grafana-assistant-app/navigateToDrilldown/v1',
            'grafana/alerting/alertingrule/queryeditor',
          ],
          title: 'Open in Grafana Metrics Drilldown',
          description: 'Open current query in the Grafana Metrics Drilldown view',
        },
        {
          targets: ['grafana-metricsdrilldown-app/grafana-assistant-app/navigateToDrilldown/v0-alpha'],
          title: 'Navigate to metrics drilldown',
          description: 'Build a url path to the metrics drilldown',
        },
        {
          targets: ['grafana/datasources/config/actions', 'grafana/datasources/config/status'],
          title: 'Open in Metrics Drilldown',
          description: 'Browse metrics in Grafana Metrics Drilldown',
        },
      ],
      addedComponents: [],
      exposedComponents: [
        {
          id: 'grafana-metricsdrilldown-app/label-breakdown-component/v1',
          title: 'Label Breakdown',
          description: 'A metrics label breakdown view from the Metrics Drilldown app.',
        },
        {
          id: 'grafana-metricsdrilldown-app/knowledge-graph-insight-metrics/v1',
          title: 'Knowledge Graph Source Metrics',
          description: 'Explore the underlying metrics related to a Knowledge Graph insight',
        },
      ],
      extensionPoints: [
        {
          id: 'grafana-exploremetrics-app/investigation/v1',
          title: '',
          description: '',
        },
        {
          id: 'grafana-metricsdrilldown-app/open-in-logs-drilldown/v1',
          title: '',
          description: '',
        },
      ],
      addedFunctions: [],
    },
    dependencies: {
      grafanaDependency: '>=11.6.0',
      grafanaVersion: '*',
      plugins: [],
      extensions: {
        exposedComponents: ['grafana/add-to-dashboard-form/v1'],
      },
    },
    buildMode: 'production',
  },
  'grafana-pyroscope-app': {
    id: 'grafana-pyroscope-app',
    path: 'public/plugins/grafana-pyroscope-app/module.js',
    version: '1.14.2',
    preload: true,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    angular: { detected: false } as AngularMeta,
    loadingStrategy: PluginLoadingStrategy.script,
    extensions: {
      addedLinks: [
        {
          targets: [
            'grafana/explore/toolbar/action',
            'grafana/traceview/details',
            'grafana-assistant-app/navigateToDrilldown/v1',
          ],
          title: 'Open in Grafana Profiles Drilldown',
          description: 'Try our new queryless experience for profiles',
        },
      ],
      addedComponents: [],
      exposedComponents: [
        {
          id: 'grafana-pyroscope-app/embedded-profiles-exploration/v1',
          title: 'Embedded Profiles Exploration',
          description:
            'A component that renders a profiles exploration view that can be embedded in other parts of Grafana.',
        },
      ],
      extensionPoints: [
        {
          id: 'grafana-pyroscope-app/investigation/v1',
          title: '',
          description: '',
        },
        {
          id: 'grafana-pyroscope-app/settings/v1',
          title: '',
          description: '',
        },
      ],
      addedFunctions: [],
    },
    dependencies: {
      grafanaDependency: '>=11.5.0',
      grafanaVersion: '*',
      plugins: [],
      extensions: {
        exposedComponents: [
          'grafana-o11yinsights-app/insights-launcher/v1',
          'grafana-adaptiveprofiles-app/resolution-boost/v1',
        ],
      },
    },
    buildMode: 'production',
  },
  [app.id]: app,
});
