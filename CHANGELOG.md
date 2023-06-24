<!-- 10.0.1 START -->

# 10.0.1 (2023-06-22)

### Features and enhancements

- **Schema:** Improve Dashboard kind docs and remove deprecated props. [#69652](https://github.com/grafana/grafana/issues/69652), [@ivanortegaalba](https://github.com/ivanortegaalba)
- **Alerting:** Update alerting module to 20230524181453-a8e75e4dfdda. [#69011](https://github.com/grafana/grafana/issues/69011), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Caching:** Update labels for cache insertions counter. (Enterprise)

### Bug fixes

- **Auth:** Fixed CVE-2023-3128. [#70581](https://github.com/grafana/grafana/issues/70581), [@zerok](https://github.com/zerok)
- **Command palette:** Include help links. [#70322](https://github.com/grafana/grafana/issues/70322), [@ashharrison90](https://github.com/ashharrison90)
- **Tempo:** Use pipe in TraceQL by default for multi-value variables. [#70321](https://github.com/grafana/grafana/issues/70321), [@joey-grafana](https://github.com/joey-grafana)
- **XYChart/Trend:** Fix min/max and units/decimals X field overrides. [#70261](https://github.com/grafana/grafana/issues/70261), [@leeoniya](https://github.com/leeoniya)
- **Explore:** Improve logs volume panel empty state. [#70255](https://github.com/grafana/grafana/issues/70255), [@Elfo404](https://github.com/Elfo404)
- **Plugins:** Wrap original check health error. [#70227](https://github.com/grafana/grafana/issues/70227), [@kousikmitra](https://github.com/kousikmitra)
- **XYChart:** Fix variable interpolation in datalinks/toggletip. [#70210](https://github.com/grafana/grafana/issues/70210), [@leeoniya](https://github.com/leeoniya)
- **XYChart:** Fix formatting of axis ticks (units, decimals). [#70193](https://github.com/grafana/grafana/issues/70193), [@leeoniya](https://github.com/leeoniya)
- **Auth:** Show invite button if disable login form is set to false. [#70155](https://github.com/grafana/grafana/issues/70155), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **TextPanel:** Fix <summary> styling missing the disclosure triangle. [#70138](https://github.com/grafana/grafana/issues/70138), [@joshhunt](https://github.com/joshhunt)
- **Alerting:** Fix email template for text/plain emails. [#70111](https://github.com/grafana/grafana/issues/70111), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Explore:** Fixed Starred query history tab to show all starred queries. [#70092](https://github.com/grafana/grafana/issues/70092), [@harisrozajac](https://github.com/harisrozajac)
- **CodeEditor:** Ensure suggestions only apply to the instance of the edit…. [#70067](https://github.com/grafana/grafana/issues/70067), [@ashharrison90](https://github.com/ashharrison90)
- **Command Palette:** Links opened in a new tab now route correctly when Grafana is served under a subpath. [#69925](https://github.com/grafana/grafana/issues/69925), [@ashharrison90](https://github.com/ashharrison90)
- **Heatmap:** Sort fields by numeric names when single frame. [#69880](https://github.com/grafana/grafana/issues/69880), [@leeoniya](https://github.com/leeoniya)
- **CloudMonitoring:** Improve parsing of GCM labels. [#69812](https://github.com/grafana/grafana/issues/69812), [@aangelisc](https://github.com/aangelisc)
- **NestedFolders:** Fix select all in folder view selecting items out of folder. [#69783](https://github.com/grafana/grafana/issues/69783), [@joshhunt](https://github.com/joshhunt)
- **Alerting:** Fix notification policies inheritance algorithm (#69304). [#69782](https://github.com/grafana/grafana/issues/69782), [@gillesdemey](https://github.com/gillesdemey)
- **Templating:** Fix updating of definition to empty string. [#69767](https://github.com/grafana/grafana/issues/69767), [@ivanahuckova](https://github.com/ivanahuckova)
- **Alerting:** Support newer http_config struct. [#69719](https://github.com/grafana/grafana/issues/69719), [@gillesdemey](https://github.com/gillesdemey)
- **Loki:** Fix including of template variables in variable query editor. [#69709](https://github.com/grafana/grafana/issues/69709), [@ivanahuckova](https://github.com/ivanahuckova)
- **Azure:** Fix Kusto auto-completion for Azure datasources (#69685). [#69695](https://github.com/grafana/grafana/issues/69695), [@aangelisc](https://github.com/aangelisc)
- **Alerting:** Fix broken UI because of query being optional for some ExpressionQuer…. [#69683](https://github.com/grafana/grafana/issues/69683), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Explore:** Run remaining queries when one is removed from a pane. [#69670](https://github.com/grafana/grafana/issues/69670), [@Elfo404](https://github.com/Elfo404)
- **Dashboards:** Variables - Improve slow template variable loading due same variable loaded multiple times on time range change. [#69641](https://github.com/grafana/grafana/issues/69641), [@axelavargas](https://github.com/axelavargas)
- **Loki:** Fix error when empty template variables response. [#69559](https://github.com/grafana/grafana/issues/69559), [@ivanahuckova](https://github.com/ivanahuckova)
- **Alerting:** Add heuristics back to datasource healthchecks. [#69541](https://github.com/grafana/grafana/issues/69541), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Util:** Fix panic when generating UIDs concurrently. [#69538](https://github.com/grafana/grafana/issues/69538), [@JohnnyQQQQ](https://github.com/JohnnyQQQQ)
- **Alerting:** Fix provisioned templates being ignored by alertmanager. [#69488](https://github.com/grafana/grafana/issues/69488), [@JacobsonMT](https://github.com/JacobsonMT)
- **Log Context:** Fix split view button using the wrong query. [#69416](https://github.com/grafana/grafana/issues/69416), [@svennergr](https://github.com/svennergr)
- **Pyroscope:** Fix wrong defaults when importing query from different datasource. [#69366](https://github.com/grafana/grafana/issues/69366), [@aocenas](https://github.com/aocenas)
- **InfluxDB:** Interpolate retention policies. [#69300](https://github.com/grafana/grafana/issues/69300), [@itsmylife](https://github.com/itsmylife)
- **SQLStore:** Align SQLite IsUniqueConstraintViolation() with other backend implementations. [#69227](https://github.com/grafana/grafana/issues/69227), [@papagian](https://github.com/papagian)
- **Dashboards:** Remove Explore option from panel menu when panel's datasource uid is "-- Dashboard --". [#69173](https://github.com/grafana/grafana/issues/69173), [@harisrozajac](https://github.com/harisrozajac)
- **Alerting:** Fix "show all instances". [#67837](https://github.com/grafana/grafana/issues/67837), [@gillesdemey](https://github.com/gillesdemey)
- **Usage Insights:** Fix last viewed date. (Enterprise)
- **Caching:** Fix issue in which caching can cause HTTP resource response bodies to be written twice. (Enterprise)

<!-- 10.0.1 END -->
<!-- 10.0.0 START -->

# 10.0.0 (2023-06-12)

### Features and enhancements

- **Themes:** Unify secondary button and ToolbarButton. [#69049](https://github.com/grafana/grafana/issues/69049), [@torkelo](https://github.com/torkelo)
- **PublicDashboards:** Email sharing users with active sessions added in Users list . (Enterprise)
- **Caching:** Ensure context-canceled are not reported as errors . (Enterprise)
- **SAML:** Configuration UI. (Enterprise)

### Bug fixes

- **Query Editor:** Ensure dropdown menus position correctly. [#69131](https://github.com/grafana/grafana/issues/69131), [@grafanabot](https://github.com/grafanabot)
- **Drawer:** Fixes closeOnMaskClick false issue. [#69103](https://github.com/grafana/grafana/issues/69103), [@grafanabot](https://github.com/grafanabot)
- **SAML:** Fix IdP metadata caching so that invalid metadata doesn't get cached. (Enterprise)

<!-- 10.0.0 END -->
<!-- 10.0.0-preview START -->

# 10.0.0-preview (2023-05-31)

### Features and enhancements

- **Alerting:** Migrate unknown NoData\Error settings to the default. [#69010](https://github.com/grafana/grafana/issues/69010), [@grafanabot](https://github.com/grafanabot)
- **Drawer:** Position under nav & minor redesign . [#68396](https://github.com/grafana/grafana/issues/68396), [@grafanabot](https://github.com/grafanabot)
- **Navigation:** Add keyboard shortcut to navigate directly to Dashboards. [#68374](https://github.com/grafana/grafana/issues/68374), [@grafanabot](https://github.com/grafanabot)
- **Explore:** Promote exploreMixedDatasource to Stable & enable by default. [#68353](https://github.com/grafana/grafana/issues/68353), [@Elfo404](https://github.com/Elfo404)
- **Tempo:** Escape regex-sensitive characters in span name before building promql query. [#68313](https://github.com/grafana/grafana/issues/68313), [@grafanabot](https://github.com/grafanabot)
- **Drawer:** Introduce a size property that set's width percentage and minWidth . [#68128](https://github.com/grafana/grafana/issues/68128), [@grafanabot](https://github.com/grafanabot)
- **AngularDeprecation:** Show warnings in panel edit for angular panels. [#68083](https://github.com/grafana/grafana/issues/68083), [@grafanabot](https://github.com/grafanabot)
- **Dashboard:** Change add panel button to fill to remove outline border. [#68017](https://github.com/grafana/grafana/issues/68017), [@grafanabot](https://github.com/grafanabot)
- **Query History:** Remove migration. [#67470](https://github.com/grafana/grafana/issues/67470), [@Elfo404](https://github.com/Elfo404)
- **Alerting:** Implement template testing endpoint. [#67450](https://github.com/grafana/grafana/issues/67450), [@JacobsonMT](https://github.com/JacobsonMT)
- **Trace View:** Export trace button . [#67368](https://github.com/grafana/grafana/issues/67368), [@adrapereira](https://github.com/adrapereira)
- **Alerting:** Update grafana/alerting to 4f09f51. [#67329](https://github.com/grafana/grafana/issues/67329), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Cloudwatch:** Add FraudDetector namespace with metrics and dimensions. [#67318](https://github.com/grafana/grafana/issues/67318), [@ffje](https://github.com/ffje)
- **Timeseries:** Migrate legend hideFrom. [#67305](https://github.com/grafana/grafana/issues/67305), [@adela-almasan](https://github.com/adela-almasan)
- **CloudWatch:** Deprecate dynamic labels feature toggle, remove support for Alias in frontend. [#67222](https://github.com/grafana/grafana/issues/67222), [@fridgepoet](https://github.com/fridgepoet)
- **Docs:** Create documentation for enterprise caching HTTP API. [#67169](https://github.com/grafana/grafana/issues/67169), [@mmandrus](https://github.com/mmandrus)
- **Cloudwatch Logs:** Update Cheatsheet. [#67161](https://github.com/grafana/grafana/issues/67161), [@sarahzinger](https://github.com/sarahzinger)
- **Alerting:** Add alert instance picker. [#67138](https://github.com/grafana/grafana/issues/67138), [@VikaCep](https://github.com/VikaCep)
- **Loki:** Enable dataplane-compliant metric data by default. [#67137](https://github.com/grafana/grafana/issues/67137), [@gabor](https://github.com/gabor)
- **Loki:** Enable new log context query editor. [#67131](https://github.com/grafana/grafana/issues/67131), [@ivanahuckova](https://github.com/ivanahuckova)
- **Elasticsearch:** Deprecate index setting for annotation queries. [#67046](https://github.com/grafana/grafana/issues/67046), [@ivanahuckova](https://github.com/ivanahuckova)
- **Search:** Preserves search filters when navigating to another page. [#67021](https://github.com/grafana/grafana/issues/67021), [@khushijain21](https://github.com/khushijain21)
- **PanelContext:** Add functionality to update data from panel. [#66993](https://github.com/grafana/grafana/issues/66993), [@torkelo](https://github.com/torkelo)
- **Phlare:** Support both Phlare and Pyroscope backends and rename to Grafana Pyroscope. [#66989](https://github.com/grafana/grafana/issues/66989), [@aocenas](https://github.com/aocenas)
- **Packaging:** Added deprecation warnings when running `grafana-cli` or `grafana-server`; the `grafana` command should be used instead. [#66976](https://github.com/grafana/grafana/issues/66976), [@kminehart](https://github.com/kminehart)
- **Elasticsearch:** Update required database version to 7.16. [#66928](https://github.com/grafana/grafana/issues/66928), [@gabor](https://github.com/gabor)
- **Alert:** Redesign with tinted background . [#66918](https://github.com/grafana/grafana/issues/66918), [@torkelo](https://github.com/torkelo)
- **Auth:** Make GitHub auth's allowed_organizations be case insensitive. [#66879](https://github.com/grafana/grafana/issues/66879), [@consideRatio](https://github.com/consideRatio)
- **Elasticsearch:** Deprecate the usage of the database field in provisioning. [#66828](https://github.com/grafana/grafana/issues/66828), [@gwdawson](https://github.com/gwdawson)
- **CSRF middleware:** Add flag to skip login cookie check. [#66806](https://github.com/grafana/grafana/issues/66806), [@PoorlyDefinedBehaviour](https://github.com/PoorlyDefinedBehaviour)
- **Alerting:** Use URLs in image annotations. [#66804](https://github.com/grafana/grafana/issues/66804), [@santihernandezc](https://github.com/santihernandezc)
- **AppRootPage:** Reduce flickering while loading plugin. [#66799](https://github.com/grafana/grafana/issues/66799), [@torkelo](https://github.com/torkelo)
- **Alerting:** Make Loki & Prometheus instant vector by default. [#66797](https://github.com/grafana/grafana/issues/66797), [@gillesdemey](https://github.com/gillesdemey)
- **Log Context:** Add button to open the context query in a split view. [#66777](https://github.com/grafana/grafana/issues/66777), [@svennergr](https://github.com/svennergr)
- **APIkeys:** Add metrics for apikey endpoints. [#66732](https://github.com/grafana/grafana/issues/66732), [@eleijonmarck](https://github.com/eleijonmarck)
- **ServeFromSubPath:** Redirect to URL with subpath when subpath missing. [#66724](https://github.com/grafana/grafana/issues/66724), [@torkelo](https://github.com/torkelo)
- **RBAC:** Remove the option to disable RBAC and add automated permission migrations for instances that had RBAC disabled. [#66652](https://github.com/grafana/grafana/issues/66652), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Plugins:** Remove secure socks proxy feature toggle. [#66611](https://github.com/grafana/grafana/issues/66611), [@stephaniehingtgen](https://github.com/stephaniehingtgen)
- **Alerting:** Loki-based alert state history modal. [#66595](https://github.com/grafana/grafana/issues/66595), [@konrad147](https://github.com/konrad147)
- **Explore:** Promote exploreMixedDatasource feature toggle to beta. [#66552](https://github.com/grafana/grafana/issues/66552), [@ifrost](https://github.com/ifrost)
- **Chore:** Clean up NavModel interface. [#66548](https://github.com/grafana/grafana/issues/66548), [@ashharrison90](https://github.com/ashharrison90)
- **Alerting:** Scheduler use rule fingerprint instead of version. [#66531](https://github.com/grafana/grafana/issues/66531), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **CloudWatch:** Deprecate dynamic labels feature toggle, remove support for Alias in backend. [#66494](https://github.com/grafana/grafana/issues/66494), [@fridgepoet](https://github.com/fridgepoet)
- **RBAC:** Make access control metadata for folders work with nested folders. [#66464](https://github.com/grafana/grafana/issues/66464), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Tracing:** Add links to documentation in config pages. [#66442](https://github.com/grafana/grafana/issues/66442), [@joey-grafana](https://github.com/joey-grafana)
- **Loki:** Always display log context toggle. [#66379](https://github.com/grafana/grafana/issues/66379), [@matyax](https://github.com/matyax)
- **Datagrid Panel:** Edit data within your dashboards. [#66353](https://github.com/grafana/grafana/issues/66353), [@mdvictor](https://github.com/mdvictor)
- **Annotations:** Support filtering the target panels. [#66325](https://github.com/grafana/grafana/issues/66325), [@ryantxu](https://github.com/ryantxu)
- **Alerting:** Use default page size of 5000 when querying Loki for state history. [#66315](https://github.com/grafana/grafana/issues/66315), [@alexweav](https://github.com/alexweav)
- **GrafanaData:** Remove obsolete logs exports. [#66271](https://github.com/grafana/grafana/issues/66271), [@gabor](https://github.com/gabor)
- **Alerting:** Update legacy alerting warning. [#66269](https://github.com/grafana/grafana/issues/66269), [@armandgrillet](https://github.com/armandgrillet)
- **GrafanaUI:** Remove obsolete logs exports. [#66268](https://github.com/grafana/grafana/issues/66268), [@gabor](https://github.com/gabor)
- **Explore:** Remove deprecated DataSourceWithLogsVolumeSupport. [#66266](https://github.com/grafana/grafana/issues/66266), [@ivanahuckova](https://github.com/ivanahuckova)
- **Chore:** Upgrade Go to 1.20.3. [#66264](https://github.com/grafana/grafana/issues/66264), [@sakjur](https://github.com/sakjur)
- **Design System:** Set TextArea to display: block in order to remove spacing below. [#66262](https://github.com/grafana/grafana/issues/66262), [@L-M-K-B](https://github.com/L-M-K-B)
- **Elasticsearch:** Add feature toggle to disable running queries trough backend. [#66260](https://github.com/grafana/grafana/issues/66260), [@ivanahuckova](https://github.com/ivanahuckova)
- **Correlations:** Add transformation editor. [#66217](https://github.com/grafana/grafana/issues/66217), [@gelicia](https://github.com/gelicia)
- **Logs Navigation:** Scroll to first log when using pagination. [#66214](https://github.com/grafana/grafana/issues/66214), [@matyax](https://github.com/matyax)
- **Search:** Add clear search button to the input bar. [#66204](https://github.com/grafana/grafana/issues/66204), [@khushijain21](https://github.com/khushijain21)
- **Visualizations:** Choose color based on series name. [#66197](https://github.com/grafana/grafana/issues/66197), [@lukepalmer](https://github.com/lukepalmer)
- **FieldValues:** Use plain arrays instead of Vector (part 1 of 2). [#66187](https://github.com/grafana/grafana/issues/66187), [@ryantxu](https://github.com/ryantxu)
- **Users:** Enable case insensitive login by default. [#66134](https://github.com/grafana/grafana/issues/66134), [@Jguer](https://github.com/Jguer)
- **Loki Query Editor:** Increase autocomplete suggestions window with to 50%. [#66041](https://github.com/grafana/grafana/issues/66041), [@matyax](https://github.com/matyax)
- **Instrumentation:** Add support for instrumenting database queries. [#66022](https://github.com/grafana/grafana/issues/66022), [@bergquist](https://github.com/bergquist)
- **Loki:** Add feature flag to enable dataplane-compliant metric frames. [#66017](https://github.com/grafana/grafana/issues/66017), [@gabor](https://github.com/gabor)
- **Tempo:** Encode IDs as hexadecimal when downloading traces. [#66001](https://github.com/grafana/grafana/issues/66001), [@kousikmitra](https://github.com/kousikmitra)
- **Cloudwatch:** Add missing AWS/IVS namespace metrics. [#65985](https://github.com/grafana/grafana/issues/65985), [@idastambuk](https://github.com/idastambuk)
- **Alerting:** Remove and revert flag alertingBigTransactions. [#65976](https://github.com/grafana/grafana/issues/65976), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Attach hash of instance labels to state history log lines. [#65968](https://github.com/grafana/grafana/issues/65968), [@alexweav](https://github.com/alexweav)
- **API keys:** Add deprecation to api keys. [#65948](https://github.com/grafana/grafana/issues/65948), [@eleijonmarck](https://github.com/eleijonmarck)
- **Logs:** Redesign and improve LogContext. [#65939](https://github.com/grafana/grafana/issues/65939), [@svennergr](https://github.com/svennergr)
- **Loki:** Remove alpha feature toggle lokiDataframeApi. [#65918](https://github.com/grafana/grafana/issues/65918), [@gabor](https://github.com/gabor)
- **Packaging:** Remove chkconfig dependency. [#65887](https://github.com/grafana/grafana/issues/65887), [@DanCech](https://github.com/DanCech)
- **Explore:** Run test datasource default selection when mounted. [#65864](https://github.com/grafana/grafana/issues/65864), [@gelicia](https://github.com/gelicia)
- **Service Accounts:** Allow unsetting token expiry date. [#65862](https://github.com/grafana/grafana/issues/65862), [@kousikmitra](https://github.com/kousikmitra)
- **SQL Datasources:** Update Max Connection and Max Idle Connection Defaults to 100 and add auto mode. [#65834](https://github.com/grafana/grafana/issues/65834), [@codeincarnate](https://github.com/codeincarnate)
- **DashlistPanel:** Add options to include time range and variable values. [#65757](https://github.com/grafana/grafana/issues/65757), [@VictorColomb](https://github.com/VictorColomb)
- **Alerting:** Add endpoint to revert to a previous alertmanager configuration. [#65751](https://github.com/grafana/grafana/issues/65751), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Document state history config options in default and sample configuration files. [#65748](https://github.com/grafana/grafana/issues/65748), [@alexweav](https://github.com/alexweav)
- **Alerting:** Choose a previous valid AM configuration in case of error. [#65746](https://github.com/grafana/grafana/issues/65746), [@VikaCep](https://github.com/VikaCep)
- **Traces:** Span filtering. [#65725](https://github.com/grafana/grafana/issues/65725), [@joey-grafana](https://github.com/joey-grafana)
- **Caching:** Refactor enterprise query caching middleware to a wire service. [#65616](https://github.com/grafana/grafana/issues/65616), [@mmandrus](https://github.com/mmandrus)
- **Alerting:** Implement template preview for Grafana AlertManager. [#65530](https://github.com/grafana/grafana/issues/65530), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Dropdown:** Stop Dropdown accepting a function as children. [#65467](https://github.com/grafana/grafana/issues/65467), [@ashharrison90](https://github.com/ashharrison90)
- **GrafanaDS:** Add support for annotation time regions. [#65462](https://github.com/grafana/grafana/issues/65462), [@leeoniya](https://github.com/leeoniya)
- **Alerting:** Add support for running HA using Redis. [#65267](https://github.com/grafana/grafana/issues/65267), [@JohnnyQQQQ](https://github.com/JohnnyQQQQ)
- **Tempo:** Add kind to TraceQL intrinsics. [#65111](https://github.com/grafana/grafana/issues/65111), [@adrapereira](https://github.com/adrapereira)
- **Feature:** Trusted Types support. [#64975](https://github.com/grafana/grafana/issues/64975), [@KristianGrafana](https://github.com/KristianGrafana)
- **AzureMonitor:** Application Insights Traces. [#64859](https://github.com/grafana/grafana/issues/64859), [@aangelisc](https://github.com/aangelisc)
- **Chore:** Remove deprecated dashboardId from panel query runner. [#64786](https://github.com/grafana/grafana/issues/64786), [@ryantxu](https://github.com/ryantxu)
- **DataFrame:** Handle nanosecond-precision timestamp fields. [#64529](https://github.com/grafana/grafana/issues/64529), [@gabor](https://github.com/gabor)
- **EditDataSources:** Add EditDataSourceActions to EditDataSourcePages. [#64487](https://github.com/grafana/grafana/issues/64487), [@mikkancso](https://github.com/mikkancso)
- **Chore:** Upgrade to react 18. [#64428](https://github.com/grafana/grafana/issues/64428), [@ashharrison90](https://github.com/ashharrison90)
- **Canvas:** Connection properties based on data. [#64360](https://github.com/grafana/grafana/issues/64360), [@adela-almasan](https://github.com/adela-almasan)
- **Explore:** Align multiple log volumes. [#64356](https://github.com/grafana/grafana/issues/64356), [@ifrost](https://github.com/ifrost)
- **Explore:** Clear live logs. [#64237](https://github.com/grafana/grafana/issues/64237), [@abdulhdr1](https://github.com/abdulhdr1)
- **TimeSeries:** Explicitly add transformer when timeseries-long exists. [#64092](https://github.com/grafana/grafana/issues/64092), [@ryantxu](https://github.com/ryantxu)
- **SAML:** Configuration UI. [#64054](https://github.com/grafana/grafana/issues/64054), [@alexanderzobnin](https://github.com/alexanderzobnin)
- **Alerting:** Use configured headers for external alertmanager. [#63819](https://github.com/grafana/grafana/issues/63819), [@JohnnyQQQQ](https://github.com/JohnnyQQQQ)
- **Prometheus:** Incremental querying option for `to: now` dashboards. [#62932](https://github.com/grafana/grafana/issues/62932), [@leeoniya](https://github.com/leeoniya)
- **Dashboard:** Add series color shades. [#61300](https://github.com/grafana/grafana/issues/61300), [@jkraml-staffbase](https://github.com/jkraml-staffbase)

### Bug fixes

- **ResourcePicker:** Fix missing border bug on cancel button. [#69113](https://github.com/grafana/grafana/issues/69113), [@nmarrs](https://github.com/nmarrs)
- **TimeSeries:** Fix centeredZero y axis ranging when all values are 0. [#69112](https://github.com/grafana/grafana/issues/69112), [@grafanabot](https://github.com/grafanabot)
- **StatusHistory:** Fix rendering of value-mapped null. [#69108](https://github.com/grafana/grafana/issues/69108), [@grafanabot](https://github.com/grafanabot)
- **Alerting:** Fix provenance guard checks for Alertmanager configuration to not cause panic when compared nested objects. [#69094](https://github.com/grafana/grafana/issues/69094), [@grafanabot](https://github.com/grafanabot)
- **Alerting:** Add support for Alert State History Loki primary. [#69077](https://github.com/grafana/grafana/issues/69077), [@grafanabot](https://github.com/grafanabot)
- **Dashboards:** Fix undefined aria labels in Annotation Checkboxes for Programmatic Access. [#68873](https://github.com/grafana/grafana/issues/68873), [@grafanabot](https://github.com/grafanabot)
- **Alerting:** Fix stale query preview error. [#68836](https://github.com/grafana/grafana/issues/68836), [@grafanabot](https://github.com/grafanabot)
- **AnonymousAuth:** Fix concurrent read-write crash. [#68803](https://github.com/grafana/grafana/issues/68803), [@grafanabot](https://github.com/grafanabot)
- **AzureMonitor:** Ensure legacy properties containing template variables are correctly migrated. [#68792](https://github.com/grafana/grafana/issues/68792), [@grafanabot](https://github.com/grafanabot)
- **Alerting:** Add additional contact points for external AM. [#68778](https://github.com/grafana/grafana/issues/68778), [@grafanabot](https://github.com/grafanabot)
- **RBAC:** Remove legacy AC editor and admin role on new dashboard route. [#68777](https://github.com/grafana/grafana/issues/68777), [@grafanabot](https://github.com/grafanabot)
- **Azure Monitor:** Fix bug with top value so more than 10 resources can be shown . [#68725](https://github.com/grafana/grafana/issues/68725), [@grafanabot](https://github.com/grafanabot)
- **NodeGraph:** Fix overlaps preventing opening an edge context menu when nodes were too close. [#68628](https://github.com/grafana/grafana/issues/68628), [@grafanabot](https://github.com/grafanabot)
- **Plugins:** Correct the usage of mutex for gRPC plugin implementation. [#68609](https://github.com/grafana/grafana/issues/68609), [@grafanabot](https://github.com/grafanabot)
- **Azure Monitor:** Fix bug that did not show alert rule preview. [#68581](https://github.com/grafana/grafana/issues/68581), [@grafanabot](https://github.com/grafanabot)
- **FlameGraph:** Fix table sort being reset when search changes. [#68454](https://github.com/grafana/grafana/issues/68454), [@grafanabot](https://github.com/grafanabot)
- **Command Palette:** Prevent stale search results from overwriting newer results. [#68392](https://github.com/grafana/grafana/issues/68392), [@grafanabot](https://github.com/grafanabot)
- **Search:** Fix Search returning results out of order. [#68387](https://github.com/grafana/grafana/issues/68387), [@joshhunt](https://github.com/joshhunt)
- **Explore:** Remove data source onboarding page. [#68381](https://github.com/grafana/grafana/issues/68381), [@grafanabot](https://github.com/grafanabot)
- **Flamegraph:** Fix tooltip positioning. [#68312](https://github.com/grafana/grafana/issues/68312), [@grafanabot](https://github.com/grafanabot)
- **Pyroscope:** Add authentication when calling backendType resource API. [#68311](https://github.com/grafana/grafana/issues/68311), [@grafanabot](https://github.com/grafanabot)
- **Histogram:** Respect min/max panel settings for x-axis. [#68245](https://github.com/grafana/grafana/issues/68245), [@grafanabot](https://github.com/grafanabot)
- **QueryRow:** Make toggle actions screen-readers accessible. [#68210](https://github.com/grafana/grafana/issues/68210), [@grafanabot](https://github.com/grafanabot)
- **Heatmap:** Fix color rendering for value ranges < 1. [#68164](https://github.com/grafana/grafana/issues/68164), [@grafanabot](https://github.com/grafanabot)
- **Heatmap:** Handle unsorted timestamps in calculate mode. [#68151](https://github.com/grafana/grafana/issues/68151), [@grafanabot](https://github.com/grafanabot)
- **Alerting:** Fixes Alert list panel "ungrouped" regression. [#68090](https://github.com/grafana/grafana/issues/68090), [@grafanabot](https://github.com/grafanabot)
- **Alerting:** Show export button for org admins. [#67995](https://github.com/grafana/grafana/issues/67995), [@grafanabot](https://github.com/grafanabot)
- **Navigation:** Fix 'Page not found' when sending or going back from 'Invitate user' page. [#67972](https://github.com/grafana/grafana/issues/67972), [@grafanabot](https://github.com/grafanabot)
- **InspectDrawer:** Fixes issue with double scrollbars. [#67888](https://github.com/grafana/grafana/issues/67888), [@grafanabot](https://github.com/grafanabot)
- **Connections:** Show core datasource plugins as well. [#67886](https://github.com/grafana/grafana/issues/67886), [@grafanabot](https://github.com/grafanabot)
- **Gauge:** Set min and max for percent unit. [#67719](https://github.com/grafana/grafana/issues/67719), [@grafanabot](https://github.com/grafanabot)
- **TimeSeries:** Fix leading null-fill for missing intervals. [#67570](https://github.com/grafana/grafana/issues/67570), [@leeoniya](https://github.com/leeoniya)
- **Pyroscope:** Fix autodetection in case of using Phlare backend. [#67536](https://github.com/grafana/grafana/issues/67536), [@aocenas](https://github.com/aocenas)
- **Dashboard:** Revert fixed header shown on mobile devices in the new panel header. [#67510](https://github.com/grafana/grafana/issues/67510), [@axelavargas](https://github.com/axelavargas)
- **PostgreSQL:** Fix tls certificate issue by downgrading lib/pq. [#67372](https://github.com/grafana/grafana/issues/67372), [@zoltanbedi](https://github.com/zoltanbedi)
- **Alerting:** Fix misleading status code in provisioning API. [#67331](https://github.com/grafana/grafana/issues/67331), [@usommerl](https://github.com/usommerl)
- **Explore:** Update table min height . [#67321](https://github.com/grafana/grafana/issues/67321), [@adrapereira](https://github.com/adrapereira)
- **Provisioning:** Fix provisioning issues with legacy alerting and data source permissions. [#67308](https://github.com/grafana/grafana/issues/67308), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Proxy:** Improve header handling for reverse proxy. [#67279](https://github.com/grafana/grafana/issues/67279), [@sakjur](https://github.com/sakjur)
- **Loki:** Fix log samples using `instant` queries. [#67271](https://github.com/grafana/grafana/issues/67271), [@svennergr](https://github.com/svennergr)
- **Alerting:** Fix panic when reparenting receivers to groups following an attempted rename via Provisioning. [#67167](https://github.com/grafana/grafana/issues/67167), [@alexweav](https://github.com/alexweav)
- **Loki:** Fix incorrect evaluation of real and extracted labels in context. [#67112](https://github.com/grafana/grafana/issues/67112), [@ivanahuckova](https://github.com/ivanahuckova)
- **Cloudwatch Logs:** Clarify Cloudwatch Logs Limits. [#67072](https://github.com/grafana/grafana/issues/67072), [@sarahzinger](https://github.com/sarahzinger)
- **Rendering:** Fix panel rendered count on error. [#67027](https://github.com/grafana/grafana/issues/67027), [@AgnesToulet](https://github.com/AgnesToulet)
- **Elasticsearch:** Fix processing of duplicated metric types and field. [#66973](https://github.com/grafana/grafana/issues/66973), [@ivanahuckova](https://github.com/ivanahuckova)
- **Plugins:** Fix width for README pages with tables. [#66872](https://github.com/grafana/grafana/issues/66872), [@andresmgot](https://github.com/andresmgot)
- **Tempo:** TraceQL query builder QoL improvements. [#66865](https://github.com/grafana/grafana/issues/66865), [@adrapereira](https://github.com/adrapereira)
- **Expressions/threshold:** Fix incorrect thresholds args length. [#66859](https://github.com/grafana/grafana/issues/66859), [@gillesdemey](https://github.com/gillesdemey)
- **Panel Header Fix:** Implement new Panel Header on Angular Panels . [#66826](https://github.com/grafana/grafana/issues/66826), [@axelavargas](https://github.com/axelavargas)
- **Elasticsearch:** Handle multiple annotation structures. [#66762](https://github.com/grafana/grafana/issues/66762), [@gabor](https://github.com/gabor)
- **Alerting:** Fix share URL for Prometheus rules on subpath. [#66752](https://github.com/grafana/grafana/issues/66752), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Fix DatasourceUID and RefID missing for DatasourceNoData alerts. [#66733](https://github.com/grafana/grafana/issues/66733), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Plugins:** Fix plugin catalog filtering. [#66663](https://github.com/grafana/grafana/issues/66663), [@leventebalogh](https://github.com/leventebalogh)
- **Navigation:** Redirect to root page when switching organization. [#66655](https://github.com/grafana/grafana/issues/66655), [@ashharrison90](https://github.com/ashharrison90)
- **Trace View:** Update the queryType to traceql for checking if same trace when clicking span link. [#66645](https://github.com/grafana/grafana/issues/66645), [@ericmustin](https://github.com/ericmustin)
- **Explore:** Fix using data source line limit when opening logs sample in split view. [#66601](https://github.com/grafana/grafana/issues/66601), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Fix ad hoc filters when used with number and > and < operators. [#66579](https://github.com/grafana/grafana/issues/66579), [@ivanahuckova](https://github.com/ivanahuckova)
- **Dashboards:** Fix broken internal data links. [#66567](https://github.com/grafana/grafana/issues/66567), [@ifrost](https://github.com/ifrost)
- **Google Cloud Monitoring:** Fix project variable. [#66524](https://github.com/grafana/grafana/issues/66524), [@asimpson](https://github.com/asimpson)
- **Azure Monitor:** Fix bug that was not showing resources for certain locations. [#66502](https://github.com/grafana/grafana/issues/66502), [@alyssabull](https://github.com/alyssabull)
- **Plugins:** Fs: Add option to access unallowed files in dev mode. [#66492](https://github.com/grafana/grafana/issues/66492), [@xnyo](https://github.com/xnyo)
- **Dashboard:** New panel in a dashboard is not deleted after "Discard"-ing changes in Panel Edit. [#66476](https://github.com/grafana/grafana/issues/66476), [@polibb](https://github.com/polibb)
- **InfluxDB:** Fix querying with hardcoded retention policy. [#66466](https://github.com/grafana/grafana/issues/66466), [@itsmylife](https://github.com/itsmylife)
- **Alerting:** Hide mute timing actions when dealing with vanilla prometheus. [#66457](https://github.com/grafana/grafana/issues/66457), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Fix creating a recording rule when having multiple datasources. [#66415](https://github.com/grafana/grafana/issues/66415), [@VikaCep](https://github.com/VikaCep)
- **AccessControl:** Allow editors to access GET /api/datasources. [#66343](https://github.com/grafana/grafana/issues/66343), [@mgyongyosi](https://github.com/mgyongyosi)
- **Table Panel:** Fix panel migration for options cell type. [#66305](https://github.com/grafana/grafana/issues/66305), [@ryantxu](https://github.com/ryantxu)
- **Navigation:** Scrolled hamburger menu links now navigate correctly in Safari. [#66261](https://github.com/grafana/grafana/issues/66261), [@ashharrison90](https://github.com/ashharrison90)
- **Cloudwatch:** Fix ui bug in template variable editor. [#66207](https://github.com/grafana/grafana/issues/66207), [@iSatVeerSingh](https://github.com/iSatVeerSingh)
- **Annotations:** Improve get tags query performance. [#66182](https://github.com/grafana/grafana/issues/66182), [@papagian](https://github.com/papagian)
- **Query Splitting:** Fix for handling queries with no requestId. [#66161](https://github.com/grafana/grafana/issues/66161), [@domasx2](https://github.com/domasx2)
- **Cloudwatch:** Pass refId from query for expression queries. [#66147](https://github.com/grafana/grafana/issues/66147), [@idastambuk](https://github.com/idastambuk)
- **Alerting:** Fix explore link in alert detail view. [#66106](https://github.com/grafana/grafana/issues/66106), [@gillesdemey](https://github.com/gillesdemey)
- **Plugins:** Skip instrumenting plugin build info for core and bundled plugins. [#66105](https://github.com/grafana/grafana/issues/66105), [@wbrowne](https://github.com/wbrowne)
- **Alerting:** Fix silences preview. [#66000](https://github.com/grafana/grafana/issues/66000), [@konrad147](https://github.com/konrad147)
- **Fix:** DataLinks from data sources override user defined data link. [#65996](https://github.com/grafana/grafana/issues/65996), [@axelavargas](https://github.com/axelavargas)
- **Auth:** Remove the session cookie only if it's invalid or revoked. [#65984](https://github.com/grafana/grafana/issues/65984), [@mgyongyosi](https://github.com/mgyongyosi)
- **Transformations:** Improve UX and fix refId issues. [#65982](https://github.com/grafana/grafana/issues/65982), [@torkelo](https://github.com/torkelo)
- **SQL Datasources:** Fix variable throwing error if query returns no data. [#65937](https://github.com/grafana/grafana/issues/65937), [@mdvictor](https://github.com/mdvictor)
- **Annotations:** Ignore unique constraint violations for tags. [#65935](https://github.com/grafana/grafana/issues/65935), [@sakjur](https://github.com/sakjur)
- **PluginExtensions:** Fixed issue with incorrect type being exposed when configuring an extension. [#65910](https://github.com/grafana/grafana/issues/65910), [@mckn](https://github.com/mckn)
- **Annotation List:** Fix panel not updating when variable is changed. [#65899](https://github.com/grafana/grafana/issues/65899), [@JoaoSilvaGrafana](https://github.com/JoaoSilvaGrafana)
- **Table:** Fix migrations from old angular table for cell color modes . [#65760](https://github.com/grafana/grafana/issues/65760), [@torkelo](https://github.com/torkelo)
- **PieChart:** Show long labels properly. [#65699](https://github.com/grafana/grafana/issues/65699), [@mdvictor](https://github.com/mdvictor)
- **Library panels:** Ensure pagination controls are always correctly displayed. [#65283](https://github.com/grafana/grafana/issues/65283), [@ashharrison90](https://github.com/ashharrison90)
- **Catalog:** Show install error with incompatible version. [#65059](https://github.com/grafana/grafana/issues/65059), [@andresmgot](https://github.com/andresmgot)
- **XYChart:** Add all dataset columns in tooltip. [#65027](https://github.com/grafana/grafana/issues/65027), [@mdvictor](https://github.com/mdvictor)
- **Alerting:** Use a completely isolated context for state history writes. [#64989](https://github.com/grafana/grafana/issues/64989), [@alexweav](https://github.com/alexweav)
- **Utils:** Reimplement util.GetRandomString to avoid modulo bias. [#64481](https://github.com/grafana/grafana/issues/64481), [@DanCech](https://github.com/DanCech)
- **Reports:** Add empty UID to not found dashboard. (Enterprise)

### Breaking changes

The deprecated `plugin:build` command in the Grafana Toolkit have been removed in this release. The replacement [`create-plugin`](https://github.com/grafana/plugin-tools/tree/main/packages/create-plugin/) tool is recommended for plugin development. Issue [#67485](https://github.com/grafana/grafana/issues/67485)

The deprecated `package:build`, `node-version-check` and `toolkit:build` commands in the Grafana Toolkit have been removed in this release. Issue [#67475](https://github.com/grafana/grafana/issues/67475)

The deprecated `plugin:github-publish` command in the Grafana Toolkit have been removed in this release. Issue [#67471](https://github.com/grafana/grafana/issues/67471)

The `/query-history/migrate` endpoint has been removed and query history entries will not be automatically migrated when switching from local storage to remote storage. Issue [#67470](https://github.com/grafana/grafana/issues/67470)

The deprecated `plugin:ci-build`, `plugin:ci-package`, `plugin:ci-report`, `plugin:update-circleci` and `plugin:bundle-managed` commands in the Grafana Toolkit have been removed in this release. Issue [#67212](https://github.com/grafana/grafana/issues/67212)

The data-format used by the Loki data source for metric (graph producing) queries was changed to be compliant with the recommended Grafana format. The change is very small, we do not expect it to cause problems: for instant-queries the dataframe-type changed from `timeseries-multi` to `numeric-multi`, the dataframe-name attribute is not used anymore. If you are affected by this, you can revert back to the old format by setting the feature flag `lokiMetricDataplane` to `false`. We recommend migrating to the new format, because the feature-flag will be removed at some point in the future. Issue [#67137](https://github.com/grafana/grafana/issues/67137)

The deprecated `plugin:sign` command in the Grafana Toolkit have been removed in this release. The replacement `sign-plugin` tool is recommended for [plugin signing](https://github.com/grafana/plugin-tools/tree/main/packages/sign-plugin). Issue [#67130](https://github.com/grafana/grafana/issues/67130)

The deprecated `plugin:test` and `plugin:dev` commands in the Grafana Toolkit have been removed in this release. Issue [#67125](https://github.com/grafana/grafana/issues/67125)

The type signature of the `testDatasource()` method on the `DataSourceWithBackend` class [has changed](https://github.com/grafana/grafana/pull/67014/files/a5608dc4f27ab4459e725b22ff60b8fc05390c08#diff-c58fc1a09e9b9b17e5f45efbfb646273e69145f7687facb134440da4edafc745R263), the returned Promise is now typed stricter, which is probably going to cause type-errors while building plugins against the latest Grafana versions.

```typescript
// Before
abstract testDatasource(): Promise<any>;

// After
abstract testDatasource(): Promise<TestDataSourceResponse>;
```

Issue [#67014](https://github.com/grafana/grafana/issues/67014)

Grafana requires an Elasticsearch version of 7.16 or newer. If you use an older Elasticsearch version, you will get warnings in the query editor and on the datasource configuration page. Issue [#66928](https://github.com/grafana/grafana/issues/66928)

The deprecated `plugin:create` and `component:create` commands in the Grafana Toolkit have been removed in this release. The replacement `create-plugin` tool is recommended for [scaffolding new plugins](https://grafana.github.io/plugin-tools/docs/creating-a-plugin) and a migration guide for moving from the toolkit is available [here](https://grafana.github.io/plugin-tools/docs/migrating-from-toolkit). Issue [#66729](https://github.com/grafana/grafana/issues/66729)

We've removed some now unused properties from the `NavModel` interface. Issue [#66548](https://github.com/grafana/grafana/issues/66548)

`default` named retention policies won't be used to query. Users who have a `default` named retention policy in their `influxdb` database, have to rename it to something else. Having `default` named retention policy is not breaking anything. We will make sure to use the actual default retention policy under the hood. To change the hardcoded retention policy in the `dashboard.json`, users must they select the right retention policy from dropdown and save the panel/dashboard. Issue [#66466](https://github.com/grafana/grafana/issues/66466)

We removed previously deprecated components from `@grafana/data` : `getLogLevel`, `getLogLevelFromKey`, `addLogLevelToSeries`, `LogsParser`, `LogsParsers`, `calculateFieldStats`, `calculateLogsLabelStats`, `calculateStats`, `getParser`, `sortInAscendingOrder`, `sortInDescendingOrder`, `sortLogsResult`, `sortLogRows`, `checkLogsError`, `escapeUnescapedString`. Issue [#66271](https://github.com/grafana/grafana/issues/66271)

We removed previously deprecated components from `@grafana/ui` : `LogLabels`, `LogMessageAnsi`, `LogRows`, `getLogRowStyles`. Issue [#66268](https://github.com/grafana/grafana/issues/66268)

We removed previously deprecated `DataSourceWithLogsVolumeSupport` that was replaced with `DataSourceWithSupplementaryQueriesSupport`. Both APIs are for internal use only. Issue [#66266](https://github.com/grafana/grafana/issues/66266)

Additional functions (map/filter/forEach/iterator) have been added to the root Vector interface. Any code using vectors will continue to work unchanged, but in the rare case that you have implemented Vector directly, it be missing these functions. The easiest fix is to extend [FunctionalVector](https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/vector/FunctionalVector.ts).

The `ArrayVector` class now extends the native JavaScript `Array` and gains all of its prototype/instance methods as a result. Issue [#66187](https://github.com/grafana/grafana/issues/66187)

We've removed the ability for functions to be passed as children to the `Dropdown` component. Previously, this was used to access the `isOpen` state of the dropdown. This can be now be achieved with the `onVisibleChange` prop.

Before:

```
return (
<Dropdown overlay={MenuActions} placement="bottom-end">
{(isOpen) =>
<ToolbarButton iconOnly icon="plus" isOpen={isOpen} aria-label="New" />
}
</Dropdown>
);
```

After:

```
const [isOpen, setIsOpen] = useState(false);

...

return (
<Dropdown overlay={MenuActions} placement="bottom-end" onVisibleChange={setIsOpen}>
<ToolbarButton iconOnly icon="plus" isOpen={isOpen} aria-label="New" />
</Dropdown>
);
```

Issue [#65467](https://github.com/grafana/grafana/issues/65467)

(relevant for plugin developers) The deprecated internal `dashboardId` is now removed from the request context. For usage tracking use the `dashboardUid` Issue [#64786](https://github.com/grafana/grafana/issues/64786)

Grafana has been upgraded to React 18 and now leverages the new React client rendering API. Plugin authors in particular should be aware, as there could be unintended side effects due to the changes around automatic batching of state updates and consistent `useEffect` timings. Be sure to test your plugins and reference the React 18 upgrade docs here: https://react.dev/blog/2022/03/08/react-18-upgrade-guide Issue [#64428](https://github.com/grafana/grafana/issues/64428)

### Deprecations

For Elasticsearch annotation queries we are deprecating index field. Possibility to customise index for newly created annotations has already been removed in version 2.6.0 and since then we supported updating of index only for queries that customised index before 2.6.0. For users who would like to specify index for annotation queries we recommend to create a new Elasticsearch data source with specified index, and use that data source for annotations. Issue [#67046](https://github.com/grafana/grafana/issues/67046)

Scripts, systemd unit files and etc should stop using the `grafana-cli` and `grafana-server` programs, and instead use the `grafana` program. Uses of `grafana-server` should become `grafana server`, and uses of `grafana-cli` should become `grafana cli`. Issue [#66976](https://github.com/grafana/grafana/issues/66976)

The `database` field has been deprecated in the Elasticsearch datasource provisioning files, please use the `index` field in `jsonData` instead. Issue [#66828](https://github.com/grafana/grafana/issues/66828)

### Plugin development fixes & changes

- **Toolkit:** Remove deprecated `plugin:build`. [#67485](https://github.com/grafana/grafana/issues/67485), [@academo](https://github.com/academo)
- **Toolkit:** Remove deprecated `package:build`, `node-version-check` and `toolkit:build` commands. [#67475](https://github.com/grafana/grafana/issues/67475), [@academo](https://github.com/academo)
- **Toolkit:** Remove deprecated `plugin:github-publish` command. [#67471](https://github.com/grafana/grafana/issues/67471), [@academo](https://github.com/academo)
- **GrafanaUI:** Add indeterminate state to Checkbox. [#67312](https://github.com/grafana/grafana/issues/67312), [@JoaoSilvaGrafana](https://github.com/JoaoSilvaGrafana)
- **Toolkit:** Remove `plugin:ci-build` `plugin:ci-package` `plugin:ci-report` and related files. [#67212](https://github.com/grafana/grafana/issues/67212), [@academo](https://github.com/academo)
- **Toolkit:** Remove deprecated `plugin:sign` command. [#67130](https://github.com/grafana/grafana/issues/67130), [@academo](https://github.com/academo)
- **Toolkit:** Remove `plugin:dev` and `plugin:test`. [#67125](https://github.com/grafana/grafana/issues/67125), [@academo](https://github.com/academo)
- **Datasource:** Overhaul plugin error handling and action buttons. [#67014](https://github.com/grafana/grafana/issues/67014), [@sasklacz](https://github.com/sasklacz)
- **Toolkit:** Remove plugin:create and component:create commands. [#66729](https://github.com/grafana/grafana/issues/66729), [@academo](https://github.com/academo)
- **InteractiveTable:** Updated design and minor tweak to Correlactions page. [#66443](https://github.com/grafana/grafana/issues/66443), [@torkelo](https://github.com/torkelo)

<!-- 10.0.0-preview END -->
<!-- 9.5.5 START -->

# 9.5.5 (2023-06-22)

### Bug fixes

- **Auth:** Fixed CVE-2023-3128. [#70580](https://github.com/grafana/grafana/issues/70580), [@zerok](https://github.com/zerok)
- **Auth:** Show invite button if disable login form is set to false. [#70154](https://github.com/grafana/grafana/issues/70154), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Azure:** Fix Kusto auto-completion for Azure datasources (#69685). [#69694](https://github.com/grafana/grafana/issues/69694), [@aangelisc](https://github.com/aangelisc)
- **RBAC:** Remove legacy AC editor and admin role on new dashboard route. [#68776](https://github.com/grafana/grafana/issues/68776), [@eleijonmarck](https://github.com/eleijonmarck)
- **Revert:** Allow editors to access GET /datasources. [#68654](https://github.com/grafana/grafana/issues/68654), [@eleijonmarck](https://github.com/eleijonmarck)
- **Settings:** Add ability to override `skip_org_role_sync` with Env variables. [#68375](https://github.com/grafana/grafana/issues/68375), [@eleijonmarck](https://github.com/eleijonmarck)

<!-- 9.5.5 END -->
<!-- 9.5.3 START -->

# 9.5.3 (2023-06-06)

### Bug fixes

- **Query:** Prevent crash while executing concurrent mixed queries
- **Alerting:** Require alert.notifications:write permissions to test receivers and templates

<!-- 9.5.3 END -->
<!-- 9.5.2 START -->

# 9.5.2 (2023-05-03)

### Features and enhancements

- **Chore:** Upgrade Go to 1.20.4. [#67757](https://github.com/grafana/grafana/issues/67757), [@papagian](https://github.com/papagian)
- **Alerting:** Scheduler use rule fingerprint instead of version. [#67516](https://github.com/grafana/grafana/issues/67516), [@grafanabot](https://github.com/grafanabot)

### Bug fixes

- **TimeSeries:** Fix leading null-fill for missing intervals. [#67571](https://github.com/grafana/grafana/issues/67571), [@leeoniya](https://github.com/leeoniya)
- **Dashboard:** Revert fixed header shown on mobile devices in the new panel header. [#67514](https://github.com/grafana/grafana/issues/67514), [@grafanabot](https://github.com/grafanabot)
- **PostgreSQL:** Fix tls certificate issue by downgrading lib/pq. [#67393](https://github.com/grafana/grafana/issues/67393), [@grafanabot](https://github.com/grafanabot)
- **Provisioning:** Fix provisioning issues with legacy alerting and data source permissions. [#67377](https://github.com/grafana/grafana/issues/67377), [@grafanabot](https://github.com/grafanabot)
- **Alerting:** Fix misleading status code in provisioning API. [#67358](https://github.com/grafana/grafana/issues/67358), [@grafanabot](https://github.com/grafanabot)
- **Explore:** Update table min height (#67321). [#67332](https://github.com/grafana/grafana/issues/67332), [@adrapereira](https://github.com/adrapereira)
- **DataLinks:** Encoded URL fixed. [#67291](https://github.com/grafana/grafana/issues/67291), [@juanicabanas](https://github.com/juanicabanas)
- **Loki:** Fix log samples using `instant` queries (#67271). [#67275](https://github.com/grafana/grafana/issues/67275), [@svennergr](https://github.com/svennergr)
- **Panel Header Fix:** Implement new Panel Header on Angular Panels . [#67228](https://github.com/grafana/grafana/issues/67228), [@grafanabot](https://github.com/grafanabot)
- **Azure Monitor:** Fix bug that was not showing resources for certain locations. [#67216](https://github.com/grafana/grafana/issues/67216), [@grafanabot](https://github.com/grafanabot)
- **Alerting:** Fix panic when reparenting receivers to groups following an attempted rename via Provisioning. [#67175](https://github.com/grafana/grafana/issues/67175), [@grafanabot](https://github.com/grafanabot)
- **Cloudwatch Logs:** Clarify Cloudwatch Logs Limits. [#67101](https://github.com/grafana/grafana/issues/67101), [@grafanabot](https://github.com/grafanabot)
- **SAML:** Fix IdP metadata caching so that invalid metadata doesn't get cached. (Enterprise)

<!-- 9.5.2 END -->
<!-- 9.5.1 START -->

# 9.5.1 (2023-04-26)

### Features and enhancements

- **Chore:** Upgrade Go to 1.20.3. [#66831](https://github.com/grafana/grafana/issues/66831), [@sakjur](https://github.com/sakjur)

<!-- 9.5.1 END -->
<!-- 9.5.0 START -->

# 9.5.0 (2023-04-04)

### Features and enhancements

- **API keys:** Add deprecation to api keys. [#65948](https://github.com/grafana/grafana/pull/65948), [@eleijonmarck](https://github.com/eleijonmarck)
- **API:** Enable serving Swagger UI by default and add docs and guidelines. [#63489](https://github.com/grafana/grafana/pull/63489), [@papagian](https://github.com/papagian)
- **API:** Permit Cache-Control (browser caching) for datasource resources. [#62033](https://github.com/grafana/grafana/pull/62033), [@kylebrandt](https://github.com/kylebrandt)
- **Accessibility:** Make row actions keyboard accessible. [#63367](https://github.com/grafana/grafana/pull/63367), [@ashharrison90](https://github.com/ashharrison90)
- **Admin/Plugins:** Set category filter in connections link. [#64393](https://github.com/grafana/grafana/pull/64393), [@mikkancso](https://github.com/mikkancso)
- **Alerting:** Add CustomDetails field in PagerDuty contact point. [#64860](https://github.com/grafana/grafana/pull/64860), [@santihernandezc](https://github.com/santihernandezc)
- **Alerting:** Add dashboard and panel links to rule and instance annotations. [#63243](https://github.com/grafana/grafana/pull/63243), [@konrad147](https://github.com/konrad147)
- **Alerting:** Add filter and remove funcs for custom labels and annotations. [#63437](https://github.com/grafana/grafana/pull/63437), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Add fuzzy search to alert list view. [#63931](https://github.com/grafana/grafana/pull/63931), [@konrad147](https://github.com/konrad147)
- **Alerting:** Add metrics for active receiver and integrations. [#64050](https://github.com/grafana/grafana/pull/64050), [@gotjosh](https://github.com/gotjosh)
- **Alerting:** Better printing of labels. [#63348](https://github.com/grafana/grafana/pull/63348), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Create new state history "fanout" backend that dispatches to multiple other backends at once. [#64774](https://github.com/grafana/grafana/pull/64774), [@alexweav](https://github.com/alexweav)
- **Alerting:** Enable preview for recording rules. [#63260](https://github.com/grafana/grafana/pull/63260), [@VikaCep](https://github.com/VikaCep)
- **Alerting:** Fetch all applied alerting configurations. [#65728](https://github.com/grafana/grafana/pull/65728), [@santihernandezc](https://github.com/santihernandezc)
- **Alerting:** Introduce proper feature toggles for common state history backend combinations. [#65497](https://github.com/grafana/grafana/pull/65497), [@alexweav](https://github.com/alexweav)
- **Alerting:** Make time range query parameters not required when querying Loki. [#62985](https://github.com/grafana/grafana/pull/62985), [@alexweav](https://github.com/alexweav)
- **Alerting:** New notification policies view. [#61952](https://github.com/grafana/grafana/pull/61952), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** No longer index state history log streams by instance labels. [#65474](https://github.com/grafana/grafana/pull/65474), [@alexweav](https://github.com/alexweav)
- **Alerting:** Respect "For" Duration for NoData alerts. [#65574](https://github.com/grafana/grafana/pull/65574), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Support filtering rules by multiple datasources. [#64355](https://github.com/grafana/grafana/pull/64355), [@VikaCep](https://github.com/VikaCep)
- **Alerting:** Switch to snappy-compressed-protobuf for outgoing push requests to Loki. [#65077](https://github.com/grafana/grafana/pull/65077), [@alexweav](https://github.com/alexweav)
- **Angular:** Prevent angular from loading when disabled. [#65755](https://github.com/grafana/grafana/pull/65755), [@torkelo](https://github.com/torkelo)
- **Auth:** Add Generic oauth skip org role sync setting. [#62418](https://github.com/grafana/grafana/pull/62418), [@eleijonmarck](https://github.com/eleijonmarck)
- **Auth:** Add feature flag to move token rotation to client. [#65060](https://github.com/grafana/grafana/pull/65060), [@kalleep](https://github.com/kalleep)
- **Auth:** Show user sync external Authentication status. [#62721](https://github.com/grafana/grafana/pull/62721), [@lokeswaran-aj](https://github.com/lokeswaran-aj)
- **Backend:** Use sdk version 0.148.0. [#62822](https://github.com/grafana/grafana/pull/62822), [@kylebrandt](https://github.com/kylebrandt)
- **Chore:** Add stat for remote cache config. [#64276](https://github.com/grafana/grafana/pull/64276), [@DanCech](https://github.com/DanCech)
- **Chore:** Replace short UID generation with more standard UUIDs. [#62731](https://github.com/grafana/grafana/pull/62731), [@ryantxu](https://github.com/ryantxu)
- **Chore:** Use DOMPurify to sanitize strings rather than js-xss. [#62787](https://github.com/grafana/grafana/pull/62787), [@KristianGrafana](https://github.com/KristianGrafana)
- **CloudMonitoring:** Add possibility to use path for private key. [#65252](https://github.com/grafana/grafana/pull/65252), [@zoltanbedi](https://github.com/zoltanbedi)
- **CloudWatch Logs:** Update default timeout to 30m. [#63155](https://github.com/grafana/grafana/pull/63155), [@ashnove](https://github.com/ashnove)
- **CloudWatch:** Add AWS/IotSiteWise namespace and metrics. [#63534](https://github.com/grafana/grafana/pull/63534), [@iwysiu](https://github.com/iwysiu)
- **CloudWatch:** Add account support to variable queries. [#63822](https://github.com/grafana/grafana/pull/63822), [@iwysiu](https://github.com/iwysiu)
- **CloudWatch:** Make deeplinks work for us-gov and china regions. [#64080](https://github.com/grafana/grafana/pull/64080), [@iwysiu](https://github.com/iwysiu)
- **Cloudwatch:** Add MeteredIOBytes metric for EFS. [#64793](https://github.com/grafana/grafana/pull/64793), [@xlagg5](https://github.com/xlagg5)
- **Command Palette:** Display dashboard location. [#63807](https://github.com/grafana/grafana/pull/63807), [@ashharrison90](https://github.com/ashharrison90)
- **Command palette:** Enable folder searching. [#62663](https://github.com/grafana/grafana/pull/62663), [@ashharrison90](https://github.com/ashharrison90)
- **Connections:** Turn on feature toggle by default. [#64885](https://github.com/grafana/grafana/pull/64885), [@mikkancso](https://github.com/mikkancso)
- **Cookies:** Provide a mechanism for per user control over cookies. [#61566](https://github.com/grafana/grafana/pull/61566), [@sakjur](https://github.com/sakjur)
- **Dashboard Datasource:** Update Query List & Improve UX. [#64429](https://github.com/grafana/grafana/pull/64429), [@codeincarnate](https://github.com/codeincarnate)
- **Dashboard:** Add a feature that creates a table panel when a spreadsheet file is dropped on the dashboard. [#62688](https://github.com/grafana/grafana/pull/62688), [@oscarkilhed](https://github.com/oscarkilhed)
- **Dashboard:** Add new visualization/row/library panel/pasted panel is now a dropdown menu. [#65361](https://github.com/grafana/grafana/pull/65361), [@polibb](https://github.com/polibb)
- **Dashboard:** Add value format for requests per minute. [#62258](https://github.com/grafana/grafana/pull/62258), [@dwradcliffe](https://github.com/dwradcliffe)
- **Dashboard:** Empty/No Panels dashboard with a new design. [#65161](https://github.com/grafana/grafana/pull/65161), [@polibb](https://github.com/polibb)
- **Dashboard:** When dashboard is not found show message instead of empty page. [#65508](https://github.com/grafana/grafana/pull/65508), [@polibb](https://github.com/polibb)
- **Dashboards:** Enable feature flag `newPanelChromeUI` by default. [#65593](https://github.com/grafana/grafana/pull/65593), [@axelavargas](https://github.com/axelavargas)
- **Dataplane:** Support timeSeriesLong without transform. [#62732](https://github.com/grafana/grafana/pull/62732), [@bohandley](https://github.com/bohandley)
- **Datasources:** Add user_agent header customization for outgoing HTTP requests. [#63769](https://github.com/grafana/grafana/pull/63769), [@zhichli](https://github.com/zhichli)
- **Datasources:** Use getDefaultQuery in annotations editors. [#61870](https://github.com/grafana/grafana/pull/61870), [@idastambuk](https://github.com/idastambuk)
- **Docs:** Add documentation on how to debug backend plugins. [#64814](https://github.com/grafana/grafana/pull/64814), [@xnyo](https://github.com/xnyo)
- **Docs:** Deprecate dashboard previews. [#65698](https://github.com/grafana/grafana/pull/65698), [@ArturWierzbicki](https://github.com/ArturWierzbicki)
- **Elasticsearch:** Detect Elasticsearch version. [#63341](https://github.com/grafana/grafana/pull/63341), [@gabor](https://github.com/gabor)
- **Elasticsearch:** Run Explore queries trough data source backend. [#65339](https://github.com/grafana/grafana/pull/65339), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore:** Add range option to internal data links. [#64063](https://github.com/grafana/grafana/pull/64063), [@connorlindsey](https://github.com/connorlindsey)
- **Explore:** Add transformations to correlation data links. [#61799](https://github.com/grafana/grafana/pull/61799), [@gelicia](https://github.com/gelicia)
- **Explore:** Support mixed data sources for supplementary query. [#63036](https://github.com/grafana/grafana/pull/63036), [@ifrost](https://github.com/ifrost)
- **Extensions:** Expose an enum for available placements. [#64586](https://github.com/grafana/grafana/pull/64586), [@leventebalogh](https://github.com/leventebalogh)
- **Feat:** Changing link destination for get more plugins. [#63517](https://github.com/grafana/grafana/pull/63517), [@tolzhabayev](https://github.com/tolzhabayev)
- **Feat:** Linking to plugin details page rather than externally for new datasources. [#63499](https://github.com/grafana/grafana/pull/63499), [@tolzhabayev](https://github.com/tolzhabayev)
- **FieldMatchers:** Add match by value (reducer). [#64477](https://github.com/grafana/grafana/pull/64477), [@leeoniya](https://github.com/leeoniya)
- **Flame graph:** Add context menu. [#62705](https://github.com/grafana/grafana/pull/62705), [@joey-grafana](https://github.com/joey-grafana)
- **Flame graph:** Add metadata above flame graph. [#61921](https://github.com/grafana/grafana/pull/61921), [@joey-grafana](https://github.com/joey-grafana)
- **Geomap:** Improve tooltip url for photos layer. [#63487](https://github.com/grafana/grafana/pull/63487), [@adela-almasan](https://github.com/adela-almasan)
- **Geomap:** Release night / day layer. [#63435](https://github.com/grafana/grafana/pull/63435), [@adela-almasan](https://github.com/adela-almasan)
- **InfluxDB:** Move database information into jsondata. [#62308](https://github.com/grafana/grafana/pull/62308), [@itsmylife](https://github.com/itsmylife)
- **Jaeger and Zipkin:** Config & docs upgrade. [#64250](https://github.com/grafana/grafana/pull/64250), [@joey-grafana](https://github.com/joey-grafana)
- **LDAP:** Allow setting minimum TLS version and accepted ciphers. [#63646](https://github.com/grafana/grafana/pull/63646), [@Jguer](https://github.com/Jguer)
- **Licensing:** Allow server admin user to log in even if the active user limit is reached. (Enterprise)
- **Live:** Remove (alpha) ability to configure live pipelines. [#65138](https://github.com/grafana/grafana/pull/65138), [@ryantxu](https://github.com/ryantxu)
- **Logger:** Add feature toggle for errors in HTTP request logs. [#64425](https://github.com/grafana/grafana/pull/64425), [@sakjur](https://github.com/sakjur)
- **Login:** Allow custom name and icon for social providers. [#63297](https://github.com/grafana/grafana/pull/63297), [@jkroepke](https://github.com/jkroepke)
- **Logs Panel:** Refactor style generation to improve rendering performance. [#62599](https://github.com/grafana/grafana/pull/62599), [@matyax](https://github.com/matyax)
- **Logs:** Add millisecond to timestamp in log line. [#64372](https://github.com/grafana/grafana/pull/64372), [@svennergr](https://github.com/svennergr)
- **Logs:** Rename dedup to deduplicate. [#62944](https://github.com/grafana/grafana/pull/62944), [@gwdawson](https://github.com/gwdawson)
- **Loki Query Editor:** Make Monaco the default editor. [#62247](https://github.com/grafana/grafana/pull/62247), [@matyax](https://github.com/matyax)
- **Loki:** Add `unpack` query builder hint. [#65608](https://github.com/grafana/grafana/pull/65608), [@svennergr](https://github.com/svennergr)
- **Loki:** Add descriptions to query builder operations. [#64046](https://github.com/grafana/grafana/pull/64046), [@gwdawson](https://github.com/gwdawson)
- **Loki:** Add placeholder to the loki query editor. [#62773](https://github.com/grafana/grafana/pull/62773), [@gwdawson](https://github.com/gwdawson)
- **Loki:** Always fetch for new label keys in the QueryBuilder. [#64597](https://github.com/grafana/grafana/pull/64597), [@svennergr](https://github.com/svennergr)
- **Loki:** Display error with label filter conflicts. [#63109](https://github.com/grafana/grafana/pull/63109), [@gwdawson](https://github.com/gwdawson)
- **Loki:** Improve the display of loki query stats. [#63623](https://github.com/grafana/grafana/pull/63623), [@gwdawson](https://github.com/gwdawson)
- **MSSQL/Postgres:** List views in table dropdown as well. [#62867](https://github.com/grafana/grafana/pull/62867), [@zoltanbedi](https://github.com/zoltanbedi)
- **MSSQL:** Update forked go-mssqldb dependency. [#65658](https://github.com/grafana/grafana/pull/65658), [@stephaniehingtgen](https://github.com/stephaniehingtgen)
- **Metrics:** Update comment to mention folders instead of dashboards. [#63312](https://github.com/grafana/grafana/pull/63312), [@monteiro-renato](https://github.com/monteiro-renato)
- **Navigation:** Enable new navigation by default. [#65335](https://github.com/grafana/grafana/pull/65335), [@ashharrison90](https://github.com/ashharrison90)
- **NodeGraph:** Support icons for nodes. [#60989](https://github.com/grafana/grafana/pull/60989), [@aocenas](https://github.com/aocenas)
- **Notifications:** Enable display of trace ID by default. [#64884](https://github.com/grafana/grafana/pull/64884), [@ashharrison90](https://github.com/ashharrison90)
- **Packaging:** Start Grafana service after InfluxDB. [#64090](https://github.com/grafana/grafana/pull/64090), [@MichaIng](https://github.com/MichaIng)
- **Panel Header:** Add CancelQuery option to panel header. [#64796](https://github.com/grafana/grafana/pull/64796), [@axelavargas](https://github.com/axelavargas)
- **Panel:** Show multiple errors info in the inspector. [#64340](https://github.com/grafana/grafana/pull/64340), [@andresmgot](https://github.com/andresmgot)
- **PanelChrome:** Add option to show actions on the right side (actions = leftItems). [#65762](https://github.com/grafana/grafana/pull/65762), [@torkelo](https://github.com/torkelo)
- **Phlare:** Allow variables in labelSelector (in query). [#64324](https://github.com/grafana/grafana/pull/64324), [@joey-grafana](https://github.com/joey-grafana)
- **Plugin:** Skip preloading disabled app plugins. [#63083](https://github.com/grafana/grafana/pull/63083), [@mckn](https://github.com/mckn)
- **Plugins:** Add optional logger for plugin requests sent to backend plugins. [#62981](https://github.com/grafana/grafana/pull/62981), [@bergquist](https://github.com/bergquist)
- **Plugins:** Extend panel menu with commands from plugins. [#63802](https://github.com/grafana/grafana/pull/63802), [@mckn](https://github.com/mckn)
- **Plugins:** Extend panel menu with links from plugins. [#63089](https://github.com/grafana/grafana/pull/63089), [@jackw](https://github.com/jackw)
- **Plugins:** Improve instrumentation by adding metrics and tracing. [#61035](https://github.com/grafana/grafana/pull/61035), [@xnyo](https://github.com/xnyo)
- **Plugins:** Support for distributed tracing in backend plugins SDK. [#63714](https://github.com/grafana/grafana/pull/63714), [@xnyo](https://github.com/xnyo)
- **Plugins:** Support for link extensions. [#61663](https://github.com/grafana/grafana/pull/61663), [@mckn](https://github.com/mckn)
- **Profiling:** Enable flame graph & Phlare/Parca data sources for all users. [#63488](https://github.com/grafana/grafana/pull/63488), [@joey-grafana](https://github.com/joey-grafana)
- **Prometheus Datasource:** Improve Prom query variable editor. [#58292](https://github.com/grafana/grafana/pull/58292), [@bohandley](https://github.com/bohandley)
- **Prometheus Metrics:** Add missing stat_total_teams metric. [#65133](https://github.com/grafana/grafana/pull/65133), [@gamab](https://github.com/gamab)
- **Prometheus/Loki:** Run query explicitly instead of onblur in panel edit. [#64815](https://github.com/grafana/grafana/pull/64815), [@torkelo](https://github.com/torkelo)
- **Prometheus:** Browser resource caching. [#60711](https://github.com/grafana/grafana/pull/60711), [@gtk-grafana](https://github.com/gtk-grafana)
- **Prometheus:** Improve prometheus query variable editor. [#63529](https://github.com/grafana/grafana/pull/63529), [@bohandley](https://github.com/bohandley)
- **Prometheus:** Use $\_\_rate_interval for rate queries generated by metric browser. [#65386](https://github.com/grafana/grafana/pull/65386), [@ivanahuckova](https://github.com/ivanahuckova)
- **Pubdash:** Email sharing handle dashboard deleted. [#64247](https://github.com/grafana/grafana/pull/64247), [@owensmallwood](https://github.com/owensmallwood)
- **Pubdash:** Email sharing handle dashboard deleted. (Enterprise)
- **PublicDashboards:** Backfills share column with default value. [#63407](https://github.com/grafana/grafana/pull/63407), [@owensmallwood](https://github.com/owensmallwood)
- **PublicDashboards:** Configuration modal redesign. [#63211](https://github.com/grafana/grafana/pull/63211), [@juanicabanas](https://github.com/juanicabanas)
- **PublicDashboards:** Email sharing. [#63762](https://github.com/grafana/grafana/pull/63762), [@juanicabanas](https://github.com/juanicabanas)
- **PublicDashboards:** Email sharing. (Enterprise)
- **PublicDashboards:** Enable creation when dashboard has template variables. [#64560](https://github.com/grafana/grafana/pull/64560), [@juanicabanas](https://github.com/juanicabanas)
- **PublicDashboards:** Paused or deleted public dashboard screen. [#63970](https://github.com/grafana/grafana/pull/63970), [@juanicabanas](https://github.com/juanicabanas)
- **PublicDashboards:** Viewer can request and claim magic link. (Enterprise)
- **QueryHistory:** Improve handling of mixed datasource entries. [#62214](https://github.com/grafana/grafana/pull/62214), [@Elfo404](https://github.com/Elfo404)
- **Rendering:** Experimental support to use JWTs as auth method. [#60841](https://github.com/grafana/grafana/pull/60841), [@joanlopez](https://github.com/joanlopez)
- **Reports:** Improve the UI for the new navigation. (Enterprise)
- **SQL Datasources:** Add back help content. [#65383](https://github.com/grafana/grafana/pull/65383), [@zoltanbedi](https://github.com/zoltanbedi)
- **Schema:** Remove exclusion for timeseries and update imports. [#65242](https://github.com/grafana/grafana/pull/65242), [@ryantxu](https://github.com/ryantxu)
- **Search:** Improvements for starred dashboard search. [#64758](https://github.com/grafana/grafana/pull/64758), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Select:** Show icon in the grafana/ui Select component. [#63827](https://github.com/grafana/grafana/pull/63827), [@ryantxu](https://github.com/ryantxu)
- **Service accounts:** Creation logic simplification. [#63884](https://github.com/grafana/grafana/pull/63884), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Service accounts:** Remove Add API keys buttons and remove one state of migrating for API keys tab. [#63411](https://github.com/grafana/grafana/pull/63411), [@eleijonmarck](https://github.com/eleijonmarck)
- **SplitOpen:** Update API to accept multiple queries. [#62245](https://github.com/grafana/grafana/pull/62245), [@ivanahuckova](https://github.com/ivanahuckova)
- **Stat Panel:** Add an option for a non-gradient/solid background. [#65052](https://github.com/grafana/grafana/pull/65052), [@baldm0mma](https://github.com/baldm0mma)
- **Stat:** Add ability to remove default single-color background gradient. [#64353](https://github.com/grafana/grafana/pull/64353), [@baldm0mma](https://github.com/baldm0mma)
- **SupportBundles:** Add OAuth bundle collectors. [#64810](https://github.com/grafana/grafana/pull/64810), [@Jguer](https://github.com/Jguer)
- **Table Panel:** Add ability to use text color for value or hide value in gauge cell. [#61477](https://github.com/grafana/grafana/pull/61477), [@torkelo](https://github.com/torkelo)
- **Table:** Introduce sparkline cell type. [#63182](https://github.com/grafana/grafana/pull/63182), [@domasx2](https://github.com/domasx2)
- **Tempo:** Config and doc updates. [#64017](https://github.com/grafana/grafana/pull/64017), [@joey-grafana](https://github.com/joey-grafana)
- **Tempo:** Update service graph view and docs. [#64875](https://github.com/grafana/grafana/pull/64875), [@joey-grafana](https://github.com/joey-grafana)
- **TraceView:** Add key and url escaping of json tag values. [#64331](https://github.com/grafana/grafana/pull/64331), [@aocenas](https://github.com/aocenas)
- **TraceView:** Reworked header. [#63105](https://github.com/grafana/grafana/pull/63105), [@joey-grafana](https://github.com/joey-grafana)
- **Tracing:** Add more detail to HTTP Outgoing Request. [#64757](https://github.com/grafana/grafana/pull/64757), [@bboreham](https://github.com/bboreham)
- **Tracing:** Docs and config improvements for Tempo/Jaeger/Zipkin. [#65255](https://github.com/grafana/grafana/pull/65255), [@joey-grafana](https://github.com/joey-grafana)
- **Tracing:** Support multiple OTel propagators. [#61199](https://github.com/grafana/grafana/pull/61199), [@hairyhenderson](https://github.com/hairyhenderson)
- **Transformations:** Support time format when converting time to strings. [#63826](https://github.com/grafana/grafana/pull/63826), [@ryantxu](https://github.com/ryantxu)
- **Transformers:** Support adding the row index using calculate field transformer. [#65148](https://github.com/grafana/grafana/pull/65148), [@ryantxu](https://github.com/ryantxu)
- **Units:** Format currency with negative before the symbol. [#65152](https://github.com/grafana/grafana/pull/65152), [@ryantxu](https://github.com/ryantxu)

### Bug fixes

- **API:** Fix "Updated by" Column in dashboard versions table. [#65351](https://github.com/grafana/grafana/pull/65351), [@papagian](https://github.com/papagian)
- **AccessControl:** Allow editors to access GET /api/datasources. [#66343](https://github.com/grafana/grafana/pull/66343), [@mgyongyosi](https://github.com/mgyongyosi)
- **Alerting:** Add "backend" label to state history writes metrics. [#65395](https://github.com/grafana/grafana/pull/65395), [@alexweav](https://github.com/alexweav)
- **Alerting:** Add alert instance labels to Loki log lines in addition to stream labels. [#65403](https://github.com/grafana/grafana/pull/65403), [@alexweav](https://github.com/alexweav)
- **Alerting:** Elide requests to Loki if nothing should be recorded. [#65011](https://github.com/grafana/grafana/pull/65011), [@alexweav](https://github.com/alexweav)
- **Alerting:** Fix DatasourceUID and RefID missing for DatasourceNoData alerts. [#66733](https://github.com/grafana/grafana/pull/66733), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Fix ambiguous handling of equals in labels when bucketing Loki state history streams. [#65013](https://github.com/grafana/grafana/pull/65013), [@alexweav](https://github.com/alexweav)
- **Alerting:** Fix attachment of external labels to Loki state history log streams. [#65140](https://github.com/grafana/grafana/pull/65140), [@alexweav](https://github.com/alexweav)
- **Alerting:** Fix creating a recording rule when having multiple datasources. [#66415](https://github.com/grafana/grafana/pull/66415), [@VikaCep](https://github.com/VikaCep)
- **Alerting:** Fix explore link in alert detail view. [#66106](https://github.com/grafana/grafana/pull/66106), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Fix share URL for Prometheus rules on subpath. [#66752](https://github.com/grafana/grafana/pull/66752), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Fix stats that display alert count when using unified alerting. [#64852](https://github.com/grafana/grafana/pull/64852), [@gotjosh](https://github.com/gotjosh)
- **Alerting:** Hide mute timing actions when dealing with vanilla prometheus. [#66457](https://github.com/grafana/grafana/pull/66457), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Paginate result previews. [#65257](https://github.com/grafana/grafana/pull/65257), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Prometheus-compatible Alertmanager timings editor. [#64526](https://github.com/grafana/grafana/pull/64526), [@konrad147](https://github.com/konrad147)
- **Alerting:** Update scheduler to get updates only from database. [#64635](https://github.com/grafana/grafana/pull/64635), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Use a completely isolated context for state history writes. [#64989](https://github.com/grafana/grafana/pull/64989), [@alexweav](https://github.com/alexweav)
- **Alerting:** Use displayNameFromDS if available in preview. [#65342](https://github.com/grafana/grafana/pull/65342), [@gillesdemey](https://github.com/gillesdemey)
- **Annotation List:** Fix panel not updating when variable is changed. [#65899](https://github.com/grafana/grafana/pull/65899), [@JoaoSilvaGrafana](https://github.com/JoaoSilvaGrafana)
- **Annotations:** Ignore unique constraint violations for tags. [#65935](https://github.com/grafana/grafana/pull/65935), [@sakjur](https://github.com/sakjur)
- **Auth:** Fix orgrole picker disabled if isSynced user. [#64033](https://github.com/grafana/grafana/pull/64033), [@eleijonmarck](https://github.com/eleijonmarck)
- **AzureMonitor:** Fix Log Analytics portal links. [#65482](https://github.com/grafana/grafana/pull/65482), [@aangelisc](https://github.com/aangelisc)
- **BrowseDashboards:** Fix move to General folder not working. [#65653](https://github.com/grafana/grafana/pull/65653), [@joshhunt](https://github.com/joshhunt)
- **Catalog:** Show install error with incompatible version. [#65059](https://github.com/grafana/grafana/pull/65059), [@andresmgot](https://github.com/andresmgot)
- **Chore:** Update Grafana to use Alertmanager v0.25.1-0.20230308154952-78fedf89728b. [#64778](https://github.com/grafana/grafana/pull/64778), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **CloudMonitoring:** Add project selector for MQL editor[fix]. [#65567](https://github.com/grafana/grafana/pull/65567), [@alyssabull](https://github.com/alyssabull)
- **CloudWatch Logs:** Fix running logs queries with expressions. [#65306](https://github.com/grafana/grafana/pull/65306), [@iwysiu](https://github.com/iwysiu)
- **CloudWatch Logs:** Fix to make log queries use a relative time if available. [#65236](https://github.com/grafana/grafana/pull/65236), [@kevinwcyu](https://github.com/kevinwcyu)
- **CloudWatch Logs:** Revert "Queries in an expression should run synchronously (#64443)". [#65036](https://github.com/grafana/grafana/pull/65036), [@fridgepoet](https://github.com/fridgepoet)
- **CloudWatch:** Fix cachedQueries insights not being updated for metric queries. [#65495](https://github.com/grafana/grafana/pull/65495), [@kevinwcyu](https://github.com/kevinwcyu)
- **Cloudwatch:** Pass refId from query for expression queries. [#66147](https://github.com/grafana/grafana/pull/66147), [@idastambuk](https://github.com/idastambuk)
- **Dashboards:** Evaluate provisioned dashboard titles in a backwards compatible way. [#65184](https://github.com/grafana/grafana/pull/65184), [@sakjur](https://github.com/sakjur)
- **Dashboards:** Fix Mobile support dashboard issues on new iOS 16.3. [#65542](https://github.com/grafana/grafana/pull/65542), [@axelavargas](https://github.com/axelavargas)
- **Dashboards:** Fix broken internal data links. [#66567](https://github.com/grafana/grafana/pull/66567), [@ifrost](https://github.com/ifrost)
- **Database:** Don't sleep 10ms before every request. [#64832](https://github.com/grafana/grafana/pull/64832), [@bboreham](https://github.com/bboreham)
- **Elasticsearch:** Fix processing of response with multiple group by for alerting. [#65165](https://github.com/grafana/grafana/pull/65165), [@ivanahuckova](https://github.com/ivanahuckova)
- **Elasticsearch:** Handle multiple annotation structures. [#66762](https://github.com/grafana/grafana/pull/66762), [@gabor](https://github.com/gabor)
- **Email:** Mark HTML comments as "safe" in email templates. [#64546](https://github.com/grafana/grafana/pull/64546), [@gillesdemey](https://github.com/gillesdemey)
- **Emails:** Preserve HTML comments. (Enterprise)
- **ErrorHandling:** Fixes issues with bad error messages. [#63775](https://github.com/grafana/grafana/pull/63775), [@torkelo](https://github.com/torkelo)
- **ErrorView:** Better detection of no-data responses. [#65477](https://github.com/grafana/grafana/pull/65477), [@leeoniya](https://github.com/leeoniya)
- **Explore:** Make `DataSourcePicker` visible on small screens. [#65149](https://github.com/grafana/grafana/pull/65149), [@abdulhdr1](https://github.com/abdulhdr1)
- **Fix:** DataLinks from data sources override user defined data link. [#65996](https://github.com/grafana/grafana/pull/65996), [@axelavargas](https://github.com/axelavargas)
- **Fix:** Top table rendering and update docs. [#64497](https://github.com/grafana/grafana/pull/64497), [@joey-grafana](https://github.com/joey-grafana)
- **Frontend:** Fix broken links in /plugins when pathname has a trailing slash. [#64348](https://github.com/grafana/grafana/pull/64348), [@gassiss](https://github.com/gassiss)
- **Geomap:** Fix route layer zoom behavior. [#63409](https://github.com/grafana/grafana/pull/63409), [@drew08t](https://github.com/drew08t)
- **Google Cloud Monitoring:** Fix project variable. [#66524](https://github.com/grafana/grafana/pull/66524), [@asimpson](https://github.com/asimpson)
- **HeatMap:** Sort y buckets when all bucket names are numeric. [#65322](https://github.com/grafana/grafana/pull/65322), [@leeoniya](https://github.com/leeoniya)
- **InfluxDB:** Fix querying with hardcoded retention policy. [#66466](https://github.com/grafana/grafana/pull/66466), [@itsmylife](https://github.com/itsmylife)
- **InfluxDB:** Fix sending retention policy with InfluxQL queries. [#63820](https://github.com/grafana/grafana/pull/63820), [@itsmylife](https://github.com/itsmylife)
- **KVStore:** Include database field in migration. [#62790](https://github.com/grafana/grafana/pull/62790), [@zoltanbedi](https://github.com/zoltanbedi)
- **LDAP:** Always synchronize Server Admin role through role sync if role sync is enabled. [#58820](https://github.com/grafana/grafana/pull/58820), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Library panels:** Ensure pagination controls are always correctly displayed. [#65283](https://github.com/grafana/grafana/pull/65283), [@ashharrison90](https://github.com/ashharrison90)
- **Loki:** Fix autocomplete situations with multiple escaped quotes. [#65520](https://github.com/grafana/grafana/pull/65520), [@svennergr](https://github.com/svennergr)
- **MegaMenu:** Fixes mega menu showing scroll indicator when it shouldn't. [#65452](https://github.com/grafana/grafana/pull/65452), [@torkelo](https://github.com/torkelo)
- **Navigation:** Redirect to root page when switching organization. [#66655](https://github.com/grafana/grafana/pull/66655), [@ashharrison90](https://github.com/ashharrison90)
- **Navigation:** Scrolled hamburger menu links now navigate correctly in Safari. [#66261](https://github.com/grafana/grafana/pull/66261), [@ashharrison90](https://github.com/ashharrison90)
- **NestedFolders:** Fix nested folder deletion. [#63572](https://github.com/grafana/grafana/pull/63572), [@ying-jeanne](https://github.com/ying-jeanne)
- **New Panel Header:** Fix when clicking submenu item the parent menu item onClick get's triggered. [#65691](https://github.com/grafana/grafana/pull/65691), [@axelavargas](https://github.com/axelavargas)
- **Phlare:** Fix error when there are no profileTypes to send from backend. [#65455](https://github.com/grafana/grafana/pull/65455), [@aocenas](https://github.com/aocenas)
- **PieChart:** Show long labels properly. [#65699](https://github.com/grafana/grafana/pull/65699), [@mdvictor](https://github.com/mdvictor)
- **PluginExtensions:** Fixed issue with incorrect type being exposed when configuring an extension. [#65910](https://github.com/grafana/grafana/pull/65910), [@mckn](https://github.com/mckn)
- **Plugins:** Ensure proxy route bodies are valid JSON. [#61771](https://github.com/grafana/grafana/pull/61771), [@wbrowne](https://github.com/wbrowne)
- **Plugins:** Fix width for README pages with tables. [#66872](https://github.com/grafana/grafana/pull/66872), [@andresmgot](https://github.com/andresmgot)
- **Plugins:** Markdown fetch retry with lowercase. [#65384](https://github.com/grafana/grafana/pull/65384), [@wbrowne](https://github.com/wbrowne)
- **Plugins:** Skip instrumenting plugin build info for core and bundled plugins. [#66105](https://github.com/grafana/grafana/pull/66105), [@wbrowne](https://github.com/wbrowne)
- **PublicDashboards:** Query collapsed panels inside rows. [#64779](https://github.com/grafana/grafana/pull/64779), [@evictorero](https://github.com/evictorero)
- **Query Splitting:** Fix for handling queries with no requestId. [#66161](https://github.com/grafana/grafana/pull/66161), [@domasx2](https://github.com/domasx2)
- **SQL Datasources:** Fix variable throwing error if query returns no data. [#65937](https://github.com/grafana/grafana/pull/65937), [@mdvictor](https://github.com/mdvictor)
- **SQL Datasources:** Prevent Call Stack Overflows with Large Numbers of Values for Variable. [#64937](https://github.com/grafana/grafana/pull/64937), [@codeincarnate](https://github.com/codeincarnate)
- **SQLStore:** Fix SQLite error propagation if query retries are disabled. [#64904](https://github.com/grafana/grafana/pull/64904), [@papagian](https://github.com/papagian)
- **Stat Panel:** Fix issue with clipping text values. [#64300](https://github.com/grafana/grafana/pull/64300), [@JoaoSilvaGrafana](https://github.com/JoaoSilvaGrafana)
- **Table Panel:** Fix panel migration for options cell type. [#66305](https://github.com/grafana/grafana/pull/66305), [@ryantxu](https://github.com/ryantxu)
- **Table:** Fix migrations from old angular table for cell color modes. [#65760](https://github.com/grafana/grafana/pull/65760), [@torkelo](https://github.com/torkelo)
- **Table:** Fixes issue with pagination summary causing scrollbar. [#65189](https://github.com/grafana/grafana/pull/65189), [@torkelo](https://github.com/torkelo)
- **Table:** Fixes table panel gauge alignment. [#64994](https://github.com/grafana/grafana/pull/64994), [@torkelo](https://github.com/torkelo)
- **TablePanel:** Fix table cells overflowing when there are multiple data links. [#65711](https://github.com/grafana/grafana/pull/65711), [@oscarkilhed](https://github.com/oscarkilhed)
- **TablePanel:** fix footer bug; no footer calculated values after "hidden" column override. [#64269](https://github.com/grafana/grafana/pull/64269), [@baldm0mma](https://github.com/baldm0mma)
- **Team sync:** Fix apply query string instead of param. (Enterprise)
- **Templating:** Allow percent encoding of variable with custom all. [#65266](https://github.com/grafana/grafana/pull/65266), [@dprokop](https://github.com/dprokop)
- **Tempo:** Set default limit if none is provided for traceql queries. [#65039](https://github.com/grafana/grafana/pull/65039), [@domasx2](https://github.com/domasx2)
- **TimeSeries:** Don't extend stepped interpolation to graph edges. [#65657](https://github.com/grafana/grafana/pull/65657), [@leeoniya](https://github.com/leeoniya)
- **TimeSeries:** Improve stacking direction heuristic. [#65499](https://github.com/grafana/grafana/pull/65499), [@leeoniya](https://github.com/leeoniya)
- **Trace View:** Update the queryType to traceql for checking if same trace when clicking span link. [#66645](https://github.com/grafana/grafana/pull/66645), [@ericmustin](https://github.com/ericmustin)
- **TraceView:** Don't require preferredVisualisationType to render. [#64920](https://github.com/grafana/grafana/pull/64920), [@aocenas](https://github.com/aocenas)
- **Utils:** Reimplement util.GetRandomString to avoid modulo bias. [#64481](https://github.com/grafana/grafana/pull/64481), [@DanCech](https://github.com/DanCech)
- **XYChart:** Add all dataset columns in tooltip. [#65027](https://github.com/grafana/grafana/pull/65027), [@mdvictor](https://github.com/mdvictor)

### Breaking changes

`default` named retention policies won't be used to query. Users who have a `default` named retention policy in their `influxdb` database, have to rename it to something else. Having `default` named retention policy is not breaking anything. We will make sure to use the actual default retention policy under the hood. To change the hardcoded retention policy in the `dashboard.json`, users must they select the right retention policy from dropdown and save the panel/dashboard. Issue [#66466](https://github.com/grafana/grafana/issues/66466)

Grafana Alerting rules with `NoDataState` configuration set to `Alerting` will now respect "For" duration. Issue [#65574](https://github.com/grafana/grafana/issues/65574)

Users who use LDAP role sync to only sync Viewer, Editor and Admin roles, but grant Grafana Server Admin role manually will not be able to do that anymore. After this change, LDAP role sync will override any manual changes to Grafana Server Admin role assignments. If `grafana_admin` is left unset in [LDAP role mapping configuration](https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-authentication/ldap/#group-mappings), it will default to false. Issue [#58820](https://github.com/grafana/grafana/issues/58820)

### Plugin development fixes & changes

- **DateTimePicker:** Can now select time correctly. [#65428](https://github.com/grafana/grafana/pull/65428), [@eledobleefe](https://github.com/eledobleefe)
- **Grafana UI:** Fix tooltip prop of button component. [#64765](https://github.com/grafana/grafana/pull/64765), [@suleymanbariseser](https://github.com/suleymanbariseser)
- **DateTimePicker:** Add min date support to calendar. [#64632](https://github.com/grafana/grafana/pull/64632), [@nevermind89x](https://github.com/nevermind89x)
- **GrafanaUI:** Implement new component Toggletip. [#64459](https://github.com/grafana/grafana/pull/64459), [@yduartep](https://github.com/yduartep)
- **ContextMenu:** Fix padding and show border based on items. [#63948](https://github.com/grafana/grafana/pull/63948), [@aocenas](https://github.com/aocenas)

<!-- 9.5.0 END -->
<!-- 9.4.13 START -->

# 9.4.13 (2023-06-22)

### Bug fixes

- **Auth:** Fixed CVE-2023-3128. [#70579](https://github.com/grafana/grafana/issues/70579), [@zerok](https://github.com/zerok)

<!-- 9.4.13 END -->
<!-- 9.3.16 START -->

# 9.3.16 (2023-06-22)

### Bug fixes

- **Auth:** Fixed CVE-2023-3128. [#70578](https://github.com/grafana/grafana/issues/70578), [@zerok](https://github.com/zerok)

<!-- 9.3.16 END -->
<!-- 9.2.20 START -->

# 9.2.20 (2023-06-22)

### Bug fixes

- **Auth:** Fixed CVE-2023-3128. [#70577](https://github.com/grafana/grafana/issues/70577), [@zerok](https://github.com/zerok)

<!-- 9.2.20 END -->
<!-- 8.5.27 START -->

# 8.5.27 (2023-06-22)

### Bug fixes

- **Auth:** Fixed CVE-2023-3128. [#70576](https://github.com/grafana/grafana/issues/70576), [@zerok](https://github.com/zerok)

<!-- 8.5.27 END -->

<!-- previous CHANGELOG entries can be found in /.changelog-archive >
