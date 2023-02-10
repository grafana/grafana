---
_build:
  list: false
title: Release notes for Grafana 7.3.0
---

<!-- Auto generated do not edit -->

# Release notes for Grafana 7.3.0

## 7.3.0 Stable

---

### Features and enhancements

- **AzureMonitor**: Support decimal (as float64) type in analytics/logs. [#28480](https://github.com/grafana/grafana/pull/28480), [@kylebrandt](https://github.com/kylebrandt)
- **Plugins signing**: UI information. [#28469](https://github.com/grafana/grafana/pull/28469), [@dprokop](https://github.com/dprokop)
- **Short URL**: Update last seen at when visiting a short URL. [#28565](https://github.com/grafana/grafana/pull/28565), [@marefr](https://github.com/marefr)

### Bug fixes

- **Alerting**: Log warnings for obsolete notifiers when extracting alerts and remove frequent error log messages. [#28162](https://github.com/grafana/grafana/pull/28162), [@papagian](https://github.com/papagian)
- **Auth**: Fix SigV4 request verification step for Amazon Elasticsearch Service. [#28481](https://github.com/grafana/grafana/pull/28481), [@wbrowne](https://github.com/wbrowne)
- **Auth**: Should redirect to login when anonymous enabled and URL with different org than anonymous specified. [#28158](https://github.com/grafana/grafana/pull/28158), [@marefr](https://github.com/marefr)
- **Elasticsearch**: Fix handling of errors when testing data source. [#28498](https://github.com/grafana/grafana/pull/28498), [@marefr](https://github.com/marefr)
- **Graphite**: Fix default version to be 1.1. [#28471](https://github.com/grafana/grafana/pull/28471), [@ivanahuckova](https://github.com/ivanahuckova)
- **StatPanel**: Fixes BizChart error max: yyy should not be less than min zzz. [#28587](https://github.com/grafana/grafana/pull/28587), [@hugohaggmark](https://github.com/hugohaggmark)

## 7.3.0-beta2

---

### Features and enhancements

- **Add monitoring mixing for Grafana**. [#28285](https://github.com/grafana/grafana/pull/28285), [@bergquist](https://github.com/bergquist)
- **CloudWatch**: Missing Namespace AWS/EC2CapacityReservations. [#28309](https://github.com/grafana/grafana/pull/28309), [@nonamef](https://github.com/nonamef)
- **Explore**: Support wide data frames. [#28393](https://github.com/grafana/grafana/pull/28393), [@aocenas](https://github.com/aocenas)
- **Instrumentation**: Add counters and histograms for database queries. [#28236](https://github.com/grafana/grafana/pull/28236), [@bergquist](https://github.com/bergquist)
- **Loki**: Visually distinguish error logs for LogQL2. [#28359](https://github.com/grafana/grafana/pull/28359), [@ivanahuckova](https://github.com/ivanahuckova)

### Bug fixes

- **API**: Fix short URLs. [#28300](https://github.com/grafana/grafana/pull/28300), [@aknuds1](https://github.com/aknuds1)
- **BackendSrv**: Fixes queue countdown when unsubscribe is before response. [#28323](https://github.com/grafana/grafana/pull/28323), [@hugohaggmark](https://github.com/hugohaggmark)
- **CloudWatch/Athena - valid metrics and dimensions.**. [#28436](https://github.com/grafana/grafana/pull/28436), [@kwarunek](https://github.com/kwarunek)
- **Dashboard links**: Places drop-down list so it's always visible. [#28330](https://github.com/grafana/grafana/pull/28330), [@maknik](https://github.com/maknik)
- **Graph**: Fix for graph size not taking up full height or width. [#28314](https://github.com/grafana/grafana/pull/28314), [@jackw](https://github.com/jackw)
- **Loki**: Base maxDataPoints limits on query type. [#28298](https://github.com/grafana/grafana/pull/28298), [@aocenas](https://github.com/aocenas)
- **Loki**: Run instant query only when doing metric query. [#28325](https://github.com/grafana/grafana/pull/28325), [@aocenas](https://github.com/aocenas)
- **Plugins**: Don't exit on duplicate plugin. [#28390](https://github.com/grafana/grafana/pull/28390), [@aknuds1](https://github.com/aknuds1)

## 7.3.0-beta1

---

### Breaking changes

- **CloudWatch**: The AWS CloudWatch data source's authentication scheme has changed.

### Features and enhancements

- **Alerting**: Add labels to name when converting data frame to series. [#28085](https://github.com/grafana/grafana/pull/28085), [@kylebrandt](https://github.com/kylebrandt)
- **Alerting**: Ensuring LINE Notify notifications are sent for all alert states. [#27639](https://github.com/grafana/grafana/pull/27639), [@haraldkubota](https://github.com/haraldkubota)
- **Auth**: Add SigV4 auth option to data sources. [#27552](https://github.com/grafana/grafana/pull/27552), [@wbrowne](https://github.com/wbrowne)
- **AzureMonitor**: Pass through null values instead of setting 0. [#28126](https://github.com/grafana/grafana/pull/28126), [@kylebrandt](https://github.com/kylebrandt)
- **Cloud Monitoring**: Out-of-the-box dashboards. [#27864](https://github.com/grafana/grafana/pull/27864), [@papagian](https://github.com/papagian)
- **CloudWatch**: Add support for AWS DirectConnect virtual interface metrics and add missing dimensions. [#28008](https://github.com/grafana/grafana/pull/28008), [@jgulick48](https://github.com/jgulick48)
- **CloudWatch**: Adding support for Amazon ElastiCache Redis metrics. [#28040](https://github.com/grafana/grafana/pull/28040), [@jgulick48](https://github.com/jgulick48)
- **CloudWatch**: Adding support for additional Amazon CloudFront metrics. [#28069](https://github.com/grafana/grafana/pull/28069), [@darrylsepeda](https://github.com/darrylsepeda)
- **CloudWatch**: Re-implement authentication. [#25548](https://github.com/grafana/grafana/pull/25548), [@aknuds1](https://github.com/aknuds1),[@patstrom](https://github.com/patstrom)
- **Dashboard**: Allow shortlink generation. [#27409](https://github.com/grafana/grafana/pull/27409), [@MisterSquishy](https://github.com/MisterSquishy)
- **Docker**: OpenShift compatibility. [#27813](https://github.com/grafana/grafana/pull/27813), [@xlson](https://github.com/xlson)
- **Elasticsearch**: Support multiple pipeline aggregations for a query. [#27945](https://github.com/grafana/grafana/pull/27945), [@simianhacker](https://github.com/simianhacker)
- **Explore**: Allow shortlink generation. [#28222](https://github.com/grafana/grafana/pull/28222), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore**: Remove collapsing of visualisations. [#27026](https://github.com/grafana/grafana/pull/27026), [@ivanahuckova](https://github.com/ivanahuckova)
- **FieldColor**: Adds new standard color option for color. [#28039](https://github.com/grafana/grafana/pull/28039), [@torkelo](https://github.com/torkelo)
- **Gauge**: Improve text sizing and support non threshold color modes. [#28256](https://github.com/grafana/grafana/pull/28256), [@torkelo](https://github.com/torkelo)
- **NamedColors**: Named colors refactors. [#28235](https://github.com/grafana/grafana/pull/28235), [@torkelo](https://github.com/torkelo)
- **Panel Inspect**: Allow CSV download for Excel. [#27284](https://github.com/grafana/grafana/pull/27284), [@tomdaly](https://github.com/tomdaly)
- **Prometheus**: Add time range parameters to labels API. [#27548](https://github.com/grafana/grafana/pull/27548), [@kakkoyun](https://github.com/kakkoyun)
- **Snapshots**: Store dashboard data encrypted in the database. [#28129](https://github.com/grafana/grafana/pull/28129), [@wbrowne](https://github.com/wbrowne)
- **Table**: New cell hover behavior and image cell display mode. [#27669](https://github.com/grafana/grafana/pull/27669), [@torkelo](https://github.com/torkelo)
- **Timezones**: Include IANA timezone canonical name in TimeZoneInfo. [#27591](https://github.com/grafana/grafana/pull/27591), [@dprokop](https://github.com/dprokop)
- **Tracing**: Add Tempo data source. [#28204](https://github.com/grafana/grafana/pull/28204), [@aocenas](https://github.com/aocenas)
- **Transformations**: Add Concatenate fields transformer. [#28237](https://github.com/grafana/grafana/pull/28237), [@ryantxu](https://github.com/ryantxu)
- **Transformations**: improve the reduce transformer. [#27875](https://github.com/grafana/grafana/pull/27875), [@ryantxu](https://github.com/ryantxu)
- **Users**: Expire old user invites. [#27361](https://github.com/grafana/grafana/pull/27361), [@wbrowne](https://github.com/wbrowne)
- **Variables**: Adds loading state and indicators. [#27917](https://github.com/grafana/grafana/pull/27917), [@hugohaggmark](https://github.com/hugohaggmark)
- **Variables**: Adds support for key/value mapping in Custom variable. [#27829](https://github.com/grafana/grafana/pull/27829), [@sartaj10](https://github.com/sartaj10)
- **grafana/toolkit**: expose Jest maxWorkers arg for plugin test & build tasks. [#27724](https://github.com/grafana/grafana/pull/27724), [@domasx2](https://github.com/domasx2)

### Bug fixes

- **Azure Analytics**: FormatAs Time series groups bool columns wrong. [#27713](https://github.com/grafana/grafana/issues/27713)
- **Azure**: Fixes cancellation of requests with different Azure sources. [#28180](https://github.com/grafana/grafana/pull/28180), [@hugohaggmark](https://github.com/hugohaggmark)
- **BackendSrv**: Reloads page instead of redirect on Unauthorized Error. [#28276](https://github.com/grafana/grafana/pull/28276), [@hugohaggmark](https://github.com/hugohaggmark)
- **Dashboard**: Do not allow users without edit permission to a folder to see new dashboard page. [#28249](https://github.com/grafana/grafana/pull/28249), [@torkelo](https://github.com/torkelo)
- **Dashboard**: Fixed issue accessing horizontal table scrollbar when placed at bottom of dashboard. [#28250](https://github.com/grafana/grafana/pull/28250), [@torkelo](https://github.com/torkelo)
- **DataProxy**: Add additional settings for dataproxy to help with network proxy timeouts. [#27841](https://github.com/grafana/grafana/pull/27841), [@kahinton](https://github.com/kahinton)
- **Database**: Adds new indices to alert_notification_state and alert_rule_tag tables. [#28166](https://github.com/grafana/grafana/pull/28166), [@KarineValenca](https://github.com/KarineValenca)
- **Explore**: Fix showing of Prometheus data in Query inspector. [#28128](https://github.com/grafana/grafana/pull/28128), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore**: Show results of Prometheus instant queries in formatted table. [#27767](https://github.com/grafana/grafana/pull/27767), [@ivanahuckova](https://github.com/ivanahuckova)
- **Graph**: Prevent legend from overflowing container. [#28254](https://github.com/grafana/grafana/pull/28254), [@jackw](https://github.com/jackw)
- **OAuth**: Fix token refresh failure when custom SSL settings are configured for OAuth provider. [#27523](https://github.com/grafana/grafana/pull/27523), [@billoley](https://github.com/billoley)
- **Plugins**: Let descendant plugins inherit their root's signature. [#27970](https://github.com/grafana/grafana/pull/27970), [@aknuds1](https://github.com/aknuds1)
- **Runtime**: Fix handling of short-lived background services. [#28025](https://github.com/grafana/grafana/pull/28025), [@ahlaw](https://github.com/ahlaw)
- **TemplateSrv**: Fix interpolating strings with object variables. [#28171](https://github.com/grafana/grafana/pull/28171), [@torkelo](https://github.com/torkelo)
- **Variables**: Fixes so constants set from url get completed state. [#28257](https://github.com/grafana/grafana/pull/28257), [@hugohaggmark](https://github.com/hugohaggmark)
- **Variables**: Prevent adhoc filters from crashing when they are not loaded properly. [#28226](https://github.com/grafana/grafana/pull/28226), [@mckn](https://github.com/mckn)
