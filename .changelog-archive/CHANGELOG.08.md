<!-- 8.5.27 START -->

# 8.5.27 (2023-06-22)

### Bug fixes

- **Auth:** Fixed CVE-2023-3128. [#70576](https://github.com/grafana/grafana/issues/70576), [@zerok](https://github.com/zerok)

<!-- 8.5.27 END -->

<!-- 8.5.22 START -->

# 8.5.22 (2023-03-22)

<!-- 8.5.22 END -->

<!-- 8.5.21 START -->

# 8.5.21 (2023-02-28)

<!-- 8.5.21 END -->

<!-- 8.5.20 START -->

# 8.5.20 (2023-01-25)

### Features and enhancements

- **Chore:** Upgrade Go to 1.19.4 [v8.5.x]. [#60824](https://github.com/grafana/grafana/pull/60824), [@sakjur](https://github.com/sakjur)

<!-- 8.5.20 END -->

<!-- 8.5.15 START -->

# 8.5.15 (2022-11-08)

### Features and enhancements

- **Chore:** Upgrade Go to 1.19.2. [#56857](https://github.com/grafana/grafana/pull/56857), [@sakjur](https://github.com/sakjur)

<!-- 8.5.15 END -->

<!-- 8.5.14 START -->

# 8.5.14 (2022-10-11)

### Features and enhancements

- **Access Control:** Allow org admins to invite new users. [#55585](https://github.com/grafana/grafana/pull/55585), [@IevaVasiljeva](https://github.com/IevaVasiljeva)

<!-- 8.5.14 END -->

<!-- 8.5.13 START -->

# 8.5.13 (2022-09-20)

### Features and enhancements

- **Plugins:** Expose @emotion/react to plugins to prevent load failures. [#55297](https://github.com/grafana/grafana/pull/55297), [@jackw](https://github.com/jackw)

### Bug fixes

- **AuthNZ:** Security fixes for CVE-2022-35957 and CVE-2022-36062. [#55495](https://github.com/grafana/grafana/pull/55495), [@IevaVasiljeva](https://github.com/IevaVasiljeva)

<!-- 8.5.13 END -->

<!-- 8.5.11 START -->

# 8.5.11 (2022-08-30)

### Features and enhancements

- **Rendering:** Add support for renderer token (#54425). [#54438](https://github.com/grafana/grafana/pull/54438), [@joanlopez](https://github.com/joanlopez)
- **Alerting:** AlertingProxy to elevate permissions for request forwarded to data proxy when RBAC enabled. [#53681](https://github.com/grafana/grafana/pull/53681), [@yuri-tceretian](https://github.com/yuri-tceretian)

<!-- 8.5.11 END -->

<!-- 8.5.10 START -->

# 8.5.10 (2022-08-08)

### Bug fixes

- **RBAC:** Fix Anonymous Editors missing dashboard controls. [#52649](https://github.com/grafana/grafana/pull/52649), [@gamab](https://github.com/gamab)

<!-- 8.5.10 END -->

<!-- 8.5.9 START -->

# 8.5.9 (2022-07-14)

### Bug fixes

- **Security:** Fixes for CVE-2022-31107 and CVE-2022-31097. [#52238](https://github.com/grafana/grafana/pull/52238), [@xlson](https://github.com/xlson)

<!-- 8.5.9 END -->

<!-- 8.5.6 START -->

# 8.5.6 (2022-06-14)

### Bug fixes

- **Dashboard:** Fixes random scrolling on time range change. [#50379](https://github.com/grafana/grafana/pull/50379), [@torkelo](https://github.com/torkelo)
- **Security:** Fixes minor code scanning security warnings in old vendored javascript libs. [#50382](https://github.com/grafana/grafana/pull/50382), [@torkelo](https://github.com/torkelo)

<!-- 8.5.6 END -->

<!-- 8.5.5 START -->

# 8.5.5 (2022-06-06)

### Features and enhancements

- **Azure Monitor:** Include datasource ref when interpolating variables. [#49543](https://github.com/grafana/grafana/pull/49543), [@kevinwcyu](https://github.com/kevinwcyu)
- **CloudWatch:** Add multi-value template variable support for log group names in logs query builder. [#49737](https://github.com/grafana/grafana/pull/49737), [@kevinwcyu](https://github.com/kevinwcyu)
- **Cloudwatch:** Add template variable query function for listing log groups. [#50100](https://github.com/grafana/grafana/pull/50100), [@yaelleC](https://github.com/yaelleC)

### Bug fixes

- **Alerting:** Do not overwrite existing alert rule condition. [#49920](https://github.com/grafana/grafana/pull/49920), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Remove double quotes from matchers. [#50044](https://github.com/grafana/grafana/pull/50044), [@alexweav](https://github.com/alexweav)

<!-- 8.5.5 END -->

<!-- 8.5.4 START -->

# 8.5.4 (2022-05-30)

### Features and enhancements

- **Alerting:** Remove disabled flag for data source when migrating alerts. [#48559](https://github.com/grafana/grafana/pull/48559), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Show notification tab of legacy alerting only to editor. [#49624](https://github.com/grafana/grafana/pull/49624), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Update migration to migrate only alerts that belong to existing org\dashboard. [#49192](https://github.com/grafana/grafana/pull/49192), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **AzureMonitor:** Do not quote variables when a custom "All" variable option is used. [#49428](https://github.com/grafana/grafana/pull/49428), [@andresmgot](https://github.com/andresmgot)
- **AzureMonitor:** Update allowed namespaces. [#48468](https://github.com/grafana/grafana/pull/48468), [@jcolladokuri](https://github.com/jcolladokuri)
- **CloudMonitor:** Correctly encode default project response. [#49510](https://github.com/grafana/grafana/pull/49510), [@aangelisc](https://github.com/aangelisc)
- **Cloudwatch:** Add support for new AWS/RDS EBS\* metrics. [#48798](https://github.com/grafana/grafana/pull/48798), [@szymonpk](https://github.com/szymonpk)
- **InfluxDB:** Use backend for influxDB by default via feature toggle. [#48453](https://github.com/grafana/grafana/pull/48453), [@yesoreyeram](https://github.com/yesoreyeram)
- **Legend:** Use correct unit for percent and count calculations. [#49004](https://github.com/grafana/grafana/pull/49004), [@dprokop](https://github.com/dprokop)
- **LokI:** use millisecond steps in Grafana 8.5.x. [#48630](https://github.com/grafana/grafana/pull/48630), [@gabor](https://github.com/gabor)
- **Plugins:** Introduce HTTP 207 Multi Status response to api/ds/query. [#48550](https://github.com/grafana/grafana/pull/48550), [@wbrowne](https://github.com/wbrowne)
- **Reporting:** Improve PDF file size using grid layout. (Enterprise)
- **Transformations:** Add an All Unique Values Reducer. [#48653](https://github.com/grafana/grafana/pull/48653), [@josiahg](https://github.com/josiahg)
- **Transformers:** avoid error when the ExtractFields source field is missing. [#49368](https://github.com/grafana/grafana/pull/49368), [@wardbekker](https://github.com/wardbekker)
- **[v8.5.x] Alerting:** Update migration to migrate only alerts that belong to existing org\dashboard. [#49199](https://github.com/grafana/grafana/pull/49199), [@grafanabot](https://github.com/grafanabot)
- **[v8.5.x] Reporting:** Improve PDF file size using grid layout. (Enterprise)

### Bug fixes

- **Alerting:** Allow disabling override timings for notification policies. [#48648](https://github.com/grafana/grafana/pull/48648), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Allow serving images from custom url path. [#49022](https://github.com/grafana/grafana/pull/49022), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Apply Custom Headers to datasource queries. [#47860](https://github.com/grafana/grafana/pull/47860), [@joeblubaugh](https://github.com/joeblubaugh)
- **Alerting:** Fix RBAC actions for notification policies. [#49185](https://github.com/grafana/grafana/pull/49185), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Fix access to alerts for viewer with editor permissions when RBAC is disabled. [#49270](https://github.com/grafana/grafana/pull/49270), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Fix anonymous access to alerting. [#49203](https://github.com/grafana/grafana/pull/49203), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** correctly show all alerts in a folder. [#48684](https://github.com/grafana/grafana/pull/48684), [@gillesdemey](https://github.com/gillesdemey)
- **AzureMonitor:** Fixes metric definition for Azure Storage queue/file/blob/table resources. [#49101](https://github.com/grafana/grafana/pull/49101), [@aangelisc](https://github.com/aangelisc)
- **Dashboard:** Fix dashboard update permission check. [#48746](https://github.com/grafana/grafana/pull/48746), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **DashboardExport:** Fix exporting and importing dashboards where query data source ended up as incorrect. [#48410](https://github.com/grafana/grafana/pull/48410), [@torkelo](https://github.com/torkelo)
- **FileUpload:** clicking the `Upload file` button now opens the modal correctly. [#48766](https://github.com/grafana/grafana/pull/48766), [@ashharrison90](https://github.com/ashharrison90)
- **GrafanaUI:** Fix color of links in error Tooltips in light theme. [#49327](https://github.com/grafana/grafana/pull/49327), [@joshhunt](https://github.com/joshhunt)
- **LibraryPanels:** Fix library panels not connecting properly in imported dashboards. [#49161](https://github.com/grafana/grafana/pull/49161), [@joshhunt](https://github.com/joshhunt)
- **Loki:** Improve unpack parser handling. [#49074](https://github.com/grafana/grafana/pull/49074), [@gabor](https://github.com/gabor)
- **RolePicker:** Fix menu position on smaller screens. [#48429](https://github.com/grafana/grafana/pull/48429), [@Clarity-89](https://github.com/Clarity-89)
- **TimeRange:** Fixes updating time range from url and browser history. [#48657](https://github.com/grafana/grafana/pull/48657), [@torkelo](https://github.com/torkelo)
- **TimeSeries:** Fix detection & rendering of sparse datapoints. [#48841](https://github.com/grafana/grafana/pull/48841), [@leeoniya](https://github.com/leeoniya)
- **Timeseries:** Fix outside range stale state. [#49633](https://github.com/grafana/grafana/pull/49633), [@ryantxu](https://github.com/ryantxu)
- **Tooltip:** Fix links not legible in Tooltips when using light theme. [#48748](https://github.com/grafana/grafana/pull/48748), [@joshhunt](https://github.com/joshhunt)
- **Tooltip:** Sort decimals using standard numeric compare. [#49084](https://github.com/grafana/grafana/pull/49084), [@dprokop](https://github.com/dprokop)
- **Transforms:** Labels to fields, fix label picker layout. [#49304](https://github.com/grafana/grafana/pull/49304), [@torkelo](https://github.com/torkelo)
- **Variables:** Fixes issue with data source variables not updating queries with variable. [#49478](https://github.com/grafana/grafana/pull/49478), [@torkelo](https://github.com/torkelo)
- **[v8.5.x] Alerting:** Fix RBAC actions for notification policies (#49185). [#49348](https://github.com/grafana/grafana/pull/49348), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **[v8.5.x] Alerting:** Fix access to alerts for viewer with editor permissions when RBAC is disabled. [#49427](https://github.com/grafana/grafana/pull/49427), [@konrad147](https://github.com/konrad147)
- **[v8.5.x] Alerting:** Fix anonymous access to alerting. [#49268](https://github.com/grafana/grafana/pull/49268), [@yuri-tceretian](https://github.com/yuri-tceretian)

### Breaking changes

For a data source query made via /api/ds/query :

- If the `DatasourceQueryMultiStatus` feature is enabled and
  - The data source response has an error set as part of the `DataResponse`, the resulting HTTP status code is now `207 Multi Status` instead of `400 Bad gateway`
- If the `DatasourceQueryMultiStatus` feature is **not** enabled and
  - The data source response has an error set as part of the `DataResponse`, the resulting HTTP status code is `400 Bad Request` (no breaking change)
    --> Issue [#48550](https://github.com/grafana/grafana/issues/48550)

<!-- 8.5.4 END -->
<!-- 9.0.0-beta1 END -->
<!-- 8.5.26 START -->

# 8.5.26 (2023-05-22)

### Bugfixes

- **Alerting:** Require alert.notifications:write permissions to test receivers and templates

<!-- 8.5.26 END -->
<!-- 8.5.3 START -->

# 8.5.3

### Bug fixes

- **Security:** fixes CVE-2022-29170. [#49240](https://github.com/grafana/grafana/pull/49240), [@xlson](https://github.com/xlson)

<!-- 8.5.3 END -->
<!-- 8.5.2 START -->

# 8.5.2 (2022-05-03)

### Features and enhancements

- **Alerting:** Add safeguard for migrations that might cause dataloss. [#48526](https://github.com/grafana/grafana/pull/48526), [@JohnnyQQQQ](https://github.com/JohnnyQQQQ)
- **AzureMonitor:** Add support for not equals and startsWith operators when creating Azure Metrics dimension filters. [#48077](https://github.com/grafana/grafana/pull/48077), [@aangelisc](https://github.com/aangelisc)
- **Elasticsearch:** Add deprecation notice for < 7.10 versions. [#48506](https://github.com/grafana/grafana/pull/48506), [@ivanahuckova](https://github.com/ivanahuckova)
- **Traces:** Filter by service/span name and operation in Tempo and Jaeger. [#48209](https://github.com/grafana/grafana/pull/48209), [@joey-grafana](https://github.com/joey-grafana)

### Bug fixes

- **AzureAd Oauth:** Fix strictMode to reject users without an assigned role. [#48474](https://github.com/grafana/grafana/pull/48474), [@kyschouv](https://github.com/kyschouv)
- **CloudWatch:** Fix variable query tag migration. [#48587](https://github.com/grafana/grafana/pull/48587), [@iwysiu](https://github.com/iwysiu)
- **Plugins:** Ensure catching all appropriate 4xx api/ds/query scenarios. [#47565](https://github.com/grafana/grafana/pull/47565), [@wbrowne](https://github.com/wbrowne)

<!-- 8.5.2 END -->
<!-- 8.5.1 START -->

# 8.5.1 (2022-04-27)

### Bug fixes

- **Azure Monitor:** Fix space character encoding for metrics query link to Azure Portal. [#48139](https://github.com/grafana/grafana/pull/48139), [@kevinwcyu](https://github.com/kevinwcyu)
- **CloudWatch:** Prevent log groups from being removed on query change. [#47994](https://github.com/grafana/grafana/pull/47994), [@asimpson](https://github.com/asimpson)
- **Cloudwatch:** Fix template variables in variable queries. [#48140](https://github.com/grafana/grafana/pull/48140), [@iwysiu](https://github.com/iwysiu)
- **Explore:** Prevent direct access to explore if disabled via feature toggle. [#47714](https://github.com/grafana/grafana/pull/47714), [@Elfo404](https://github.com/Elfo404)
- **InfluxDB:** Fixes invalid no data alerts. [#48295](https://github.com/grafana/grafana/pull/48295), [@yesoreyeram](https://github.com/yesoreyeram)
- **Navigation:** Prevent navbar briefly showing on login. [#47968](https://github.com/grafana/grafana/pull/47968), [@ashharrison90](https://github.com/ashharrison90)
- **Plugins Catalog:** Fix styling of hyperlinks. [#48196](https://github.com/grafana/grafana/pull/48196), [@marefr](https://github.com/marefr)
- **Table:** Fix filter crashes table. [#48258](https://github.com/grafana/grafana/pull/48258), [@zoltanbedi](https://github.com/zoltanbedi)
- **TimeSeries:** Properly stack series with missing datapoints. [#48321](https://github.com/grafana/grafana/pull/48321), [@leeoniya](https://github.com/leeoniya)

<!-- 8.5.1 END -->
<!-- 8.5.0 START -->

# 8.5.0 (2022-04-21)

### Features and enhancements

- **Alerting:** Add contact points provisioning API. [#47197](https://github.com/grafana/grafana/pull/47197), [@JohnnyQQQQ](https://github.com/JohnnyQQQQ)
- **Alerting:** Add resolved count to notification title when both firing and resolved present. [#46697](https://github.com/grafana/grafana/pull/46697), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Alert rule should wait For duration when execution error state is Alerting. [#47052](https://github.com/grafana/grafana/pull/47052), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Classic conditions can now display multiple values. [#46971](https://github.com/grafana/grafana/pull/46971), [@gotjosh](https://github.com/gotjosh)
- **Alerting:** Display query from grafana-managed alert rules on `/api/v1/rules`. [#45969](https://github.com/grafana/grafana/pull/45969), [@gotjosh](https://github.com/gotjosh)
- **Alerting:** Enhance support for arbitrary group names in managed alerts. [#47785](https://github.com/grafana/grafana/pull/47785), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** add field for custom slack endpoint. [#45751](https://github.com/grafana/grafana/pull/45751), [@nathanrodman](https://github.com/nathanrodman)
- **Azure Monitor :** Adding json formatting of error messages in Panel Header Corner and Inspect Error Tab. [#44877](https://github.com/grafana/grafana/pull/44877), [@yaelleC](https://github.com/yaelleC)
- **Azure Monitor:** Add 2 more Curated Dashboards for VM Insights. [#45187](https://github.com/grafana/grafana/pull/45187), [@jcolladokuri](https://github.com/jcolladokuri)
- **CloudWatch:** Handle new error codes for MetricInsights. [#47033](https://github.com/grafana/grafana/pull/47033), [@Gabrielopesantos](https://github.com/Gabrielopesantos)
- **Dashboards:** show changes in save dialog. [#46557](https://github.com/grafana/grafana/pull/46557), [@ryantxu](https://github.com/ryantxu)
- **DataSource:** Default data source is no longer a persisted state but just the default data source for new panels. [#45132](https://github.com/grafana/grafana/pull/45132), [@torkelo](https://github.com/torkelo)
- **DataSourcePlugin API:** Allow queries import when changing data source type. [#47435](https://github.com/grafana/grafana/pull/47435), [@dprokop](https://github.com/dprokop)
- **Explore:** Remove return to panel button. [#45018](https://github.com/grafana/grafana/pull/45018), [@gelicia](https://github.com/gelicia)
- **Explore:** allow users to save Explore state to a new panel in a new dashboard. [#45148](https://github.com/grafana/grafana/pull/45148), [@Elfo404](https://github.com/Elfo404)
- **Instrumentation:** Proxy status code correction and various improvements. [#47473](https://github.com/grafana/grafana/pull/47473), [@marefr](https://github.com/marefr)
- **Logging:** Introduce feature toggle to activate gokit/log format. [#47336](https://github.com/grafana/grafana/pull/47336), [@ying-jeanne](https://github.com/ying-jeanne)
- **NewsPanel:** Add support for Atom feeds. [#45390](https://github.com/grafana/grafana/pull/45390), [@kaydelaney](https://github.com/kaydelaney)
- **Plugins:** Add deprecation notice for /api/tsdb/query endpoint. [#45238](https://github.com/grafana/grafana/pull/45238), [@wbrowne](https://github.com/wbrowne)
- **Plugins:** Adding support for traceID field to accept variables. [#45559](https://github.com/grafana/grafana/pull/45559), [@vinisdl](https://github.com/vinisdl)
- **PostgreSQL:** \_\_unixEpochGroup to support arithmetic expression as argument. [#46764](https://github.com/grafana/grafana/pull/46764), [@s0nik42](https://github.com/s0nik42)
- **Profile/Help:** Expose option to disable profile section and help menu. [#46308](https://github.com/grafana/grafana/pull/46308), [@cameronwaterman](https://github.com/cameronwaterman)
- **Prometheus:** Enable new visual query builder by default. [#46634](https://github.com/grafana/grafana/pull/46634), [@torkelo](https://github.com/torkelo)
- **SAML:** Allow disabling of SAML signups. [#47481](https://github.com/grafana/grafana/pull/47481), [@mmandrus](https://github.com/mmandrus)
- **SAML:** Allow disabling of SAML signups. (Enterprise)
- **Table:** New pagination option. [#45732](https://github.com/grafana/grafana/pull/45732), [@zoltanbedi](https://github.com/zoltanbedi)
- **TablePanel:** Add cell inspect option. [#45620](https://github.com/grafana/grafana/pull/45620), [@dprokop](https://github.com/dprokop)
- **Tempo / Trace Viewer:** Support Span Links in Trace Viewer. [#45632](https://github.com/grafana/grafana/pull/45632), [@Shachi16](https://github.com/Shachi16)
- **Tempo:** Download span references in data inspector. [#47074](https://github.com/grafana/grafana/pull/47074), [@connorlindsey](https://github.com/connorlindsey)
- **Tempo:** Separate trace to logs and loki search datasource config. [#46655](https://github.com/grafana/grafana/pull/46655), [@connorlindsey](https://github.com/connorlindsey)
- **Trace View:** Show number of child spans. [#44393](https://github.com/grafana/grafana/pull/44393), [@tharun208](https://github.com/tharun208)
- **Transformations:** Support escaped characters in key-value pair parsing. [#47901](https://github.com/grafana/grafana/pull/47901), [@aangelisc](https://github.com/aangelisc)

### Bug fixes

- **Azure Monitor:** Bug Fix for incorrect variable cascading for template variables. [#47478](https://github.com/grafana/grafana/pull/47478), [@jcolladokuri](https://github.com/jcolladokuri)
- **CloudWatch:** List all metrics properly in SQL autocomplete. [#45898](https://github.com/grafana/grafana/pull/45898), [@sunker](https://github.com/sunker)
- **CloudWatch:** Run query on blur in logs query field. [#47454](https://github.com/grafana/grafana/pull/47454), [@fridgepoet](https://github.com/fridgepoet)
- **Dashboard:** Template variables are now correctly persisted when clicking breadcrumb links. [#46790](https://github.com/grafana/grafana/pull/46790), [@ashharrison90](https://github.com/ashharrison90)
- **DashboardPage:** Remember scroll position when coming back panel edit / view panel. [#47639](https://github.com/grafana/grafana/pull/47639), [@torkelo](https://github.com/torkelo)
- **Panel Edit:** Options search now works correctly when a logarithmic scale option is set. [#47927](https://github.com/grafana/grafana/pull/47927), [@ashharrison90](https://github.com/ashharrison90)
- **Postgres:** Return tables with hyphenated schemes. [#45754](https://github.com/grafana/grafana/pull/45754), [@zuchka](https://github.com/zuchka)
- **Table panel:** Fix horizontal scrolling when pagination is enabled. [#47776](https://github.com/grafana/grafana/pull/47776), [@dprokop](https://github.com/dprokop)
- **Variables:** Ensure variables in query params are correctly recognised. [#47049](https://github.com/grafana/grafana/pull/47049), [@ashharrison90](https://github.com/ashharrison90)
- **Variables:** Fix crash when changing query variable datasource. [#44957](https://github.com/grafana/grafana/pull/44957), [@joshhunt](https://github.com/joshhunt)
- **Visualizations:** Stack negative-valued series downwards. [#47373](https://github.com/grafana/grafana/pull/47373), [@leeoniya](https://github.com/leeoniya)

### Breaking changes

For a proxied request, e.g. Grafana's datasource or plugin proxy:

- If the request is cancelled, e.g. from the browser/by the client, the HTTP status code is now `499 Client closed request` instead of `502 Bad gateway`
- If the request times out, e.g. takes longer time than allowed, the HTTP status code is now `504 Gateway timeout` instead of `502 Bad gateway`. Issue [#47473](https://github.com/grafana/grafana/issues/47473)

The change in behavior is that negative-valued series are now stacked downwards from 0 (in their own stacks), rather than downwards from the top of the positive stacks. We now automatically group stacks by Draw style, Line interpolation, and Bar alignment, making it impossible to stack bars on top of lines, or smooth lines on top of stepped lines. Issue [#47373](https://github.com/grafana/grafana/issues/47373)

The meaning of the default data source has now changed from being a persisted property in a panel. Before when you selected the default data source for a panel and later changed the default data source to another data source it would change all panels who were configured to use the default data source. From now on the default data source is just the default for new panels and changing the default will not impact any currently saved dashboards. Issue [#45132](https://github.com/grafana/grafana/issues/45132)

The Tooltip component provided by `@grafana/ui` is no longer automatically interactive (that is you can hover onto it and click a link or select text). It will from now on by default close automatically when you mouse out from the trigger element. To make tooltips behave like before set the new `interactive` property to true.
Issue [#45053](https://github.com/grafana/grafana/issues/45053)

### Deprecations

`/api/tsdb/query` API has been deprecated and will be removed in a future release. Use [/api/ds/query](https://grafana.com/docs/grafana/latest/http_api/data_source/#query-a-data-source) instead. Issue [#45238](https://github.com/grafana/grafana/issues/45238)

### Plugin development fixes & changes

- **Card:** Increase clickable area when meta items are present. [#47935](https://github.com/grafana/grafana/pull/47935), [@ashharrison90](https://github.com/ashharrison90)
- **Loki:** Fix operator description propup from being shortened. [#46575](https://github.com/grafana/grafana/pull/46575), [@glintik](https://github.com/glintik)
- **Tooltips:** Make tooltips non interactive by default. [#45053](https://github.com/grafana/grafana/pull/45053), [@torkelo](https://github.com/torkelo)

<!-- 8.5.0 END -->
<!-- 8.5.0-beta1 START -->

# 8.5.0-beta1 (2022-04-06)

### Features and enhancements

- Add config option to enable/disable reporting. (Enterprise)
- **Alerting:** Accurately set value for prom-compatible APIs. [#47216](https://github.com/grafana/grafana/pull/47216), [@gotjosh](https://github.com/gotjosh)
- **Alerting:** Provisioning API - Notification Policies. [#46755](https://github.com/grafana/grafana/pull/46755), [@alexweav](https://github.com/alexweav)
- **Alerting:** Notification URL points to alert view page instead of alert edit page. [#47752](https://github.com/grafana/grafana/pull/47752), [@joeblubaugh](https://github.com/joeblubaugh)
- **Analytics:** Enable grafana and plugin update checks to be operated independently. [#46352](https://github.com/grafana/grafana/pull/46352), [@wbrowne](https://github.com/wbrowne)
- **Azure Monitor:** Add support for multiple template variables in resource picker. [#46215](https://github.com/grafana/grafana/pull/46215), [@sarahzinger](https://github.com/sarahzinger)
- **Caching:** Add separate TTL for resources cache. (Enterprise)
- **Caching:** add support for TLS configuration for Redis Cluster. (Enterprise)
- **NewsPanel:** Remove Use Proxy option and update documentation with recommendations. [#47189](https://github.com/grafana/grafana/pull/47189), [@joshhunt](https://github.com/joshhunt)
- **OAuth:** Sync GitHub OAuth user name to Grafana if it's set. [#45438](https://github.com/grafana/grafana/pull/45438), [@pallxk](https://github.com/pallxk)

### Bug fixes

- **Plugins:** Fix Default Nav URL for dashboard includes. [#47143](https://github.com/grafana/grafana/pull/47143), [@wbrowne](https://github.com/wbrowne)

### Breaking changes

When user is using Github OAuth, GitHub login is showed as both Grafana login and name. Now the GitHub name is showed as Grafana name, and GitHub login is showed as Grafana Login. Issue [#45438](https://github.com/grafana/grafana/issues/45438)

The meaning of the default data source has now changed from being a persisted property in a panel. Before when you selected the default data source for a panel and later changed the default data source to another data source it would change all panels who were configured to use the default data source. From now on the default data source is just the default for new panels and changing the default will not impact any currently saved dashboards. Issue [#45132](https://github.com/grafana/grafana/issues/45132)

<!-- 8.4.11 START -->

# 8.4.11 (2022-08-30)

### Features and enhancements

- **Rendering:** Add support for renderer token (#54425). [#54437](https://github.com/grafana/grafana/pull/54437), [@joanlopez](https://github.com/joanlopez)

<!-- 8.4.11 END -->

<!-- 8.4.10 START -->

# 8.4.10 (2022-07-14)

### Bug fixes

- **Security:** Fixes for CVE-2022-31107 and CVE-2022-31097. [#52218](https://github.com/grafana/grafana/pull/52218), [@IevaVasiljeva](https://github.com/IevaVasiljeva)

<!-- 8.4.10 END -->

<!-- 8.4.7 START -->

# 8.4.7 (2022-04-19)

### Features and enhancements

- **CloudWatch:** Added missing MemoryDB Namespace metrics. [#47290](https://github.com/grafana/grafana/pull/47290), [@james-deee](https://github.com/james-deee)
- **Histogram Panel:** Take decimal into consideration. [#47330](https://github.com/grafana/grafana/pull/47330), [@mdvictor](https://github.com/mdvictor)
- **TimeSeries:** Sort tooltip values based on raw values. [#46738](https://github.com/grafana/grafana/pull/46738), [@dprokop](https://github.com/dprokop)

### Bug fixes

- **API:** Include userId, orgId, uname in request logging middleware. [#47183](https://github.com/grafana/grafana/pull/47183), [@marefr](https://github.com/marefr)
- **Elasticsearch:** Respect maxConcurrentShardRequests datasource setting. [#47120](https://github.com/grafana/grafana/pull/47120), [@alexandrst88](https://github.com/alexandrst88)

<!-- 8.4.7 END -->
<!-- 8.5.0-beta1 END -->
<!-- 8.4.6 START -->

# 8.4.6 (2022-04-12)

- **Security:** Fixes CVE-2022-24812. For more information, see our [blog](https://grafana.com/blog/2022/04/12/grafana-enterprise-8.4.6-released-with-high-severity-security-fix/)

<!-- 8.4.6 END -->
<!-- 8.4.5 START -->

# 8.4.5 (2022-03-31)

### Features and enhancements

- **Instrumentation:** Make backend plugin metrics endpoints available with optional authentication. [#46467](https://github.com/grafana/grafana/pull/46467), [@marefr](https://github.com/marefr)
- **Table panel:** Show datalinks for cell display modes JSON View and Gauge derivates. [#46020](https://github.com/grafana/grafana/pull/46020), [@mdvictor](https://github.com/mdvictor)

### Bug fixes

- **Azure Monitor:** Small bug fixes for Resource Picker. [#46665](https://github.com/grafana/grafana/pull/46665), [@sarahzinger](https://github.com/sarahzinger)
- **Logger:** Use specified format for file logger. [#46970](https://github.com/grafana/grafana/pull/46970), [@sakjur](https://github.com/sakjur)
- **Logs:** Handle missing fields in dataframes better. [#46963](https://github.com/grafana/grafana/pull/46963), [@gabor](https://github.com/gabor)
- **ManageDashboards:** Fix error when deleting all dashboards from folder view. [#46877](https://github.com/grafana/grafana/pull/46877), [@joshhunt](https://github.com/joshhunt)

<!-- 8.4.5 END -->
<!-- 8.4.4 START -->

# 8.4.4 (2022-03-16)

### Features and enhancements

- **Loki:** Add unpack to autocomplete suggestions (#44623). [#46573](https://github.com/grafana/grafana/pull/46573), [@glintik](https://github.com/glintik)
- **Plugins:** allow using both Function and Class components for app plugins. [#46148](https://github.com/grafana/grafana/pull/46148), [@leventebalogh](https://github.com/leventebalogh)
- **TimeSeries:** Add migration for Graph panel's transform series override. [#46577](https://github.com/grafana/grafana/pull/46577), [@dprokop](https://github.com/dprokop)
- **TimeSeries:** Preserve null/undefined values when performing negative y transform. [#46584](https://github.com/grafana/grafana/pull/46584), [@dprokop](https://github.com/dprokop)

### Bug fixes

- **CloudWatch:** Use default http client from aws-sdk-go. [#46370](https://github.com/grafana/grafana/pull/46370), [@sunker](https://github.com/sunker)
- **Dashboards:** Fixes repeating by row and no refresh. [#46565](https://github.com/grafana/grafana/pull/46565), [@torkelo](https://github.com/torkelo)
- **Gauge:** Fixes blank viz when data link exists and orientation was horizontal. [#46335](https://github.com/grafana/grafana/pull/46335), [@torkelo](https://github.com/torkelo)
- **Search:** sort results correctly when using postgres. [#46466](https://github.com/grafana/grafana/pull/46466), [@xlson](https://github.com/xlson)
- **TagsInput:** fix tags remove button accessibility issues. [#46254](https://github.com/grafana/grafana/pull/46254), [@Elfo404](https://github.com/Elfo404)
- **TextPanel:** Sanitize after markdown has been rendered to html. [#46166](https://github.com/grafana/grafana/pull/46166), [@ashharrison90](https://github.com/ashharrison90)

<!-- 8.4.4 END -->
<!-- 8.4.3 START -->

# 8.4.3 (2022-03-02)

### Features and enhancements

- **Alerting:** Grafana uses > instead of >= when checking the For duration. [#46010](https://github.com/grafana/grafana/issues/46010)
- **Alerting:** Use expanded labels in dashboard annotations. [#45726](https://github.com/grafana/grafana/pull/45726), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Logs:** Escape windows newline into single newline. [#45771](https://github.com/grafana/grafana/pull/45771), [@perosb](https://github.com/perosb)

### Bug fixes

- **Alerting:** Fix use of > instead of >= when checking the For duration. [#46011](https://github.com/grafana/grafana/pull/46011), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Azure Monitor:** Fixes broken log queries that use workspace. [#45820](https://github.com/grafana/grafana/pull/45820), [@sunker](https://github.com/sunker)
- **CloudWatch:** Remove error message when using multi-valued template vars in region field. [#45886](https://github.com/grafana/grafana/pull/45886), [@sunker](https://github.com/sunker)
- **Middleware:** Fix IPv6 host parsing in CSRF check. [#45911](https://github.com/grafana/grafana/pull/45911), [@ying-jeanne](https://github.com/ying-jeanne)

### Plugin development fixes & changes

- **ClipboardButton:** Use a fallback when the Clipboard API is unavailable. [#45831](https://github.com/grafana/grafana/pull/45831), [@ashharrison90](https://github.com/ashharrison90)

<!-- 8.4.3 END -->
<!-- 8.4.2 START -->

# 8.4.2 (2022-02-23)

### Features and enhancements

- **OAuth:** Add setting to skip org assignment for external users. [#34834](https://github.com/grafana/grafana/pull/34834), [@baez90](https://github.com/baez90)
- **Tracing:** Add option to map tag names to log label names in trace to logs settings. [#45178](https://github.com/grafana/grafana/pull/45178), [@connorlindsey](https://github.com/connorlindsey)

### Bug fixes

- **Explore:** Fix closing split pane when logs panel is used. [#45602](https://github.com/grafana/grafana/pull/45602), [@ifrost](https://github.com/ifrost)

<!-- 8.4.2 END -->
<!-- 8.4.1 START -->

# 8.4.1 (2022-02-18)

### Features and enhancements

- **Cloudwatch:** Add support for AWS/PrivateLink\* metrics and dimensions. [#45515](https://github.com/grafana/grafana/pull/45515), [@szymonpk](https://github.com/szymonpk)
- **Configuration:** Add ability to customize okta login button name and icon. [#44079](https://github.com/grafana/grafana/pull/44079), [@DanCech](https://github.com/DanCech)
- **Tempo:** Switch out Select with AsyncSelect component to get loading state in Tempo Search. [#45110](https://github.com/grafana/grafana/pull/45110), [@CatPerry](https://github.com/CatPerry)

### Bug fixes

- **Alerting:** Fix migrations by making send_alerts_to field nullable. [#45572](https://github.com/grafana/grafana/pull/45572), [@santihernandezc](https://github.com/santihernandezc)

<!-- 8.4.1 END -->
<!-- 8.4.0 START -->

# 8.4.0 (2022-02-16)

### Features and enhancements

- **API:** Extract OpenAPI specification from source code using go-swagger. [#40528](https://github.com/grafana/grafana/pull/40528), [@papagian](https://github.com/papagian)
- **AccessControl:** Disable user remove and user update roles when they do not have the permissions. [#43429](https://github.com/grafana/grafana/pull/43429), [@Jguer](https://github.com/Jguer)
- **AccessControl:** Provisioning for teams. [#43767](https://github.com/grafana/grafana/pull/43767), [@gamab](https://github.com/gamab)
- **API:** Add usage stats preview endpoint. [#43899](https://github.com/grafana/grafana/pull/43899), [@Jguer](https://github.com/Jguer)
- **Alerting:** Move slow queries in the scheduler to another goroutine. [#44423](https://github.com/grafana/grafana/pull/44423), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Use time.Ticker instead of alerting.Ticker in ngalert. [#44395](https://github.com/grafana/grafana/pull/44395), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** add custom grouping to Alert Panel. [#44559](https://github.com/grafana/grafana/pull/44559), [@gillesdemey](https://github.com/gillesdemey)
- **Analytics:** Add user id tracking to google analytics. [#42763](https://github.com/grafana/grafana/pull/42763), [@autoric](https://github.com/autoric)
- **Angular:** Add AngularJS plugin support deprecation plan to docs site. [#45149](https://github.com/grafana/grafana/pull/45149), [@torkelo](https://github.com/torkelo)
- **Auth:** implement auto_sign_up for auth.jwt. [#43502](https://github.com/grafana/grafana/pull/43502), [@sakjur](https://github.com/sakjur)
- **Azure Monitor Logs:** Order subscriptions in resource picker by name. [#45228](https://github.com/grafana/grafana/pull/45228), [@sunker](https://github.com/sunker)
- **Azure monitor Logs:** Optimize data fetching in resource picker. [#44549](https://github.com/grafana/grafana/pull/44549), [@sunker](https://github.com/sunker)
- **AzureMonitor:** Filter list of resources by resourceType. [#43522](https://github.com/grafana/grafana/pull/43522), [@andresmgot](https://github.com/andresmgot)
- **BarChart:** color by field, x time field, bar radius, label skipping. [#43257](https://github.com/grafana/grafana/pull/43257), [@leeoniya](https://github.com/leeoniya)
- **Chore:** Implement OpenTelemetry in Grafana. [#42674](https://github.com/grafana/grafana/pull/42674), [@idafurjes](https://github.com/idafurjes)
- **Cloud Monitoring:** Adds metric type to Metric drop down options. [#43268](https://github.com/grafana/grafana/pull/43268), [@tw1nk](https://github.com/tw1nk)
- **CloudWatch:** Add Data Lifecycle Manager metrics and dimension. [#43310](https://github.com/grafana/grafana/pull/43310), [@ilyastoli](https://github.com/ilyastoli)
- **CloudWatch:** Add Missing Elasticache Host-level metrics. [#43455](https://github.com/grafana/grafana/pull/43455), [@dhendo](https://github.com/dhendo)
- **CloudWatch:** Add all ElastiCache Redis Metrics. [#43336](https://github.com/grafana/grafana/pull/43336), [@siavashs](https://github.com/siavashs)
- **CloudWatch:** Add new AWS/ES metrics. [#43034](https://github.com/grafana/grafana/pull/43034), [@sunker](https://github.com/sunker)
- **Cloudwatch:** Add syntax highlighting and autocomplete for "Metric Search". [#43985](https://github.com/grafana/grafana/pull/43985), [@sarahzinger](https://github.com/sarahzinger)
- **Explore:** Support custom display label for exemplar links for Prometheus datasource. [#42732](https://github.com/grafana/grafana/pull/42732), [@JokerQueue](https://github.com/JokerQueue)
- **Hotkeys:** Make time range absolute/permanent. [#43802](https://github.com/grafana/grafana/pull/43802), [@davkal](https://github.com/davkal)
- **Playlists:** Enable sharing direct links to playlists. [#44161](https://github.com/grafana/grafana/pull/44161), [@ashharrison90](https://github.com/ashharrison90)
- **SQLStore:** Prevent concurrent migrations. [#44101](https://github.com/grafana/grafana/pull/44101), [@papagian](https://github.com/papagian)
- **SSE:** Add Mode to drop NaN/Inf/Null in Reduction operations. [#43583](https://github.com/grafana/grafana/pull/43583), [@kylebrandt](https://github.com/kylebrandt)
- **Setting:** Support configuring feature toggles with bools instead of just passing an array. [#43326](https://github.com/grafana/grafana/pull/43326), [@bergquist](https://github.com/bergquist)
- **TimeSeries:** Add support for negative Y and constant transform. [#44774](https://github.com/grafana/grafana/pull/44774), [@dprokop](https://github.com/dprokop)
- **Transformations:** Add 'JSON' field type to ConvertFieldTypeTransformer. [#42624](https://github.com/grafana/grafana/pull/42624), [@sd2k](https://github.com/sd2k)

### Bug fixes

- **Auth:** Guarantee consistency of signed SigV4 headers. [#45054](https://github.com/grafana/grafana/pull/45054), [@wbrowne](https://github.com/wbrowne)
- **CloudWatch:** Fix MetricName resetting on Namespace change. [#44165](https://github.com/grafana/grafana/pull/44165), [@yaelleC](https://github.com/yaelleC)
- **Cloudwatch :** Fixed resetting metric name when changing namespace in Metric Query. [#44612](https://github.com/grafana/grafana/pull/44612), [@yaelleC](https://github.com/yaelleC)
- **Explore:** Avoid locking timepicker when range is inverted. [#44790](https://github.com/grafana/grafana/pull/44790), [@Elfo404](https://github.com/Elfo404)
- **Instrumentation:** Fix HTTP request instrumentation of authentication failures. [#44234](https://github.com/grafana/grafana/pull/44234), [@marefr](https://github.com/marefr)
- **LibraryPanels:** Prevent long descriptions and names from obscuring the delete button. [#45190](https://github.com/grafana/grafana/pull/45190), [@zuchka](https://github.com/zuchka)
- **OAuth:** Fix parsing of ID token if header contains non-string value. [#44159](https://github.com/grafana/grafana/pull/44159), [@marefr](https://github.com/marefr)
- **Panel Edit:** Visualization search now works correctly with special characters. [#45137](https://github.com/grafana/grafana/pull/45137), [@ashharrison90](https://github.com/ashharrison90)
- **Provisioning:** Fix duplicate validation when multiple organizations have been configured. [#44151](https://github.com/grafana/grafana/pull/44151), [@marefr](https://github.com/marefr)
- **QueryField:** Fix issue with undo history when suggestion is inserted (#28656). [#39114](https://github.com/grafana/grafana/pull/39114), [@glintik](https://github.com/glintik)
- **TablePanel:** Do not prefix columns with frame name if multiple frames and override active. [#45174](https://github.com/grafana/grafana/pull/45174), [@mdvictor](https://github.com/mdvictor)

### Deprecations

AngularJS plugin support is now in a deprecated state, meaning it will be removed in a future release. Currently, that is planned for version 10 (in 2023). The documentation site has an [article](https://grafana.com/docs/grafana/next/developers/angular_deprecation/) with more details on why, when, and how. Issue [#45149](https://github.com/grafana/grafana/issues/45149)

<!-- 8.4.0 END -->
<!-- 8.4.0-beta1 START -->

# 8.4.0-beta1 (2022-02-02)

### Features and enhancements

- **Alerting:** Support WeCom as a contact point type. [#40975](https://github.com/grafana/grafana/pull/40975), [@smallpath](https://github.com/smallpath)
- **Alerting:** UI for mute timings. [#41578](https://github.com/grafana/grafana/pull/41578), [@nathanrodman](https://github.com/nathanrodman)
- **Alerting:** add settings for peer reconnection in HA mode. [#42300](https://github.com/grafana/grafana/pull/42300), [@JohnnyQQQQ](https://github.com/JohnnyQQQQ)
- **Auth:** implement auto_sign_up for auth.jwt. [#37040](https://github.com/grafana/grafana/pull/37040), [@Roguelazer](https://github.com/Roguelazer)
- **Dashboard:** Add Show unknown variables toggle to dashboard settings. [#41854](https://github.com/grafana/grafana/pull/41854), [@hugohaggmark](https://github.com/hugohaggmark)
- **Instrumentation:** Logger migration from log15 to gokit/log. [#41636](https://github.com/grafana/grafana/pull/41636), [@ying-jeanne](https://github.com/ying-jeanne)
- **MSSQL:** Change regex to validate Provider connection string. [#40248](https://github.com/grafana/grafana/pull/40248), [@ianselmi](https://github.com/ianselmi)
- **MSSQL:** Configuration of certificate verification for TLS connection. [#31865](https://github.com/grafana/grafana/pull/31865), [@mortenaa](https://github.com/mortenaa)
- **Middleware:** Don't require HTTPS for HSTS headers to be emitted. [#35147](https://github.com/grafana/grafana/pull/35147), [@alexmv](https://github.com/alexmv)
- **Navigation:** Implement Keyboard Navigation. [#41618](https://github.com/grafana/grafana/pull/41618), [@axelavargas](https://github.com/axelavargas)
- **News:** Reload feed when changing the time range or refreshing. [#42217](https://github.com/grafana/grafana/pull/42217), [@ashharrison90](https://github.com/ashharrison90)
- **UI/Plot:** Implement keyboard controls for plot cursor. [#42244](https://github.com/grafana/grafana/pull/42244), [@kaydelaney](https://github.com/kaydelaney)

<!-- 8.4.0-beta1 END -->

<!-- 8.3.11 START -->

# 8.3.11 (2022-08-30)

### Features and enhancements

- **Rendering:** Add support for renderer token (#54425). [#54436](https://github.com/grafana/grafana/pull/54436), [@joanlopez](https://github.com/joanlopez)

<!-- 8.3.11 END -->

<!-- 8.3.7 START -->

# 8.3.7 (2022-03-01)

### Bug fixes

- **Provisioning:** Ensure that the default value for orgID is set when provisioning datasources to be deleted. [#44244](https://github.com/grafana/grafana/pull/44244), [@filewalkwithme](https://github.com/filewalkwithme)

<!-- 8.3.7 END -->

<!-- 8.3.6 START -->

# 8.3.6 (2022-02-09)

### Features and enhancements

- **Cloud Monitoring:** Reduce request size when listing labels. [#44365](https://github.com/grafana/grafana/pull/44365), [@mtanda](https://github.com/mtanda)
- **Explore:** Show scalar data result in a table instead of graph. [#44362](https://github.com/grafana/grafana/pull/44362), [@tharun208](https://github.com/tharun208)
- **Snapshots:** Updates the default external snapshot server URL. [#44563](https://github.com/grafana/grafana/pull/44563), [@DanCech](https://github.com/DanCech)
- **Table:** Makes footer not overlap table content. [#44210](https://github.com/grafana/grafana/pull/44210), [@dprokop](https://github.com/dprokop)
- **Tempo:** Add request histogram to service graph datalink. [#44671](https://github.com/grafana/grafana/pull/44671), [@connorlindsey](https://github.com/connorlindsey)
- **Tempo:** Add time range to tempo search query behind a feature flag. [#43811](https://github.com/grafana/grafana/pull/43811), [@connorlindsey](https://github.com/connorlindsey)
- **Tempo:** Auto-clear results when changing query type. [#44390](https://github.com/grafana/grafana/pull/44390), [@connorlindsey](https://github.com/connorlindsey)
- **Tempo:** Display start time in search results as relative time. [#44568](https://github.com/grafana/grafana/pull/44568), [@tharun208](https://github.com/tharun208)

### Bug fixes

- **CloudMonitoring:** Fix resource labels in query editor. [#44550](https://github.com/grafana/grafana/pull/44550), [@iwysiu](https://github.com/iwysiu)
- **Cursor sync:** Apply the settings without saving the dashboard. [#44270](https://github.com/grafana/grafana/pull/44270), [@dprokop](https://github.com/dprokop)
- **LibraryPanels:** Fix for Error while cleaning library panels. [#45033](https://github.com/grafana/grafana/pull/45033), [@hugohaggmark](https://github.com/hugohaggmark)
- **Logs Panel:** fix timestamp parsing for string dates without timezone. [#44664](https://github.com/grafana/grafana/pull/44664), [@Elfo404](https://github.com/Elfo404)
- **Prometheus:** Fix some of the alerting queries that use reduce/math operation. [#44380](https://github.com/grafana/grafana/pull/44380), [@ivanahuckova](https://github.com/ivanahuckova)
- **TablePanel:** Fix ad-hoc variables not working on default datasources. [#44314](https://github.com/grafana/grafana/pull/44314), [@joshhunt](https://github.com/joshhunt)
- **Text Panel:** Fix alignment of elements. [#44313](https://github.com/grafana/grafana/pull/44313), [@ashharrison90](https://github.com/ashharrison90)
- **Variables:** Fix for constant variables in self referencing links. [#44631](https://github.com/grafana/grafana/pull/44631), [@hugohaggmark](https://github.com/hugohaggmark)

<!-- 8.3.6 END -->
<!-- 8.3.5 START -->

# 8.3.5 (2022-02-08)

- **Security**: Fixes CVE-2022-21702. For more information, see our [blog](https://grafana.com/blog/2022/02/08/grafana-7.5.15-and-8.3.5-released-with-moderate-severity-security-fixes/)
- **Security**: Fixes CVE-2022-21703. For more information, see our [blog](https://grafana.com/blog/2022/02/08/grafana-7.5.15-and-8.3.5-released-with-moderate-severity-security-fixes/)
- **Security**: Fixes CVE-2022-21713. For more information, see our [blog](https://grafana.com/blog/2022/02/08/grafana-7.5.15-and-8.3.5-released-with-moderate-severity-security-fixes/)

<!-- 8.3.5 END -->
<!-- 8.3.4 START -->

# 8.3.4 (2022-01-17)

### Features and enhancements

- **Alerting:** Allow configuration of non-ready alertmanagers. [#43063](https://github.com/grafana/grafana/pull/43063), [@alexweav](https://github.com/alexweav)
- **Alerting:** Allow customization of Google chat message. [#43568](https://github.com/grafana/grafana/pull/43568), [@alexweav](https://github.com/alexweav)
- **Alerting:** Allow customization of Google chat message (#43568). [#43723](https://github.com/grafana/grafana/pull/43723), [@alexweav](https://github.com/alexweav)
- **AppPlugins:** Support app plugins with only default nav. [#43016](https://github.com/grafana/grafana/pull/43016), [@torkelo](https://github.com/torkelo)
- **InfluxDB:** InfluxQL: query editor: skip fields in metadata queries. [#42543](https://github.com/grafana/grafana/pull/42543), [@gabor](https://github.com/gabor)
- **Postgres/MySQL/MSSQL:** Cancel in-flight SQL query if user cancels query in grafana. [#43890](https://github.com/grafana/grafana/pull/43890), [@mdvictor](https://github.com/mdvictor)
- **Prometheus:** Forward oauth tokens after prometheus datasource migration. [#43686](https://github.com/grafana/grafana/pull/43686), [@MasslessParticle](https://github.com/MasslessParticle)

### Bug fixes

- **Azure Monitor:** Bug fix for variable interpolations in metrics dropdowns. [#43251](https://github.com/grafana/grafana/pull/43251), [@sarahzinger](https://github.com/sarahzinger)
- **Azure Monitor:** Improved error messages for variable queries. [#43213](https://github.com/grafana/grafana/pull/43213), [@sunker](https://github.com/sunker)
- **CloudMonitoring:** Fixes broken variable queries that use group bys. [#43914](https://github.com/grafana/grafana/pull/43914), [@sunker](https://github.com/sunker)
- **Configuration:** You can now see your expired API keys if you have no active ones. [#42452](https://github.com/grafana/grafana/pull/42452), [@ashharrison90](https://github.com/ashharrison90)
- **Elasticsearch:** Fix handling multiple datalinks for a single field. [#44029](https://github.com/grafana/grafana/pull/44029), [@Elfo404](https://github.com/Elfo404)
- **Export:** Fix error being thrown when exporting dashboards using query variables that reference the default datasource. [#44034](https://github.com/grafana/grafana/pull/44034), [@ashharrison90](https://github.com/ashharrison90)
- **ImportDashboard:** Fixes issue with importing dashboard and name ending up in uid. [#43451](https://github.com/grafana/grafana/pull/43451), [@torkelo](https://github.com/torkelo)
- **Login:** Page no longer overflows on mobile. [#43739](https://github.com/grafana/grafana/pull/43739), [@ashharrison90](https://github.com/ashharrison90)
- **Plugins:** Set backend metadata property for core plugins. [#43349](https://github.com/grafana/grafana/pull/43349), [@marefr](https://github.com/marefr)
- **Prometheus:** Fill missing steps with null values. [#43622](https://github.com/grafana/grafana/pull/43622), [@ivanahuckova](https://github.com/ivanahuckova)
- **Prometheus:** Fix interpolation of \$\_\_rate_interval variable. [#44035](https://github.com/grafana/grafana/pull/44035), [@ivanahuckova](https://github.com/ivanahuckova)
- **Prometheus:** Interpolate variables with curly brackets syntax. [#42927](https://github.com/grafana/grafana/pull/42927), [@ivanahuckova](https://github.com/ivanahuckova)
- **Prometheus:** Respect the http-method data source setting. [#42753](https://github.com/grafana/grafana/pull/42753), [@gabor](https://github.com/gabor)
- **Table:** Fixes issue with field config applied to wrong fields when hiding columns. [#43376](https://github.com/grafana/grafana/pull/43376), [@torkelo](https://github.com/torkelo)
- **Toolkit:** Fix bug with rootUrls not being properly parsed when signing a private plugin. [#43014](https://github.com/grafana/grafana/pull/43014), [@dessen-xu](https://github.com/dessen-xu)
- **Variables:** Fix so data source variables are added to adhoc configuration. [#43881](https://github.com/grafana/grafana/pull/43881), [@hugohaggmark](https://github.com/hugohaggmark)

### Plugin development fixes & changes

- **Toolkit:** Revert build config so tslib is bundled with plugins to prevent plugins from crashing. [#43556](https://github.com/grafana/grafana/pull/43556), [@mckn](https://github.com/mckn)

<!-- 8.3.4 END -->
<!-- 8.3.3 START -->

# 8.3.3 (2021-12-10)

### Features and enhancements

- **BarChart:** Use new data error view component to show actions in panel edit. [#42474](https://github.com/grafana/grafana/pull/42474), [@torkelo](https://github.com/torkelo)
- **CloudMonitor:** Iterate over pageToken for resources. [#42546](https://github.com/grafana/grafana/pull/42546), [@iwysiu](https://github.com/iwysiu)
- **Macaron:** Prevent WriteHeader invalid HTTP status code panic. [#42973](https://github.com/grafana/grafana/pull/42973), [@bergquist](https://github.com/bergquist)

### Bug fixes

- **AnnoListPanel:** Fix interpolation of variables in tags. [#42318](https://github.com/grafana/grafana/pull/42318), [@francoisdtm](https://github.com/francoisdtm)
- **CloudWatch:** Allow queries to have no dimensions specified. [#42800](https://github.com/grafana/grafana/pull/42800), [@sunker](https://github.com/sunker)
- **CloudWatch:** Fix broken queries for users migrating from 8.2.4/8.2.5 to 8.3.0. [#42611](https://github.com/grafana/grafana/pull/42611), [@sunker](https://github.com/sunker)
- **CloudWatch:** Make sure MatchExact flag gets the right value. [#42621](https://github.com/grafana/grafana/pull/42621), [@sunker](https://github.com/sunker)
- **Dashboards:** Fix so that empty folders can be deleted from the manage dashboards/folders page. [#42527](https://github.com/grafana/grafana/pull/42527), [@ashharrison90](https://github.com/ashharrison90)
- **InfluxDB:** Improve handling of metadata query errors in InfluxQL. [#42500](https://github.com/grafana/grafana/pull/42500), [@gabor](https://github.com/gabor)
- **Loki:** Fix adding of ad hoc filters for queries with parser and line_format expressions. [#42590](https://github.com/grafana/grafana/pull/42590), [@ivanahuckova](https://github.com/ivanahuckova)
- **Prometheus:** Fix running of exemplar queries for non-histogram metrics. [#42749](https://github.com/grafana/grafana/pull/42749), [@ivanahuckova](https://github.com/ivanahuckova)
- **Prometheus:** Interpolate template variables in interval. [#42637](https://github.com/grafana/grafana/pull/42637), [@ivanahuckova](https://github.com/ivanahuckova)
- **StateTimeline:** Fix toolitp not showing when for frames with multiple fields. [#42741](https://github.com/grafana/grafana/pull/42741), [@dprokop](https://github.com/dprokop)
- **TraceView:** Fix virtualized scrolling when trace view is opened in right pane in Explore. [#42480](https://github.com/grafana/grafana/pull/42480), [@autoric](https://github.com/autoric)
- **Variables:** Fix repeating panels for on time range changed variables. [#42828](https://github.com/grafana/grafana/pull/42828), [@hugohaggmark](https://github.com/hugohaggmark)
- **Variables:** Fix so queryparam option works for scoped variables. [#42742](https://github.com/grafana/grafana/pull/42742), [@hugohaggmark](https://github.com/hugohaggmark)

<!-- 8.3.3 END -->
<!-- 8.3.2 START -->

# 8.3.2 (2021-12-10)

- **Security**: Fixes CVE-2021-43813 and CVE-2021-43815. For more information, see our [blog](https://grafana.com/blog/2021/12/10/grafana-8.3.2-and-7.5.12-released-with-moderate-severity-security-fix/

<!-- 8.3.2 END -->

<!-- 8.3.1 START -->

# 8.3.1 (2021-12-07)

- **Security**: Fixes CVE-2021-43798. For more information, see our [blog](https://grafana.com/blog/2021/12/07/grafana-8.3.1-8.2.7-8.1.8-and-8.0.7-released-with-high-severity-security-fix/)

<!-- 8.3.1 END -->

<!-- 8.3.0 START -->

# 8.3.0 (2021-11-30)

### Features and enhancements

- **Alerting:** Prevent folders from being deleted when they contain alerts. [#42307](https://github.com/grafana/grafana/pull/42307), [@peterholmberg](https://github.com/peterholmberg)
- **Alerting:** Show full preview value in tooltip. [#42445](https://github.com/grafana/grafana/pull/42445), [@peterholmberg](https://github.com/peterholmberg)
- **BarGauge:** Limit title width when name is really long. [#42346](https://github.com/grafana/grafana/pull/42346), [@torkelo](https://github.com/torkelo)
- **CloudMonitoring:** Avoid to escape regexps in filters. [#41961](https://github.com/grafana/grafana/pull/41961), [@andresmgot](https://github.com/andresmgot)
- **CloudWatch:** Add support for AWS Metric Insights. [#42487](https://github.com/grafana/grafana/pull/42487), [@sunker](https://github.com/sunker)
- **TooltipPlugin:** Remove other panels' shared tooltip in edit panel. [#42187](https://github.com/grafana/grafana/pull/42187), [@mdvictor](https://github.com/mdvictor)
- **Visualizations:** Limit y label width to 40% of visualization width. [#42350](https://github.com/grafana/grafana/pull/42350), [@torkelo](https://github.com/torkelo)

### Bug fixes

- **Alerting:** Clear alerting rule evaluation errors after intermittent failures. [#42386](https://github.com/grafana/grafana/pull/42386), [@gotjosh](https://github.com/gotjosh)
- **Alerting:** Fix refresh on legacy Alert List panel. [#42322](https://github.com/grafana/grafana/pull/42322), [@peterholmberg](https://github.com/peterholmberg)
- **Dashboard:** Fix queries for panels with non-integer widths. [#42420](https://github.com/grafana/grafana/pull/42420), [@gabor](https://github.com/gabor)
- **Explore:** Fix url update inconsistency. [#42288](https://github.com/grafana/grafana/pull/42288), [@gabor](https://github.com/gabor)
- **Prometheus:** Fix range variables interpolation for time ranges smaller than 1 second. [#42242](https://github.com/grafana/grafana/pull/42242), [@ivanahuckova](https://github.com/ivanahuckova)
- **ValueMappings:** Fixes issue with regex value mapping that only sets color. [#42311](https://github.com/grafana/grafana/pull/42311), [@torkelo](https://github.com/torkelo)

<!-- 8.3.0 END -->
<!-- 8.3.0-beta2 START -->

# 8.3.0-beta2 (2021-11-25)

### Features and enhancements

- **Alerting:** Create DatasourceError alert if evaluation returns error. [#41869](https://github.com/grafana/grafana/pull/41869), [@gerobinson](https://github.com/gerobinson)
- **Alerting:** Make Unified Alerting enabled by default for those who do not use legacy alerting. [#42200](https://github.com/grafana/grafana/pull/42200), [@armandgrillet](https://github.com/armandgrillet)
- **Alerting:** Support mute timings configuration through the api for the embedded alert manager. [#41533](https://github.com/grafana/grafana/pull/41533), [@JohnnyQQQQ](https://github.com/JohnnyQQQQ)
- **CloudWatch:** Add missing AWS/Events metrics. [#42164](https://github.com/grafana/grafana/pull/42164), [@n2N8Z](https://github.com/n2N8Z)
- **Docs:** Add easier to find deprecation notices to certain data sources and to the changelog. [#41938](https://github.com/grafana/grafana/pull/41938), [@gabor](https://github.com/gabor)
- **Plugins Catalog:** Enable install controls based on the pluginAdminEnabled flag. [#41686](https://github.com/grafana/grafana/pull/41686), [@leventebalogh](https://github.com/leventebalogh)
- **Query caching:** Increase max_value_mb default to 10. (Enterprise)
- **Table:** Add space between values for the DefaultCell. [#42246](https://github.com/grafana/grafana/pull/42246), [@kirederik](https://github.com/kirederik)
- **Table:** Add space between values on JSONViewCell. [#42156](https://github.com/grafana/grafana/pull/42156), [@kirederik](https://github.com/kirederik)
- **Tracing:** Make query editors available in dashboard for Tempo and Zipkin. [#41974](https://github.com/grafana/grafana/pull/41974), [@ivanahuckova](https://github.com/ivanahuckova)

### Bug fixes

- **AccessControl:** Renamed `orgs` roles, removed `fixed:orgs:reader` introduced in beta1. [#42049](https://github.com/grafana/grafana/pull/42049), [@gamab](https://github.com/gamab)
- **Azure Monitor:** Add trap focus for modals in grafana/ui and other small a11y fixes for Azure Monitor. [#41449](https://github.com/grafana/grafana/pull/41449), [@sarahzinger](https://github.com/sarahzinger)
- **CodeEditor:** Prevent suggestions from being clipped. [#42120](https://github.com/grafana/grafana/pull/42120), [@kaydelaney](https://github.com/kaydelaney)
- **Dashboard:** Fix cache timeout persistence. [#42204](https://github.com/grafana/grafana/pull/42204), [@hugohaggmark](https://github.com/hugohaggmark)
- **Datasource:** Fix stable sort order of query responses. [#41868](https://github.com/grafana/grafana/pull/41868), [@marefr](https://github.com/marefr)
- **Explore:** Fix error in query history when removing last item. [#42179](https://github.com/grafana/grafana/pull/42179), [@gabor](https://github.com/gabor)
- **Logs:** Fix requesting of older logs when flipped order. [#41966](https://github.com/grafana/grafana/pull/41966), [@ivanahuckova](https://github.com/ivanahuckova)
- **Prometheus:** Fix running of health check query based on access mode. [#42189](https://github.com/grafana/grafana/pull/42189), [@ivanahuckova](https://github.com/ivanahuckova)
- **TextPanel:** Fix suggestions for existing panels. [#42195](https://github.com/grafana/grafana/pull/42195), [@hugohaggmark](https://github.com/hugohaggmark)
- **Tracing:** Fix incorrect indentations due to reoccurring spanIDs. [#41919](https://github.com/grafana/grafana/pull/41919), [@ivanahuckova](https://github.com/ivanahuckova)
- **Tracing:** Show start time of trace with milliseconds precision. [#42132](https://github.com/grafana/grafana/pull/42132), [@ivanahuckova](https://github.com/ivanahuckova)
- **Variables:** Make renamed or missing variable section expandable. [#41964](https://github.com/grafana/grafana/pull/41964), [@hugohaggmark](https://github.com/hugohaggmark)

### Breaking changes

### Grafana 8 Alerting enabled by default for installations that do not use legacy alerting

Starting with Grafana v8.3.0, if you have **not** explicitly disabled unified alerting and **do not** have legacy alerts set up you are automatically "migrated" to Grafana 8 Alerting.

A migration **from legacy to Grafana 8 Alerting** will never incur a data loss, as the previous data is kept around for rollback purposes. However, going from **Grafana 8 Alerting to legacy alerting** will delete all the data created for Grafana 8 Alerting. It is recommended that you **backup your database** before attempting a migration between systems.

If unclear, please verify the table below:

| `[alerting][enabled]` | `[unified_alerting][enabled]` | With Existing Legacy Alerts | Result             |
| --------------------- | ----------------------------- | --------------------------- | ------------------ |
| `true`                | `true`                        | N/A                         | Error              |
| `true`                | `false`                       | N/A                         | Legacy Alerting    |
| `true`                | not set                       | Yes                         | Legacy Alerting    |
| `true`                | not set                       | No                          | Grafana 8 Alerting |
| not set               | `true`                        | N/A                         | Grafana 8 Alerting |
| not set               | `false`                       | N/A                         | Legacy Alerting    |
| not set               | not set                       | Yes                         | Legacy Alerting    |
| not set               | not set                       | No                          | Grafana 8 Alerting |
| `false`               | `true`                        | N/A                         | Grafana 8 Alerting |
| `false`               | `false`                       | N/A                         | Alerting disabled  |
| `false`               | not set                       | N/A                         | Grafana 8 Alerting |

N/A in the "With Existing Legacy Alerts" column means that it does not matter if you have legacy alerts or not.
Issue [#42200](https://github.com/grafana/grafana/issues/42200)

### Keep Last State for "If execution error or timeout" when upgrading to Grafana 8 alerting

In Grafana 8.3.0-beta2 we changed how alert rules that use `Keep Last State` for `If execution error or timeout` are upgraded from Legacy Alerting to Grafana 8 alerting. In 8.3.0-beta1 and earlier, alert rules with `Keep Last State` for `If execution error or timeout` were changed to `Alerting` when upgrading from Legacy Alerting to Grafana 8 alerting. However, in 8.3.0-beta2 these alert rules are now upgraded to a new option called `Error`. With this option, on encountering an error evaluating an alert rule, Grafana creates a special alert called `DatasourceError` with the `rule_uid` and `ref_id` as labels and an annotation called `Error` with the error message. Issue [#41869](https://github.com/grafana/grafana/issues/41869)

### Deprecations

The access mode "browser" is deprecated in the following data sources and will be removed in a later release:

- Prometheus
- InfluxDB
- Elasticsearch Issue [#41938](https://github.com/grafana/grafana/issues/41938)

### Plugin development fixes & changes

- **Select:** Select menus now properly scroll during keyboard navigation. [#41917](https://github.com/grafana/grafana/pull/41917), [@ashharrison90](https://github.com/ashharrison90)

<!-- 8.3.0-beta2 END -->
<!-- 8.3.0-beta1 START -->

# 8.3.0-beta1 (2021-11-18)

### Features and enhancements

- **AccessControl:** Apply role-based access control to licensing. (Enterprise)
- **Alerting:** Add UI for contact point testing with custom annotations and labels. [#40491](https://github.com/grafana/grafana/pull/40491), [@nathanrodman](https://github.com/nathanrodman)
- **Alerting:** Make alert state indicator in panel header work with Grafana 8 alerts. [#38713](https://github.com/grafana/grafana/pull/38713), [@domasx2](https://github.com/domasx2)
- **Alerting:** Option for Discord notifier to use webhook name. [#40463](https://github.com/grafana/grafana/pull/40463), [@Skyebold](https://github.com/Skyebold)
- **Annotations:** Deprecate AnnotationsSrv. [#39631](https://github.com/grafana/grafana/pull/39631), [@hugohaggmark](https://github.com/hugohaggmark)
- **Auditing:** Add audit logs for unified alerting endpoints. (Enterprise)
- **Auditing:** Add endpoints (plugins, datasources, library elements). (Enterprise)
- **Auth:** Omit all base64 paddings in JWT tokens for the JWT auth. [#35602](https://github.com/grafana/grafana/pull/35602), [@gillg](https://github.com/gillg)
- **Azure Monitor:** Clean up fields when editing Metrics. [#41762](https://github.com/grafana/grafana/pull/41762), [@andresmgot](https://github.com/andresmgot)
- **AzureMonitor:** Add new starter dashboards. [#39876](https://github.com/grafana/grafana/pull/39876), [@jcolladokuri](https://github.com/jcolladokuri)
- **AzureMonitor:** Add starter dashboard for app monitoring with Application Insights. [#40725](https://github.com/grafana/grafana/pull/40725), [@jcolladokuri](https://github.com/jcolladokuri)
- **Barchart/Time series:** Allow x axis label. [#41142](https://github.com/grafana/grafana/pull/41142), [@oscarkilhed](https://github.com/oscarkilhed)
- **CLI:** Improve error handling for installing plugins. [#41257](https://github.com/grafana/grafana/pull/41257), [@marefr](https://github.com/marefr)
- **CloudMonitoring:** Migrate to use backend plugin SDK contracts. [#38650](https://github.com/grafana/grafana/pull/38650), [@idafurjes](https://github.com/idafurjes)
- **CloudWatch Logs:** Add retry strategy for hitting max concurrent queries. [#39290](https://github.com/grafana/grafana/pull/39290), [@aocenas](https://github.com/aocenas)
- **CloudWatch:** Add AWS RoboMaker metrics and dimension. [#41450](https://github.com/grafana/grafana/pull/41450), [@ilyastoli](https://github.com/ilyastoli)
- **CloudWatch:** Add AWS Transfer metrics and dimension. [#41168](https://github.com/grafana/grafana/pull/41168), [@ilyastoli](https://github.com/ilyastoli)
- **Dashboard:** replace datasource name with a reference object. [#33817](https://github.com/grafana/grafana/pull/33817), [@ryantxu](https://github.com/ryantxu)
- **Dashboards:** Show logs on time series when hovering. [#40110](https://github.com/grafana/grafana/pull/40110), [@ryantxu](https://github.com/ryantxu)
- **Elasticsearch:** Add support for Elasticsearch 8.0 (Beta). [#41729](https://github.com/grafana/grafana/pull/41729), [@Elfo404](https://github.com/Elfo404)
- **Elasticsearch:** Add time zone setting to Date Histogram aggregation. [#40882](https://github.com/grafana/grafana/pull/40882), [@Elfo404](https://github.com/Elfo404)
- **Elasticsearch:** Enable full range log volume histogram. [#41202](https://github.com/grafana/grafana/pull/41202), [@ifrost](https://github.com/ifrost)
- **Elasticsearch:** Full range logs volume. [#40700](https://github.com/grafana/grafana/pull/40700), [@ifrost](https://github.com/ifrost)
- **Explore:** Allow changing the graph type. [#40522](https://github.com/grafana/grafana/pull/40522), [@gabor](https://github.com/gabor)
- **Explore:** Show ANSI colors when highlighting matched words in the logs panel. [#40971](https://github.com/grafana/grafana/pull/40971), [@oliverfrye](https://github.com/oliverfrye)
- **Graph(old) panel:** Listen to events from Time series panel. [#41033](https://github.com/grafana/grafana/pull/41033), [@zoltanbedi](https://github.com/zoltanbedi)
- **Import:** Load gcom dashboards from URL. [#41799](https://github.com/grafana/grafana/pull/41799), [@ashharrison90](https://github.com/ashharrison90)
- **LibraryPanels:** Improves export and import of library panels between orgs. [#39214](https://github.com/grafana/grafana/pull/39214), [@hugohaggmark](https://github.com/hugohaggmark)
- **OAuth:** Support PKCE. [#39948](https://github.com/grafana/grafana/pull/39948), [@sakjur](https://github.com/sakjur)
- **Panel edit:** Overrides now highlight correctly when searching. [#41684](https://github.com/grafana/grafana/pull/41684), [@ashharrison90](https://github.com/ashharrison90)
- **PanelEdit:** Display drag indicators on draggable sections. [#41711](https://github.com/grafana/grafana/pull/41711), [@ashharrison90](https://github.com/ashharrison90)
- **Plugins:** Refactor Plugin Management. [#40477](https://github.com/grafana/grafana/pull/40477), [@wbrowne](https://github.com/wbrowne)
- **Prometheus:** Add custom query parameters when creating PromLink url. [#41213](https://github.com/grafana/grafana/pull/41213), [@Ian-Yy](https://github.com/Ian-Yy)
- **Prometheus:** Remove limits on metrics, labels, and values in Metrics Browser. [#40660](https://github.com/grafana/grafana/pull/40660), [@autoric](https://github.com/autoric)
- **StateTimeline:** Share cursor with rest of the panels. [#41038](https://github.com/grafana/grafana/pull/41038), [@zoltanbedi](https://github.com/zoltanbedi)
- **Tempo:** Add error details when json upload fails. [#41803](https://github.com/grafana/grafana/pull/41803), [@aocenas](https://github.com/aocenas)
- **Tempo:** Add filtering for service graph query. [#41162](https://github.com/grafana/grafana/pull/41162), [@aocenas](https://github.com/aocenas)
- **Tempo:** Add links to nodes in Service Graph pointing to Prometheus metrics. [#41135](https://github.com/grafana/grafana/pull/41135), [@aocenas](https://github.com/aocenas)
- **Time series/Bar chart panel:** Add ability to sort series via legend. [#40226](https://github.com/grafana/grafana/pull/40226), [@zoltanbedi](https://github.com/zoltanbedi)
- **TimeSeries:** Allow multiple axes for the same unit. [#41635](https://github.com/grafana/grafana/pull/41635), [@dprokop](https://github.com/dprokop)
- **TraceView:** Allow span links defined on dataFrame. [#40563](https://github.com/grafana/grafana/pull/40563), [@aocenas](https://github.com/aocenas)
- **Transformations:** Support a rows mode in labels to fields. [#41020](https://github.com/grafana/grafana/pull/41020), [@ryantxu](https://github.com/ryantxu)
- **ValueMappings:** Don't apply field config defaults to time fields. [#41132](https://github.com/grafana/grafana/pull/41132), [@torkelo](https://github.com/torkelo)
- **Variables:** Only update panels that are impacted by variable change. [#39420](https://github.com/grafana/grafana/pull/39420), [@hugohaggmark](https://github.com/hugohaggmark)

### Bug fixes

- **API:** Fix dashboard quota limit for imports. [#41495](https://github.com/grafana/grafana/pull/41495), [@yangkb09](https://github.com/yangkb09)
- **Alerting:** Fix rule editor issues with Azure Monitor data source. [#41317](https://github.com/grafana/grafana/pull/41317), [@domasx2](https://github.com/domasx2)
- **Azure monitor:** Make sure alert rule editor is not enabled when template variables are being used. [#41335](https://github.com/grafana/grafana/pull/41335), [@sunker](https://github.com/sunker)
- **CloudMonitoring:** Fix annotation queries. [#41529](https://github.com/grafana/grafana/pull/41529), [@sunker](https://github.com/sunker)
- **CodeEditor:** Trigger the latest getSuggestions() passed to CodeEditor. [#40544](https://github.com/grafana/grafana/pull/40544), [@DukeManh](https://github.com/DukeManh)
- **Dashboard:** Remove the current panel from the list of options in the Dashboard datasource. [#41826](https://github.com/grafana/grafana/pull/41826), [@ashharrison90](https://github.com/ashharrison90)
- **Encryption:** Fix decrypting secrets in alerting migration. [#41061](https://github.com/grafana/grafana/pull/41061), [@undef1nd](https://github.com/undef1nd)
- **InfluxDB:** Fix corner case where index is too large in ALIAS field. [#41562](https://github.com/grafana/grafana/pull/41562), [@gabor](https://github.com/gabor)
- **NavBar:** Order App plugins alphabetically. [#40078](https://github.com/grafana/grafana/pull/40078), [@ashharrison90](https://github.com/ashharrison90)
- **NodeGraph:** Fix zooming sensitivity on touchpads. [#40718](https://github.com/grafana/grafana/pull/40718), [@aocenas](https://github.com/aocenas)
- **Plugins:** Add OAuth pass-through logic to api/ds/query endpoint. [#41352](https://github.com/grafana/grafana/pull/41352), [@wbrowne](https://github.com/wbrowne)
- **Snapshots:** Fix panel inspector for snapshot data. [#41530](https://github.com/grafana/grafana/pull/41530), [@joshhunt](https://github.com/joshhunt)
- **Tempo:** Fix basic auth password reset on adding tag. [#41808](https://github.com/grafana/grafana/pull/41808), [@aocenas](https://github.com/aocenas)
- **ValueMapping:** Fixes issue with regex mappings. [#41515](https://github.com/grafana/grafana/pull/41515), [@mcdee](https://github.com/mcdee)

### Plugin development fixes & changes

- **grafana/ui:** Enable slider marks display. [#41275](https://github.com/grafana/grafana/pull/41275), [@dprokop](https://github.com/dprokop)

<!-- 8.3.0-beta1 END -->
<!-- 8.2.7 START -->

# 8.2.7 (2021-12-07)

- **Security**: Fixes CVE-2021-43798. For more information, see our [blog](https://grafana.com/blog/2021/12/07/grafana-8.3.1-8.2.7-8.1.8-and-8.0.7-released-with-high-severity-security-fix/)

<!-- 8.2.7 END -->

<!-- 8.2.6 START -->

# 8.2.6 (2021-12-02)

### Features and enhancements

- **Security:** Upgrade Docker base image to Alpine 3.14.3. [#42061](https://github.com/grafana/grafana/pull/42061), [@dsotirakis](https://github.com/dsotirakis)
- **Security:** Upgrade Go to 1.17.2. [#42427](https://github.com/grafana/grafana/pull/42427), [@idafurjes](https://github.com/idafurjes)

### Bug fixes

- **TimeSeries:** Fix fillBelowTo wrongly affecting fills of unrelated series. [#41998](https://github.com/grafana/grafana/pull/41998), [@leeoniya](https://github.com/leeoniya)

<!-- 8.2.6 END -->
<!-- 8.2.5 START -->

# 8.2.5 (2021-11-18)

### Bug fixes

- **Alerting:** Fix a bug where the metric in the evaluation string was not correctly populated. [#41731](https://github.com/grafana/grafana/pull/41731), [@JohnnyQQQQ](https://github.com/JohnnyQQQQ)
- **Alerting:** Fix no data behaviour in Legacy Alerting for alert rules using the AND operator. [#41305](https://github.com/grafana/grafana/pull/41305), [@gerobinson](https://github.com/gerobinson)
- **CloudMonitoring:** Ignore min and max aggregation in MQL queries. [#41302](https://github.com/grafana/grafana/pull/41302), [@sunker](https://github.com/sunker)
- **Dashboards:** 'Copy' is no longer added to new dashboard titles. [#41344](https://github.com/grafana/grafana/pull/41344), [@joshhunt](https://github.com/joshhunt)
- **DataProxy:** Fix overriding response body when response is a WebSocket upgrade. [#41364](https://github.com/grafana/grafana/pull/41364), [@marefr](https://github.com/marefr)
- **Elasticsearch:** Use field configured in query editor as field for date_histogram aggregations. [#41258](https://github.com/grafana/grafana/pull/41258), [@Elfo404](https://github.com/Elfo404)
- **Explore:** Fix running queries without a datasource property set. [#40805](https://github.com/grafana/grafana/pull/40805), [@Elfo404](https://github.com/Elfo404)
- **InfluxDB:** Fix numeric aliases in queries. [#41531](https://github.com/grafana/grafana/pull/41531), [@gabor](https://github.com/gabor)
- **Plugins:** Ensure consistent plugin settings list response. [#41346](https://github.com/grafana/grafana/pull/41346), [@wbrowne](https://github.com/wbrowne)
- **Tempo:** Fix validation of float durations. [#41400](https://github.com/grafana/grafana/pull/41400), [@ivanahuckova](https://github.com/ivanahuckova)
- **Tracing:** Correct tags for each span are shown. [#41473](https://github.com/grafana/grafana/pull/41473), [@ivanahuckova](https://github.com/ivanahuckova)

### Breaking changes

### Fix No Data behaviour in Legacy Alerting

In Grafana 8.2.5 and later, this change fixes a bug in the evaluation of alert rules when using the AND operator to compare two or more conditions. In Grafana 8.2.4 and earlier such alert rules would evaluate to `OK` if at least one, but not all, conditions returned no data. This change fixes that bug such that in Grafana 8.2.5 these alert rules now evaluate to `No Data`.

If an alert should evaluate to `OK` when one or all conditions return `No Data` then this can be done via changing `If no data or all values are null` to `OK`. However, this will not preserve the old behaviour in 8.2.4 where an alert will be `OK` if at least one, but not all, conditions return no data and then `No Data` if all conditions return `No Data`. Issue [#41305](https://github.com/grafana/grafana/issues/41305)

<!-- 8.2.5 END -->
<!-- 8.2.4 START -->

# 8.2.4 (2021-11-15)

- **Security**: Fixes CVE-2021-41244. For more information, see our [blog](https://grafana.com/blog/2021/11/15/grafana-8.2.4-released-with-security-fixes/)

<!-- 8.2.4 END -->

<!-- 8.2.3 START -->

# 8.2.3 (2021-11-03)

- **Security**: Fixes CVE-2021-41174. For more information, see our [blog](https://grafana.com/blog/2021/11/03/grafana-8.2.3-released-with-medium-severity-security-fix-cve-2021-41174-grafana-xss/)

<!-- 8.2.3 END -->

<!-- 8.2.2 START -->

# 8.2.2 (2021-10-21)

### Features and enhancements

- **Annotations:** We have improved tag search performance. [#40567](https://github.com/grafana/grafana/pull/40567), [@ashharrison90](https://github.com/ashharrison90)
- **Application:** You can now configure an error-template title. [#40310](https://github.com/grafana/grafana/pull/40310), [@benrubson](https://github.com/benrubson)
- **AzureMonitor:** We removed a restriction from the resource filter query. [#40690](https://github.com/grafana/grafana/pull/40690), [@andresmgot](https://github.com/andresmgot)
- **Caching:** Make cache size metric collection optional. (Enterprise)
- **Packaging:** We removed the ProcSubset option in systemd. This option prevented Grafana from starting in LXC environments. [#40339](https://github.com/grafana/grafana/pull/40339), [@kminehart](https://github.com/kminehart)
- **Prometheus:** We removed the autocomplete limit for metrics. [#39363](https://github.com/grafana/grafana/pull/39363), [@ivanahuckova](https://github.com/ivanahuckova)
- **Request interceptor:** Allow MSSQL's named instances. (Enterprise)
- **Table:** We improved the styling of the type icons to make them more distinct from column / field name. [#40596](https://github.com/grafana/grafana/pull/40596), [@torkelo](https://github.com/torkelo)
- **ValueMappings:** You can now use value mapping in stat, gauge, bar gauge, and pie chart visualizations. [#40612](https://github.com/grafana/grafana/pull/40612), [@torkelo](https://github.com/torkelo)

### Bug fixes

- **Alerting:** Fix panic when Slack's API sends unexpected response. [#40721](https://github.com/grafana/grafana/pull/40721), [@santihernandezc](https://github.com/santihernandezc)
- **Alerting:** The Create Alert button now appears on the dashboard panel when you are working with a default datasource. [#40334](https://github.com/grafana/grafana/pull/40334), [@domasx2](https://github.com/domasx2)
- **Explore:** We fixed the problem where the Explore log panel disappears when an Elasticsearch logs query returns no results. [#40217](https://github.com/grafana/grafana/pull/40217), [@Elfo404](https://github.com/Elfo404)
- **Graph:** You can now see annotation descriptions on hover. [#40581](https://github.com/grafana/grafana/pull/40581), [@axelavargas](https://github.com/axelavargas)
- **Logs:** The system now uses the JSON parser only if the line is parsed to an object. [#40507](https://github.com/grafana/grafana/pull/40507), [@ivanahuckova](https://github.com/ivanahuckova)
- **Prometheus:** We fixed the issue where the system did not reuse TCP connections when querying from Grafana Alerting. [#40349](https://github.com/grafana/grafana/pull/40349), [@kminehart](https://github.com/kminehart)
- **Prometheus:** We fixed the problem that resulted in an error when a user created a query with a \$\_\_interval min step. [#40525](https://github.com/grafana/grafana/pull/40525), [@ivanahuckova](https://github.com/ivanahuckova)
- **RowsToFields:** We fixed the issue where the system was not properly interpreting number values. [#40580](https://github.com/grafana/grafana/pull/40580), [@torkelo](https://github.com/torkelo)
- **Scale:** We fixed how the system handles NaN percent when data min = data max. [#40622](https://github.com/grafana/grafana/pull/40622), [@torkelo](https://github.com/torkelo)
- **Table panel:** You can now create a filter that includes special characters. [#40458](https://github.com/grafana/grafana/pull/40458), [@dprokop](https://github.com/dprokop)

<!-- 8.2.2 END -->
<!-- 8.2.1 START -->

# 8.2.1 (2021-10-11)

### Bug fixes

- **Dashboard:** Fix rendering of repeating panels. [#39991](https://github.com/grafana/grafana/pull/39991), [@hugohaggmark](https://github.com/hugohaggmark)
- **Datasources:** Fix deletion of data source if plugin is not found. [#40095](https://github.com/grafana/grafana/pull/40095), [@jackw](https://github.com/jackw)
- **Packaging:** Remove systemcallfilters sections from systemd unit files. [#40176](https://github.com/grafana/grafana/pull/40176), [@kminehart](https://github.com/kminehart)
- **Prometheus:** Add Headers to HTTP client options. [#40214](https://github.com/grafana/grafana/pull/40214), [@dsotirakis](https://github.com/dsotirakis)

<!-- 8.2.1 END -->
<!-- 8.2.0 START -->

# 8.2.0 (2021-10-07)

### Features and enhancements

- **AWS:** Updated AWS authentication documentation. [#39236](https://github.com/grafana/grafana/pull/39236), [@sunker](https://github.com/sunker)
- **Alerting:** Added support Alertmanager data source for upstream Prometheus AM implementation. [#39775](https://github.com/grafana/grafana/pull/39775), [@domasx2](https://github.com/domasx2)
- **Alerting:** Allows more characters in label names so notifications are sent. [#38629](https://github.com/grafana/grafana/pull/38629), [@gotjosh](https://github.com/gotjosh)
- **Alerting:** Get alert rules for a dashboard or a panel using /api/v1/rules endpoints. [#39476](https://github.com/grafana/grafana/pull/39476), [@gerobinson](https://github.com/gerobinson)
- **Annotations:** Improved rendering performance of event markers. [#39984](https://github.com/grafana/grafana/pull/39984), [@torkelo](https://github.com/torkelo)
- **CloudWatch Logs:** Skip caching for log queries. [#39860](https://github.com/grafana/grafana/pull/39860), [@aocenas](https://github.com/aocenas)
- **Explore:** Added an opt-in configuration for Node Graph in Jaeger, Zipkin, and Tempo. [#39958](https://github.com/grafana/grafana/pull/39958), [@connorlindsey](https://github.com/connorlindsey)
- **Packaging:** Add stricter systemd unit options. [#38109](https://github.com/grafana/grafana/pull/38109), [@erdnaxe](https://github.com/erdnaxe)
- **Prometheus:** Metrics browser can now handle label values with special characters. [#39713](https://github.com/grafana/grafana/pull/39713), [@gabor](https://github.com/gabor)

### Bug fixes

- **CodeEditor:** Ensure that we trigger the latest onSave callback provided to the component. [#39835](https://github.com/grafana/grafana/pull/39835), [@mckn](https://github.com/mckn)
- **DashboardList/AlertList:** Fix for missing All folder value. [#39772](https://github.com/grafana/grafana/pull/39772), [@hugohaggmark](https://github.com/hugohaggmark)

### Breaking changes

#### Potential failure to start in Ubuntu 18.04 / Debian 9 / CentOS

- In Grafana v8.2.0, this change can prevent the `grafana-server` service from starting on older versions of systemd, present on Ubuntu 18.04 and slightly older versions of Debian. If running one of those versions, please wait until v8.2.1 is released before upgrading. If you still want to upgrade or have already ugpraded, a simple fix is available here: https://github.com/grafana/grafana/issues/40162#issuecomment-938060240 Issue [#38109](https://github.com/grafana/grafana/issues/38109)

### Plugin development fixes & changes

- **Plugins:** Create a mock icon component to prevent console errors. [#39901](https://github.com/grafana/grafana/pull/39901), [@jackw](https://github.com/jackw)

<!-- 8.2.0 END -->
<!-- 8.2.0-beta2 START -->

# 8.2.0-beta2 (2021-09-30)

### Features and enhancements

- **AccessControl:** Document new permissions restricting data source access. [#39091](https://github.com/grafana/grafana/pull/39091), [@gamab](https://github.com/gamab)
- **TimePicker:** Add fiscal years and search to time picker. [#39073](https://github.com/grafana/grafana/pull/39073), [@oscarkilhed](https://github.com/oscarkilhed)
- **Alerting:** Added support for Unified Alerting with Grafana HA. [#37920](https://github.com/grafana/grafana/pull/37920), [@gotjosh](https://github.com/gotjosh)
- **Alerting:** Added support for tune rule evaluation using configuration options. [#35623](https://github.com/grafana/grafana/pull/35623), [@papagian](https://github.com/papagian)
- **Alerting:** Cleanups alertmanager namespace from key-value store when disabling Grafana 8 alerts. [#39554](https://github.com/grafana/grafana/pull/39554), [@papagian](https://github.com/papagian)
- **Alerting:** Remove `ngalert` feature toggle and introduce two new settings for enabling Grafana 8 alerts and disabling them for specific organisations. [#38746](https://github.com/grafana/grafana/pull/38746), [@papagian](https://github.com/papagian)
- **CloudWatch:** Introduced new math expression where it is necessary to specify the period field. [#39458](https://github.com/grafana/grafana/pull/39458), [@sunker](https://github.com/sunker)
- **InfluxDB:** Added support for $\_\_interval and $\_\_interval_ms in Flux queries for alerting. [#38889](https://github.com/grafana/grafana/pull/38889), [@gabor](https://github.com/gabor)
- **InfluxDB:** Flux queries can use more precise start and end timestamps with nanosecond-precision. [#39415](https://github.com/grafana/grafana/pull/39415), [@gabor](https://github.com/gabor)
- **Plugins Catalog:** Make the catalog the default way to interact with plugins. [#39779](https://github.com/grafana/grafana/pull/39779), [@leventebalogh](https://github.com/leventebalogh)
- **Prometheus:** Removed autocomplete limit for metrics. [#39363](https://github.com/grafana/grafana/pull/39363), [@ivanahuckova](https://github.com/ivanahuckova)

### Bug fixes

- **Alerting:** Fixed an issue where the edit page crashes if you tried to preview an alert without a condition set. [#39659](https://github.com/grafana/grafana/pull/39659), [@peterholmberg](https://github.com/peterholmberg)
- **Alerting:** Fixed rules migration to keep existing Grafana 8 alert rules. [#39541](https://github.com/grafana/grafana/pull/39541), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Fixed the silence file content generated during migration. [#39557](https://github.com/grafana/grafana/pull/39557), [@papagian](https://github.com/papagian)
- **Analytics:** Fixed an issue related to interaction event propagation in Azure Application Insights. [#39752](https://github.com/grafana/grafana/pull/39752), [@sunker](https://github.com/sunker)
- **BarGauge:** Fixed an issue where the cell color was lit even though there was no data. [#39574](https://github.com/grafana/grafana/pull/39574), [@ashharrison90](https://github.com/ashharrison90)
- **BarGauge:** Improved handling of streaming data. [#39737](https://github.com/grafana/grafana/pull/39737), [@ashharrison90](https://github.com/ashharrison90)
- **CloudMonitoring:** Fixed INT64 label unmarshal error. [#39441](https://github.com/grafana/grafana/pull/39441), [@bspellmeyer](https://github.com/bspellmeyer)
- **ConfirmModal:** Fixes confirm button focus on modal open. [#39328](https://github.com/grafana/grafana/pull/39328), [@torkelo](https://github.com/torkelo)
- **Dashboard:** Add option to generate short URL for variables with values containing spaces. [#39552](https://github.com/grafana/grafana/pull/39552), [@hugohaggmark](https://github.com/hugohaggmark)
- **Explore:** No longer hides errors containing refId property. [#39504](https://github.com/grafana/grafana/pull/39504), [@Elfo404](https://github.com/Elfo404)
- Fixed an issue that produced State timeline panel tooltip error when data was not in sync. [#39438](https://github.com/grafana/grafana/pull/39438), [@zoltanbedi](https://github.com/zoltanbedi)
- **InfluxDB:** InfluxQL query editor is set to always use resultFormat. [#39330](https://github.com/grafana/grafana/pull/39330), [@gabor](https://github.com/gabor)
- **Loki:** Fixed creating context query for logs with parsed labels. [#39648](https://github.com/grafana/grafana/pull/39648), [@ivanahuckova](https://github.com/ivanahuckova)
- **PageToolbar:** Fixed alignment of titles. [#39572](https://github.com/grafana/grafana/pull/39572), [@ashharrison90](https://github.com/ashharrison90)
- **Plugins Catalog:** Update to the list of available panels after an install, update or uninstall. [#39293](https://github.com/grafana/grafana/pull/39293), [@leventebalogh](https://github.com/leventebalogh)
- **TimeSeries:** Fixed an issue where the shared cursor was not showing when hovering over in old Graph panel. [#39738](https://github.com/grafana/grafana/pull/39738), [@zoltanbedi](https://github.com/zoltanbedi)
- **Variables:** Fixed issues related to change of focus or refresh pages when pressing enter in a text box variable input. [#39666](https://github.com/grafana/grafana/pull/39666), [@hugohaggmark](https://github.com/hugohaggmark)
- **Variables:** Panel no longer crash when using the adhoc variable in data links. [#39546](https://github.com/grafana/grafana/pull/39546), [@hugohaggmark](https://github.com/hugohaggmark)

### Breaking changes

Grafana v8.2.0-beta1 caused data loss for users having enabled `ngalert` in 8.0.x - 8.1.x and created alerts using the new alerting system. This issue is now fixed except if the deployment has multiple organizations and the feature flag was enabled in the previous version (8.0.x - 8.1.x).

In this scenario (upgrade from 8.0.x - 8.1.x with multiple organizations and `ngalert` enabled to 8.2.0-beta2), the migration will assign existing notification policies and contact points to the first organization and then apply the default alertmanager configuration to all organizations. This will effectively reset notification policies for _all_ organizations. Issue [#39541](https://github.com/grafana/grafana/issues/39541)

### Deprecations

`ngalert` feature toggle it has been deprecated it will be removed in a future release. To enable Grafana 8 alerts, modify your configuration and:

- in the `unified_alerting` section set the `enabled` property to `true`
- in the `alerting` section set the `enabled` property to `false` Issue [#38746](https://github.com/grafana/grafana/issues/38746)

<!-- 8.2.0-beta2 END -->
<!-- 8.2.0-beta1 START -->

# 8.2.0-beta1 (2021-09-16)

### Features and enhancements

- **AccessControl:** Introduce new permissions to restrict access for reloading provisioning configuration. [#38906](https://github.com/grafana/grafana/pull/38906), [@vtorosyan](https://github.com/vtorosyan)
- **Admin:** Update license page UI. (Enterprise)
- **Alerting:** Add UI to edit Cortex/Loki namespace, group names, and group evaluation interval. [#38543](https://github.com/grafana/grafana/pull/38543), [@domasx2](https://github.com/domasx2)
- **Alerting:** Add a Test button to test contact point. [#37475](https://github.com/grafana/grafana/pull/37475), [@domasx2](https://github.com/domasx2)
- **Alerting:** Allow creating/editing recording rules for Loki and Cortex. [#38064](https://github.com/grafana/grafana/pull/38064), [@domasx2](https://github.com/domasx2)
- **Alerting:** Metrics should have the label `org` instead of `user`. [#39353](https://github.com/grafana/grafana/pull/39353), [@gotjosh](https://github.com/gotjosh)
- **Alerting:** Sort notification channels by name to make them easier to locate. [#37426](https://github.com/grafana/grafana/pull/37426), [@jstangroome](https://github.com/jstangroome)
- **Alerting:** Support org level isolation of notification configuration. [#37414](https://github.com/grafana/grafana/pull/37414), [@papagian](https://github.com/papagian)
- **AzureMonitor:** Add data links to deep link to Azure Portal Azure Resource Graph. [#35591](https://github.com/grafana/grafana/pull/35591), [@shuotli](https://github.com/shuotli)
- **AzureMonitor:** Add support for annotations from Azure Monitor Metrics and Azure Resource Graph services. [#37633](https://github.com/grafana/grafana/pull/37633), [@joshhunt](https://github.com/joshhunt)
- **AzureMonitor:** Show error message when subscriptions request fails in ConfigEditor. [#37837](https://github.com/grafana/grafana/pull/37837), [@joshhunt](https://github.com/joshhunt)
- **Chore:** Update to Golang 1.16.7. [#38604](https://github.com/grafana/grafana/pull/38604), [@dsotirakis](https://github.com/dsotirakis)
- **CloudWatch Logs:** Add link to X-Ray data source for trace IDs in logs. [#39135](https://github.com/grafana/grafana/pull/39135), [@aocenas](https://github.com/aocenas)
- **CloudWatch Logs:** Disable query path using websockets (Live) feature. [#39231](https://github.com/grafana/grafana/pull/39231), [@aocenas](https://github.com/aocenas)
- **CloudWatch/Logs:** Don't group dataframes for non time series queries. [#37998](https://github.com/grafana/grafana/pull/37998), [@aocenas](https://github.com/aocenas)
- **Cloudwatch:** Migrate queries that use multiple stats to one query per stat. [#36925](https://github.com/grafana/grafana/pull/36925), [@sunker](https://github.com/sunker)
- **Dashboard:** Keep live timeseries moving left (v2). [#37769](https://github.com/grafana/grafana/pull/37769), [@ryantxu](https://github.com/ryantxu)
- **Datasources:** Introduce `response_limit` for datasource responses. [#38962](https://github.com/grafana/grafana/pull/38962), [@dsotirakis](https://github.com/dsotirakis)
- **Explore:** Add filter by trace or span ID to `trace to logs` feature. [#38943](https://github.com/grafana/grafana/pull/38943), [@connorlindsey](https://github.com/connorlindsey)
- **Explore:** Download traces as JSON in Explore Inspector. [#38614](https://github.com/grafana/grafana/pull/38614), [@connorlindsey](https://github.com/connorlindsey)
- **Explore:** Reuse Dashboard's QueryRows component. [#38942](https://github.com/grafana/grafana/pull/38942), [@Elfo404](https://github.com/Elfo404)
- **Explore:** Support custom display label for derived fields buttons for Loki datasource. [#37273](https://github.com/grafana/grafana/pull/37273), [@connorlindsey](https://github.com/connorlindsey)
- **Grafana UI:** Update monaco-related dependencies. [#39027](https://github.com/grafana/grafana/pull/39027), [@gabor](https://github.com/gabor)
- **Graphite:** Deprecate browser access mode. [#38783](https://github.com/grafana/grafana/pull/38783), [@ifrost](https://github.com/ifrost)
- **InfluxDB:** Improve handling of intervals in alerting. [#37588](https://github.com/grafana/grafana/pull/37588), [@gabor](https://github.com/gabor)
- **InfluxDB:** InfluxQL query editor: Handle unusual characters in tag values better. [#39170](https://github.com/grafana/grafana/pull/39170), [@gabor](https://github.com/gabor)
- Introduce "monitored queries" service. (Enterprise)
- **Jaeger:** Add ability to upload JSON file for trace data. [#37205](https://github.com/grafana/grafana/pull/37205), [@zoltanbedi](https://github.com/zoltanbedi)
- **LibraryElements:** Enable specifying UID for new and existing library elements. [#39019](https://github.com/grafana/grafana/pull/39019), [@hugohaggmark](https://github.com/hugohaggmark)
- **LibraryPanels:** Remove library panel icon from the panel header so you can no longer tell that a panel is a library panel from the dashboard view. [#38749](https://github.com/grafana/grafana/pull/38749), [@hugohaggmark](https://github.com/hugohaggmark)
- **Logs panel:** Scroll to the bottom on page refresh when sorting in ascending order. [#37634](https://github.com/grafana/grafana/pull/37634), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Add fuzzy search to label browser. [#36864](https://github.com/grafana/grafana/pull/36864), [@connorlindsey](https://github.com/connorlindsey)
- **Navigation:** Implement active state for items in the Sidemenu. [#39030](https://github.com/grafana/grafana/pull/39030), [@ashharrison90](https://github.com/ashharrison90)
- **Packaging:** Add stricter systemd unit options. [#38109](https://github.com/grafana/grafana/pull/38109), [@erdnaxe](https://github.com/erdnaxe)
- **Packaging:** Update PID file location from `/var/run` to `/run`. [#35739](https://github.com/grafana/grafana/pull/35739), [@MichaIng](https://github.com/MichaIng)
- **Plugins:** Add Hide OAuth Forward config option. [#36306](https://github.com/grafana/grafana/pull/36306), [@wbrowne](https://github.com/wbrowne)
- **Postgres/MySQL/MSSQL:** Add setting to limit the maximum number of rows processed. [#38986](https://github.com/grafana/grafana/pull/38986), [@marefr](https://github.com/marefr)
- **Prometheus:** Add browser access mode deprecation warning. [#37578](https://github.com/grafana/grafana/pull/37578), [@ivanahuckova](https://github.com/ivanahuckova)
- **Prometheus:** Add interpolation for built-in-time variables to backend. [#39051](https://github.com/grafana/grafana/pull/39051), [@ivanahuckova](https://github.com/ivanahuckova)
- **Recorded Queries:** Finish rest API endpoints. (Enterprise)
- **Reporting:** enable creating reports from dashboard. (Enterprise)
- **Tempo:** Add ability to upload trace data in JSON format. [#37407](https://github.com/grafana/grafana/pull/37407), [@zoltanbedi](https://github.com/zoltanbedi)
- **TimeSeries/XYChart:** Allow grid lines visibility control in XYChart and TimeSeries panels. [#38502](https://github.com/grafana/grafana/pull/38502), [@dprokop](https://github.com/dprokop)
- **Transformations:** Convert field types to time string number or boolean. [#38517](https://github.com/grafana/grafana/pull/38517), [@nikki-kiga](https://github.com/nikki-kiga)
- **Usage Insights:** Support writing events to Grafana's log. (Enterprise)
- **Value mappings:** Add regular-expression based value mapping. [#38931](https://github.com/grafana/grafana/pull/38931), [@mcdee](https://github.com/mcdee)
- **Zipkin:** Add ability to upload trace JSON. [#37483](https://github.com/grafana/grafana/pull/37483), [@zoltanbedi](https://github.com/zoltanbedi)

### Bug fixes

- **Admin:** Prevent user from deleting user's current/active organization. [#38056](https://github.com/grafana/grafana/pull/38056), [@idafurjes](https://github.com/idafurjes)
- **LibraryPanels:** Fix library panel getting saved in the dashboard's folder. [#38978](https://github.com/grafana/grafana/pull/38978), [@hugohaggmark](https://github.com/hugohaggmark)
- **OAuth:** Make generic teams URL and JMES path configurable. [#37233](https://github.com/grafana/grafana/pull/37233), [@djairhogeuens](https://github.com/djairhogeuens)
- **QueryEditor:** Fix broken copy-paste for mouse middle-click (#39117). [#39117](https://github.com/grafana/grafana/pull/39117), [@glintik](https://github.com/glintik)
- **Thresholds:** Fix undefined color in "Add threshold". [#39113](https://github.com/grafana/grafana/pull/39113), [@glintik](https://github.com/glintik)
- **Timeseries:** Add wide-to-long, and fix multi-frame output. [#38670](https://github.com/grafana/grafana/pull/38670), [@ryantxu](https://github.com/ryantxu)
- **TooltipPlugin:** Fix behavior of Shared Crosshair when Tooltip is set to All. [#37285](https://github.com/grafana/grafana/pull/37285), [@nikki-kiga](https://github.com/nikki-kiga)

### Breaking changes

The `monaco-editor` dependency in `grafana-ui` has been updated to a newer version (`0.27.0`), which is not completely backward compatible with the old version (`0.21.2`). The backward incompatible changes are fairly small, but they do exist, so if your code accesses the raw monaco-objects through the `grafana-ui` package, please check the [monaco-editor changelog](https://github.com/microsoft/monaco-editor/blob/main/CHANGELOG.md) and apply any necessary changes. Issue [#39027](https://github.com/grafana/grafana/issues/39027)

The mandatory `css` prop in `grafana/ui` components has been removed.

Previous versions of `grafana/ui` components were typed incorrectly due to a dependency mismatch between emotion 10 and 11 causing a `css` prop to be added to components that extended react types.
Issue [#38078](https://github.com/grafana/grafana/issues/38078)

### Unified Alerting (Grafana 8 Alerting) data loss

Grafana v8.2 fixed an issue with org isolation for notification configuration but to fix this Grafana will now re-run the migration from old alerting and this will cause complete removal of all new alert rules and notification configurations. This data loss is not something we find acceptable and are working on ways to mitigate it. So in the meantime, if you are an early adopter of unified alerting please wait with trying v8.2 beta.
Issue [#37414](https://github.com/grafana/grafana/issues/37414)

Panel queries and/or annotation queries that used more than one statistic will be converted into one query/annotation per statistic. In case an alerting rule was based on a query row that had more than one statistic, it would now be based only on the first statistic for that query row. New alerting rules will not be created for migrated queries. Please note that in most cases it would not make sense to have an alerting rule that is based on multiple statistics anyway. Issue [#36925](https://github.com/grafana/grafana/issues/36925)

### Deprecations

`getHighlighterExpressions` in datasource APIs ( used to highlight logs while editing queries) has been deprecated and will be removed in a future release.

# Deprecation notice

`ExploreQueryFieldProps` interface for query editors has been deprecated and will be removed in a future release. Use `QueryEditorProps` instead. Issue [#38942](https://github.com/grafana/grafana/issues/38942)

### Plugin development fixes & changes

- **Grafana UI:** Fix TS error property `css` is missing in type. [#38078](https://github.com/grafana/grafana/pull/38078), [@jackw](https://github.com/jackw)

<!-- 8.2.0-beta1 END -->

<!-- 8.1.8 START -->

# 8.1.8 (2021-12-07)

- **Security**: Fixes CVE-2021-43798. For more information, see our [blog](https://grafana.com/blog/2021/12/07/grafana-8.3.1-8.2.7-8.1.8-and-8.0.7-released-with-high-severity-security-fix/)

<!-- 8.1.8 END -->

<!-- 8.1.7 START -->

# 8.1.7 (2021-10-06)

### Bug fixes

- **Alerting:** Fix alerts with evaluation interval more than 30 seconds resolving before notification. [#39513](https://github.com/grafana/grafana/pull/39513), [@gerobinson](https://github.com/gerobinson)
- **Elasticsearch/Prometheus:** Fix usage of proper SigV4 service namespace. [#39439](https://github.com/grafana/grafana/pull/39439), [@marefr](https://github.com/marefr)

<!-- 8.1.7 END -->

<!-- 8.1.6 START -->

# 8.1.6 (2021-10-05)

- **Security**: Fixes CVE-2021-39226. For more information, see our [blog](https://grafana.com/blog/2021/10/05/grafana-7.5.11-and-8.1.6-released-with-critical-security-fix/)

<!-- 8.1.6 END -->

<!-- 8.1.5 START -->

# 8.1.5 (2021-09-21)

### Bug fixes

- **BarChart:** Fixes panel error that happens on second refresh. [#39304](https://github.com/grafana/grafana/pull/39304), [@DanCech](https://github.com/DanCech)

<!-- 8.1.5 END -->

<!-- 8.1.4 START -->

# 8.1.4 (2021-09-16)

### Features and enhancements

- **Explore:** Ensure logs volume bar colors match legend colors. [#39072](https://github.com/grafana/grafana/pull/39072), [@ifrost](https://github.com/ifrost)
- **LDAP:** Search all DNs for users. [#38891](https://github.com/grafana/grafana/pull/38891), [@sakjur](https://github.com/sakjur)

### Bug fixes

- **Alerting:** Fix notification channel migration. [#38983](https://github.com/grafana/grafana/pull/38983), [@papagian](https://github.com/papagian)
- **Annotations:** Fix blank panels for queries with unknown data sources. [#39017](https://github.com/grafana/grafana/pull/39017), [@hugohaggmark](https://github.com/hugohaggmark)
- **BarChart:** Fix stale values and x axis labels. [#39188](https://github.com/grafana/grafana/pull/39188), [@leeoniya](https://github.com/leeoniya)
- **Graph:** Make old graph panel thresholds work even if ngalert is enabled. [#38918](https://github.com/grafana/grafana/pull/38918), [@domasx2](https://github.com/domasx2)
- **InfluxDB:** Fix regex to identify `/` as separator. [#39185](https://github.com/grafana/grafana/pull/39185), [@dsotirakis](https://github.com/dsotirakis)
- **LibraryPanels:** Fix update issues related to library panels in rows. [#38963](https://github.com/grafana/grafana/pull/38963), [@hugohaggmark](https://github.com/hugohaggmark)
- **Variables:** Fix variables not updating inside a Panel when the preceding Row uses "Repeat For". [#38935](https://github.com/grafana/grafana/pull/38935), [@axelavargas](https://github.com/axelavargas)

<!-- 8.1.4 END -->
<!-- 8.1.3 START -->

# 8.1.3 (2021-09-08)

### Bug fixes

- **Alerting:** Fix alert flapping in the internal alertmanager. [#38648](https://github.com/grafana/grafana/pull/38648), [@gotjosh](https://github.com/gotjosh)
- **Alerting:** Fix request handler failed to convert dataframe "results" to plugins.DataTimeSeriesSlice: input frame is not recognized as a time series. [#38587](https://github.com/grafana/grafana/pull/38587), [@idafurjes](https://github.com/idafurjes)
- **Dashboard:** Fix UIDs are not preserved when importing/creating dashboards thru importing .json file. [#38659](https://github.com/grafana/grafana/pull/38659), [@axelavargas](https://github.com/axelavargas)
- **Dashboard:** Forces panel re-render when exiting panel edit. [#38913](https://github.com/grafana/grafana/pull/38913), [@hugohaggmark](https://github.com/hugohaggmark)
- **Dashboard:** Prevent folder from changing when navigating to general settings. [#38103](https://github.com/grafana/grafana/pull/38103), [@hugohaggmark](https://github.com/hugohaggmark)
- **Docker:** Force use of libcrypto1.1 and libssl1.1 versions to fix CVE-2021-3711. [#38585](https://github.com/grafana/grafana/pull/38585), [@dsotirakis](https://github.com/dsotirakis)
- **Elasticsearch:** Fix metric names for alert queries. [#38546](https://github.com/grafana/grafana/pull/38546), [@dsotirakis](https://github.com/dsotirakis)
- **Elasticsearch:** Limit Histogram field parameter to numeric values. [#38631](https://github.com/grafana/grafana/pull/38631), [@Elfo404](https://github.com/Elfo404)
- **Elasticsearch:** Prevent pipeline aggregations to show up in terms order by options. [#38448](https://github.com/grafana/grafana/pull/38448), [@Elfo404](https://github.com/Elfo404)
- **LibraryPanels:** Prevent duplicate repeated panels from being created. [#38804](https://github.com/grafana/grafana/pull/38804), [@hugohaggmark](https://github.com/hugohaggmark)
- **Loki:** Fix ad-hoc filter in dashboard when used with parser. [#38542](https://github.com/grafana/grafana/pull/38542), [@ivanahuckova](https://github.com/ivanahuckova)
- **Plugins:** Track signed files + add warn log for plugin assets which are not signed. [#38938](https://github.com/grafana/grafana/pull/38938), [@wbrowne](https://github.com/wbrowne)
- **Postgres/MySQL/MSSQL:** Fix region annotations not displayed correctly. [#38936](https://github.com/grafana/grafana/pull/38936), [@marefr](https://github.com/marefr)
- **Prometheus:** Fix validate selector in metrics browser. [#38921](https://github.com/grafana/grafana/pull/38921), [@ivanahuckova](https://github.com/ivanahuckova)
- **Security:** Fix stylesheet injection vulnerability [#38432](https://github.com/grafana/grafana/pull/38432), [@idafurjes](https://github.com/idafurjes). Big thanks to Tobias Hamann and Lauritz Holtmann of usd AG for reporting this issue.
- **Security:** Fix short URL vulnerability [#38436](https://github.com/grafana/grafana/pull/38436), [@idafurjes](https://github.com/idafurjes). Big thanks to Tobias Hamann and Lauritz Holtmann of usd AG for reporting this issue.

<!-- 8.1.3 END -->
<!-- 8.1.2 START -->

# 8.1.2 (2021-08-19)

### Features and enhancements

- **AzureMonitor:** Add support for PostgreSQL and MySQL Flexible Servers. [#38075](https://github.com/grafana/grafana/pull/38075), [@joshhunt](https://github.com/joshhunt)
- **Datasource:** Change HTTP status code for failed datasource health check to 400. [#37895](https://github.com/grafana/grafana/pull/37895), [@stephaniehingtgen](https://github.com/stephaniehingtgen)
- **Explore:** Add span duration to left panel in trace viewer. [#37806](https://github.com/grafana/grafana/pull/37806), [@connorlindsey](https://github.com/connorlindsey)
- **Plugins:** Use file extension allowlist when serving plugin assets instead of checking for UNIX executable. [#37688](https://github.com/grafana/grafana/pull/37688), [@wbrowne](https://github.com/wbrowne)
- **Profiling:** Add support for binding pprof server to custom network interfaces. [#36580](https://github.com/grafana/grafana/pull/36580), [@cinaglia](https://github.com/cinaglia)
- **Search:** Make search icon keyboard navigable. [#37865](https://github.com/grafana/grafana/pull/37865), [@tskarhed](https://github.com/tskarhed)
- **Template variables:** Keyboard navigation improvements. [#38001](https://github.com/grafana/grafana/pull/38001), [@tskarhed](https://github.com/tskarhed)
- **Tooltip:** Display ms within minute time range. [#37569](https://github.com/grafana/grafana/pull/37569), [@nikki-kiga](https://github.com/nikki-kiga)

### Bug fixes

- **Alerting:** Fix saving LINE contact point. [#37744](https://github.com/grafana/grafana/pull/37744), [@xy-man](https://github.com/xy-man)
- **Alerting:** Fix saving LINE contact point. [#37718](https://github.com/grafana/grafana/pull/37718), [@xy-man](https://github.com/xy-man)
- **Annotations:** Fix alerting annotation coloring. [#37412](https://github.com/grafana/grafana/pull/37412), [@kylebrandt](https://github.com/kylebrandt)
- **Annotations:** Alert annotations are now visible in the correct Panel. [#37959](https://github.com/grafana/grafana/pull/37959), [@hugohaggmark](https://github.com/hugohaggmark)
- **Auth:** Hide SigV4 config UI and disable middleware when its config flag is disabled. [#37293](https://github.com/grafana/grafana/pull/37293), [@wbrowne](https://github.com/wbrowne)
- **Dashboard:** Prevent incorrect panel layout by comparing window width against theme breakpoints. [#37868](https://github.com/grafana/grafana/pull/37868), [@ashharrison90](https://github.com/ashharrison90)
- **Elasticsearch:** Fix metric names for alert queries. [#37871](https://github.com/grafana/grafana/pull/37871), [@dsotirakis](https://github.com/dsotirakis)
- **Explore:** Fix showing of full log context. [#37442](https://github.com/grafana/grafana/pull/37442), [@ivanahuckova](https://github.com/ivanahuckova)
- **PanelEdit:** Fix 'Actual' size by passing the correct panel size to Das…. [#37885](https://github.com/grafana/grafana/pull/37885), [@ashharrison90](https://github.com/ashharrison90)
- **Plugins:** Fix TLS datasource settings. [#37797](https://github.com/grafana/grafana/pull/37797), [@wbrowne](https://github.com/wbrowne)
- **Variables:** Fix issue with empty drop downs on navigation. [#37776](https://github.com/grafana/grafana/pull/37776), [@hugohaggmark](https://github.com/hugohaggmark)
- **Variables:** Fix URL util converting `false` into `true`. [#37402](https://github.com/grafana/grafana/pull/37402), [@simPod](https://github.com/simPod)

### Plugin development fixes & changes

- **Toolkit:** Fix matchMedia not found error. [#37643](https://github.com/grafana/grafana/pull/37643), [@zoltanbedi](https://github.com/zoltanbedi)

<!-- 8.1.2 END -->
<!-- 8.1.1 START -->

# 8.1.1 (2021-08-09)

### Bug fixes

- **CloudWatch Logs:** Fix crash when no region is selected. [#37639](https://github.com/grafana/grafana/pull/37639), [@aocenas](https://github.com/aocenas)
- **Reporting:** Fix timezone parsing for scheduler. (Enterprise)

<!-- 8.1.1 END -->
<!-- 8.1.0 START -->

# 8.1.0 (2021-08-05)

### Features and enhancements

- **Alerting:** Deduplicate receivers during migration. [#36812](https://github.com/grafana/grafana/pull/36812), [@codesome](https://github.com/codesome)
- **ColorPicker:** Display colors as RGBA. [#37231](https://github.com/grafana/grafana/pull/37231), [@nikki-kiga](https://github.com/nikki-kiga)
- **Encryption:** Add support for multiple encryption algorithms (aes-gcm). (Enterprise)
- **Select:** Make portalling the menu opt-in, but opt-in _everywhere_. [#37501](https://github.com/grafana/grafana/pull/37501), [@ashharrison90](https://github.com/ashharrison90)
- **TeamSync:** Batch team synchronization. (Enterprise)
- **TimeRangePicker:** Improve accessibility. [#36912](https://github.com/grafana/grafana/pull/36912), [@tskarhed](https://github.com/tskarhed)

### Bug fixes

- **Annotations:** Correct annotations that are displayed upon page refresh. [#37496](https://github.com/grafana/grafana/pull/37496), [@axelavargas](https://github.com/axelavargas)
- **Annotations:** Fix **Enabled** button that disappeared from Grafana v8.0.6. [#37454](https://github.com/grafana/grafana/pull/37454), [@axelavargas](https://github.com/axelavargas)
- **Annotations:** Fix data source template variable that was not available for annotations. [#37506](https://github.com/grafana/grafana/pull/37506), [@axelavargas](https://github.com/axelavargas)
- **AzureMonitor:** Fix annotations query editor that does not load. [#37476](https://github.com/grafana/grafana/pull/37476), [@torkelo](https://github.com/torkelo)
- **Geomap:** Fix scale calculations. [#37375](https://github.com/grafana/grafana/pull/37375), [@ryantxu](https://github.com/ryantxu)
- **GraphNG:** Fix y-axis autosizing. [#37464](https://github.com/grafana/grafana/pull/37464), [@leeoniya](https://github.com/leeoniya)
- **Live:** Display stream rate and fix duplicate channels in list response. [#37365](https://github.com/grafana/grafana/pull/37365), [@FZambia](https://github.com/FZambia)
- **Loki:** Update labels in log browser when time range changes. [#37520](https://github.com/grafana/grafana/pull/37520), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Update labels in log browser when time range changes in dashboard. [#37541](https://github.com/grafana/grafana/pull/37541), [@ivanahuckova](https://github.com/ivanahuckova)
- **NGAlert:** Send resolve signal to alertmanager on alerting -> Normal. [#37363](https://github.com/grafana/grafana/pull/37363), [@kylebrandt](https://github.com/kylebrandt)
- **PasswordField:** Prevent a password from being displayed when you click the Enter button. [#37444](https://github.com/grafana/grafana/pull/37444), [@tskarhed](https://github.com/tskarhed)
- **Renderer:** Remove debug.log file when Grafana is stopped. [#37367](https://github.com/grafana/grafana/pull/37367), [@AgnesToulet](https://github.com/AgnesToulet)
- **Security:** Update dependencies to fix CVE-2021-36222. [#37546](https://github.com/grafana/grafana/pull/37546), [@ying-jeanne](https://github.com/ying-jeanne)

<!-- 8.1.0 END -->

<!-- 8.1.0-beta3 START -->

# 8.1.0-beta3 (2021-07-29)

### Features and enhancements

- **Alerting:** Support label matcher syntax in alert rule list filter. [#36408](https://github.com/grafana/grafana/pull/36408), [@nathanrodman](https://github.com/nathanrodman)
- **IconButton:** Put tooltip text as aria-label. [#36760](https://github.com/grafana/grafana/pull/36760), [@tskarhed](https://github.com/tskarhed)
- **Live:** Experimental HA with Redis. [#36787](https://github.com/grafana/grafana/pull/36787), [@FZambia](https://github.com/FZambia)
- **UI:** FileDropzone component. [#36646](https://github.com/grafana/grafana/pull/36646), [@zoltanbedi](https://github.com/zoltanbedi)
- **[v8.1.x] CloudWatch:** Add AWS LookoutMetrics. [#37329](https://github.com/grafana/grafana/pull/37329), [@ilyastoli](https://github.com/ilyastoli)

### Bug fixes

- **Docker:** Fix builds by delaying go mod verify until all required files are copied over. [#37246](https://github.com/grafana/grafana/pull/37246), [@wbrowne](https://github.com/wbrowne)
- **Exemplars:** Fix disable exemplars only on the query that failed. [#37296](https://github.com/grafana/grafana/pull/37296), [@zoltanbedi](https://github.com/zoltanbedi)
- **SQL:** Fix SQL dataframe resampling (fill mode + time intervals). [#36937](https://github.com/grafana/grafana/pull/36937), [@idafurjes](https://github.com/idafurjes)

<!-- 8.1.0-beta3 END -->

<!-- 8.1.0-beta2 START -->

# 8.1.0-beta2 (2021-07-23)

### Features and enhancements

- **Alerting:** Expand the value string in alert annotations and labels. [#37051](https://github.com/grafana/grafana/pull/37051), [@gerobinson](https://github.com/gerobinson)
- **Auth:** Add Azure HTTP authentication middleware. [#36932](https://github.com/grafana/grafana/pull/36932), [@kostrse](https://github.com/kostrse)
- **Auth:** Auth: Pass user role when using the authentication proxy. [#36729](https://github.com/grafana/grafana/pull/36729), [@yuwaMSFT2](https://github.com/yuwaMSFT2)
- **Gazetteer:** Update countries.json file to allow for linking to 3-letter country codes. [#37129](https://github.com/grafana/grafana/pull/37129), [@bryanuribe](https://github.com/bryanuribe)

### Bug fixes

- **Config:** Fix Docker builds by correcting formatting in sample.ini. [#37106](https://github.com/grafana/grafana/pull/37106), [@FZambia](https://github.com/FZambia)
- **Explore:** Fix encoding of internal URLs. [#36919](https://github.com/grafana/grafana/pull/36919), [@aocenas](https://github.com/aocenas)

<!-- 8.1.0-beta2 END -->
<!-- 8.1.0-beta1 START -->

# 8.1.0-beta1 (2021-07-22)

### Features and enhancements

- **Alerting:** Add Alertmanager notifications tab. [#35759](https://github.com/grafana/grafana/pull/35759), [@nathanrodman](https://github.com/nathanrodman)
- **Alerting:** Add button to deactivate current Alertmanager configuration. [#36951](https://github.com/grafana/grafana/pull/36951), [@domasx2](https://github.com/domasx2)
- **Alerting:** Add toggle in Loki/Prometheus data source configuration to opt out of alerting UI. [#36552](https://github.com/grafana/grafana/pull/36552), [@domasx2](https://github.com/domasx2)
- **Alerting:** Allow any "evaluate for" value >=0 in the alert rule form. [#35807](https://github.com/grafana/grafana/pull/35807), [@domasx2](https://github.com/domasx2)
- **Alerting:** Load default configuration from status endpoint, if Cortex Alertmanager returns empty user configuration. [#35769](https://github.com/grafana/grafana/pull/35769), [@domasx2](https://github.com/domasx2)
- **Alerting:** view to display alert rule and its underlying data. [#35546](https://github.com/grafana/grafana/pull/35546), [@mckn](https://github.com/mckn)
- **Annotation panel:** Release the annotation panel. [#36959](https://github.com/grafana/grafana/pull/36959), [@ryantxu](https://github.com/ryantxu)
- **Annotations:** Add typeahead support for tags in built-in annotations. [#36377](https://github.com/grafana/grafana/pull/36377), [@ashharrison90](https://github.com/ashharrison90)
- **AzureMonitor:** Add curated dashboards for Azure services. [#35356](https://github.com/grafana/grafana/pull/35356), [@avidhanju](https://github.com/avidhanju)
- **AzureMonitor:** Add support for deep links to Microsoft Azure portal for Metrics. [#32273](https://github.com/grafana/grafana/pull/32273), [@shuotli](https://github.com/shuotli)
- **AzureMonitor:** Remove support for different credentials for Azure Monitor Logs. [#35121](https://github.com/grafana/grafana/pull/35121), [@andresmgot](https://github.com/andresmgot)
- **AzureMonitor:** Support querying any Resource for Logs queries. [#33879](https://github.com/grafana/grafana/pull/33879), [@joshhunt](https://github.com/joshhunt)
- **Elasticsearch:** Add frozen indices search support. [#36018](https://github.com/grafana/grafana/pull/36018), [@Elfo404](https://github.com/Elfo404)
- **Elasticsearch:** Name fields after template variables values instead of their name. [#36035](https://github.com/grafana/grafana/pull/36035), [@Elfo404](https://github.com/Elfo404)
- **Elasticsearch:** add rate aggregation. [#33311](https://github.com/grafana/grafana/pull/33311), [@estermv](https://github.com/estermv)
- **Email:** Allow configuration of content types for email notifications. [#34530](https://github.com/grafana/grafana/pull/34530), [@djairhogeuens](https://github.com/djairhogeuens)
- **Explore:** Add more meta information when line limit is hit. [#33069](https://github.com/grafana/grafana/pull/33069), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore:** UI improvements to trace view. [#34276](https://github.com/grafana/grafana/pull/34276), [@aocenas](https://github.com/aocenas)
- **FieldOverrides:** Added support to change display name in an override field and have it be matched by a later rule. [#35893](https://github.com/grafana/grafana/pull/35893), [@torkelo](https://github.com/torkelo)
- **HTTP Client:** Introduce `dataproxy_max_idle_connections` config variable. [#35864](https://github.com/grafana/grafana/pull/35864), [@dsotirakis](https://github.com/dsotirakis)
- **InfluxDB:** InfluxQL: adds tags to timeseries data. [#36702](https://github.com/grafana/grafana/pull/36702), [@gabor](https://github.com/gabor)
- **InfluxDB:** InfluxQL: make measurement search case insensitive. [#34563](https://github.com/grafana/grafana/pull/34563), [@gabor](https://github.com/gabor)
- **Legacy Alerting:** Replace simplejson with a struct in webhook notification channel. [#34952](https://github.com/grafana/grafana/pull/34952), [@KEVISONG](https://github.com/KEVISONG)
- **Legend:** Updates display name for Last (not null) to just Last\*. [#35633](https://github.com/grafana/grafana/pull/35633), [@torkelo](https://github.com/torkelo)
- **Logs panel:** Add option to show common labels. [#36166](https://github.com/grafana/grafana/pull/36166), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Add \$\_\_range variable. [#36175](https://github.com/grafana/grafana/pull/36175), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Add support for "label_values(log stream selector, label)" in templating. [#35488](https://github.com/grafana/grafana/pull/35488), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Add support for ad-hoc filtering in dashboard. [#36393](https://github.com/grafana/grafana/pull/36393), [@ivanahuckova](https://github.com/ivanahuckova)
- **MySQL Datasource:** Add timezone parameter. [#27535](https://github.com/grafana/grafana/pull/27535), [@andipabst](https://github.com/andipabst)
- **NodeGraph:** Show gradient fields in legend. [#34078](https://github.com/grafana/grafana/pull/34078), [@aocenas](https://github.com/aocenas)
- **PanelOptions:** Don't mutate panel options/field config object when updating. [#36441](https://github.com/grafana/grafana/pull/36441), [@dprokop](https://github.com/dprokop)
- **PieChart:** Make pie gradient more subtle to match other charts. [#36961](https://github.com/grafana/grafana/pull/36961), [@nikki-kiga](https://github.com/nikki-kiga)
- **Prometheus:** Update PromQL typeahead and highlighting. [#36730](https://github.com/grafana/grafana/pull/36730), [@ekpdt](https://github.com/ekpdt)
- **Prometheus:** interpolate variable for step field. [#36437](https://github.com/grafana/grafana/pull/36437), [@zoltanbedi](https://github.com/zoltanbedi)
- **Provisioning:** Improve validation by validating across all dashboard providers. [#26742](https://github.com/grafana/grafana/pull/26742), [@nabokihms](https://github.com/nabokihms)
- **Query cache:** Adding an encryption option for caching. (Enterprise)
- **Reporting:** Use start and end dates for scheduling. (Enterprise)
- **SQL Datasources:** Allow multiple string/labels columns with time series. [#36485](https://github.com/grafana/grafana/pull/36485), [@kylebrandt](https://github.com/kylebrandt)
- **Select:** Portal select menu to document.body. [#36398](https://github.com/grafana/grafana/pull/36398), [@ashharrison90](https://github.com/ashharrison90)
- **Team Sync:** Add group mapping to support team sync in the Generic OAuth provider. [#36307](https://github.com/grafana/grafana/pull/36307), [@wardbekker](https://github.com/wardbekker)
- **Tooltip:** Make active series more noticeable. [#36824](https://github.com/grafana/grafana/pull/36824), [@nikki-kiga](https://github.com/nikki-kiga)
- **Tracing:** Add support to configure trace to logs start and end time. [#34995](https://github.com/grafana/grafana/pull/34995), [@zoltanbedi](https://github.com/zoltanbedi)
- **Transformations:** Skip merge when there is only a single data frame. [#36407](https://github.com/grafana/grafana/pull/36407), [@edgarpoce](https://github.com/edgarpoce)
- **ValueMapping:** Added support for mapping text to color, boolean values, NaN and Null. Improved UI for value mapping. [#33820](https://github.com/grafana/grafana/pull/33820), [@torkelo](https://github.com/torkelo)
- **Visualizations:** Dynamically set any config (min, max, unit, color, thresholds) from query results. [#36548](https://github.com/grafana/grafana/pull/36548), [@torkelo](https://github.com/torkelo)
- **live:** Add support to handle origin without a value for the port when matching with root_url. [#36834](https://github.com/grafana/grafana/pull/36834), [@FZambia](https://github.com/FZambia)

### Bug fixes

- **Alerting:** Handle marshaling Inf values. [#36947](https://github.com/grafana/grafana/pull/36947), [@kylebrandt](https://github.com/kylebrandt)
- **AzureMonitor:** Fix macro resolution for template variables. [#36944](https://github.com/grafana/grafana/pull/36944), [@andresmgot](https://github.com/andresmgot)
- **AzureMonitor:** Fix queries with Microsoft.NetApp/../../volumes resources. [#32661](https://github.com/grafana/grafana/pull/32661), [@pckls](https://github.com/pckls)
- **AzureMonitor:** Request and concat subsequent resource pages. [#36958](https://github.com/grafana/grafana/pull/36958), [@andresmgot](https://github.com/andresmgot)
- **Bug:** Fix parse duration for day. [#36942](https://github.com/grafana/grafana/pull/36942), [@idafurjes](https://github.com/idafurjes)
- **Datasources:** Improve error handling for error messages. [#35120](https://github.com/grafana/grafana/pull/35120), [@ifrost](https://github.com/ifrost)
- **Explore:** Correct the functionality of shift-enter shortcut across all uses. [#36600](https://github.com/grafana/grafana/pull/36600), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore:** Show all dataFrames in data tab in Inspector. [#32161](https://github.com/grafana/grafana/pull/32161), [@ivanahuckova](https://github.com/ivanahuckova)
- **GraphNG:** Fix Tooltip mode 'All' for XYChart. [#31260](https://github.com/grafana/grafana/pull/31260), [@Posnet](https://github.com/Posnet)
- **Loki:** Fix highlight of logs when using filter expressions with backticks. [#36024](https://github.com/grafana/grafana/pull/36024), [@ivanahuckova](https://github.com/ivanahuckova)
- **Modal:** Force modal content to overflow with scroll. [#36754](https://github.com/grafana/grafana/pull/36754), [@ashharrison90](https://github.com/ashharrison90)
- **Plugins:** Ignore symlinked folders when verifying plugin signature. [#34434](https://github.com/grafana/grafana/pull/34434), [@wbrowne](https://github.com/wbrowne)

### Breaking changes

When parsing Elasticsearch query responses using template variables, each field gets named after the variable value instead of the name.
For example, executing a `terms` aggregation on a variable named `$groupBy` that has `@hostname` as a value, the resulting column in the table response will be `@hostname` instead of `$groupBy` Issue [#36035](https://github.com/grafana/grafana/issues/36035)

Azure Monitor data source no longer supports different credentials for Metrics and Logs in existing data sources. To use different credentials for Azure Monitor Logs, create another data source. Issue [#35121](https://github.com/grafana/grafana/issues/35121)

Existing Azure Metrics Logs queries for Log Analytics Workspaces should be backward compatible with this change and should not get impacted. Panels will be migrated to use the new resource-centric backend when you first edit and save them.

Application Insights and Insights Analytics queries are now read-only and cannot be modified. To update Application Insights queries, users can manually recreate them as Metrics queries, and Insights Analytics are recreated with Logs.

Issue [#33879](https://github.com/grafana/grafana/issues/33879)

### Plugin development fixes & changes

- **Toolkit:** Improve error messages when tasks fail. [#36381](https://github.com/grafana/grafana/pull/36381), [@joshhunt](https://github.com/joshhunt)

<!-- 8.1.0-beta1 END -->

<!-- 8.0.7 START -->

# 8.0.7 (2021-12-07)

- **Security**: Fixes CVE-2021-43798. For more information, see our [blog](https://grafana.com/blog/2021/12/07/grafana-8.3.1-8.2.7-8.1.8-and-8.0.7-released-with-high-severity-security-fix/)

<!-- 8.0.7 END -->

<!-- 8.0.6 START -->

# 8.0.6 (2021-07-14)

### Features and enhancements

- **Alerting:** Add annotation upon alert state change. [#36535](https://github.com/grafana/grafana/pull/36535), [@davidmparrott](https://github.com/davidmparrott)
- **Alerting:** Allow space in label and annotation names. [#36549](https://github.com/grafana/grafana/pull/36549), [@codesome](https://github.com/codesome)
- **InfluxDB:** Improve legend labels for InfluxDB query results. [#36603](https://github.com/grafana/grafana/pull/36603), [@gabor](https://github.com/gabor)

### Bug fixes

- **Alerting:** Fix improper alert by changing the handling of empty labels. [#36679](https://github.com/grafana/grafana/pull/36679), [@davidmparrott](https://github.com/davidmparrott)
- **CloudWatch/Logs:** Reestablish Cloud Watch alert behavior. [#36558](https://github.com/grafana/grafana/pull/36558), [@aocenas](https://github.com/aocenas)
- **Dashboard:** Avoid migration breaking on fieldConfig without defaults field in folded panel. [#36666](https://github.com/grafana/grafana/pull/36666), [@glindstedt](https://github.com/glindstedt)
- **DashboardList:** Fix issue not re-fetching dashboard list after variable change. [#36591](https://github.com/grafana/grafana/pull/36591), [@torkelo](https://github.com/torkelo)
- **Database:** Fix incorrect format of isolation level configuration parameter for MySQL. [#36565](https://github.com/grafana/grafana/pull/36565), [@marefr](https://github.com/marefr)
- **InfluxDB:** Correct tag filtering on InfluxDB data. [#36570](https://github.com/grafana/grafana/pull/36570), [@gabor](https://github.com/gabor)
- **Links:** Fix links that caused a full page reload. [#36631](https://github.com/grafana/grafana/pull/36631), [@torkelo](https://github.com/torkelo)
- **Live:** Fix HTTP error when InfluxDB metrics have an incomplete or asymmetrical field set. [#36664](https://github.com/grafana/grafana/pull/36664), [@FZambia](https://github.com/FZambia)
- **Postgres/MySQL/MSSQL:** Change time field to "Time" for time series queries. [#36720](https://github.com/grafana/grafana/pull/36720), [@marefr](https://github.com/marefr)
- **Postgres:** Fix the handling of a null return value in query results. [#36648](https://github.com/grafana/grafana/pull/36648), [@idafurjes](https://github.com/idafurjes)
- **Tempo:** Show hex strings instead of uints for IDs. [#36471](https://github.com/grafana/grafana/pull/36471), [@zoltanbedi](https://github.com/zoltanbedi)
- **TimeSeries:** Improve tooltip positioning when tooltip overflows. [#36440](https://github.com/grafana/grafana/pull/36440), [@ashharrison90](https://github.com/ashharrison90)
- **Transformations:** Add 'prepare time series' transformer. [#36737](https://github.com/grafana/grafana/pull/36737), [@ryantxu](https://github.com/ryantxu)

<!-- 8.0.6 END -->

<!-- 8.0.5 START -->

# 8.0.5 (2021-07-08)

### Features and enhancements

- **Cloudwatch Logs:** Send error down to client. [#36277](https://github.com/grafana/grafana/pull/36277), [@zoltanbedi](https://github.com/zoltanbedi)
- **Folders:** Return 409 Conflict status when folder already exists. [#36429](https://github.com/grafana/grafana/pull/36429), [@dsotirakis](https://github.com/dsotirakis)
- **TimeSeries:** Do not show series in tooltip if it's hidden in the viz. [#36353](https://github.com/grafana/grafana/pull/36353), [@dprokop](https://github.com/dprokop)

### Bug fixes

- **AzureMonitor:** Fix issue where resource group name is missing on the resource picker button. [#36400](https://github.com/grafana/grafana/pull/36400), [@joshhunt](https://github.com/joshhunt)
- **Chore:** Fix AWS auth assuming role with workspace IAM. [#36430](https://github.com/grafana/grafana/pull/36430), [@wbrowne](https://github.com/wbrowne)
- **DashboardQueryRunner:** Fixes unrestrained subscriptions being created. [#36371](https://github.com/grafana/grafana/pull/36371), [@hugohaggmark](https://github.com/hugohaggmark)
- **DateFormats:** Fix reading correct setting key for use_browser_locale. [#36428](https://github.com/grafana/grafana/pull/36428), [@torkelo](https://github.com/torkelo)
- **Links:** Fix links to other apps outside Grafana when under sub path. [#36498](https://github.com/grafana/grafana/pull/36498), [@torkelo](https://github.com/torkelo)
- **Snapshots:** Fix snapshot absolute time range issue. [#36350](https://github.com/grafana/grafana/pull/36350), [@torkelo](https://github.com/torkelo)
- **Table:** Fix data link color. [#36446](https://github.com/grafana/grafana/pull/36446), [@tharun208](https://github.com/tharun208)
- **Time Series:** Fix X-axis time format when tick increment is larger than a year. [#36335](https://github.com/grafana/grafana/pull/36335), [@torkelo](https://github.com/torkelo)
- **Tooltip Plugin:** Prevent tooltip render if field is undefined. [#36260](https://github.com/grafana/grafana/pull/36260), [@ashharrison90](https://github.com/ashharrison90)

<!-- 8.0.5 END -->

<!-- 8.0.4 START -->

# 8.0.4 (2021-07-01)

### Features and enhancements

- **Live:** Rely on app url for origin check. [#35983](https://github.com/grafana/grafana/pull/35983), [@FZambia](https://github.com/FZambia)
- **PieChart:** Sort legend descending, update placeholder to show default …. [#36062](https://github.com/grafana/grafana/pull/36062), [@ashharrison90](https://github.com/ashharrison90)
- **TimeSeries panel:** Do not reinitialize plot when thresholds mode change. [#35952](https://github.com/grafana/grafana/pull/35952), [@dprokop](https://github.com/dprokop)

### Bug fixes

- **Elasticsearch:** Allow case sensitive custom options in date_histogram interval. [#36168](https://github.com/grafana/grafana/pull/36168), [@Elfo404](https://github.com/Elfo404)
- **Elasticsearch:** Restore previous field naming strategy when using variables. [#35624](https://github.com/grafana/grafana/pull/35624), [@Elfo404](https://github.com/Elfo404)
- **Explore:** Fix import of queries between SQL data sources. [#36210](https://github.com/grafana/grafana/pull/36210), [@ivanahuckova](https://github.com/ivanahuckova)
- **InfluxDB:** InfluxQL query editor: fix retention policy handling. [#36022](https://github.com/grafana/grafana/pull/36022), [@gabor](https://github.com/gabor)
- **Loki:** Send correct time range in template variable queries. [#36268](https://github.com/grafana/grafana/pull/36268), [@ivanahuckova](https://github.com/ivanahuckova)
- **TimeSeries:** Preserve RegExp series overrides when migrating from old graph panel. [#36134](https://github.com/grafana/grafana/pull/36134), [@ashharrison90](https://github.com/ashharrison90)

<!-- 8.0.4 END -->

<!-- 8.0.3 START -->

# 8.0.3 (2021-06-18)

### Features and enhancements

- **Alerting:** Increase alertmanager_conf column if MySQL. [#35657](https://github.com/grafana/grafana/pull/35657), [@kylebrandt](https://github.com/kylebrandt)
- **Time series/Bar chart panel:** Handle infinite numbers as nulls when converting to plot array. [#35638](https://github.com/grafana/grafana/pull/35638), [@dprokop](https://github.com/dprokop)
- **TimeSeries:** Ensure series overrides that contain color are migrated, and migrate the previous `fieldConfig` when changing the panel type. [#35676](https://github.com/grafana/grafana/pull/35676), [@ashharrison90](https://github.com/ashharrison90)
- **ValueMappings:** Improve singlestat value mappings migration. [#35578](https://github.com/grafana/grafana/pull/35578), [@dprokop](https://github.com/dprokop)

### Bug fixes

- **Annotations:** Fix annotation line and marker colors. [#35608](https://github.com/grafana/grafana/pull/35608), [@torkelo](https://github.com/torkelo)
- **AzureMonitor:** Fix KQL template variable queries without default workspace. [#35836](https://github.com/grafana/grafana/pull/35836), [@joshhunt](https://github.com/joshhunt)
- **CloudWatch/Logs:** Fix missing response data for log queries. [#35724](https://github.com/grafana/grafana/pull/35724), [@aocenas](https://github.com/aocenas)
- **Elasticsearch:** Restore previous field naming strategy when using variables. [#35624](https://github.com/grafana/grafana/pull/35624), [@Elfo404](https://github.com/Elfo404)
- **LibraryPanels:** Fix crash in library panels list when panel plugin is not found. [#35907](https://github.com/grafana/grafana/pull/35907), [@torkelo](https://github.com/torkelo)
- **LogsPanel:** Fix performance drop when moving logs panel in dashboard. [#35379](https://github.com/grafana/grafana/pull/35379), [@aocenas](https://github.com/aocenas)
- **Loki:** Parse log levels when ANSI coloring is enabled. [#35607](https://github.com/grafana/grafana/pull/35607), [@olbo98](https://github.com/olbo98)
- **MSSQL:** Fix issue with hidden queries still being executed. [#35787](https://github.com/grafana/grafana/pull/35787), [@torkelo](https://github.com/torkelo)
- **PanelEdit:** Display the VisualizationPicker that was not displayed if a panel has an unknown panel plugin. [#35831](https://github.com/grafana/grafana/pull/35831), [@jackw](https://github.com/jackw)
- **Plugins:** Fix loading symbolically linked plugins. [#35635](https://github.com/grafana/grafana/pull/35635), [@domasx2](https://github.com/domasx2)
- **Prometheus:** Fix issue where legend name was replaced with name Value in stat and gauge panels. [#35863](https://github.com/grafana/grafana/pull/35863), [@torkelo](https://github.com/torkelo)
- **State Timeline:** Fix crash when hovering over panel. [#35692](https://github.com/grafana/grafana/pull/35692), [@hugohaggmark](https://github.com/hugohaggmark)

<!-- 8.0.3 END -->

<!-- 8.0.2 START -->

# 8.0.2 (2021-06-14)

### Features and enhancements

- **Datasource:** Add support for max_conns_per_host in dataproxy settings. [#35520](https://github.com/grafana/grafana/pull/35520), [@jvrplmlmn](https://github.com/jvrplmlmn)

### Bug fixes

- **Configuration:** Fix changing org preferences in FireFox. [#35549](https://github.com/grafana/grafana/pull/35549), [@hugohaggmark](https://github.com/hugohaggmark)
- **PieChart:** Fix legend dimension limits. [#35563](https://github.com/grafana/grafana/pull/35563), [@torkelo](https://github.com/torkelo)
- **Postgres/MySQL/MSSQL:** Fix panic in concurrent map writes. [#35510](https://github.com/grafana/grafana/pull/35510), [@marefr](https://github.com/marefr)
- **Variables:** Hide default data source if missing from regex. [#35561](https://github.com/grafana/grafana/pull/35561), [@hugohaggmark](https://github.com/hugohaggmark)

<!-- 8.0.2 END -->

<!-- 8.0.1 START -->

# 8.0.1 (2021-06-10)

### Bug fixes

- **Alerting/SSE:** Fix "count_non_null" reducer validation. [#35451](https://github.com/grafana/grafana/pull/35451), [@kylebrandt](https://github.com/kylebrandt)
- **Cloudwatch:** Fix duplicated time series. [#35433](https://github.com/grafana/grafana/pull/35433), [@sunker](https://github.com/sunker)
- **Cloudwatch:** Fix missing defaultRegion. [#35436](https://github.com/grafana/grafana/pull/35436), [@andresmgot](https://github.com/andresmgot)
- **Dashboard:** Fix Dashboard init failed error on dashboards with old singlestat panels in collapsed rows. [#35425](https://github.com/grafana/grafana/pull/35425), [@torkelo](https://github.com/torkelo)
- **Datasource:** Fix storing timeout option as numeric. [#35441](https://github.com/grafana/grafana/pull/35441), [@marefr](https://github.com/marefr)
- **Postgres/MySQL/MSSQL:** Fix annotation parsing for empty responses. [#35367](https://github.com/grafana/grafana/pull/35367), [@marcbachmann](https://github.com/marcbachmann)
- **Postgres/MySQL/MSSQL:** Numeric/non-string values are now returned from query variables. [#35411](https://github.com/grafana/grafana/pull/35411), [@marefr](https://github.com/marefr)
- **Postgres:** Fix an error that was thrown when the annotation query did not return any results. [#35382](https://github.com/grafana/grafana/pull/35382), [@dprokop](https://github.com/dprokop)
- **StatPanel:** Fix an issue with the appearance of the graph when switching color mode. [#35460](https://github.com/grafana/grafana/pull/35460), [@torkelo](https://github.com/torkelo)
- **Visualizations:** Fix an issue in the Stat/BarGauge/Gauge/PieChart panels where all values mode were showing the same name if they had the same value. [#35368](https://github.com/grafana/grafana/pull/35368), [@torkelo](https://github.com/torkelo)

### Plugin development fixes & changes

- **Toolkit:** Resolve external fonts when Grafana is served from a sub path. [#35352](https://github.com/grafana/grafana/pull/35352), [@jackw](https://github.com/jackw)

<!-- 8.0.1 END -->

<!-- 8.0.0 START -->

# 8.0.0 (2021-06-08)

### Features and enhancements

- **AzureMonitor:** Require default subscription for workspaces() template variable query. [#35181](https://github.com/grafana/grafana/pull/35181), [@joshhunt](https://github.com/joshhunt)
- **AzureMonitor:** Use resource type display names in the UI. [#35060](https://github.com/grafana/grafana/pull/35060), [@joshhunt](https://github.com/joshhunt)
- **Dashboard:** Remove support for loading and deleting dashboard by slug. [#35104](https://github.com/grafana/grafana/pull/35104), [@dsotirakis](https://github.com/dsotirakis)
- **InfluxDB:** Deprecate direct browser access in data source. [#35105](https://github.com/grafana/grafana/pull/35105), [@gabor](https://github.com/gabor)
- **VizLegend:** Add a read-only property. [#35096](https://github.com/grafana/grafana/pull/35096), [@dprokop](https://github.com/dprokop)

### Bug fixes

- **AzureMonitor:** Fix Azure Resource Graph queries in Azure China. [#35235](https://github.com/grafana/grafana/pull/35235), [@kostrse](https://github.com/kostrse)
- **Checkbox:** Fix vertical layout issue with checkboxes due to fixed height. [#35022](https://github.com/grafana/grafana/pull/35022), [@torkelo](https://github.com/torkelo)
- **Dashboard:** Fix Table view when editing causes the panel data to not update. [#34998](https://github.com/grafana/grafana/pull/34998), [@axelavargas](https://github.com/axelavargas)
- **Dashboard:** Fix issues where unsaved-changes warning is not displayed. [#34989](https://github.com/grafana/grafana/pull/34989), [@torkelo](https://github.com/torkelo)
- **Login:** Fixes Unauthorized message showing when on login page or snapshot page. [#35311](https://github.com/grafana/grafana/pull/35311), [@torkelo](https://github.com/torkelo)
- **NodeGraph:** Fix sorting markers in grid view. [#35200](https://github.com/grafana/grafana/pull/35200), [@aocenas](https://github.com/aocenas)
- **Short URL:** Include orgId in generated short URLs. [#34696](https://github.com/grafana/grafana/pull/34696), [@farodin91](https://github.com/farodin91)
- **Variables:** Support raw values of boolean type. [#34727](https://github.com/grafana/grafana/pull/34727), [@simPod](https://github.com/simPod)

### Breaking changes

The following endpoints were deprecated for Grafana v5.0 and support for them has now been removed:

- GET `/dashboards/db/:slug`
- GET `/dashboard-solo/db/:slug`
- GET `/api/dashboard/db/:slug`
- DELETE `/api/dashboards/db/:slug` Issue [#35104](https://github.com/grafana/grafana/issues/35104)

<!-- 8.0.0 END -->

<!-- 8.0.0-beta3 START -->

# 8.0.0-beta3 (2021-06-01)

### Features and enhancements

- **API:** Support folder UID in dashboards API. [#33991](https://github.com/grafana/grafana/pull/33991), [@zserge](https://github.com/zserge)
- **Alerting:** Add support for configuring avatar URL for the Discord notifier. [#33355](https://github.com/grafana/grafana/pull/33355), [@ChipWolf](https://github.com/ChipWolf)
- **Alerting:** Clarify that Threema Gateway Alerts support only Basic IDs. [#34828](https://github.com/grafana/grafana/pull/34828), [@dbrgn](https://github.com/dbrgn)
- **Azure:** Expose Azure settings to external plugins. [#34484](https://github.com/grafana/grafana/pull/34484), [@sunker](https://github.com/sunker)
- **AzureMonitor:** Deprecate using separate credentials for Azure Monitor Logs. [#34758](https://github.com/grafana/grafana/pull/34758), [@andresmgot](https://github.com/andresmgot)
- **AzureMonitor:** Display variables in resource picker for Azure Monitor Logs. [#34648](https://github.com/grafana/grafana/pull/34648), [@joshhunt](https://github.com/joshhunt)
- **AzureMonitor:** Hide application insights for data sources not using it. [#34725](https://github.com/grafana/grafana/pull/34725), [@joshhunt](https://github.com/joshhunt)
- **AzureMonitor:** Support querying subscriptions and resource groups in Azure Monitor Logs. [#34766](https://github.com/grafana/grafana/pull/34766), [@joshhunt](https://github.com/joshhunt)
- **AzureMonitor:** remove requirement for default subscription. [#34787](https://github.com/grafana/grafana/pull/34787), [@kostrse](https://github.com/kostrse)
- **CloudWatch:** Add Lambda@Edge Amazon CloudFront metrics. [#34561](https://github.com/grafana/grafana/pull/34561), [@razor-x](https://github.com/razor-x)
- **CloudWatch:** Add missing AWS AppSync metrics. [#34691](https://github.com/grafana/grafana/pull/34691), [@razor-x](https://github.com/razor-x)
- **ConfirmModal:** Auto focus delete button. [#34917](https://github.com/grafana/grafana/pull/34917), [@torkelo](https://github.com/torkelo)
- **Explore:** Add caching for queries that are run from logs navigation. [#34297](https://github.com/grafana/grafana/pull/34297), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Add formatting for annotations. [#34774](https://github.com/grafana/grafana/pull/34774), [@fredr](https://github.com/fredr)
- **Loki:** Bring back processed bytes as meta information. [#34092](https://github.com/grafana/grafana/pull/34092), [@mmenbawy](https://github.com/mmenbawy)
- **NodeGraph:** Display node graph collapsed by default with trace view. [#34491](https://github.com/grafana/grafana/pull/34491), [@aocenas](https://github.com/aocenas)
- **Overrides:** Include a manual override option to hide something from visualization. [#34783](https://github.com/grafana/grafana/pull/34783), [@torkelo](https://github.com/torkelo)
- **PieChart:** Support row data in pie charts. [#34755](https://github.com/grafana/grafana/pull/34755), [@torkelo](https://github.com/torkelo)
- **Prometheus:** Update default HTTP method to POST for existing data sources. [#34599](https://github.com/grafana/grafana/pull/34599), [@ivanahuckova](https://github.com/ivanahuckova)
- **Reporting:** Enable generating PDF for anonymous users. (Enterprise)
- **SAML:** Make private key and certificate optional. (Enterprise)
- **Time series panel:** Position tooltip correctly when window is scrolled or resized. [#34782](https://github.com/grafana/grafana/pull/34782), [@dprokop](https://github.com/dprokop)

### Bug fixes

- **Admin:** Fix infinite loading edit on the profile page. [#34627](https://github.com/grafana/grafana/pull/34627), [@hugohaggmark](https://github.com/hugohaggmark)
- **Color:** Fix issues with random colors in string and date fields. [#34913](https://github.com/grafana/grafana/pull/34913), [@torkelo](https://github.com/torkelo)
- **Dashboard:** Fix issue with title or folder change has no effect after exiting settings view. [#34677](https://github.com/grafana/grafana/pull/34677), [@torkelo](https://github.com/torkelo)
- **DataLinks:** Fix an issue \_\_series.name is not working in data link. [#34932](https://github.com/grafana/grafana/pull/34932), [@torkelo](https://github.com/torkelo)
- **Datasource:** Fix dataproxy timeout should always be applied for outgoing data source HTTP requests. [#34597](https://github.com/grafana/grafana/pull/34597), [@dsotirakis](https://github.com/dsotirakis)
- **Elasticsearch:** Fix NewClient not passing httpClientProvider to client impl. [#34539](https://github.com/grafana/grafana/pull/34539), [@KiVirgil](https://github.com/KiVirgil)
- **Explore:** Fix Browser title not updated on Navigation to Explore. [#34651](https://github.com/grafana/grafana/pull/34651), [@axelavargas](https://github.com/axelavargas)
- **GraphNG:** Remove fieldName and hideInLegend properties from UPlotSeriesBuilder. [#34901](https://github.com/grafana/grafana/pull/34901), [@dprokop](https://github.com/dprokop)
- **OAuth:** Fix fallback to auto_assign_org_role setting for Azure AD OAuth when no role claims exists. [#34838](https://github.com/grafana/grafana/pull/34838), [@idafurjes](https://github.com/idafurjes)
- **PanelChrome:** Fix issue with empty panel after adding a non data panel and coming back from panel edit. [#34765](https://github.com/grafana/grafana/pull/34765), [@torkelo](https://github.com/torkelo)
- **StatPanel:** Fix data link tooltip not showing for single value. [#34934](https://github.com/grafana/grafana/pull/34934), [@torkelo](https://github.com/torkelo)
- **Table:** Fix sorting for number fields. [#34722](https://github.com/grafana/grafana/pull/34722), [@hugohaggmark](https://github.com/hugohaggmark)
- **Table:** Have text underline for datalink, and add support for image datalink. [#34635](https://github.com/grafana/grafana/pull/34635), [@thisisobate](https://github.com/thisisobate)
- **Time series panel:** Position tooltip correctly when window is scrolled or resized. [#34584](https://github.com/grafana/grafana/pull/34584), [@dprokop](https://github.com/dprokop)
- **Transformations:** Prevent FilterByValue transform from crashing panel edit. [#34747](https://github.com/grafana/grafana/pull/34747), [@jackw](https://github.com/jackw)

### Breaking changes

The default HTTP method for Prometheus data source is now POST. Previously, it was GET. The POST APIs have been available since January 2018 (Prometheus 2.1.0) and they have fewer limitations than the GET APIs. For example, when dealing with high cardinality labels, GET hits the URL size limit.

If you have a Prometheus instance with version < 2.1.0, which uses the default HTTP method, update your HTTP method to GET. Issue [#34599](https://github.com/grafana/grafana/issues/34599)

<!-- 8.0.0-beta3 END -->

<!-- 8.0.0-beta2 START -->

# 8.0.0-beta2 (2021-05-20)

### Features and enhancements

- **AppPlugins:** Expose react-router to apps. [#33775](https://github.com/grafana/grafana/pull/33775), [@dprokop](https://github.com/dprokop)
- **AzureMonitor:** Add Azure Resource Graph. [#33293](https://github.com/grafana/grafana/pull/33293), [@shuotli](https://github.com/shuotli)
- **AzureMonitor:** Managed Identity configuration UI. [#34170](https://github.com/grafana/grafana/pull/34170), [@kostrse](https://github.com/kostrse)
- **AzureMonitor:** Token provider with support for Managed Identities. [#33807](https://github.com/grafana/grafana/pull/33807), [@kostrse](https://github.com/kostrse)
- **AzureMonitor:** Update Logs workspace() template variable query to return resource URIs. [#34445](https://github.com/grafana/grafana/pull/34445), [@joshhunt](https://github.com/joshhunt)
- **BarChart:** Value label sizing. [#34229](https://github.com/grafana/grafana/pull/34229), [@dprokop](https://github.com/dprokop)
- **CloudMonitoring:** Add support for preprocessing. [#33011](https://github.com/grafana/grafana/pull/33011), [@sunker](https://github.com/sunker)
- **CloudWatch:** Add AWS/EFS StorageBytes metric. [#33426](https://github.com/grafana/grafana/pull/33426), [@freshleafmedia](https://github.com/freshleafmedia)
- **CloudWatch:** Allow use of missing AWS namespaces using custom metrics. [#30961](https://github.com/grafana/grafana/pull/30961), [@mmcoltman](https://github.com/mmcoltman)
- **Datasource:** Shared HTTP client provider for core backend data sources and any data source using the data source proxy. [#33439](https://github.com/grafana/grafana/pull/33439), [@marefr](https://github.com/marefr)
- **InfluxDB:** InfluxQL: allow empty tag values in the query editor. [#34311](https://github.com/grafana/grafana/pull/34311), [@gabor](https://github.com/gabor)
- **Instrumentation:** Instrument incoming HTTP request with histograms by default. [#33921](https://github.com/grafana/grafana/pull/33921), [@bergquist](https://github.com/bergquist)
- **Library Panels:** Add name endpoint & unique name validation to AddLibraryPanelModal. [#33987](https://github.com/grafana/grafana/pull/33987), [@kaydelaney](https://github.com/kaydelaney)
- **Logs panel:** Support details view. [#34125](https://github.com/grafana/grafana/pull/34125), [@ivanahuckova](https://github.com/ivanahuckova)
- **PieChart:** Always show the calculation options dropdown in the editor. [#34267](https://github.com/grafana/grafana/pull/34267), [@oscarkilhed](https://github.com/oscarkilhed)
- **PieChart:** Remove beta flag. [#34098](https://github.com/grafana/grafana/pull/34098), [@oscarkilhed](https://github.com/oscarkilhed)
- **Plugins:** Enforce signing for all plugins. [#34364](https://github.com/grafana/grafana/pull/34364), [@wbrowne](https://github.com/wbrowne)
- **Plugins:** Remove support for deprecated backend plugin protocol version. [#34127](https://github.com/grafana/grafana/pull/34127), [@idafurjes](https://github.com/idafurjes)
- **Tempo/Jaeger:** Add better display name to legend. [#34063](https://github.com/grafana/grafana/pull/34063), [@aocenas](https://github.com/aocenas)
- **Timeline:** Add time range zoom. [#34079](https://github.com/grafana/grafana/pull/34079), [@torkelo](https://github.com/torkelo)
- **Timeline:** Adds opacity & line width option. [#34118](https://github.com/grafana/grafana/pull/34118), [@torkelo](https://github.com/torkelo)
- **Timeline:** Value text alignment option. [#34087](https://github.com/grafana/grafana/pull/34087), [@torkelo](https://github.com/torkelo)
- **ValueMappings:** Add duplicate action, and disable dismiss on backdrop click. [#34100](https://github.com/grafana/grafana/pull/34100), [@torkelo](https://github.com/torkelo)
- **Zipkin:** Add node graph view to trace response. [#34414](https://github.com/grafana/grafana/pull/34414), [@aocenas](https://github.com/aocenas)

### Bug fixes

- **Annotations panel:** Remove subpath from dashboard links. [#34134](https://github.com/grafana/grafana/pull/34134), [@jackw](https://github.com/jackw)
- **Content Security Policy:** Allow all image sources by default. [#34265](https://github.com/grafana/grafana/pull/34265), [@aknuds1](https://github.com/aknuds1)
- **Content Security Policy:** Relax default template wrt. loading of scripts, due to nonces not working. [#34363](https://github.com/grafana/grafana/pull/34363), [@aknuds1](https://github.com/aknuds1)
- **Datasource:** Fix tracing propagation for alert execution by introducing HTTP client outgoing tracing middleware. [#34466](https://github.com/grafana/grafana/pull/34466), [@marefr](https://github.com/marefr)
- **InfluxDB:** InfluxQL always apply time interval end. [#34308](https://github.com/grafana/grafana/pull/34308), [@gabor](https://github.com/gabor)
- **Library Panels:** Fixes "error while loading library panels". [#34278](https://github.com/grafana/grafana/pull/34278), [@hugohaggmark](https://github.com/hugohaggmark)
- **NewsPanel:** Fixes rendering issue in Safari. [#34067](https://github.com/grafana/grafana/pull/34067), [@kaydelaney](https://github.com/kaydelaney)
- **PanelChrome:** Fix queries being issued again when scrolling in and out of view. [#34061](https://github.com/grafana/grafana/pull/34061), [@torkelo](https://github.com/torkelo)
- **Plugins:** Fix Azure token provider cache panic and auth param nil value. [#34252](https://github.com/grafana/grafana/pull/34252), [@kostrse](https://github.com/kostrse)
- **Snapshots:** Fix key and deleteKey being ignored when creating an external snapshot. [#33686](https://github.com/grafana/grafana/pull/33686), [@wengelbrecht-grafana](https://github.com/wengelbrecht-grafana)
- **Table:** Fix issue with cell border not showing with colored background cells. [#34231](https://github.com/grafana/grafana/pull/34231), [@torkelo](https://github.com/torkelo)
- **Table:** Makes tooltip scrollable for long JSON values. [#34120](https://github.com/grafana/grafana/pull/34120), [@hugohaggmark](https://github.com/hugohaggmark)
- **TimeSeries:** Fix for Connected null values threshold toggle during panel editing. [#34452](https://github.com/grafana/grafana/pull/34452), [@leeoniya](https://github.com/leeoniya)
- **Variables:** Fixes inconsistent `selected` states on dashboard load. [#34197](https://github.com/grafana/grafana/pull/34197), [@hugohaggmark](https://github.com/hugohaggmark)
- **Variables:** Refreshes all panels even if panel is full screen. [#34097](https://github.com/grafana/grafana/pull/34097), [@hugohaggmark](https://github.com/hugohaggmark)

### Breaking changes

The `workspaces()` template variable, mainly for use with Azure Monitor Logs, has been changed to return resource URIs instead of Log Analytics Workspaces GUIDs. This should not impact Azure Monitor Logs queries, but if the variables are being used in other data sources which expect a Workspace GUID may no longer be compatible.

Custom template variables used in the workspace or resource field in Azure Monitor Logs queries should resolve to an Azure Resource URI in the format `/subscriptions/{guid}/resourceGroups/{resource-group-name}/{resource-provider-namespace}/{resource-type}/{resource-name}`
Issue [#34445](https://github.com/grafana/grafana/issues/34445)

Removes support for deprecated backend plugin protocol (v1) including usage of github.com/grafana/grafana-plugin-model.

Issue [#34127](https://github.com/grafana/grafana/issues/34127)

### Plugin development fixes & changes

- **QueryField:** Remove carriage return character from pasted text. [#34076](https://github.com/grafana/grafana/pull/34076), [@ivanahuckova](https://github.com/ivanahuckova)

<!-- 8.0.0-beta2 END -->

<!-- 8.0.0-beta1 START -->

# 8.0.0-beta1 (2021-05-13)

### Features and enhancements

- **API**: Add org users with pagination. [#33788](https://github.com/grafana/grafana/pull/33788), [@idafurjes](https://github.com/idafurjes)
- **API**: Return 404 when deleting nonexistent API key. [#33346](https://github.com/grafana/grafana/pull/33346), [@chaudum](https://github.com/chaudum)
- **API**: Return query results as JSON rather than base64 encoded Arrow. [#32303](https://github.com/grafana/grafana/pull/32303), [@ryantxu](https://github.com/ryantxu)
- **Alerting**: Allow sending notification tags to Opsgenie as extra properties. [#30332](https://github.com/grafana/grafana/pull/30332), [@DewaldV](https://github.com/DewaldV)
- **Alerts**: Replaces all uses of InfoBox & FeatureInfoBox with Alert. [#33352](https://github.com/grafana/grafana/pull/33352), [@torkelo](https://github.com/torkelo)
- **Auth**: Add support for JWT Authentication. [#29995](https://github.com/grafana/grafana/pull/29995), [@marshall-lee](https://github.com/marshall-lee)
- **AzureMonitor**: Add support for Microsoft.SignalRService/SignalR metrics. [#33246](https://github.com/grafana/grafana/pull/33246), [@M0ns1gn0r](https://github.com/M0ns1gn0r)
- **AzureMonitor**: Azure settings in Grafana server config. [#33728](https://github.com/grafana/grafana/pull/33728), [@kostrse](https://github.com/kostrse)
- **AzureMonitor**: Migrate Metrics query editor to React. [#30783](https://github.com/grafana/grafana/pull/30783), [@joshhunt](https://github.com/joshhunt)
- **BarChart panel**: enable series toggling via legend. [#33955](https://github.com/grafana/grafana/pull/33955), [@dprokop](https://github.com/dprokop)
- **BarChart panel**: Adds support for Tooltip in BarChartPanel. [#33938](https://github.com/grafana/grafana/pull/33938), [@dprokop](https://github.com/dprokop)
- **PieChart panel**: Change look of highlighted pie slices. [#33841](https://github.com/grafana/grafana/pull/33841), [@oscarkilhed](https://github.com/oscarkilhed)
- **CloudMonitoring**: Migrate config editor from angular to react. [#33645](https://github.com/grafana/grafana/pull/33645), [@sunker](https://github.com/sunker)
- **CloudWatch**: Add Amplify Console metrics and dimensions. [#33171](https://github.com/grafana/grafana/pull/33171), [@rodrigorfk](https://github.com/rodrigorfk)
- **CloudWatch**: Add missing Redshift metrics to CloudWatch data source. [#32121](https://github.com/grafana/grafana/pull/32121), [@tomdaly](https://github.com/tomdaly)
- **CloudWatch**: Add metrics for managed RabbitMQ service. [#31838](https://github.com/grafana/grafana/pull/31838), [@nirojan](https://github.com/nirojan)
- **DashboardList**: Enable templating on search tag input. [#31460](https://github.com/grafana/grafana/pull/31460), [@delta50](https://github.com/delta50)
- **Datasource config**: correctly remove single custom http header. [#32445](https://github.com/grafana/grafana/pull/32445), [@gabor](https://github.com/gabor)
- **Elasticsearch**: Add generic support for template variables. [#32762](https://github.com/grafana/grafana/pull/32762), [@Elfo404](https://github.com/Elfo404)
- **Elasticsearch**: Allow omitting field when metric supports inline script. [#32839](https://github.com/grafana/grafana/pull/32839), [@Elfo404](https://github.com/Elfo404)
- **Elasticsearch**: Allow setting a custom limit for log queries. [#32422](https://github.com/grafana/grafana/pull/32422), [@Elfo404](https://github.com/Elfo404)
- **Elasticsearch**: Guess field type from first non-empty value. [#32290](https://github.com/grafana/grafana/pull/32290), [@Elfo404](https://github.com/Elfo404)
- **Elasticsearch**: Use application/x-ndjson content type for multisearch requests. [#32282](https://github.com/grafana/grafana/pull/32282), [@Elfo404](https://github.com/Elfo404)
- **Elasticsearch**: Use semver strings to identify ES version. [#33646](https://github.com/grafana/grafana/pull/33646), [@Elfo404](https://github.com/Elfo404)
- **Explore**: Add logs navigation to request more logs. [#33259](https://github.com/grafana/grafana/pull/33259), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore**: Map Graphite queries to Loki. [#33405](https://github.com/grafana/grafana/pull/33405), [@ifrost](https://github.com/ifrost)
- **Explore**: Scroll split panes in Explore independently. [#32978](https://github.com/grafana/grafana/pull/32978), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore**: Wrap each panel in separate error boundary. [#33868](https://github.com/grafana/grafana/pull/33868), [@aocenas](https://github.com/aocenas)
- **FieldDisplay**: Smarter naming of stat values when visualising row values (all values) in stat panels. [#31704](https://github.com/grafana/grafana/pull/31704), [@torkelo](https://github.com/torkelo)
- **Graphite**: Expand metric names for variables. [#33694](https://github.com/grafana/grafana/pull/33694), [@ifrost](https://github.com/ifrost)
- **Graphite**: Handle unknown Graphite functions without breaking the visual editor. [#32635](https://github.com/grafana/grafana/pull/32635), [@ifrost](https://github.com/ifrost)
- **Graphite**: Show graphite functions descriptions. [#32305](https://github.com/grafana/grafana/pull/32305), [@ifrost](https://github.com/ifrost)
- **Graphite**: Support request cancellation properly (Uses new backendSrv.fetch Observable request API). [#31928](https://github.com/grafana/grafana/pull/31928), [@mckn](https://github.com/mckn)
- **InfluxDB**: Flux: Improve handling of complex response-structures. [#33823](https://github.com/grafana/grafana/pull/33823), [@gabor](https://github.com/gabor)
- **InfluxDB**: Support region annotations. [#31526](https://github.com/grafana/grafana/pull/31526), [@Komalis](https://github.com/Komalis)
- **Inspector**: Download logs for manual processing. [#32764](https://github.com/grafana/grafana/pull/32764), [@ivanahuckova](https://github.com/ivanahuckova)
- **Jaeger**: Add node graph view for trace. [#31521](https://github.com/grafana/grafana/pull/31521), [@aocenas](https://github.com/aocenas)
- **Jaeger**: Search traces. [#32805](https://github.com/grafana/grafana/pull/32805), [@zoltanbedi](https://github.com/zoltanbedi)
- **Loki**: Use data source settings for alerting queries. [#33942](https://github.com/grafana/grafana/pull/33942), [@ivanahuckova](https://github.com/ivanahuckova)
- **NodeGraph**: Exploration mode. [#33623](https://github.com/grafana/grafana/pull/33623), [@aocenas](https://github.com/aocenas)
- **OAuth**: Add support for empty scopes. [#32129](https://github.com/grafana/grafana/pull/32129), [@jvoeller](https://github.com/jvoeller)
- **PanelChrome**: New logic-less emotion based component with no dependency on PanelModel or DashboardModel. [#29456](https://github.com/grafana/grafana/pull/29456), [@torkelo](https://github.com/torkelo)
- **PanelEdit**: Adds a table view toggle to quickly view data in table form. [#33753](https://github.com/grafana/grafana/pull/33753), [@torkelo](https://github.com/torkelo)
- **PanelEdit**: Highlight matched words when searching options. [#33717](https://github.com/grafana/grafana/pull/33717), [@torkelo](https://github.com/torkelo)
- **PanelEdit**: UX improvements. [#32124](https://github.com/grafana/grafana/pull/32124), [@torkelo](https://github.com/torkelo)
- **Plugins**: PanelRenderer and simplified QueryRunner to be used from plugins. [#31901](https://github.com/grafana/grafana/pull/31901), [@torkelo](https://github.com/torkelo)
- **Plugins**: AuthType in route configuration and params interpolation. [#33674](https://github.com/grafana/grafana/pull/33674), [@kostrse](https://github.com/kostrse)
- **Plugins**: Enable plugin runtime install/uninstall capabilities. [#33836](https://github.com/grafana/grafana/pull/33836), [@wbrowne](https://github.com/wbrowne)
- **Plugins**: Support set body content in plugin routes. [#32551](https://github.com/grafana/grafana/pull/32551), [@marefr](https://github.com/marefr)
- **Plugins**: Introduce marketplace app. [#33869](https://github.com/grafana/grafana/pull/33869), [@jackw](https://github.com/jackw)
- **Plugins**: Moving the DataSourcePicker to grafana/runtime so it can be reused in plugins. [#31628](https://github.com/grafana/grafana/pull/31628), [@mckn](https://github.com/mckn)
- **Prometheus**: Add custom query params for alert and exemplars queries. [#32440](https://github.com/grafana/grafana/pull/32440), [@aocenas](https://github.com/aocenas)
- **Prometheus**: Use fuzzy string matching to autocomplete metric names and label. [#32207](https://github.com/grafana/grafana/pull/32207), [@ifrost](https://github.com/ifrost)
- **Routing**: Replace Angular routing with react-router. [#31463](https://github.com/grafana/grafana/pull/31463), [@dprokop](https://github.com/dprokop)
- **Slack**: Use chat.postMessage API by default. [#32511](https://github.com/grafana/grafana/pull/32511), [@aknuds1](https://github.com/aknuds1)
- **Tempo**: Search for Traces by querying Loki directly from Tempo. [#33308](https://github.com/grafana/grafana/pull/33308), [@davkal](https://github.com/davkal)
- **Tempo**: Show graph view of the trace. [#33635](https://github.com/grafana/grafana/pull/33635), [@aocenas](https://github.com/aocenas)
- **Themes**: Switch theme without reload using global shortcut. [#32180](https://github.com/grafana/grafana/pull/32180), [@torkelo](https://github.com/torkelo)
- **TimeSeries panel**: Add support for shared cursor. [#33433](https://github.com/grafana/grafana/pull/33433), [@dprokop](https://github.com/dprokop)
- **TimeSeries panel**: Do not crash the panel if there is no time series data in the response. [#33993](https://github.com/grafana/grafana/pull/33993), [@dprokop](https://github.com/dprokop)
- **Variables**: Do not save repeated panels, rows and scopedVars. [#32436](https://github.com/grafana/grafana/pull/32436), [@torkelo](https://github.com/torkelo)
- **Variables**: Removes experimental Tags feature. [#33361](https://github.com/grafana/grafana/pull/33361), [@hugohaggmark](https://github.com/hugohaggmark)
- **Variables**: Removes the never refresh option. [#33533](https://github.com/grafana/grafana/pull/33533), [@hugohaggmark](https://github.com/hugohaggmark)
- **Visualizations**: Unify tooltip options across visualizations. [#33892](https://github.com/grafana/grafana/pull/33892), [@dprokop](https://github.com/dprokop)
- **Visualizations**: Refactor and unify option creation between new visualizations. [#33867](https://github.com/grafana/grafana/pull/33867), [@oscarkilhed](https://github.com/oscarkilhed)
- **Visualizations**: Remove singlestat panel. [#31904](https://github.com/grafana/grafana/pull/31904), [@dprokop](https://github.com/dprokop)

### Bug fixes

- **APIKeys**: Fixes issue with adding first api key. [#32201](https://github.com/grafana/grafana/pull/32201), [@torkelo](https://github.com/torkelo)
- **Alerting**: Add checks for non supported units - disable defaulting to seconds. [#32477](https://github.com/grafana/grafana/pull/32477), [@dsotirakis](https://github.com/dsotirakis)
- **Alerting**: Fix issue where Slack notifications won't link to user IDs. [#32861](https://github.com/grafana/grafana/pull/32861), [@n-wbrown](https://github.com/n-wbrown)
- **Alerting**: Omit empty message in PagerDuty notifier. [#31359](https://github.com/grafana/grafana/pull/31359), [@pkoenig10](https://github.com/pkoenig10)
- **AzureMonitor**: Fix migration error from older versions of App Insights queries. [#32372](https://github.com/grafana/grafana/pull/32372), [@joshhunt](https://github.com/joshhunt)
- **CloudWatch**: Fix AWS/Connect dimensions. [#33736](https://github.com/grafana/grafana/pull/33736), [@sunker](https://github.com/sunker)
- **CloudWatch**: Fix broken AWS/MediaTailor dimension name. [#33271](https://github.com/grafana/grafana/pull/33271), [@sunker](https://github.com/sunker)
- **Dashboards**: Allow string manipulation as advanced variable format option. [#29754](https://github.com/grafana/grafana/pull/29754), [@rscot231](https://github.com/rscot231)
- **DataLinks**: Includes harmless extended characters like Cyrillic characters. [#33551](https://github.com/grafana/grafana/pull/33551), [@hugohaggmark](https://github.com/hugohaggmark)
- **Drawer**: Fixes title overflowing its container. [#33857](https://github.com/grafana/grafana/pull/33857), [@thisisobate](https://github.com/thisisobate)
- **Explore**: Fix issue when some query errors were not shown. [#32212](https://github.com/grafana/grafana/pull/32212), [@aocenas](https://github.com/aocenas)
- **Generic OAuth**: Prevent adding duplicated users. [#32286](https://github.com/grafana/grafana/pull/32286), [@dsotirakis](https://github.com/dsotirakis)
- **Graphite**: Handle invalid annotations. [#32437](https://github.com/grafana/grafana/pull/32437), [@ifrost](https://github.com/ifrost)
- **Graphite**: Fix autocomplete when tags are not available. [#31680](https://github.com/grafana/grafana/pull/31680), [@ifrost](https://github.com/ifrost)
- **InfluxDB**: Fix Cannot read property 'length' of undefined in when parsing response. [#32504](https://github.com/grafana/grafana/pull/32504), [@ivanahuckova](https://github.com/ivanahuckova)
- **Instrumentation**: Enable tracing when Jaeger host and port are set. [#33682](https://github.com/grafana/grafana/pull/33682), [@zserge](https://github.com/zserge)
- **Instrumentation**: Prefix metrics with `grafana`. [#33925](https://github.com/grafana/grafana/pull/33925), [@bergquist](https://github.com/bergquist)
- **MSSQL**: By default let driver choose port. [#32417](https://github.com/grafana/grafana/pull/32417), [@aknuds1](https://github.com/aknuds1)
- **OAuth**: Add optional strict parsing of role_attribute_path. [#28021](https://github.com/grafana/grafana/pull/28021), [@klausenbusk](https://github.com/klausenbusk)
- **Panel**: Fixes description markdown with inline code being rendered on newlines and full width. [#32405](https://github.com/grafana/grafana/pull/32405), [@dprokop](https://github.com/dprokop)
- **PanelChrome**: Ignore data updates & errors for non data panels. [#33477](https://github.com/grafana/grafana/pull/33477), [@torkelo](https://github.com/torkelo)
- **Permissions**: Fix inherited folder permissions can prevent new permissions being added to a dashboard. [#33329](https://github.com/grafana/grafana/pull/33329), [@marefr](https://github.com/marefr)
- **Plugins**: Remove pre-existing plugin installs when installing with grafana-cli. [#31515](https://github.com/grafana/grafana/pull/31515), [@wbrowne](https://github.com/wbrowne)
- **Plugins**: Support installing to folders with whitespace and fix pluginUrl trailing and leading whitespace failures. [#32506](https://github.com/grafana/grafana/pull/32506), [@wbrowne](https://github.com/wbrowne)
- **Postgres/MySQL/MSSQL**: Don't return connection failure details to the client. [#32408](https://github.com/grafana/grafana/pull/32408), [@marefr](https://github.com/marefr)
- **Postgres**: Fix ms precision of interval in time group macro when TimescaleDB is enabled. [#33853](https://github.com/grafana/grafana/pull/33853), [@ying-jeanne](https://github.com/ying-jeanne)
- **Provisioning**: Use dashboard checksum field as change indicator. [#29797](https://github.com/grafana/grafana/pull/29797), [@cristi-](https://github.com/cristi-)
- **SQL**: Fix so that all captured errors are returned from sql engine. [#32353](https://github.com/grafana/grafana/pull/32353), [@marefr](https://github.com/marefr)
- **Shortcuts**: Fixes panel shortcuts so they always work. [#32385](https://github.com/grafana/grafana/pull/32385), [@torkelo](https://github.com/torkelo)
- **Table**: Fixes so border is visible for cells with links. [#33160](https://github.com/grafana/grafana/pull/33160), [@hugohaggmark](https://github.com/hugohaggmark)
- **Variables**: Clear query when data source type changes. [#33924](https://github.com/grafana/grafana/pull/33924), [@hugohaggmark](https://github.com/hugohaggmark)
- **Variables**: Filters out builtin variables from unknown list. [#33933](https://github.com/grafana/grafana/pull/33933), [@hugohaggmark](https://github.com/hugohaggmark)
- **Variables**: Refreshes all panels even if panel is full screen. [#33201](https://github.com/grafana/grafana/pull/33201), [@hugohaggmark](https://github.com/hugohaggmark)

### Breaking changes

Removes the `never` refresh option for Query variables. Existing variables will be migrated and any stored options will be removed. Issue [#33533](https://github.com/grafana/grafana/issues/33533)

Removes the experimental Tags feature for Variables. Issue [#33361](https://github.com/grafana/grafana/issues/33361)

### Deprecations

The InfoBox & FeatureInfoBox are now deprecated please use the Alert component instead with severity info.
Issue [#33352](https://github.com/grafana/grafana/issues/33352)

### Plugin development fixes & changes

- **Button**: Introduce buttonStyle prop. [#33384](https://github.com/grafana/grafana/pull/33384), [@jackw](https://github.com/jackw)
- **DataQueryRequest**: Remove deprecated props showingGraph and showingTabel and exploreMode. [#31876](https://github.com/grafana/grafana/pull/31876), [@torkelo](https://github.com/torkelo)
- **grafana/ui**: Update React Hook Form to v7. [#33328](https://github.com/grafana/grafana/pull/33328), [@Clarity-89](https://github.com/Clarity-89)
- **IconButton**: Introduce variant for red and blue icon buttons. [#33479](https://github.com/grafana/grafana/pull/33479), [@jackw](https://github.com/jackw)
- **Plugins**: Expose the `getTimeZone` function to be able to get the current selected timeZone. [#31900](https://github.com/grafana/grafana/pull/31900), [@mckn](https://github.com/mckn)
- **TagsInput**: Add className to TagsInput. [#33944](https://github.com/grafana/grafana/pull/33944), [@Clarity-89](https://github.com/Clarity-89)
- **VizLegend**: Move onSeriesColorChanged to PanelContext (breaking change). [#33611](https://github.com/grafana/grafana/pull/33611), [@ryantxu](https://github.com/ryantxu)

### License update

- **AGPL License:** Update license from Apache 2.0 to the GNU Affero General Public License (AGPL). [#33184](https://github.com/grafana/grafana/pull/33184)

<!-- 8.0.0-beta1 END -->
