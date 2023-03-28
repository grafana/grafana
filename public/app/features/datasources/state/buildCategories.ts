import { DataSourcePluginMeta, PluginType } from '@grafana/data';
import { config, featureEnabled } from '@grafana/runtime';
import { DataSourcePluginCategory } from 'app/types';

export function buildCategories(plugins: DataSourcePluginMeta[]): DataSourcePluginCategory[] {
  const categories: DataSourcePluginCategory[] = [
    { id: 'tsdb', title: 'Time series databases', plugins: [] },
    { id: 'logging', title: 'Logging & document databases', plugins: [] },
    { id: 'tracing', title: 'Distributed tracing', plugins: [] },
    { id: 'profiling', title: 'Profiling', plugins: [] },
    { id: 'sql', title: 'SQL', plugins: [] },
    { id: 'cloud', title: 'Cloud', plugins: [] },
    { id: 'enterprise', title: 'Enterprise plugins', plugins: [] },
    { id: 'iot', title: 'Industrial & IoT', plugins: [] },
    { id: 'other', title: 'Others', plugins: [] },
  ].filter((item) => item);

  const categoryIndex: Record<string, DataSourcePluginCategory> = {};
  const pluginIndex: Record<string, DataSourcePluginMeta> = {};
  const enterprisePlugins = getEnterprisePhantomPlugins();

  // build indices
  for (const category of categories) {
    categoryIndex[category.id] = category;
  }

  for (const plugin of plugins) {
    const enterprisePlugin = enterprisePlugins.find((item) => item.id === plugin.id);
    // Force category for enterprise plugins
    if (plugin.enterprise || enterprisePlugin) {
      plugin.category = 'enterprise';
      plugin.unlicensed = !featureEnabled('enterprise.plugins');
      plugin.info.links = enterprisePlugin?.info?.links || plugin.info.links;
    }

    // Fix link name
    if (plugin.info.links) {
      for (const link of plugin.info.links) {
        link.name = 'Learn more';
      }
    }

    const category = categories.find((item) => item.id === plugin.category) || categoryIndex['other'];
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

  // Only show categories with plugins
  return categories.filter((c) => c.plugins.length > 0);
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

    return a.name > b.name ? 1 : -1;
  });
}

function getEnterprisePhantomPlugins(): DataSourcePluginMeta[] {
  return [
    getPhantomPlugin({
      id: 'grafana-splunk-datasource',
      name: 'Splunk',
      description: 'Visualize and explore Splunk logs',
      imgUrl: 'public/img/plugins/splunk_logo_128.png',
    }),
    getPhantomPlugin({
      id: 'grafana-oracle-datasource',
      name: 'Oracle',
      description: 'Visualize and explore Oracle SQL',
      imgUrl: 'public/img/plugins/oracle.png',
    }),
    getPhantomPlugin({
      id: 'grafana-dynatrace-datasource',
      name: 'Dynatrace',
      description: 'Visualize and explore Dynatrace data',
      imgUrl: 'public/img/plugins/dynatrace.png',
    }),
    getPhantomPlugin({
      id: 'grafana-servicenow-datasource',
      description: 'ServiceNow integration and data source',
      name: 'ServiceNow',
      imgUrl: 'public/img/plugins/servicenow.svg',
    }),
    getPhantomPlugin({
      id: 'grafana-datadog-datasource',
      description: 'DataDog integration and data source',
      name: 'DataDog',
      imgUrl: 'public/img/plugins/datadog.png',
    }),
    getPhantomPlugin({
      id: 'grafana-newrelic-datasource',
      description: 'New Relic integration and data source',
      name: 'New Relic',
      imgUrl: 'public/img/plugins/newrelic.svg',
    }),
    getPhantomPlugin({
      id: 'grafana-mongodb-datasource',
      description: 'MongoDB integration and data source',
      name: 'MongoDB',
      imgUrl: 'public/img/plugins/mongodb.svg',
    }),
    getPhantomPlugin({
      id: 'grafana-snowflake-datasource',
      description: 'Snowflake integration and data source',
      name: 'Snowflake',
      imgUrl: 'public/img/plugins/snowflake.svg',
    }),
    getPhantomPlugin({
      id: 'grafana-wavefront-datasource',
      description: 'Wavefront integration and data source',
      name: 'Wavefront',
      imgUrl: 'public/img/plugins/wavefront.svg',
    }),
    getPhantomPlugin({
      id: 'dlopes7-appdynamics-datasource',
      description: 'AppDynamics integration and data source',
      name: 'AppDynamics',
      imgUrl: 'public/img/plugins/appdynamics.svg',
    }),
    getPhantomPlugin({
      id: 'grafana-saphana-datasource',
      description: 'SAP HANA® integration and data source',
      name: 'SAP HANA®',
      imgUrl: 'public/img/plugins/sap_hana.png',
    }),
    getPhantomPlugin({
      id: 'grafana-honeycomb-datasource',
      description: 'Honeycomb integration and datasource',
      name: 'Honeycomb',
      imgUrl: 'public/img/plugins/honeycomb.png',
    }),
    getPhantomPlugin({
      id: 'grafana-salesforce-datasource',
      description: 'Salesforce integration and datasource',
      name: 'Salesforce',
      imgUrl: 'public/img/plugins/salesforce.svg',
    }),
    getPhantomPlugin({
      id: 'grafana-jira-datasource',
      description: 'Jira integration and datasource',
      name: 'Jira',
      imgUrl: 'public/img/plugins/jira_logo.png',
    }),
    getPhantomPlugin({
      id: 'grafana-gitlab-datasource',
      description: 'GitLab integration and datasource',
      name: 'GitLab',
      imgUrl: 'public/img/plugins/gitlab.svg',
    }),
    getPhantomPlugin({
      id: 'grafana-splunk-monitoring-datasource',
      description: 'SignalFx integration and datasource',
      name: 'Splunk Infrastructure Monitoring',
      imgUrl: 'public/img/plugins/signalfx-logo.svg',
    }),
    getPhantomPlugin({
      id: 'grafana-azuredevops-datasource',
      description: 'Azure Devops datasource',
      name: 'Azure Devops',
      imgUrl: 'public/img/plugins/azure-devops.png',
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
      description: 'Hosted Graphite, Prometheus, and Loki',
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
          url: config.pluginCatalogURL + options.id,
          name: 'Install now',
        },
      ],
      screenshots: [],
      updated: '2019-05-10',
      version: '1.0.0',
    },
  };
}
