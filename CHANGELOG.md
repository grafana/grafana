<!-- openGauss/8.4.2 START -->

# openGauss/8.4.2 (2025-08-14)

### Features and enhancements

- **Storage:** Adapt to openGauss database and support multi IP configuration of the openGauss database
- **Safe:** Close web source map for safe

<!-- openGauss/8.4.2 END -->
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
- **Prometheus:** Fix interpolation of $\_\_rate_interval variable. [#44035](https://github.com/grafana/grafana/pull/44035), [@ivanahuckova](https://github.com/ivanahuckova)
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

- **AccessControl:** Apply fine-grained access control to licensing. (Enterprise)
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
<!-- 8.3.0-beta1 END -->
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
- **Prometheus:** We fixed the issue where the system did not reuse TCP connections when querying from Grafana alerting. [#40349](https://github.com/grafana/grafana/pull/40349), [@kminehart](https://github.com/kminehart)
- **Prometheus:** We fixed the problem that resulted in an error when a user created a query with a $\_\_interval min step. [#40525](https://github.com/grafana/grafana/pull/40525), [@ivanahuckova](https://github.com/ivanahuckova)
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
- **Loki:** Add $\_\_range variable. [#36175](https://github.com/grafana/grafana/pull/36175), [@ivanahuckova](https://github.com/ivanahuckova)
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
<!-- 7.5.15 START -->

# 7.5.15 (2022-02-08)

- **Security**: Fixes CVE-2022-21702. For more information, see our [blog](https://grafana.com/blog/2022/02/08/grafana-7.5.15-and-8.3.5-released-with-moderate-severity-security-fixes/)
- **Security**: Fixes CVE-2022-21703. For more information, see our [blog](https://grafana.com/blog/2022/02/08/grafana-7.5.15-and-8.3.5-released-with-moderate-severity-security-fixes/)
- **Security**: Fixes CVE-2022-21713. For more information, see our [blog](https://grafana.com/blog/2022/02/08/grafana-7.5.15-and-8.3.5-released-with-moderate-severity-security-fixes/)

<!-- 7.5.15 END -->
<!-- 7.5.13 START -->

# 7.5.13 (2022-01-18)

### Bug fixes

- **[v7.5.x] Alerting:** Fix NoDataFound for alert rules using AND operator (#41305). [#44066](https://github.com/grafana/grafana/pull/44066), [@armandgrillet](https://github.com/armandgrillet)

<!-- 7.5.13 END -->

<!-- 7.5.11 START -->

# 7.5.11 (2021-10-05)

- **Security**: Fixes CVE-2021-39226. For more information, see our [blog](https://grafana.com/blog/2021/10/05/grafana-7.5.11-and-8.1.6-released-with-critical-security-fix/)

<!-- 7.5.11 END -->

<!-- 7.5.10 START -->

# 7.5.10 (2021-07-15)

### Bug fixes

- **[v7.5.x] Transformations:** add 'prepare time series' transformer. [#36749](https://github.com/grafana/grafana/pull/36749), [@mckn](https://github.com/mckn)

<!-- 7.5.10 END -->

<!-- 7.5.9 START -->

# 7.5.9 (2021-06-23)

### Bug fixes

- **Login:** Fix Unauthorized message that is displayed on sign-in or snapshot page. [#35880](https://github.com/grafana/grafana/pull/35880), [@torkelo](https://github.com/torkelo)

<!-- 7.5.9 END -->

<!-- 7.5.8 START -->

# 7.5.8 (2021-06-16)

### Features and enhancements

- **Datasource:** Add support for max_conns_per_host in dataproxy settings. [#35519](https://github.com/grafana/grafana/pull/35519), [@jvrplmlmn](https://github.com/jvrplmlmn)
- **Datasource:** Add support for max_idle_connections_per_host in dataproxy settings. [#35365](https://github.com/grafana/grafana/pull/35365), [@dsotirakis](https://github.com/dsotirakis)
- **Instrumentation:** Add metrics for outbound HTTP connections. [#35321](https://github.com/grafana/grafana/pull/35321), [@dsotirakis](https://github.com/dsotirakis)
- **Snapshots:** Remove dashboard links from dashboard snapshots. [#35567](https://github.com/grafana/grafana/pull/35567), [@torkelo](https://github.com/torkelo)

<!-- 7.5.8 END -->

<!-- 7.5.7 START -->

# 7.5.7 (2021-05-19)

### Bug fixes

- **Dockerfile:** Fixes missing --no-cache. [#33906](https://github.com/grafana/grafana/pull/33906), [@030](https://github.com/030)
- **Annotations:** Prevent orphaned annotation tags cleanup when no annotations were cleaned. [#33957](https://github.com/grafana/grafana/pull/33957), [@afayngelerindbx](https://github.com/afayngelerindbx)
- **Quota:** Do not count folders towards dashboard quota. [#32519](https://github.com/grafana/grafana/pull/32519), [@conorevans](https://github.com/conorevans)

<!-- 7.5.7 END -->

<!-- 7.5.6 START -->

# 7.5.6 (2021-05-11)

### Features and enhancements

- **Database**: Add isolation level configuration parameter for MySQL. [#33830](https://github.com/grafana/grafana/pull/33830), [@zserge](https://github.com/zserge)
- **InfluxDB**: Improve measurement-autocomplete behavior. [#33494](https://github.com/grafana/grafana/pull/33494), [@gabor](https://github.com/gabor)
- **Instrumentation**: Don't consider invalid email address a failed email. [#33671](https://github.com/grafana/grafana/pull/33671), [@bergquist](https://github.com/bergquist)

### Bug fixes

- **Loki**: fix label browser crashing when + typed. [#33900](https://github.com/grafana/grafana/pull/33900), [@zoltanbedi](https://github.com/zoltanbedi)
- **Prometheus**: Sanitize PromLink button. [#33874](https://github.com/grafana/grafana/pull/33874), [@ivanahuckova](https://github.com/ivanahuckova)

<!-- 7.5.6 END -->

<!-- 7.5.5 START -->

# 7.5.5 (2021-04-28)

### Features and enhancements

- **Explore:** Load default data source in Explore when the provided source does not exist. [#32992](https://github.com/grafana/grafana/pull/32992), [@ifrost](https://github.com/ifrost)
- **Instrumentation:** Add success rate metrics for email notifications. [#33359](https://github.com/grafana/grafana/pull/33359), [@bergquist](https://github.com/bergquist)

### Bug fixes

- **Alerting:** Remove field limitation from Slack notifications. [#33113](https://github.com/grafana/grafana/pull/33113), [@dsotirakis](https://github.com/dsotirakis)
- **Auth:** Do not clear auth token cookie when token lookup fails. [#32999](https://github.com/grafana/grafana/pull/32999), [@marefr](https://github.com/marefr)
- **Bug:** Add git command to Dockerfile.ubuntu file. [#33247](https://github.com/grafana/grafana/pull/33247), [@dsotirakis](https://github.com/dsotirakis)
- **Explore:** Adjust time to the selected timezone. [#33315](https://github.com/grafana/grafana/pull/33315), [@ifrost](https://github.com/ifrost)
- **GraphNG:** Fix exemplars window position. [#33427](https://github.com/grafana/grafana/pull/33427), [@zoltanbedi](https://github.com/zoltanbedi)
- **Loki:** Pass Skip TLS Verify setting to alert queries. [#33025](https://github.com/grafana/grafana/pull/33025), [@ivanahuckova](https://github.com/ivanahuckova)
- **Postgres:** Fix time group macro when TimescaleDB is enabled and interval is less than a second. [#33153](https://github.com/grafana/grafana/pull/33153), [@marefr](https://github.com/marefr)

<!-- 7.5.5 END -->

<!-- 7.5.4 START -->

# 7.5.4 (2021-04-14)

### Features and enhancements

- **Auditing:** Use nanosecond resolution for audit log timestamps. (Enterprise)
- **AzureMonitor:** Add support for Microsoft.AppConfiguration/configurationStores namespace. [#32123](https://github.com/grafana/grafana/pull/32123), [@deesejohn](https://github.com/deesejohn)
- **TablePanel:** Make sorting case-insensitive. [#32435](https://github.com/grafana/grafana/pull/32435), [@kaydelaney](https://github.com/kaydelaney)

### Bug fixes

- **AzureMonitor:** Add support for Virtual WAN namespaces. [#32935](https://github.com/grafana/grafana/pull/32935), [@joshhunt](https://github.com/joshhunt)
- **Bugfix:** Add proper padding when scrolling is added to bar gauge. [#32411](https://github.com/grafana/grafana/pull/32411), [@mckn](https://github.com/mckn)
- **Datasource:** Prevent default data source named "default" from causing infinite loop. [#32949](https://github.com/grafana/grafana/pull/32949), [@jackw](https://github.com/jackw)
- **Prometheus:** Allow exemplars endpoint in data source proxy. [#32802](https://github.com/grafana/grafana/pull/32802), [@zoltanbedi](https://github.com/zoltanbedi)
- **Table:** Fix table data links so they refer to correct row after sorting. [#32571](https://github.com/grafana/grafana/pull/32571), [@torkelo](https://github.com/torkelo)

<!-- 7.5.4 END -->

<!-- 7.5.3 START -->

# 7.5.3 (2021-04-07)

### Features and enhancements

- **Dashboard**: Do not include default datasource when externally exporting dashboard with row. [#32494](https://github.com/grafana/grafana/pull/32494), [@kaydelaney](https://github.com/kaydelaney)
- **Loki**: Remove empty annotations tags. [#32359](https://github.com/grafana/grafana/pull/32359), [@conorevans](https://github.com/conorevans)

### Bug fixes

- **AdHocVariable**: Add default data source to picker. [#32470](https://github.com/grafana/grafana/pull/32470), [@hugohaggmark](https://github.com/hugohaggmark)
- **Configuration**: Prevent browser hanging / crashing with large number of org users. [#32546](https://github.com/grafana/grafana/pull/32546), [@jackw](https://github.com/jackw)
- **Elasticsearch**: Fix bucket script variable duplication in UI. [#32705](https://github.com/grafana/grafana/pull/32705), [@Elfo404](https://github.com/Elfo404)
- **Explore**: Fix bug where navigating to explore would result in wrong query and datasource to be shown. [#32558](https://github.com/grafana/grafana/pull/32558), [@aocenas](https://github.com/aocenas)
- **FolderPicker**: Prevent dropdown menu from disappearing off screen. [#32603](https://github.com/grafana/grafana/pull/32603), [@jackw](https://github.com/jackw)
- **SingleStat**: Fix issue with panel links. [#32721](https://github.com/grafana/grafana/pull/32721), [@gjulianm](https://github.com/gjulianm)
- **Variables**: Confirm selection before opening new picker. [#32586](https://github.com/grafana/grafana/pull/32586), [@hugohaggmark](https://github.com/hugohaggmark)
- **Variables**: Confirm selection before opening new picker. [#32503](https://github.com/grafana/grafana/pull/32503), [@hugohaggmark](https://github.com/hugohaggmark)
- **Variables**: Fix unsupported data format error for null values. [#32480](https://github.com/grafana/grafana/pull/32480), [@hugohaggmark](https://github.com/hugohaggmark)

<!-- 7.5.3 END -->

<!-- 7.5.2 START -->

# 7.5.2 (2021-03-30)

### Features and enhancements

- **Explore**: Set Explore's GraphNG to use default value for connected null values setting. [#32471](https://github.com/grafana/grafana/pull/32471), [@ivanahuckova](https://github.com/ivanahuckova)

### Bug fixes

- **DashboardDataSource**: Fix query not being executed after selecting source panel. [#32383](https://github.com/grafana/grafana/pull/32383), [@torkelo](https://github.com/torkelo)
- **Graph**: Fix setting right y-axis when standard option unit is configured. [#32426](https://github.com/grafana/grafana/pull/32426), [@torkelo](https://github.com/torkelo)
- **Table**: Fix links for image cells. [#32370](https://github.com/grafana/grafana/pull/32370), [@kaydelaney](https://github.com/kaydelaney)
- **Variables**: Fix data source variable when default data source is selected. [#32384](https://github.com/grafana/grafana/pull/32384), [@torkelo](https://github.com/torkelo)
- **Variables**: Fix manually entering non-matching custom value in variable input/picker error. [#32390](https://github.com/grafana/grafana/pull/32390), [@torkelo](https://github.com/torkelo)

<!-- 7.5.2 END -->

<!-- 7.5.1 START -->

# 7.5.1 (2021-03-26)

### Bug fixes

- **MSSQL**: Fix panic not implemented by upgrading go-mssqldb dependency. [#32347](https://github.com/grafana/grafana/pull/32347), [@aknuds1](https://github.com/aknuds1)

<!-- 7.5.1 END -->

<!-- 7.5.0 START -->

# 7.5.0 (2021-03-25)

### Features and enhancements

- **Alerting**: Add ability to include aliases with hyphen in InfluxDB. [#32262](https://github.com/grafana/grafana/pull/32262), [@grafanabot](https://github.com/grafanabot)
- **CloudWatch**: Use latest version of aws sdk. [#32217](https://github.com/grafana/grafana/pull/32217), [@sunker](https://github.com/sunker)

### Bug fixes

- **Alerting**: Add ability to include aliases with hyphen in InfluxDB. [#32224](https://github.com/grafana/grafana/pull/32224), [@dsotirakis](https://github.com/dsotirakis)
- **DashboardSettings**: Fixes issue with tags list not updating changes are made. [#32241](https://github.com/grafana/grafana/pull/32241), [@huynhsamha](https://github.com/huynhsamha)
- **DashboardSettings**: Fixes issue with tags list not updating changes are made. [#32189](https://github.com/grafana/grafana/pull/32189), [@huynhsamha](https://github.com/huynhsamha)
- **Loki**: Fix text search in Label browser. [#32293](https://github.com/grafana/grafana/pull/32293), [@ivanahuckova](https://github.com/ivanahuckova)

<!-- 7.5.0 END -->

<!-- 7.5.0-beta2 START -->

# 7.5.0-beta2 (2021-03-19)

### Features and enhancements

- **CloudWatch**: Add support for EC2 IAM role. [#31804](https://github.com/grafana/grafana/pull/31804), [@sunker](https://github.com/sunker)
- **CloudWatch**: Consume the grafana/aws-sdk. [#31807](https://github.com/grafana/grafana/pull/31807), [@sunker](https://github.com/sunker)
- **CloudWatch**: Restrict auth provider and assume role usage according to Grafana configuration. [#31805](https://github.com/grafana/grafana/pull/31805), [@sunker](https://github.com/sunker)
- **Cloudwatch**: ListMetrics API page limit. [#31788](https://github.com/grafana/grafana/pull/31788), [@sunker](https://github.com/sunker)
- **Cloudwatch**: Use shared library for aws auth. [#29550](https://github.com/grafana/grafana/pull/29550), [@ryantxu](https://github.com/ryantxu)
- **DataLinks**: Bring back single click links for Stat, Gauge and BarGauge panel. [#31692](https://github.com/grafana/grafana/pull/31692), [@dprokop](https://github.com/dprokop)
- **Docker**: Support pre-installed plugins from other sources in custom Dockerfiles. [#31234](https://github.com/grafana/grafana/pull/31234), [@sgnsys3](https://github.com/sgnsys3)
- **Elasticseach**: Add support for histogram fields. [#29079](https://github.com/grafana/grafana/pull/29079), [@simianhacker](https://github.com/simianhacker)
- **Exemplars**: Always query exemplars. [#31673](https://github.com/grafana/grafana/pull/31673), [@zoltanbedi](https://github.com/zoltanbedi)
- **Explore**: Support full inspect drawer. [#32005](https://github.com/grafana/grafana/pull/32005), [@ivanahuckova](https://github.com/ivanahuckova)
- **HttpServer**: Make read timeout configurable but disabled by default. [#31575](https://github.com/grafana/grafana/pull/31575), [@bergquist](https://github.com/bergquist)
- **SQLStore**: Close session in withDbSession. [#31775](https://github.com/grafana/grafana/pull/31775), [@aknuds1](https://github.com/aknuds1)
- **Templating**: Use dashboard timerange when variables are set to refresh 'On Dashboard Load'. [#31721](https://github.com/grafana/grafana/pull/31721), [@Elfo404](https://github.com/Elfo404)
- **Tempo**: Convert to backend data source. [#31618](https://github.com/grafana/grafana/pull/31618), [@zoltanbedi](https://github.com/zoltanbedi)

### Bug fixes

- **Admin**: Keeps expired api keys visible in table after delete. [#31636](https://github.com/grafana/grafana/pull/31636), [@hugohaggmark](https://github.com/hugohaggmark)
- **Data proxy**: Fix encoded characters in URL path should be proxied as encoded. [#30597](https://github.com/grafana/grafana/pull/30597), [@marefr](https://github.com/marefr)
- **Explore/Logs**: Fix escaping in ANSI logs. [#31731](https://github.com/grafana/grafana/pull/31731), [@ivanahuckova](https://github.com/ivanahuckova)
- **GraphNG**: Fix tooltip series color for multi data frame scenario. [#32098](https://github.com/grafana/grafana/pull/32098), [@dprokop](https://github.com/dprokop)
- **GraphNG**: Make sure data set and config are in sync when initializing and re-initializing uPlot. [#32106](https://github.com/grafana/grafana/pull/32106), [@dprokop](https://github.com/dprokop)
- **Loki**: Fix autocomplete when re-editing Loki label values. [#31828](https://github.com/grafana/grafana/pull/31828), [@ivanahuckova](https://github.com/ivanahuckova)
- **MixedDataSource**: Name is updated when data source variables change. [#32090](https://github.com/grafana/grafana/pull/32090), [@hugohaggmark](https://github.com/hugohaggmark)
- **PanelInspect**: Interpolates variables in CSV file name. [#31936](https://github.com/grafana/grafana/pull/31936), [@hugohaggmark](https://github.com/hugohaggmark)
- **ReduceTransform**: Include series with numeric string names. [#31763](https://github.com/grafana/grafana/pull/31763), [@hugohaggmark](https://github.com/hugohaggmark)
- **Snapshots**: Fix usage of sign in link from the snapshot page. [#31986](https://github.com/grafana/grafana/pull/31986), [@marefr](https://github.com/marefr)
- **TimePicker**: Fixes hidden time picker shown in kiosk TV mode. [#32062](https://github.com/grafana/grafana/pull/32062), [@torkelo](https://github.com/torkelo)
- **ValueMappings**: Fixes value 0 not being mapped. [#31924](https://github.com/grafana/grafana/pull/31924), [@Willena](https://github.com/Willena)
- **Variables**: Fixes filtering in picker with null items. [#31979](https://github.com/grafana/grafana/pull/31979), [@hugohaggmark](https://github.com/hugohaggmark)
- **Variables**: Improves inspection performance and unknown filtering. [#31811](https://github.com/grafana/grafana/pull/31811), [@hugohaggmark](https://github.com/hugohaggmark)

### Plugin development fixes & changes

- **Auth**: Allow soft token revocation. [#31601](https://github.com/grafana/grafana/pull/31601), [@joanlopez](https://github.com/joanlopez)

<!-- 7.5.0-beta2 END -->

<!-- 7.5.0-beta1 START -->

# 7.5.0-beta1 (2021-03-04)

### Features and enhancements

- **Alerting**: Customise OK notification priorities for Pushover notifier. [#30169](https://github.com/grafana/grafana/pull/30169), [@acaire](https://github.com/acaire)
- **Alerting**: Improve default message for SensuGo notifier. [#31428](https://github.com/grafana/grafana/pull/31428), [@M4teo](https://github.com/M4teo)
- **Alerting**: PagerDuty: adding current state to the payload. [#29270](https://github.com/grafana/grafana/pull/29270), [@Eraac](https://github.com/Eraac)
- **AzureMonitor**: Add deprecation message for App Insights/Insights Analytics. [#30633](https://github.com/grafana/grafana/pull/30633), [@joshhunt](https://github.com/joshhunt)
- **CloudMonitoring**: Allow free text input for GCP project on dashboard variable query. [#28048](https://github.com/grafana/grafana/issues/28048)
- **CloudMonitoring**: Increase service api page size. [#30892](https://github.com/grafana/grafana/pull/30892), [@sunker](https://github.com/sunker)
- **CloudMonitoring**: Show service and SLO display name in SLO Query editor. [#30900](https://github.com/grafana/grafana/pull/30900), [@sunker](https://github.com/sunker)
- **CloudWatch**: Add AWS Ground Station metrics and dimensions. [#31362](https://github.com/grafana/grafana/pull/31362), [@ilyastoli](https://github.com/ilyastoli)
- **CloudWatch**: Add AWS Network Firewall metrics and dimensions. [#31498](https://github.com/grafana/grafana/pull/31498), [@ilyastoli](https://github.com/ilyastoli)
- **CloudWatch**: Add AWS Timestream Metrics and Dimensions. [#31624](https://github.com/grafana/grafana/pull/31624), [@ilyastoli](https://github.com/ilyastoli)
- **CloudWatch**: Add RDS Proxy metrics. [#31595](https://github.com/grafana/grafana/pull/31595), [@sunker](https://github.com/sunker)
- **CloudWatch**: Add eu-south-1 Cloudwatch region. [#31198](https://github.com/grafana/grafana/pull/31198), [@rubycut](https://github.com/rubycut)
- **CloudWatch**: Make it possible to specify custom api endpoint. [#31402](https://github.com/grafana/grafana/pull/31402), [@sunker](https://github.com/sunker)
- **Cloudwatch**: Add AWS/DDoSProtection metrics and dimensions. [#31297](https://github.com/grafana/grafana/pull/31297), [@relvira](https://github.com/relvira)
- **Dashboard**: Remove template variables option from ShareModal. [#30395](https://github.com/grafana/grafana/pull/30395), [@oscarkilhed](https://github.com/oscarkilhed)
- **Docs**: Define TLS/SSL terminology. [#30533](https://github.com/grafana/grafana/pull/30533), [@aknuds1](https://github.com/aknuds1)
- **Elasticsearch**: Add word highlighting to search results. [#30293](https://github.com/grafana/grafana/pull/30293), [@simianhacker](https://github.com/simianhacker)
- **Folders**: Editors should be able to edit name and delete folders. [#31242](https://github.com/grafana/grafana/pull/31242), [@torkelo](https://github.com/torkelo)
- **Graphite/SSE**: update graphite to work with server side expressions. [#31455](https://github.com/grafana/grafana/pull/31455), [@kylebrandt](https://github.com/kylebrandt)
- **InfluxDB**: Improve maxDataPoints error-message in Flux-mode, raise limits. [#31259](https://github.com/grafana/grafana/pull/31259), [@gabor](https://github.com/gabor)
- **InfluxDB**: In flux query editor, do not run query when disabled. [#31324](https://github.com/grafana/grafana/pull/31324), [@gabor](https://github.com/gabor)
- **LogsPanel**: Add deduplication option for logs. [#31019](https://github.com/grafana/grafana/pull/31019), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki**: Add line limit for annotations. [#31183](https://github.com/grafana/grafana/pull/31183), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki**: Add support for alerting. [#31424](https://github.com/grafana/grafana/pull/31424), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki**: Label browser. [#30351](https://github.com/grafana/grafana/pull/30351), [@davkal](https://github.com/davkal)
- **PieChart**: Add color changing options to pie chart. [#31588](https://github.com/grafana/grafana/pull/31588), [@oscarkilhed](https://github.com/oscarkilhed)
- **PostgreSQL**: Allow providing TLS/SSL certificates as text in addition to file paths. [#30353](https://github.com/grafana/grafana/pull/30353), [@ying-jeanne](https://github.com/ying-jeanne)
- **Postgres**: SSL certification. [#30352](https://github.com/grafana/grafana/pull/30352), [@ying-jeanne](https://github.com/ying-jeanne)
- **Profile**: Prevent OAuth users from changing user details or password. [#27886](https://github.com/grafana/grafana/pull/27886), [@dupondje](https://github.com/dupondje)
- **Prometheus**: Change default httpMethod for new instances to POST. [#31292](https://github.com/grafana/grafana/pull/31292), [@ivanahuckova](https://github.com/ivanahuckova)
- **Prometheus**: Min step defaults to seconds when no unit is set. [#30966](https://github.com/grafana/grafana/pull/30966), [@nutmos](https://github.com/nutmos)
- **Stats**: Exclude folders from total dashboard count. [#31320](https://github.com/grafana/grafana/pull/31320), [@bergquist](https://github.com/bergquist)
- **Tracing**: Specify type of data frame that is expected for TraceView. [#31465](https://github.com/grafana/grafana/pull/31465), [@aocenas](https://github.com/aocenas)
- **Transformers**: Add search to transform selection. [#30854](https://github.com/grafana/grafana/pull/30854), [@ryantxu](https://github.com/ryantxu)

### Bug fixes

- **Alerting**: Ensure Discord notification is sent when metric name is absent. [#31257](https://github.com/grafana/grafana/pull/31257), [@LeviHarrison](https://github.com/LeviHarrison)
- **Alerting**: Fix case when Alertmanager notifier fails if a URL is not working. [#31079](https://github.com/grafana/grafana/pull/31079), [@kurokochin](https://github.com/kurokochin)
- **CloudMonitoring**: Prevent resource type variable function from crashing. [#30901](https://github.com/grafana/grafana/pull/30901), [@sunker](https://github.com/sunker)
- **Color**: Fix issue where colors are reset to gray when switching panels. [#31611](https://github.com/grafana/grafana/pull/31611), [@torkelo](https://github.com/torkelo)
- **Explore**: Show ANSI colored logs in logs context. [#31510](https://github.com/grafana/grafana/pull/31510), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore**: keep enabled/disabled state in angular based QueryEditors correctly. [#31558](https://github.com/grafana/grafana/pull/31558), [@gabor](https://github.com/gabor)
- **Graph**: Fix tooltip not being displayed when close to edge of viewport. [#31493](https://github.com/grafana/grafana/pull/31493), [@msober](https://github.com/msober)
- **Heatmap**: Fix missing value in legend. [#31430](https://github.com/grafana/grafana/pull/31430), [@kurokochin](https://github.com/kurokochin)
- **InfluxDB**: Handle columns named "table". [#30985](https://github.com/grafana/grafana/pull/30985), [@gabor](https://github.com/gabor)
- **Prometheus**: Use configured HTTP method for /series and /labels endpoints. [#31401](https://github.com/grafana/grafana/pull/31401), [@ivanahuckova](https://github.com/ivanahuckova)
- **RefreshPicker**: Make valid intervals in url visible in RefreshPicker. [#30474](https://github.com/grafana/grafana/pull/30474), [@hugohaggmark](https://github.com/hugohaggmark)
- **TimeSeriesPanel**: Fix overlapping time axis ticks. [#31332](https://github.com/grafana/grafana/pull/31332), [@torkelo](https://github.com/torkelo)
- **TraceViewer**: Fix show log marker in spanbar. [#30742](https://github.com/grafana/grafana/pull/30742), [@zoltanbedi](https://github.com/zoltanbedi)

### Plugin development fixes & changes

- **Plugins**: Add autoEnabled plugin JSON field to auto enable App plugins and add configuration link to menu by default. [#31354](https://github.com/grafana/grafana/pull/31354), [@torkelo](https://github.com/torkelo)
- **Pagination**: Improve pagination for large number of pages. [#30151](https://github.com/grafana/grafana/pull/30151), [@nathanrodman](https://github.com/nathanrodman)

<!-- 7.5.0-beta1 END -->

<!-- 7.4.5 START -->

# 7.4.5 (2021-03-18)

### Bug fixes

- **Security**: Fix API permissions issues related to team-sync CVE-2021-28146, CVE-2021-28147. (Enterprise)
- **Security**: Usage insights requires signed in users CVE-2021-28148. (Enterprise)
- **Security**: Do not allow editors to incorrectly bypass permissions on the default data source. CVE-2021-27962. (Enterprise)

<!-- 7.4.5 END -->

<!-- 7.4.3 START -->

# 7.4.3 (2021-02-24)

### Bug fixes

- **AdHocVariables**: Fixes crash when values are stored as numbers. [#31382](https://github.com/grafana/grafana/pull/31382), [@hugohaggmark](https://github.com/hugohaggmark)
- **DashboardLinks**: Fix an issue where the dashboard links were causing a full page reload. [#31334](https://github.com/grafana/grafana/pull/31334), [@torkelo](https://github.com/torkelo)
- **Elasticsearch**: Fix query initialization logic & query transformation from Prometheus/Loki. [#31322](https://github.com/grafana/grafana/pull/31322), [@Elfo404](https://github.com/Elfo404)
- **QueryEditor**: Fix disabling queries in dashboards. [#31336](https://github.com/grafana/grafana/pull/31336), [@gabor](https://github.com/gabor)
- **Streaming**: Fix an issue with the time series panel and streaming data source when scrolling back from being out of view. [#31431](https://github.com/grafana/grafana/pull/31431), [@torkelo](https://github.com/torkelo)
- **Table**: Fix an issue regarding the fixed min and auto max values in bar gauge cell. [#31316](https://github.com/grafana/grafana/pull/31316), [@torkelo](https://github.com/torkelo)

<!-- 7.4.3 END -->

<!-- 7.4.2 START -->

# 7.4.2 (2021-02-17)

### Features and enhancements

- **Explore**: Do not show non queryable data sources in data source picker. [#31144](https://github.com/grafana/grafana/pull/31144), [@torkelo](https://github.com/torkelo)
- **Security**: Do not allow an anonymous user to create snapshots. CVE-2021-27358. [#31263](https://github.com/grafana/grafana/pull/31263), [@marefr](https://github.com/marefr)

### Bug fixes

- **CloudWatch**: Ensure empty query row errors are not passed to the panel. [#31172](https://github.com/grafana/grafana/pull/31172), [@sunker](https://github.com/sunker)
- **DashboardLinks**: Fix the links that always cause a full page to reload. [#31178](https://github.com/grafana/grafana/pull/31178), [@torkelo](https://github.com/torkelo)
- **DashboardListPanel**: Fix issue with folder picker always showing All and using old form styles. [#31160](https://github.com/grafana/grafana/pull/31160), [@torkelo](https://github.com/torkelo)
- **IPv6**: Support host address configured with enclosing square brackets. [#31226](https://github.com/grafana/grafana/pull/31226), [@aknuds1](https://github.com/aknuds1)
- **Permissions**: Fix team and role permissions on folders/dashboards not displayed for non Grafana Admin users. [#31132](https://github.com/grafana/grafana/pull/31132), [@AgnesToulet](https://github.com/AgnesToulet)
- **Postgres**: Fix timeGroup macro converts long intervals to invalid numbers when TimescaleDB is enabled. [#31179](https://github.com/grafana/grafana/pull/31179), [@kurokochin](https://github.com/kurokochin)
- **Prometheus**: Fix enabling of disabled queries when editing in dashboard. [#31055](https://github.com/grafana/grafana/pull/31055), [@ivanahuckova](https://github.com/ivanahuckova)
- **QueryEditors**: Fix an issue that happens after moving queries then editing would update other queries. [#31193](https://github.com/grafana/grafana/pull/31193), [@torkelo](https://github.com/torkelo)
- **SqlDataSources**: Fix the Show Generated SQL button in query editors. [#31236](https://github.com/grafana/grafana/pull/31236), [@torkelo](https://github.com/torkelo)
- **StatPanels**: Fix an issue where the palette color scheme is not cleared when loading panel. [#31126](https://github.com/grafana/grafana/pull/31126), [@torkelo](https://github.com/torkelo)
- **Variables**: Add the default option back for the data source variable. [#31208](https://github.com/grafana/grafana/pull/31208), [@hugohaggmark](https://github.com/hugohaggmark)
- **Variables**: Fix missing empty elements from regex filters. [#31156](https://github.com/grafana/grafana/pull/31156), [@hugohaggmark](https://github.com/hugohaggmark)

<!-- 7.4.2 END -->

<!-- v7.4.2 START -->

<!-- v7.4.2 END -->

<!-- 7.4.1 START -->

# 7.4.1 (2021-02-11)

### Features and enhancements

- **Influx**: Make max series limit configurable and show the limiting message if applied. [#31025](https://github.com/grafana/grafana/pull/31025), [@aocenas](https://github.com/aocenas)
- **Make value mappings correctly interpret numeric-like strings**. [#30893](https://github.com/grafana/grafana/pull/30893), [@dprokop](https://github.com/dprokop)
- **Variables**: Adds queryparam formatting option. [#30858](https://github.com/grafana/grafana/pull/30858), [@hugohaggmark](https://github.com/hugohaggmark)

### Bug fixes

- **Alerting**: Fixes so notification channels are properly deleted. [#31040](https://github.com/grafana/grafana/pull/31040), [@hugohaggmark](https://github.com/hugohaggmark)
- **BarGauge**: Improvements to value sizing and table inner width calculations. [#30990](https://github.com/grafana/grafana/pull/30990), [@torkelo](https://github.com/torkelo)
- **DashboardLinks**: Fixes crash when link has no title. [#31008](https://github.com/grafana/grafana/pull/31008), [@hugohaggmark](https://github.com/hugohaggmark)
- **Elasticsearch**: Fix alias field value not being shown in query editor. [#30992](https://github.com/grafana/grafana/pull/30992), [@Elfo404](https://github.com/Elfo404)
- **Elasticsearch**: Fix log row context errors. [#31088](https://github.com/grafana/grafana/pull/31088), [@Elfo404](https://github.com/Elfo404)
- **Elasticsearch**: Show Size setting for raw_data metric. [#30980](https://github.com/grafana/grafana/pull/30980), [@Elfo404](https://github.com/Elfo404)
- **Graph**: Fixes so graph is shown for non numeric time values. [#30972](https://github.com/grafana/grafana/pull/30972), [@hugohaggmark](https://github.com/hugohaggmark)
- **Logging**: Ignore 'file already closed' error when closing file. [#31119](https://github.com/grafana/grafana/pull/31119), [@aknuds1](https://github.com/aknuds1)
- **Plugins**: Fix plugin signature validation for manifest v2 on Windows. [#31045](https://github.com/grafana/grafana/pull/31045), [@wbrowne](https://github.com/wbrowne)
- **TextPanel**: Fixes so panel title is updated when variables change. [#30884](https://github.com/grafana/grafana/pull/30884), [@hugohaggmark](https://github.com/hugohaggmark)
- **Transforms**: Fixes Outer join issue with duplicate field names not getting the same unique field names as before. [#31121](https://github.com/grafana/grafana/pull/31121), [@torkelo](https://github.com/torkelo)

<!-- 7.4.1 END -->

<!-- 7.4.0 START -->

# 7.4.0 (2021-02-04)

### Features and enhancements

- **CDN**: Adds support for serving assets over a CDN. [#30691](https://github.com/grafana/grafana/pull/30691), [@torkelo](https://github.com/torkelo)
- **DashboardLinks**: Support variable expression in to tooltip - Issue #30409. [#30569](https://github.com/grafana/grafana/pull/30569), [@huynhsamha](https://github.com/huynhsamha)
- **Explore**: Set Explore's GraphNG to be connected. [#30707](https://github.com/grafana/grafana/pull/30707), [@ivanahuckova](https://github.com/ivanahuckova)
- **InfluxDB**: Add http configuration when selecting InfluxDB v2 flavor. [#30827](https://github.com/grafana/grafana/pull/30827), [@aocenas](https://github.com/aocenas)
- **InfluxDB**: Show all datapoints for dynamically windowed flux query. [#30688](https://github.com/grafana/grafana/pull/30688), [@davkal](https://github.com/davkal)
- **Loki**: Improve live tailing errors. [#30517](https://github.com/grafana/grafana/pull/30517), [@ivanahuckova](https://github.com/ivanahuckova)

### Bug fixes

- **Admin**: Fixes so form values are filled in from backend. [#30544](https://github.com/grafana/grafana/pull/30544), [@hugohaggmark](https://github.com/hugohaggmark)
- **Admin**: Fixes so whole org drop down is visible when adding users to org. [#30481](https://github.com/grafana/grafana/pull/30481), [@hugohaggmark](https://github.com/hugohaggmark)
- **Alerting**: Hides threshold handle for percentual thresholds. [#30431](https://github.com/grafana/grafana/pull/30431), [@hugohaggmark](https://github.com/hugohaggmark)
- **CloudWatch**: Prevent field config from being overwritten. [#30437](https://github.com/grafana/grafana/pull/30437), [@sunker](https://github.com/sunker)
- **Decimals**: Big Improvements to auto decimals and fixes to auto decimals bug found in 7.4-beta1. [#30519](https://github.com/grafana/grafana/pull/30519), [@torkelo](https://github.com/torkelo)
- **Explore**: Fix jumpy live tailing. [#30650](https://github.com/grafana/grafana/pull/30650), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore**: Fix loading visualisation on the top of the new time series panel. [#30553](https://github.com/grafana/grafana/pull/30553), [@ivanahuckova](https://github.com/ivanahuckova)
- **Footer**: Fixes layout issue in footer. [#30443](https://github.com/grafana/grafana/pull/30443), [@torkelo](https://github.com/torkelo)
- **Graph**: Fixes so only users with correct permissions can add annotations. [#30419](https://github.com/grafana/grafana/pull/30419), [@hugohaggmark](https://github.com/hugohaggmark)
- **Mobile**: Fixes issue scrolling on mobile in chrome. [#30746](https://github.com/grafana/grafana/pull/30746), [@torkelo](https://github.com/torkelo)
- **PanelEdit**: Trigger refresh when changing data source. [#30744](https://github.com/grafana/grafana/pull/30744), [@torkelo](https://github.com/torkelo)
- **Panels**: Fixes so panels are refreshed when scrolling past them fast. [#30784](https://github.com/grafana/grafana/pull/30784), [@hugohaggmark](https://github.com/hugohaggmark)
- **Prometheus**: Fix show query instead of Value if no **name** and metric. [#30511](https://github.com/grafana/grafana/pull/30511), [@zoltanbedi](https://github.com/zoltanbedi)
- **TimeSeriesPanel**: Fixes default value for Gradient mode. [#30484](https://github.com/grafana/grafana/pull/30484), [@torkelo](https://github.com/torkelo)
- **Variables**: Clears drop down state when leaving dashboard. [#30810](https://github.com/grafana/grafana/pull/30810), [@hugohaggmark](https://github.com/hugohaggmark)
- **Variables**: Fixes display value when using capture groups in regex. [#30636](https://github.com/grafana/grafana/pull/30636), [@hugohaggmark](https://github.com/hugohaggmark)
- **Variables**: Fixes so queries work for numbers values too. [#30602](https://github.com/grafana/grafana/pull/30602), [@hugohaggmark](https://github.com/hugohaggmark)
- **Variables**: Fixes so text format will show All instead of custom all value. [#30730](https://github.com/grafana/grafana/pull/30730), [@hugohaggmark](https://github.com/hugohaggmark)

### Plugin development fixes & changes

- **Plugins**: Fix failing plugin builds because of wrong internal import. [#30439](https://github.com/grafana/grafana/pull/30439), [@aocenas](https://github.com/aocenas)

<!-- 7.4.0 END -->

<!-- 7.4.0-beta1 START -->

# 7.4.0-beta1 (2021-01-20)

### Features and enhancements

- **API**: Add ID to snapshot API responses. [#29600](https://github.com/grafana/grafana/pull/29600), [@AgnesToulet](https://github.com/AgnesToulet)
- **AlertListPanel**: Add options to sort by Time(asc) and Time(desc). [#29764](https://github.com/grafana/grafana/pull/29764), [@dboslee](https://github.com/dboslee)
- **AlertListPanel**: Changed alert url to to go the panel view instead of panel edit. [#29060](https://github.com/grafana/grafana/pull/29060), [@zakiharis](https://github.com/zakiharis)
- **Alerting**: Add support for Sensu Go notification channel. [#28012](https://github.com/grafana/grafana/pull/28012), [@nixwiz](https://github.com/nixwiz)
- **Alerting**: Add support for alert notification query label interpolation. [#29908](https://github.com/grafana/grafana/pull/29908), [@wbrowne](https://github.com/wbrowne)
- **Annotations**: Remove annotation_tag entries as part of annotations cleanup. [#29534](https://github.com/grafana/grafana/pull/29534), [@dafydd-t](https://github.com/dafydd-t)
- **Azure Monitor**: Add Microsoft.Network/natGateways. [#29479](https://github.com/grafana/grafana/pull/29479), [@JoeyLemur](https://github.com/JoeyLemur)
- **Backend plugins**: Support Forward OAuth Identity for backend data source plugins. [#27055](https://github.com/grafana/grafana/pull/27055), [@billoley](https://github.com/billoley)
- **Cloud Monitoring**: MQL support. [#26551](https://github.com/grafana/grafana/pull/26551), [@mtanda](https://github.com/mtanda)
- **CloudWatch**: Add 'EventBusName' dimension to CloudWatch 'AWS/Events' namespace. [#28402](https://github.com/grafana/grafana/pull/28402), [@tomdaly](https://github.com/tomdaly)
- **CloudWatch**: Add support for AWS DirectConnect ConnectionErrorCount metric. [#29583](https://github.com/grafana/grafana/pull/29583), [@haeringer](https://github.com/haeringer)
- **CloudWatch**: Add support for AWS/ClientVPN metrics and dimensions. [#29055](https://github.com/grafana/grafana/pull/29055), [@marefr](https://github.com/marefr)
- **CloudWatch**: Added HTTP API Gateway specific metrics and dimensions. [#28780](https://github.com/grafana/grafana/pull/28780), [@karlatkinson](https://github.com/karlatkinson)
- **Configuration**: Add an option to hide certain users in the UI. [#28942](https://github.com/grafana/grafana/pull/28942), [@AgnesToulet](https://github.com/AgnesToulet)
- **Currency**: Adds Indonesian IDR currency. [#28363](https://github.com/grafana/grafana/pull/28363), [@hiddenrebel](https://github.com/hiddenrebel)
- **Dashboards**: Delete related data (permissions, stars, tags, versions, annotations) when deleting a dashboard or a folder. [#28826](https://github.com/grafana/grafana/pull/28826), [@AgnesToulet](https://github.com/AgnesToulet)
- **Dependencies**: Update angularjs to 1.8.2. [#28736](https://github.com/grafana/grafana/pull/28736), [@torkelo](https://github.com/torkelo)
- **Docker**: Use root group in the custom Dockerfile. [#28639](https://github.com/grafana/grafana/pull/28639), [@chugunov](https://github.com/chugunov)
- **Elasticsearch**: Add Moving Function Pipeline Aggregation. [#28131](https://github.com/grafana/grafana/pull/28131), [@simianhacker](https://github.com/simianhacker)
- **Elasticsearch**: Add Support for Serial Differencing Pipeline Aggregation. [#28618](https://github.com/grafana/grafana/pull/28618), [@simianhacker](https://github.com/simianhacker)
- **Elasticsearch**: Deprecate browser access mode. [#29649](https://github.com/grafana/grafana/pull/29649), [@Elfo404](https://github.com/Elfo404)
- **Elasticsearch**: Interpolate variables in Filters Bucket Aggregation. [#28969](https://github.com/grafana/grafana/pull/28969), [@Elfo404](https://github.com/Elfo404)
- **Elasticsearch**: Support extended stats and percentiles in terms order by. [#28910](https://github.com/grafana/grafana/pull/28910), [@simianhacker](https://github.com/simianhacker)
- **Elasticsearch**: View in context feature for logs. [#28764](https://github.com/grafana/grafana/pull/28764), [@simianhacker](https://github.com/simianhacker)
- **Explore/Logs**: Alphabetically sort unique labels, labels and parsed fields. [#29030](https://github.com/grafana/grafana/pull/29030), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore/Logs**: Update Parsed fields to Detected fields. [#28881](https://github.com/grafana/grafana/pull/28881), [@ivanahuckova](https://github.com/ivanahuckova)
- **Field overrides**: Added matcher to match all fields returned by a specific query. [#28872](https://github.com/grafana/grafana/pull/28872), [@mckn](https://github.com/mckn)
- **Graph**: Add support for spline interpolation (smoothing) added in new time series panel. [#4303](https://github.com/grafana/grafana/issues/4303)
- **Instrumentation**: Add histograms for database queries. [#29662](https://github.com/grafana/grafana/pull/29662), [@dafydd-t](https://github.com/dafydd-t)
- **Jaeger**: Remove browser access mode. [#30349](https://github.com/grafana/grafana/pull/30349), [@zoltanbedi](https://github.com/zoltanbedi)
- **LogsPanel**: Don't show scroll bars when not needed. [#28972](https://github.com/grafana/grafana/pull/28972), [@aocenas](https://github.com/aocenas)
- **Loki**: Add query type and line limit to query editor in dashboard. [#29356](https://github.com/grafana/grafana/pull/29356), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki**: Add query type selector to query editor in Explore. [#28817](https://github.com/grafana/grafana/pull/28817), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki**: Retry web socket connection when connection is closed abnormally. [#29438](https://github.com/grafana/grafana/pull/29438), [@ivanahuckova](https://github.com/ivanahuckova)
- **MS SQL**: Integrated security. [#30369](https://github.com/grafana/grafana/pull/30369), [@daniellee](https://github.com/daniellee)
- **Middleware**: Add CSP support. [#29740](https://github.com/grafana/grafana/pull/29740), [@aknuds1](https://github.com/aknuds1)
- **OAuth**: Configurable user name attribute. [#28286](https://github.com/grafana/grafana/pull/28286), [@alexanderzobnin](https://github.com/alexanderzobnin)
- **PanelEditor**: Render panel field config categories as separate option group sections. [#30301](https://github.com/grafana/grafana/pull/30301), [@dprokop](https://github.com/dprokop)
- **Postgres**: SSL certification. [#30352](https://github.com/grafana/grafana/pull/30352), [@ying-jeanne](https://github.com/ying-jeanne)
- **Prometheus**: Add support for Exemplars. [#28057](https://github.com/grafana/grafana/pull/28057), [@zoltanbedi](https://github.com/zoltanbedi)
- **Prometheus**: Improve autocomplete performance and remove disabling of dynamic label lookup. [#30199](https://github.com/grafana/grafana/pull/30199), [@ivanahuckova](https://github.com/ivanahuckova)
- **Prometheus**: Update default query type option to "Both" in Explore query editor. [#28935](https://github.com/grafana/grafana/pull/28935), [@ivanahuckova](https://github.com/ivanahuckova)
- **Prometheus**: Use customQueryParameters for all queries. [#28949](https://github.com/grafana/grafana/pull/28949), [@alexbumbacea](https://github.com/alexbumbacea)
- **Security**: Prefer server cipher suites for http2. [#29379](https://github.com/grafana/grafana/pull/29379), [@bergquist](https://github.com/bergquist)
- **Security**: Remove insecure cipher suit as default option. [#29378](https://github.com/grafana/grafana/pull/29378), [@bergquist](https://github.com/bergquist)
- **StatPanels**: Add new calculation option for percentage difference. [#26369](https://github.com/grafana/grafana/pull/26369), [@jedstar](https://github.com/jedstar)
- **StatPanels**: Change default stats option to "Last (not null)". [#28617](https://github.com/grafana/grafana/pull/28617), [@ryantxu](https://github.com/ryantxu)
- **Table**: migrate old-table config to new table config. [#30142](https://github.com/grafana/grafana/pull/30142), [@jackw](https://github.com/jackw)
- **Templating**: Custom variable edit UI, change options input into textarea. [#28322](https://github.com/grafana/grafana/pull/28322), [@darrylsepeda](https://github.com/darrylsepeda)
- **TimeSeriesPanel**: The new graph panel now supports y-axis value mapping. [#30272](https://github.com/grafana/grafana/pull/30272), [@torkelo](https://github.com/torkelo)
- **Tracing**: Tag spans with user login and datasource name instead of id. [#29183](https://github.com/grafana/grafana/pull/29183), [@bergquist](https://github.com/bergquist)
- **Transformations**: Add "Rename By Regex" transformer. [#29281](https://github.com/grafana/grafana/pull/29281), [@simianhacker](https://github.com/simianhacker)
- **Transformations**: Added new transform for excluding and including rows based on their values. [#26884](https://github.com/grafana/grafana/pull/26884), [@Totalus](https://github.com/Totalus)
- **Transforms**: Add sort by transformer. [#30370](https://github.com/grafana/grafana/pull/30370), [@ryantxu](https://github.com/ryantxu)
- **Variables**: Add deprecation warning for value group tags. [#30160](https://github.com/grafana/grafana/pull/30160), [@torkelo](https://github.com/torkelo)
- **Variables**: Added \_\_user.email to global variable. [#28853](https://github.com/grafana/grafana/pull/28853), [@mckn](https://github.com/mckn)
- **Variables**: Adds description field. [#29332](https://github.com/grafana/grafana/pull/29332), [@hugohaggmark](https://github.com/hugohaggmark)
- **Variables**: Adds variables inspection. [#25214](https://github.com/grafana/grafana/pull/25214), [@hugohaggmark](https://github.com/hugohaggmark)
- **Variables**: New Variables are stored immediately. [#29178](https://github.com/grafana/grafana/pull/29178), [@hugohaggmark](https://github.com/hugohaggmark)
- **Zipkin**: Remove browser access mode. [#30360](https://github.com/grafana/grafana/pull/30360), [@zoltanbedi](https://github.com/zoltanbedi)

### Bug fixes

- **API**: Query database from /api/health endpoint. [#28349](https://github.com/grafana/grafana/pull/28349), [@ceh](https://github.com/ceh)
- **Alerting**: Return proper status code when trying to create alert notification channel with duplicate name or uid. [#28043](https://github.com/grafana/grafana/pull/28043), [@jgulick48](https://github.com/jgulick48)
- **Auth**: Fix default maximum lifetime an authenticated user can be logged in. [#30030](https://github.com/grafana/grafana/pull/30030), [@papagian](https://github.com/papagian)
- **Backend**: Fix IPv6 address parsing erroneous. [#28585](https://github.com/grafana/grafana/pull/28585), [@taciomcosta](https://github.com/taciomcosta)
- **CloudWatch**: Make sure stats grow horizontally and not vertically in the Query Editor. [#30106](https://github.com/grafana/grafana/pull/30106), [@sunker](https://github.com/sunker)
- **Cloudwatch**: Fix issue with field calculation transform not working properly with Cloudwatch data. [#28761](https://github.com/grafana/grafana/pull/28761), [@torkelo](https://github.com/torkelo)
- **Dashboards**: Hide playlist edit functionality from viewers and snapshots link from unauthenticated users. [#28992](https://github.com/grafana/grafana/pull/28992), [@jackw](https://github.com/jackw)
- **Data source proxy**: Convert 401 HTTP status code from data source to 400. [#28962](https://github.com/grafana/grafana/pull/28962), [@aknuds1](https://github.com/aknuds1)
- **Decimals**: Improving auto decimals logic for high numbers and scaled units. [#30262](https://github.com/grafana/grafana/pull/30262), [@torkelo](https://github.com/torkelo)
- **Elasticsearch**: Fix date histogram auto interval handling for alert queries. [#30049](https://github.com/grafana/grafana/pull/30049), [@simianhacker](https://github.com/simianhacker)
- **Elasticsearch**: Fix index pattern not working with multiple base sections. [#28348](https://github.com/grafana/grafana/pull/28348), [@tomdaly](https://github.com/tomdaly)
- **Explore**: Clear errors after running a new query. [#30367](https://github.com/grafana/grafana/pull/30367), [@ivanahuckova](https://github.com/ivanahuckova)
- **Graph**: Fixes stacking issues like floating bars when data is not aligned. [#29051](https://github.com/grafana/grafana/pull/29051), [@torkelo](https://github.com/torkelo)
- **Graph**: Staircase and null value=null calculates auto Y-Min incorrectly (fixed in new Time series panel). [#12995](https://github.com/grafana/grafana/issues/12995)
- **Graph**: Staircase mode, do now draw line segment from zero when drawing null values as null (Fixed in new Time series panel). [#17838](https://github.com/grafana/grafana/issues/17838)
- **Image uploader**: Fix uploading of images to GCS. [#26493](https://github.com/grafana/grafana/pull/26493), [@gastonqiu](https://github.com/gastonqiu)
- **Influx**: Fixes issue with many queries being issued as you type in the variable query field. [#29968](https://github.com/grafana/grafana/pull/29968), [@dprokop](https://github.com/dprokop)
- **Logs Panel**: Fix inconsistent highlighting. [#28971](https://github.com/grafana/grafana/pull/28971), [@ivanahuckova](https://github.com/ivanahuckova)
- **Logs Panel**: Fixes problem dragging scrollbar inside logs panel. [#28974](https://github.com/grafana/grafana/pull/28974), [@aocenas](https://github.com/aocenas)
- **Loki**: Fix hiding of series in table if labels have number values. [#30185](https://github.com/grafana/grafana/pull/30185), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki**: Lower min step to 1ms. [#30135](https://github.com/grafana/grafana/pull/30135), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki**: Remove showing of unique labels with the empty string value. [#30363](https://github.com/grafana/grafana/pull/30363), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki**: Timeseries should not produce 0-values for missing data. [#30116](https://github.com/grafana/grafana/pull/30116), [@davkal](https://github.com/davkal)
- **Plugins**: Fix panic when using complex dynamic URLs in app plugin routes. [#27977](https://github.com/grafana/grafana/pull/27977), [@cinaglia](https://github.com/cinaglia)
- **Prometheus**: Fix link to Prometheus graph in dashboard. [#29543](https://github.com/grafana/grafana/pull/29543), [@ivanahuckova](https://github.com/ivanahuckova)
- **Provisioning**: Build paths in an os independent way. [#29143](https://github.com/grafana/grafana/pull/29143), [@amattheisen](https://github.com/amattheisen)
- **Provisioning**: Fixed problem with getting started panel being added to custom home dashboard. [#28750](https://github.com/grafana/grafana/pull/28750), [@torkelo](https://github.com/torkelo)
- **SAML**: Fixes bug in processing SAML response with empty <Issuer> element by updating saml library (Enterprise). [#29991](https://github.com/grafana/grafana/pull/29991), [@alexanderzobnin](https://github.com/alexanderzobnin)
- **SQL**: Define primary key for tables without it. [#22255](https://github.com/grafana/grafana/pull/22255), [@azhiltsov](https://github.com/azhiltsov)
- **Tracing**: Fix issue showing more than 300 spans. [#29377](https://github.com/grafana/grafana/pull/29377), [@zoltanbedi](https://github.com/zoltanbedi)
- **Units**: Changes FLOP/s to FLOPS and some other rates per second units get /s suffix. [#28825](https://github.com/grafana/grafana/pull/28825), [@Berbe](https://github.com/Berbe)
- **Variables**: Fixes Constant variable persistence confusion. [#29407](https://github.com/grafana/grafana/pull/29407), [@hugohaggmark](https://github.com/hugohaggmark)
- **Variables**: Fixes Textbox current value persistence. [#29481](https://github.com/grafana/grafana/pull/29481), [@hugohaggmark](https://github.com/hugohaggmark)
- **Variables**: Fixes loading with a custom all value in url. [#28958](https://github.com/grafana/grafana/pull/28958), [@hugohaggmark](https://github.com/hugohaggmark)
- **Variables**: Fixes so clicking on Selected in drop down will exclude All value from selection. [#29844](https://github.com/grafana/grafana/pull/29844), [@hugohaggmark](https://github.com/hugohaggmark)

### Breaking changes

#### Constant variables

In order to minimize the confusion with Constant variable usage, we've removed the ability to make Constant variables visible. This change will also migrate **`all`** existing **`visible`** Constant variables to Textbox variables because which we think this is a more appropriate type of variable for this use case.
Issue [#29407](https://github.com/grafana/grafana/issues/29407)

#### Plugin compatibility

We have upgraded AngularJS from version 1.6.6 to 1.8.2. Due to this upgrade some old angular plugins might stop working and will require a small update. This is due to the deprecation and removal of pre-assigned bindings. So if your custom angular controllers expect component bindings in the controller constructor you need to move this code to an `$onInit` function. For more details on how to migrate AngularJS code open the [migration guide](https://docs.angularjs.org/guide/migration) and search for **pre-assigning bindings**.

In order not to break all angular panel plugins and data sources we have some custom [angular inject behavior](https://github.com/grafana/grafana/blob/master/public/app/core/injectorMonkeyPatch.ts) that makes sure that bindings for these controllers are still set before constructor is called so many old angular panels and data source plugins will still work. Issue [#28736](https://github.com/grafana/grafana/issues/28736)

### Deprecations

#### Query variable value group tags

This option to group query variable values into groups by tags has been an experimental feature since it was introduced. It was introduced to work around the lack of tags support in time series databases at the time. Now that tags (ie. labels) are the norm there is no longer any great need for this feature. This feature will be removed in Grafana v8 later this year. Issue [#30160](https://github.com/grafana/grafana/issues/30160)

### Plugin development fixes & changes

- **AngularPlugins**: Angular controller events emitter is now a separate emitter and not the same as PanelModel events emitter. [#30379](https://github.com/grafana/grafana/pull/30379), [@torkelo](https://github.com/torkelo)
- **FieldConfig API**: Add ability to hide field option or disable it from the overrides. [#29879](https://github.com/grafana/grafana/pull/29879), [@dprokop](https://github.com/dprokop)
- **Select**: Changes default menu placement for Select from auto to bottom. [#29837](https://github.com/grafana/grafana/pull/29837), [@hugohaggmark](https://github.com/hugohaggmark)
- **Collapse**: Allow component children to use height: 100% styling. [#29776](https://github.com/grafana/grafana/pull/29776), [@aocenas](https://github.com/aocenas)
- **DataSourceWithBackend**: Throw error if health check fails in DataSourceWithBackend. [#29743](https://github.com/grafana/grafana/pull/29743), [@aocenas](https://github.com/aocenas)
- **NodeGraph**: Add node graph visualization. [#29706](https://github.com/grafana/grafana/pull/29706), [@aocenas](https://github.com/aocenas)
- **FieldColor**: Handling color changes when switching panel types. [#28875](https://github.com/grafana/grafana/pull/28875), [@dprokop](https://github.com/dprokop)
- **CodeEditor**: Added support for javascript language. [#28818](https://github.com/grafana/grafana/pull/28818), [@ae3e](https://github.com/ae3e)
- **grafana/toolkit**: Allow builds with lint warnings. [#28810](https://github.com/grafana/grafana/pull/28810), [@dprokop](https://github.com/dprokop)
- **grafana/toolkit**: Drop console and debugger statements by default when building plugin. [#28776](https://github.com/grafana/grafana/pull/28776), [@dprokop](https://github.com/dprokop)
- **Card**: Add new Card component. [#28216](https://github.com/grafana/grafana/pull/28216), [@Clarity-89](https://github.com/Clarity-89)
- **FieldConfig**: Implementation slider editor (#27592). [#28007](https://github.com/grafana/grafana/pull/28007), [@isaozlerfm](https://github.com/isaozlerfm)
- **MutableDataFrame**: Remove unique field name constraint and values field index and unused/seldom used stuff. [#27573](https://github.com/grafana/grafana/pull/27573), [@torkelo](https://github.com/torkelo)

<!-- 7.4.0-beta1 END -->

<!-- 7.3.10 START -->

# 7.3.10 (2021-03-18)

### Bug fixes

- **Security**: Fix API permissions issues related to team-sync CVE-2021-28146, CVE-2021-28147. (Enterprise)
- **Security**: Usage insights requires signed in users CVE-2021-28148. (Enterprise)

<!-- 7.3.10 END -->

<!-- 7.3.7 START -->

# 7.3.7 (2021-01-14)

### Bug fixes

- **Auth**: Add missing request headers to SigV4 middleware allowlist. [#30115](https://github.com/grafana/grafana/pull/30115), [@wbrowne](https://github.com/wbrowne)
- **Elasticsearch**: Sort results by index order as well as @timestamp. [#29761](https://github.com/grafana/grafana/pull/29761), [@STEELBADGE](https://github.com/STEELBADGE)
- **SAML**: Fixes bug in processing SAML response with empty <Issuer> element by updating saml library (Enterprise). [#30179](https://github.com/grafana/grafana/pull/30179), [@alexanderzobnin](https://github.com/alexanderzobnin)
- **SeriesToRows**: Fixes issue in transform so that value field is always named Value. [#30054](https://github.com/grafana/grafana/pull/30054), [@torkelo](https://github.com/torkelo)

<!-- 7.3.7 END -->

<!-- 7.3.6 START -->

# 7.3.6 (2020-12-17)

### Security

- **SAML**: Fixes encoding/xml SAML vulnerability in Grafana Enterprise. [#29875](https://github.com/grafana/grafana/issues/29875)

<!-- 7.3.6 END -->

<!-- 7.3.5 START -->

# 7.3.5 (2020-12-10)

### Features and enhancements

- **Alerting**: Improve Prometheus Alert Rule error message. [#29390](https://github.com/grafana/grafana/pull/29390), [@wbrowne](https://github.com/wbrowne)

### Bug fixes

- **Alerting**: Fix alarm message formatting in Dingding. [#29482](https://github.com/grafana/grafana/pull/29482), [@tomowang](https://github.com/tomowang)
- **AzureMonitor**: Fix unit translation for MilliSeconds. [#29399](https://github.com/grafana/grafana/pull/29399), [@secustor](https://github.com/secustor)
- **Instrumentation**: Fix bug with invalid handler label value for HTTP request metrics. [#29529](https://github.com/grafana/grafana/pull/29529), [@bergquist](https://github.com/bergquist)
- **Prometheus**: Fixes problem where changing display name in Field tab had no effect. [#29441](https://github.com/grafana/grafana/pull/29441), [@zoltanbedi](https://github.com/zoltanbedi)
- **Tracing**: Fixed issue showing more than 300 spans. [#29377](https://github.com/grafana/grafana/pull/29377), [@zoltanbedi](https://github.com/zoltanbedi)

<!-- 7.3.5 END -->

<!-- 7.3.4 START -->

# 7.3.4 (2020-11-24)

### Bug fixes

- **Dashboard**: Fixes kiosk state after being redirected to login page and back. [#29273](https://github.com/grafana/grafana/pull/29273), [@torkelo](https://github.com/torkelo)
- **InfluxDB**: Update flux library to fix support for boolean label values. [#29310](https://github.com/grafana/grafana/pull/29310), [@ryantxu](https://github.com/ryantxu)
- **Security**: Fixes minor security issue with alert notification webhooks that allowed GET & DELETE requests. [#29330](https://github.com/grafana/grafana/pull/29330), [@wbrowne](https://github.com/wbrowne)
- **Table**: Fixes issues with phantom extra 0 for zero values. [#29165](https://github.com/grafana/grafana/pull/29165), [@dprokop](https://github.com/dprokop)

<!-- 7.3.4 END -->

<!-- 7.3.3 START -->

# 7.3.3 (2020-11-17)

### Bug fixes

- **Cloud monitoring**: Fix for multi-value template variable for project selector. [#29042](https://github.com/grafana/grafana/pull/29042), [@papagian](https://github.com/papagian)
- **LogsPanel**: Fixes problem dragging scrollbar inside logs panel. [#28974](https://github.com/grafana/grafana/pull/28974), [@aocenas](https://github.com/aocenas)
- **Provisioning**: Fixes application not pinned to the sidebar when it's enabled. [#29084](https://github.com/grafana/grafana/pull/29084), [@alexanderzobnin](https://github.com/alexanderzobnin)
- **StatPanel**: Fixes hanging issue when all values are zero. [#29077](https://github.com/grafana/grafana/pull/29077), [@torkelo](https://github.com/torkelo)
- **Thresholds**: Fixes color assigned to null values. [#29010](https://github.com/grafana/grafana/pull/29010), [@torkelo](https://github.com/torkelo)

<!-- 7.3.3 END -->

<!-- 7.3.2 START -->

# 7.3.2 (2020-11-11)

### Features / Enhancements

- **CloudWatch Logs**: Change how we measure query progress. [#28912](https://github.com/grafana/grafana/pull/28912), [@aocenas](https://github.com/aocenas)
- **Dashboards / Folders**: delete related data (permissions, stars, tags, versions, annotations) when deleting a dashboard or a folder. [#28826](https://github.com/grafana/grafana/pull/28826), [@AgnesToulet](https://github.com/AgnesToulet)
- **Gauge**: Improve font size auto sizing. [#28797](https://github.com/grafana/grafana/pull/28797), [@torkelo](https://github.com/torkelo)
- **Short URL**: Cleanup unvisited/stale short URLs. [#28867](https://github.com/grafana/grafana/pull/28867), [@wbrowne](https://github.com/wbrowne)
- **Templating**: Custom variable edit UI, change options input into textarea. [#28322](https://github.com/grafana/grafana/pull/28322), [@darrylsepeda](https://github.com/darrylsepeda)

### Bug Fixes

- **Cloudwatch**: Fix issue with field calculation transform not working properly with Cloudwatch data. [#28761](https://github.com/grafana/grafana/pull/28761), [@torkelo](https://github.com/torkelo)
- **Dashboard**: fix view panel mode for Safari / iOS. [#28702](https://github.com/grafana/grafana/pull/28702), [@jackw](https://github.com/jackw)
- **Elasticsearch**: Exclude pipeline aggregations from order by options. [#28620](https://github.com/grafana/grafana/pull/28620), [@simianhacker](https://github.com/simianhacker)
- **Panel inspect**: Interpolate variables in panel inspect title. [#28779](https://github.com/grafana/grafana/pull/28779), [@dprokop](https://github.com/dprokop)
- **Prometheus**: Fix copy paste behaving as cut and paste. [#28622](https://github.com/grafana/grafana/pull/28622), [@aocenas](https://github.com/aocenas)
- **StatPanels**: Fixes auto min max when latest value is zero. [#28982](https://github.com/grafana/grafana/pull/28982), [@torkelo](https://github.com/torkelo)
- **TableFilters**: Fixes filtering with field overrides. [#28690](https://github.com/grafana/grafana/pull/28690), [@hugohaggmark](https://github.com/hugohaggmark)
- **Templating**: Speeds up certain variable queries for Postgres MySql MSSql. [#28686](https://github.com/grafana/grafana/pull/28686), [@hugohaggmark](https://github.com/hugohaggmark)
- **Units**: added support to handle negative fractional numbers. [#28849](https://github.com/grafana/grafana/pull/28849), [@mckn](https://github.com/mckn)
- **Variables**: Fix backward compatibility in custom variable options that contain colon. [#28896](https://github.com/grafana/grafana/pull/28896), [@mckn](https://github.com/mckn)

<!-- 7.3.2 END -->

# 7.3.1 (2020-10-30)

### Bug Fixes

- **Cloudwatch**: Fix duplicate metric data. [#28642](https://github.com/grafana/grafana/pull/28642), [@zoltanbedi](https://github.com/zoltanbedi)
- **Loki**: Fix error when some queries return zero results. [#28645](https://github.com/grafana/grafana/pull/28645), [@ivanahuckova](https://github.com/ivanahuckova)
- **PanelMenu**: Fix panel submenu not being accessible for panels close to the right edge of the screen. [#28666](https://github.com/grafana/grafana/pull/28666), [@torkelo](https://github.com/torkelo)
- **Plugins**: Fix descendent frontend plugin signature validation. [#28638](https://github.com/grafana/grafana/pull/28638), [@wbrowne](https://github.com/wbrowne)
- **StatPanel**: Fix value being under graph and reduced likelihood for white and dark value text mixing. [#28641](https://github.com/grafana/grafana/pull/28641), [@torkelo](https://github.com/torkelo)
- **TextPanel**: Fix problems where text panel would show old content. [#28643](https://github.com/grafana/grafana/pull/28643), [@torkelo](https://github.com/torkelo)

# 7.3.0 (2020-10-28)

### Features / Enhancements

- **AzureMonitor**: Support decimal (as float64) type in analytics/logs. [#28480](https://github.com/grafana/grafana/pull/28480), [@kylebrandt](https://github.com/kylebrandt)
- **Plugins signing**: UI information. [#28469](https://github.com/grafana/grafana/pull/28469), [@dprokop](https://github.com/dprokop)
- **Short URL**: Update last seen at when visiting a short URL. [#28565](https://github.com/grafana/grafana/pull/28565), [@marefr](https://github.com/marefr)

### Bug Fixes

- **Alerting**: Log warnings for obsolete notifiers when extracting alerts and remove frequent error log messages. [#28162](https://github.com/grafana/grafana/pull/28162), [@papagian](https://github.com/papagian)
- **Auth**: Fix SigV4 request verification step for Amazon Elasticsearch Service. [#28481](https://github.com/grafana/grafana/pull/28481), [@wbrowne](https://github.com/wbrowne)
- **Auth**: Should redirect to login when anonymous enabled and URL with different org than anonymous specified. [#28158](https://github.com/grafana/grafana/pull/28158), [@marefr](https://github.com/marefr)
- **Elasticsearch**: Fix handling of errors when testing data source. [#28498](https://github.com/grafana/grafana/pull/28498), [@marefr](https://github.com/marefr)
- **Graphite**: Fix default version to be 1.1. [#28471](https://github.com/grafana/grafana/pull/28471), [@ivanahuckova](https://github.com/ivanahuckova)
- **StatPanel**: Fixes BizChart error max: yyy should not be less than min zzz. [#28587](https://github.com/grafana/grafana/pull/28587), [@hugohaggmark](https://github.com/hugohaggmark)

# 7.3.0-beta2 (2020-10-22)

### Features / Enhancements

- **Add monitoring mixing for Grafana**. [#28285](https://github.com/grafana/grafana/pull/28285), [@bergquist](https://github.com/bergquist)
- **CloudWatch**: Missing Namespace AWS/EC2CapacityReservations. [#28309](https://github.com/grafana/grafana/pull/28309), [@nonamef](https://github.com/nonamef)
- **Explore**: Support wide data frames. [#28393](https://github.com/grafana/grafana/pull/28393), [@aocenas](https://github.com/aocenas)
- **Instrumentation**: Add counters and histograms for database queries. [#28236](https://github.com/grafana/grafana/pull/28236), [@bergquist](https://github.com/bergquist)
- **Loki**: Visually distinguish error logs for LogQL2. [#28359](https://github.com/grafana/grafana/pull/28359), [@ivanahuckova](https://github.com/ivanahuckova)

### Bug Fixes

- **API**: Fix short URLs. [#28300](https://github.com/grafana/grafana/pull/28300), [@aknuds1](https://github.com/aknuds1)
- **BackendSrv**: Fixes queue countdown when unsubscribe is before response. [#28323](https://github.com/grafana/grafana/pull/28323), [@hugohaggmark](https://github.com/hugohaggmark)
- **CloudWatch/Athena - valid metrics and dimensions.**. [#28436](https://github.com/grafana/grafana/pull/28436), [@kwarunek](https://github.com/kwarunek)
- **Dashboard links**: Places drop down list so it's always visible. [#28330](https://github.com/grafana/grafana/pull/28330), [@maknik](https://github.com/maknik)
- **Graph**: Fix for graph size not taking up full height or width. [#28314](https://github.com/grafana/grafana/pull/28314), [@jackw](https://github.com/jackw)
- **Loki**: Base maxDataPoints limits on query type. [#28298](https://github.com/grafana/grafana/pull/28298), [@aocenas](https://github.com/aocenas)
- **Loki**: Run instant query only when doing metric query. [#28325](https://github.com/grafana/grafana/pull/28325), [@aocenas](https://github.com/aocenas)
- **Plugins**: Don't exit on duplicate plugin. [#28390](https://github.com/grafana/grafana/pull/28390), [@aknuds1](https://github.com/aknuds1)

# 7.3.0-beta1 (2020-10-15)

### Breaking changes

- **CloudWatch**: The AWS CloudWatch data source's authentication scheme has changed. See the [upgrade notes](https://grafana.com/docs/grafana/latest/installation/upgrading/#upgrading-to-v73) for details and how this may affect you.
- **Docker**: The Grafana docker image will run with the root group instead of the Grafana group. This may break builds for users who extend the official Docker images. Refer to the [upgrade notes](https://grafana.com/docs/grafana/latest/installation/upgrading/#upgrading-to-v73) for details.

### Features / Enhancements

- **Alerting**: Add labels to name when converting data frame to series. [#28085](https://github.com/grafana/grafana/pull/28085), [@kylebrandt](https://github.com/kylebrandt)
- **Alerting**: Ensuring LINE Notify notifications are sent for all alert states. [#27639](https://github.com/grafana/grafana/pull/27639), [@haraldkubota](https://github.com/haraldkubota)
- **Auth**: Add SigV4 auth option to datasources. [#27552](https://github.com/grafana/grafana/pull/27552), [@wbrowne](https://github.com/wbrowne)
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

### Bug Fixes

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

<!-- 7.2.3 START -->

# 7.2.3 (2020-12-17)

### Security

- **SAML**: Fixes encoding/xml SAML vulnerability in Grafana Enterprise [#29875](https://github.com/grafana/grafana/issues/29875), [@bergquist](https://github.com/bergquist)

<!-- 7.2.3 END -->

# 7.2.2 (2020-10-21)

### Features / Enhancements

**Caution:** Please do not use/enable the `database_metrics` feature flag. It will corrupt MySQL database tables. See [#28440](https://github.com/grafana/grafana/issues/28440) for more information.

~~**Instrumentation**: Add counters and histograms for database queries. [#28236](https://github.com/grafana/grafana/pull/28236), [@bergquist](https://github.com/bergquist)~~

- **Instrumentation**: Add histogram for request duration. [#28364](https://github.com/grafana/grafana/pull/28364), [@bergquist](https://github.com/bergquist)
- **Instrumentation**: Adds environment_info metric. [#28355](https://github.com/grafana/grafana/pull/28355), [@bergquist](https://github.com/bergquist)

### Bug Fixes

- **CloudWatch**: Fix custom metrics. [#28391](https://github.com/grafana/grafana/pull/28391), [@aknuds1](https://github.com/aknuds1)

# 7.2.1 (2020-10-08)

### Features / Enhancements

- **Api**: Add /healthz endpoint for health checks. [#27536](https://github.com/grafana/grafana/pull/27536), [@bergquist](https://github.com/bergquist)
- **Api**: Healthchecks should not be rejected due to domain enforcement checks. [#27981](https://github.com/grafana/grafana/pull/27981), [@bergquist](https://github.com/bergquist)
- **Instrumentation**: Removes invalid chars from label names. [#27921](https://github.com/grafana/grafana/pull/27921), [@bergquist](https://github.com/bergquist)
- **Orgs**: Remove organisations deprecation notice from backend. [#27788](https://github.com/grafana/grafana/pull/27788), [@wbrowne](https://github.com/wbrowne)
- **grafana/toolkit**: Add --coverage flag to plugin build command. [#27743](https://github.com/grafana/grafana/pull/27743), [@gassiss](https://github.com/gassiss)

### Bug Fixes

- **BarGauge**: Fixed scrollbar showing for bar gauge in Firefox. [#27784](https://github.com/grafana/grafana/pull/27784), [@torkelo](https://github.com/torkelo)
- **Dashboard**: Honour root_url for Explore link. [#27654](https://github.com/grafana/grafana/pull/27654), [@tiagomotasantos](https://github.com/tiagomotasantos)
- **DashboardLinks**: values in links are updated when variables change. [#27926](https://github.com/grafana/grafana/pull/27926), [@hugohaggmark](https://github.com/hugohaggmark)
- **Elasticsearch**: Add query's refId to each series returned by a query. [#27614](https://github.com/grafana/grafana/pull/27614), [@Elfo404](https://github.com/Elfo404)
- **Elasticsearch**: Fix ad-hoc filter support for Raw Data query and new table panel. [#28064](https://github.com/grafana/grafana/pull/28064), [@Elfo404](https://github.com/Elfo404)
- **Graph**: Fixed histogram bucket calculations to avoid missing buckets. [#27883](https://github.com/grafana/grafana/pull/27883), [@torkelo](https://github.com/torkelo)
- **Loki**: Run instant query only in Explore. [#27974](https://github.com/grafana/grafana/pull/27974), [@ivanahuckova](https://github.com/ivanahuckova)
- **Units**: bps & Bps default scale remains decimal (backwards-compatibility). [#27838](https://github.com/grafana/grafana/pull/27838), [@Berbe](https://github.com/Berbe)
- **ValueMappings**: Fix issue with value mappings in override applying to all columns. [#27718](https://github.com/grafana/grafana/pull/27718), [@torkelo](https://github.com/torkelo)

# 7.2.0 (2020-09-23)

### Features / Enhancements

- **Alerting**: Ensuring notifications displayed correctly in mobile device with Google Chat. [#27578](https://github.com/grafana/grafana/pull/27578), [@alvarolmedo](https://github.com/alvarolmedo)
- **TraceView**: Show full traceID and better discern multiple stackTraces in span details. [#27710](https://github.com/grafana/grafana/pull/27710), [@aocenas](https://github.com/aocenas)

### Bug Fixes

- **DataLinks**: Fixes issue with data links not interpolating values with correct field config. [#27622](https://github.com/grafana/grafana/pull/27622), [@torkelo](https://github.com/torkelo)
- **DataProxy**: Ignore empty URL's in plugin routes. [#27653](https://github.com/grafana/grafana/pull/27653), [@domasx2](https://github.com/domasx2)
- **Field config**: Respect config paths when rendering default value of field config property. [#27652](https://github.com/grafana/grafana/pull/27652), [@dprokop](https://github.com/dprokop)
- **Field config**: Fix mismatch in field config editor types. [#27657](https://github.com/grafana/grafana/pull/27657), [@dprokop](https://github.com/dprokop)
- **Panel editor**: Prevents adding transformations in panels with alerts. [#27706](https://github.com/grafana/grafana/pull/27706), [@hugohaggmark](https://github.com/hugohaggmark)
- **Stat panel**: Fix problem where string values where always green. [#27656](https://github.com/grafana/grafana/pull/27656), [@peterholmberg](https://github.com/peterholmberg)

# 7.2.0-beta2 (2020-09-17)

### Features / Enhancements

- **API**: Enrich add user to org endpoints with user ID in the response. [#27551](https://github.com/grafana/grafana/pull/27551), [@AgnesToulet](https://github.com/AgnesToulet)
- **API**: Enrich responses and improve error handling for alerting API endpoints. [#27550](https://github.com/grafana/grafana/pull/27550), [@AgnesToulet](https://github.com/AgnesToulet)
- **Auth**: Replace maximum inactive/lifetime settings of days to duration. [#27150](https://github.com/grafana/grafana/pull/27150), [@Hansuuuuuuuuuu](https://github.com/Hansuuuuuuuuuu)
- **Dashboard**: Support configuring default timezone via config file. [#27404](https://github.com/grafana/grafana/pull/27404), [@woutersmeenk](https://github.com/woutersmeenk)
- **Elasticsearch**: Add support for date_nanos type. [#27538](https://github.com/grafana/grafana/pull/27538), [@Elfo404](https://github.com/Elfo404)
- **Elasticsearch**: Allow fields starting with underscore. [#27520](https://github.com/grafana/grafana/pull/27520), [@Elfo404](https://github.com/Elfo404)
- **Elasticsearch**: Increase maximum geohash aggregation precision to 12. [#27539](https://github.com/grafana/grafana/pull/27539), [@Elfo404](https://github.com/Elfo404)
- **Field config**: Add support for paths in default field config setup. [#27570](https://github.com/grafana/grafana/pull/27570), [@dprokop](https://github.com/dprokop)
- **Postgres**: Support request cancellation properly (Uses new backendSrv.fetch Observable request API). [#27478](https://github.com/grafana/grafana/pull/27478), [@hugohaggmark](https://github.com/hugohaggmark)
- **Provisioning**: Remove provisioned dashboards without parental reader. [#26143](https://github.com/grafana/grafana/pull/26143), [@nabokihms](https://github.com/nabokihms)
- **Variables**: Limit rendering of options in dropdown to improve search performance. [#27525](https://github.com/grafana/grafana/pull/27525), [@guoqn](https://github.com/guoqn)
- **Units**: Binary-prefixed data rates. [#27022](https://github.com/grafana/grafana/pull/27022), [@Berbe](https://github.com/Berbe)

### Bug Fixes

- **Admin**: Fixes close('X') button layout issue in API keys page. [#27625](https://github.com/grafana/grafana/pull/27625), [@nikasvan](https://github.com/nikasvan)
- **Alerting**: Fix integration key so it's stored encrypted for Pagerduty notifier. [#27484](https://github.com/grafana/grafana/pull/27484), [@marefr](https://github.com/marefr)
- **Annotations**: Fixes issue with showing error notice for cancelled annotation queries. [#27557](https://github.com/grafana/grafana/pull/27557), [@torkelo](https://github.com/torkelo)
- **Azure/Insights**: Fix handling of legacy dimension values. [#27513](https://github.com/grafana/grafana/pull/27513), [@marefr](https://github.com/marefr)
- **DataLinks**: Respects display name and adds field quoting. [#27616](https://github.com/grafana/grafana/pull/27616), [@hugohaggmark](https://github.com/hugohaggmark)
- **ImageRendering**: Fix rendering panel using shared query in png, PDF reports and embedded scenarios. [#27628](https://github.com/grafana/grafana/pull/27628), [@torkelo](https://github.com/torkelo)
- **InputControl**: Fixed using InputControl in unit tests from plugins. [#27615](https://github.com/grafana/grafana/pull/27615), [@torkelo](https://github.com/torkelo)
- **NewsPanel**: Fixed XSS issue when rendering rss links. [#27612](https://github.com/grafana/grafana/pull/27612), [@torkelo](https://github.com/torkelo)
- **Transforms**: Fix for issue in labels to fields transform where the new option value field name did not work properly. [#27501](https://github.com/grafana/grafana/pull/27501), [@torkelo](https://github.com/torkelo)

# 7.2.0-beta1 (2020-09-09)

### Breaking changes

- **Units**: The date time units `YYYY-MM-DD HH:mm:ss` and `MM/DD/YYYY h:mm:ss a` have been renamed to `Datetime ISO`
  and `Datetime US` respectively. This is no breaking change just a visual name change (the unit id is unchanged). The
  unit behavior is different however, it no longer hides the date part if the date is today. If you want this old
  behavior you need to change unit to `Datetime ISO (No date if today)` or `Datetime US (No date if today)`.

### Features / Enhancements

- **API**: Return ID of the deleted resource for dashboard, datasource and folder DELETE endpoints. [#26691](https://github.com/grafana/grafana/pull/26691), [@AgnesToulet](https://github.com/AgnesToulet)
- **API**: Support paging in the admin orgs list API. [#26932](https://github.com/grafana/grafana/pull/26932), [@benjaminjb](https://github.com/benjaminjb)
- **API**: return resource ID for auth key creation, folder permissions update and user invite complete endpoints. [#27419](https://github.com/grafana/grafana/pull/27419), [@AgnesToulet](https://github.com/AgnesToulet)
- **Alerting**: Add toggle to disable alert threshold visibility in graph panel. [#25705](https://github.com/grafana/grafana/pull/25705), [@jpalpant](https://github.com/jpalpant)
- **Alerting**: Adds support for overriding 'dedup_key' via alert tags when using the Pagerduty notifier. [#27356](https://github.com/grafana/grafana/pull/27356), [@alavrovinfb](https://github.com/alavrovinfb)
- **Alerting**: Change alert rule link in alert notifications to open panel in view mode. [#27378](https://github.com/grafana/grafana/pull/27378), [@robertlestak](https://github.com/robertlestak)
- **Alerting**: Support storing sensitive notifier settings securely/encrypted. [#25114](https://github.com/grafana/grafana/pull/25114), [@mtanda](https://github.com/mtanda)
- **Annotation**: Add clean up job for old annotations. [#26156](https://github.com/grafana/grafana/pull/26156), [@bergquist](https://github.com/bergquist)
- **AzureMonitor**: select plugin route from cloudname. [#27273](https://github.com/grafana/grafana/pull/27273), [@kylebrandt](https://github.com/kylebrandt)
- **BackendSrv**: Uses credentials, deprecates withCredentials & defaults to same-origin. [#27385](https://github.com/grafana/grafana/pull/27385), [@hugohaggmark](https://github.com/hugohaggmark)
- **Chore**: Upgrade to Go 1.15.1. [#27326](https://github.com/grafana/grafana/pull/27326), [@aknuds1](https://github.com/aknuds1)
- **CloudWatch**: Update list of AmazonMQ metrics and dimensions. [#27332](https://github.com/grafana/grafana/pull/27332), [@szymonpk](https://github.com/szymonpk)
- **Cloudwatch**: Add Support for external ID in assume role. [#23685](https://github.com/grafana/grafana/pull/23685), [@gdhananjay](https://github.com/gdhananjay)
- **Cloudwatch**: Add af-south-1 region. [#26513](https://github.com/grafana/grafana/pull/26513), [@ruanbekker](https://github.com/ruanbekker)
- **Dashboard**: Add Duplicate dashboard links button to links list. [#26600](https://github.com/grafana/grafana/pull/26600), [@Hmerac](https://github.com/Hmerac)
- **Dashboard**: Adds folder name and link to the dashboard overview on the homepage. [#27214](https://github.com/grafana/grafana/pull/27214), [@michelengelen](https://github.com/michelengelen)
- **Database**: Set 0640 permissions on SQLite database file. [#26339](https://github.com/grafana/grafana/pull/26339), [@aknuds1](https://github.com/aknuds1)
- **DateFormats**: Default ISO & US formats never omit date part even if date is today (breaking change). [#27300](https://github.com/grafana/grafana/pull/27300), [@torkelo](https://github.com/torkelo)
- **Explore/Loki**: POC for toggling parsed fields in the list view. [#26178](https://github.com/grafana/grafana/pull/26178), [@fredr](https://github.com/fredr)
- **Explore**: Sort order of log results. [#26669](https://github.com/grafana/grafana/pull/26669), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore**: Transform prometheus query to elasticsearch query. [#23670](https://github.com/grafana/grafana/pull/23670), [@melchiormoulin](https://github.com/melchiormoulin)
- **Field overrides**: Overrides UI improvements. [#27073](https://github.com/grafana/grafana/pull/27073), [@dprokop](https://github.com/dprokop)
- **Heatmap**: Reduce the aggressiveness of hiding ticks/labels when panel is small. [#27016](https://github.com/grafana/grafana/pull/27016), [@lrstanley](https://github.com/lrstanley)
- **Image Store**: Add support for using signed URLs when uploading images to GCS. [#26840](https://github.com/grafana/grafana/pull/26840), [@marcosrmendezthd](https://github.com/marcosrmendezthd)
- **Image Store**: Fallback to application default credentials when no key file is specified for GCS. [#25948](https://github.com/grafana/grafana/pull/25948), [@Eraac](https://github.com/Eraac)
- **InfluxDB/Flux**: Increase series limit for Flux datasource. [#26746](https://github.com/grafana/grafana/pull/26746), [@sneddrs](https://github.com/sneddrs)
- **InfluxDB**: exclude result and table column from Flux table results. [#27081](https://github.com/grafana/grafana/pull/27081), [@ryantxu](https://github.com/ryantxu)
- **InfluxDB**: return a table rather than an error when timeseries is missing time. [#27320](https://github.com/grafana/grafana/pull/27320), [@ryantxu](https://github.com/ryantxu)
- **Instrumentation**: Adds instrumentation for outgoing datasource requests. [#27427](https://github.com/grafana/grafana/pull/27427), [@bergquist](https://github.com/bergquist)
- **Loki**: Add scopedVars support in legend formatting for repeated variables. [#27046](https://github.com/grafana/grafana/pull/27046), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki**: Re-introduce running of instant queries. [#27213](https://github.com/grafana/grafana/pull/27213), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki**: Support request cancellation properly (Uses new backendSrv.fetch Observable request API). [#27265](https://github.com/grafana/grafana/pull/27265), [@hugohaggmark](https://github.com/hugohaggmark)
- **MixedDatasource**: Shows retrieved data even if a data source fails. [#27024](https://github.com/grafana/grafana/pull/27024), [@hugohaggmark](https://github.com/hugohaggmark)
- **OAuth**: Handle DEFLATE compressed payloads in JWT for Generic OAuth. [#26969](https://github.com/grafana/grafana/pull/26969), [@billoley](https://github.com/billoley)
- **OAuth**: Increase state cookie max age. [#27258](https://github.com/grafana/grafana/pull/27258), [@bergquist](https://github.com/bergquist)
- **Orgs**: Remove org deprecation notice as we have decided to preserve multi-org support. [#26853](https://github.com/grafana/grafana/pull/26853), [@torkelo](https://github.com/torkelo)
- **PanelInspector**: Adds a Raw display mode but defaults to Formatted display mode. [#27306](https://github.com/grafana/grafana/pull/27306), [@hugohaggmark](https://github.com/hugohaggmark)
- **Postgres**: Support Unix socket for host. [#25778](https://github.com/grafana/grafana/pull/25778), [@aknuds1](https://github.com/aknuds1)
- **Prometheus**: Add scopedVars support in legend formatting for repeated variables. [#27047](https://github.com/grafana/grafana/pull/27047), [@ivanahuckova](https://github.com/ivanahuckova)
- **Prometheus**: Support request cancellation properly (Uses new backendSrv.fetch Observable request API). [#27090](https://github.com/grafana/grafana/pull/27090), [@hugohaggmark](https://github.com/hugohaggmark)
- **Prometheus**: add $\_\_rate_interval variable. [#26937](https://github.com/grafana/grafana/pull/26937), [@zoltanbedi](https://github.com/zoltanbedi)
- **Provisioning**: Validate that datasource access field equals to direct or proxy. [#26440](https://github.com/grafana/grafana/pull/26440), [@nabokihms](https://github.com/nabokihms)
- **RangeUtils**: migrate logic from kbn to grafana/data. [#27347](https://github.com/grafana/grafana/pull/27347), [@ryantxu](https://github.com/ryantxu)
- **Table**: Adds column filtering. [#27225](https://github.com/grafana/grafana/pull/27225), [@hugohaggmark](https://github.com/hugohaggmark)
- **Table**: Support showing numbers in strings with full original value. [#27097](https://github.com/grafana/grafana/pull/27097), [@torkelo](https://github.com/torkelo)
- **TablePanel**: Add support for basic gauge as a cell display mode. [#26595](https://github.com/grafana/grafana/pull/26595), [@jutley](https://github.com/jutley)
- **Transformations**: Group by and aggregate on multiple fields. [#25498](https://github.com/grafana/grafana/pull/25498), [@Totalus](https://github.com/Totalus)
- **Transformations**: enable transformations reorder. [#27197](https://github.com/grafana/grafana/pull/27197), [@dprokop](https://github.com/dprokop)
- **Units**: Allow re-scaling nanoseconds up to days. [#26458](https://github.com/grafana/grafana/pull/26458), [@kaydelaney](https://github.com/kaydelaney)
- **grafana-cli**: Add ability to read password from stdin to reset admin password. [#26016](https://github.com/grafana/grafana/pull/26016), [@nabokihms](https://github.com/nabokihms)
- **Reporting**: add branding options. (Enterprise)
- **Reporting**: allow setting custom timerange. (Enterprise)

### Bug Fixes

- **Auth**: Fix signup workflow and UI when verify email is enabled. [#26263](https://github.com/grafana/grafana/pull/26263), [@KamalGalrani](https://github.com/KamalGalrani)
- **AzureMonitor**: Change filterDimensions property to match what is stored. [#27459](https://github.com/grafana/grafana/pull/27459), [@kylebrandt](https://github.com/kylebrandt)
- **Cloud Monitoring**: Fix missing title and text from cloud monitoring annotations. [#27187](https://github.com/grafana/grafana/pull/27187), [@atotto](https://github.com/atotto)
- **CloudWatch**: Fix error message returned from tag:GetResources. [#27205](https://github.com/grafana/grafana/pull/27205), [@kichik](https://github.com/kichik)
- **Cloudwatch**: Update AWS/MediaConnect metrics and dimensions. [#26093](https://github.com/grafana/grafana/pull/26093), [@papagian](https://github.com/papagian)
- **DashboardSettings**: Fixes auto refresh crash with space in interval. [#27438](https://github.com/grafana/grafana/pull/27438), [@hugohaggmark](https://github.com/hugohaggmark)
- **Elasticsearch**: Fix localized dates in index pattern. [#27351](https://github.com/grafana/grafana/pull/27351), [@domasx2](https://github.com/domasx2)
- **Elasticsearch**: Fix using multiple bucket script aggregations when only grouping by terms. [#24064](https://github.com/grafana/grafana/pull/24064), [@MarceloNunesAlves](https://github.com/MarceloNunesAlves)
- **Explore**: Expand template variables when redirecting from dashboard panel. [#27354](https://github.com/grafana/grafana/pull/27354), [@Elfo404](https://github.com/Elfo404)
- **FolderPicker**: Fixes not being able to create new folder. [#27092](https://github.com/grafana/grafana/pull/27092), [@hugohaggmark](https://github.com/hugohaggmark)
- **Graphite**: Show and hide query editor function popup on click. [#26923](https://github.com/grafana/grafana/pull/26923), [@ivanahuckova](https://github.com/ivanahuckova)
- **InfluxDB/Flux**: Fix for Alerts on InfluxDB Flux datasources only use the first series. [#27463](https://github.com/grafana/grafana/pull/27463), [@ryantxu](https://github.com/ryantxu)
- **Loki**: Send current time range when fetching labels and values. [#26622](https://github.com/grafana/grafana/pull/26622), [@ivanahuckova](https://github.com/ivanahuckova)
- **Prometheus**: Add backslash escaping for template variables. [#26205](https://github.com/grafana/grafana/pull/26205), [@ivanahuckova](https://github.com/ivanahuckova)
- **Prometheus**: Correctly format multi values variables in queries. [#26896](https://github.com/grafana/grafana/pull/26896), [@ivanahuckova](https://github.com/ivanahuckova)
- **Provisioning**: Add validation for missing organisations in datasource, dashboard, and notifier configurations. [#26601](https://github.com/grafana/grafana/pull/26601), [@nabokihms](https://github.com/nabokihms)
- **Rendering**: Fixed issue rendering text panel to image via image renderer plugin. [#27083](https://github.com/grafana/grafana/pull/27083), [@torkelo](https://github.com/torkelo)
- **Stats**: Use more efficient SQL and add timeouts. [#27390](https://github.com/grafana/grafana/pull/27390), [@sakjur](https://github.com/sakjur)
- **Table**: Support date unit formats on string values. [#26879](https://github.com/grafana/grafana/pull/26879), [@torkelo](https://github.com/torkelo)
- **Thresholds**: Fixed issue with thresholds in overrides not working after save and reload. [#27297](https://github.com/grafana/grafana/pull/27297), [@torkelo](https://github.com/torkelo)
- **Transformations**: Fixes outer join transformation when frames are missing field to join by. [#27453](https://github.com/grafana/grafana/pull/27453), [@hugohaggmark](https://github.com/hugohaggmark)
- **Transformations**: merge will properly handle empty frames and frames with multiple rows where values are overlapping. [#27362](https://github.com/grafana/grafana/pull/27362), [@mckn](https://github.com/mckn)
- **grafana-cli**: Fix installing of plugins missing directory entries in zip. [#26945](https://github.com/grafana/grafana/pull/26945), [@adrianlzt](https://github.com/adrianlzt)

# 7.1.5 (2020-08-25)

### Features / Enhancements

- **Stats**: Stop counting the same user multiple times. [#26777](https://github.com/grafana/grafana/pull/26777), [@sakjur](https://github.com/sakjur)

### Bug Fixes

- **Alerting**: remove LongToWide call in alerting. [#27140](https://github.com/grafana/grafana/pull/27140), [@kylebrandt](https://github.com/kylebrandt)
- **AzureMonitor**: fix panic introduced in 7.1.4 when unit was unspecified and alias was used. [#27113](https://github.com/grafana/grafana/pull/27113), [@kylebrandt](https://github.com/kylebrandt)
- **Variables**: Fixes issue with All variable not being resolved. [#27151](https://github.com/grafana/grafana/pull/27151), [@hugohaggmark](https://github.com/hugohaggmark)

# 7.1.4 (2020-08-20)

### Features / Enhancements

- **Azure App Insights Alert error - tsdb.HandleRequest() failed to convert dataframe "" to tsdb.TimeSeriesSlice**. [#26897](https://github.com/grafana/grafana/issues/26897)
- **AzureMonitor**: map more units. [#26990](https://github.com/grafana/grafana/pull/26990), [@kylebrandt](https://github.com/kylebrandt)
- **Azuremonitor**: do not set unit if literal "Unspecified". [#26839](https://github.com/grafana/grafana/pull/26839), [@kylebrandt](https://github.com/kylebrandt)
- **Dataframe/Alerting**: to tsdb.TimeSeriesSlice - accept "empty" time series. [#26903](https://github.com/grafana/grafana/pull/26903), [@kylebrandt](https://github.com/kylebrandt)
- **Field overrides**: Filter by field name using regex. [#27070](https://github.com/grafana/grafana/pull/27070), [@dprokop](https://github.com/dprokop)
- **Overrides**: expose byType matcher UI. [#27056](https://github.com/grafana/grafana/pull/27056), [@ryantxu](https://github.com/ryantxu)

### Bug Fixes

- **CloudWatch**: Add FreeStorageCapacity metric. [#26503](https://github.com/grafana/grafana/pull/26503), [@waqark3389](https://github.com/waqark3389)
- **CloudWatch**: Fix sorting of metrics results. [#26835](https://github.com/grafana/grafana/pull/26835), [@aknuds1](https://github.com/aknuds1)
- **Cloudwatch**: Add FileSystemId as a dimension key for the AWS/FSx namespace. [#26662](https://github.com/grafana/grafana/pull/26662), [@waqark3389](https://github.com/waqark3389)
- **InfluxDB**: Update Flux placeholder URL with respect to latest Go client. [#27086](https://github.com/grafana/grafana/pull/27086), [@aknuds1](https://github.com/aknuds1)
- **InfluxDB**: Upgrade Go client, use data source HTTP client. [#27012](https://github.com/grafana/grafana/pull/27012), [@aknuds1](https://github.com/aknuds1)
- **Proxy**: Fix updating refresh token in OAuth pass-thru. [#26885](https://github.com/grafana/grafana/pull/26885), [@seanlaff](https://github.com/seanlaff)
- **Templating**: Fixes so texts show in picker not the values. [#27002](https://github.com/grafana/grafana/pull/27002), [@hugohaggmark](https://github.com/hugohaggmark)

# 7.1.3 (2020-08-06)

### Bug Fixes

- **Templating**: Templating: Fix undefined result when using raw interpolation format [#26818](https://github.com/grafana/grafana/pull/26818)

# 7.1.2 (2020-08-05)

### Features / Enhancements

- **Explore**: Don't run queries on datasource change. [#26033](https://github.com/grafana/grafana/pull/26033), [@davkal](https://github.com/davkal)
- **TemplateSrv**: Formatting options for ${**from} and ${**to}, unix seconds epoch, ISO 8601/RFC 3339. [#26466](https://github.com/grafana/grafana/pull/26466), [@torkelo](https://github.com/torkelo)
- **Toolkit/Plugin**: throw an Error instead of a string. [#26618](https://github.com/grafana/grafana/pull/26618), [@leventebalogh](https://github.com/leventebalogh)

### Bug Fixes

- **Dashbard**: Fix refresh interval settings to allow setting it to equal min_refresh_interval. [#26615](https://github.com/grafana/grafana/pull/26615), [@torkelo](https://github.com/torkelo)
- **Flux**: Ensure connections to InfluxDB are closed. [#26735](https://github.com/grafana/grafana/pull/26735), [@sneddrs](https://github.com/sneddrs)
- **Query history**: Fix search filtering if null value. [#26768](https://github.com/grafana/grafana/pull/26768), [@ivanahuckova](https://github.com/ivanahuckova)
- **QueryOptions**: Fix not being able to change cache timeout setting. [#26614](https://github.com/grafana/grafana/pull/26614), [@torkelo](https://github.com/torkelo)
- **StatPanel**: Fix stat panel display name not showing when explicitly set. [#26616](https://github.com/grafana/grafana/pull/26616), [@torkelo](https://github.com/torkelo)
- **Templating**: Fixed access to system variables like **dashboard, **user & \_\_org during dashboard load & variable queries. [#26637](https://github.com/grafana/grafana/pull/26637), [@torkelo](https://github.com/torkelo)
- **TextPanel**: Fix content overflowing panel boundaries. [#26612](https://github.com/grafana/grafana/pull/26612), [@torkelo](https://github.com/torkelo)
- **TimePicker**: Fix position and responsive behavior. [#26570](https://github.com/grafana/grafana/pull/26570), [@torkelo](https://github.com/torkelo)
- **TimePicker**: Fixes app crash when changing custom range to nothing. [#26775](https://github.com/grafana/grafana/pull/26775), [@hugohaggmark](https://github.com/hugohaggmark)
- **Units**: Remove duplicate SI prefix from mSv and µSv. [#26598](https://github.com/grafana/grafana/pull/26598), [@tofurky](https://github.com/tofurky)

# 7.1.1 (2020-07-24)

### Features / Enhancements

- **Graph**: Support setting field unit & override data source (automatic) unit. [#26529](https://github.com/grafana/grafana/pull/26529), [@ryantxu](https://github.com/ryantxu)
- **Tracing**: Add errorIconColor prop to TraceSpanData. [#26509](https://github.com/grafana/grafana/pull/26509), [@zoltanbedi](https://github.com/zoltanbedi)

### Bug Fixes

- **Branding**: Fix login app title. [#26425](https://github.com/grafana/grafana/pull/26425), [@benrubson](https://github.com/benrubson)
- **Bring back scripts evaluation in TextPanel**. [#26413](https://github.com/grafana/grafana/pull/26413), [@dprokop](https://github.com/dprokop)
- **Dashboard**: Fix empty panels after scrolling on Safari/iOS. [#26495](https://github.com/grafana/grafana/pull/26495), [@torkelo](https://github.com/torkelo)
- **Dashboard**: Fix for viewer can enter panel edit mode by modifying url (but cannot not save anything). [#26556](https://github.com/grafana/grafana/pull/26556), [@torkelo](https://github.com/torkelo)
- **Elasticsearch**: Fix displaying of bucket script input. [#26552](https://github.com/grafana/grafana/pull/26552), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore**: parse queryType from explore url. [#26349](https://github.com/grafana/grafana/pull/26349), [@zoltanbedi](https://github.com/zoltanbedi)
- **Tracing**: upstream fix for hovering on log lines. [#26426](https://github.com/grafana/grafana/pull/26426), [@zoltanbedi](https://github.com/zoltanbedi)

# 7.1.0 (2020-07-16)

### Features / Enhancements

- **Backend**: Use latest go plugin sdk (0.74.0) to sort wide frames. [#26207](https://github.com/grafana/grafana/pull/26207), [@kylebrandt](https://github.com/kylebrandt)
- **Elasticsearch**: Create Raw Doc metric to render raw JSON docs in columns in the new table panel. [#26233](https://github.com/grafana/grafana/pull/26233), [@ivanahuckova](https://github.com/ivanahuckova)
- **PluginsListPage**: More plugins button should open in new window. [#26305](https://github.com/grafana/grafana/pull/26305), [@zoltanbedi](https://github.com/zoltanbedi)

### Bug Fixes

- **AdminUsers**: Reset page to zero on query change. [#26293](https://github.com/grafana/grafana/pull/26293), [@hshoff](https://github.com/hshoff)
- **CloudWatch Logs**: Fixes grouping of results by numeric field. [#26298](https://github.com/grafana/grafana/pull/26298), [@kaydelaney](https://github.com/kaydelaney)
- **DashboardLinks**: Do not over-query search endpoint. [#26311](https://github.com/grafana/grafana/pull/26311), [@torkelo](https://github.com/torkelo)
- **Docker**: Make sure to create default plugin provisioning directory. [#26017](https://github.com/grafana/grafana/pull/26017), [@marefr](https://github.com/marefr)
- **Elastic**: Fix error "e.buckets[Symbol.iterator] is not a function" when using filter. [#26217](https://github.com/grafana/grafana/pull/26217), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore/Loki**: Escape \ in labels for show context queries. [#26116](https://github.com/grafana/grafana/pull/26116), [@ivanahuckova](https://github.com/ivanahuckova)
- **Jaeger/Zipkin**: URL-encode service names and trace ids for API calls. [#26115](https://github.com/grafana/grafana/pull/26115), [@ivanahuckova](https://github.com/ivanahuckova)
- **Prometheus**: Fix prom links in mixed mode. [#26244](https://github.com/grafana/grafana/pull/26244), [@zoltanbedi](https://github.com/zoltanbedi)
- **Provisioning**: Fix bug when provision app plugins using Enterprise edition. [#26340](https://github.com/grafana/grafana/pull/26340), [@marefr](https://github.com/marefr)
- **Sign In** Use correct url for the Sign In button. [#26239](https://github.com/grafana/grafana/pull/26239), [@dprokop](https://github.com/dprokop)

# 7.1.0-beta3 (2020-07-13)

### Features / Enhancements

- **Explore**: Unification of logs/metrics/traces user interface. [#25890](https://github.com/grafana/grafana/pull/25890), [@aocenas](https://github.com/aocenas)
- **Graph panel**: Move Stacking and null values before Hover tooltip options (#26035). [#26037](https://github.com/grafana/grafana/pull/26037), [@jsoref](https://github.com/jsoref)
- **LDAP**: Get all groups for all group base search DNs. [#25825](https://github.com/grafana/grafana/pull/25825), [@Annegies](https://github.com/Annegies)
- **Table**: JSON Cell should try to convert strings to JSON. [#26024](https://github.com/grafana/grafana/pull/26024), [@ryantxu](https://github.com/ryantxu)
- **Transform**: adding missing "table"-transform and "series to rows"-transform to Grafana v7-transforms. [#26042](https://github.com/grafana/grafana/pull/26042), [@mckn](https://github.com/mckn)

### Bug Fixes

- **AdminUsersTable**: Fix width issues. [#26019](https://github.com/grafana/grafana/pull/26019), [@tskarhed](https://github.com/tskarhed)
- **BarGauge**: Fix space bug in single series mode. [#26176](https://github.com/grafana/grafana/pull/26176), [@torkelo](https://github.com/torkelo)
- **Dashboard**: Allow removing min refresh interval from refresh options (5s or other). [#26150](https://github.com/grafana/grafana/pull/26150), [@torkelo](https://github.com/torkelo)
- **DataLinks**: Fixed interpolation of repeated variables used in Graph data links. [#26147](https://github.com/grafana/grafana/pull/26147), [@torkelo](https://github.com/torkelo)
- **Do not break dashboard settings UI when time intervals end with trailing comma**. [#26126](https://github.com/grafana/grafana/pull/26126), [@dprokop](https://github.com/dprokop)
- **Elastic**: Display correct log message based on selected log field. [#26020](https://github.com/grafana/grafana/pull/26020), [@ivanahuckova](https://github.com/ivanahuckova)
- **InfluxDB**: Fixed new group by dropdown now showing after first use. [#26031](https://github.com/grafana/grafana/pull/26031), [@torkelo](https://github.com/torkelo)
- **StatPanel**: Fixes issue with name showing for single series / field results. [#26070](https://github.com/grafana/grafana/pull/26070), [@torkelo](https://github.com/torkelo)
- **Templating**: Fix recursive loop of template variable queries when changing ad-hoc-variable. [#26191](https://github.com/grafana/grafana/pull/26191), [@torkelo](https://github.com/torkelo)

# 7.0.6 (2020-07-09)

### Bug fixes

- **Templating**: Fixed recursive queries triggered when switching dashboard settings view [#26137](https://github.com/grafana/grafana/pull/26137)
- **Templating**: Fix recursive loop of template variable queries when changing ad-hoc-variable [#26191](https://github.com/grafana/grafana/pull/26191)
- **Auth**: Add support for forcing authentication in anonymous mode and modify SignIn to use it instead of redirect [#25567](https://github.com/grafana/grafana/pull/25567)
- **Auth**: Fix POST request failures with anonymous access [#26049](https://github.com/grafana/grafana/pull/26049)

# 7.1.0-beta 2 (2020-07-02)

### Features / Enhancements

- **Loki**: Allow aliasing Loki queries in dashboard. [#25706](https://github.com/grafana/grafana/pull/25706), [@bastjan](https://github.com/bastjan)

### Bug Fixes

- **Explore**: Fix href when jumping from Explore to Add data source. [#25991](https://github.com/grafana/grafana/pull/25991), [@ivanahuckova](https://github.com/ivanahuckova)
- **Fix**: Build-in plugins failed to load in windows. [#25982](https://github.com/grafana/grafana/pull/25982), [@papagian](https://github.com/papagian)

# 7.1.0-beta 1 (2020-07-01)

### Features / Enhancements

- **Alerting**: Adds support for multiple URLs in Alertmanager notifier. [#24196](https://github.com/grafana/grafana/pull/24196), [@alistarle](https://github.com/alistarle)
- **Alerting**: updating the victorops alerter to handle the no_data alert type. [#23761](https://github.com/grafana/grafana/pull/23761), [@rrusso1982](https://github.com/rrusso1982)
- **Azure**: Application Insights metrics to Frame and support multiple query dimensions. [#25849](https://github.com/grafana/grafana/pull/25849), [@kylebrandt](https://github.com/kylebrandt)
- **Azure**: Multiple dimension support for Azure Monitor Service. [#25947](https://github.com/grafana/grafana/pull/25947), [@kylebrandt](https://github.com/kylebrandt)
- **Azure**: Split Insights into two services. [#25410](https://github.com/grafana/grafana/pull/25410), [@kylebrandt](https://github.com/kylebrandt)
- **Backend plugins**: Refactor to allow shared contract between core and external backend plugins. [#25472](https://github.com/grafana/grafana/pull/25472), [@marefr](https://github.com/marefr)
- **Branding**: Use AppTitle as document title. [#25271](https://github.com/grafana/grafana/pull/25271), [@benrubson](https://github.com/benrubson)
- **Chore**: upgrade to typescript 3.9.3. [#25154](https://github.com/grafana/grafana/pull/25154), [@ryantxu](https://github.com/ryantxu)
- **CloudWatch**: Add Route53 DNSQueries metric and dimension. [#25125](https://github.com/grafana/grafana/pull/25125), [@erkolson](https://github.com/erkolson)
- **CloudWatch**: Added AWS DataSync metrics and dimensions. [#25054](https://github.com/grafana/grafana/pull/25054), [@ilyastoli](https://github.com/ilyastoli)
- **CloudWatch**: Added AWS MediaStore metrics and dimensions. [#25492](https://github.com/grafana/grafana/pull/25492), [@ilyastoli](https://github.com/ilyastoli)
- **CloudWatch**: Added AWS RoboMaker metrics and dimensions. [#25090](https://github.com/grafana/grafana/pull/25090), [@ilyastoli](https://github.com/ilyastoli)
- **CloudWatch**: Added AWS SDKMetrics metrics and dimensions. [#25150](https://github.com/grafana/grafana/pull/25150), [@ilyastoli](https://github.com/ilyastoli)
- **CloudWatch**: Added AWS ServiceCatalog metrics and dimensions. [#25812](https://github.com/grafana/grafana/pull/25812), [@ilyastoli](https://github.com/ilyastoli)
- **CloudWatch**: Added AWS WAFV2 metrics. [#24048](https://github.com/grafana/grafana/pull/24048), [@mikkokupsu](https://github.com/mikkokupsu)
- **Dashboards**: Make path to default dashboard configurable. [#25595](https://github.com/grafana/grafana/pull/25595), [@bergquist](https://github.com/bergquist)
- **Elastic**: Internal data links. [#25942](https://github.com/grafana/grafana/pull/25942), [@aocenas](https://github.com/aocenas)
- **Elasticsearch**: Add support for template variable in date histogram min_doc_count. [#21064](https://github.com/grafana/grafana/pull/21064), [@faxm0dem](https://github.com/faxm0dem)
- **Elasticsearch**: Adds cumulative sum aggregation support. [#24820](https://github.com/grafana/grafana/pull/24820), [@retzkek](https://github.com/retzkek)
- **Elasticsearch**: Support using a variable for histogram and terms min doc count. [#25392](https://github.com/grafana/grafana/pull/25392), [@marefr](https://github.com/marefr)
- **Explore/Loki**: Show results of instant queries only in table and time series only in graph. [#25845](https://github.com/grafana/grafana/pull/25845), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore**: Remove legend formatting when switching from panel to Explore. [#25848](https://github.com/grafana/grafana/pull/25848), [@ivanahuckova](https://github.com/ivanahuckova)
- **Footer**: Add back footer to login page. [#25656](https://github.com/grafana/grafana/pull/25656), [@torkelo](https://github.com/torkelo)
- **ForgottenPassword**: Move view to login screen. [#25366](https://github.com/grafana/grafana/pull/25366), [@tskarhed](https://github.com/tskarhed)
- **Gauge**: Hide orientation option in panel options. [#25511](https://github.com/grafana/grafana/pull/25511), [@torkelo](https://github.com/torkelo)
- **Grafana-UI**: Add FileUpload. [#25835](https://github.com/grafana/grafana/pull/25835), [@Clarity-89](https://github.com/Clarity-89)
- **GraphPanel**: Make legend values clickable series toggles. [#25581](https://github.com/grafana/grafana/pull/25581), [@hshoff](https://github.com/hshoff)
- **Influx**: Support flux in the influx datasource. [#25308](https://github.com/grafana/grafana/pull/25308), [@ryantxu](https://github.com/ryantxu)
- **Migration**: Select org. [#24739](https://github.com/grafana/grafana/pull/24739), [@tskarhed](https://github.com/tskarhed)
- **Migration**: Settings forms. [#24741](https://github.com/grafana/grafana/pull/24741), [@tskarhed](https://github.com/tskarhed)
- **Panel Inspect**: use Monaco editor for json display. [#25251](https://github.com/grafana/grafana/pull/25251), [@ryantxu](https://github.com/ryantxu)
- **Panel edit**: Clicking twice on a visualization closes the VizPicker. [#25739](https://github.com/grafana/grafana/pull/25739), [@peterholmberg](https://github.com/peterholmberg)
- **PanelInspect**: Update UI for Data display options. [#25478](https://github.com/grafana/grafana/pull/25478), [@tskarhed](https://github.com/tskarhed)
- **Plugins**: move jaeger trace type to grafana data. [#25403](https://github.com/grafana/grafana/pull/25403), [@zoltanbedi](https://github.com/zoltanbedi)
- **Provisioning**: Adds support for enabling app plugins. [#25649](https://github.com/grafana/grafana/pull/25649), [@marefr](https://github.com/marefr)
- **Provisioning**: Use folders structure from the file system to create desired folders in dashboard provisioning. [#23117](https://github.com/grafana/grafana/pull/23117), [@nabokihms](https://github.com/nabokihms)
- **Query history**: Add keyboard shortcut support for commenting. [#24736](https://github.com/grafana/grafana/pull/24736), [@ivanahuckova](https://github.com/ivanahuckova)
- **Query history**: Add search for query history and starred queries. [#25747](https://github.com/grafana/grafana/pull/25747), [@ivanahuckova](https://github.com/ivanahuckova)
- **Rich history**: Updates for default settings and starred queries deletion. [#25732](https://github.com/grafana/grafana/pull/25732), [@ivanahuckova](https://github.com/ivanahuckova)
- **Search**: support URL query params. [#25541](https://github.com/grafana/grafana/pull/25541), [@Clarity-89](https://github.com/Clarity-89)
- **Stackdriver**: Deep linking from Grafana panels to the Metrics Explorer. [#25858](https://github.com/grafana/grafana/pull/25858), [@papagian](https://github.com/papagian)
- **Stackdriver**: Rename Stackdriver to Google Cloud Monitoring. [#25807](https://github.com/grafana/grafana/pull/25807), [@papagian](https://github.com/papagian)
- **StatPanel**: Option showing name instead of value and more. [#25676](https://github.com/grafana/grafana/pull/25676), [@torkelo](https://github.com/torkelo)
- **Switch**: Deprecate checked prop in favor of value. [#25862](https://github.com/grafana/grafana/pull/25862), [@tskarhed](https://github.com/tskarhed)
- **Tab**: Make active tab clickable and add hyperlink functionality. [#25546](https://github.com/grafana/grafana/pull/25546), [@tskarhed](https://github.com/tskarhed)
- **Table**: Adds adhoc filtering. [#25467](https://github.com/grafana/grafana/pull/25467), [@hugohaggmark](https://github.com/hugohaggmark)
- **Teams**: Add index for permission check. [#25736](https://github.com/grafana/grafana/pull/25736), [@sakjur](https://github.com/sakjur)
- **Template variable filters**: Hide overflowing text. [#25801](https://github.com/grafana/grafana/pull/25801), [@tskarhed](https://github.com/tskarhed)
- **Templating**: Add bult in \_\_user {name, id, login, email} variable to templating system. [#23378](https://github.com/grafana/grafana/pull/23378), [@aidanmountford](https://github.com/aidanmountford)
- **Templating**: removes old Angular variable system and featureToggle. [#24779](https://github.com/grafana/grafana/pull/24779), [@hugohaggmark](https://github.com/hugohaggmark)
- **TextPanel**: Adds proper editor for markdown and html. [#25618](https://github.com/grafana/grafana/pull/25618), [@hugohaggmark](https://github.com/hugohaggmark)
- **TextPanel**: Removes Angular Text Panel. [#25504](https://github.com/grafana/grafana/pull/25504), [@hugohaggmark](https://github.com/hugohaggmark)
- **TextPanel**: Removes text mode. [#25589](https://github.com/grafana/grafana/pull/25589), [@hugohaggmark](https://github.com/hugohaggmark)
- **TimeZone**: unify the time zone pickers to one that can rule them all. [#24803](https://github.com/grafana/grafana/pull/24803), [@mckn](https://github.com/mckn)
- **Transform**: added merge transform that will merge multiple series/tables into one table. [#25490](https://github.com/grafana/grafana/pull/25490), [@mckn](https://github.com/mckn)
- **Units**: add base-pascals and rotational speed units. [#22879](https://github.com/grafana/grafana/pull/22879), [@sakjur](https://github.com/sakjur)
- **Units**: add new unit for duration, it is optimized for displaying days, hours, minutes and seconds. [#24175](https://github.com/grafana/grafana/pull/24175), [@pabigot](https://github.com/pabigot)
- **Variables**: enables cancel for slow query variables queries. [#24430](https://github.com/grafana/grafana/pull/24430), [@hugohaggmark](https://github.com/hugohaggmark)
- **switches default value for security settings**. [#25175](https://github.com/grafana/grafana/pull/25175), [@bergquist](https://github.com/bergquist)
- **Reporting:** add monthly schedule option. (Enterprise)

### Bug Fixes

- **DatatLinks**: Fix open in new tab state mismatch. [#25826](https://github.com/grafana/grafana/pull/25826), [@tskarhed](https://github.com/tskarhed)
- **Explore/Loki**: Fix field type in table for instant queries. [#25907](https://github.com/grafana/grafana/pull/25907), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore/Loki**: Fix scrolling of context when leaving context window. [#25838](https://github.com/grafana/grafana/pull/25838), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore/SQL data sources**: Show correctly interpolated queries. [#25110](https://github.com/grafana/grafana/pull/25110), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore/Tooltip**: Fix label value in tooltip. [#25940](https://github.com/grafana/grafana/pull/25940), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore**: Fix query editors on mobile. [#25148](https://github.com/grafana/grafana/pull/25148), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore**: adds an ability to exit log row context with ESC key. [#24205](https://github.com/grafana/grafana/pull/24205), [@Estrax](https://github.com/Estrax)
- **Fix**: Value mappings match against string values. [#25929](https://github.com/grafana/grafana/pull/25929), [@peterholmberg](https://github.com/peterholmberg)
- **GraphPanel**: Fix annotations overflowing panels. [#25606](https://github.com/grafana/grafana/pull/25606), [@hshoff](https://github.com/hshoff)
- **Instrumentation**: Fix setting Jaeger tracing address through Grafana config. [#25768](https://github.com/grafana/grafana/pull/25768), [@marefr](https://github.com/marefr)
- **Prometheus**: Fix performance issue in processing of histogram labels. [#25813](https://github.com/grafana/grafana/pull/25813), [@bsherrod](https://github.com/bsherrod)
- **Provisioning**: Makes file the default dashboard provisioner type. [#24856](https://github.com/grafana/grafana/pull/24856), [@bergquist](https://github.com/bergquist)
- **Templating**: fixes variables not being interpolated after dashboard refresh. [#25698](https://github.com/grafana/grafana/pull/25698), [@hugohaggmark](https://github.com/hugohaggmark)
- **Units**: Custom unit suffix and docs for custom units. [#25710](https://github.com/grafana/grafana/pull/25710), [@torkelo](https://github.com/torkelo)
- **ValueFormats**: Fix byte-format data rates. [#25424](https://github.com/grafana/grafana/pull/25424), [@mueslo](https://github.com/mueslo)
- **Variables**: Fixes maximum call stack bug for empty value. [#25503](https://github.com/grafana/grafana/pull/25503), [@hugohaggmark](https://github.com/hugohaggmark)

### Security fixes

- **Graph**: Fix XSS vulnerability with series overrides [#25401](https://github.com/grafana/grafana/pull/25401). Thanks to Rotem Reiss for reporting this.

# 7.0.5 (2020-06-30)

### Bug Fixes

- **Datasource**: Make sure data proxy timeout applies to HTTP client. [#25865](https://github.com/grafana/grafana/pull/25865), [@marefr](https://github.com/marefr)
- **Graphite**: Fix tag value dropdowns not showing in query editor. [#25889](https://github.com/grafana/grafana/pull/25889), [@torkelo](https://github.com/torkelo)

# 7.0.4 (2020-06-25)

### Features / Enhancements

- **Dashboard**: Redirects for old (pre 7.0) edit & view panel urls. [#25653](https://github.com/grafana/grafana/pull/25653), [@torkelo](https://github.com/torkelo)
- **Stackdriver**: Use default project name if project name isn't set on the query. [#25413](https://github.com/grafana/grafana/pull/25413), [@alexashley](https://github.com/alexashley)
- **TablePanel**: Sort numbers correctly. [#25421](https://github.com/grafana/grafana/pull/25421), [@speakyourcode](https://github.com/speakyourcode)
- **Update Bitcoin currency to use proper symbol, add mBTC and μBTC**. [#24182](https://github.com/grafana/grafana/pull/24182), [@overcookedpanda](https://github.com/overcookedpanda)
- **Variables**: Links that update variables on current dashboard does not trigger refresh / update. [#25192](https://github.com/grafana/grafana/pull/25192), [@torkelo](https://github.com/torkelo)

### Bug Fixes

- **Azure Monitor**: fixes undefined is not iterable. [#25586](https://github.com/grafana/grafana/pull/25586), [@hugohaggmark](https://github.com/hugohaggmark)
- **Datasources**: Handle URL parsing error. [#25742](https://github.com/grafana/grafana/pull/25742), [@marefr](https://github.com/marefr)
- **InfluxDB**: Fix invalid memory address or nil pointer dereference when schema is missing in URL. [#25565](https://github.com/grafana/grafana/pull/25565), [@marefr](https://github.com/marefr)
- **Security**: Use Header.Set and Header.Del for X-Grafana-User header. [#25495](https://github.com/grafana/grafana/pull/25495), [@beardhatcode](https://github.com/beardhatcode)
- **Stackdriver**: Fix creating Label Values datasource query variable. [#25633](https://github.com/grafana/grafana/pull/25633), [@papagian](https://github.com/papagian)
- **Table**: Support custom date formats via custom unit. [#25195](https://github.com/grafana/grafana/pull/25195), [@torkelo](https://github.com/torkelo)
- **Templating**: Fixes query variable with \${\_\_searchFilter} value selection not causing refresh & url update. [#25770](https://github.com/grafana/grafana/pull/25770), [@torkelo](https://github.com/torkelo)

# 7.0.3 (2020-06-03)

### Features / Enhancements

- **Stats**: include all fields. [#24829](https://github.com/grafana/grafana/pull/24829), [@ryantxu](https://github.com/ryantxu)
- **Variables**: change VariableEditorList row action Icon to IconButton. [#25217](https://github.com/grafana/grafana/pull/25217), [@hshoff](https://github.com/hshoff)

### Bug Fixes

- **Cloudwatch**: Fix dimensions of DDoSProtection. [#25317](https://github.com/grafana/grafana/pull/25317), [@papagian](https://github.com/papagian)
- **Configuration**: Fix env var override of sections containing hyphen. [#25178](https://github.com/grafana/grafana/pull/25178), [@marefr](https://github.com/marefr)
- **Dashboard**: Get panels in collapsed rows. [#25079](https://github.com/grafana/grafana/pull/25079), [@peterholmberg](https://github.com/peterholmberg)
- **Do not show alerts tab when alerting is disabled**. [#25285](https://github.com/grafana/grafana/pull/25285), [@dprokop](https://github.com/dprokop)
- **Jaeger**: fixes cascader option label duration value. [#25129](https://github.com/grafana/grafana/pull/25129), [@Estrax](https://github.com/Estrax)
- **Transformations**: Fixed Transform tab crash & no update after adding first transform. [#25152](https://github.com/grafana/grafana/pull/25152), [@torkelo](https://github.com/torkelo)

# 7.0.2 (2020-06-03)

- **Security**: Urgent security patch release. Please read more in our [blog](https://grafana.com/blog/2020/06/03/grafana-6.7.4-and-7.0.2-released-with-important-security-fix/)

# 7.0.1 (2020-05-26)

### Features / Enhancements

- **Datasource/CloudWatch**: Makes CloudWatch Logs query history more readable. [#24795](https://github.com/grafana/grafana/pull/24795), [@kaydelaney](https://github.com/kaydelaney)
- **Download CSV**: Add date and time formatting. [#24992](https://github.com/grafana/grafana/pull/24992), [@ryantxu](https://github.com/ryantxu)
- **Table**: Make last cell value visible when right aligned. [#24921](https://github.com/grafana/grafana/pull/24921), [@peterholmberg](https://github.com/peterholmberg)
- **TablePanel**: Adding sort order persistence. [#24705](https://github.com/grafana/grafana/pull/24705), [@torkelo](https://github.com/torkelo)
- **Transformations**: Display correct field name when using reduce transformation. [#25068](https://github.com/grafana/grafana/pull/25068), [@peterholmberg](https://github.com/peterholmberg)
- **Transformations**: Allow custom number input for binary operations. [#24752](https://github.com/grafana/grafana/pull/24752), [@ryantxu](https://github.com/ryantxu)

### Bug Fixes

- **Cloudwatch**: Fix AWS WAF and AWS DDoSProtection metrics. [#25071](https://github.com/grafana/grafana/pull/25071), [@papagian](https://github.com/papagian)
- **Dashboard/Links**: Fixes dashboard links by tags not working. [#24773](https://github.com/grafana/grafana/pull/24773), [@KamalGalrani](https://github.com/KamalGalrani)
- **Dashboard/Links**: Fixes open in new window for dashboard link. [#24772](https://github.com/grafana/grafana/pull/24772), [@KamalGalrani](https://github.com/KamalGalrani)
- **Dashboard/Links**: Variables are resolved and limits to 100. [#25076](https://github.com/grafana/grafana/pull/25076), [@hugohaggmark](https://github.com/hugohaggmark)
- **DataLinks**: Bring back variables interpolation in title. [#24970](https://github.com/grafana/grafana/pull/24970), [@dprokop](https://github.com/dprokop)
- **Datasource/CloudWatch**: Field suggestions no longer limited to prefix-only. [#24855](https://github.com/grafana/grafana/pull/24855), [@kaydelaney](https://github.com/kaydelaney)
- **Explore/Table**: Keep existing field types if possible. [#24944](https://github.com/grafana/grafana/pull/24944), [@kaydelaney](https://github.com/kaydelaney)
- **Explore**: Fix wrap lines toggle for results of queries with filter expression. [#24915](https://github.com/grafana/grafana/pull/24915), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore**: fix undo in query editor. [#24797](https://github.com/grafana/grafana/pull/24797), [@zoltanbedi](https://github.com/zoltanbedi)
- **Explore**: fix word break in type head info. [#25014](https://github.com/grafana/grafana/pull/25014), [@zoltanbedi](https://github.com/zoltanbedi)
- **Graph**: Legend decimals now work as expected. [#24931](https://github.com/grafana/grafana/pull/24931), [@torkelo](https://github.com/torkelo)
- **LoginPage**: Fix hover color for service buttons. [#25009](https://github.com/grafana/grafana/pull/25009), [@tskarhed](https://github.com/tskarhed)
- **LogsPanel**: Fix scrollbar. [#24850](https://github.com/grafana/grafana/pull/24850), [@ivanahuckova](https://github.com/ivanahuckova)
- **MoveDashboard**: Fix for moving dashboard caused all variables to be lost. [#25005](https://github.com/grafana/grafana/pull/25005), [@torkelo](https://github.com/torkelo)
- **Organize transformer**: Use display name in field order comparer. [#24984](https://github.com/grafana/grafana/pull/24984), [@dprokop](https://github.com/dprokop)
- **Panel**: shows correct panel menu items in view mode. [#24912](https://github.com/grafana/grafana/pull/24912), [@hugohaggmark](https://github.com/hugohaggmark)
- **PanelEditor Fix missing labels and description if there is only single option in category**. [#24905](https://github.com/grafana/grafana/pull/24905), [@dprokop](https://github.com/dprokop)
- **PanelEditor**: Overrides name matcher still show all original field names even after Field default display name is specified. [#24933](https://github.com/grafana/grafana/pull/24933), [@torkelo](https://github.com/torkelo)
- **PanelInspector**: Makes sure Data display options are visible. [#24902](https://github.com/grafana/grafana/pull/24902), [@hugohaggmark](https://github.com/hugohaggmark)
- **PanelInspector**: Hides unsupported data display options for Panel type. [#24918](https://github.com/grafana/grafana/pull/24918), [@hugohaggmark](https://github.com/hugohaggmark)
- **PanelMenu**: Make menu disappear on button press. [#25015](https://github.com/grafana/grafana/pull/25015), [@tskarhed](https://github.com/tskarhed)
- **Postgres**: Fix add button. [#25087](https://github.com/grafana/grafana/pull/25087), [@phemmer](https://github.com/phemmer)
- **Prometheus**: Fix recording rules expansion. [#24977](https://github.com/grafana/grafana/pull/24977), [@ivanahuckova](https://github.com/ivanahuckova)
- **Stackdriver**: Fix creating Service Level Objectives (SLO) datasource query variable. [#25023](https://github.com/grafana/grafana/pull/25023), [@papagian](https://github.com/papagian)

# 7.0.0 (2020-05-18)

## Breaking changes

- **Removed PhantomJS**: PhantomJS was deprecated in [Grafana v6.4](https://grafana.com/docs/grafana/latest/guides/whats-new-in-v6-4/#phantomjs-deprecation) and starting from Grafana v7.0.0, all PhantomJS support has been removed. This means that Grafana no longer ships with a built-in image renderer, and we advise you to install the [Grafana Image Renderer plugin](https://grafana.com/grafana/plugins/grafana-image-renderer).
- **Dashboard**: A global minimum dashboard refresh interval is now enforced and defaults to 5 seconds.
- **Interval calculation**: There is now a new option `Max data points` that controls the auto interval `$__interval` calculation. Interval was previously calculated by dividing the panel width by the time range. With the new max data points option it is now easy to set `$__interval` to a dynamic value that is time range agnostic. For example if you set `Max data points` to 10 Grafana will dynamically set `$__interval` by dividing the current time range by 10.
- **Datasource/Loki**: Support for [deprecated Loki endpoints](https://github.com/grafana/loki/blob/master/docs/api.md#lokis-http-api) has been removed.
- **Backend plugins**: Grafana now requires backend plugins to be signed, otherwise Grafana will not load/start them. This is an additional security measure to make sure backend plugin binaries and files haven't been tampered with. Refer to [Upgrade Grafana](https://grafana.com/docs/grafana/latest/installation/upgrading/#upgrading-to-v7-0) for more information.
- **Docker**: Our Ubuntu based images have been upgraded to Ubuntu [20.04 LTS](https://releases.ubuntu.com/20.04/).
- **@grafana/ui**: Forms migration notice, see [@grafana/ui changelog](https://github.com/grafana/grafana/blob/master/packages/grafana-ui/CHANGELOG.md)
- **@grafana/ui**: Select API change for creating custom values, see [@grafana/ui changelog](https://github.com/grafana/grafana/blob/master/packages/grafana-ui/CHANGELOG.md)

**Deprecation warnings**

- Scripted dashboards is now deprecated. The feature is not removed but will be in a future release. We hope to address the underlying requirement of dynamic dashboards in a different way. [#24059](https://github.com/grafana/grafana/issues/24059)
- The unofficial first version of backend plugins together with usage of [grafana/grafana-plugin-model](https://github.com/grafana/grafana-plugin-model) is now deprecated and support for that will be removed in a future release. Please refer to [backend plugins documentation](https://grafana.com/docs/grafana/latest/developers/plugins/backend/) for information about the new officially supported backend plugins.

## 7.0 Feature highlights

### Data transformations

Not just visualizing data from anywhere, in Grafana 7 you can transform it too. By chaining a simple set of point and click transformations users will be able join, pivot, filter, re-name and calculate to get the results they need. Perfect for operations across queries or data sources missing essential data transformations.

Data transformations will provide a common set of data operations that were previously duplicated as custom features in many panels or data sources but are now an integral part of the Grafana data processing pipeline and something all data sources and panels can take advantage of.

In Grafana 7.0 we have a shared data model for both time series and table data that we call [DataFrame](https://github.com/grafana/grafana/blob/master/docs/sources/plugins/developing/dataframe.md). A DataFrame is like a table with columns but we refer to columns as fields. A time series is simply a DataFrame with two fields (time & value).

**Transformations shipping in 7.0**

- **Reduce**: Reduce many rows / data points to a single value
- **Filter by name**: Filter fields by name or regex
- **Filter by refId**: Filter by query letter
- **Organize fields**: Reorder, rename and hide fields.
- **Labels to fields**: Transform time series with labels into a table where labels get's converted to fields and the result is joined by time
- **Join by field**: Join many result sets (series) together using for example the time field. Useful for transforming time series into a table with a shared time column and where each series get it's own column.
- **Add field from calculation**: This is a powerful transformation that allows you perform many different types of math operations and add the result as a new field. Examples:
  - Calculate the difference between two series or fields and add the result to a new field
  - Multiply one field with another another and add the result to a new field

### New panel edit experience

In Grafana 7 we have redesigned the UI for editing panels. The first visible change is that we have separated panel display settings to a right hand side pane that you can collapse or expand depending on what your focus is on. With this change we are also introducing our new unified option model & UI for defining data configuration and display options. This unified data configuration system powers a consistent UI for setting data options across visualizations as well as making all data display settings data driven and overridable.

This new option architecture and UI will make all panels have a consistent set of options and behaviors for attributes like `unit`, `min`, `max`, `thresholds`, `links`, `decimals`. Not only that but all these options will share a consistent UI for specifying override rules and is extensible for custom panel specific options.

We have yet to migrate all core panels to this new architecture so in 7.0 there will sadly be some big inconsistencies in the UI between panels. Hopefully this will be fixed soon in future releases as we update all the core panels and help the community update the community panel plugins.

### New table panel

Grafana 7.0 comes with a new table panel (and deprecates the old one). This new table panel supports horizontal scrolling and column resize. Paired with the new `Organize fields` transformation detailed above you can reorder, hide & rename columns. This new panel also supports new cell display modes, like showing a bar gauge inside a cell.

### Panel inspector

The panel inspector is a feature that every panel will support, including internal as well as external community plugins. In this new panel inspector, you can view the raw data in a table format, apply some pre-defined transformations, and download as CSV. You can find the **Inspect** setting in the panel menu. Use the keyboard shortcut `i` when hovering over a panel to get the panel inspector to appear.

### Improved time zone support

Starting in version 7.0, you can override the time zone used to display date and time values in a dashboard.

With this feature, you can specify the local time zone of the service or system that you are monitoring. This can be helpful when monitoring a system or service that operates across several time zones.

We have also extended the time zone options so you can select any of the standard [ISO 8601 time zones](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).

### Features / Enhancements

- **Azure Monitor**: Deep linking from Log Analytic queries to the Azure Portal. [#24417](https://github.com/grafana/grafana/pull/24417), [@daniellee](https://github.com/daniellee)
- **Backend plugins**: Log deprecation warning when using the unofficial first version of backend plugins. [#24675](https://github.com/grafana/grafana/pull/24675), [@marefr](https://github.com/marefr)
- **CloudWatch/Logs**: Add data links to CloudWatch logs for deep linking to AWS. [#24334](https://github.com/grafana/grafana/pull/24334), [@kaydelaney](https://github.com/kaydelaney)
- **CloudWatch**: Unify look of query mode select between dashboard and explore. [#24648](https://github.com/grafana/grafana/pull/24648), [@aocenas](https://github.com/aocenas)
- **Docker**: Adds tzdata package to Ubuntu image. [#24422](https://github.com/grafana/grafana/pull/24422), [@xlson](https://github.com/xlson)
- **Editor**: New line on Enter, run query on Shift+Enter. [#24654](https://github.com/grafana/grafana/pull/24654), [@davkal](https://github.com/davkal)
- **Loki**: Allow multiple derived fields with the same name. [#24437](https://github.com/grafana/grafana/pull/24437), [@aocenas](https://github.com/aocenas)
- **Orgs**: Add future deprecation notice. [#24502](https://github.com/grafana/grafana/pull/24502), [@torkelo](https://github.com/torkelo)

### Bug Fixes

- **@grafana/toolkit**: Use process.cwd() instead of PWD to get directory. [#24677](https://github.com/grafana/grafana/pull/24677), [@zoltanbedi](https://github.com/zoltanbedi)
- **Admin**: Makes long settings values line break in settings page. [#24559](https://github.com/grafana/grafana/pull/24559), [@hugohaggmark](https://github.com/hugohaggmark)
- **Azure Monitor**: Fix failure when using table join in Log Analytics queries. [#24528](https://github.com/grafana/grafana/pull/24528), [@daniellee](https://github.com/daniellee)
- **CloudWatch/Logs**: Add error message when log groups are not selected. [#24361](https://github.com/grafana/grafana/pull/24361), [@aocenas](https://github.com/aocenas)
- **CloudWatch/Logs**: Allows a user to search for log groups that aren't there initially. [#24695](https://github.com/grafana/grafana/pull/24695), [@kaydelaney](https://github.com/kaydelaney)
- **CloudWatch/Logs**: Correctly interpolate variables in logs queries. [#24619](https://github.com/grafana/grafana/pull/24619), [@kaydelaney](https://github.com/kaydelaney)
- **CloudWatch/Logs**: Fix autocomplete after by keyword. [#24644](https://github.com/grafana/grafana/pull/24644), [@aocenas](https://github.com/aocenas)
- **CloudWatch/Logs**: Fix field autocomplete suggestions inside function. [#24406](https://github.com/grafana/grafana/pull/24406), [@aocenas](https://github.com/aocenas)
- **CloudWatch/Logs**: Fix fields not being refetched when log group changed. [#24529](https://github.com/grafana/grafana/pull/24529), [@aocenas](https://github.com/aocenas)
- **CloudWatch/Logs**: Fix panic on multiple aggregations queries. [#24683](https://github.com/grafana/grafana/pull/24683), [@aocenas](https://github.com/aocenas)
- **CloudWatch/Logs**: Fix query error when results were sparse. [#24702](https://github.com/grafana/grafana/pull/24702), [@aocenas](https://github.com/aocenas)
- **CloudWatch/Logs**: Fix suggestion for already inserted field. [#24581](https://github.com/grafana/grafana/pull/24581), [@aocenas](https://github.com/aocenas)
- **CloudWatch/Logs**: Fix suggestions of fields after comma. [#24520](https://github.com/grafana/grafana/pull/24520), [@aocenas](https://github.com/aocenas)
- **CloudWatch/Logs**: Fixes various autocomplete issues. [#24583](https://github.com/grafana/grafana/pull/24583), [@kaydelaney](https://github.com/kaydelaney)
- **CloudWatch/Logs**: Handle errors that are not awserr.Error instances. [#24641](https://github.com/grafana/grafana/pull/24641), [@aknuds1](https://github.com/aknuds1)
- **CloudWatch/Logs**: Handle invalidation of log groups when switching data source. [#24703](https://github.com/grafana/grafana/pull/24703), [@kaydelaney](https://github.com/kaydelaney)
- **CloudWatch/Logs**: Make stats hint show consistently. [#24392](https://github.com/grafana/grafana/pull/24392), [@aocenas](https://github.com/aocenas)
- **CloudWatch/Logs**: Prevents hidden data frame fields from displaying in tables. [#24580](https://github.com/grafana/grafana/pull/24580), [@kaydelaney](https://github.com/kaydelaney)
- **CloudWatch/Logs**: Results of stats queries are now grouped. [#24396](https://github.com/grafana/grafana/pull/24396), [@kaydelaney](https://github.com/kaydelaney)
- **CloudWatch/Logs**: Usability improvements. [#24447](https://github.com/grafana/grafana/pull/24447), [@kaydelaney](https://github.com/kaydelaney)
- **Dashboard**: Allow editing provisioned dashboard JSON and add confirmation when JSON is copied to dashboard. [#24680](https://github.com/grafana/grafana/pull/24680), [@dprokop](https://github.com/dprokop)
- **Dashboard**: Fix for strange "dashboard not found" errors when opening links in dashboard settings. [#24416](https://github.com/grafana/grafana/pull/24416), [@torkelo](https://github.com/torkelo)
- **Dashboard**: Fix so default data source is selected when data source can't be found in panel editor. [#24526](https://github.com/grafana/grafana/pull/24526), [@mckn](https://github.com/mckn)
- **Dashboard**: Fixed issue changing a panel from transparent back to normal in panel editor. [#24483](https://github.com/grafana/grafana/pull/24483), [@torkelo](https://github.com/torkelo)
- **Dashboard**: Make header names reflect the field name when exporting to CSV file from the panel inspector. [#24624](https://github.com/grafana/grafana/pull/24624), [@peterholmberg](https://github.com/peterholmberg)
- **Dashboard**: Make sure side pane is displayed with tabs by default in panel editor. [#24636](https://github.com/grafana/grafana/pull/24636), [@dprokop](https://github.com/dprokop)
- **Data source**: Fix query/annotation help content formatting. [#24687](https://github.com/grafana/grafana/pull/24687), [@AgnesToulet](https://github.com/AgnesToulet)
- **Data source**: Fixes async mount errors. [#24579](https://github.com/grafana/grafana/pull/24579), [@Estrax](https://github.com/Estrax)
- **Data source**: Fixes saving a data source without failure when URL doesn't specify a protocol. [#24497](https://github.com/grafana/grafana/pull/24497), [@aknuds1](https://github.com/aknuds1)
- **Explore/Prometheus**: Show results of instant queries only in table. [#24508](https://github.com/grafana/grafana/pull/24508), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore**: Fix rendering of react query editors. [#24593](https://github.com/grafana/grafana/pull/24593), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore**: Fixes loading more logs in logs context view. [#24135](https://github.com/grafana/grafana/pull/24135), [@Estrax](https://github.com/Estrax)
- **Graphite**: Fix schema and dedupe strategy in rollup indicators for Metrictank queries. [#24685](https://github.com/grafana/grafana/pull/24685), [@torkelo](https://github.com/torkelo)
- **Graphite**: Makes query annotations work again. [#24556](https://github.com/grafana/grafana/pull/24556), [@hugohaggmark](https://github.com/hugohaggmark)
- **Logs**: Clicking "Load more" from context overlay doesn't expand log row. [#24299](https://github.com/grafana/grafana/pull/24299), [@kaydelaney](https://github.com/kaydelaney)
- **Logs**: Fix total bytes process calculation. [#24691](https://github.com/grafana/grafana/pull/24691), [@davkal](https://github.com/davkal)
- **Org/user/team preferences**: Fixes so UI Theme can be set back to Default. [#24628](https://github.com/grafana/grafana/pull/24628), [@AgnesToulet](https://github.com/AgnesToulet)
- **Plugins**: Fix manifest validation. [#24573](https://github.com/grafana/grafana/pull/24573), [@aknuds1](https://github.com/aknuds1)
- **Provisioning**: Use proxy as default access mode in provisioning. [#24669](https://github.com/grafana/grafana/pull/24669), [@bergquist](https://github.com/bergquist)
- **Search**: Fix select item when pressing enter and Grafana is served using a sub path. [#24634](https://github.com/grafana/grafana/pull/24634), [@tskarhed](https://github.com/tskarhed)
- **Search**: Save folder expanded state. [#24496](https://github.com/grafana/grafana/pull/24496), [@Clarity-89](https://github.com/Clarity-89)
- **Security**: Tag value sanitization fix in OpenTSDB data source. [#24539](https://github.com/grafana/grafana/pull/24539), [@rotemreiss](https://github.com/rotemreiss)
- **Table**: Do not include angular options in options when switching from angular panel. [#24684](https://github.com/grafana/grafana/pull/24684), [@torkelo](https://github.com/torkelo)
- **Table**: Fixed persisting column resize for time series fields. [#24505](https://github.com/grafana/grafana/pull/24505), [@torkelo](https://github.com/torkelo)
- **Table**: Fixes Cannot read property subRows of null. [#24578](https://github.com/grafana/grafana/pull/24578), [@hugohaggmark](https://github.com/hugohaggmark)
- **Time picker**: Fixed so you can enter a relative range in the time picker without being converted to absolute range. [#24534](https://github.com/grafana/grafana/pull/24534), [@mckn](https://github.com/mckn)
- **Transformations**: Make transform dropdowns not cropped. [#24615](https://github.com/grafana/grafana/pull/24615), [@dprokop](https://github.com/dprokop)
- **Transformations**: Sort order should be preserved as entered by user when using the reduce transformation. [#24494](https://github.com/grafana/grafana/pull/24494), [@hugohaggmark](https://github.com/hugohaggmark)
- **Units**: Adds scale symbol for currencies with suffixed symbol. [#24678](https://github.com/grafana/grafana/pull/24678), [@hugohaggmark](https://github.com/hugohaggmark)
- **Variables**: Fixes filtering options with more than 1000 entries. [#24614](https://github.com/grafana/grafana/pull/24614), [@hugohaggmark](https://github.com/hugohaggmark)
- **Variables**: Fixes so Textbox variables read value from url. [#24623](https://github.com/grafana/grafana/pull/24623), [@hugohaggmark](https://github.com/hugohaggmark)
- **Zipkin**: Fix error when span contains remoteEndpoint. [#24524](https://github.com/grafana/grafana/pull/24524), [@aocenas](https://github.com/aocenas)
- **SAML**: Switch from email to login for user login attribute mapping (Enterprise)

# 7.0.0-beta3 (2020-05-08)

### Features / Enhancements

- **Docker**: Upgrade to Alpine 3.11. [#24056](https://github.com/grafana/grafana/pull/24056), [@aknuds1](https://github.com/aknuds1)
- **Forms**: Remove Forms namespace [BREAKING]. Will cause all `Forms` imports to stop working. See migration guide in [@grafana/ui changelog](https://github.com/grafana/grafana/blob/master/packages/grafana-ui/CHANGELOG.md)[#24378](https://github.com/grafana/grafana/pull/24378), [@tskarhed](https://github.com/tskarhed)

### Bug Fixes

- **CloudWatch**: Fix error with expression only query. [#24362](https://github.com/grafana/grafana/pull/24362), [@aocenas](https://github.com/aocenas)
- **Elasticsearch**: Fix building of raw document queries resulting in error Unknown BaseAggregationBuilder error. [#24403](https://github.com/grafana/grafana/pull/24403), [@ivanahuckova](https://github.com/ivanahuckova)
- **Prometheus**: Fix for prometheus legend formats for instant time series queries. [#24407](https://github.com/grafana/grafana/pull/24407), [@torkelo](https://github.com/torkelo)

# 7.0.0-beta2 (2020-05-07)

## Breaking changes

- **Removed PhantomJS**: PhantomJS was deprecated in [Grafana v6.4](https://grafana.com/docs/grafana/latest/guides/whats-new-in-v6-4/#phantomjs-deprecation) and starting from Grafana v7.0.0, all PhantomJS support has been removed. This means that Grafana no longer ships with a built-in image renderer, and we advise you to install the [Grafana Image Renderer plugin](https://grafana.com/grafana/plugins/grafana-image-renderer).
- **Docker**: Our Ubuntu based images have been upgraded to Ubuntu [20.04 LTS](https://releases.ubuntu.com/20.04/).
- **Dashboard**: A global minimum dashboard refresh interval is now enforced and defaults to 5 seconds.
- **@grafana/ui**: Forms migration notice, see [@grafana/ui changelog](https://github.com/grafana/grafana/blob/master/packages/grafana-ui/CHANGELOG.md)
- **Interval calculation**: There is now a new option `Max data points` that controls the auto interval `$__interval` calculation. Interval was previously calculated by dividing the panel width by the time range. With the new max data points option it is now easy to set `$__interval` to a dynamic value that is time range agnostic. For example if you set `Max data points` to 10 Grafana will dynamically set `$__interval` by dividing the current time range by 10.
- **Datasource/Loki**: Support for [deprecated Loki endpoints](https://github.com/grafana/loki/blob/master/docs/api.md#lokis-http-api) has been removed.

**Deprecation warnings**

- Scripted dashboards are now deprecated. The feature is not removed but will be in a future release. We hope to address the underlying requirement of dynamic dashboards in a different way. [#24059](https://github.com/grafana/grafana/issues/24059)

### Features / Enhancements

- **CloudWatch**: Adds more examples to CloudWatch Logs cheatsheet. [#24288](https://github.com/grafana/grafana/pull/24288), [@kaydelaney](https://github.com/kaydelaney)
- **Elasticsearch**: Changes terms min_doc_count default from 1 to 0. [#24204](https://github.com/grafana/grafana/pull/24204), [@Estrax](https://github.com/Estrax)
- **Login Page**: New design. [#23892](https://github.com/grafana/grafana/pull/23892), [@torkelo](https://github.com/torkelo)
- **Logs**: Add log level Fatal. [#24185](https://github.com/grafana/grafana/pull/24185), [@davkal](https://github.com/davkal)
- **Loki**: Show loki datasource stats in panel inspector. [#24190](https://github.com/grafana/grafana/pull/24190), [@davkal](https://github.com/davkal)
- **Migration**: Dashboard links. [#23553](https://github.com/grafana/grafana/pull/23553), [@peterholmberg](https://github.com/peterholmberg)
- **Plugins**: Require signing of external back-end plugins. [#24075](https://github.com/grafana/grafana/pull/24075), [@aknuds1](https://github.com/aknuds1)
- **Prometheus**: Add off switch for metric/label name lookup. [#24034](https://github.com/grafana/grafana/pull/24034), [@s-h-a-d-o-w](https://github.com/s-h-a-d-o-w)
- **Search**: Bring back open search by clicking dashboard name. [#24151](https://github.com/grafana/grafana/pull/24151), [@torkelo](https://github.com/torkelo)
- **Tracing**: Header updates. [#24153](https://github.com/grafana/grafana/pull/24153), [@aocenas](https://github.com/aocenas)
- **Transformations**: Improve time series support. [#23978](https://github.com/grafana/grafana/pull/23978), [@ryantxu](https://github.com/ryantxu)

### Bug Fixes

- **CloudWatch logs**: Fix default region interpolation and reset log groups on region change. [#24346](https://github.com/grafana/grafana/pull/24346), [@aocenas](https://github.com/aocenas)
- **Dashboard**: Fix for folder picker menu not being visible outside modal when saving dashboard. [#24296](https://github.com/grafana/grafana/pull/24296), [@tskarhed](https://github.com/tskarhed)
- **Dashboard**: Go to explore now works even after discarding dashboard changes. [#24149](https://github.com/grafana/grafana/pull/24149), [@torkelo](https://github.com/torkelo)
- **Dashboard**: Only show cache timeout option in panel edit if enabled in data source plugin json. [#24095](https://github.com/grafana/grafana/pull/24095), [@peterholmberg](https://github.com/peterholmberg)
- **Dashboard**: Propagate unhandled errors when saving dashboard. [#24081](https://github.com/grafana/grafana/pull/24081), [@peterholmberg](https://github.com/peterholmberg)
- **Dashboard**: Variable without a current value in json model causes crash on load. [#24261](https://github.com/grafana/grafana/pull/24261), [@torkelo](https://github.com/torkelo)
- **DashboardManager**: Disable editing if there are no folder permissions. [#24237](https://github.com/grafana/grafana/pull/24237), [@tskarhed](https://github.com/tskarhed)
- **DataLinks**: Do not add empty links. [#24088](https://github.com/grafana/grafana/pull/24088), [@dprokop](https://github.com/dprokop)
- **Explore/Loki**: Removes old query syntax support for regex filter. [#24281](https://github.com/grafana/grafana/pull/24281), [@Estrax](https://github.com/Estrax)
- **Explore**: Fix showing of results of queries in table. [#24018](https://github.com/grafana/grafana/pull/24018), [@ivanahuckova](https://github.com/ivanahuckova)
- **Field options**: show field name when title option config is empty. [#24335](https://github.com/grafana/grafana/pull/24335), [@dprokop](https://github.com/dprokop)
- **Graph**: Fixed graph tooltip getting stuck / not being cleared when leaving dashboard. [#24162](https://github.com/grafana/grafana/pull/24162), [@torkelo](https://github.com/torkelo)
- **Graph**: Fixed issue with x-axis labels showing "MM/DD" after viewing dashboard with pie chart. [#24341](https://github.com/grafana/grafana/pull/24341), [@mckn](https://github.com/mckn)
- **Jaeger**: Fix how label is created in cascader. [#24164](https://github.com/grafana/grafana/pull/24164), [@aocenas](https://github.com/aocenas)
- **Loki**: Fix label matcher for log metrics queries. [#24238](https://github.com/grafana/grafana/pull/24238), [@ivanahuckova](https://github.com/ivanahuckova)
- **Panel inspect**: hides Query tab for plugins without Query ability. [#24216](https://github.com/grafana/grafana/pull/24216), [@hugohaggmark](https://github.com/hugohaggmark)
- **Prometheus**: Refresh query field metrics on data source change. [#24116](https://github.com/grafana/grafana/pull/24116), [@s-h-a-d-o-w](https://github.com/s-h-a-d-o-w)
- **Select**: Fixes so component loses focus on selecting value or pressing outside of input. [#24008](https://github.com/grafana/grafana/pull/24008), [@mckn](https://github.com/mckn)
- **Stat/Gauge/BarGauge**: Shows default cursor when missing links. [#24284](https://github.com/grafana/grafana/pull/24284), [@hugohaggmark](https://github.com/hugohaggmark)
- **Tracing**: Fix view bounds after trace change. [#23994](https://github.com/grafana/grafana/pull/23994), [@aocenas](https://github.com/aocenas)
- **Variables**: Migrates old tags format for consistency. [#24276](https://github.com/grafana/grafana/pull/24276), [@hugohaggmark](https://github.com/hugohaggmark)
- **Reporting**: Update report schedule as soon as a report is updated (Enterprise)
- **White-labeling**: Makes login title and subtitle configurable (Enterprise)

# 7.0.0-beta1 (2020-04-28)

## Breaking changes

- **Removed PhantomJS**: PhantomJS was deprecated in [Grafana v6.4](https://grafana.com/docs/grafana/latest/guides/whats-new-in-v6-4/#phantomjs-deprecation) and starting from Grafana v7.0.0, all PhantomJS support has been removed. This means that Grafana no longer ships with a built-in image renderer, and we advise you to install the [Grafana Image Renderer plugin](https://grafana.com/grafana/plugins/grafana-image-renderer).
- **Docker**: Our Ubuntu based images have been upgraded to Ubuntu [20.04 LTS](https://releases.ubuntu.com/20.04/).
- **Dashboard**: A global minimum dashboard refresh interval is now enforced and defaults to 5 seconds.
- **@grafana/ui**: Forms migration notice, see [@grafana/ui changelog](https://github.com/grafana/grafana/blob/master/packages/grafana-ui/CHANGELOG.md)
- **@grafana/ui**: Select API change for creating custom values, see [@grafana/ui changelog](https://github.com/grafana/grafana/blob/master/packages/grafana-ui/CHANGELOG.md)
- **Interval calculation**: There is now a new option `Max data points` that controls the auto interval `$__interval` calculation. Interval was previously calculated by dividing the panel width by the time range. With the new max data points option it is now easy to set `$__interval` to a dynamic value that is time range agnostic. For example if you set `Max data points` to 10 Grafana will dynamically set `$__interval` by dividing the current time range by 10.
- **Datasource/Loki**: Support for [deprecated Loki endpoints](https://github.com/grafana/loki/blob/master/docs/api.md#lokis-http-api) has been removed.

### Features / Enhancements

- **@grafana/ui**: Create Icon component and replace icons. [#23402](https://github.com/grafana/grafana/pull/23402), [@ivanahuckova](https://github.com/ivanahuckova)
- **@grafana/ui**: Create slider component. [#22275](https://github.com/grafana/grafana/pull/22275), [@ivanahuckova](https://github.com/ivanahuckova)
- **@grafana/ui**: Remove ColorPalette component. [#23592](https://github.com/grafana/grafana/pull/23592), [@ivanahuckova](https://github.com/ivanahuckova)
- **AWS IAM**: Support for AWS EKS ServiceAccount roles for CloudWatch and S3 image upload. [#21594](https://github.com/grafana/grafana/pull/21594), [@patstrom](https://github.com/patstrom)
- **Alerting**: Adds support for basic auth in Alertmanager notifier. [#23231](https://github.com/grafana/grafana/pull/23231), [@melchiormoulin](https://github.com/melchiormoulin)
- **Alerting**: Enable Alert rule tags to override PagerDuty Severity setting. [#22736](https://github.com/grafana/grafana/pull/22736), [@AndrewBurian](https://github.com/AndrewBurian)
- **Alerting**: Handle image renderer unavailable when edit notifiers. [#23711](https://github.com/grafana/grafana/pull/23711), [@marefr](https://github.com/marefr)
- **Alerting**: Upload error image when image renderer unavailable. [#23713](https://github.com/grafana/grafana/pull/23713), [@marefr](https://github.com/marefr)
- **Alerting**: support alerting on data.Frame (that can be time series). [#22812](https://github.com/grafana/grafana/pull/22812), [@kylebrandt](https://github.com/kylebrandt)
- **Azure Monitor**: Add alerting support - Port Azure log analytics to the backend. [#23839](https://github.com/grafana/grafana/pull/23839), [@daniellee](https://github.com/daniellee)
- **Backend plugins**: Support alerting in external data source plugins. [#6841](https://github.com/grafana/grafana/issues/6841)
- **Build**: Bundle plugins. [#23787](https://github.com/grafana/grafana/pull/23787), [@aknuds1](https://github.com/aknuds1)
- **Build**: Remove usage of Go vendoring. [#23796](https://github.com/grafana/grafana/pull/23796), [@kylebrandt](https://github.com/kylebrandt)
- **Build**: Upgrade to Go 1.14. [#23371](https://github.com/grafana/grafana/pull/23371), [@aknuds1](https://github.com/aknuds1)
- **CloudWatch**: Added AWS Chatbot metrics and dimensions. [#23516](https://github.com/grafana/grafana/pull/23516), [@ilyastoli](https://github.com/ilyastoli)
- **CloudWatch**: Added Cassandra namespace. [#23299](https://github.com/grafana/grafana/pull/23299), [@vikkyomkar](https://github.com/vikkyomkar)
- **CloudWatch**: Added missing Cassandra metrics. [#23467](https://github.com/grafana/grafana/pull/23467), [@ilyastoli](https://github.com/ilyastoli)
- **CloudWatch**: Adds support for Cloudwatch Logs. [#23566](https://github.com/grafana/grafana/pull/23566), [@kaydelaney](https://github.com/kaydelaney)
- **CloudWatch**: Prefer webIdentity over EC2 role. [#23452](https://github.com/grafana/grafana/pull/23452), [@dnascimento](https://github.com/dnascimento)
- **CloudWatch**: Prefer webIdentity over EC2 role also when assuming a role. [#23807](https://github.com/grafana/grafana/pull/23807), [@bruecktech](https://github.com/bruecktech)
- **Components**: IconButton. [#23510](https://github.com/grafana/grafana/pull/23510), [@torkelo](https://github.com/torkelo)
- **Dashboard**: Add failsafe for slug generation. [#23709](https://github.com/grafana/grafana/pull/23709), [@sakjur](https://github.com/sakjur)
- **Dashboard**: Enforce minimum dashboard refresh interval to 5 seconds per default. [#23929](https://github.com/grafana/grafana/pull/23929), [@marefr](https://github.com/marefr)
- **Dashboard**: Handle no renderer available in panel share dialog. [#23856](https://github.com/grafana/grafana/pull/23856), [@marefr](https://github.com/marefr)
- **Dashboard**: Support additional variable format options (singlequote, doublequote, sqlstring). [#21622](https://github.com/grafana/grafana/pull/21622), [@xiaobeiyang](https://github.com/xiaobeiyang)
- **Dashboard**: Support data links via field overrides. [#23590](https://github.com/grafana/grafana/pull/23590), [@dprokop](https://github.com/dprokop)
- **Data source**: Max data points now used in interval calculation for all data sources. [#23915](https://github.com/grafana/grafana/pull/23915), [@torkelo](https://github.com/torkelo)
- **Database**: Order results in UserSearch by username/email. [#23328](https://github.com/grafana/grafana/pull/23328), [@aknuds1](https://github.com/aknuds1)
- **Database**: Update the xorm dependency to v0.8.1. [#22376](https://github.com/grafana/grafana/pull/22376), [@novalagung](https://github.com/novalagung)
- **Docker**: Upgrade to Ubuntu 20.04 in Dockerfiles. [#23852](https://github.com/grafana/grafana/pull/23852), [@aknuds1](https://github.com/aknuds1)
- **Docs**: Adding API reference documentation support for the packages libraries. [#21931](https://github.com/grafana/grafana/pull/21931), [@mckn](https://github.com/mckn)
- **Tracing**: Add trace UI to show traces from tracing datasources and Jaeger datasource. [#23047](https://github.com/grafana/grafana/pull/23047), [@aocenas](https://github.com/aocenas)
- **Frontend**: Adding support to select preferred timezone for presentation of date and time values. [#23586](https://github.com/grafana/grafana/pull/23586), [@mckn](https://github.com/mckn)
- **Grafana Toolkit**: Adds template for backend data source. [#23864](https://github.com/grafana/grafana/pull/23864), [@bergquist](https://github.com/bergquist)
- **Graphite**: Rollup indicator and custom meta data inspector. [#22738](https://github.com/grafana/grafana/pull/22738), [@torkelo](https://github.com/torkelo)
- **HTTP API**: Allow assigning a specific organization when creating a new user. [#21775](https://github.com/grafana/grafana/pull/21775), [@Sytten](https://github.com/Sytten)
- **Image Rendering**: New setting to control render request concurrency. [#23950](https://github.com/grafana/grafana/pull/23950), [@marefr](https://github.com/marefr)
- **Image Rendering**: Remove PhantomJS support. [#23460](https://github.com/grafana/grafana/pull/23460), [@marefr](https://github.com/marefr)
- **Logs**: Derived fields link design. [#23695](https://github.com/grafana/grafana/pull/23695), [@aocenas](https://github.com/aocenas)
- **Metrics**: Add image rendering metrics. [#23827](https://github.com/grafana/grafana/pull/23827), [@alexanderzobnin](https://github.com/alexanderzobnin)
- **Metrics**: Instrument backend plugin requests. [#23346](https://github.com/grafana/grafana/pull/23346), [@bergquist](https://github.com/bergquist)
- **Migration**: Add old Input to legacy namespace. [#23286](https://github.com/grafana/grafana/pull/23286), [@tskarhed](https://github.com/tskarhed)
- **Migration**: Admin org edit page. [#23866](https://github.com/grafana/grafana/pull/23866), [@tskarhed](https://github.com/tskarhed)
- **Migration**: Alerting - notifications list. [#22548](https://github.com/grafana/grafana/pull/22548), [@tskarhed](https://github.com/tskarhed)
- **Migration**: Change password. [#23623](https://github.com/grafana/grafana/pull/23623), [@tskarhed](https://github.com/tskarhed)
- **Migration**: Create org. [#22542](https://github.com/grafana/grafana/pull/22542), [@tskarhed](https://github.com/tskarhed)
- **Migration**: Data/Panel link editor. [#23778](https://github.com/grafana/grafana/pull/23778), [@tskarhed](https://github.com/tskarhed)
- **Migration**: Final components to LegacyForms. [#23707](https://github.com/grafana/grafana/pull/23707), [@tskarhed](https://github.com/tskarhed)
- **Migration**: Layout Selector. [#23790](https://github.com/grafana/grafana/pull/23790), [@tskarhed](https://github.com/tskarhed)
- **Migration**: Migrate admin/users. [#22759](https://github.com/grafana/grafana/pull/22759), [@mckn](https://github.com/mckn)
- **Migration**: Migrates ad hoc variable type to react/redux. [#22784](https://github.com/grafana/grafana/pull/22784), [@mckn](https://github.com/mckn)
- **Migration**: Move Switch from Forms namespace. [#23386](https://github.com/grafana/grafana/pull/23386), [@tskarhed](https://github.com/tskarhed)
- **Migration**: Move last components from Forms namespace. [#23556](https://github.com/grafana/grafana/pull/23556), [@tskarhed](https://github.com/tskarhed)
- **Migration**: Move old Switch to legacy namespace. [#23357](https://github.com/grafana/grafana/pull/23357), [@tskarhed](https://github.com/tskarhed)
- **Migration**: New datasource. [#23221](https://github.com/grafana/grafana/pull/23221), [@tskarhed](https://github.com/tskarhed)
- **Migration**: Org users page. [#23372](https://github.com/grafana/grafana/pull/23372), [@tskarhed](https://github.com/tskarhed)
- **Migration**: Orgs list. [#23821](https://github.com/grafana/grafana/pull/23821), [@tskarhed](https://github.com/tskarhed)
- **Migration**: Remove Button from Forms namespace. [#23105](https://github.com/grafana/grafana/pull/23105), [@tskarhed](https://github.com/tskarhed)
- **Migration**: Teams and alert list. [#23810](https://github.com/grafana/grafana/pull/23810), [@tskarhed](https://github.com/tskarhed)
- **Migration**: TextArea from Forms namespace. [#23436](https://github.com/grafana/grafana/pull/23436), [@tskarhed](https://github.com/tskarhed)
- **Migration**: User edit. [#23110](https://github.com/grafana/grafana/pull/23110), [@tskarhed](https://github.com/tskarhed)
- **OAuth**: Adds Okta provider. [#22972](https://github.com/grafana/grafana/pull/22972), [@alexanderzobnin](https://github.com/alexanderzobnin)
- **OAuth**: Introduce new setting for configuring max age of OAuth state cookie. [#23195](https://github.com/grafana/grafana/pull/23195), [@rtrompier](https://github.com/rtrompier)
- **Plugins**: Add deprecation notice to setEditor method in PanelPlugin. [#23895](https://github.com/grafana/grafana/pull/23895), [@dprokop](https://github.com/dprokop)
- **Plugins**: Adds support for URL params in plugin routes. [#23503](https://github.com/grafana/grafana/pull/23503), [@daniellee](https://github.com/daniellee)
- **Plugins**: Fluent API for custom field config and panel options creation for PanelPlugin. [#23070](https://github.com/grafana/grafana/pull/23070), [@dprokop](https://github.com/dprokop)
- **Plugins**: Hide plugins page from viewers, and limit /api/plugins to only core plugins when called by viewer role. [#21901](https://github.com/grafana/grafana/pull/21901), [@dprokop](https://github.com/dprokop)
- **Postgres**: Add SSL support for datasource. [#21341](https://github.com/grafana/grafana/pull/21341), [@ryankurte](https://github.com/ryankurte)
- **Prometheus**: Render missing labels in legend formats as an empty string. [#22355](https://github.com/grafana/grafana/pull/22355), [@Hixon10](https://github.com/Hixon10)
- **Provisioning**: Allows specifying uid for datasource and use that in derived fields. [#23585](https://github.com/grafana/grafana/pull/23585), [@aocenas](https://github.com/aocenas)
- **Provisioning**: Validate that dashboard providers have unique names. [#22898](https://github.com/grafana/grafana/pull/22898), [@youshy](https://github.com/youshy)
- **Search**: Replace search implementation. [#23855](https://github.com/grafana/grafana/pull/23855), [@sakjur](https://github.com/sakjur)
- **Search**: migrate dashboard search to react. [#23274](https://github.com/grafana/grafana/pull/23274), [@Clarity-89](https://github.com/Clarity-89)
- **Server**: Don't include trailing slash in cookie path when hosting Grafana in a sub path. [#22265](https://github.com/grafana/grafana/pull/22265), [@consideRatio](https://github.com/consideRatio)
- **Stackdriver**: Support for SLO queries. [#22917](https://github.com/grafana/grafana/pull/22917), [@sunker](https://github.com/sunker)
- **Table**: Add support for organizing fields/columns. [#23135](https://github.com/grafana/grafana/pull/23135), [@mckn](https://github.com/mckn)
- **Table**: Improvements to column resizing, style and alignment. [#23663](https://github.com/grafana/grafana/pull/23663), [@torkelo](https://github.com/torkelo)
- **Table**: upgrades react-table to 7.0.0 and typings. [#23247](https://github.com/grafana/grafana/pull/23247), [@hugohaggmark](https://github.com/hugohaggmark)
- **Table**: Handle column overflow and horizontal scrolling in table panel. [#4157](https://github.com/grafana/grafana/issues/4157)
- **Tracing**: Dark theme styling for TraceView. [#23406](https://github.com/grafana/grafana/pull/23406), [@aocenas](https://github.com/aocenas)
- **Tracing**: Zipkin datasource. [#23829](https://github.com/grafana/grafana/pull/23829), [@aocenas](https://github.com/aocenas)
- **Transformations**: Adds labels as fields transformer. [#23703](https://github.com/grafana/grafana/pull/23703), [@hugohaggmark](https://github.com/hugohaggmark)
- **Transformations**: Improve UI and add some love to filter by name. [#23751](https://github.com/grafana/grafana/pull/23751), [@dprokop](https://github.com/dprokop)
- **Transformations**: calculate a new field based on the row values. [#23675](https://github.com/grafana/grafana/pull/23675), [@ryantxu](https://github.com/ryantxu)
- **Units**: add (IEC) and (Metric) to bits and bytes. [#23175](https://github.com/grafana/grafana/pull/23175), [@flopp999](https://github.com/flopp999)
- **Usagestats**: Add usage stats about what type of data source is used in alerting. [#23125](https://github.com/grafana/grafana/pull/23125), [@bergquist](https://github.com/bergquist)
- **delete old dashboard versions in multiple batches**. [#23348](https://github.com/grafana/grafana/pull/23348), [@DanCech](https://github.com/DanCech)
- **grafana/data**: PanelTypeChangedHandler API update to use PanelModel instead of panel options object [BREAKING]. [#22754](https://github.com/grafana/grafana/pull/22754), [@dprokop](https://github.com/dprokop)
- **grafana/ui**: Add basic horizontal and vertical layout components. [#22303](https://github.com/grafana/grafana/pull/22303), [@dprokop](https://github.com/dprokop)
- **Auth** SAML Role and Team Sync (Enterprise)
- **Presence Indicators**: Display the avatars of active users on dashboards (Enterprise)
- **Reporting**: Makes it possible to disable the scheduler (Enterprise)
- **Dashboard**: Dashboard usage view (Enterprise)
- **Reporting** Makes it possible to trigger report emails without scheduler (Enterprise)
- **Search**: Sorting based on dashboard views and errors (Enterprise)
- **Reporting**: Improved landscape mode and panel image quality (Enterprise)
- **Reporting**: Adds config setting for image_scale_factor of panel images (Enterprise)

### Bug Fixes

- **@grafana/ui**: Fix time range when only partial datetime is provided. [#23122](https://github.com/grafana/grafana/pull/23122), [@ivanahuckova](https://github.com/ivanahuckova)
- **Alerting**: Only include image in notifier when enabled. [#23194](https://github.com/grafana/grafana/pull/23194), [@marefr](https://github.com/marefr)
- **Alerting**: Basic auth should not be required in the Alertmanager notifier. [#23691](https://github.com/grafana/grafana/pull/23691), [@bergquist](https://github.com/bergquist)
- **Alerting**: Translate notification IDs to UIDs when extracting alert rules. [#19882](https://github.com/grafana/grafana/pull/19882), [@aSapien](https://github.com/aSapien)
- **Azure Monitor**: Fix for application insights Azure China plugin route. [#23877](https://github.com/grafana/grafana/pull/23877), [@daniellee](https://github.com/daniellee)
- **CloudWatch**: Add ServerlessDatabaseCapacity to AWS/RDS metrics. [#23635](https://github.com/grafana/grafana/pull/23635), [@jackstevenson](https://github.com/jackstevenson)
- **Dashboard**: Fix global variable "\_\_org.id". [#23362](https://github.com/grafana/grafana/pull/23362), [@vikkyomkar](https://github.com/vikkyomkar)
- **Dashboard**: Handle min refresh interval when importing dashboard. [#23959](https://github.com/grafana/grafana/pull/23959), [@marefr](https://github.com/marefr)
- **DataSourceProxy**: Handle URL parsing error. [#23731](https://github.com/grafana/grafana/pull/23731), [@aknuds1](https://github.com/aknuds1)
- **Frontend**: Fix sorting of organization popup in alphabetical order. [#22259](https://github.com/grafana/grafana/pull/22259), [@vikkyomkar](https://github.com/vikkyomkar)
- **Image Rendering**: Make it work using serve_from_sub_path configured. [#23706](https://github.com/grafana/grafana/pull/23706), [@marefr](https://github.com/marefr)
- **Image rendering**: Fix missing icon on plugins list. [#23958](https://github.com/grafana/grafana/pull/23958), [@marefr](https://github.com/marefr)
- **Logs**: Fix error when non-string log level supplied. [#23654](https://github.com/grafana/grafana/pull/23654), [@ivanahuckova](https://github.com/ivanahuckova)
- **Rich history**: Fix create url and run query for various datasources. [#23627](https://github.com/grafana/grafana/pull/23627), [@ivanahuckova](https://github.com/ivanahuckova)
- **Security**: Fix XSS vulnerability in table panel. [#23816](https://github.com/grafana/grafana/pull/23816), [@torkelo](https://github.com/torkelo)

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
