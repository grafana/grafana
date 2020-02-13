# 6.7.0 (unreleased)

## Breaking changes
* **Slack**: Removed _Mention_ setting and instead introduce _Mention Users_, _Mention Groups_, and _Mention Channel_. The first two settings require user and group IDs, respectively. This change was necessary because the way of mentioning via the Slack API [changed](https://api.slack.com/changelog/2017-09-the-one-about-usernames) and mentions in Slack notifications no longer worked.

### Notice about changes in backendSrv for plugin authors

In our mission to migrate away from AngularJS to React we have removed all AngularJS dependencies in the core data retrieval service `backendSrv`.

Removing the AngularJS dependencies in `backendSrv` has the unfortunate side effect of AngularJS digest no longer being triggered for any request made with `backendSrv`. Because of this, external plugins using `backendSrv` directly may suffer from strange behaviour in the UI.

To remedy this issue, as a plugin author you need to trigger the digest after a direct call to `backendSrv`. 

Example: 

```js
backendSrv.get(‘http://your.url/api’).then(result => {
    this.result = result;
    this.$scope.$digest();
});
```

You can test your plugin with the `master` branch version of Grafana.

# 6.6.1 (2020-02-06)

### Bug Fixes
* **Annotations**: Change indices and rewrites annotation find query to improve database query performance. [#21915](https://github.com/grafana/grafana/pull/21915), [@papagian](https://github.com/papagian), [@marefr](https://github.com/marefr), [@kylebrandt](https://github.com/kylebrandt)
* **Azure Monitor**: Fix Application Insights API key field to allow input. [#21738](https://github.com/grafana/grafana/pull/21738), [@shavonn](https://github.com/shavonn)
* **BarGauge**: Fix so we properly display the "no result" value when query returns empty result. [#21791](https://github.com/grafana/grafana/pull/21791), [@mckn](https://github.com/mckn)
* **Datasource**: Show access (Browser/Server) select on the Prometheus datasource. [#21833](https://github.com/grafana/grafana/pull/21833), [@jorgelbg](https://github.com/jorgelbg)
* **DatasourceSettings**: Fixed issue navigating away from data source settings page. [#21841](https://github.com/grafana/grafana/pull/21841), [@torkelo](https://github.com/torkelo)
* **Graph Panel**: Fix typo in thresholds form. [#21903](https://github.com/grafana/grafana/pull/21903), [@orendain](https://github.com/orendain)
* **Graphite**: Fixed issue with functions with multiple required params and no defaults caused params that could not be edited (groupByNodes groupByTags). [#21814](https://github.com/grafana/grafana/pull/21814), [@torkelo](https://github.com/torkelo)
* **Image Rendering**: Fix render of graph panel legend aligned to the right using Grafana image renderer plugin/service. [#21854](https://github.com/grafana/grafana/pull/21854), [@marefr](https://github.com/marefr)
* **Metrics**: Adds back missing summary quantiles. [#21858](https://github.com/grafana/grafana/pull/21858), [@kogent](https://github.com/kogent)
* **OpenTSDB**: Adds back missing ngInject to make it work again. [#21796](https://github.com/grafana/grafana/pull/21796), [@marefr](https://github.com/marefr)
* **Plugins**: Fix routing in app plugin pages. [#21847](https://github.com/grafana/grafana/pull/21847), [@dprokop](https://github.com/dprokop)
* **Prometheus**: Fixes default step value for annotation query. [#21934](https://github.com/grafana/grafana/pull/21934), [@hugohaggmark](https://github.com/hugohaggmark)
* **Quota**: Makes LDAP + Quota work for the first login of a new user. [#21949](https://github.com/grafana/grafana/pull/21949), [@xlson](https://github.com/xlson)
* **StatPanels**: Fixed change from singlestat to Gauge / BarGauge / Stat where default min & max (0, 100) was copied . [#21820](https://github.com/grafana/grafana/pull/21820), [@torkelo](https://github.com/torkelo)
* **TimePicker**: Should display in kiosk mode. [#21816](https://github.com/grafana/grafana/pull/21816), [@evgbibko](https://github.com/evgbibko)
* **grafana/toolkit**: Fix failing linter when there were lint issues. [#21849](https://github.com/grafana/grafana/pull/21849), [@dprokop](https://github.com/dprokop)

# 6.6.0 (2020-01-27)
  
### Features / Enhancements
* **CloudWatch**: Add DynamoDB Accelerator (DAX) metrics & dimensions. [#21644](https://github.com/grafana/grafana/pull/21644), [@kenju](https://github.com/kenju)
* **CloudWatch**: Auto period snap to next higher period. [#21659](https://github.com/grafana/grafana/pull/21659), [@sunker](https://github.com/sunker)
* **Template variables**: Add error for failed query variable on time range update. [#21731](https://github.com/grafana/grafana/pull/21731), [@tskarhed](https://github.com/tskarhed)
* **XSS**: Sanitize column link. [#21735](https://github.com/grafana/grafana/pull/21735), [@tskarhed](https://github.com/tskarhed)

### Bug Fixes
* **Elasticsearch**: Fix adhoc variable filtering for logs query. [#21346](https://github.com/grafana/grafana/pull/21346), [@ceh](https://github.com/ceh)
* **Explore**: Fix colors for log level when level value is capitalised. [#21646](https://github.com/grafana/grafana/pull/21646), [@ivanahuckova](https://github.com/ivanahuckova)
* **Explore**: Fix context view in logs, where some rows may have been filtered out.. [#21729](https://github.com/grafana/grafana/pull/21729), [@aocenas](https://github.com/aocenas)
* **Loki**: Fix Loki with repeated panels and interpolation for Explore. [#21685](https://github.com/grafana/grafana/pull/21685), [@ivanahuckova](https://github.com/ivanahuckova)
* **SQLStore**: Fix PostgreSQL failure to create organisation for first time. [#21648](https://github.com/grafana/grafana/pull/21648), [@papagian](https://github.com/papagian)

# 6.6.0-beta1 (2020-01-20)

## Breaking changes
* **PagerDuty**: Change `payload.custom_details` field in PagerDuty notification to be a JSON object instead of a string.
* **Security**: The `[security]` setting `cookie_samesite` configured to `none` now renders cookies with `SameSite=None` attribute compared to before where no `SameSite` attribute was added to cookies. To get the old behavior, use value `disabled` instead of `none`. Refer to [Upgrade Grafana](https://grafana.com/docs/grafana/latest/installation/upgrading/#upgrading-to-v6-6) for more information.

### Features / Enhancements
* **Graphite**: Add Metrictank dashboard to Graphite datasource
* **Admin**: Show name of user in users table view. [#18108](https://github.com/grafana/grafana/pull/18108), [@eleijonmarck](https://github.com/eleijonmarck)
* **Alerting**: Add configurable severity support for PagerDuty notifier. [#19425](https://github.com/grafana/grafana/pull/19425), [@yemble](https://github.com/yemble)
* **Alerting**: Add more information to webhook notifications. [#20420](https://github.com/grafana/grafana/pull/20420), [@michael-az](https://github.com/michael-az)
* **Alerting**: Add support for sending tags in OpsGenie notifier. [#20810](https://github.com/grafana/grafana/pull/20810), [@aSapien](https://github.com/aSapien)
* **Alerting**: Added fallbackText to Google Chat notifier. [#21464](https://github.com/grafana/grafana/pull/21464), [@alvarolmedo](https://github.com/alvarolmedo)
* **Alerting**: Adds support for sending a single email to all recipients in email notifier. [#21091](https://github.com/grafana/grafana/pull/21091), [@marefr](https://github.com/marefr)
* **Alerting**: Enable setting of OpsGenie priority via a tag. [#21298](https://github.com/grafana/grafana/pull/21298), [@zabullet](https://github.com/zabullet)
* **Alerting**: Use fully qualified status emoji in Threema notifier. [#21305](https://github.com/grafana/grafana/pull/21305), [@dbrgn](https://github.com/dbrgn)
* **Alerting**: new min_interval_seconds option to enforce a minimum evaluation frequency . [#21188](https://github.com/grafana/grafana/pull/21188), [@papagian](https://github.com/papagian)
* **CloudWatch**: Calculate period based on time range. [#21471](https://github.com/grafana/grafana/pull/21471), [@sunker](https://github.com/sunker)
* **CloudWatch**: Display partial result in graph when max DP/call limit is reached . [#21533](https://github.com/grafana/grafana/pull/21533), [@sunker](https://github.com/sunker)
* **CloudWatch**: ECS/ContainerInsights metrics support. [#21125](https://github.com/grafana/grafana/pull/21125), [@briancurt](https://github.com/briancurt)
* **CloudWatch**: Upgrade aws-sdk-go. [#20510](https://github.com/grafana/grafana/pull/20510), [@mtanda](https://github.com/mtanda)
* **DataLinks**: allow using values from other fields in the same row (cells). [#21478](https://github.com/grafana/grafana/pull/21478), [@ryantxu](https://github.com/ryantxu)
* **Editor**: Ignore closing brace when it was added by editor. [#21172](https://github.com/grafana/grafana/pull/21172), [@davkal](https://github.com/davkal)
* **Explore**: Context tooltip to copy labels and values from graph. [#21405](https://github.com/grafana/grafana/pull/21405), [@ivanahuckova](https://github.com/ivanahuckova)
* **Explore**: Log message line wrapping options for logs. [#20360](https://github.com/grafana/grafana/pull/20360), [@ivanahuckova](https://github.com/ivanahuckova)
* **Forms**: introduce RadioButtonGroup. [#20828](https://github.com/grafana/grafana/pull/20828), [@dprokop](https://github.com/dprokop)
* **Frontend**: Changes in Redux location should not strip subpath from location url. [#20161](https://github.com/grafana/grafana/pull/20161), [@wybczu](https://github.com/wybczu)
* **Graph**: Add fill gradient option to series override line fill. [#20941](https://github.com/grafana/grafana/pull/20941), [@hendrikvh](https://github.com/hendrikvh)
* **Graphite**: Add metrictank dashboard to Graphite datasource. [#20776](https://github.com/grafana/grafana/pull/20776), [@Dieterbe](https://github.com/Dieterbe)
* **Graphite**: Do not change query when opening the query editor and there is no data. [#21588](https://github.com/grafana/grafana/pull/21588), [@daniellee](https://github.com/daniellee)
* **Gravatar**: Use HTTPS by default. [#20964](https://github.com/grafana/grafana/pull/20964), [@jiajunhuang](https://github.com/jiajunhuang)
* **Loki**: Support for template variable queries. [#20697](https://github.com/grafana/grafana/pull/20697), [@ivanahuckova](https://github.com/ivanahuckova)
* **NewsPanel**: Add news as a builtin panel. [#21128](https://github.com/grafana/grafana/pull/21128), [@ryantxu](https://github.com/ryantxu)
* **OAuth**: Removes send_client_credentials_via_post setting . [#20044](https://github.com/grafana/grafana/pull/20044), [@LK4D4](https://github.com/LK4D4)
* **OpenTSDB**: Adding lookup limit to OpenTSDB datasource settings. [#20647](https://github.com/grafana/grafana/pull/20647), [@itamarst](https://github.com/itamarst)
* **Postgres/MySQL/MSSQL**: Adds support for region annotations. [#20752](https://github.com/grafana/grafana/pull/20752), [@Bercon](https://github.com/Bercon)
* **Prometheus**: Field to specify step in Explore. [#20195](https://github.com/grafana/grafana/pull/20195), [@Estrax](https://github.com/Estrax)
* **Prometheus**: User metrics metadata to inform query hints. [#21304](https://github.com/grafana/grafana/pull/21304), [@davkal](https://github.com/davkal)
* **Renderer**: Add user-agent to remote rendering service requests. [#20956](https://github.com/grafana/grafana/pull/20956), [@kfdm](https://github.com/kfdm)
* **Security**: Add disabled option for cookie samesite attribute. [#21472](https://github.com/grafana/grafana/pull/21472), [@marefr](https://github.com/marefr)
* **Stackdriver**: Support meta labels. [#21373](https://github.com/grafana/grafana/pull/21373), [@sunker](https://github.com/sunker)
* **TablePanel, GraphPanel**: Exclude hidden columns from CSV. [#19925](https://github.com/grafana/grafana/pull/19925), [@literalplus](https://github.com/literalplus)
* **Templating**: Update variables on location changed. [#21480](https://github.com/grafana/grafana/pull/21480), [@ryantxu](https://github.com/ryantxu)
* **Tracing**: Support configuring Jaeger client from environment. [#21103](https://github.com/grafana/grafana/pull/21103), [@hairyhenderson](https://github.com/hairyhenderson)
* **Units**: Add currency and energy units. [#20428](https://github.com/grafana/grafana/pull/20428), [@anirudh-ramesh](https://github.com/anirudh-ramesh)
* **Units**: Support dynamic count and currency units. [#21279](https://github.com/grafana/grafana/pull/21279), [@ryantxu](https://github.com/ryantxu)
* **grafana/toolkit**: Add option to override webpack config. [#20872](https://github.com/grafana/grafana/pull/20872), [@sebimarkgraf](https://github.com/sebimarkgraf)
* **grafana/ui**: ConfirmModal component. [#20965](https://github.com/grafana/grafana/pull/20965), [@alexanderzobnin](https://github.com/alexanderzobnin)
* **grafana/ui**: Create Tabs component. [#21328](https://github.com/grafana/grafana/pull/21328), [@peterholmberg](https://github.com/peterholmberg)
* **grafana/ui**: New table component. [#20991](https://github.com/grafana/grafana/pull/20991), [@peterholmberg](https://github.com/peterholmberg)
* **grafana/ui**: New updated time picker. [#20931](https://github.com/grafana/grafana/pull/20931), [@mckn](https://github.com/mckn)
* **White-labeling**: Makes it possible to customize the footer and login background (Enterprise)

### Bug Fixes
* **API**: Optionally list expired API keys. [#20468](https://github.com/grafana/grafana/pull/20468), [@papagian](https://github.com/papagian)
* **Alerting**: Fix custom_details to be a JSON object instead of a string in PagerDuty notifier. [#21150](https://github.com/grafana/grafana/pull/21150), [@tehGoti](https://github.com/tehGoti)
* **Alerting**: Fix image rendering and uploading timeout preventing to send alert notifications. [#21536](https://github.com/grafana/grafana/pull/21536), [@marefr](https://github.com/marefr)
* **Alerting**: Fix panic in dingding notifier . [#20378](https://github.com/grafana/grafana/pull/20378), [@csyangchen](https://github.com/csyangchen)
* **Alerting**: Fix template query validation logic. [#20721](https://github.com/grafana/grafana/pull/20721), [@okhowang](https://github.com/okhowang)
* **Alerting**: If no permission to clear history, keep the historical data. [#19007](https://github.com/grafana/grafana/pull/19007), [@lzdw](https://github.com/lzdw)
* **Alerting**: Unpausing a non-paused alert rule should not change status to Unknown. [#21375](https://github.com/grafana/grafana/pull/21375), [@vikkyomkar](https://github.com/vikkyomkar)
* **Api**: Fix returned message when enabling, disabling and deleting a non-existing user. [#21391](https://github.com/grafana/grafana/pull/21391), [@dpavlos](https://github.com/dpavlos)
* **Auth**: Rotate auth tokens at the end of requests. [#21347](https://github.com/grafana/grafana/pull/21347), [@woodsaj](https://github.com/woodsaj)
* **Azure Monitor**: Fixes error using azure monitor credentials with log analytics and non-default cloud. [#21032](https://github.com/grafana/grafana/pull/21032), [@shavonn](https://github.com/shavonn)
* **CLI**: Return error and aborts when plugin file extraction fails. [#20849](https://github.com/grafana/grafana/pull/20849), [@marefr](https://github.com/marefr)
* **CloudWatch**: Multi-valued template variable dimension alias fix. [#21541](https://github.com/grafana/grafana/pull/21541), [@sunker](https://github.com/sunker)
* **Dashboard**: Disable draggable panels on small devices. [#20629](https://github.com/grafana/grafana/pull/20629), [@peterholmberg](https://github.com/peterholmberg)
* **DataLinks**: Links with ${__value.time} do not work when clicking on first result . [#20019](https://github.com/grafana/grafana/pull/20019), [@dweineha](https://github.com/dweineha)
* **Explore**: Fix showing of results in selected timezone (UTC/local). [#20812](https://github.com/grafana/grafana/pull/20812), [@ivanahuckova](https://github.com/ivanahuckova)
* **Explore**: Fix timepicker when browsing back after switching datasource. [#21454](https://github.com/grafana/grafana/pull/21454), [@ivanahuckova](https://github.com/ivanahuckova)
* **Explore**: Sync timepicker and logs after live-tailing stops. [#20979](https://github.com/grafana/grafana/pull/20979), [@ivanahuckova](https://github.com/ivanahuckova)
* **Graph**: Fix when clicking a plot on a touch device we won't display the annotation menu. [#21479](https://github.com/grafana/grafana/pull/21479), [@mckn](https://github.com/mckn)
* **OAuth**: Fix role mapping from id token. [#20300](https://github.com/grafana/grafana/pull/20300), [@seanson](https://github.com/seanson)
* **Plugins**: Add appSubUrl string to config pages. [#21414](https://github.com/grafana/grafana/pull/21414), [@Maddin-619](https://github.com/Maddin-619)
* **Provisioning**: Start provision dashboards after Grafana server have started. [#21564](https://github.com/grafana/grafana/pull/21564), [@marefr](https://github.com/marefr)
* **Render**: Use https as protocol when rendering if HTTP2 enabled. [#21600](https://github.com/grafana/grafana/pull/21600), [@marefr](https://github.com/marefr)
* **Security**: Use same cookie settings for all cookies. [#19787](https://github.com/grafana/grafana/pull/19787), [@jeffdesc](https://github.com/jeffdesc)
* **Singlestat**: Support empty value map texts. [#20952](https://github.com/grafana/grafana/pull/20952), [@hendrikvh](https://github.com/hendrikvh)
* **Units**: Custom suffix and prefix units can now be specified, for example custom currency & SI & time formats. [#20763](https://github.com/grafana/grafana/pull/20763), [@ryantxu](https://github.com/ryantxu)
* **grafana/ui**: Do not build grafana/ui in strict mode as it depends on non-strict libs. [#21319](https://github.com/grafana/grafana/pull/21319), [@dprokop](https://github.com/dprokop)

# 6.5.3 (2020-01-15)
### Features / Enhancements
* **API**: Validate redirect_to cookie has valid (Grafana) url . [#21057](https://github.com/grafana/grafana/pull/21057), [@papagian](https://github.com/papagian), Thanks Habi S Ravi for reporting this issue. 

### Bug Fixes
* **AdHocFilter**: Shows SubMenu when filtering directly from table. [#21017](https://github.com/grafana/grafana/pull/21017), [@hugohaggmark](https://github.com/hugohaggmark)
* **Cloudwatch**: Fixed crash when switching from cloudwatch data source. [#21376](https://github.com/grafana/grafana/pull/21376), [@torkelo](https://github.com/torkelo)
* **DataLinks**: Sanitize data/panel link URLs. [#21140](https://github.com/grafana/grafana/pull/21140), [@dprokop](https://github.com/dprokop)
* **Elastic**: Fix multiselect variable interpolation for logs. [#20894](https://github.com/grafana/grafana/pull/20894), [@ivanahuckova](https://github.com/ivanahuckova)
* **Prometheus**: Fixes so user can change HTTP Method in config settings. [#21055](https://github.com/grafana/grafana/pull/21055), [@hugohaggmark](https://github.com/hugohaggmark)
* **Prometheus**: Prevents validation of inputs when clicking in them without changing the value. [#21059](https://github.com/grafana/grafana/pull/21059), [@hugohaggmark](https://github.com/hugohaggmark)
* **Rendering**: Fix panel PNG rendering when using sub url & serve_from_sub_path = true. [#21306](https://github.com/grafana/grafana/pull/21306), [@bgranvea](https://github.com/bgranvea)
* **Table**: Matches column names with unescaped regex characters. [#21164](https://github.com/grafana/grafana/pull/21164), [@hugohaggmark](https://github.com/hugohaggmark)

# 6.5.2 (2019-12-11)

### Bug Fixes
  * **Alerting**: Improve alert threshold handle dragging behavior. [#20922](https://github.com/grafana/grafana/pull/20922), [@torkelo](https://github.com/torkelo)
  * **AngularPanels**: Fixed loading spinner being stuck in some rare cases. [#20878](https://github.com/grafana/grafana/pull/20878), [@torkelo](https://github.com/torkelo)
  * **CloudWatch**: Fix query editor does not render in Explore. [#20909](https://github.com/grafana/grafana/pull/20909), [@davkal](https://github.com/davkal)
  * **CloudWatch**: Remove illegal character escaping in inferred expressions. [#20915](https://github.com/grafana/grafana/pull/20915), [@sunker](https://github.com/sunker)
  * **CloudWatch**: Remove template variable error message. [#20864](https://github.com/grafana/grafana/pull/20864), [@sunker](https://github.com/sunker)
  * **CloudWatch**: Use datasource template variable in curated dashboards. [#20917](https://github.com/grafana/grafana/pull/20917), [@sunker](https://github.com/sunker)
  * **Elasticsearch**: Set default port to 9200 in ConfigEditor. [#20948](https://github.com/grafana/grafana/pull/20948), [@papagian](https://github.com/papagian)
  * **Gauge/BarGauge**: Added support for value mapping of "no data"-state to text/value. [#20842](https://github.com/grafana/grafana/pull/20842), [@mckn](https://github.com/mckn)
  * **Graph**: Prevent tooltip from being displayed outside of window. [#20874](https://github.com/grafana/grafana/pull/20874), [@mckn](https://github.com/mckn)
  * **Graphite**: Fixes error with annotation metric queries . [#20857](https://github.com/grafana/grafana/pull/20857), [@dprokop](https://github.com/dprokop)
  * **Login**: Fix fatal error when navigating from reset password page. [#20747](https://github.com/grafana/grafana/pull/20747), [@peterholmberg](https://github.com/peterholmberg)
  * **MixedDatasources**: Do not filter out all mixed data sources in add mixed query dropdown. [#20990](https://github.com/grafana/grafana/pull/20990), [@torkelo](https://github.com/torkelo)
  * **Prometheus**: Fix caching for default labels request. [#20718](https://github.com/grafana/grafana/pull/20718), [@aocenas](https://github.com/aocenas)
  * **Prometheus**: Run default labels query only once. [#20898](https://github.com/grafana/grafana/pull/20898), [@aocenas](https://github.com/aocenas)
  * **Security**: Fix invite link still accessible after completion or revocation. [#20863](https://github.com/grafana/grafana/pull/20863), [@aknuds1](https://github.com/aknuds1)
  * **Server**: Fail when unable to create log directory. [#20804](https://github.com/grafana/grafana/pull/20804), [@aknuds1](https://github.com/aknuds1)
  * **TeamPicker**: Increase size limit from 10 to 100. [#20882](https://github.com/grafana/grafana/pull/20882), [@hendrikvh](https://github.com/hendrikvh)
  * **Units**: Remove SI prefix symbol from new milli/microSievert(/h) units. [#20650](https://github.com/grafana/grafana/pull/20650), [@zegelin](https://github.com/zegelin)

# 6.5.1 (2019-11-28)

### Bug Fixes
* **CloudWatch**: Region template query fix. [#20661](https://github.com/grafana/grafana/pull/20661), [@sunker](https://github.com/sunker)
* **CloudWatch**: Fix annotations query editor loading. [#20687](https://github.com/grafana/grafana/pull/20687), [@sunker](https://github.com/sunker)
* **Panel**: Fixes undefined services/dependencies in plugins without `/**@ngInject*/`. [#20696](https://github.com/grafana/grafana/pull/20696), [@hugohaggmark](https://github.com/hugohaggmark)
* **Server**: Fix failure to start with "bind: address already in use" when using socket as protocol. [#20679](https://github.com/grafana/grafana/pull/20679), [@aknuds1](https://github.com/aknuds1)
* **Stats**: Fix active admins/editors/viewers stats are counted more than once if the user is part of more than one org. [#20711](https://github.com/grafana/grafana/pull/20711), [@papagian](https://github.com/papagian)

# 6.5.0 (2019-11-25)

### Features / Enhancements

* **CloudWatch**: Add curated dashboards for most popular amazon services. [#20486](https://github.com/grafana/grafana/pull/20486), [@sunker](https://github.com/sunker)
* **CloudWatch**: Enable Min time interval. [#20260](https://github.com/grafana/grafana/pull/20260), [@mtanda](https://github.com/mtanda)
* **Explore**: UI improvements for log details. [#20485](https://github.com/grafana/grafana/pull/20485), [@ivanahuckova](https://github.com/ivanahuckova)
* **Server**: Improve grafana-server diagnostics configuration for profiling and tracing. [#20593](https://github.com/grafana/grafana/pull/20593), [@papagian](https://github.com/papagian)

### Bug Fixes

* **BarGauge/Gauge**: Add back missing title option field display options. [#20616](https://github.com/grafana/grafana/pull/20616), [@torkelo](https://github.com/torkelo)
* **CloudWatch**: Fix high CPU load. [#20579](https://github.com/grafana/grafana/pull/20579), [@marefr](https://github.com/marefr)
* **CloudWatch**: Fix high resolution mode without expression. [#20459](https://github.com/grafana/grafana/pull/20459), [@mtanda](https://github.com/mtanda)
* **CloudWatch**: Make sure period variable is being interpreted correctly. [#20447](https://github.com/grafana/grafana/pull/20447), [@sunker](https://github.com/sunker)
* **CloudWatch**: Remove HighResolution toggle since it's not being used. [#20440](https://github.com/grafana/grafana/pull/20440), [@sunker](https://github.com/sunker)
* **Cloudwatch**: Fix LaunchTime attribute tag bug. [#20237](https://github.com/grafana/grafana/pull/20237), [@sunker](https://github.com/sunker)
* **Data links**: Fix URL field turns read-only for graph panels. [#20381](https://github.com/grafana/grafana/pull/20381), [@dprokop](https://github.com/dprokop)
* **Explore**: Keep logQL filters when selecting labels in log row details. [#20570](https://github.com/grafana/grafana/pull/20570), [@ivanahuckova](https://github.com/ivanahuckova)
* **MySQL**: Fix TLS auth settings in config page. [#20501](https://github.com/grafana/grafana/pull/20501), [@peterholmberg](https://github.com/peterholmberg)
* **Provisioning**: Fix unmarshaling nested jsonData values. [#20399](https://github.com/grafana/grafana/pull/20399), [@aocenas](https://github.com/aocenas)
* **Server**: Should fail when server is unable to bind port. [#20409](https://github.com/grafana/grafana/pull/20409), [@aknuds1](https://github.com/aknuds1)
* **Templating**: Prevents crash when $__searchFilter is not a string. [#20526](https://github.com/grafana/grafana/pull/20526), [@hugohaggmark](https://github.com/hugohaggmark)
* **TextPanel**: Fixes issue with template variable value not properly html escaped [#20588](https://github.com/grafana/grafana/pull/20588), [@torkelo](https://github.com/torkelo)
* **TimePicker**: Should update after location change. [#20466](https://github.com/grafana/grafana/pull/20466), [@torkelo](https://github.com/torkelo)

## Breaking changes
* **CloudWatch**: Pre Grafana 6.5.0, the CloudWatch datasource used the GetMetricStatistics API for all queries that did not have an ´id´ and did not have an ´expression´ defined in the query editor. The GetMetricStatistics API has a limit of 400 transactions per second. In this release, all queries use the GetMetricData API. The GetMetricData API has a limit of 50 transactions per second and 100 metrics per transaction. For API pricing information, please refer to the CloudWatch pricing page (https://aws.amazon.com/cloudwatch/pricing/).

* **CloudWatch**: The GetMetricData API does not return metric unit, so unit auto detection in panels is no longer supported.

* **CloudWatch**: The `HighRes` switch has been removed from the query editor. Read more about this in [upgrading to 6.5](https://grafana.com/docs/installation/upgrading/#upgrading-to-v6-5).

* **CloudWatch**: In previous versions of Grafana, there was partial support for using multi-valued template variables as dimension values. When a multi-valued template variable is being used for dimension values in Grafana 6.5, a [search expression](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/using-search-expressions.html) will be generated. In the GetMetricData API, expressions are limited to 1024 characters, so you might reach this limit if you are using a large number of values. Read our [upgrading to 6.5](https://grafana.com/docs/installation/upgrading/#upgrading-to-v6-5) guide to see how you can use the `*` wildcard for this use case.

# 6.5.0-beta1 (2019-11-14)

### Features / Enhancements

  * **API**: Add `createdAt` and `updatedAt` to api/users/lookup. [#19496](https://github.com/grafana/grafana/pull/19496), [@gotjosh](https://github.com/gotjosh)
  * **API**: Add createdAt field to /api/users/:id. [#19475](https://github.com/grafana/grafana/pull/19475), [@cored](https://github.com/cored)
  * **Admin**: Adds setting to disable creating initial admin user. [#19505](https://github.com/grafana/grafana/pull/19505), [@shavonn](https://github.com/shavonn)
  * **Alerting**: Include alert_state in Kafka notifier payload. [#20099](https://github.com/grafana/grafana/pull/20099), [@arnaudlemaignen](https://github.com/arnaudlemaignen)
  * **AuthProxy**: Can now login with auth proxy and get a login token. [#20175](https://github.com/grafana/grafana/pull/20175), [@torkelo](https://github.com/torkelo)
  * **AuthProxy**: replaces setting ldap_sync_ttl with sync_ttl. [#20191](https://github.com/grafana/grafana/pull/20191), [@jongyllen](https://github.com/jongyllen)
  * **AzureMonitor**: Alerting for Azure Application Insights. [#19381](https://github.com/grafana/grafana/pull/19381), [@ChadNedzlek](https://github.com/ChadNedzlek)
  * **Build**: Upgrade to Go 1.13. [#19502](https://github.com/grafana/grafana/pull/19502), [@aknuds1](https://github.com/aknuds1)
  * **CLI**: Reduce memory usage for plugin installation. [#19639](https://github.com/grafana/grafana/pull/19639), [@olivierlemasle](https://github.com/olivierlemasle)
  * **CloudWatch**: Add ap-east-1 to hard-coded region lists. [#19523](https://github.com/grafana/grafana/pull/19523), [@Nessworthy](https://github.com/Nessworthy)
  * **CloudWatch**: ContainerInsights metrics support. [#18971](https://github.com/grafana/grafana/pull/18971), [@francopeapea](https://github.com/francopeapea)
  * **CloudWatch**: Support dynamic queries using dimension wildcards [#20058](https://github.com/grafana/grafana/issues/20058), [@sunker](https://github.com/sunker)
  * **CloudWatch**: Stop using GetMetricStatistics and use GetMetricData for all time series requests [#20057](https://github.com/grafana/grafana/issues/20057), [@sunker](https://github.com/sunker)
  * **CloudWatch**: Convert query editor from Angular to React [#19880](https://github.com/grafana/grafana/issues/19880), [@sunker](https://github.com/sunker)
  * **CloudWatch**: Convert config editor from Angular to React [#19881](https://github.com/grafana/grafana/issues/19881), [@shavonn](https://github.com/shavonn)
  * **CloudWatch**: Improved error handling when throttling occurs [#20348](https://github.com/grafana/grafana/issues/20348), [@sunker](https://github.com/sunker)
  * **CloudWatch**: Deep linking from Grafana panel to CloudWatch console [#20279](https://github.com/grafana/grafana/issues/20279), [@sunker](https://github.com/sunker)
  * **CloudWatch**: Add Grafana user agent to GMD calls [#20277](https://github.com/grafana/grafana/issues/20277), [@sunker](https://github.com/sunker)
  * **Dashboard**: Allows the d-solo route to be used without slug. [#19640](https://github.com/grafana/grafana/pull/19640), [@97amarnathk](https://github.com/97amarnathk)
  * **Docker**: Build and publish an additional Ubuntu based docker image. [#20196](https://github.com/grafana/grafana/pull/20196), [@aknuds1](https://github.com/aknuds1)
  * **Elasticsearch**: Adds support for region annotations. [#17602](https://github.com/grafana/grafana/pull/17602), [@fangel](https://github.com/fangel)
  * **Explore**: Add custom DataLinks on datasource level (like tracing links). [#20060](https://github.com/grafana/grafana/pull/20060), [@aocenas](https://github.com/aocenas)
  * **Explore**: Add functionality to show/hide query row results. [#19794](https://github.com/grafana/grafana/pull/19794), [@ivanahuckova](https://github.com/ivanahuckova)
  * **Explore**: Synchronise time ranges in split mode. [#19274](https://github.com/grafana/grafana/pull/19274), [@ivanahuckova](https://github.com/ivanahuckova)
  * **Explore**: UI change for log row details . [#20034](https://github.com/grafana/grafana/pull/20034), [@ivanahuckova](https://github.com/ivanahuckova)
  * **Frontend**: Migrate DataSource HTTP Settings to React. [#19452](https://github.com/grafana/grafana/pull/19452), [@dprokop](https://github.com/dprokop)
  * **Frontend**: Show browser not supported notification. [#19904](https://github.com/grafana/grafana/pull/19904), [@peterholmberg](https://github.com/peterholmberg)
  * **Graph**: Added series override option to have hidden series be persisted on save. [#20124](https://github.com/grafana/grafana/pull/20124), [@Gauravshah](https://github.com/Gauravshah)
  * **Graphite**: Add Metrictank option to settings to view Metrictank request processing info in new inspect feature. [#20138](https://github.com/grafana/grafana/pull/20138), [@ryantxu](https://github.com/ryantxu)
  * **LDAP**: Enable single user sync. [#19446](https://github.com/grafana/grafana/pull/19446), [@gotjosh](https://github.com/gotjosh)
  * **LDAP**: Last org admin can login but wont be removed. [#20326](https://github.com/grafana/grafana/pull/20326), [@xlson](https://github.com/xlson)
  * **LDAP**: Support env variable expressions in ldap.toml file. [#20173](https://github.com/grafana/grafana/pull/20173), [@torkelo](https://github.com/torkelo)
  * **OAuth**: Generic OAuth role mapping support. [#17149](https://github.com/grafana/grafana/pull/17149), [@hypery2k](https://github.com/hypery2k)
  * **Prometheus**: Custom query parameters string for Thanos downsampling. [#19121](https://github.com/grafana/grafana/pull/19121), [@seuf](https://github.com/seuf)
  * **Provisioning**: Allow saving of provisioned dashboards. [#19820](https://github.com/grafana/grafana/pull/19820), [@jongyllen](https://github.com/jongyllen)
  * **Security**: Minor XSS issue resolved by angularjs upgrade from 1.6.6 -> 1.6.9. [#19849](https://github.com/grafana/grafana/pull/19849), [@peterholmberg](https://github.com/peterholmberg)
  * **TablePanel**: Prevents crash when data contains mixed data formats. [#20202](https://github.com/grafana/grafana/pull/20202), [@hugohaggmark](https://github.com/hugohaggmark)
  * **Templating**: Introduces $__searchFilter to Query Variables. [#19858](https://github.com/grafana/grafana/pull/19858), [@hugohaggmark](https://github.com/hugohaggmark)
  * **Templating**: Made default template variable query editor field a textarea with automatic height. [#20288](https://github.com/grafana/grafana/pull/20288), [@torkelo](https://github.com/torkelo)
  * **Units**: Add milli/microSievert, milli/microSievert/h and pixels. [#20144](https://github.com/grafana/grafana/pull/20144), [@ryantxu](https://github.com/ryantxu)
  * **Units**: Added mega ampere and watt-hour per kg. [#19922](https://github.com/grafana/grafana/pull/19922), [@Karan96Kaushik](https://github.com/Karan96Kaushik)

  ### Bug Fixes
  * **API**: Added dashboardId and slug in response to dashboard import api. [#19692](https://github.com/grafana/grafana/pull/19692), [@jongyllen](https://github.com/jongyllen)
  * **API**: Fix logging of dynamic listening port. [#19644](https://github.com/grafana/grafana/pull/19644), [@oleggator](https://github.com/oleggator)
  * **BarGauge**: Fix so that default thresholds not keeps resetting. [#20190](https://github.com/grafana/grafana/pull/20190), [@lzdw](https://github.com/lzdw)
  * **CloudWatch**: Fix incorrect casing of Redshift dimension entry for service class and stage. [#19897](https://github.com/grafana/grafana/pull/19897), [@nlsdfnbch](https://github.com/nlsdfnbch)
  * **CloudWatch**: Fixing AWS Kafka dimension names. [#19986](https://github.com/grafana/grafana/pull/19986), [@skuxy](https://github.com/skuxy)
  * **CloudWatch**: Metric math broken when using multi template variables [#18337](https://github.com/grafana/grafana/issues/18337), [@sunker](https://github.com/sunker)
  * **CloudWatch**: Graphs with multiple multi-value dimension variables don't work [#17949](https://github.com/grafana/grafana/issues/17949), [@sunker](https://github.com/sunker)
  * **CloudWatch**: Variables' values surrounded with braces in request sent to AWS [#14451](https://github.com/grafana/grafana/issues/14451), [@sunker](https://github.com/sunker)
  * **CloudWatch**: Cloudwatch Query for a list of instances for which data is available in the selected time interval [#12784](https://github.com/grafana/grafana/issues/12784), [@sunker](https://github.com/sunker)
  * **CloudWatch**: Dimension's positioning/order should be stored in the json dashboard [#11062](https://github.com/grafana/grafana/issues/11062), [@sunker](https://github.com/sunker)
  * **CloudWatch**: Batch CloudWatch API call support in backend [#7991](https://github.com/grafana/grafana/issues/7991), [@sunker](https://github.com/sunker)
  * **ColorPicker**: Fixes issue with ColorPicker disappearing too quickly . [#20289](https://github.com/grafana/grafana/pull/20289), [@dprokop](https://github.com/dprokop)
  * **Datasource**: Add custom headers on alerting queries. [#19508](https://github.com/grafana/grafana/pull/19508), [@weeco](https://github.com/weeco)
  * **Docker**: Add additional glibc dependencies to support certain backend plugins in alpine. [#20214](https://github.com/grafana/grafana/pull/20214), [@briangann](https://github.com/briangann)
  * **Docker**: Build and use musl-based binaries in alpine images to resolve glibc incompatibility issues. [#19798](https://github.com/grafana/grafana/pull/19798), [@aknuds1](https://github.com/aknuds1)
  * **Elasticsearch**: Fix template variables interpolation when redirecting to Explore. [#20314](https://github.com/grafana/grafana/pull/20314), [@ivanahuckova](https://github.com/ivanahuckova)
  * **Elasticsearch**: Support rendering in logs panel. [#20229](https://github.com/grafana/grafana/pull/20229), [@davkal](https://github.com/davkal)
  * **Explore**: Expand template variables when redirecting from dashboard panel. [#19582](https://github.com/grafana/grafana/pull/19582), [@ivanahuckova](https://github.com/ivanahuckova)
  * **OAuth**: Make the login button display name of custom OAuth provider. [#20209](https://github.com/grafana/grafana/pull/20209), [@dprokop](https://github.com/dprokop)
  * **ReactPanels**: Adds Explore menu item. [#20236](https://github.com/grafana/grafana/pull/20236), [@hugohaggmark](https://github.com/hugohaggmark)
  * **Team Sync**: Fix URL encode Group IDs for external team sync. [#20280](https://github.com/grafana/grafana/pull/20280), [@gotjosh](https://github.com/gotjosh)

## Breaking changes
* **CloudWatch**: Pre Grafana 6.5.0, the CloudWatch datasource used the GetMetricStatistics API for all queries that did not have an ´id´ and did not have an ´expression´ defined in the query editor. The GetMetricStatistics API has a limit of 400 transactions per second. In this release, all queries use the GetMetricData API. The GetMetricData API has a limit of 50 transactions per second and 100 metrics per transaction. For API pricing information, please refer to the CloudWatch pricing page (https://aws.amazon.com/cloudwatch/pricing/).

* **CloudWatch**: The GetMetricData API does not return metric unit, so unit auto detection in panels is no longer supported.

* **CloudWatch**: The `HighRes` switch has been removed from the query editor. Read more about this in [upgrading to 6.5](https://grafana.com/docs/installation/upgrading/#upgrading-to-v6-5).

* **CloudWatch**: In previous versions of Grafana, there was partial support for using multi-valued template variables as dimension values. When a multi-valued template variable is being used for dimension values in Grafana 6.5, a [search expression](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/using-search-expressions.html) will be generated. In the GetMetricData API, expressions are limited to 1024 characters, so you might reach this limit if you are using a large number of values. Read our [upgrading to 6.5](https://grafana.com/docs/installation/upgrading/#upgrading-to-v6-5) guide to see how you can use the `*` wildcard for this use case.

# 6.4.5 (2019-11-25)

### Bug Fixes

* **CloudWatch**: Fix high CPU load [#20579](https://github.com/grafana/grafana/pull/20579)

# 6.4.4 (2019-11-06)

### Bug Fixes
* **MySQL**: Fix encoding in connection string [#20192](https://github.com/grafana/grafana/pull/20192)
* **DataLinks**: Fix blur issues. [#19883](https://github.com/grafana/grafana/pull/19883), [@aocenas](https://github.com/aocenas)
* **Docker**: Makes it possible to parse timezones in the docker image. [#20081](https://github.com/grafana/grafana/pull/20081), [@xlson](https://github.com/xlson)
* **LDAP**: All LDAP servers should be tried even if one of them returns a connection error. [#20077](https://github.com/grafana/grafana/pull/20077), [@jongyllen](https://github.com/jongyllen)
* **LDAP**: No longer shows incorrectly matching groups based on role in debug page. [#20018](https://github.com/grafana/grafana/pull/20018), [@xlson](https://github.com/xlson)
* **Singlestat**: Fix no data / null value mapping . [#19951](https://github.com/grafana/grafana/pull/19951), [@ryantxu](https://github.com/ryantxu)

#### Security vulnerability

The MySQL data source connnection string fix, [#20192](https://github.com/grafana/grafana/pull/20192), that was part of this release
also fixed a security vulnerability. Thanks Yuriy Dyachenko for discovering and notifying us about this.

# 6.4.3 (2019-10-16)

### Bug Fixes
* **Alerting**: All notification channels should send even if one fails to send. [#19807](https://github.com/grafana/grafana/pull/19807), [@jan25](https://github.com/jan25)
* **AzureMonitor**: Fix slate interference with dropdowns. [#19799](https://github.com/grafana/grafana/pull/19799), [@aocenas](https://github.com/aocenas)
* **ContextMenu**: make ContextMenu positioning aware of the viewport width. [#19699](https://github.com/grafana/grafana/pull/19699), [@krvajal](https://github.com/krvajal)
* **DataLinks**: Fix context menu not showing in singlestat-ish visualisations. [#19809](https://github.com/grafana/grafana/pull/19809), [@dprokop](https://github.com/dprokop)
* **DataLinks**: Fix url field not releasing focus. [#19804](https://github.com/grafana/grafana/pull/19804), [@aocenas](https://github.com/aocenas)
* **Datasource**: Fixes clicking outside of some query editors required 2 clicks. [#19822](https://github.com/grafana/grafana/pull/19822), [@aocenas](https://github.com/aocenas)
* **Panels**: Fixes default tab for visualizations without Queries Tab. [#19803](https://github.com/grafana/grafana/pull/19803), [@hugohaggmark](https://github.com/hugohaggmark)
* **Singlestat**: Fixed issue with mapping null to text. [#19689](https://github.com/grafana/grafana/pull/19689), [@torkelo](https://github.com/torkelo)
* **@grafana/toolkit**: Don't fail plugin creation when git user.name config is not set. [#19821](https://github.com/grafana/grafana/pull/19821), [@dprokop](https://github.com/dprokop)
* **@grafana/toolkit**: TSLint line number off by 1. [#19782](https://github.com/grafana/grafana/pull/19782), [@fredwangwang](https://github.com/fredwangwang)

# 6.4.2 (2019-10-08)

### Bug Fixes
* **CloudWatch**: Changes incorrect dimension wmlid to wlmid . [#19679](https://github.com/grafana/grafana/pull/19679), [@ATTron](https://github.com/ATTron)
* **Grafana Image Renderer**: Fixes plugin page. [#19664](https://github.com/grafana/grafana/pull/19664), [@hugohaggmark](https://github.com/hugohaggmark)
* **Graph**: Fixes auto decimals logic for y axis ticks that results in too many decimals for high values. [#19618](https://github.com/grafana/grafana/pull/19618), [@torkelo](https://github.com/torkelo)
* **Graph**: Switching to series mode should re-render graph. [#19623](https://github.com/grafana/grafana/pull/19623), [@torkelo](https://github.com/torkelo)
* **Loki**: Fix autocomplete on label values. [#19579](https://github.com/grafana/grafana/pull/19579), [@aocenas](https://github.com/aocenas)
* **Loki**: Removes live option for logs panel. [#19533](https://github.com/grafana/grafana/pull/19533), [@davkal](https://github.com/davkal)
* **Profile**: Fix issue with user profile not showing more than sessions sessions in some cases. [#19578](https://github.com/grafana/grafana/pull/19578), [@huynhsamha](https://github.com/huynhsamha)
* **Prometheus**: Fixes so results in Panel always are sorted by query order. [#19597](https://github.com/grafana/grafana/pull/19597), [@hugohaggmark](https://github.com/hugohaggmark)
* **ShareQuery**: Fixed issue when using -- Dashboard -- datasource (to share query result) when dashboard had rows. [#19610](https://github.com/grafana/grafana/pull/19610), [@torkelo](https://github.com/torkelo)
* **Show SAML login button if SAML is enabled**. [#19591](https://github.com/grafana/grafana/pull/19591), [@papagian](https://github.com/papagian)
* **SingleStat**: Fixes $__name postfix/prefix usage. [#19687](https://github.com/grafana/grafana/pull/19687), [@hugohaggmark](https://github.com/hugohaggmark)
* **Table**: Proper handling of json data with dataframes. [#19596](https://github.com/grafana/grafana/pull/19596), [@marefr](https://github.com/marefr)
* **Units**: Fixed wrong id for Terabits/sec. [#19611](https://github.com/grafana/grafana/pull/19611), [@andreaslangnevyjel](https://github.com/andreaslangnevyjel)

# 6.4.1 (2019-10-02)

### Bug Fixes

* **Provisioning**: Fixed issue where empty nested keys in YAML provisioning caused server crash, [#19547](https://github.com/grafana/grafana/pull/19547)
* **ImageRendering**: Fixed issue with image rendering in enterprise build (Enterprise)
* **Reporting**: Fixed issue with reporting service when STMP disabled (Enterprise).

# 6.4.0 (2019-10-01)

### Features / Enhancements
* **Build**: Upgrade go to 1.12.10. [#19499](https://github.com/grafana/grafana/pull/19499), [@marefr](https://github.com/marefr)
* **DataLinks**: Suggestions menu improvements. [#19396](https://github.com/grafana/grafana/pull/19396), [@dprokop](https://github.com/dprokop)
* **Explore**: Take root_url setting into account when redirecting from dashboard to explore. [#19447](https://github.com/grafana/grafana/pull/19447), [@ivanahuckova](https://github.com/ivanahuckova)
* **Explore**: Update broken link to logql docs. [#19510](https://github.com/grafana/grafana/pull/19510), [@ivanahuckova](https://github.com/ivanahuckova)
* **Logs**: Adds Logs Panel as a visualization. [#19504](https://github.com/grafana/grafana/pull/19504), [@davkal](https://github.com/davkal)

### Bug Fixes
* **CLI**: Fix version selection for plugin install. [#19498](https://github.com/grafana/grafana/pull/19498), [@aocenas](https://github.com/aocenas)
* **Graph**: Fixes minor issue with series override color picker and custom color . [#19516](https://github.com/grafana/grafana/pull/19516), [@torkelo](https://github.com/torkelo)

## Plugins that need updating when upgrading from 6.3 to 6.4

* [Splunk](https://grafana.com/grafana/plugins/grafana-splunk-datasource)

# 6.4.0-beta2 (2019-09-25)

### Features / Enhancements
* **Azure Monitor**: Remove support for cross resource queries (#19115)". [#19346](https://github.com/grafana/grafana/pull/19346), [@sunker](https://github.com/sunker)
* **Docker**: Upgrade packages to resolve reported vulnerabilities. [#19188](https://github.com/grafana/grafana/pull/19188), [@marefr](https://github.com/marefr)
* **Graphite**: Time range expansion reduced from 1 minute to 1 second. [#19246](https://github.com/grafana/grafana/pull/19246), [@torkelo](https://github.com/torkelo)
* **grafana/toolkit**: Add plugin creation task. [#19207](https://github.com/grafana/grafana/pull/19207), [@dprokop](https://github.com/dprokop)

### Bug Fixes
* **Alerting**: Prevents creating alerts from unsupported queries. [#19250](https://github.com/grafana/grafana/pull/19250), [@hugohaggmark](https://github.com/hugohaggmark)
* **Alerting**: Truncate PagerDuty summary when greater than 1024 characters. [#18730](https://github.com/grafana/grafana/pull/18730), [@nvllsvm](https://github.com/nvllsvm)
* **Cloudwatch**: Fix autocomplete for Gamelift dimensions. [#19146](https://github.com/grafana/grafana/pull/19146), [@kevinpz](https://github.com/kevinpz)
* **Dashboard**: Fix export for sharing when panels use default data source. [#19315](https://github.com/grafana/grafana/pull/19315), [@torkelo](https://github.com/torkelo)
* **Database**: Rewrite system statistics query to perform better. [#19178](https://github.com/grafana/grafana/pull/19178), [@papagian](https://github.com/papagian)
* **Gauge/BarGauge**: Fix issue with [object Object] in titles  . [#19217](https://github.com/grafana/grafana/pull/19217), [@ryantxu](https://github.com/ryantxu)
* **MSSQL**: Revert usage of new connectionstring format introduced by #18384. [#19203](https://github.com/grafana/grafana/pull/19203), [@marefr](https://github.com/marefr)
* **Multi-LDAP**: Do not fail-fast on invalid credentials. [#19261](https://github.com/grafana/grafana/pull/19261), [@gotjosh](https://github.com/gotjosh)
* **MySQL, Postgres, MSSQL**: Fix validating query with template variables in alert . [#19237](https://github.com/grafana/grafana/pull/19237), [@marefr](https://github.com/marefr)
* **MySQL, Postgres**: Update raw sql when query builder updates. [#19209](https://github.com/grafana/grafana/pull/19209), [@marefr](https://github.com/marefr)
* **MySQL**: Limit datasource error details returned from the backend. [#19373](https://github.com/grafana/grafana/pull/19373), [@marefr](https://github.com/marefr)

# 6.4.0-beta1 (2019-09-17)

### Features / Enhancements
* **Reporting**: Created scheduled PDF reports for any dashboard (Enterprise).
* **API**: Readonly datasources should not be created via the API. [#19006](https://github.com/grafana/grafana/pull/19006), [@papagian](https://github.com/papagian)
* **Alerting**: Include configured AlertRuleTags in Webhooks notifier. [#18233](https://github.com/grafana/grafana/pull/18233), [@dominic-miglar](https://github.com/dominic-miglar)
* **Annotations**: Add annotations support to Loki. [#18949](https://github.com/grafana/grafana/pull/18949), [@aocenas](https://github.com/aocenas)
* **Annotations**: Use a single row to represent a region. [#17673](https://github.com/grafana/grafana/pull/17673), [@ryantxu](https://github.com/ryantxu)
* **Auth**: Allow inviting existing users when login form is disabled. [#19048](https://github.com/grafana/grafana/pull/19048), [@548017](https://github.com/548017)
* **Azure Monitor**: Add support for cross resource queries. [#19115](https://github.com/grafana/grafana/pull/19115), [@sunker](https://github.com/sunker)
* **CLI**: Allow installing custom binary plugins. [#17551](https://github.com/grafana/grafana/pull/17551), [@aocenas](https://github.com/aocenas)
* **Dashboard**: Adds Logs Panel (alpha) as visualization option for Dashboards. [#18641](https://github.com/grafana/grafana/pull/18641), [@hugohaggmark](https://github.com/hugohaggmark)
* **Dashboard**: Reuse query results between panels . [#16660](https://github.com/grafana/grafana/pull/16660), [@ryantxu](https://github.com/ryantxu)
* **Dashboard**: Set time to to 23:59:59 when setting To time using calendar. [#18595](https://github.com/grafana/grafana/pull/18595), [@simPod](https://github.com/simPod)
* **DataLinks**: Add DataLinks support to Gauge, BarGauge and stat panel. [#18605](https://github.com/grafana/grafana/pull/18605), [@ryantxu](https://github.com/ryantxu)
* **DataLinks**: Enable access to labels & field names. [#18918](https://github.com/grafana/grafana/pull/18918), [@torkelo](https://github.com/torkelo)
* **DataLinks**: Enable multiple data links per panel. [#18434](https://github.com/grafana/grafana/pull/18434), [@dprokop](https://github.com/dprokop)
* **Docker**: switch docker image to alpine base with phantomjs support. [#18468](https://github.com/grafana/grafana/pull/18468), [@DanCech](https://github.com/DanCech)
* **Elasticsearch**: allow templating queries to order by doc_count. [#18870](https://github.com/grafana/grafana/pull/18870), [@hackery](https://github.com/hackery)
* **Explore**: Add throttling when doing live queries. [#19085](https://github.com/grafana/grafana/pull/19085), [@aocenas](https://github.com/aocenas)
* **Explore**: Adds ability to go back to dashboard, optionally with query changes. [#17982](https://github.com/grafana/grafana/pull/17982), [@kaydelaney](https://github.com/kaydelaney)
* **Explore**: Reduce default time range to last hour. [#18212](https://github.com/grafana/grafana/pull/18212), [@davkal](https://github.com/davkal)
* **Gauge/BarGauge**: Support decimals for min/max. [#18368](https://github.com/grafana/grafana/pull/18368), [@ryantxu](https://github.com/ryantxu)
* **Graph**: New series override transform constant that renders a single point as a line across the whole graph. [#19102](https://github.com/grafana/grafana/pull/19102), [@davkal](https://github.com/davkal)
* **Image rendering**: Add deprecation warning when PhantomJS is used for rendering images. [#18933](https://github.com/grafana/grafana/pull/18933), [@papagian](https://github.com/papagian)
* **InfluxDB**: Enable interpolation within ad-hoc filter values. [#18077](https://github.com/grafana/grafana/pull/18077), [@kvc-code](https://github.com/kvc-code)
* **LDAP**: Allow an user to be synchronized against LDAP. [#18976](https://github.com/grafana/grafana/pull/18976), [@gotjosh](https://github.com/gotjosh)
* **Ldap**: Add ldap debug page. [#18759](https://github.com/grafana/grafana/pull/18759), [@peterholmberg](https://github.com/peterholmberg)
* **Loki**: Remove prefetching of default label values. [#18213](https://github.com/grafana/grafana/pull/18213), [@davkal](https://github.com/davkal)
* **Metrics**: Add failed alert notifications metric. [#18089](https://github.com/grafana/grafana/pull/18089), [@koorgoo](https://github.com/koorgoo)
* **OAuth**: Support JMES path lookup when retrieving user email. [#14683](https://github.com/grafana/grafana/pull/14683), [@bobmshannon](https://github.com/bobmshannon)
* **OAuth**: return GitLab groups as a part of user info (enable team sync). [#18388](https://github.com/grafana/grafana/pull/18388), [@alexanderzobnin](https://github.com/alexanderzobnin)
* **Panels**: Add unit for electrical charge - ampere-hour. [#18950](https://github.com/grafana/grafana/pull/18950), [@anirudh-ramesh](https://github.com/anirudh-ramesh)
* **Plugin**: AzureMonitor - Reapply MetricNamespace support. [#17282](https://github.com/grafana/grafana/pull/17282), [@raphaelquati](https://github.com/raphaelquati)
* **Plugins**: better warning when plugins fail to load. [#18671](https://github.com/grafana/grafana/pull/18671), [@ryantxu](https://github.com/ryantxu)
* **Postgres**: Add support for scram sha 256 authentication. [#18397](https://github.com/grafana/grafana/pull/18397), [@nonamef](https://github.com/nonamef)
* **RemoteCache**: Support SSL with Redis. [#18511](https://github.com/grafana/grafana/pull/18511), [@kylebrandt](https://github.com/kylebrandt)
* **SingleStat**: The gauge option in now disabled/hidden (unless it's an old panel with it already enabled) . [#18610](https://github.com/grafana/grafana/pull/18610), [@ryantxu](https://github.com/ryantxu)
* **Stackdriver**: Add extra alignment period options. [#18909](https://github.com/grafana/grafana/pull/18909), [@sunker](https://github.com/sunker)
* **Units**: Add South African Rand (ZAR) to currencies. [#18893](https://github.com/grafana/grafana/pull/18893), [@jeteon](https://github.com/jeteon)
* **Units**: Adding T,P,E,Z,and Y bytes. [#18706](https://github.com/grafana/grafana/pull/18706), [@chiqomar](https://github.com/chiqomar)

### Bug Fixes
* **Alerting**: Notification is sent when state changes from no_data to ok. [#18920](https://github.com/grafana/grafana/pull/18920), [@papagian](https://github.com/papagian)
* **Alerting**: fix duplicate alert states when the alert fails to save to the database. [#18216](https://github.com/grafana/grafana/pull/18216), [@kylebrandt](https://github.com/kylebrandt)
* **Alerting**: fix response popover prompt when add notification channels. [#18967](https://github.com/grafana/grafana/pull/18967), [@lzdw](https://github.com/lzdw)
* **CloudWatch**: Fix alerting for queries with Id (using GetMetricData). [#17899](https://github.com/grafana/grafana/pull/17899), [@alex-berger](https://github.com/alex-berger)
* **Explore**: Fix auto completion on label values for Loki. [#18988](https://github.com/grafana/grafana/pull/18988), [@aocenas](https://github.com/aocenas)
* **Explore**: Fixes crash using back button with a zoomed in graph. [#19122](https://github.com/grafana/grafana/pull/19122), [@hugohaggmark](https://github.com/hugohaggmark)
* **Explore**: Fixes so queries in Explore are only run if Graph/Table is shown. [#19000](https://github.com/grafana/grafana/pull/19000), [@hugohaggmark](https://github.com/hugohaggmark)
* **MSSQL**: Change connectionstring to URL format to fix using passwords with semicolon. [#18384](https://github.com/grafana/grafana/pull/18384), [@Russiancold](https://github.com/Russiancold)
* **MSSQL**: Fix memory leak when debug enabled. [#19049](https://github.com/grafana/grafana/pull/19049), [@briangann](https://github.com/briangann)
* **Provisioning**: Allow escaping literal '$' with '$$' in configs to avoid interpolation. [#18045](https://github.com/grafana/grafana/pull/18045), [@kylebrandt](https://github.com/kylebrandt)
* **TimePicker**: Fixes hiding time picker dropdown in FireFox. [#19154](https://github.com/grafana/grafana/pull/19154), [@hugohaggmark](https://github.com/hugohaggmark)

## Breaking changes

### Annotations

There are some breaking changes in the annotations HTTP API for region annotations. Region annotations are now represented
using a single event instead of two seperate events. Check breaking changes in HTTP API [below](#http-api) and [HTTP API documentation](https://grafana.com/docs/http_api/annotations/) for more details.

### Docker

Grafana is now using Alpine 3.10 as docker base image.

### HTTP API
  - `GET /api/alert-notifications` now requires at least editor access. New `/api/alert-notifications/lookup` returns less information than `/api/alert-notifications` and can be access by any authenticated user.
  - `GET /api/alert-notifiers` now requires at least editor access
  - `GET /api/org/users` now requires org admin role. New `/api/org/users/lookup` returns less information than `/api/org/users` and can be access by users that are org admins, admin in any folder or admin of any team.
  - `GET /api/annotations` no longer returns `regionId` property.
  - `POST /api/annotations` no longer supports `isRegion` property.
  - `PUT /api/annotations/:id` no longer supports `isRegion` property.
  - `PATCH /api/annotations/:id` no longer supports `isRegion` property.
  - `DELETE /api/annotations/region/:id` has been removed.

## Deprecation notes

### PhantomJS

[PhantomJS](https://phantomjs.org/), which is used for rendering images of dashboards and panels, is deprecated and will be removed in a future Grafana release. A deprecation warning will from now on be logged when Grafana starts up if PhantomJS is in use.

Please consider migrating from PhantomJS to the [Grafana Image Renderer plugin](https://grafana.com/grafana/plugins/grafana-image-renderer).

# 6.3.7 (2019-11-22)

### Bug Fixes
* **CloudWatch**: Fix high CPU load [#20579](https://github.com/grafana/grafana/pull/20579)

# 6.3.6 (2019-09-23)

### Features / Enhancements
* **Metrics**: Adds setting for turning off total stats metrics. [#19142](https://github.com/grafana/grafana/pull/19142), [@marefr](https://github.com/marefr)

### Bug Fixes
* **Database**: Rewrite system statistics query to perform better. [#19178](https://github.com/grafana/grafana/pull/19178), [@papagian](https://github.com/papagian)
* **Explore**: Fixes error when switching from prometheus to loki data sources. [#18599](https://github.com/grafana/grafana/pull/18599), [@kaydelaney](https://github.com/kaydelaney)

# 6.3.5 (2019-09-02)

### Upgrades
* **Build**: Upgrade to go 1.12.9. [#18638](https://github.com/grafana/grafana/pull/18638), [@marcusolsson](https://github.com/marcusolsson)

### Bug Fixes
* **Dashboard**: Fixes dashboards init failed loading error for dashboards with panel links that had missing properties. [#18786](https://github.com/grafana/grafana/pull/18786), [@torkelo](https://github.com/torkelo)
* **Editor**: Fixes issue where only entire lines were being copied. [#18806](https://github.com/grafana/grafana/pull/18806), [@kaydelaney](https://github.com/kaydelaney)
* **Explore**: Fixes query field layout in splitted view for Safari browsers. [#18654](https://github.com/grafana/grafana/pull/18654), [@hugohaggmark](https://github.com/hugohaggmark)
* **LDAP**: multildap + ldap integration. [#18588](https://github.com/grafana/grafana/pull/18588), [@markelog](https://github.com/markelog)
* **Profile/UserAdmin**: Fix for user agent parser crashes grafana-server on 32-bit builds. [#18788](https://github.com/grafana/grafana/pull/18788), [@marcusolsson](https://github.com/marcusolsson)
* **Prometheus**: Prevents panel editor crash when switching to Prometheus data source. [#18616](https://github.com/grafana/grafana/pull/18616), [@hugohaggmark](https://github.com/hugohaggmark)
* **Prometheus**: Changes brace-insertion behavior to be less annoying. [#18698](https://github.com/grafana/grafana/pull/18698), [@kaydelaney](https://github.com/kaydelaney)

# 6.3.4 (2019-08-29)

* **Security**: Urgent security patch release. Please read more in our [blog](https://grafana.com/blog/2019/08/29/grafana-5.4.5-and-6.3.4-released-with-important-security-fix/)

# 6.3.3 (2019-08-15)

### Bug Fixes
* **Annotations**: Fix failing annotation query when time series query is cancelled. [#18532](https://github.com/grafana/grafana/pull/18532), [@dprokop](https://github.com/dprokop)
* **Auth**: Do not set SameSite cookie attribute if cookie_samesite is none. [#18462](https://github.com/grafana/grafana/pull/18462), [@papagian](https://github.com/papagian)
* **DataLinks**: Apply scoped variables to data links correctly. [#18454](https://github.com/grafana/grafana/pull/18454), [@dprokop](https://github.com/dprokop)
* **DataLinks**: Respect timezone when displaying datapoint's timestamp in graph context menu. [#18461](https://github.com/grafana/grafana/pull/18461), [@dprokop](https://github.com/dprokop)
* **DataLinks**: Use datapoint timestamp correctly when interpolating variables. [#18459](https://github.com/grafana/grafana/pull/18459), [@dprokop](https://github.com/dprokop)
* **Explore**: Fix loading error for empty queries. [#18488](https://github.com/grafana/grafana/pull/18488), [@davkal](https://github.com/davkal)
* **Graph**: Fixes legend issue clicking on series line icon and issue with horizontal scrollbar being visible on windows. [#18563](https://github.com/grafana/grafana/pull/18563), [@torkelo](https://github.com/torkelo)
* **Graphite**: Avoid glob of single-value array variables . [#18420](https://github.com/grafana/grafana/pull/18420), [@gotjosh](https://github.com/gotjosh)
* **Prometheus**: Fix queries with label_replace remove the $1 match when loading query editor. [#18480](https://github.com/grafana/grafana/pull/18480), [@hugohaggmark](https://github.com/hugohaggmark)
* **Prometheus**: More consistently allows for multi-line queries in editor. [#18362](https://github.com/grafana/grafana/pull/18362), [@kaydelaney](https://github.com/kaydelaney)
* **TimeSeries**: Assume values are all numbers. [#18540](https://github.com/grafana/grafana/pull/18540), [@ryantxu](https://github.com/ryantxu)

# 6.3.2 (2019-08-07)

### Bug Fixes
* **Gauge/BarGauge**: Fixes issue with lost thresholds and an issue loading Gauge with avg stat. [#18375](https://github.com/grafana/grafana/pull/18375)

# 6.3.1 (2019-08-07)

### Bug Fixes
* **PanelLinks**: Fixes crash issue with Gauge & Bar Gauge panels with panel links (drill down links). [#18430](https://github.com/grafana/grafana/pull/18430)

# 6.3.0 (2019-08-06)
### Features / Enhancements
* **OAuth**: Do not set SameSite OAuth cookie if cookie_samesite is None. [#18392](https://github.com/grafana/grafana/pull/18392), [@papagian](https://github.com/papagian)

### Bug Fixes
* **PanelLinks**: Fix render issue when there is no panel description. [#18408](https://github.com/grafana/grafana/pull/18408), [@dehrax](https://github.com/dehrax)

# 6.3.0-beta4 (2019-08-02)
### Features / Enhancements
* **Auth Proxy**: Include additional headers as part of the cache key. [#18298](https://github.com/grafana/grafana/pull/18298), [@gotjosh](https://github.com/gotjosh)

# 6.3.0-beta3 (2019-08-02)
### Bug Fixes
* **OAuth**: Fix "missing saved state" OAuth login failure due to SameSite cookie policy. [#18332](https://github.com/grafana/grafana/pull/18332), [@papagian](https://github.com/papagian)
* **cli**: fix for recognizing when in dev mode.. [#18334](https://github.com/grafana/grafana/pull/18334), [@xlson](https://github.com/xlson)

# 6.3.0-beta2 (2019-07-26)
### Features / Enhancements
* **Build grafana images consistently**. [#18224](https://github.com/grafana/grafana/pull/18224), [@hassanfarid](https://github.com/hassanfarid)
* **Docs**: SAML. [#18069](https://github.com/grafana/grafana/pull/18069), [@gotjosh](https://github.com/gotjosh)
* **Permissions**: Show plugins in nav for non admin users but hide plugin configuration. [#18234](https://github.com/grafana/grafana/pull/18234), [@aocenas](https://github.com/aocenas)
* **TimePicker**: Increase max height of quick range dropdown. [#18247](https://github.com/grafana/grafana/pull/18247), [@torkelo](https://github.com/torkelo)

### Bug Fixes
* **DataLinks**: Fixes incorrect interpolation of ${__series_name} . [#18251](https://github.com/grafana/grafana/pull/18251), [@torkelo](https://github.com/torkelo)
* **Loki**: Display live tailed logs in correct order in Explore. [#18031](https://github.com/grafana/grafana/pull/18031), [@kaydelaney](https://github.com/kaydelaney)
* **PhantomJS**: Fixes rendering on Debian Buster. [#18162](https://github.com/grafana/grafana/pull/18162), [@xlson](https://github.com/xlson)
* **TimePicker**: Fixed style issue for custom range popover. [#18244](https://github.com/grafana/grafana/pull/18244), [@torkelo](https://github.com/torkelo)
* **Timerange**: Fixes a bug where custom time ranges didn't respect UTC. [#18248](https://github.com/grafana/grafana/pull/18248), [@kaydelaney](https://github.com/kaydelaney)
* **remote_cache**: Fix redis connstr parsing. [#18204](https://github.com/grafana/grafana/pull/18204), [@mblaschke](https://github.com/mblaschke)


# 6.3.0-beta1 (2019-07-10)
### Features / Enhancements
* **Alerting**: Add tags to alert rules. [#10989](https://github.com/grafana/grafana/pull/10989), [@Thib17](https://github.com/Thib17)
* **Alerting**: Attempt to send email notifications to all given email addresses. [#16881](https://github.com/grafana/grafana/pull/16881), [@zhulongcheng](https://github.com/zhulongcheng)
* **Alerting**: Improve alert rule testing. [#16286](https://github.com/grafana/grafana/pull/16286), [@marefr](https://github.com/marefr)
* **Alerting**: Support for configuring content field for Discord alert notifier. [#17017](https://github.com/grafana/grafana/pull/17017), [@jan25](https://github.com/jan25)
* **Alertmanager**: Replace illegal chars with underscore in label names. [#17002](https://github.com/grafana/grafana/pull/17002), [@bergquist](https://github.com/bergquist)
* **Auth**: Allow expiration of API keys. [#17678](https://github.com/grafana/grafana/pull/17678), [@papagian](https://github.com/papagian)
* **Auth**: Return device, os and browser when listing user auth tokens in HTTP API. [#17504](https://github.com/grafana/grafana/pull/17504), [@shavonn](https://github.com/shavonn)
* **Auth**: Support list and revoke of user auth tokens in UI. [#17434](https://github.com/grafana/grafana/pull/17434), [@shavonn](https://github.com/shavonn)
* **AzureMonitor**: change clashing built-in Grafana variables/macro names for Azure Logs. [#17140](https://github.com/grafana/grafana/pull/17140), [@shavonn](https://github.com/shavonn)
* **CloudWatch**: Made region visible for AWS Cloudwatch Expressions. [#17243](https://github.com/grafana/grafana/pull/17243), [@utkarshcmu](https://github.com/utkarshcmu)
* **Cloudwatch**: Add AWS DocDB metrics. [#17241](https://github.com/grafana/grafana/pull/17241), [@utkarshcmu](https://github.com/utkarshcmu)
* **Dashboard**: Use timezone dashboard setting when exporting to CSV. [#18002](https://github.com/grafana/grafana/pull/18002), [@dehrax](https://github.com/dehrax)
* **Data links**. [#17267](https://github.com/grafana/grafana/pull/17267), [@torkelo](https://github.com/torkelo)
* **Docker**: Switch base image to ubuntu:latest from debian:stretch to avoid security issues.. [#17066](https://github.com/grafana/grafana/pull/17066), [@bergquist](https://github.com/bergquist)
* **Elasticsearch**: Support for visualizing logs in Explore . [#17605](https://github.com/grafana/grafana/pull/17605), [@marefr](https://github.com/marefr)
* **Explore**: Adds Live option for supported data sources. [#17062](https://github.com/grafana/grafana/pull/17062), [@hugohaggmark](https://github.com/hugohaggmark)
* **Explore**: Adds orgId to URL for sharing purposes. [#17895](https://github.com/grafana/grafana/pull/17895), [@kaydelaney](https://github.com/kaydelaney)
* **Explore**: Adds support for new loki 'start' and 'end' params for labels endpoint. [#17512](https://github.com/grafana/grafana/pull/17512), [@kaydelaney](https://github.com/kaydelaney)
* **Explore**: Adds support for toggling raw query mode in explore. [#17870](https://github.com/grafana/grafana/pull/17870), [@kaydelaney](https://github.com/kaydelaney)
* **Explore**: Allow switching between metrics and logs . [#16959](https://github.com/grafana/grafana/pull/16959), [@marefr](https://github.com/marefr)
* **Explore**: Combines the timestamp and local time columns into one. [#17775](https://github.com/grafana/grafana/pull/17775), [@hugohaggmark](https://github.com/hugohaggmark)
* **Explore**: Display log lines context . [#17097](https://github.com/grafana/grafana/pull/17097), [@dprokop](https://github.com/dprokop)
* **Explore**: Don't parse log levels if provided by field or label. [#17180](https://github.com/grafana/grafana/pull/17180), [@marefr](https://github.com/marefr)
* **Explore**: Improves performance of Logs element by limiting re-rendering. [#17685](https://github.com/grafana/grafana/pull/17685), [@kaydelaney](https://github.com/kaydelaney)
* **Explore**: Support for new LogQL filtering syntax. [#16674](https://github.com/grafana/grafana/pull/16674), [@davkal](https://github.com/davkal)
* **Explore**: Use new TimePicker from Grafana/UI. [#17793](https://github.com/grafana/grafana/pull/17793), [@hugohaggmark](https://github.com/hugohaggmark)
* **Explore**: handle newlines in LogRow Highlighter. [#17425](https://github.com/grafana/grafana/pull/17425), [@rrfeng](https://github.com/rrfeng)
* **Graph**: Added new fill gradient option. [#17528](https://github.com/grafana/grafana/pull/17528), [@torkelo](https://github.com/torkelo)
* **GraphPanel**: Don't sort series when legend table & sort column is not visible . [#17095](https://github.com/grafana/grafana/pull/17095), [@shavonn](https://github.com/shavonn)
* **InfluxDB**: Support for visualizing logs in Explore. [#17450](https://github.com/grafana/grafana/pull/17450), [@hugohaggmark](https://github.com/hugohaggmark)
* **Logging**: Login and Logout actions (#17760). [#17883](https://github.com/grafana/grafana/pull/17883), [@ATTron](https://github.com/ATTron)
* **Logging**: Move log package to pkg/infra. [#17023](https://github.com/grafana/grafana/pull/17023), [@zhulongcheng](https://github.com/zhulongcheng)
* **Metrics**: Expose stats about roles as metrics. [#17469](https://github.com/grafana/grafana/pull/17469), [@bergquist](https://github.com/bergquist)
* **MySQL/Postgres/MSSQL**: Add parsing for day, weeks and year intervals in macros. [#13086](https://github.com/grafana/grafana/pull/13086), [@bernardd](https://github.com/bernardd)
* **MySQL**: Add support for periodically reloading client certs. [#14892](https://github.com/grafana/grafana/pull/14892), [@tpetr](https://github.com/tpetr)
* **Plugins**: replace dataFormats list with skipDataQuery flag in plugin.json. [#16984](https://github.com/grafana/grafana/pull/16984), [@ryantxu](https://github.com/ryantxu)
* **Prometheus**: Take timezone into account for step alignment. [#17477](https://github.com/grafana/grafana/pull/17477), [@fxmiii](https://github.com/fxmiii)
* **Prometheus**: Use overridden panel range for $__range instead of dashboard range. [#17352](https://github.com/grafana/grafana/pull/17352), [@patrick246](https://github.com/patrick246)
* **Prometheus**: added time range filter to series labels query. [#16851](https://github.com/grafana/grafana/pull/16851), [@FUSAKLA](https://github.com/FUSAKLA)
* **Provisioning**: Support folder that doesn't exist yet in dashboard provisioning. [#17407](https://github.com/grafana/grafana/pull/17407), [@Nexucis](https://github.com/Nexucis)
* **Refresh picker**: Handle empty intervals. [#17585](https://github.com/grafana/grafana/pull/17585), [@dehrax](https://github.com/dehrax)
* **Singlestat**: Add y min/max config to singlestat sparklines. [#17527](https://github.com/grafana/grafana/pull/17527), [@pitr](https://github.com/pitr)
* **Snapshot**: use given key and deleteKey. [#16876](https://github.com/grafana/grafana/pull/16876), [@zhulongcheng](https://github.com/zhulongcheng)
* **Templating**: Correctly display __text in multi-value variable after page reload. [#17840](https://github.com/grafana/grafana/pull/17840), [@EduardSergeev](https://github.com/EduardSergeev)
* **Templating**: Support selecting all filtered values of a multi-value variable. [#16873](https://github.com/grafana/grafana/pull/16873), [@r66ad](https://github.com/r66ad)
* **Tracing**: allow propagation with Zipkin headers. [#17009](https://github.com/grafana/grafana/pull/17009), [@jrockway](https://github.com/jrockway)
* **Users**: Disable users removed from LDAP. [#16820](https://github.com/grafana/grafana/pull/16820), [@alexanderzobnin](https://github.com/alexanderzobnin)

### Bug Fixes
* **AddPanel**: Fix issue when removing moved add panel widget . [#17659](https://github.com/grafana/grafana/pull/17659), [@dehrax](https://github.com/dehrax)
* **CLI**: Fix encrypt-datasource-passwords fails with sql error. [#18014](https://github.com/grafana/grafana/pull/18014), [@marefr](https://github.com/marefr)
* **Elasticsearch**: Fix default max concurrent shard requests. [#17770](https://github.com/grafana/grafana/pull/17770), [@marefr](https://github.com/marefr)
* **Explore**: Fix browsing back to dashboard panel. [#17061](https://github.com/grafana/grafana/pull/17061), [@jschill](https://github.com/jschill)
* **Explore**: Fix filter by series level in logs graph. [#17798](https://github.com/grafana/grafana/pull/17798), [@marefr](https://github.com/marefr)
* **Explore**: Fix issues when loading and both graph/table are collapsed. [#17113](https://github.com/grafana/grafana/pull/17113), [@marefr](https://github.com/marefr)
* **Explore**: Fix selection/copy of log lines. [#17121](https://github.com/grafana/grafana/pull/17121), [@marefr](https://github.com/marefr)
* **Fix**: Wrap value of multi variable in array when coming from URL. [#16992](https://github.com/grafana/grafana/pull/16992), [@aocenas](https://github.com/aocenas)
* **Frontend**: Fix for Json tree component not working. [#17608](https://github.com/grafana/grafana/pull/17608), [@srid12](https://github.com/srid12)
* **Graphite**: Fix for issue with alias function being moved last. [#17791](https://github.com/grafana/grafana/pull/17791), [@torkelo](https://github.com/torkelo)
* **Graphite**: Fixes issue with seriesByTag & function with variable param. [#17795](https://github.com/grafana/grafana/pull/17795), [@torkelo](https://github.com/torkelo)
* **Graphite**: use POST for /metrics/find requests. [#17814](https://github.com/grafana/grafana/pull/17814), [@papagian](https://github.com/papagian)
* **HTTP Server**: Serve Grafana with a custom URL path prefix. [#17048](https://github.com/grafana/grafana/pull/17048), [@jan25](https://github.com/jan25)
* **InfluxDB**: Fixes single quotes are not escaped in label value filters. [#17398](https://github.com/grafana/grafana/pull/17398), [@Panzki](https://github.com/Panzki)
* **Prometheus**: Correctly escape '|' literals in interpolated PromQL variables. [#16932](https://github.com/grafana/grafana/pull/16932), [@Limess](https://github.com/Limess)
* **Prometheus**: Fix when adding label for metrics which contains colons in Explore. [#16760](https://github.com/grafana/grafana/pull/16760), [@tolwi](https://github.com/tolwi)
* **SinglestatPanel**: Remove background color when value turns null. [#17552](https://github.com/grafana/grafana/pull/17552), [@druggieri](https://github.com/druggieri)

# 6.2.5 (2019-06-25)

### Features / Enhancements
* **Grafana-CLI**: Wrapper for `grafana-cli` within RPM/DEB packages and config/homepath are now global flags. [#17695](https://github.com/grafana/grafana/pull/17695), [@gotjosh](https://github.com/gotjosh)
* **Panel**: Fully escape html in drilldown links (was only sanitized before) . [#17731](https://github.com/grafana/grafana/pull/17731), [@dehrax](https://github.com/dehrax)

### Bug Fixes
* **Config**: Fix connectionstring for remote_cache in defaults.ini. [#17675](https://github.com/grafana/grafana/pull/17675), [@kylebrandt](https://github.com/kylebrandt)
* **Elasticsearch**: Fix empty query (via template variable) should be sent as wildcard. [#17488](https://github.com/grafana/grafana/pull/17488), [@davewat](https://github.com/davewat)
* **HTTP-Server**: Fix Strict-Transport-Security header. [#17644](https://github.com/grafana/grafana/pull/17644), [@kylebrandt](https://github.com/kylebrandt)
* **TablePanel**: fix annotations display. [#17646](https://github.com/grafana/grafana/pull/17646), [@ryantxu](https://github.com/ryantxu)

# 6.2.4 (2019-06-18)

### Bug Fixes
* **Grafana-CLI**: Fix receiving flags via command line . [#17617](https://github.com/grafana/grafana/pull/17617), [@gotjosh](https://github.com/gotjosh)
* **HTTPServer**: Fix X-XSS-Protection header formatting. [#17620](https://github.com/grafana/grafana/pull/17620), [@yverry](https://github.com/yverry)

# 6.2.3 (2019-06-17)

### Known issues
* **grafana-cli**: The argument `--pluginsDir` is not working.
* **docker**: Due to above problem with grafana-cli the docker run will fail to start the container if you're installing plugins using the `GF_INSTALL_PLUGINS` environment variable. We have removed 6.2.3 tag from docker hub and latest tag now points to 6.2.2.

More details in bug report: https://github.com/grafana/grafana/issues/17613

### Features / Enhancements
* **AuthProxy**: Optimistic lock pattern for remote cache Set. [#17485](https://github.com/grafana/grafana/pull/17485), [@papagian](https://github.com/papagian)
* **HTTPServer**: Options for returning new headers X-Content-Type-Options,  X-XSS-Protection and Strict-Transport-Security. [#17522](https://github.com/grafana/grafana/pull/17522), [@kylebrandt](https://github.com/kylebrandt)

### Bug Fixes
* **Auth Proxy**: Fix non-negative cache TTL. [#17495](https://github.com/grafana/grafana/pull/17495), [@kylebrandt](https://github.com/kylebrandt)
* **Grafana-CLI**: Fix receiving configuration flags from the command line. [#17606](https://github.com/grafana/grafana/pull/17606), [@gotjosh](https://github.com/gotjosh)
* **OAuth**: Fix for wrong user token updated on OAuth refresh in DS proxy. [#17541](https://github.com/grafana/grafana/pull/17541), [@redbaron](https://github.com/redbaron)
* **remote_cache**: Fix redis. [#17483](https://github.com/grafana/grafana/pull/17483), [@kylebrandt](https://github.com/kylebrandt)

# 6.2.2 (2019-06-05)

### Features / Enhancements
  * **Security**: Prevent CSV formula injection attack when exporting data. [#17363](https://github.com/grafana/grafana/pull/17363), [@DanCech](https://github.com/DanCech)

### Bug Fixes
  * **CloudWatch**: Fixes error when hiding/disabling queries . [#17283](https://github.com/grafana/grafana/pull/17283), [@jpiccari](https://github.com/jpiccari)
  * **Database**: Fixed slow permission query in folder/dashboard search. [#17427](https://github.com/grafana/grafana/pull/17427), [@aocenas](https://github.com/aocenas)
  * **Explore**: Fixed updating time range before running queries. [#17349](https://github.com/grafana/grafana/pull/17349), [@marefr](https://github.com/marefr)
  * **Plugins**: Fixed plugin config page navigation when using subpath. [#17364](https://github.com/grafana/grafana/pull/17364), [@torkelo](https://github.com/torkelo)

# 6.2.1 (2019-05-27)

### Features / Enhancements
  * **CLI**: Add command to migrate all data sources to use encrypted password fields . [#17118](https://github.com/grafana/grafana/pull/17118), [@aocenas](https://github.com/aocenas)
  * **Gauge/BarGauge**: Improvements to auto value font size . [#17292](https://github.com/grafana/grafana/pull/17292), [@torkelo](https://github.com/torkelo)

### Bug Fixes
  * **Auth Proxy**: Resolve database is locked errors. [#17274](https://github.com/grafana/grafana/pull/17274), [@marefr](https://github.com/marefr)
  * **Database**: Retry transaction if sqlite returns database is locked error. [#17276](https://github.com/grafana/grafana/pull/17276), [@marefr](https://github.com/marefr)
  * **Explore**: Fixes so clicking in a Prometheus Table the query is filtered by clicked value. [#17083](https://github.com/grafana/grafana/pull/17083), [@hugohaggmark](https://github.com/hugohaggmark)
  * **Singlestat**: Fixes issue with value placement and line wraps. [#17249](https://github.com/grafana/grafana/pull/17249), [@torkelo](https://github.com/torkelo)
  * **Tech**: Update jQuery to 3.4.1 to fix issue on iOS 10 based browers as well as Chrome 53.x . [#17290](https://github.com/grafana/grafana/pull/17290), [@timbutler](https://github.com/timbutler)

# 6.2.0 (2019-05-22)

### Bug Fixes
* **BarGauge**: Fix for negative min values. [#17192](https://github.com/grafana/grafana/pull/17192), [@torkelo](https://github.com/torkelo)
* **Gauge/BarGauge**: Fix for issues editing min & max options. [#17174](https://github.com/grafana/grafana/pull/17174)
* **Search**: Make only folder name only open search with current folder filter. [#17226](https://github.com/grafana/grafana/pull/17226)
* **AzureMonitor**: Revert to clearing chained dropdowns. [#17212](https://github.com/grafana/grafana/pull/17212)

### Breaking Changes
* **Plugins**: Data source plugins that process hidden queries need to add a "hiddenQueries: true" attribute in plugin.json. [#17124](https://github.com/grafana/grafana/pull/17124), [@ryantxu](https://github.com/ryantxu)

### Removal of old deprecated package repository

5 months ago we deprecated our old package cloud repository and [replaced it](https://grafana.com/blog/2019/01/05/moving-to-packages.grafana.com/) with our own. We will remove the old depreciated
repo on July 1st. Make sure you have switched to the new repo by then. The new repository has all our old releases so you are not required to upgrade just to switch package repository.

# 6.2.0-beta2 (2019-05-15)

### Features / Enhancements
  * **Plugins**: Support templated urls in plugin routes. [#16599](https://github.com/grafana/grafana/pull/16599), [@briangann](https://github.com/briangann)
  * **Packaging**: New MSI windows installer package**. [#17073](https://github.com/grafana/grafana/pull/17073), [@briangann](https://github.com/briangann)

  ### Bug Fixes
  * **Dashboard**: Fixes blank dashboard after window resize with panel without title. [#16942](https://github.com/grafana/grafana/pull/16942), [@torkelo](https://github.com/torkelo)
  * **Dashboard**: Fixes lazy loading & expanding collapsed rows on mobile. [#17055](https://github.com/grafana/grafana/pull/17055), [@torkelo](https://github.com/torkelo)
  * **Dashboard**: Fixes scrolling issues for Edge browser. [#17033](https://github.com/grafana/grafana/pull/17033), [@jschill](https://github.com/jschill)
  * **Dashboard**: Show refresh button in first kiosk(tv) mode. [#17032](https://github.com/grafana/grafana/pull/17032), [@torkelo](https://github.com/torkelo)
  * **Explore**: Fix empty result from data source should render logs container. [#16999](https://github.com/grafana/grafana/pull/16999), [@marefr](https://github.com/marefr)
  * **Explore**: Fixes so clicking in a Prometheus Table the query is filtered by clicked value. [#17083](https://github.com/grafana/grafana/pull/17083), [@hugohaggmark](https://github.com/hugohaggmark)
  * **Explore**: Makes it possible to zoom in Explore/Loki/Graph without exception. [#16991](https://github.com/grafana/grafana/pull/16991), [@hugohaggmark](https://github.com/hugohaggmark)
  * **Gauge**: Fixes orientation issue after switching from BarGauge to Gauge. [#17064](https://github.com/grafana/grafana/pull/17064), [@torkelo](https://github.com/torkelo)
  * **GettingStarted**: Fixes layout issues in getting started panel. [#16941](https://github.com/grafana/grafana/pull/16941), [@torkelo](https://github.com/torkelo)
  * **InfluxDB**: Fix HTTP method should default to GET. [#16949](https://github.com/grafana/grafana/pull/16949), [@StephenSorriaux](https://github.com/StephenSorriaux)
  * **Panels**: Fixed alert icon position in panel header. [#17070](https://github.com/grafana/grafana/pull/17070), [@torkelo](https://github.com/torkelo)
  * **Panels**: Fixes panel error tooltip not showing. [#16993](https://github.com/grafana/grafana/pull/16993), [@torkelo](https://github.com/torkelo)
  * **Plugins**: Fix how datemath utils are exposed to plugins. [#16976](https://github.com/grafana/grafana/pull/16976), [@marefr](https://github.com/marefr)
  * **Singlestat**: fixed centering issue for very small panels. [#16944](https://github.com/grafana/grafana/pull/16944), [@torkelo](https://github.com/torkelo)
  * **Search**: Scroll issue in dashboard search in latest Chrome. [#17054](https://github.com/grafana/grafana/pull/17054), [@jschill](https://github.com/jschill)
  * **Docker**: Prevent a permission denied error when writing files to the default provisioning directory. [#16831](https://github.com/grafana/grafana/pull/16831), [@wmedlar](https://github.com/wmedlar)
  * **Gauge**: Adds background shade to gauge track and improves height usage. [#17019](https://github.com/grafana/grafana/pull/17019), [@torkelo](https://github.com/torkelo)
  * **RemoteCache**: Avoid race condition in Set causing error on insert. . [#17082](https://github.com/grafana/grafana/pull/17082), [@bergquist](https://github.com/bergquist)

# 6.2.0-beta1 (2019-05-07)

### Features / Enhancements
  * **Admin**: Add more stats about roles. [#16667](https://github.com/grafana/grafana/pull/16667), [@bergquist](https://github.com/bergquist)
  * **Alert list panel**: Support variables in filters. [#16892](https://github.com/grafana/grafana/pull/16892), [@psschand](https://github.com/psschand)
  * **Alerting**: Adjust label for send on all alerts to default . [#16554](https://github.com/grafana/grafana/pull/16554), [@simPod](https://github.com/simPod)
  * **Alerting**: Makes timeouts and retries configurable. [#16259](https://github.com/grafana/grafana/pull/16259), [@kobehaha](https://github.com/kobehaha)
  * **Alerting**: No notification when going from no data to pending. [#16905](https://github.com/grafana/grafana/pull/16905), [@bergquist](https://github.com/bergquist)
  * **Alerting**: Pushover alert, support for different sound for OK. [#16525](https://github.com/grafana/grafana/pull/16525), [@Hofls](https://github.com/Hofls)
  * **Auth**: Enable retries and transaction for some db calls for auth tokens . [#16785](https://github.com/grafana/grafana/pull/16785), [@bergquist](https://github.com/bergquist)
  * **AzureMonitor**: Adds support for multiple subscriptions per data source. [#16922](https://github.com/grafana/grafana/pull/16922), [@daniellee](https://github.com/daniellee)
  * **Bar Gauge**: New multi series enabled gauge like panel with horizontal and vertical layouts and 3 display modes. [#16918](https://github.com/grafana/grafana/pull/16918), [@torkelo](https://github.com/torkelo)
  * **Build**: Upgrades to golang 1.12.4. [#16545](https://github.com/grafana/grafana/pull/16545), [@bergquist](https://github.com/bergquist)
  * **CloudWatch**: Update AWS/IoT metric and dimensions. [#16337](https://github.com/grafana/grafana/pull/16337), [@nonamef](https://github.com/nonamef)
  * **Config**: Show user-friendly error message instead of stack trace. [#16564](https://github.com/grafana/grafana/pull/16564), [@Hofls](https://github.com/Hofls)
  * **Dashboard**: Enable filtering dashboards in search by current folder. [#16790](https://github.com/grafana/grafana/pull/16790), [@dprokop](https://github.com/dprokop)
  * **Dashboard**: Lazy load out of view panels . [#15554](https://github.com/grafana/grafana/pull/15554), [@ryantxu](https://github.com/ryantxu)
  * **DataProxy**: Restore Set-Cookie header after proxy request. [#16838](https://github.com/grafana/grafana/pull/16838), [@marefr](https://github.com/marefr)
  * **Data Sources**: Add pattern validation for time input on data source config pages. [#16837](https://github.com/grafana/grafana/pull/16837), [@aocenas](https://github.com/aocenas)
  * **Elasticsearch**: Add 7.x version support. [#16646](https://github.com/grafana/grafana/pull/16646), [@alcidesv](https://github.com/alcidesv)
  * **Explore**: Adds reconnect for failing data source. [#16226](https://github.com/grafana/grafana/pull/16226), [@hugohaggmark](https://github.com/hugohaggmark)
  * **Explore**: Support user timezone. [#16469](https://github.com/grafana/grafana/pull/16469), [@marefr](https://github.com/marefr)
  * **InfluxDB**: Add support for POST HTTP verb. [#16690](https://github.com/grafana/grafana/pull/16690), [@StephenSorriaux](https://github.com/StephenSorriaux)
  * **Loki**: Search is now case insensitive. [#15948](https://github.com/grafana/grafana/pull/15948), [@steven-sheehy](https://github.com/steven-sheehy)
  * **OAuth**: Update jwt regexp to include `=`. [#16521](https://github.com/grafana/grafana/pull/16521), [@DanCech](https://github.com/DanCech)
  * **Panels**: No title will no longer make panel header take up space. [#16884](https://github.com/grafana/grafana/pull/16884), [@torkelo](https://github.com/torkelo)
  * **Prometheus**: Adds tracing headers for Prometheus datas ource. [#16724](https://github.com/grafana/grafana/pull/16724), [@svagner](https://github.com/svagner)
  * **Provisioning**: Add API endpoint to reload provisioning configs. [#16579](https://github.com/grafana/grafana/pull/16579), [@aocenas](https://github.com/aocenas)
  * **Provisioning**: Do not allow deletion of provisioned dashboards. [#16211](https://github.com/grafana/grafana/pull/16211), [@aocenas](https://github.com/aocenas)
  * **Provisioning**: Interpolate env vars in provisioning files. [#16499](https://github.com/grafana/grafana/pull/16499), [@aocenas](https://github.com/aocenas)
  * **Provisioning**: Support FolderUid in Dashboard Provisioning Config. [#16559](https://github.com/grafana/grafana/pull/16559), [@swtch1](https://github.com/swtch1)
  * **Security**: Add new setting allow_embedding. [#16853](https://github.com/grafana/grafana/pull/16853), [@marefr](https://github.com/marefr)
  * **Security**: Store data source passwords encrypted in secureJsonData. [#16175](https://github.com/grafana/grafana/pull/16175), [@aocenas](https://github.com/aocenas)
  * **UX**: Improve Grafana usage for smaller screens. [#16783](https://github.com/grafana/grafana/pull/16783), [@torkelo](https://github.com/torkelo)
  * **Units**: Add angle units, Arc Minutes and Seconds. [#16271](https://github.com/grafana/grafana/pull/16271), [@Dripoul](https://github.com/Dripoul)

### Bug Fixes
  * **Build**: Fix bug where grafana didn't start after mysql on rpm packages. [#16917](https://github.com/grafana/grafana/pull/16917), [@bergquist](https://github.com/bergquist)
  * **CloudWatch**: Fixes query order not affecting series ordering & color. [#16408](https://github.com/grafana/grafana/pull/16408), [@mtanda](https://github.com/mtanda)
  * **CloudWatch**: Use default alias if there is no alias for metrics. [#16732](https://github.com/grafana/grafana/pull/16732), [@utkarshcmu](https://github.com/utkarshcmu)
  * **Config**: Fixes bug where timeouts for alerting was not parsed correctly. [#16784](https://github.com/grafana/grafana/pull/16784), [@aocenas](https://github.com/aocenas)
  * **Elasticsearch**: Fix view percentiles metric in table without date histogram. [#15686](https://github.com/grafana/grafana/pull/15686), [@Igor-Ratsuk](https://github.com/Igor-Ratsuk)
  * **Explore**: Prevents histogram loading from killing Prometheus instance. [#16768](https://github.com/grafana/grafana/pull/16768), [@hugohaggmark](https://github.com/hugohaggmark)
  * **Graph**: Allow override decimals to fully override. [#16414](https://github.com/grafana/grafana/pull/16414), [@torkelo](https://github.com/torkelo)
  * **Mixed Data Source**: Fix error when one query is disabled. [#16409](https://github.com/grafana/grafana/pull/16409), [@marefr](https://github.com/marefr)
  * **Search**: Fixes search limits and adds a page parameter. [#16458](https://github.com/grafana/grafana/pull/16458), [@torkelo](https://github.com/torkelo)
  * **Security**: Responses from backend should not be cached. [#16848](https://github.com/grafana/grafana/pull/16848), [@marefr](https://github.com/marefr)

### Breaking changes

* **Gauge Panel**: The suffix / prefix options have been removed from the new Gauge Panel (introduced in v6.0). [#16870](https://github.com/grafana/grafana/issues/16870).


# 6.1.6 (2019-04-29)
### Features / Enhancements
* **Security**: Bump jQuery to 3.4.0 . [#16761](https://github.com/grafana/grafana/pull/16761), [@dprokop](https://github.com/dprokop)

### Bug Fixes
* **Playlist**: Fix loading dashboards by tag. [#16727](https://github.com/grafana/grafana/pull/16727), [@marefr](https://github.com/marefr)

# 6.1.5 (2019-04-29)

* **Security**: Urgent security patch release. Please read more in our [blog](https://grafana.com/blog/2019/04/29/grafana-5.4.4-and-6.1.6-released-with-important-security-fix/)

# 6.1.4 (2019-04-16)

### Bug Fixes
  * **DataPanel**: Added missing built-in interval variables to scopedVars. [#16556](https://github.com/grafana/grafana/pull/16556), [@torkelo](https://github.com/torkelo)
  * **Explore**: Adds maxDataPoints to data source query options . [#16513](https://github.com/grafana/grafana/pull/16513), [@hugohaggmark](https://github.com/hugohaggmark)
  * **Explore**: Fixes so intervals are recalculated on run query. [#16510](https://github.com/grafana/grafana/pull/16510), [@hugohaggmark](https://github.com/hugohaggmark)
  * **Heatmap**: Fix for empty graph when panel is too narrow (#16378). [#16460](https://github.com/grafana/grafana/pull/16460), [@alexanderzobnin](https://github.com/alexanderzobnin)
  * **Heatmap**: Fixed auto decimals when bucket name is not number. [#16609](https://github.com/grafana/grafana/pull/16609), [@torkelo](https://github.com/torkelo)
  * **QueryInspector**: Now shows error responses again. [#16514](https://github.com/grafana/grafana/pull/16514), [@torkelo](https://github.com/torkelo)

# 6.1.3 (2019-04-09)

### Bug Fixes
  * **Graph**: Fixed auto decimals in legend values for some units like `ms` and `s`. [#16455](https://github.com/grafana/grafana/pull/16455), [@torkelo](https://github.com/torkelo)
  * **Graph**: Fixed png rendering with legend to the right. [#16463](https://github.com/grafana/grafana/pull/16463), [@torkelo](https://github.com/torkelo)
  * **Singlestat**: Use decimals when manually specified. [#16451](https://github.com/grafana/grafana/pull/16451), [@torkelo](https://github.com/torkelo)
  * **UI Switch**: Fix broken UI switches. Fixes Default Data Source switch, Explore Logs switches, Gauge option switches. [#16303](https://github.com/grafana/grafana/pull/16303), [@dprokop](https://github.com/dprokop)

# 6.1.2 (2019-04-08)

 ### Bug Fixes
  * **Graph**: Fixed series legend color for hidden series. [#16438](https://github.com/grafana/grafana/pull/16438), [@Ijin08](https://github.com/Ijin08)
  * **Graph**: Fixed tooltip highlight on white theme. [#16429](https://github.com/grafana/grafana/pull/16429), [@torkelo](https://github.com/torkelo)
  * **Styles**: Fixed menu hover highlight border. [#16431](https://github.com/grafana/grafana/pull/16431), [@torkelo](https://github.com/torkelo)
  * **Singlestat Panel**: Correctly use the override decimals. [#16413](https://github.com/grafana/grafana/pull/16413), [@torkelo](https://github.com/torkelo)

# 6.1.1 (2019-04-05)

 ### Bug Fixes
  * **Alerting**: Notification channel http api fixes. [#16379](https://github.com/grafana/grafana/pull/16379), [@marefr](https://github.com/marefr)
  * **Graphite**: Editing graphite query function now works again. [#16390](https://github.com/grafana/grafana/pull/16390), [@torkelo](https://github.com/torkelo)
  * **Playlist**: Kiosk & auto fit panels modes are working normally again . [#16403](https://github.com/grafana/grafana/pull/16403), [@torkelo](https://github.com/torkelo)
  * **QueryEditors**: Toggle edit mode now always work on slower computers. [#16394](https://github.com/grafana/grafana/pull/16394), [@seanlaff](https://github.com/seanlaff)

# 6.1.0 (2019-04-03)

### Bug Fixes
* **CloudWatch**: Fix for dimension value list when changing dimension key. [#16356](https://github.com/grafana/grafana/pull/16356), [@mtanda](https://github.com/mtanda)
* **Graphite**: Editing function arguments now works again. [#16297](https://github.com/grafana/grafana/pull/16297), [@torkelo](https://github.com/torkelo)
* **InfluxDB**: Fix tag names with periods in alert evaluation. [#16255](https://github.com/grafana/grafana/pull/16255), [@floyd-may](https://github.com/floyd-may)
* **PngRendering**: Fix for panel height & title centering . [#16351](https://github.com/grafana/grafana/pull/16351), [@torkelo](https://github.com/torkelo)
* **Templating**: Fix for editing query variables. [#16299](https://github.com/grafana/grafana/pull/16299), [@torkelo](https://github.com/torkelo)

# 6.1.0-beta1 (2019-03-27)

### New Features
* **Prometheus**: adhoc filter support [#8253](https://github.com/grafana/grafana/issues/8253), thx [@mtanda](https://github.com/mtanda)
* **Permissions**: Editors can become admin for dashboards, folders and teams they create. [#15977](https://github.com/grafana/grafana/pull/15977), [@xlson](https://github.com/xlson)

### Minor

* **Auth**: Support listing and revoking auth tokens via API [#15836](https://github.com/grafana/grafana/issues/15836)
* **Alerting**: DingDing notification channel now includes alert values. [#13825](https://github.com/grafana/grafana/pull/13825), [@athurg](https://github.com/athurg)
* **Alerting**: Notification channel http api enhancements. [#16219](https://github.com/grafana/grafana/pull/16219), [@marefr](https://github.com/marefr)
* **CloudWatch**: Update metrics/dimensions list. [#16137](https://github.com/grafana/grafana/pull/16137), [@mtanda](https://github.com/mtanda)
* **Cloudwatch**: Add AWS RDS MaximumUsedTransactionIDs metric [#15077](https://github.com/grafana/grafana/pull/15077), thx [@activeshadow](https://github.com/activeshadow)
* **Cache**: Adds support for using out of proc caching in the backend [#10816](https://github.com/grafana/grafana/issues/10816)
* **Dashboard**: New keyboard shortcut `d l` toggles all Graph legends in a dashboard. [#15770](https://github.com/grafana/grafana/pull/15770), [@jsferrei](https://github.com/jsferrei)
* **Data Source**: Only log connection string in dev environment [#16001](https://github.com/grafana/grafana/issues/16001)
* **DataProxy**: Add custom header (X-Grafana-User) to data source requests with the current username. [#15998](https://github.com/grafana/grafana/pull/15998), [@aocenas](https://github.com/aocenas)
* **DataProxy**: Make it possible to add user details to requests sent to the dataproxy [#6359](https://github.com/grafana/grafana/issues/6359) and [#15931](https://github.com/grafana/grafana/issues/15931)
* **DataProxy**: Adds oauth pass-through option for data sources. [#15205](https://github.com/grafana/grafana/pull/15205), [@seanlaff](https://github.com/seanlaff)
* **Explore**: Hide empty duplicates column in logs viewer. [#15982](https://github.com/grafana/grafana/pull/15982), [@steven-sheehy](https://github.com/steven-sheehy)
* **Explore**: Make it possible to close left pane of split view. [#16155](https://github.com/grafana/grafana/pull/16155), [@dprokop](https://github.com/dprokop)
* **Explore**: Move back / forward with browser buttons now works. [#16150](https://github.com/grafana/grafana/pull/16150), [@hugohaggmark](https://github.com/hugohaggmark)
* **Explore**: Update Loki labels when label selector is opened. [#16131](https://github.com/grafana/grafana/pull/16131), [@dprokop](https://github.com/dprokop)
* **Graph Panel**: New options for X-axis Min & Max (for histograms). [#14877](https://github.com/grafana/grafana/pull/14877), [@papagian](https://github.com/papagian)
* **Heatmap**: You can now choose to hide buckets with zero value. [#15934](https://github.com/grafana/grafana/pull/15934), [@alexanderzobnin](https://github.com/alexanderzobnin)
* **Heatmap**: `Middle` bucket bound option [#15683](https://github.com/grafana/grafana/issues/15683)
* **Heatmap**: `Reverse order` option for changing order of buckets [#15683](https://github.com/grafana/grafana/issues/15683)
* **Prometheus**: Change alignment of range queries to end before now and not in future. [#16110](https://github.com/grafana/grafana/pull/16110), [@davkal](https://github.com/davkal)
* **Prometheus**: Dedup annotations events with same timestamp . [#16152](https://github.com/grafana/grafana/pull/16152), [@torkelo](https://github.com/torkelo)
* **SQL**: Use default min interval of 1m for all SQL data sources. [#15799](https://github.com/grafana/grafana/pull/15799), [@marefr](https://github.com/marefr)
* **TablePanel**: Column color style now works even after removing columns. [#16227](https://github.com/grafana/grafana/pull/16227), [@torkelo](https://github.com/torkelo)
* **Templating**: Custom variable value now escapes all backslashes properly. [#15980](https://github.com/grafana/grafana/pull/15980), [@srid12](https://github.com/srid12)
* **Templating**: Data source variable now supports multi-value for uses cases that involve repeating panels & rows. [#15914](https://github.com/grafana/grafana/pull/15914), [@torkelo](https://github.com/torkelo)
* **VictorOps**:  Adds more information to the victor ops notifiers [#15744](https://github.com/grafana/grafana/issues/15744), thx [@zhulongcheng](https://github.com/zhulongcheng)

### Bug Fixes
* **Alerting**: Don't include non-existing image in MS Teams notifications. [#16116](https://github.com/grafana/grafana/pull/16116), [@SGI495](https://github.com/SGI495)
* **Api**: Invalid org invite code [#10506](https://github.com/grafana/grafana/issues/10506)
* **Annotations**: Fix for native annotations filtered by template variable with pipe. [#15515](https://github.com/grafana/grafana/pull/15515), [@marefr](https://github.com/marefr)
* **Dashboard**: Fix for time regions spanning across midnight. [#16201](https://github.com/grafana/grafana/pull/16201), [@marefr](https://github.com/marefr)
* **Data Source**: Handles nil jsondata field gracefully [#14239](https://github.com/grafana/grafana/issues/14239)
* **Data Source**: Empty user/password was not updated when updating data sources [#15608](https://github.com/grafana/grafana/pull/15608), thx [@Maddin-619](https://github.com/Maddin-619)
* **Elasticsearch**:  Fixes using template variables in the alias field. [#16229](https://github.com/grafana/grafana/pull/16229), [@daniellee](https://github.com/daniellee)
* **Elasticsearch**: Fix incorrect index pattern padding in alerting queries. [#15892](https://github.com/grafana/grafana/pull/15892), [@sandlis](https://github.com/sandlis)
* **Explore**: Fix for Prometheus autocomplete not working in Firefox. [#16192](https://github.com/grafana/grafana/pull/16192), [@hugohaggmark](https://github.com/hugohaggmark)
* **Explore**: Fix for url does not keep query after browser refresh. [#16189](https://github.com/grafana/grafana/pull/16189), [@hugohaggmark](https://github.com/hugohaggmark)
* **Gauge**: Interpolate scoped variables in repeated gauges [#15739](https://github.com/grafana/grafana/issues/15739)
* **Graphite**: Fixed issue with using series ref and series by tag. [#16111](https://github.com/grafana/grafana/pull/16111), [@torkelo](https://github.com/torkelo)
* **Graphite**: Fixed variable quoting when variable value is nummeric. [#16149](https://github.com/grafana/grafana/pull/16149), [@torkelo](https://github.com/torkelo)
* **Heatmap**: Fixes Y-axis tick labels being in wrong order for some Prometheus queries. [#15932](https://github.com/grafana/grafana/pull/15932), [@alexanderzobnin](https://github.com/alexanderzobnin)
* **Heatmap**: Negative values are now displayed correctly in graph & legend. [#15953](https://github.com/grafana/grafana/pull/15953), [@alexanderzobnin](https://github.com/alexanderzobnin)
* **Heatmap**: legend shows wrong colors for small values [#14019](https://github.com/grafana/grafana/issues/14019)
* **InfluxDB**: Always close request body even for error status codes. [#16207](https://github.com/grafana/grafana/pull/16207), [@ramongtx](https://github.com/ramongtx)
* **ManageDashboards**: Fix for checkboxes not appearing properly Firefox . [#15981](https://github.com/grafana/grafana/pull/15981), [@srid12](https://github.com/srid12)
* **Playlist**:  Leaving playlist now always stops playlist . [#15791](https://github.com/grafana/grafana/pull/15791), [@peterholmberg](https://github.com/peterholmberg)
* **Prometheus**: fixes regex ad-hoc filters variables with wildcards. [#16234](https://github.com/grafana/grafana/pull/16234), [@daniellee](https://github.com/daniellee)
* **TablePanel**: Column color style now works even after removing columns. [#16227](https://github.com/grafana/grafana/pull/16227), [@torkelo](https://github.com/torkelo)
* **TablePanel**: Fix for white text on white background when value is null. [#16199](https://github.com/grafana/grafana/pull/16199), [@peterholmberg](https://github.com/peterholmberg)

# 6.0.2 (2019-03-19)

### Bug Fixes
* **Alerting**: Fixed issue with AlertList panel links resulting in panel not found errors. [#15975](https://github.com/grafana/grafana/pull/15975), [@torkelo](https://github.com/torkelo)
* **Dashboard**: Improved error handling when rendering dashboard panels. [#15970](https://github.com/grafana/grafana/pull/15970), [@torkelo](https://github.com/torkelo)
* **LDAP**: Fix allow anonymous server bind for ldap search. [#15872](https://github.com/grafana/grafana/pull/15872), [@marefr](https://github.com/marefr)
* **Discord**: Fix discord notifier so it doesn't crash when there are no image generated. [#15833](https://github.com/grafana/grafana/pull/15833), [@marefr](https://github.com/marefr)
* **Panel Edit**: Prevent search in VizPicker from stealing focus. [#15802](https://github.com/grafana/grafana/pull/15802), [@peterholmberg](https://github.com/peterholmberg)
* **Data Source admin**: Fixed url of back button in data source edit page, when root_url configured. [#15759](https://github.com/grafana/grafana/pull/15759), [@dprokop](https://github.com/dprokop)

# 6.0.1 (2019-03-06)

### Bug Fixes
* **Metrics**: Fixes broken usagestats metrics for /metrics [#15651](https://github.com/grafana/grafana/issues/15651)
* **Dashboard**: Fixes kiosk mode should have &kiosk appended to the url [#15765](https://github.com/grafana/grafana/issues/15765)
* **Dashboard**: Fixes kiosk=tv mode with autofitpanels should respect header [#15650](https://github.com/grafana/grafana/issues/15650)
* **Image rendering**: Fixed image rendering issue for dashboards with auto refresh, . [#15818](https://github.com/grafana/grafana/pull/15818), [@torkelo](https://github.com/torkelo)
* **Dashboard**: Fix only users that can edit a dashboard should be able to update panel json. [#15805](https://github.com/grafana/grafana/pull/15805), [@marefr](https://github.com/marefr)
* **LDAP**: fix allow anonymous initial bind for ldap search. [#15803](https://github.com/grafana/grafana/pull/15803), [@marefr](https://github.com/marefr)
* **UX**: Fixed scrollbar not visible initially (only after manual scroll). [#15798](https://github.com/grafana/grafana/pull/15798), [@torkelo](https://github.com/torkelo)
* **Data Source admin** TestData   [#15793](https://github.com/grafana/grafana/pull/15793), [@hugohaggmark](https://github.com/hugohaggmark)
* **Dashboard**: Fixed scrolling issue that caused scroll to be locked to bottom. [#15792](https://github.com/grafana/grafana/pull/15792), [@torkelo](https://github.com/torkelo)
* **Explore**: Viewers with viewers_can_edit should be able to access /explore. [#15787](https://github.com/grafana/grafana/pull/15787), [@jschill](https://github.com/jschill)
* **Security** fix: limit access to org admin and alerting pages. [#15761](https://github.com/grafana/grafana/pull/15761), [@marefr](https://github.com/marefr)
* **Panel Edit** minInterval changes did not persist [#15757](https://github.com/grafana/grafana/pull/15757), [@hugohaggmark](https://github.com/hugohaggmark)
* **Teams**: Fixed bug when getting teams for user. [#15595](https://github.com/grafana/grafana/pull/15595), [@hugohaggmark](https://github.com/hugohaggmark)
* **Stackdriver**: fix for float64 bounds for distribution metrics [#14509](https://github.com/grafana/grafana/issues/14509)
* **Stackdriver**: no reducers available for distribution type [#15179](https://github.com/grafana/grafana/issues/15179)

# 6.0.0 stable (2019-02-25)

### Bug Fixes
* **Dashboard**: fixes click after scroll in series override menu [#15621](https://github.com/grafana/grafana/issues/15621)
* **MySQL**: fix mysql query using _interval_ms variable throws error [#14507](https://github.com/grafana/grafana/issues/14507)

# 6.0.0-beta3 (2019-02-19)

### Minor
* **CLI**: Grafana CLI should preserve permissions for backend binaries for Linux and Darwin [#15500](https://github.com/grafana/grafana/issues/15500)
* **Alerting**: Allow image rendering 90 percent of alertTimeout [#15395](https://github.com/grafana/grafana/pull/15395)

### Bug fixes
* **Influxdb**: Add support for alerting on InfluxDB queries that use the non_negative_difference function [#15415](https://github.com/grafana/grafana/issues/15415), thx [@kiran3394](https://github.com/kiran3394)
* **Alerting**: Fix percent_diff calculation when points are nulls [#15443](https://github.com/grafana/grafana/issues/15443), thx [@max-neverov](https://github.com/max-neverov)
* **Alerting**: Fixed handling of alert urls with true flags [#15454](https://github.com/grafana/grafana/issues/15454)

# 6.0.0-beta2 (2019-02-11)

### New Features
* **AzureMonitor**: Enable alerting by converting Azure Monitor API to Go [#14623](https://github.com/grafana/grafana/issues/14623)

### Minor
* **Alerting**: Adds support for images in pushover notifier [#10780](https://github.com/grafana/grafana/issues/10780), thx [@jpenalbae](https://github.com/jpenalbae)
* **Graphite/InfluxDB/OpenTSDB**: Fix always take dashboard timezone into consideration when handle custom time ranges [#15284](https://github.com/grafana/grafana/issues/15284)
* **Stackdriver**: Template variables in filters using globbing format [#15182](https://github.com/grafana/grafana/issues/15182)
* **Cloudwatch**: Add `resource_arns` template variable query function [#8207](https://github.com/grafana/grafana/issues/8207), thx [@jeroenvollenbrock](https://github.com/jeroenvollenbrock)
* **Cloudwatch**: Add AWS/Neptune metrics [#14231](https://github.com/grafana/grafana/issues/14231), thx [@tcpatterson](https://github.com/tcpatterson)
* **Cloudwatch**: Add AWS/EC2/API metrics [#14233](https://github.com/grafana/grafana/issues/14233), thx [@tcpatterson](https://github.com/tcpatterson)
* **Cloudwatch**: Add AWS RDS ServerlessDatabaseCapacity metric [#15265](https://github.com/grafana/grafana/pull/15265), thx [@larsjoergensen](https://github.com/larsjoergensen)
* **MySQL**: Adds data source SSL CA/client certificates support [#8570](https://github.com/grafana/grafana/issues/8570), thx [@bugficks](https://github.com/bugficks)
* **MSSQL**: Timerange are now passed for template variable queries [#13324](https://github.com/grafana/grafana/issues/13324), thx [@thatsparesh](https://github.com/thatsparesh)
* **Annotations**: Support PATCH verb in annotations http api [#12546](https://github.com/grafana/grafana/issues/12546), thx [@SamuelToh](https://github.com/SamuelToh)
* **Templating**: Add json formatting to variable interpolation [#15291](https://github.com/grafana/grafana/issues/15291), thx [@mtanda](https://github.com/mtanda)
* **Login**: Anonymous usage stats for token auth [#15288](https://github.com/grafana/grafana/issues/15288)
* **AzureMonitor**: improve autocomplete for Log Analytics and App Insights editor [#15131](https://github.com/grafana/grafana/issues/15131)
* **LDAP**: Fix IPA/FreeIPA v4.6.4 does not allow LDAP searches with empty attributes [#14432](https://github.com/grafana/grafana/issues/14432)
* **Provisioning**: Allow testing data sources that were added by config [#12164](https://github.com/grafana/grafana/issues/12164)
* **Security**: Fix CSRF Token validation for POSTs [#1441](https://github.com/grafana/grafana/issues/1441)

### Breaking changes

* **Internal Metrics** Edition has been added to the build_info metric. This will break any Graphite queries using this metric. Edition will be a new label for the Prometheus metric. [#15363](https://github.com/grafana/grafana/pull/15363)

### Bug fixes

* **Gauge**: Fix issue with gauge requests being cancelled [#15366](https://github.com/grafana/grafana/issues/15366)
* **Gauge**: Accept decimal inputs for thresholds [#15372](https://github.com/grafana/grafana/issues/15372)
* **UI**: Fix error caused by named colors that are not part of named colors palette [#15373](https://github.com/grafana/grafana/issues/15373)
* **Search**: Bug pressing special regexp chars in input fields [#12972](https://github.com/grafana/grafana/issues/12972)
* **Permissions**: No need to have edit permissions to be able to "Save as" [#13066](https://github.com/grafana/grafana/issues/13066)

# 6.0.0-beta1 (2019-01-30)

### New Features

* **Alerting**: Adds support for Google Hangouts Chat notifications [#11221](https://github.com/grafana/grafana/issues/11221), thx [@PatrickSchuster](https://github.com/PatrickSchuster)
* **Elasticsearch**: Support bucket script pipeline aggregations [#5968](https://github.com/grafana/grafana/issues/5968)
* **Influxdb**: Add support for time zone (`tz`) clause [#10322](https://github.com/grafana/grafana/issues/10322), thx [@cykl](https://github.com/cykl)
* **Snapshots**: Enable deletion of public snapshot [#14109](https://github.com/grafana/grafana/issues/14109)
* **Provisioning**: Provisioning support for alert notifiers [#10487](https://github.com/grafana/grafana/issues/10487), thx [@pbakulev](https://github.com/pbakulev)
* **Explore**: A whole new way to do ad-hoc metric queries and exploration. Split view in half and compare metrics & logs and much much more. [Read more here](http://docs.grafana.org/features/explore/)
* **Auth**: Replace remember me cookie solution for Grafana's builtin, LDAP and OAuth authentication with a solution based on short-lived tokens [#15303](https://github.com/grafana/grafana/issues/15303)

### Minor

* **Templating**: Built in time range variables `$__from` and `$__to`, [#1909](https://github.com/grafana/grafana/issues/1909)
* **Alerting**: Use separate timeouts for alert evals and notifications [#14701](https://github.com/grafana/grafana/issues/14701), thx [@sharkpc0813](https://github.com/sharkpc0813)
* **Elasticsearch**: Add support for offset in date histogram aggregation [#12653](https://github.com/grafana/grafana/issues/12653), thx [@mattiarossi](https://github.com/mattiarossi)
* **Elasticsearch**: Add support for moving average and derivative using doc count (metric count) [#8843](https://github.com/grafana/grafana/issues/8843) [#11175](https://github.com/grafana/grafana/issues/11175)
* **Elasticsearch**: Add support for template variable interpolation in alias field [#4075](https://github.com/grafana/grafana/issues/4075), thx [@SamuelToh](https://github.com/SamuelToh)
* **Influxdb**: Fix autocomplete of measurements does not escape search string properly [#11503](https://github.com/grafana/grafana/issues/11503), thx [@SamuelToh](https://github.com/SamuelToh)
* **Stackdriver**: Aggregating series returns more than one series [#14581](https://github.com/grafana/grafana/issues/14581) and [#13914](https://github.com/grafana/grafana/issues/13914), thx [@kinok](https://github.com/kinok)
* **Cloudwatch**: Fix Assume Role Arn [#14722](https://github.com/grafana/grafana/issues/14722), thx [@jaken551](https://github.com/jaken551)
* **Postgres/MySQL/MSSQL**: Nanosecond timestamp support (`$__unixEpochNanoFilter`, `$__unixEpochNanoFrom`, `$__unixEpochNanoTo`) [#14711](https://github.com/grafana/grafana/pull/14711), thx [@ander26](https://github.com/ander26)
* **Provisioning**: Fixes bug causing infinite growth in dashboard_version table. [#12864](https://github.com/grafana/grafana/issues/12864)
* **Auth**: Prevent password reset when login form is disabled or either LDAP or Auth Proxy is enabled [#14246](https://github.com/grafana/grafana/issues/14246), thx [@SilverFire](https://github.com/SilverFire)
* **Admin**: Fix prevent removing last grafana admin permissions [#11067](https://github.com/grafana/grafana/issues/11067), thx [@danielbh](https://github.com/danielbh)
* **Admin**: When multiple user invitations, all links are the same as the first user who was invited [#14483](https://github.com/grafana/grafana/issues/14483)
* **LDAP**: Upgrade go-ldap to v3 [#14548](https://github.com/grafana/grafana/issues/14548)
* **OAuth**: Support OAuth providers that are not RFC6749 compliant [#14562](https://github.com/grafana/grafana/issues/14562), thx [@tdabasinskas](https://github.com/tdabasinskas)
* **Proxy whitelist**: Add CIDR capability to auth_proxy whitelist [#14546](https://github.com/grafana/grafana/issues/14546), thx [@jacobrichard](https://github.com/jacobrichard)
* **Dashboard**: `Min width` changed to `Max per row` for repeating panels. This lets you specify the maximum number of panels to show per row and by that repeated panels will always take up full width of row [#12991](https://github.com/grafana/grafana/pull/12991), thx [@pgiraud](https://github.com/pgiraud)
* **Dashboard**: Retain decimal precision when exporting CSV [#13929](https://github.com/grafana/grafana/issues/13929), thx [@cinaglia](https://github.com/cinaglia)
* **Templating**: Escaping "Custom" template variables [#13754](https://github.com/grafana/grafana/issues/13754), thx [@IntegersOfK](https://github.com/IntegersOfK)
* **Templating**: Add percentencode formatting to variable interpolation to be used mainly for url escaping [#12764](https://github.com/grafana/grafana/issues/12764), thx [@cxcv](https://github.com/cxcv)
* **Units**: Add blood glucose level units mg/dL and mmol/L [#14519](https://github.com/grafana/grafana/issues/14519), thx [@kjedamzik](https://github.com/kjedamzik)
* **Units**: Add Floating Point Operations per Second units [#14558](https://github.com/grafana/grafana/pull/14558), thx [@hahnjo](https://github.com/hahnjo)
* **Table**: Renders epoch string as date if date column style [#14484](https://github.com/grafana/grafana/issues/14484)
* **Dataproxy**: Override incoming Authorization header [#13815](https://github.com/grafana/grafana/issues/13815), thx [@kornholi](https://github.com/kornholi)
* **Dataproxy**: Add global data source proxy timeout setting [#5699](https://github.com/grafana/grafana/issues/5699), thx [@RangerRick](https://github.com/RangerRick)
* **Database**: Support specifying database host using IPV6 for backend database and sql data sources [#13711](https://github.com/grafana/grafana/issues/13711), thx [@ellisvlad](https://github.com/ellisvlad)
* **Database**: Support defining additonal database connection string args when using `url` property in database settings [#14709](https://github.com/grafana/grafana/pull/14709), thx [@tpetr](https://github.com/tpetr)
* **Stackdriver**: crossSeriesAggregation not being sent with the query [#15129](https://github.com/grafana/grafana/issues/15129), thx [@Legogris](https://github.com/Legogris)

### Bug fixes
* **Search**: Fix for issue with scrolling the "tags filter" dropdown, fixes [#14486](https://github.com/grafana/grafana/issues/14486)
* **Prometheus**: Query for annotation always uses 60s step regardless of dashboard range, fixes [#14795](https://github.com/grafana/grafana/issues/14795)
* **Annotations**: Fix creating annotation when graph panel has no data points position the popup outside viewport [#13765](https://github.com/grafana/grafana/issues/13765), thx [@banjeremy](https://github.com/banjeremy)
* **Piechart/Flot**: Fixes multiple piechart instances with donut bug [#15062](https://github.com/grafana/grafana/pull/15062)
* **Postgres**: Fix default port not added when port not configured [#15189](https://github.com/grafana/grafana/issues/15189)
* **Alerting**: Fixes crash bug when alert notifier folders are missing [#15295](https://github.com/grafana/grafana/issues/15295)
* **Dashboard**: Fix save provisioned dashboard modal [#15219](https://github.com/grafana/grafana/pull/15219)
* **Dashboard**: Fix having a long query in prometheus dashboard query editor blocks 30% of the query field when on OSX and having native scrollbars [#15122](https://github.com/grafana/grafana/issues/15122)
* **Explore**: Fix issue with wrapping on long queries [#15222](https://github.com/grafana/grafana/issues/15222)
* **Explore**: Fix cut & paste adds newline before and after selection [#15223](https://github.com/grafana/grafana/issues/15223)
* **Dataproxy**: Fix global data source proxy timeout not added to correct http client [#15258](https://github.com/grafana/grafana/issues/15258) [#5699](https://github.com/grafana/grafana/issues/5699)

### Breaking changes
* **Text Panel**: The text panel does no longer by default allow unsantizied HTML. [#4117](https://github.com/grafana/grafana/issues/4117). This means that if you have text panels with scripts tags they will no longer work as before. To enable unsafe javascript execution in text panels enable the settings `disable_sanitize_html` under the section `[panels]` in your Grafana ini file, or set env variable  `GF_PANELS_DISABLE_SANITIZE_HTML=true`.
* **Dashboard**: Panel property `minSpan` replaced by `maxPerRow`. Dashboard migration will automatically migrate all dashboard panels using the `minSpan` property to the new `maxPerRow` property [#12991](https://github.com/grafana/grafana/pull/12991)

# 5.4.5 (2019-08-29)

* **Security**: Urgent security patch release. Please read more in our [blog](https://grafana.com/blog/2019/08/29/grafana-5.4.5-and-6.3.4-released-with-important-security-fix/)

# 5.4.4 (2019-04-29)

* **Security**: Urgent security patch release. Please read more in our [blog](https://grafana.com/blog/2019/04/29/grafana-5.4.4-and-6.1.6-released-with-important-security-fix/)

# 5.4.3 (2019-01-14)

### Tech

* **Docker**: Build and publish docker images for armv7 and arm64 [#14617](https://github.com/grafana/grafana/pull/14617), thx [@johanneswuerbach](https://github.com/johanneswuerbach)
* **Backend**: Upgrade to golang 1.11.4 [#14580](https://github.com/grafana/grafana/issues/14580)
* **MySQL** only update session in mysql database when required [#14540](https://github.com/grafana/grafana/pull/14540)

### Bug fixes
* **Alerting** Invalid frequency causes division by zero in alert scheduler [#14810](https://github.com/grafana/grafana/issues/14810)
* **Dashboard** Dashboard links do not update when time range changes [#14493](https://github.com/grafana/grafana/issues/14493)
* **Limits** Support more than 1000 data sources per org [#13883](https://github.com/grafana/grafana/issues/13883)
* **Backend** fix signed in user for orgId=0 result should return active org id [#14574](https://github.com/grafana/grafana/pull/14574)
* **Provisioning** Adds orgId to user dto for provisioned dashboards [#14678](https://github.com/grafana/grafana/pull/14678)

# 5.4.2 (2018-12-13)

* **Data Source admin**: Fix for issue creating new data source when same name exists [#14467](https://github.com/grafana/grafana/issues/14467)
* **OAuth**: Fix for oauth auto login setting, can now be set using env variable [#14435](https://github.com/grafana/grafana/issues/14435)
* **Dashboard search**: Fix for searching tags in tags filter dropdown.

# 5.4.1 (2018-12-10)

* **Stackdriver**: Fixes issue with data proxy and Authorization header [#14262](https://github.com/grafana/grafana/issues/14262)
* **Units**: fixedUnit for Flow:l/min and mL/min [#14294](https://github.com/grafana/grafana/issues/14294), thx [@flopp999](https://github.com/flopp999).
* **Logging**: Fix for issue where data proxy logged a secret when debug logging was enabled, now redacted. [#14319](https://github.com/grafana/grafana/issues/14319)
* TSDB**: Fix always take dashboard timezone into consideration when handle custom time ranges**: Add support for alerting on InfluxDB queries that use the cumulative_sum function. [#14314](https://github.com/grafana/grafana/pull/14314), thx [@nitti](https://github.com/nitti)
* **Plugins**: Panel plugins should no receive the panel-initialized event again as usual.
* **Embedded Graphs**: Iframe graph panels should now work as usual. [#14284](https://github.com/grafana/grafana/issues/14284)
* **Postgres**: Improve PostgreSQL Query Editor if using different Schemas, [#14313](
https://github.com/grafana/grafana/pull/14313)
* **Quotas**: Fixed for updating org & user quotas. [#14347](https://github.com/grafana/grafana/pull/14347), thx [#moznion](https://github.com/moznion)
* **Cloudwatch**: Add the AWS/SES Cloudwatch metrics of BounceRate and ComplaintRate to auto complete list. [#14401](https://github.com/grafana/grafana/pull/14401), thx [@sglajchEG](https://github.com/sglajchEG)
* **Dashboard Search**: Fixed filtering by tag issues.
* **Graph**: Fixed time region issues, [#14425](https://github.com/grafana/grafana/issues/14425), [#14280](https://github.com/grafana/grafana/issues/14280)
* **Graph**: Fixed issue with series color picker popover being placed outside window.



# 5.4.0 (2018-12-03)

* **Cloudwatch**: Fix invalid time range causes segmentation fault [#14150](https://github.com/grafana/grafana/issues/14150)
* **Cloudwatch**: AWS/CodeBuild metrics and dimensions [#14167](https://github.com/grafana/grafana/issues/14167), thx [@mmcoltman](https://github.com/mmcoltman)
* **MySQL**: Fix `$__timeFrom()` and `$__timeTo()` should respect local time zone [#14228](https://github.com/grafana/grafana/issues/14228)

### 5.4.0-beta1 fixes
* **Graph**: Fix legend always visible even if configured to be hidden [#14144](https://github.com/grafana/grafana/issues/14144)
* **Elasticsearch**: Fix regression when using data source version 6.0+ and alerting [#14175](https://github.com/grafana/grafana/pull/14175)

# 5.4.0-beta1 (2018-11-20)

### New Features

* **Alerting**: Introduce alert debouncing with the `FOR` setting. [#7886](https://github.com/grafana/grafana/issues/7886) & [#6202](https://github.com/grafana/grafana/issues/6202)
* **Alerting**: Option to disable OK alert notifications [#12330](https://github.com/grafana/grafana/issues/12330) & [#6696](https://github.com/grafana/grafana/issues/6696), thx [@davewat](https://github.com/davewat)
* **Postgres/MySQL/MSSQL**: Adds support for configuration of max open/idle connections and connection max lifetime. Also, panels with multiple SQL queries will now be executed concurrently [#11711](https://github.com/grafana/grafana/issues/11711), thx [@connection-reset](https://github.com/connection-reset)
* **MySQL**: Graphical query builder [#13762](https://github.com/grafana/grafana/issues/13762), thx [svenklemm](https://github.com/svenklemm)
* **MySQL**: Support connecting thru Unix socket for MySQL data source [#12342](https://github.com/grafana/grafana/issues/12342), thx [@Yukinoshita-Yukino](https://github.com/Yukinoshita-Yukino)
* **MSSQL**: Add encrypt setting to allow configuration of how data sent between client and server are encrypted [#13629](https://github.com/grafana/grafana/issues/13629), thx [@ramiro](https://github.com/ramiro)
* **Stackdriver**: Not possible to authenticate using GCE metadata server [#13669](https://github.com/grafana/grafana/issues/13669)
* **Teams**: Team preferences (theme, home dashboard, timezone) support [#12550](https://github.com/grafana/grafana/issues/12550)
* **Graph**: Time regions support enabling highlight of weekdays and/or certain timespans [#5930](https://github.com/grafana/grafana/issues/5930)
* **OAuth**: Automatic redirect to sign-in with OAuth [#11893](https://github.com/grafana/grafana/issues/11893), thx [@Nick-Triller](https://github.com/Nick-Triller)
* **Stackdriver**: Template query editor [#13561](https://github.com/grafana/grafana/issues/13561)

### Minor

* **Security**: Upgrade macaron session package to fix security issue. [#14043](https://github.com/grafana/grafana/pull/14043)
* **Cloudwatch**: Show all available CloudWatch regions [#12308](https://github.com/grafana/grafana/issues/12308), thx [@mtanda](https://github.com/mtanda)
* **Cloudwatch**: AWS/Connect metrics and dimensions [#13970](https://github.com/grafana/grafana/pull/13970), thx [@zcoffy](https://github.com/zcoffy)
* **Cloudwatch**: CloudHSM metrics and dimensions [#14129](https://github.com/grafana/grafana/pull/14129), thx [@daktari](https://github.com/daktari)
* **Cloudwatch**: Enable using variables in the stats field [#13810](https://github.com/grafana/grafana/issues/13810), thx [@mtanda](https://github.com/mtanda)
* **Postgres**: Add delta window function to postgres query builder [#13925](https://github.com/grafana/grafana/issues/13925), thx [svenklemm](https://github.com/svenklemm)
* **Elasticsearch**: Fix switching to/from es raw document metric query [#6367](https://github.com/grafana/grafana/issues/6367)
* **Elasticsearch**: Fix deprecation warning about terms aggregation order key in Elasticsearch 6.x [#11977](https://github.com/grafana/grafana/issues/11977)
* **Graph**: Render dots when no connecting line can be made [#13605](https://github.com/grafana/grafana/issues/13605), thx [@jsferrei](https://github.com/jsferrei)
* **Table**: Fix CSS alpha background-color applied twice in table cell with link [#13606](https://github.com/grafana/grafana/issues/13606), thx [@grisme](https://github.com/grisme)
* **Singlestat**: Fix XSS in prefix/postfix [#13946](https://github.com/grafana/grafana/issues/13946), thx [@cinaglia](https://github.com/cinaglia)
* **Units**: New clock time format, to format ms or second values as for example `01h:59m`, [#13635](https://github.com/grafana/grafana/issues/13635), thx [@franciscocpg](https://github.com/franciscocpg)
* **Alerting**: Increaste default duration for queries [#13945](https://github.com/grafana/grafana/pull/13945)
* **Alerting**: More options for the Slack Alert notifier [#13993](https://github.com/grafana/grafana/issues/13993), thx [@andreykaipov](https://github.com/andreykaipov)
* **Alerting**: Can't receive DingDing alert when alert is triggered [#13723](https://github.com/grafana/grafana/issues/13723), thx [@Yukinoshita-Yukino](https://github.com/Yukinoshita-Yukino)
* **Alerting**: Increase Telegram captions length limit [#13876](https://github.com/grafana/grafana/pull/13876), thx [@skgsergio](https://github.com/skgsergio)
* **Internal metrics**: Renamed `grafana_info` to `grafana_build_info` and added branch, goversion and revision [#13876](https://github.com/grafana/grafana/pull/13876)
* **Data Source Proxy**: Keep trailing slash for data source proxy requests [#13326](https://github.com/grafana/grafana/pull/13326), thx [@ryantxu](https://github.com/ryantxu)
* **OAuth**: Fix Google OAuth relies on email, not google account id [#13924](https://github.com/grafana/grafana/issues/13924), thx [@vinicyusmacedo](https://github.com/vinicyusmacedo)
* **Dashboard**: Toggle legend using keyboard shortcut [#13655](https://github.com/grafana/grafana/issues/13655), thx [@davewat](https://github.com/davewat)
* **Dashboard**: Fix render dashboard row drag handle only in edit mode [#13555](https://github.com/grafana/grafana/issues/13555), thx [@praveensastry](https://github.com/praveensastry)
* **Teams**: Fix cannot select team if not included in initial search [#13425](https://github.com/grafana/grafana/issues/13425)
* **Render**: Support full height screenshots using phantomjs render script [#13352](https://github.com/grafana/grafana/pull/13352), thx [@amuraru](https://github.com/amuraru)
* **HTTP API**: Support retrieving teams by user [#14120](https://github.com/grafana/grafana/pull/14120), thx [@supercharlesliu](https://github.com/supercharlesliu)
* **Metrics**: Add basic authentication to metrics endpoint [#13577](https://github.com/grafana/grafana/issues/13577), thx [@bobmshannon](https://github.com/bobmshannon)

### Breaking changes

* Postgres/MySQL/MSSQL data sources now per default uses `max open connections` = `unlimited` (earlier 10), `max idle connections` = `2` (earlier 10) and `connection max lifetime` = `4` hours (earlier unlimited).

# 5.3.4 (2018-11-13)

* **Alerting**: Delete alerts when parent folder was deleted [#13322](https://github.com/grafana/grafana/issues/13322)
* **MySQL**: Fix `$__timeFilter()` should respect local time zone [#13769](https://github.com/grafana/grafana/issues/13769)
* **Dashboard**: Fix data source selection in panel by enter key [#13932](https://github.com/grafana/grafana/issues/13932)
* **Graph**: Fix table legend height when positioned below graph and using Internet Explorer 11 [#13903](https://github.com/grafana/grafana/issues/13903)
* **Dataproxy**: Drop origin and referer http headers [#13328](https://github.com/grafana/grafana/issues/13328) [#13949](https://github.com/grafana/grafana/issues/13949), thx [@roidelapluie](https://github.com/roidelapluie)

# 5.3.3 (2018-11-13)

### File Exfiltration vulnerability Security fix

See [security announcement](https://community.grafana.com/t/grafana-5-3-3-and-4-6-5-security-update/11961) for details.

# 5.3.2 (2018-10-24)

* **InfluxDB/Graphite/Postgres**: Prevent cross site scripting (XSS) in query editor [#13667](https://github.com/grafana/grafana/issues/13667), thx [@svenklemm](https://github.com/svenklemm)
* **Postgres**: Fix template variables error [#13692](https://github.com/grafana/grafana/issues/13692), thx [@svenklemm](https://github.com/svenklemm)
* **Cloudwatch**: Fix service panic because of race conditions [#13674](https://github.com/grafana/grafana/issues/13674), thx [@mtanda](https://github.com/mtanda)
* **Cloudwatch**: Fix check for invalid percentile statistics [#13633](https://github.com/grafana/grafana/issues/13633), thx [@apalaniuk](https://github.com/apalaniuk)
* **Stackdriver/Cloudwatch**: Allow user to change unit in graph panel if cloudwatch/stackdriver data source response doesn't include unit [#13718](https://github.com/grafana/grafana/issues/13718), thx [@mtanda](https://github.com/mtanda)
* **Stackdriver**: stackdriver user-metrics duplicated response when multiple resource types [#13691](https://github.com/grafana/grafana/issues/13691)
* **Variables**: Fix text box template variable doesn't work properly without a default value [#13666](https://github.com/grafana/grafana/issues/13666)
* **Variables**: Fix variable dependency check when using `${var}` format [#13600](https://github.com/grafana/grafana/issues/13600)
* **Dashboard**: Fix kiosk=1 url parameter should put dashboard in kiosk mode [#13764](https://github.com/grafana/grafana/pull/13764)
* **LDAP**: Fix super admins can also be admins of orgs [#13710](https://github.com/grafana/grafana/issues/13710), thx [@adrien-f](https://github.com/adrien-f)
* **Provisioning**: Fix deleting provisioned dashboard folder should cleanup provisioning meta data [#13280](https://github.com/grafana/grafana/issues/13280)

### Minor

* **Docker**: adds curl back into the docker image for utility. [#13794](https://github.com/grafana/grafana/pull/13794)

# 5.3.1 (2018-10-16)

* **Render**: Fix PhantomJS render of graph panel when legend displayed as table to the right [#13616](https://github.com/grafana/grafana/issues/13616)
* **Stackdriver**: Filter option disappears after removing initial filter [#13607](https://github.com/grafana/grafana/issues/13607)
* **Elasticsearch**: Fix no limit size in terms aggregation for alerting queries [#13172](https://github.com/grafana/grafana/issues/13172), thx [@Yukinoshita-Yukino](https://github.com/Yukinoshita-Yukino)
* **InfluxDB**: Fix for annotation issue that caused text to be shown twice [#13553](https://github.com/grafana/grafana/issues/13553)
* **Variables**: Fix nesting variables leads to exception and missing refresh [#13628](https://github.com/grafana/grafana/issues/13628)
* **Variables**: Prometheus: Single letter labels are not supported [#13641](https://github.com/grafana/grafana/issues/13641), thx [@olshansky](https://github.com/olshansky)
* **Graph**: Fix graph time formatting for Last 24h ranges [#13650](https://github.com/grafana/grafana/issues/13650)
* **Playlist**: Fix cannot add dashboards with long names to playlist [#13464](https://github.com/grafana/grafana/issues/13464), thx [@neufeldtech](https://github.com/neufeldtech)
* **HTTP API**: Fix /api/org/users so that query and limit querystrings works

# 5.3.0 (2018-10-10)

* **Stackdriver**: Filter wildcards and regex matching are not yet supported [#13495](https://github.com/grafana/grafana/issues/13495)
* **Stackdriver**: Support the distribution metric type for heatmaps [#13559](https://github.com/grafana/grafana/issues/13559)
* **Cloudwatch**: Automatically set graph yaxis unit [#13575](https://github.com/grafana/grafana/issues/13575), thx [@mtanda](https://github.com/mtanda)

# 5.3.0-beta3 (2018-10-03)

* **Stackdriver**: Fix for missing ngInject [#13511](https://github.com/grafana/grafana/pull/13511)
* **Permissions**: Fix for broken permissions selector [#13507](https://github.com/grafana/grafana/issues/13507)
* **Alerting**: Alert reminders deduping not working as expected when running multiple Grafana instances [#13492](https://github.com/grafana/grafana/issues/13492)

# 5.3.0-beta2 (2018-10-01)

### New Features

* **Annotations**: Enable template variables in tagged annotations queries [#9735](https://github.com/grafana/grafana/issues/9735)
* **Stackdriver**: Support for Google Stackdriver data source [#13289](https://github.com/grafana/grafana/pull/13289)

### Minor

* **Provisioning**: Dashboard Provisioning now support symlinks that changes target [#12534](https://github.com/grafana/grafana/issues/12534), thx [@auhlig](https://github.com/auhlig)
* **OAuth**: Allow oauth email attribute name to be configurable [#12986](https://github.com/grafana/grafana/issues/12986), thx [@bobmshannon](https://github.com/bobmshannon)
* **Tags**: Default sort order for GetDashboardTags [#11681](https://github.com/grafana/grafana/pull/11681), thx [@Jonnymcc](https://github.com/Jonnymcc)
* **Prometheus**: Label completion queries respect dashboard time range  [#12251](https://github.com/grafana/grafana/pull/12251), thx [@mtanda](https://github.com/mtanda)
* **Prometheus**: Allow to display annotations based on Prometheus series value [#10159](https://github.com/grafana/grafana/issues/10159), thx [@mtanda](https://github.com/mtanda)
* **Prometheus**: Adhoc-filtering for Prometheus dashboards [#13212](https://github.com/grafana/grafana/issues/13212)
* **Singlestat**: Fix gauge display accuracy for percents [#13270](https://github.com/grafana/grafana/issues/13270), thx [@tianon](https://github.com/tianon)
* **Dashboard**: Prevent auto refresh from starting when loading dashboard with absolute time range [#12030](https://github.com/grafana/grafana/issues/12030)
* **Templating**: New templating variable type `Text box` that allows free text input [#3173](https://github.com/grafana/grafana/issues/3173)
* **Alerting**: Link to view full size image in Microsoft Teams alert notifier [#13121](https://github.com/grafana/grafana/issues/13121), thx [@holiiveira](https://github.com/holiiveira)
* **Alerting**: Fixes a bug where all alerts would send reminders after upgrade & restart [#13402](https://github.com/grafana/grafana/pull/13402)
* **Alerting**: Concurrent render limit for graphs used in notifications [#13401](https://github.com/grafana/grafana/pull/13401)
* **Postgres/MySQL/MSSQL**: Add support for replacing $__interval and  $__interval_ms in alert queries [#11555](https://github.com/grafana/grafana/issues/11555), thx [@svenklemm](https://github.com/svenklemm)

# 5.3.0-beta1 (2018-09-06)

### New Major Features

* **Alerting**: Notification reminders [#7330](https://github.com/grafana/grafana/issues/7330), thx [@jbaublitz](https://github.com/jbaublitz)
* **Dashboard**: TV & Kiosk mode changes, new cycle view mode button in dashboard toolbar [#13025](https://github.com/grafana/grafana/pull/13025)
* **OAuth**: Gitlab OAuth with support for filter by groups [#5623](https://github.com/grafana/grafana/issues/5623), thx [@BenoitKnecht](https://github.com/BenoitKnecht)
* **Postgres**: Graphical query builder [#10095](https://github.com/grafana/grafana/issues/10095), thx [svenklemm](https://github.com/svenklemm)

### New Features

* **LDAP**: Define Grafana Admin permission in ldap group mappings [#2469](https://github.com/grafana/grafana/issues/2496), PR [#12622](https://github.com/grafana/grafana/issues/12622)
* **LDAP**: Client certificates support [#12805](https://github.com/grafana/grafana/issues/12805), thx [@nyxi](https://github.com/nyxi)
* **Profile**: List teams that the user is member of in current/active organization [#12476](https://github.com/grafana/grafana/issues/12476)
* **Configuration**: Allow auto-assigning users to specific organization (other than Main. Org) [#1823](https://github.com/grafana/grafana/issues/1823) [#12801](https://github.com/grafana/grafana/issues/12801), thx [@gzzo](https://github.com/gzzo) and [@ofosos](https://github.com/ofosos)
* **Dataproxy**: Pass configured/auth headers to a data source [#10971](https://github.com/grafana/grafana/issues/10971), thx [@mrsiano](https://github.com/mrsiano)
* **CloudWatch**: GetMetricData support [#11487](https://github.com/grafana/grafana/issues/11487), thx [@mtanda](https://github.com/mtanda)
* **Postgres**: TimescaleDB support, e.g. use `time_bucket` for grouping by time when option enabled [#12680](https://github.com/grafana/grafana/pull/12680), thx [svenklemm](https://github.com/svenklemm)
* **Cleanup**: Make temp file time to live configurable [#11607](https://github.com/grafana/grafana/issues/11607), thx [@xapon](https://github.com/xapon)

### Minor

* **Alerting**: Its now possible to configure the default value for how to handle errors and no data in alerting. [#10424](https://github.com/grafana/grafana/issues/10424)
* **Alerting**: Fix diff and percent_diff reducers [#11563](https://github.com/grafana/grafana/issues/11563), thx [@jessetane](https://github.com/jessetane)
* **Alerting**: Fix rendering timeout which could cause notifications to not be sent due to rendering timing out [#12151](https://github.com/grafana/grafana/issues/12151)
* **Docker**: Make it possible to set a specific plugin url [#12861](https://github.com/grafana/grafana/pull/12861), thx [ClementGautier](https://github.com/ClementGautier)
* **GrafanaCli**: Fixed issue with grafana-cli install plugin resulting in corrupt http response from source error. Fixes [#13079](https://github.com/grafana/grafana/issues/13079)
* **Provisioning**: Should allow one default data source per organization [#12229](https://github.com/grafana/grafana/issues/12229)
* **Github OAuth**: Allow changes of user info at Github to be synched to Grafana when signing in [#11818](https://github.com/grafana/grafana/issues/11818), thx [@rwaweber](https://github.com/rwaweber)
* **OAuth**: Fix overriding tls_skip_verify_insecure using environment variable [#12747](https://github.com/grafana/grafana/issues/12747), thx [@jangaraj](https://github.com/jangaraj)
* **Prometheus**: Fix graph panel bar width issue in aligned prometheus queries [#12379](https://github.com/grafana/grafana/issues/12379)
* **Prometheus**: Heatmap - fix unhandled error when some points are missing [#12484](https://github.com/grafana/grafana/issues/12484)
* **Prometheus**: Add $__interval, $__interval_ms, $__range, $__range_s & $__range_ms support for dashboard and template queries [#12597](https://github.com/grafana/grafana/issues/12597) [#12882](https://github.com/grafana/grafana/issues/12882), thx [@roidelapluie](https://github.com/roidelapluie)
* **Elasticsearch**: For alerting/backend, support having index name to the right of pattern in index pattern [#12731](https://github.com/grafana/grafana/issues/12731)
* **Graphite**: Fix for quoting of int function parameters (when using variables) [#11927](https://github.com/grafana/grafana/pull/11927)
* **InfluxDB**: Support timeFilter in query templating for InfluxDB [#12598](https://github.com/grafana/grafana/pull/12598), thx [kichristensen](https://github.com/kichristensen)
* **Postgres/MySQL/MSSQL**: New $__unixEpochGroup and $__unixEpochGroupAlias macros [#12892](https://github.com/grafana/grafana/issues/12892), thx [@svenklemm](https://github.com/svenklemm)
* **Postgres/MySQL/MSSQL**: Add previous fill mode to $__timeGroup macro which will fill in previously seen value when point is missing [#12756](https://github.com/grafana/grafana/issues/12756), thx [@svenklemm](https://github.com/svenklemm)
* **Postgres/MySQL/MSSQL**: Use floor rounding in $__timeGroup macro function [#12460](https://github.com/grafana/grafana/issues/12460), thx [@svenklemm](https://github.com/svenklemm)
* **Postgres/MySQL/MSSQL**: Use metric column as prefix when returning multiple value columns [#12727](https://github.com/grafana/grafana/issues/12727), thx [@svenklemm](https://github.com/svenklemm)
* **Postgres/MySQL/MSSQL**: New $__timeGroupAlias macro. Postgres $__timeGroup no longer automatically adds time column alias [#12749](https://github.com/grafana/grafana/issues/12749), thx [@svenklemm](https://github.com/svenklemm)
* **Postgres/MySQL/MSSQL**: Escape single quotes in variables [#12785](https://github.com/grafana/grafana/issues/12785), thx [@eMerzh](https://github.com/eMerzh)
* **Postgres/MySQL/MSSQL**: Min time interval support [#13157](https://github.com/grafana/grafana/issues/13157), thx [@svenklemm](https://github.com/svenklemm)
* **MySQL/MSSQL**: Use datetime format instead of epoch for $__timeFilter, $__timeFrom and $__timeTo macros [#11618](https://github.com/grafana/grafana/issues/11618) [#11619](https://github.com/grafana/grafana/issues/11619), thx [@AustinWinstanley](https://github.com/AustinWinstanley)
* **Postgres**: Escape ssl mode parameter in connectionstring [#12644](https://github.com/grafana/grafana/issues/12644), thx [@yogyrahmawan](https://github.com/yogyrahmawan)
* **Cloudwatch**: Improved error handling [#12489](https://github.com/grafana/grafana/issues/12489), thx [@mtanda](https://github.com/mtanda)
* **Cloudwatch**: AppSync metrics and dimensions [#12300](https://github.com/grafana/grafana/issues/12300), thx [@franciscocpg](https://github.com/franciscocpg)
* **Cloudwatch**: Direct Connect metrics and dimensions [#12762](https://github.com/grafana/grafana/pulls/12762), thx [@mindriot88](https://github.com/mindriot88)
* **Cloudwatch**: Added BurstBalance metric to list of AWS RDS metrics [#12561](https://github.com/grafana/grafana/pulls/12561), thx [@activeshadow](https://github.com/activeshadow)
* **Cloudwatch**: Add new Redshift metrics and dimensions [#12063](https://github.com/grafana/grafana/pulls/12063), thx [@A21z](https://github.com/A21z)
* **Dashboard**: Fix selecting current dashboard from search should not reload dashboard [#12248](https://github.com/grafana/grafana/issues/12248)
* **Dashboard**: Use uid when linking to dashboards internally in a dashboard [#10705](https://github.com/grafana/grafana/issues/10705)
* **Graph**: Option to hide series from tooltip [#3341](https://github.com/grafana/grafana/issues/3341), thx [@mtanda](https://github.com/mtanda)
* **Singlestat**: Make colorization of prefix and postfix optional in singlestat [#11892](https://github.com/grafana/grafana/pull/11892), thx [@ApsOps](https://github.com/ApsOps)
* **Table**: Adjust header contrast for the light theme [#12668](https://github.com/grafana/grafana/issues/12668)
* **Table**: Fix link color when using light theme and thresholds in use [#12766](https://github.com/grafana/grafana/issues/12766)
* **Table**: Fix for useless horizontal scrollbar for table panel [#9964](https://github.com/grafana/grafana/issues/9964)
* **Table**: Make table sorting stable when null values exist [#12362](https://github.com/grafana/grafana/pull/12362), thx [@bz2](https://github.com/bz2)
* **Heatmap**: Fix broken tooltip and crosshair on Firefox [#12486](https://github.com/grafana/grafana/issues/12486)
* **Data Source**: Fix UI issue with secret fields after updating data source [#11270](https://github.com/grafana/grafana/issues/11270)
* **Variables**: Skip unneeded extra query request when de-selecting variable values used for repeated panels [#8186](https://github.com/grafana/grafana/issues/8186), thx [@mtanda](https://github.com/mtanda)
* **Variables**: Limit amount of queries executed when updating variable that other variable(s) are dependent on [#11890](https://github.com/grafana/grafana/issues/11890)
* **Variables**: Support query variable refresh when another variable referenced in `Regex` field change its value [#12952](https://github.com/grafana/grafana/issues/12952), thx [@franciscocpg](https://github.com/franciscocpg)
* **Variables**: Support variables in query variable `Custom all value` field [#12965](https://github.com/grafana/grafana/issues/12965), thx [@franciscocpg](https://github.com/franciscocpg)
* **Units**: Change units to include characters for power of 2 and 3 [#12744](https://github.com/grafana/grafana/pull/12744), thx [@Worty](https://github.com/Worty)
* **Units**: Polish złoty currency [#12691](https://github.com/grafana/grafana/pull/12691), thx [@mwegrzynek](https://github.com/mwegrzynek)
* **Units**: Adds bitcoin axes unit. [#13125](https://github.com/grafana/grafana/pull/13125)
* **Api**: Delete nonexistent data source should return 404 [#12313](https://github.com/grafana/grafana/issues/12313), thx [@AustinWinstanley](https://github.com/AustinWinstanley)
* **Logging**: Reopen log files after receiving a SIGHUP signal [#13112](https://github.com/grafana/grafana/pull/13112), thx [@filewalkwithme](https://github.com/filewalkwithme)
* **Login**: Show loading animation while waiting for authentication response on login [#12865](https://github.com/grafana/grafana/issues/12865)
* **UI**: Fix iOS home screen "app" icon and Windows 10 app experience [#12752](https://github.com/grafana/grafana/issues/12752), thx [@andig](https://github.com/andig)
* **Plugins**: Convert URL-like text to links in plugins readme [#12843](https://github.com/grafana/grafana/pull/12843), thx [pgiraud](https://github.com/pgiraud)

### Breaking changes

* Postgres data source no longer automatically adds time column alias when using the $__timeGroup alias. However, there's code in place which should make this change backward compatible and shouldn't create any issues.
* Kiosk mode now also hides submenu (variables)
* ?inactive url parameter no longer supported, replaced with kiosk=tv url parameter

### New experimental features

These are new features that's still being worked on and are in an experimental phase. We encourage users to try these out and provide any feedback in related issue.

* **Dashboard**: Auto fit dashboard panels to optimize space used for current TV / Monitor [#12768](https://github.com/grafana/grafana/issues/12768)

### Tech

* **Frontend**: Convert all Frontend Karma tests to Jest tests [#12224](https://github.com/grafana/grafana/issues/12224)
* **Backend**: Upgrade to golang 1.11 [#13030](https://github.com/grafana/grafana/issues/13030)

# 5.2.4 (2018-09-07)

* **GrafanaCli**: Fixed issue with grafana-cli install plugin resulting in corrupt http response from source error. Fixes [#13079](https://github.com/grafana/grafana/issues/13079)

# 5.2.3 (2018-08-29)

### Important fix for LDAP & OAuth login vulnerability

See [security announcement](https://community.grafana.com/t/grafana-5-2-3-and-4-6-4-security-update/10050) for details.

# 5.2.2 (2018-07-25)

### Minor

* **Prometheus**: Fix graph panel bar width issue in aligned prometheus queries [#12379](https://github.com/grafana/grafana/issues/12379)
* **Dashboard**: Dashboard links not updated when changing variables [#12506](https://github.com/grafana/grafana/issues/12506)
* **Postgres/MySQL/MSSQL**: Fix connection leak [#12636](https://github.com/grafana/grafana/issues/12636) [#9827](https://github.com/grafana/grafana/issues/9827)
* **Plugins**: Fix loading of external plugins [#12551](https://github.com/grafana/grafana/issues/12551)
* **Dashboard**: Remove unwanted scrollbars in embedded panels [#12589](https://github.com/grafana/grafana/issues/12589)
* **Prometheus**: Prevent error using $__interval_ms in query [#12533](https://github.com/grafana/grafana/pull/12533), thx [@mtanda](https://github.com/mtanda)

# 5.2.1 (2018-06-29)

### Minor

* **Auth Proxy**: Important security fix for whitelist of IP address feature [#12444](https://github.com/grafana/grafana/pull/12444)
* **UI**: Fix - Grafana footer overlapping page [#12430](https://github.com/grafana/grafana/issues/12430)
* **Logging**: Errors should be reported before crashing [#12438](https://github.com/grafana/grafana/issues/12438)

# 5.2.0-stable (2018-06-27)

### Minor

* **Plugins**: Handle errors correctly when loading data source plugin [#12383](https://github.com/grafana/grafana/pull/12383) thx [@rozetko](https://github.com/rozetko)
* **Render**: Enhance error message if phantomjs executable is not found [#11868](https://github.com/grafana/grafana/issues/11868)
* **Dashboard**: Set correct text in drop down when variable is present in url [#11968](https://github.com/grafana/grafana/issues/11968)

### 5.2.0-beta3 fixes

* **LDAP**: Handle "dn" ldap attribute more gracefully [#12385](https://github.com/grafana/grafana/pull/12385), reverts [#10970](https://github.com/grafana/grafana/pull/10970)

# 5.2.0-beta3 (2018-06-21)

### Minor

* **Build**: All rpm packages should be signed [#12359](https://github.com/grafana/grafana/issues/12359)

# 5.2.0-beta2 (2018-06-20)

### New Features

* **Dashboard**: Import dashboard to folder [#10796](https://github.com/grafana/grafana/issues/10796)

### Minor

* **Permissions**: Important security fix for API keys with viewer role [#12343](https://github.com/grafana/grafana/issues/12343)
* **Dashboard**: Fix so panel titles doesn't wrap [#11074](https://github.com/grafana/grafana/issues/11074)
* **Dashboard**: Prevent double-click when saving dashboard [#11963](https://github.com/grafana/grafana/issues/11963)
* **Dashboard**: AutoFocus the add-panel search filter [#12189](https://github.com/grafana/grafana/pull/12189) thx [@ryantxu](https://github.com/ryantxu)
* **Units**: W/m2 (energy), l/h (flow) and kPa (pressure) [#11233](https://github.com/grafana/grafana/pull/11233), thx [@flopp999](https://github.com/flopp999)
* **Units**: Liter/min (flow) and milliLiter/min (flow) [#12282](https://github.com/grafana/grafana/pull/12282), thx [@flopp999](https://github.com/flopp999)
* **Alerting**: Fix mobile notifications for Microsoft Teams alert notifier [#11484](https://github.com/grafana/grafana/pull/11484), thx [@manacker](https://github.com/manacker)
* **Influxdb**: Add support for mode function [#12286](https://github.com/grafana/grafana/issues/12286)
* **Cloudwatch**: Fixes panic caused by bad timerange settings [#12199](https://github.com/grafana/grafana/issues/12199)
* **Auth Proxy**: Whitelist proxy IP address instead of client IP address [#10707](https://github.com/grafana/grafana/issues/10707)
* **User Management**: Make sure that a user always has a current org assigned [#11076](https://github.com/grafana/grafana/issues/11076)
* **Snapshots**: Fix: annotations not properly extracted leading to incorrect rendering of annotations [#12278](https://github.com/grafana/grafana/issues/12278)
* **LDAP**: Allow use of DN in group_search_filter_user_attribute and member_of [#3132](https://github.com/grafana/grafana/issues/3132), thx [@mmolnar](https://github.com/mmolnar)
* **Graph**: Fix legend decimals precision calculation [#11792](https://github.com/grafana/grafana/issues/11792)
* **Dashboard**: Make sure to process panels in collapsed rows when exporting dashboard [#12256](https://github.com/grafana/grafana/issues/12256)

### 5.2.0-beta1 fixes

* **Dashboard**: Dashboard link doesn't work when "As dropdown" option is checked [#12315](https://github.com/grafana/grafana/issues/12315)
* **Dashboard**: Fix regressions after save modal changes, including adhoc template issues [#12240](https://github.com/grafana/grafana/issues/12240)
* **Docker**: Config keys ending with _FILE are not respected [#170](https://github.com/grafana/grafana-docker/issues/170)

# 5.2.0-beta1 (2018-06-05)

### New Features

* **Elasticsearch**: Alerting support [#5893](https://github.com/grafana/grafana/issues/5893), thx [@WPH95](https://github.com/WPH95)
* **Build**: Crosscompile and packages Grafana on arm, windows, linux and darwin [#11920](https://github.com/grafana/grafana/pull/11920), thx [@fg2it](https://github.com/fg2it)
* **Login**: Change admin password after first login [#11882](https://github.com/grafana/grafana/issues/11882)
* **Alert list panel**: Updated to support filtering alerts by name, dashboard title, folder, tags [#11500](https://github.com/grafana/grafana/issues/11500), [#8168](https://github.com/grafana/grafana/issues/8168), [#6541](https://github.com/grafana/grafana/issues/6541)

### Minor

* **Dashboard**: Modified time range and variables are now not saved by default [#10748](https://github.com/grafana/grafana/issues/10748), [#8805](https://github.com/grafana/grafana/issues/8805)
* **Graph**: Show invisible highest value bucket in histogram [#11498](https://github.com/grafana/grafana/issues/11498)
* **Dashboard**: Enable "Save As..." if user has edit permission [#11625](https://github.com/grafana/grafana/issues/11625)
* **Prometheus**: Query dates are now step-aligned [#10434](https://github.com/grafana/grafana/pull/10434)
* **Prometheus**: Table columns order now changes when rearrange queries [#11690](https://github.com/grafana/grafana/issues/11690), thx [@mtanda](https://github.com/mtanda)
* **Variables**: Fix variable interpolation when using multiple formatting types [#11800](https://github.com/grafana/grafana/issues/11800), thx [@svenklemm](https://github.com/svenklemm)
* **Dashboard**: Fix date selector styling for dark/light theme in time picker control [#11616](https://github.com/grafana/grafana/issues/11616)
* **Discord**: Alert notification channel type for Discord, [#7964](https://github.com/grafana/grafana/issues/7964) thx [@jereksel](https://github.com/jereksel),
* **InfluxDB**: Support SELECT queries in templating query, [#5013](https://github.com/grafana/grafana/issues/5013)
* **InfluxDB**: Support count distinct aggregation [#11645](https://github.com/grafana/grafana/issues/11645), thx [@kichristensen](https://github.com/kichristensen)
* **Dashboard**: JSON Model under dashboard settings can now be updated & changes saved, [#1429](https://github.com/grafana/grafana/issues/1429), thx [@jereksel](https://github.com/jereksel)
* **Security**: Fix XSS vulnerabilities in dashboard links [#11813](https://github.com/grafana/grafana/pull/11813)
* **Singlestat**: Fix "time of last point" shows local time when dashboard timezone set to UTC [#10338](https://github.com/grafana/grafana/issues/10338)
* **Prometheus**: Add support for passing timeout parameter to Prometheus [#11788](https://github.com/grafana/grafana/pull/11788), thx [@mtanda](https://github.com/mtanda)
* **Login**: Add optional option sign out url for generic oauth [#9847](https://github.com/grafana/grafana/issues/9847), thx [@roidelapluie](https://github.com/roidelapluie)
* **Login**: Use proxy server from environment variable if available [#9703](https://github.com/grafana/grafana/issues/9703), thx [@iyeonok](https://github.com/iyeonok)
* **Invite users**: Friendlier error message when smtp is not configured [#12087](https://github.com/grafana/grafana/issues/12087), thx [@thurt](https://github.com/thurt)
* **Graphite**: Don't send distributed tracing headers when using direct/browser access mode [#11494](https://github.com/grafana/grafana/issues/11494)
* **Sidenav**: Show create dashboard link for viewers if at least editor in one folder [#11858](https://github.com/grafana/grafana/issues/11858)
* **SQL**: Second epochs are now correctly converted to ms. [#12085](https://github.com/grafana/grafana/pull/12085)
* **Singlestat**: Fix singlestat threshold tooltip [#11971](https://github.com/grafana/grafana/issues/11971)
* **Dashboard**: Hide grid controls in fullscreen/low-activity views [#11771](https://github.com/grafana/grafana/issues/11771)
* **Dashboard**: Validate uid when importing dashboards [#11515](https://github.com/grafana/grafana/issues/11515)
* **Docker**: Support for env variables ending with _FILE [grafana-docker #166](https://github.com/grafana/grafana-docker/pull/166), thx [@efrecon](https://github.com/efrecon)
* **Alert list panel**: Show alerts for user with viewer role [#11167](https://github.com/grafana/grafana/issues/11167)
* **Provisioning**: Verify checksum of dashboards before updating to reduce load on database [#11670](https://github.com/grafana/grafana/issues/11670)
* **Provisioning**: Support symlinked files in dashboard provisioning config files [#11958](https://github.com/grafana/grafana/issues/11958)
* **Dashboard list panel**: Search dashboards by folder [#11525](https://github.com/grafana/grafana/issues/11525)
* **Sidenav**: Always show server admin link in sidenav if grafana admin [#11657](https://github.com/grafana/grafana/issues/11657)

# 5.1.5 (2018-06-27)

* **Docker**: Config keys ending with _FILE are not respected [#170](https://github.com/grafana/grafana-docker/issues/170)

# 5.1.4 (2018-06-19)

* **Permissions**: Important security fix for API keys with viewer role [#12343](https://github.com/grafana/grafana/issues/12343)

# 5.1.3 (2018-05-16)

* **Scroll**: Graph panel / legend texts shifts on the left each time we move scrollbar on firefox [#11830](https://github.com/grafana/grafana/issues/11830)

# 5.1.2 (2018-05-09)

* **Database**: Fix MySql migration issue [#11862](https://github.com/grafana/grafana/issues/11862)
* **Google Analytics**: Enable Google Analytics anonymizeIP setting for GDPR [#11656](https://github.com/grafana/grafana/pull/11656)

# 5.1.1 (2018-05-07)

* **LDAP**: LDAP login with MariaDB/MySQL database and dn>100 chars not possible [#11754](https://github.com/grafana/grafana/issues/11754)
* **Build**: AppVeyor Windows build missing version and commit info [#11758](https://github.com/grafana/grafana/issues/11758)
* **Scroll**: Scroll can't start in graphs on Chrome mobile [#11710](https://github.com/grafana/grafana/issues/11710)
* **Units**: Revert renaming of unit key ppm [#11743](https://github.com/grafana/grafana/issues/11743)

# 5.1.0 (2018-04-26)

* **Folders**: Default permissions on folder are not shown as inherited in its dashboards [#11668](https://github.com/grafana/grafana/issues/11668)
* **Templating**: Allow more than 20 previews when creating a variable [#11508](https://github.com/grafana/grafana/issues/11508)
* **Dashboard**: Row edit icon not shown [#11466](https://github.com/grafana/grafana/issues/11466)
* **SQL**: Unsupported data types for value column using time series query [#11703](https://github.com/grafana/grafana/issues/11703)
* **Prometheus**: Prometheus query inspector expands to be very large on autocomplete queries [#11673](https://github.com/grafana/grafana/issues/11673)

# 5.1.0-beta1 (2018-04-20)

* **MSSQL**: New Microsoft SQL Server data source [#10093](https://github.com/grafana/grafana/pull/10093), [#11298](https://github.com/grafana/grafana/pull/11298), thx [@linuxchips](https://github.com/linuxchips)
* **Prometheus**: The heatmap panel now support Prometheus histograms [#10009](https://github.com/grafana/grafana/issues/10009)
* **Postgres/MySQL**: Ability to insert 0s or nulls for missing intervals [#9487](https://github.com/grafana/grafana/issues/9487), thanks [@svenklemm](https://github.com/svenklemm)
* **Postgres/MySQL/MSSQL**: Fix precision for the time column in table mode [#11306](https://github.com/grafana/grafana/issues/11306)
* **Graph**: Align left and right Y-axes to one level [#1271](https://github.com/grafana/grafana/issues/1271) &  [#2740](https://github.com/grafana/grafana/issues/2740) thx [@ilgizar](https://github.com/ilgizar)
* **Graph**: Thresholds for Right Y axis [#7107](https://github.com/grafana/grafana/issues/7107), thx [@ilgizar](https://github.com/ilgizar)
* **Graph**: Support multiple series stacking in histogram mode [#8151](https://github.com/grafana/grafana/issues/8151), thx [@mtanda](https://github.com/mtanda)
* **Alerting**: Pausing/un alerts now updates new_state_date [#10942](https://github.com/grafana/grafana/pull/10942)
* **Alerting**: Support Pagerduty notification channel using Pagerduty V2 API [#10531](https://github.com/grafana/grafana/issues/10531), thx [@jbaublitz](https://github.com/jbaublitz)
* **Templating**: Add comma templating format [#10632](https://github.com/grafana/grafana/issues/10632), thx [@mtanda](https://github.com/mtanda)
* **Prometheus**: Show template variable candidate in query editor [#9210](https://github.com/grafana/grafana/issues/9210), thx [@mtanda](https://github.com/mtanda)
* **Prometheus**: Support POST for query and query_range [#9859](https://github.com/grafana/grafana/pull/9859), thx [@mtanda](https://github.com/mtanda)
* **Alerting**: Add support for retries on alert queries [#5855](https://github.com/grafana/grafana/issues/5855), thx [@Thib17](https://github.com/Thib17)
* **Table**: Table plugin value mappings [#7119](https://github.com/grafana/grafana/issues/7119), thx [infernix](https://github.com/infernix)
* **IE11**: IE 11 compatibility [#11165](https://github.com/grafana/grafana/issues/11165)
* **Scrolling**: Better scrolling experience [#11053](https://github.com/grafana/grafana/issues/11053), [#11252](https://github.com/grafana/grafana/issues/11252), [#10836](https://github.com/grafana/grafana/issues/10836), [#11185](https://github.com/grafana/grafana/issues/11185), [#11168](https://github.com/grafana/grafana/issues/11168)
* **Docker**: Improved docker image (breaking changes regarding file ownership) [grafana-docker #141](https://github.com/grafana/grafana-docker/issues/141), thx [@Spindel](https://github.com/Spindel), [@ChristianKniep](https://github.com/ChristianKniep), [@brancz](https://github.com/brancz) and [@jangaraj](https://github.com/jangaraj)
* **Folders**: A folder admin cannot add user/team permissions for folder/its dashboards [#11173](https://github.com/grafana/grafana/issues/11173)
* **Provisioning**: Improved workflow for provisioned dashboards [#10883](https://github.com/grafana/grafana/issues/10883)

### Minor

* **OpsGenie**: Add triggered alerts as description [#11046](https://github.com/grafana/grafana/pull/11046), thx [@llamashoes](https://github.com/llamashoes)
* **Cloudwatch**: Support high resolution metrics [#10925](https://github.com/grafana/grafana/pull/10925), thx [@mtanda](https://github.com/mtanda)
* **Cloudwatch**: Add dimension filtering to CloudWatch `dimension_values()` [#10029](https://github.com/grafana/grafana/issues/10029), thx [@willyhutw](https://github.com/willyhutw)
* **Units**: Second to HH:mm:ss formatter [#11107](https://github.com/grafana/grafana/issues/11107), thx [@gladdiologist](https://github.com/gladdiologist)
* **Singlestat**: Add color to prefix and postfix in singlestat panel [#11143](https://github.com/grafana/grafana/pull/11143), thx [@ApsOps](https://github.com/ApsOps)
* **Dashboards**: Version cleanup fails on old databases with many entries [#11278](https://github.com/grafana/grafana/issues/11278)
* **Server**: Adjust permissions of unix socket [#11343](https://github.com/grafana/grafana/pull/11343), thx [@corny](https://github.com/corny)
* **Shortcuts**: Add shortcut for duplicate panel [#11102](https://github.com/grafana/grafana/issues/11102)
* **AuthProxy**: Support IPv6 in Auth proxy white list [#11330](https://github.com/grafana/grafana/pull/11330), thx [@corny](https://github.com/corny)
* **SMTP**: Don't connect to STMP server using TLS unless configured. [#7189](https://github.com/grafana/grafana/issues/7189)
* **Prometheus**: Escape backslash in labels correctly. [#10555](https://github.com/grafana/grafana/issues/10555), thx [@roidelapluie](https://github.com/roidelapluie)
* **Variables**: Case-insensitive sorting for template values [#11128](https://github.com/grafana/grafana/issues/11128) thx [@cross](https://github.com/cross)
* **Annotations (native)**: Change default limit from 10 to 100 when querying api [#11569](https://github.com/grafana/grafana/issues/11569), thx [@flopp999](https://github.com/flopp999)
* **MySQL/Postgres/MSSQL**: PostgreSQL data source generates invalid query with dates before 1970 [#11530](https://github.com/grafana/grafana/issues/11530) thx [@ryantxu](https://github.com/ryantxu)
* **Kiosk**: Adds url parameter for starting a dashboard in inactive mode [#11228](https://github.com/grafana/grafana/issues/11228), thx [@towolf](https://github.com/towolf)
* **Dashboard**: Enable closing timepicker using escape key [#11332](https://github.com/grafana/grafana/issues/11332)
* **Data Sources**: Rename direct access mode in the data source settings [#11391](https://github.com/grafana/grafana/issues/11391)
* **Search**: Display dashboards in folder indented [#11073](https://github.com/grafana/grafana/issues/11073)
* **Units**: Use B/s instead Bps for Bytes per second [#9342](https://github.com/grafana/grafana/pull/9342), thx [@mayli](https://github.com/mayli)
* **Units**: Radiation units [#11001](https://github.com/grafana/grafana/issues/11001), thx [@victorclaessen](https://github.com/victorclaessen)
* **Units**: Timeticks unit [#11183](https://github.com/grafana/grafana/pull/11183), thx [@jtyr](https://github.com/jtyr)
* **Units**: Concentration units and "Normal cubic meter" [#11211](https://github.com/grafana/grafana/issues/11211), thx [@flopp999](https://github.com/flopp999)
* **Units**: New currency - Czech koruna [#11384](https://github.com/grafana/grafana/pull/11384), thx [@Rohlik](https://github.com/Rohlik)
* **Avatar**: Fix DISABLE_GRAVATAR option [#11095](https://github.com/grafana/grafana/issues/11095)
* **Heatmap**: Disable log scale when using time time series buckets [#10792](https://github.com/grafana/grafana/issues/10792)
* **Provisioning**: Remove `id` from json when provisioning dashboards, [#11138](https://github.com/grafana/grafana/issues/11138)
* **Prometheus**: tooltip for legend format not showing properly [#11516](https://github.com/grafana/grafana/issues/11516), thx [@svenklemm](https://github.com/svenklemm)
* **Playlist**: Empty playlists cannot be deleted [#11133](https://github.com/grafana/grafana/issues/11133), thx [@kichristensen](https://github.com/kichristensen)
* **Switch Orgs**: Alphabetic order in Switch Organization modal [#11556](https://github.com/grafana/grafana/issues/11556)
* **Postgres**: improve `$__timeFilter` macro [#11578](https://github.com/grafana/grafana/issues/11578), thx [@svenklemm](https://github.com/svenklemm)
* **Permission list**: Improved ux [#10747](https://github.com/grafana/grafana/issues/10747)
* **Dashboard**: Sizing and positioning of settings menu icons [#11572](https://github.com/grafana/grafana/pull/11572)
* **Dashboard**: Add search filter/tabs to new panel control [#10427](https://github.com/grafana/grafana/issues/10427)
* **Folders**: User with org viewer role should not be able to save/move dashboards in/to general folder [#11553](https://github.com/grafana/grafana/issues/11553)
* **Influxdb**: Don't assume the first column in table response is time. [#11476](https://github.com/grafana/grafana/issues/11476), thx [@hahnjo](https://github.com/hahnjo)

### Tech
* Backend code simplification [#11613](https://github.com/grafana/grafana/pull/11613), thx [@knweiss](https://github.com/knweiss)
* Add codespell to CI [#11602](https://github.com/grafana/grafana/pull/11602), thx [@mjtrangoni](https://github.com/mjtrangoni)
* Migrated JavaScript files to TypeScript

# 5.0.4 (2018-03-28)

* **Docker** Can't start Grafana on Kubernetes 1.7.14, 1.8.9, or 1.9.4 [#140 in grafana-docker repo](https://github.com/grafana/grafana-docker/issues/140) thx [@suquant](https://github.com/suquant)
* **Dashboard** Fixed bug where collapsed panels could not be directly linked to/renderer [#11114](https://github.com/grafana/grafana/issues/11114) & [#11086](https://github.com/grafana/grafana/issues/11086) & [#11296](https://github.com/grafana/grafana/issues/11296)
* **Dashboard** Provisioning dashboard with alert rules should create alerts [#11247](https://github.com/grafana/grafana/issues/11247)
* **Snapshots** For snapshots, the Graph panel renders the legend incorrectly on right hand side [#11318](https://github.com/grafana/grafana/issues/11318)
* **Alerting** Link back to Grafana returns wrong URL if root_path contains sub-path components [#11403](https://github.com/grafana/grafana/issues/11403)
* **Alerting** Incorrect default value for upload images setting for alert notifiers [#11413](https://github.com/grafana/grafana/pull/11413)

# 5.0.3 (2018-03-16)
* **Mysql**: Mysql panic occurring occasionally upon Grafana dashboard access (a bigger patch than the one in 5.0.2) [#11155](https://github.com/grafana/grafana/issues/11155)

# 5.0.2 (2018-03-14)
* **Mysql**: Mysql panic occurring occasionally upon Grafana dashboard access [#11155](https://github.com/grafana/grafana/issues/11155)
* **Dashboards**: Should be possible to browse dashboard using only uid [#11231](https://github.com/grafana/grafana/issues/11231)
* **Alerting**: Fixes bug where alerts from hidden panels where deleted [#11222](https://github.com/grafana/grafana/issues/11222)
* **Import**: Fixes bug where dashboards with alerts couldn't be imported [#11227](https://github.com/grafana/grafana/issues/11227)
* **Teams**: Remove quota restrictions from teams [#11220](https://github.com/grafana/grafana/issues/11220)
* **Render**: Fixes bug with legacy url redirection for panel rendering [#11180](https://github.com/grafana/grafana/issues/11180)

# 5.0.1 (2018-03-08)

* **Postgres**: PostgreSQL error when using ipv6 address as hostname in connection string [#11055](https://github.com/grafana/grafana/issues/11055), thanks [@svenklemm](https://github.com/svenklemm)
* **Dashboards**: Changing templated value from dropdown is causing unsaved changes [#11063](https://github.com/grafana/grafana/issues/11063)
* **Prometheus**: Fixes bundled Prometheus 2.0 dashboard [#11016](https://github.com/grafana/grafana/issues/11016), thx [@roidelapluie](https://github.com/roidelapluie)
* **Sidemenu**: Profile menu "invisible" when gravatar is disabled [#11097](https://github.com/grafana/grafana/issues/11097)
* **Dashboard**: Fixes a bug with resizable handles for panels [#11103](https://github.com/grafana/grafana/issues/11103)
* **Alerting**: Telegram inline image mode fails when caption too long [#10975](https://github.com/grafana/grafana/issues/10975)
* **Alerting**: Fixes silent failing validation [#11145](https://github.com/grafana/grafana/pull/11145)
* **OAuth**: Only use jwt token if it contains an email address [#11127](https://github.com/grafana/grafana/pull/11127)

# 5.0.0-stable (2018-03-01)

### Fixes

- **oauth** Fix Github OAuth not working with private Organizations [#11028](https://github.com/grafana/grafana/pull/11028) [@lostick](https://github.com/lostick)
- **kiosk** white area over bottom panels in kiosk mode [#11010](https://github.com/grafana/grafana/issues/11010)
- **alerting** Fix OK state doesn't show up in Microsoft Teams [#11032](https://github.com/grafana/grafana/pull/11032), thx [@manacker](https://github.com/manacker)

# 5.0.0-beta5 (2018-02-26)

### Fixes

- **Orgs** Unable to switch org when too many orgs listed [#10774](https://github.com/grafana/grafana/issues/10774)
- **Folders** Make it easier/explicit to access/modify folders using the API [#10630](https://github.com/grafana/grafana/issues/10630)
- **Dashboard** Scrollbar works incorrectly in Grafana 5.0 Beta4 in some cases [#10982](https://github.com/grafana/grafana/issues/10982)
- **ElasticSearch** Custom aggregation sizes no longer allowed for Elasticsearch [#10124](https://github.com/grafana/grafana/issues/10124)
- **oauth** Github OAuth with allowed organizations fails to login [#10964](https://github.com/grafana/grafana/issues/10964)
- **heatmap** Heatmap panel has partially hidden legend [#10793](https://github.com/grafana/grafana/issues/10793)
- **snapshots** Expired snapshots not being cleaned up [#10996](https://github.com/grafana/grafana/pull/10996)

# 5.0.0-beta4 (2018-02-19)

### Fixes

- **Dashboard** Fixed dashboard overwrite permission issue [#10814](https://github.com/grafana/grafana/issues/10814)
- **Keyboard shortcuts** Fixed Esc key when in panel edit/view mode [#10945](https://github.com/grafana/grafana/issues/10945)
- **Save dashboard** Fixed issue with time range & variable reset after saving [#10946](https://github.com/grafana/grafana/issues/10946)

# 5.0.0-beta3 (2018-02-16)

### Fixes

- **MySQL** Fixed new migration issue with index length [#10931](https://github.com/grafana/grafana/issues/10931)
- **Modal** Escape key no closes modals everywhere, fixes [#10887](https://github.com/grafana/grafana/issues/10887)
- **Row repeats** Fix for repeating rows issue, fixes [#10932](https://github.com/grafana/grafana/issues/10932)
- **Docs** Team api documented, fixes [#10832](https://github.com/grafana/grafana/issues/10832)
- **Plugins** Plugin info page broken, fixes [#10943](https://github.com/grafana/grafana/issues/10943)

# 5.0.0-beta2 (2018-02-15)

### Fixes

- **Permissions** Fixed search permissions issues [#10822](https://github.com/grafana/grafana/issues/10822)
- **Permissions** Fixed problem issues displaying permissions lists [#10864](https://github.com/grafana/grafana/issues/10864)
- **PNG-Rendering** Fixed problem rendering legend to the right [#10526](https://github.com/grafana/grafana/issues/10526)
- **Reset password** Fixed problem with reset password form [#10870](https://github.com/grafana/grafana/issues/10870)
- **Light theme** Fixed problem with light theme in safari, [#10869](https://github.com/grafana/grafana/issues/10869)
- **Provisioning** Now handles deletes when dashboard json files removed from disk [#10865](https://github.com/grafana/grafana/issues/10865)
- **MySQL** Fixed issue with schema migration on old mysql (index too long) [#10779](https://github.com/grafana/grafana/issues/10779)
- **Github OAuth** Fixed fetching github orgs from private github org [#10823](https://github.com/grafana/grafana/issues/10823)
- **Embedding** Fixed issues embedding panel [#10787](https://github.com/grafana/grafana/issues/10787)

# 5.0.0-beta1 (2018-02-05)

Grafana v5.0 is going to be the biggest and most foundational release Grafana has ever had, coming with a ton of UX improvements, a new dashboard grid engine, dashboard folders, user teams and permissions. Checkout out this [video preview](https://www.youtube.com/watch?v=Izr0IBgoTZQ) of Grafana v5.

### New Major Features
- **Dashboards** Dashboard folders, [#1611](https://github.com/grafana/grafana/issues/1611)
- **Teams** User groups (teams) implemented. Can be used in folder & dashboard permission list.
- **Dashboard grid**: Panels are now laid out in a two dimensional grid (with x, y, w, h). [#9093](https://github.com/grafana/grafana/issues/9093).
- **Templating**: Vertical repeat direction for panel repeats.
- **UX**: Major update to page header and navigation
- **Dashboard settings**: Combine dashboard settings views into one with side menu, [#9750](https://github.com/grafana/grafana/issues/9750)
- **Persistent dashboard url's**: New url's for dashboards that allows renaming dashboards without breaking links. [#7883](https://github.com/grafana/grafana/issues/7883)

## Breaking changes

* **[dashboard.json]** have been replaced with [dashboard provisioning](http://docs.grafana.org/administration/provisioning/).
Config files for provisioning data sources as configuration have changed from `/conf/datasources` to `/conf/provisioning/datasources`.
From `/etc/grafana/datasources` to `/etc/grafana/provisioning/datasources` when installed with deb/rpm packages.

* **Pagerduty** The notifier now defaults to not auto resolve incidents. More details at [#10222](https://github.com/grafana/grafana/issues/10222)

* **HTTP API**
  - `GET /api/alerts` property dashboardUri renamed to url and is now the full url (that is including app sub url).

## New Dashboard Grid

The new grid engine is a major upgrade for how you can position and move panels. It enables new layouts and a much easier dashboard building experience. The change is backward compatible. So you can upgrade your current version to 5.0 without breaking dashboards, but you cannot downgrade from 5.0 to previous versions. Grafana will automatically upgrade your dashboards to the new schema and position panels to match your existing layout. There might be minor differences in panel height. If you upgrade to 5.0 and for some reason want to rollback to the previous version you can restore dashboards to previous versions using dashboard history. But that should only be seen as an emergency solution.

Dashboard panels and rows are positioned using a gridPos object `{x: 0, y: 0, w: 24, h: 5}`. Units are in grid dimensions (24 columns, 1 height unit 30px). Rows and Panels objects exist (together) in a flat array directly on the dashboard root object. Rows are not needed for layouts anymore and are mainly there for backward compatibility. Some panel plugins that do not respect their panel height might require an update.

## New Features
* **Alerting**: Add support for internal image store [#6922](https://github.com/grafana/grafana/issues/6922), thx [@FunkyM](https://github.com/FunkyM)
* **Data Source Proxy**: Add support for whitelisting specified cookies that will be passed through to the data source when proxying data source requests [#5457](https://github.com/grafana/grafana/issues/5457), thanks [@robingustafsson](https://github.com/robingustafsson)
* **Postgres/MySQL**: add __timeGroup macro for mysql [#9596](https://github.com/grafana/grafana/pull/9596), thanks [@svenklemm](https://github.com/svenklemm)
* **Text**: Text panel are now edited in the ace editor. [#9698](https://github.com/grafana/grafana/pull/9698), thx [@mtanda](https://github.com/mtanda)
* **Teams**: Add Microsoft Teams notifier as  [#8523](https://github.com/grafana/grafana/issues/8523), thx [@anthu](https://github.com/anthu)
* **Data Sources**: Its now possible to configure data sources with config files [#1789](https://github.com/grafana/grafana/issues/1789)
* **Graphite**: Query editor updated to support new query by tag features [#9230](https://github.com/grafana/grafana/issues/9230)
* **Dashboard history**: New config file option versions_to_keep sets how many versions per dashboard to store, [#9671](https://github.com/grafana/grafana/issues/9671)
* **Dashboard as cfg**: Load dashboards from file into Grafana on startup/change [#9654](https://github.com/grafana/grafana/issues/9654) [#5269](https://github.com/grafana/grafana/issues/5269)
* **Prometheus**: Grafana can now send alerts to Prometheus Alertmanager while firing [#7481](https://github.com/grafana/grafana/issues/7481), thx [@Thib17](https://github.com/Thib17) and [@mtanda](https://github.com/mtanda)
* **Table**: Support multiple table formatted queries in table panel [#9170](https://github.com/grafana/grafana/issues/9170), thx [@davkal](https://github.com/davkal)
* **Security**: Protect against brute force (frequent) login attempts [#7616](https://github.com/grafana/grafana/issues/7616)

## Minor
* **Graph**: Don't hide graph display options (Lines/Points) when draw mode is unchecked [#9770](https://github.com/grafana/grafana/issues/9770), thx [@Jonnymcc](https://github.com/Jonnymcc)
* **Prometheus**: Show label name in paren after by/without/on/ignoring/group_left/group_right [#9664](https://github.com/grafana/grafana/pull/9664), thx [@mtanda](https://github.com/mtanda)
* **Alert panel**: Adds placeholder text when no alerts are within the time range [#9624](https://github.com/grafana/grafana/issues/9624), thx [@straend](https://github.com/straend)
* **Mysql**: MySQL enable MaxOpenCon and MaxIdleCon regards how constring is configured.  [#9784](https://github.com/grafana/grafana/issues/9784), thx [@dfredell](https://github.com/dfredell)
* **Cloudwatch**: Fixes broken query inspector for cloudwatch [#9661](https://github.com/grafana/grafana/issues/9661), thx [@mtanda](https://github.com/mtanda)
* **Dashboard**: Make it possible to start dashboards from search and dashboard list panel [#1871](https://github.com/grafana/grafana/issues/1871)
* **Annotations**: Posting annotations now return the id of the annotation [#9798](https://github.com/grafana/grafana/issues/9798)
* **Systemd**: Use systemd notification ready flag [#10024](https://github.com/grafana/grafana/issues/10024), thx [@jgrassler](https://github.com/jgrassler)
* **Github**: Use organizations_url provided from github to verify user belongs in org. [#10111](https://github.com/grafana/grafana/issues/10111), thx
[@adiletmaratov](https://github.com/adiletmaratov)
* **Backend**: Fixed bug where Grafana exited before all sub routines where finished [#10131](https://github.com/grafana/grafana/issues/10131)
* **Azure**: Adds support for Azure blob storage as external image stor [#8955](https://github.com/grafana/grafana/issues/8955), thx [@saada](https://github.com/saada)
* **Telegram**: Add support for inline image uploads to telegram notifier plugin [#9967](https://github.com/grafana/grafana/pull/9967), thx [@rburchell](https://github.com/rburchell)

## Fixes
* **Sensu**: Send alert message to sensu output [#9551](https://github.com/grafana/grafana/issues/9551), thx [@cjchand](https://github.com/cjchand)
* **Singlestat**: suppress error when result contains no datapoints [#9636](https://github.com/grafana/grafana/issues/9636), thx [@utkarshcmu](https://github.com/utkarshcmu)
* **Postgres/MySQL**: Control quoting in SQL-queries when using template variables [#9030](https://github.com/grafana/grafana/issues/9030), thanks [@svenklemm](https://github.com/svenklemm)
* **Pagerduty**: Pagerduty don't auto resolve incidents by default anymore. [#10222](https://github.com/grafana/grafana/issues/10222)
* **Cloudwatch**: Fix for multi-valued templated queries. [#9903](https://github.com/grafana/grafana/issues/9903)

## Tech
* **RabbitMq**: Remove support for publishing events to RabbitMQ [#9645](https://github.com/grafana/grafana/issues/9645)

## Deprecation notes

### HTTP API
The following operations have been deprecated and will be removed in a future release:
  - `GET /api/dashboards/db/:slug` -> Use `GET /api/dashboards/uid/:uid` instead
  - `DELETE /api/dashboards/db/:slug` -> Use `DELETE /api/dashboards/uid/:uid` instead

The following properties have been deprecated and will be removed in a future release:
  - `uri` property in `GET /api/search` -> Use new `url` or `uid` property instead
  - `meta.slug` property in `GET /api/dashboards/uid/:uid` and `GET /api/dashboards/db/:slug` -> Use new `meta.url` or `dashboard.uid` property instead

# 4.6.4 (2018-08-29)

### Important fix for LDAP & OAuth login vulnerability

See [security announcement](https://community.grafana.com/t/grafana-5-2-3-and-4-6-4-security-update/10050) for details.

# 4.6.3 (2017-12-14)

## Fixes
* **Gzip**: Fixes bug gravatar images when gzip was enabled [#5952](https://github.com/grafana/grafana/issues/5952)
* **Alert list**: Now shows alert state changes even after adding manual annotations on dashboard [#9951](https://github.com/grafana/grafana/issues/9951)
* **Alerting**: Fixes bug where rules evaluated as firing when all conditions was false and using OR operator. [#9318](https://github.com/grafana/grafana/issues/9318)
* **Cloudwatch**: CloudWatch no longer display metrics' default alias [#10151](https://github.com/grafana/grafana/issues/10151), thx [@mtanda](https://github.com/mtanda)

# 4.6.2 (2017-11-16)

## Important
* **Prometheus**: Fixes bug with new prometheus alerts in Grafana. Make sure to download this version if you're using Prometheus for alerting. More details in the issue. [#9777](https://github.com/grafana/grafana/issues/9777)

## Fixes
* **Color picker**: Bug after using textbox input field to change/paste color string [#9769](https://github.com/grafana/grafana/issues/9769)
* **Cloudwatch**: Fix for cloudwatch templating query `ec2_instance_attribute` [#9667](https://github.com/grafana/grafana/issues/9667), thanks [@mtanda](https://github.com/mtanda)
* **Heatmap**: Fixed tooltip for "time series buckets" mode [#9332](https://github.com/grafana/grafana/issues/9332)
* **InfluxDB**: Fixed query editor issue when using `>` or `<` operators in WHERE clause [#9871](https://github.com/grafana/grafana/issues/9871)


# 4.6.1 (2017-11-01)

* **Singlestat**: Lost thresholds when using save dashboard as [#9681](https://github.com/grafana/grafana/issues/9681)
* **Graph**: Fix for series override color picker [#9715](https://github.com/grafana/grafana/issues/9715)
* **Go**: build using golang 1.9.2 [#9713](https://github.com/grafana/grafana/issues/9713)
* **Plugins**: Fixed problem with loading plugin js files behind auth proxy [#9509](https://github.com/grafana/grafana/issues/9509)
* **Graphite**: Annotation tooltip should render empty string when undefined [#9707](https://github.com/grafana/grafana/issues/9707)

# 4.6.0 (2017-10-26)

## Fixes
* **Alerting**: Viewer can no longer pause alert rules [#9640](https://github.com/grafana/grafana/issues/9640)
* **Playlist**: Bug where playlist controls was missing [#9639](https://github.com/grafana/grafana/issues/9639)
* **Firefox**: Creating region annotations now work in firefox [#9638](https://github.com/grafana/grafana/issues/9638)

# 4.6.0-beta3 (2017-10-23)

## Fixes
* **Prometheus**: Fix for browser crash for short time ranges. [#9575](https://github.com/grafana/grafana/issues/9575)
* **Heatmap**: Fix for y-axis not showing. [#9576](https://github.com/grafana/grafana/issues/9576)
* **Save to file**: Fix for save to file in export modal. [#9586](https://github.com/grafana/grafana/issues/9586)
* **Postgres**: modify group by time macro so it can be used in select clause [#9527](https://github.com/grafana/grafana/pull/9527), thanks [@svenklemm](https://github.com/svenklemm)

# 4.6.0-beta2 (2017-10-17)

## Fixes
* **ColorPicker**: Fix for color picker not showing [#9549](https://github.com/grafana/grafana/issues/9549)
* **Alerting**: Fix for broken test rule button in alert tab [#9539](https://github.com/grafana/grafana/issues/9539)
* **Cloudwatch**: Provide error message when failing to add cloudwatch data source [#9534](https://github.com/grafana/grafana/pull/9534), thx [@mtanda](https://github.com/mtanda)
* **Cloudwatch**: Fix unused period parameter [#9536](https://github.com/grafana/grafana/pull/9536), thx [@mtanda](https://github.com/mtanda)
* **CSV Export**: Fix for broken CSV export [#9525](https://github.com/grafana/grafana/issues/9525)
* **Text panel**: Fix for issue with break lines in Firefox [#9491](https://github.com/grafana/grafana/issues/9491)
* **Annotations**: Fix for issue saving annotation event in MySQL DB [#9550](https://github.com/grafana/grafana/issues/9550), thanks [@krise3k](https://github.com/krise3k)


# 4.6.0-beta1 (2017-10-13)

## New Features
* **Annotations**: Add support for creating annotations from graph panel [#8197](https://github.com/grafana/grafana/pull/8197)
* **GCS**: Adds support for Google Cloud Storage [#8370](https://github.com/grafana/grafana/issues/8370) thx [@chuhlomin](https://github.com/chuhlomin)
* **Prometheus**: Adds /metrics endpoint for exposing Grafana metrics. [#9187](https://github.com/grafana/grafana/pull/9187)
* **Graph**: Add support for local formatting in axis. [#1395](https://github.com/grafana/grafana/issues/1395), thx [@m0nhawk](https://github.com/m0nhawk)
* **Jaeger**: Add support for open tracing using jaeger in Grafana. [#9213](https://github.com/grafana/grafana/pull/9213)
* **Unit types**: New date & time unit types added, useful in singlestat to show dates & times. [#3678](https://github.com/grafana/grafana/issues/3678), [#6710](https://github.com/grafana/grafana/issues/6710), [#2764](https://github.com/grafana/grafana/issues/2764)
* **CLI**: Make it possible to install plugins from any url [#5873](https://github.com/grafana/grafana/issues/5873)
* **Prometheus**: Add support for instant queries [#5765](https://github.com/grafana/grafana/issues/5765), thx [@mtanda](https://github.com/mtanda)
* **Cloudwatch**: Add support for alerting using the cloudwatch data source [#8050](https://github.com/grafana/grafana/pull/8050), thx [@mtanda](https://github.com/mtanda)
* **Pagerduty**: Include triggering series in pagerduty notification [#8479](https://github.com/grafana/grafana/issues/8479), thx [@rickymoorhouse](https://github.com/rickymoorhouse)
* **Timezone**: Time ranges like Today & Yesterday now work correctly when timezone setting is set to UTC [#8916](https://github.com/grafana/grafana/issues/8916), thx [@ctide](https://github.com/ctide)
* **Prometheus**: Align $__interval with the step parameters. [#9226](https://github.com/grafana/grafana/pull/9226), thx [@alin-amana](https://github.com/alin-amana)
* **Prometheus**: Autocomplete for label name and label value [#9208](https://github.com/grafana/grafana/pull/9208), thx [@mtanda](https://github.com/mtanda)
* **Postgres**: New Postgres data source [#9209](https://github.com/grafana/grafana/pull/9209), thx [@svenklemm](https://github.com/svenklemm)
* **Data sources**: Make data source HTTP requests verify TLS by default. closes [#9371](https://github.com/grafana/grafana/issues/9371), [#5334](https://github.com/grafana/grafana/issues/5334), [#8812](https://github.com/grafana/grafana/issues/8812), thx [@mattbostock](https://github.com/mattbostock)
* **OAuth**: Verify TLS during OAuth callback [#9373](https://github.com/grafana/grafana/issues/9373), thx [@mattbostock](https://github.com/mattbostock)

## Minor
* **SMTP**: Make it possible to set specific HELO for smtp client. [#9319](https://github.com/grafana/grafana/issues/9319)
* **Dataproxy**: Allow grafana to renegotiate tls connection [#9250](https://github.com/grafana/grafana/issues/9250)
* **HTTP**: set net.Dialer.DualStack to true for all http clients [#9367](https://github.com/grafana/grafana/pull/9367)
* **Alerting**: Add diff and percent diff as series reducers [#9386](https://github.com/grafana/grafana/pull/9386), thx [@shanhuhai5739](https://github.com/shanhuhai5739)
* **Slack**: Allow images to be uploaded to slack when Token is present [#7175](https://github.com/grafana/grafana/issues/7175), thx [@xginn8](https://github.com/xginn8)
* **Opsgenie**: Use their latest API instead of old version [#9399](https://github.com/grafana/grafana/pull/9399), thx [@cglrkn](https://github.com/cglrkn)
* **Table**: Add support for displaying the timestamp with milliseconds [#9429](https://github.com/grafana/grafana/pull/9429), thx [@s1061123](https://github.com/s1061123)
* **Hipchat**: Add metrics, message and image to hipchat notifications [#9110](https://github.com/grafana/grafana/issues/9110), thx [@eloo](https://github.com/eloo)
* **Kafka**: Add support for sending alert notifications to kafka [#7104](https://github.com/grafana/grafana/issues/7104), thx [@utkarshcmu](https://github.com/utkarshcmu)
* **Alerting**: add count_non_null as series reducer [#9516](https://github.com/grafana/grafana/issues/9516)

## Tech
* **Go**: Grafana is now built using golang 1.9
* **Webpack**: Changed from systemjs to webpack (see readme or building from source guide for new build instructions). Systemjs is still used to load plugins but now plugins can only import a limited set of dependencies. See [PLUGIN_DEV.md](https://github.com/grafana/grafana/blob/master/PLUGIN_DEV.md) for more details on how this can effect some plugins.

# 4.5.2 (2017-09-22)

## Fixes
* **Graphite**: Fix for issues with jsonData & graphiteVersion null errors [#9258](https://github.com/grafana/grafana/issues/9258)
* **Graphite**: Fix for Grafana internal metrics to Graphite sending NaN values [#9279](https://github.com/grafana/grafana/issues/9279)
* **HTTP API**: Fix for HEAD method requests [#9307](https://github.com/grafana/grafana/issues/9307)
* **Templating**: Fix for duplicate template variable queries when refresh is set to time range change [#9185](https://github.com/grafana/grafana/issues/9185)
* **Metrics**: don't write NaN values to graphite [#9279](https://github.com/grafana/grafana/issues/9279)

# 4.5.1 (2017-09-15)

## Fixes
* **MySQL**: Fixed issue with query editor not showing [#9247](https://github.com/grafana/grafana/issues/9247)

## Breaking changes
* **Metrics**: The metric structure for internal metrics about Grafana published to graphite has changed. This might break dashboards for internal metrics.

# 4.5.0 (2017-09-14)

## Fixes & Enhancements since beta1
* **Security**: Security fix for api vulnerability (in multiple org setups).
* **Shortcuts**: Adds shortcut for creating new dashboard [#8876](https://github.com/grafana/grafana/pull/8876) thx [@mtanda](https://github.com/mtanda)
* **Graph**: Right Y-Axis label position fixed [#9172](https://github.com/grafana/grafana/pull/9172)
* **General**: Improve rounding of time intervals [#9197](https://github.com/grafana/grafana/pull/9197), thx [@alin-amana](https://github.com/alin-amana)

# 4.5.0-beta1 (2017-09-05)

## New Features

* **Table panel**: Render cell values as links that can have an url template that uses variables from current table row. [#3754](https://github.com/grafana/grafana/issues/3754)
* **Elasticsearch**: Add ad hoc filters directly by clicking values in table panel [#8052](https://github.com/grafana/grafana/issues/8052).
* **MySQL**: New rich query editor with syntax highlighting
* **Prometheus**: New rich query editor with syntax highlighting, metric & range auto complete and integrated function docs. [#5117](https://github.com/grafana/grafana/issues/5117)

## Enhancements

* **GitHub OAuth**: Support for GitHub organizations with 100+ teams. [#8846](https://github.com/grafana/grafana/issues/8846), thx [@skwashd](https://github.com/skwashd)
* **Graphite**: Calls to Graphite api /metrics/find now include panel or dashboard time range (from & until) in most cases, [#8055](https://github.com/grafana/grafana/issues/8055)
* **Graphite**: Added new graphite 1.0 functions, available if you set version to 1.0.x in data source settings. New Functions: mapSeries, reduceSeries, isNonNull, groupByNodes, offsetToZero, grep, weightedAverage, removeEmptySeries, aggregateLine, averageOutsidePercentile, delay, exponentialMovingAverage, fallbackSeries, integralByInterval, interpolate, invert, linearRegression, movingMin, movingMax, movingSum, multiplySeriesWithWildcards, pow, powSeries, removeBetweenPercentile, squareRoot, timeSlice, closes [#8261](https://github.com/grafana/grafana/issues/8261)
- **Elasticsearch**: Ad-hoc filters now use query phrase match filters instead of term filters, works on non keyword/raw fields [#9095](https://github.com/grafana/grafana/issues/9095).

### Breaking change

* **InfluxDB/Elasticsearch**: The panel & data source option named "Group by time interval" is now named "Min time interval" and does now always define a lower limit for the auto group by time. Without having to use `>` prefix (that prefix still works). This should in theory have close to zero actual impact on existing dashboards. It does mean that if you used this setting to define a hard group by time interval of, say "1d", if you zoomed to a time range wide enough the time range could increase above the "1d" range as the setting is now always considered a lower limit.
* **Elasticsearch**: Elasticsearch metric queries without date histogram now return table formatted data making table panel much easier to use for this use case. Should not break/change existing dashboards with stock panels but external panel plugins can be affected.

## Changes

* **InfluxDB**: Change time range filter for absolute time ranges to be inclusive instead of exclusive [#8319](https://github.com/grafana/grafana/issues/8319), thx [@Oxydros](https://github.com/Oxydros)
* **InfluxDB**: Added parenthesis around tag filters in queries [#9131](https://github.com/grafana/grafana/pull/9131)

## Bug Fixes

* **Modals**: Maintain scroll position after opening/leaving modal [#8800](https://github.com/grafana/grafana/issues/8800)
* **Templating**: You cannot select data source variables as data source for other template variables [#7510](https://github.com/grafana/grafana/issues/7510)
* **MySQL/Postgres**: Fix for max_idle_conn option default which was wrongly set to zero which does not mean unlimited but means zero, which in practice kind of disables connection pooling, which is not good. Fixes [#8513](https://github.com/grafana/grafana/issues/8513)

# 4.4.3 (2017-08-07)

## Bug Fixes

* **Search**: Fix for issue that caused search view to hide  when you clicked starred or tags filters, fixes [#8981](https://github.com/grafana/grafana/issues/8981)
* **Modals**: ESC key now closes modal again, fixes [#8981](https://github.com/grafana/grafana/issues/8988), thx [@j-white](https://github.com/j-white)

# 4.4.2 (2017-08-01)

## Bug Fixes

* **GrafanaDB(mysql)**: Fix for dashboard_version.data column type, now changed to MEDIUMTEXT, fixes [#8813](https://github.com/grafana/grafana/issues/8813)
* **Dashboard(settings)**: Closing setting views using ESC key did not update url correctly, fixes [#8869](https://github.com/grafana/grafana/issues/8869)
* **InfluxDB**: Wrong username/password parameter name when using direct access, fixes [#8789](https://github.com/grafana/grafana/issues/8789)
* **Forms(TextArea)**: Bug fix for no scroll in text areas [#8797](https://github.com/grafana/grafana/issues/8797)
* **Png Render API**: Bug fix for timeout url parameter. It now works as it should. Default value was also increased from 30 to 60 seconds [#8710](https://github.com/grafana/grafana/issues/8710)
* **Search**: Fix for not being able to close search by clicking on right side of search result container, [8848](https://github.com/grafana/grafana/issues/8848)
* **Cloudwatch**: Fix for using variables in templating metrics() query, [8965](https://github.com/grafana/grafana/issues/8965)

## Changes

* **Settings(defaults)**: allow_sign_up default changed from true to false [#8743](https://github.com/grafana/grafana/issues/8743)
* **Settings(defaults)**: allow_org_create default changed from true to false

# 4.4.1 (2017-07-05)

## Bug Fixes

* **Migrations**: migration fails where dashboard.created_by is null [#8783](https://github.com/grafana/grafana/issues/8783)

# 4.4.0 (2017-07-04)

## New Features
**Dashboard History**: View dashboard version history, compare any two versions (summary & json diffs), restore to old version. This big feature
was contributed by **Walmart Labs**. Big thanks to them for this massive contribution!
Initial feature request: [#4638](https://github.com/grafana/grafana/issues/4638)
Pull Request: [#8472](https://github.com/grafana/grafana/pull/8472)

## Enhancements
* **Elasticsearch**: Added filter aggregation label [#8420](https://github.com/grafana/grafana/pull/8420), thx [@tianzk](github.com/tianzk)
* **Sensu**: Added option for source and handler [#8405](https://github.com/grafana/grafana/pull/8405), thx [@joemiller](github.com/joemiller)
* **CSV**: Configurable csv export datetime format [#8058](https://github.com/grafana/grafana/issues/8058), thx [@cederigo](github.com/cederigo)
* **Table Panel**: Column style that preserves formatting/indentation (like pre tag) [#6617](https://github.com/grafana/grafana/issues/6617)
* **DingDing**: Add DingDing Alert Notifier [#8473](https://github.com/grafana/grafana/pull/8473) thx [@jiamliang](https://github.com/jiamliang)

## Minor Enhancements

* **Elasticsearch**: Add option for result set size in raw_document [#3426](https://github.com/grafana/grafana/issues/3426) [#8527](https://github.com/grafana/grafana/pull/8527), thx [@mk-dhia](github.com/mk-dhia)

## Bug Fixes

* **Graph**: Bug fix for negative values in histogram mode [#8628](https://github.com/grafana/grafana/issues/8628)

# 4.3.2 (2017-05-31)

## Bug fixes

* **InfluxDB**: Fixed issue with query editor not showing ALIAS BY input field when in text editor mode [#8459](https://github.com/grafana/grafana/issues/8459)
* **Graph Log Scale**: Fixed issue with log scale going below x-axis [#8244](https://github.com/grafana/grafana/issues/8244)
* **Playlist**: Fixed dashboard play order issue [#7688](https://github.com/grafana/grafana/issues/7688)
* **Elasticsearch**: Fixed table query issue with ES 2.x [#8467](https://github.com/grafana/grafana/issues/8467), thx [@goldeelox](https://github.com/goldeelox)

## Changes
* **Lazy Loading Of Panels**: Panels are no longer loaded as they are scrolled into view, this was reverted due to Chrome bug, might be reintroduced when Chrome fixes it's JS blocking behavior on scroll. [#8500](https://github.com/grafana/grafana/issues/8500)

# 4.3.1 (2017-05-23)

## Bug fixes

* **S3 image upload**: Fixed image url issue for us-east-1 (us standard) region. If you were missing slack images for alert notifications this should fix it. [#8444](https://github.com/grafana/grafana/issues/8444)

# 4.3.0-stable (2017-05-23)

## Bug fixes

* **Gzip**: Fixed crash when gzip was enabled [#8380](https://github.com/grafana/grafana/issues/8380)
* **Graphite**: Fixed issue with Toggle edit mode did in query editor [#8377](https://github.com/grafana/grafana/issues/8377)
* **Alerting**: Fixed issue with state history not showing query execution errors [#8412](https://github.com/grafana/grafana/issues/8412)
* **Alerting**: Fixed issue with missing state history events/annotations when using sqlite3 database [#7992](https://github.com/grafana/grafana/issues/7992)
* **Sqlite**: Fixed with database table locked and using sqlite3 database [#7992](https://github.com/grafana/grafana/issues/7992)
* **Alerting**: Fixed issue with annotations showing up in unsaved dashboards, new graph & alert panel. [#8361](https://github.com/grafana/grafana/issues/8361)
* **webdav**: Fixed http proxy env variable support for webdav image upload [#7922](https://github.com/grafana/grafana/issues/79222), thx [@berghauz](https://github.com/berghauz)
* **Prometheus**: Fixed issue with hiding query [#8413](https://github.com/grafana/grafana/issues/8413)

## Enhancements

* **VictorOps**:  Now supports panel image & auto resolve [#8431](https://github.com/grafana/grafana/pull/8431), thx [@davidmscott](https://github.com/davidmscott)
* **Alerting**:  Alert annotations now provide more info [#8421](https://github.com/grafana/grafana/pull/8421)

# 4.3.0-beta1 (2017-05-12)

## Enhancements

* **InfluxDB**: influxdb query builder support for ORDER BY and LIMIT (allows TOPN queries) [#6065](https://github.com/grafana/grafana/issues/6065) Support influxdb's SLIMIT Feature [#7232](https://github.com/grafana/grafana/issues/7232) thx [@thuck](https://github.com/thuck)
* **Panels**: Delay loading & Lazy load panels as they become visible (scrolled into view) [#5216](https://github.com/grafana/grafana/issues/5216) thx [@jifwin](https://github.com/jifwin)
* **Graph**: Support auto grid min/max when using log scale [#3090](https://github.com/grafana/grafana/issues/3090), thx [@bigbenhur](https://github.com/bigbenhur)
* **Graph**: Support for histograms [#600](https://github.com/grafana/grafana/issues/600)
* **Prometheus**: Support table response formats (column per label) [#6140](https://github.com/grafana/grafana/issues/6140), thx [@mtanda](https://github.com/mtanda)
* **Single Stat Panel**: support for non time series data [#6564](https://github.com/grafana/grafana/issues/6564)
* **Server**: Monitoring Grafana (health check endpoint) [#3302](https://github.com/grafana/grafana/issues/3302)
* **Heatmap**: Heatmap Panel [#7934](https://github.com/grafana/grafana/pull/7934)
* **Elasticsearch**: histogram aggregation [#3164](https://github.com/grafana/grafana/issues/3164)

## Minor Enhancements

* **InfluxDB**: Small fix for the "glow" when focus the field for LIMIT and SLIMIT [#7799](https://github.com/grafana/grafana/pull/7799) thx [@thuck](https://github.com/thuck)
* **Prometheus**: Make Prometheus query field a textarea [#7663](https://github.com/grafana/grafana/issues/7663), thx [@hagen1778](https://github.com/hagen1778)
* **Prometheus**: Step parameter changed semantics to min step to reduce the load on Prometheus and rendering in browser [#8073](https://github.com/grafana/grafana/pull/8073), thx [@bobrik](https://github.com/bobrik)
* **Templating**: Should not be possible to create self-referencing (recursive) template variable definitions [#7614](https://github.com/grafana/grafana/issues/7614) thx [@thuck](https://github.com/thuck)
* **Cloudwatch**: Correctly obtain IAM roles within ECS container tasks [#7892](https://github.com/grafana/grafana/issues/7892) thx [@gomlgs](https://github.com/gomlgs)
* **Units**: New number format: Scientific notation [#7781](https://github.com/grafana/grafana/issues/7781) thx [@cadnce](https://github.com/cadnce)
* **Oauth**: Add common type for oauth authorization errors [#6428](https://github.com/grafana/grafana/issues/6428) thx [@amenzhinsky](https://github.com/amenzhinsky)
* **Templating**: Data source variable now supports multi value and panel repeats [#7030](https://github.com/grafana/grafana/issues/7030) thx [@mtanda](https://github.com/mtanda)
* **Telegram**: Telegram alert is not sending metric and legend. [#8110](https://github.com/grafana/grafana/issues/8110), thx [@bashgeek](https://github.com/bashgeek)
* **Graph**: Support dashed lines [#514](https://github.com/grafana/grafana/issues/514), thx [@smalik03](https://github.com/smalik03)
* **Table**: Support to change column header text [#3551](https://github.com/grafana/grafana/issues/3551)
* **Alerting**: Better error when SMTP is not configured [#8093](https://github.com/grafana/grafana/issues/8093)
* **Pushover**: Add an option to attach graph image link in Pushover notification [#8043](https://github.com/grafana/grafana/issues/8043) thx [@devkid](https://github.com/devkid)
* **WebDAV**: Allow to set different ImageBaseUrl for WebDAV upload and image link [#7914](https://github.com/grafana/grafana/issues/7914)
* **Panels**: type-ahead mixed data source selection [#7697](https://github.com/grafana/grafana/issues/7697) thx [@mtanda](https://github.com/mtanda)
* **Security**:User enumeration problem [#7619](https://github.com/grafana/grafana/issues/7619)
* **InfluxDB**: Register new queries available in InfluxDB - Holt Winters [#5619](https://github.com/grafana/grafana/issues/5619) thx [@rikkuness](https://github.com/rikkuness)
* **Server**: Support listening on a UNIX socket [#4030](https://github.com/grafana/grafana/issues/4030), thx [@mitjaziv](https://github.com/mitjaziv)
* **Graph**: Support log scaling for values smaller 1 [#5278](https://github.com/grafana/grafana/issues/5278)
* **InfluxDB**: Slow 'select measurement' rendering for InfluxDB [#2524](https://github.com/grafana/grafana/issues/2524), thx [@sbhenderson](https://github.com/sbhenderson)
* **Config**: Configurable signout menu activation [#7968](https://github.com/grafana/grafana/pull/7968), thx [@seuf](https://github.com/seuf)

## Fixes
* **Table Panel**: Fixed annotation display in table panel, [#8023](https://github.com/grafana/grafana/issues/8023)
* **Dashboard**: If refresh is blocked due to tab not visible, then refresh when it becomes visible [#8076](https://github.com/grafana/grafana/issues/8076) thanks [@SimenB](https://github.com/SimenB)
* **Snapshots**: Fixed problem with annotations & snapshots [#7659](https://github.com/grafana/grafana/issues/7659)
* **Graph**: MetricSegment loses type when value is an asterisk [#8277](https://github.com/grafana/grafana/issues/8277), thx [@Gordiychuk](https://github.com/Gordiychuk)
* **Alerting**: Alert notifications do not show charts when using a non public S3 bucket [#8250](https://github.com/grafana/grafana/issues/8250) thx [@rogerswingle](https://github.com/rogerswingle)
* **Graph**: 100% client CPU usage on red alert glow animation [#8222](https://github.com/grafana/grafana/issues/8222)
* **InfluxDB**: Templating: "All" query does match too much [#8165](https://github.com/grafana/grafana/issues/8165)
* **Dashboard**: Description tooltip is not fully displayed [#7970](https://github.com/grafana/grafana/issues/7970)
* **Proxy**: Redirect after switching Org does not obey sub path in root_url (using reverse proxy) [#8089](https://github.com/grafana/grafana/issues/8089)
* **Templating**: Restoration of ad-hoc variable from URL does not work correctly [#8056](https://github.com/grafana/grafana/issues/8056) thx [@tamayika](https://github.com/tamayika)
* **InfluxDB**: timeFilter cannot be used twice in alerts [#7969](https://github.com/grafana/grafana/issues/7969)
* **MySQL**: 4-byte UTF8 not supported when using MySQL database (allows Emojis) [#7958](https://github.com/grafana/grafana/issues/7958)
* **Alerting**: api/alerts and api/alert/:id hold previous data for "message" and "Message" field when field value is changed from "some string" to empty string. [#7927](https://github.com/grafana/grafana/issues/7927)
* **Graph**: Cannot add fill below to series override [#7916](https://github.com/grafana/grafana/issues/7916)
* **InfluxDB**: Influxb Data source test passes even if the Database doesn't exist [#7864](https://github.com/grafana/grafana/issues/7864)
* **Prometheus**: Displaying Prometheus annotations is incredibly slow [#7750](https://github.com/grafana/grafana/issues/7750), thx [@mtanda](https://github.com/mtanda)
* **Graphite**: grafana generates empty find query to graphite -> 422 Unprocessable Entity [#7740](https://github.com/grafana/grafana/issues/7740)
* **Admin**: make organization filter case insensitive [#8194](https://github.com/grafana/grafana/issues/8194), thx [@Alexander-N](https://github.com/Alexander-N)

## Changes
* **Elasticsearch**: Changed elasticsearch Terms aggregation to default to Min Doc Count to 1, and sort order to Top [#8321](https://github.com/grafana/grafana/issues/8321)

## Tech

* **Library Upgrade**: inconshreveable/log15 outdated - no support for solaris [#8262](https://github.com/grafana/grafana/issues/8262)
* **Library Upgrade**: Upgrade Macaron [#7600](https://github.com/grafana/grafana/issues/7600)

# 4.2.0 (2017-03-22)
## Minor Enhancements
* **Templates**: Prevent use of the prefix `__` for templates in web UI [#7678](https://github.com/grafana/grafana/issues/7678)
* **Threema**: Add emoji to Threema alert notifications [#7676](https://github.com/grafana/grafana/pull/7676) thx [@dbrgn](https://github.com/dbrgn)
* **Panels**: Support dm3 unit [#7695](https://github.com/grafana/grafana/issues/7695) thx [@mitjaziv](https://github.com/mitjaziv)
* **Docs**: Added some details about Sessions in Postgres [#7694](https://github.com/grafana/grafana/pull/7694) thx [@rickard-von-essen](https://github.com/rickard-von-essen)
* **Influxdb**: Allow commas in template variables [#7681](https://github.com/grafana/grafana/issues/7681) thx [@thuck](https://github.com/thuck)
* **Cloudwatch**: stop using deprecated session.New() [#7736](https://github.com/grafana/grafana/issues/7736) thx [@mtanda](https://github.com/mtanda)
*TSDB**: Fix always take dashboard timezone into consideration when handle custom time ranges**: Pass dropcounter rate option if no max counter and no reset value or reset value as 0 is specified [#7743](https://github.com/grafana/grafana/pull/7743) thx [@r4um](https://github.com/r4um)
* **Templating**: support full resolution for $interval variable [#7696](https://github.com/grafana/grafana/pull/7696) thx [@mtanda](https://github.com/mtanda)
* **Elasticsearch**: Unique Count on string fields in ElasticSearch [#3536](https://github.com/grafana/grafana/issues/3536), thx [@pyro2927](https://github.com/pyro2927)
* **Templating**: Data source template variable that refers to other variable in regex filter [#6365](https://github.com/grafana/grafana/issues/6365) thx [@rlodge](https://github.com/rlodge)
* **Admin**: Global User List: add search and pagination [#7469](https://github.com/grafana/grafana/issues/7469)
* **User Management**: Invite UI is now disabled when login form is disabled [#7875](https://github.com/grafana/grafana/issues/7875)

## Bugfixes
* **Webhook**: Use proxy settings from environment variables [#7710](https://github.com/grafana/grafana/issues/7710)
* **Panels**: Deleting a dashboard with unsaved changes raises an error message [#7591](https://github.com/grafana/grafana/issues/7591) thx [@thuck](https://github.com/thuck)
* **Influxdb**: Query builder detects regex to easily for measurement [#7276](https://github.com/grafana/grafana/issues/7276) thx [@thuck](https://github.com/thuck)
* **Docs**: router_logging not documented [#7723](https://github.com/grafana/grafana/issues/7723)
* **Alerting**: Spelling mistake [#7739](https://github.com/grafana/grafana/pull/7739) thx [@woutersmit](https://github.com/woutersmit)
* **Alerting**: Graph legend scrolls to top when an alias is toggled/clicked [#7680](https://github.com/grafana/grafana/issues/7680) thx [@p4ddy1](https://github.com/p4ddy1)
* **Panels**: Fixed panel tooltip description after scrolling down [#7708](https://github.com/grafana/grafana/issues/7708) thx [@askomorokhov](https://github.com/askomorokhov)

# 4.2.0-beta1 (2017-02-27)

## Enhancements
* **Telegram**: Added Telegram alert notifier [#7098](https://github.com/grafana/grafana/pull/7098), thx [@leonoff](https://github.com/leonoff)
* **Templating**: Make $__interval and $__interval_ms global built in variables that can be used in by any data source (in panel queries), closes [#7190](https://github.com/grafana/grafana/issues/7190), closes [#6582](https://github.com/grafana/grafana/issues/6582)
* **S3 Image Store**: External s3 image store (used in alert notifications) now support AWS IAM Roles, closes [#6985](https://github.com/grafana/grafana/issues/6985), [#7058](https://github.com/grafana/grafana/issues/7058) thx [@mtanda](https://github.com/mtanda)
* **SingleStat**: Implements diff aggregation method for singlestat [#7234](https://github.com/grafana/grafana/issues/7234), thx [@oliverpool](https://github.com/oliverpool)
* **Dataproxy**: Added setting to enable more verbose logging in dataproxy [#7209](https://github.com/grafana/grafana/pull/7209), thx [@Ricky-N](https://github.com/Ricky-N)
* **Alerting**: Better information about why an alert triggered [#7035](https://github.com/grafana/grafana/issues/7035)
* **LINE**: Add LINE as alerting notification channel [#7301](https://github.com/grafana/grafana/pull/7301), thx [@huydx](https://github.com/huydx)
* **LINE**: Adds image to notification message [#7417](https://github.com/grafana/grafana/pull/7417), thx [@Erliz](https://github.com/Erliz)
* **Hipchat**: Adds support for sending alert notifications to hipchat [#6451](https://github.com/grafana/grafana/issues/6451), thx [@jregovic](https://github.com/jregovic)
* **Alerting**: Uploading images for alert notifications is now optional [#7419](https://github.com/grafana/grafana/issues/7419)
* **Dashboard**: Adds shortcut for collapsing/expanding all rows [#552](https://github.com/grafana/grafana/issues/552), thx [@mtanda](https://github.com/mtanda)
* **Alerting**: Adds de duping of alert notifications [#7632](https://github.com/grafana/grafana/pull/7632)
* **Orgs**: Sharing dashboards using Grafana share feature will now redirect to correct org. [#1613](https://github.com/grafana/grafana/issues/1613)
* **Pushover**: Add Pushover alert notifications [#7526](https://github.com/grafana/grafana/pull/7526) thx [@devkid](https://github.com/devkid)
* **Threema**: Add Threema Gateway alert notification integration [#7482](https://github.com/grafana/grafana/pull/7482) thx [@dbrgn](https://github.com/dbrgn)

## Minor Enhancements
* **Optimzation**: Never issue refresh event when Grafana tab is not visible [#7218](https://github.com/grafana/grafana/issues/7218), thx [@mtanda](https://github.com/mtanda)
* **Browser History**: Browser back/forward now works time ranges / zoom, [#7259](https://github.com/grafana/grafana/issues/7259)
* **Elasticsearch**: Support for Min Doc Count options in Terms aggregation [#7324](https://github.com/grafana/grafana/pull/7324), thx [@lpic10](https://github.com/lpic10)
* **Elasticsearch**: Term aggregation limit can now be changed in template queries [#7112](https://github.com/grafana/grafana/issues/7112), thx [@FFalcon](https://github.com/FFalcon)
* **Elasticsearch**: Ad-hoc filters now support all operators [#7612](https://github.com/grafana/grafana/issues/7612), thx [@tamayika](https://github.com/tamayika)
* **Graph**: Add full series name as title for legends. [#7493](https://github.com/grafana/grafana/pull/7493), thx [@kolobaev](https://github.com/kolobaev)
* **Table**: Add a message when queries returns no data. [#6109](https://github.com/grafana/grafana/issues/6109), thx [@xginn8](https://github.com/xginn8)
* **Graph**: Set max width for series names in legend tables. [#2385](https://github.com/grafana/grafana/issues/2385), thx [@kolobaev](https://github.com/kolobaev)
* **Database**: Allow max db connection pool configuration [#7427](https://github.com/grafana/grafana/issues/7427), thx [@huydx](https://github.com/huydx)
* **Data Sources** Delete datsource by name [#7476](https://github.com/grafana/grafana/issues/7476), thx [@huydx](https://github.com/huydx)
* **Dataproxy**: Only allow get that begins with api/ to access Prometheus [#7459](https://github.com/grafana/grafana/pull/7459), thx [@mtanda](https://github.com/mtanda)
* **Snapshot**: Make timeout for snapshot creation configurable [#7449](https://github.com/grafana/grafana/pull/7449) thx [@ryu1-sakai](https://github.com/ryu1-sakai)
* **Panels**: Add more physics units [#7554](https://github.com/grafana/grafana/pull/7554) thx [@ryantxu](https://github.com/ryantxu)
* **Email**: Add sender's name on email [#2131](https://github.com/grafana/grafana/issues/2131) thx [@jacobbednarz](https://github.com/jacobbednarz)
* **HTTPS**: Set tls 1.2 as lowest tls version. [#7347](https://github.com/grafana/grafana/pull/7347) thx [@roman-vynar](https://github.com/roman-vynar)
* **Table**: Added suppressing of empty results to table plugin. [#7602](https://github.com/grafana/grafana/pull/7602) thx [@LLIyRiK](https://github.com/LLIyRiK)

## Tech

* **Library Upgrade**: Upgraded angularjs from 1.5.8 to 1.6.1 [#7274](https://github.com/grafana/grafana/issues/7274)
* **Backend**: Grafana is now built using golang 1.8

## Bugfixes
* **Alerting**: Fixes missing support for no_data and execution error when testing alerts [#7149](https://github.com/grafana/grafana/issues/7149)
* **Dashboard**: Avoid duplicate data in dashboard json for panels with alerts [#7256](https://github.com/grafana/grafana/pull/7256)
* **Alertlist**: Only show scrollbar when required [#7269](https://github.com/grafana/grafana/issues/7269)
* **SMTP**: Set LocalName to hostname [#7223](https://github.com/grafana/grafana/issues/7223)
* **Sidemenu**: Disable sign out in sidemenu for AuthProxyEnabled [#7377](https://github.com/grafana/grafana/pull/7377), thx [@solugebefola](https://github.com/solugebefola)
* **Prometheus**: Add support for basic auth in Prometheus tsdb package [#6799](https://github.com/grafana/grafana/issues/6799), thx [@hagen1778](https://github.com/hagen1778)
* **OAuth**: Redirect to original page when logging in with OAuth [#7513](https://github.com/grafana/grafana/issues/7513)
* **Annotations**: Wrap text in annotations tooltip [#7542](https://github.com/grafana/grafana/pull/7542), thx [@xginn8](https://github.com/xginn8)
* **Templating**: Fixes error when using numeric sort on empty strings [#7382](https://github.com/grafana/grafana/issues/7382)
* **Templating**: Fixed issue detecting template variable dependency [#7354](https://github.com/grafana/grafana/issues/7354)

# 4.1.2 (2017-02-13)

### Bugfixes
* **Table**: Fixes broken annotation rendering mode in the table panel [#7268](https://github.com/grafana/grafana/issues/7268)
* **Data Sources**: Sorting for lists of data sources in UI is now case insensitive [#7491](https://github.com/grafana/grafana/issues/7491)
* **Admin**: Support more then 1000 users in global users list [#7469](https://github.com/grafana/grafana/issues/7469)

# 4.1.1 (2017-01-11)

### Bugfixes
* **Graph Panel**: Fixed issue with legend height in table mode [#7221](https://github.com/grafana/grafana/issues/7221)

# 4.1.0 (2017-01-11)

### Bugfixes
* **Server side PNG rendering**: Fixed issue with y-axis label rotation in phantomjs rendered images [#6924](https://github.com/grafana/grafana/issues/6924)
* **Graph**: Fixed centering of y-axis label [#7099](https://github.com/grafana/grafana/issues/7099)
* **Graph**: Fixed graph legend table mode and always visible scrollbar [#6828](https://github.com/grafana/grafana/issues/6828)
* **Templating**: Fixed template variable value groups/tags feature [#6752](https://github.com/grafana/grafana/issues/6752)
* **Webhook**: Fixed webhook username mismatch [#7195](https://github.com/grafana/grafana/pull/7195), thx [@theisenmark](https://github.com/theisenmark)
* **Influxdb**: Handles time(auto) the same way as time($interval) [#6997](https://github.com/grafana/grafana/issues/6997)

## Enhancements
* **Elasticsearch**: Added support for all moving average options [#7154](https://github.com/grafana/grafana/pull/7154), thx [@vaibhavinbayarea](https://github.com/vaibhavinbayarea)

# 4.1-beta1 (2016-12-21)

### Enhancements
* **Postgres**: Add support for Certs for Postgres database [#6655](https://github.com/grafana/grafana/issues/6655)
* **Victorops**: Add VictorOps notification integration [#6411](https://github.com/grafana/grafana/issues/6411), thx [@ichekrygin](https://github.com/ichekrygin)
* **Opsgenie**: Add OpsGenie notification integratiion [#6687](https://github.com/grafana/grafana/issues/6687), thx [@kylemcc](https://github.com/kylemcc)
* **Singlestat**: New aggregation on singlestat panel [#6740](https://github.com/grafana/grafana/pull/6740), thx [@dirk-leroux](https://github.com/dirk-leroux)
* **Cloudwatch**: Make it possible to specify access and secret key on the data source config page [#6697](https://github.com/grafana/grafana/issues/6697)
* **Table**: Added Hidden Column Style for Table Panel [#5677](https://github.com/grafana/grafana/pull/5677), thx [@bmundt](https://github.com/bmundt)
* **Graph**: Shared crosshair option renamed to shared tooltip, shows tooltip on all graphs as you hover over one graph. [#1578](https://github.com/grafana/grafana/pull/1578), [#6274](https://github.com/grafana/grafana/pull/6274)
* **Elasticsearch**: Added support for Missing option (bucket) for terms aggregation [#4244](https://github.com/grafana/grafana/pull/4244), thx [@shanielh](https://github.com/shanielh)
* **Elasticsearch**: Added support for Elasticsearch 5.x [#5740](https://github.com/grafana/grafana/issues/5740), thx [@lpic10](https://github.com/lpic10)
* **CLI**: Make it possible to reset the admin password using the grafana-cli. [#5479](https://github.com/grafana/grafana/issues/5479)
* **Influxdb**: Support multiple tags in InfluxDB annotations. [#4550](https://github.com/grafana/grafana/pull/4550), thx [@adrianlzt](https://github.com/adrianlzt)
* **LDAP**:  Basic Auth now supports LDAP username and password, [#6940](https://github.com/grafana/grafana/pull/6940), thx [@utkarshcmu](https://github.com/utkarshcmu)
* **LDAP**: Now works with Auth Proxy, role and organization mapping & sync will regularly be performed. [#6895](https://github.com/grafana/grafana/pull/6895), thx [@Seuf](https://github.com/seuf)
* **Alerting**: Adds OK as no data option. [#6866](https://github.com/grafana/grafana/issues/6866)
* **Alert list**: Order alerts based on state. [#6676](https://github.com/grafana/grafana/issues/6676)
* **Alerting**: Add api endpoint for pausing all alerts. [#6589](https://github.com/grafana/grafana/issues/6589)
* **Panel**: Added help text for panels. [#4079](https://github.com/grafana/grafana/issues/4079), thx [@utkarshcmu](https://github.com/utkarshcmu)

### Bugfixes
* **API**: HTTP API for deleting org returning incorrect message for a non-existing org [#6679](https://github.com/grafana/grafana/issues/6679)
* **Dashboard**: Posting empty dashboard result in corrupted dashboard [#5443](https://github.com/grafana/grafana/issues/5443)
* **Logging**: Fixed logging level confing issue [#6978](https://github.com/grafana/grafana/issues/6978)
* **Notifications**: Remove html escaping the email subject. [#6905](https://github.com/grafana/grafana/issues/6905)
* **Influxdb**: Fixes broken field dropdown when using template vars as measurement. [#6473](https://github.com/grafana/grafana/issues/6473)

# 4.0.2 (2016-12-08)

### Enhancements
* **Playlist**: Add support for kiosk mode [#6727](https://github.com/grafana/grafana/issues/6727)

### Bugfixes
* **Alerting**: Add alert message to webhook notifications [#6807](https://github.com/grafana/grafana/issues/6807)
* **Alerting**: Fixes a bug where avg() reducer treated null as zero. [#6879](https://github.com/grafana/grafana/issues/6879)
* **PNG Rendering**: Fix for server side rendering when using non default http addr bind and domain setting [#6813](https://github.com/grafana/grafana/issues/6813)
* **PNG Rendering**: Fix for server side rendering when setting enforce_domain to true [#6769](https://github.com/grafana/grafana/issues/6769)
* **Webhooks**: Add content type json to outgoing webhooks [#6822](https://github.com/grafana/grafana/issues/6822)
* **Keyboard shortcut**: Fixed zoom out shortcut [#6837](https://github.com/grafana/grafana/issues/6837)
* **Webdav**: Adds basic auth headers to webdav uploader [#6779](https://github.com/grafana/grafana/issues/6779)

# 4.0.1 (2016-12-02)

> **Notice**
4.0.0 had serious connection pooling issue when using a data source in proxy access. This bug caused lots of resource issues
due to too many connections/file handles on the data source backend. This problem is fixed in this release.

### Bugfixes
* **Metrics**: Fixes nil pointer dereference on my arm build [#6749](https://github.com/grafana/grafana/issues/6749)
* **Data proxy**: Fixes a tcp pooling issue in the data source reverse proxy [#6759](https://github.com/grafana/grafana/issues/6759)

# 4.0-stable (2016-11-29)

### Bugfixes
* **Server-side rendering**: Fixed address used when rendering panel via phantomjs and using non default http_addr config [#6660](https://github.com/grafana/grafana/issues/6660)
* **Graph panel**: Fixed graph panel tooltip sort order issue [#6648](https://github.com/grafana/grafana/issues/6648)
* **Unsaved changes**: You now navigate to the intended page after saving in the unsaved changes dialog [#6675](https://github.com/grafana/grafana/issues/6675)
* **TLS Client Auth**: Support for TLS client authentication for data source proxies [#2316](https://github.com/grafana/grafana/issues/2316)
* **Alerts out of sync**: Saving dashboards with broken alerts causes sync problem[#6576](https://github.com/grafana/grafana/issues/6576)
* **Alerting**: Saving an alert with condition "HAS NO DATA" throws an error[#6701](https://github.com/grafana/grafana/issues/6701)
* **Config**: Improve error message when parsing broken config file [#6731](https://github.com/grafana/grafana/issues/6731)
* **Table**: Render empty dates as - instead of current date [#6728](https://github.com/grafana/grafana/issues/6728)

# 4.0-beta2 (2016-11-21)

### Bugfixes
* **Graph Panel**: Log base scale on right Y-axis had no effect, max value calc was not applied, [#6534](https://github.com/grafana/grafana/issues/6534)
* **Graph Panel**: Bar width if bars was only used in series override, [#6528](https://github.com/grafana/grafana/issues/6528)
* **UI/Browser**: Fixed issue with page/view header gradient border not showing in Safari, [#6530](https://github.com/grafana/grafana/issues/6530)
* **Cloudwatch**: Fixed cloudwatch data source requesting to many datapoints, [#6544](https://github.com/grafana/grafana/issues/6544)
* **UX**: Panel Drop zone visible after duplicating panel, and when entering fullscreen/edit view, [#6598](https://github.com/grafana/grafana/issues/6598)
* **Templating**: Newly added variable was not visible directly only after dashboard reload, [#6622](https://github.com/grafana/grafana/issues/6622)

### Enhancements
* **Singlestat**: Support repeated template variables in prefix/postfix [#6595](https://github.com/grafana/grafana/issues/6595)
* **Templating**: Don't persist variable options with refresh option [#6586](https://github.com/grafana/grafana/issues/6586)
* **Alerting**: Add ability to have OR conditions (and mixing AND & OR) [#6579](https://github.com/grafana/grafana/issues/6579)
* **InfluxDB**: Fix for Ad-Hoc Filters variable & changing dashboards [#6821](https://github.com/grafana/grafana/issues/6821)

# 4.0-beta1 (2016-11-09)

### Enhancements
* **Login**: Adds option to disable username/password logins, closes [#4674](https://github.com/grafana/grafana/issues/4674)
* **SingleStat**: Add seriename as option in singlestat panel, closes [#4740](https://github.com/grafana/grafana/issues/4740)
* **Localization**: Week start day now dependent on browser locale setting, closes [#3003](https://github.com/grafana/grafana/issues/3003)
* **Templating**: Update panel repeats for variables that change on time refresh, closes [#5021](https://github.com/grafana/grafana/issues/5021)
* **Templating**: Add support for numeric and alphabetical sorting of variable values, closes [#2839](https://github.com/grafana/grafana/issues/2839)
* **Elasticsearch**: Support to set Precision Threshold for Unique Count metric, closes [#4689](https://github.com/grafana/grafana/issues/4689)
* **Navigation**: Add search to org swithcer, closes [#2609](https://github.com/grafana/grafana/issues/2609)
* **Database**: Allow database config using one property, closes [#5456](https://github.com/grafana/grafana/pull/5456)
* **Graphite**: Add support for groupByNodes, closes [#5613](https://github.com/grafana/grafana/pull/5613)
* **Influxdb**: Add support for elapsed(), closes [#5827](https://github.com/grafana/grafana/pull/5827)
* **OpenTSDB**: Add support for explicitTags for OpenTSDB>=2.3, closes [#6360](https://github.com/grafana/grafana/pull/6361)
* **OAuth**: Add support for generic oauth, closes [#4718](https://github.com/grafana/grafana/pull/4718)
* **Cloudwatch**: Add support to expand multi select template variable, closes [#5003](https://github.com/grafana/grafana/pull/5003)
* **Background Tasks**: Now support automatic purging of old snapshots, closes [#4087](https://github.com/grafana/grafana/issues/4087)
* **Background Tasks**: Now support automatic purging of old rendered images, closes [#2172](https://github.com/grafana/grafana/issues/2172)
* **Dashboard**: After inactivity hide nav/row actions, fade to nice clean view, can be toggled with `d v`, also added kiosk mode, toggled via `d k` [#6476](https://github.com/grafana/grafana/issues/6476)
* **Dashboard**: Improved dashboard row menu & add panel UX [#6442](https://github.com/grafana/grafana/issues/6442)
* **Graph Panel**: Support for stacking null values [#2912](https://github.com/grafana/grafana/issues/2912), [#6287](https://github.com/grafana/grafana/issues/6287), thanks @benrubson!

### Breaking changes
* **SystemD**: Change systemd description, closes [#5971](https://github.com/grafana/grafana/pull/5971)
* **lodash upgrade**: Upgraded lodash from 2.4.2 to 4.15.0, this contains a number of breaking changes that could effect plugins. closes [#6021](https://github.com/grafana/grafana/pull/6021)

### Bug fixes
* **Table Panel**: Fixed problem when switching to Mixed data source in metrics tab, fixes [#5999](https://github.com/grafana/grafana/pull/5999)
* **Playlist**: Fixed problem with play order not matching order defined in playlist, fixes [#5467](https://github.com/grafana/grafana/pull/5467)
* **Graph panel**: Fixed problem with auto decimals on y axis when datamin=datamax, fixes [#6070](https://github.com/grafana/grafana/pull/6070)
* **Snapshot**: Can view embedded panels/png rendered panels in snapshots without login, fixes [#3769](https://github.com/grafana/grafana/pull/3769)
* **Elasticsearch**: Fix for query template variable when looking up terms without query, no longer relies on elasticsearch default field, fixes [#3887](https://github.com/grafana/grafana/pull/3887)
* **Elasticsearch**: Fix for displaying IP address used in terms aggregations, fixes [#4393](https://github.com/grafana/grafana/pull/4393)
* **PNG Rendering**: Fix for server side rendering when using auth proxy, fixes [#5906](https://github.com/grafana/grafana/pull/5906)
* **OpenTSDB**: Fixed multi-value nested templating for opentsdb, fixes [#6455](https://github.com/grafana/grafana/pull/6455)
* **Playlist**: Remove playlist items when dashboard is removed, fixes [#6292](https://github.com/grafana/grafana/issues/6292)

# 3.1.2 (unreleased)
* **Templating**: Fixed issue when combining row & panel repeats, fixes [#5790](https://github.com/grafana/grafana/issues/5790)
* **Drag&Drop**: Fixed issue with drag and drop in latest Chrome(51+), fixes [#5767](https://github.com/grafana/grafana/issues/5767)
* **Internal Metrics**: Fixed issue with dots in instance_name when sending internal metrics to Graphite, fixes [#5739](https://github.com/grafana/grafana/issues/5739)
* **Grafana-CLI**: Add default plugin path for MAC OS, fixes [#5806](https://github.com/grafana/grafana/issues/5806)
* **Grafana-CLI**: Improve error message for upgrade-all command, fixes [#5885](https://github.com/grafana/grafana/issues/5885)

# 3.1.1 (2016-08-01)
* **IFrame embedding**: Fixed issue of using full iframe height, fixes [#5605](https://github.com/grafana/grafana/issues/5606)
* **Panel PNG rendering**: Fixed issue detecting render completion, fixes [#5605](https://github.com/grafana/grafana/issues/5606)
* **Elasticsearch**: Fixed issue with templating query and json parse error, fixes [#5615](https://github.com/grafana/grafana/issues/5615)
* **Tech**: Upgraded JQuery to 2.2.4 to fix Security vulnerabilitie in 2.1.4, fixes [#5627](https://github.com/grafana/grafana/issues/5627)
* **Graphite**: Fixed issue with mixed data sources and Graphite, fixes [#5617](https://github.com/grafana/grafana/issues/5617)
* **Templating**: Fixed issue with template variable query was issued multiple times during dashboard load, fixes [#5637](https://github.com/grafana/grafana/issues/5637)
* **Zoom**: Fixed issues with zoom in and out on embedded (iframed) panel, fixes [#4489](https://github.com/grafana/grafana/issues/4489), [#5666](https://github.com/grafana/grafana/issues/5666)

# 3.1.0 stable (2016-07-12)

### Bugfixes & Enhancements,
* **User Alert Notices**: Backend error alert popups did not show properly, fixes [#5435](https://github.com/grafana/grafana/issues/5435)
* **Table**: Added sanitize HTML option to allow links in table cells, fixes [#4596](https://github.com/grafana/grafana/issues/4596)
* **Apps**: App dashboards are automatically synced to DB at startup after plugin update, fixes [#5529](https://github.com/grafana/grafana/issues/5529)

# 3.1.0-beta1 (2016-06-23)

### Enhancements
* **Dashboard Export/Import**: Dashboard export now templetize data sources and constant variables, users pick these on import, closes [#5084](https://github.com/grafana/grafana/issues/5084)
* **Dashboard Url**: Time range changes updates url, closes [#458](https://github.com/grafana/grafana/issues/458)
* **Dashboard Url**: Template variable change updates url, closes [#5002](https://github.com/grafana/grafana/issues/5002)
* **Singlestat**: Add support for range to text mappings, closes [#1319](https://github.com/grafana/grafana/issues/1319)
* **Graph**: Adds sort order options for graph tooltip, closes  [#1189](https://github.com/grafana/grafana/issues/1189)
* **Theme**: Add default theme to config file [#5011](https://github.com/grafana/grafana/pull/5011)
* **Page Footer**: Added page footer with links to docs, shows Grafana version and info if new version is available, closes [#4889](https://github.com/grafana/grafana/pull/4889)
* **InfluxDB**: Add spread function, closes [#5211](https://github.com/grafana/grafana/issues/5211)
* **Scripts**: Use restart instead of start for deb package script, closes [#5282](https://github.com/grafana/grafana/pull/5282)
* **Logging**: Moved to structured logging lib, and moved to component specific level filters via config file, closes [#4590](https://github.com/grafana/grafana/issues/4590)
* **OpenTSDB**: Support nested template variables in tag_values function, closes [#4398](https://github.com/grafana/grafana/issues/4398)
* **Data Source**: Pending data source requests are canceled before new ones are issues (Graphite & Prometheus), closes [#5321](https://github.com/grafana/grafana/issues/5321)

### Breaking changes
* **Logging** : Changed default logging output format (now structured into message, and key value pairs, with logger key acting as component). You can also no change in config to json log output.
* **Graphite** : The Graph panel no longer have a Graphite PNG option. closes [#5367](https://github.com/grafana/grafana/issues/5367)

### Bug fixes
* **PNG rendering**: Fixed phantomjs rendering and y-axis label rotation. fixes [#5220](https://github.com/grafana/grafana/issues/5220)
* **CLI**: The cli tool now supports reading plugin.json from dist/plugin.json. fixes [#5410](https://github.com/grafana/grafana/issues/5410)

# 3.0.4 Patch release (2016-05-25)
* **Panel**: Fixed blank dashboard issue when switching to other dashboard while in fullscreen edit mode, fixes [#5163](https://github.com/grafana/grafana/pull/5163)
* **Templating**: Fixed issue with nested multi select variables and cascading and updating child variable selection state, fixes [#4861](https://github.com/grafana/grafana/pull/4861)
* **Templating**: Fixed issue with using templated data source in another template variable query, fixes [#5165](https://github.com/grafana/grafana/pull/5165)
* **Singlestat gauge**: Fixed issue with gauge render position, fixes [#5143](https://github.com/grafana/grafana/pull/5143)
* **Home dashboard**: Fixes broken home dashboard api, fixes [#5167](https://github.com/grafana/grafana/issues/5167)

# 3.0.3 Patch release (2016-05-23)
* **Annotations**: Annotations can now use a template variable as data source, closes [#5054](https://github.com/grafana/grafana/issues/5054)
* **Time picker**: Fixed issue timepicker and UTC when reading time from URL, fixes [#5078](https://github.com/grafana/grafana/issues/5078)
* **CloudWatch**: Support for Multiple Account by AssumeRole, closes [#3522](https://github.com/grafana/grafana/issues/3522)
* **Singlestat**: Fixed alignment and minimum height issue, fixes [#5113](https://github.com/grafana/grafana/issues/5113), fixes [#4679](https://github.com/grafana/grafana/issues/4679)
* **Share modal**: Fixed link when using grafana under dashboard sub url, fixes [#5109](https://github.com/grafana/grafana/issues/5109)
* **Prometheus**: Fixed bug in query editor that caused it not to load when reloading page, fixes [#5107](https://github.com/grafana/grafana/issues/5107)
* **Elasticsearch**: Fixed bug when template variable query returns numeric values, fixes [#5097](https://github.com/grafana/grafana/issues/5097), fixes [#5088](https://github.com/grafana/grafana/issues/5088)
* **Logging**: Fixed issue with reading logging level value, fixes [#5079](https://github.com/grafana/grafana/issues/5079)
* **Timepicker**: Fixed issue with timepicker and UTC when reading time from URL, fixes [#5078](https://github.com/grafana/grafana/issues/5078)
* **Docs**: Added docs for org & user preferences HTTP API, closes [#5069](https://github.com/grafana/grafana/issues/5069)
* **Plugin list panel**: Now shows correct enable state for apps when not enabled, fixes [#5068](https://github.com/grafana/grafana/issues/5068)
* **Elasticsearch**: Templating & Annotation queries that use template variables are now formatted correctly, fixes [#5135](https://github.com/grafana/grafana/issues/5135)

# 3.0.2 Patch release (2016-05-16)

* **Templating**: Fixed issue mixing row repeat and panel repeats, fixes [#4988](https://github.com/grafana/grafana/issues/4988)
* **Templating**: Fixed issue detecting dependencies in nested variables, fixes [#4987](https://github.com/grafana/grafana/issues/4987), fixes [#4986](https://github.com/grafana/grafana/issues/4986)
* **Graph**: Fixed broken PNG rendering in graph panel, fixes [#5025](https://github.com/grafana/grafana/issues/5025)
* **Graph**: Fixed broken xaxis on graph panel, fixes [#5024](https://github.com/grafana/grafana/issues/5024)

* **Influxdb**: Fixes crash when hiding middle series, fixes [#5005](https://github.com/grafana/grafana/issues/5005)

# 3.0.1 Stable (2016-05-11)

### Bug fixes
* **Templating**: Fixed issue with new data source variable not persisting current selected value, fixes [#4934](https://github.com/grafana/grafana/issues/4934)

# 3.0.0-beta7 (2016-05-02)

### Bug fixes
* **Dashboard title**: Fixed max dashboard title width (media query) for large screens,  fixes [#4859](https://github.com/grafana/grafana/issues/4859)
* **Annotations**: Fixed issue with entering annotation edit view, fixes [#4857](https://github.com/grafana/grafana/issues/4857)
* **Remove query**: Fixed issue with removing query for data sources without collapsible query editors, fixes [#4856](https://github.com/grafana/grafana/issues/4856)
* **Graphite PNG**: Fixed issue graphite png rendering option, fixes [#4864](https://github.com/grafana/grafana/issues/4864)
* **InfluxDB**: Fixed issue missing plus group by iconn, fixes [#4862](https://github.com/grafana/grafana/issues/4862)
* **Graph**: Fixes missing line mode for thresholds, fixes [#4902](https://github.com/grafana/grafana/pull/4902)

### Enhancements
* **InfluxDB**: Added new functions moving_average and difference to query editor, closes [#4698](https://github.com/grafana/grafana/issues/4698)

# 3.0.0-beta6 (2016-04-29)

### Enhancements
* **Singlestat**: Support for gauges in singlestat panel. closes [#3688](https://github.com/grafana/grafana/pull/3688)
* **Templating**: Support for data source as variable, closes [#816](https://github.com/grafana/grafana/pull/816)

### Bug fixes
* **InfluxDB 0.12**: Fixed issue templating and `show tag values` query only returning tags for first measurement,  fixes [#4726](https://github.com/grafana/grafana/issues/4726)
* **Templating**: Fixed issue with regex formatting when matching multiple values, fixes [#4755](https://github.com/grafana/grafana/issues/4755)
* **Templating**: Fixed issue with custom all value and escaping, fixes [#4736](https://github.com/grafana/grafana/issues/4736)
* **Dashlist**: Fixed issue dashboard list panel and caching tags, fixes [#4768](https://github.com/grafana/grafana/issues/4768)
* **Graph**: Fixed issue with unneeded scrollbar in legend for Firefox, fixes [#4760](https://github.com/grafana/grafana/issues/4760)
* **Table panel**: Fixed issue table panel formatting string array properties, fixes [#4791](https://github.com/grafana/grafana/issues/4791)
* **grafana-cli**: Improve error message when failing to install plugins due to corrupt response, fixes [#4651](https://github.com/grafana/grafana/issues/4651)
* **Singlestat**: Fixes prefix an postfix for gauges, fixes [#4812](https://github.com/grafana/grafana/issues/4812)
* **Singlestat**: Fixes auto-refresh on change for some options, fixes [#4809](https://github.com/grafana/grafana/issues/4809)

### Breaking changes
**Data Source Query Editors**: Issue [#3900](https://github.com/grafana/grafana/issues/3900)

Query editors have been updated to use the new form styles. External data source plugins needs to be
updated to work. Sorry to introduce breaking change this late in beta phase. We wanted to get this change
in before 3.0 stable is released so we don't have to break data sources in next release (3.1). If you are
a data source plugin author and want help for how the new form styles work please ask for help in
slack channel (link to slack channel in readme).

# 3.0.0-beta5 (2016-04-15)

### Bug fixes
* **grafana-cli**: Fixed issue grafana-cli tool, did not detect the right plugin dir, fixes [#4723](https://github.com/grafana/grafana/issues/4723)
* **Graph**: Fixed issue with light theme text color issue in tooltip, fixes [#4702](https://github.com/grafana/grafana/issues/4702)
* **Snapshot**: Fixed issue with empty snapshots, fixes [#4706](https://github.com/grafana/grafana/issues/4706)

# 3.0.0-beta4 (2016-04-13)

### Bug fixes
* **Home dashboard**: Fixed issue with permission denied error on home dashboard, fixes [#4686](https://github.com/grafana/grafana/issues/4686)
* **Templating**: Fixed issue templating variables that use regex extraction, fixes [#4672](https://github.com/grafana/grafana/issues/4672)

# 3.0.0-beta3 (2016-04-12)

### Enhancements
* **InfluxDB**: Changed multi query encoding to work with InfluxDB 0.11 & 0.12, closes [#4533](https://github.com/grafana/grafana/issues/4533)
* **Timepicker**: Add arrows and shortcuts for moving back and forth in current dashboard, closes [#119](https://github.com/grafana/grafana/issues/119)

### Bug fixes
* **Postgres**: Fixed page render crash when using postgres, fixes [#4558](https://github.com/grafana/grafana/issues/4558)
* **Table panel**: Fixed table panel bug when trying to show annotations in table panel, fixes [#4563](https://github.com/grafana/grafana/issues/4563)
* **App Config**: Fixed app config issue showing content of other app config, fixes [#4575](https://github.com/grafana/grafana/issues/4575)
* **Graph Panel**: Fixed legend option max not updating, fixes [#4601](https://github.com/grafana/grafana/issues/4601)
* **Graph Panel**: Fixed issue where newly added graph panels shared same axes config, fixes [#4582](https://github.com/grafana/grafana/issues/4582)
* **Graph Panel**: Fixed issue with axis labels overlapping Y-axis, fixes [#4626](https://github.com/grafana/grafana/issues/4626)
* **InfluxDB**: Fixed issue with templating query containing template variable, fixes [#4602](https://github.com/grafana/grafana/issues/4602)
* **Graph Panel**: Fixed issue with hiding series and stacking, fixes [#4557](https://github.com/grafana/grafana/issues/4557)
* **Graph Panel**: Fixed issue with legend height in table mode with few series, affected iframe embedding as well, fixes [#4640](https://github.com/grafana/grafana/issues/4640)

# 3.0.0-beta2 (2016-04-04)

### New Features (introduces since 3.0-beta1)
* **Preferences**: Set home dashboard on user and org level, closes [#1678](https://github.com/grafana/grafana/issues/1678)
* **Preferences**: Set timezone on user and org level, closes [#3214](https://github.com/grafana/grafana/issues/3214), [#1200](https://github.com/grafana/grafana/issues/1200)
* **Preferences**: Set theme on user and org level, closes [#3214](https://github.com/grafana/grafana/issues/3214), [#1917](https://github.com/grafana/grafana/issues/1917)

### Bug fixes
* **Dashboard**: Fixed dashboard panel layout for mobile devices, fixes [#4529](https://github.com/grafana/grafana/issues/4529)
* **Table Panel**: Fixed issue with table panel sort, fixes [#4532](https://github.com/grafana/grafana/issues/4532)
* **Page Load Crash**: A data source with null jsonData would make Grafana fail to load page, fixes [#4536](https://github.com/grafana/grafana/issues/4536)
* **Metrics tab**: Fix for missing data source name in data source selector, fixes [#4541](https://github.com/grafana/grafana/issues/4540)
* **Graph**: Fix legend in table mode with series on right-y axis, fixes [#4551](https://github.com/grafana/grafana/issues/4551), [#1145](https://github.com/grafana/grafana/issues/1145)

# 3.0.0-beta1 (2016-03-31)

### New Features
* **Playlists**: Playlists can now be persisted and started from urls, closes [#3655](https://github.com/grafana/grafana/issues/3655)
* **Metadata**: Settings panel now shows dashboard metadata, closes [#3304](https://github.com/grafana/grafana/issues/3304)
* **InfluxDB**: Support for policy selection in query editor, closes [#2018](https://github.com/grafana/grafana/issues/2018)
* **Snapshots UI**: Dashboard snapshots list can be managed through UI, closes[#1984](https://github.com/grafana/grafana/issues/1984)
* **Prometheus**: Prometheus annotation support, closes[#2883](https://github.com/grafana/grafana/pull/2883)
* **Cli**: New cli tool for downloading and updating plugins
* **Annotations**: Annotations can now contain links that can be clicked (you can navigate on to annotation popovers), closes [#1588](https://github.com/grafana/grafana/issues/1588)
* **Opentsdb**: Opentsdb 2.2 filters support, closes[#3077](https://github.com/grafana/grafana/issues/3077)

### Breaking changes
* **Plugin API**: Both data source and panel plugin api (and plugin.json schema) have been updated, requiring an update to plugins. See [plugin api](https://github.com/grafana/grafana/blob/master/public/app/plugins/plugin_api.md) for more info.
* **InfluxDB 0.8.x** The data source for the old version of influxdb (0.8.x) is no longer included in default builds, but can easily be installed via improved plugin system, closes [#3523](https://github.com/grafana/grafana/issues/3523)
* **KairosDB** The data source is no longer included in default builds, but can easily be installed via improved plugin system, closes [#3524](https://github.com/grafana/grafana/issues/3524)
* **Templating**: Templating value formats (glob/regex/pipe etc) are now handled automatically and not specified by the user, this makes variable values possible to reuse in many contexts. It can in some edge cases break existing dashboards that have template variables that do not reload on dashboard load. To fix any issue just go into template variable options and update the variable (so it's values are reloaded.).

### Enhancements
* **LDAP**: Support for nested LDAP Groups, closes [#4401](https://github.com/grafana/grafana/issues/4401), [#3808](https://github.com/grafana/grafana/issues/3808)
* **Sessions**: Support for memcached as session storage, closes [#3458](https://github.com/grafana/grafana/issues/3458)
* **mysql**: Grafana now supports ssl for mysql, closes [#3584](https://github.com/grafana/grafana/issues/3584)
* **snapshot**: Annotations are now included in snapshots, closes [#3635](https://github.com/grafana/grafana/issues/3635)
* **Admin**: Admin can now have global overview of Grafana setup, closes [#3812](https://github.com/grafana/grafana/issues/3812)
* **graph**: Right side legend height is now fixed at row height, closes [#1277](https://github.com/grafana/grafana/issues/1277)
* **Table**: All content in table panel is now html escaped, closes [#3673](https://github.com/grafana/grafana/issues/3673)
* **graph**: Template variables can now be used in TimeShift and TimeFrom, closes[#1960](https://github.com/grafana/grafana/issues/1960)
* **Tooltip**: Optionally add milliseconds to timestamp in tool tip, closes[#2248](https://github.com/grafana/grafana/issues/2248)
* **Opentsdb**: Support milliseconds when using openTSDB data source, closes [#2865](https://github.com/grafana/grafana/issues/2865)
* **Opentsdb**: Add support for annotations, closes[#664](https://github.com/grafana/grafana/issues/664)

### Bug fixes
* **Playlist**: Fix for memory leak when running a playlist, closes [#3794](https://github.com/grafana/grafana/pull/3794)
* **InfluxDB**: Fix for InfluxDB and table panel when using Format As Table and having group by time, fixes [#3928](https://github.com/grafana/grafana/issues/3928)
* **Panel Time shift**: Fix for panel time range and using dashboard times like `Today` and `This Week`, fixes [#3941](https://github.com/grafana/grafana/issues/3941)
* **Row repeat**: Repeated rows will now appear next to each other and not by the bottom of the dashboard, fixes [#3942](https://github.com/grafana/grafana/issues/3942)
* **Png renderer**: Fix for phantomjs path on windows, fixes [#3657](https://github.com/grafana/grafana/issues/3657)

# 2.6.1 (unrelased, 2.6.x branch)

### New Features
* **Elasticsearch**: Support for derivative unit option, closes [#3512](https://github.com/grafana/grafana/issues/3512)

### Bug fixes
* **Graph Panel**: Fixed typehead when adding series style override, closes [#3554](https://github.com/grafana/grafana/issues/3554)

# 2.6.0 (2015-12-14)

### New Features
* **Elasticsearch**: Support for pipeline aggregations Moving average and derivative, closes [#2715](https://github.com/grafana/grafana/issues/2715)
* **Elasticsearch**: Support for inline script and missing options for metrics, closes [#3500](https://github.com/grafana/grafana/issues/3500)
* **Syslog**: Support for syslog logging, closes [#3161](https://github.com/grafana/grafana/pull/3161)
* **Timepicker**: Always show refresh button even with refresh rate, closes [#3498](https://github.com/grafana/grafana/pull/3498)
* **Login**: Make it possible to change the login hint on the login page, closes [#2571](https://github.com/grafana/grafana/pull/2571)

### Bug Fixes
* **metric editors**: Fix for clicking typeahead auto dropdown option, fixes [#3428](https://github.com/grafana/grafana/issues/3428)
* **influxdb**: Fixed issue showing Group By label only on first query, fixes [#3453](https://github.com/grafana/grafana/issues/3453)
* **logging**: Add more verbose info logging for http requests, closes [#3405](https://github.com/grafana/grafana/pull/3405)

# 2.6.0-Beta1 (2015-12-04)

### New Table Panel
* **table**:  New powerful and flexible table panel, closes [#215](https://github.com/grafana/grafana/issues/215)

### Enhancements
* **CloudWatch**: Support for multiple AWS Credentials, closes [#3053](https://github.com/grafana/grafana/issues/3053), [#3080](https://github.com/grafana/grafana/issues/3080)
* **Elasticsearch**: Support for dynamic daily indices for annotations, closes [#3061](https://github.com/grafana/grafana/issues/3061)
* **Elasticsearch**: Support for setting min_doc_count for date histogram, closes [#3416](https://github.com/grafana/grafana/issues/3416)
* **Graph Panel**: Option to hide series with all zeroes from legend and tooltip, closes [#1381](https://github.com/grafana/grafana/issues/1381), [#3336](https://github.com/grafana/grafana/issues/3336)

### Bug Fixes
* **cloudwatch**: fix for handling of period for long time ranges, fixes [#3086](https://github.com/grafana/grafana/issues/3086)
* **dashboard**: fix for collapse row by clicking on row title, fixes [#3065](https://github.com/grafana/grafana/issues/3065)
* **influxdb**: fix for relative time ranges `last x months` and `last x years`, fixes [#3067](https://github.com/grafana/grafana/issues/3067)
* **graph**: layout fix for color picker when right side legend was enabled, fixes [#3093](https://github.com/grafana/grafana/issues/3093)
* **elasticsearch**: disabling elastic query (via eye) caused error, fixes [#3300](https://github.com/grafana/grafana/issues/3300)

### Breaking changes
* **elasticsearch**: Manual json edited queries are not supported any more (They very barely worked in 2.5)

# 2.5 (2015-10-28)

**New Feature: Mix data sources**
- A built in data source is now available named `-- Mixed --`, When picked in the metrics tab,
it allows you to add queries of different data source types & instances to the same graph/panel!
[Issue #436](https://github.com/grafana/grafana/issues/436)

**New Feature: Elasticsearch Metrics Query Editor and Viz Support**
- Feature rich query editor and processing features enables you to issues all kind of metric queries to Elasticsearch
- See [Issue #1034](https://github.com/grafana/grafana/issues/1034) for more info.

**New Feature: New and much improved time picker**
- Support for quick ranges like `Today`, `This day last week`, `This week`, `The day so far`, etc.
- Improved UI and improved support for UTC, [Issue #2761](https://github.com/grafana/grafana/issues/2761) for more info.

**User Onboarding**
- Org admin can now send email invites (or invite links) to people who are not yet Grafana users
- Sign up flow now supports email verification (if enabled)
- See [Issue #2353](https://github.com/grafana/grafana/issues/2353) for more info.

**Other new Features && Enhancements**
- [Pull  #2720](https://github.com/grafana/grafana/pull/2720). Admin: Initial basic quota support (per Org)
- [Issue #2577](https://github.com/grafana/grafana/issues/2577). Panel: Resize handles in panel bottom right corners for easy width and height change
- [Issue #2457](https://github.com/grafana/grafana/issues/2457). Admin: admin page for all grafana organizations (list / edit view)
- [Issue #1186](https://github.com/grafana/grafana/issues/1186). Time Picker: New option `today`, will set time range from midnight to now
- [Issue #2647](https://github.com/grafana/grafana/issues/2647). InfluxDB: You can now set group by time interval on each query
- [Issue #2599](https://github.com/grafana/grafana/issues/2599). InfluxDB: Improved alias support, you can now use the `AS` clause for each select statement
- [Issue #2708](https://github.com/grafana/grafana/issues/2708). InfluxDB: You can now set math expression for select clauses.
- [Issue #1575](https://github.com/grafana/grafana/issues/1575). Drilldown link: now you can click on the external link icon in the panel header to access drilldown links!
- [Issue #1646](https://github.com/grafana/grafana/issues/1646). OpenTSDB: Fetch list of aggregators from OpenTSDB
- [Issue #2955](https://github.com/grafana/grafana/issues/2955). Graph: More axis units (Length, Volume, Temperature, Pressure, etc), thanks @greglook
- [Issue #2928](https://github.com/grafana/grafana/issues/2928). LDAP: Support for searching for groups memberships, i.e. POSIX (no memberOf) schemas, also multiple ldap servers, and root ca cert, thanks @abligh

**Fixes**
- [Issue #2413](https://github.com/grafana/grafana/issues/2413). InfluxDB 0.9: Fix for handling empty series object in response from influxdb
- [Issue #2574](https://github.com/grafana/grafana/issues/2574). Snapshot: Fix for snapshot with expire 7 days option, 7 days option not correct, was 7 hours
- [Issue #2568](https://github.com/grafana/grafana/issues/2568). AuthProxy: Fix for server side rendering of panel when using auth proxy
- [Issue #2490](https://github.com/grafana/grafana/issues/2490). Graphite: Dashboard import was broken in 2.1 and 2.1.1, working now
- [Issue #2565](https://github.com/grafana/grafana/issues/2565). TimePicker: Fix for when you applied custom time range it did not refreh dashboard
- [Issue #2563](https://github.com/grafana/grafana/issues/2563). Annotations: Fixed issue when html sanitizer failes for title to annotation body, now fallbacks to html escaping title and text
- [Issue #2564](https://github.com/grafana/grafana/issues/2564). Templating: Another atempt at fixing #2534 (Init multi value template var used in repeat panel from url)
- [Issue #2620](https://github.com/grafana/grafana/issues/2620). Graph: multi series tooltip did no highlight correct point when stacking was enabled and series were of different resolution
- [Issue #2636](https://github.com/grafana/grafana/issues/2636). InfluxDB: Do no show template vars in dropdown for tag keys and group by keys
- [Issue #2604](https://github.com/grafana/grafana/issues/2604). InfluxDB: More alias options, can now use `$[0-9]` syntax to reference part of a measurement name (separated by dots)

**Breaking Changes**
- Notice to makers/users of custom data sources, there is a minor breaking change in 2.2 that
require an update to custom data sources for them to work in 2.2. [Read this doc](https://github.com/grafana/grafana/tree/master/docs/sources/datasources/plugin_api.md) for more on the
data source api change.
- Data source api changes, [PLUGIN_CHANGES.md](https://github.com/grafana/grafana/blob/master/public/app/plugins/PLUGIN_CHANGES.md)
- The duplicate query function used in data source editors is changed, and moveMetricQuery function was renamed

**Tech (Note for devs)**
Started using Typescript (transpiled to ES5), uncompiled typescript files and less files are in public folder (in source tree)
This folder is never modified by build steps. Compiled css and javascript files are put in public_gen, all other files
that do not undergo transformation are just copied from public to public_gen, it is public_gen that is used by grafana-server
if it is found.

Grunt & Watch tasks:
- `grunt` : default task, will remove public_gen, copy over all files from public, do less & typescript compilation
- `grunt watch`: will watch for changes to less, and typescript files and compile them to public_gen, and for other files it will just copy them to public_gen


# 2.1.3 (2015-08-24)

**Fixes**
- [Issue #2580](https://github.com/grafana/grafana/issues/2580). Packaging: ldap.toml was not marked as config file and could be overwritten in upgrade
- [Issue #2564](https://github.com/grafana/grafana/issues/2564). Templating: Another atempt at fixing #2534 (Init multi value template var used in repeat panel from url)

# 2.1.2 (2015-08-20)

**Fixes**
- [Issue #2558](https://github.com/grafana/grafana/issues/2558). DragDrop: Fix for broken drag drop behavior
- [Issue #2534](https://github.com/grafana/grafana/issues/2534). Templating: fix for setting template variable value via url and having repeated panels or rows

# 2.1.1 (2015-08-11)

**Fixes**
- [Issue #2443](https://github.com/grafana/grafana/issues/2443). Templating: Fix for buggy repeat row behavior when combined with with repeat panel due to recent change before 2.1 release
- [Issue #2442](https://github.com/grafana/grafana/issues/2442). Templating: Fix text panel when using template variables in text in in repeated panel
- [Issue #2446](https://github.com/grafana/grafana/issues/2446). InfluxDB: Fix for using template vars inside alias field (InfluxDB 0.9)
- [Issue #2460](https://github.com/grafana/grafana/issues/2460). SinglestatPanel: Fix to handle series with no data points
- [Issue #2461](https://github.com/grafana/grafana/issues/2461). LDAP: Fix for ldap users with empty email address
- [Issue #2484](https://github.com/grafana/grafana/issues/2484). Graphite: Fix bug when using series ref (#A-Z) and referenced series is hidden in query editor.
- [Issue #1896](https://github.com/grafana/grafana/issues/1896). Postgres: Dashboard search is now case insensitive when using Postgres

**Enhancements**
- [Issue #2477](https://github.com/grafana/grafana/issues/2477). InfluxDB(0.9): Added more condition operators (`<`, `>`, `<>`, `!~`), thx @thuck
- [Issue #2483](https://github.com/grafana/grafana/issues/2484). InfluxDB(0.9): Use $col as option in alias patterns, thx @thuck

# 2.1.0 (2015-08-04)

**Data sources**
- [Issue #1525](https://github.com/grafana/grafana/issues/1525). InfluxDB: Full support for InfluxDB 0.9 with new adapted query editor
- [Issue #2191](https://github.com/grafana/grafana/issues/2191). KariosDB: Grafana now ships with a KariosDB data source plugin, thx @masaori335
- [Issue #1177](https://github.com/grafana/grafana/issues/1177). OpenTSDB: Limit tags by metric, OpenTSDB config option tsd.core.meta.enable_realtime_ts must enabled for OpenTSDB lookup api
- [Issue #1250](https://github.com/grafana/grafana/issues/1250). OpenTSDB: Support for template variable values lookup queries

**New dashboard features**
- [Issue #1144](https://github.com/grafana/grafana/issues/1144). Templating: You can now select multiple template variables values at the same time.
- [Issue #1922](https://github.com/grafana/grafana/issues/1922). Templating: Specify multiple variable values via URL params.
- [Issue #1888](https://github.com/grafana/grafana/issues/1144). Templating: Repeat panel or row for each selected template variable value
- [Issue #1888](https://github.com/grafana/grafana/issues/1944). Dashboard: Custom Navigation links & dynamic links to related dashboards
- [Issue #590](https://github.com/grafana/grafana/issues/590).   Graph: Define series color using regex rule
- [Issue #2162](https://github.com/grafana/grafana/issues/2162). Graph: New series style override, negative-y transform and stack groups
- [Issue #2096](https://github.com/grafana/grafana/issues/2096). Dashboard list panel: Now supports search by multiple tags
- [Issue #2203](https://github.com/grafana/grafana/issues/2203). Singlestat: Now support string values

**User or Organization admin**
- [Issue #1899](https://github.com/grafana/grafana/issues/1899). Organization: You can now update the organization user role directly (without removing and readding the organization user).
- [Issue #2088](https://github.com/grafana/grafana/issues/2088). Roles: New user role `Read Only Editor` that replaces the old `Viewer` role behavior

**Backend**
- [Issue #2218](https://github.com/grafana/grafana/issues/2218). Auth: You can now authenicate against api with username / password using basic auth
- [Issue #2095](https://github.com/grafana/grafana/issues/2095). Search: Search now supports filtering by multiple dashboard tags
- [Issue #1905](https://github.com/grafana/grafana/issues/1905). Github OAuth: You can now configure a Github team membership requirement, thx @dewski
- [Issue #2052](https://github.com/grafana/grafana/issues/2052). Github OAuth: You can now configure a Github organization requirement, thx @indrekj
- [Issue #1891](https://github.com/grafana/grafana/issues/1891). Security: New config option to disable the use of gravatar for profile images
- [Issue #1921](https://github.com/grafana/grafana/issues/1921). Auth: Support for user authentication via reverse proxy header (like X-Authenticated-User, or X-WEBAUTH-USER)
- [Issue #960](https://github.com/grafana/grafana/issues/960).   Search: Backend can now index a folder with json files, will be available in search (saving back to folder is not supported, this feature is meant for static generated json dashboards)

**Breaking changes**
- [Issue #1826](https://github.com/grafana/grafana/issues/1826). User role 'Viewer' are now prohibited from entering edit mode (and doing other transient dashboard edits). A new role `Read Only Editor` will replace the old Viewer behavior
- [Issue #1928](https://github.com/grafana/grafana/issues/1928). HTTP API: GET /api/dashboards/db/:slug response changed property `model` to `dashboard` to match the POST request nameing
- Backend render URL changed from `/render/dashboard/solo` `render/dashboard-solo/` (in order to have consistent dashboard url `/dashboard/:type/:slug`)
- Search HTTP API response has changed (simplified), tags list moved to separate HTTP resource URI
- Data source HTTP api breaking change, ADD data source is now POST /api/datasources/, update is now PUT /api/datasources/:id

**Fixes**
- [Issue #2185](https://github.com/grafana/grafana/issues/2185). Graph: fixed PNG rendering of panels with legend table to the right
- [Issue #2163](https://github.com/grafana/grafana/issues/2163). Backend: Load dashboards with capital letters in the dashboard url slug (url id)

# 2.0.3 (unreleased - 2.0.x branch)

**Fixes**
- [Issue #1872](https://github.com/grafana/grafana/issues/1872). Firefox/IE issue, invisible text in dashboard search fixed
- [Issue #1857](https://github.com/grafana/grafana/issues/1857). /api/login/ping Fix for issue when behind reverse proxy and subpath
- [Issue #1863](https://github.com/grafana/grafana/issues/1863). MySQL: Dashboard.data column type changed to mediumtext (sql migration added)

# 2.0.2 (2015-04-22)

**Fixes**
- [Issue #1832](https://github.com/grafana/grafana/issues/1832). Graph Panel + Legend Table mode: Many series caused zero height graph, now legend will never reduce the height of the graph below 50% of row height.
- [Issue #1846](https://github.com/grafana/grafana/issues/1846). Snapshots: Fixed issue with snapshoting dashboards with an interval template variable
- [Issue #1848](https://github.com/grafana/grafana/issues/1848). Panel timeshift: You can now use panel timeshift without a relative time override

# 2.0.1 (2015-04-20)

**Fixes**
- [Issue #1784](https://github.com/grafana/grafana/issues/1784). Data source proxy: Fixed issue with using data source proxy when grafana is behind nginx suburl
- [Issue #1749](https://github.com/grafana/grafana/issues/1749). Graph Panel: Table legends are now visible when rendered to PNG
- [Issue #1786](https://github.com/grafana/grafana/issues/1786). Graph Panel: Legend in table mode now aligns, graph area is reduced depending on how many series
- [Issue #1734](https://github.com/grafana/grafana/issues/1734). Support for unicode / international characters in dashboard title (improved slugify)
- [Issue #1782](https://github.com/grafana/grafana/issues/1782). Github OAuth: Now works with Github for Enterprise, thanks @williamjoy
- [Issue #1780](https://github.com/grafana/grafana/issues/1780). Dashboard snapshot: Should not require login to view snapshot, Fixes #1780

# 2.0.0-Beta3 (2015-04-12)

**RPM / DEB Package changes (to follow HFS)**
- binary name changed to grafana-server
- does not install to `/opt/grafana` any more, installs to `/usr/share/grafana`
- binary to `/usr/sbin/grafana-server`
- init.d script improvements, renamed to `/etc/init.d/grafana-server`
- added default file with environment variables,
  - `/etc/default/grafana-server` (deb/ubuntu)
  - `/etc/sysconfig/grafana-server` (centos/redhat)

- added systemd service file, tested on debian jessie and centos7
- config file in same location `/etc/grafana/grafana.ini` (now complete config file but with every setting commented out)
- data directory (where sqlite3) file is stored is now by default `/var/lib/grafana`
- no symlinking current to versions anymore
- For more info see [Issue #1758](https://github.com/grafana/grafana/issues/1758).

**Config breaking change (setting rename)**
- `[log] root_path` has changed to `[paths] logs`

# 2.0.0-Beta2  (...)

**Enhancements**
- [Issue #1701](https://github.com/grafana/grafana/issues/1701). Share modal: Override UI theme via URL param for Share link, rendered panel, or embedded panel
- [Issue #1660](https://github.com/grafana/grafana/issues/1660). OAuth: Specify allowed email address domains for google or and github oauth logins

**Fixes**
- [Issue #1649](https://github.com/grafana/grafana/issues/1649). HTTP API: grafana /render calls nows with api keys
- [Issue #1667](https://github.com/grafana/grafana/issues/1667). Data source proxy & session timeout fix (caused 401 Unauthorized error after a while)
- [Issue #1707](https://github.com/grafana/grafana/issues/1707). Unsaved changes: Do not show for snapshots, scripted and file based dashboards
- [Issue #1703](https://github.com/grafana/grafana/issues/1703). Unsaved changes: Do not show for users with role `Viewer`
- [Issue #1675](https://github.com/grafana/grafana/issues/1675). Data source proxy: Fixed issue with Gzip enabled and data source proxy
- [Issue #1681](https://github.com/grafana/grafana/issues/1681). MySQL session: fixed problem using mysql as session store
- [Issue #1671](https://github.com/grafana/grafana/issues/1671). Data sources: Fixed issue with changing default data source (should not require full page load to take effect, now fixed)
- [Issue #1685](https://github.com/grafana/grafana/issues/1685). Search: Dashboard results should be sorted alphabetically
- [Issue #1673](https://github.com/grafana/grafana/issues/1673). Basic auth: Fixed issue when using basic auth proxy infront of Grafana

# 2.0.0-Beta1 (2015-03-30)

**Important Note**

Grafana 2.x is fundamentally different from 1.x; it now ships with an integrated backend server. Please read the [Documentation](http://docs.grafana.org) for more detailed about this SIGNIFICANT change to Grafana

**New features**
- [Issue #1623](https://github.com/grafana/grafana/issues/1623). Share Dashboard: Dashboard snapshot sharing (dash and data snapshot), save to local or save to public snapshot dashboard snapshots.raintank.io site
- [Issue #1622](https://github.com/grafana/grafana/issues/1622). Share Panel: The share modal now has an embed option, gives you an iframe that you can use to embed a single graph on another web site
- [Issue #718](https://github.com/grafana/grafana/issues/718).   Dashboard: When saving a dashboard and another user has made changes in between the user is prompted with a warning if he really wants to overwrite the other's changes
- [Issue #1331](https://github.com/grafana/grafana/issues/1331). Graph & Singlestat: New axis/unit format selector and more units (kbytes, Joule, Watt, eV), and new design for graph axis & grid tab and single stat options tab views
- [Issue #1241](https://github.com/grafana/grafana/issues/1242). Timepicker: New option in timepicker (under dashboard settings), to change ``now`` to be for example ``now-1m``, useful when you want to ignore last minute because it contains incomplete data
- [Issue #171](https://github.com/grafana/grafana/issues/171).   Panel: Different time periods, panels can override dashboard relative time and/or add a time shift
- [Issue #1488](https://github.com/grafana/grafana/issues/1488). Dashboard: Clone dashboard / Save as
- [Issue #1458](https://github.com/grafana/grafana/issues/1458). User: persisted user option for dark or light theme  (no longer an option on a dashboard)
- [Issue #452](https://github.com/grafana/grafana/issues/452).   Graph: Adds logarithmic scale option for base 10, base 16 and base 1024

**Enhancements**
- [Issue #1366](https://github.com/grafana/grafana/issues/1366). Graph & Singlestat: Support for additional units, Fahrenheit (°F) and Celsius (°C), Humidity (%H), kW, watt-hour (Wh), kilowatt-hour (kWh), velocities (m/s, km/h, mpg, knot)
- [Issue #978](https://github.com/grafana/grafana/issues/978).   Graph: Shared tooltip improvement, can now support metrics of different resolution/intervals
- [Issue #1297](https://github.com/grafana/grafana/issues/1297). Graphite: Added cumulative and minimumBelow graphite functions
- [Issue #1296](https://github.com/grafana/grafana/issues/1296). InfluxDB: Auto escape column names with special characters. Thanks @steven-aerts
- [Issue #1321](https://github.com/grafana/grafana/issues/1321). SingleStatPanel: You can now use template variables in pre & postfix
- [Issue #599](https://github.com/grafana/grafana/issues/599).   Graph: Added right y axis label setting and graph support
- [Issue #1253](https://github.com/grafana/grafana/issues/1253). Graph & Singlestat: Users can now set decimal precision for legend and tooltips (override auto precision)
- [Issue #1255](https://github.com/grafana/grafana/issues/1255). Templating: Dashboard will now wait to load until all template variables that have refresh on load set or are initialized via url to be fully loaded and so all variables are in valid state before panels start issuing metric requests.
- [Issue #1344](https://github.com/grafana/grafana/issues/1344). OpenTSDB: Alias patterns (reference tag values), syntax is: $tag_tagname or [[tag_tagname]]

**Fixes**
- [Issue #1298](https://github.com/grafana/grafana/issues/1298). InfluxDB: Fix handling of empty array in templating variable query
- [Issue #1309](https://github.com/grafana/grafana/issues/1309). Graph: Fixed issue when using zero as a grid threshold
- [Issue #1345](https://github.com/grafana/grafana/issues/1345). UI: Fixed position of confirm modal when scrolled down
- [Issue #1372](https://github.com/grafana/grafana/issues/1372). Graphite: Fix for nested complex queries, where a query references a query that references another query (ie the #[A-Z] syntax)
- [Issue #1363](https://github.com/grafana/grafana/issues/1363). Templating: Fix to allow custom template variables to contain white space, now only splits on ','
- [Issue #1359](https://github.com/grafana/grafana/issues/1359). Graph: Fix for all series tooltip showing series with all null values when ``Hide Empty`` option is enabled
- [Issue #1497](https://github.com/grafana/grafana/issues/1497). Dashboard: Fixed memory leak when switching dashboards

**Changes**
- Dashboard title change & save will no longer create a new dashboard, it will just change the title.

**OpenTSDB breaking change**
- [Issue #1438](https://github.com/grafana/grafana/issues/1438). OpenTSDB: Automatic downsample interval passed to OpenTSDB (depends on timespan and graph width)
- NOTICE, Downsampling is now enabled by default, so if you have not picked a downsample aggregator in your metric query do so or your graphs will be misleading
- This will make Grafana a lot quicker for OpenTSDB users when viewing large time spans without having to change the downsample interval manually.

**Tech**
- [Issue #1311](https://github.com/grafana/grafana/issues/1311). Tech: Updated Font-Awesome from 3.2 to 4.2

# 1.9.1 (2014-12-29)

**Enhancements**
- [Issue #1028](https://github.com/grafana/grafana/issues/1028). Graph: New legend option ``hideEmtpy`` to hide series with only null values from legend
- [Issue #1242](https://github.com/grafana/grafana/issues/1242). OpenTSDB: Downsample query field now supports interval template variable
- [Issue #1126](https://github.com/grafana/grafana/issues/1126). InfluxDB: Support more than 10 series name segments when using alias ``$number`` patterns

**Fixes**
- [Issue #1251](https://github.com/grafana/grafana/issues/1251). Graph: Fix for y axis and scaled units (GiB etc) caused rounding, for example 400 GiB instead of 378 GiB
- [Issue #1199](https://github.com/grafana/grafana/issues/1199). Graph: fix for series tooltip when one series is hidden/disabled
- [Issue #1207](https://github.com/grafana/grafana/issues/1207). Graphite: movingAverage / movingMedian parameter type impovement, now handles int and interval parameter

# 1.9.0 (2014-12-02)

**Enhancements**
- [Issue #1130](https://github.com/grafana/grafana/issues/1130). SinglestatPanel: Added null point handling, and value to text mapping


**Fixes**
- [Issue #1087](https://github.com/grafana/grafana/issues/1087). Panel: Fixed IE9 crash due to angular drag drop
- [Issue #1093](https://github.com/grafana/grafana/issues/1093). SingleStatPanel: Fixed position for drilldown link tooltip when dashboard requires scrolling
- [Issue #1095](https://github.com/grafana/grafana/issues/1095). DrilldownLink: template variables in params property was not interpolated
- [Issue #1114](https://github.com/grafana/grafana/issues/1114). Graphite: Lexer fix, allow equal sign (=) in metric paths
- [Issue #1136](https://github.com/grafana/grafana/issues/1136). Graph: Fix to legend value Max and negative values
- [Issue #1150](https://github.com/grafana/grafana/issues/1150). SinglestatPanel: Fixed absolute drilldown link issue
- [Issue #1123](https://github.com/grafana/grafana/issues/1123). Firefox: Workaround for Firefox bug, caused input text fields to not be selectable and not have placeable cursor
- [Issue #1108](https://github.com/grafana/grafana/issues/1108). Graph: Fix for tooltip series order when series draw order was changed with zindex property

# 1.9.0-rc1 (2014-11-17)

**UI Improvements**
- [Issue #770](https://github.com/grafana/grafana/issues/770). UI: Panel dropdown menu replaced with a new panel menu

**Graph**
- [Issue #877](https://github.com/grafana/grafana/issues/877). Graph: Smart auto decimal precision when using scaled unit formats
- [Issue #850](https://github.com/grafana/grafana/issues/850). Graph: Shared tooltip that shows multiple series & crosshair line, thx @toni-moreno
- [Issue #940](https://github.com/grafana/grafana/issues/940). Graph: New series style override option "Fill below to", useful to visualize max & min as a shadow for the mean
- [Issue #1030](https://github.com/grafana/grafana/issues/1030). Graph: Legend table display/look changed, now includes column headers for min/max/avg, and full width (unless on right side)
- [Issue #861](https://github.com/grafana/grafana/issues/861). Graph: Export graph time series data as csv file

**New Panels**
- [Issue #951](https://github.com/grafana/grafana/issues/951). SingleStat: New singlestat panel

**Misc**
- [Issue #864](https://github.com/grafana/grafana/issues/846). Panel: Share panel feature, get a link to panel with the current time range
- [Issue #938](https://github.com/grafana/grafana/issues/938). Panel: Plugin panels now reside outside of app/panels directory
- [Issue #952](https://github.com/grafana/grafana/issues/952). Help: Shortcut "?" to open help modal with list of all shortcuts
- [Issue #991](https://github.com/grafana/grafana/issues/991). ScriptedDashboard: data source services are now available in scripted dashboards, you can query data source for metric keys, generate dashboards, and even save them in a scripted dashboard (see scripted_gen_and_save.js for example)
- [Issue #1041](https://github.com/grafana/grafana/issues/1041). Panel: All panels can now have links to other dashboards or absolute links, these links are available in the panel menu.

**Changes**
- [Issue #1007](https://github.com/grafana/grafana/issues/1007). Graph: Series hide/show toggle changed to be default exclusive, so clicking on a series name will show only that series. (SHIFT or meta)+click will toggle hide/show.

**OpenTSDB**
- [Issue #930](https://github.com/grafana/grafana/issues/930). OpenTSDB: Adding counter max and counter reset value to open tsdb query editor, thx @rsimiciuc
- [Issue #917](https://github.com/grafana/grafana/issues/917). OpenTSDB: Templating support for OpenTSDB series name and tags, thx @mchataigner

**InfluxDB**
- [Issue #714](https://github.com/grafana/grafana/issues/714). InfluxDB: Support for sub second resolution graphs

**Fixes**
- [Issue #925](https://github.com/grafana/grafana/issues/925). Graph: bar width calculation fix for some edge cases (bars would render on top of each other)
- [Issue #505](https://github.com/grafana/grafana/issues/505). Graph: fix for second y axis tick unit labels wrapping on the next line
- [Issue #987](https://github.com/grafana/grafana/issues/987). Dashboard: Collapsed rows became invisible when hide controls was enabled

=======
# 1.8.1 (2014-09-30)

**Fixes**
- [Issue #855](https://github.com/grafana/grafana/issues/855). Graph: Fix for scroll issue in graph edit mode when dropdown goes below screen
- [Issue #847](https://github.com/grafana/grafana/issues/847). Graph: Fix for series draw order not being the same after hiding/unhiding series
- [Issue #851](https://github.com/grafana/grafana/issues/851). Annotations: Fix for annotations not reloaded when switching between 2 dashboards with annotations
- [Issue #846](https://github.com/grafana/grafana/issues/846). Edit panes: Issue when open row or json editor when scrolled down the page, unable to scroll and you did not see editor
- [Issue #840](https://github.com/grafana/grafana/issues/840). Import: Fixes to import from json file and import from graphite. Issues was lingering state from previous dashboard.
- [Issue #859](https://github.com/grafana/grafana/issues/859). InfluxDB: Fix for bug when saving dashboard where title is the same as slugified url id
- [Issue #852](https://github.com/grafana/grafana/issues/852). White theme: Fixes for hidden series legend text and disabled annotations color

# 1.8.0 (2014-09-22)

Read this [blog post](https://grafana.com/blog/2014/09/11/grafana-1.8.0-rc1-released) for an overview of all improvements.

**Fixes**
- [Issue #802](https://github.com/grafana/grafana/issues/802). Annotations: Fix when using InfluxDB data source
- [Issue #795](https://github.com/grafana/grafana/issues/795). Chrome: Fix for display issue in chrome beta & chrome canary when entering edit mode
- [Issue #818](https://github.com/grafana/grafana/issues/818). Graph: Added percent y-axis format
- [Issue #828](https://github.com/grafana/grafana/issues/828). Elasticsearch: saving new dashboard with title equal to slugified url would cause it to deleted.
- [Issue #830](https://github.com/grafana/grafana/issues/830). Annotations: Fix for elasticsearch annotations and mapping nested fields

# 1.8.0-RC1 (2014-09-12)

**UI polish / changes**
- [Issue #725](https://github.com/grafana/grafana/issues/725). UI: All modal editors are removed and replaced by an edit pane under menu. The look of editors is also updated and polished. Search dropdown is also shown as pane under menu and has seen some UI polish.

**Filtering/Templating feature overhaul**
- Filtering renamed to Templating, and filter items to variables
- Filter editing has gotten its own edit pane with much improved UI and options
- [Issue #296](https://github.com/grafana/grafana/issues/296). Templating: Can now retrieve variable values from a non-default data source
- [Issue #219](https://github.com/grafana/grafana/issues/219). Templating: Template variable value selection is now a typeahead autocomplete dropdown
- [Issue #760](https://github.com/grafana/grafana/issues/760). Templating: Extend template variable syntax to include $variable syntax replacement
- [Issue #234](https://github.com/grafana/grafana/issues/234). Templating: Interval variable type for time intervals summarize/group by parameter, included "auto" option, and auto step counts option.
- [Issue #262](https://github.com/grafana/grafana/issues/262). Templating: Ability to use template variables for function parameters via custom variable type, can be used as parameter for movingAverage or scaleToSeconds for example
- [Issue #312](https://github.com/grafana/grafana/issues/312). Templating: Can now use template variables in panel titles
- [Issue #613](https://github.com/grafana/grafana/issues/613). Templating: Full support for InfluxDB, filter by part of series names, extract series substrings, nested queries, multiple where clauses!
- Template variables can be initialized from url, with var-my_varname=value, breaking change, before it was just my_varname.
- Templating and url state sync has some issues that are not solved for this release, see [Issue #772](https://github.com/grafana/grafana/issues/772) for more details.

**InfluxDB Breaking changes**
- To better support templating, fill(0) and group by time low limit some changes has been made to the editor and query model schema
- Currently some of these changes are breaking
- If you used custom condition filter you need to open the graph in edit mode, the editor will update the schema, and the queries should work again
- If you used a raw query you need to remove the time filter and replace it with $timeFilter (this is done automatically when you switch from query editor to raw query, but old raw queries needs to updated)
- If you used group by and later removed the group by the graph could break, open in editor and should correct it
- InfluxDB annotation queries that used [[timeFilter]] should be updated to use $timeFilter syntax instead
- Might write an upgrade tool to update dashboards automatically, but right now master (1.8) includes the above breaking changes

**InfluxDB query editor enhancements**
- [Issue #756](https://github.com/grafana/grafana/issues/756). InfluxDB: Add option for fill(0) and fill(null), integrated help in editor for why this option is important when stacking series
- [Issue #743](https://github.com/grafana/grafana/issues/743). InfluxDB: A group by time option for all queries in graph panel that supports a low limit for auto group by time, very important for stacking and fill(0)
- The above to enhancements solves the problems associated with stacked bars and lines when points are missing, these issues are solved:
- [Issue #673](https://github.com/grafana/grafana/issues/673). InfluxDB: stacked bars missing intermediate data points, unless lines also enabled
- [Issue #674](https://github.com/grafana/grafana/issues/674). InfluxDB: stacked chart ignoring series without latest values
- [Issue #534](https://github.com/grafana/grafana/issues/534). InfluxDB: No order in stacked bars mode

**New features and improvements**
- [Issue #117](https://github.com/grafana/grafana/issues/117). Graphite: Graphite query builder can now handle functions that multiple series as arguments!
- [Issue #281](https://github.com/grafana/grafana/issues/281). Graphite: Metric node/segment selection is now a textbox with autocomplete dropdown, allow for custom glob expression for single node segment without entering text editor mode.
- [Issue #304](https://github.com/grafana/grafana/issues/304). Dashboard: View dashboard json, edit/update any panel using json editor, makes it possible to quickly copy a graph from one dashboard to another.
- [Issue #578](https://github.com/grafana/grafana/issues/578). Dashboard: Row option to display row title even when the row is visible
- [Issue #672](https://github.com/grafana/grafana/issues/672). Dashboard: panel fullscreen & edit state is present in url, can now link to graph in edit & fullscreen mode.
- [Issue #709](https://github.com/grafana/grafana/issues/709). Dashboard: Small UI look polish to search results, made dashboard title link are larger
- [Issue #425](https://github.com/grafana/grafana/issues/425). Graph: New section in 'Display Styles' tab to override any display setting on per series bases (mix and match lines, bars, points, fill, stack, line width etc)
- [Issue #634](https://github.com/grafana/grafana/issues/634). Dashboard: Dashboard tags now in different colors (from fixed palette) determined by tag name.
- [Issue #685](https://github.com/grafana/grafana/issues/685). Dashboard: New config.js option to change/remove window title prefix.
- [Issue #781](https://github.com/grafana/grafana/issues/781). Dashboard: Title URL is now slugified for greater URL readability, works with both ES & InfluxDB storage, is backward compatible
- [Issue #785](https://github.com/grafana/grafana/issues/785). Elasticsearch: Support for full elasticsearch lucene search grammar when searching for dashboards, better async search
- [Issue #787](https://github.com/grafana/grafana/issues/787). Dashboard: time range can now be read from URL parameters, will override dashboard saved time range

**Fixes**
- [Issue #696](https://github.com/grafana/grafana/issues/696). Graph: Fix for y-axis format 'none' when values are in scientific notation (ex 2.3e-13)
- [Issue #733](https://github.com/grafana/grafana/issues/733). Graph: Fix for tooltip current value decimal precision when 'none' axis format was selected
- [Issue #697](https://github.com/grafana/grafana/issues/697). Graphite: Fix for Glob syntax in graphite queries ([1-9] and ?) that made the query editor / parser bail and fallback to a text box.
- [Issue #702](https://github.com/grafana/grafana/issues/702). Graphite: Fix for nonNegativeDerivative function, now possible to not include optional first parameter maxValue
- [Issue #277](https://github.com/grafana/grafana/issues/277). Dashboard: Fix for timepicker date & tooltip when UTC timezone selected.
- [Issue #699](https://github.com/grafana/grafana/issues/699). Dashboard: Fix for bug when adding rows from dashboard settings dialog.
- [Issue #723](https://github.com/grafana/grafana/issues/723). Dashboard: Fix for hide controls setting not used/initialized on dashboard load
- [Issue #724](https://github.com/grafana/grafana/issues/724). Dashboard: Fix for zoom out causing right hand "to" range to be set in the future.

**Tech**
- Upgraded from angularjs 1.1.5 to 1.3 beta 17;
- Switch from underscore to lodash
- helpers to easily unit test angularjs controllers and services
- Test coverage through coveralls
- Upgrade from jquery 1.8.0 to 2.1.1 (**Removes support for IE7 & IE8**)

# 1.7.1 (unreleased)

**Fixes**
- [Issue #691](https://github.com/grafana/grafana/issues/691). Dashboard: Tooltip fixes, sometimes they would not show, and sometimes they would get stuck.
- [Issue #695](https://github.com/grafana/grafana/issues/695). Dashboard: Tooltip on goto home menu icon would get stuck after clicking on it

# 1.7.0 (2014-08-11)

**Fixes**
- [Issue #652](https://github.com/grafana/grafana/issues/652). Timepicker: Entering custom date range impossible when refresh is low (now is constantly reset)
- [Issue #450](https://github.com/grafana/grafana/issues/450). Graph: Tooltip does not disappear sometimes and would get stuck
- [Issue #655](https://github.com/grafana/grafana/issues/655). General: Auto refresh not initiated / started after dashboard loading
- [Issue #657](https://github.com/grafana/grafana/issues/657). General: Fix for refresh icon in IE browsers
- [Issue #661](https://github.com/grafana/grafana/issues/661). Annotations: Elasticsearch querystring with filter template replacements was not interpolated
- [Issue #660](https://github.com/grafana/grafana/issues/660). OpenTSDB: fix opentsdb queries that returned more than one series

**Change**
- [Issue #681](https://github.com/grafana/grafana/issues/681). Dashboard: The panel error bar has been replaced with a small error indicator, this indicator does not change panel height and is a lot less intrusive. Hover over it for short details, click on it for more details.

# 1.7.0-rc1 (2014-08-05)

**New features or improvements**
- [Issue #581](https://github.com/grafana/grafana/issues/581). InfluxDB: Add continuous query in series results (series typeahead).
- [Issue #584](https://github.com/grafana/grafana/issues/584). InfluxDB: Support for alias & alias patterns when using raw query mode
- [Issue #394](https://github.com/grafana/grafana/issues/394). InfluxDB: Annotation support
- [Issue #633](https://github.com/grafana/grafana/issues/633). InfluxDB: InfluxDB can now act as a datastore for dashboards
- [Issue #610](https://github.com/grafana/grafana/issues/610). InfluxDB: Support for InfluxdB v0.8 list series response schemea (series typeahead)
- [Issue #525](https://github.com/grafana/grafana/issues/525). InfluxDB: Enhanced series aliasing (legend names) with pattern replacements
- [Issue #266](https://github.com/grafana/grafana/issues/266). Graphite: New option cacheTimeout to override graphite default memcache timeout
- [Issue #606](https://github.com/grafana/grafana/issues/606). General: New global option in config.js to specify admin password (useful to hinder users from accidentally make changes)
- [Issue #201](https://github.com/grafana/grafana/issues/201). Annotations: Elasticsearch data source support for events
- [Issue #344](https://github.com/grafana/grafana/issues/344). Annotations: Annotations can now be fetched from non default data sources
- [Issue #631](https://github.com/grafana/grafana/issues/631). Search: max_results config.js option & scroll in search results (To show more or all dashboards)
- [Issue #511](https://github.com/grafana/grafana/issues/511). Text panel: Allow [[..]] filter notation in all text panels (markdown/html/text)
- [Issue #136](https://github.com/grafana/grafana/issues/136). Graph: New legend display option "Align as table"
- [Issue #556](https://github.com/grafana/grafana/issues/556). Graph: New legend display option "Right side", will show legend to the right of the graph
- [Issue #604](https://github.com/grafana/grafana/issues/604). Graph: New axis format, 'bps' (SI unit in steps of 1000) useful for network gear metics
- [Issue #626](https://github.com/grafana/grafana/issues/626). Graph: Downscale y axis to more precise unit, value of 0.1 for seconds format will be formatted as 100 ms. Thanks @kamaradclimber
- [Issue #618](https://github.com/grafana/grafana/issues/618). OpenTSDB: Series alias option to override metric name returned from opentsdb. Thanks @heldr

**Documentation**
- [Issue #635](https://github.com/grafana/grafana/issues/635). Docs for features and changes in v1.7, new troubleshooting guide, new Getting started guide, improved install & config guide.


**Changes**
- [Issue #536](https://github.com/grafana/grafana/issues/536). Graphite: Use unix epoch for Graphite from/to for absolute time ranges
- [Issue #641](https://github.com/grafana/grafana/issues/536). General: Dashboard save temp copy feature settings moved from dashboard to config.js, default is enabled, and ttl to 30 days
- [Issue #532](https://github.com/grafana/grafana/issues/532). Schema: Dashboard schema changes, "Unsaved changes" should not appear for schema changes. All changes are backward compatible with old schema.

**Fixes**
- [Issue #545](https://github.com/grafana/grafana/issues/545). Graph: Fix formatting negative values (axis formats, legend values)
- [Issue #460](https://github.com/grafana/grafana/issues/460). Graph: fix for max legend value when max value is zero
- [Issue #628](https://github.com/grafana/grafana/issues/628). Filtering: Fix for nested filters, changing a child filter could result in infinite recursion in some cases
- [Issue #528](https://github.com/grafana/grafana/issues/528). Graphite: Fix for graphite expressions parser failure when metric expressions starts with curly brace segment

# 1.6.1 (2014-06-24)

**New features or improvements**
- [Issue #360](https://github.com/grafana/grafana/issues/360). Ability to set y min/max for right y-axis (RR #519)

**Fixes**

- [Issue #500](https://github.com/grafana/grafana/issues/360). Fixes regex InfluxDB queries intoduced in 1.6.0
- [Issue #506](https://github.com/grafana/grafana/issues/506). Bug in when using % sign in legends (aliases), fixed by removing url decoding of metric names
- [Issue #522](https://github.com/grafana/grafana/issues/522). Series names and column name typeahead cache fix
- [Issue #504](https://github.com/grafana/grafana/issues/504). Fixed influxdb issue with raw query that caused wrong value column detection
- [Issue #526](https://github.com/grafana/grafana/issues/526). Default property that marks which data source is default in config.js is now optional
- [Issue #342](https://github.com/grafana/grafana/issues/342). Auto-refresh caused 2 refreshes (and hence multiple queries) each time (at least in firefox)

# 1.6.0 (2014-06-16)

#### New features or improvements
- [Issue #427](https://github.com/grafana/grafana/issues/427). New Y-axis formater for metric values that represent seconds, Thanks @jippi
- [Issue #390](https://github.com/grafana/grafana/issues/390). Allow special characters in series names (influxdb data source), Thanks @majst01
- [Issue #428](https://github.com/grafana/grafana/issues/428). Refactoring of filterSrv, Thanks @Tetha
- [Issue #445](https://github.com/grafana/grafana/issues/445). New config for playlist feature. Set playlist_timespan to set default playlist interval, Thanks @rmca
- [Issue #461](https://github.com/grafana/grafana/issues/461). New graphite function definition added isNonNull,  Thanks @tmonk42
- [Issue #455](https://github.com/grafana/grafana/issues/455). New InfluxDB function difference add to function dropdown
- [Issue #459](https://github.com/grafana/grafana/issues/459). Added parameter to keepLastValue graphite function definition (default 100)
  [Issue #418](https://github.com/grafana/grafana/issues/418). to the browser cache when upgrading grafana and improve load performance
- [Issue #327](https://github.com/grafana/grafana/issues/327). Partial support for url encoded metrics when using Graphite data source. Thanks @axe-felix
- [Issue #473](https://github.com/grafana/grafana/issues/473). Improvement to InfluxDB query editor and function/value column selection
- [Issue #375](https://github.com/grafana/grafana/issues/375). Initial support for filtering (templated queries) for InfluxDB. Thanks @mavimo
- [Issue #475](https://github.com/grafana/grafana/issues/475). Row editing and adding new panel is now a lot quicker and easier with the new row menu
- [Issue #211](https://github.com/grafana/grafana/issues/211). New data source! Initial support for OpenTSDB, Thanks @mpage
- [Issue #492](https://github.com/grafana/grafana/issues/492). Improvement and polish to the OpenTSDB query editor
- [Issue #441](https://github.com/grafana/grafana/issues/441). Influxdb group by support, Thanks @piis3
- improved asset (css/js) build pipeline, added revision to css and js. Will remove issues related


#### Changes
- [Issue #475](https://github.com/grafana/grafana/issues/475). Add panel icon and Row edit button is replaced by the Row edit menu
- New graphs now have a default empty query
- Add Row button now creates a row with default height of 250px (no longer opens dashboard settings modal)
- Clean up of config.sample.js, graphiteUrl removed (still works, but deprecated, removed in future)
  Use data sources config instead. panel_names removed from config.js. Use plugins.panels to add custom panels
- Graphite panel is now renamed graph (Existing dashboards will still work)

#### Fixes
- [Issue #126](https://github.com/grafana/grafana/issues/126). Graphite query lexer change, can now handle regex parameters for aliasSub function
- [Issue #447](https://github.com/grafana/grafana/issues/447). Filter option loading when having multiple nested filters now works better. Options are now reloaded correctly and there are no multiple renders/refresh in between.
- [Issue #412](https://github.com/grafana/grafana/issues/412). After a filter option is changed and a nested template param is reloaded, if the current value exists after the options are reloaded the current selected value is kept.
- [Issue #460](https://github.com/grafana/grafana/issues/460). Legend Current value did not display when value was zero
- [Issue #328](https://github.com/grafana/grafana/issues/328). Fix to series toggling bug that caused annotations to be hidden when toggling/hiding series.
- [Issue #293](https://github.com/grafana/grafana/issues/293). Fix for graphite function selection menu that some times draws outside screen. It now displays upward
- [Issue #350](https://github.com/grafana/grafana/issues/350). Fix for exclusive series toggling (hold down CTRL, SHIFT or META key) and left click a series for exclusive toggling
- [Issue #472](https://github.com/grafana/grafana/issues/472). CTRL does not work on MAC OSX but SHIFT or META should (depending on browser)

# 1.5.4 (2014-05-13)
### New features and improvements
- InfluxDB enhancement: support for multiple hosts (with retries) and raw queries ([Issue #318](https://github.com/grafana/grafana/issues/318), thx @toddboom)
- Added rounding for graphites from and to time range filters
  for very short absolute ranges ([Issue #320](https://github.com/grafana/grafana/issues/320))
- Increased resolution for graphite datapoints (maxDataPoints), now equal to panel pixel width. ([Issue #5](https://github.com/grafana/grafana/issues/5))
- Improvement to influxdb query editor, can now add where clause and alias ([Issue #331](https://github.com/grafana/grafana/issues/331), thanks @mavimo)
- New config setting for graphite data source to control if json render request is POST or GET ([Issue #345](https://github.com/grafana/grafana/issues/345))
- Unsaved changes warning feature ([Issue #324](https://github.com/grafana/grafana/issues/324))
- Improvement to series toggling, CTRL+MouseClick on series name will now hide all others ([Issue #350](https://github.com/grafana/grafana/issues/350))

### Changes
- Graph default setting for Y-Min changed from zero to auto scalling (will not effect existing dashboards). ([Issue #386](https://github.com/grafana/grafana/issues/386)) - thx @kamaradclimber

### Fixes
- Fixes to filters and "All" option. It now never uses "*" as value, but all options in a {node1, node2, node3} expression ([Issue #228](https://github.com/grafana/grafana/issues/228), #359)
- Fix for InfluxDB query generation with columns containing dots or dashes ([Issue #369](https://github.com/grafana/grafana/issues/369), #348) - Thanks to @jbripley


# 1.5.3 (2014-04-17)
- Add support for async scripted dashboards ([Issue #274](https://github.com/grafana/grafana/issues/274))
- Text panel now accepts html (for links to other dashboards, etc) ([Issue #236](https://github.com/grafana/grafana/issues/236))
- Fix for Text panel, now changes take effect directly ([Issue #251](https://github.com/grafana/grafana/issues/251))
- Fix when adding functions without params that did not cause graph to update ([Issue #267](https://github.com/grafana/grafana/issues/267))
- Graphite errors are now much easier to see and troubleshoot with the new inspector ([Issue #265](https://github.com/grafana/grafana/issues/265))
- Use influxdb aliases to distinguish between multiple columns ([Issue #283](https://github.com/grafana/grafana/issues/283))
- Correction to ms axis formater, now formats days correctly. ([Issue #189](https://github.com/grafana/grafana/issues/189))
- Css fix for Firefox and using top menu dropdowns in panel fullscreen / edit mode ([Issue #106](https://github.com/grafana/grafana/issues/106))
- Browser page title is now Grafana - {{dashboard title}} ([Issue #294](https://github.com/grafana/grafana/issues/294))
- Disable auto refresh zooming in (every time you change to an absolute time range), refresh will be restored when you change time range back to relative ([Issue #282](https://github.com/grafana/grafana/issues/282))
- More graphite functions

# 1.5.2 (2014-03-24)
### New Features and improvements
- Support for second optional params for functions like aliasByNode ([Issue #167](https://github.com/grafana/grafana/issues/167)). Read the wiki on the [Function Editor](https://github.com/torkelo/grafana/wiki/Graphite-Function-Editor) for more info.
- More functions added to InfluxDB query editor ([Issue #218](https://github.com/grafana/grafana/issues/218))
- Filters can now be used inside other filters (templated segments) ([Issue #128](https://github.com/grafana/grafana/issues/128))
- More graphite functions added

### Fixes
- Float arguments now work for functions like scale ([Issue #223](https://github.com/grafana/grafana/issues/223))
- Fix for graphite function editor, the graph & target was not updated after adding a function and leaving default params as is #191

The zip files now contains a sub folder with project name and version prefix. ([Issue #209](https://github.com/grafana/grafana/issues/209))

# 1.5.1 (2014-03-10)
### Fixes
- maxDataPoints must be an integer #184 (thanks @frejsoya for fixing this)

For people who are find Grafana slow for large time spans or high resolution metrics. This is most likely due to graphite returning a large number of datapoints. The maxDataPoints parameter solves this issue. For maxDataPoints to work you need to run the latest graphite-web (some builds of 0.9.12 does not include this feature).

Read this for more info:
[Performance for large time spans](https://github.com/torkelo/grafana/wiki/Performance-for-large-time-spans)

# 1.5.0 (2014-03-09)
### New Features and improvements
- New function editor [video demo](http://youtu.be/I90WHRwE1ZM) ([Issue #178](https://github.com/grafana/grafana/issues/178))
- Links to function documentation from function editor ([Issue #3](https://github.com/grafana/grafana/issues/3))
- Reorder functions ([Issue #130](https://github.com/grafana/grafana/issues/130))
- [Initial support for InfluxDB](https://github.com/torkelo/grafana/wiki/InfluxDB) as metric data source (#103), need feedback!
- [Dashboard playlist](https://github.com/torkelo/grafana/wiki/Dashboard-playlist) ([Issue #36](https://github.com/grafana/grafana/issues/36))
- When adding aliasByNode smartly set node number ([Issue #175](https://github.com/grafana/grafana/issues/175))
- Support graphite identifiers with embedded colons ([Issue #173](https://github.com/grafana/grafana/issues/173))
- Typeahead & autocomplete when adding new function ([Issue #164](https://github.com/grafana/grafana/issues/164))
- More graphite function definitions
- Make "ms" axis format include hour, day, weeks, month and year ([Issue #149](https://github.com/grafana/grafana/issues/149))
- Microsecond axis format ([Issue #146](https://github.com/grafana/grafana/issues/146))
- Specify template parameters in URL ([Issue #123](https://github.com/grafana/grafana/issues/123))

### Fixes
- Basic Auth fix ([Issue #152](https://github.com/grafana/grafana/issues/152))
- Fix to annotations with graphite source & null values ([Issue #138](https://github.com/grafana/grafana/issues/138))

# 1.4.0 (2014-02-21)
### New Features
- #44 Annotations! Required a lot of work to get right. Read wiki article for more info. Supported annotations data sources are graphite metrics and graphite events. Support for more will be added in the future!
- #35 Support for multiple graphite servers! (Read wiki article for more)
- #116 Back to dashboard link in top menu to easily exist full screen / edit mode.
- #114, #97 Legend values now use the same y axes formatter
- #77 Improvements and polish to the light theme

### Changes
- #98 Stack is no longer by default turned on in graph display settings.
- Hide controls (Ctrl+h) now hides the sub menu row (where filtering, and annotations are). So if you had filtering enabled and hide controls enabled you will not see the filtering sub menu.

### Fixes:
- #94 Fix for bug that caused dashboard settings to sometimes not contain timepicker tab.
- #110 Graph with many many metrics caused legend to push down graph editor below screen. You can now scroll in edit mode & full screen mode for graphs with lots of series & legends.
- #104 Improvement to graphite target editor, select wildcard now gives you a "select metric" link for the next node.
- #105 Added zero as a possible node value in groupByAlias function

# 1.3.0 (2014-02-13)
### New features or improvements
- #86 Dashboard tags and search (see wiki article for details)
- #54 Enhancement to filter / template. "Include All" improvement
- #82 Dashboard search result sorted in alphabetical order

### Fixes
- #91 Custom date selector is one day behind
- #89 Filter / template does not work after switching dashboard
- #88 Closed / Minimized row css bug
- #85 Added all parameters to summarize function
- #83 Stack as percent should now work a lot better!

# 1.2.0 (2014-02-10)
### New features
- #70 Grid Thresholds (warning and error regions or lines in graph)
- #72 Added an example of a scripted dashboard and a short wiki article documenting scripted dashboards.

### Fixes
- #81 Grid min/max values are ignored bug
- #80 "stacked as percent" graphs should always use "max" value of 100 bug
- #73 Left Y format change did not work
- #42 Fixes to grid min/max auto scaling
- #69 Fixes to lexer/parser for metrics segments like "10-20".
- #67 Allow decimal input for scale function
- #68 Bug when trying to open dashboard while in edit mode

# 1.1.0 (2014-02-06)
### New features:

- #22 Support for native graphite png renderer, does not support click and select zoom yet
- #60 Support for legend values (cactiStyle, min, max, current, total, avg). The options for these are found in the new "Axes & Grid" tab for now.
- #62 There is now a "New" button in the search/open dashboard view to quickly open a clean empty dashboard.
- #55 Basic auth is now supported for elastic search as well
- some new function definitions added (will focus more on this for next release).

### Fixes
- #45 zero values from graphite was handled as null.
- #63 Kibana / Grafana on same host would use same localStorage keys, now fixed
- #46 Impossible to edit graph without a name fixed.
- #24 fix for dashboard search when elastic search is configured to disable _all field.
- #38 Improvement to lexer / parser to support pure numeric literals in metric segments

Thanks to everyone who contributed fixes and provided feedback :+1:

# 1.0.4 (2014-01-24)
- [Issue #28](https://github.com/grafana/grafana/issues/28) - Relative time range caused 500 graphite error in some cases (thx rsommer for the fix)

# 1.0.3 (2014-01-23)
- #9 Add Y-axis format for milliseconds
- #16 Add support for Basic Auth (use http://username:password@yourgraphitedomain.com)
- #13 Relative time ranges now uses relative time ranges when issuing graphite query

# 1.0.2 (2014-01-21)
- [Issue #12](https://github.com/grafana/grafana/issues/12), should now work ok without ElasticSearch

# 1.0.1 (2014-01-21)
- Resize fix
- Improvements to drag & drop
- Added a few graphite function definitions
- Fixed duplicate panel bug
- Updated default dashboard with welcome message and randomWalk graph

# 1.0.0 (2014-01-19)

First public release
