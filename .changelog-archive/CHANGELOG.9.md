<!-- 9.4.12 START -->

# 9.4.12 (2023-06-06)

### Bug fixes

- **Query:** Prevent crash while executing concurrent mixed queries
- **Alerting:** Require alert.notifications:write permissions to test receivers and templates
- **RBAC:** Remove legacy AC editor and admin role on new dashboard route. [#68775](https://github.com/grafana/grafana/issues/68775), [@grafanabot](https://github.com/grafanabot)
- **Revert:** Allow editors to access GET /datasources. [#68653](https://github.com/grafana/grafana/issues/68653), [@grafanabot](https://github.com/grafanabot)
- **Explore:** Remove data source onboarding page. [#68642](https://github.com/grafana/grafana/issues/68642), [@grafanabot](https://github.com/grafanabot)

<!-- 9.4.12 END -->
<!-- 9.4.10 START -->

# 9.4.10 (2023-05-08)

### Features and enhancements

- **Chore:** Upgrade Go to 1.20.4. [#67760](https://github.com/grafana/grafana/issues/67760), [@papagian](https://github.com/papagian)

### Bug fixes

- **AzureMonitor:** Fix logs query multi-resource and timespan values. [#67931](https://github.com/grafana/grafana/issues/67931), [@grafanabot](https://github.com/grafanabot)
- **TimeSeries:** Fix leading null-fill for missing intervals. [#67572](https://github.com/grafana/grafana/issues/67572), [@leeoniya](https://github.com/leeoniya)
- **Alerting:** Fix misleading status code in provisioning API. [#67357](https://github.com/grafana/grafana/issues/67357), [@grafanabot](https://github.com/grafanabot)
- **Azure Monitor:** Fix bug that was not showing resources for certain locations. [#66617](https://github.com/grafana/grafana/issues/66617), [@grafanabot](https://github.com/grafanabot)

<!-- 9.4.10 END -->
<!-- 9.4.9 START -->

# 9.4.9 (2023-04-24)

### Features and enhancements

- **Chore:** Upgrade Go to 1.20.3. [#66836](https://github.com/grafana/grafana/issues/66836), [@sakjur](https://github.com/sakjur)

### Bug fixes

- **Expressions/threshold:** Fix incorrect thresholds args length. [#66925](https://github.com/grafana/grafana/issues/66925), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Fix share URL for Prometheus rules on subpath (#66752). [#66802](https://github.com/grafana/grafana/issues/66802), [@gillesdemey](https://github.com/gillesdemey)
- **Trace View:** Update the queryType to traceql for checking if same trace when clicking span link. [#66670](https://github.com/grafana/grafana/issues/66670), [@ericmustin](https://github.com/ericmustin)
- **Google Cloud Monitoring:** Fix project variable. [#66602](https://github.com/grafana/grafana/issues/66602), [@asimpson](https://github.com/asimpson)
- **InfluxDB:** Fix querying with hardcoded retention policy. [#66587](https://github.com/grafana/grafana/issues/66587), [@itsmylife](https://github.com/itsmylife)
- **Auth:** Remove the session cookie only if it's invalid or revoked. [#66430](https://github.com/grafana/grafana/issues/66430), [@mgyongyosi](https://github.com/mgyongyosi)
- **AccessControl:** Allow editors to access GET /api/datasources. [#66375](https://github.com/grafana/grafana/issues/66375), [@mgyongyosi](https://github.com/mgyongyosi)
- **CloudMonitoring:** Add project selector for MQL editor[fix]. [#65844](https://github.com/grafana/grafana/issues/65844), [@alyssabull](https://github.com/alyssabull)

<!-- 9.4.9 END -->
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
<!-- 9.3.15 START -->

# 9.3.15 (2023-06-06)

### Bug fixes

- **Alerting:** Require alert.notifications:write permissions to test receivers and templates
- **Auth:** Remove the session cookie only if it's invalid or revoked. [#68796](https://github.com/grafana/grafana/issues/68796), [@mgyongyosi](https://github.com/mgyongyosi)

<!-- 9.3.15 END -->
<!-- 9.3.14 START -->

# 9.3.14 (2023-05-08)

### Features and enhancements

- **Chore:** Upgrade Go to 1.20.4. [#67762](https://github.com/grafana/grafana/issues/67762), [@papagian](https://github.com/papagian)

<!-- 9.3.14 END -->
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
<!-- 9.2.19 START -->

# 9.2.19 (2023-06-06)

### Bug fixes

- **Alerting:** Require alert.notifications:write permissions to test receivers and templates
- **Auth:** Remove the session cookie only if it's invalid or revoked. [#68795](https://github.com/grafana/grafana/issues/68795), [@mgyongyosi](https://github.com/mgyongyosi)

<!-- 9.2.19 END -->
<!-- 9.2.18 START -->

# 9.2.18 (2023-05-08)

<!-- 9.2.18 END -->
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
