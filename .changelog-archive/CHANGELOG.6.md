<!-- 6.7.6 START -->

# 6.7.6 (2021-03-18)

### Bug fixes

- **Security**: Fix API permissions issues related to team-sync CVE-2021-28147. (Enterprise)
- **Security**: Usage insights requires signed in users CVE-2021-28148. (Enterprise)

<!-- 6.7.6 END -->

<!-- 6.7.5 START -->

# 6.7.5 (2020-12-17)

### Security

- **SAML**: Fixes encoding/xml SAML vulnerability in Grafana Enterprise [#29875](https://github.com/grafana/grafana/issues/29875), [@bergquist](https://github.com/bergquist)

<!-- 6.7.5 END -->

# 6.7.4 (2020-06-03)

- **Security**: Urgent security patch release. Please read more in our [blog](https://grafana.com/blog/2020/06/03/grafana-6.7.4-and-7.0.2-released-with-important-security-fix/)

# 6.7.3 (2020-04-23)

### Bug Fixes

- **Admin**: Fix Synced via LDAP message for non-LDAP external users. [#23477](https://github.com/grafana/grafana/pull/23477), [@alexanderzobnin](https://github.com/alexanderzobnin)
- **Alerting**: Fixes notifications for alerts with empty message in Google Hangouts notifier. [#23559](https://github.com/grafana/grafana/pull/23559), [@hugohaggmark](https://github.com/hugohaggmark)
- **AuthProxy**: Fixes bug where long username could not be cached.. [#22926](https://github.com/grafana/grafana/pull/22926), [@jcmcken](https://github.com/jcmcken)
- **Dashboard**: Fix saving dashboard when editing raw dashboard JSON model. [#23314](https://github.com/grafana/grafana/pull/23314), [@peterholmberg](https://github.com/peterholmberg)
- **Dashboard**: Try to parse 8 and 15 digit numbers as timestamps if parsing of time range as date fails. [#21694](https://github.com/grafana/grafana/pull/21694), [@jessetan](https://github.com/jessetan)
- **DashboardListPanel**: Fixed problem with empty panel after going into edit mode (General folder filter being automatically added) . [#23426](https://github.com/grafana/grafana/pull/23426), [@torkelo](https://github.com/torkelo)
- **Data source**: Handle datasource withCredentials option properly. [#23380](https://github.com/grafana/grafana/pull/23380), [@hvtuananh](https://github.com/hvtuananh)
- **Security**: Fix annotation popup XSS vulnerability [#23813](https://github.com/grafana/grafana/pull/23813), [@torkelo](https://github.com/torkelo). Big thanks to Juha Laaksonen for reporting this issue.
- **Security**: Fix XSS vulnerability in table panel [#23816](https://github.com/grafana/grafana/pull/23816), [@torkelo](https://github.com/torkelo). Big thanks to Rotem Reiss for reporting this issue.
- **Server**: Exit Grafana with status code 0 if no error. [#23312](https://github.com/grafana/grafana/pull/23312), [@aknuds1](https://github.com/aknuds1)
- **TablePanel**: Fix XSS issue in header column rename (backport). [#23814](https://github.com/grafana/grafana/pull/23814), [@torkelo](https://github.com/torkelo)
- **Variables**: Fixes error when setting adhoc variable values. [#23580](https://github.com/grafana/grafana/pull/23580), [@hugohaggmark](https://github.com/hugohaggmark)

# 6.7.2 (2020-04-02)

### Bug Fixes

- **BackendSrv**: Adds config to response to fix issue for external plugins that used this property . [#23032](https://github.com/grafana/grafana/pull/23032), [@torkelo](https://github.com/torkelo)
- **Dashboard**: Fixed issue with saving new dashboard after changing title . [#23104](https://github.com/grafana/grafana/pull/23104), [@dprokop](https://github.com/dprokop)
- **DataLinks**: make sure we use the correct datapoint when dataset contains null value.. [#22981](https://github.com/grafana/grafana/pull/22981), [@mckn](https://github.com/mckn)
- **Plugins**: Fixed issue for plugins that imported dateMath util . [#23069](https://github.com/grafana/grafana/pull/23069), [@mckn](https://github.com/mckn)
- **Security**: Fix for dashboard snapshot original dashboard link could contain XSS vulnerability in url. [#23254](https://github.com/grafana/grafana/pull/23254), [@torkelo](https://github.com/torkelo). Big thanks to Ahmed A. Sherif for reporting this issue.
- **Variables**: Fixes issue with too many queries being issued for nested template variables after value change. [#23220](https://github.com/grafana/grafana/pull/23220), [@torkelo](https://github.com/torkelo)
- **Plugins**: Expose promiseToDigest. [#23249](https://github.com/grafana/grafana/pull/23249), [@torkelo](https://github.com/torkelo)
- **Reporting**: Fixes issue updating a report created by someone else (Enterprise)

# 6.7.1 (2020-03-20)

### Bug Fixes

- **Azure**: Fixed dropdowns not showing current value. [#22914](https://github.com/grafana/grafana/pull/22914), [@torkelo](https://github.com/torkelo)
- **BackendSrv**: only add content-type on POST, PUT requests. [#22910](https://github.com/grafana/grafana/pull/22910), [@hugohaggmark](https://github.com/hugohaggmark)
- **Panels**: Fixed size issue with panel internal size when exiting panel edit mode. [#22912](https://github.com/grafana/grafana/pull/22912), [@torkelo](https://github.com/torkelo)
- **Reporting**: fixes migrations compatibility with mysql (Enterprise)
- **Reporting**: Reduce default concurrency limit to 4 (Enterprise)

# 6.7.0 (2020-03-19)

### Features / Enhancements

- **AzureMonitor**: support workspaces function for template variables. [#22882](https://github.com/grafana/grafana/pull/22882), [@daniellee](https://github.com/daniellee)
- **SQLStore**: Add migration for adding index on annotation.alert_id. [#22876](https://github.com/grafana/grafana/pull/22876), [@aknuds1](https://github.com/aknuds1)
- **TablePanel**: Enable new units picker . [#22833](https://github.com/grafana/grafana/pull/22833), [@dprokop](https://github.com/dprokop)

### Bug Fixes

- **AngularPanels**: Fixed inner height calculation for angular panels . [#22796](https://github.com/grafana/grafana/pull/22796), [@torkelo](https://github.com/torkelo)
- **BackendSrv**: makes sure provided headers are correctly recognized and set. [#22778](https://github.com/grafana/grafana/pull/22778), [@hugohaggmark](https://github.com/hugohaggmark)
- **Forms**: Fix input suffix position (caret-down in Select) . [#22780](https://github.com/grafana/grafana/pull/22780), [@torkelo](https://github.com/torkelo)
- **Graphite**: Fixed issue with query editor and next select metric now showing after selecting metric node . [#22856](https://github.com/grafana/grafana/pull/22856), [@torkelo](https://github.com/torkelo)
- **Rich History**: UX adjustments and fixes. [#22729](https://github.com/grafana/grafana/pull/22729), [@ivanahuckova](https://github.com/ivanahuckova)

# 6.7.0-beta1 (2020-03-12)

## Breaking changes

- **Slack**: Removed _Mention_ setting and instead introduce _Mention Users_, _Mention Groups_, and _Mention Channel_. The first two settings require user and group IDs, respectively. This change was necessary because the way of mentioning via the Slack API [changed](https://api.slack.com/changelog/2017-09-the-one-about-usernames) and mentions in Slack notifications no longer worked.
- **Alerting**: Reverts the behavior of `diff` and `percent_diff` to not always be absolute. Something we introduced by mistake in [6.1.0](https://github.com/grafana/grafana/commit/28eaac3a9c7082e8c496005c1cb66b4b70a4f82f). Alerting now support `diff()`, `diff_abs()`, `percent_diff()` and `percent_diff_abs()`. [#21338](https://github.com/grafana/grafana/pull/21338)

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

Another unfortunate outcome from this work in `backendSrv` is that the response format for `.headers()` changed from a function to an object.

To make your plugin work on 6.7.x as well as on previous versions you should add something like the following:

```typescript
let responseHeaders = response.headers;
if (!responseHeaders) {
  return null;
}

// Support pre 6.7 angular HTTP rather than fetch
if (typeof responseHeaders === 'function') {
  responseHeaders = responseHeaders();
}
```

You can test your plugin with the `master` branch version of Grafana.

### Features / Enhancements

- **API**: Include IP address when logging request error. [#21596](https://github.com/grafana/grafana/pull/21596), [@thedeveloperr](https://github.com/thedeveloperr)
- **Alerting**: Support passing tags to Pagerduty and allow notification on specific event categories . [#21335](https://github.com/grafana/grafana/pull/21335), [@johntdyer](https://github.com/johntdyer)
- **Chore**: Remove angular dependency from backendSrv. [#20999](https://github.com/grafana/grafana/pull/20999), [@kaydelaney](https://github.com/kaydelaney)
- **CloudWatch**: Surround dimension names with double quotes. [#22222](https://github.com/grafana/grafana/pull/22222), [@jeet-parekh](https://github.com/jeet-parekh)
- **CloudWatch**: updated metrics and dimensions for Athena, DocDB, and Route53Resolver. [#22604](https://github.com/grafana/grafana/pull/22604), [@jeet-parekh](https://github.com/jeet-parekh)
- **Cloudwatch**: add Usage Metrics. [#22179](https://github.com/grafana/grafana/pull/22179), [@passing](https://github.com/passing)
- **Dashboard**: Adds support for a global minimum dashboard refresh interval. [#19416](https://github.com/grafana/grafana/pull/19416), [@lfroment0](https://github.com/lfroment0)
- **DatasourceEditor**: Add UI to edit custom HTTP headers. [#17846](https://github.com/grafana/grafana/pull/17846), [@adrien-f](https://github.com/adrien-f)
- **Elastic**: To get fields, start with today's index and go backwards. [#22318](https://github.com/grafana/grafana/pull/22318), [@ChadiEM](https://github.com/ChadiEM)
- **Explore**: Rich history. [#22570](https://github.com/grafana/grafana/pull/22570), [@ivanahuckova](https://github.com/ivanahuckova)
- **Graph**: canvas's Stroke is executed after loop. [#22610](https://github.com/grafana/grafana/pull/22610), [@merturl](https://github.com/merturl)
- **Graphite**: Don't issue empty "select metric" queries. [#22699](https://github.com/grafana/grafana/pull/22699), [@papagian](https://github.com/papagian)
- **Image Rendering**: Store render key in remote cache to enable renderer to callback to public/load balancer URL when running in HA mode. [#22031](https://github.com/grafana/grafana/pull/22031), [@marefr](https://github.com/marefr)
- **LDAP**: Add fallback to search_base_dns if group_search_base_dns is undefined.. [#21263](https://github.com/grafana/grafana/pull/21263), [@bb-Ricardo](https://github.com/bb-Ricardo)
- **OAuth**: Implement Azure AD provide. [#20030](https://github.com/grafana/grafana/pull/20030), [@twendt](https://github.com/twendt)
- **Prometheus**: Implement region annotation. [#22225](https://github.com/grafana/grafana/pull/22225), [@secustor](https://github.com/secustor)
- **Prometheus**: make \$\_\_range more precise. [#21722](https://github.com/grafana/grafana/pull/21722), [@bmerry](https://github.com/bmerry)
- **Prometheus**: Do not show rate hint when increase function is used in query. [#21955](https://github.com/grafana/grafana/pull/21955), [@fredwangwang](https://github.com/fredwangwang)
- **Stackdriver**: Project selector. [#22447](https://github.com/grafana/grafana/pull/22447), [@sunker](https://github.com/sunker)
- **TablePanel**: display multi-line text. [#20210](https://github.com/grafana/grafana/pull/20210), [@michael-az](https://github.com/michael-az)
- **Templating**: Add new global built-in variables. [#21790](https://github.com/grafana/grafana/pull/21790), [@dcastanier](https://github.com/dcastanier)
- **Reporting**: add concurrent render limit to settings (Enterprise)
- **Reporting**: Add rendering timeout in settings (Enterprise)

### Bug Fixes

- **API**: Fix redirect issues. [#22285](https://github.com/grafana/grafana/pull/22285), [@papagian](https://github.com/papagian)
- **Alerting**: Don't include image_url field with Slack message if empty. [#22372](https://github.com/grafana/grafana/pull/22372), [@aknuds1](https://github.com/aknuds1)
- **Alerting**: Fixed bad background color for default notifications in alert tab . [#22660](https://github.com/grafana/grafana/pull/22660), [@krvajal](https://github.com/krvajal)
- **Annotations**: In table panel when setting transform to annotation, they will now show up right away without a manual refresh. [#22323](https://github.com/grafana/grafana/pull/22323), [@krvajal](https://github.com/krvajal)
- **Azure Monitor**: Fix app insights source to allow for new **timeFrom and **timeTo. [#21879](https://github.com/grafana/grafana/pull/21879), [@ChadNedzlek](https://github.com/ChadNedzlek)
- **BackendSrv**: Fixes POST body for form data. [#21714](https://github.com/grafana/grafana/pull/21714), [@hugohaggmark](https://github.com/hugohaggmark)
- **CloudWatch**: Credentials cache invalidation fix. [#22473](https://github.com/grafana/grafana/pull/22473), [@sunker](https://github.com/sunker)
- **CloudWatch**: Expand alias variables when query yields no result. [#22695](https://github.com/grafana/grafana/pull/22695), [@sunker](https://github.com/sunker)
- **Dashboard**: Fix bug with NaN in alerting. [#22053](https://github.com/grafana/grafana/pull/22053), [@a-melnyk](https://github.com/a-melnyk)
- **Explore**: Fix display of multiline logs in log panel and explore. [#22057](https://github.com/grafana/grafana/pull/22057), [@thomasdraebing](https://github.com/thomasdraebing)
- **Heatmap**: Legend color range is incorrect when using custom min/max. [#21748](https://github.com/grafana/grafana/pull/21748), [@sv5d](https://github.com/sv5d)
- **Security**: Fixed XSS issue in dashboard history diff . [#22680](https://github.com/grafana/grafana/pull/22680), [@torkelo](https://github.com/torkelo)
- **StatPanel**: Fixes base color is being used for null values .
  [#22646](https://github.com/grafana/grafana/pull/22646), [@torkelo](https://github.com/torkelo)

# 6.6.2 (2020-02-20)

### Features / Enhancements

- **Data proxy**: Log proxy errors using Grafana logger. [#22174](https://github.com/grafana/grafana/pull/22174), [@bergquist](https://github.com/bergquist)
- **Metrics**: Add gauge for requests currently in flight. [#22168](https://github.com/grafana/grafana/pull/22168), [@bergquist](https://github.com/bergquist)

### Bug Fixes

- **@grafana/ui**: Fix displaying of bars in React Graph. [#21968](https://github.com/grafana/grafana/pull/21968), [@ivanahuckova](https://github.com/ivanahuckova)
- **API**: Fix redirect issue when configured to use a subpath. [#21652](https://github.com/grafana/grafana/pull/21652), [@briangann](https://github.com/briangann)
- **API**: Improve recovery middleware when response already been written. [#22256](https://github.com/grafana/grafana/pull/22256), [@marefr](https://github.com/marefr)
- **Auth**: Don't rotate auth token when requests are cancelled by client. [#22106](https://github.com/grafana/grafana/pull/22106), [@bergquist](https://github.com/bergquist)
- **Docker**: Downgrade to 18.04 LTS base image. [#22313](https://github.com/grafana/grafana/pull/22313), [@aknuds1](https://github.com/aknuds1)
- **Elasticsearch**: Fix auto interval for date histogram in explore logs mode. [#21937](https://github.com/grafana/grafana/pull/21937), [@ivanahuckova](https://github.com/ivanahuckova)
- **Image Rendering**: Fix PhantomJS compatibility with es2016 node dependencies. [#21677](https://github.com/grafana/grafana/pull/21677), [@dprokop](https://github.com/dprokop)
- **Links**: Assure base url when single stat, panel and data links are built. [#21956](https://github.com/grafana/grafana/pull/21956), [@dprokop](https://github.com/dprokop)
- **Loki, Prometheus**: Fix PromQL and LogQL syntax highlighting. [#21944](https://github.com/grafana/grafana/pull/21944), [@ivanahuckova](https://github.com/ivanahuckova)
- **OAuth**: Enforce auto_assign_org_id setting when role mapping enabled using Generic OAuth. [#22268](https://github.com/grafana/grafana/pull/22268), [@aknuds1](https://github.com/aknuds1)
- **Prometheus**: Updates explore query editor to prevent it from throwing error on edit. [#21605](https://github.com/grafana/grafana/pull/21605), [@Estrax](https://github.com/Estrax)
- **Server**: Reorder cipher suites for better security. [#22101](https://github.com/grafana/grafana/pull/22101), [@tofu-rocketry](https://github.com/tofu-rocketry)
- **TimePicker**: fixing weird behavior with calendar when switching between months/years . [#22253](https://github.com/grafana/grafana/pull/22253), [@mckn](https://github.com/mckn)

# 6.6.1 (2020-02-06)

### Bug Fixes

- **Annotations**: Change indices and rewrites annotation find query to improve database query performance. [#21915](https://github.com/grafana/grafana/pull/21915), [@papagian](https://github.com/papagian), [@marefr](https://github.com/marefr), [@kylebrandt](https://github.com/kylebrandt)
- **Azure Monitor**: Fix Application Insights API key field to allow input. [#21738](https://github.com/grafana/grafana/pull/21738), [@shavonn](https://github.com/shavonn)
- **BarGauge**: Fix so we properly display the "no result" value when query returns empty result. [#21791](https://github.com/grafana/grafana/pull/21791), [@mckn](https://github.com/mckn)
- **Datasource**: Show access (Browser/Server) select on the Prometheus datasource. [#21833](https://github.com/grafana/grafana/pull/21833), [@jorgelbg](https://github.com/jorgelbg)
- **DatasourceSettings**: Fixed issue navigating away from data source settings page. [#21841](https://github.com/grafana/grafana/pull/21841), [@torkelo](https://github.com/torkelo)
- **Graph Panel**: Fix typo in thresholds form. [#21903](https://github.com/grafana/grafana/pull/21903), [@orendain](https://github.com/orendain)
- **Graphite**: Fixed issue with functions with multiple required params and no defaults caused params that could not be edited (groupByNodes groupByTags). [#21814](https://github.com/grafana/grafana/pull/21814), [@torkelo](https://github.com/torkelo)
- **Image Rendering**: Fix render of graph panel legend aligned to the right using Grafana image renderer plugin/service. [#21854](https://github.com/grafana/grafana/pull/21854), [@marefr](https://github.com/marefr)
- **Metrics**: Adds back missing summary quantiles. [#21858](https://github.com/grafana/grafana/pull/21858), [@kogent](https://github.com/kogent)
- **OpenTSDB**: Adds back missing ngInject to make it work again. [#21796](https://github.com/grafana/grafana/pull/21796), [@marefr](https://github.com/marefr)
- **Plugins**: Fix routing in app plugin pages. [#21847](https://github.com/grafana/grafana/pull/21847), [@dprokop](https://github.com/dprokop)
- **Prometheus**: Fixes default step value for annotation query. [#21934](https://github.com/grafana/grafana/pull/21934), [@hugohaggmark](https://github.com/hugohaggmark)
- **Quota**: Makes LDAP + Quota work for the first login of a new user. [#21949](https://github.com/grafana/grafana/pull/21949), [@xlson](https://github.com/xlson)
- **StatPanels**: Fixed change from singlestat to Gauge / BarGauge / Stat where default min & max (0, 100) was copied . [#21820](https://github.com/grafana/grafana/pull/21820), [@torkelo](https://github.com/torkelo)
- **TimePicker**: Should display in kiosk mode. [#21816](https://github.com/grafana/grafana/pull/21816), [@evgbibko](https://github.com/evgbibko)
- **grafana/toolkit**: Fix failing linter when there were lint issues. [#21849](https://github.com/grafana/grafana/pull/21849), [@dprokop](https://github.com/dprokop)

# 6.6.0 (2020-01-27)

### Features / Enhancements

- **CloudWatch**: Add DynamoDB Accelerator (DAX) metrics & dimensions. [#21644](https://github.com/grafana/grafana/pull/21644), [@kenju](https://github.com/kenju)
- **CloudWatch**: Auto period snap to next higher period. [#21659](https://github.com/grafana/grafana/pull/21659), [@sunker](https://github.com/sunker)
- **Template variables**: Add error for failed query variable on time range update. [#21731](https://github.com/grafana/grafana/pull/21731), [@tskarhed](https://github.com/tskarhed)
- **XSS**: Sanitize column link. [#21735](https://github.com/grafana/grafana/pull/21735), [@tskarhed](https://github.com/tskarhed)

### Bug Fixes

- **Elasticsearch**: Fix adhoc variable filtering for logs query. [#21346](https://github.com/grafana/grafana/pull/21346), [@ceh](https://github.com/ceh)
- **Explore**: Fix colors for log level when level value is capitalised. [#21646](https://github.com/grafana/grafana/pull/21646), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore**: Fix context view in logs, where some rows may have been filtered out.. [#21729](https://github.com/grafana/grafana/pull/21729), [@aocenas](https://github.com/aocenas)
- **Loki**: Fix Loki with repeated panels and interpolation for Explore. [#21685](https://github.com/grafana/grafana/pull/21685), [@ivanahuckova](https://github.com/ivanahuckova)
- **SQLStore**: Fix PostgreSQL failure to create organisation for first time. [#21648](https://github.com/grafana/grafana/pull/21648), [@papagian](https://github.com/papagian)

# 6.6.0-beta1 (2020-01-20)

## Breaking changes

- **PagerDuty**: Change `payload.custom_details` field in PagerDuty notification to be a JSON object instead of a string.
- **Security**: The `[security]` setting `cookie_samesite` configured to `none` now renders cookies with `SameSite=None` attribute compared to before where no `SameSite` attribute was added to cookies. To get the old behavior, use value `disabled` instead of `none`. Refer to [Upgrade Grafana](https://grafana.com/docs/grafana/latest/installation/upgrading/#upgrading-to-v6-6) for more information.

### Features / Enhancements

- **Graphite**: Add Metrictank dashboard to Graphite datasource
- **Admin**: Show name of user in users table view. [#18108](https://github.com/grafana/grafana/pull/18108), [@eleijonmarck](https://github.com/eleijonmarck)
- **Alerting**: Add configurable severity support for PagerDuty notifier. [#19425](https://github.com/grafana/grafana/pull/19425), [@yemble](https://github.com/yemble)
- **Alerting**: Add more information to webhook notifications. [#20420](https://github.com/grafana/grafana/pull/20420), [@michael-az](https://github.com/michael-az)
- **Alerting**: Add support for sending tags in OpsGenie notifier. [#20810](https://github.com/grafana/grafana/pull/20810), [@aSapien](https://github.com/aSapien)
- **Alerting**: Added fallbackText to Google Chat notifier. [#21464](https://github.com/grafana/grafana/pull/21464), [@alvarolmedo](https://github.com/alvarolmedo)
- **Alerting**: Adds support for sending a single email to all recipients in email notifier. [#21091](https://github.com/grafana/grafana/pull/21091), [@marefr](https://github.com/marefr)
- **Alerting**: Enable setting of OpsGenie priority via a tag. [#21298](https://github.com/grafana/grafana/pull/21298), [@zabullet](https://github.com/zabullet)
- **Alerting**: Use fully qualified status emoji in Threema notifier. [#21305](https://github.com/grafana/grafana/pull/21305), [@dbrgn](https://github.com/dbrgn)
- **Alerting**: new min_interval_seconds option to enforce a minimum evaluation frequency . [#21188](https://github.com/grafana/grafana/pull/21188), [@papagian](https://github.com/papagian)
- **CloudWatch**: Calculate period based on time range. [#21471](https://github.com/grafana/grafana/pull/21471), [@sunker](https://github.com/sunker)
- **CloudWatch**: Display partial result in graph when max DP/call limit is reached . [#21533](https://github.com/grafana/grafana/pull/21533), [@sunker](https://github.com/sunker)
- **CloudWatch**: ECS/ContainerInsights metrics support. [#21125](https://github.com/grafana/grafana/pull/21125), [@briancurt](https://github.com/briancurt)
- **CloudWatch**: Upgrade aws-sdk-go. [#20510](https://github.com/grafana/grafana/pull/20510), [@mtanda](https://github.com/mtanda)
- **DataLinks**: allow using values from other fields in the same row (cells). [#21478](https://github.com/grafana/grafana/pull/21478), [@ryantxu](https://github.com/ryantxu)
- **Editor**: Ignore closing brace when it was added by editor. [#21172](https://github.com/grafana/grafana/pull/21172), [@davkal](https://github.com/davkal)
- **Explore**: Context tooltip to copy labels and values from graph. [#21405](https://github.com/grafana/grafana/pull/21405), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore**: Log message line wrapping options for logs. [#20360](https://github.com/grafana/grafana/pull/20360), [@ivanahuckova](https://github.com/ivanahuckova)
- **Forms**: introduce RadioButtonGroup. [#20828](https://github.com/grafana/grafana/pull/20828), [@dprokop](https://github.com/dprokop)
- **Frontend**: Changes in Redux location should not strip subpath from location url. [#20161](https://github.com/grafana/grafana/pull/20161), [@wybczu](https://github.com/wybczu)
- **Graph**: Add fill gradient option to series override line fill. [#20941](https://github.com/grafana/grafana/pull/20941), [@hendrikvh](https://github.com/hendrikvh)
- **Graphite**: Add metrictank dashboard to Graphite datasource. [#20776](https://github.com/grafana/grafana/pull/20776), [@Dieterbe](https://github.com/Dieterbe)
- **Graphite**: Do not change query when opening the query editor and there is no data. [#21588](https://github.com/grafana/grafana/pull/21588), [@daniellee](https://github.com/daniellee)
- **Gravatar**: Use HTTPS by default. [#20964](https://github.com/grafana/grafana/pull/20964), [@jiajunhuang](https://github.com/jiajunhuang)
- **Loki**: Support for template variable queries. [#20697](https://github.com/grafana/grafana/pull/20697), [@ivanahuckova](https://github.com/ivanahuckova)
- **NewsPanel**: Add news as a builtin panel. [#21128](https://github.com/grafana/grafana/pull/21128), [@ryantxu](https://github.com/ryantxu)
- **OAuth**: Removes send_client_credentials_via_post setting . [#20044](https://github.com/grafana/grafana/pull/20044), [@LK4D4](https://github.com/LK4D4)
- **OpenTSDB**: Adding lookup limit to OpenTSDB datasource settings. [#20647](https://github.com/grafana/grafana/pull/20647), [@itamarst](https://github.com/itamarst)
- **Postgres/MySQL/MSSQL**: Adds support for region annotations. [#20752](https://github.com/grafana/grafana/pull/20752), [@Bercon](https://github.com/Bercon)
- **Prometheus**: Field to specify step in Explore. [#20195](https://github.com/grafana/grafana/pull/20195), [@Estrax](https://github.com/Estrax)
- **Prometheus**: User metrics metadata to inform query hints. [#21304](https://github.com/grafana/grafana/pull/21304), [@davkal](https://github.com/davkal)
- **Renderer**: Add user-agent to remote rendering service requests. [#20956](https://github.com/grafana/grafana/pull/20956), [@kfdm](https://github.com/kfdm)
- **Security**: Add disabled option for cookie samesite attribute. [#21472](https://github.com/grafana/grafana/pull/21472), [@marefr](https://github.com/marefr)
- **Stackdriver**: Support meta labels. [#21373](https://github.com/grafana/grafana/pull/21373), [@sunker](https://github.com/sunker)
- **TablePanel, GraphPanel**: Exclude hidden columns from CSV. [#19925](https://github.com/grafana/grafana/pull/19925), [@literalplus](https://github.com/literalplus)
- **Templating**: Update variables on location changed. [#21480](https://github.com/grafana/grafana/pull/21480), [@ryantxu](https://github.com/ryantxu)
- **Tracing**: Support configuring Jaeger client from environment. [#21103](https://github.com/grafana/grafana/pull/21103), [@hairyhenderson](https://github.com/hairyhenderson)
- **Units**: Add currency and energy units. [#20428](https://github.com/grafana/grafana/pull/20428), [@anirudh-ramesh](https://github.com/anirudh-ramesh)
- **Units**: Support dynamic count and currency units. [#21279](https://github.com/grafana/grafana/pull/21279), [@ryantxu](https://github.com/ryantxu)
- **grafana/toolkit**: Add option to override webpack config. [#20872](https://github.com/grafana/grafana/pull/20872), [@sebimarkgraf](https://github.com/sebimarkgraf)
- **grafana/ui**: ConfirmModal component. [#20965](https://github.com/grafana/grafana/pull/20965), [@alexanderzobnin](https://github.com/alexanderzobnin)
- **grafana/ui**: Create Tabs component. [#21328](https://github.com/grafana/grafana/pull/21328), [@peterholmberg](https://github.com/peterholmberg)
- **grafana/ui**: New table component. [#20991](https://github.com/grafana/grafana/pull/20991), [@peterholmberg](https://github.com/peterholmberg)
- **grafana/ui**: New updated time picker. [#20931](https://github.com/grafana/grafana/pull/20931), [@mckn](https://github.com/mckn)
- **White-labeling**: Makes it possible to customize the footer and login background (Enterprise)

### Bug Fixes

- **API**: Optionally list expired API keys. [#20468](https://github.com/grafana/grafana/pull/20468), [@papagian](https://github.com/papagian)
- **Alerting**: Fix custom_details to be a JSON object instead of a string in PagerDuty notifier. [#21150](https://github.com/grafana/grafana/pull/21150), [@tehGoti](https://github.com/tehGoti)
- **Alerting**: Fix image rendering and uploading timeout preventing to send alert notifications. [#21536](https://github.com/grafana/grafana/pull/21536), [@marefr](https://github.com/marefr)
- **Alerting**: Fix panic in dingding notifier . [#20378](https://github.com/grafana/grafana/pull/20378), [@csyangchen](https://github.com/csyangchen)
- **Alerting**: Fix template query validation logic. [#20721](https://github.com/grafana/grafana/pull/20721), [@okhowang](https://github.com/okhowang)
- **Alerting**: If no permission to clear history, keep the historical data. [#19007](https://github.com/grafana/grafana/pull/19007), [@lzdw](https://github.com/lzdw)
- **Alerting**: Unpausing a non-paused alert rule should not change status to Unknown. [#21375](https://github.com/grafana/grafana/pull/21375), [@vikkyomkar](https://github.com/vikkyomkar)
- **Api**: Fix returned message when enabling, disabling and deleting a non-existing user. [#21391](https://github.com/grafana/grafana/pull/21391), [@dpavlos](https://github.com/dpavlos)
- **Auth**: Rotate auth tokens at the end of requests. [#21347](https://github.com/grafana/grafana/pull/21347), [@woodsaj](https://github.com/woodsaj)
- **Azure Monitor**: Fixes error using azure monitor credentials with log analytics and non-default cloud. [#21032](https://github.com/grafana/grafana/pull/21032), [@shavonn](https://github.com/shavonn)
- **CLI**: Return error and aborts when plugin file extraction fails. [#20849](https://github.com/grafana/grafana/pull/20849), [@marefr](https://github.com/marefr)
- **CloudWatch**: Multi-valued template variable dimension alias fix. [#21541](https://github.com/grafana/grafana/pull/21541), [@sunker](https://github.com/sunker)
- **Dashboard**: Disable draggable panels on small devices. [#20629](https://github.com/grafana/grafana/pull/20629), [@peterholmberg](https://github.com/peterholmberg)
- **DataLinks**: Links with \${\_\_value.time} do not work when clicking on first result . [#20019](https://github.com/grafana/grafana/pull/20019), [@dweineha](https://github.com/dweineha)
- **Explore**: Fix showing of results in selected timezone (UTC/local). [#20812](https://github.com/grafana/grafana/pull/20812), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore**: Fix timepicker when browsing back after switching datasource. [#21454](https://github.com/grafana/grafana/pull/21454), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore**: Sync timepicker and logs after live-tailing stops. [#20979](https://github.com/grafana/grafana/pull/20979), [@ivanahuckova](https://github.com/ivanahuckova)
- **Graph**: Fix when clicking a plot on a touch device we won't display the annotation menu. [#21479](https://github.com/grafana/grafana/pull/21479), [@mckn](https://github.com/mckn)
- **OAuth**: Fix role mapping from id token. [#20300](https://github.com/grafana/grafana/pull/20300), [@seanson](https://github.com/seanson)
- **Plugins**: Add appSubUrl string to config pages. [#21414](https://github.com/grafana/grafana/pull/21414), [@Maddin-619](https://github.com/Maddin-619)
- **Provisioning**: Start provision dashboards after Grafana server have started. [#21564](https://github.com/grafana/grafana/pull/21564), [@marefr](https://github.com/marefr)
- **Render**: Use https as protocol when rendering if HTTP2 enabled. [#21600](https://github.com/grafana/grafana/pull/21600), [@marefr](https://github.com/marefr)
- **Security**: Use same cookie settings for all cookies. [#19787](https://github.com/grafana/grafana/pull/19787), [@jeffdesc](https://github.com/jeffdesc)
- **Singlestat**: Support empty value map texts. [#20952](https://github.com/grafana/grafana/pull/20952), [@hendrikvh](https://github.com/hendrikvh)
- **Units**: Custom suffix and prefix units can now be specified, for example custom currency & SI & time formats. [#20763](https://github.com/grafana/grafana/pull/20763), [@ryantxu](https://github.com/ryantxu)
- **grafana/ui**: Do not build grafana/ui in strict mode as it depends on non-strict libs. [#21319](https://github.com/grafana/grafana/pull/21319), [@dprokop](https://github.com/dprokop)

# 6.5.3 (2020-01-15)

### Features / Enhancements

- **API**: Validate redirect_to cookie has valid (Grafana) url . [#21057](https://github.com/grafana/grafana/pull/21057), [@papagian](https://github.com/papagian), Thanks Habi S Ravi for reporting this issue.

### Bug Fixes

- **AdHocFilter**: Shows SubMenu when filtering directly from table. [#21017](https://github.com/grafana/grafana/pull/21017), [@hugohaggmark](https://github.com/hugohaggmark)
- **Cloudwatch**: Fixed crash when switching from cloudwatch data source. [#21376](https://github.com/grafana/grafana/pull/21376), [@torkelo](https://github.com/torkelo)
- **DataLinks**: Sanitize data/panel link URLs. [#21140](https://github.com/grafana/grafana/pull/21140), [@dprokop](https://github.com/dprokop)
- **Elastic**: Fix multiselect variable interpolation for logs. [#20894](https://github.com/grafana/grafana/pull/20894), [@ivanahuckova](https://github.com/ivanahuckova)
- **Prometheus**: Fixes so user can change HTTP Method in config settings. [#21055](https://github.com/grafana/grafana/pull/21055), [@hugohaggmark](https://github.com/hugohaggmark)
- **Prometheus**: Prevents validation of inputs when clicking in them without changing the value. [#21059](https://github.com/grafana/grafana/pull/21059), [@hugohaggmark](https://github.com/hugohaggmark)
- **Rendering**: Fix panel PNG rendering when using sub url & serve_from_sub_path = true. [#21306](https://github.com/grafana/grafana/pull/21306), [@bgranvea](https://github.com/bgranvea)
- **Table**: Matches column names with unescaped regex characters. [#21164](https://github.com/grafana/grafana/pull/21164), [@hugohaggmark](https://github.com/hugohaggmark)

# 6.5.2 (2019-12-11)

### Bug Fixes

- **Alerting**: Improve alert threshold handle dragging behavior. [#20922](https://github.com/grafana/grafana/pull/20922), [@torkelo](https://github.com/torkelo)
- **AngularPanels**: Fixed loading spinner being stuck in some rare cases. [#20878](https://github.com/grafana/grafana/pull/20878), [@torkelo](https://github.com/torkelo)
- **CloudWatch**: Fix query editor does not render in Explore. [#20909](https://github.com/grafana/grafana/pull/20909), [@davkal](https://github.com/davkal)
- **CloudWatch**: Remove illegal character escaping in inferred expressions. [#20915](https://github.com/grafana/grafana/pull/20915), [@sunker](https://github.com/sunker)
- **CloudWatch**: Remove template variable error message. [#20864](https://github.com/grafana/grafana/pull/20864), [@sunker](https://github.com/sunker)
- **CloudWatch**: Use datasource template variable in curated dashboards. [#20917](https://github.com/grafana/grafana/pull/20917), [@sunker](https://github.com/sunker)
- **Elasticsearch**: Set default port to 9200 in ConfigEditor. [#20948](https://github.com/grafana/grafana/pull/20948), [@papagian](https://github.com/papagian)
- **Gauge/BarGauge**: Added support for value mapping of "no data"-state to text/value. [#20842](https://github.com/grafana/grafana/pull/20842), [@mckn](https://github.com/mckn)
- **Graph**: Prevent tooltip from being displayed outside of window. [#20874](https://github.com/grafana/grafana/pull/20874), [@mckn](https://github.com/mckn)
- **Graphite**: Fixes error with annotation metric queries . [#20857](https://github.com/grafana/grafana/pull/20857), [@dprokop](https://github.com/dprokop)
- **Login**: Fix fatal error when navigating from reset password page. [#20747](https://github.com/grafana/grafana/pull/20747), [@peterholmberg](https://github.com/peterholmberg)
- **MixedDatasources**: Do not filter out all mixed data sources in add mixed query dropdown. [#20990](https://github.com/grafana/grafana/pull/20990), [@torkelo](https://github.com/torkelo)
- **Prometheus**: Fix caching for default labels request. [#20718](https://github.com/grafana/grafana/pull/20718), [@aocenas](https://github.com/aocenas)
- **Prometheus**: Run default labels query only once. [#20898](https://github.com/grafana/grafana/pull/20898), [@aocenas](https://github.com/aocenas)
- **Security**: Fix invite link still accessible after completion or revocation. [#20863](https://github.com/grafana/grafana/pull/20863), [@aknuds1](https://github.com/aknuds1)
- **Server**: Fail when unable to create log directory. [#20804](https://github.com/grafana/grafana/pull/20804), [@aknuds1](https://github.com/aknuds1)
- **TeamPicker**: Increase size limit from 10 to 100. [#20882](https://github.com/grafana/grafana/pull/20882), [@hendrikvh](https://github.com/hendrikvh)
- **Units**: Remove SI prefix symbol from new milli/microSievert(/h) units. [#20650](https://github.com/grafana/grafana/pull/20650), [@zegelin](https://github.com/zegelin)

# 6.5.1 (2019-11-28)

### Bug Fixes

- **CloudWatch**: Region template query fix. [#20661](https://github.com/grafana/grafana/pull/20661), [@sunker](https://github.com/sunker)
- **CloudWatch**: Fix annotations query editor loading. [#20687](https://github.com/grafana/grafana/pull/20687), [@sunker](https://github.com/sunker)
- **Panel**: Fixes undefined services/dependencies in plugins without `/**@ngInject*/`. [#20696](https://github.com/grafana/grafana/pull/20696), [@hugohaggmark](https://github.com/hugohaggmark)
- **Server**: Fix failure to start with "bind: address already in use" when using socket as protocol. [#20679](https://github.com/grafana/grafana/pull/20679), [@aknuds1](https://github.com/aknuds1)
- **Stats**: Fix active admins/editors/viewers stats are counted more than once if the user is part of more than one org. [#20711](https://github.com/grafana/grafana/pull/20711), [@papagian](https://github.com/papagian)

# 6.5.0 (2019-11-25)

### Features / Enhancements

- **CloudWatch**: Add curated dashboards for most popular amazon services. [#20486](https://github.com/grafana/grafana/pull/20486), [@sunker](https://github.com/sunker)
- **CloudWatch**: Enable Min time interval. [#20260](https://github.com/grafana/grafana/pull/20260), [@mtanda](https://github.com/mtanda)
- **Explore**: UI improvements for log details. [#20485](https://github.com/grafana/grafana/pull/20485), [@ivanahuckova](https://github.com/ivanahuckova)
- **Server**: Improve grafana-server diagnostics configuration for profiling and tracing. [#20593](https://github.com/grafana/grafana/pull/20593), [@papagian](https://github.com/papagian)

### Bug Fixes

- **BarGauge/Gauge**: Add back missing title option field display options. [#20616](https://github.com/grafana/grafana/pull/20616), [@torkelo](https://github.com/torkelo)
- **CloudWatch**: Fix high CPU load. [#20579](https://github.com/grafana/grafana/pull/20579), [@marefr](https://github.com/marefr)
- **CloudWatch**: Fix high resolution mode without expression. [#20459](https://github.com/grafana/grafana/pull/20459), [@mtanda](https://github.com/mtanda)
- **CloudWatch**: Make sure period variable is being interpreted correctly. [#20447](https://github.com/grafana/grafana/pull/20447), [@sunker](https://github.com/sunker)
- **CloudWatch**: Remove HighResolution toggle since it's not being used. [#20440](https://github.com/grafana/grafana/pull/20440), [@sunker](https://github.com/sunker)
- **Cloudwatch**: Fix LaunchTime attribute tag bug. [#20237](https://github.com/grafana/grafana/pull/20237), [@sunker](https://github.com/sunker)
- **Data links**: Fix URL field turns read-only for graph panels. [#20381](https://github.com/grafana/grafana/pull/20381), [@dprokop](https://github.com/dprokop)
- **Explore**: Keep logQL filters when selecting labels in log row details. [#20570](https://github.com/grafana/grafana/pull/20570), [@ivanahuckova](https://github.com/ivanahuckova)
- **MySQL**: Fix TLS auth settings in config page. [#20501](https://github.com/grafana/grafana/pull/20501), [@peterholmberg](https://github.com/peterholmberg)
- **Provisioning**: Fix unmarshaling nested jsonData values. [#20399](https://github.com/grafana/grafana/pull/20399), [@aocenas](https://github.com/aocenas)
- **Server**: Should fail when server is unable to bind port. [#20409](https://github.com/grafana/grafana/pull/20409), [@aknuds1](https://github.com/aknuds1)
- **Templating**: Prevents crash when \$\_\_searchFilter is not a string. [#20526](https://github.com/grafana/grafana/pull/20526), [@hugohaggmark](https://github.com/hugohaggmark)
- **TextPanel**: Fixes issue with template variable value not properly html escaped [#20588](https://github.com/grafana/grafana/pull/20588), [@torkelo](https://github.com/torkelo)
- **TimePicker**: Should update after location change. [#20466](https://github.com/grafana/grafana/pull/20466), [@torkelo](https://github.com/torkelo)

## Breaking changes

- **CloudWatch**: Pre Grafana 6.5.0, the CloudWatch datasource used the GetMetricStatistics API for all queries that did not have an ´id´ and did not have an ´expression´ defined in the query editor. The GetMetricStatistics API has a limit of 400 transactions per second. In this release, all queries use the GetMetricData API. The GetMetricData API has a limit of 50 transactions per second and 100 metrics per transaction. For API pricing information, please refer to the CloudWatch pricing page (https://aws.amazon.com/cloudwatch/pricing/).

- **CloudWatch**: The GetMetricData API does not return metric unit, so unit auto detection in panels is no longer supported.

- **CloudWatch**: The `HighRes` switch has been removed from the query editor. Read more about this in [upgrading to 6.5](https://grafana.com/docs/installation/upgrading/#upgrading-to-v6-5).

- **CloudWatch**: In previous versions of Grafana, there was partial support for using multi-valued template variables as dimension values. When a multi-valued template variable is being used for dimension values in Grafana 6.5, a [search expression](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/using-search-expressions.html) will be generated. In the GetMetricData API, expressions are limited to 1024 characters, so you might reach this limit if you are using a large number of values. Read our [upgrading to 6.5](https://grafana.com/docs/installation/upgrading/#upgrading-to-v6-5) guide to see how you can use the `*` wildcard for this use case.

# 6.5.0-beta1 (2019-11-14)

### Features / Enhancements

- **API**: Add `createdAt` and `updatedAt` to api/users/lookup. [#19496](https://github.com/grafana/grafana/pull/19496), [@gotjosh](https://github.com/gotjosh)
- **API**: Add createdAt field to /api/users/:id. [#19475](https://github.com/grafana/grafana/pull/19475), [@cored](https://github.com/cored)
- **Admin**: Adds setting to disable creating initial admin user. [#19505](https://github.com/grafana/grafana/pull/19505), [@shavonn](https://github.com/shavonn)
- **Alerting**: Include alert_state in Kafka notifier payload. [#20099](https://github.com/grafana/grafana/pull/20099), [@arnaudlemaignen](https://github.com/arnaudlemaignen)
- **AuthProxy**: Can now login with auth proxy and get a login token. [#20175](https://github.com/grafana/grafana/pull/20175), [@torkelo](https://github.com/torkelo)
- **AuthProxy**: replaces setting ldap_sync_ttl with sync_ttl. [#20191](https://github.com/grafana/grafana/pull/20191), [@jongyllen](https://github.com/jongyllen)
- **AzureMonitor**: Alerting for Azure Application Insights. [#19381](https://github.com/grafana/grafana/pull/19381), [@ChadNedzlek](https://github.com/ChadNedzlek)
- **Build**: Upgrade to Go 1.13. [#19502](https://github.com/grafana/grafana/pull/19502), [@aknuds1](https://github.com/aknuds1)
- **CLI**: Reduce memory usage for plugin installation. [#19639](https://github.com/grafana/grafana/pull/19639), [@olivierlemasle](https://github.com/olivierlemasle)
- **CloudWatch**: Add ap-east-1 to hard-coded region lists. [#19523](https://github.com/grafana/grafana/pull/19523), [@Nessworthy](https://github.com/Nessworthy)
- **CloudWatch**: ContainerInsights metrics support. [#18971](https://github.com/grafana/grafana/pull/18971), [@francopeapea](https://github.com/francopeapea)
- **CloudWatch**: Support dynamic queries using dimension wildcards [#20058](https://github.com/grafana/grafana/issues/20058), [@sunker](https://github.com/sunker)
- **CloudWatch**: Stop using GetMetricStatistics and use GetMetricData for all time series requests [#20057](https://github.com/grafana/grafana/issues/20057), [@sunker](https://github.com/sunker)
- **CloudWatch**: Convert query editor from Angular to React [#19880](https://github.com/grafana/grafana/issues/19880), [@sunker](https://github.com/sunker)
- **CloudWatch**: Convert config editor from Angular to React [#19881](https://github.com/grafana/grafana/issues/19881), [@shavonn](https://github.com/shavonn)
- **CloudWatch**: Improved error handling when throttling occurs [#20348](https://github.com/grafana/grafana/issues/20348), [@sunker](https://github.com/sunker)
- **CloudWatch**: Deep linking from Grafana panel to CloudWatch console [#20279](https://github.com/grafana/grafana/issues/20279), [@sunker](https://github.com/sunker)
- **CloudWatch**: Add Grafana user agent to GMD calls [#20277](https://github.com/grafana/grafana/issues/20277), [@sunker](https://github.com/sunker)
- **Dashboard**: Allows the d-solo route to be used without slug. [#19640](https://github.com/grafana/grafana/pull/19640), [@97amarnathk](https://github.com/97amarnathk)
- **Docker**: Build and publish an additional Ubuntu based docker image. [#20196](https://github.com/grafana/grafana/pull/20196), [@aknuds1](https://github.com/aknuds1)
- **Elasticsearch**: Adds support for region annotations. [#17602](https://github.com/grafana/grafana/pull/17602), [@fangel](https://github.com/fangel)
- **Explore**: Add custom DataLinks on datasource level (like tracing links). [#20060](https://github.com/grafana/grafana/pull/20060), [@aocenas](https://github.com/aocenas)
- **Explore**: Add functionality to show/hide query row results. [#19794](https://github.com/grafana/grafana/pull/19794), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore**: Synchronise time ranges in split mode. [#19274](https://github.com/grafana/grafana/pull/19274), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore**: UI change for log row details . [#20034](https://github.com/grafana/grafana/pull/20034), [@ivanahuckova](https://github.com/ivanahuckova)
- **Frontend**: Migrate DataSource HTTP Settings to React. [#19452](https://github.com/grafana/grafana/pull/19452), [@dprokop](https://github.com/dprokop)
- **Frontend**: Show browser not supported notification. [#19904](https://github.com/grafana/grafana/pull/19904), [@peterholmberg](https://github.com/peterholmberg)
- **Graph**: Added series override option to have hidden series be persisted on save. [#20124](https://github.com/grafana/grafana/pull/20124), [@Gauravshah](https://github.com/Gauravshah)
- **Graphite**: Add Metrictank option to settings to view Metrictank request processing info in new inspect feature. [#20138](https://github.com/grafana/grafana/pull/20138), [@ryantxu](https://github.com/ryantxu)
- **LDAP**: Enable single user sync. [#19446](https://github.com/grafana/grafana/pull/19446), [@gotjosh](https://github.com/gotjosh)
- **LDAP**: Last org admin can login but wont be removed. [#20326](https://github.com/grafana/grafana/pull/20326), [@xlson](https://github.com/xlson)
- **LDAP**: Support env variable expressions in ldap.toml file. [#20173](https://github.com/grafana/grafana/pull/20173), [@torkelo](https://github.com/torkelo)
- **OAuth**: Generic OAuth role mapping support. [#17149](https://github.com/grafana/grafana/pull/17149), [@hypery2k](https://github.com/hypery2k)
- **Prometheus**: Custom query parameters string for Thanos downsampling. [#19121](https://github.com/grafana/grafana/pull/19121), [@seuf](https://github.com/seuf)
- **Provisioning**: Allow saving of provisioned dashboards. [#19820](https://github.com/grafana/grafana/pull/19820), [@jongyllen](https://github.com/jongyllen)
- **Security**: Minor XSS issue resolved by angularjs upgrade from 1.6.6 -> 1.6.9. [#19849](https://github.com/grafana/grafana/pull/19849), [@peterholmberg](https://github.com/peterholmberg)
- **TablePanel**: Prevents crash when data contains mixed data formats. [#20202](https://github.com/grafana/grafana/pull/20202), [@hugohaggmark](https://github.com/hugohaggmark)
- **Templating**: Introduces \$\_\_searchFilter to Query Variables. [#19858](https://github.com/grafana/grafana/pull/19858), [@hugohaggmark](https://github.com/hugohaggmark)
- **Templating**: Made default template variable query editor field a textarea with automatic height. [#20288](https://github.com/grafana/grafana/pull/20288), [@torkelo](https://github.com/torkelo)
- **Units**: Add milli/microSievert, milli/microSievert/h and pixels. [#20144](https://github.com/grafana/grafana/pull/20144), [@ryantxu](https://github.com/ryantxu)
- **Units**: Added mega ampere and watt-hour per kg. [#19922](https://github.com/grafana/grafana/pull/19922), [@Karan96Kaushik](https://github.com/Karan96Kaushik)
- **Enterprise**: Enterprise without a license behaves like OSS (Enterprise)

### Bug Fixes

- **API**: Added dashboardId and slug in response to dashboard import api. [#19692](https://github.com/grafana/grafana/pull/19692), [@jongyllen](https://github.com/jongyllen)
- **API**: Fix logging of dynamic listening port. [#19644](https://github.com/grafana/grafana/pull/19644), [@oleggator](https://github.com/oleggator)
- **BarGauge**: Fix so that default thresholds not keeps resetting. [#20190](https://github.com/grafana/grafana/pull/20190), [@lzdw](https://github.com/lzdw)
- **CloudWatch**: Fix incorrect casing of Redshift dimension entry for service class and stage. [#19897](https://github.com/grafana/grafana/pull/19897), [@nlsdfnbch](https://github.com/nlsdfnbch)
- **CloudWatch**: Fixing AWS Kafka dimension names. [#19986](https://github.com/grafana/grafana/pull/19986), [@skuxy](https://github.com/skuxy)
- **CloudWatch**: Metric math broken when using multi template variables [#18337](https://github.com/grafana/grafana/issues/18337), [@sunker](https://github.com/sunker)
- **CloudWatch**: Graphs with multiple multi-value dimension variables don't work [#17949](https://github.com/grafana/grafana/issues/17949), [@sunker](https://github.com/sunker)
- **CloudWatch**: Variables' values surrounded with braces in request sent to AWS [#14451](https://github.com/grafana/grafana/issues/14451), [@sunker](https://github.com/sunker)
- **CloudWatch**: Cloudwatch Query for a list of instances for which data is available in the selected time interval [#12784](https://github.com/grafana/grafana/issues/12784), [@sunker](https://github.com/sunker)
- **CloudWatch**: Dimension's positioning/order should be stored in the json dashboard [#11062](https://github.com/grafana/grafana/issues/11062), [@sunker](https://github.com/sunker)
- **CloudWatch**: Batch CloudWatch API call support in backend [#7991](https://github.com/grafana/grafana/issues/7991), [@sunker](https://github.com/sunker)
- **ColorPicker**: Fixes issue with ColorPicker disappearing too quickly . [#20289](https://github.com/grafana/grafana/pull/20289), [@dprokop](https://github.com/dprokop)
- **Datasource**: Add custom headers on alerting queries. [#19508](https://github.com/grafana/grafana/pull/19508), [@weeco](https://github.com/weeco)
- **Docker**: Add additional glibc dependencies to support certain backend plugins in alpine. [#20214](https://github.com/grafana/grafana/pull/20214), [@briangann](https://github.com/briangann)
- **Docker**: Build and use musl-based binaries in alpine images to resolve glibc incompatibility issues. [#19798](https://github.com/grafana/grafana/pull/19798), [@aknuds1](https://github.com/aknuds1)
- **Elasticsearch**: Fix template variables interpolation when redirecting to Explore. [#20314](https://github.com/grafana/grafana/pull/20314), [@ivanahuckova](https://github.com/ivanahuckova)
- **Elasticsearch**: Support rendering in logs panel. [#20229](https://github.com/grafana/grafana/pull/20229), [@davkal](https://github.com/davkal)
- **Explore**: Expand template variables when redirecting from dashboard panel. [#19582](https://github.com/grafana/grafana/pull/19582), [@ivanahuckova](https://github.com/ivanahuckova)
- **OAuth**: Make the login button display name of custom OAuth provider. [#20209](https://github.com/grafana/grafana/pull/20209), [@dprokop](https://github.com/dprokop)
- **ReactPanels**: Adds Explore menu item. [#20236](https://github.com/grafana/grafana/pull/20236), [@hugohaggmark](https://github.com/hugohaggmark)
- **Team Sync**: Fix URL encode Group IDs for external team sync. [#20280](https://github.com/grafana/grafana/pull/20280), [@gotjosh](https://github.com/gotjosh)

## Breaking changes

- **CloudWatch**: Pre Grafana 6.5.0, the CloudWatch datasource used the GetMetricStatistics API for all queries that did not have an ´id´ and did not have an ´expression´ defined in the query editor. The GetMetricStatistics API has a limit of 400 transactions per second. In this release, all queries use the GetMetricData API. The GetMetricData API has a limit of 50 transactions per second and 100 metrics per transaction. For API pricing information, please refer to the CloudWatch pricing page (https://aws.amazon.com/cloudwatch/pricing/).

- **CloudWatch**: The GetMetricData API does not return metric unit, so unit auto detection in panels is no longer supported.

- **CloudWatch**: The `HighRes` switch has been removed from the query editor. Read more about this in [upgrading to 6.5](https://grafana.com/docs/installation/upgrading/#upgrading-to-v6-5).

- **CloudWatch**: In previous versions of Grafana, there was partial support for using multi-valued template variables as dimension values. When a multi-valued template variable is being used for dimension values in Grafana 6.5, a [search expression](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/using-search-expressions.html) will be generated. In the GetMetricData API, expressions are limited to 1024 characters, so you might reach this limit if you are using a large number of values. Read our [upgrading to 6.5](https://grafana.com/docs/installation/upgrading/#upgrading-to-v6-5) guide to see how you can use the `*` wildcard for this use case.

# 6.4.5 (2019-11-25)

### Bug Fixes

- **CloudWatch**: Fix high CPU load [#20579](https://github.com/grafana/grafana/pull/20579)

# 6.4.4 (2019-11-06)

### Bug Fixes

- **MySQL**: Fix encoding in connection string [#20192](https://github.com/grafana/grafana/pull/20192)
- **DataLinks**: Fix blur issues. [#19883](https://github.com/grafana/grafana/pull/19883), [@aocenas](https://github.com/aocenas)
- **Docker**: Makes it possible to parse timezones in the docker image. [#20081](https://github.com/grafana/grafana/pull/20081), [@xlson](https://github.com/xlson)
- **LDAP**: All LDAP servers should be tried even if one of them returns a connection error. [#20077](https://github.com/grafana/grafana/pull/20077), [@jongyllen](https://github.com/jongyllen)
- **LDAP**: No longer shows incorrectly matching groups based on role in debug page. [#20018](https://github.com/grafana/grafana/pull/20018), [@xlson](https://github.com/xlson)
- **Singlestat**: Fix no data / null value mapping . [#19951](https://github.com/grafana/grafana/pull/19951), [@ryantxu](https://github.com/ryantxu)

#### Security vulnerability

The MySQL data source connection string fix, [#20192](https://github.com/grafana/grafana/pull/20192), that was part of this release
also fixed a security vulnerability. Thanks Yuriy Dyachenko for discovering and notifying us about this.

# 6.4.3 (2019-10-16)

### Bug Fixes

- **Alerting**: All notification channels should send even if one fails to send. [#19807](https://github.com/grafana/grafana/pull/19807), [@jan25](https://github.com/jan25)
- **AzureMonitor**: Fix slate interference with dropdowns. [#19799](https://github.com/grafana/grafana/pull/19799), [@aocenas](https://github.com/aocenas)
- **ContextMenu**: make ContextMenu positioning aware of the viewport width. [#19699](https://github.com/grafana/grafana/pull/19699), [@krvajal](https://github.com/krvajal)
- **DataLinks**: Fix context menu not showing in singlestat-ish visualisations. [#19809](https://github.com/grafana/grafana/pull/19809), [@dprokop](https://github.com/dprokop)
- **DataLinks**: Fix url field not releasing focus. [#19804](https://github.com/grafana/grafana/pull/19804), [@aocenas](https://github.com/aocenas)
- **Datasource**: Fixes clicking outside of some query editors required 2 clicks. [#19822](https://github.com/grafana/grafana/pull/19822), [@aocenas](https://github.com/aocenas)
- **Panels**: Fixes default tab for visualizations without Queries Tab. [#19803](https://github.com/grafana/grafana/pull/19803), [@hugohaggmark](https://github.com/hugohaggmark)
- **Singlestat**: Fixed issue with mapping null to text. [#19689](https://github.com/grafana/grafana/pull/19689), [@torkelo](https://github.com/torkelo)
- **@grafana/toolkit**: Don't fail plugin creation when git user.name config is not set. [#19821](https://github.com/grafana/grafana/pull/19821), [@dprokop](https://github.com/dprokop)
- **@grafana/toolkit**: TSLint line number off by 1. [#19782](https://github.com/grafana/grafana/pull/19782), [@fredwangwang](https://github.com/fredwangwang)

# 6.4.2 (2019-10-08)

### Bug Fixes

- **CloudWatch**: Changes incorrect dimension wmlid to wlmid . [#19679](https://github.com/grafana/grafana/pull/19679), [@ATTron](https://github.com/ATTron)
- **Grafana Image Renderer**: Fixes plugin page. [#19664](https://github.com/grafana/grafana/pull/19664), [@hugohaggmark](https://github.com/hugohaggmark)
- **Graph**: Fixes auto decimals logic for y axis ticks that results in too many decimals for high values. [#19618](https://github.com/grafana/grafana/pull/19618), [@torkelo](https://github.com/torkelo)
- **Graph**: Switching to series mode should re-render graph. [#19623](https://github.com/grafana/grafana/pull/19623), [@torkelo](https://github.com/torkelo)
- **Loki**: Fix autocomplete on label values. [#19579](https://github.com/grafana/grafana/pull/19579), [@aocenas](https://github.com/aocenas)
- **Loki**: Removes live option for logs panel. [#19533](https://github.com/grafana/grafana/pull/19533), [@davkal](https://github.com/davkal)
- **Profile**: Fix issue with user profile not showing more than sessions sessions in some cases. [#19578](https://github.com/grafana/grafana/pull/19578), [@huynhsamha](https://github.com/huynhsamha)
- **Prometheus**: Fixes so results in Panel always are sorted by query order. [#19597](https://github.com/grafana/grafana/pull/19597), [@hugohaggmark](https://github.com/hugohaggmark)
- **ShareQuery**: Fixed issue when using -- Dashboard -- datasource (to share query result) when dashboard had rows. [#19610](https://github.com/grafana/grafana/pull/19610), [@torkelo](https://github.com/torkelo)
- **Show SAML login button if SAML is enabled**. [#19591](https://github.com/grafana/grafana/pull/19591), [@papagian](https://github.com/papagian)
- **SingleStat**: Fixes \$\_\_name postfix/prefix usage. [#19687](https://github.com/grafana/grafana/pull/19687), [@hugohaggmark](https://github.com/hugohaggmark)
- **Table**: Proper handling of json data with dataframes. [#19596](https://github.com/grafana/grafana/pull/19596), [@marefr](https://github.com/marefr)
- **Units**: Fixed wrong id for Terabits/sec. [#19611](https://github.com/grafana/grafana/pull/19611), [@andreaslangnevyjel](https://github.com/andreaslangnevyjel)

# 6.4.1 (2019-10-02)

### Bug Fixes

- **Provisioning**: Fixed issue where empty nested keys in YAML provisioning caused server crash, [#19547](https://github.com/grafana/grafana/pull/19547)
- **ImageRendering**: Fixed issue with image rendering in enterprise build (Enterprise)
- **Reporting**: Fixed issue with reporting service when STMP disabled (Enterprise).

# 6.4.0 (2019-10-01)

### Features / Enhancements

- **Build**: Upgrade go to 1.12.10. [#19499](https://github.com/grafana/grafana/pull/19499), [@marefr](https://github.com/marefr)
- **DataLinks**: Suggestions menu improvements. [#19396](https://github.com/grafana/grafana/pull/19396), [@dprokop](https://github.com/dprokop)
- **Explore**: Take root_url setting into account when redirecting from dashboard to explore. [#19447](https://github.com/grafana/grafana/pull/19447), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore**: Update broken link to logql docs. [#19510](https://github.com/grafana/grafana/pull/19510), [@ivanahuckova](https://github.com/ivanahuckova)
- **Logs**: Adds Logs Panel as a visualization. [#19504](https://github.com/grafana/grafana/pull/19504), [@davkal](https://github.com/davkal)
- **Reporting**: Generate and email PDF reports based on Dashboards (Enterprise)

### Bug Fixes

- **CLI**: Fix version selection for plugin install. [#19498](https://github.com/grafana/grafana/pull/19498), [@aocenas](https://github.com/aocenas)
- **Graph**: Fixes minor issue with series override color picker and custom color . [#19516](https://github.com/grafana/grafana/pull/19516), [@torkelo](https://github.com/torkelo)

## Plugins that need updating when upgrading from 6.3 to 6.4

- [Splunk](https://grafana.com/grafana/plugins/grafana-splunk-datasource)

# 6.4.0-beta2 (2019-09-25)

### Features / Enhancements

- **Azure Monitor**: Remove support for cross resource queries (#19115)". [#19346](https://github.com/grafana/grafana/pull/19346), [@sunker](https://github.com/sunker)
- **Docker**: Upgrade packages to resolve reported vulnerabilities. [#19188](https://github.com/grafana/grafana/pull/19188), [@marefr](https://github.com/marefr)
- **Graphite**: Time range expansion reduced from 1 minute to 1 second. [#19246](https://github.com/grafana/grafana/pull/19246), [@torkelo](https://github.com/torkelo)
- **grafana/toolkit**: Add plugin creation task. [#19207](https://github.com/grafana/grafana/pull/19207), [@dprokop](https://github.com/dprokop)

### Bug Fixes

- **Alerting**: Prevents creating alerts from unsupported queries. [#19250](https://github.com/grafana/grafana/pull/19250), [@hugohaggmark](https://github.com/hugohaggmark)
- **Alerting**: Truncate PagerDuty summary when greater than 1024 characters. [#18730](https://github.com/grafana/grafana/pull/18730), [@nvllsvm](https://github.com/nvllsvm)
- **Cloudwatch**: Fix autocomplete for Gamelift dimensions. [#19146](https://github.com/grafana/grafana/pull/19146), [@kevinpz](https://github.com/kevinpz)
- **Dashboard**: Fix export for sharing when panels use default data source. [#19315](https://github.com/grafana/grafana/pull/19315), [@torkelo](https://github.com/torkelo)
- **Database**: Rewrite system statistics query to perform better. [#19178](https://github.com/grafana/grafana/pull/19178), [@papagian](https://github.com/papagian)
- **Gauge/BarGauge**: Fix issue with [object Object] in titles . [#19217](https://github.com/grafana/grafana/pull/19217), [@ryantxu](https://github.com/ryantxu)
- **MSSQL**: Revert usage of new connectionstring format introduced by #18384. [#19203](https://github.com/grafana/grafana/pull/19203), [@marefr](https://github.com/marefr)
- **Multi-LDAP**: Do not fail-fast on invalid credentials. [#19261](https://github.com/grafana/grafana/pull/19261), [@gotjosh](https://github.com/gotjosh)
- **MySQL, Postgres, MSSQL**: Fix validating query with template variables in alert . [#19237](https://github.com/grafana/grafana/pull/19237), [@marefr](https://github.com/marefr)
- **MySQL, Postgres**: Update raw sql when query builder updates. [#19209](https://github.com/grafana/grafana/pull/19209), [@marefr](https://github.com/marefr)
- **MySQL**: Limit datasource error details returned from the backend. [#19373](https://github.com/grafana/grafana/pull/19373), [@marefr](https://github.com/marefr)

# 6.4.0-beta1 (2019-09-17)

### Features / Enhancements

- **Reporting**: Created scheduled PDF reports for any dashboard (Enterprise).
- **API**: Readonly datasources should not be created via the API. [#19006](https://github.com/grafana/grafana/pull/19006), [@papagian](https://github.com/papagian)
- **Alerting**: Include configured AlertRuleTags in Webhooks notifier. [#18233](https://github.com/grafana/grafana/pull/18233), [@dominic-miglar](https://github.com/dominic-miglar)
- **Annotations**: Add annotations support to Loki. [#18949](https://github.com/grafana/grafana/pull/18949), [@aocenas](https://github.com/aocenas)
- **Annotations**: Use a single row to represent a region. [#17673](https://github.com/grafana/grafana/pull/17673), [@ryantxu](https://github.com/ryantxu)
- **Auth**: Allow inviting existing users when login form is disabled. [#19048](https://github.com/grafana/grafana/pull/19048), [@548017](https://github.com/548017)
- **Azure Monitor**: Add support for cross resource queries. [#19115](https://github.com/grafana/grafana/pull/19115), [@sunker](https://github.com/sunker)
- **CLI**: Allow installing custom binary plugins. [#17551](https://github.com/grafana/grafana/pull/17551), [@aocenas](https://github.com/aocenas)
- **Dashboard**: Adds Logs Panel (alpha) as visualization option for Dashboards. [#18641](https://github.com/grafana/grafana/pull/18641), [@hugohaggmark](https://github.com/hugohaggmark)
- **Dashboard**: Reuse query results between panels . [#16660](https://github.com/grafana/grafana/pull/16660), [@ryantxu](https://github.com/ryantxu)
- **Dashboard**: Set time to to 23:59:59 when setting To time using calendar. [#18595](https://github.com/grafana/grafana/pull/18595), [@simPod](https://github.com/simPod)
- **DataLinks**: Add DataLinks support to Gauge, BarGauge and stat panel. [#18605](https://github.com/grafana/grafana/pull/18605), [@ryantxu](https://github.com/ryantxu)
- **DataLinks**: Enable access to labels & field names. [#18918](https://github.com/grafana/grafana/pull/18918), [@torkelo](https://github.com/torkelo)
- **DataLinks**: Enable multiple data links per panel. [#18434](https://github.com/grafana/grafana/pull/18434), [@dprokop](https://github.com/dprokop)
- **Docker**: switch docker image to alpine base with phantomjs support. [#18468](https://github.com/grafana/grafana/pull/18468), [@DanCech](https://github.com/DanCech)
- **Elasticsearch**: allow templating queries to order by doc_count. [#18870](https://github.com/grafana/grafana/pull/18870), [@hackery](https://github.com/hackery)
- **Explore**: Add throttling when doing live queries. [#19085](https://github.com/grafana/grafana/pull/19085), [@aocenas](https://github.com/aocenas)
- **Explore**: Adds ability to go back to dashboard, optionally with query changes. [#17982](https://github.com/grafana/grafana/pull/17982), [@kaydelaney](https://github.com/kaydelaney)
- **Explore**: Reduce default time range to last hour. [#18212](https://github.com/grafana/grafana/pull/18212), [@davkal](https://github.com/davkal)
- **Gauge/BarGauge**: Support decimals for min/max. [#18368](https://github.com/grafana/grafana/pull/18368), [@ryantxu](https://github.com/ryantxu)
- **Graph**: New series override transform constant that renders a single point as a line across the whole graph. [#19102](https://github.com/grafana/grafana/pull/19102), [@davkal](https://github.com/davkal)
- **Image rendering**: Add deprecation warning when PhantomJS is used for rendering images. [#18933](https://github.com/grafana/grafana/pull/18933), [@papagian](https://github.com/papagian)
- **InfluxDB**: Enable interpolation within ad-hoc filter values. [#18077](https://github.com/grafana/grafana/pull/18077), [@kvc-code](https://github.com/kvc-code)
- **LDAP**: Allow an user to be synchronized against LDAP. [#18976](https://github.com/grafana/grafana/pull/18976), [@gotjosh](https://github.com/gotjosh)
- **Ldap**: Add ldap debug page. [#18759](https://github.com/grafana/grafana/pull/18759), [@peterholmberg](https://github.com/peterholmberg)
- **Loki**: Remove prefetching of default label values. [#18213](https://github.com/grafana/grafana/pull/18213), [@davkal](https://github.com/davkal)
- **Metrics**: Add failed alert notifications metric. [#18089](https://github.com/grafana/grafana/pull/18089), [@koorgoo](https://github.com/koorgoo)
- **OAuth**: Support JMES path lookup when retrieving user email. [#14683](https://github.com/grafana/grafana/pull/14683), [@bobmshannon](https://github.com/bobmshannon)
- **OAuth**: return GitLab groups as a part of user info (enable team sync). [#18388](https://github.com/grafana/grafana/pull/18388), [@alexanderzobnin](https://github.com/alexanderzobnin)
- **Panels**: Add unit for electrical charge - ampere-hour. [#18950](https://github.com/grafana/grafana/pull/18950), [@anirudh-ramesh](https://github.com/anirudh-ramesh)
- **Plugin**: AzureMonitor - Reapply MetricNamespace support. [#17282](https://github.com/grafana/grafana/pull/17282), [@raphaelquati](https://github.com/raphaelquati)
- **Plugins**: better warning when plugins fail to load. [#18671](https://github.com/grafana/grafana/pull/18671), [@ryantxu](https://github.com/ryantxu)
- **Postgres**: Add support for scram sha 256 authentication. [#18397](https://github.com/grafana/grafana/pull/18397), [@nonamef](https://github.com/nonamef)
- **RemoteCache**: Support SSL with Redis. [#18511](https://github.com/grafana/grafana/pull/18511), [@kylebrandt](https://github.com/kylebrandt)
- **SingleStat**: The gauge option in now disabled/hidden (unless it's an old panel with it already enabled) . [#18610](https://github.com/grafana/grafana/pull/18610), [@ryantxu](https://github.com/ryantxu)
- **Stackdriver**: Add extra alignment period options. [#18909](https://github.com/grafana/grafana/pull/18909), [@sunker](https://github.com/sunker)
- **Units**: Add South African Rand (ZAR) to currencies. [#18893](https://github.com/grafana/grafana/pull/18893), [@jeteon](https://github.com/jeteon)
- **Units**: Adding T,P,E,Z,and Y bytes. [#18706](https://github.com/grafana/grafana/pull/18706), [@chiqomar](https://github.com/chiqomar)

### Bug Fixes

- **Alerting**: Notification is sent when state changes from no_data to ok. [#18920](https://github.com/grafana/grafana/pull/18920), [@papagian](https://github.com/papagian)
- **Alerting**: fix duplicate alert states when the alert fails to save to the database. [#18216](https://github.com/grafana/grafana/pull/18216), [@kylebrandt](https://github.com/kylebrandt)
- **Alerting**: fix response popover prompt when add notification channels. [#18967](https://github.com/grafana/grafana/pull/18967), [@lzdw](https://github.com/lzdw)
- **CloudWatch**: Fix alerting for queries with Id (using GetMetricData). [#17899](https://github.com/grafana/grafana/pull/17899), [@alex-berger](https://github.com/alex-berger)
- **Explore**: Fix auto completion on label values for Loki. [#18988](https://github.com/grafana/grafana/pull/18988), [@aocenas](https://github.com/aocenas)
- **Explore**: Fixes crash using back button with a zoomed in graph. [#19122](https://github.com/grafana/grafana/pull/19122), [@hugohaggmark](https://github.com/hugohaggmark)
- **Explore**: Fixes so queries in Explore are only run if Graph/Table is shown. [#19000](https://github.com/grafana/grafana/pull/19000), [@hugohaggmark](https://github.com/hugohaggmark)
- **MSSQL**: Change connectionstring to URL format to fix using passwords with semicolon. [#18384](https://github.com/grafana/grafana/pull/18384), [@Russiancold](https://github.com/Russiancold)
- **MSSQL**: Fix memory leak when debug enabled. [#19049](https://github.com/grafana/grafana/pull/19049), [@briangann](https://github.com/briangann)
- **Provisioning**: Allow escaping literal '$' with '$\$' in configs to avoid interpolation. [#18045](https://github.com/grafana/grafana/pull/18045), [@kylebrandt](https://github.com/kylebrandt)
- **TimePicker**: Fixes hiding time picker dropdown in FireFox. [#19154](https://github.com/grafana/grafana/pull/19154), [@hugohaggmark](https://github.com/hugohaggmark)

## Breaking changes

### Annotations

There are some breaking changes in the annotations HTTP API for region annotations. Region annotations are now represented
using a single event instead of two separate events. Check breaking changes in HTTP API [below](#http-api) and [HTTP API documentation](https://grafana.com/docs/http_api/annotations/) for more details.

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

- **CloudWatch**: Fix high CPU load [#20579](https://github.com/grafana/grafana/pull/20579)

# 6.3.6 (2019-09-23)

### Features / Enhancements

- **Metrics**: Adds setting for turning off total stats metrics. [#19142](https://github.com/grafana/grafana/pull/19142), [@marefr](https://github.com/marefr)

### Bug Fixes

- **Database**: Rewrite system statistics query to perform better. [#19178](https://github.com/grafana/grafana/pull/19178), [@papagian](https://github.com/papagian)
- **Explore**: Fixes error when switching from prometheus to loki data sources. [#18599](https://github.com/grafana/grafana/pull/18599), [@kaydelaney](https://github.com/kaydelaney)

# 6.3.5 (2019-09-02)

### Upgrades

- **Build**: Upgrade to go 1.12.9. [#18638](https://github.com/grafana/grafana/pull/18638), [@marcusolsson](https://github.com/marcusolsson)

### Bug Fixes

- **Dashboard**: Fixes dashboards init failed loading error for dashboards with panel links that had missing properties. [#18786](https://github.com/grafana/grafana/pull/18786), [@torkelo](https://github.com/torkelo)
- **Editor**: Fixes issue where only entire lines were being copied. [#18806](https://github.com/grafana/grafana/pull/18806), [@kaydelaney](https://github.com/kaydelaney)
- **Explore**: Fixes query field layout in splitted view for Safari browsers. [#18654](https://github.com/grafana/grafana/pull/18654), [@hugohaggmark](https://github.com/hugohaggmark)
- **LDAP**: multildap + ldap integration. [#18588](https://github.com/grafana/grafana/pull/18588), [@markelog](https://github.com/markelog)
- **Profile/UserAdmin**: Fix for user agent parser crashes grafana-server on 32-bit builds. [#18788](https://github.com/grafana/grafana/pull/18788), [@marcusolsson](https://github.com/marcusolsson)
- **Prometheus**: Prevents panel editor crash when switching to Prometheus data source. [#18616](https://github.com/grafana/grafana/pull/18616), [@hugohaggmark](https://github.com/hugohaggmark)
- **Prometheus**: Changes brace-insertion behavior to be less annoying. [#18698](https://github.com/grafana/grafana/pull/18698), [@kaydelaney](https://github.com/kaydelaney)

# 6.3.4 (2019-08-29)

- **Security**: Urgent security patch release. Please read more in our [blog](https://grafana.com/blog/2019/08/29/grafana-5.4.5-and-6.3.4-released-with-important-security-fix/)

# 6.3.3 (2019-08-15)

### Bug Fixes

- **Annotations**: Fix failing annotation query when time series query is cancelled. [#18532](https://github.com/grafana/grafana/pull/18532), [@dprokop](https://github.com/dprokop)
- **Auth**: Do not set SameSite cookie attribute if cookie_samesite is none. [#18462](https://github.com/grafana/grafana/pull/18462), [@papagian](https://github.com/papagian)
- **DataLinks**: Apply scoped variables to data links correctly. [#18454](https://github.com/grafana/grafana/pull/18454), [@dprokop](https://github.com/dprokop)
- **DataLinks**: Respect timezone when displaying datapoint's timestamp in graph context menu. [#18461](https://github.com/grafana/grafana/pull/18461), [@dprokop](https://github.com/dprokop)
- **DataLinks**: Use datapoint timestamp correctly when interpolating variables. [#18459](https://github.com/grafana/grafana/pull/18459), [@dprokop](https://github.com/dprokop)
- **Explore**: Fix loading error for empty queries. [#18488](https://github.com/grafana/grafana/pull/18488), [@davkal](https://github.com/davkal)
- **Graph**: Fixes legend issue clicking on series line icon and issue with horizontal scrollbar being visible on windows. [#18563](https://github.com/grafana/grafana/pull/18563), [@torkelo](https://github.com/torkelo)
- **Graphite**: Avoid glob of single-value array variables . [#18420](https://github.com/grafana/grafana/pull/18420), [@gotjosh](https://github.com/gotjosh)
- **Prometheus**: Fix queries with label_replace remove the \$1 match when loading query editor. [#18480](https://github.com/grafana/grafana/pull/18480), [@hugohaggmark](https://github.com/hugohaggmark)
- **Prometheus**: More consistently allows for multi-line queries in editor. [#18362](https://github.com/grafana/grafana/pull/18362), [@kaydelaney](https://github.com/kaydelaney)
- **TimeSeries**: Assume values are all numbers. [#18540](https://github.com/grafana/grafana/pull/18540), [@ryantxu](https://github.com/ryantxu)

# 6.3.2 (2019-08-07)

### Bug Fixes

- **Gauge/BarGauge**: Fixes issue with lost thresholds and an issue loading Gauge with avg stat. [#18375](https://github.com/grafana/grafana/pull/18375)

# 6.3.1 (2019-08-07)

### Bug Fixes

- **PanelLinks**: Fixes crash issue with Gauge & Bar Gauge panels with panel links (drill down links). [#18430](https://github.com/grafana/grafana/pull/18430)

# 6.3.0 (2019-08-06)

### Features / Enhancements

- **OAuth**: Do not set SameSite OAuth cookie if cookie_samesite is None. [#18392](https://github.com/grafana/grafana/pull/18392), [@papagian](https://github.com/papagian)

### Bug Fixes

- **PanelLinks**: Fix render issue when there is no panel description. [#18408](https://github.com/grafana/grafana/pull/18408), [@dehrax](https://github.com/dehrax)

# 6.3.0-beta4 (2019-08-02)

### Features / Enhancements

- **Auth Proxy**: Include additional headers as part of the cache key. [#18298](https://github.com/grafana/grafana/pull/18298), [@gotjosh](https://github.com/gotjosh)

# 6.3.0-beta3 (2019-08-02)

### Bug Fixes

- **OAuth**: Fix "missing saved state" OAuth login failure due to SameSite cookie policy. [#18332](https://github.com/grafana/grafana/pull/18332), [@papagian](https://github.com/papagian)
- **cli**: fix for recognizing when in dev mode.. [#18334](https://github.com/grafana/grafana/pull/18334), [@xlson](https://github.com/xlson)

# 6.3.0-beta2 (2019-07-26)

### Features / Enhancements

- **Build grafana images consistently**. [#18224](https://github.com/grafana/grafana/pull/18224), [@hassanfarid](https://github.com/hassanfarid)
- **Docs**: SAML. [#18069](https://github.com/grafana/grafana/pull/18069), [@gotjosh](https://github.com/gotjosh)
- **Permissions**: Show plugins in nav for non admin users but hide plugin configuration. [#18234](https://github.com/grafana/grafana/pull/18234), [@aocenas](https://github.com/aocenas)
- **TimePicker**: Increase max height of quick range dropdown. [#18247](https://github.com/grafana/grafana/pull/18247), [@torkelo](https://github.com/torkelo)

### Bug Fixes

- **DataLinks**: Fixes incorrect interpolation of \${\_\_series_name} . [#18251](https://github.com/grafana/grafana/pull/18251), [@torkelo](https://github.com/torkelo)
- **Loki**: Display live tailed logs in correct order in Explore. [#18031](https://github.com/grafana/grafana/pull/18031), [@kaydelaney](https://github.com/kaydelaney)
- **PhantomJS**: Fixes rendering on Debian Buster. [#18162](https://github.com/grafana/grafana/pull/18162), [@xlson](https://github.com/xlson)
- **TimePicker**: Fixed style issue for custom range popover. [#18244](https://github.com/grafana/grafana/pull/18244), [@torkelo](https://github.com/torkelo)
- **Timerange**: Fixes a bug where custom time ranges didn't respect UTC. [#18248](https://github.com/grafana/grafana/pull/18248), [@kaydelaney](https://github.com/kaydelaney)
- **remote_cache**: Fix redis connstr parsing. [#18204](https://github.com/grafana/grafana/pull/18204), [@mblaschke](https://github.com/mblaschke)

# 6.3.0-beta1 (2019-07-10)

### Features / Enhancements

- **Alerting**: Add tags to alert rules. [#10989](https://github.com/grafana/grafana/pull/10989), [@Thib17](https://github.com/Thib17)
- **Alerting**: Attempt to send email notifications to all given email addresses. [#16881](https://github.com/grafana/grafana/pull/16881), [@zhulongcheng](https://github.com/zhulongcheng)
- **Alerting**: Improve alert rule testing. [#16286](https://github.com/grafana/grafana/pull/16286), [@marefr](https://github.com/marefr)
- **Alerting**: Support for configuring content field for Discord alert notifier. [#17017](https://github.com/grafana/grafana/pull/17017), [@jan25](https://github.com/jan25)
- **Alertmanager**: Replace illegal chars with underscore in label names. [#17002](https://github.com/grafana/grafana/pull/17002), [@bergquist](https://github.com/bergquist)
- **Auth**: Allow expiration of API keys. [#17678](https://github.com/grafana/grafana/pull/17678), [@papagian](https://github.com/papagian)
- **Auth**: Return device, os and browser when listing user auth tokens in HTTP API. [#17504](https://github.com/grafana/grafana/pull/17504), [@shavonn](https://github.com/shavonn)
- **Auth**: Support list and revoke of user auth tokens in UI. [#17434](https://github.com/grafana/grafana/pull/17434), [@shavonn](https://github.com/shavonn)
- **AzureMonitor**: change clashing built-in Grafana variables/macro names for Azure Logs. [#17140](https://github.com/grafana/grafana/pull/17140), [@shavonn](https://github.com/shavonn)
- **CloudWatch**: Made region visible for AWS Cloudwatch Expressions. [#17243](https://github.com/grafana/grafana/pull/17243), [@utkarshcmu](https://github.com/utkarshcmu)
- **Cloudwatch**: Add AWS DocDB metrics. [#17241](https://github.com/grafana/grafana/pull/17241), [@utkarshcmu](https://github.com/utkarshcmu)
- **Dashboard**: Use timezone dashboard setting when exporting to CSV. [#18002](https://github.com/grafana/grafana/pull/18002), [@dehrax](https://github.com/dehrax)
- **Data links**. [#17267](https://github.com/grafana/grafana/pull/17267), [@torkelo](https://github.com/torkelo)
- **Docker**: Switch base image to ubuntu:latest from debian:stretch to avoid security issues.. [#17066](https://github.com/grafana/grafana/pull/17066), [@bergquist](https://github.com/bergquist)
- **Elasticsearch**: Support for visualizing logs in Explore . [#17605](https://github.com/grafana/grafana/pull/17605), [@marefr](https://github.com/marefr)
- **Explore**: Adds Live option for supported data sources. [#17062](https://github.com/grafana/grafana/pull/17062), [@hugohaggmark](https://github.com/hugohaggmark)
- **Explore**: Adds orgId to URL for sharing purposes. [#17895](https://github.com/grafana/grafana/pull/17895), [@kaydelaney](https://github.com/kaydelaney)
- **Explore**: Adds support for new loki 'start' and 'end' params for labels endpoint. [#17512](https://github.com/grafana/grafana/pull/17512), [@kaydelaney](https://github.com/kaydelaney)
- **Explore**: Adds support for toggling raw query mode in explore. [#17870](https://github.com/grafana/grafana/pull/17870), [@kaydelaney](https://github.com/kaydelaney)
- **Explore**: Allow switching between metrics and logs . [#16959](https://github.com/grafana/grafana/pull/16959), [@marefr](https://github.com/marefr)
- **Explore**: Combines the timestamp and local time columns into one. [#17775](https://github.com/grafana/grafana/pull/17775), [@hugohaggmark](https://github.com/hugohaggmark)
- **Explore**: Display log lines context . [#17097](https://github.com/grafana/grafana/pull/17097), [@dprokop](https://github.com/dprokop)
- **Explore**: Don't parse log levels if provided by field or label. [#17180](https://github.com/grafana/grafana/pull/17180), [@marefr](https://github.com/marefr)
- **Explore**: Improves performance of Logs element by limiting re-rendering. [#17685](https://github.com/grafana/grafana/pull/17685), [@kaydelaney](https://github.com/kaydelaney)
- **Explore**: Support for new LogQL filtering syntax. [#16674](https://github.com/grafana/grafana/pull/16674), [@davkal](https://github.com/davkal)
- **Explore**: Use new TimePicker from Grafana/UI. [#17793](https://github.com/grafana/grafana/pull/17793), [@hugohaggmark](https://github.com/hugohaggmark)
- **Explore**: handle newlines in LogRow Highlighter. [#17425](https://github.com/grafana/grafana/pull/17425), [@rrfeng](https://github.com/rrfeng)
- **Graph**: Added new fill gradient option. [#17528](https://github.com/grafana/grafana/pull/17528), [@torkelo](https://github.com/torkelo)
- **GraphPanel**: Don't sort series when legend table & sort column is not visible . [#17095](https://github.com/grafana/grafana/pull/17095), [@shavonn](https://github.com/shavonn)
- **InfluxDB**: Support for visualizing logs in Explore. [#17450](https://github.com/grafana/grafana/pull/17450), [@hugohaggmark](https://github.com/hugohaggmark)
- **Logging**: Login and Logout actions (#17760). [#17883](https://github.com/grafana/grafana/pull/17883), [@ATTron](https://github.com/ATTron)
- **Logging**: Move log package to pkg/infra. [#17023](https://github.com/grafana/grafana/pull/17023), [@zhulongcheng](https://github.com/zhulongcheng)
- **Metrics**: Expose stats about roles as metrics. [#17469](https://github.com/grafana/grafana/pull/17469), [@bergquist](https://github.com/bergquist)
- **MySQL/Postgres/MSSQL**: Add parsing for day, weeks and year intervals in macros. [#13086](https://github.com/grafana/grafana/pull/13086), [@bernardd](https://github.com/bernardd)
- **MySQL**: Add support for periodically reloading client certs. [#14892](https://github.com/grafana/grafana/pull/14892), [@tpetr](https://github.com/tpetr)
- **Plugins**: replace dataFormats list with skipDataQuery flag in plugin.json. [#16984](https://github.com/grafana/grafana/pull/16984), [@ryantxu](https://github.com/ryantxu)
- **Prometheus**: Take timezone into account for step alignment. [#17477](https://github.com/grafana/grafana/pull/17477), [@fxmiii](https://github.com/fxmiii)
- **Prometheus**: Use overridden panel range for \$\_\_range instead of dashboard range. [#17352](https://github.com/grafana/grafana/pull/17352), [@patrick246](https://github.com/patrick246)
- **Prometheus**: added time range filter to series labels query. [#16851](https://github.com/grafana/grafana/pull/16851), [@FUSAKLA](https://github.com/FUSAKLA)
- **Provisioning**: Support folder that doesn't exist yet in dashboard provisioning. [#17407](https://github.com/grafana/grafana/pull/17407), [@Nexucis](https://github.com/Nexucis)
- **Refresh picker**: Handle empty intervals. [#17585](https://github.com/grafana/grafana/pull/17585), [@dehrax](https://github.com/dehrax)
- **Singlestat**: Add y min/max config to singlestat sparklines. [#17527](https://github.com/grafana/grafana/pull/17527), [@pitr](https://github.com/pitr)
- **Snapshot**: use given key and deleteKey. [#16876](https://github.com/grafana/grafana/pull/16876), [@zhulongcheng](https://github.com/zhulongcheng)
- **Templating**: Correctly display \_\_text in multi-value variable after page reload. [#17840](https://github.com/grafana/grafana/pull/17840), [@EduardSergeev](https://github.com/EduardSergeev)
- **Templating**: Support selecting all filtered values of a multi-value variable. [#16873](https://github.com/grafana/grafana/pull/16873), [@r66ad](https://github.com/r66ad)
- **Tracing**: allow propagation with Zipkin headers. [#17009](https://github.com/grafana/grafana/pull/17009), [@jrockway](https://github.com/jrockway)
- **Users**: Disable users removed from LDAP. [#16820](https://github.com/grafana/grafana/pull/16820), [@alexanderzobnin](https://github.com/alexanderzobnin)
- **SAML**: Add SAML as an authentication option (Enterprise)

### Bug Fixes

- **AddPanel**: Fix issue when removing moved add panel widget . [#17659](https://github.com/grafana/grafana/pull/17659), [@dehrax](https://github.com/dehrax)
- **CLI**: Fix encrypt-datasource-passwords fails with sql error. [#18014](https://github.com/grafana/grafana/pull/18014), [@marefr](https://github.com/marefr)
- **Elasticsearch**: Fix default max concurrent shard requests. [#17770](https://github.com/grafana/grafana/pull/17770), [@marefr](https://github.com/marefr)
- **Explore**: Fix browsing back to dashboard panel. [#17061](https://github.com/grafana/grafana/pull/17061), [@jschill](https://github.com/jschill)
- **Explore**: Fix filter by series level in logs graph. [#17798](https://github.com/grafana/grafana/pull/17798), [@marefr](https://github.com/marefr)
- **Explore**: Fix issues when loading and both graph/table are collapsed. [#17113](https://github.com/grafana/grafana/pull/17113), [@marefr](https://github.com/marefr)
- **Explore**: Fix selection/copy of log lines. [#17121](https://github.com/grafana/grafana/pull/17121), [@marefr](https://github.com/marefr)
- **Fix**: Wrap value of multi variable in array when coming from URL. [#16992](https://github.com/grafana/grafana/pull/16992), [@aocenas](https://github.com/aocenas)
- **Frontend**: Fix for Json tree component not working. [#17608](https://github.com/grafana/grafana/pull/17608), [@srid12](https://github.com/srid12)
- **Graphite**: Fix for issue with alias function being moved last. [#17791](https://github.com/grafana/grafana/pull/17791), [@torkelo](https://github.com/torkelo)
- **Graphite**: Fixes issue with seriesByTag & function with variable param. [#17795](https://github.com/grafana/grafana/pull/17795), [@torkelo](https://github.com/torkelo)
- **Graphite**: use POST for /metrics/find requests. [#17814](https://github.com/grafana/grafana/pull/17814), [@papagian](https://github.com/papagian)
- **HTTP Server**: Serve Grafana with a custom URL path prefix. [#17048](https://github.com/grafana/grafana/pull/17048), [@jan25](https://github.com/jan25)
- **InfluxDB**: Fixes single quotes are not escaped in label value filters. [#17398](https://github.com/grafana/grafana/pull/17398), [@Panzki](https://github.com/Panzki)
- **Prometheus**: Correctly escape '|' literals in interpolated PromQL variables. [#16932](https://github.com/grafana/grafana/pull/16932), [@Limess](https://github.com/Limess)
- **Prometheus**: Fix when adding label for metrics which contains colons in Explore. [#16760](https://github.com/grafana/grafana/pull/16760), [@tolwi](https://github.com/tolwi)
- **SinglestatPanel**: Remove background color when value turns null. [#17552](https://github.com/grafana/grafana/pull/17552), [@druggieri](https://github.com/druggieri)

# 6.2.5 (2019-06-25)

### Features / Enhancements

- **Grafana-CLI**: Wrapper for `grafana-cli` within RPM/DEB packages and config/homepath are now global flags. [#17695](https://github.com/grafana/grafana/pull/17695), [@gotjosh](https://github.com/gotjosh)
- **Panel**: Fully escape html in drilldown links (was only sanitized before) . [#17731](https://github.com/grafana/grafana/pull/17731), [@dehrax](https://github.com/dehrax)

### Bug Fixes

- **Config**: Fix connectionstring for remote_cache in defaults.ini. [#17675](https://github.com/grafana/grafana/pull/17675), [@kylebrandt](https://github.com/kylebrandt)
- **Elasticsearch**: Fix empty query (via template variable) should be sent as wildcard. [#17488](https://github.com/grafana/grafana/pull/17488), [@davewat](https://github.com/davewat)
- **HTTP-Server**: Fix Strict-Transport-Security header. [#17644](https://github.com/grafana/grafana/pull/17644), [@kylebrandt](https://github.com/kylebrandt)
- **TablePanel**: fix annotations display. [#17646](https://github.com/grafana/grafana/pull/17646), [@ryantxu](https://github.com/ryantxu)

# 6.2.4 (2019-06-18)

### Bug Fixes

- **Grafana-CLI**: Fix receiving flags via command line . [#17617](https://github.com/grafana/grafana/pull/17617), [@gotjosh](https://github.com/gotjosh)
- **HTTPServer**: Fix X-XSS-Protection header formatting. [#17620](https://github.com/grafana/grafana/pull/17620), [@yverry](https://github.com/yverry)

# 6.2.3 (2019-06-17)

### Known issues

- **grafana-cli**: The argument `--pluginsDir` is not working.
- **docker**: Due to above problem with grafana-cli the docker run will fail to start the container if you're installing plugins using the `GF_INSTALL_PLUGINS` environment variable. We have removed 6.2.3 tag from docker hub and latest tag now points to 6.2.2.

More details in bug report: https://github.com/grafana/grafana/issues/17613

### Features / Enhancements

- **AuthProxy**: Optimistic lock pattern for remote cache Set. [#17485](https://github.com/grafana/grafana/pull/17485), [@papagian](https://github.com/papagian)
- **HTTPServer**: Options for returning new headers X-Content-Type-Options, X-XSS-Protection and Strict-Transport-Security. [#17522](https://github.com/grafana/grafana/pull/17522), [@kylebrandt](https://github.com/kylebrandt)

### Bug Fixes

- **Auth Proxy**: Fix non-negative cache TTL. [#17495](https://github.com/grafana/grafana/pull/17495), [@kylebrandt](https://github.com/kylebrandt)
- **Grafana-CLI**: Fix receiving configuration flags from the command line. [#17606](https://github.com/grafana/grafana/pull/17606), [@gotjosh](https://github.com/gotjosh)
- **OAuth**: Fix for wrong user token updated on OAuth refresh in DS proxy. [#17541](https://github.com/grafana/grafana/pull/17541), [@redbaron](https://github.com/redbaron)
- **remote_cache**: Fix redis. [#17483](https://github.com/grafana/grafana/pull/17483), [@kylebrandt](https://github.com/kylebrandt)

# 6.2.2 (2019-06-05)

### Features / Enhancements

- **Security**: Prevent CSV formula injection attack when exporting data. [#17363](https://github.com/grafana/grafana/pull/17363), [@DanCech](https://github.com/DanCech)

### Bug Fixes

- **CloudWatch**: Fixes error when hiding/disabling queries . [#17283](https://github.com/grafana/grafana/pull/17283), [@jpiccari](https://github.com/jpiccari)
- **Database**: Fixed slow permission query in folder/dashboard search. [#17427](https://github.com/grafana/grafana/pull/17427), [@aocenas](https://github.com/aocenas)
- **Explore**: Fixed updating time range before running queries. [#17349](https://github.com/grafana/grafana/pull/17349), [@marefr](https://github.com/marefr)
- **Plugins**: Fixed plugin config page navigation when using subpath. [#17364](https://github.com/grafana/grafana/pull/17364), [@torkelo](https://github.com/torkelo)

# 6.2.1 (2019-05-27)

### Features / Enhancements

- **CLI**: Add command to migrate all data sources to use encrypted password fields . [#17118](https://github.com/grafana/grafana/pull/17118), [@aocenas](https://github.com/aocenas)
- **Gauge/BarGauge**: Improvements to auto value font size . [#17292](https://github.com/grafana/grafana/pull/17292), [@torkelo](https://github.com/torkelo)

### Bug Fixes

- **Auth Proxy**: Resolve database is locked errors. [#17274](https://github.com/grafana/grafana/pull/17274), [@marefr](https://github.com/marefr)
- **Database**: Retry transaction if sqlite returns database is locked error. [#17276](https://github.com/grafana/grafana/pull/17276), [@marefr](https://github.com/marefr)
- **Explore**: Fixes so clicking in a Prometheus Table the query is filtered by clicked value. [#17083](https://github.com/grafana/grafana/pull/17083), [@hugohaggmark](https://github.com/hugohaggmark)
- **Singlestat**: Fixes issue with value placement and line wraps. [#17249](https://github.com/grafana/grafana/pull/17249), [@torkelo](https://github.com/torkelo)
- **Tech**: Update jQuery to 3.4.1 to fix issue on iOS 10 based browsers as well as Chrome 53.x . [#17290](https://github.com/grafana/grafana/pull/17290), [@timbutler](https://github.com/timbutler)

# 6.2.0 (2019-05-22)

### Bug Fixes

- **BarGauge**: Fix for negative min values. [#17192](https://github.com/grafana/grafana/pull/17192), [@torkelo](https://github.com/torkelo)
- **Gauge/BarGauge**: Fix for issues editing min & max options. [#17174](https://github.com/grafana/grafana/pull/17174)
- **Search**: Make only folder name only open search with current folder filter. [#17226](https://github.com/grafana/grafana/pull/17226)
- **AzureMonitor**: Revert to clearing chained dropdowns. [#17212](https://github.com/grafana/grafana/pull/17212)

### Breaking Changes

- **Plugins**: Data source plugins that process hidden queries need to add a "hiddenQueries: true" attribute in plugin.json. [#17124](https://github.com/grafana/grafana/pull/17124), [@ryantxu](https://github.com/ryantxu)

### Removal of old deprecated package repository

5 months ago we deprecated our old package cloud repository and [replaced it](https://grafana.com/blog/2019/01/05/moving-to-packages.grafana.com/) with our own. We will remove the old depreciated
repo on July 1st. Make sure you have switched to the new repo by then. The new repository has all our old releases so you are not required to upgrade just to switch package repository.

# 6.2.0-beta2 (2019-05-15)

### Features / Enhancements

- **Plugins**: Support templated urls in plugin routes. [#16599](https://github.com/grafana/grafana/pull/16599), [@briangann](https://github.com/briangann)
- **Packaging**: New MSI windows installer package\*\*. [#17073](https://github.com/grafana/grafana/pull/17073), [@briangann](https://github.com/briangann)

### Bug Fixes

- **Dashboard**: Fixes blank dashboard after window resize with panel without title. [#16942](https://github.com/grafana/grafana/pull/16942), [@torkelo](https://github.com/torkelo)
- **Dashboard**: Fixes lazy loading & expanding collapsed rows on mobile. [#17055](https://github.com/grafana/grafana/pull/17055), [@torkelo](https://github.com/torkelo)
- **Dashboard**: Fixes scrolling issues for Edge browser. [#17033](https://github.com/grafana/grafana/pull/17033), [@jschill](https://github.com/jschill)
- **Dashboard**: Show refresh button in first kiosk(tv) mode. [#17032](https://github.com/grafana/grafana/pull/17032), [@torkelo](https://github.com/torkelo)
- **Explore**: Fix empty result from data source should render logs container. [#16999](https://github.com/grafana/grafana/pull/16999), [@marefr](https://github.com/marefr)
- **Explore**: Fixes so clicking in a Prometheus Table the query is filtered by clicked value. [#17083](https://github.com/grafana/grafana/pull/17083), [@hugohaggmark](https://github.com/hugohaggmark)
- **Explore**: Makes it possible to zoom in Explore/Loki/Graph without exception. [#16991](https://github.com/grafana/grafana/pull/16991), [@hugohaggmark](https://github.com/hugohaggmark)
- **Gauge**: Fixes orientation issue after switching from BarGauge to Gauge. [#17064](https://github.com/grafana/grafana/pull/17064), [@torkelo](https://github.com/torkelo)
- **GettingStarted**: Fixes layout issues in getting started panel. [#16941](https://github.com/grafana/grafana/pull/16941), [@torkelo](https://github.com/torkelo)
- **InfluxDB**: Fix HTTP method should default to GET. [#16949](https://github.com/grafana/grafana/pull/16949), [@StephenSorriaux](https://github.com/StephenSorriaux)
- **Panels**: Fixed alert icon position in panel header. [#17070](https://github.com/grafana/grafana/pull/17070), [@torkelo](https://github.com/torkelo)
- **Panels**: Fixes panel error tooltip not showing. [#16993](https://github.com/grafana/grafana/pull/16993), [@torkelo](https://github.com/torkelo)
- **Plugins**: Fix how datemath utils are exposed to plugins. [#16976](https://github.com/grafana/grafana/pull/16976), [@marefr](https://github.com/marefr)
- **Singlestat**: fixed centering issue for very small panels. [#16944](https://github.com/grafana/grafana/pull/16944), [@torkelo](https://github.com/torkelo)
- **Search**: Scroll issue in dashboard search in latest Chrome. [#17054](https://github.com/grafana/grafana/pull/17054), [@jschill](https://github.com/jschill)
- **Docker**: Prevent a permission denied error when writing files to the default provisioning directory. [#16831](https://github.com/grafana/grafana/pull/16831), [@wmedlar](https://github.com/wmedlar)
- **Gauge**: Adds background shade to gauge track and improves height usage. [#17019](https://github.com/grafana/grafana/pull/17019), [@torkelo](https://github.com/torkelo)
- **RemoteCache**: Avoid race condition in Set causing error on insert. . [#17082](https://github.com/grafana/grafana/pull/17082), [@bergquist](https://github.com/bergquist)

# 6.2.0-beta1 (2019-05-07)

### Features / Enhancements

- **Admin**: Add more stats about roles. [#16667](https://github.com/grafana/grafana/pull/16667), [@bergquist](https://github.com/bergquist)
- **Alert list panel**: Support variables in filters. [#16892](https://github.com/grafana/grafana/pull/16892), [@psschand](https://github.com/psschand)
- **Alerting**: Adjust label for send on all alerts to default . [#16554](https://github.com/grafana/grafana/pull/16554), [@simPod](https://github.com/simPod)
- **Alerting**: Makes timeouts and retries configurable. [#16259](https://github.com/grafana/grafana/pull/16259), [@kobehaha](https://github.com/kobehaha)
- **Alerting**: No notification when going from no data to pending. [#16905](https://github.com/grafana/grafana/pull/16905), [@bergquist](https://github.com/bergquist)
- **Alerting**: Pushover alert, support for different sound for OK. [#16525](https://github.com/grafana/grafana/pull/16525), [@Hofls](https://github.com/Hofls)
- **Auth**: Enable retries and transaction for some db calls for auth tokens . [#16785](https://github.com/grafana/grafana/pull/16785), [@bergquist](https://github.com/bergquist)
- **AzureMonitor**: Adds support for multiple subscriptions per data source. [#16922](https://github.com/grafana/grafana/pull/16922), [@daniellee](https://github.com/daniellee)
- **Bar Gauge**: New multi series enabled gauge like panel with horizontal and vertical layouts and 3 display modes. [#16918](https://github.com/grafana/grafana/pull/16918), [@torkelo](https://github.com/torkelo)
- **Build**: Upgrades to golang 1.12.4. [#16545](https://github.com/grafana/grafana/pull/16545), [@bergquist](https://github.com/bergquist)
- **CloudWatch**: Update AWS/IoT metric and dimensions. [#16337](https://github.com/grafana/grafana/pull/16337), [@nonamef](https://github.com/nonamef)
- **Config**: Show user-friendly error message instead of stack trace. [#16564](https://github.com/grafana/grafana/pull/16564), [@Hofls](https://github.com/Hofls)
- **Dashboard**: Enable filtering dashboards in search by current folder. [#16790](https://github.com/grafana/grafana/pull/16790), [@dprokop](https://github.com/dprokop)
- **Dashboard**: Lazy load out of view panels . [#15554](https://github.com/grafana/grafana/pull/15554), [@ryantxu](https://github.com/ryantxu)
- **DataProxy**: Restore Set-Cookie header after proxy request. [#16838](https://github.com/grafana/grafana/pull/16838), [@marefr](https://github.com/marefr)
- **Data Sources**: Add pattern validation for time input on data source config pages. [#16837](https://github.com/grafana/grafana/pull/16837), [@aocenas](https://github.com/aocenas)
- **Elasticsearch**: Add 7.x version support. [#16646](https://github.com/grafana/grafana/pull/16646), [@alcidesv](https://github.com/alcidesv)
- **Explore**: Adds reconnect for failing data source. [#16226](https://github.com/grafana/grafana/pull/16226), [@hugohaggmark](https://github.com/hugohaggmark)
- **Explore**: Support user timezone. [#16469](https://github.com/grafana/grafana/pull/16469), [@marefr](https://github.com/marefr)
- **InfluxDB**: Add support for POST HTTP verb. [#16690](https://github.com/grafana/grafana/pull/16690), [@StephenSorriaux](https://github.com/StephenSorriaux)
- **Loki**: Search is now case insensitive. [#15948](https://github.com/grafana/grafana/pull/15948), [@steven-sheehy](https://github.com/steven-sheehy)
- **OAuth**: Update jwt regexp to include `=`. [#16521](https://github.com/grafana/grafana/pull/16521), [@DanCech](https://github.com/DanCech)
- **Panels**: No title will no longer make panel header take up space. [#16884](https://github.com/grafana/grafana/pull/16884), [@torkelo](https://github.com/torkelo)
- **Prometheus**: Adds tracing headers for Prometheus datasource. [#16724](https://github.com/grafana/grafana/pull/16724), [@svagner](https://github.com/svagner)
- **Provisioning**: Add API endpoint to reload provisioning configs. [#16579](https://github.com/grafana/grafana/pull/16579), [@aocenas](https://github.com/aocenas)
- **Provisioning**: Do not allow deletion of provisioned dashboards. [#16211](https://github.com/grafana/grafana/pull/16211), [@aocenas](https://github.com/aocenas)
- **Provisioning**: Interpolate env vars in provisioning files. [#16499](https://github.com/grafana/grafana/pull/16499), [@aocenas](https://github.com/aocenas)
- **Provisioning**: Support FolderUid in Dashboard Provisioning Config. [#16559](https://github.com/grafana/grafana/pull/16559), [@swtch1](https://github.com/swtch1)
- **Security**: Add new setting allow_embedding. [#16853](https://github.com/grafana/grafana/pull/16853), [@marefr](https://github.com/marefr)
- **Security**: Store data source passwords encrypted in secureJsonData. [#16175](https://github.com/grafana/grafana/pull/16175), [@aocenas](https://github.com/aocenas)
- **UX**: Improve Grafana usage for smaller screens. [#16783](https://github.com/grafana/grafana/pull/16783), [@torkelo](https://github.com/torkelo)
- **Units**: Add angle units, Arc Minutes and Seconds. [#16271](https://github.com/grafana/grafana/pull/16271), [@Dripoul](https://github.com/Dripoul)

### Bug Fixes

- **Build**: Fix bug where grafana didn't start after mysql on rpm packages. [#16917](https://github.com/grafana/grafana/pull/16917), [@bergquist](https://github.com/bergquist)
- **CloudWatch**: Fixes query order not affecting series ordering & color. [#16408](https://github.com/grafana/grafana/pull/16408), [@mtanda](https://github.com/mtanda)
- **CloudWatch**: Use default alias if there is no alias for metrics. [#16732](https://github.com/grafana/grafana/pull/16732), [@utkarshcmu](https://github.com/utkarshcmu)
- **Config**: Fixes bug where timeouts for alerting was not parsed correctly. [#16784](https://github.com/grafana/grafana/pull/16784), [@aocenas](https://github.com/aocenas)
- **Elasticsearch**: Fix view percentiles metric in table without date histogram. [#15686](https://github.com/grafana/grafana/pull/15686), [@Igor-Ratsuk](https://github.com/Igor-Ratsuk)
- **Explore**: Prevents histogram loading from killing Prometheus instance. [#16768](https://github.com/grafana/grafana/pull/16768), [@hugohaggmark](https://github.com/hugohaggmark)
- **Graph**: Allow override decimals to fully override. [#16414](https://github.com/grafana/grafana/pull/16414), [@torkelo](https://github.com/torkelo)
- **Mixed Data Source**: Fix error when one query is disabled. [#16409](https://github.com/grafana/grafana/pull/16409), [@marefr](https://github.com/marefr)
- **Search**: Fixes search limits and adds a page parameter. [#16458](https://github.com/grafana/grafana/pull/16458), [@torkelo](https://github.com/torkelo)
- **Security**: Responses from backend should not be cached. [#16848](https://github.com/grafana/grafana/pull/16848), [@marefr](https://github.com/marefr)

### Breaking changes

- **Gauge Panel**: The suffix / prefix options have been removed from the new Gauge Panel (introduced in v6.0). [#16870](https://github.com/grafana/grafana/issues/16870).

# 6.1.6 (2019-04-29)

### Features / Enhancements

- **Security**: Bump jQuery to 3.4.0 . [#16761](https://github.com/grafana/grafana/pull/16761), [@dprokop](https://github.com/dprokop)

### Bug Fixes

- **Playlist**: Fix loading dashboards by tag. [#16727](https://github.com/grafana/grafana/pull/16727), [@marefr](https://github.com/marefr)

# 6.1.5 (2019-04-29)

- **Security**: Urgent security patch release. Please read more in our [blog](https://grafana.com/blog/2019/04/29/grafana-5.4.4-and-6.1.6-released-with-important-security-fix/)

# 6.1.4 (2019-04-16)

### Bug Fixes

- **DataPanel**: Added missing built-in interval variables to scopedVars. [#16556](https://github.com/grafana/grafana/pull/16556), [@torkelo](https://github.com/torkelo)
- **Explore**: Adds maxDataPoints to data source query options . [#16513](https://github.com/grafana/grafana/pull/16513), [@hugohaggmark](https://github.com/hugohaggmark)
- **Explore**: Fixes so intervals are recalculated on run query. [#16510](https://github.com/grafana/grafana/pull/16510), [@hugohaggmark](https://github.com/hugohaggmark)
- **Heatmap**: Fix for empty graph when panel is too narrow (#16378). [#16460](https://github.com/grafana/grafana/pull/16460), [@alexanderzobnin](https://github.com/alexanderzobnin)
- **Heatmap**: Fixed auto decimals when bucket name is not number. [#16609](https://github.com/grafana/grafana/pull/16609), [@torkelo](https://github.com/torkelo)
- **QueryInspector**: Now shows error responses again. [#16514](https://github.com/grafana/grafana/pull/16514), [@torkelo](https://github.com/torkelo)

# 6.1.3 (2019-04-09)

### Bug Fixes

- **Graph**: Fixed auto decimals in legend values for some units like `ms` and `s`. [#16455](https://github.com/grafana/grafana/pull/16455), [@torkelo](https://github.com/torkelo)
- **Graph**: Fixed png rendering with legend to the right. [#16463](https://github.com/grafana/grafana/pull/16463), [@torkelo](https://github.com/torkelo)
- **Singlestat**: Use decimals when manually specified. [#16451](https://github.com/grafana/grafana/pull/16451), [@torkelo](https://github.com/torkelo)
- **UI Switch**: Fix broken UI switches. Fixes Default Data Source switch, Explore Logs switches, Gauge option switches. [#16303](https://github.com/grafana/grafana/pull/16303), [@dprokop](https://github.com/dprokop)

# 6.1.2 (2019-04-08)

### Bug Fixes

- **Graph**: Fixed series legend color for hidden series. [#16438](https://github.com/grafana/grafana/pull/16438), [@Ijin08](https://github.com/Ijin08)
- **Graph**: Fixed tooltip highlight on white theme. [#16429](https://github.com/grafana/grafana/pull/16429), [@torkelo](https://github.com/torkelo)
- **Styles**: Fixed menu hover highlight border. [#16431](https://github.com/grafana/grafana/pull/16431), [@torkelo](https://github.com/torkelo)
- **Singlestat Panel**: Correctly use the override decimals. [#16413](https://github.com/grafana/grafana/pull/16413), [@torkelo](https://github.com/torkelo)

# 6.1.1 (2019-04-05)

### Bug Fixes

- **Alerting**: Notification channel http api fixes. [#16379](https://github.com/grafana/grafana/pull/16379), [@marefr](https://github.com/marefr)
- **Graphite**: Editing graphite query function now works again. [#16390](https://github.com/grafana/grafana/pull/16390), [@torkelo](https://github.com/torkelo)
- **Playlist**: Kiosk & auto fit panels modes are working normally again . [#16403](https://github.com/grafana/grafana/pull/16403), [@torkelo](https://github.com/torkelo)
- **QueryEditors**: Toggle edit mode now always work on slower computers. [#16394](https://github.com/grafana/grafana/pull/16394), [@seanlaff](https://github.com/seanlaff)

# 6.1.0 (2019-04-03)

### Bug Fixes

- **CloudWatch**: Fix for dimension value list when changing dimension key. [#16356](https://github.com/grafana/grafana/pull/16356), [@mtanda](https://github.com/mtanda)
- **Graphite**: Editing function arguments now works again. [#16297](https://github.com/grafana/grafana/pull/16297), [@torkelo](https://github.com/torkelo)
- **InfluxDB**: Fix tag names with periods in alert evaluation. [#16255](https://github.com/grafana/grafana/pull/16255), [@floyd-may](https://github.com/floyd-may)
- **PngRendering**: Fix for panel height & title centering . [#16351](https://github.com/grafana/grafana/pull/16351), [@torkelo](https://github.com/torkelo)
- **Templating**: Fix for editing query variables. [#16299](https://github.com/grafana/grafana/pull/16299), [@torkelo](https://github.com/torkelo)

# 6.1.0-beta1 (2019-03-27)

### New Features

- **Prometheus**: adhoc filter support [#8253](https://github.com/grafana/grafana/issues/8253), thx [@mtanda](https://github.com/mtanda)
- **Permissions**: Editors can become admin for dashboards, folders and teams they create. [#15977](https://github.com/grafana/grafana/pull/15977), [@xlson](https://github.com/xlson)

### Minor

- **Auth**: Support listing and revoking auth tokens via API [#15836](https://github.com/grafana/grafana/issues/15836)
- **Alerting**: DingDing notification channel now includes alert values. [#13825](https://github.com/grafana/grafana/pull/13825), [@athurg](https://github.com/athurg)
- **Alerting**: Notification channel http api enhancements. [#16219](https://github.com/grafana/grafana/pull/16219), [@marefr](https://github.com/marefr)
- **CloudWatch**: Update metrics/dimensions list. [#16137](https://github.com/grafana/grafana/pull/16137), [@mtanda](https://github.com/mtanda)
- **Cloudwatch**: Add AWS RDS MaximumUsedTransactionIDs metric [#15077](https://github.com/grafana/grafana/pull/15077), thx [@activeshadow](https://github.com/activeshadow)
- **Cache**: Adds support for using out of proc caching in the backend [#10816](https://github.com/grafana/grafana/issues/10816)
- **Dashboard**: New keyboard shortcut `d l` toggles all Graph legends in a dashboard. [#15770](https://github.com/grafana/grafana/pull/15770), [@jsferrei](https://github.com/jsferrei)
- **Data Source**: Only log connection string in dev environment [#16001](https://github.com/grafana/grafana/issues/16001)
- **DataProxy**: Add custom header (X-Grafana-User) to data source requests with the current username. [#15998](https://github.com/grafana/grafana/pull/15998), [@aocenas](https://github.com/aocenas)
- **DataProxy**: Make it possible to add user details to requests sent to the dataproxy [#6359](https://github.com/grafana/grafana/issues/6359) and [#15931](https://github.com/grafana/grafana/issues/15931)
- **DataProxy**: Adds oauth pass-through option for data sources. [#15205](https://github.com/grafana/grafana/pull/15205), [@seanlaff](https://github.com/seanlaff)
- **Explore**: Hide empty duplicates column in logs viewer. [#15982](https://github.com/grafana/grafana/pull/15982), [@steven-sheehy](https://github.com/steven-sheehy)
- **Explore**: Make it possible to close left pane of split view. [#16155](https://github.com/grafana/grafana/pull/16155), [@dprokop](https://github.com/dprokop)
- **Explore**: Move back / forward with browser buttons now works. [#16150](https://github.com/grafana/grafana/pull/16150), [@hugohaggmark](https://github.com/hugohaggmark)
- **Explore**: Update Loki labels when label selector is opened. [#16131](https://github.com/grafana/grafana/pull/16131), [@dprokop](https://github.com/dprokop)
- **Graph Panel**: New options for X-axis Min & Max (for histograms). [#14877](https://github.com/grafana/grafana/pull/14877), [@papagian](https://github.com/papagian)
- **Heatmap**: You can now choose to hide buckets with zero value. [#15934](https://github.com/grafana/grafana/pull/15934), [@alexanderzobnin](https://github.com/alexanderzobnin)
- **Heatmap**: `Middle` bucket bound option [#15683](https://github.com/grafana/grafana/issues/15683)
- **Heatmap**: `Reverse order` option for changing order of buckets [#15683](https://github.com/grafana/grafana/issues/15683)
- **Prometheus**: Change alignment of range queries to end before now and not in future. [#16110](https://github.com/grafana/grafana/pull/16110), [@davkal](https://github.com/davkal)
- **Prometheus**: Dedup annotations events with same timestamp . [#16152](https://github.com/grafana/grafana/pull/16152), [@torkelo](https://github.com/torkelo)
- **SQL**: Use default min interval of 1m for all SQL data sources. [#15799](https://github.com/grafana/grafana/pull/15799), [@marefr](https://github.com/marefr)
- **TablePanel**: Column color style now works even after removing columns. [#16227](https://github.com/grafana/grafana/pull/16227), [@torkelo](https://github.com/torkelo)
- **Templating**: Custom variable value now escapes all backslashes properly. [#15980](https://github.com/grafana/grafana/pull/15980), [@srid12](https://github.com/srid12)
- **Templating**: Data source variable now supports multi-value for uses cases that involve repeating panels & rows. [#15914](https://github.com/grafana/grafana/pull/15914), [@torkelo](https://github.com/torkelo)
- **VictorOps**: Adds more information to the victor ops notifiers [#15744](https://github.com/grafana/grafana/issues/15744), thx [@zhulongcheng](https://github.com/zhulongcheng)

### Bug Fixes

- **Alerting**: Don't include non-existing image in MS Teams notifications. [#16116](https://github.com/grafana/grafana/pull/16116), [@SGI495](https://github.com/SGI495)
- **Api**: Invalid org invite code [#10506](https://github.com/grafana/grafana/issues/10506)
- **Annotations**: Fix for native annotations filtered by template variable with pipe. [#15515](https://github.com/grafana/grafana/pull/15515), [@marefr](https://github.com/marefr)
- **Dashboard**: Fix for time regions spanning across midnight. [#16201](https://github.com/grafana/grafana/pull/16201), [@marefr](https://github.com/marefr)
- **Data Source**: Handles nil jsondata field gracefully [#14239](https://github.com/grafana/grafana/issues/14239)
- **Data Source**: Empty user/password was not updated when updating data sources [#15608](https://github.com/grafana/grafana/pull/15608), thx [@Maddin-619](https://github.com/Maddin-619)
- **Elasticsearch**: Fixes using template variables in the alias field. [#16229](https://github.com/grafana/grafana/pull/16229), [@daniellee](https://github.com/daniellee)
- **Elasticsearch**: Fix incorrect index pattern padding in alerting queries. [#15892](https://github.com/grafana/grafana/pull/15892), [@sandlis](https://github.com/sandlis)
- **Explore**: Fix for Prometheus autocomplete not working in Firefox. [#16192](https://github.com/grafana/grafana/pull/16192), [@hugohaggmark](https://github.com/hugohaggmark)
- **Explore**: Fix for url does not keep query after browser refresh. [#16189](https://github.com/grafana/grafana/pull/16189), [@hugohaggmark](https://github.com/hugohaggmark)
- **Gauge**: Interpolate scoped variables in repeated gauges [#15739](https://github.com/grafana/grafana/issues/15739)
- **Graphite**: Fixed issue with using series ref and series by tag. [#16111](https://github.com/grafana/grafana/pull/16111), [@torkelo](https://github.com/torkelo)
- **Graphite**: Fixed variable quoting when variable value is numeric. [#16149](https://github.com/grafana/grafana/pull/16149), [@torkelo](https://github.com/torkelo)
- **Heatmap**: Fixes Y-axis tick labels being in wrong order for some Prometheus queries. [#15932](https://github.com/grafana/grafana/pull/15932), [@alexanderzobnin](https://github.com/alexanderzobnin)
- **Heatmap**: Negative values are now displayed correctly in graph & legend. [#15953](https://github.com/grafana/grafana/pull/15953), [@alexanderzobnin](https://github.com/alexanderzobnin)
- **Heatmap**: legend shows wrong colors for small values [#14019](https://github.com/grafana/grafana/issues/14019)
- **InfluxDB**: Always close request body even for error status codes. [#16207](https://github.com/grafana/grafana/pull/16207), [@ramongtx](https://github.com/ramongtx)
- **ManageDashboards**: Fix for checkboxes not appearing properly Firefox . [#15981](https://github.com/grafana/grafana/pull/15981), [@srid12](https://github.com/srid12)
- **Playlist**: Leaving playlist now always stops playlist . [#15791](https://github.com/grafana/grafana/pull/15791), [@peterholmberg](https://github.com/peterholmberg)
- **Prometheus**: fixes regex ad-hoc filters variables with wildcards. [#16234](https://github.com/grafana/grafana/pull/16234), [@daniellee](https://github.com/daniellee)
- **TablePanel**: Column color style now works even after removing columns. [#16227](https://github.com/grafana/grafana/pull/16227), [@torkelo](https://github.com/torkelo)
- **TablePanel**: Fix for white text on white background when value is null. [#16199](https://github.com/grafana/grafana/pull/16199), [@peterholmberg](https://github.com/peterholmberg)

# 6.0.2 (2019-03-19)

### Bug Fixes

- **Alerting**: Fixed issue with AlertList panel links resulting in panel not found errors. [#15975](https://github.com/grafana/grafana/pull/15975), [@torkelo](https://github.com/torkelo)
- **Dashboard**: Improved error handling when rendering dashboard panels. [#15970](https://github.com/grafana/grafana/pull/15970), [@torkelo](https://github.com/torkelo)
- **LDAP**: Fix allow anonymous server bind for ldap search. [#15872](https://github.com/grafana/grafana/pull/15872), [@marefr](https://github.com/marefr)
- **Discord**: Fix discord notifier so it doesn't crash when there are no image generated. [#15833](https://github.com/grafana/grafana/pull/15833), [@marefr](https://github.com/marefr)
- **Panel Edit**: Prevent search in VizPicker from stealing focus. [#15802](https://github.com/grafana/grafana/pull/15802), [@peterholmberg](https://github.com/peterholmberg)
- **Data Source admin**: Fixed url of back button in data source edit page, when root_url configured. [#15759](https://github.com/grafana/grafana/pull/15759), [@dprokop](https://github.com/dprokop)

# 6.0.1 (2019-03-06)

### Bug Fixes

- **Metrics**: Fixes broken usagestats metrics for /metrics [#15651](https://github.com/grafana/grafana/issues/15651)
- **Dashboard**: Fixes kiosk mode should have &kiosk appended to the url [#15765](https://github.com/grafana/grafana/issues/15765)
- **Dashboard**: Fixes kiosk=tv mode with autofitpanels should respect header [#15650](https://github.com/grafana/grafana/issues/15650)
- **Image rendering**: Fixed image rendering issue for dashboards with auto refresh, . [#15818](https://github.com/grafana/grafana/pull/15818), [@torkelo](https://github.com/torkelo)
- **Dashboard**: Fix only users that can edit a dashboard should be able to update panel json. [#15805](https://github.com/grafana/grafana/pull/15805), [@marefr](https://github.com/marefr)
- **LDAP**: fix allow anonymous initial bind for ldap search. [#15803](https://github.com/grafana/grafana/pull/15803), [@marefr](https://github.com/marefr)
- **UX**: Fixed scrollbar not visible initially (only after manual scroll). [#15798](https://github.com/grafana/grafana/pull/15798), [@torkelo](https://github.com/torkelo)
- **Data Source admin** TestData [#15793](https://github.com/grafana/grafana/pull/15793), [@hugohaggmark](https://github.com/hugohaggmark)
- **Dashboard**: Fixed scrolling issue that caused scroll to be locked to bottom. [#15792](https://github.com/grafana/grafana/pull/15792), [@torkelo](https://github.com/torkelo)
- **Explore**: Viewers with viewers_can_edit should be able to access /explore. [#15787](https://github.com/grafana/grafana/pull/15787), [@jschill](https://github.com/jschill)
- **Security** fix: limit access to org admin and alerting pages. [#15761](https://github.com/grafana/grafana/pull/15761), [@marefr](https://github.com/marefr)
- **Panel Edit** minInterval changes did not persist [#15757](https://github.com/grafana/grafana/pull/15757), [@hugohaggmark](https://github.com/hugohaggmark)
- **Teams**: Fixed bug when getting teams for user. [#15595](https://github.com/grafana/grafana/pull/15595), [@hugohaggmark](https://github.com/hugohaggmark)
- **Stackdriver**: fix for float64 bounds for distribution metrics [#14509](https://github.com/grafana/grafana/issues/14509)
- **Stackdriver**: no reducers available for distribution type [#15179](https://github.com/grafana/grafana/issues/15179)

# 6.0.0 stable (2019-02-25)

### Bug Fixes

- **Dashboard**: fixes click after scroll in series override menu [#15621](https://github.com/grafana/grafana/issues/15621)
- **MySQL**: fix mysql query using \_interval_ms variable throws error [#14507](https://github.com/grafana/grafana/issues/14507)

# 6.0.0-beta3 (2019-02-19)

### Minor

- **CLI**: Grafana CLI should preserve permissions for backend binaries for Linux and Darwin [#15500](https://github.com/grafana/grafana/issues/15500)
- **Alerting**: Allow image rendering 90 percent of alertTimeout [#15395](https://github.com/grafana/grafana/pull/15395)

### Bug fixes

- **Influxdb**: Add support for alerting on InfluxDB queries that use the non_negative_difference function [#15415](https://github.com/grafana/grafana/issues/15415), thx [@kiran3394](https://github.com/kiran3394)
- **Alerting**: Fix percent_diff calculation when points are nulls [#15443](https://github.com/grafana/grafana/issues/15443), thx [@max-neverov](https://github.com/max-neverov)
- **Alerting**: Fixed handling of alert urls with true flags [#15454](https://github.com/grafana/grafana/issues/15454)

# 6.0.0-beta2 (2019-02-11)

### New Features

- **AzureMonitor**: Enable alerting by converting Azure Monitor API to Go [#14623](https://github.com/grafana/grafana/issues/14623)

### Minor

- **Alerting**: Adds support for images in pushover notifier [#10780](https://github.com/grafana/grafana/issues/10780), thx [@jpenalbae](https://github.com/jpenalbae)
- **Graphite/InfluxDB/OpenTSDB**: Fix always take dashboard timezone into consideration when handle custom time ranges [#15284](https://github.com/grafana/grafana/issues/15284)
- **Stackdriver**: Template variables in filters using globbing format [#15182](https://github.com/grafana/grafana/issues/15182)
- **Cloudwatch**: Add `resource_arns` template variable query function [#8207](https://github.com/grafana/grafana/issues/8207), thx [@jeroenvollenbrock](https://github.com/jeroenvollenbrock)
- **Cloudwatch**: Add AWS/Neptune metrics [#14231](https://github.com/grafana/grafana/issues/14231), thx [@tcpatterson](https://github.com/tcpatterson)
- **Cloudwatch**: Add AWS/EC2/API metrics [#14233](https://github.com/grafana/grafana/issues/14233), thx [@tcpatterson](https://github.com/tcpatterson)
- **Cloudwatch**: Add AWS RDS ServerlessDatabaseCapacity metric [#15265](https://github.com/grafana/grafana/pull/15265), thx [@larsjoergensen](https://github.com/larsjoergensen)
- **MySQL**: Adds data source SSL CA/client certificates support [#8570](https://github.com/grafana/grafana/issues/8570), thx [@bugficks](https://github.com/bugficks)
- **MSSQL**: Timerange are now passed for template variable queries [#13324](https://github.com/grafana/grafana/issues/13324), thx [@thatsparesh](https://github.com/thatsparesh)
- **Annotations**: Support PATCH verb in annotations http api [#12546](https://github.com/grafana/grafana/issues/12546), thx [@SamuelToh](https://github.com/SamuelToh)
- **Templating**: Add json formatting to variable interpolation [#15291](https://github.com/grafana/grafana/issues/15291), thx [@mtanda](https://github.com/mtanda)
- **Login**: Anonymous usage stats for token auth [#15288](https://github.com/grafana/grafana/issues/15288)
- **AzureMonitor**: improve autocomplete for Log Analytics and App Insights editor [#15131](https://github.com/grafana/grafana/issues/15131)
- **LDAP**: Fix IPA/FreeIPA v4.6.4 does not allow LDAP searches with empty attributes [#14432](https://github.com/grafana/grafana/issues/14432)
- **Provisioning**: Allow testing data sources that were added by config [#12164](https://github.com/grafana/grafana/issues/12164)
- **Security**: Fix CSRF Token validation for POSTs [#1441](https://github.com/grafana/grafana/issues/1441)

### Breaking changes

- **Internal Metrics** Edition has been added to the build_info metric. This will break any Graphite queries using this metric. Edition will be a new label for the Prometheus metric. [#15363](https://github.com/grafana/grafana/pull/15363)

### Bug fixes

- **Gauge**: Fix issue with gauge requests being cancelled [#15366](https://github.com/grafana/grafana/issues/15366)
- **Gauge**: Accept decimal inputs for thresholds [#15372](https://github.com/grafana/grafana/issues/15372)
- **UI**: Fix error caused by named colors that are not part of named colors palette [#15373](https://github.com/grafana/grafana/issues/15373)
- **Search**: Bug pressing special regexp chars in input fields [#12972](https://github.com/grafana/grafana/issues/12972)
- **Permissions**: No need to have edit permissions to be able to "Save as" [#13066](https://github.com/grafana/grafana/issues/13066)

# 6.0.0-beta1 (2019-01-30)

### New Features

- **Alerting**: Adds support for Google Hangouts Chat notifications [#11221](https://github.com/grafana/grafana/issues/11221), thx [@PatrickSchuster](https://github.com/PatrickSchuster)
- **Elasticsearch**: Support bucket script pipeline aggregations [#5968](https://github.com/grafana/grafana/issues/5968)
- **Influxdb**: Add support for time zone (`tz`) clause [#10322](https://github.com/grafana/grafana/issues/10322), thx [@cykl](https://github.com/cykl)
- **Snapshots**: Enable deletion of public snapshot [#14109](https://github.com/grafana/grafana/issues/14109)
- **Provisioning**: Provisioning support for alert notifiers [#10487](https://github.com/grafana/grafana/issues/10487), thx [@pbakulev](https://github.com/pbakulev)
- **Explore**: A whole new way to do ad-hoc metric queries and exploration. Split view in half and compare metrics & logs and much much more. [Read more here](http://docs.grafana.org/features/explore/)
- **Auth**: Replace remember me cookie solution for Grafana's builtin, LDAP and OAuth authentication with a solution based on short-lived tokens [#15303](https://github.com/grafana/grafana/issues/15303)

### Minor

- **Templating**: Built in time range variables `$__from` and `$__to`, [#1909](https://github.com/grafana/grafana/issues/1909)
- **Alerting**: Use separate timeouts for alert evals and notifications [#14701](https://github.com/grafana/grafana/issues/14701), thx [@sharkpc0813](https://github.com/sharkpc0813)
- **Elasticsearch**: Add support for offset in date histogram aggregation [#12653](https://github.com/grafana/grafana/issues/12653), thx [@mattiarossi](https://github.com/mattiarossi)
- **Elasticsearch**: Add support for moving average and derivative using doc count (metric count) [#8843](https://github.com/grafana/grafana/issues/8843) [#11175](https://github.com/grafana/grafana/issues/11175)
- **Elasticsearch**: Add support for template variable interpolation in alias field [#4075](https://github.com/grafana/grafana/issues/4075), thx [@SamuelToh](https://github.com/SamuelToh)
- **Influxdb**: Fix autocomplete of measurements does not escape search string properly [#11503](https://github.com/grafana/grafana/issues/11503), thx [@SamuelToh](https://github.com/SamuelToh)
- **Stackdriver**: Aggregating series returns more than one series [#14581](https://github.com/grafana/grafana/issues/14581) and [#13914](https://github.com/grafana/grafana/issues/13914), thx [@kinok](https://github.com/kinok)
- **Cloudwatch**: Fix Assume Role Arn [#14722](https://github.com/grafana/grafana/issues/14722), thx [@jaken551](https://github.com/jaken551)
- **Postgres/MySQL/MSSQL**: Nanosecond timestamp support (`$__unixEpochNanoFilter`, `$__unixEpochNanoFrom`, `$__unixEpochNanoTo`) [#14711](https://github.com/grafana/grafana/pull/14711), thx [@ander26](https://github.com/ander26)
- **Provisioning**: Fixes bug causing infinite growth in dashboard_version table. [#12864](https://github.com/grafana/grafana/issues/12864)
- **Auth**: Prevent password reset when login form is disabled or either LDAP or Auth Proxy is enabled [#14246](https://github.com/grafana/grafana/issues/14246), thx [@SilverFire](https://github.com/SilverFire)
- **Admin**: Fix prevent removing last grafana admin permissions [#11067](https://github.com/grafana/grafana/issues/11067), thx [@danielbh](https://github.com/danielbh)
- **Admin**: When multiple user invitations, all links are the same as the first user who was invited [#14483](https://github.com/grafana/grafana/issues/14483)
- **LDAP**: Upgrade go-ldap to v3 [#14548](https://github.com/grafana/grafana/issues/14548)
- **OAuth**: Support OAuth providers that are not RFC6749 compliant [#14562](https://github.com/grafana/grafana/issues/14562), thx [@tdabasinskas](https://github.com/tdabasinskas)
- **Proxy whitelist**: Add CIDR capability to auth_proxy whitelist [#14546](https://github.com/grafana/grafana/issues/14546), thx [@jacobrichard](https://github.com/jacobrichard)
- **Dashboard**: `Min width` changed to `Max per row` for repeating panels. This lets you specify the maximum number of panels to show per row and by that repeated panels will always take up full width of row [#12991](https://github.com/grafana/grafana/pull/12991), thx [@pgiraud](https://github.com/pgiraud)
- **Dashboard**: Retain decimal precision when exporting CSV [#13929](https://github.com/grafana/grafana/issues/13929), thx [@cinaglia](https://github.com/cinaglia)
- **Templating**: Escaping "Custom" template variables [#13754](https://github.com/grafana/grafana/issues/13754), thx [@IntegersOfK](https://github.com/IntegersOfK)
- **Templating**: Add percentencode formatting to variable interpolation to be used mainly for url escaping [#12764](https://github.com/grafana/grafana/issues/12764), thx [@cxcv](https://github.com/cxcv)
- **Units**: Add blood glucose level units mg/dL and mmol/L [#14519](https://github.com/grafana/grafana/issues/14519), thx [@kjedamzik](https://github.com/kjedamzik)
- **Units**: Add Floating Point Operations per Second units [#14558](https://github.com/grafana/grafana/pull/14558), thx [@hahnjo](https://github.com/hahnjo)
- **Table**: Renders epoch string as date if date column style [#14484](https://github.com/grafana/grafana/issues/14484)
- **Dataproxy**: Override incoming Authorization header [#13815](https://github.com/grafana/grafana/issues/13815), thx [@kornholi](https://github.com/kornholi)
- **Dataproxy**: Add global data source proxy timeout setting [#5699](https://github.com/grafana/grafana/issues/5699), thx [@RangerRick](https://github.com/RangerRick)
- **Database**: Support specifying database host using IPV6 for backend database and sql data sources [#13711](https://github.com/grafana/grafana/issues/13711), thx [@ellisvlad](https://github.com/ellisvlad)
- **Database**: Support defining additional database connection string args when using `url` property in database settings [#14709](https://github.com/grafana/grafana/pull/14709), thx [@tpetr](https://github.com/tpetr)
- **Stackdriver**: crossSeriesAggregation not being sent with the query [#15129](https://github.com/grafana/grafana/issues/15129), thx [@Legogris](https://github.com/Legogris)

### Bug fixes

- **Search**: Fix for issue with scrolling the "tags filter" dropdown, fixes [#14486](https://github.com/grafana/grafana/issues/14486)
- **Prometheus**: Query for annotation always uses 60s step regardless of dashboard range, fixes [#14795](https://github.com/grafana/grafana/issues/14795)
- **Annotations**: Fix creating annotation when graph panel has no data points position the popup outside viewport [#13765](https://github.com/grafana/grafana/issues/13765), thx [@banjeremy](https://github.com/banjeremy)
- **Piechart/Flot**: Fixes multiple piechart instances with donut bug [#15062](https://github.com/grafana/grafana/pull/15062)
- **Postgres**: Fix default port not added when port not configured [#15189](https://github.com/grafana/grafana/issues/15189)
- **Alerting**: Fixes crash bug when alert notifier folders are missing [#15295](https://github.com/grafana/grafana/issues/15295)
- **Dashboard**: Fix save provisioned dashboard modal [#15219](https://github.com/grafana/grafana/pull/15219)
- **Dashboard**: Fix having a long query in prometheus dashboard query editor blocks 30% of the query field when on OSX and having native scrollbars [#15122](https://github.com/grafana/grafana/issues/15122)
- **Explore**: Fix issue with wrapping on long queries [#15222](https://github.com/grafana/grafana/issues/15222)
- **Explore**: Fix cut & paste adds newline before and after selection [#15223](https://github.com/grafana/grafana/issues/15223)
- **Dataproxy**: Fix global data source proxy timeout not added to correct http client [#15258](https://github.com/grafana/grafana/issues/15258) [#5699](https://github.com/grafana/grafana/issues/5699)

### Breaking changes

- **Text Panel**: The text panel does no longer by default allow unsanitized HTML. [#4117](https://github.com/grafana/grafana/issues/4117). This means that if you have text panels with scripts tags they will no longer work as before. To enable unsafe javascript execution in text panels enable the settings `disable_sanitize_html` under the section `[panels]` in your Grafana ini file, or set env variable `GF_PANELS_DISABLE_SANITIZE_HTML=true`.
- **Dashboard**: Panel property `minSpan` replaced by `maxPerRow`. Dashboard migration will automatically migrate all dashboard panels using the `minSpan` property to the new `maxPerRow` property [#12991](https://github.com/grafana/grafana/pull/12991)

For older release notes, refer to the [CHANGELOG_ARCHIVE.md](https://github.com/grafana/grafana/blob/master/CHANGELOG_ARCHIVE.md)
