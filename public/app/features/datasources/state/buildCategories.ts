import { DataSourcePluginMeta, PluginType } from '@grafana/data';
import { featureEnabled } from '@grafana/runtime';
import { DataSourcePluginCategory } from 'app/types';
import grafanaIconSvg from 'img/grafana_icon.svg';
import adobeAnalyticsSvg from 'img/plugins/adobe-analytics.svg';
import appdynamicsSvg from 'img/plugins/appdynamics.svg';
import atlassianStatuspageSvg from 'img/plugins/atlassian-statuspage.svg';
import auroraSvg from 'img/plugins/aurora.svg';
import azureCosmosdbSvg from 'img/plugins/azure-cosmosdb.svg';
import azureDevopsPng from 'img/plugins/azure-devops.png';
import catchpointSvg from 'img/plugins/catchpoint.svg';
import cloudflareJpg from 'img/plugins/cloudflare.jpg';
import cockroachdbJpg from 'img/plugins/cockroachdb.jpg';
import datadogPng from 'img/plugins/datadog.png';
import droneSvg from 'img/plugins/drone.svg';
import dynatracePng from 'img/plugins/dynatrace.png';
import gitlabSvg from 'img/plugins/gitlab.svg';
import honeycombPng from 'img/plugins/honeycomb.png';
import jiraLogoPng from 'img/plugins/jira_logo.png';
import mongodbSvg from 'img/plugins/mongodb.svg';
import netlifySvg from 'img/plugins/netlify.svg';
import newrelicSvg from 'img/plugins/newrelic.svg';
import oraclePng from 'img/plugins/oracle.png';
import pagerdutySvg from 'img/plugins/pagerduty.svg';
import salesforceSvg from 'img/plugins/salesforce.svg';
import sapHanaPng from 'img/plugins/sap_hana.png';
import servicenowSvg from 'img/plugins/servicenow.svg';
import signalfxLogoSvg from 'img/plugins/signalfx-logo.svg';
import snowflakeSvg from 'img/plugins/snowflake.svg';
import splunkLogo128Png from 'img/plugins/splunk_logo_128.png';
import sumoSvg from 'img/plugins/sumo.svg';
import wavefrontSvg from 'img/plugins/wavefront.svg';
import zendeskSvg from 'img/plugins/zendesk.svg';

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
      imgUrl: splunkLogo128Png,
    }),
    getPhantomPlugin({
      id: 'grafana-oracle-datasource',
      name: 'Oracle',
      description: 'Visualize and explore Oracle SQL',
      imgUrl: oraclePng,
    }),
    getPhantomPlugin({
      id: 'grafana-dynatrace-datasource',
      name: 'Dynatrace',
      description: 'Visualize and explore Dynatrace data',
      imgUrl: dynatracePng,
    }),
    getPhantomPlugin({
      id: 'grafana-servicenow-datasource',
      description: 'ServiceNow integration and data source',
      name: 'ServiceNow',
      imgUrl: servicenowSvg,
    }),
    getPhantomPlugin({
      id: 'grafana-datadog-datasource',
      description: 'DataDog integration and data source',
      name: 'DataDog',
      imgUrl: datadogPng,
    }),
    getPhantomPlugin({
      id: 'grafana-newrelic-datasource',
      description: 'New Relic integration and data source',
      name: 'New Relic',
      imgUrl: newrelicSvg,
    }),
    getPhantomPlugin({
      id: 'grafana-mongodb-datasource',
      description: 'MongoDB integration and data source',
      name: 'MongoDB',
      imgUrl: mongodbSvg,
    }),
    getPhantomPlugin({
      id: 'grafana-snowflake-datasource',
      description: 'Snowflake integration and data source',
      name: 'Snowflake',
      imgUrl: snowflakeSvg,
    }),
    getPhantomPlugin({
      id: 'grafana-wavefront-datasource',
      description: 'Wavefront integration and data source',
      name: 'Wavefront',
      imgUrl: wavefrontSvg,
    }),
    getPhantomPlugin({
      id: 'dlopes7-appdynamics-datasource',
      description: 'AppDynamics integration and data source',
      name: 'AppDynamics',
      imgUrl: appdynamicsSvg,
    }),
    getPhantomPlugin({
      id: 'grafana-saphana-datasource',
      description: 'SAP HANA® integration and data source',
      name: 'SAP HANA®',
      imgUrl: sapHanaPng,
    }),
    getPhantomPlugin({
      id: 'grafana-honeycomb-datasource',
      description: 'Honeycomb integration and datasource',
      name: 'Honeycomb',
      imgUrl: honeycombPng,
    }),
    getPhantomPlugin({
      id: 'grafana-salesforce-datasource',
      description: 'Salesforce integration and datasource',
      name: 'Salesforce',
      imgUrl: salesforceSvg,
    }),
    getPhantomPlugin({
      id: 'grafana-jira-datasource',
      description: 'Jira integration and datasource',
      name: 'Jira',
      imgUrl: jiraLogoPng,
    }),
    getPhantomPlugin({
      id: 'grafana-gitlab-datasource',
      description: 'GitLab integration and datasource',
      name: 'GitLab',
      imgUrl: gitlabSvg,
    }),
    getPhantomPlugin({
      id: 'grafana-splunk-monitoring-datasource',
      description: 'SignalFx integration and datasource',
      name: 'Splunk Infrastructure Monitoring',
      imgUrl: signalfxLogoSvg,
    }),
    getPhantomPlugin({
      id: 'grafana-azuredevops-datasource',
      description: 'Azure Devops datasource',
      name: 'Azure Devops',
      imgUrl: azureDevopsPng,
    }),
    getPhantomPlugin({
      id: 'grafana-sumologic-datasource',
      description: 'SumoLogic integration and datasource',
      name: 'SumoLogic',
      imgUrl: sumoSvg,
    }),
    getPhantomPlugin({
      id: 'grafana-pagerduty-datasource',
      description: 'PagerDuty datasource',
      name: 'PagerDuty',
      imgUrl: pagerdutySvg,
    }),
    getPhantomPlugin({
      id: 'grafana-catchpoint-datasource',
      description: 'Catchpoint datasource',
      name: 'Catchpoint',
      imgUrl: catchpointSvg,
    }),
    getPhantomPlugin({
      id: 'grafana-azurecosmosdb-datasource',
      description: 'Azure CosmosDB datasource',
      name: 'Azure CosmosDB',
      imgUrl: azureCosmosdbSvg,
    }),
    getPhantomPlugin({
      id: 'grafana-adobeanalytics-datasource',
      description: 'Adobe Analytics datasource',
      name: 'Adobe Analytics',
      imgUrl: adobeAnalyticsSvg,
    }),
    getPhantomPlugin({
      id: 'grafana-cloudflare-datasource',
      description: 'Cloudflare datasource',
      name: 'Cloudflare',
      imgUrl: cloudflareJpg,
    }),
    getPhantomPlugin({
      id: 'grafana-cockroachdb-datasource',
      description: 'CockroachDB datasource',
      name: 'CockroachDB',
      imgUrl: cockroachdbJpg,
    }),
    getPhantomPlugin({
      id: 'grafana-netlify-datasource',
      description: 'Netlify datasource',
      name: 'Netlify',
      imgUrl: netlifySvg,
    }),
    getPhantomPlugin({
      id: 'grafana-drone-datasource',
      description: 'Drone datasource',
      name: 'Drone',
      imgUrl: droneSvg,
    }),
    getPhantomPlugin({
      id: 'grafana-zendesk-datasource',
      description: 'Zendesk datasource',
      name: 'Zendesk',
      imgUrl: zendeskSvg,
    }),
    getPhantomPlugin({
      id: 'grafana-atlassianstatuspage-datasource',
      description: 'Atlassian Statuspage datasource',
      name: 'Atlassian Statuspage',
      imgUrl: atlassianStatuspageSvg,
    }),
    getPhantomPlugin({
      id: 'grafana-aurora-datasource',
      description: 'Aurora data source',
      name: 'Aurora',
      imgUrl: auroraSvg,
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
      logos: { small: grafanaIconSvg, large: grafanaIconSvg },
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
          url: '/plugins/' + options.id,
          name: 'Install now',
          target: '_self',
        },
      ],
      screenshots: [],
      updated: '2019-05-10',
      version: '1.0.0',
    },
  };
}
