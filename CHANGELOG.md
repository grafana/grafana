<!-- 9.4.7 START -->

# 9.4.7 (2023-03-16)

### Bug fixes

- **Alerting:** Update scheduler to receive rule updates only from database. [#64780](https://github.com/grafana/grafana/pull/64780), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Influxdb:** Re-introduce backend migration feature toggle. [#64842](https://github.com/grafana/grafana/pull/64842), [@itsmylife](https://github.com/itsmylife)
- **Security:** Fixes for CVE-2023-1410. [#65278](https://github.com/grafana/grafana/pull/65278), [@itsmylife](https://github.com/itsmylife)

### Breaking changes

The InfluxDB backend migration feature toggle (influxdbBackendMigration) has been reintroduced in this version as issues were discovered with backend processing of InfluxDB data. Unless this feature toggle is enabled, all InfluxDB data will be parsed in the frontend. This frontend processing is the default behavior.
In Grafana 9.4.4, InfluxDB data parsing started to be handled in the backend. If you have upgraded to 9.4.4 and then added new transformations on InfluxDB data, those panels will fail to render. To resolve this either:

- Remove the affected panel and re-create it
- Edit the `time` field as `Time` in `panel.json` or `dashboard.json` Issue [#64842](https://github.com/grafana/grafana/issues/64842)

<!-- 9.4.7 END -->
<!-- 9.4.3 START -->

# 9.4.3 (2023-03-02)

### Bug fixes

- **Alerting:** Use background context for maintenance function. [#64065](https://github.com/grafana/grafana/pull/64065), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Report Settings:** Fix URL validation. (Enterprise)

<!-- 9.4.3 END -->
<!-- 9.4.2 START -->

# 9.4.2 (2023-03-02)

### Bug fixes

- **Alerting:** Fix boolean default in migration from false to 0. [#63952](https://github.com/grafana/grafana/pull/63952), [@alexmobo](https://github.com/alexmobo)

<!-- 9.4.2 END -->
<!-- 9.4.1 START -->

# 9.4.1 (2023-02-28)

<!-- 9.4.1 END -->
<!-- 9.4.0 START -->

# 9.4.0 (2023-02-28)

### Features and enhancements

- **Alerting:** Add endpoint for querying state history. [#62166](https://github.com/grafana/grafana/pull/62166), [@alexweav](https://github.com/alexweav)
- **Alerting:** Add label query parameters to state history endpoint. [#62831](https://github.com/grafana/grafana/pull/62831), [@alexweav](https://github.com/alexweav)
- **Alerting:** Add static label to all state history entries. [#62817](https://github.com/grafana/grafana/pull/62817), [@alexweav](https://github.com/alexweav)
- **Alerting:** Mark AM configuration as applied. [#61330](https://github.com/grafana/grafana/pull/61330), [@santihernandezc](https://github.com/santihernandezc)
- **Azure Monitor:** Enable multiple resource queries. [#62467](https://github.com/grafana/grafana/pull/62467), [@andresmgot](https://github.com/andresmgot)
- **InfluxDB:** Move database information into jsondata. [#62308](https://github.com/grafana/grafana/pull/62308), [@itsmylife](https://github.com/itsmylife)
- **Query Caching:** Add per-panel query caching TTL. [#61968](https://github.com/grafana/grafana/pull/61968), [@mmandrus](https://github.com/mmandrus)
- **Table:** Add row number column option. [#62256](https://github.com/grafana/grafana/pull/62256), [@baldm0mma](https://github.com/baldm0mma)
- **Tempo:** Remove tempoApmTable feature flag. [#62499](https://github.com/grafana/grafana/pull/62499), [@adrapereira](https://github.com/adrapereira)
- **Transformations:** Selectively apply transformation to queries. [#61735](https://github.com/grafana/grafana/pull/61735), [@ryantxu](https://github.com/ryantxu)

### Bug fixes

- **AccessControl:** Clear user permission cache for update org user role. [#62745](https://github.com/grafana/grafana/pull/62745), [@Jguer](https://github.com/Jguer)
- **Alerting:** Fix handling of special floating-point cases when writing observed values to annotations. [#61074](https://github.com/grafana/grafana/pull/61074), [@alexweav](https://github.com/alexweav)
- **Auth:** Rotate token patch. [#62676](https://github.com/grafana/grafana/pull/62676), [@mgyongyosi](https://github.com/mgyongyosi)
- **ContextMenu:** Consider y coord when determining bottom collision. [#62403](https://github.com/grafana/grafana/pull/62403), [@gelicia](https://github.com/gelicia)
- **Elasticsearch:** Fix consistent label order in alerting. [#62497](https://github.com/grafana/grafana/pull/62497), [@gabor](https://github.com/gabor)
- **Explore:** Fix graph not updating when changing config. [#62473](https://github.com/grafana/grafana/pull/62473), [@Elfo404](https://github.com/Elfo404)
- **Heatmap:** Support heatmap rows with non-timeseries X axis. [#60929](https://github.com/grafana/grafana/pull/60929), [@ryantxu](https://github.com/ryantxu)
- **Login:** Fix panic when a user is upserted by a background process. [#62539](https://github.com/grafana/grafana/pull/62539), [@sakjur](https://github.com/sakjur)
- **MSSQL:** Add support for macro function calls. [#62742](https://github.com/grafana/grafana/pull/62742), [@mdvictor](https://github.com/mdvictor)
- **MySQL:** Quote identifiers that include special characters. [#61135](https://github.com/grafana/grafana/pull/61135), [@zoltanbedi](https://github.com/zoltanbedi)
- **Navigation:** Sign in button now works correctly when served under a sub path. [#62504](https://github.com/grafana/grafana/pull/62504), [@ashharrison90](https://github.com/ashharrison90)
- **Nested Folder:** Fix for SQLite not to overwrite the parent on restarts. [#62709](https://github.com/grafana/grafana/pull/62709), [@papagian](https://github.com/papagian)
- **PanelChrome:** Adds display mode to support transparent option. [#62647](https://github.com/grafana/grafana/pull/62647), [@torkelo](https://github.com/torkelo)
- **Plugins:** Case-sensitive routes for standalone pages. [#62779](https://github.com/grafana/grafana/pull/62779), [@leventebalogh](https://github.com/leventebalogh)
- **Plugins:** Prefer to use the data source UID when querying. [#62776](https://github.com/grafana/grafana/pull/62776), [@andresmgot](https://github.com/andresmgot)
- **SQLStore:** Fix folder migration for MySQL < 5.7. [#62521](https://github.com/grafana/grafana/pull/62521), [@papagian](https://github.com/papagian)
- **Search:** Fix not being able to clear sort value. [#62557](https://github.com/grafana/grafana/pull/62557), [@joshhunt](https://github.com/joshhunt)
- **Tempo:** Fix span name being dropped from the query. [#62257](https://github.com/grafana/grafana/pull/62257), [@CrypticSignal](https://github.com/CrypticSignal)

### Plugin development fixes & changes

- **PanelChrome:** Implement hover header. [#61774](https://github.com/grafana/grafana/pull/61774), [@kaydelaney](https://github.com/kaydelaney)

<!-- 9.4.0 END -->
<!-- 9.4.0-beta1 START -->

# 9.4.0-beta1 (2023-01-30)

### Features and enhancements

- **API:** Change how Cache-Control and related headers are set. [#62021](https://github.com/grafana/grafana/pull/62021), [@kylebrandt](https://github.com/kylebrandt)
- **AccessControl:** Add high availability support to access control seeder. (Enterprise)
- **Accessibility:** Make QueryEditorHelp examples keyboard interactive. [#59355](https://github.com/grafana/grafana/pull/59355), [@idastambuk](https://github.com/idastambuk)
- **Admin:** Combine org and admin user pages. [#59365](https://github.com/grafana/grafana/pull/59365), [@Clarity-89](https://github.com/Clarity-89)
- **Admin:** Remove navigation subheaders. [#61344](https://github.com/grafana/grafana/pull/61344), [@Clarity-89](https://github.com/Clarity-89)
- **AlertGroups:** Generate models.gen.ts from models.cue. [#61227](https://github.com/grafana/grafana/pull/61227), [@Clarity-89](https://github.com/Clarity-89)
- **Alerting:** Access query details of provisioned alerts. [#59626](https://github.com/grafana/grafana/pull/59626), [@konrad147](https://github.com/konrad147)
- **Alerting:** Add alert rule cloning action. [#59200](https://github.com/grafana/grafana/pull/59200), [@konrad147](https://github.com/konrad147)
- **Alerting:** Add dashboard and panel picker to the rule form. [#58304](https://github.com/grafana/grafana/pull/58304), [@konrad147](https://github.com/konrad147)
- **Alerting:** Add discord as a possible receiver in cloud rules. [#59366](https://github.com/grafana/grafana/pull/59366), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Add export button for exporting all alert rules in alert list view. [#62416](https://github.com/grafana/grafana/pull/62416), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Add header X-Grafana-Org-Id to evaluation requests. [#58972](https://github.com/grafana/grafana/pull/58972), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Add landing page. [#59050](https://github.com/grafana/grafana/pull/59050), [@konrad147](https://github.com/konrad147)
- **Alerting:** Add maxdatapoints in alert rule form. [#61904](https://github.com/grafana/grafana/pull/61904), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Add provisioning endpoint to fetch all rules. [#59989](https://github.com/grafana/grafana/pull/59989), [@alexweav](https://github.com/alexweav)
- **Alerting:** Add support for settings parse_mode and disable_notifications to Telegram receiver. [#60198](https://github.com/grafana/grafana/pull/60198), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Add support for tracing to alerting scheduler. [#61057](https://github.com/grafana/grafana/pull/61057), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Adds evaluation interval to group view. [#59974](https://github.com/grafana/grafana/pull/59974), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Alert rules search improvements. [#61398](https://github.com/grafana/grafana/pull/61398), [@konrad147](https://github.com/konrad147)
- **Alerting:** Allow state history to be disabled through configuration. [#61006](https://github.com/grafana/grafana/pull/61006), [@alexweav](https://github.com/alexweav)
- **Alerting:** Bump Prometheus Alertmanager to v0.25. [#60764](https://github.com/grafana/grafana/pull/60764), [@santihernandezc](https://github.com/santihernandezc)
- **Alerting:** Choose a previous valid AM configuration in case of error. [#58472](https://github.com/grafana/grafana/pull/58472), [@santihernandezc](https://github.com/santihernandezc)
- **Alerting:** Create endpoints for exporting in provisioning file format. [#58623](https://github.com/grafana/grafana/pull/58623), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Declare incident from a firing alert. [#61178](https://github.com/grafana/grafana/pull/61178), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Do not maintain Normal state. [#56336](https://github.com/grafana/grafana/pull/56336), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Improve UI for making more clear that evaluation interval belongs to the group. [#56397](https://github.com/grafana/grafana/pull/56397), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Improve legacy migration to include send reminder & frequency. [#60275](https://github.com/grafana/grafana/pull/60275), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** PagerDuty receiver to let user configure fields Source, Client and Client URL. [#59895](https://github.com/grafana/grafana/pull/59895), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Recognise & change UI for OnCall notification policy + contact point. [#60259](https://github.com/grafana/grafana/pull/60259), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Rename contact point type to receiver in the user interface. [#59589](https://github.com/grafana/grafana/pull/59589), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Rule evaluator to get cached data source info. [#61305](https://github.com/grafana/grafana/pull/61305), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Support customizable timeout for screenshots. [#60981](https://github.com/grafana/grafana/pull/60981), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** UI changes required to support v3 and Auth in Kafka Contact Point. [#61123](https://github.com/grafana/grafana/pull/61123), [@MohammadGhazanfar](https://github.com/MohammadGhazanfar)
- **Alerting:** Update Alerting and Alertmanager to v0.25.1. [#61233](https://github.com/grafana/grafana/pull/61233), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Upload images to Slack via files.upload. [#59163](https://github.com/grafana/grafana/pull/59163), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Auditing/Usage Insights:** Loki support for multi-tenancy. (Enterprise)
- **Auth forwarding:** Pass tokens without refresh. [#61634](https://github.com/grafana/grafana/pull/61634), [@Jguer](https://github.com/Jguer)
- **Auth:** Add expiry date for service accounts access tokens. [#58885](https://github.com/grafana/grafana/pull/58885), [@linoman](https://github.com/linoman)
- **Auth:** Add plugin roles to RolePicker. [#59667](https://github.com/grafana/grafana/pull/59667), [@linoman](https://github.com/linoman)
- **Auth:** Add skip_org_role_sync for AzureAD OAuth. [#60322](https://github.com/grafana/grafana/pull/60322), [@eleijonmarck](https://github.com/eleijonmarck)
- **Auth:** Add skip_org_role_sync for Okta. [#62106](https://github.com/grafana/grafana/pull/62106), [@eleijonmarck](https://github.com/eleijonmarck)
- **Auth:** Add skip_org_role_sync setting for GrafanaCom. [#60553](https://github.com/grafana/grafana/pull/60553), [@eleijonmarck](https://github.com/eleijonmarck)
- **Auth:** Add skip_org_role_sync setting for github. [#61673](https://github.com/grafana/grafana/pull/61673), [@eleijonmarck](https://github.com/eleijonmarck)
- **Auth:** Add skip_org_role_sync setting to OAuth integration Google. [#61572](https://github.com/grafana/grafana/pull/61572), [@eleijonmarck](https://github.com/eleijonmarck)
- **Auth:** Add skip_org_role_sync to GitLab OAuth. [#62055](https://github.com/grafana/grafana/pull/62055), [@eleijonmarck](https://github.com/eleijonmarck)
- **Auth:** Add sub claim check to JWT Auth pre-checks. [#61417](https://github.com/grafana/grafana/pull/61417), [@mgyongyosi](https://github.com/mgyongyosi)
- **Auth:** Disable team sync for JWT Authentication. [#62191](https://github.com/grafana/grafana/pull/62191), [@eleijonmarck](https://github.com/eleijonmarck)
- **Auth:** Display id Provider label in orgs/users view. [#58033](https://github.com/grafana/grafana/pull/58033), [@linoman](https://github.com/linoman)
- **Auth:** Implement skip org role sync for jwt. [#61647](https://github.com/grafana/grafana/pull/61647), [@linoman](https://github.com/linoman)
- **Auth:** Log a more useful msg if no OAuth provider configured. [#56722](https://github.com/grafana/grafana/pull/56722), [@someone-stole-my-name](https://github.com/someone-stole-my-name)
- **Auth:** Set service account access token limit on expiry dates. [#56467](https://github.com/grafana/grafana/pull/56467), [@linoman](https://github.com/linoman)
- **Azure Monitor:** Add variable function to list regions. [#62297](https://github.com/grafana/grafana/pull/62297), [@andresmgot](https://github.com/andresmgot)
- **Backend:** Consistently use context RemoteAddr function to determine remote address. [#60201](https://github.com/grafana/grafana/pull/60201), [@DanCech](https://github.com/DanCech)
- **BarChart:** Highlight bars option for easier interaction. [#60530](https://github.com/grafana/grafana/pull/60530), [@mdvictor](https://github.com/mdvictor)
- **BarChartPanel:** Custom tooltips. [#60148](https://github.com/grafana/grafana/pull/60148), [@mdvictor](https://github.com/mdvictor)
- **Canvas:** Add server element. [#61104](https://github.com/grafana/grafana/pull/61104), [@drew08t](https://github.com/drew08t)
- **Canvas:** Add support for basic arrows. [#57561](https://github.com/grafana/grafana/pull/57561), [@nmarrs](https://github.com/nmarrs)
- **Canvas:** Add tooltip for data links. [#61648](https://github.com/grafana/grafana/pull/61648), [@adela-almasan](https://github.com/adela-almasan)
- **Canvas:** Improve placement when adding an element via context menu. [#61071](https://github.com/grafana/grafana/pull/61071), [@adela-almasan](https://github.com/adela-almasan)
- **Canvas:** Update context menu actions for multiple elements selected. [#61108](https://github.com/grafana/grafana/pull/61108), [@adela-almasan](https://github.com/adela-almasan)
- **Canvas:** Update element(s) selection after action. [#61204](https://github.com/grafana/grafana/pull/61204), [@adela-almasan](https://github.com/adela-almasan)
- **Chore:** Add deprecation warnings for Sentry. [#60165](https://github.com/grafana/grafana/pull/60165), [@domasx2](https://github.com/domasx2)
- **CloudMonitor:** Improve detail of MQL series labels. [#59747](https://github.com/grafana/grafana/pull/59747), [@aangelisc](https://github.com/aangelisc)
- **CloudWatch Logs:** Set default logs query and disable button when empty. [#61956](https://github.com/grafana/grafana/pull/61956), [@iwysiu](https://github.com/iwysiu)
- **CloudWatch:** Add CloudWatchSynthetics dimension. [#60832](https://github.com/grafana/grafana/pull/60832), [@jangaraj](https://github.com/jangaraj)
- **CloudWatch:** Add MaxProvisionedTableReadCapacityUtilization AWS/DynamoDB metric name. [#60829](https://github.com/grafana/grafana/pull/60829), [@jangaraj](https://github.com/jangaraj)
- **CloudWatch:** Add RDS dimension. [#61027](https://github.com/grafana/grafana/pull/61027), [@jangaraj](https://github.com/jangaraj)
- **CloudWatch:** Add macro for resolving period in SEARCH expressions. [#60435](https://github.com/grafana/grafana/pull/60435), [@sunker](https://github.com/sunker)
- **Cloudwatch:** Add feedback labels to log groups selector. [#60619](https://github.com/grafana/grafana/pull/60619), [@sunker](https://github.com/sunker)
- **Cloudwatch:** Add run query button. [#60089](https://github.com/grafana/grafana/pull/60089), [@sunker](https://github.com/sunker)
- **Cloudwatch:** Add support for template variables in new log group picker. [#61243](https://github.com/grafana/grafana/pull/61243), [@sunker](https://github.com/sunker)
- **Cloudwatch:** Define and use getDefaultquery instead of calling onChange on mount. [#60221](https://github.com/grafana/grafana/pull/60221), [@idastambuk](https://github.com/idastambuk)
- **Cloudwatch:** Refactor log group model. [#60873](https://github.com/grafana/grafana/pull/60873), [@sunker](https://github.com/sunker)
- **Cloudwatch:** Set CloudwatchCrossAccountQuery feature to stable. [#62348](https://github.com/grafana/grafana/pull/62348), [@sarahzinger](https://github.com/sarahzinger)
- **Cloudwatch:** Use new log group picker also for non cross-account queries. [#60913](https://github.com/grafana/grafana/pull/60913), [@sunker](https://github.com/sunker)
- **CommandPalette:** Improve section header styling. [#61584](https://github.com/grafana/grafana/pull/61584), [@joshhunt](https://github.com/joshhunt)
- **CommandPalette:** Minor usability improvements. [#61567](https://github.com/grafana/grafana/pull/61567), [@joshhunt](https://github.com/joshhunt)
- **CommandPalette:** Search for dashboards using API. [#61090](https://github.com/grafana/grafana/pull/61090), [@joshhunt](https://github.com/joshhunt)
- **Config:** Support JSON list syntax. [#61288](https://github.com/grafana/grafana/pull/61288), [@alexanderzobnin](https://github.com/alexanderzobnin)
- **DataLinks:** Allow providing a dynamic data link builder. [#60452](https://github.com/grafana/grafana/pull/60452), [@dprokop](https://github.com/dprokop)
- **DataProxy:** Populate X-Grafana-Referer header. [#60040](https://github.com/grafana/grafana/pull/60040), [@neilfordyce](https://github.com/neilfordyce)
- **Database:** Adds support for enable/disable SQLite Write-Ahead Logging (WAL) via configuration. [#58268](https://github.com/grafana/grafana/pull/58268), [@marefr](https://github.com/marefr)
- **Dataplane:** Deprecate timeseries-many in favor of timeseries-multi. [#59070](https://github.com/grafana/grafana/pull/59070), [@bohandley](https://github.com/bohandley)
- **Datasource settings:** Add deprecation notice for database field. [#58647](https://github.com/grafana/grafana/pull/58647), [@zoltanbedi](https://github.com/zoltanbedi)
- **Datasources:** Add support for getDetDefaultQuery in variable editor. [#62026](https://github.com/grafana/grafana/pull/62026), [@idastambuk](https://github.com/idastambuk)
- **Devenv:** OpenLDAP-Mac improvements. [#60229](https://github.com/grafana/grafana/pull/60229), [@mgyongyosi](https://github.com/mgyongyosi)
- **Docs:** Rename Message templates to Notification templates. [#59477](https://github.com/grafana/grafana/pull/59477), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Docs:** Unified Alerting is now compatible with AWS Aurora. [#61001](https://github.com/grafana/grafana/pull/61001), [@alexweav](https://github.com/alexweav)
- **Elastic:** Remove experimental tag from v8.0+. [#61359](https://github.com/grafana/grafana/pull/61359), [@gwdawson](https://github.com/gwdawson)
- **Elasticsearch:** Deprecate raw document mode. [#62236](https://github.com/grafana/grafana/pull/62236), [@gabor](https://github.com/gabor)
- **Elasticsearch:** Support nested aggregation. [#62301](https://github.com/grafana/grafana/pull/62301), [@gabor](https://github.com/gabor)
- **Email:** Use MJML email template. (Enterprise)
- **Email:** Use MJML email templates. [#57751](https://github.com/grafana/grafana/pull/57751), [@gillesdemey](https://github.com/gillesdemey)
- **Explore:** Add feature to open log sample in split view. [#62097](https://github.com/grafana/grafana/pull/62097), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore:** Enable resize of split pane. [#58683](https://github.com/grafana/grafana/pull/58683), [@gelicia](https://github.com/gelicia)
- **Explore:** Implement logs sample in Explore. [#61864](https://github.com/grafana/grafana/pull/61864), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore:** Keyboard shortcut to go to explore. [#61837](https://github.com/grafana/grafana/pull/61837), [@torkelo](https://github.com/torkelo)
- **Explore:** Notify when compact URL is used. [#58684](https://github.com/grafana/grafana/pull/58684), [@gelicia](https://github.com/gelicia)
- **Explore:** Use Datasource Onboarding page when visiting without any datasource set up. [#60399](https://github.com/grafana/grafana/pull/60399), [@Elfo404](https://github.com/Elfo404)
- **FileDropzone:** Format the file size limit in the error message when the max file size is exceeded (1000 => 1 kB). [#62290](https://github.com/grafana/grafana/pull/62290), [@oscarkilhed](https://github.com/oscarkilhed)
- **Flame graph:** Search with uFuzzy. [#61748](https://github.com/grafana/grafana/pull/61748), [@joey-grafana](https://github.com/joey-grafana)
- **GRPC Server:** Add query service. [#55781](https://github.com/grafana/grafana/pull/55781), [@toddtreece](https://github.com/toddtreece)
- **Geomap panel:** Generate types. [#61636](https://github.com/grafana/grafana/pull/61636), [@Clarity-89](https://github.com/Clarity-89)
- **Geomap:** Add color gradients to route layer. [#59062](https://github.com/grafana/grafana/pull/59062), [@drew08t](https://github.com/drew08t)
- **Glue:** Validate target query in correlations page. [#57245](https://github.com/grafana/grafana/pull/57245), [@L-M-K-B](https://github.com/L-M-K-B)
- **Heatmap:** Remove legacy angular based implementation. [#59249](https://github.com/grafana/grafana/pull/59249), [@ryantxu](https://github.com/ryantxu)
- **InfluxDB:** Send retention policy with InfluxQL queries if its been specified. [#62149](https://github.com/grafana/grafana/pull/62149), [@brettbuddin](https://github.com/brettbuddin)
- **Influxdb:** Remove backend migration feature toggle. [#61308](https://github.com/grafana/grafana/pull/61308), [@itsmylife](https://github.com/itsmylife)
- **Internationalization:** Translate page headers and Search dashboard actions. [#60727](https://github.com/grafana/grafana/pull/60727), [@TaitChan](https://github.com/TaitChan)
- **LDAP:** Make LDAP attribute mapping case-insensitive. [#58992](https://github.com/grafana/grafana/pull/58992), [@markkrj](https://github.com/markkrj)
- **LoginAttempts:** Reset attempts on successfull password reset. [#59215](https://github.com/grafana/grafana/pull/59215), [@kalleep](https://github.com/kalleep)
- **Logs Panel:** Add support for keyboard interactions with log lines. [#60561](https://github.com/grafana/grafana/pull/60561), [@matyax](https://github.com/matyax)
- **Logs:** Add possibility to download logs in JSON format. [#61394](https://github.com/grafana/grafana/pull/61394), [@svennergr](https://github.com/svennergr)
- **Logs:** Make `no logs found` text more visible in Explore. [#61651](https://github.com/grafana/grafana/pull/61651), [@svennergr](https://github.com/svennergr)
- **Logs:** Unify detected fields and labels in Log Details. [#60448](https://github.com/grafana/grafana/pull/60448), [@svennergr](https://github.com/svennergr)
- **Loki Autocomplete:** Suggest only possible labels for unwrap. [#61411](https://github.com/grafana/grafana/pull/61411), [@matyax](https://github.com/matyax)
- **Loki Editor Autocomplete:** Suggest unique history items. [#60262](https://github.com/grafana/grafana/pull/60262), [@matyax](https://github.com/matyax)
- **Loki Query Editor:** Add support to display query parsing errors to users. [#59427](https://github.com/grafana/grafana/pull/59427), [@matyax](https://github.com/matyax)
- **Loki Query Editor:** Autocompletion and suggestions improvements (unwrap, parser, extracted labels). [#59103](https://github.com/grafana/grafana/pull/59103), [@matyax](https://github.com/matyax)
- **Loki Query Editor:** Update history items with successive queries. [#60327](https://github.com/grafana/grafana/pull/60327), [@matyax](https://github.com/matyax)
- **Loki:** Add format explanation to regex operations. [#60518](https://github.com/grafana/grafana/pull/60518), [@gwdawson](https://github.com/gwdawson)
- **Loki:** Add hints for query filters. [#60293](https://github.com/grafana/grafana/pull/60293), [@gwdawson](https://github.com/gwdawson)
- **Loki:** Add improvements to loki label browser. [#59387](https://github.com/grafana/grafana/pull/59387), [@gwdawson](https://github.com/gwdawson)
- **Loki:** Change format of query builder hints. [#60228](https://github.com/grafana/grafana/pull/60228), [@gwdawson](https://github.com/gwdawson)
- **Loki:** Make label browser accessible in query builder. [#58525](https://github.com/grafana/grafana/pull/58525), [@gwdawson](https://github.com/gwdawson)
- **Loki:** Push support for multi-tenancy mode. [#60866](https://github.com/grafana/grafana/pull/60866), [@joanlopez](https://github.com/joanlopez)
- **Loki:** Remove raw query toggle. [#59125](https://github.com/grafana/grafana/pull/59125), [@gwdawson](https://github.com/gwdawson)
- **Loki:** Rename "explain" toggle to "explain query". [#61150](https://github.com/grafana/grafana/pull/61150), [@gwdawson](https://github.com/gwdawson)
- **Loki:** Set custom width for modals in the loki query editor. [#59714](https://github.com/grafana/grafana/pull/59714), [@gwdawson](https://github.com/gwdawson)
- **Loki:** Show configured log line limit. [#61291](https://github.com/grafana/grafana/pull/61291), [@gwdawson](https://github.com/gwdawson)
- **Loki:** Show query size approximation. [#62109](https://github.com/grafana/grafana/pull/62109), [@gwdawson](https://github.com/gwdawson)
- **Middleware:** Add Custom Headers to HTTP responses. [#59018](https://github.com/grafana/grafana/pull/59018), [@jcalisto](https://github.com/jcalisto)
- **Navigation:** Open command palette from search box. [#61667](https://github.com/grafana/grafana/pull/61667), [@joshhunt](https://github.com/joshhunt)
- **NodeGraph:** Allow usage with single dataframe. [#58448](https://github.com/grafana/grafana/pull/58448), [@aocenas](https://github.com/aocenas)
- **OAuth:** Support pagination for GitHub orgs. [#58648](https://github.com/grafana/grafana/pull/58648), [@sdague](https://github.com/sdague)
- **PanelChrome:** Allow panel to be dragged if set as draggable from the outside. [#61698](https://github.com/grafana/grafana/pull/61698), [@axelavargas](https://github.com/axelavargas)
- **PanelChrome:** Refactor and refine items next to title. [#60514](https://github.com/grafana/grafana/pull/60514), [@axelavargas](https://github.com/axelavargas)
- **PanelRenderer:** Interpolate variables in applyFieldOverrides. [#59844](https://github.com/grafana/grafana/pull/59844), [@connorlindsey](https://github.com/connorlindsey)
- **Performance:** Preallocate slices. [#61580](https://github.com/grafana/grafana/pull/61580), [@peakle](https://github.com/peakle)
- **Phlare:** Reset flame graph after query is run. [#59609](https://github.com/grafana/grafana/pull/59609), [@joey-grafana](https://github.com/joey-grafana)
- **Phlare:** Transition from LogQL/PromQL to Phlare should keep the query. [#60217](https://github.com/grafana/grafana/pull/60217), [@joey-grafana](https://github.com/joey-grafana)
- **Plugins:** Add file permission error check when attempting to verify plugin signature. [#61860](https://github.com/grafana/grafana/pull/61860), [@wbrowne](https://github.com/wbrowne)
- **Plugins:** Automatically forward plugin request HTTP headers in outgoing HTTP requests. [#60417](https://github.com/grafana/grafana/pull/60417), [@marefr](https://github.com/marefr)
- **Plugins:** Forward user header (X-Grafana-User) in backend plugin requests. [#58646](https://github.com/grafana/grafana/pull/58646), [@marefr](https://github.com/marefr)
- **Plugins:** Pass through dashboard/contextual HTTP headers to plugins/datasources. [#60301](https://github.com/grafana/grafana/pull/60301), [@GiedriusS](https://github.com/GiedriusS)
- **Plugins:** Refactor forward of cookies, OAuth token and header modifications by introducing client middlewares. [#58132](https://github.com/grafana/grafana/pull/58132), [@marefr](https://github.com/marefr)
- **Plugins:** Remove connection/hop-by-hop request/response headers for call resource. [#60077](https://github.com/grafana/grafana/pull/60077), [@marefr](https://github.com/marefr)
- **Plugins:** Unsigned chromium file should not invalidate signature for Renderer plugin. [#59104](https://github.com/grafana/grafana/pull/59104), [@wbrowne](https://github.com/wbrowne)
- **Preferences:** Add pagination to org configuration page. [#60896](https://github.com/grafana/grafana/pull/60896), [@alexanderzobnin](https://github.com/alexanderzobnin)
- **Preferences:** Add theme preference to match system theme. [#61986](https://github.com/grafana/grafana/pull/61986), [@joshhunt](https://github.com/joshhunt)
- **Prometheus:** Kickstart your query, formerly query patterns. [#60718](https://github.com/grafana/grafana/pull/60718), [@bohandley](https://github.com/bohandley)
- **Prometheus:** New instant query results view in Explore. [#60479](https://github.com/grafana/grafana/pull/60479), [@gtk-grafana](https://github.com/gtk-grafana)
- **Prometheus:** Remove buffered client and feature toggle related to it. [#59898](https://github.com/grafana/grafana/pull/59898), [@itsmylife](https://github.com/itsmylife)
- **Public Dashboards:** Time range for public dashboard in NavToolbar. [#60689](https://github.com/grafana/grafana/pull/60689), [@juanicabanas](https://github.com/juanicabanas)
- **PublicDashboards:** A unique page for public dashboards. [#60744](https://github.com/grafana/grafana/pull/60744), [@juanicabanas](https://github.com/juanicabanas)
- **PublicDashboards:** Add react-hook-form for Public Dashboard modal. [#60249](https://github.com/grafana/grafana/pull/60249), [@juanicabanas](https://github.com/juanicabanas)
- **PublicDashboards:** Add share column to public dashboards table. [#61102](https://github.com/grafana/grafana/pull/61102), [@owensmallwood](https://github.com/owensmallwood)
- **PublicDashboards:** Adds middleware for email sharing. (Enterprise)
- **PublicDashboards:** Adds tables and models for email sharing. (Enterprise)
- **PublicDashboards:** Checkboxes list refactor. [#61947](https://github.com/grafana/grafana/pull/61947), [@juanicabanas](https://github.com/juanicabanas)
- **PublicDashboards:** Create API for sharing by email. (Enterprise)
- **PublicDashboards:** Enterprise service skeleton for public dashboards with feature flag. (Enterprise)
- **PublicDashboards:** Modal warns when using unsupported datasources. [#58926](https://github.com/grafana/grafana/pull/58926), [@owensmallwood](https://github.com/owensmallwood)
- **PublicDashboards:** Page to request access to protected pubdash. (Enterprise)
- **PublicDashboards:** Remove unnecessary css style in Audit Table. [#60546](https://github.com/grafana/grafana/pull/60546), [@juanicabanas](https://github.com/juanicabanas)
- **PublicDashboards:** Revert Time range setting added. [#60698](https://github.com/grafana/grafana/pull/60698), [@juanicabanas](https://github.com/juanicabanas)
- **PublicDashboards:** Time range conditionally shown. [#60425](https://github.com/grafana/grafana/pull/60425), [@juanicabanas](https://github.com/juanicabanas)
- **PublicDashboards:** Time range setting added. [#60487](https://github.com/grafana/grafana/pull/60487), [@juanicabanas](https://github.com/juanicabanas)
- **PublicDashboards:** Time range settings. [#61585](https://github.com/grafana/grafana/pull/61585), [@juanicabanas](https://github.com/juanicabanas)
- **PublicDashboards:** Time range switch added. [#60257](https://github.com/grafana/grafana/pull/60257), [@juanicabanas](https://github.com/juanicabanas)
- **PublicDashboards:** Time range wording changed. [#60473](https://github.com/grafana/grafana/pull/60473), [@juanicabanas](https://github.com/juanicabanas)
- **RBAC:** Add an endpoint to search through assignments. (Enterprise)
- **RBAC:** Add config option to reset basic roles on start up. [#59598](https://github.com/grafana/grafana/pull/59598), [@gamab](https://github.com/gamab)
- **RBAC:** Add config option to reset basic roles on start up. (Enterprise)
- **RBAC:** Add permission to get usage report preview. [#61570](https://github.com/grafana/grafana/pull/61570), [@alexanderzobnin](https://github.com/alexanderzobnin)
- **RBAC:** Permission check performance improvements for the new search. [#60729](https://github.com/grafana/grafana/pull/60729), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **RBAC:** Register plugin permissions's action and its accepted scopes. (Enterprise)
- **RBAC:** Runtime plugin role registration and update. (Enterprise)
- **Report Settings:** Add UI to upload logo files. (Enterprise)
- **Reporting:** Allow to upload report branding images. (Enterprise)
- **RolePicker:** Align groupHeader to the list items horizontally. [#61060](https://github.com/grafana/grafana/pull/61060), [@mgyongyosi](https://github.com/mgyongyosi)
- **SAML:** Support auto login. [#61685](https://github.com/grafana/grafana/pull/61685), [@alexanderzobnin](https://github.com/alexanderzobnin)
- **SMTP:** Update SMTP TemplatesPatterns to do an 'or' filter instead of 'and'. [#61421](https://github.com/grafana/grafana/pull/61421), [@mmandrus](https://github.com/mmandrus)
- **SQL Datasources:** Move database setting to jsonData. [#58649](https://github.com/grafana/grafana/pull/58649), [@zoltanbedi](https://github.com/zoltanbedi)
- **SQL Datasources:** Use health check for config test. [#59867](https://github.com/grafana/grafana/pull/59867), [@zoltanbedi](https://github.com/zoltanbedi)
- **SQL:** Return no data response when no rows returned. [#59121](https://github.com/grafana/grafana/pull/59121), [@zoltanbedi](https://github.com/zoltanbedi)
- **Search:** Remember sorting preference between visits. [#62248](https://github.com/grafana/grafana/pull/62248), [@joshhunt](https://github.com/joshhunt)
- **Segment:** Individual segments are now keyboard accessible. [#60555](https://github.com/grafana/grafana/pull/60555), [@ashharrison90](https://github.com/ashharrison90)
- **Server:** Switch from separate server & cli to a unified grafana binary. [#58286](https://github.com/grafana/grafana/pull/58286), [@DanCech](https://github.com/DanCech)
- **SharePDF:** Add zoom select. (Enterprise)
- **Slugify:** Replace gosimple/slug with a simple function. [#59517](https://github.com/grafana/grafana/pull/59517), [@ryantxu](https://github.com/ryantxu)
- **Snapshots:** Add snapshot enable config. [#61587](https://github.com/grafana/grafana/pull/61587), [@leandro-deveikis](https://github.com/leandro-deveikis)
- **Table Panel:** Refactor Cell Options to Allow for Options per Cell Type. [#59363](https://github.com/grafana/grafana/pull/59363), [@codeincarnate](https://github.com/codeincarnate)
- **Table panel:** Use link elements instead of div elements with on click events to aid with keyboard accessibility. [#59393](https://github.com/grafana/grafana/pull/59393), [@oscarkilhed](https://github.com/oscarkilhed)
- **TablePanel:** Improve and align table styles with the rest of Grafana. [#60365](https://github.com/grafana/grafana/pull/60365), [@torkelo](https://github.com/torkelo)
- **Teams:** Support paginating and filtering more then 1000 teams. [#58761](https://github.com/grafana/grafana/pull/58761), [@kalleep](https://github.com/kalleep)
- **Teams:** Use generated TS types. [#60618](https://github.com/grafana/grafana/pull/60618), [@Clarity-89](https://github.com/Clarity-89)
- **Tempo:** Trace to logs custom query with interpolation. [#61702](https://github.com/grafana/grafana/pull/61702), [@aocenas](https://github.com/aocenas)
- **Tempo:** Update column width for Loki search. [#61924](https://github.com/grafana/grafana/pull/61924), [@joey-grafana](https://github.com/joey-grafana)
- **Tempo:** Update docs and default Tempo metrics query. [#62185](https://github.com/grafana/grafana/pull/62185), [@joey-grafana](https://github.com/joey-grafana)
- **TestDatasource:** Add scenario for generating trace data. [#59299](https://github.com/grafana/grafana/pull/59299), [@aocenas](https://github.com/aocenas)
- **TextPanel:** Refactor to functional component. [#60885](https://github.com/grafana/grafana/pull/60885), [@ryantxu](https://github.com/ryantxu)
- **Theme:** Use `Inter` font by default. [#59544](https://github.com/grafana/grafana/pull/59544), [@ashharrison90](https://github.com/ashharrison90)
- **Trace View:** Disallow a span colour that is the same or looks similar to previous colour. [#58146](https://github.com/grafana/grafana/pull/58146), [@joey-grafana](https://github.com/joey-grafana)
- **Tracing:** Add keyboard accessibility to SpanDetailRow. [#59412](https://github.com/grafana/grafana/pull/59412), [@joey-grafana](https://github.com/joey-grafana)
- **Transformations:** Add context parameter to transformDataFrame and operators. [#60694](https://github.com/grafana/grafana/pull/60694), [@torkelo](https://github.com/torkelo)
- **Transformations:** Extract JSON Paths. [#59400](https://github.com/grafana/grafana/pull/59400), [@NiklasCi](https://github.com/NiklasCi)
- **Transformations:** Grouping to matrix empty value option. [#55591](https://github.com/grafana/grafana/pull/55591), [@hugo082](https://github.com/hugo082)
- **UsageInsights:** Record events for Explore queries. [#59931](https://github.com/grafana/grafana/pull/59931), [@daniellee](https://github.com/daniellee)
- **Variables:** Support for colons in time variables custom format. [#61404](https://github.com/grafana/grafana/pull/61404), [@yesoreyeram](https://github.com/yesoreyeram)

### Bug fixes

- **Alerting:** Fix ConditionsCmd No Data for "has no value". [#58634](https://github.com/grafana/grafana/pull/58634), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Fix evaluation timeout. [#61303](https://github.com/grafana/grafana/pull/61303), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Redo refactoring from reverted fix in #56812. [#61051](https://github.com/grafana/grafana/pull/61051), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Set Dashboard and Panel IDs on rule group replacement. [#60374](https://github.com/grafana/grafana/pull/60374), [@alexmobo](https://github.com/alexmobo)
- **Alerting:** Store alertmanager configuration history in a separate table in the database. [#60197](https://github.com/grafana/grafana/pull/60197), [@alexweav](https://github.com/alexweav)
- **Azure Monitor:** Fix health check for empty default subscription. [#60569](https://github.com/grafana/grafana/pull/60569), [@andresmgot](https://github.com/andresmgot)
- **Barchart:** Fix erroneous tooltip value. [#61455](https://github.com/grafana/grafana/pull/61455), [@mdvictor](https://github.com/mdvictor)
- **Candlestick:** Fix showing hidden legend values. [#60971](https://github.com/grafana/grafana/pull/60971), [@zoltanbedi](https://github.com/zoltanbedi)
- **CloudWatch:** Fix logs insights deeplink. [#59906](https://github.com/grafana/grafana/pull/59906), [@fridgepoet](https://github.com/fridgepoet)
- **Cloudmonitor:** Refactor query builder. [#61410](https://github.com/grafana/grafana/pull/61410), [@aangelisc](https://github.com/aangelisc)
- **Command Palette:** Links now work when grafana is served under a subpath. [#60033](https://github.com/grafana/grafana/pull/60033), [@ashharrison90](https://github.com/ashharrison90)
- **CommandPalette:** Fix long dashboard names freezing the browser. [#61278](https://github.com/grafana/grafana/pull/61278), [@joshhunt](https://github.com/joshhunt)
- **DataFrame:** Add explicit histogram frame type. [#61195](https://github.com/grafana/grafana/pull/61195), [@leeoniya](https://github.com/leeoniya)
- **Dropdown:** Make escape close a dropdown. [#62098](https://github.com/grafana/grafana/pull/62098), [@ashharrison90](https://github.com/ashharrison90)
- **Explore:** Fix a11y issue with show all series button in Graph. [#58943](https://github.com/grafana/grafana/pull/58943), [@Elfo404](https://github.com/Elfo404)
- **Explore:** Fixes explore page height and margin issues. [#59865](https://github.com/grafana/grafana/pull/59865), [@torkelo](https://github.com/torkelo)
- **Explore:** Re-initialize graph when number of series to show changes. [#60499](https://github.com/grafana/grafana/pull/60499), [@Elfo404](https://github.com/Elfo404)
- **Fix:** Unlocking the UI for AuthProxy users. [#59507](https://github.com/grafana/grafana/pull/59507), [@gamab](https://github.com/gamab)
- **GrafanaUI:** Checkbox description fix. [#61929](https://github.com/grafana/grafana/pull/61929), [@juanicabanas](https://github.com/juanicabanas)
- **LDAP:** Disable user in case it has been removed from LDAP directory. [#60231](https://github.com/grafana/grafana/pull/60231), [@mgyongyosi](https://github.com/mgyongyosi)
- **LibraryPanels:** Fix issue where viewer with folder edit permissions could not update library panel. [#58420](https://github.com/grafana/grafana/pull/58420), [@kaydelaney](https://github.com/kaydelaney)
- **Loki Query Builder:** Fix bug parsing range params. [#61678](https://github.com/grafana/grafana/pull/61678), [@matyax](https://github.com/matyax)
- **MultiSelect:** Fix `actionMeta` not available in `onChange` callback. [#62339](https://github.com/grafana/grafana/pull/62339), [@svennergr](https://github.com/svennergr)
- **Navigation:** Fix finding the active nav item for plugins. [#62123](https://github.com/grafana/grafana/pull/62123), [@leventebalogh](https://github.com/leventebalogh)
- **PanelChrome:** Allow hovering on description when status error is visible. [#61757](https://github.com/grafana/grafana/pull/61757), [@ivanortegaalba](https://github.com/ivanortegaalba)
- **PanelEditor:** Fixes issue where panel edit would show the panel plugin options of the previous edit panel. [#59861](https://github.com/grafana/grafana/pull/59861), [@torkelo](https://github.com/torkelo)
- **PublicDashboards:** Footer alignment fix for Firefox browser. [#62108](https://github.com/grafana/grafana/pull/62108), [@juanicabanas](https://github.com/juanicabanas)
- **PublicDashboards:** Footer position fix. [#61954](https://github.com/grafana/grafana/pull/61954), [@juanicabanas](https://github.com/juanicabanas)
- **RBAC:** Fix DeleteUserPermissions not being called on Upsert org sync. [#60531](https://github.com/grafana/grafana/pull/60531), [@Jguer](https://github.com/Jguer)
- **RBAC:** Handle edge case where there is duplicated acl entries for a role on a single dashboard. [#58079](https://github.com/grafana/grafana/pull/58079), [@kalleep](https://github.com/kalleep)
- **Resource Query Cache:** Do not store 207 status codes. (Enterprise)
- **SAML:** Do not register SAML support bundle collector when SAML is disabled. (Enterprise)
- **SSE:** Fix math expression to support NoData results. [#61721](https://github.com/grafana/grafana/pull/61721), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Security:** Fix XSS in runbook URL. [#59540](https://github.com/grafana/grafana/pull/59540), [@dsotirakis](https://github.com/dsotirakis)
- **TimeSeries:** Better y-axis ticks for IEC units. [#59984](https://github.com/grafana/grafana/pull/59984), [@leeoniya](https://github.com/leeoniya)
- **TimeSeries:** Fix rendering when zooming to time ranges between datapoints. [#59444](https://github.com/grafana/grafana/pull/59444), [@leeoniya](https://github.com/leeoniya)
- **TimeSeries:** Fix y-axis Yes/No and On/Off boolean units. [#61207](https://github.com/grafana/grafana/pull/61207), [@leeoniya](https://github.com/leeoniya)
- **Traces:** Fix for multiple $\_\_tags in trace to metrics. [#59641](https://github.com/grafana/grafana/pull/59641), [@joey-grafana](https://github.com/joey-grafana)
- **Variables:** Allow user to filter values in dropdown using white space. [#60622](https://github.com/grafana/grafana/pull/60622), [@yusuf-multhan](https://github.com/yusuf-multhan)

### Breaking changes

Removes the non-functional feature toggle `influxdbBackendMigration`. InfluxDB is working %100 with server access mode. You can keep using your dashboards, and data sources as you have been using. This won't affect them. If you are upgrading from older versions of Grafana please be sure to check your dashboard config and check for warnings. Issue [#61308](https://github.com/grafana/grafana/issues/61308)

Removes support for "detected fields" in the details of a log line, however all supported interactions (filter, statistics, visibility) are now supported for all fields. If you are using Loki you can get those fields back by using a parser operation like `logfmt` or `json`.
Issue [#60448](https://github.com/grafana/grafana/issues/60448)

### Deprecations

In the elasticsearch data source, the "Raw document" display mode is deprecated. We recommend using the "Raw Data" mode instead. Issue [#62236](https://github.com/grafana/grafana/issues/62236)

Sentry frontend logging provider will be removed with next major version. Issue [#60165](https://github.com/grafana/grafana/issues/60165)

### Plugin development fixes & changes

- **FileDropzone:** Display max file size. [#62334](https://github.com/grafana/grafana/pull/62334), [@oscarkilhed](https://github.com/oscarkilhed)
- **Chore:** Bump d3-color to 3.1.0. [#61609](https://github.com/grafana/grafana/pull/61609), [@jackw](https://github.com/jackw)
- **UI/Alert:** Infer the `role` property based on the `severity`. [#61242](https://github.com/grafana/grafana/pull/61242), [@leventebalogh](https://github.com/leventebalogh)
- **PanelChrome:** Menu is wrapped in a render prop for full outside control. [#60537](https://github.com/grafana/grafana/pull/60537), [@polibb](https://github.com/polibb)
- **Toolkit:** Deprecate all plugin related commands. [#60290](https://github.com/grafana/grafana/pull/60290), [@academo](https://github.com/academo)
- **Grafana UI:** Add experimental InteractiveTable component. [#58223](https://github.com/grafana/grafana/pull/58223), [@Elfo404](https://github.com/Elfo404)

<!-- 9.3.11 START -->

# 9.3.11 (2023-03-22)

### Bug fixes

- **Alerting:** Update scheduler to receive rule updates only from database. [#64662](https://github.com/grafana/grafana/pull/64662), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Chore:** Update Grafana to use Alertmanager v0.25.1-0.20230308154952-78fedf89728b. [#64784](https://github.com/grafana/grafana/pull/64784), [@yuri-tceretian](https://github.com/yuri-tceretian)

<!-- 9.3.11 END -->

<!-- 9.3.8 START -->

# 9.3.8 (2023-02-28)

<!-- 9.3.8 END -->

<!-- 9.3.7 START -->

# 9.3.7 (2023-02-28)

### Bug fixes

- **Alerting:** Validate that tags are 100 characters or less. [#62335](https://github.com/grafana/grafana/pull/62335), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Expressions:** Fixes the issue showing expressions editor. [#62510](https://github.com/grafana/grafana/pull/62510), [@itsmylife](https://github.com/itsmylife)
- **Logs:** Fix stats not being updated when log results change. [#62317](https://github.com/grafana/grafana/pull/62317), [@svennergr](https://github.com/svennergr)
- **Plugins:** Fix circular reference in customOptions leading to MarshalJSON errors. [#62328](https://github.com/grafana/grafana/pull/62328), [@yoziru](https://github.com/yoziru)
- **Time Series Panel:** Fix legend text selection in Firefox. [#60809](https://github.com/grafana/grafana/pull/60809), [@codeincarnate](https://github.com/codeincarnate)

<!-- 9.3.7 END -->
<!-- 9.4.0-beta1 END -->
<!-- 9.3.6 START -->

# 9.3.6 (2023-01-26)

### Bug fixes

- **QueryEditorRow:** Fixes issue loading query editor when data source variable selected. [#61927](https://github.com/grafana/grafana/pull/61927), [@torkelo](https://github.com/torkelo)

<!-- 9.3.6 END -->
<!-- 9.3.4 START -->

# 9.3.4 (2023-01-25)

### Features and enhancements

- **Prometheus:** Add default editor configuration. [#61510](https://github.com/grafana/grafana/pull/61510), [@itsmylife](https://github.com/itsmylife)
- **TextPanel:** Refactor to functional component (#60885). [#61937](https://github.com/grafana/grafana/pull/61937), [@ryantxu](https://github.com/ryantxu)

### Bug fixes

- **Alerting:** Fix webhook to use correct key for decrypting token. [#61717](https://github.com/grafana/grafana/pull/61717), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Set error annotation on EvaluationError regardless of underlying error type. [#61506](https://github.com/grafana/grafana/pull/61506), [@alexweav](https://github.com/alexweav)
- **Datasources:** Fix Proxy by UID Failing for UIDs with a Hyphen. [#61723](https://github.com/grafana/grafana/pull/61723), [@csmarchbanks](https://github.com/csmarchbanks)
- **Elasticsearch:** Fix creating of span link with no tags. [#61753](https://github.com/grafana/grafana/pull/61753), [@ivanahuckova](https://github.com/ivanahuckova)
- **Elasticsearch:** Fix failing requests when using SigV4. [#61923](https://github.com/grafana/grafana/pull/61923), [@svennergr](https://github.com/svennergr)
- **Elasticsearch:** Fix toggle-settings are not shown correctly. [#61751](https://github.com/grafana/grafana/pull/61751), [@svennergr](https://github.com/svennergr)
- **Explore:** Be sure time range key bindings are mounted after clear. [#61892](https://github.com/grafana/grafana/pull/61892), [@gelicia](https://github.com/gelicia)
- **Explore:** Unsync time ranges when a pane is closed. [#61369](https://github.com/grafana/grafana/pull/61369), [@Elfo404](https://github.com/Elfo404)
- **Logs:** Lines with long words do not break properly. [#61707](https://github.com/grafana/grafana/pull/61707), [@svennergr](https://github.com/svennergr)
- **Loki:** Fix misaligned derived fields settings. [#61475](https://github.com/grafana/grafana/pull/61475), [@svennergr](https://github.com/svennergr)
- **Query Builder:** Fix max width of input component to prevent overflows. [#61798](https://github.com/grafana/grafana/pull/61798), [@matyax](https://github.com/matyax)
- **Search:** Auto focus input elements. [#61443](https://github.com/grafana/grafana/pull/61443), [@ryantxu](https://github.com/ryantxu)
- **Search:** Fix empty folder message showing when by starred dashboards. [#61610](https://github.com/grafana/grafana/pull/61610), [@eledobleefe](https://github.com/eledobleefe)
- **Table Panel:** Fix image of image cell overflowing table cell and cells ignoring text alignment setting when a data link is added. [#59392](https://github.com/grafana/grafana/pull/59392), [@oscarkilhed](https://github.com/oscarkilhed)

<!-- 9.3.4 END -->
<!-- 9.3.2 START -->

# 9.3.2 (2023-12-13)

### Features and enhancements

- **Graphite:** Process multiple queries to Graphite plugin. [#59608](https://github.com/grafana/grafana/pull/59608), [@mmandrus](https://github.com/mmandrus)

### Bug fixes

- **API:** Fix delete user failure due to quota not enabled. [#59875](https://github.com/grafana/grafana/pull/59875), [@papagian](https://github.com/papagian)
- **Accessibility:** Improved keyboard accessibility in BarGauge. [#59382](https://github.com/grafana/grafana/pull/59382), [@lpskdl](https://github.com/lpskdl)
- **Accessibility:** Improved keyboard accessibility in BigValue. [#59830](https://github.com/grafana/grafana/pull/59830), [@lpskdl](https://github.com/lpskdl)
- **Alerting:** Use the QuotaTargetSrv instead of the QuotaTarget in quota check. [#60026](https://github.com/grafana/grafana/pull/60026), [@joeblubaugh](https://github.com/joeblubaugh)
- **AzureMonitor:** Automate location retrieval. [#59602](https://github.com/grafana/grafana/pull/59602), [@aangelisc](https://github.com/aangelisc)
- **AzureMonitor:** Fix bad request when setting dimensions. [#59700](https://github.com/grafana/grafana/pull/59700), [@andresmgot](https://github.com/andresmgot)
- **BarChart:** Fix value mappings. [#60066](https://github.com/grafana/grafana/pull/60066), [@leeoniya](https://github.com/leeoniya)
- **Build:** Streamline and sync dockerfiles. [#58101](https://github.com/grafana/grafana/pull/58101), [@DanCech](https://github.com/DanCech)
- **Build:** Unified dockerfile for all builds. [#59173](https://github.com/grafana/grafana/pull/59173), [@DanCech](https://github.com/DanCech)
- **CloudWatch:** Fix - make sure dimensions are propagated to alert query editor. [#58281](https://github.com/grafana/grafana/pull/58281), [@conorevans](https://github.com/conorevans)
- **Cloudwatch:** Fix deeplink with default region (#60260). [#60274](https://github.com/grafana/grafana/pull/60274), [@iwysiu](https://github.com/iwysiu)
- **Command Palette:** Fix not being able to type if triggered whilst another modal is open. [#59728](https://github.com/grafana/grafana/pull/59728), [@ashharrison90](https://github.com/ashharrison90)
- **Command Palette:** Maintain page state when changing theme. [#59787](https://github.com/grafana/grafana/pull/59787), [@ashharrison90](https://github.com/ashharrison90)
- **Dashboards:** Fix 'Make Editable' button not working in Dashboard Settings. [#60306](https://github.com/grafana/grafana/pull/60306), [@joshhunt](https://github.com/joshhunt)
- **Dashboards:** Show error when data source is missing. [#60099](https://github.com/grafana/grafana/pull/60099), [@joshhunt](https://github.com/joshhunt)
- **Datasource:** Fix - apply default query also to queries in new panels. [#59625](https://github.com/grafana/grafana/pull/59625), [@sunker](https://github.com/sunker)
- **Dropdown:** Menu now closes correctly when selecting options on touch devices. [#60181](https://github.com/grafana/grafana/pull/60181), [@ashharrison90](https://github.com/ashharrison90)
- **Influx:** Query segment menus now position correctly near the bottom of the screen. [#60087](https://github.com/grafana/grafana/pull/60087), [@ashharrison90](https://github.com/ashharrison90)
- **Login:** Fix failure to login a new user via an external provider if quota are enabled. [#60015](https://github.com/grafana/grafana/pull/60015), [@papagian](https://github.com/papagian)
- **Loki/Prometheus:** Fix wrong queries executed in split view. [#60172](https://github.com/grafana/grafana/pull/60172), [@svennergr](https://github.com/svennergr)
- **Loki:** Fix wrongly escaped label values when using LabelFilter. [#59812](https://github.com/grafana/grafana/pull/59812), [@svennergr](https://github.com/svennergr)
- **Navigation:** Prevent app crash when importing a dashboard with a uid of `home`. [#59874](https://github.com/grafana/grafana/pull/59874), [@ashharrison90](https://github.com/ashharrison90)
- **Panel Edit:** Fix data links edit icons being off screen when provided title is too long. [#59829](https://github.com/grafana/grafana/pull/59829), [@dprokop](https://github.com/dprokop)
- **Prometheus:** Fix exemplar fill color to match series color in time series. [#59908](https://github.com/grafana/grafana/pull/59908), [@gtk-grafana](https://github.com/gtk-grafana)
- **Prometheus:** Fix exemplars not respecting corresponding series display status. [#59743](https://github.com/grafana/grafana/pull/59743), [@gtk-grafana](https://github.com/gtk-grafana)
- **StateTimeline:** Fix negative infinity legend/tooltip from thresholds. [#60279](https://github.com/grafana/grafana/pull/60279), [@leeoniya](https://github.com/leeoniya)
- **Table:** Fixes row border style not showing and colored rows blending together. [#59660](https://github.com/grafana/grafana/pull/59660), [@torkelo](https://github.com/torkelo)
- **Tempo:** Fix TraceQL autocomplete issues (#60058). [#60125](https://github.com/grafana/grafana/pull/60125), [@CrypticSignal](https://github.com/CrypticSignal)
- **TimePicker:** Prevent TimePicker overflowing viewport on small screens. [#59808](https://github.com/grafana/grafana/pull/59808), [@ashharrison90](https://github.com/ashharrison90)
- **TimeRangePicker:** Fix recently ranges only not showing all recent ranges. [#59836](https://github.com/grafana/grafana/pull/59836), [@joshhunt](https://github.com/joshhunt)
- **TimeZonePicker:** Scroll menu correctly when using keyboard controls. [#60008](https://github.com/grafana/grafana/pull/60008), [@ashharrison90](https://github.com/ashharrison90)

<!-- 9.3.2 END -->
<!-- 9.3.1 START -->

# 9.3.1 (2022-11-30)

### Features and enhancements

- **Connections:** Update "Your connections/Data sources" page. [#58589](https://github.com/grafana/grafana/pull/58589), [@mikkancso](https://github.com/mikkancso)

### Bug fixes

- **Accessibility:** Increase badge constrast to be WCAG AA compliant. [#59531](https://github.com/grafana/grafana/pull/59531), [@eledobleefe](https://github.com/eledobleefe)

<!-- 9.3.1 END -->
<!-- 9.3.0 START -->

# 9.3.0 (2022-11-30)

### Features and enhancements

- **Alerting:** Enable interpolation for notification policies in file provisioning. [#58956](https://github.com/grafana/grafana/pull/58956), [@JohnnyQQQQ](https://github.com/JohnnyQQQQ)
- **Azure Monitor Logs:** Avoid warning when the response is empty. [#59211](https://github.com/grafana/grafana/pull/59211), [@andresmgot](https://github.com/andresmgot)
- **Azure Monitor:** Add support to customized routes. [#54829](https://github.com/grafana/grafana/pull/54829), [@ms-hujia](https://github.com/ms-hujia)
- **Canvas:** Add icon value mapping. [#59013](https://github.com/grafana/grafana/pull/59013), [@nmarrs](https://github.com/nmarrs)
- **CloudWatch:** Cross-account querying support. [#59362](https://github.com/grafana/grafana/pull/59362), [@sunker](https://github.com/sunker)
- **Docs:** Update `merge-pull-request.md` regarding backport policies. [#59239](https://github.com/grafana/grafana/pull/59239), [@dsotirakis](https://github.com/dsotirakis)
- **GaugePanel:** Setting the neutral-point of a gauge. [#53989](https://github.com/grafana/grafana/pull/53989), [@sfranzis](https://github.com/sfranzis)
- **Geomap:** Improve location editor. [#58017](https://github.com/grafana/grafana/pull/58017), [@drew08t](https://github.com/drew08t)
- **Internationalization:** Enable internationalization by default. [#59204](https://github.com/grafana/grafana/pull/59204), [@joshhunt](https://github.com/joshhunt)
- **Logs:** Add `Download logs` button to log log-browser. [#55163](https://github.com/grafana/grafana/pull/55163), [@svennergr](https://github.com/svennergr)
- **Loki:** Add `gzip` compression to resource calls. [#59059](https://github.com/grafana/grafana/pull/59059), [@svennergr](https://github.com/svennergr)
- **Loki:** Add improvements to loki label browser. [#59387](https://github.com/grafana/grafana/pull/59387), [@gwdawson](https://github.com/gwdawson)
- **Loki:** Make label browser accessible in query builder. [#58525](https://github.com/grafana/grafana/pull/58525), [@gwdawson](https://github.com/gwdawson)
- **Loki:** Remove raw query toggle. [#59125](https://github.com/grafana/grafana/pull/59125), [@gwdawson](https://github.com/gwdawson)
- **Middleware:** Add CSP Report Only support. [#58074](https://github.com/grafana/grafana/pull/58074), [@jcalisto](https://github.com/jcalisto)
- **Navigation:** Prevent viewer role accessing dashboard creation, import and folder creation. [#58842](https://github.com/grafana/grafana/pull/58842), [@lpskdl](https://github.com/lpskdl)
- **OAuth:** Refactor OAuth parameters handling to support obtaining refresh tokens for Google OAuth. [#58782](https://github.com/grafana/grafana/pull/58782), [@mgyongyosi](https://github.com/mgyongyosi)
- **Oauth:** Display friendly error message when role_attribute_strict=true and no valid role found. [#57818](https://github.com/grafana/grafana/pull/57818), [@kalleep](https://github.com/kalleep)
- **Preferences:** Add confirmation modal when saving org preferences. [#59119](https://github.com/grafana/grafana/pull/59119), [@JoaoSilvaGrafana](https://github.com/JoaoSilvaGrafana)
- **PublicDashboards:** Orphaned public dashboard deletion script added. [#57917](https://github.com/grafana/grafana/pull/57917), [@juanicabanas](https://github.com/juanicabanas)
- **Query Editor:** Hide overflow for long query names. [#58840](https://github.com/grafana/grafana/pull/58840), [@zuchka](https://github.com/zuchka)
- **Reports:** Configurable timezone. (Enterprise)
- **Solo Panel:** Configurable timezone. [#59153](https://github.com/grafana/grafana/pull/59153), [@spinillos](https://github.com/spinillos)
- **TablePanel:** Add support for Count calculation per column or per entire dataset. [#58134](https://github.com/grafana/grafana/pull/58134), [@mdvictor](https://github.com/mdvictor)
- **Tempo:** Send the correct start time when making a TraceQL query. [#59128](https://github.com/grafana/grafana/pull/59128), [@CrypticSignal](https://github.com/CrypticSignal)
- **Various Panels:** Remove beta label from Bar Chart, Candlestick, Histogram, State Timeline, & Status History Panels. [#58557](https://github.com/grafana/grafana/pull/58557), [@codeincarnate](https://github.com/codeincarnate)

### Bug fixes

- **Access Control:** Clear user's permission cache after resource creation. [#59307](https://github.com/grafana/grafana/pull/59307), [@grafanabot](https://github.com/grafanabot)
- **Access Control:** Clear user's permission cache after resource creation. [#59101](https://github.com/grafana/grafana/pull/59101), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Accessibility:** Improve keyboard accessibility in `AnnoListPanel`. [#58971](https://github.com/grafana/grafana/pull/58971), [@ashharrison90](https://github.com/ashharrison90)
- **Accessibility:** Improve keyboard accessibility in `Collapse`. [#59022](https://github.com/grafana/grafana/pull/59022), [@ashharrison90](https://github.com/ashharrison90)
- **Accessibility:** Improve keyboard accessibility in `GettingStarted` panel. [#58966](https://github.com/grafana/grafana/pull/58966), [@ashharrison90](https://github.com/ashharrison90)
- **Accessibility:** Improve keyboard accessibility of `FilterPill`. [#58976](https://github.com/grafana/grafana/pull/58976), [@ashharrison90](https://github.com/ashharrison90)
- **Admin:** Fix broken links to image assets in email templates. [#58729](https://github.com/grafana/grafana/pull/58729), [@zuchka](https://github.com/zuchka)
- **Azure Monitor:** Fix namespace selection for storageaccounts. [#56449](https://github.com/grafana/grafana/pull/56449), [@andresmgot](https://github.com/andresmgot)
- **Calcs:** Fix difference percent in legend. [#59243](https://github.com/grafana/grafana/pull/59243), [@zoltanbedi](https://github.com/zoltanbedi)
- **DataLinks:** Improve Data-Links AutoComplete Logic. [#58934](https://github.com/grafana/grafana/pull/58934), [@zuchka](https://github.com/zuchka)
- **Explore:** Fix a11y issue with logs navigation buttons. [#58944](https://github.com/grafana/grafana/pull/58944), [@Elfo404](https://github.com/Elfo404)
- **Heatmap:** Fix blurry text & rendering. [#59260](https://github.com/grafana/grafana/pull/59260), [@leeoniya](https://github.com/leeoniya)
- **Heatmap:** Fix tooltip y range of top and bottom buckets in calculated heatmaps. [#59172](https://github.com/grafana/grafana/pull/59172), [@leeoniya](https://github.com/leeoniya)
- **Logs:** Fix misalignment of LogRows. [#59279](https://github.com/grafana/grafana/pull/59279), [@svennergr](https://github.com/svennergr)
- **Navigation:** Stop clearing search state when opening a result in a new tab. [#58880](https://github.com/grafana/grafana/pull/58880), [@ashharrison90](https://github.com/ashharrison90)
- **OptionsUI:** SliderValueEditor does not get auto focused on slider change. [#59209](https://github.com/grafana/grafana/pull/59209), [@eledobleefe](https://github.com/eledobleefe)
- **PanelEdit:** Fixes bug with not remembering panel options pane collapse/expand state. [#59265](https://github.com/grafana/grafana/pull/59265), [@torkelo](https://github.com/torkelo)
- **Query Caching:** Skip 207 status codes. (Enterprise)
- **Quota:** Fix failure in store due to missing scope parameters. [#58874](https://github.com/grafana/grafana/pull/58874), [@papagian](https://github.com/papagian)
- **Quota:** Fix failure when checking session limits. [#58865](https://github.com/grafana/grafana/pull/58865), [@papagian](https://github.com/papagian)
- **Reports:** Fix time preview. (Enterprise)
- **StateTimeline:** Prevent label text from overflowing state rects. [#59169](https://github.com/grafana/grafana/pull/59169), [@leeoniya](https://github.com/leeoniya)
- **Tempo:** Fix search table duration unit. [#58642](https://github.com/grafana/grafana/pull/58642), [@joey-grafana](https://github.com/joey-grafana)
- **TraceView:** Fix broken rendering when scrolling in Dashboard panel in Firefox. [#56642](https://github.com/grafana/grafana/pull/56642), [@zdg-github](https://github.com/zdg-github)

### Plugin development fixes & changes

- **GrafanaUI:** Add disabled option for menu items. [#58980](https://github.com/grafana/grafana/pull/58980), [@going-confetti](https://github.com/going-confetti)

<!-- 9.3.0 END -->
<!-- 9.3.0-beta1 START -->

# 9.3.0-beta1 (2022-11-15)

### Features and enhancements

- **Alerting:** Add Alertmanager choice warning. [#55311](https://github.com/grafana/grafana/pull/55311), [@konrad147](https://github.com/konrad147)
- **Alerting:** Add support for linking external images securely - Azure Blob (#1). [#56598](https://github.com/grafana/grafana/pull/56598), [@petr-stupka](https://github.com/petr-stupka)
- **Alerting:** Add threshold expression. [#55102](https://github.com/grafana/grafana/pull/55102), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Add traceability headers for alert queries. [#57127](https://github.com/grafana/grafana/pull/57127), [@alexweav](https://github.com/alexweav)
- **Alerting:** Allow none provenance alert rule creation from provisioning API. [#58410](https://github.com/grafana/grafana/pull/58410), [@alexmobo](https://github.com/alexmobo)
- **Alerting:** Cache result of dashboard ID lookups. [#56587](https://github.com/grafana/grafana/pull/56587), [@alexweav](https://github.com/alexweav)
- **Alerting:** Expressions pipeline redesign. [#54601](https://github.com/grafana/grafana/pull/54601), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Fall back to "range" query type for unified alerting when "both" is specified. [#57288](https://github.com/grafana/grafana/pull/57288), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Implement the Webex notifier. [#58480](https://github.com/grafana/grafana/pull/58480), [@gotjosh](https://github.com/gotjosh)
- **Alerting:** Improve group modal with validation on evaluation interval. [#57830](https://github.com/grafana/grafana/pull/57830), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Persist annotations from multidimensional rules in batches. [#56575](https://github.com/grafana/grafana/pull/56575), [@alexweav](https://github.com/alexweav)
- **Alerting:** Query time logging. [#57585](https://github.com/grafana/grafana/pull/57585), [@konrad147](https://github.com/konrad147)
- **Alerting:** Remove the alert manager selection from the data source configuration. [#57369](https://github.com/grafana/grafana/pull/57369), [@VikaCep](https://github.com/VikaCep)
- **Alerting:** Remove the alert manager selection from the data source configuration. [#56460](https://github.com/grafana/grafana/pull/56460), [@gitstart](https://github.com/gitstart)
- **Alerting:** Support values in notification templates. [#56457](https://github.com/grafana/grafana/pull/56457), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Templated URLs for webhook type contact points. [#57296](https://github.com/grafana/grafana/pull/57296), [@santihernandezc](https://github.com/santihernandezc)
- **Annotations:** Disable "Add annotation" button when annotations are disabled. [#57481](https://github.com/grafana/grafana/pull/57481), [@ryantxu](https://github.com/ryantxu)
- **Auth:** Add validation and ingestion of conflict file. [#53014](https://github.com/grafana/grafana/pull/53014), [@eleijonmarck](https://github.com/eleijonmarck)
- **Auth:** Make built-in login configurable. [#46978](https://github.com/grafana/grafana/pull/46978), [@TsotosA](https://github.com/TsotosA)
- **Auth:** Refresh OAuth access_token automatically using the refresh_token. [#56076](https://github.com/grafana/grafana/pull/56076), [@mgyongyosi](https://github.com/mgyongyosi)
- **Auth:** Validate Azure ID token version on login is not v1. [#58088](https://github.com/grafana/grafana/pull/58088), [@Jguer](https://github.com/Jguer)
- **BackendSrv:** Make it possible to pass `options` to `.get|post|patch...` methods. [#51316](https://github.com/grafana/grafana/pull/51316), [@leventebalogh](https://github.com/leventebalogh)
- **Canvas:** Add tabs to inline editor. [#57778](https://github.com/grafana/grafana/pull/57778), [@adela-almasan](https://github.com/adela-almasan)
- **Canvas:** Extend root context menu. [#58097](https://github.com/grafana/grafana/pull/58097), [@adela-almasan](https://github.com/adela-almasan)
- **Chore:** Switch Grafana to using faro libraries. [#58186](https://github.com/grafana/grafana/pull/58186), [@tolzhabayev](https://github.com/tolzhabayev)
- **Chore:** Use strings.ReplaceAll and preallocate containers. [#58483](https://github.com/grafana/grafana/pull/58483), [@sashamelentyev](https://github.com/sashamelentyev)
- **CloudWatch:** Cache resource request responses in the browser. [#57082](https://github.com/grafana/grafana/pull/57082), [@sunker](https://github.com/sunker)
- **Config:** Change jwt config value to be "expect_claims". [#58284](https://github.com/grafana/grafana/pull/58284), [@conorevans](https://github.com/conorevans)
- **Configuration:** Update ssl_mode documentation in sample.ini to match default.ini. [#55138](https://github.com/grafana/grafana/pull/55138), [@alecxvs](https://github.com/alecxvs)
- **Correlations:** Add query editor and target field to settings page. [#55567](https://github.com/grafana/grafana/pull/55567), [@Elfo404](https://github.com/Elfo404)
- **Dashboard:** Record the number of cached queries for usage insights. [#56050](https://github.com/grafana/grafana/pull/56050), [@juanicabanas](https://github.com/juanicabanas)
- **Dashboard:** Record the number of cached queries for usage insights. (Enterprise)
- **Datasources:** Support mixed datasources in a single query. [#56832](https://github.com/grafana/grafana/pull/56832), [@mmandrus](https://github.com/mmandrus)
- **Docs:** Add documentation for Custom Branding on Public Dashboards. [#58090](https://github.com/grafana/grafana/pull/58090), [@leandro-deveikis](https://github.com/leandro-deveikis)
- **Docs:** Add missing documentation for enterprise features. [#56753](https://github.com/grafana/grafana/pull/56753), [@mmandrus](https://github.com/mmandrus)
- **Docs:** Clarify that audit logs are generated only for API requests. [#57521](https://github.com/grafana/grafana/pull/57521), [@spinillos](https://github.com/spinillos)
- **Echo:** Add config option to prevent duplicate page views for GA4. [#57619](https://github.com/grafana/grafana/pull/57619), [@tolzhabayev](https://github.com/tolzhabayev)
- **Elasticsearch:** Add trace to logs functionality. [#58063](https://github.com/grafana/grafana/pull/58063), [@ivanahuckova](https://github.com/ivanahuckova)
- **Elasticsearch:** Reuse http client in the backend. [#55172](https://github.com/grafana/grafana/pull/55172), [@gabor](https://github.com/gabor)
- **Explore:** Add tracesToMetrics span time shift options (#54710). [#55335](https://github.com/grafana/grafana/pull/55335), [@hanjm](https://github.com/hanjm)
- **Explore:** Logs volume histogram: always start Y axis from zero. [#56200](https://github.com/grafana/grafana/pull/56200), [@gabor](https://github.com/gabor)
- **Explore:** Remove explore2Dashboard feature toggle. [#58329](https://github.com/grafana/grafana/pull/58329), [@Elfo404](https://github.com/Elfo404)
- **Explore:** Support fields interpolation in logs panel. [#58426](https://github.com/grafana/grafana/pull/58426), [@ifrost](https://github.com/ifrost)
- **Frontend Routing:** Always render standalone plugin pages using the `<AppRootPage>`. [#57771](https://github.com/grafana/grafana/pull/57771), [@leventebalogh](https://github.com/leventebalogh)
- **GRPC Server:** Add gRPC server service. [#47849](https://github.com/grafana/grafana/pull/47849), [@FZambia](https://github.com/FZambia)
- **Geomap:** Add photo layer. [#57307](https://github.com/grafana/grafana/pull/57307), [@drew08t](https://github.com/drew08t)
- **Geomap:** Upgrade to openlayers 7.x. [#57317](https://github.com/grafana/grafana/pull/57317), [@ryantxu](https://github.com/ryantxu)
- **GrafanaData:** Deprecate logs functions. [#56077](https://github.com/grafana/grafana/pull/56077), [@gabor](https://github.com/gabor)
- **GrafanaData:** Deprecate the LogsParser type. [#56242](https://github.com/grafana/grafana/pull/56242), [@gabor](https://github.com/gabor)
- **Kindsys:** Introduce Kind framework. [#56492](https://github.com/grafana/grafana/pull/56492), [@sdboyer](https://github.com/sdboyer)
- **LDAP:** Add `skip_org_role_sync` configuration option. [#56792](https://github.com/grafana/grafana/pull/56792), [@grafanabot](https://github.com/grafanabot)
- **LDAP:** Add `skip_org_role_sync` configuration option. [#56679](https://github.com/grafana/grafana/pull/56679), [@gamab](https://github.com/gamab)
- **LDAPSync:** Improve performance of sync and make it case insensitive. (Enterprise)
- **LibraryPanels:** Load library panels in the frontend rather than the backend. [#50560](https://github.com/grafana/grafana/pull/50560), [@ryantxu](https://github.com/ryantxu)
- **LogContext:** Add header and close button to modal. [#56283](https://github.com/grafana/grafana/pull/56283), [@svennergr](https://github.com/svennergr)
- **LogContext:** Improve text describing the loglines. [#55475](https://github.com/grafana/grafana/pull/55475), [@svennergr](https://github.com/svennergr)
- **Logs:** Allow collapsing the logs volume histogram. [#52808](https://github.com/grafana/grafana/pull/52808), [@gabor](https://github.com/gabor)
- **Logs:** Center `show context` modal on click. [#55989](https://github.com/grafana/grafana/pull/55989), [@svennergr](https://github.com/svennergr)
- **Logs:** Center `show context` modal on click. [#55405](https://github.com/grafana/grafana/pull/55405), [@svennergr](https://github.com/svennergr)
- **Logs:** Show LogRowMenu also for long logs and wrap-lines turned off. [#56030](https://github.com/grafana/grafana/pull/56030), [@svennergr](https://github.com/svennergr)
- **LogsContext:** Added button to load 10 more log lines. [#55923](https://github.com/grafana/grafana/pull/55923), [@svennergr](https://github.com/svennergr)
- **Loki:** Add case insensitive line contains operation. [#58177](https://github.com/grafana/grafana/pull/58177), [@gwdawson](https://github.com/gwdawson)
- **Loki:** Monaco Query Editor enabled by default. [#58080](https://github.com/grafana/grafana/pull/58080), [@matyax](https://github.com/matyax)
- **Loki:** Redesign and improve query patterns. [#55097](https://github.com/grafana/grafana/pull/55097), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Rename log browser to label browser. [#58416](https://github.com/grafana/grafana/pull/58416), [@gwdawson](https://github.com/gwdawson)
- **Loki:** Show invalid fields in label filter. [#55751](https://github.com/grafana/grafana/pull/55751), [@ivanahuckova](https://github.com/ivanahuckova)
- **MSSQL:** Add connection timeout setting in configuration page. [#58631](https://github.com/grafana/grafana/pull/58631), [@mdvictor](https://github.com/mdvictor)
- **Navigation:** Add `pluginId` to standalone plugin page NavLinks. [#57769](https://github.com/grafana/grafana/pull/57769), [@leventebalogh](https://github.com/leventebalogh)
- **Navigation:** Expose new props to extend `Page`/`PluginPage`. [#58465](https://github.com/grafana/grafana/pull/58465), [@ashharrison90](https://github.com/ashharrison90)
- **Navtree:** Make it possible to configure standalone plugin pages. [#56393](https://github.com/grafana/grafana/pull/56393), [@leventebalogh](https://github.com/leventebalogh)
- **Node Graph:** Always show context menu. [#56876](https://github.com/grafana/grafana/pull/56876), [@joey-grafana](https://github.com/joey-grafana)
- **Number formatting:** Strip trailing zeros after decimal point when decimals=auto. [#57373](https://github.com/grafana/grafana/pull/57373), [@leeoniya](https://github.com/leeoniya)
- **OAuth:** Feature toggle for access token expiration check and docs. [#58179](https://github.com/grafana/grafana/pull/58179), [@mgyongyosi](https://github.com/mgyongyosi)
- **Opentsdb:** Allow template variables for filter keys. [#57226](https://github.com/grafana/grafana/pull/57226), [@bohandley](https://github.com/bohandley)
- **PanelEdit:** Allow test id to be passed to panel editors. [#55417](https://github.com/grafana/grafana/pull/55417), [@mckn](https://github.com/mckn)
- **Plugins:** Add hook to make it easier to track interactions in plugins. [#56126](https://github.com/grafana/grafana/pull/56126), [@mckn](https://github.com/mckn)
- **Plugins:** Introduce new Flame graph panel. [#56376](https://github.com/grafana/grafana/pull/56376), [@joey-grafana](https://github.com/joey-grafana)
- **Plugins:** Make "README" the default markdown request param. [#58264](https://github.com/grafana/grafana/pull/58264), [@wbrowne](https://github.com/wbrowne)
- **PostgreSQL:** Migrate to React. [#52831](https://github.com/grafana/grafana/pull/52831), [@zoltanbedi](https://github.com/zoltanbedi)
- **Preferences:** Create indices. [#48356](https://github.com/grafana/grafana/pull/48356), [@sakjur](https://github.com/sakjur)
- **Profiling:** Add Phlare and Parca datasources. [#57809](https://github.com/grafana/grafana/pull/57809), [@aocenas](https://github.com/aocenas)
- **Prometheus:** Handle errors and warnings in buffered client. [#58504](https://github.com/grafana/grafana/pull/58504), [@itsmylife](https://github.com/itsmylife)
- **Prometheus:** Make Prometheus streaming parser as default client. [#58365](https://github.com/grafana/grafana/pull/58365), [@itsmylife](https://github.com/itsmylife)
- **Public Dashboards:** Add audit table. [#54508](https://github.com/grafana/grafana/pull/54508), [@jalevin](https://github.com/jalevin)
- **PublicDashboards:** Add PubDash support to Angular panel plugins. [#57293](https://github.com/grafana/grafana/pull/57293), [@mmandrus](https://github.com/mmandrus)
- **PublicDashboards:** Add annotations support. [#56413](https://github.com/grafana/grafana/pull/56413), [@owensmallwood](https://github.com/owensmallwood)
- **PublicDashboards:** Add custom branding for Public Dashboard. (Enterprise)
- **PublicDashboards:** Add delete public dashboard button in public dashboard modal. [#58095](https://github.com/grafana/grafana/pull/58095), [@juanicabanas](https://github.com/juanicabanas)
- **PublicDashboards:** Cached queries column added in public dashboard insight query. (Enterprise)
- **PublicDashboards:** Can toggle annotations in modal. [#57312](https://github.com/grafana/grafana/pull/57312), [@owensmallwood](https://github.com/owensmallwood)
- **PublicDashboards:** Delete public dashboard in public dashboard table. [#57766](https://github.com/grafana/grafana/pull/57766), [@juanicabanas](https://github.com/juanicabanas)
- **PublicDashboards:** Delete public dashboard when dashboard is deleted. [#57291](https://github.com/grafana/grafana/pull/57291), [@juanicabanas](https://github.com/juanicabanas)
- **PublicDashboards:** Extract config of Public Dashboard. [#57788](https://github.com/grafana/grafana/pull/57788), [@leandro-deveikis](https://github.com/leandro-deveikis)
- **PublicDashboards:** Hide top navigation bar. [#56873](https://github.com/grafana/grafana/pull/56873), [@evictorero](https://github.com/evictorero)
- **PublicDashboards:** Make mixed datasource calls concurrently. [#56421](https://github.com/grafana/grafana/pull/56421), [@juanicabanas](https://github.com/juanicabanas)
- **PublicDashboards:** Orphaned public dashboard item list modified. [#58014](https://github.com/grafana/grafana/pull/58014), [@juanicabanas](https://github.com/juanicabanas)
- **PublicDashboards:** Rename PubdashFooter frontend component. [#58137](https://github.com/grafana/grafana/pull/58137), [@leandro-deveikis](https://github.com/leandro-deveikis)
- **PublicDashboards:** Update docs with supported datasources. [#57629](https://github.com/grafana/grafana/pull/57629), [@owensmallwood](https://github.com/owensmallwood)
- **PublicDashboards:** Validate access token. [#57298](https://github.com/grafana/grafana/pull/57298), [@leandro-deveikis](https://github.com/leandro-deveikis)
- **PublicDashboards:** Validate access token not to be duplicated and add retries. [#56755](https://github.com/grafana/grafana/pull/56755), [@juanicabanas](https://github.com/juanicabanas)
- **RBAC:** Improve performance of dashboard filter query. [#56813](https://github.com/grafana/grafana/pull/56813), [@kalleep](https://github.com/kalleep)
- **Rendering:** Add configuration options for `renderKey` lifetime. [#57339](https://github.com/grafana/grafana/pull/57339), [@Willena](https://github.com/Willena)
- **Reports:** Dynamic scale factor per report. (Enterprise)
- **SAML:** Set cookie option SameSite=none and Secure=true. (Enterprise)
- **SQLStore:** Optionally retry queries if sqlite returns database is locked. [#56096](https://github.com/grafana/grafana/pull/56096), [@papagian](https://github.com/papagian)
- **Server:** Make unix socket permission configurable. [#52944](https://github.com/grafana/grafana/pull/52944), [@unknowndevQwQ](https://github.com/unknowndevQwQ)
- **Tempo:** Add start time and end time parameters while querying traces. [#48068](https://github.com/grafana/grafana/pull/48068), [@bikashmishra100](https://github.com/bikashmishra100)
- **TimeSeries:** Render null-bounded points at data edges. [#57798](https://github.com/grafana/grafana/pull/57798), [@leeoniya](https://github.com/leeoniya)
- **Tracing:** Allow trace to logs for OpenSearch. [#58161](https://github.com/grafana/grafana/pull/58161), [@gabor](https://github.com/gabor)
- **Transformers:** PartitionByValues. [#56767](https://github.com/grafana/grafana/pull/56767), [@leeoniya](https://github.com/leeoniya)
- **UsageStats:** Add traces when sending usage stats. [#55474](https://github.com/grafana/grafana/pull/55474), [@sakjur](https://github.com/sakjur)

### Bug fixes

- **Alerting:** Fix mathexp.NoData in ConditionsCmd. [#56812](https://github.com/grafana/grafana/pull/56812), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **BarChart:** Fix coloring from thresholds and value mappings. [#58285](https://github.com/grafana/grafana/pull/58285), [@leeoniya](https://github.com/leeoniya)
- **BarChart:** Fix stacked hover. [#57711](https://github.com/grafana/grafana/pull/57711), [@leeoniya](https://github.com/leeoniya)
- **Explore:** Fix shared crosshair for logs, logsvolume and graph panels. [#57892](https://github.com/grafana/grafana/pull/57892), [@Elfo404](https://github.com/Elfo404)
- **Flame Graph:** Exact search. [#56769](https://github.com/grafana/grafana/pull/56769), [@joey-grafana](https://github.com/joey-grafana)
- **Flame Graph:** Fix for dashboard scrolling. [#56555](https://github.com/grafana/grafana/pull/56555), [@joey-grafana](https://github.com/joey-grafana)
- **LogContext:** Fix scroll behavior in context modal. [#56070](https://github.com/grafana/grafana/pull/56070), [@svennergr](https://github.com/svennergr)
- **Loki:** Fix showing of history of querying in query editor. [#57344](https://github.com/grafana/grafana/pull/57344), [@ivanahuckova](https://github.com/ivanahuckova)
- **OAuth:** Fix misleading warn log related to oauth and increase logged content. [#57336](https://github.com/grafana/grafana/pull/57336), [@Jguer](https://github.com/Jguer)
- **Plugins:** Plugin details page visual alignment issues. [#57729](https://github.com/grafana/grafana/issues/57729)
- **PublicDashboards:** Fix GET public dashboard that doesn't match. [#57571](https://github.com/grafana/grafana/pull/57571), [@juanicabanas](https://github.com/juanicabanas)
- **PublicDashboards:** Fix annotations error for public dashboards. [#57455](https://github.com/grafana/grafana/pull/57455), [@leandro-deveikis](https://github.com/leandro-deveikis)
- **PublicDashboards:** Fix granularity discrepancy between public and original dashboard. [#57129](https://github.com/grafana/grafana/pull/57129), [@guicaulada](https://github.com/guicaulada)
- **PublicDashboards:** Fix granularity issue caused by query caching. (Enterprise)
- **PublicDashboards:** Fix hidden queries execution. (Enterprise)
- **RBAC:** Add primary key to seed_assignment table. [#56540](https://github.com/grafana/grafana/pull/56540), [@kalleep](https://github.com/kalleep)
- **Tempo:** Fix search removing service name from query. [#58630](https://github.com/grafana/grafana/pull/58630), [@joey-grafana](https://github.com/joey-grafana)
- **TimeRangeInput:** Fix clear button type. [#56545](https://github.com/grafana/grafana/pull/56545), [@Clarity-89](https://github.com/Clarity-89)

### Breaking changes

Removes the unused close-milestone command from `@grafana/toolkit`. Issue [#57062](https://github.com/grafana/grafana/issues/57062)

@grafana/toolkit `cherrypick` command was removed. Issue [#56114](https://github.com/grafana/grafana/issues/56114)

`EmotionPerfTest` is no longer exported from the `@grafana/ui` bundle. Issue [#56100](https://github.com/grafana/grafana/issues/56100)

Removing the unused `changelog` command in `@grafana/toolkit`. Issue [#56073](https://github.com/grafana/grafana/issues/56073)

### Deprecations

The interface type `LogsParser` in `grafana-data` is deprecated. Issue [#56242](https://github.com/grafana/grafana/issues/56242)

The following functions and classes related to logs are deprecated in the `grafana-ui` package: `getLogLevel`, `getLogLevelFromKey`, `addLogLevelToSeries`, `LogsParsers`, `calculateFieldStats`, `calculateLogsLabelStats`, `calculateStats`, `getParser`, `sortInAscendingOrder`, `sortInDescendingOrder`, `sortLogsResult`, `sortLogRows`, `checkLogsError`, `escapeUnescapedString`. Issue [#56077](https://github.com/grafana/grafana/issues/56077)

### Plugin development fixes & changes

- **Toolkit:** Deprecate `plugin:update-circleci` command. [#57743](https://github.com/grafana/grafana/pull/57743), [@academo](https://github.com/academo)
- **Toolkit:** Deprecate `plugin:github-publish` command. [#57726](https://github.com/grafana/grafana/pull/57726), [@academo](https://github.com/academo)
- **Toolkit:** Deprecate `plugin:bundle-managed` command and move its functionality to a bash script. [#57719](https://github.com/grafana/grafana/pull/57719), [@academo](https://github.com/academo)
- **Toolkit:** Deprecate and replace toolkit:build with plain yarn scripts. [#57620](https://github.com/grafana/grafana/pull/57620), [@academo](https://github.com/academo)
- **Toolkit:** Deprecate node-version-check command. [#57591](https://github.com/grafana/grafana/pull/57591), [@academo](https://github.com/academo)
- **Toolkit:** Deprecate searchTestData command. [#57589](https://github.com/grafana/grafana/pull/57589), [@academo](https://github.com/academo)
- **Toolkit:** Remove unused close-milestone command. [#57062](https://github.com/grafana/grafana/pull/57062), [@academo](https://github.com/academo)
- **Toolkit:** Remove unused legacy cherrypick command. [#56114](https://github.com/grafana/grafana/pull/56114), [@academo](https://github.com/academo)
- **Grafana UI:** Clean up bundle. [#56100](https://github.com/grafana/grafana/pull/56100), [@jackw](https://github.com/jackw)
- **Toolkit:** Deprecate `component:create` command. [#56086](https://github.com/grafana/grafana/pull/56086), [@academo](https://github.com/academo)
- **Toolkit:** Remove changelog command. [#56073](https://github.com/grafana/grafana/pull/56073), [@gitstart](https://github.com/gitstart)

<!-- 9.2.15 START -->

# 9.2.15 (2023-03-22)

<!-- 9.2.15 END -->

<!-- 9.2.13 START -->

<!-- 9.2.13 END -->

<!-- 9.2.10 START -->

# 9.2.10 (2023-01-24)

### Features and enhancements

- **TextPanel:** Refactor to functional component (#60885). [#61940](https://github.com/grafana/grafana/pull/61940), [@ryantxu](https://github.com/ryantxu)
- **[v9.2.x] Chore:** Upgrade Go to 1.19.4. [#60826](https://github.com/grafana/grafana/pull/60826), [@sakjur](https://github.com/sakjur)

### Bug fixes

- **Live:** Fix `Subscription to the channel already exists` live streaming error. [#61420](https://github.com/grafana/grafana/pull/61420), [@grafanabot](https://github.com/grafanabot)
- **Live:** Fix `Subscription to the channel already exists` live streaming error. [#61419](https://github.com/grafana/grafana/pull/61419), [@grafanabot](https://github.com/grafanabot)
- **Live:** Fix `Subscription to the channel already exists` live streaming error. [#61406](https://github.com/grafana/grafana/pull/61406), [@ArturWierzbicki](https://github.com/ArturWierzbicki)

<!-- 9.2.10 END -->

<!-- 9.2.7 START -->

# 9.2.7 (2022-11-29)

### Bug fixes

- **Access Control:** Clear user's permission cache after resource creation. [#59318](https://github.com/grafana/grafana/pull/59318), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Azure Monitor:** Fix empty/errored responses for Logs variables. [#59240](https://github.com/grafana/grafana/pull/59240), [@andresmgot](https://github.com/andresmgot)
- **Azure Monitor:** Fix resource picker selection for subresources. [#56392](https://github.com/grafana/grafana/pull/56392), [@andresmgot](https://github.com/andresmgot)
- **Navigation:** Fix crash when Help is disabled. [#58919](https://github.com/grafana/grafana/pull/58919), [@lpskdl](https://github.com/lpskdl)
- **PostgreSQL:** Fix missing CA field from configuration. [#59280](https://github.com/grafana/grafana/pull/59280), [@oscarkilhed](https://github.com/oscarkilhed)
- **SQL Datasources:** Fix annotation migration. [#59438](https://github.com/grafana/grafana/pull/59438), [@zoltanbedi](https://github.com/zoltanbedi)
- **SQL:** Fix code editor for SQL datasources. [#58116](https://github.com/grafana/grafana/pull/58116), [@zoltanbedi](https://github.com/zoltanbedi)
- **SSE:** Make sure to forward headers, user and cookies/OAuth token. [#58897](https://github.com/grafana/grafana/pull/58897), [@kylebrandt](https://github.com/kylebrandt)
- **TimeseriesPanel:** Preserve string fields for data link interpolation. [#58424](https://github.com/grafana/grafana/pull/58424), [@mdvictor](https://github.com/mdvictor)

<!-- 9.2.7 END -->

<!-- 9.2.6 START -->

# 9.2.6 (2022-11-22)

### Features and enhancements

- **Alerting:** Support Prometheus durations in Provisioning API. [#58293](https://github.com/grafana/grafana/pull/58293), [@bartpeeters](https://github.com/bartpeeters)
- **SSE:** Keep value name from numeric table. [#58831](https://github.com/grafana/grafana/pull/58831), [@kylebrandt](https://github.com/kylebrandt)
- **Transformations:** Make Card Descriptions Clickable. [#58717](https://github.com/grafana/grafana/pull/58717), [@zuchka](https://github.com/zuchka)

### Bug fixes

- **MS/My/PostgresSQL:** Migrate annotation query. [#58847](https://github.com/grafana/grafana/pull/58847), [@zoltanbedi](https://github.com/zoltanbedi)
- **Search:** Fixes issue with Recent/Starred section always displaying "General" folder. [#58746](https://github.com/grafana/grafana/pull/58746), [@JoaoSilvaGrafana](https://github.com/JoaoSilvaGrafana)
- **Server:** Write internal server error on missing write. [#57813](https://github.com/grafana/grafana/pull/57813), [@sakjur](https://github.com/sakjur)

<!-- 9.2.6 END -->

<!-- 9.2.5 START -->

# 9.2.5 (2022-11-16)

### Features and enhancements

- **Alerting:** Log when alert rule cannot be screenshot to help debugging. [#58537](https://github.com/grafana/grafana/pull/58537), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Suggest previously entered custom labels. [#57783](https://github.com/grafana/grafana/pull/57783), [@VikaCep](https://github.com/VikaCep)
- **Canvas:** Improve disabled inline editing UX. [#58610](https://github.com/grafana/grafana/pull/58610), [@nmarrs](https://github.com/nmarrs)
- **Canvas:** Improve disabled inline editing UX. [#58609](https://github.com/grafana/grafana/issues/58609)
- **Chore:** Upgrade go-sqlite3 to v1.14.16. [#58581](https://github.com/grafana/grafana/pull/58581), [@sakjur](https://github.com/sakjur)
- **Plugins:** Ensure CallResource responses contain valid Content-Type header. [#58506](https://github.com/grafana/grafana/pull/58506), [@xnyo](https://github.com/xnyo)
- **Prometheus:** Handle errors and warnings in buffered client. [#58657](https://github.com/grafana/grafana/pull/58657), [@itsmylife](https://github.com/itsmylife)
- **Prometheus:** Upgrade HTTP client library to v1.13.1. [#58363](https://github.com/grafana/grafana/pull/58363), [@marefr](https://github.com/marefr)

### Bug fixes

- **Alerting:** Fix screenshots were not cached. [#58493](https://github.com/grafana/grafana/pull/58493), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Canvas:** Fix setting icon from field data. [#58499](https://github.com/grafana/grafana/pull/58499), [@nmarrs](https://github.com/nmarrs)
- **Plugins:** Fix don't set Content-Type header if status is 204 for call resource. [#50780](https://github.com/grafana/grafana/pull/50780), [@sd2k](https://github.com/sd2k)

### Plugin development fixes & changes

- **Toolkit:** Fix compilation loop when watching plugins for changes. [#58167](https://github.com/grafana/grafana/pull/58167), [@jackw](https://github.com/jackw)
- **Tooltips:** Make tooltips in FormField and FormLabel interactive and keyboard friendly. [#57706](https://github.com/grafana/grafana/pull/57706), [@asimpson](https://github.com/asimpson)

<!-- 9.2.5 END -->
<!-- 9.3.0-beta1 END -->
<!-- 9.2.4 START -->

# 9.2.4 (2022-11-07)

### Features and enhancements

- **Access Control:** Add an endpoint for setting several managed resource permissions. [#57893](https://github.com/grafana/grafana/pull/57893), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Accessibility:** Increase `Select` placeholder contrast to be WCAG AA compliant. [#58034](https://github.com/grafana/grafana/pull/58034), [@ashharrison90](https://github.com/ashharrison90)
- **Alerting:** Append org ID to alert notification URLs. [#57123](https://github.com/grafana/grafana/pull/57123), [@neel1996](https://github.com/neel1996)
- **Alerting:** Make the Grouped view the default one for Rules. [#58271](https://github.com/grafana/grafana/pull/58271), [@VikaCep](https://github.com/VikaCep)
- **Build:** Remove unnecessary alpine package updates. [#58005](https://github.com/grafana/grafana/pull/58005), [@DanCech](https://github.com/DanCech)
- **Chore:** Upgrade Go to 1.19.3. [#58052](https://github.com/grafana/grafana/pull/58052), [@sakjur](https://github.com/sakjur)
- **Google Cloud Monitoring:** Set frame interval to draw null values. [#57768](https://github.com/grafana/grafana/pull/57768), [@andresmgot](https://github.com/andresmgot)
- **Instrumentation:** Expose when the binary was built as a gauge. [#57951](https://github.com/grafana/grafana/pull/57951), [@bergquist](https://github.com/bergquist)
- **Loki:** Preserve `X-ID-Token` header. [#57878](https://github.com/grafana/grafana/pull/57878), [@siiimooon](https://github.com/siiimooon)
- **Search:** Reduce requests in folder view. [#55876](https://github.com/grafana/grafana/pull/55876), [@mvsousa](https://github.com/mvsousa)
- **TimeSeries:** More thorough detection of negative values for auto-stacking direction. [#57863](https://github.com/grafana/grafana/pull/57863), [@leeoniya](https://github.com/leeoniya)

### Bug fixes

- **Alerting:** Attempt to preserve UID from migrated legacy channel. [#57639](https://github.com/grafana/grafana/pull/57639), [@alexweav](https://github.com/alexweav)
- **Alerting:** Fix response is not returned for invalid Duration in Provisioning API. [#58046](https://github.com/grafana/grafana/pull/58046), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Fix screenshot is not taken for stale series. [#57982](https://github.com/grafana/grafana/pull/57982), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Auth:** Fix admins not seeing pending invites. [#58217](https://github.com/grafana/grafana/pull/58217), [@joshhunt](https://github.com/joshhunt)
- **MSSQL/Postgres:** Fix visual query editor filter disappearing. [#58248](https://github.com/grafana/grafana/pull/58248), [@zoltanbedi](https://github.com/zoltanbedi)
- **Tempo:** Fix dropdown issue on tag field focus. [#57616](https://github.com/grafana/grafana/pull/57616), [@xiyu95](https://github.com/xiyu95)
- **Timeseries:** Fix null pointer when matching fill below to field. [#58030](https://github.com/grafana/grafana/pull/58030), [@mdvictor](https://github.com/mdvictor)

### Plugin development fixes & changes

- **Toolkit:** Fix Webpack less-loader config. [#57950](https://github.com/grafana/grafana/pull/57950), [@dessen-xu](https://github.com/dessen-xu)

<!-- 9.2.4 END -->
<!-- 9.2.3 START -->

# 9.2.3 (2022-10-31)

### Features and enhancements

- **Docs:** Add information about DB version support to upgrade guide. [#57643](https://github.com/grafana/grafana/pull/57643), [@joeblubaugh](https://github.com/joeblubaugh)
- **Footer:** Update footer release notes link to Github changelog. [#57871](https://github.com/grafana/grafana/pull/57871), [@joshhunt](https://github.com/joshhunt)
- **Prometheus:** Do not drop errors in streaming parser. [#57698](https://github.com/grafana/grafana/pull/57698), [@kylebrandt](https://github.com/kylebrandt)
- **Prometheus:** Flavor/version configuration. [#57554](https://github.com/grafana/grafana/pull/57554), [@gtk-grafana](https://github.com/gtk-grafana)
- **Prometheus:** Provide label values match parameter API when supported prometheus instance is configured. [#57553](https://github.com/grafana/grafana/pull/57553), [@gtk-grafana](https://github.com/gtk-grafana)
- **Security:** Upgrade x/text to version unaffected by CVE-2022-32149. [#57797](https://github.com/grafana/grafana/pull/57797), [@yong-jie-gong](https://github.com/yong-jie-gong)

### Bug fixes

- **Access control:** Fix a bug with argument order for data source managed permission updates. (Enterprise)
- **Auth:** Fix GF_AUTH_JWT_URL_LOGIN env variable doesn't work. [#57689](https://github.com/grafana/grafana/pull/57689), [@Jguer](https://github.com/Jguer)
- **Live:** Explicitly reply with http 200. [#57428](https://github.com/grafana/grafana/pull/57428), [@sh0rez](https://github.com/sh0rez)
- **Prometheus:** Fix builder operation mode changing multiselect to single select behaviour. [#57780](https://github.com/grafana/grafana/pull/57780), [@itsmylife](https://github.com/itsmylife)
- **Prometheus:** Fix builder operation mode changing multiselect to single select behaviour. [#57493](https://github.com/grafana/grafana/pull/57493), [@yinjialu](https://github.com/yinjialu)
- **Security:** Fix vulnerabilities in webpack loader-utils. [#57533](https://github.com/grafana/grafana/pull/57533), [@jackw](https://github.com/jackw)

<!-- 9.2.3 END -->
<!-- 9.2.2 START -->

# 9.2.2 (2022-10-25)

### Features and enhancements

- **Alerting:** Add support for wecom apiapp. [#55991](https://github.com/grafana/grafana/pull/55991), [@aimuz](https://github.com/aimuz)
- **Canvas:** Improve resource picker initialization. [#57319](https://github.com/grafana/grafana/pull/57319), [@nmarrs](https://github.com/nmarrs)
- **Canvas:** Improve text element readability. [#57371](https://github.com/grafana/grafana/pull/57371), [@adela-almasan](https://github.com/adela-almasan)
- **CloudWatch:** Make sure adoption tracking is done on valid, migrated queries. [#56872](https://github.com/grafana/grafana/pull/56872), [@sunker](https://github.com/sunker)
- **Dashboard:** Alerts user to incorrect tag format for JSON import. [#54657](https://github.com/grafana/grafana/pull/54657), [@iamelDuderino](https://github.com/iamelDuderino)
- **MSSQL:** Support tables from all schemas. [#53099](https://github.com/grafana/grafana/pull/53099), [@zoltanbedi](https://github.com/zoltanbedi)
- **Opentsdb:** Allow template variables for filter keys. [#57226](https://github.com/grafana/grafana/pull/57226), [@bohandley](https://github.com/bohandley)
- **Prometheus:** Provide label values match parameter API when supported prometheus instance is configured. [#56510](https://github.com/grafana/grafana/pull/56510), [@gtk-grafana](https://github.com/gtk-grafana)
- **QueryEditor:** Revert components from grafana-ui. [#57436](https://github.com/grafana/grafana/pull/57436), [@zoltanbedi](https://github.com/zoltanbedi)
- **TeamSync:** Allow team sync when external organization mapping returns no organization role. (Enterprise)

### Bug fixes

- **Browse:** Fix General folder not showing in FolderPicker. [#57156](https://github.com/grafana/grafana/pull/57156), [@eledobleefe](https://github.com/eledobleefe)
- **Elasticsearch:** Fix calculation of trimEdges in alert mode. [#56148](https://github.com/grafana/grafana/pull/56148), [@jorgelbg](https://github.com/jorgelbg)
- **Elasticsearch:** Fix trimEdges delete logic in alert mode. [#56985](https://github.com/grafana/grafana/pull/56985), [@gabor](https://github.com/gabor)
- **GoogleOAuth:** Unlock User Admin UI. [#57350](https://github.com/grafana/grafana/pull/57350), [@gamab](https://github.com/gamab)
- **LogContext:** Fix wrong color of `show context` icon in light theme. [#57427](https://github.com/grafana/grafana/pull/57427), [@svennergr](https://github.com/svennergr)
- **Loki:** Fix adding of adhoc filters to stream selector when query with empty stream selector. [#57280](https://github.com/grafana/grafana/pull/57280), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Fix double stringified log-lines when copied via Copy button. [#57243](https://github.com/grafana/grafana/pull/57243), [@svennergr](https://github.com/svennergr)
- **Loki:** Fix explain section about $\_\_interval variable. [#57188](https://github.com/grafana/grafana/pull/57188), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Remove already selected options from next label filter options in builder. [#57187](https://github.com/grafana/grafana/pull/57187), [@ivanahuckova](https://github.com/ivanahuckova)
- **NodeGraph:** Fix rendering issues when values of arc are over 1. [#57460](https://github.com/grafana/grafana/pull/57460), [@aocenas](https://github.com/aocenas)
- **PublicDashboards:** Fix hidden queries execution. [#57194](https://github.com/grafana/grafana/pull/57194), [@juanicabanas](https://github.com/juanicabanas)
- **PublicDashboards:** Fix hidden queries execution. [#57004](https://github.com/grafana/grafana/pull/57004), [@juanicabanas](https://github.com/juanicabanas)
- **Tempo:** Fix Node Graph visualization type in dashboard. [#56931](https://github.com/grafana/grafana/pull/56931), [@CrypticSignal](https://github.com/CrypticSignal)
- **TimeSeries:** Fix stacking when first value is negative zero. [#57257](https://github.com/grafana/grafana/pull/57257), [@zoltanbedi](https://github.com/zoltanbedi)
- **TimeseriesPanel:** Fix variables in data links. [#56729](https://github.com/grafana/grafana/pull/56729), [@mdvictor](https://github.com/mdvictor)
- **User:** Fix externalUserId not being populated. [#57341](https://github.com/grafana/grafana/pull/57341), [@joshhunt](https://github.com/joshhunt)

### Breaking changes

We added some components a bit too early to @grafana/ui in 9.2 so we are moving them back to @grafana/experimental. If you used any of these components

- AccessoryButton
- EditorFieldGroup
- EditorHeader
- EditorField
- EditorRow
- EditorList
- EditorRows
- EditorSwitch
- FlexItem
- Stack
- InlineSelect
- InputGroup
- Space

Please use them from grafana/experimental from now on. Issue [#57436](https://github.com/grafana/grafana/issues/57436)

<!-- 9.2.2 END -->
<!-- 9.2.1 START -->

# 9.2.1 (2022-10-18)

### Features and enhancements

- **Alerting:** Improve notification policies created during migration. [#52071](https://github.com/grafana/grafana/pull/52071), [@JacobsonMT](https://github.com/JacobsonMT)
- **AzureAD:** Add option to force fetch the groups from the Graph API. [#56916](https://github.com/grafana/grafana/pull/56916), [@gamab](https://github.com/gamab)
- **AzureAD:** Add option to force fetch the groups from the Graph API (#56916). [#56947](https://github.com/grafana/grafana/pull/56947), [@gamab](https://github.com/gamab)
- **Docs:** Note end of release notes publication. [#57013](https://github.com/grafana/grafana/pull/57013), [@gguillotte-grafana](https://github.com/gguillotte-grafana)
- **Inspect:** Handle JSON tab crash when the provided object is too big to stringify. [#55939](https://github.com/grafana/grafana/pull/55939), [@TsotosA](https://github.com/TsotosA)
- **TablePanel:** Footer now updates values on column filtering. [#56354](https://github.com/grafana/grafana/pull/56354), [@mdvictor](https://github.com/mdvictor)

### Bug fixes

- **Alerting:** Fix email image embedding on Windows. [#56766](https://github.com/grafana/grafana/pull/56766), [@joeblubaugh](https://github.com/joeblubaugh)
- **Alerting:** Fix mathexp.NoData for ConditionsCmd. [#56816](https://github.com/grafana/grafana/pull/56816), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Legacy Alerting:** Fix duration calculation when testing a rule. [#56616](https://github.com/grafana/grafana/pull/56616), [@jorgelbg](https://github.com/jorgelbg)
- **Loki:** Propagate additional headers from Grafana to Loki when querying data. [#56896](https://github.com/grafana/grafana/pull/56896), [@alexweav](https://github.com/alexweav)
- **Search:** Sort alphabetically in the folder view, increase the limit of the folder search from 50 to 1000. [#57141](https://github.com/grafana/grafana/pull/57141), [@ArturWierzbicki](https://github.com/ArturWierzbicki)
- **TablePanel:** Fix last table column to be centered. [#56047](https://github.com/grafana/grafana/pull/56047), [@gitstart](https://github.com/gitstart)

### Plugin development fixes & changes

- **Grafana UI:** Export prop types for queryfield, modal and field components. [#57097](https://github.com/grafana/grafana/pull/57097), [@jackw](https://github.com/jackw)
- **Toolkit:** Fix `Cannot use import statement outside...` error in tests. [#57071](https://github.com/grafana/grafana/pull/57071), [@jackw](https://github.com/jackw)

<!-- 9.2.1 END -->
<!-- 9.2.0 START -->

# 9.2.0 (2022-10-11)

### Features and enhancements

- **Alerting:** Add Notification error feedback on contact points view. [#56225](https://github.com/grafana/grafana/pull/56225), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Allow created by to be manually set when there's no creator for silences. [#55952](https://github.com/grafana/grafana/pull/55952), [@gotjosh](https://github.com/gotjosh)
- **Alerting:** Expose info about notification delivery errors in a new /receivers endpoint. [#55429](https://github.com/grafana/grafana/pull/55429), [@santihernandezc](https://github.com/santihernandezc)
- **Alerting:** Update imported prometheus alertmanager version. [#56228](https://github.com/grafana/grafana/pull/56228), [@joeblubaugh](https://github.com/joeblubaugh)
- **Alerting:** Update imported prometheus alertmanager version. Backport (#56228). [#56430](https://github.com/grafana/grafana/pull/56430), [@joeblubaugh](https://github.com/joeblubaugh)
- **Alerting:** Write and Delete multiple alert instances. [#55350](https://github.com/grafana/grafana/pull/55350), [@joeblubaugh](https://github.com/joeblubaugh)
- **Core:** Implement aria attributes for query rows, improve a11y. [#55563](https://github.com/grafana/grafana/pull/55563), [@L-M-K-B](https://github.com/L-M-K-B)
- **Custom Branding:** Remove custom branding service. (Enterprise)
- **Custom branding:** Remove UI. (Enterprise)
- **DevEnv:** Adds docker block for clickhouse. [#55702](https://github.com/grafana/grafana/pull/55702), [@owensmallwood](https://github.com/owensmallwood)
- **Docker:** removes unneccesary use of edge repo. [#54567](https://github.com/grafana/grafana/pull/54567), [@xlson](https://github.com/xlson)
- **Explore:** Revert split pane resize feature. [#56310](https://github.com/grafana/grafana/pull/56310), [@Elfo404](https://github.com/Elfo404)
- **Frontend:** Make local storage items propagate to different tabs immediately. [#55810](https://github.com/grafana/grafana/pull/55810), [@oscarkilhed](https://github.com/oscarkilhed)
- **PublicDashboards:** Allow disabling an existent public dashboard if it …. [#55778](https://github.com/grafana/grafana/pull/55778), [@evictorero](https://github.com/evictorero)
- **QueryEditorRow:** Only pass error to query editor if panel is not in a loading state. [#56350](https://github.com/grafana/grafana/pull/56350), [@kevinwcyu](https://github.com/kevinwcyu)
- **Reports:** Refresh query variables on time range change. (Enterprise)
- **XYChart:** Beta release. [#55973](https://github.com/grafana/grafana/pull/55973), [@mdvictor](https://github.com/mdvictor)
- **[9.2.x] Alerting:** Start ticker only when scheduler starts (#56339). [#56418](https://github.com/grafana/grafana/pull/56418), [@yuri-tceretian](https://github.com/yuri-tceretian)

### Bug fixes

- **Alerting:** Fix pq: missing FROM-clause for table "a". [#56453](https://github.com/grafana/grafana/pull/56453), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **AzureMonitor:** Correctly update subscriptions value in ARG editor. [#55860](https://github.com/grafana/grafana/pull/55860), [@aangelisc](https://github.com/aangelisc)
- **Chore:** Fix swagger validation failures. (Enterprise)
- **Chore:** Regenerate swagger specification and fix validation failures. [#55750](https://github.com/grafana/grafana/pull/55750), [@joshhunt](https://github.com/joshhunt)
- **Correlations:** Only return correlation for which both source and target datasources exist. [#55454](https://github.com/grafana/grafana/pull/55454), [@Elfo404](https://github.com/Elfo404)
- **Explore:** Prevent panes from disappearing when resizing window in split view. [#55696](https://github.com/grafana/grafana/pull/55696), [@gelicia](https://github.com/gelicia)
- **Links:** Fix opening links from different orgs on the same tab. [#55837](https://github.com/grafana/grafana/pull/55837), [@guicaulada](https://github.com/guicaulada)
- **LogContext:** Fix scroll position in upper context group. [#56370](https://github.com/grafana/grafana/pull/56370), [@svennergr](https://github.com/svennergr)
- **Logs:** Show copy button independently from context. [#55934](https://github.com/grafana/grafana/pull/55934), [@svennergr](https://github.com/svennergr)
- **Loki/Prometheus:** Fix adding of ad hoc filters when jumping from dashboard to explore. [#55915](https://github.com/grafana/grafana/pull/55915), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Add support for range aggregations with by grouping. [#56184](https://github.com/grafana/grafana/pull/56184), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Fix label-value escaping in context query. [#56614](https://github.com/grafana/grafana/pull/56614), [@svennergr](https://github.com/svennergr)
- **Loki:** Fix redundant escaping in adhoc filter with regex match. [#56447](https://github.com/grafana/grafana/pull/56447), [@ivanahuckova](https://github.com/ivanahuckova)
- **PanelEdit:** Fixes resize pane border and spacing issues. [#56190](https://github.com/grafana/grafana/pull/56190), [@torkelo](https://github.com/torkelo)
- **PublicDashboards:** Fix dashboard insights query when Public Dashboard feature is enabled. (Enterprise)
- **PublicDashboards:** Fix dashboard insights query when Public Dashboard feature is enabled. (Enterprise)
- **RBAC:** Redirect to /login when forceLogin is set. [#56469](https://github.com/grafana/grafana/pull/56469), [@sakjur](https://github.com/sakjur)
- **SAML:** Fix RelayState generation function. (Enterprise)
- **Security:** Fix CVE-2022-27664. [#55361](https://github.com/grafana/grafana/pull/55361), [@yong-jie-gong](https://github.com/yong-jie-gong)
- **StateTimeline:** Fix tooltip showing erroneously in shared crosshair dashboards. [#55809](https://github.com/grafana/grafana/pull/55809), [@mdvictor](https://github.com/mdvictor)
- **Tempo:** Fix unexpected trimming of leading zeroes in traceID. [#55167](https://github.com/grafana/grafana/pull/55167), [@hanjm](https://github.com/hanjm)
- **Tracing:** Fix bug where errors are not reported to OpenTelemetry. [#55925](https://github.com/grafana/grafana/pull/55925), [@sakjur](https://github.com/sakjur)

<!-- 9.2.0 END -->
<!-- 9.2.0-beta1 START -->

# 9.2.0-beta1 (2022-09-26)

### Features and enhancements

- **AccessControl:** Move GetCacheKey to SignedInUser. [#53591](https://github.com/grafana/grafana/pull/53591), [@mgyongyosi](https://github.com/mgyongyosi)
- **AccessControl:** Move GetCacheKey to SignedInUser. (Enterprise)
- **Admin:** Add support to configure default admin email. [#54363](https://github.com/grafana/grafana/pull/54363), [@mhuangwm](https://github.com/mhuangwm)
- **Admin:** Create/Edit Team/ServiceAccount UI changes. [#53889](https://github.com/grafana/grafana/pull/53889), [@mgyongyosi](https://github.com/mgyongyosi)
- **Alert list panel:** Add view mode "Stat". [#53281](https://github.com/grafana/grafana/pull/53281), [@peterholmberg](https://github.com/peterholmberg)
- **Alerting:** Add alert preview to cloud rules editor. [#54950](https://github.com/grafana/grafana/pull/54950), [@konrad147](https://github.com/konrad147)
- **Alerting:** Add new API endpoint GET /api/v1/ngalert. [#55134](https://github.com/grafana/grafana/pull/55134), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Add templates autocomplete. [#53655](https://github.com/grafana/grafana/pull/53655), [@konrad147](https://github.com/konrad147)
- **Alerting:** Adds support for editing group details for Grafana managed rules. [#53120](https://github.com/grafana/grafana/pull/53120), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Change default alert state to Error on execution error or timeout. [#55345](https://github.com/grafana/grafana/pull/55345), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Display alert's 'Created' time in local time instead of UTC. [#54414](https://github.com/grafana/grafana/pull/54414), [@mmusenbr](https://github.com/mmusenbr)
- **Alerting:** Improve Mimir AM interoperability with Grafana. [#53396](https://github.com/grafana/grafana/pull/53396), [@konrad147](https://github.com/konrad147)
- **Alerting:** Improve validation of query and expressions on rule submit. [#53258](https://github.com/grafana/grafana/pull/53258), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Read group details before saving. [#53586](https://github.com/grafana/grafana/pull/53586), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Resolve stale state. [#49352](https://github.com/grafana/grafana/pull/49352), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Support for re-ordering alert rules in a group. [#53318](https://github.com/grafana/grafana/pull/53318), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Update embedded Alertmanager v0.24. [#53555](https://github.com/grafana/grafana/pull/53555), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Update forking request handlers to use the same errors. [#52965](https://github.com/grafana/grafana/pull/52965), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Write and Delete multiple alert instances. [#52305](https://github.com/grafana/grafana/pull/52305), [@joeblubaugh](https://github.com/joeblubaugh)
- **Annotation:** Optionally allow storing longer annotation tags. [#54754](https://github.com/grafana/grafana/pull/54754), [@papagian](https://github.com/papagian)
- **Auth:** Add SAML common resolutions to cookie issues. [#55395](https://github.com/grafana/grafana/pull/55395), [@Jguer](https://github.com/Jguer)
- **Auth:** Add cli command users-manager for conflict resolution. [#52344](https://github.com/grafana/grafana/pull/52344), [@eleijonmarck](https://github.com/eleijonmarck)
- **Auth:** Add documentation on group overage claims in AzureAD. [#55389](https://github.com/grafana/grafana/pull/55389), [@Jguer](https://github.com/Jguer)
- **Auth:** Extend auth token errors with user ID. [#54633](https://github.com/grafana/grafana/pull/54633), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Auth:** Reduce allocs in permission map. [#55410](https://github.com/grafana/grafana/pull/55410), [@Jguer](https://github.com/Jguer)
- **Auth:** Restore legacy behavior and add deprecation notice for empty org role in oauth. [#55118](https://github.com/grafana/grafana/pull/55118), [@Jguer](https://github.com/Jguer)
- **AzureMonitor:** Automate retrieval of supported Metrics namespaces. [#53203](https://github.com/grafana/grafana/pull/53203), [@aangelisc](https://github.com/aangelisc)
- **Build:** Replace the file-loader loader with asset module in webpack config. [#53088](https://github.com/grafana/grafana/pull/53088), [@academo](https://github.com/academo)
- **Chore:** Group auth docker blocks. [#54274](https://github.com/grafana/grafana/pull/54274), [@linoman](https://github.com/linoman)
- **Chore:** Upgrade Go to 1.19.1. [#54902](https://github.com/grafana/grafana/pull/54902), [@sakjur](https://github.com/sakjur)
- **Cleanup:** Add traces to cleanup jobs. [#55465](https://github.com/grafana/grafana/pull/55465), [@sakjur](https://github.com/sakjur)
- **CloudMonitor:** Remove cloudMonitoringExperimentalUI feature flag. [#55054](https://github.com/grafana/grafana/pull/55054), [@asimpson](https://github.com/asimpson)
- **CloudWatch:** Add AWS/States metrics. [#55427](https://github.com/grafana/grafana/pull/55427), [@jangaraj](https://github.com/jangaraj)
- **CloudWatch:** Add missing AWS/ApiGateway metrics. [#53839](https://github.com/grafana/grafana/pull/53839), [@jangaraj](https://github.com/jangaraj)
- **CloudWatch:** Add missing AWS/Events metrics. [#53831](https://github.com/grafana/grafana/pull/53831), [@jangaraj](https://github.com/jangaraj)
- **CloudWatch:** Enable feature adoption tracking in the plugin. [#54299](https://github.com/grafana/grafana/pull/54299), [@sunker](https://github.com/sunker)
- **CloudWatch:** Log group variable should get all log groups. [#54062](https://github.com/grafana/grafana/pull/54062), [@iwysiu](https://github.com/iwysiu)
- **CloudWatch:** Refactoring - decouple logs and metrics in datasource file. [#55079](https://github.com/grafana/grafana/pull/55079), [@sunker](https://github.com/sunker)
- **Correlations:** Add GetCorrelation(s) HTTP APIs. [#52517](https://github.com/grafana/grafana/pull/52517), [@Elfo404](https://github.com/Elfo404)
- **Custom branding:** Add RBAC (early access). (Enterprise)
- **Custom branding:** Add preview for the settings (early access). (Enterprise)
- **Dashboard:** Support Variables in "Filter by Name" Transformation. [#51804](https://github.com/grafana/grafana/pull/51804), [@Kirchen99](https://github.com/Kirchen99)
- **DashboardQuery:** Expand query options. [#53998](https://github.com/grafana/grafana/pull/53998), [@ryantxu](https://github.com/ryantxu)
- **Docs:** Deprecating packages_api and removing it from our pipelines. [#54473](https://github.com/grafana/grafana/pull/54473), [@tolzhabayev](https://github.com/tolzhabayev)
- **Docs:** Update annotations API docs to include required field. [#52644](https://github.com/grafana/grafana/pull/52644), [@HarryTennent](https://github.com/HarryTennent)
- **Echo:** Add support for Google Analytics 4. [#55446](https://github.com/grafana/grafana/pull/55446), [@joshhunt](https://github.com/joshhunt)
- **Elasticsearch:** Respect time range in ad hoc filters. [#53874](https://github.com/grafana/grafana/pull/53874), [@gabor](https://github.com/gabor)
- **Explore:** Add Mixed Datasource. [#53429](https://github.com/grafana/grafana/pull/53429), [@gelicia](https://github.com/gelicia)
- **Explore:** Add resize to split view, with Min/Max button. [#54420](https://github.com/grafana/grafana/pull/54420), [@gelicia](https://github.com/gelicia)
- **Footer:** Add release notes url to version label. [#52909](https://github.com/grafana/grafana/pull/52909), [@kianelbo](https://github.com/kianelbo)
- **Geomap:** Add Africa, Australia, Oceania, South Asia, and East Asia as initial view options. [#55142](https://github.com/grafana/grafana/pull/55142), [@zuchka](https://github.com/zuchka)
- **Geomap:** Add dynamic initial view options. [#54419](https://github.com/grafana/grafana/pull/54419), [@drew08t](https://github.com/drew08t)
- **Grafana Backend:** Establish a database version support policy. [#54374](https://github.com/grafana/grafana/pull/54374), [@joeblubaugh](https://github.com/joeblubaugh)
- **Grafana UI:** Add implicit submit to TimeRangeForm for A11y. [#52647](https://github.com/grafana/grafana/pull/52647), [@matejkubinec](https://github.com/matejkubinec)
- **Grafana/ui:** Adds all unicons to IconName and script to generate types. [#53820](https://github.com/grafana/grafana/pull/53820), [@academo](https://github.com/academo)
- **GrafanaUI:** Add icon to links on Plugin configuration page. [#55581](https://github.com/grafana/grafana/pull/55581), [@leandro-deveikis](https://github.com/leandro-deveikis)
- **GrafanaUI:** Deprecate logs components. [#55364](https://github.com/grafana/grafana/pull/55364), [@gabor](https://github.com/gabor)
- **GraphPanel:** Panel Description box does not expand to fit markdown table. [#54238](https://github.com/grafana/grafana/pull/54238), [@gitstart](https://github.com/gitstart)
- **Icons:** Move unicons icons to the repository and generate the iconsBundle.js with nodejs. [#53766](https://github.com/grafana/grafana/pull/53766), [@academo](https://github.com/academo)
- **InfluxDB:** Remove browser ('direct' access) mode. [#53529](https://github.com/grafana/grafana/pull/53529), [@obetomuniz](https://github.com/obetomuniz)
- **JWT:** Add support for assigning org roles. [#54277](https://github.com/grafana/grafana/pull/54277), [@nrwiersma](https://github.com/nrwiersma)
- **JWT:** Allow conventional bearer token in Authorization header. [#54821](https://github.com/grafana/grafana/pull/54821), [@nrwiersma](https://github.com/nrwiersma)
- **Live:** Migrate to centrifuge-js v3 (new API and client protocol). [#51977](https://github.com/grafana/grafana/pull/51977), [@FZambia](https://github.com/FZambia)
- Load icons using webpack context instead of react-inlinesvg library. [#53675](https://github.com/grafana/grafana/pull/53675), [@academo](https://github.com/academo)
- **Login:** Allow basic users to reset password when LDAP or Auth Proxy is enabled. [#52331](https://github.com/grafana/grafana/pull/52331), [@krzysdabro](https://github.com/krzysdabro)
- **Login:** Remove single admin team restriction. [#54534](https://github.com/grafana/grafana/pull/54534), [@linoman](https://github.com/linoman)
- **Logs:** Relocate "show context" button, add copy line log button. [#50977](https://github.com/grafana/grafana/pull/50977), [@Seyaji](https://github.com/Seyaji)
- **Loki Query Variables:** Add support to select from existing labels. [#54625](https://github.com/grafana/grafana/pull/54625), [@matyax](https://github.com/matyax)
- **Loki/Prometheus:** Make sections in log/metrics browser resizable. [#54704](https://github.com/grafana/grafana/pull/54704), [@gwdawson](https://github.com/gwdawson)
- **Loki/Prometheus:** Remove beta tag from query builder. [#55150](https://github.com/grafana/grafana/pull/55150), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Add validation to derived fields url field setting. [#53599](https://github.com/grafana/grafana/pull/53599), [@matyax](https://github.com/matyax)
- **Loki:** Create Variable Query Editor for Loki. [#54102](https://github.com/grafana/grafana/pull/54102), [@matyax](https://github.com/matyax)
- **MSSQL:** Migrate to React. [#51765](https://github.com/grafana/grafana/pull/51765), [@zoltanbedi](https://github.com/zoltanbedi)
- **Metrics:** Instrument requests not matching any handler as `notfound`. [#53949](https://github.com/grafana/grafana/pull/53949), [@bergquist](https://github.com/bergquist)
- **Navigation Bar:** Remove plugins link under Server Admin. [#54386](https://github.com/grafana/grafana/pull/54386), [@academo](https://github.com/academo)
- **Navigation:** Don't round app plugin icon images. [#54543](https://github.com/grafana/grafana/pull/54543), [@joshhunt](https://github.com/joshhunt)
- **OAuth:** Allow assigning Server Admin. [#54780](https://github.com/grafana/grafana/pull/54780), [@Jguer](https://github.com/Jguer)
- **Panel edit:** Run queries when time range changes in table view. [#53111](https://github.com/grafana/grafana/pull/53111), [@axelavargas](https://github.com/axelavargas)
- **Panels:** Add panel debug support helper. [#54678](https://github.com/grafana/grafana/pull/54678), [@ryantxu](https://github.com/ryantxu)
- **Playlists:** Migrate to UIDs and load dashboards in the frontend. [#54125](https://github.com/grafana/grafana/pull/54125), [@ryantxu](https://github.com/ryantxu)
- **Plugins:** Add feature toggles for long running queries. [#54349](https://github.com/grafana/grafana/pull/54349), [@kevinwcyu](https://github.com/kevinwcyu)
- **Plugins:** Add secure JSON fields to plugin setting DTO. [#55313](https://github.com/grafana/grafana/pull/55313), [@wbrowne](https://github.com/wbrowne)
- **Plugins:** Handle app plugin proxy routes per request. [#51835](https://github.com/grafana/grafana/pull/51835), [@marefr](https://github.com/marefr)
- **Plugins:** Use error plane for api/ds/query. [#54750](https://github.com/grafana/grafana/pull/54750), [@wbrowne](https://github.com/wbrowne)
- **Preferences:** Support setting any dashboard as home, not just the starred ones. [#54258](https://github.com/grafana/grafana/pull/54258), [@ryantxu](https://github.com/ryantxu)
- **Prometheus:** Add dashboard uid when tracing header in browsermode. [#53232](https://github.com/grafana/grafana/pull/53232), [@lpskdl](https://github.com/lpskdl)
- **Prometheus:** Throw error on direct access. [#50162](https://github.com/grafana/grafana/pull/50162), [@aocenas](https://github.com/aocenas)
- **Prometheus:** Upgrades http client to 1.30. [#53901](https://github.com/grafana/grafana/pull/53901), [@bergquist](https://github.com/bergquist)
- **Prometheus:** Upgrades the prometheus http client to 1.13. [#47707](https://github.com/grafana/grafana/pull/47707), [@yesoreyeram](https://github.com/yesoreyeram)
- **PublicDashboard:** Add RTK Query with loading and error state. Add MSW dependency for testing. [#55518](https://github.com/grafana/grafana/pull/55518), [@juanicabanas](https://github.com/juanicabanas)
- **PublicDashboards:** Add RBAC to secured endpoints. [#54544](https://github.com/grafana/grafana/pull/54544), [@evictorero](https://github.com/evictorero)
- **PublicDashboards:** Add link to public dashboards docs to sharing modal. [#55186](https://github.com/grafana/grafana/pull/55186), [@guicaulada](https://github.com/guicaulada)
- **PublicDashboards:** Disable form when user does not has permissions. [#54853](https://github.com/grafana/grafana/pull/54853), [@evictorero](https://github.com/evictorero)
- **PublicDashboards:** Dont support exemplars. [#54933](https://github.com/grafana/grafana/pull/54933), [@owensmallwood](https://github.com/owensmallwood)
- **PublicDashboards:** Ignore time range input and changes on public dashboard. [#55412](https://github.com/grafana/grafana/pull/55412), [@guicaulada](https://github.com/guicaulada)
- **PublicDashboards:** Log api layer errors and which datasources fail/succeed. [#55056](https://github.com/grafana/grafana/pull/55056), [@owensmallwood](https://github.com/owensmallwood)
- **PublicDashboards:** Render tag when dashboard meta changes in state. [#55414](https://github.com/grafana/grafana/pull/55414), [@owensmallwood](https://github.com/owensmallwood)
- **PublicDashboards:** Resolve interval for public dashboard data source. [#55489](https://github.com/grafana/grafana/pull/55489), [@guicaulada](https://github.com/guicaulada)
- **PublicDashboards:** Sanitize metadata from public dashboard queries. [#55269](https://github.com/grafana/grafana/pull/55269), [@guicaulada](https://github.com/guicaulada)
- **PublicDashboards:** UI improvements. [#55130](https://github.com/grafana/grafana/pull/55130), [@juanicabanas](https://github.com/juanicabanas)
- **Query editor:** Allow query editors to create new query. [#55028](https://github.com/grafana/grafana/pull/55028), [@ivanahuckova](https://github.com/ivanahuckova)
- **RBAC:** Add cache for oss rbac permissions. [#55098](https://github.com/grafana/grafana/pull/55098), [@kalleep](https://github.com/kalleep)
- **RBAC:** Add endpoints for reading and updating role assignments. (Enterprise)
- **RBAC:** Add permissions to install and configure plugins. [#51829](https://github.com/grafana/grafana/pull/51829), [@gamab](https://github.com/gamab)
- **RBAC:** Display indicator if a permission is inherited. [#54080](https://github.com/grafana/grafana/pull/54080), [@kalleep](https://github.com/kalleep)
- **RBAC:** Only display unique permissions in list. [#54074](https://github.com/grafana/grafana/pull/54074), [@kalleep](https://github.com/kalleep)
- **RBAC:** Refactor delegation check to reduce db queries. (Enterprise)
- **RBAC:** Validate scopes during role creation. (Enterprise)
- **Report:** Keep report data on edit page refresh. (Enterprise)
- **Reports:** Allow CSV only option. (Enterprise)
- **Reports:** Render steps inside ReportPage. (Enterprise)
- **SAML:** Account for all orgs in org_mapping. (Enterprise)
- **SAML:** Add option to skip org role sync. [#55230](https://github.com/grafana/grafana/pull/55230), [@gamab](https://github.com/gamab)
- **SAML:** Add option to skip org role sync. (Enterprise)
- **SAML:** Allow wildcard mapping to add user to all existing orgs. [#55628](https://github.com/grafana/grafana/pull/55628), [@gamab](https://github.com/gamab)
- **SAML:** Do not SAML SLO if user is not SAML authenticated. [#53418](https://github.com/grafana/grafana/pull/53418), [@Jguer](https://github.com/Jguer)
- **SAML:** Improve SAML login flow. (Enterprise)
- **SQL:** Migrate (MS/My/Postgres)SQL configuration pages from Angular to React. [#51891](https://github.com/grafana/grafana/pull/51891), [@oscarkilhed](https://github.com/oscarkilhed)
- **Search:** Migrated impressions to use dashboardUID. [#53090](https://github.com/grafana/grafana/pull/53090), [@lpskdl](https://github.com/lpskdl)
- **Secrets:** Add fallback to secrets kvstore plugin. [#54056](https://github.com/grafana/grafana/pull/54056), [@guicaulada](https://github.com/guicaulada)
- **Secrets:** Convert secret migration to a background service. [#54676](https://github.com/grafana/grafana/pull/54676), [@guicaulada](https://github.com/guicaulada)
- **Secrets:** Implement secrets manager plugin fallback store. [#54496](https://github.com/grafana/grafana/pull/54496), [@guicaulada](https://github.com/guicaulada)
- **Secrets:** Improve error handling for secrets manager plugin. [#54811](https://github.com/grafana/grafana/pull/54811), [@guicaulada](https://github.com/guicaulada)
- **SegmentInput:** Omit allowCustomValue and allowEmptyValue props. [#55352](https://github.com/grafana/grafana/pull/55352), [@timagixe](https://github.com/timagixe)
- **Status History Panel:** Show X-Axis Value in Tooltip. [#54563](https://github.com/grafana/grafana/pull/54563), [@gitstart](https://github.com/gitstart)
- **TeamSync:** Add description to group mapping. (Enterprise)
- **TeamSync:** Prevent team syncing out of orgs mapped by auth method. (Enterprise)
- **Teams:** Add TeamRolePicker to the Create and Edit Team pages. [#53775](https://github.com/grafana/grafana/pull/53775), [@mgyongyosi](https://github.com/mgyongyosi)
- **Tempo:** Set the default query type even if queryType was set to 'clear'. [#53887](https://github.com/grafana/grafana/pull/53887), [@CrypticSignal](https://github.com/CrypticSignal)
- **Tempo:** Wrap the autocomplete value for a tag in double quotes. [#55610](https://github.com/grafana/grafana/pull/55610), [@CrypticSignal](https://github.com/CrypticSignal)
- **TextPanel:** Support code formats. [#53850](https://github.com/grafana/grafana/pull/53850), [@ryantxu](https://github.com/ryantxu)
- **TimeRangePicker:** Absolute timeranges with timezone. [#53763](https://github.com/grafana/grafana/pull/53763), [@mdvictor](https://github.com/mdvictor)
- **TimeSeries:** Support for log scale and negative numbers. [#54812](https://github.com/grafana/grafana/pull/54812), [@leeoniya](https://github.com/leeoniya)
- **TopNav:** Panel edit changes. [#54746](https://github.com/grafana/grafana/pull/54746), [@torkelo](https://github.com/torkelo)
- **Tracing:** Add new [tracing.opentelemetry] custom_attributes config setting. [#54110](https://github.com/grafana/grafana/pull/54110), [@hairyhenderson](https://github.com/hairyhenderson)
- **Transformations:** Add support for an inner join transformation. [#53865](https://github.com/grafana/grafana/pull/53865), [@AlexKaracaoglu](https://github.com/AlexKaracaoglu)
- **Transformers:** Support inner vs outer join. [#53913](https://github.com/grafana/grafana/pull/53913), [@ryantxu](https://github.com/ryantxu)
- **User management:** Use HMAC-SHA256 to generate time limit codes (password reset tokens). [#42334](https://github.com/grafana/grafana/pull/42334), [@andreasgerstmayr](https://github.com/andreasgerstmayr)
- **UsersTable:** Display Disabled flag in Organizations' Users table. [#53656](https://github.com/grafana/grafana/pull/53656), [@mgyongyosi](https://github.com/mgyongyosi)
- **Various Panels:** Add ability to toggle legend with keyboard shortcut. (Enterprise)

### Bug fixes

- **Alerting:** AlertingProxy to elevate permissions for request forwarded to data proxy when RBAC enabled. [#53620](https://github.com/grafana/grafana/pull/53620), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Auth:** Allow admins to manually change external user's role if `oauth_skip_org_role_update_sync` or saml `skip_org_role_sync` is enabled. [#55182](https://github.com/grafana/grafana/pull/55182), [@Jguer](https://github.com/Jguer)
- **AuthNZ:** Security fixes for CVE-2022-35957 and CVE-2022-36062. [#55503](https://github.com/grafana/grafana/pull/55503), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **ContextHandler:** Use standard library style middleware. [#54219](https://github.com/grafana/grafana/pull/54219), [@sakjur](https://github.com/sakjur)
- **ElasticSearch:** Fix lucene formatted variables being wrongly escaped. [#54981](https://github.com/grafana/grafana/pull/54981), [@svennergr](https://github.com/svennergr)
- **FIX:** RBAC prevents deleting empty snapshots. [#54385](https://github.com/grafana/grafana/pull/54385), [@gamab](https://github.com/gamab)
- **Fix:** Adjusting plugin.json schema regex. [#54515](https://github.com/grafana/grafana/pull/54515), [@tolzhabayev](https://github.com/tolzhabayev)
- **Fix:** Wrong swagger meta preventing spec generation. [#54181](https://github.com/grafana/grafana/pull/54181), [@leandro-deveikis](https://github.com/leandro-deveikis)
- **Histogram:** Fix panel hide when clicking on legend. [#53651](https://github.com/grafana/grafana/pull/53651), [@mdvictor](https://github.com/mdvictor)
- **Loki:** Hide loki sample queries from query inspector. [#55158](https://github.com/grafana/grafana/pull/55158), [@ivanahuckova](https://github.com/ivanahuckova)
- **Query Builder:** Fix spelling of "lose" in user visible message. [#53435](https://github.com/grafana/grafana/pull/53435), [@spazm](https://github.com/spazm)
- **RBAC:** Fix resolver issue on wildcard resulting in wrong status code for endpoints. [#54208](https://github.com/grafana/grafana/pull/54208), [@kalleep](https://github.com/kalleep)
- **Reports:** Fix starting value. (Enterprise)
- **StatPanel:** Add padding between horizontal name and value. [#55299](https://github.com/grafana/grafana/pull/55299), [@JoaoSilvaGrafana](https://github.com/JoaoSilvaGrafana)
- **TablePanel:** Fix FooterRow styling for Safari and Firefox. [#55543](https://github.com/grafana/grafana/pull/55543), [@mdvictor](https://github.com/mdvictor)
- **TablePanel:** Fix vertical scrollbar. [#53457](https://github.com/grafana/grafana/pull/53457), [@mdvictor](https://github.com/mdvictor)
- **Tempo:** Fix typo in the tooltip for "Limit". [#53750](https://github.com/grafana/grafana/pull/53750), [@CrypticSignal](https://github.com/CrypticSignal)
- **Transformations:** Fix clearing of transformation select fields. [#53916](https://github.com/grafana/grafana/pull/53916), [@AlexKaracaoglu](https://github.com/AlexKaracaoglu)
- **Various Panels:** Fix Single right-aligned y-axis hiding gridlines. [#54206](https://github.com/grafana/grafana/pull/54206), [@gitstart](https://github.com/gitstart)

### Breaking changes

Dashboards: Remove the ability to open dashboard settings while panel edit is still open. Issue [#54746](https://github.com/grafana/grafana/issues/54746)

In InfluxDB, browser access mode was deprecated in Grafana 8.0.0 and removed in 9.2.0. If you used this mode, please switch to server access mode on the datasource configuration page. Issue [#53529](https://github.com/grafana/grafana/issues/53529)

In Prometheus, browser access mode was deprecated in Grafana 7.4.0 and removed in 9.2.0. If you used this mode, please switch to server access mode on the datasource configuration page. Issue [#50162](https://github.com/grafana/grafana/issues/50162)

Password reset links sent before the upgrade will no longer work and have to be resent. Since the duration of those links are only two hours we decided to not support both token formats. Issue [#42334](https://github.com/grafana/grafana/issues/42334)

### Deprecations

Google Analytics 'Universal Analytics' is deprecated by Google in favor of Google Analytics 4. See [Google's deprecation notice](https://support.google.com/analytics/answer/10089681?hl=en) for more details. After July 2023, Grafana's Google Analytics 'Universal Analytics' integration will be removed, along with the `analytics.google_analytics_ua_id` server config property. Configure Google Analytics 4 using the `analytics.google_analytics_4_id` server config property.
Issue [#55446](https://github.com/grafana/grafana/issues/55446)

The following components and functions related to logs are deprecated in the `grafana-ui` package: `LogLabels`, `LogMessageAnsi`, `LogRows`, `getLogRowStyles`.
Issue [#55364](https://github.com/grafana/grafana/issues/55364)

### Plugin development fixes & changes

- **GrafanaUI:** Add required behavior to Inline Field. [#54867](https://github.com/grafana/grafana/pull/54867), [@gefgu](https://github.com/gefgu)
- **CustomScrollbar:** Add optional scroll indicators to `CustomScrollbar`. [#54705](https://github.com/grafana/grafana/pull/54705), [@ashharrison90](https://github.com/ashharrison90)
- **Build:** Introduce ESM and Treeshaking to NPM package builds. [#51517](https://github.com/grafana/grafana/pull/51517), [@jackw](https://github.com/jackw)

<!-- 9.1.8 START -->

# 9.1.8 (2022-10-11)

### Features and enhancements

- **Alerting:** Update imported prometheus alertmanager version. Backport (#56228). [#56429](https://github.com/grafana/grafana/pull/56429), [@joeblubaugh](https://github.com/joeblubaugh)
- **Chore:** Upgrade Go to 1.19.2. [#56355](https://github.com/grafana/grafana/pull/56355), [@sakjur](https://github.com/sakjur)

### Bug fixes

- **Alerting:** Fix evaluation interval validation. [#56115](https://github.com/grafana/grafana/pull/56115), [@konrad147](https://github.com/konrad147)
- **Alerting:** Fix migration to create rules with group index 1. [#56511](https://github.com/grafana/grafana/pull/56511), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Fix migration to not add label "alertname". [#56509](https://github.com/grafana/grafana/pull/56509), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Azure Monitor:** Fix empty Logs response for Alerting. [#56378](https://github.com/grafana/grafana/pull/56378), [@andresmgot](https://github.com/andresmgot)
- **Azure Monitor:** Fix subscription selector when changing data sources. [#56284](https://github.com/grafana/grafana/pull/56284), [@andresmgot](https://github.com/andresmgot)
- **Caching:** Fix wrong memcached setting name in defaults. (Enterprise)
- **Google Cloud Monitoring:** Fix bucket bound for distributions. [#56565](https://github.com/grafana/grafana/pull/56565), [@andresmgot](https://github.com/andresmgot)

<!-- 9.1.8 END -->

<!-- 9.1.7 START -->

# 9.1.7 (2022-10-04)

### Features and enhancements

- **Chore:** Upgrade Go version to 1.19.1 (backport). [#55733](https://github.com/grafana/grafana/pull/55733), [@sakjur](https://github.com/sakjur)
- **CloudWatch:** Add missing AWS/Prometheus metrics. [#54990](https://github.com/grafana/grafana/pull/54990), [@jangaraj](https://github.com/jangaraj)
- **Explore:** Add feature tracking events. [#54514](https://github.com/grafana/grafana/pull/54514), [@L-M-K-B](https://github.com/L-M-K-B)
- **Graphite:** Add error information to graphite queries tracing. [#55249](https://github.com/grafana/grafana/pull/55249), [@jesusvazquez](https://github.com/jesusvazquez)
- **Prometheus:** Restore FromAlert header. [#55255](https://github.com/grafana/grafana/pull/55255), [@kylebrandt](https://github.com/kylebrandt)
- **SAML:** Account for all orgs in org_mapping (#3855). (Enterprise)
- **Search:** Add search index configuration options. [#55525](https://github.com/grafana/grafana/pull/55525), [@ArturWierzbicki](https://github.com/ArturWierzbicki)
- **Thresholds:** Add option for dashed line style. [#55875](https://github.com/grafana/grafana/pull/55875), [@leeoniya](https://github.com/leeoniya)

### Bug fixes

- **Alerting:** Fix default query's data source when no default datasource specified. [#55435](https://github.com/grafana/grafana/pull/55435), [@konrad147](https://github.com/konrad147)
- **Alerting:** Fix mathexp.NoData cannot be reduced. [#55347](https://github.com/grafana/grafana/pull/55347), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Skip unsupported file types on provisioning. [#55573](https://github.com/grafana/grafana/pull/55573), [@JohnnyQQQQ](https://github.com/JohnnyQQQQ)
- **AzureMonitor:** Ensure resourceURI template variable is migrated. [#56095](https://github.com/grafana/grafana/pull/56095), [@aangelisc](https://github.com/aangelisc)
- **Dashboard:** Fix plugin dashboard save as button. [#55197](https://github.com/grafana/grafana/pull/55197), [@lpskdl](https://github.com/lpskdl)
- **Docs:** Fix decimals: auto docs for panel edit. [#55477](https://github.com/grafana/grafana/pull/55477), [@joshhunt](https://github.com/joshhunt)
- **Fix:** RBAC handle `error no resolver` found. [#55676](https://github.com/grafana/grafana/pull/55676), [@gamab](https://github.com/gamab)
- **Fix:** RBAC handle `error no resolver` found. (Enterprise)
- **LibraryPanelSearch:** Refactor and fix hyphen issue. [#55314](https://github.com/grafana/grafana/pull/55314), [@kaydelaney](https://github.com/kaydelaney)
- **Live:** Fix live streaming with `live-service-web-worker` feature flag enabled. [#55528](https://github.com/grafana/grafana/pull/55528), [@ArturWierzbicki](https://github.com/ArturWierzbicki)
- **QueryField:** Fix wrong cursor position on autocomplete. [#55576](https://github.com/grafana/grafana/pull/55576), [@svennergr](https://github.com/svennergr)

<!-- 9.1.7 END -->
<!-- 9.2.0-beta1 END -->
<!-- 9.1.6 START -->

# 9.1.6 (2022-09-20)

### Features and enhancements

- **Auth:** Trigger auth token cleanup job. (Enterprise)
- **DataSource:** Adding possibility to hide queries from the inspector. [#54892](https://github.com/grafana/grafana/pull/54892), [@mckn](https://github.com/mckn)
- **Inspect:** Hide Actions tab when it is empty. [#55272](https://github.com/grafana/grafana/pull/55272), [@ryantxu](https://github.com/ryantxu)
- **PanelMenu:** Remove hide legend action as it was showing on all panel types. [#54876](https://github.com/grafana/grafana/pull/54876), [@torkelo](https://github.com/torkelo)
- **Provisioning Contact points:** Support disableResolveMessage via YAML. [#54122](https://github.com/grafana/grafana/pull/54122), [@mmusenbr](https://github.com/mmusenbr)
- **PublicDashboards:** Support subpaths when generating pubdash url. [#55204](https://github.com/grafana/grafana/pull/55204), [@owensmallwood](https://github.com/owensmallwood)

### Bug fixes

- **Alerting:** Fix legacy migration crash when rule name is too long. [#55053](https://github.com/grafana/grafana/pull/55053), [@alexweav](https://github.com/alexweav)
- **Alerting:** Fix send resolved notifications. [#54793](https://github.com/grafana/grafana/pull/54793), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Azure Monitor:** Fix migration issue with MetricDefinitionsQuery template variable query types. [#55262](https://github.com/grafana/grafana/pull/55262), [@yaelleC](https://github.com/yaelleC)
- **Browse:** Hide dashboard actions if user does not have enough permission. [#55218](https://github.com/grafana/grafana/pull/55218), [@lpskdl](https://github.com/lpskdl)
- **ElasticSearch:** Fix dispatching queries at a wrong time. [#55225](https://github.com/grafana/grafana/pull/55225), [@svennergr](https://github.com/svennergr)
- **Panel:** Disable legends when showLegend is false prior to schema v37. [#55126](https://github.com/grafana/grafana/pull/55126), [@ivanortegaalba](https://github.com/ivanortegaalba)
- **Prometheus:** Fix metadata requests for browser access mode. [#55403](https://github.com/grafana/grafana/pull/55403), [@itsmylife](https://github.com/itsmylife)
- **Search:** Avoid requesting all dashboards when in Folder View. [#55169](https://github.com/grafana/grafana/pull/55169), [@JoaoSilvaGrafana](https://github.com/JoaoSilvaGrafana)
- **TablePanel/StatPanel:** Fix values not being visible when background transparent. [#55092](https://github.com/grafana/grafana/pull/55092), [@mdvictor](https://github.com/mdvictor)

<!-- 9.1.6 END -->
<!-- 9.1.5 START -->

# 9.1.5 (2022-09-12)

### Features and enhancements

- **Alerting:** Sanitize invalid label/annotation names for external alertmanagers. [#54537](https://github.com/grafana/grafana/pull/54537), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Telegram: Truncate long messages to avoid send error. [#54339](https://github.com/grafana/grafana/pull/54339), [@ZloyDyadka](https://github.com/ZloyDyadka)
- **DisplayProcessor:** Handle reverse-ordered data when auto-showing millis. [#54923](https://github.com/grafana/grafana/pull/54923), [@leeoniya](https://github.com/leeoniya)
- **Heatmap:** Add option to reverse color scheme. [#54365](https://github.com/grafana/grafana/pull/54365), [@leeoniya](https://github.com/leeoniya)
- **PluginLoader:** Alias slate-react as @grafana/slate-react. [#55027](https://github.com/grafana/grafana/pull/55027), [@kaydelaney](https://github.com/kaydelaney)
- **Search:** Add substring matcher, to bring back the old dashboard search behavior. [#54813](https://github.com/grafana/grafana/pull/54813), [@ArturWierzbicki](https://github.com/ArturWierzbicki)
- **Traces:** More visible span colors. [#54513](https://github.com/grafana/grafana/pull/54513), [@joey-grafana](https://github.com/joey-grafana)

### Bug fixes

- **Alerting:** Fix incorrect propagation of org ID and other fields in rule provisioning endpoints. [#54603](https://github.com/grafana/grafana/pull/54603), [@alexweav](https://github.com/alexweav)
- **Alerting:** Resetting the notification policy tree to the default policy will also restore default contact points. [#54608](https://github.com/grafana/grafana/pull/54608), [@alexweav](https://github.com/alexweav)
- **AzureMonitor:** Fix custom namespaces. [#54937](https://github.com/grafana/grafana/pull/54937), [@asimpson](https://github.com/asimpson)
- **AzureMonitor:** Fix issue where custom metric namespaces are not included in the metric namespace list. [#54826](https://github.com/grafana/grafana/pull/54826), [@andresmgot](https://github.com/andresmgot)
- **CloudWatch:** Fix display name of metric and namespace. [#54860](https://github.com/grafana/grafana/pull/54860), [@sunker](https://github.com/sunker)
- **Cloudwatch:** Fix annotation query serialization issue. [#54884](https://github.com/grafana/grafana/pull/54884), [@sunker](https://github.com/sunker)
- **Dashboard:** Fix issue where unsaved changes warning would appear even after save, and not being able to change library panels. [#54706](https://github.com/grafana/grafana/pull/54706), [@torkelo](https://github.com/torkelo)
- **Dashboard:** Hide overflow content for single left pane. [#54882](https://github.com/grafana/grafana/pull/54882), [@lpskdl](https://github.com/lpskdl)
- **Loki:** Fix a bug where adding adhoc filters was not possible. [#54920](https://github.com/grafana/grafana/pull/54920), [@svennergr](https://github.com/svennergr)
- **Reports:** Fix handling expired state. (Enterprise)

<!-- 9.1.5 END -->
<!-- 9.1.4 START -->

# 9.1.4 (2022-09-09)

### Bug fixes

- **GrafanaUI:** Fixes Chrome issue for various query fields. [#54566](https://github.com/grafana/grafana/pull/54566), [@kaydelaney](https://github.com/kaydelaney)

<!-- 9.1.4 END -->
<!-- 9.1.3 START -->

# 9.1.3 (2022-09-05)

### Features and enhancements

- **API:** Do not expose user input in datasource error responses. [#53483](https://github.com/grafana/grafana/pull/53483), [@papagian](https://github.com/papagian)
- **Alerting:** Write and Delete multiple alert instances. [#54072](https://github.com/grafana/grafana/pull/54072), [@joeblubaugh](https://github.com/joeblubaugh)
- **Library Panel:** Allow to delete them when deprecated. [#54662](https://github.com/grafana/grafana/pull/54662), [@ivanortegaalba](https://github.com/ivanortegaalba)
- **Plugins Catalog:** Allow to filter plugins using special characters. [#54474](https://github.com/grafana/grafana/pull/54474), [@murtazaqa](https://github.com/murtazaqa)

### Bug fixes

- **Alerting:** Fix UI bug when setting custom notification policy group by. [#54607](https://github.com/grafana/grafana/pull/54607), [@JacobsonMT](https://github.com/JacobsonMT)
- **AppRootPage:** Fix issue navigating between two app plugin pages. [#54519](https://github.com/grafana/grafana/pull/54519), [@torkelo](https://github.com/torkelo)
- **Correlations:** Use correct fallback handlers. [#54511](https://github.com/grafana/grafana/pull/54511), [@kalleep](https://github.com/kalleep)
- **FIX:** RBAC prevents deleting empty snapshots (#54385). [#54510](https://github.com/grafana/grafana/pull/54510), [@gamab](https://github.com/gamab)
- **LibraryElements:** Fix inability to delete library panels under MySQL. [#54600](https://github.com/grafana/grafana/pull/54600), [@kaydelaney](https://github.com/kaydelaney)
- **Metrics:** fix `grafana_database_conn_*` metrics, and add new `go_sql_stats_*` metrics as eventual replacement. [#54405](https://github.com/grafana/grafana/pull/54405), [@hairyhenderson](https://github.com/hairyhenderson)
- **TestData DB:** Fix node graph not showing when the `Data type` field is set to `random`. [#54298](https://github.com/grafana/grafana/pull/54298), [@CrypticSignal](https://github.com/CrypticSignal)

### Deprecations

The `grafana_database_conn_*` metrics are deprecated, and will be removed in a future version of Grafana. Use the `go_sql_stats_*` metrics instead. Issue [#54405](https://github.com/grafana/grafana/issues/54405)

<!-- 9.1.3 END -->
<!-- 9.1.2 START -->

# 9.1.2 (2022-08-30)

### Features and enhancements

- **AdHoc variable:** Correctly preselect datasource when provisioning. [#54088](https://github.com/grafana/grafana/pull/54088), [@dprokop](https://github.com/dprokop)
- **AzureMonitor:** Added ARG query function for template variables. [#53059](https://github.com/grafana/grafana/pull/53059), [@yaelleC](https://github.com/yaelleC)
- **Dashboard save:** Persist details message when navigating through dashboard save drawer's tabs. [#54084](https://github.com/grafana/grafana/pull/54084), [@vbeskrovnov](https://github.com/vbeskrovnov)
- **Dashboards:** Correctly migrate mixed data source targets. [#54152](https://github.com/grafana/grafana/pull/54152), [@dprokop](https://github.com/dprokop)
- **Elasticsearch:** Use millisecond intervals for alerting. [#54157](https://github.com/grafana/grafana/pull/54157), [@gabor](https://github.com/gabor)
- **Elasticsearch:** Use millisecond intervals in frontend. [#54202](https://github.com/grafana/grafana/pull/54202), [@gabor](https://github.com/gabor)
- **Geomap:** Local color range. [#54348](https://github.com/grafana/grafana/pull/54348), [@adela-almasan](https://github.com/adela-almasan)
- **Plugins Catalog:** Use appSubUrl to generate plugins catalog urls. [#54426](https://github.com/grafana/grafana/pull/54426), [@academo](https://github.com/academo)
- **Rendering:** Add support for renderer token. [#54425](https://github.com/grafana/grafana/pull/54425), [@joanlopez](https://github.com/joanlopez)

### Bug fixes

- **Alerting:** Fix saving of screenshots uploaded with a signed url. [#53933](https://github.com/grafana/grafana/pull/53933), [@VDVsx](https://github.com/VDVsx)
- **AngularPanels:** Fixing changing angular panel options not taking having affect when coming back from panel edit. [#54087](https://github.com/grafana/grafana/pull/54087), [@torkelo](https://github.com/torkelo)
- **Explore:** Improve a11y of query row collapse button. [#53827](https://github.com/grafana/grafana/pull/53827), [@L-M-K-B](https://github.com/L-M-K-B)
- **Geomap:** Fix tooltip display. [#54245](https://github.com/grafana/grafana/pull/54245), [@adela-almasan](https://github.com/adela-almasan)
- **QueryEditorRow:** Filter data on mount. [#54260](https://github.com/grafana/grafana/pull/54260), [@asimpson](https://github.com/asimpson)
- **Search:** Show all dashboards in the folder view. [#54163](https://github.com/grafana/grafana/pull/54163), [@ryantxu](https://github.com/ryantxu)
- **Tracing:** Fix the event attributes in opentelemetry tracing. [#54117](https://github.com/grafana/grafana/pull/54117), [@ying-jeanne](https://github.com/ying-jeanne)

### Plugin development fixes & changes

- **GrafanaUI:** Fix styles for invalid selects & DataSourcePicker. [#53476](https://github.com/grafana/grafana/pull/53476), [@Elfo404](https://github.com/Elfo404)

<!-- 9.1.2 END -->
<!-- 9.1.1 START -->

# 9.1.1 (2022-08-23)

### Features and enhancements

- **Cloud Monitoring:** Support SLO burn rate. [#53710](https://github.com/grafana/grafana/pull/53710), [@itkq](https://github.com/itkq)
- **Schema:** Restore "hidden" in LegendDisplayMode. [#53925](https://github.com/grafana/grafana/pull/53925), [@academo](https://github.com/academo)
- **Timeseries:** Revert the timezone(s) property name change back to singular. [#53926](https://github.com/grafana/grafana/pull/53926), [@academo](https://github.com/academo)

### Bug fixes

- **Alerting:** Fix links in Microsoft Teams notifications. [#54003](https://github.com/grafana/grafana/pull/54003), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Fix notifications for Microsoft Teams. [#53810](https://github.com/grafana/grafana/pull/53810), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Fix width of Adaptive Cards in Teams notifications. [#53996](https://github.com/grafana/grafana/pull/53996), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **ColorPickerInput:** Fix popover in disabled state. [#54000](https://github.com/grafana/grafana/pull/54000), [@Clarity-89](https://github.com/Clarity-89)
- **Decimals:** Fixes auto decimals to behave the same for positive and negative values. [#53960](https://github.com/grafana/grafana/pull/53960), [@JoaoSilvaGrafana](https://github.com/JoaoSilvaGrafana)
- **Loki:** Fix unique log row id generation. [#53932](https://github.com/grafana/grafana/pull/53932), [@gabor](https://github.com/gabor)
- **Plugins:** Fix file extension in development authentication guide. [#53838](https://github.com/grafana/grafana/pull/53838), [@pbzona](https://github.com/pbzona)
- **TimeSeries:** Fix jumping legend issue. [#53671](https://github.com/grafana/grafana/pull/53671), [@zoltanbedi](https://github.com/zoltanbedi)
- **TimeSeries:** Fix memory leak on viz re-init caused by KeyboardPlugin. [#53872](https://github.com/grafana/grafana/pull/53872), [@leeoniya](https://github.com/leeoniya)

### Plugin development fixes & changes

- **TimePicker:** Fixes relative timerange of less than a day not displaying. [#53975](https://github.com/grafana/grafana/pull/53975), [@JoaoSilvaGrafana](https://github.com/JoaoSilvaGrafana)
- **GrafanaUI:** Fixes ClipboardButton to always keep multi line content. [#53903](https://github.com/grafana/grafana/pull/53903), [@JoaoSilvaGrafana](https://github.com/JoaoSilvaGrafana)

<!-- 9.1.1 END -->
<!-- 9.1.0 START -->

# 9.1.0 (2022-08-16)

### Features and enhancements

- **API:** Allow creating teams with a user defined identifier. [#48710](https://github.com/grafana/grafana/pull/48710), [@papagian](https://github.com/papagian)
- **Alerting:** Adds interval and For to alert rule details. [#53211](https://github.com/grafana/grafana/pull/53211), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Extend PUT rule-group route to write the entire rule group rather than top-level fields only. [#53078](https://github.com/grafana/grafana/pull/53078), [@alexweav](https://github.com/alexweav)
- **Alerting:** Use Adaptive Cards in Teams notifications. [#53532](https://github.com/grafana/grafana/pull/53532), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Azure Monitor:** Add Network Insights Dashboard. [#50362](https://github.com/grafana/grafana/pull/50362), [@Teddy-Lin](https://github.com/Teddy-Lin)
- **Chore:** Improve logging of unrecoverable errors. [#53664](https://github.com/grafana/grafana/pull/53664), [@sakjur](https://github.com/sakjur)
- **Correlations:** Add UpdateCorrelation HTTP API. [#52444](https://github.com/grafana/grafana/pull/52444), [@Elfo404](https://github.com/Elfo404)
- **Dashboard:** Reverted the changes of hiding multi-select and all variable in the datasource picker. [#53521](https://github.com/grafana/grafana/pull/53521), [@lpskdl](https://github.com/lpskdl)
- **Geomap:** Add alpha day/night layer. [#50201](https://github.com/grafana/grafana/pull/50201), [@ryantxu](https://github.com/ryantxu)
- **Geomap:** Add measuring tools. [#51608](https://github.com/grafana/grafana/pull/51608), [@drew08t](https://github.com/drew08t)
- **GrafanaUI:** Add success state to ClipboardButton. [#52069](https://github.com/grafana/grafana/pull/52069), [@evictorero](https://github.com/evictorero)
- **Heatmap:** Replace the heatmap panel with new implementation. [#50229](https://github.com/grafana/grafana/pull/50229), [@ryantxu](https://github.com/ryantxu)
- **KVStore:** Allow empty value in kv_store. [#53416](https://github.com/grafana/grafana/pull/53416), [@spinillos](https://github.com/spinillos)
- **Prometheus:** Promote Azure auth flag to configuration. [#53447](https://github.com/grafana/grafana/pull/53447), [@andresmgot](https://github.com/andresmgot)
- **Reports:** Save and update in reports should be transactional. (Enterprise)
- **Reports:** Set uid when we don't receive it in the query. (Enterprise)
- **Search:** Display only dashboards in General folder of Search Folder View. [#53607](https://github.com/grafana/grafana/pull/53607), [@lpskdl](https://github.com/lpskdl)
- **Status history/State timeline:** Support datalinks. [#50226](https://github.com/grafana/grafana/pull/50226), [@jloupdef](https://github.com/jloupdef)
- **Transform:** Add a limit transform. [#49291](https://github.com/grafana/grafana/pull/49291), [@josiahg](https://github.com/josiahg)
- **Transformations:** Add standard deviation and variance reducers. [#49753](https://github.com/grafana/grafana/pull/49753), [@selvavm](https://github.com/selvavm)

### Bug fixes

- **API:** Fix snapshot responses. [#52998](https://github.com/grafana/grafana/pull/52998), [@papagian](https://github.com/papagian)
- **Access Control:** Fix permission error during dashboard creation flow. [#53214](https://github.com/grafana/grafana/pull/53214), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Access Control:** Set permissions for Grafana's test data source. [#53247](https://github.com/grafana/grafana/pull/53247), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Alerting:** Fix migration failure. [#53253](https://github.com/grafana/grafana/pull/53253), [@papagian](https://github.com/papagian)
- **BarGauge:** Show empty bar when value, minValue and maxValue are all equal. [#53314](https://github.com/grafana/grafana/pull/53314), [@ashharrison90](https://github.com/ashharrison90)
- **Dashboard:** Fix color of bold and italics text in panel description tooltip. [#53380](https://github.com/grafana/grafana/pull/53380), [@joshhunt](https://github.com/joshhunt)
- **Loki:** Fix passing of query with defaults to code mode. [#53646](https://github.com/grafana/grafana/pull/53646), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Fix producing correct log volume query for query with comments. [#53254](https://github.com/grafana/grafana/pull/53254), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Fix showing of unusable labels field in detected fields. [#53319](https://github.com/grafana/grafana/pull/53319), [@ivanahuckova](https://github.com/ivanahuckova)
- **Reports:** Fix inconsistency reports. (Enterprise)
- **Tracing:** Fix OpenTelemetry Jaeger context propagation. [#53269](https://github.com/grafana/grafana/pull/53269), [@zhichli](https://github.com/zhichli)
- **Tracing:** Fix OpenTelemetry Jaeger context propagation (#53269). [#53724](https://github.com/grafana/grafana/pull/53724), [@idafurjes](https://github.com/idafurjes)
- **[9.1.x] Alerting:** AlertingProxy to elevate permissions for request forwarded to data proxy when RBAC enabled. [#53679](https://github.com/grafana/grafana/pull/53679), [@yuri-tceretian](https://github.com/yuri-tceretian)

### Breaking changes

Alert notifications to Microsoft Teams now use Adaptive Cards instead of Office 365 Connector Cards. Issue [#53532](https://github.com/grafana/grafana/issues/53532)

Starting at 9.1.0, existing heatmap panels will start using a new implementation. This can be disabled by setting the `useLegacyHeatmapPanel` feature flag to true. It can be tested on a single dashbobard by adding `?__feature.useLegacyHeatmapPanel=true` to any dashboard URL. Please report any [heatmap migration issues.](https://github.com/grafana/grafana/issues/new/choose). The most notable changes are:

- Significantly improved rendering performance
- When calculating heatmaps, the buckets are now placed on reasonable borders (1m, 5m, 30s etc)
- Round cells are no longer supported
  Issue [#50229](https://github.com/grafana/grafana/issues/50229)

### Plugin development fixes & changes

- **Plugins:** Only pass `rootUrls` field in request when not empty. [#53135](https://github.com/grafana/grafana/pull/53135), [@wbrowne](https://github.com/wbrowne)

<!-- 9.1.0 END -->
<!-- 9.1.0-beta1 START -->

# 9.1.0-beta1 (unreleased)

### Features and enhancements

- **API:** Migrate CSRF to service and support additional options. [#48120](https://github.com/grafana/grafana/pull/48120), [@sakjur](https://github.com/sakjur)
- **API:** Move swagger definitions to the handlers and rename operations after them. [#52643](https://github.com/grafana/grafana/pull/52643), [@papagian](https://github.com/papagian)
- **Access Control:** Allow org admins to invite new users. [#52894](https://github.com/grafana/grafana/pull/52894), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **AccessControl:** Check dashboards permission for reports. (Enterprise)
- **Alerting:** Add config disabled_labels to disable reserved labels. [#51832](https://github.com/grafana/grafana/pull/51832), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Add custom templated title to Wecom notifier. [#51529](https://github.com/grafana/grafana/pull/51529), [@dingweiqings](https://github.com/dingweiqings)
- **Alerting:** Add file provisioning for alert rules. [#51635](https://github.com/grafana/grafana/pull/51635), [@JohnnyQQQQ](https://github.com/JohnnyQQQQ)
- **Alerting:** Add file provisioning for contact points. [#51924](https://github.com/grafana/grafana/pull/51924), [@JohnnyQQQQ](https://github.com/JohnnyQQQQ)
- **Alerting:** Add file provisioning for mute timings. [#52936](https://github.com/grafana/grafana/pull/52936), [@JohnnyQQQQ](https://github.com/JohnnyQQQQ)
- **Alerting:** Add file provisioning for notification policies. [#52877](https://github.com/grafana/grafana/pull/52877), [@JohnnyQQQQ](https://github.com/JohnnyQQQQ)
- **Alerting:** Add file provisioning for text templates. [#52952](https://github.com/grafana/grafana/pull/52952), [@JohnnyQQQQ](https://github.com/JohnnyQQQQ)
- **Alerting:** Add first Grafana reserved label grafana_folder. [#50262](https://github.com/grafana/grafana/pull/50262), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Add support for images in Kafka alerts. [#50758](https://github.com/grafana/grafana/pull/50758), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Add support for images in VictorOps alerts. [#50759](https://github.com/grafana/grafana/pull/50759), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Adds contact point template syntax highlighting. [#51559](https://github.com/grafana/grafana/pull/51559), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Adds visual tokens for templates. [#51376](https://github.com/grafana/grafana/pull/51376), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Alert rules pagination. [#50612](https://github.com/grafana/grafana/pull/50612), [@konrad147](https://github.com/konrad147)
- **Alerting:** Change **alertScreenshotToken** to **alertImageToken**. [#50771](https://github.com/grafana/grafana/pull/50771), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Configure alert manager data source as an external AM. [#52081](https://github.com/grafana/grafana/pull/52081), [@konrad147](https://github.com/konrad147)
- **Alerting:** Do not include button in googlechat notification if URL invalid. [#47317](https://github.com/grafana/grafana/pull/47317), [@j6s](https://github.com/j6s)
- **Alerting:** Group alert state history by labels and allow filtering. [#52784](https://github.com/grafana/grafana/pull/52784), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Make ticker to tick at predictable time. [#50197](https://github.com/grafana/grafana/pull/50197), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Persist rule position in the group. [#50051](https://github.com/grafana/grafana/pull/50051), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Prevent evaluation if "for" shorter than "evaluate". [#51797](https://github.com/grafana/grafana/pull/51797), [@peterholmberg](https://github.com/peterholmberg)
- **Alerting:** Provisioning UI. [#50776](https://github.com/grafana/grafana/pull/50776), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Rule api to fail update if provisioned rules are affected. [#50835](https://github.com/grafana/grafana/pull/50835), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Scheduler to drop ticks if a rule's evaluation is too slow. [#48885](https://github.com/grafana/grafana/pull/48885), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Show evaluation interval global limit warning. [#52942](https://github.com/grafana/grafana/pull/52942), [@konrad147](https://github.com/konrad147)
- **Alerting:** State manager to use tick time to determine stale states. [#50991](https://github.com/grafana/grafana/pull/50991), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Support for optimistic locking for alert rules. [#50274](https://github.com/grafana/grafana/pull/50274), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Update RBAC for alert rules to consider access to rule as access to group it belongs. [#49033](https://github.com/grafana/grafana/pull/49033), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Update default route groupBy to [grafana_folder, alertname]. [#50052](https://github.com/grafana/grafana/pull/50052), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alertmanager:** Adding SigV4 Authentication to Alertmanager Datasource. [#49718](https://github.com/grafana/grafana/pull/49718), [@lewinkedrs](https://github.com/lewinkedrs)
- **Analytics:** Save all view time dates as UTC. (Enterprise)
- **Annotations:** Migrate dashboardId to dashboardUID. [#52588](https://github.com/grafana/grafana/pull/52588), [@lpskdl](https://github.com/lpskdl)
- **Auditing:** Allow users to have more verbose logs. (Enterprise)
- **Auth:** Add lookup params for saml and LDAP sync. (Enterprise)
- **Auth:** Add option for case insensitive login. [#49262](https://github.com/grafana/grafana/pull/49262), [@Jguer](https://github.com/Jguer)
- **Auth:** Case insensitive ids duplicate usagestats. [#50724](https://github.com/grafana/grafana/pull/50724), [@eleijonmarck](https://github.com/eleijonmarck)
- **Auth:** Implement Token URL Auth. [#52578](https://github.com/grafana/grafana/pull/52578), [@Jguer](https://github.com/Jguer)
- **Auth:** Implement Token URL JWT Auth. [#52662](https://github.com/grafana/grafana/pull/52662), [@Jguer](https://github.com/Jguer)
- **Auth:** Lockdown non-editables in frontend when external auth is configured. [#52160](https://github.com/grafana/grafana/pull/52160), [@Jguer](https://github.com/Jguer)
- **Azure Monitor:** Add new dashboard with geo map for app insights test availability. [#52494](https://github.com/grafana/grafana/pull/52494), [@jcolladokuri](https://github.com/jcolladokuri)
- **Azure Monitor:** New template variable editor. [#52594](https://github.com/grafana/grafana/pull/52594), [@andresmgot](https://github.com/andresmgot)
- **Azure Monitor:** Restore Metrics query parameters: subscription, resourceGroup, metricNamespace and resourceName. [#52897](https://github.com/grafana/grafana/pull/52897), [@andresmgot](https://github.com/andresmgot)
- **Chore:** Add dashboard UID as query parameter of Get annotation endpoint. [#52764](https://github.com/grafana/grafana/pull/52764), [@ying-jeanne](https://github.com/ying-jeanne)
- **Chore:** Remove jest-coverage-badges dep from toolkit. [#49883](https://github.com/grafana/grafana/pull/49883), [@zoltanbedi](https://github.com/zoltanbedi)
- **Chore:** Rename dashboardUID to dashboardUIDs in search endpoint and up…. [#52766](https://github.com/grafana/grafana/pull/52766), [@ying-jeanne](https://github.com/ying-jeanne)
- **CloudWatch:** Add default log groups to config page. [#49286](https://github.com/grafana/grafana/pull/49286), [@iwysiu](https://github.com/iwysiu)
- **CommandPalette:** Populate dashboard search when the palette is opened. [#51293](https://github.com/grafana/grafana/pull/51293), [@ryantxu](https://github.com/ryantxu)
- **Core Plugins:** Add support for HTTP logger. [#46578](https://github.com/grafana/grafana/pull/46578), [@toddtreece](https://github.com/toddtreece)
- **Correlations:** Add CreateCorrelation HTTP API. [#51630](https://github.com/grafana/grafana/pull/51630), [@Elfo404](https://github.com/Elfo404)
- **Correlations:** Add DeleteCorrelation HTTP API. [#51801](https://github.com/grafana/grafana/pull/51801), [@Elfo404](https://github.com/Elfo404)
- **Custom branding:** Add UI for setting configuration. (Enterprise)
- **Custom branding:** Add custom branding service (early access). (Enterprise)
- **Data Connections:** Create a new top-level page. [#50018](https://github.com/grafana/grafana/pull/50018), [@leventebalogh](https://github.com/leventebalogh)
- **DataSource:** Allow data source plugins to set query default values. [#49581](https://github.com/grafana/grafana/pull/49581), [@sunker](https://github.com/sunker)
- **Docs:** CSRF add configuration options and documentation for additional headers and origins. [#50473](https://github.com/grafana/grafana/pull/50473), [@eleijonmarck](https://github.com/eleijonmarck)
- **Elasticsearch:** Added `modifyQuery` method to add filters in Explore. [#52313](https://github.com/grafana/grafana/pull/52313), [@svennergr](https://github.com/svennergr)
- **Explore:** Add ability to include tags in trace to metrics queries. [#49433](https://github.com/grafana/grafana/pull/49433), [@connorlindsey](https://github.com/connorlindsey)
- **Explore:** Download and upload service graphs for Tempo. [#50260](https://github.com/grafana/grafana/pull/50260), [@connorlindsey](https://github.com/connorlindsey)
- **Explore:** Make service graph visualization use available vertical space. [#50518](https://github.com/grafana/grafana/pull/50518), [@connorlindsey](https://github.com/connorlindsey)
- **Explore:** Reset Graph overrides if underlying series changes. [#49680](https://github.com/grafana/grafana/pull/49680), [@Elfo404](https://github.com/Elfo404)
- **Explore:** Sort trace process attributes alphabetically. [#51261](https://github.com/grafana/grafana/pull/51261), [@connorlindsey](https://github.com/connorlindsey)
- **Frontend Logging:** Integrate grafana javascript agent. [#50801](https://github.com/grafana/grafana/pull/50801), [@tolzhabayev](https://github.com/tolzhabayev)
- **Geomap:** Add ability to select a data query filter for each layer. [#49966](https://github.com/grafana/grafana/pull/49966), [@mmandrus](https://github.com/mmandrus)
- **Geomap:** Route/path visualization. [#43554](https://github.com/grafana/grafana/pull/43554), [@alexanderzobnin](https://github.com/alexanderzobnin)
- **GeomapPanel:** Add base types to data layer options. [#50053](https://github.com/grafana/grafana/pull/50053), [@drew08t](https://github.com/drew08t)
- **Graph Panel:** Add feature toggle that will allow automatic migration to timeseries panel. [#50631](https://github.com/grafana/grafana/pull/50631), [@ryantxu](https://github.com/ryantxu)
- **Graphite:** Introduce new query types in annotation editor. [#52341](https://github.com/grafana/grafana/pull/52341), [@itsmylife](https://github.com/itsmylife)
- **Infra:** Pass custom headers in resource request. [#51291](https://github.com/grafana/grafana/pull/51291), [@aocenas](https://github.com/aocenas)
- **Insights:** Add RBAC for insights features. (Enterprise)
- **Instrumentation:** Add more buckets to the HTTP request histogram. [#51492](https://github.com/grafana/grafana/pull/51492), [@bergquist](https://github.com/bergquist)
- **Instrumentation:** Collect database connection stats. [#52797](https://github.com/grafana/grafana/pull/52797), [@bergquist](https://github.com/bergquist)
- **Instrumentation:** Convert some metrics to histograms. [#50420](https://github.com/grafana/grafana/pull/50420), [@SuperQ](https://github.com/SuperQ)
- **Jaeger:** Add support for variables. [#50500](https://github.com/grafana/grafana/pull/50500), [@joey-grafana](https://github.com/joey-grafana)
- **LDAP:** Allow specifying LDAP timeout. [#48870](https://github.com/grafana/grafana/pull/48870), [@hannes-256](https://github.com/hannes-256)
- **LibraryPanels:** Require only viewer permissions to use a Library Panel. [#50241](https://github.com/grafana/grafana/pull/50241), [@joshhunt](https://github.com/joshhunt)
- **Licensing:** Usage-based billing reporting enhancements. (Enterprise)
- **Logs:** Handle clicks on legend labels in histogram. [#49931](https://github.com/grafana/grafana/pull/49931), [@gabor](https://github.com/gabor)
- **Logs:** Improve the color for unknown log level. [#52711](https://github.com/grafana/grafana/pull/52711), [@gabor](https://github.com/gabor)
- **Loki/Logs:** Make it possible to copy log values to clipboard. [#50914](https://github.com/grafana/grafana/pull/50914), [@Seyaji](https://github.com/Seyaji)
- **Loki:** Add hint for pipeline error to query builder. [#52134](https://github.com/grafana/grafana/pull/52134), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Add hints for level-like labels. [#52414](https://github.com/grafana/grafana/pull/52414), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Add support for IP label and line filter in query builder. [#52658](https://github.com/grafana/grafana/pull/52658), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Add unwrap with conversion function to builder. [#52639](https://github.com/grafana/grafana/pull/52639), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Implement hints for query builder. [#51795](https://github.com/grafana/grafana/pull/51795), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Move explain section to builder mode. [#52879](https://github.com/grafana/grafana/pull/52879), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Show label options for unwrap operation. [#52810](https://github.com/grafana/grafana/pull/52810), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Support json parser with expressions in query builder. [#51965](https://github.com/grafana/grafana/pull/51965), [@ivanahuckova](https://github.com/ivanahuckova)
- **Navigation:** Display `Starred` dashboards in the `Navbar`. [#51038](https://github.com/grafana/grafana/pull/51038), [@ashharrison90](https://github.com/ashharrison90)
- **Node Graph Panel:** Add options to configure units and arc colors. [#51057](https://github.com/grafana/grafana/pull/51057), [@connorlindsey](https://github.com/connorlindsey)
- **OAuth:** Allow role mapping from GitHub and GitLab groups. [#52407](https://github.com/grafana/grafana/pull/52407), [@Jguer](https://github.com/Jguer)
- **Opentsdb:** Add tag values into the opentsdb response. [#48672](https://github.com/grafana/grafana/pull/48672), [@xy-man](https://github.com/xy-man)
- **OptionsUI:** UnitPicker now supports isClearable setting. [#51064](https://github.com/grafana/grafana/pull/51064), [@ryantxu](https://github.com/ryantxu)
- **PanelEdit:** Hide multi-/all-select datasource variables in datasource picker. [#52142](https://github.com/grafana/grafana/pull/52142), [@eledobleefe](https://github.com/eledobleefe)
- **Piechart:** Implements series override -> hide in area for the legend or tooltip. [#51297](https://github.com/grafana/grafana/pull/51297), [@daniellee](https://github.com/daniellee)
- **Plugin admin:** Add a page to show where panel plugins are used in dashboards. [#50909](https://github.com/grafana/grafana/pull/50909), [@ryantxu](https://github.com/ryantxu)
- **Plugins:** Add validation for plugin manifest. [#52787](https://github.com/grafana/grafana/pull/52787), [@wbrowne](https://github.com/wbrowne)
- **Prometheus:** Move explain section to builder mode. [#52935](https://github.com/grafana/grafana/pull/52935), [@itsmylife](https://github.com/itsmylife)
- **Prometheus:** Support 1ms resolution intervals. [#44707](https://github.com/grafana/grafana/pull/44707), [@dankeder](https://github.com/dankeder)
- **Prometheus:** Throw error on direct access. [#50162](https://github.com/grafana/grafana/pull/50162), [@aocenas](https://github.com/aocenas)
- **RBAC:** Add RBAC for query caching. (Enterprise)
- **RBAC:** Add access control metadata to folder dtos. [#51158](https://github.com/grafana/grafana/pull/51158), [@kalleep](https://github.com/kalleep)
- **RBAC:** Allow app plugins access restriction. [#51524](https://github.com/grafana/grafana/pull/51524), [@gamab](https://github.com/gamab)
- **RBAC:** Rename alerting roles to match naming convention. [#50504](https://github.com/grafana/grafana/pull/50504), [@gamab](https://github.com/gamab)
- **Report:** Calculate grid height unit dynamically instead use hardcode values. (Enterprise)
- **Reports:** Add created column in report_dashboards. (Enterprise)
- **Reports:** Add dashboard title in all pdf pages. (Enterprise)
- **Reports:** Allow saving draft reports. (Enterprise)
- **Reports:** Multiple dashboards improvements. (Enterprise)
- **SAML :** Support Azure Single Sign Out. (Enterprise)
- **SAML:** Add NameIDFormat in SP metadata. (Enterprise)
- **SAML:** Improve debug logs for saml logout. (Enterprise)
- **SSE:** Add noData type. [#51973](https://github.com/grafana/grafana/pull/51973), [@kylebrandt](https://github.com/kylebrandt)
- **Search:** Filter punctuation and tokenize camel case. [#51165](https://github.com/grafana/grafana/pull/51165), [@FZambia](https://github.com/FZambia)
- **Search:** Sync state on read for HA consistency. [#50152](https://github.com/grafana/grafana/pull/50152), [@FZambia](https://github.com/FZambia)
- **Security:** Choose Lookup params per auth module (CVE-2022-31107). [#52312](https://github.com/grafana/grafana/pull/52312), [@Jguer](https://github.com/Jguer)
- **Service Accounts:** Managed permissions for service accounts. [#51818](https://github.com/grafana/grafana/pull/51818), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Service accounts:** Grafana service accounts are enabled by default. [#51402](https://github.com/grafana/grafana/pull/51402), [@vtorosyan](https://github.com/vtorosyan)
- **ServiceAccounts:** Add Prometheus metrics service. [#51831](https://github.com/grafana/grafana/pull/51831), [@Jguer](https://github.com/Jguer)
- **ServiceAccounts:** Add Service Account Token last used at date. [#51446](https://github.com/grafana/grafana/pull/51446), [@Jguer](https://github.com/Jguer)
- **SharePDF:** Use currently selected variables and time range when generating PDF. (Enterprise)
- **Slider:** Enforce numeric constraints and styling within the text input. [#50905](https://github.com/grafana/grafana/pull/50905), [@drew08t](https://github.com/drew08t)
- **State Timeline:** Enable support for annotations. [#47887](https://github.com/grafana/grafana/pull/47887), [@dprokop](https://github.com/dprokop)
- **Table panel:** Add multiple data links support to Default, Image and JSONView cells. [#51162](https://github.com/grafana/grafana/pull/51162), [@dprokop](https://github.com/dprokop)
- **TeamSync:** Remove LDAP specific example from team sync. [#51368](https://github.com/grafana/grafana/pull/51368), [@Jguer](https://github.com/Jguer)
- **TeamSync:** Support case insensitive matches and wildcard groups. (Enterprise)
- **Tempo:** Add context menu to edges. [#52396](https://github.com/grafana/grafana/pull/52396), [@joey-grafana](https://github.com/joey-grafana)
- **Tempo:** Consider tempo search out of beta and remove beta badge and feature flags. [#50030](https://github.com/grafana/grafana/pull/50030), [@connorlindsey](https://github.com/connorlindsey)
- **Tempo:** Tempo/Prometheus links select ds in new tab (cmd + click). [#52319](https://github.com/grafana/grafana/pull/52319), [@joey-grafana](https://github.com/joey-grafana)
- **Time series panel:** Hide axis when series is hidden from the visualization. [#51432](https://github.com/grafana/grafana/pull/51432), [@dprokop](https://github.com/dprokop)
- **TimeSeries:** Add option for symmetrical y axes (align 0). [#52555](https://github.com/grafana/grafana/pull/52555), [@leeoniya](https://github.com/leeoniya)
- **TimeSeries:** Add option to match axis color to series color. [#51437](https://github.com/grafana/grafana/pull/51437), [@leeoniya](https://github.com/leeoniya)
- **TimeSeries:** Improved constantY rendering parity with Graph (old). [#51401](https://github.com/grafana/grafana/pull/51401), [@leeoniya](https://github.com/leeoniya)
- **Timeseries:** Support multiple timezones in x axis. [#52424](https://github.com/grafana/grafana/pull/52424), [@ryantxu](https://github.com/ryantxu)
- **TopNav:** Adds new feature toggle for upcoming nav. [#51115](https://github.com/grafana/grafana/pull/51115), [@torkelo](https://github.com/torkelo)
- **Traces:** APM table. [#48654](https://github.com/grafana/grafana/pull/48654), [@joey-grafana](https://github.com/joey-grafana)
- **Traces:** Add absolute time to span details. [#50685](https://github.com/grafana/grafana/pull/50685), [@joey-grafana](https://github.com/joey-grafana)
- **Traces:** Add horizontal scroll. [#50278](https://github.com/grafana/grafana/pull/50278), [@joey-grafana](https://github.com/joey-grafana)
- **Traces:** Consistent span colors for service names. [#50782](https://github.com/grafana/grafana/pull/50782), [@joey-grafana](https://github.com/joey-grafana)
- **Traces:** Move towards using OTEL naming conventions. [#51379](https://github.com/grafana/grafana/pull/51379), [@joey-grafana](https://github.com/joey-grafana)
- **Traces:** Span bar label. [#50931](https://github.com/grafana/grafana/pull/50931), [@joey-grafana](https://github.com/joey-grafana)
- **Transformations:** Add standard deviation and variance reducers. [#52769](https://github.com/grafana/grafana/pull/52769), [@ryantxu](https://github.com/ryantxu)
- **Transforms:** Add Join by label transformation. [#52670](https://github.com/grafana/grafana/pull/52670), [@ryantxu](https://github.com/ryantxu)
- **URL:** Encode certain special characters. [#51806](https://github.com/grafana/grafana/pull/51806), [@L-M-K-B](https://github.com/L-M-K-B)
- **ValueMappings:** Make value mapping row focusable. [#52337](https://github.com/grafana/grafana/pull/52337), [@lpskdl](https://github.com/lpskdl)
- **Variables:** Add 'jsonwithoutquote' formatting options for variables, and format of variable supports pipeline. [#51859](https://github.com/grafana/grafana/pull/51859), [@MicroOps-cn](https://github.com/MicroOps-cn)
- **Variables:** Selectively reload panels on URL update. [#51003](https://github.com/grafana/grafana/pull/51003), [@toddtreece](https://github.com/toddtreece)
- **Various Panels:** Add ability to toggle legend with keyboard shortcut. [#52241](https://github.com/grafana/grafana/pull/52241), [@alyssabull](https://github.com/alyssabull)

### Bug fixes

- **API:** Fix failing test by initialising legacy guardian when creating folder scenario. [#50800](https://github.com/grafana/grafana/pull/50800), [@vicmarbev](https://github.com/vicmarbev)
- **Access control:** Show dashboard settings to users who can edit dashboard. [#52532](https://github.com/grafana/grafana/pull/52532), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Alerting:** Fix RegExp matchers in frontend for Silences and other previews. [#51726](https://github.com/grafana/grafana/pull/51726), [@joeblubaugh](https://github.com/joeblubaugh)
- **Alerting:** Fix rule API to accept 0 duration of field `For`. [#50992](https://github.com/grafana/grafana/pull/50992), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Increase alert rule operation perf by replacing subquery with threshold calculation. [#53069](https://github.com/grafana/grafana/pull/53069), [@alexweav](https://github.com/alexweav)
- **Barchart Panel:** Fix threshold colors changing when data is refreshed. [#52038](https://github.com/grafana/grafana/pull/52038), [@mingozh](https://github.com/mingozh)
- **Dashboard:** Fix iteration property change triggering unsaved changes warning. [#51272](https://github.com/grafana/grafana/pull/51272), [@torkelo](https://github.com/torkelo)
- **Dashboards:** Disable variable pickers for snapshots. [#52827](https://github.com/grafana/grafana/pull/52827), [@joshhunt](https://github.com/joshhunt)
- **Elasticsearch:** Always use fixed_interval. [#50297](https://github.com/grafana/grafana/pull/50297), [@gabor](https://github.com/gabor)
- **Geomap:** Fix tooltip offset bug. [#52627](https://github.com/grafana/grafana/pull/52627), [@drew08t](https://github.com/drew08t)
- **Geomap:** Update with template variable change. [#52007](https://github.com/grafana/grafana/pull/52007), [@drew08t](https://github.com/drew08t)
- **Loki:** Fix adding of multiple label filters when parser. [#52335](https://github.com/grafana/grafana/pull/52335), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Fix support of ad-hoc filters for specific queries. [#51232](https://github.com/grafana/grafana/pull/51232), [@ivanahuckova](https://github.com/ivanahuckova)
- **Navigation:** Hide `Dashboards`/`Starred items` from navbar when unauthenticated. [#53051](https://github.com/grafana/grafana/pull/53051), [@ashharrison90](https://github.com/ashharrison90)
- **PasswordReset:** Enforce password length check on password reset request. [#51005](https://github.com/grafana/grafana/pull/51005), [@asymness](https://github.com/asymness)
- **Prometheus:** Fix integer overflow in rate interval calculation on 32-bit architectures. [#51508](https://github.com/grafana/grafana/pull/51508), [@andreasgerstmayr](https://github.com/andreasgerstmayr)
- **Search:** Fix indexing - re-index after initial provisioning. [#50959](https://github.com/grafana/grafana/pull/50959), [@FZambia](https://github.com/FZambia)
- **Slider:** Fixes styling of marker dots. [#52678](https://github.com/grafana/grafana/pull/52678), [@torkelo](https://github.com/torkelo)
- **Tracing:** Fix links to traces in Explore. [#50113](https://github.com/grafana/grafana/pull/50113), [@connorlindsey](https://github.com/connorlindsey)

### Breaking changes

Some swagger operations and responses have been renamed to match the respective handler names in order to better highlight their relation.
If you use the Swagger specification for generating code, you have to re-generate it and make the necessary adjustments. Issue [#52643](https://github.com/grafana/grafana/issues/52643)

The following metrics have been converted to histograms:

- grafana_datasource_request_total
- grafana_datasource_request_duration_seconds
- grafana_datasource_response_size_bytes
- grafana_datasource_request_in_flight
- grafana_plugin_request_duration_milliseconds
- grafana_alerting_rule_evaluation_duration_seconds Issue [#50420](https://github.com/grafana/grafana/issues/50420)

In Elasticsearch versions 7.x, to specify the interval-value we used the `interval` property. In Grafana 9.1.0 we switched to use the `fixed_interval` property. This makes it to be the same as in Elasticsearch versions 8.x, also this provides a more consistent experience, `fixed_interval` is a better match to Grafana's time invervals. For most situations this will not cause any visible change to query results. Issue [#50297](https://github.com/grafana/grafana/issues/50297)

### Grafana now reserves alert labels prefixed with `grafana_`

Labels prefixed with `grafana_` are reserved by Grafana for special use. If a manually configured label is added beginning with `grafana_` it may be overwritten in case of collision.

The current list of labels created by Grafana and available for use anywhere manually configured labels are:

| Label          | Description                               |
| -------------- | ----------------------------------------- | --------------------------------------------------------------- |
| grafana_folder | Title of the folder containing the alert. | Issue [#50262](https://github.com/grafana/grafana/issues/50262) |

In Prometheus, browser access mode was deprecated in Grafana 7.4.0 and removed in 9.0.0. If you used this mode, please switch to server access mode on the datasource configuration page. Issue [#50162](https://github.com/grafana/grafana/issues/50162)

### Plugin development fixes & changes

- **Dropdown:** New dropdown component. [#52684](https://github.com/grafana/grafana/pull/52684), [@torkelo](https://github.com/torkelo)
- **Grafana/UI:** Add ColorPickerInput component. [#52222](https://github.com/grafana/grafana/pull/52222), [@Clarity-89](https://github.com/Clarity-89)
- **Plugins:** Validate root URLs when signing private plugins via grafana-toolkit. [#51968](https://github.com/grafana/grafana/pull/51968), [@wbrowne](https://github.com/wbrowne)

<!-- 9.0.9 START -->

# 9.0.9 (2022-09-20)

### Bug fixes

- **AngularPanels:** Fixing changing angular panel options not taking having affect when coming back from panel edit. [#54834](https://github.com/grafana/grafana/pull/54834), [@grafanabot](https://github.com/grafanabot)
- **AuthNZ:** Security fixes for CVE-2022-35957 and CVE-2022-36062. [#55498](https://github.com/grafana/grafana/pull/55498), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **FIX:** RBAC prevents deleting empty snapshots (#54385). [#54509](https://github.com/grafana/grafana/pull/54509), [@gamab](https://github.com/gamab)

<!-- 9.0.9 END -->

<!-- 9.0.8 START -->

# 9.0.8 (2022-08-30)

### Features and enhancements

- **Alerting:** Hide "no rules" message when we are fetching from data sources. [#53778](https://github.com/grafana/grafana/pull/53778), [@gillesdemey](https://github.com/gillesdemey)
- **Rendering:** Add support for renderer token (#54425). [#54439](https://github.com/grafana/grafana/pull/54439), [@joanlopez](https://github.com/joanlopez)
- **Reports:** Title is showing under panels. (Enterprise)
- **Alerting:** AlertingProxy to elevate permissions for request forwarded to data proxy when RBAC enabled. [#53680](https://github.com/grafana/grafana/pull/53680), [@yuri-tceretian](https://github.com/yuri-tceretian)

<!-- 9.0.8 END -->

<!-- 9.0.7 START -->

# 9.0.7 (2022-08-10)

### Features and enhancements

- **CloudMonitoring:** Remove link setting for SLO queries. [#53031](https://github.com/grafana/grafana/pull/53031), [@andresmgot](https://github.com/andresmgot)

### Bug fixes

- **GrafanaUI:** Render PageToolbar's leftItems regardless of title's presence. [#53285](https://github.com/grafana/grafana/pull/53285), [@Elfo404](https://github.com/Elfo404)

<!-- 9.0.7 END -->
<!-- 9.1.0-beta1 END -->
<!-- 9.0.6 START -->

# 9.0.6 (2022-08-01)

### Features and enhancements

- **Access Control:** Allow org admins to invite new users to their organization. [#52904](https://github.com/grafana/grafana/pull/52904), [@IevaVasiljeva](https://github.com/IevaVasiljeva)

### Bug fixes

- **Grafana/toolkit:** Fix incorrect image and font generation for plugin builds. [#52927](https://github.com/grafana/grafana/pull/52927), [@academo](https://github.com/academo)
- **Prometheus:** Fix adding of multiple values for regex operator. [#52978](https://github.com/grafana/grafana/pull/52978), [@ivanahuckova](https://github.com/ivanahuckova)
- **UI/Card:** Fix card items always having pointer cursor. [#52809](https://github.com/grafana/grafana/pull/52809), [@gillesdemey](https://github.com/gillesdemey)

<!-- 9.0.6 END -->
<!-- 9.0.5 START -->

# 9.0.5 (2022-07-26)

### Features and enhancements

- **Access control:** Show dashboard settings to users who can edit dashboard. [#52535](https://github.com/grafana/grafana/pull/52535), [@grafanabot](https://github.com/grafanabot)
- **Alerting:** Allow the webhook notifier to support a custom Authorization header. [#52515](https://github.com/grafana/grafana/pull/52515), [@gotjosh](https://github.com/gotjosh)
- **Chore:** Upgrade to Go version 1.17.12. [#52523](https://github.com/grafana/grafana/pull/52523), [@sakjur](https://github.com/sakjur)
- **Plugins:** Add signature wildcard globbing for dedicated private plugin type. [#52163](https://github.com/grafana/grafana/pull/52163), [@wbrowne](https://github.com/wbrowne)
- **Prometheus:** Don't show errors from unsuccessful API checks like rules or exemplar checks. [#52193](https://github.com/grafana/grafana/pull/52193), [@darrenjaneczek](https://github.com/darrenjaneczek)

### Bug fixes

- **Access control:** Allow organisation admins to add existing users to org (#51668). [#52553](https://github.com/grafana/grafana/pull/52553), [@vtorosyan](https://github.com/vtorosyan)
- **Alerting:** Fix alert panel instance-based rules filtering. [#52583](https://github.com/grafana/grafana/pull/52583), [@konrad147](https://github.com/konrad147)
- **Apps:** Fixes navigation between different app plugin pages. [#52571](https://github.com/grafana/grafana/pull/52571), [@torkelo](https://github.com/torkelo)
- **Cloudwatch:** Upgrade grafana-aws-sdk to fix auth issue with secret keys. [#52420](https://github.com/grafana/grafana/pull/52420), [@sarahzinger](https://github.com/sarahzinger)
- **Grafana/toolkit:** Fix incorrect image and font generation for plugin builds. [#52661](https://github.com/grafana/grafana/pull/52661), [@academo](https://github.com/academo)
- **Loki:** Fix `show context` not working in some occasions. [#52458](https://github.com/grafana/grafana/pull/52458), [@svennergr](https://github.com/svennergr)
- **RBAC:** Fix permissions on dashboards and folders created by anonymous users. [#52615](https://github.com/grafana/grafana/pull/52615), [@gamab](https://github.com/gamab)

<!-- 9.0.5 END -->
<!-- 9.0.4 START -->

# 9.0.4 (2022-07-20)

### Features and enhancements

- **Browse/Search:** Make browser back work properly when visiting Browse or search. [#52271](https://github.com/grafana/grafana/pull/52271), [@torkelo](https://github.com/torkelo)
- **Logs:** Improve getLogRowContext API. [#52130](https://github.com/grafana/grafana/pull/52130), [@gabor](https://github.com/gabor)
- **Loki:** Improve handling of empty responses. [#52397](https://github.com/grafana/grafana/pull/52397), [@gabor](https://github.com/gabor)
- **Plugins:** Always validate root URL if specified in signature manfiest. [#52332](https://github.com/grafana/grafana/pull/52332), [@wbrowne](https://github.com/wbrowne)
- **Preferences:** Get home dashboard from teams. [#52225](https://github.com/grafana/grafana/pull/52225), [@sakjur](https://github.com/sakjur)
- **SQLStore:** Support Upserting multiple rows. [#52228](https://github.com/grafana/grafana/pull/52228), [@joeblubaugh](https://github.com/joeblubaugh)
- **Traces:** Add more template variables in Tempo & Zipkin. [#52306](https://github.com/grafana/grafana/pull/52306), [@joey-grafana](https://github.com/joey-grafana)
- **Traces:** Remove serviceMap feature flag. [#52375](https://github.com/grafana/grafana/pull/52375), [@joey-grafana](https://github.com/joey-grafana)

### Bug fixes

- **Access Control:** Fix missing folder permissions. [#52410](https://github.com/grafana/grafana/pull/52410), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Access control:** Fix org user removal for OSS users. [#52473](https://github.com/grafana/grafana/pull/52473), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Alerting:** Fix Slack notification preview. [#50230](https://github.com/grafana/grafana/pull/50230), [@ekrucio](https://github.com/ekrucio)
- **Alerting:** Fix Slack push notifications. [#52391](https://github.com/grafana/grafana/pull/52391), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Fixes slack push notifications. [#50267](https://github.com/grafana/grafana/pull/50267), [@jgillick](https://github.com/jgillick)
- **Alerting:** Preserve new-lines from custom email templates in rendered email. [#52253](https://github.com/grafana/grafana/pull/52253), [@alexweav](https://github.com/alexweav)
- **Insights:** Fix dashboard and data source insights pages. (Enterprise)
- **Log:** Fix text logging for unsupported types. [#51306](https://github.com/grafana/grafana/pull/51306), [@papagian](https://github.com/papagian)
- **Loki:** Fix incorrect TopK value type in query builder. [#52226](https://github.com/grafana/grafana/pull/52226), [@ivanahuckova](https://github.com/ivanahuckova)

<!-- 9.0.4 END -->
<!-- 9.0.3 START -->

# 9.0.3 (2022-07-14)

### Features and enhancements

- **Access Control:** Allow dashboard admins to query org users. [#51652](https://github.com/grafana/grafana/pull/51652), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Access control:** Allow organisation admins to add existing users to org. [#51668](https://github.com/grafana/grafana/pull/51668), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Alerting:** Add method to provisioning API for obtaining a group and its rules. [#51761](https://github.com/grafana/grafana/pull/51761), [@alexweav](https://github.com/alexweav)
- **Alerting:** Add method to provisioning API for obtaining a group and its rules. [#51398](https://github.com/grafana/grafana/pull/51398), [@alexweav](https://github.com/alexweav)
- **Alerting:** Allow filtering of contact points by name. [#51933](https://github.com/grafana/grafana/pull/51933), [@alexweav](https://github.com/alexweav)
- **Alerting:** Disable /api/admin/pause-all-alerts with Unified Alerting. [#51895](https://github.com/grafana/grafana/pull/51895), [@joeblubaugh](https://github.com/joeblubaugh)
- **Analytics:** Add total queries and cached queries in usage insights logs. (Enterprise)
- **Annotations:** Use point marker for short time range annotations. [#51520](https://github.com/grafana/grafana/pull/51520), [@codeincarnate](https://github.com/codeincarnate)
- **AzureMonitor:** Update UI to experimental package. [#52123](https://github.com/grafana/grafana/pull/52123), [@asimpson](https://github.com/asimpson)
- **AzureMonitor:** Update resource and namespace metadata. [#52030](https://github.com/grafana/grafana/pull/52030), [@despian](https://github.com/despian)
- **CloudWatch:** Remove simplejson in favor of 'encoding/json'. [#51062](https://github.com/grafana/grafana/pull/51062), [@asimpson](https://github.com/asimpson)
- **DashboardRow:** Collapse shortcut prevent to move the collapsed rows. [#51589](https://github.com/grafana/grafana/pull/51589), [@ivanortegaalba](https://github.com/ivanortegaalba)
- **Insights:** Add dashboard UID to exported logs. (Enterprise)
- **Navigation:** Highlight active nav item when Grafana is served from subpath. [#51767](https://github.com/grafana/grafana/pull/51767), [@kianelbo](https://github.com/kianelbo)
- **Plugins:** InfluxDB datasource - set epoch query param value as "ms". [#51651](https://github.com/grafana/grafana/pull/51651), [@itsmylife](https://github.com/itsmylife)
- **Plugins:** InfluxDB update time range query. [#51833](https://github.com/grafana/grafana/pull/51833), [@itsmylife](https://github.com/itsmylife)
- **StateTimeline:** Try to sort time field. [#51569](https://github.com/grafana/grafana/pull/51569), [@zoltanbedi](https://github.com/zoltanbedi)

### Bug fixes

- **API:** Do not validate/save legacy alerts when saving a dashboard if legacy alerting is disabled. [#51883](https://github.com/grafana/grafana/pull/51883), [@papagian](https://github.com/papagian)
- **Access Control:** Fix missing folder permissions. [#52153](https://github.com/grafana/grafana/pull/52153), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Alerting:** Add method to reset notification policy tree back to the default. [#51934](https://github.com/grafana/grafana/pull/51934), [@alexweav](https://github.com/alexweav)
- **Alerting:** Fix Teams notifier not failing on 200 response with error. [#52254](https://github.com/grafana/grafana/pull/52254), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Fix bug where state did not change between Alerting and Error. [#52204](https://github.com/grafana/grafana/pull/52204), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Fix consistency errors in OpenAPI documentation. [#51935](https://github.com/grafana/grafana/pull/51935), [@alexweav](https://github.com/alexweav)
- **Alerting:** Fix normalization of alert states for panel annotations. [#51637](https://github.com/grafana/grafana/pull/51637), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Provisioning API respects global rule quota. [#52180](https://github.com/grafana/grafana/pull/52180), [@alexweav](https://github.com/alexweav)
- **CSRF:** Fix additional headers option. [#50629](https://github.com/grafana/grafana/pull/50629), [@sakjur](https://github.com/sakjur)
- **Chore:** Bump parse-url to 6.0.2 to fix security vulnerabilities. [#51796](https://github.com/grafana/grafana/pull/51796), [@jackw](https://github.com/jackw)
- **Chore:** Fix CVE-2020-7753. [#51752](https://github.com/grafana/grafana/pull/51752), [@jackw](https://github.com/jackw)
- **Chore:** Fix CVE-2021-3807. [#51753](https://github.com/grafana/grafana/pull/51753), [@jackw](https://github.com/jackw)
- **Chore:** Fix CVE-2021-3918. [#51745](https://github.com/grafana/grafana/pull/51745), [@jackw](https://github.com/jackw)
- **Chore:** Fix CVE-2021-43138. [#51751](https://github.com/grafana/grafana/pull/51751), [@jackw](https://github.com/jackw)
- **Chore:** Fix CVE-2022-0155. [#51755](https://github.com/grafana/grafana/pull/51755), [@jackw](https://github.com/jackw)
- **Custom Branding:** Fix login logo size. (Enterprise)
- **Dashboard:** Fixes tooltip issue with TimePicker and Setting buttons. [#51836](https://github.com/grafana/grafana/pull/51836), [@torkelo](https://github.com/torkelo)
- **Dashboard:** Prevent unnecessary scrollbar when viewing single panel. [#52122](https://github.com/grafana/grafana/pull/52122), [@lpskdl](https://github.com/lpskdl)
- **Logs:** Fixed wrapping log lines from detected fields. [#52108](https://github.com/grafana/grafana/pull/52108), [@svennergr](https://github.com/svennergr)
- **Loki:** Add missing operators in label filter expression. [#51880](https://github.com/grafana/grafana/pull/51880), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Fix error when changing operations with different parameters. [#51779](https://github.com/grafana/grafana/pull/51779), [@svennergr](https://github.com/svennergr)
- **Loki:** Fix suggesting of correct operations in query builder. [#52034](https://github.com/grafana/grafana/pull/52034), [@ivanahuckova](https://github.com/ivanahuckova)
- **Plugins:** InfluxDB variable interpolation fix. [#51917](https://github.com/grafana/grafana/pull/51917), [@itsmylife](https://github.com/itsmylife)
- **Plugins:** InfluxDB variable interpolation fix for influxdbBackendMigration feature flag. [#51624](https://github.com/grafana/grafana/pull/51624), [@itsmylife](https://github.com/itsmylife)
- **Reports:** Fix line breaks in message. (Enterprise)
- **Reports:** Fix saving report formats. (Enterprise)
- **SQLstore:** Fix fetching an inexistent playlist. [#51962](https://github.com/grafana/grafana/pull/51962), [@papagian](https://github.com/papagian)
- **Security:** Fixes for CVE-2022-31107 and CVE-2022-31097. [#52279](https://github.com/grafana/grafana/pull/52279), [@kminehart](https://github.com/kminehart)
- **Snapshots:** Fix deleting external snapshots when using RBAC. [#51897](https://github.com/grafana/grafana/pull/51897), [@idafurjes](https://github.com/idafurjes)
- **Table:** Fix scrollbar being hidden by pagination. [#51501](https://github.com/grafana/grafana/pull/51501), [@zoltanbedi](https://github.com/zoltanbedi)
- **Templating:** Changing between variables with the same name now correctly triggers a dashboard refresh. [#51490](https://github.com/grafana/grafana/pull/51490), [@ashharrison90](https://github.com/ashharrison90)
- **Time series panel:** Fix an issue with stacks being not complete due to the incorrect data frame length. [#51910](https://github.com/grafana/grafana/pull/51910), [@dprokop](https://github.com/dprokop)
- **[v9.0.x] Snapshots:** Fix deleting external snapshots when using RBAC (#51897). [#51904](https://github.com/grafana/grafana/pull/51904), [@idafurjes](https://github.com/idafurjes)

<!-- 9.0.3 END -->
<!-- 9.0.2 START -->

# 9.0.2 (2022-06-28)

### Features and enhancements

- **Alerting:** Add support for images in Pushover alerts. [#51372](https://github.com/grafana/grafana/pull/51372), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Don't stop the migration when alert rule tags are invalid. [#51253](https://github.com/grafana/grafana/pull/51253), [@gotjosh](https://github.com/gotjosh)
- **Alerting:** Don't stop the migration when alert rule tags are invalid (…. [#51341](https://github.com/grafana/grafana/pull/51341), [@gotjosh](https://github.com/gotjosh)
- **Alerting:** Skip the default data source if incompatible. [#51452](https://github.com/grafana/grafana/pull/51452), [@gillesdemey](https://github.com/gillesdemey)
- **AzureMonitor:** Parse non-fatal errors for Logs. [#51320](https://github.com/grafana/grafana/pull/51320), [@andresmgot](https://github.com/andresmgot)
- **OAuth:** Restore debug log behavior. [#51244](https://github.com/grafana/grafana/pull/51244), [@Jguer](https://github.com/Jguer)
- **Plugins:** Improved handling of symlinks. [#51324](https://github.com/grafana/grafana/pull/51324), [@marefr](https://github.com/marefr)

### Bug fixes

- **Alerting:** Code-gen parsing of URL parameters and fix related bugs. [#51353](https://github.com/grafana/grafana/pull/51353), [@alexweav](https://github.com/alexweav)
- **Alerting:** Code-gen parsing of URL parameters and fix related bugs. [#50731](https://github.com/grafana/grafana/pull/50731), [@alexweav](https://github.com/alexweav)
- **Annotations:** Fix annotation autocomplete causing panels to crash. [#51164](https://github.com/grafana/grafana/pull/51164), [@ashharrison90](https://github.com/ashharrison90)
- **Barchart:** Fix warning not showing. [#51190](https://github.com/grafana/grafana/pull/51190), [@joshhunt](https://github.com/joshhunt)
- **CloudWatch:** Enable custom session duration in AWS plugin auth. [#51322](https://github.com/grafana/grafana/pull/51322), [@sunker](https://github.com/sunker)
- **Dashboards:** Fixes issue with the initial panel layout counting as an unsaved change. [#51315](https://github.com/grafana/grafana/pull/51315), [@JoaoSilvaGrafana](https://github.com/JoaoSilvaGrafana)
- **Plugins:** Use a Grafana specific SDK logger implementation for core plugins. [#51229](https://github.com/grafana/grafana/pull/51229), [@marefr](https://github.com/marefr)
- **Search:** Fix pagination in the new search page. [#51366](https://github.com/grafana/grafana/pull/51366), [@ArturWierzbicki](https://github.com/ArturWierzbicki)

<!-- 9.0.2 END -->
<!-- 9.0.1 START -->

# 9.0.1 (2022-06-21)

### Features and enhancements

- **Alerting:** Add support for image annotation in Alertmanager alerts. [#50686](https://github.com/grafana/grafana/pull/50686), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Add support for images in SensuGo alerts. [#50718](https://github.com/grafana/grafana/pull/50718), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Add support for images in Threema alerts. [#50734](https://github.com/grafana/grafana/pull/50734), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Adds Mimir to Alertmanager data source implementation. [#50943](https://github.com/grafana/grafana/pull/50943), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Invalid setting of enabled for unified alerting should return error. [#49876](https://github.com/grafana/grafana/pull/49876), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **AzureMonitor:** Clean namespace when changing the resource. [#50311](https://github.com/grafana/grafana/pull/50311), [@andresmgot](https://github.com/andresmgot)
- **AzureMonitor:** Update supported namespaces and filter resources by the right type. [#50788](https://github.com/grafana/grafana/pull/50788), [@andresmgot](https://github.com/andresmgot)
- **CLI:** Allow relative symlinks in zip archives when installing plugins. [#50537](https://github.com/grafana/grafana/pull/50537), [@marefr](https://github.com/marefr)
- **Dashboard:** Don't show unsaved changes modal for automatic schema changes. [#50822](https://github.com/grafana/grafana/pull/50822), [@torkelo](https://github.com/torkelo)
- **Dashboard:** Unsaved changes warning should not trigger when only pluginVersion has changed. [#50677](https://github.com/grafana/grafana/pull/50677), [@torkelo](https://github.com/torkelo)
- **Expression:** Execute hidden expressions. [#50636](https://github.com/grafana/grafana/pull/50636), [@yesoreyeram](https://github.com/yesoreyeram)
- **Geomap:** Support showing tooltip content on click (not just hover). [#50985](https://github.com/grafana/grafana/pull/50985), [@ryantxu](https://github.com/ryantxu)
- **Heatmap:** Remove alpha flag from new heatmap panel. [#50733](https://github.com/grafana/grafana/pull/50733), [@ryantxu](https://github.com/ryantxu)
- **Instrumentation:** Define handlers for requests that are not handled with named handlers. [#50613](https://github.com/grafana/grafana/pull/50613), [@bergquist](https://github.com/bergquist)
- **Log Panel:** Improve log row hover contrast and visibility. [#50908](https://github.com/grafana/grafana/pull/50908), [@Seyaji](https://github.com/Seyaji)
- **Logs:** Handle backend-mode errors in histogram. [#50535](https://github.com/grafana/grafana/pull/50535), [@gabor](https://github.com/gabor)
- **Loki:** Do not show histogram for instant queries. [#50711](https://github.com/grafana/grafana/pull/50711), [@gabor](https://github.com/gabor)
- **Loki:** Handle data source configs with path in the url. [#50971](https://github.com/grafana/grafana/pull/50971), [@gabor](https://github.com/gabor)
- **Loki:** Handle invalid query type values. [#50755](https://github.com/grafana/grafana/pull/50755), [@gabor](https://github.com/gabor)
- **OAuth:** Redirect to login if no oauth module is found or if module is not configured. [#50661](https://github.com/grafana/grafana/pull/50661), [@kalleep](https://github.com/kalleep)
- **OptionsUI:** Move internal options editors out of @grafana/ui. [#50739](https://github.com/grafana/grafana/pull/50739), [@ryantxu](https://github.com/ryantxu)
- **Prometheus:** Don't show undefined for step in collapsed options in query editor when value is "auto". [#50511](https://github.com/grafana/grafana/pull/50511), [@aocenas](https://github.com/aocenas)
- **Prometheus:** Show query patterns in all editor modes for Prometheus and Loki. [#50263](https://github.com/grafana/grafana/pull/50263), [@ivanahuckova](https://github.com/ivanahuckova)
- **Tempo:** Add link to Tempo Search with node service selected. [#49776](https://github.com/grafana/grafana/pull/49776), [@joey-grafana](https://github.com/joey-grafana)
- **Time Series Panel:** Add Null Filling and "No Value" Support. [#50907](https://github.com/grafana/grafana/pull/50907), [@codeincarnate](https://github.com/codeincarnate)
- **TimeSeries:** Add an option to set legend width. [#49126](https://github.com/grafana/grafana/pull/49126), [@bobrik](https://github.com/bobrik)
- **Timeseries:** Improve cursor Y sync behavior. [#50740](https://github.com/grafana/grafana/pull/50740), [@ryantxu](https://github.com/ryantxu)
- **Traces:** Do not use red in span colors as this looks like an error. [#50074](https://github.com/grafana/grafana/pull/50074), [@joey-grafana](https://github.com/joey-grafana)

### Bug fixes

- **Alerting:** Fix AM config overwrite when SQLite db is locked during sync. [#50951](https://github.com/grafana/grafana/pull/50951), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Fix alert instances filtering for prom rules. [#50850](https://github.com/grafana/grafana/pull/50850), [@konrad147](https://github.com/konrad147)
- **Alerting:** Fix alert rule page crashing when datasource contained URL unsafe characters. [#51105](https://github.com/grafana/grafana/pull/51105), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Fix automatically select newly created folder option. [#50949](https://github.com/grafana/grafana/pull/50949), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Fix removal of notification policy without labels matchers. [#50678](https://github.com/grafana/grafana/pull/50678), [@konrad147](https://github.com/konrad147)
- **CloudWatch:** Allow hidden queries to be executed in case an ID is provided. [#50987](https://github.com/grafana/grafana/pull/50987), [@sunker](https://github.com/sunker)
- **Dashboard:** Prevent non-repeating panels being dropped from repeated rows when collapsed/expanded. [#50764](https://github.com/grafana/grafana/pull/50764), [@ashharrison90](https://github.com/ashharrison90)
- **Dashboards:** Fix folder picker not showing correct results when typing too fast. [#50303](https://github.com/grafana/grafana/pull/50303), [@joshhunt](https://github.com/joshhunt)
- **Datasource:** Prevent panic when proxying for non-existing data source. [#50667](https://github.com/grafana/grafana/pull/50667), [@wbrowne](https://github.com/wbrowne)
- **Explore:** Fix log context scroll to bottom. [#50600](https://github.com/grafana/grafana/pull/50600), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore:** Revert "Remove support for compact format URLs (#49350)". [#50873](https://github.com/grafana/grafana/pull/50873), [@gelicia](https://github.com/gelicia)
- **Expressions:** Fixes dashboard schema migration issue that casued Expression datasource to be set on panel level. [#50945](https://github.com/grafana/grafana/pull/50945), [@torkelo](https://github.com/torkelo)
- **Formatting:** Fixes valueFormats for a value of 0. [#50719](https://github.com/grafana/grafana/pull/50719), [@JoaoSilvaGrafana](https://github.com/JoaoSilvaGrafana)
- **GrafanaData:** Fix week start for non-English browsers. [#50582](https://github.com/grafana/grafana/pull/50582), [@AgnesToulet](https://github.com/AgnesToulet)
- **LibraryPanel:** Resizing a library panel to 6x3 no longer crashes the dashboard on startup. [#50400](https://github.com/grafana/grafana/pull/50400), [@ashharrison90](https://github.com/ashharrison90)
- **LogRow:** Fix placement of icon. [#51010](https://github.com/grafana/grafana/pull/51010), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Fix bug in labels framing. [#51015](https://github.com/grafana/grafana/pull/51015), [@gabor](https://github.com/gabor)
- **Loki:** Fix issues with using query patterns. [#50414](https://github.com/grafana/grafana/pull/50414), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Fix showing of duplicated label values in dropdown in query builder. [#50680](https://github.com/grafana/grafana/pull/50680), [@ivanahuckova](https://github.com/ivanahuckova)
- **MSSQL:** Fix ParseFloat error. [#50815](https://github.com/grafana/grafana/pull/50815), [@zoltanbedi](https://github.com/zoltanbedi)
- **Panels:** Fixes issue with showing 'Cannot visualize data' when query returned 0 rows. [#50485](https://github.com/grafana/grafana/pull/50485), [@torkelo](https://github.com/torkelo)
- **Playlists:** Disable Create Playlist buttons for users with viewer role. [#50840](https://github.com/grafana/grafana/pull/50840), [@asymness](https://github.com/asymness)
- **Plugins:** Fix typo in plugin data frames documentation. [#50554](https://github.com/grafana/grafana/pull/50554), [@osisoft-mbishop](https://github.com/osisoft-mbishop)
- **Prometheus:** Fix body not being included in resource calls if they are POST. [#50833](https://github.com/grafana/grafana/pull/50833), [@aocenas](https://github.com/aocenas)
- **RolePicker:** Fix submenu position on horizontal space overflow. [#50769](https://github.com/grafana/grafana/pull/50769), [@Clarity-89](https://github.com/Clarity-89)
- **Tracing:** Fix trace links in traces panel. [#50028](https://github.com/grafana/grafana/pull/50028), [@connorlindsey](https://github.com/connorlindsey)

### Deprecations

Support for compact Explore URLs is deprecated and will be removed in a future release. Until then, when navigating to Explore using the deprecated format the URLs are automatically converted. If you have existing links pointing to Explore update them using the format generated by Explore upon navigation.

You can identify a compact URL by its format. Compact URLs have the left (and optionally right) url parameter as an array of strings, for example `&left=["now-1h","now"...]`. The standard explore URLs follow a key/value pattern, for example `&left={"datasource":"test"...}`. Please be sure to check your dashboards for any hardcoded links to Explore and update them to the standard URL pattern. Issue [#50873](https://github.com/grafana/grafana/issues/50873)

<!-- 9.0.1 END -->
<!-- 9.0.0 START -->

# 9.0.0 (2022-06-10)

### Features and enhancements

- **API:** Add GET /api/annotations/:annotationId endpoint. [#47739](https://github.com/grafana/grafana/pull/47739), [@scottbock](https://github.com/scottbock)
- **API:** Add endpoint for updating a data source by its UID. [#49396](https://github.com/grafana/grafana/pull/49396), [@papagian](https://github.com/papagian)
- **AccessControl:** Add enterprise only setting for rbac permission cache. [#49006](https://github.com/grafana/grafana/pull/49006), [@kalleep](https://github.com/kalleep)
- **AccessControl:** Document basic roles changes and provisioning V2. [#48910](https://github.com/grafana/grafana/pull/48910), [@gamab](https://github.com/gamab)
- **AccessControl:** Enable RBAC by default. [#48813](https://github.com/grafana/grafana/pull/48813), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **AddDataSourceConfig:** Remove deprecated checkHealth prop. [#50296](https://github.com/grafana/grafana/pull/50296), [@kaydelaney](https://github.com/kaydelaney)
- **Alerting:** Add Image URLs to Microsoft Teams notifier. [#49385](https://github.com/grafana/grafana/pull/49385), [@joeblubaugh](https://github.com/joeblubaugh)
- **Alerting:** Add RBAC actions and role for provisioning API routes. [#50459](https://github.com/grafana/grafana/pull/50459), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Add Screenshot URLs to Pagerduty Notifier. [#49377](https://github.com/grafana/grafana/pull/49377), [@joeblubaugh](https://github.com/joeblubaugh)
- **Alerting:** Add a "Reason" to Alert Instances to show underlying cause of state. [#49259](https://github.com/grafana/grafana/pull/49259), [@joeblubaugh](https://github.com/joeblubaugh)
- **Alerting:** Add a general screenshot service and alerting-specific image service. [#49293](https://github.com/grafana/grafana/pull/49293), [@joeblubaugh](https://github.com/joeblubaugh)
- **Alerting:** Add image url or file attachment to email notifications. [#49381](https://github.com/grafana/grafana/pull/49381), [@joeblubaugh](https://github.com/joeblubaugh)
- **Alerting:** Add image_urls to OpsGenie notification details. [#49379](https://github.com/grafana/grafana/pull/49379), [@joeblubaugh](https://github.com/joeblubaugh)
- **Alerting:** Add notification policy flow chart. [#49405](https://github.com/grafana/grafana/pull/49405), [@peterholmberg](https://github.com/peterholmberg)
- **Alerting:** Attach image URL to alerts in Webhook notifier format. [#49378](https://github.com/grafana/grafana/pull/49378), [@joeblubaugh](https://github.com/joeblubaugh)
- **Alerting:** Attach image URLs or upload files to Discord notifications. [#49439](https://github.com/grafana/grafana/pull/49439), [@alexweav](https://github.com/alexweav)
- **Alerting:** Attach image URLs to Google Chat notifications. [#49445](https://github.com/grafana/grafana/pull/49445), [@alexweav](https://github.com/alexweav)
- **Alerting:** Attach screenshot data to Unified Alerting notifications. [#49374](https://github.com/grafana/grafana/pull/49374), [@joeblubaugh](https://github.com/joeblubaugh)
- **Alerting:** Create folder for alerting when start from the scratch. [#48866](https://github.com/grafana/grafana/pull/48866), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Modify alertmanager endpoints for proxying using the datasource UID. [#47978](https://github.com/grafana/grafana/pull/47978), [@papagian](https://github.com/papagian)
- **Alerting:** Modify endpoint for testing a datasource rule using the UID. [#48070](https://github.com/grafana/grafana/pull/48070), [@papagian](https://github.com/papagian)
- **Alerting:** Modify prometheus endpoints for proxying using the datasource UID. [#48052](https://github.com/grafana/grafana/pull/48052), [@papagian](https://github.com/papagian)
- **Alerting:** State Manager takes screenshots. [#49338](https://github.com/grafana/grafana/pull/49338), [@joeblubaugh](https://github.com/joeblubaugh)
- **Alerting:** Use UID scope for folders authorization. [#48970](https://github.com/grafana/grafana/pull/48970), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** modify ruler endpoints for proxying using the datasource UID. [#48046](https://github.com/grafana/grafana/pull/48046), [@papagian](https://github.com/papagian)
- **Angular:** Adds back two angular directives that are still used by remaining angular bits and plugins. [#50380](https://github.com/grafana/grafana/pull/50380), [@torkelo](https://github.com/torkelo)
- **Azure Monitor:** Add Resource Picker to Metrics Queries. [#49029](https://github.com/grafana/grafana/pull/49029), [@sarahzinger](https://github.com/sarahzinger)
- **Azure Monitor:** Add search feature to resource picker. [#48234](https://github.com/grafana/grafana/pull/48234), [@sarahzinger](https://github.com/sarahzinger)
- **AzureMonitor:** Add support for selecting multiple options when using the equals and not equals dimension filters. [#48650](https://github.com/grafana/grafana/pull/48650), [@aangelisc](https://github.com/aangelisc)
- **AzureMonitor:** Remove deprecated code. [#48328](https://github.com/grafana/grafana/pull/48328), [@andresmgot](https://github.com/andresmgot)
- **Build:** Change names to PascalCase to match. [#48949](https://github.com/grafana/grafana/pull/48949), [@zuchka](https://github.com/zuchka)
- **Chore:** Remove deprecated DataSourceAPI methods. [#49313](https://github.com/grafana/grafana/pull/49313), [@ifrost](https://github.com/ifrost)
- **Chore:** Upgrade typescript to 4.6.4. [#49016](https://github.com/grafana/grafana/pull/49016), [@kaydelaney](https://github.com/kaydelaney)
- **Cloud Monitoring:** Use new annotation API. [#49026](https://github.com/grafana/grafana/pull/49026), [@kevinwcyu](https://github.com/kevinwcyu)
- **CloudMonitoring:** Allow to set a custom value or disable graph_period. [#48646](https://github.com/grafana/grafana/pull/48646), [@andresmgot](https://github.com/andresmgot)
- **CloudWatch:** Add generic filter component to variable editor. [#47907](https://github.com/grafana/grafana/pull/47907), [@iwysiu](https://github.com/iwysiu)
- **CloudWatch:** Added missing AWS/AppRunner metrics. [#49174](https://github.com/grafana/grafana/pull/49174), [@Aton-Kish](https://github.com/Aton-Kish)
- **CloudWatch:** Enable support for dynamic labels with migrated alias patterns. [#49173](https://github.com/grafana/grafana/pull/49173), [@sunker](https://github.com/sunker)
- **Cloudwatch:** Pass label in deep link. [#49160](https://github.com/grafana/grafana/pull/49160), [@sunker](https://github.com/sunker)
- **Cloudwatch:** Use new annotation API. [#48102](https://github.com/grafana/grafana/pull/48102), [@sunker](https://github.com/sunker)
- **Dashboard:** Validate dashboards against schema on save. [#48252](https://github.com/grafana/grafana/pull/48252), [@sdboyer](https://github.com/sdboyer)
- **DashboardPickerByID:** Add option to exclude dashboards. [#49211](https://github.com/grafana/grafana/pull/49211), [@Clarity-89](https://github.com/Clarity-89)
- **DashboardPickerById:** Add optionLabel prop. [#47556](https://github.com/grafana/grafana/pull/47556), [@Clarity-89](https://github.com/Clarity-89)
- **Dashboards:** Display values of 0 with the configured decimal places. [#48155](https://github.com/grafana/grafana/pull/48155), [@wx1322](https://github.com/wx1322)
- **Data:** Remove deprecated types and functions from valueMappings. [#50035](https://github.com/grafana/grafana/pull/50035), [@kaydelaney](https://github.com/kaydelaney)
- **Elasticsearch:** Remove browser access mode. [#49014](https://github.com/grafana/grafana/pull/49014), [@gabor](https://github.com/gabor)
- **Elasticsearch:** Remove support for versions after their end of the life (<7.10.0). [#48715](https://github.com/grafana/grafana/pull/48715), [@ivanahuckova](https://github.com/ivanahuckova)
- **Encryption:** Add support for multiple data keys per day. [#47765](https://github.com/grafana/grafana/pull/47765), [@joanlopez](https://github.com/joanlopez)
- **Encryption:** Enable envelope encryption by default. [#49301](https://github.com/grafana/grafana/pull/49301), [@joanlopez](https://github.com/joanlopez)
- **Explore:** Remove support for legacy, compact format URLs. [#49350](https://github.com/grafana/grafana/pull/49350), [@gelicia](https://github.com/gelicia)
- **Explore:** Skip Angular error handling when Angular support is disabled. [#49311](https://github.com/grafana/grafana/pull/49311), [@ifrost](https://github.com/ifrost)
- **Explore:** simplify support for multiple query editors. [#48701](https://github.com/grafana/grafana/pull/48701), [@Elfo404](https://github.com/Elfo404)
- **FeatureToggles:** Support changing feature toggles with URL parameters. [#50275](https://github.com/grafana/grafana/pull/50275), [@ryantxu](https://github.com/ryantxu)
- **FileUpload:** Make component accessible by keyboard navigation. [#47497](https://github.com/grafana/grafana/pull/47497), [@tolzhabayev](https://github.com/tolzhabayev)
- **Formatting:** Make SI number formats more robust. [#50117](https://github.com/grafana/grafana/pull/50117), [@kaydelaney](https://github.com/kaydelaney)
- **Graph:** Deprecate Graph (old) and make it no longer a visualization option for new panels. [#48034](https://github.com/grafana/grafana/pull/48034), [@torkelo](https://github.com/torkelo)
- **IconButton:** IconButtons are now correctly aligned in Safari. [#48759](https://github.com/grafana/grafana/pull/48759), [@ashharrison90](https://github.com/ashharrison90)
- **Logger:** Enable new logging format by default. [#47584](https://github.com/grafana/grafana/pull/47584), [@ying-jeanne](https://github.com/ying-jeanne)
- **Loki:** Add more query patterns. [#50248](https://github.com/grafana/grafana/pull/50248), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Enable new visual query builder by default. [#48346](https://github.com/grafana/grafana/pull/48346), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** use the same dataframe-format for both live and normal queries. [#47153](https://github.com/grafana/grafana/pull/47153), [@gabor](https://github.com/gabor)
- **OAuth:** Make allowed email domain case insensitive. [#49252](https://github.com/grafana/grafana/pull/49252), [@Jguer](https://github.com/Jguer)
- **Panels:** Use the No value option when showing the no data message. [#47675](https://github.com/grafana/grafana/pull/47675), [@torkelo](https://github.com/torkelo)
- **Plugins:** Remove plugin list panel. [#46914](https://github.com/grafana/grafana/pull/46914), [@tolzhabayev](https://github.com/tolzhabayev)
- **Query History:** Enable new query history by default. [#49407](https://github.com/grafana/grafana/pull/49407), [@ifrost](https://github.com/ifrost)
- **QueryEditorRow:** Show query errors next to query in a consistent way across Grafana. [#47613](https://github.com/grafana/grafana/pull/47613), [@torkelo](https://github.com/torkelo)
- **SAML:** Implement Name Templates for assertion_attribute_name option. [#48022](https://github.com/grafana/grafana/pull/48022), [@mmandrus](https://github.com/mmandrus)
- **Service accounts:** Do not display service accounts assigned to team. [#48995](https://github.com/grafana/grafana/pull/48995), [@eleijonmarck](https://github.com/eleijonmarck)
- **Settings:** Use Grafana Azure SDK to pass Azure env vars for external plugins. [#48954](https://github.com/grafana/grafana/pull/48954), [@kostrse](https://github.com/kostrse)
- **Shortcuts:** Add shortcut to show shortcuts to the list of shortcuts. [#48395](https://github.com/grafana/grafana/pull/48395), [@ivanahuckova](https://github.com/ivanahuckova)
- **Traces Panel:** Add new Traces Panel visualization. [#47534](https://github.com/grafana/grafana/pull/47534), [@joey-grafana](https://github.com/joey-grafana)
- **Traces:** Filter by service/span name and operation in Tempo and Jaeger. [#48209](https://github.com/grafana/grafana/pull/48209), [@joey-grafana](https://github.com/joey-grafana)
- **Transformations:** Allow more complex regex expressions in `Rename by regex`. [#48179](https://github.com/grafana/grafana/pull/48179), [@ashharrison90](https://github.com/ashharrison90)
- **grafana/ui:** Add default type="button" to <Button>. [#48183](https://github.com/grafana/grafana/pull/48183), [@axelavargas](https://github.com/axelavargas)

### Bug fixes

- **Alerting:** Fix database unavailable removes rules from scheduler. [#49874](https://github.com/grafana/grafana/pull/49874), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **AzureMonitor:** Fix auto-selection of time-grain for metrics. [#49278](https://github.com/grafana/grafana/pull/49278), [@aangelisc](https://github.com/aangelisc)
- **DataSources:** Fixes issue with expressions not being queried. [#50446](https://github.com/grafana/grafana/pull/50446), [@JoaoSilvaGrafana](https://github.com/JoaoSilvaGrafana)
- **GraphNG:** Fix thresholds by color not following data update. [#48571](https://github.com/grafana/grafana/pull/48571), [@zoltanbedi](https://github.com/zoltanbedi)
- **Jaeger:** Update operations dropdown. [#49329](https://github.com/grafana/grafana/pull/49329), [@joey-grafana](https://github.com/joey-grafana)
- **Login:** Fix mismatching label on auth_module in user list. [#49177](https://github.com/grafana/grafana/pull/49177), [@Jguer](https://github.com/Jguer)
- **Playlists:** Save button now correctly creates a new playlist. [#50381](https://github.com/grafana/grafana/pull/50381), [@ashharrison90](https://github.com/ashharrison90)
- **RBAC:** Fix migrations running in the wrong order causing inheritance problem in enterprise. [#50452](https://github.com/grafana/grafana/pull/50452), [@gamab](https://github.com/gamab)
- **RBAC:** Fix migrations running into the wrong order. (Enterprise)
- **ServiceAccounts:** Add identifiable token prefix to service account tokens. [#49011](https://github.com/grafana/grafana/pull/49011), [@Jguer](https://github.com/Jguer)
- **Traces:** Fix missing CopyButton on KeyValueTables and overlapping of panels. [#49271](https://github.com/grafana/grafana/pull/49271), [@svennergr](https://github.com/svennergr)

### Breaking changes

The `@grafana/ui` package helper function `selectOptionInTest` used in frontend tests has been removed as it caused testing libraries to be bundled in the production code of Grafana. If you were using this helper function in your tests please update your code accordingly:

```js
// before
import { selectOptionInTest } from '@grafana/ui';
// ...test usage
await selectOptionInTest(selectEl, 'Option 2');

// after
import { select } from 'react-select-event';
// ...test usage
await select(selectEl, 'Option 2', { container: document.body });
```

Issue [#50442](https://github.com/grafana/grafana/issues/50442)

Removed deprecated `checkHealth` prop from the `@grafana/e2e` `addDataSource` config. Previously this value defaulted to `false`, and has not been used in end-to-end tests since Grafana 8.0.3. Issue [#50296](https://github.com/grafana/grafana/issues/50296)

Removes the deprecated `LegacyBaseMap`, `LegacyValueMapping`, `LegacyValueMap`, and `LegacyRangeMap` types, and `getMappedValue` function from grafana-data. Migration is as follows:
| Old | New |
| ------------- | ------------- |
| `LegacyBaseMap` | `MappingType` |
| `LegacyValueMapping` | `ValueMapping` |
| `LegacyValueMap` | `ValueMap` |
| `LegacyRangeMap` | `RangeMap` |
| `getMappedValue` | `getValueMappingResult` | Issue [#50035](https://github.com/grafana/grafana/issues/50035)

This change fixes a bug in Grafana where intermittent failure of database, network between Grafana and the database, or error in querying the database would cause all alert rules to be unscheduled in Grafana. Following this change scheduled alert rules are not updated unless the query is successful.

The `get_alert_rules_duration_seconds` metric has been renamed to `schedule_query_alert_rules_duration_seconds`. Issue [#49874](https://github.com/grafana/grafana/issues/49874)

- Any secret (data sources credential, alert manager credential, etc, etc) created or modified with Grafana v9.0 won't be decryptable from any previous version (by default) because the way encrypted secrets are stored into the database has changed. Although secrets created or modified with previous versions will still be decryptable by Grafana v9.0.
- If required, although generally discouraged, the `disableEnvelopeEncryption` feature toggle can be enabled to keep envelope encryption disabled once updating to Grafana v9.0.
- In case of need to rollback to an earlier version of Grafana (i.e. Grafana v8.x) for any reason, after being created or modified any secret with Grafana v9.0, the `envelopeEncryption` feature toggle will need to be enabled to keep backwards compatibility (only from `v8.3.x` a bit unstable, from `8.5.x` stable).
- As a final attempt to deal with issues related with the aforementioned situations, the `grafana-cli admin secrets-migration rollback` command has been designed to move back all the Grafana secrets encrypted with envelope encryption to legacy encryption. So, after running that command it should be safe to disable envelope encryption and/or roll back to a previous version of Grafana.
- Alternatively or complementarily to all the points above, backing up the Grafana database before updating could be a good idea to prevent disasters (although the risk of getting some secrets corrupted only applies to those updates/created with after updating to Grafana v9.0). Issue [#49301](https://github.com/grafana/grafana/issues/49301)

- According to the dynamic labels documentation, you can use up to five dynamic values per label. There’s currently no such restriction in the alias pattern system, so if more than 5 patterns are being used the GetMetricData API will return an error.
- Dynamic labels only allow \${LABEL} to be used once per query. There’s no such restriction in the alias pattern system, so in case more than 1 is being used the GetMetricData API will return an error.
- When no alias is provided by the user, Grafana will no longer fallback with custom rules for naming the legend.
- In case a search expression is being used and no data is returned, Grafana will no longer expand dimension values, for instance when using a multi-valued template variable or star wildcard `*` in the dimension value field. Ref https://github.com/grafana/grafana/issues/20729
- Time series might be displayed in a different order. Using for example the dynamic label `${PROP('MetricName')}`, might have the consequence that the time series are returned in a different order compared to when the alias pattern `{{metric}}` is used

Issue [#49173](https://github.com/grafana/grafana/issues/49173)

In Elasticsearch, browser access mode was deprecated in grafana 7.4.0 and removed in 9.0.0. If you used this mode, please switch to server access mode on the datasource configuration page. Issue [#49014](https://github.com/grafana/grafana/issues/49014)

Environment variables passed from Grafana to external Azure plugins have been renamed:

- `AZURE_CLOUD` renamed to `GFAZPL_AZURE_CLOUD`
- `AZURE_MANAGED_IDENTITY_ENABLED` renamed to `GFAZPL_MANAGED_IDENTITY_ENABLED`
- `AZURE_MANAGED_IDENTITY_CLIENT_ID` renamed to `GFAZPL_MANAGED_IDENTITY_CLIENT_ID`

There are no known plugins which were relying on these variables. Moving forward plugins should read Azure settings only via Grafana Azure SDK which properly handles old and new environment variables. Issue [#48954](https://github.com/grafana/grafana/issues/48954)

Removes support for for ElasticSearch versions after their end-of-life, currently versions < 7.10.0. To continue to use ElasticSearch data source, upgrade ElasticSearch to version 7.10.0+.
Issue [#48715](https://github.com/grafana/grafana/issues/48715)

Application Insights and Insight Analytics queries in Azure Monitor were deprecated in Grafana 8.0 and finally removed in 9.0. Deprecated queries will no longer be executed. Please refer to the [documentation](https://grafana.com/docs/grafana/latest/datasources/azuremonitor/deprecated-application-insights/) for more information about this change.

Issue [#48328](https://github.com/grafana/grafana/issues/48328)

**grafana/ui: Button now specifies a default type="button"**

The `Button` component provided by @grafana/ui now specifies a default `type="button"` when no type is provided. In previous versions, if the attribute was not specified for buttons associated with a `<form>` the default value was `submit` per the [specification](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button#attr-type)

You can preserve the old behavior by explicitly setting the type attribute: `<Button type="submit" />`

[Github Issue #41863](https://github.com/grafana/grafana/issues/41863).
Issue [#48183](https://github.com/grafana/grafana/issues/48183)

The `Rename by regex` transformation has been improved to allow global patterns of the form `/<stringToReplace>/g`. Depending on the regex match used, this may cause some transformations to behave slightly differently. You can guarantee the same behaviour as before by wrapping the `match` string in forward slashes (`/`), e.g. `(.*)` would become `/(.*)/` Issue [#48179](https://github.com/grafana/grafana/issues/48179)

`<Select />` menus will now portal to the document body by default. This is to give more consistent behaviour when positioning and overlaying. If you were setting `menuShouldPortal={true}` before you can safely remove that prop and behaviour will be the same. If you weren't explicitly setting that prop, there should be no visible changes in behaviour but your tests may need updating. Please see the original PR (https://github.com/grafana/grafana/pull/36398) for migration guides. If you were setting `menuShouldPortal={false}` this will continue to prevent the menu from portalling.

Issue [#48176](https://github.com/grafana/grafana/issues/48176)

Grafana alerting endpoint prefixed with `api/v1/rule/test` that tests a rule against a Corte/Loki data source now expects the data source UID as a path parameter instead of the data source numeric identifier. Issue [#48070](https://github.com/grafana/grafana/issues/48070)

Grafana alerting endpoints prefixed with `api/prometheus/` that proxy requests to a Cortex/Loki data source now expect the data source UID as a path parameter instead of the data source numeric identifier. Issue [#48052](https://github.com/grafana/grafana/issues/48052)

Grafana alerting endpoints prefixed with `api/ruler/` that proxy requests to a Cortex/Loki data source now expect the data source UID as a path parameter instead of the data source numeric identifier. Issue [#48046](https://github.com/grafana/grafana/issues/48046)

Grafana alerting endpoints prefixed with `api/alertmanager/` that proxy requests to an Alertmanager now expect the data source UID as a path parameter instead of the data source numeric identifier. Issue [#47978](https://github.com/grafana/grafana/issues/47978)

The format of log messages have been updated, `lvl` is now `level` and `eror`and `dbug` has been replaced with `error` and `debug`. The precision of timestamps has been increased. To smooth the transition, it is possible to opt-out of the new log format by enabling the feature toggle `oldlog`. This option will be removed in a future minor release. Issue [#47584](https://github.com/grafana/grafana/issues/47584)

In the Loki data source, the dataframe format used to represent Loki logs-data has been changed to a more efficient format. The query-result is represented by a single dataframe with a "labels" column, instead of the separate dataframes for every labels-value. When displaying such data in explore, or in a logs-panel in the dashboard will continue to work without changes, but if the data was loaded into a different dashboard-panel, or Transforms were used, adjustments may be necessary. For example, if you used the "labels to fields" transformation with the logs data, please switch to the "extract fields" transformation. Issue [#47153](https://github.com/grafana/grafana/issues/47153)

### Deprecations

`setExploreQueryField`, `setExploreMetricsQueryField` and `setExploreLogsQueryField` are now deprecated and will be removed in a future release. If you need to set a different query editor for Explore, conditionally render based on `props.app` in your regular query editor. Please refer to https://grafana.com/docs/grafana/latest/developers/plugins/add-support-for-explore-queries/ for more information.
Issue [#48701](https://github.com/grafana/grafana/issues/48701)

### Plugin development fixes & changes

- **Chore:** Remove react-testing-lib from bundles. [#50442](https://github.com/grafana/grafana/pull/50442), [@jackw](https://github.com/jackw)
- **Select:** Portal menu by default. [#48176](https://github.com/grafana/grafana/pull/48176), [@ashharrison90](https://github.com/ashharrison90)

<!-- 9.0.0 END -->
<!-- 9.0.0-beta3 START -->

# 9.0.0-beta3 (2022-06-06)

### Features and enhancements

- **Alerting:** Add provenance guard to config api. [#50147](https://github.com/grafana/grafana/pull/50147), [@JohnnyQQQQ](https://github.com/JohnnyQQQQ)
- **Alerting:** Make folder filter clearable in Alert list panel. [#50093](https://github.com/grafana/grafana/pull/50093), [@peterholmberg](https://github.com/peterholmberg)
- **Alerting:** Provisioning API - Alert rules. [#47930](https://github.com/grafana/grafana/pull/47930), [@JohnnyQQQQ](https://github.com/JohnnyQQQQ)
- **Alerting:** Remove Image Upload code from Slack notifier. [#50062](https://github.com/grafana/grafana/pull/50062), [@joeblubaugh](https://github.com/joeblubaugh)
- **Alerting:** Remove double quotes from matchers. [#50038](https://github.com/grafana/grafana/pull/50038), [@gotjosh](https://github.com/gotjosh)
- **Cloudwatch:** Dynamic labels autocomplete. [#49794](https://github.com/grafana/grafana/pull/49794), [@sunker](https://github.com/sunker)
- **Datasource:** Remove deprecated max_idle_connections_per_host setting. [#49948](https://github.com/grafana/grafana/pull/49948), [@marefr](https://github.com/marefr)
- **Datasource:** Remove support for unencrypted passwords. [#49987](https://github.com/grafana/grafana/pull/49987), [@marefr](https://github.com/marefr)
- **Dependencies:** Update to Golang version `1.17.11`. [#50253](https://github.com/grafana/grafana/pull/50253), [@dsotirakis](https://github.com/dsotirakis)
- **Loki:** Run query when pressing Enter on line-filters. [#49913](https://github.com/grafana/grafana/pull/49913), [@svennergr](https://github.com/svennergr)
- **Metrics:** Remove support for using summaries instead of histogram for HTTP instrumentation. [#49985](https://github.com/grafana/grafana/pull/49985), [@bergquist](https://github.com/bergquist)
- **Plugins:** Remove deprecated /api/tsdb/query metrics endpoint. [#49916](https://github.com/grafana/grafana/pull/49916), [@wbrowne](https://github.com/wbrowne)
- **Plugins:** Support headers field for check health. [#49930](https://github.com/grafana/grafana/pull/49930), [@marefr](https://github.com/marefr)
- **Prometheus/Loki:** Add raw query and syntax highlight in explain mode. [#50070](https://github.com/grafana/grafana/pull/50070), [@aocenas](https://github.com/aocenas)
- **Prometheus:** Migrate metadata queries to use resource calls. [#49921](https://github.com/grafana/grafana/pull/49921), [@srclosson](https://github.com/srclosson)
- **RBAC:** Make RBAC action names more consistent. [#49730](https://github.com/grafana/grafana/pull/49730), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **RBAC:** Make RBAC action names more consistent. (Enterprise)
- **Settings:** Sunset non-duration based login lifetime config. [#49944](https://github.com/grafana/grafana/pull/49944), [@sakjur](https://github.com/sakjur)
- **[9.0.x] Alerting:** Update alert rule diff to not see difference between nil and empty map. [#50198](https://github.com/grafana/grafana/pull/50198), [@yuri-tceretian](https://github.com/yuri-tceretian)

### Bug fixes

- **Alerting:** Fix alert list panel showing firing alerts with no instances. [#50069](https://github.com/grafana/grafana/pull/50069), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Fix notification policy "Override grouping" form save. [#50031](https://github.com/grafana/grafana/pull/50031), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Remove double quotes from matchers. [#50046](https://github.com/grafana/grafana/pull/50046), [@alexweav](https://github.com/alexweav)
- **Alerting:** Use correct permission scope for external AM updates. [#50159](https://github.com/grafana/grafana/pull/50159), [@gillesdemey](https://github.com/gillesdemey)
- **Datasource:** Fix allowed cookies to be forwarded as header to backend datasources. [#49541](https://github.com/grafana/grafana/pull/49541), [@marefr](https://github.com/marefr)
- **Licensing:** Fix trial expiration warning. (Enterprise)
- **Loki:** Fix uncaught errors if `labelKey` contains special characters. [#49887](https://github.com/grafana/grafana/pull/49887), [@svennergr](https://github.com/svennergr)
- **Prometheus:** Fix aligning of labels of exemplars after backend migration. [#49924](https://github.com/grafana/grafana/pull/49924), [@aocenas](https://github.com/aocenas)
- **SharePDF:** Fix repeated datasource variables in PDF. (Enterprise)
- **State Timeline:** Fix Null Value Filling and Value Transformation. [#50054](https://github.com/grafana/grafana/pull/50054), [@codeincarnate](https://github.com/codeincarnate)
- **Usage stats:** Divide collection into multiple functions to isolate failures. [#49928](https://github.com/grafana/grafana/pull/49928), [@sakjur](https://github.com/sakjur)

### Breaking changes

Removes support for storing/using datasource `password` and `basicAuthPassword` unencrypted which was [deprecated in Grafana v8.1.0](https://grafana.com/docs/grafana/latest/installation/upgrading/#use-of-unencrypted-passwords-for-data-sources-no-longer-supported). Please use `secureJsonData.password` and `secureJsonData.basicAuthPassword`. Issue [#49987](https://github.com/grafana/grafana/issues/49987)

Removes the option to instrument HTTP request in Grafana using summaries instead of histograms. Issue [#49985](https://github.com/grafana/grafana/issues/49985)

Removes support for deprecated dataproxy.max_idle_connections_per_host setting. Please use max_idle_connections instead. Issue [#49948](https://github.com/grafana/grafana/issues/49948)

Removes the deprecated `getFormStyles` function from grafana-ui.
Prefer using `GrafanaTheme2` and the `useStyles2` hook. Issue [#49945](https://github.com/grafana/grafana/issues/49945)

The configuration options `auth.login_maximum_inactive_lifetime_days` and `auth.login_maximum_lifetime_days` were deprecated in Grafana v7.2.0 and have now been removed. Use `login_maximum_inactive_lifetime_duration` and `login_maximum_lifetime_duration` to customize the maximum lifetime of a login session. Issue [#49944](https://github.com/grafana/grafana/issues/49944)

Removed the deprecated `isFocused` and `isInvalid` props from the `InlineLabel` component. These props haven't done anything for a while, so migration is just a matter of removing the props. Issue [#49929](https://github.com/grafana/grafana/issues/49929)

Removed the deprecated `onColorChange` prop from `ColorPicker`. Moving forward the `onChange` prop should be used. Issue [#49923](https://github.com/grafana/grafana/issues/49923)

`/api/tsdb/query` API has been removed. Use [/api/ds/query](https://grafana.com/docs/grafana/latest/http_api/data_source/#query-a-data-source) instead.
Issue [#49916](https://github.com/grafana/grafana/issues/49916)

`onClipboardCopy` and `onClipboardError` APIs have been changed such that the callback's argument is just the text that's been copied rather than the old `ClipboardEvent` interface.
Migration should just be a matter of going from

```tsx
<ClipboardButton
  {/*other props... */}
  onClipboardCopy={(e) => {
    console.log(`Text "${e.text}" was copied!`);
  }}
/>
```

to

```tsx
<ClipboardButton
  {/* other props... */}
  onClipboardCopy={(copiedText) => {
    console.log(`Text "${copiedText}" was copied!`);
  }}
/>
```

Issue [#49847](https://github.com/grafana/grafana/issues/49847)

The following RBAC action renames have been carried out:

- `users.authtoken:update` -> `users.authtoken:write`;
- `users.password:update` -> `users.password:write`;
- `users.permissions:update` -> `users.permissions:write`;
- `users.quotas:update` -> `users.quotas:write`;
- `org.users.role:update` -> `org.users:write`;
- `alert.instances:update` -> `alert.instances:write`;
- `alert.rules:update` -> `alert.rules:write`;
- `users.authtoken:list` -> `users.authtoken:read`;
- `users.quotas:list` -> `users.quotas:read`;
- `users.teams:read` -> replaced by `users.read` + `teams:read`

We've added a migration from the old action names to the new names and have updated our documentation. But you will have to update any scripts and provisioning files that are using the old action names. Issue [#49730](https://github.com/grafana/grafana/issues/49730)

The following RBAC action renames have been carried out:

- `reports.admin:write` -> `reports:write`;
- `reports.admin:create` -> `reports:create`;
- `licensing:update` -> `licensing:write`;
- `roles:list` -> `roles:read`;
- `teams.roles:list` -> `teams.roles:read`;
- `users.roles:list` -> `users.roles:read`;
- `users.permissions:list` -> `users.permissions:read`

We've added a migration from the old action names to the new names and have updated our documentation. But you will have to update any scripts and provisioning files that are using the old action names. Issue [#3372](https://github.com/grafana/grafana/issues/3372)

### Plugin development fixes & changes

- **UI:** Remove deprecated getFormStyles function. [#49945](https://github.com/grafana/grafana/pull/49945), [@kaydelaney](https://github.com/kaydelaney)
- **InlineLabel:** Remove deprecated props. [#49929](https://github.com/grafana/grafana/pull/49929), [@kaydelaney](https://github.com/kaydelaney)
- **ColorPicker:** Remove deprecated onColorChange prop. [#49923](https://github.com/grafana/grafana/pull/49923), [@kaydelaney](https://github.com/kaydelaney)
- **ClipboardButton:** Simplify callbacks. [#49847](https://github.com/grafana/grafana/pull/49847), [@kaydelaney](https://github.com/kaydelaney)

<!-- 9.0.0-beta3 END -->
<!-- 9.0.0-beta2 START -->

# 9.0.0-beta2 (2022-05-31)

### Features and enhancements

- **Alerting:** Add legacy indicator to navbar. [#49511](https://github.com/grafana/grafana/pull/49511), [@peterholmberg](https://github.com/peterholmberg)
- **Alerting:** Add templated subject config to email notifier. [#49742](https://github.com/grafana/grafana/pull/49742), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Enable Unified Alerting for open source and enterprise. [#49834](https://github.com/grafana/grafana/pull/49834), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Make alertmanager datasource stable. [#49485](https://github.com/grafana/grafana/pull/49485), [@gillesdemey](https://github.com/gillesdemey)
- **Angular:** Remove deprecated angular modal support and libs. [#49781](https://github.com/grafana/grafana/pull/49781), [@torkelo](https://github.com/torkelo)
- **AuthProxy:** Remove deprecated ldap_sync_ttl setting. [#49902](https://github.com/grafana/grafana/pull/49902), [@kalleep](https://github.com/kalleep)
- **Build:** Enable long term caching for frontend assets. [#47625](https://github.com/grafana/grafana/pull/47625), [@jackw](https://github.com/jackw)
- **Chore:** Remove deprecated TextDisplayOptions export. [#49705](https://github.com/grafana/grafana/pull/49705), [@kaydelaney](https://github.com/kaydelaney)
- **Chore:** Remove deprecated `surface` prop from IconButton. [#49715](https://github.com/grafana/grafana/pull/49715), [@kaydelaney](https://github.com/kaydelaney)
- **Chore:** Remove usage of deprecated getColorForTheme function. [#49519](https://github.com/grafana/grafana/pull/49519), [@kaydelaney](https://github.com/kaydelaney)
- **DatePicker:** Add minDate prop. [#49503](https://github.com/grafana/grafana/pull/49503), [@alexanderzobnin](https://github.com/alexanderzobnin)
- **Notification history:** Enable by default. [#49502](https://github.com/grafana/grafana/pull/49502), [@ashharrison90](https://github.com/ashharrison90)
- **Prometheus:** Add pluginVersion to query. [#49414](https://github.com/grafana/grafana/pull/49414), [@toddtreece](https://github.com/toddtreece)
- **Prometheus:** Enable prometheusStreamingJSONParser by default. [#49475](https://github.com/grafana/grafana/pull/49475), [@toddtreece](https://github.com/toddtreece)
- **Prometheus:** Predefined scopes for Azure authentication. [#49557](https://github.com/grafana/grafana/pull/49557), [@kostrse](https://github.com/kostrse)
- **Prometheus:** Streaming JSON parser performance improvements. [#48792](https://github.com/grafana/grafana/pull/48792), [@toddtreece](https://github.com/toddtreece)
- **ValueMapping:** Add support for regex replacement over multiple lines. [#49607](https://github.com/grafana/grafana/pull/49607), [@ashharrison90](https://github.com/ashharrison90)

### Bug fixes

- **Accessibility:** Pressing escape in a Modal or DashboardSettings correctly closes the overlay. [#49500](https://github.com/grafana/grafana/pull/49500), [@ashharrison90](https://github.com/ashharrison90)
- **Alerting:** Validate alert notification UID length. [#45546](https://github.com/grafana/grafana/pull/45546), [@wbrowne](https://github.com/wbrowne)
- **BackendSrv:** Throw an error when fetching an invalid JSON. [#47493](https://github.com/grafana/grafana/pull/47493), [@leventebalogh](https://github.com/leventebalogh)
- **Fix:** Timeseries migration regex override. [#49629](https://github.com/grafana/grafana/pull/49629), [@zoltanbedi](https://github.com/zoltanbedi)
- **Loki:** Fix unwrap parsing in query builder. [#49732](https://github.com/grafana/grafana/pull/49732), [@ivanahuckova](https://github.com/ivanahuckova)
- **Navigation:** Position hamburger menu correctly in mobile view. [#49603](https://github.com/grafana/grafana/pull/49603), [@ashharrison90](https://github.com/ashharrison90)
- **PanelEditor:** Fixes issue with Table view and multi data frames. [#49854](https://github.com/grafana/grafana/pull/49854), [@JoaoSilvaGrafana](https://github.com/JoaoSilvaGrafana)
- **Preferences:** Fix updating of preferences for Navbar and Query History. [#49677](https://github.com/grafana/grafana/pull/49677), [@ivanahuckova](https://github.com/ivanahuckova)
- **TimeRange:** Fixes issue when zooming out on a timerange with timespan 0. [#49622](https://github.com/grafana/grafana/pull/49622), [@JoaoSilvaGrafana](https://github.com/JoaoSilvaGrafana)
- **Variables:** Fixes DS variables not being correctly used in panel queries. [#49323](https://github.com/grafana/grafana/pull/49323), [@JoaoSilvaGrafana](https://github.com/JoaoSilvaGrafana)

### Breaking changes

Drop support for deprecated setting ldap_sync_ttl under [auth.proxy]
Only sync_ttl will work from now on Issue [#49902](https://github.com/grafana/grafana/issues/49902)

Removes support for deprecated `heading` and `description` props. Moving forward, the `Card.Heading` and `Card.Description` components should be used. Issue [#49885](https://github.com/grafana/grafana/issues/49885)

Removes the deprecated `link` variant from the `Button` component.
To migrate, replace any usage of `variant="link"` with `fill="text"`. Issue [#49843](https://github.com/grafana/grafana/issues/49843)

Removes the deprecated `surface` prop from the `IconButton` component. This prop hasn't actually done anything for a while, so it should be safe to just remove any instances of its usage.
Issue [#49715](https://github.com/grafana/grafana/issues/49715)

Removes the deprecated `TextDisplayOptions` export from `@grafana/data` in favor of `VizTextDisplayOptions` from `@grafana/schema`. To migrate, just replace usage of `TextDisplayOptions` with `VizTextDisplayOptions`. Issue [#49705](https://github.com/grafana/grafana/issues/49705)

Removed support for the deprecated `getColorForTheme(color: string, theme: GrafanaTheme)` function in favor of the
`theme.visualization.getColorByName(color: string)` method. The output of this method is identical to the removed function, so migration should just be a matter of rewriting calls of `getColorForTheme(myColor, myTheme)` to `myTheme.visualization.getColorByName(myColor)`.
Issue [#49519](https://github.com/grafana/grafana/issues/49519)

In the Prometheus data source, for consistency and performance reasons, we changed how we represent `NaN` (not a number) values received from Prometheus. In the past versions, we converted these to `null` in the frontend (for dashboard and explore), and kept as `NaN` in the alerting path. Starting with this version, we will always keep it as `NaN`. This change should be mostly invisible for the users. Issue [#49475](https://github.com/grafana/grafana/issues/49475)

Plugins using custom Webpack configs could potentially break due to the changes between webpack@4 and webpack@5. Please refer to the [official migration guide](https://webpack.js.org/migrate/5/) for assistance.

Webpack 5 does not include polyfills for node.js core modules by default (e.g. `buffer`, `stream`, `os`). This can result in failed builds for plugins. If polyfills are required it is recommended to create a custom webpack config in the root of the plugin repo and add the required fallbacks:

```js
// webpack.config.js

module.exports.getWebpackConfig = (config, options) => ({
  ...config,
  resolve: {
    ...config.resolve,
    fallback: {
      os: require.resolve('os-browserify/browser'),
      stream: require.resolve('stream-browserify'),
      timers: require.resolve('timers-browserify'),
    },
  },
});
```

Please refer to the webpack build error messages or the [official migration guide](https://webpack.js.org/migrate/5/) for assistance with fallbacks.

**Which issue(s) this PR fixes**:

<!--

- Automatically closes linked issue when the Pull Request is merged.

Usage: "Fixes #<issue number>", or "Fixes (paste link of issue)"

-->

Fixes #

**Special notes for your reviewer**:

It does not bump the following dependencies to the very latest due to the latest versions being ES modules:

- ora
- globby
- execa
- chalk
  Issue [#47826](https://github.com/grafana/grafana/issues/47826)

We have changed the internals of `backendSrv.fetch()` to throw an error when the response is an incorrect JSON.

```javascript
// PREVIOUSLY: this was returning with an empty object {} - in case the response is an invalid JSON
return await getBackendSrv().post(`${API_ROOT}/${id}/install`);

// AFTER THIS CHANGE: the following will throw an error - in case the response is an invalid JSON
return await getBackendSrv().post(`${API_ROOT}/${id}/install`);
```

**When is the response handled as JSON?**

- If the response has the `"Content-Type: application/json"` header, OR
- If the backendSrv options ([`BackendSrvRequest`](https://github.com/grafana/grafana/blob/e237ff20a996c7313632b2e28f38032012f0e340/packages/grafana-runtime/src/services/backendSrv.ts#L8)) specify the response as JSON: `{ responseType: 'json' }`

**How does it work after this change?**

- In case it is recognised as a JSON response and the response is empty, it returns an empty object `{}`
- In case it is recognised as a JSON response and it has formatting errors, it throws an error

**How to migrate?**
Make sure to handle possible errors on the callsite where using `backendSrv.fetch()` (or any other `backendSrv` methods). Issue [#47493](https://github.com/grafana/grafana/issues/47493)

### Plugin development fixes & changes

- **UI/Card:** Remove deprecated props. [#49885](https://github.com/grafana/grafana/pull/49885), [@kaydelaney](https://github.com/kaydelaney)
- **UI/Button:** Remove deprecated "link" variant. [#49843](https://github.com/grafana/grafana/pull/49843), [@kaydelaney](https://github.com/kaydelaney)
- **Toolkit:** Bump dependencies. [#47826](https://github.com/grafana/grafana/pull/47826), [@jackw](https://github.com/jackw)

<!-- 9.0.0-beta2 END -->
<!-- 9.0.0-beta1 START -->

# 9.0.0-beta1 (2022-05-24)

### Features and enhancements

- **AccessControl:** Add setting for permission cache. (Enterprise)
- **AccessControl:** Check dashboard permissions for reports. (Enterprise)
- **Auth:** Remove grafana ui dependency to the aws sdk. [#43559](https://github.com/grafana/grafana/pull/43559), [@sunker](https://github.com/sunker)
- **BasicRoles:** Add API endpoint to reset basic roles permissions to factory. (Enterprise)
- **LDAP Mapping:** Allow Grafana Admin mapping without org role. [#37189](https://github.com/grafana/grafana/pull/37189), [@krzysdabro](https://github.com/krzysdabro)
- **Licensing:** Only enforce total number of users. (Enterprise)
- **Loki:** do not convert NaN to null. [#45389](https://github.com/grafana/grafana/pull/45389), [@gabor](https://github.com/gabor)
- **Report:** API support for multiple dashboards. (Enterprise)
- **Report:** Support sending embedded image in the report email. (Enterprise)
- **Report:** UI for multiple dashboards. (Enterprise)
- **Reporting:** Remove redundant empty attachment when export to CSV is enabled. (Enterprise)
- **SAML:** Implement Name Templates for assertion_attribute_name option. (Enterprise)
- **SSE/Alerting:** Support prom instant vector responses. [#44865](https://github.com/grafana/grafana/pull/44865), [@kylebrandt](https://github.com/kylebrandt)
- **Tracing:** Add trace to metrics config behind feature toggle. [#46298](https://github.com/grafana/grafana/pull/46298), [@connorlindsey](https://github.com/connorlindsey)

### Bug fixes

- **Fix:** Prevent automatic parsing of string data types to numbers. [#46035](https://github.com/grafana/grafana/pull/46035), [@joshhunt](https://github.com/joshhunt)
- **Prometheus:** Fix inconsistent labels in exemplars resulting in marshal json error. [#46135](https://github.com/grafana/grafana/pull/46135), [@hanjm](https://github.com/hanjm)

### Breaking changes

In the Loki data source, for consistency and performance reasons, we changed how we represent `NaN` (not a number) values received from Loki. In the past versions, we converted these to `null` in the frontend (for dashboard and explore), and kept as `NaN` in the alerting path. Starting with this version, we will always keep it as `NaN`. This change should be mostly invisible for the users. Issue [#45389](https://github.com/grafana/grafana/issues/45389)

The dependency to [grafana/aws-sdk](https://github.com/grafana/grafana-aws-sdk-react) is moved from [grafana/ui](https://github.com/grafana/grafana/blob/main/packages/grafana-ui/package.json) to the plugin. This means that any plugin that use SIGV4 auth need to pass a SIGV4 editor component as a prop to the `DataSourceHttpSettings` component. Issue [#43559](https://github.com/grafana/grafana/issues/43559)

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

<!-- previous CHANGELOG entries can be found in /.changelog-archive >
