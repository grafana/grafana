import { cloneDeep } from 'lodash';

import type { PluginMetasResponse } from '../types';
import type { Meta } from '../types/meta_object_gen';

export const v0alpha1Meta: Meta = cloneDeep({
  kind: 'Meta',
  apiVersion: 'plugins.grafana.app/v0alpha1',
  metadata: {
    name: 'myorg-someplugin-app',
    namespace: 'default',
  },
  spec: {
    pluginJson: {
      id: 'myorg-someplugin-app',
      type: 'app',
      name: 'Some-Plugin',
      info: {
        keywords: ['app'],
        logos: {
          small: 'public/plugins/myorg-someplugin-app/img/logo.svg',
          large: 'public/plugins/myorg-someplugin-app/img/logo.svg',
        },
        updated: '2025-12-15',
        version: '1.0.0',
        author: {
          name: 'Myorg',
        },
      },
      dependencies: {
        grafanaDependency: '>=10.4.0',
        grafanaVersion: '*',
      },
      includes: [
        {
          type: 'page',
          name: 'Page One',
          role: 'Viewer',
          action: 'plugins.app:access',
          path: '/a/myorg-someplugin-app/one',
          addToNav: true,
          defaultNav: true,
        },
        {
          type: 'page',
          name: 'Page Two',
          role: 'Viewer',
          action: 'plugins.app:access',
          path: '/a/myorg-someplugin-app/two',
          addToNav: true,
        },
        {
          type: 'page',
          name: 'Page Three',
          role: 'Viewer',
          action: 'plugins.app:access',
          path: '/a/myorg-someplugin-app/three',
          addToNav: true,
        },
        {
          type: 'page',
          name: 'Page Four',
          role: 'Viewer',
          action: 'plugins.app:access',
          path: '/a/myorg-someplugin-app/four',
          addToNav: true,
        },
        {
          type: 'page',
          name: 'Configuration',
          role: 'Admin',
          path: '/plugins/myorg-someplugin-app',
          addToNav: true,
          icon: 'cog',
        },
      ],
    },
    class: 'external',
    module: {
      path: 'public/plugins/myorg-someplugin-app/module.js',
      loadingStrategy: 'script',
    },
    baseURL: 'public/plugins/myorg-someplugin-app',
    signature: {
      status: 'unsigned',
    },
    angular: {
      detected: false,
    },
  },
  status: {},
});

