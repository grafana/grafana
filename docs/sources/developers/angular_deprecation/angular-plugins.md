---
keywords:
  - grafana
  - plugins
  - plugin
  - angular
  - deprecation
  - migration
title: Plugins using AngularJS
---

The use of AngularJS in Grafana has been [deprecated]({{< relref "../angular_deprecation" >}}) and support for it will be removed in a future release.

This page is to help users of Grafana understand how they might be impacted by the removal of Angular support, and whether a migration option exists.

It lists the latest versions of plugins currently available in the [Plugins Catalog](https://grafana.com/plugins) which depend on Angular, and will stop working when Angular support is removed from Grafana. The list will be updated as more plugins migrate to React or offer migration advice.

{{% admonition type="note" %}}
We advise you to ensure you are running the latest version of plugins, as previous releases of plugins not listed here may still require AngularJS.
{{% /admonition %}}

We also list the year in which the plugin was last updated in the catalog and where appropriate, highlight warnings for plugins where the source repository has not been updated in a number of years and appears inactive. This may help indicate the likelihood of a migration being undertaken, but is informational rather than definitive.

{{% admonition type="note" %}}
Plugins were updated to include signatures in 2021, so whilst a plugin may show as having been updated at that point - the last update to its functionality or dependencies may have been longer ago.
{{% /admonition %}}

## What should I do with the information below?

- Consider the available migration steps.
- Check your Grafana instances for usage of these plugins - see information here on [browsing installed plugins]({{< relref "../../administration/plugin-management/#browse-plugins" >}}).
- Review the project repositories to add your support to any migration issues.

## I'm a plugin author

We are greatly appreciative of the developers who have contributed plugins to the Grafana ecosystem, your work has helped support millions of users to gain insights into their data. A plugin being listed below is no reflection on its quality, and is purely to help users understand the impact of the removal of Angular support in Grafana.

Guidance on migrating a plugin to React can be found in our [migration guide]({{< relref "../plugins/migration-guide/angular-react/" >}}). If you would like to add any specific migration guidance for your plugin here or update our assessment, please open a PR by clicking the `Suggest an edit` button at the bottom of this page.

# Current AngularJS based plugins

## Apps

### [BelugaCDN](https://grafana.com/grafana/plugins/belugacdn-app)

Latest Version: 1.2.1 | Signature: Commercial | Last Updated: 2023

> [Migration issue](https://github.com/belugacdn/grafana-belugacdn-app/issues/7) has been raised.

> **Warning:** Lack of recent activity in the [project repository](https://github.com/belugacdn/grafana-belugacdn-app) in the past 7 years suggests project _may_ not be actively maintained.

### [Bosun](https://grafana.com/grafana/plugins/bosun-app)

Latest Version: 0.0.29 | Signature: Community | Last Updated: 2023

> [Migration issue](https://github.com/bosun-monitor/bosun-grafana-app/issues/63) has been raised.

### [Cloudflare Grafana App](https://grafana.com/grafana/plugins/cloudflare-app/)

Latest Version: 0.2.4 | Signature: Commercial | Last Updated: 2022

### [GLPI](https://grafana.com/grafana/plugins/ddurieux-glpi-app)

Latest Version: 1.3.1 | Signature: Community | Last Updated: 2021

> [Migration issue](https://github.com/ddurieux/glpi_app_grafana/issues/96) has been raised.

### [DevOpsProdigy KubeGraf](https://grafana.com/grafana/plugins/devopsprodigy-kubegraf-app/)

Latest Version: 1.5.2 | Signature: Community | Last Updated: 2021

> **Warning:** [Issues](https://github.com/devopsprodigy/kubegraf/issues/71) in the project repository suggest that the project _may_ be unsupported.

> **Migration available - potential alternative:** Grafana Cloud includes a [Kubernetes integration](https://grafana.com/solutions/kubernetes/).

### [AWS IoT TwinMaker App](https://grafana.com/grafana/plugins/grafana-iot-twinmaker-app)

Latest Version: 1.6.2 | Signature: Grafana | Last Updated: 2023

> **Note:** Plugin should continue to work even if Angular is disabled, and a full removal of Angular related code is planned.

### [Kentik Connect Pro](https://grafana.com/grafana/plugins/kentik-connect-app/)

Latest Version: 1.6.2 | Signature: Commercial | Last Updated: 2023

### [Moogsoft AIOps](https://grafana.com/grafana/plugins/moogsoft-aiops-app)

Latest Version: 8.0.2 | Signature: Commercial | Last Updated: 2022

### [OpenNMS Helm](https://grafana.com/grafana/plugins/opennms-helm-app)

Latest Version: 8.0.4 | Signature: Community | Last Updated: 2023

> **Migration available - plugin superseded:** The plugin has effectively been replaced with a [new plugin](https://grafana.com/grafana/plugins/opennms-opennms-app/) based on React.

### [Percona](https://grafana.com/grafana/plugins/percona-percona-app/)

Latest Version: 1.0.1 | Signature: Community | Last Updated: 2021

> **Warning:** [Project repository](https://github.com/percona/grafana-app) was archived on June 12, 2020.

### [Stagemonitor Elasticsearch](https://grafana.com/grafana/plugins/stagemonitor-elasticsearch-app)

Latest Version: 0.83.3 | Signature: Community | Last Updated: 2021

> [Migration issue](https://github.com/stagemonitor/stagemonitor-grafana-elasticsearch/issues/1) has been raised.

> **Warning:** Lack of recent activity in the [project repository](https://github.com/stagemonitor/stagemonitor-grafana-elasticsearch) in the past 4 years suggests project _may_ not be actively maintained.

### [Voxter VoIP Platform Metrics](https://grafana.com/grafana/plugins/voxter-app)

Latest Version: 0.0.2 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/raintank/voxter-app) in the past 3 years suggests project _may_ not be actively maintained.

## Datasources

### [Druid](https://grafana.com/grafana/plugins/abhisant-druid-datasource/)

Latest Version: v0.0.6 | Signature: Community | Last Updated: 2021

> **Migration available - plugin superseded:** The original plugin only claims support for Grafana v4.x.x, it was replaced with a [new plugin](https://grafana.com/grafana/plugins/grafadruid-druid-datasource/) based on React.

### [Cognite Data Fusion](https://grafana.com/grafana/plugins/cognitedata-datasource/)

Latest Version: 3.1.0 | Signature: Commercial | Last Updated: 2023

### [Akumuli](https://grafana.com/grafana/plugins/akumuli-datasource/)

Latest Version: 1.3.12 | Signature: Community | Last Updated: 2021

> **Warning:** [Issues](https://github.com/akumuli/Akumuli/issues/379) in the project repository suggest that the project _may_ be unsupported.

> **Warning:** Lack of recent activity in the [project repository](https://github.com/akumuli/Akumuli/) in the past 3 years suggests project _may_ not be actively maintained.

### [DarkSky](https://grafana.com/grafana/plugins/andig-darksky-datasource/)

Latest Version: 1.0.2 | Signature: Community | Last Updated: 2021

> **Warning:** [Project repository](https://github.com/andig/grafana-darksky) was archived on September 27, 2022.

> **Warning:** Apple removed support for the DarkSky API on March 31, 2023 - [source](https://support.apple.com/en-us/HT213526).

### [Finance](https://grafana.com/grafana/plugins/ayoungprogrammer-finance-datasource/)

Latest Version: 1.0.1 | Signature: Community | Last Updated: 2021

> **Warning:** [Issues](https://github.com/ayoungprogrammer/grafana-finance/issues/7) in the project repository suggest that the project _may_ be unsupported.

> **Warning:** Lack of recent activity in the [project repository](https://github.com/ayoungprogrammer/grafana-finance) in the past 6 years suggests project _may_ not be actively maintained.

### [Prometheus AlertManager](https://grafana.com/grafana/plugins/camptocamp-prometheus-alertmanager-datasource/)

Latest Version: 1.2.1 | Signature: Community | Last Updated: 2022

> **Warning:** Lack of recent activity in the [project repository](https://github.com/camptocamp/grafana-prometheus-alertmanager-datasource) in the past year suggests project _may_ not be actively maintained.

> **Migration available - potential alternative:** Grafana includes an AlertManager data source as a Core plugin.

### [Chaos Mesh](https://grafana.com/grafana/plugins/chaosmeshorg-datasource/)

Latest Version: 2.2.3 | Signature: Community | Last Updated: 2022

> **Warning:** Lack of recent activity in the [project repository](https://github.com/chaos-mesh/datasource) in the past year suggests project _may_ not be actively maintained.

### [DeviceHive](https://grafana.com/grafana/plugins/devicehive-devicehive-datasource/)

Latest Version: 2.0.2 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/devicehive/devicehive-grafana-datasource) in the past 5 years suggests project _may_ not be actively maintained.

### [Google BigQuery](https://grafana.com/grafana/plugins/doitintl-bigquery-datasource/)

Latest Version: 2.0.3 | Signature: Community | Last Updated: 2022

> **Migration available - plugin superseded:** Grafana provides its own [Google BigQuery Plugin](https://grafana.com/grafana/plugins/grafana-bigquery-datasource/). The previous [Project repository](https://github.com/doitintl/bigquery-grafana) was archived on December 11, 2022 with a recommendation to migrate to the aforementioned Grafana provided plugin.

### [Open-Falcon](https://grafana.com/grafana/plugins/fastweb-openfalcon-datasource/)

Latest Version: 1.0.1 | Signature: Community | Last Updated: 2021

> **Warning:** [Project repository](https://github.com/open-falcon/grafana-openfalcon-datasource) suggests support for Grafana v4.2 - Grafana v5.4.

> **Warning:** Lack of recent activity in the [project repository](https://github.com/open-falcon/grafana-openfalcon-datasource) in the past year suggests project _may_ not be actively maintained.

### [GraphQL Data Source](https://grafana.com/grafana/plugins/fifemon-graphql-datasource/)

Latest Version: 1.3.0 | Signature: Community | Last Updated: 2021

> **Warning:** Project support is unclear after a request for new maintainers - [source](https://github.com/fifemon/graphql-datasource/issues/77).

> **Migration available - potential alternative:** The [Infinity](https://grafana.com/grafana/plugins/yesoreyeram-infinity-datasource/) data source supports GraphQL.

### [Cloudera Manager](https://grafana.com/grafana/plugins/foursquare-clouderamanager-datasource/)

Latest Version: 0.9.3 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/foursquare/datasource-plugin-clouderamanager) in the past 7 years suggests project _may_ not be actively maintained.

### [Simple Annotations](https://grafana.com/grafana/plugins/fzakaria-simple-annotations-datasource/)

Latest Version: 1.0.1 | Signature: Community | Last Updated: 2021

> **Warning:** Plugin only claims support for Grafana v4.x.x.

> **Warning:** Lack of recent activity in the [project repository](https://github.com/fzakaria/simple-annotations-plugin/) in the past 6 years suggests project _may_ not be actively maintained.

> **Warning:** Developer no longer maintains the project, but is open to contributions: https://github.com/fzakaria/simple-annotations-plugin/issues/2

### [Gnocchi](https://grafana.com/grafana/plugins/gnocchixyz-gnocchi-datasource/)

Latest Version: 1.7.1 | Signature: Community | Last Updated: 2021

> **Warning:** Plugin only claims support for Grafana v4.x.x

> **Warning:** Lack of recent activity in the [project repository](https://github.com/gnocchixyz/grafana-gnocchi-datasource) in the past 3 years suggests project _may_ not be actively maintained.

### [MetaQueries](https://grafana.com/grafana/plugins/goshposh-metaqueries-datasource/)

Latest Version: 0.0.9 | Signature: Community | Last Updated: 2022

> **Warning:** Lack of recent activity in the [project repository](https://github.com/GoshPosh/grafana-meta-queries) in the past year suggests project _may_ not be actively maintained.

### [Open Distro for Elasticsearch](https://grafana.com/grafana/plugins/grafana-es-open-distro-datasource/)

Latest Version: 1.0.6 | Signature: Grafana | Last Updated: 2021

> **Migration available - plugin superseded:** Plugin was deprecated in favour of the [OpenSearch Plugin](https://grafana.com/grafana/plugins/grafana-opensearch-datasource/).

### [KairosDB](https://grafana.com/grafana/plugins/grafana-kairosdb-datasource/)

Latest Version: 3.0.2 | Signature: Grafana | Last Updated: 2021

> **Warning:** [Project repository](https://github.com/grafana/kairosdb-datasource) was archived on August 30th, 2021 and is no longer maintained.

### [SimpleJson](https://grafana.com/grafana/plugins/grafana-simple-json-datasource/)

Latest Version: 1.4.2 | Signature: Grafana | Last Updated: 2021

> **Migration available - potential alternative:** [Project repository](https://github.com/grafana/simple-json-datasource) is no longer maintained, but a number of alternatives exist, including - [Infinity](https://grafana.com/grafana/plugins/yesoreyeram-infinity-datasource/), [JSON](https://grafana.com/grafana/plugins/simpod-json-datasource) and [JSON API](https://grafana.com/grafana/plugins/marcusolsson-json-datasource).

> **Note:** If you're looking for an example of a data source plugin to start from, refer to [grafana-starter-datasource-backend](https://github.com/grafana/grafana-starter-datasource-backend).

### [Strava](https://grafana.com/grafana/plugins/grafana-strava-datasource/)

Latest Version: 1.5.1 | Signature: Grafana | Last Updated: 2022

> **Note:** Removal of any angular dependency is on the near term roadmap.

### [openHistorian](https://grafana.com/grafana/plugins/gridprotectionalliance-openhistorian-datasource/)

Latest Version: 1.0.3 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/GridProtectionAlliance/openHistorian-grafana/) in the past 2 years suggests project _may_ not be actively maintained.

### [Hawkular](https://grafana.com/grafana/plugins/hawkular-datasource/)

Latest Version: 1.1.2 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/hawkular/hawkular-grafana-datasource) in the past 5 years suggests project _may_ not be actively maintained.

### [Humio](https://grafana.com/grafana/plugins/humio-datasource/)

Latest Version: 3.3.1 | Signature: Commercial | Last Updated: 2022

### [IBM APM](https://grafana.com/grafana/plugins/ibm-apm-datasource/)

Latest Version: 0.9.1 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/rafal-szypulka/grafana-ibm-apm) in the past 3 years suggests project _may_ not be actively maintained.

### [PRTG](https://grafana.com/grafana/plugins/jasonlashua-prtg-datasource/)

Latest Version: 4.0.4 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/neuralfraud/grafana-prtg) in the past 4 years suggests project _may_ not be actively maintained.

> **Warning:** Unmaintained since 2017 - [source](https://github.com/neuralfraud/grafana-prtg/wiki).

### [LinkSmart HDS Datasource](https://grafana.com/grafana/plugins/linksmart-hds-datasource/)

Latest Version: 1.0.2 | Signature: Community | Last Updated: 2021

> **Warning:** [Project repository](https://github.com/linksmart/grafana-hds-datasource) was archived on April 4th, 2022 and is no longer maintained.

### [LinkSmart SensorThings](https://grafana.com/grafana/plugins/linksmart-sensorthings-datasource/)

Latest Version: 1.3.1 | Signature: Community | Last Updated: 2021

> **Warning:** [Project repository](https://github.com/linksmart/grafana-sensorthings-datasource) was archived on April 4th, 2022 and is no longer maintained.

### [Monasca](https://grafana.com/grafana/plugins/monasca-datasource/)

Latest Version: 1.0.1 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/openstack/monasca-grafana-datasource) in the past 2 years suggests project _may_ not be actively maintained.

> **Warning:** Last updated to support Grafana v7.

### [Monitoring Art](https://grafana.com/grafana/plugins/monitoringartist-monitoringart-datasource/)

Latest Version: 1.0.1 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/monitoringartist/grafana-monitoring-art) in the past 6 years suggests project _may_ not be actively maintained.

### [GoogleCalendar](https://grafana.com/grafana/plugins/mtanda-google-calendar-datasource/)

Latest Version: 1.0.5 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/mtanda/grafana-google-calendar-datasource) in the past 2 years suggests project _may_ not be actively maintained.

### [USGS Water Services](https://grafana.com/grafana/plugins/natel-usgs-datasource/)

Latest Version: 0.0.3 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/NatelEnergy/natel-usgs-datasource) in the past 3 years suggests project _may_ not be actively maintained.

### [ntopng](https://grafana.com/grafana/plugins/ntop-ntopng-datasource/)

Latest Version: 1.0.1 | Signature: Community | Last Updated: 2021

> **Migration available - plugin superseded:** this plugin was [discontinued in favour of the InfluxDB data source](https://github.com/ntop/ntopng-grafana-datasource) - a Core plugin included in Grafana, additional guidance is available [here](https://www.ntop.org/guides/ntopng/basic_concepts/timeseries.html#influxdb-driver).

### [Oracle Cloud Infrastructure Logs](https://grafana.com/grafana/plugins/oci-logs-datasource/)

Latest Version: 3.0.0 | Signature: Commercial | Last Updated: 2023

### [Oracle Cloud Infrastructure Metrics](https://grafana.com/grafana/plugins/oci-metrics-datasource/)

Latest Version: 4.0.1 | Signature: Commercial | Last Updated: 2023

### [Warp 10](https://grafana.com/grafana/plugins/ovh-warp10-datasource/)

Latest Version: 2.2.1 | Signature: Community | Last Updated: 2021

{{% admonition type="warning" %}}
[Project repository](https://github.com/ovh/ovh-warp10-datasource) was archived on March 22nd, 2023 and is no longer maintained.
{{% /admonition %}}

### [KapacitorSimpleJson](https://grafana.com/grafana/plugins/paytm-kapacitor-datasource/)

Latest Version: 0.1.3 | Signature: Community | Last Updated: 2021

{{% admonition type="warning" %}}
Lack of recent activity in the [project repository](https://github.com/paytm/kapacitor-grafana-datasource-plugin) in the past 4 years suggests project _may_ not be actively maintained.
{{% /admonition %}}

### [Ambari Metrics](https://grafana.com/grafana/plugins/praj-ams-datasource/)

Latest Version: 1.2.1 | Signature: Community | Last Updated: 2021

{{% admonition type="warning" %}}
Lack of recent activity in the [project repository](https://github.com/prajwalrao/ambari-metrics-grafana) in the past 5 years suggests project _may_ not be actively maintained.
{{% /admonition %}}

### [Solr](https://grafana.com/grafana/plugins/pue-solr-datasource/)

Latest Version: 1.0.3 | Signature: Community | Last Updated: 2021

{{% admonition type="warning" %}}
Unclear progress on migration to React - [issue](https://github.com/pueteam/datasource-plugin-solr/issues/12).
{{% /admonition %}}

> **Migration available - potential alternative:** Users could configure the solr-exporter for Prometheus as described [here](https://solr.apache.org/guide/solr/latest/deployment-guide/monitoring-with-prometheus-and-grafana.html).

### [QuasarDB](https://grafana.com/grafana/plugins/quasardb-datasource/)

Latest Version: 3.8.3 | Signature: Community | Last Updated: 2021

### [Blueflood](https://grafana.com/grafana/plugins/rackerlabs-blueflood-datasource/)

Latest Version: 0.0.3 | Signature: Community | Last Updated: 2021

{{% admonition type="warning" %}}
Lack of recent activity in the [project repository](https://github.com/rax-maas/blueflood-grafana) in the past 7 years suggests project _may_ not be actively maintained.
{{% /admonition %}}

### [NetXMS](https://grafana.com/grafana/plugins/radensolutions-netxms-datasource/)

Latest Version: 1.2.3 | Signature: Community | Last Updated: 2021

{{% admonition type="warning" %}}
Lack of recent activity in the [project repository](https://github.com/netxms/grafana) in the past 2 years suggests project _may_ not be actively maintained.
{{% /admonition %}}

### [Shoreline Data Source](https://grafana.com/grafana/plugins/shorelinesoftware-shoreline-datasource/)

Latest Version: 1.1.0 | Signature: Commercial | Last Updated: 6 months ago

### [Sidewinder](https://grafana.com/grafana/plugins/sidewinder-datasource/)

Latest Version: 0.2.1 | Signature: Community | Last Updated: 2021

{{% admonition type="warning" %}}
Lack of recent activity in the [project repository](https://github.com/srotya/sidewinder-grafana) in the past 5 years suggests project _may_ not be actively maintained.
{{% /admonition %}}

### [Skydive](https://grafana.com/grafana/plugins/skydive-datasource/)

Latest Version: 1.2.1 | Signature: Community | Last Updated: 2021

{{% admonition type="warning" %}}
Lack of recent activity in the [project repository](https://github.com/skydive-project/skydive-grafana-datasource) in the past 4 years suggests project _may_ not be actively maintained.
{{% /admonition %}}

{{% admonition type="warning" %}}
Issues suggest the entire project, not just the plugin, may be abandoned - [source](https://github.com/skydive-project/skydive/issues/2417).
{{% /admonition %}}

### [Heroic](https://grafana.com/grafana/plugins/spotify-heroic-datasource/)

Latest Version: 0.0.2 | Signature: Community | Last Updated: 2021

{{% admonition type="warning" %}}
[Plugin](https://github.com/spotify/spotify-heroic-datasource) and [Heroic](https://github.com/spotify/heroic) were both archived on April 17th, 2021 and March 27th, 2021 respectively.
{{% /admonition %}}

### [Heroic](https://grafana.com/grafana/plugins/udoprog-heroic-datasource/)

Latest Version: 0.1.1 | Signature: Community | Last Updated: 2021

{{% admonition type="warning" %}}
[Plugin](https://github.com/udoprog/udoprog-heroic-datasource) and [Heroic](https://github.com/spotify/heroic) were both archived on October 16th, 2022 and March 27th, 2021 respectively.
{{% /admonition %}}

### [Altinity plugin for ClickHouse](https://grafana.com/grafana/plugins/vertamedia-clickhouse-datasource/)

Latest Version: 2.5.3 | Signature: Community | Last Updated: 2022

{{% admonition type="note" %}}
The [migration issue](https://github.com/Altinity/clickhouse-grafana/issues/475) has been assigned to a new major version milestone.
{{% /admonition %}}

### [Pagerduty](https://grafana.com/grafana/plugins/xginn8-pagerduty-datasource/)

Latest Version: 0.2.2 | Signature: Community | Last Updated: 2021

{{% admonition type="warning" %}}
Lack of recent activity in the [project repository](https://github.com/skydive-project/skydive-grafana-datasource) in the past year suggests project _may_ not be actively maintained.
{{% /admonition %}}

{{% admonition type="warning" %}}
Plugin only claims support for Grafana v5.
{{% /admonition %}}

### [Chaos Mesh](https://grafana.com/grafana/plugins/yeya24-chaosmesh-datasource/)

Latest Version: 0.2.3 | Signature: Community | Last Updated: 2022

{{% admonition type="warning" %}}
Plugin declares itself deprecated in favour of [chaosmeshorg-datasource](https://grafana.com/grafana/plugins/chaosmeshorg-datasource/) which also appears above in this list with warnings around its future.
{{% /admonition %}}

## Panels

### [FlowCharting](https://grafana.com/grafana/plugins/agenty-flowcharting-panel/)

Latest Version: 0.9.1 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/algenty/grafana-flowcharting) in the past year suggests project _may_ not be actively maintained.

### [HTML](https://grafana.com/grafana/plugins/aidanmountford-html-panel/)

Latest Version: 0.0.2 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/aidanmountford/aidanmountford-html-panel) in the past 4 years suggests project _may_ not be actively maintained.

> **Migration available - potential alternative:** The [Text]({{< relref "../../panels-visualizations/visualizations/text/#html" >}}) panel included with Grafana supports rendering HTML content.

### [Track Map](https://grafana.com/grafana/plugins/alexandra-trackmap-panel/)

Latest Version: 1.2.6 | Signature: Community | Last Updated: 2021

> **Warning:** [Issue](https://github.com/alexandrainst/alexandra-trackmap-panel/issues/72#issuecomment-1332179974) suggests problems with ongoing maintenance unless new contributors are found.

> **Warning:** [Migration issue](https://github.com/alexandrainst/alexandra-trackmap-panel/issues/105) has been marked as needing help.

### [PictureIt](https://grafana.com/grafana/plugins/bessler-pictureit-panel/)

Latest Version: 1.0.1 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/vbessler/grafana-pictureit) in the past 6 years suggests project _may_ not be actively maintained.

> **Migration available - potential alternative:** another plugin exists which provides similar capabilities - [ePict](https://grafana.com/grafana/plugins/larona-epict-panel/).

### [Singlestat Math](https://grafana.com/grafana/plugins/blackmirror1-singlestat-math-panel/)

Latest Version: 1.1.8 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/black-mirror-1/singlestat-math) in the past 5 years suggests project _may_ not be actively maintained.

### [Status By Group Panel](https://grafana.com/grafana/plugins/blackmirror1-statusbygroup-panel/)

Latest Version: 1.1.2 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/black-mirror-1/Grafana_Status_panel) in the past 5 years suggests project _may_ not be actively maintained.

### [Datatable Panel](https://grafana.com/grafana/plugins/briangann-datatable-panel/)

Latest Version: 1.0.3 | Signature: Community | Last Updated: 2021

> **Note:** Migration to react is planned - [issue](https://github.com/briangann/grafana-datatable-panel/issues/174).

### [D3 Gauge](https://grafana.com/grafana/plugins/briangann-gauge-panel/)

Latest Version: 0.0.9 | Signature: Community | Last Updated: 2021

> **Note:** Migration to react is a planned [update](https://github.com/briangann/grafana-gauge-panel/issues/740).

### [GeoLoop](https://grafana.com/grafana/plugins/citilogics-geoloop-panel/)

Latest Version: 1.1.2 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/CitiLogics/citilogics-geoloop-panel) in the past 2 years suggests project _may_ not be actively maintained.

### [Progress List](https://grafana.com/grafana/plugins/corpglory-progresslist-panel/)

Latest Version: 1.0.6 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/CorpGlory/grafana-progress-list) in the past 2 years suggests project _may_ not be actively maintained.

### [Bubble Chart](https://grafana.com/grafana/plugins/digrich-bubblechart-panel/)

Latest Version: 1.2.1 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/digrich/bubblechart-panel) in the past 3 years suggests project _may_ not be actively maintained.

### [Blendstat](https://grafana.com/grafana/plugins/farski-blendstat-panel/)

Latest Version: 1.0.3 | Signature: Community | Last Updated: 2021

> **Migration available - potential alternative:** plugin author recommends use of single stat panel and transformations functionality - [source](https://github.com/farski/blendstat-grafana/issues/11#issuecomment-1112158909).

### [WindRose](https://grafana.com/grafana/plugins/fatcloud-windrose-panel/)

Latest Version: 0.7.1 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/fatcloud/windrose-panel) in the past 4 years suggests project _may_ not be actively maintained.

### [Statusmap](https://grafana.com/grafana/plugins/flant-statusmap-panel/)

Latest Version: 0.5.1 | Signature: Community | Last Updated: 2022

> **Warning:** Unknown whether migration to react will be undertaken - [migration issue](https://github.com/flant/grafana-statusmap/issues/302).

### [Singlestat](https://grafana.com/grafana/plugins/grafana-singlestat-panel/)

Latest Version: 2.0.0 | Signature: Grafana | Last Updated: 2022

> **Migration available - plugin superseded:** Singlestat plugin was replaced by the [Stat]({{< relref "../../panels-visualizations/visualizations/stat/" >}})panel included in Grafana.

### [Worldmap Panel](https://grafana.com/grafana/plugins/grafana-worldmap-panel/)

Latest Version: 1.0.3 | Signature: Grafana | Last Updated: 2023

> **Migration available - plugin superseded:** Worldmap plugin was replaced by [Geomap]({{< relref "../../panels-visualizations/visualizations/geomap/" >}}) panel included in Grafana.

### [Topology Panel](https://grafana.com/grafana/plugins/gretamosa-topology-panel/)

Latest Version: 1.0.1 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/gretamosa/gretamosa-topology-panel) in the past 4 years suggests project _may_ not be actively maintained

### [SVG](https://grafana.com/grafana/plugins/marcuscalidus-svg-panel/)

Latest Version: 0.3.4 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/MarcusCalidus/marcuscalidus-svg-panel) in the past year suggests project _may_ not be actively maintained.

> **Migration available - potential alternative:** another plugin exists which provides similar capabilities - [aceiot-svg-panel](https://grafana.com/grafana/plugins/aceiot-svg-panel/)

### [Annunciator](https://grafana.com/grafana/plugins/michaeldmoore-annunciator-panel/)

Latest Version: 1.1.0 | Signature: Community | Last Updated: 2021

> **Warning:** Plugin developer has indicated they will retire the plugin once Angular support is discontinued - [source](https://github.com/michaeldmoore/michaeldmoore-annunciator-panel/issues/24#issuecomment-1479372673).

### [Multistat](https://grafana.com/grafana/plugins/michaeldmoore-multistat-panel/)

Latest Version: 1.7.2 | Signature: Community | Last Updated: 2021

> **Warning:** Plugin developer has indicated they will retire the plugin once Angular support is discontinued - [source](https://github.com/michaeldmoore/michaeldmoore-multistat-panel/issues/71#issuecomment-1479372977).

### [HeatmapEpoch](https://grafana.com/grafana/plugins/mtanda-heatmap-epoch-panel/)

Latest Version: 0.1.8 | Signature: Community | Last Updated: 2021

> **Warning:** Plugin advises caution as not stable; [project repository](https://github.com/mtanda/grafana-heatmap-epoch-panel) has not been updated in 7 years.

> **Migration available - potential alternative:** Other Heatmap panels exist including natively in Grafana - [learn more]({{< relref "../../panels-visualizations/visualizations/heatmap/" >}}).

### [Histogram](https://grafana.com/grafana/plugins/mtanda-histogram-panel/)

Latest Version: 0.1.7 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/mtanda/grafana-histogram-panel) in the past 7 years suggests project _may_ not be actively maintained

> **Migration available - potential alternative:** other Histogram panels exist including natively in Grafana - [learn more]({{< relref "../../panels-visualizations/visualizations/histogram/" >}}).

### [Separator](https://grafana.com/grafana/plugins/mxswat-separator-panel/)

Latest Version: 1.0.1 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/mxswat/grafana-separator-panel) in the past 5 years suggests project _may_ not be actively maintained

> **Migration available - potential alternative:** the [Text]({{< relref "../../panels-visualizations/visualizations/text/#html" >}}) panel can be used with no data to provide space within dashboards.

### [Discrete](https://grafana.com/grafana/plugins/natel-discrete-panel/)

Latest Version: 0.1.1 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/NatelEnergy/grafana-discrete-panel) in the past 3 years suggests project _may_ not be actively maintained

### [Influx Admin](https://grafana.com/grafana/plugins/natel-influx-admin-panel/)

Latest Version: 0.0.6 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/NatelEnergy/grafana-influx-admin) in the past 5 years suggests project _may_ not be actively maintained.

### [Plotly](https://grafana.com/grafana/plugins/natel-plotly-panel/)

Latest Version: 0.0.7 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/NatelEnergy/grafana-plotly-panel) in the past 2 years suggests project _may_ not be actively maintained.

> **Migration available - potential alternative:** another plugin exists which provides similar capabilities - [nline-plotlyjs-panel/](https://grafana.com/grafana/plugins/nline-plotlyjs-panel/).

### [Cal-HeatMap](https://grafana.com/grafana/plugins/neocat-cal-heatmap-panel/)

Latest Version: 0.0.4 | Signature: Community | Last Updated: 2021

> **Warning:** Plugin advises caution as not stable; [project repository](https://github.com/NeoCat/grafana-cal-heatmap-panel) has not been updated in 7 years.

> **Migration available - potential alternative:** other Heatmap panels exist including natively in Grafana - [learn more]({{< relref "../../panels-visualizations/visualizations/heatmap/" >}}).

### [Annotation Panel](https://grafana.com/grafana/plugins/novalabs-annotations-panel/)

Latest Version: 0.0.2 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/novalabs/grafana-annotations-panel) in the past 6 years suggests project _may_ not be actively maintained.

### [Carpet plot](https://grafana.com/grafana/plugins/petrslavotinek-carpetplot-panel/)

Latest Version: 0.1.2 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/petrslavotinek/grafana-carpetplot) in the past 6 years suggests project _may_ not be actively maintained.

### [TrackMap](https://grafana.com/grafana/plugins/pr0ps-trackmap-panel/)

Latest Version: 2.1.4 | Signature: Community | Last Updated: 2023

> **Warning:** Unknown whether migration to react will be undertaken - [migration issue](https://github.com/pR0Ps/grafana-trackmap-panel/issues/84).

### [AJAX](https://grafana.com/grafana/plugins/ryantxu-ajax-panel/)

Latest Version: 0.1.0 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/ryantxu/ajax-panel) in the past 2 years suggests project _may_ not be actively maintained.

### [Annotation List](https://grafana.com/grafana/plugins/ryantxu-annolist-panel/)

Latest Version: 0.0.2 | Signature: Community | Last Updated: 2021

> **Migration available - plugin superseded:** [Project repository](https://github.com/ryantxu/annotations-panel) for the plugin was archived on July 13th, 2019 in favour of native [annotations]({{< relref "../../panels-visualizations/visualizations/annotations/" >}}).

### [3D Globe Panel](https://grafana.com/grafana/plugins/satellogic-3d-globe-panel/)

Latest Version: 0.1.1 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/satellogic/grafana-3d-globe-panel) in the past 5 years suggests project _may_ not be actively maintained.

### [Heatmap](https://grafana.com/grafana/plugins/savantly-heatmap-panel/)

Latest Version: 0.2.1 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/savantly-net/grafana-heatmap) in the past 6 years suggests project _may_ not be actively maintained.

> **Migration available - potential alternative:** other Heatmap panels exist including natively in Grafana - [learn more]({{< relref "../../panels-visualizations/visualizations/heatmap/" >}}).

### [SCADAvis Synoptic Panel](https://grafana.com/grafana/plugins/scadavis-synoptic-panel/)

Latest Version: 1.0.5 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/riclolsen/scadavis-synoptic-panel) in the past 3 years suggests project _may_ not be actively maintained.

### [TrafficLight](https://grafana.com/grafana/plugins/smartmakers-trafficlight-panel/)

Latest Version: 1.0.1 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/smartmakers/grafana-trafficlight) in the past 5 years suggests project _may_ not be actively maintained.

### [Radar Graph](https://grafana.com/grafana/plugins/snuids-radar-panel/)

Latest Version: 1.5.1 | Signature: Community | Last Updated: 2022

> **Warning:** Unknown whether migration to react will be undertaken - [migration issue](https://github.com/snuids/grafana-radar-panel/issues/29).

### [Traffic Lights](https://grafana.com/grafana/plugins/snuids-trafficlights-panel/)

Latest Version: 1.6.0 | Signature: Community | Last Updated: 2023

> **Warning:** Unknown whether migration to react will be undertaken - [migration issue](https://github.com/snuids/trafficlights-panel/issues/44).

### [Status Panel](https://grafana.com/grafana/plugins/vonage-status-panel/)

Latest Version: 1.0.11 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/Vonage/Grafana_Status_panel) in the past 3 years suggests project _may_ not be actively maintained.

### [Boom Table](https://grafana.com/grafana/plugins/yesoreyeram-boomtable-panel/)

Latest Version: 1.4.1 | Signature: Community | Last Updated: 2021

> **Warning:** Lack of recent activity in the [project repository](https://github.com/yesoreyeram/yesoreyeram-boomtable-panel) in the past 3 years suggests project _may_ not be actively maintained.

### [Parity Report](https://grafana.com/grafana/plugins/zuburqan-parity-report-panel/)

Latest Version: 1.2.2 | Signature: Community | Last Updated: 2021

> **Warning:** Unknown whether migration to react will be undertaken - [migration issue](https://github.com/zuburqan/grafana-parity-report/issues/17).
