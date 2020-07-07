import { DataSourcePluginMeta, PluginType } from '@grafana/data';
import { DataSourcePluginCategory } from 'app/types';

export function buildCategories(plugins: DataSourcePluginMeta[]): DataSourcePluginCategory[] {
  const categories: DataSourcePluginCategory[] = [
    { id: 'tsdb', title: 'Time series databases', plugins: [] },
    { id: 'logging', title: 'Logging & document databases', plugins: [] },
    { id: 'tracing', title: 'Distributed tracing', plugins: [] },
    { id: 'sql', title: 'SQL', plugins: [] },
    { id: 'cloud', title: 'Cloud', plugins: [] },
    { id: 'enterprise', title: 'Enterprise plugins', plugins: [] },
    { id: 'other', title: 'Others', plugins: [] },
  ].filter(item => item);

  const categoryIndex: Record<string, DataSourcePluginCategory> = {};
  const pluginIndex: Record<string, DataSourcePluginMeta> = {};
  const enterprisePlugins = getEnterprisePhantomPlugins();

  // build indices
  for (const category of categories) {
    categoryIndex[category.id] = category;
  }

  for (const plugin of plugins) {
    // Force category for enterprise plugins
    if (enterprisePlugins.find(item => item.id === plugin.id)) {
      plugin.category = 'enterprise';
    }

    // Fix link name
    if (plugin.info.links) {
      for (const link of plugin.info.links) {
        link.name = 'Learn more';
      }
    }

    const category = categories.find(item => item.id === plugin.category) || categoryIndex['other'];
    category.plugins.push(plugin);
    // add to plugin index
    pluginIndex[plugin.id] = plugin;
  }

  for (const category of categories) {
    // add phantom plugin
    if (category.id === 'cloud') {
      category.plugins.push(getGrafanaCloudPhantomPlugin());
    }

    // add phantom plugins
    if (category.id === 'enterprise') {
      for (const plugin of enterprisePlugins) {
        if (!pluginIndex[plugin.id]) {
          category.plugins.push(plugin);
        }
      }
    }

    sortPlugins(category.plugins);
  }

  return categories;
}

function sortPlugins(plugins: DataSourcePluginMeta[]) {
  const sortingRules: { [id: string]: number } = {
    prometheus: 100,
    graphite: 95,
    loki: 90,
    mysql: 80,
    jaeger: 100,
    postgres: 79,
    gcloud: -1,
  };

  plugins.sort((a, b) => {
    const aSort = sortingRules[a.id] || 0;
    const bSort = sortingRules[b.id] || 0;
    if (aSort > bSort) {
      return -1;
    }
    if (aSort < bSort) {
      return 1;
    }

    return a.name > b.name ? -1 : 1;
  });
}

function getEnterprisePhantomPlugins(): DataSourcePluginMeta[] {
  return [
    getPhantomPlugin({
      id: 'grafana-splunk-datasource',
      name: 'Splunk',
      description: 'Visualize & explore Splunk logs',
      imgUrl: 'public/img/plugins/splunk_logo_128.png',
    }),
    getPhantomPlugin({
      id: 'grafana-oracle-datasource',
      name: 'Oracle',
      description: 'Visualize & explore Oracle SQL',
      imgUrl: 'public/img/plugins/oracle.png',
    }),
    getPhantomPlugin({
      id: 'grafana-dynatrace-datasource',
      name: 'Dynatrace',
      description: 'Visualize & explore Dynatrace data',
      imgUrl: 'public/img/plugins/dynatrace.png',
    }),
    getPhantomPlugin({
      id: 'grafana-servicenow-datasource',
      description: 'ServiceNow integration & data source',
      name: 'ServiceNow',
      imgUrl: 'public/img/plugins/servicenow.svg',
    }),
    getPhantomPlugin({
      id: 'grafana-datadog-datasource',
      description: 'DataDog integration & data source',
      name: 'DataDog',
      imgUrl: 'public/img/plugins/datadog.png',
    }),
    getPhantomPlugin({
      id: 'grafana-newrelic-datasource',
      description: 'New Relic integration & data source',
      name: 'New Relic',
      imgUrl: 'public/img/plugins/newrelic.svg',
    }),
    getPhantomPlugin({
      id: 'dlopes7-appdynamics-datasource',
      description: 'AppDynamics integration & data source',
      name: 'AppDynamics',
      imgUrl: 'public/img/plugins/appdynamics.svg',
    }),
  ];
}

function getGrafanaCloudPhantomPlugin(): DataSourcePluginMeta {
  return {
    id: 'gcloud',
    name: 'Grafana Cloud',
    type: PluginType.datasource,
    module: 'phantom',
    baseUrl: '',
    info: {
      description: 'Hosted Graphite, Prometheus and Loki',
      logos: { small: 'public/img/grafana_icon.svg', large: 'asd' },
      author: { name: 'Grafana Labs' },
      links: [
        {
          url: 'https://grafana.com/products/cloud/',
          name: 'Learn more',
        },
      ],
      screenshots: [],
      updated: '2019-05-10',
      version: '1.0.0',
    },
  };
}

interface GetPhantomPluginOptions {
  id: string;
  name: string;
  description: string;
  imgUrl: string;
}

function getPhantomPlugin(options: GetPhantomPluginOptions): DataSourcePluginMeta {
  return {
    id: options.id,
    name: options.name,
    type: PluginType.datasource,
    module: 'phantom',
    baseUrl: '',
    info: {
      description: options.description,
      logos: { small: options.imgUrl, large: options.imgUrl },
      author: { name: 'Grafana Labs' },
      links: [
        {
          url: 'https://grafana.com/grafana/plugins/' + options.id,
          name: 'Install now',
        },
      ],
      screenshots: [],
      updated: '2019-05-10',
      version: '1.0.0',
    },
  };
}
