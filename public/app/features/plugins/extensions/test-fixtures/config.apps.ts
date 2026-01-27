import { cloneDeep } from 'lodash';

import { AngularMeta, AppPluginConfig, PluginLoadingStrategy } from '@grafana/data';
import { AppPluginMetas } from '@grafana/runtime/internal';

const app: AppPluginConfig = cloneDeep({
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

export const metas: AppPluginMetas = cloneDeep({
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
  'grafana-assistant-app': {
    id: 'grafana-assistant-app',
    path: 'https://plugins-cdn.grafana-ops.net/grafana-assistant-app/1.1.24+58ee124e03cacc64622bfd434222be36787410d8/public/plugins/grafana-assistant-app/module.js',
    version: '1.1.24+58ee124e03cacc64622bfd434222be36787410d8',
    preload: false,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    angular: { detected: false } as AngularMeta,
    loadingStrategy: PluginLoadingStrategy.script,
    extensions: {
      addedLinks: [
        {
          targets: ['grafana/extension-sidebar/v0-alpha'],
          title: 'Grafana Assistant',
          description: 'Opens Grafana Assistant',
        },
        {
          targets: ['grafana/dashboard/panel/menu'],
          title: 'Explain in Assistant',
          description: 'Explain in Assistant',
        },
        {
          targets: ['grafana/commandpalette/action'],
          title: '✨ Open Assistant',
          description: '✨ Open Assistant',
        },
        {
          targets: ['grafana/commandpalette/action'],
          title: 'Assistant Playbooks',
          description: 'Assistant Playbooks',
        },
      ],
      addedComponents: [
        {
          targets: ['grafana/extension-sidebar/v0-alpha'],
          title: 'Grafana Assistant',
          description: 'Opens Grafana Assistant',
        },
        {
          targets: ['grafana/datasources/config/status'],
          title: 'Explain in Assistant',
          description: 'Explain in Assistant',
        },
        {
          targets: ['grafana/traceview/header/actions'],
          title: 'Analyze trace with AI assistant',
          description: 'AI Trace Analysis',
        },
      ],
      exposedComponents: [
        {
          id: 'grafana-assistant-app/view-report/v1',
          title: 'Investigation Findings',
          description: 'Displays minimal investigation key findings',
        },
        {
          id: 'grafana-assistant-app/investigation-status/v1',
          title: 'Investigation Status',
          description: 'Displays investigation status with animated progress indicator, summary, and duration',
        },
      ],
      extensionPoints: [],
      addedFunctions: [
        {
          targets: ['grafana/grafana-assistant-app/add-callback-function/v0-alpha'],
          title: 'addCallbackFunction',
          description: 'addCallbackFunction',
        },
      ],
    },
    dependencies: {
      grafanaDependency: '>=12.0.0-0',
      grafanaVersion: '*',
      plugins: [],
      extensions: {
        exposedComponents: [
          'grafana-exploretraces-app/embedded-trace-exploration/v1',
          'grafana-metricsdrilldown-app/mini-breakdown-component/v1',
        ],
      },
    },
    moduleHash: 'sha256-9hm/qb7FzfNc1T5Un+QTQvqIrRXZUpQNUv3afPS8ytA=',
    buildMode: 'production',
  },
  'grafana-pathfinder-app': {
    id: 'grafana-pathfinder-app',
    path: 'https://plugins-cdn.grafana-ops.net/grafana-pathfinder-app/1.4.0/public/plugins/grafana-pathfinder-app/module.js',
    version: '1.4.0',
    preload: false,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    angular: { detected: false } as AngularMeta,
    loadingStrategy: PluginLoadingStrategy.script,
    extensions: {
      addedLinks: [
        {
          targets: ['grafana/extension-sidebar/v0-alpha'],
          title: 'Documentation-Link',
          description: 'Opens Interactive learning',
        },
        {
          targets: ['grafana/commandpalette/action'],
          title: 'Open Interactive learning',
          description: 'Open Interactive learning',
        },
        {
          targets: ['grafana/commandpalette/action'],
          title: 'Need help?',
          description: 'Get help with Grafana',
        },
        {
          targets: ['grafana/commandpalette/action'],
          title: 'Learn Grafana',
          description: 'Learn how to use Grafana',
        },
      ],
      addedComponents: [
        {
          targets: ['grafana/extension-sidebar/v0-alpha'],
          title: 'Interactive learning',
          description: 'Opens Interactive learning',
        },
      ],
      exposedComponents: [],
      extensionPoints: [],
      addedFunctions: [],
    },
    dependencies: {
      grafanaDependency: '>=12.3.0-0',
      grafanaVersion: '*',
      plugins: [],
      extensions: {
        exposedComponents: [],
      },
    },
    moduleHash: 'sha256-AED7SCpo01zHg/zP3TIH8zm2zesFT6rGaNjklnkkbxc=',
    translations: {
      'cs-CZ':
        'https://plugins-cdn.grafana-ops.net/grafana-pathfinder-app/1.4.0/public/plugins/grafana-pathfinder-app/locales/cs-CZ/grafana-pathfinder-app.json',
      'de-DE':
        'https://plugins-cdn.grafana-ops.net/grafana-pathfinder-app/1.4.0/public/plugins/grafana-pathfinder-app/locales/de-DE/grafana-pathfinder-app.json',
      'en-US':
        'https://plugins-cdn.grafana-ops.net/grafana-pathfinder-app/1.4.0/public/plugins/grafana-pathfinder-app/locales/en-US/grafana-pathfinder-app.json',
      'es-ES':
        'https://plugins-cdn.grafana-ops.net/grafana-pathfinder-app/1.4.0/public/plugins/grafana-pathfinder-app/locales/es-ES/grafana-pathfinder-app.json',
      'fr-FR':
        'https://plugins-cdn.grafana-ops.net/grafana-pathfinder-app/1.4.0/public/plugins/grafana-pathfinder-app/locales/fr-FR/grafana-pathfinder-app.json',
      'hu-HU':
        'https://plugins-cdn.grafana-ops.net/grafana-pathfinder-app/1.4.0/public/plugins/grafana-pathfinder-app/locales/hu-HU/grafana-pathfinder-app.json',
      'id-ID':
        'https://plugins-cdn.grafana-ops.net/grafana-pathfinder-app/1.4.0/public/plugins/grafana-pathfinder-app/locales/id-ID/grafana-pathfinder-app.json',
      'it-IT':
        'https://plugins-cdn.grafana-ops.net/grafana-pathfinder-app/1.4.0/public/plugins/grafana-pathfinder-app/locales/it-IT/grafana-pathfinder-app.json',
      'ja-JP':
        'https://plugins-cdn.grafana-ops.net/grafana-pathfinder-app/1.4.0/public/plugins/grafana-pathfinder-app/locales/ja-JP/grafana-pathfinder-app.json',
      'ko-KR':
        'https://plugins-cdn.grafana-ops.net/grafana-pathfinder-app/1.4.0/public/plugins/grafana-pathfinder-app/locales/ko-KR/grafana-pathfinder-app.json',
      'nl-NL':
        'https://plugins-cdn.grafana-ops.net/grafana-pathfinder-app/1.4.0/public/plugins/grafana-pathfinder-app/locales/nl-NL/grafana-pathfinder-app.json',
      'pl-PL':
        'https://plugins-cdn.grafana-ops.net/grafana-pathfinder-app/1.4.0/public/plugins/grafana-pathfinder-app/locales/pl-PL/grafana-pathfinder-app.json',
      'pt-BR':
        'https://plugins-cdn.grafana-ops.net/grafana-pathfinder-app/1.4.0/public/plugins/grafana-pathfinder-app/locales/pt-BR/grafana-pathfinder-app.json',
      'pt-PT':
        'https://plugins-cdn.grafana-ops.net/grafana-pathfinder-app/1.4.0/public/plugins/grafana-pathfinder-app/locales/pt-PT/grafana-pathfinder-app.json',
      'ru-RU':
        'https://plugins-cdn.grafana-ops.net/grafana-pathfinder-app/1.4.0/public/plugins/grafana-pathfinder-app/locales/ru-RU/grafana-pathfinder-app.json',
      'sv-SE':
        'https://plugins-cdn.grafana-ops.net/grafana-pathfinder-app/1.4.0/public/plugins/grafana-pathfinder-app/locales/sv-SE/grafana-pathfinder-app.json',
      'tr-TR':
        'https://plugins-cdn.grafana-ops.net/grafana-pathfinder-app/1.4.0/public/plugins/grafana-pathfinder-app/locales/tr-TR/grafana-pathfinder-app.json',
      'zh-CN':
        'https://plugins-cdn.grafana-ops.net/grafana-pathfinder-app/1.4.0/public/plugins/grafana-pathfinder-app/locales/zh-CN/grafana-pathfinder-app.json',
      'zh-Hans':
        'https://plugins-cdn.grafana-ops.net/grafana-pathfinder-app/1.4.0/public/plugins/grafana-pathfinder-app/locales/zh-Hans/grafana-pathfinder-app.json',
      'zh-Hant':
        'https://plugins-cdn.grafana-ops.net/grafana-pathfinder-app/1.4.0/public/plugins/grafana-pathfinder-app/locales/zh-Hant/grafana-pathfinder-app.json',
      'zh-TW':
        'https://plugins-cdn.grafana-ops.net/grafana-pathfinder-app/1.4.0/public/plugins/grafana-pathfinder-app/locales/zh-TW/grafana-pathfinder-app.json',
    },
    buildMode: 'production',
  },
  [app.id]: app,
});

export const apps = Object.values(metas);

export const genericAppPluginConfig: Omit<AppPluginConfig, 'id'> = {
  path: '',
  version: '',
  preload: false,
  angular: {
    detected: false,
    hideDeprecation: false,
  },
  loadingStrategy: PluginLoadingStrategy.fetch,
  dependencies: {
    grafanaVersion: '8.0.0',
    plugins: [],
    extensions: {
      exposedComponents: [],
    },
  },
  extensions: {
    addedLinks: [],
    addedComponents: [],
    addedFunctions: [],
    exposedComponents: [],
    extensionPoints: [],
  },
};