export const v0alpha1Response: PluginMetasResponse = cloneDeep({
  items: [
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'alertlist',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'alertlist',
          type: 'panel',
          name: 'Alert list',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/alertlist/img/icn-singlestat-panel.svg',
              large: 'public/plugins/alertlist/img/icn-singlestat-panel.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Shows list of alerts and their current status',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/alert-list/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
          skipDataQuery: true,
        },
        class: 'core',
        module: {
          path: 'core:plugin/alertlist',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/alertlist',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'alertmanager',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'alertmanager',
          type: 'datasource',
          name: 'Alertmanager',
          info: {
            keywords: ['alerts', 'alerting', 'prometheus', 'alertmanager', 'mimir', 'cortex'],
            logos: {
              small: 'public/plugins/alertmanager/img/logo.svg',
              large: 'public/plugins/alertmanager/img/logo.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Prometheus alertmanager',
              url: 'https://grafana.com',
            },
            description:
              'Add external Alertmanagers (supports Prometheus and Mimir implementations) so you can use the Grafana Alerting UI to manage silences, contact points, and notification policies.',
            links: [
              {
                name: 'Learn more',
                url: 'https://prometheus.io/docs/alerting/latest/alertmanager/',
              },
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/datasources/alertmanager/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
          routes: [
            {
              path: 'alertmanager/api/v2/silences',
              method: 'GET',
              reqRole: 'Viewer',
              reqAction: 'alert.instances.external:read',
            },
            {
              path: 'api/v2/silences',
              method: 'GET',
              reqRole: 'Viewer',
              reqAction: 'alert.instances.external:read',
            },
            {
              path: 'alertmanager/api/v2/silences',
              method: 'POST',
              reqRole: 'Editor',
              reqAction: 'alert.instances.external:write',
            },
            {
              path: 'api/v2/silences',
              method: 'POST',
              reqRole: 'Editor',
              reqAction: 'alert.instances.external:write',
            },
            {
              path: 'alertmanager/api/v2/silence/',
              method: 'GET',
              reqRole: 'Viewer',
              reqAction: 'alert.instances.external:read',
            },
            {
              path: 'api/v2/silence/',
              method: 'GET',
              reqRole: 'Viewer',
              reqAction: 'alert.instances.external:read',
            },
            {
              path: 'alertmanager/api/v2/silence/',
              method: 'DELETE',
              reqRole: 'Editor',
              reqAction: 'alert.instances.external:write',
            },
            {
              path: 'api/v2/silence/',
              method: 'DELETE',
              reqRole: 'Editor',
              reqAction: 'alert.instances.external:write',
            },
            {
              path: 'alertmanager/api/v2/alerts/groups',
              method: 'GET',
              reqRole: 'Viewer',
              reqAction: 'alert.instances.external:read',
            },
            {
              path: 'api/v2/alerts/groups',
              method: 'GET',
              reqRole: 'Viewer',
              reqAction: 'alert.instances.external:read',
            },
            {
              path: 'alertmanager/api/v2/alerts',
              method: 'GET',
              reqRole: 'Viewer',
              reqAction: 'alert.instances.external:read',
            },
            {
              path: 'api/v2/alerts',
              method: 'GET',
              reqRole: 'Viewer',
              reqAction: 'alert.instances.external:read',
            },
            {
              path: 'alertmanager/api/v2/alerts',
              method: 'POST',
              reqRole: 'Editor',
              reqAction: 'alert.instances.external:write',
            },
            {
              path: 'api/v2/alerts',
              method: 'POST',
              reqRole: 'Editor',
              reqAction: 'alert.instances.external:write',
            },
            {
              path: 'alertmanager/api/v2/status',
              method: 'GET',
              reqRole: 'Viewer',
              reqAction: 'alert.notifications.external:read',
            },
            {
              path: 'api/v2/status',
              method: 'GET',
              reqRole: 'Viewer',
              reqAction: 'alert.notifications.external:read',
            },
            {
              path: 'alertmanager/api/v2/receivers',
              method: 'GET',
              reqRole: 'Viewer',
              reqAction: 'alert.instances.external:read',
            },
            {
              path: 'api/v2/receivers',
              method: 'GET',
              reqRole: 'Viewer',
              reqAction: 'alert.instances.external:read',
            },
            {
              path: 'api/v1/alerts',
              method: 'GET',
              reqRole: 'Viewer',
              reqAction: 'alert.notifications.external:read',
            },
            {
              path: 'api/v1/alerts',
              method: 'POST',
              reqRole: 'Editor',
              reqAction: 'alert.notifications.external:write',
            },
            {
              path: 'api/v1/alerts',
              method: 'DELETE',
              reqRole: 'Editor',
              reqAction: 'alert.notifications.external:write',
            },
            {
              method: 'POST',
              reqRole: 'Admin',
            },
            {
              method: 'PUT',
              reqRole: 'Admin',
            },
            {
              method: 'DELETE',
              reqRole: 'Admin',
            },
            {
              method: 'GET',
              reqRole: 'Admin',
            },
          ],
        },
        class: 'core',
        module: {
          path: 'core:plugin/alertmanager',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/alertmanager',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'annolist',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'annolist',
          type: 'panel',
          name: 'Annotations list',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/annolist/img/icn-annolist-panel.svg',
              large: 'public/plugins/annolist/img/icn-annolist-panel.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'List annotations',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/annotations/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
          skipDataQuery: true,
        },
        class: 'core',
        module: {
          path: 'core:plugin/annolist',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/annolist',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'barchart',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'barchart',
          type: 'panel',
          name: 'Bar chart',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/barchart/img/barchart.svg',
              large: 'public/plugins/barchart/img/barchart.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Categorical charts with group support',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/bar-chart/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
        },
        class: 'core',
        module: {
          path: 'core:plugin/barchart',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/barchart',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'bargauge',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'bargauge',
          type: 'panel',
          name: 'Bar gauge',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/bargauge/img/icon_bar_gauge.svg',
              large: 'public/plugins/bargauge/img/icon_bar_gauge.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Horizontal and vertical gauges',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/bar-gauge/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
        },
        class: 'core',
        module: {
          path: 'core:plugin/bargauge',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/bargauge',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'candlestick',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'candlestick',
          type: 'panel',
          name: 'Candlestick',
          info: {
            keywords: ['financial', 'price', 'currency', 'k-line'],
            logos: {
              small: 'public/plugins/candlestick/img/candlestick.svg',
              large: 'public/plugins/candlestick/img/candlestick.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Graphical representation of price movements of a security, derivative, or currency.',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/candlestick/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
        },
        class: 'core',
        module: {
          path: 'core:plugin/candlestick',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/candlestick',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'canvas',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'canvas',
          type: 'panel',
          name: 'Canvas',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/canvas/img/icn-canvas.svg',
              large: 'public/plugins/canvas/img/icn-canvas.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Explicit element placement',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/canvas/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
        },
        class: 'core',
        module: {
          path: 'core:plugin/canvas',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/canvas',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'cloudwatch',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'cloudwatch',
          type: 'datasource',
          name: 'CloudWatch',
          info: {
            keywords: ['aws', 'amazon'],
            logos: {
              small: 'public/plugins/cloudwatch/img/amazon-web-services.png',
              large: 'public/plugins/cloudwatch/img/amazon-web-services.png',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Data source for Amazon AWS monitoring service',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/datasources/aws-cloudwatch/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
          alerting: true,
          annotations: true,
          backend: true,
          category: 'cloud',
          includes: [
            {
              type: 'dashboard',
              name: 'EC2',
              role: 'Viewer',
              path: 'dashboards/ec2.json',
            },
            {
              type: 'dashboard',
              name: 'EBS',
              role: 'Viewer',
              path: 'dashboards/EBS.json',
            },
            {
              type: 'dashboard',
              name: 'Lambda',
              role: 'Viewer',
              path: 'dashboards/Lambda.json',
            },
            {
              type: 'dashboard',
              name: 'Logs',
              role: 'Viewer',
              path: 'dashboards/Logs.json',
            },
            {
              type: 'dashboard',
              name: 'RDS',
              role: 'Viewer',
              path: 'dashboards/RDS.json',
            },
          ],
          logs: true,
          metrics: true,
          queryOptions: {
            minInterval: true,
          },
        },
        class: 'core',
        module: {
          path: 'core:plugin/cloudwatch',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/cloudwatch',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'dashboard',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'dashboard',
          type: 'datasource',
          name: '-- Dashboard --',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/dashboard/img/icn-reusequeries.svg',
              large: 'public/plugins/dashboard/img/icn-reusequeries.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Uses the result set from another panel in the same dashboard',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
          builtIn: true,
          metrics: true,
        },
        class: 'core',
        module: {
          path: 'core:plugin/dashboard',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/dashboard',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'dashlist',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'dashlist',
          type: 'panel',
          name: 'Dashboard list',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/dashlist/img/icn-dashlist-panel.svg',
              large: 'public/plugins/dashlist/img/icn-dashlist-panel.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'List of dynamic links to other dashboards',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/dashboard-list/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
          skipDataQuery: true,
        },
        class: 'core',
        module: {
          path: 'core:plugin/dashlist',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/dashlist',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'datagrid',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'datagrid',
          type: 'panel',
          name: 'Datagrid',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/datagrid/img/icn-table-panel.svg',
              large: 'public/plugins/datagrid/img/icn-table-panel.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/datagrid/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
          state: 'beta',
        },
        class: 'core',
        module: {
          path: 'core:plugin/datagrid',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/datagrid',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'debug',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'debug',
          type: 'panel',
          name: 'Debug',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/debug/img/icn-debug.svg',
              large: 'public/plugins/debug/img/icn-debug.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Debug Panel for Grafana',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
          state: 'alpha',
        },
        class: 'core',
        module: {
          path: 'core:plugin/debug',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/debug',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'elasticsearch',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'elasticsearch',
          type: 'datasource',
          name: 'Elasticsearch',
          info: {
            keywords: ['elasticsearch', 'datasource', 'database', 'logs', 'nosql', 'traces'],
            logos: {
              small: 'public/plugins/elasticsearch/img/elasticsearch.svg',
              large: 'public/plugins/elasticsearch/img/elasticsearch.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Open source logging & analytics database',
            links: [
              {
                name: 'Learn more',
                url: 'https://grafana.com/docs/features/datasources/elasticsearch/',
              },
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/datasources/elasticsearch/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
          alerting: true,
          annotations: true,
          backend: true,
          category: 'logging',
          logs: true,
          metrics: true,
          queryOptions: {
            minInterval: true,
          },
        },
        class: 'core',
        module: {
          path: 'core:plugin/elasticsearch',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/elasticsearch',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'flamegraph',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'flamegraph',
          type: 'panel',
          name: 'Flame Graph',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/flamegraph/img/icn-flamegraph.svg',
              large: 'public/plugins/flamegraph/img/icn-flamegraph.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/flame-graph/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
        },
        class: 'core',
        module: {
          path: 'core:plugin/flamegraph',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/flamegraph',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'gauge',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'gauge',
          type: 'panel',
          name: 'Gauge',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/gauge/img/icon_gauge.svg',
              large: 'public/plugins/gauge/img/icon_gauge.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Standard gauge visualization',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/gauge/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
        },
        class: 'core',
        module: {
          path: 'core:plugin/gauge',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/gauge',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'geomap',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'geomap',
          type: 'panel',
          name: 'Geomap',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/geomap/img/icn-geomap.svg',
              large: 'public/plugins/geomap/img/icn-geomap.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Geomap panel',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/geomap/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
        },
        class: 'core',
        module: {
          path: 'core:plugin/geomap',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/geomap',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'gettingstarted',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'gettingstarted',
          type: 'panel',
          name: 'Getting Started',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/gettingstarted/img/icn-dashlist-panel.svg',
              large: 'public/plugins/gettingstarted/img/icn-dashlist-panel.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
          hideFromList: true,
          skipDataQuery: true,
        },
        class: 'core',
        module: {
          path: 'core:plugin/gettingstarted',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/gettingstarted',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'grafana',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'grafana',
          type: 'datasource',
          name: '-- Grafana --',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/grafana/img/icn-grafanadb.svg',
              large: 'public/plugins/grafana/img/icn-grafanadb.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description:
              'A built-in data source that generates random walk data and can poll the Testdata data source. This helps you test visualizations and run experiments.',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
          annotations: true,
          backend: true,
          builtIn: true,
          metrics: true,
        },
        class: 'core',
        module: {
          path: 'core:plugin/grafana',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/grafana',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'grafana-azure-monitor-datasource',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'grafana-azure-monitor-datasource',
          type: 'datasource',
          name: 'Azure Monitor',
          info: {
            keywords: ['azure', 'monitor', 'Application Insights', 'Log Analytics', 'App Insights'],
            logos: {
              small: 'public/plugins/grafana-azure-monitor-datasource/img/logo.jpg',
              large: 'public/plugins/grafana-azure-monitor-datasource/img/logo.jpg',
            },
            updated: '',
            version: '12.4.0-pre',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Data source for Microsoft Azure Monitor & Application Insights',
            links: [
              {
                name: 'Learn more',
                url: 'https://grafana.com/docs/grafana/latest/datasources/azuremonitor/',
              },
              {
                name: 'License',
                url: 'https://github.com/grafana/grafana/blob/HEAD/LICENSE',
              },
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/datasources/azure-monitor/',
              },
            ],
            screenshots: [
              {
                name: 'Azure Contoso Loans',
                path: 'public/plugins/grafana-azure-monitor-datasource/img/contoso_loans_grafana_dashboard.png',
              },
              {
                name: 'Azure Monitor Network',
                path: 'public/plugins/grafana-azure-monitor-datasource/img/azure_monitor_network.png',
              },
              {
                name: 'Azure Monitor CPU',
                path: 'public/plugins/grafana-azure-monitor-datasource/img/azure_monitor_cpu.png',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '>=10.3.0',
            grafanaVersion: '*',
          },
          alerting: true,
          annotations: true,
          backend: true,
          category: 'cloud',
          executable: 'gpx_azuremonitor',
          includes: [
            {
              type: 'dashboard',
              name: 'Azure / Alert Consumption',
              role: 'Viewer',
              path: 'dashboards/v1Alerts.json',
            },
            {
              type: 'dashboard',
              name: 'Azure / Infrastructure / Apps Monitoring',
              role: 'Viewer',
              path: 'dashboards/azureInfraApps.json',
            },
            {
              type: 'dashboard',
              name: 'Azure / Infrastructure / Compute Monitoring',
              role: 'Viewer',
              path: 'dashboards/azureInfraCompute.json',
            },
            {
              type: 'dashboard',
              name: 'Azure / Infrastructure / Data Monitoring',
              role: 'Viewer',
              path: 'dashboards/azureInfraData.json',
            },
            {
              type: 'dashboard',
              name: 'Azure / Infrastructure / Network Monitoring',
              role: 'Viewer',
              path: 'dashboards/azureInfraNetwork.json',
            },
            {
              type: 'dashboard',
              name: 'Azure / Infrastructure / Storage and Key Vaults Monitoring',
              role: 'Viewer',
              path: 'dashboards/azureInfraStorageVaults.json',
            },
            {
              type: 'dashboard',
              name: 'Azure / Azure PostgreSQL / Flexible Server Monitoring',
              role: 'Viewer',
              path: 'dashboards/postgresFlexibleServer.json',
            },
            {
              type: 'dashboard',
              name: 'Azure Monitor / Container Insights / Syslog',
              role: 'Viewer',
              path: 'dashboards/containerInsightsSyslog.json',
            },
            {
              type: 'dashboard',
              name: 'Azure / Insights / Applications',
              role: 'Viewer',
              path: 'dashboards/appInsights.json',
            },
            {
              type: 'dashboard',
              name: 'Azure / Insights / Applications / Performance / Operations',
              role: 'Viewer',
              path: 'dashboards/appInsightsPerfOperations.json',
            },
            {
              type: 'dashboard',
              name: 'Azure / Insights / Applications / Performance / Dependencies',
              role: 'Viewer',
              path: 'dashboards/appInsightsPerfDependencies.json',
            },
            {
              type: 'dashboard',
              name: 'Azure / Insights / Applications / Failures / Operations',
              role: 'Viewer',
              path: 'dashboards/appInsightsFailureOperations.json',
            },
            {
              type: 'dashboard',
              name: 'Azure / Insights / Applications / Failures / Dependencies',
              role: 'Viewer',
              path: 'dashboards/appInsightsFailureDependencies.json',
            },
            {
              type: 'dashboard',
              name: 'Azure / Insights / Applications / Failures / Exceptions',
              role: 'Viewer',
              path: 'dashboards/appInsightsFailureExceptions.json',
            },
            {
              type: 'dashboard',
              name: 'Azure / Insights / Applications Test Availability Geo Map',
              role: 'Viewer',
              path: 'dashboards/appInsightsGeoMap.json',
            },
            {
              type: 'dashboard',
              name: 'Azure / Insights / CosmosDB',
              role: 'Viewer',
              path: 'dashboards/cosmosdb.json',
            },
            {
              type: 'dashboard',
              name: 'Azure / Insights / Data Explorer Clusters',
              role: 'Viewer',
              path: 'dashboards/adx.json',
            },
            {
              type: 'dashboard',
              name: 'Azure / Insights / Key Vaults',
              role: 'Viewer',
              path: 'dashboards/keyvault.json',
            },
            {
              type: 'dashboard',
              name: 'Azure / Insights / Networks',
              role: 'Viewer',
              path: 'dashboards/networkInsightsDashboard.json',
            },
            {
              type: 'dashboard',
              name: 'Azure / Insights / SQL Database',
              role: 'Viewer',
              path: 'dashboards/sqldb.json',
            },
            {
              type: 'dashboard',
              name: 'Azure / Insights / Storage Accounts',
              role: 'Viewer',
              path: 'dashboards/storage.json',
            },
            {
              type: 'dashboard',
              name: 'Azure / Insights / Virtual Machines by Resource Group',
              role: 'Viewer',
              path: 'dashboards/vMInsightsRG.json',
            },
            {
              type: 'dashboard',
              name: 'Azure / Insights / Virtual Machines by Workspace',
              role: 'Viewer',
              path: 'dashboards/vMInsightsWorkspace.json',
            },
            {
              type: 'dashboard',
              name: 'Azure / Resources Overview',
              role: 'Viewer',
              path: 'dashboards/arg.json',
            },
          ],
          logs: true,
          metrics: true,
          tracing: true,
        },
        class: 'core',
        module: {
          path: 'public/plugins/grafana-azure-monitor-datasource/module.js',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/grafana-azure-monitor-datasource',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
        translations: {
          'cs-CZ':
            'public/plugins/grafana-azure-monitor-datasource/locales/cs-CZ/grafana-azure-monitor-datasource.json',
          'de-DE':
            'public/plugins/grafana-azure-monitor-datasource/locales/de-DE/grafana-azure-monitor-datasource.json',
          'en-US':
            'public/plugins/grafana-azure-monitor-datasource/locales/en-US/grafana-azure-monitor-datasource.json',
          'es-ES':
            'public/plugins/grafana-azure-monitor-datasource/locales/es-ES/grafana-azure-monitor-datasource.json',
          'fr-FR':
            'public/plugins/grafana-azure-monitor-datasource/locales/fr-FR/grafana-azure-monitor-datasource.json',
          'hu-HU':
            'public/plugins/grafana-azure-monitor-datasource/locales/hu-HU/grafana-azure-monitor-datasource.json',
          'id-ID':
            'public/plugins/grafana-azure-monitor-datasource/locales/id-ID/grafana-azure-monitor-datasource.json',
          'it-IT':
            'public/plugins/grafana-azure-monitor-datasource/locales/it-IT/grafana-azure-monitor-datasource.json',
          'ja-JP':
            'public/plugins/grafana-azure-monitor-datasource/locales/ja-JP/grafana-azure-monitor-datasource.json',
          'ko-KR':
            'public/plugins/grafana-azure-monitor-datasource/locales/ko-KR/grafana-azure-monitor-datasource.json',
          'nl-NL':
            'public/plugins/grafana-azure-monitor-datasource/locales/nl-NL/grafana-azure-monitor-datasource.json',
          'pl-PL':
            'public/plugins/grafana-azure-monitor-datasource/locales/pl-PL/grafana-azure-monitor-datasource.json',
          'pt-BR':
            'public/plugins/grafana-azure-monitor-datasource/locales/pt-BR/grafana-azure-monitor-datasource.json',
          'pt-PT':
            'public/plugins/grafana-azure-monitor-datasource/locales/pt-PT/grafana-azure-monitor-datasource.json',
          'ru-RU':
            'public/plugins/grafana-azure-monitor-datasource/locales/ru-RU/grafana-azure-monitor-datasource.json',
          'sv-SE':
            'public/plugins/grafana-azure-monitor-datasource/locales/sv-SE/grafana-azure-monitor-datasource.json',
          'tr-TR':
            'public/plugins/grafana-azure-monitor-datasource/locales/tr-TR/grafana-azure-monitor-datasource.json',
          'zh-Hans':
            'public/plugins/grafana-azure-monitor-datasource/locales/zh-Hans/grafana-azure-monitor-datasource.json',
          'zh-Hant':
            'public/plugins/grafana-azure-monitor-datasource/locales/zh-Hant/grafana-azure-monitor-datasource.json',
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'grafana-exploretraces-app',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'grafana-exploretraces-app',
          type: 'app',
          name: 'Grafana Traces Drilldown',
          info: {
            keywords: ['app', 'tempo', 'traces', 'explore'],
            logos: {
              small: 'public/plugins/grafana-exploretraces-app/img/logo.svg',
              large: 'public/plugins/grafana-exploretraces-app/img/logo.svg',
            },
            updated: '2025-12-04',
            version: '1.2.2',
            author: {
              name: 'Grafana',
            },
            description:
              'Use Rate, Errors, and Duration (RED) metrics derived from traces to investigate errors within complex distributed systems.',
            links: [
              {
                name: 'Github',
                url: 'https://github.com/grafana/explore-traces',
              },
              {
                name: 'Report bug',
                url: 'https://github.com/grafana/explore-traces/issues/new',
              },
            ],
            screenshots: [
              {
                name: 'histogram-breakdown',
                path: 'public/plugins/grafana-exploretraces-app/img/histogram-breakdown.png',
              },
              {
                name: 'errors-metric-flow',
                path: 'public/plugins/grafana-exploretraces-app/img/errors-metric-flow.png',
              },
              {
                name: 'errors-root-cause',
                path: 'public/plugins/grafana-exploretraces-app/img/errors-root-cause.png',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '>=11.5.0',
            grafanaVersion: '*',
            extensions: {
              exposedComponents: [
                'grafana-asserts-app/entity-assertions-widget/v1',
                'grafana-asserts-app/insights-timeline-widget/v1',
              ],
            },
          },
          autoEnabled: true,
          includes: [
            {
              type: 'page',
              name: 'Explore',
              role: 'Viewer',
              action: 'datasources:explore',
              path: '/a/grafana-exploretraces-app/',
              addToNav: true,
              defaultNav: true,
            },
          ],
          preload: true,
          extensions: {
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
              },
              {
                id: 'grafana-exploretraces-app/get-logs-drilldown-link/v1',
              },
            ],
          },
        },
        class: 'external',
        module: {
          path: 'public/plugins/grafana-exploretraces-app/module.js',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/grafana-exploretraces-app',
        signature: {
          status: 'valid',
          type: 'grafana',
          org: 'Grafana Labs',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'grafana-lokiexplore-app',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'grafana-lokiexplore-app',
          type: 'app',
          name: 'Grafana Logs Drilldown',
          info: {
            keywords: ['app', 'loki', 'explore', 'logs', 'drilldown', 'drill', 'down', 'drill-down'],
            logos: {
              small: 'public/plugins/grafana-lokiexplore-app/img/logo.svg',
              large: 'public/plugins/grafana-lokiexplore-app/img/logo.svg',
            },
            updated: '2025-12-09',
            version: '1.0.32',
            author: {
              name: 'Grafana',
            },
            description:
              'Visualize log volumes to easily detect anomalies or significant changes over time, without needing to compose LogQL queries.',
            links: [
              {
                name: 'Github',
                url: 'https://github.com/grafana/explore-logs',
              },
              {
                name: 'Report bug',
                url: 'https://github.com/grafana/explore-logs/issues/new',
              },
            ],
            screenshots: [
              {
                name: 'patterns',
                path: 'public/plugins/grafana-lokiexplore-app/img/patterns.png',
              },
              {
                name: 'fields',
                path: 'public/plugins/grafana-lokiexplore-app/img/fields.png',
              },
              {
                name: 'table',
                path: 'public/plugins/grafana-lokiexplore-app/img/table.png',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '>=11.6.0',
            grafanaVersion: '*',
            extensions: {
              exposedComponents: [
                'grafana-adaptivelogs-app/temporary-exemptions/v1',
                'grafana-lokiexplore-app/embedded-logs-exploration/v1',
                'grafana-asserts-app/insights-timeline-widget/v1',
                'grafana/add-to-dashboard-form/v1',
              ],
            },
          },
          autoEnabled: true,
          includes: [
            {
              type: 'page',
              name: 'Grafana Logs Drilldown',
              role: 'Viewer',
              action: 'datasources:explore',
              path: '/a/grafana-lokiexplore-app/explore',
              addToNav: true,
              defaultNav: true,
            },
          ],
          preload: true,
          extensions: {
            addedComponents: [
              {
                targets: ['grafana-asserts-app/insights-timeline-widget/v1'],
                title: 'Insights Timeline Widget',
                description: 'Widget for displaying insights timeline in other apps',
              },
            ],
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
            addedFunctions: [
              {
                targets: ['grafana-exploretraces-app/get-logs-drilldown-link/v1'],
                title: 'Open Logs Drilldown',
                description: 'Returns url to logs drilldown app',
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
              },
            ],
          },
        },
        class: 'external',
        module: {
          path: 'public/plugins/grafana-lokiexplore-app/module.js',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/grafana-lokiexplore-app',
        signature: {
          status: 'valid',
          type: 'grafana',
          org: 'Grafana Labs',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'grafana-metricsdrilldown-app',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'grafana-metricsdrilldown-app',
          type: 'app',
          name: 'Grafana Metrics Drilldown',
          info: {
            keywords: ['drilldown', 'metrics', 'app', 'prometheus', 'mimir'],
            logos: {
              small: 'public/plugins/grafana-metricsdrilldown-app/img/logo.svg',
              large: 'public/plugins/grafana-metricsdrilldown-app/img/logo.svg',
            },
            updated: '2025-12-17',
            version: '1.0.26',
            author: {
              name: 'Grafana',
            },
            description:
              'Quickly find related metrics with a few clicks, without needing to write PromQL queries to retrieve metrics.',
            links: [
              {
                name: 'GitHub',
                url: 'https://github.com/grafana/metrics-drilldown',
              },
              {
                name: 'Report a bug',
                url: 'https://github.com/grafana/metrics-drilldown/issues/new',
              },
            ],
            screenshots: [
              {
                name: 'metricselect',
                path: 'public/plugins/grafana-metricsdrilldown-app/img/metrics-drilldown.png',
              },
              {
                name: 'breakdown',
                path: 'public/plugins/grafana-metricsdrilldown-app/img/breakdown.png',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '>=11.6.0',
            grafanaVersion: '*',
            extensions: {
              exposedComponents: ['grafana/add-to-dashboard-form/v1'],
            },
          },
          autoEnabled: true,
          includes: [
            {
              type: 'page',
              name: 'Grafana Metrics Drilldown',
              role: 'Viewer',
              action: 'datasources:explore',
              path: '/a/grafana-metricsdrilldown-app/drilldown',
              addToNav: true,
              defaultNav: true,
            },
          ],
          preload: true,
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
              },
              {
                id: 'grafana-metricsdrilldown-app/open-in-logs-drilldown/v1',
              },
            ],
          },
        },
        class: 'external',
        module: {
          path: 'public/plugins/grafana-metricsdrilldown-app/module.js',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/grafana-metricsdrilldown-app',
        signature: {
          status: 'valid',
          type: 'grafana',
          org: 'Grafana Labs',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'grafana-postgresql-datasource',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'grafana-postgresql-datasource',
          type: 'datasource',
          name: 'PostgreSQL',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/grafana-postgresql-datasource/img/postgresql_logo.svg',
              large: 'public/plugins/grafana-postgresql-datasource/img/postgresql_logo.svg',
            },
            updated: '',
            version: '12.4.0-pre',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Data source for PostgreSQL and compatible databases',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/datasources/postgres/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '>=11.6.0',
            grafanaVersion: '*',
          },
          alerting: true,
          annotations: true,
          backend: true,
          category: 'sql',
          executable: 'gpx_grafana-postgresql-datasource',
          logs: true,
          metrics: true,
          queryOptions: {
            minInterval: true,
          },
        },
        class: 'core',
        module: {
          path: 'public/plugins/grafana-postgresql-datasource/module.js',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/grafana-postgresql-datasource',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'grafana-pyroscope-app',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'grafana-pyroscope-app',
          type: 'app',
          name: 'Grafana Profiles Drilldown',
          info: {
            keywords: ['app', 'pyroscope', 'profiling', 'explore', 'profiles', 'performance', 'drilldown'],
            logos: {
              small: 'public/plugins/grafana-pyroscope-app/img/logo.svg',
              large: 'public/plugins/grafana-pyroscope-app/img/logo.svg',
            },
            updated: '2025-12-18',
            version: '1.14.2',
            author: {
              name: 'Grafana',
            },
            description:
              'View and analyze high-level service performance, identify problem processes for optimization, and diagnose issues to determine root causes.',
            links: [
              {
                name: 'GitHub',
                url: 'https://github.com/grafana/profiles-drilldown',
              },
              {
                name: 'Report bug',
                url: 'https://github.com/grafana/profiles-drilldown/issues/new',
              },
            ],
            screenshots: [
              {
                name: 'Hero Image',
                path: 'public/plugins/grafana-pyroscope-app/img/hero-image.png',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '>=11.5.0',
            grafanaVersion: '*',
            extensions: {
              exposedComponents: [
                'grafana-o11yinsights-app/insights-launcher/v1',
                'grafana-adaptiveprofiles-app/resolution-boost/v1',
              ],
            },
          },
          autoEnabled: true,
          includes: [
            {
              type: 'page',
              name: 'Profiles',
              role: 'Viewer',
              action: 'datasources:explore',
              path: '/a/grafana-pyroscope-app/explore',
              addToNav: true,
              defaultNav: true,
            },
          ],
          preload: true,
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
              },
              {
                id: 'grafana-pyroscope-app/settings/v1',
              },
            ],
          },
        },
        class: 'external',
        module: {
          path: 'public/plugins/grafana-pyroscope-app/module.js',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/grafana-pyroscope-app',
        signature: {
          status: 'valid',
          type: 'grafana',
          org: 'Grafana Labs',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'grafana-pyroscope-datasource',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'grafana-pyroscope-datasource',
          type: 'datasource',
          name: 'Grafana Pyroscope',
          info: {
            keywords: [
              'grafana',
              'datasource',
              'phlare',
              'flamegraph',
              'profiling',
              'continuous profiling',
              'pyroscope',
            ],
            logos: {
              small: 'public/plugins/grafana-pyroscope-datasource/img/grafana_pyroscope_icon.svg',
              large: 'public/plugins/grafana-pyroscope-datasource/img/grafana_pyroscope_icon.svg',
            },
            updated: '',
            version: '12.4.0-pre',
            author: {
              name: 'Grafana Labs',
              url: 'https://www.grafana.com',
            },
            description:
              'Data source for Grafana Pyroscope, horizontally-scalable, highly-available, multi-tenant continuous profiling aggregation system.',
            links: [
              {
                name: 'GitHub Project',
                url: 'https://github.com/grafana/pyroscope',
              },
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/pyroscope/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/datasources/pyroscope/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '>=10.3.0-0',
            grafanaVersion: '*',
          },
          backend: true,
          category: 'profiling',
          executable: 'gpx_grafana-pyroscope-datasource',
          metrics: true,
        },
        class: 'core',
        module: {
          path: 'public/plugins/grafana-pyroscope-datasource/module.js',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/grafana-pyroscope-datasource',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'grafana-testdata-datasource',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'grafana-testdata-datasource',
          type: 'datasource',
          name: 'TestData',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/grafana-testdata-datasource/img/testdata.svg',
              large: 'public/plugins/grafana-testdata-datasource/img/testdata.svg',
            },
            updated: '',
            version: '12.4.0-pre',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Generates test data in different forms',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/datasources/testdata/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '>=10.3.0-0',
            grafanaVersion: '*',
          },
          alerting: true,
          annotations: true,
          backend: true,
          executable: 'gpx_testdata',
          includes: [
            {
              type: 'dashboard',
              name: 'Streaming Example',
              role: 'Viewer',
              path: 'dashboards/streaming.json',
            },
          ],
          logs: true,
          metrics: true,
          queryOptions: {
            maxDataPoints: true,
            minInterval: true,
          },
        },
        class: 'core',
        module: {
          path: 'public/plugins/grafana-testdata-datasource/module.js',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/grafana-testdata-datasource',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'graphite',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'graphite',
          type: 'datasource',
          name: 'Graphite',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/graphite/img/graphite_logo.png',
              large: 'public/plugins/graphite/img/graphite_logo.png',
            },
            updated: '',
            version: '12.4.0-pre',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Open source time series database',
            links: [
              {
                name: 'Learn more',
                url: 'https://graphiteapp.org/',
              },
              {
                name: 'Graphite 1.1 Release',
                url: 'https://grafana.com/blog/2018/01/11/graphite-1.1-teaching-an-old-dog-new-tricks/',
              },
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/datasources/graphite/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '>=10.3.0',
            grafanaVersion: '*',
          },
          alerting: true,
          annotations: true,
          backend: true,
          category: 'tsdb',
          executable: 'gpx_graphite',
          includes: [
            {
              type: 'dashboard',
              name: 'Graphite Carbon Metrics',
              role: 'Viewer',
              path: 'dashboards/carbon_metrics.json',
            },
            {
              type: 'dashboard',
              name: 'Metrictank (Graphite alternative)',
              role: 'Viewer',
              path: 'dashboards/metrictank.json',
            },
          ],
          metrics: true,
          queryOptions: {
            maxDataPoints: true,
            cacheTimeout: true,
          },
        },
        class: 'core',
        module: {
          path: 'public/plugins/graphite/module.js',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/graphite',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'heatmap',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'heatmap',
          type: 'panel',
          name: 'Heatmap',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/heatmap/img/icn-heatmap-panel.svg',
              large: 'public/plugins/heatmap/img/icn-heatmap-panel.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Like a histogram over time',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/heatmap/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
        },
        class: 'core',
        module: {
          path: 'core:plugin/heatmap',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/heatmap',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'histogram',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'histogram',
          type: 'panel',
          name: 'Histogram',
          info: {
            keywords: ['distribution', 'bar chart', 'frequency', 'proportional'],
            logos: {
              small: 'public/plugins/histogram/img/histogram.svg',
              large: 'public/plugins/histogram/img/histogram.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Distribution of values presented as a bar chart.',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/histogram/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
        },
        class: 'core',
        module: {
          path: 'core:plugin/histogram',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/histogram',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'influxdb',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'influxdb',
          type: 'datasource',
          name: 'InfluxDB',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/influxdb/img/influxdb_logo.svg',
              large: 'public/plugins/influxdb/img/influxdb_logo.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Open source time series database',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/datasources/influxdb/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
          alerting: true,
          annotations: true,
          backend: true,
          category: 'tsdb',
          logs: true,
          metrics: true,
          queryOptions: {
            minInterval: true,
          },
        },
        class: 'core',
        module: {
          path: 'core:plugin/influxdb',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/influxdb',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'jaeger',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'jaeger',
          type: 'datasource',
          name: 'Jaeger',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/jaeger/img/jaeger_logo.svg',
              large: 'public/plugins/jaeger/img/jaeger_logo.svg',
            },
            updated: '',
            version: '12.4.0-pre',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Open source, end-to-end distributed tracing',
            links: [
              {
                name: 'Learn more',
                url: 'https://www.jaegertracing.io',
              },
              {
                name: 'Jaeger GitHub Project',
                url: 'https://github.com/jaegertracing/jaeger',
              },
              {
                name: 'Repository',
                url: 'https://github.com/grafana/grafana',
              },
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/datasources/jaeger/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '>=10.3.0-0',
            grafanaVersion: '*',
          },
          backend: true,
          category: 'tracing',
          executable: 'gpx_jaeger',
          metrics: true,
          tracing: true,
        },
        class: 'core',
        module: {
          path: 'public/plugins/jaeger/module.js',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/jaeger',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'live',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'live',
          type: 'panel',
          name: 'Live',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/live/img/live.svg',
              large: 'public/plugins/live/img/live.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
          skipDataQuery: true,
          state: 'alpha',
        },
        class: 'core',
        module: {
          path: 'core:plugin/live',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/live',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'logs',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'logs',
          type: 'panel',
          name: 'Logs',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/logs/img/icn-logs-panel.svg',
              large: 'public/plugins/logs/img/icn-logs-panel.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/logs/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
        },
        class: 'core',
        module: {
          path: 'core:plugin/logs',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/logs',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'loki',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'loki',
          type: 'datasource',
          name: 'Loki',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/loki/img/loki_icon.svg',
              large: 'public/plugins/loki/img/loki_icon.svg',
            },
            updated: '',
            version: '12.4.0-pre',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Like Prometheus but for logs. OSS logging solution from Grafana Labs',
            links: [
              {
                name: 'Learn more',
                url: 'https://grafana.com/loki',
              },
              {
                name: 'GitHub Project',
                url: 'https://github.com/grafana/loki',
              },
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/datasources/loki/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '>=10.4.0',
            grafanaVersion: '*',
          },
          alerting: true,
          annotations: true,
          backend: true,
          category: 'logging',
          executable: 'gpx_loki',
          logs: true,
          metrics: true,
          queryOptions: {
            maxDataPoints: true,
          },
          streaming: true,
        },
        class: 'core',
        module: {
          path: 'public/plugins/loki/module.js',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/loki',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'mixed',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'mixed',
          type: 'datasource',
          name: '-- Mixed --',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/mixed/img/icn-mixeddatasources.svg',
              large: 'public/plugins/mixed/img/icn-mixeddatasources.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Lets you query multiple data sources in the same panel.',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/datasources/#special-data-sources',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
          builtIn: true,
          metrics: true,
          queryOptions: {
            minInterval: true,
          },
        },
        class: 'core',
        module: {
          path: 'core:plugin/mixed',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/mixed',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'mssql',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'mssql',
          type: 'datasource',
          name: 'Microsoft SQL Server',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/mssql/img/sql_server_logo.svg',
              large: 'public/plugins/mssql/img/sql_server_logo.svg',
            },
            updated: '',
            version: '12.4.0-pre',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Data source for Microsoft SQL Server compatible databases',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/datasources/mssql/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '>=10.4.0',
            grafanaVersion: '*',
          },
          alerting: true,
          annotations: true,
          backend: true,
          category: 'sql',
          executable: 'gpx_mssql',
          metrics: true,
          queryOptions: {
            minInterval: true,
          },
        },
        class: 'core',
        module: {
          path: 'public/plugins/mssql/module.js',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/mssql',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
        translations: {
          'cs-CZ': 'public/plugins/mssql/locales/cs-CZ/mssql.json',
          'de-DE': 'public/plugins/mssql/locales/de-DE/mssql.json',
          'en-US': 'public/plugins/mssql/locales/en-US/mssql.json',
          'es-ES': 'public/plugins/mssql/locales/es-ES/mssql.json',
          'fr-FR': 'public/plugins/mssql/locales/fr-FR/mssql.json',
          'hu-HU': 'public/plugins/mssql/locales/hu-HU/mssql.json',
          'id-ID': 'public/plugins/mssql/locales/id-ID/mssql.json',
          'it-IT': 'public/plugins/mssql/locales/it-IT/mssql.json',
          'ja-JP': 'public/plugins/mssql/locales/ja-JP/mssql.json',
          'ko-KR': 'public/plugins/mssql/locales/ko-KR/mssql.json',
          'nl-NL': 'public/plugins/mssql/locales/nl-NL/mssql.json',
          'pl-PL': 'public/plugins/mssql/locales/pl-PL/mssql.json',
          'pt-BR': 'public/plugins/mssql/locales/pt-BR/mssql.json',
          'pt-PT': 'public/plugins/mssql/locales/pt-PT/mssql.json',
          'ru-RU': 'public/plugins/mssql/locales/ru-RU/mssql.json',
          'sv-SE': 'public/plugins/mssql/locales/sv-SE/mssql.json',
          'tr-TR': 'public/plugins/mssql/locales/tr-TR/mssql.json',
          'zh-Hans': 'public/plugins/mssql/locales/zh-Hans/mssql.json',
          'zh-Hant': 'public/plugins/mssql/locales/zh-Hant/mssql.json',
        },
      },
      status: {},
    },
    v0alpha1Meta,
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'mysql',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'mysql',
          type: 'datasource',
          name: 'MySQL',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/mysql/img/mysql_logo.svg',
              large: 'public/plugins/mysql/img/mysql_logo.svg',
            },
            updated: '',
            version: '12.4.0-pre',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Data source for MySQL databases',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/datasources/mysql/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '>=10.4.0',
            grafanaVersion: '*',
          },
          alerting: true,
          annotations: true,
          backend: true,
          category: 'sql',
          executable: 'gpx_mysql',
          metrics: true,
          queryOptions: {
            minInterval: true,
          },
        },
        class: 'core',
        module: {
          path: 'public/plugins/mysql/module.js',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/mysql',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'news',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'news',
          type: 'panel',
          name: 'News',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/news/img/news.svg',
              large: 'public/plugins/news/img/news.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'RSS feed reader',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/news/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
          skipDataQuery: true,
          state: 'beta',
        },
        class: 'core',
        module: {
          path: 'core:plugin/news',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/news',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'nodeGraph',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'nodeGraph',
          type: 'panel',
          name: 'Node Graph',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/nodeGraph/img/icn-node-graph.svg',
              large: 'public/plugins/nodeGraph/img/icn-node-graph.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/node-graph/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
        },
        class: 'core',
        module: {
          path: 'core:plugin/nodeGraph',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/nodeGraph',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'opentsdb',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'opentsdb',
          type: 'datasource',
          name: 'OpenTSDB',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/opentsdb/img/opentsdb_logo.png',
              large: 'public/plugins/opentsdb/img/opentsdb_logo.png',
            },
            updated: '',
            version: '12.4.0-pre',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Open source time series database',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/datasources/opentsdb/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '>=10.3.0-0',
            grafanaVersion: '*',
          },
          alerting: true,
          annotations: true,
          backend: true,
          category: 'tsdb',
          executable: 'gpx_opentsdb',
          metrics: true,
        },
        class: 'core',
        module: {
          path: 'public/plugins/opentsdb/module.js',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/opentsdb',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'parca',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'parca',
          type: 'datasource',
          name: 'Parca',
          info: {
            keywords: ['grafana', 'datasource', 'parca', 'profiling'],
            logos: {
              small: 'public/plugins/parca/img/logo-small.svg',
              large: 'public/plugins/parca/img/logo-small.svg',
            },
            updated: '',
            version: '12.4.0-pre',
            author: {
              name: 'Grafana Labs',
              url: 'https://www.grafana.com',
            },
            description:
              'Continuous profiling for analysis of CPU and memory usage, down to the line number and throughout time. Saving infrastructure cost, improving performance, and increasing reliability.',
            links: [
              {
                name: 'GitHub Project',
                url: 'https://github.com/parca-dev/parca',
              },
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/datasources/parca/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '>=10.3.0-0',
            grafanaVersion: '*',
          },
          backend: true,
          category: 'profiling',
          executable: 'gpx_parca',
          metrics: true,
        },
        class: 'core',
        module: {
          path: 'public/plugins/parca/module.js',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/parca',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'piechart',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'piechart',
          type: 'panel',
          name: 'Pie chart',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/piechart/img/icon_piechart.svg',
              large: 'public/plugins/piechart/img/icon_piechart.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'The new core pie chart visualization',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/pie-chart/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
        },
        class: 'core',
        module: {
          path: 'core:plugin/piechart',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/piechart',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'prometheus',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'prometheus',
          type: 'datasource',
          name: 'Prometheus',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/prometheus/img/prometheus_logo.svg',
              large: 'public/plugins/prometheus/img/prometheus_logo.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Open source time series database & alerting',
            links: [
              {
                name: 'Learn more',
                url: 'https://prometheus.io/',
              },
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/datasources/prometheus/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
          alerting: true,
          annotations: true,
          backend: true,
          category: 'tsdb',
          includes: [
            {
              type: 'dashboard',
              name: 'Prometheus Stats',
              role: 'Viewer',
              path: 'dashboards/prometheus_stats.json',
            },
            {
              type: 'dashboard',
              name: 'Prometheus 2.0 Stats',
              role: 'Viewer',
              path: 'dashboards/prometheus_2_stats.json',
            },
            {
              type: 'dashboard',
              name: 'Grafana Stats',
              role: 'Viewer',
              path: 'dashboards/grafana_stats.json',
            },
          ],
          metrics: true,
          multiValueFilterOperators: true,
          queryOptions: {
            minInterval: true,
          },
          routes: [
            {
              path: 'api/v1/query',
              method: 'POST',
              reqRole: 'Viewer',
              reqAction: 'datasources:query',
            },
            {
              path: 'api/v1/query_range',
              method: 'POST',
              reqRole: 'Viewer',
              reqAction: 'datasources:query',
            },
            {
              path: 'api/v1/series',
              method: 'POST',
              reqRole: 'Viewer',
              reqAction: 'datasources:query',
            },
            {
              path: 'api/v1/labels',
              method: 'POST',
              reqRole: 'Viewer',
              reqAction: 'datasources:query',
            },
            {
              path: 'api/v1/query_exemplars',
              method: 'POST',
              reqRole: 'Viewer',
              reqAction: 'datasources:query',
            },
            {
              path: '/rules',
              method: 'GET',
              reqRole: 'Viewer',
              reqAction: 'alert.rules.external:read',
            },
            {
              path: '/rules',
              method: 'POST',
              reqRole: 'Editor',
              reqAction: 'alert.rules.external:write',
            },
            {
              path: '/rules',
              method: 'DELETE',
              reqRole: 'Editor',
              reqAction: 'alert.rules.external:write',
            },
            {
              path: '/config/v1/rules',
              method: 'DELETE',
              reqRole: 'Editor',
              reqAction: 'alert.rules.external:write',
            },
            {
              path: '/config/v1/rules',
              method: 'POST',
              reqRole: 'Editor',
              reqAction: 'alert.rules.external:write',
            },
          ],
        },
        class: 'core',
        module: {
          path: 'core:plugin/prometheus',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/prometheus',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'stackdriver',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'stackdriver',
          type: 'datasource',
          name: 'Google Cloud Monitoring',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/stackdriver/img/cloud_monitoring_logo.svg',
              large: 'public/plugins/stackdriver/img/cloud_monitoring_logo.svg',
            },
            updated: '',
            version: '12.4.0-pre',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: "Data source for Google's monitoring service (formerly named Stackdriver)",
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/datasources/google-cloud-monitoring/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
          alerting: true,
          annotations: true,
          backend: true,
          category: 'cloud',
          executable: 'gpx_cloudmonitoring',
          includes: [
            {
              type: 'dashboard',
              name: 'Data Processing Monitoring',
              role: 'Viewer',
              path: 'dashboards/dataprocessing-monitoring.json',
            },
            {
              type: 'dashboard',
              name: 'Cloud Functions Monitoring',
              role: 'Viewer',
              path: 'dashboards/cloudfunctions-monitoring.json',
            },
            {
              type: 'dashboard',
              name: 'GCE VM Instance Monitoring',
              role: 'Viewer',
              path: 'dashboards/gce-vm-instance-monitoring.json',
            },
            {
              type: 'dashboard',
              name: 'GKE Prometheus Pod/Node Monitoring',
              role: 'Viewer',
              path: 'dashboards/gke-prometheus-pod-node-monitoring.json',
            },
            {
              type: 'dashboard',
              name: 'Firewall Insights Monitoring',
              role: 'Viewer',
              path: 'dashboards/firewall-insight-monitoring.json',
            },
            {
              type: 'dashboard',
              name: 'GCE Network Monitoring',
              role: 'Viewer',
              path: 'dashboards/gce-network-monitoring.json',
            },
            {
              type: 'dashboard',
              name: 'HTTP/S LB Backend Services',
              role: 'Viewer',
              path: 'dashboards/https-lb-backend-services-monitoring.json',
            },
            {
              type: 'dashboard',
              name: 'HTTP/S Load Balancer Monitoring',
              role: 'Viewer',
              path: 'dashboards/https-loadbalancer-monitoring.json',
            },
            {
              type: 'dashboard',
              name: 'Network TCP Load Balancer Monitoring',
              role: 'Viewer',
              path: 'dashboards/network-tcp-loadbalancer-monitoring.json',
            },
            {
              type: 'dashboard',
              name: 'MicroService Monitoring',
              role: 'Viewer',
              path: 'dashboards/micro-service-monitoring.json',
            },
            {
              type: 'dashboard',
              name: 'Cloud Storage Monitoring',
              role: 'Viewer',
              path: 'dashboards/cloud-storage-monitoring.json',
            },
            {
              type: 'dashboard',
              name: 'Cloud SQL Monitoring',
              role: 'Viewer',
              path: 'dashboards/cloudsql-monitoring.json',
            },
            {
              type: 'dashboard',
              name: 'Cloud SQL(MySQL) Monitoring',
              role: 'Viewer',
              path: 'dashboards/cloudsql-mysql-monitoring.json',
            },
          ],
          logs: true,
          metrics: true,
          queryOptions: {
            maxDataPoints: true,
            cacheTimeout: true,
          },
        },
        class: 'core',
        module: {
          path: 'public/plugins/stackdriver/module.js',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/stackdriver',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'stat',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'stat',
          type: 'panel',
          name: 'Stat',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/stat/img/icn-singlestat-panel.svg',
              large: 'public/plugins/stat/img/icn-singlestat-panel.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Big stat values & sparklines',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/stat/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
        },
        class: 'core',
        module: {
          path: 'core:plugin/stat',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/stat',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'state-timeline',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'state-timeline',
          type: 'panel',
          name: 'State timeline',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/state-timeline/img/timeline.svg',
              large: 'public/plugins/state-timeline/img/timeline.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'State changes and durations',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/state-timeline/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
        },
        class: 'core',
        module: {
          path: 'core:plugin/state-timeline',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/state-timeline',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'status-history',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'status-history',
          type: 'panel',
          name: 'Status history',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/status-history/img/status.svg',
              large: 'public/plugins/status-history/img/status.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Periodic status history',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/status-history/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
        },
        class: 'core',
        module: {
          path: 'core:plugin/status-history',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/status-history',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'table',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'table',
          type: 'panel',
          name: 'Table',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/table/img/icn-table-panel.svg',
              large: 'public/plugins/table/img/icn-table-panel.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Supports many column styles',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/table/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
        },
        class: 'core',
        module: {
          path: 'core:plugin/table',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/table',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'tempo',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'tempo',
          type: 'datasource',
          name: 'Tempo',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/tempo/img/tempo_logo.svg',
              large: 'public/plugins/tempo/img/tempo_logo.svg',
            },
            updated: '',
            version: '12.4.0-pre',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'High volume, minimal dependency trace storage.  OSS tracing solution from Grafana Labs.',
            links: [
              {
                name: 'GitHub Project',
                url: 'https://github.com/grafana/tempo',
              },
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/datasources/tempo/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '>=10.3.0-0',
            grafanaVersion: '*',
          },
          backend: true,
          category: 'tracing',
          executable: 'gpx_tempo',
          metrics: true,
          tracing: true,
        },
        class: 'core',
        module: {
          path: 'public/plugins/tempo/module.js',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/tempo',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'text',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'text',
          type: 'panel',
          name: 'Text',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/text/img/icn-text-panel.svg',
              large: 'public/plugins/text/img/icn-text-panel.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Supports markdown and html content',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/text/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
          skipDataQuery: true,
        },
        class: 'core',
        module: {
          path: 'core:plugin/text',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/text',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'timeseries',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'timeseries',
          type: 'panel',
          name: 'Time series',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/timeseries/img/icn-timeseries-panel.svg',
              large: 'public/plugins/timeseries/img/icn-timeseries-panel.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Time based line, area and bar charts',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/time-series/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
        },
        class: 'core',
        module: {
          path: 'core:plugin/timeseries',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/timeseries',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'traces',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'traces',
          type: 'panel',
          name: 'Traces',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/traces/img/traces-panel.svg',
              large: 'public/plugins/traces/img/traces-panel.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/traces/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
        },
        class: 'core',
        module: {
          path: 'core:plugin/traces',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/traces',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'trend',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'trend',
          type: 'panel',
          name: 'Trend',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/trend/img/trend.svg',
              large: 'public/plugins/trend/img/trend.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Like timeseries, but when x != time',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/trend/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
          state: 'beta',
        },
        class: 'core',
        module: {
          path: 'core:plugin/trend',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/trend',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'welcome',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'welcome',
          type: 'panel',
          name: 'Welcome',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/welcome/img/icn-dashlist-panel.svg',
              large: 'public/plugins/welcome/img/icn-dashlist-panel.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
          hideFromList: true,
          skipDataQuery: true,
        },
        class: 'core',
        module: {
          path: 'core:plugin/welcome',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/welcome',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'xychart',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'xychart',
          type: 'panel',
          name: 'XY Chart',
          info: {
            keywords: ['scatter', 'plot'],
            logos: {
              small: 'public/plugins/xychart/img/icn-xychart.svg',
              large: 'public/plugins/xychart/img/icn-xychart.svg',
            },
            updated: '',
            version: '',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Supports arbitrary X vs Y in a graph to visualize the relationship between two variables.',
            links: [
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/xy-chart/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '',
            grafanaVersion: '*',
          },
        },
        class: 'core',
        module: {
          path: 'core:plugin/xychart',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/xychart',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
    {
      kind: 'Meta',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {
        name: 'zipkin',
        namespace: 'default',
      },
      spec: {
        pluginJson: {
          id: 'zipkin',
          type: 'datasource',
          name: 'Zipkin',
          info: {
            keywords: [],
            logos: {
              small: 'public/plugins/zipkin/img/zipkin-logo.svg',
              large: 'public/plugins/zipkin/img/zipkin-logo.svg',
            },
            updated: '',
            version: '12.4.0-pre',
            author: {
              name: 'Grafana Labs',
              url: 'https://grafana.com',
            },
            description: 'Placeholder for the distributed tracing system.',
            links: [
              {
                name: 'Learn more',
                url: 'https://zipkin.io',
              },
              {
                name: 'Raise issue',
                url: 'https://github.com/grafana/grafana/issues/new',
              },
              {
                name: 'Documentation',
                url: 'https://grafana.com/docs/grafana/latest/datasources/zipkin/',
              },
            ],
          },
          dependencies: {
            grafanaDependency: '>=10.3.0-0',
            grafanaVersion: '*',
          },
          backend: true,
          category: 'tracing',
          executable: 'gpx_zipkin',
          metrics: true,
          tracing: true,
        },
        class: 'core',
        module: {
          path: 'public/plugins/zipkin/module.js',
          loadingStrategy: 'script',
        },
        baseURL: 'public/plugins/zipkin',
        signature: {
          status: 'internal',
        },
        angular: {
          detected: false,
        },
      },
      status: {},
    },
  ],
});
