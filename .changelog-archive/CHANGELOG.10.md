<!-- 10.4.5 START -->

# 10.4.5 (2024-06-21)

### Bug fixes

- **Echo:** Suppress errors from frontend-metrics API call failing. [#89498](https://github.com/grafana/grafana/issues/89498), [@joshhunt](https://github.com/joshhunt)
- **Azure Monitor:** Add validation for namespace field in AdvancedResourcePicker when entering a forward slash. [#89313](https://github.com/grafana/grafana/issues/89313), [@adamyeats](https://github.com/adamyeats)

<!-- 10.4.5 END -->
<!-- 10.4.4 START -->

# 10.4.4 (2024-06-13)

### Bug fixes

- **BrowseDashboards:** Prepend subpath to New Browse Dashboard actions. [#89129](https://github.com/grafana/grafana/issues/89129), [@joshhunt](https://github.com/joshhunt)
- **Alerting:** Fix rule storage to filter by group names using case-sensitive comparison. [#89061](https://github.com/grafana/grafana/issues/89061), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Fix editing Grafana folder via alert rule editor. [#88907](https://github.com/grafana/grafana/issues/88907), [@gillesdemey](https://github.com/gillesdemey)
- **AzureMonitor:** Fix bug detecting app insights queries. [#88786](https://github.com/grafana/grafana/issues/88786), [@aangelisc](https://github.com/aangelisc)
- **AuthN:** Fix signout redirect url. [#88749](https://github.com/grafana/grafana/issues/88749), [@kalleep](https://github.com/kalleep)
- **SSE:** Fix threshold unmarshal to avoid panic. [#88650](https://github.com/grafana/grafana/issues/88650), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Fix typo in JSON response for rule export. [#88094](https://github.com/grafana/grafana/issues/88094), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **CloudMonitoring:** Fix query type selection issue. [#88023](https://github.com/grafana/grafana/issues/88023), [@aangelisc](https://github.com/aangelisc)
- **Provisioning:** Add override option to role provisioning. (Enterprise)

<!-- 10.4.4 END -->
<!-- 10.4.3 START -->

# 10.4.3 (2024-05-13)

### Features and enhancements

- **Chore:** Upgrade go to 1.21.10. [#87473](https://github.com/grafana/grafana/issues/87473), [@stephaniehingtgen](https://github.com/stephaniehingtgen)
- **Chore:** Upgrade go to 1.21.10. (Enterprise)

### Bug fixes

- **CloudMonitoring:** Improve legacy query migrations. [#87647](https://github.com/grafana/grafana/issues/87647), [@aangelisc](https://github.com/aangelisc)
- **Azure data sources:** Set selected config type before save. [#87585](https://github.com/grafana/grafana/issues/87585), [@bossinc](https://github.com/bossinc)
- **Provisioning:** Look up provisioned folders by UID when possible. [#87467](https://github.com/grafana/grafana/issues/87467), [@DanCech](https://github.com/DanCech)
- **Cloudwatch:** Update grafana-aws-sdk to fix sts endpoints. [#87348](https://github.com/grafana/grafana/issues/87348), [@iwysiu](https://github.com/iwysiu)
- **Alerting:** Prevent search from locking the browser. [#87231](https://github.com/grafana/grafana/issues/87231), [@gillesdemey](https://github.com/gillesdemey)
- **SQLStore:** Disable redundant create and drop unique index migrations on dashboard table. [#86866](https://github.com/grafana/grafana/issues/86866), [@papagian](https://github.com/papagian)
- **Alerting:** Take receivers into account when custom grouping Alertmanager groups. [#86697](https://github.com/grafana/grafana/issues/86697), [@konrad147](https://github.com/konrad147)
- **LDAP:** Fix listing all non-matching groups. [#86690](https://github.com/grafana/grafana/issues/86690), [@mgyongyosi](https://github.com/mgyongyosi)
- **Alerting:** Fix simplified routing group by override. [#86620](https://github.com/grafana/grafana/issues/86620), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Return a 400 and errutil error when trying to delete a contact point that is referenced by a policy. [#86162](https://github.com/grafana/grafana/issues/86162), [@alexweav](https://github.com/alexweav)
- **LibraryPanelRBAC:** Fix issue with importing dashboards containing library panels. [#86150](https://github.com/grafana/grafana/issues/86150), [@kaydelaney](https://github.com/kaydelaney)
- **Google Cloud Monitor:** Fix `res` being accessed after it becomes `nil` in `promql_query.go`. [#85959](https://github.com/grafana/grafana/issues/85959), [@adamyeats](https://github.com/adamyeats)
- **Google Cloud Monitor:** Fix interface conversion for incorrect type in cloudMonitoringProm.run. [#85957](https://github.com/grafana/grafana/issues/85957), [@adamyeats](https://github.com/adamyeats)
- **Dashboard:** Allow `auto` refresh option when saving a dashboard. [#85921](https://github.com/grafana/grafana/issues/85921), [@bfmatei](https://github.com/bfmatei)
- **Reporting:** Fix monthly schedule text and modify monthly schedule inputs behavior. (Enterprise)
- **SAML:** Fix Authn request generation in case of HTTP-POST binding. (Enterprise)

<!-- 10.4.3 END -->
<!-- 10.4.2 START -->

# 10.4.2 (2024-04-10)

### Bug fixes

- **Angular deprecation:** Prefer local "angularDetected" value to the remote one. [#85631](https://github.com/grafana/grafana/issues/85631), [@xnyo](https://github.com/xnyo)
- **AuthProxy:** Fix missing session for ldap auth proxy users. [#85237](https://github.com/grafana/grafana/issues/85237), [@Jguer](https://github.com/Jguer)
- **Alerting:** Fix receiver inheritance when provisioning a notification policy. [#85192](https://github.com/grafana/grafana/issues/85192), [@julienduchesne](https://github.com/julienduchesne)
- **CloudMonitoring:** Only run query if filters are complete. [#85016](https://github.com/grafana/grafana/issues/85016), [@aangelisc](https://github.com/aangelisc)

<!-- 10.4.2 END -->
<!-- 10.4.1 START -->

# 10.4.1 (2024-03-20)

### Features and enhancements

- **Alerting:** Add "Keep Last State" backend functionality. [#84406](https://github.com/grafana/grafana/issues/84406), [@rwwiv](https://github.com/rwwiv)
- **Postgres:** Allow disabling SNI on SSL-enabled connections. [#84249](https://github.com/grafana/grafana/issues/84249), [@papagian](https://github.com/papagian)
- **DataQuery:** Track panel plugin id not type. [#83164](https://github.com/grafana/grafana/issues/83164), [@torkelo](https://github.com/torkelo)

### Bug fixes

- **Elasticsearch:** Fix legend for alerting, expressions and previously frontend queries. [#84685](https://github.com/grafana/grafana/issues/84685), [@ivanahuckova](https://github.com/ivanahuckova)
- **Alerting:** Fix optional fields requiring validation rule. [#84595](https://github.com/grafana/grafana/issues/84595), [@gillesdemey](https://github.com/gillesdemey)
- **ExtSvcAccounts:** FIX prevent service account deletion. [#84511](https://github.com/grafana/grafana/issues/84511), [@gamab](https://github.com/gamab)
- **Loki:** Fix null pointer exception in case request returned an error. [#84401](https://github.com/grafana/grafana/issues/84401), [@svennergr](https://github.com/svennergr)
- **Dashboard:** Fix issue where out-of-view shared query panels caused blank dependent panels. [#84197](https://github.com/grafana/grafana/issues/84197), [@kaydelaney](https://github.com/kaydelaney)
- **Auth:** Only call rotate token if we have a session expiry cookie. [#84181](https://github.com/grafana/grafana/issues/84181), [@kalleep](https://github.com/kalleep)
- **Serviceaccounts:** Add ability to add samename SA for different orgs. [#83953](https://github.com/grafana/grafana/issues/83953), [@eleijonmarck](https://github.com/eleijonmarck)
- **GenAI:** Update the component only when the response is fully generated. [#83895](https://github.com/grafana/grafana/issues/83895), [@ivanortegaalba](https://github.com/ivanortegaalba)
- **Tempo:** Better fallbacks for metrics query. [#83688](https://github.com/grafana/grafana/issues/83688), [@adrapereira](https://github.com/adrapereira)
- **Tempo:** Add template variable interpolation for filters. [#83667](https://github.com/grafana/grafana/issues/83667), [@joey-grafana](https://github.com/joey-grafana)
- **Alerting:** Fix saving evaluation group. [#83234](https://github.com/grafana/grafana/issues/83234), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **QueryVariableEditor:** Select a variable ds does not work. [#83181](https://github.com/grafana/grafana/issues/83181), [@ivanortegaalba](https://github.com/ivanortegaalba)
- **Logs Panel:** Add option extra UI functionality for log context. [#83129](https://github.com/grafana/grafana/issues/83129), [@svennergr](https://github.com/svennergr)

<!-- 10.4.1 END -->
<!-- 10.4.0 START -->

# 10.4.0 (2024-03-06)

### Features and enhancements

- **AuthToken:** Remove client token rotation feature toggle. [#82886](https://github.com/grafana/grafana/issues/82886), [@kalleep](https://github.com/kalleep)
- **Plugins:** Enable feature toggle angularDeprecationUI by default. [#82880](https://github.com/grafana/grafana/issues/82880), [@xnyo](https://github.com/xnyo)
- **Table Component:** Improve text-wrapping behavior of cells. [#82872](https://github.com/grafana/grafana/issues/82872), [@ahuarte47](https://github.com/ahuarte47)
- **Alerting:** Dry-run legacy upgrade on startup. [#82835](https://github.com/grafana/grafana/issues/82835), [@JacobsonMT](https://github.com/JacobsonMT)
- **Tempo:** Upgrade @grafana/lezer-traceql patch version to use trace metrics syntax. [#82532](https://github.com/grafana/grafana/issues/82532), [@joey-grafana](https://github.com/joey-grafana)
- **Logs Panel:** Add CSV to download options. [#82480](https://github.com/grafana/grafana/issues/82480), [@gtk-grafana](https://github.com/gtk-grafana)
- **Folders:** Switch order of the columns in folder table indexes so that org_id becomes first. [#82454](https://github.com/grafana/grafana/issues/82454), [@papagian](https://github.com/papagian)
- **Logs panel:** Table UI - Guess string field types. [#82397](https://github.com/grafana/grafana/issues/82397), [@gtk-grafana](https://github.com/gtk-grafana)
- **Alerting:** Send alerts to APIv2 when using the Alertmanager contact point. [#82373](https://github.com/grafana/grafana/issues/82373), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Emit warning when creating or updating unusually large groups. [#82279](https://github.com/grafana/grafana/issues/82279), [@alexweav](https://github.com/alexweav)
- **Keybindings:** Change 'h' to 'mod+h' to open help modal. [#82253](https://github.com/grafana/grafana/issues/82253), [@tskarhed](https://github.com/tskarhed)
- **Chore:** Update arrow and prometheus dependencies. [#82215](https://github.com/grafana/grafana/issues/82215), [@ryantxu](https://github.com/ryantxu)
- **Alerting:** Enable group-level rule evaluation jittering by default, remove feature toggle. [#82212](https://github.com/grafana/grafana/issues/82212), [@alexweav](https://github.com/alexweav)
- **Loki Log Context:** Always show label filters with at least one parsed label. [#82211](https://github.com/grafana/grafana/issues/82211), [@svennergr](https://github.com/svennergr)
- **Logs Panel:** Table UI - better default column spacing. [#82205](https://github.com/grafana/grafana/issues/82205), [@gtk-grafana](https://github.com/gtk-grafana)
- **RBAC:** Migration to remove the scope from permissions where action is alert.instances:read. [#82202](https://github.com/grafana/grafana/issues/82202), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **JWT Authentication:** Add support for specifying groups in auth.jwt for teamsync. [#82175](https://github.com/grafana/grafana/issues/82175), [@Jguer](https://github.com/Jguer)
- **Alerting:** GA alertingPreviewUpgrade and enable by default. [#82038](https://github.com/grafana/grafana/issues/82038), [@JacobsonMT](https://github.com/JacobsonMT)
- **Elasticsearch:** Apply ad-hoc filters to annotation queries. [#82032](https://github.com/grafana/grafana/issues/82032), [@mikelv92](https://github.com/mikelv92)
- **Alerting:** Show legacy provisioned alert rules warning. [#81902](https://github.com/grafana/grafana/issues/81902), [@gillesdemey](https://github.com/gillesdemey)
- **Tempo:** Support TraceQL metrics queries. [#81886](https://github.com/grafana/grafana/issues/81886), [@adrapereira](https://github.com/adrapereira)
- **Tempo:** Support backtick strings. [#81802](https://github.com/grafana/grafana/issues/81802), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Dashboards:** Remove `advancedDataSourcePicker` feature toggle. [#81790](https://github.com/grafana/grafana/issues/81790), [@Sergej-Vlasov](https://github.com/Sergej-Vlasov)
- **CloudWatch:** Remove references to pkg/infra/metrics. [#81744](https://github.com/grafana/grafana/issues/81744), [@iwysiu](https://github.com/iwysiu)
- **Licensing:** Redact license when overriden by env variable. [#81726](https://github.com/grafana/grafana/issues/81726), [@leandro-deveikis](https://github.com/leandro-deveikis)
- **Explore:** Disable cursor sync. [#81698](https://github.com/grafana/grafana/issues/81698), [@ifrost](https://github.com/ifrost)
- **Tempo:** Add custom headers middleware for grpc client. [#81693](https://github.com/grafana/grafana/issues/81693), [@aocenas](https://github.com/aocenas)
- **Chore:** Update test database initialization. [#81673](https://github.com/grafana/grafana/issues/81673), [@DanCech](https://github.com/DanCech)
- **Elasticsearch:** Implement CheckHealth method in the backend. [#81671](https://github.com/grafana/grafana/issues/81671), [@mikelv92](https://github.com/mikelv92)
- **Tooltips:** Hide dimension configuration when tooltip mode is hidden. [#81627](https://github.com/grafana/grafana/issues/81627), [@codeincarnate](https://github.com/codeincarnate)
- **Alerting:** Show warning when cp does not exist and invalidate the form. [#81621](https://github.com/grafana/grafana/issues/81621), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **User:** Add uid colum to user table. [#81615](https://github.com/grafana/grafana/issues/81615), [@ryantxu](https://github.com/ryantxu)
- **Cloudwatch:** Remove core imports from infra/log. [#81543](https://github.com/grafana/grafana/issues/81543), [@njvrzm](https://github.com/njvrzm)
- **Alerting:** Add pagination and improved search for notification policies. [#81535](https://github.com/grafana/grafana/issues/81535), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Move action buttons in the alert list view. [#81341](https://github.com/grafana/grafana/issues/81341), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Grafana/ui:** Add deprecation notices to the legacy layout components. [#81328](https://github.com/grafana/grafana/issues/81328), [@Clarity-89](https://github.com/Clarity-89)
- **Cloudwatch:** Deprecate cloudwatchNewRegionsHandler feature toggle and remove core imports from featuremgmt. [#81310](https://github.com/grafana/grafana/issues/81310), [@njvrzm](https://github.com/njvrzm)
- **Candlestick:** Add tooltip options. [#81307](https://github.com/grafana/grafana/issues/81307), [@adela-almasan](https://github.com/adela-almasan)
- **Folders:** Forbid performing operations on folders via dashboards HTTP API. [#81264](https://github.com/grafana/grafana/issues/81264), [@undef1nd](https://github.com/undef1nd)
- **Feature Management:** Move awsDatasourcesNewFormStyling to Public Preview. [#81257](https://github.com/grafana/grafana/issues/81257), [@idastambuk](https://github.com/idastambuk)
- **Alerting:** Update API to use folders' full paths. [#81214](https://github.com/grafana/grafana/issues/81214), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Datasources:** Add concurrency number to the settings. [#81212](https://github.com/grafana/grafana/issues/81212), [@itsmylife](https://github.com/itsmylife)
- **CloudWatch:** Remove dependencies on grafana/pkg/setting. [#81208](https://github.com/grafana/grafana/issues/81208), [@iwysiu](https://github.com/iwysiu)
- **Logs:** Table UI - Allow users to resize field selection section. [#81201](https://github.com/grafana/grafana/issues/81201), [@gtk-grafana](https://github.com/gtk-grafana)
- **Dashboards:** Remove emptyDashboardPage feature flag. [#81188](https://github.com/grafana/grafana/issues/81188), [@Sergej-Vlasov](https://github.com/Sergej-Vlasov)
- **Cloudwatch:** Import httpClient from grafana-plugin-sdk-go instead of grafana/infra. [#81187](https://github.com/grafana/grafana/issues/81187), [@idastambuk](https://github.com/idastambuk)
- **Logs:** Table UI - Enable feature flag by default (GA). [#81185](https://github.com/grafana/grafana/issues/81185), [@gtk-grafana](https://github.com/gtk-grafana)
- **Tempo:** Improve tags UX. [#81166](https://github.com/grafana/grafana/issues/81166), [@joey-grafana](https://github.com/joey-grafana)
- **Table:** Cell inspector auto-detecting JSON. [#81152](https://github.com/grafana/grafana/issues/81152), [@gtk-grafana](https://github.com/gtk-grafana)
- **Grafana/ui:** Add Space component. [#81145](https://github.com/grafana/grafana/issues/81145), [@Clarity-89](https://github.com/Clarity-89)
- **Grafana/ui:** Add deprecation notice to the Form component. [#81068](https://github.com/grafana/grafana/issues/81068), [@Clarity-89](https://github.com/Clarity-89)
- **Alerting:** Swap order between Annotations and Labels step in the alert rule form. [#81060](https://github.com/grafana/grafana/issues/81060), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Plugins:** Change managedPluginsInstall to public preview. [#81053](https://github.com/grafana/grafana/issues/81053), [@oshirohugo](https://github.com/oshirohugo)
- **Tempo:** Add span, trace vars to trace to metrics interpolation. [#81046](https://github.com/grafana/grafana/issues/81046), [@joey-grafana](https://github.com/joey-grafana)
- **Tempo:** Support multiple filter expressions for service graph queries. [#81037](https://github.com/grafana/grafana/issues/81037), [@domasx2](https://github.com/domasx2)
- **Alerting:** Support for simplified notification settings in rule API. [#81011](https://github.com/grafana/grafana/issues/81011), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Plugins:** Add fuzzy search to plugins catalogue. [#81001](https://github.com/grafana/grafana/issues/81001), [@Ukochka](https://github.com/Ukochka)
- **CloudWatch:** Only override contextDialer when using PDC. [#80992](https://github.com/grafana/grafana/issues/80992), [@leandro-deveikis](https://github.com/leandro-deveikis)
- **Alerting:** Add a feature flag to periodically save states. [#80987](https://github.com/grafana/grafana/issues/80987), [@JohnnyQQQQ](https://github.com/JohnnyQQQQ)
- **RBAC:** Return the underlying error instead of internal server or bad request for managed permission endpoints. [#80974](https://github.com/grafana/grafana/issues/80974), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Correlations:** Enable correlations feature toggle by default. [#80881](https://github.com/grafana/grafana/issues/80881), [@ifrost](https://github.com/ifrost)
- **Transformations:** Focus search input on drawer open. [#80859](https://github.com/grafana/grafana/issues/80859), [@codeincarnate](https://github.com/codeincarnate)
- **Packaging:** Use the GRAFANA_HOME variable in postinst script on Debian. [#80853](https://github.com/grafana/grafana/issues/80853), [@denisse-dev](https://github.com/denisse-dev)
- **Visualizations:** Hue gradient mode now applies to the line color . [#80805](https://github.com/grafana/grafana/issues/80805), [@torkelo](https://github.com/torkelo)
- **Drawer:** Resizable via draggable edge . [#80796](https://github.com/grafana/grafana/issues/80796), [@torkelo](https://github.com/torkelo)
- **Alerting:** Add setting to distribute rule group evaluations over time. [#80766](https://github.com/grafana/grafana/issues/80766), [@alexweav](https://github.com/alexweav)
- **Logs Panel:** Permalink (copy shortlink). [#80764](https://github.com/grafana/grafana/issues/80764), [@gtk-grafana](https://github.com/gtk-grafana)
- **VizTooltips:** Copy to clipboard functionality. [#80761](https://github.com/grafana/grafana/issues/80761), [@adela-almasan](https://github.com/adela-almasan)
- **AuthN:** Support reloading SSO config after the sso settings have changed. [#80734](https://github.com/grafana/grafana/issues/80734), [@mgyongyosi](https://github.com/mgyongyosi)
- **Logs Panel:** Add total count to logs volume panel in explore. [#80730](https://github.com/grafana/grafana/issues/80730), [@gtk-grafana](https://github.com/gtk-grafana)
- **Caching:** Remove useCachingService feature toggle. [#80695](https://github.com/grafana/grafana/issues/80695), [@mmandrus](https://github.com/mmandrus)
- **Table:** Support showing data links inline. . [#80691](https://github.com/grafana/grafana/issues/80691), [@ryantxu](https://github.com/ryantxu)
- **Storage:** Add support for sortBy selector. [#80680](https://github.com/grafana/grafana/issues/80680), [@DanCech](https://github.com/DanCech)
- **Alerting:** Add metric counting rule groups per org. [#80669](https://github.com/grafana/grafana/issues/80669), [@alexweav](https://github.com/alexweav)
- **RBAC:** Cover plugin routes. [#80578](https://github.com/grafana/grafana/issues/80578), [@gamab](https://github.com/gamab)
- **Profiling:** Import godeltaprof/http/pprof. [#80509](https://github.com/grafana/grafana/issues/80509), [@korniltsev](https://github.com/korniltsev)
- **Tempo:** Add warning message when scope missing in TraceQL. [#80472](https://github.com/grafana/grafana/issues/80472), [@joey-grafana](https://github.com/joey-grafana)
- **Cloudwatch:** Move getNextRefIdChar util from app/core/utils to @grafana/data. [#80471](https://github.com/grafana/grafana/issues/80471), [@idastambuk](https://github.com/idastambuk)
- **DataFrame:** Add optional unique id definition. [#80428](https://github.com/grafana/grafana/issues/80428), [@aocenas](https://github.com/aocenas)
- **Canvas:** Add element snapping and alignment. [#80407](https://github.com/grafana/grafana/issues/80407), [@nmarrs](https://github.com/nmarrs)
- **Logs:** Add show context to dashboard panel. [#80403](https://github.com/grafana/grafana/issues/80403), [@svennergr](https://github.com/svennergr)
- **Canvas:** Support context menu in panel edit mode. [#80335](https://github.com/grafana/grafana/issues/80335), [@nmarrs](https://github.com/nmarrs)
- **VizTooltip:** Add sizing options. [#80306](https://github.com/grafana/grafana/issues/80306), [@Develer](https://github.com/Develer)
- **Plugins:** Parse defaultValues correctly for nested options. [#80302](https://github.com/grafana/grafana/issues/80302), [@oshirohugo](https://github.com/oshirohugo)
- **Geomap:** Support geojson styling properties. [#80272](https://github.com/grafana/grafana/issues/80272), [@drew08t](https://github.com/drew08t)
- **Runtime:** Add property for disabling caching. [#80245](https://github.com/grafana/grafana/issues/80245), [@aangelisc](https://github.com/aangelisc)
- **Alerting:** Log scheduler maxAttempts, guard against invalid retry counts, log retry errors. [#80234](https://github.com/grafana/grafana/issues/80234), [@alexweav](https://github.com/alexweav)
- **Alerting:** Improve integration with dashboards. [#80201](https://github.com/grafana/grafana/issues/80201), [@konrad147](https://github.com/konrad147)
- **Transformations:** Use an explicit join seperator when converting from an array to string field. [#80169](https://github.com/grafana/grafana/issues/80169), [@ryantxu](https://github.com/ryantxu)
- **Build:** Update plugin IDs list in build and release process. [#80160](https://github.com/grafana/grafana/issues/80160), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **NestedFolders:** Support Shared with me folder for showing items you've been granted access to. [#80141](https://github.com/grafana/grafana/issues/80141), [@joshhunt](https://github.com/joshhunt)
- **Log Context:** Add highlighted words to log rows. [#80119](https://github.com/grafana/grafana/issues/80119), [@svennergr](https://github.com/svennergr)
- **Tempo:** Add `}` when `{` is inserted automatically. [#80113](https://github.com/grafana/grafana/issues/80113), [@harrymaurya05](https://github.com/harrymaurya05)
- **Time Range:** Copy-paste Time Range. [#80107](https://github.com/grafana/grafana/issues/80107), [@harisrozajac](https://github.com/harisrozajac)
- **PanelContext:** Remove deprecated onSplitOpen. [#80087](https://github.com/grafana/grafana/issues/80087), [@harisrozajac](https://github.com/harisrozajac)
- **Docs:** Add HAProxy rewrite information considering `serve_from_sub_path` setting. [#80062](https://github.com/grafana/grafana/issues/80062), [@simPod](https://github.com/simPod)
- **Table:** Keep expanded rows persistent when data changes if it has unique ID. [#80031](https://github.com/grafana/grafana/issues/80031), [@aocenas](https://github.com/aocenas)
- **SSO Config:** Add generic OAuth. [#79972](https://github.com/grafana/grafana/issues/79972), [@Clarity-89](https://github.com/Clarity-89)
- **FeatureFlags:** Remove the unsupported/undocumented option to read flags from a file. [#79959](https://github.com/grafana/grafana/issues/79959), [@ryantxu](https://github.com/ryantxu)
- **Transformations:** Add Group to Nested Tables Transformation. [#79952](https://github.com/grafana/grafana/issues/79952), [@codeincarnate](https://github.com/codeincarnate)
- **Cloudwatch Metrics:** Adjust error handling. [#79911](https://github.com/grafana/grafana/issues/79911), [@idastambuk](https://github.com/idastambuk)
- **Tempo:** Decouple Tempo from Grafana core. [#79888](https://github.com/grafana/grafana/issues/79888), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Table Panel:** Filter column values with operators or expressions. [#79853](https://github.com/grafana/grafana/issues/79853), [@ahuarte47](https://github.com/ahuarte47)
- **Chore:** Generate shorter UIDs. [#79843](https://github.com/grafana/grafana/issues/79843), [@ryantxu](https://github.com/ryantxu)
- **Alerting:** MuteTiming service return errutil + GetTiming by name. [#79772](https://github.com/grafana/grafana/issues/79772), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Azure Monitor:** Add select all subscription option for ARG queries. [#79582](https://github.com/grafana/grafana/issues/79582), [@alyssabull](https://github.com/alyssabull)
- **Alerting:** Enable sending notifications to a specific topic on Telegram. [#79546](https://github.com/grafana/grafana/issues/79546), [@th0th](https://github.com/th0th)
- **Logs Panel:** Table UI - Reordering table columns via drag-and-drop. [#79536](https://github.com/grafana/grafana/issues/79536), [@gtk-grafana](https://github.com/gtk-grafana)
- **Cloudwatch:** Add AWS/EMRServerless and AWS/KafkaConnect Metrics . [#79532](https://github.com/grafana/grafana/issues/79532), [@DugeraProve](https://github.com/DugeraProve)
- **Transformations:** Move transformation help to drawer component. [#79247](https://github.com/grafana/grafana/issues/79247), [@codeincarnate](https://github.com/codeincarnate)
- **Stat:** Support no value in spark line. [#78986](https://github.com/grafana/grafana/issues/78986), [@FOWind](https://github.com/FOWind)
- **NodeGraph:** Use layered layout instead of force based layout. [#78957](https://github.com/grafana/grafana/issues/78957), [@aocenas](https://github.com/aocenas)
- **Alerting:** Create alertingQueryOptimization feature flag for alert query optimization. [#78932](https://github.com/grafana/grafana/issues/78932), [@JacobsonMT](https://github.com/JacobsonMT)
- **Dashboard:** New EmbeddedDashboard runtime component . [#78916](https://github.com/grafana/grafana/issues/78916), [@torkelo](https://github.com/torkelo)
- **Alerting:** Show warning when query optimized. [#78751](https://github.com/grafana/grafana/issues/78751), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Add support for TTL for pushover for Mimir Alertmanager. [#78687](https://github.com/grafana/grafana/issues/78687), [@gillesdemey](https://github.com/gillesdemey)
- **Grafana/ui:** Enable removing values in multiselect opened state. [#78662](https://github.com/grafana/grafana/issues/78662), [@FOWind](https://github.com/FOWind)
- **SQL datasources:** Consistent interval handling. [#78517](https://github.com/grafana/grafana/issues/78517), [@gabor](https://github.com/gabor)
- **Alerting:** During legacy migration reduce the number of created silences. [#78505](https://github.com/grafana/grafana/issues/78505), [@JacobsonMT](https://github.com/JacobsonMT)
- **UI:** New share button and toolbar reorganize. [#77563](https://github.com/grafana/grafana/issues/77563), [@evictorero](https://github.com/evictorero)
- **Alerting:** Update rule API to address folders by UID. [#74600](https://github.com/grafana/grafana/issues/74600), [@papagian](https://github.com/papagian)
- **Reports:** Add uid column to the database. (Enterprise)
- **Plugins:** Add metrics for cloud plugin install. (Enterprise)
- **RBAC:** Make seeding resilient to failed plugin loading. (Enterprise)
- **Plugins:** Support disabling caching at a plugin instance level. (Enterprise)

### Bug fixes

- **Auth:** Fix email verification bypass when using basic authentication. [#82914](https://github.com/grafana/grafana/issues/82914), [@volcanonoodle](https://github.com/volcanonoodle)
- **LibraryPanels/RBAC:** Fix issue where folder scopes weren't being correctly inherited. [#82700](https://github.com/grafana/grafana/issues/82700), [@kaydelaney](https://github.com/kaydelaney)
- **Table Panel:** Fix display of ad-hoc filter actions. [#82442](https://github.com/grafana/grafana/issues/82442), [@codeincarnate](https://github.com/codeincarnate)
- **Loki:** Update `@grafana/lezer-logql` to `0.2.3` containing fix for ip label name. [#82378](https://github.com/grafana/grafana/issues/82378), [@ivanahuckova](https://github.com/ivanahuckova)
- **Alerting:** Fix slack double pound and email summary. [#82333](https://github.com/grafana/grafana/issues/82333), [@gillesdemey](https://github.com/gillesdemey)
- **Elasticsearch:** Fix resource calls for paths that include `:`. [#82327](https://github.com/grafana/grafana/issues/82327), [@ivanahuckova](https://github.com/ivanahuckova)
- **Alerting:** Return provenance of notification templates. [#82274](https://github.com/grafana/grafana/issues/82274), [@julienduchesne](https://github.com/julienduchesne)
- **LibraryPanels:** Fix issue with repeated library panels. [#82255](https://github.com/grafana/grafana/issues/82255), [@kaydelaney](https://github.com/kaydelaney)
- **Loki:** Fix fetching of values for label if no previous equality operator. [#82251](https://github.com/grafana/grafana/issues/82251), [@ivanahuckova](https://github.com/ivanahuckova)
- **Alerting:** Fix data races and improve testing. [#81994](https://github.com/grafana/grafana/issues/81994), [@diegommm](https://github.com/diegommm)
- **chore:** Fix typo in GraphTresholdsStyleMode enum. [#81960](https://github.com/grafana/grafana/issues/81960), [@paulJonesCalian](https://github.com/paulJonesCalian)
- **CloudWatch:** Fix code editor not resizing on mount when content height is &gt; 200px. [#81911](https://github.com/grafana/grafana/issues/81911), [@kevinwcyu](https://github.com/kevinwcyu)
- **FieldOptions:** Revert scalable unit option as we already support this via custom prefix/suffixes . [#81893](https://github.com/grafana/grafana/issues/81893), [@torkelo](https://github.com/torkelo)
- **Browse Dashboards:** Imported dashboards now display immediately in the dashboard list. [#81819](https://github.com/grafana/grafana/issues/81819), [@ashharrison90](https://github.com/ashharrison90)
- **Elasticsearch:** Set middlewares from Grafana's `httpClientProvider`. [#81814](https://github.com/grafana/grafana/issues/81814), [@svennergr](https://github.com/svennergr)
- **Folders:** Fix failure to update folder in SQLite. [#81795](https://github.com/grafana/grafana/issues/81795), [@papagian](https://github.com/papagian)
- **Plugins:** Never disable add new data source for core plugins. [#81774](https://github.com/grafana/grafana/issues/81774), [@oshirohugo](https://github.com/oshirohugo)
- **Alerting:** Fixes for pending period. [#81718](https://github.com/grafana/grafana/issues/81718), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Fix editing group of nested folder. [#81665](https://github.com/grafana/grafana/issues/81665), [@gillesdemey](https://github.com/gillesdemey)
- **Plugins:** Don't auto prepend app sub url to plugin asset paths. [#81658](https://github.com/grafana/grafana/issues/81658), [@wbrowne](https://github.com/wbrowne)
- **Alerting:** Fix inconsistent AM raw config when applied via sync vs API. [#81655](https://github.com/grafana/grafana/issues/81655), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Fix support check for export with modifications. [#81602](https://github.com/grafana/grafana/issues/81602), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Fix selecting empty contact point value for notification policy inheritance. [#81482](https://github.com/grafana/grafana/issues/81482), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Fix child provisioned polices not being rendered as provisioned. [#81449](https://github.com/grafana/grafana/issues/81449), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Tempo:** Fix durations in TraceQL. [#81418](https://github.com/grafana/grafana/issues/81418), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Logs:** Fix toggleable filters to be applied for specified query. [#81368](https://github.com/grafana/grafana/issues/81368), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Fix label not being added to all subexpressions. [#81360](https://github.com/grafana/grafana/issues/81360), [@svennergr](https://github.com/svennergr)
- **Loki/Elastic:** Assert queryfix value to always be string. [#81349](https://github.com/grafana/grafana/issues/81349), [@svennergr](https://github.com/svennergr)
- **Tempo:** Add query ref in the query editor. [#81343](https://github.com/grafana/grafana/issues/81343), [@joey-grafana](https://github.com/joey-grafana)
- **Transformations:** Use the display name of the original y field for the predicted field of the regression analysis transformation. [#81332](https://github.com/grafana/grafana/issues/81332), [@oscarkilhed](https://github.com/oscarkilhed)
- **Field:** Fix perf regression in getUniqueFieldName(). [#81323](https://github.com/grafana/grafana/issues/81323), [@leeoniya](https://github.com/leeoniya)
- **Alerting:** Fix scheduler to group folders by the unique key (orgID and UID). [#81303](https://github.com/grafana/grafana/issues/81303), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Fix migration edge-case race condition for silences. [#81206](https://github.com/grafana/grafana/issues/81206), [@JacobsonMT](https://github.com/JacobsonMT)
- **Explore:** Set default time range to now-1h. [#81135](https://github.com/grafana/grafana/issues/81135), [@ifrost](https://github.com/ifrost)
- **Elasticsearch:** Fix URL creation and allowlist for `/_mapping` requests. [#80970](https://github.com/grafana/grafana/issues/80970), [@svennergr](https://github.com/svennergr)
- **Postgres:** Handle single quotes in table names in the query editor. [#80951](https://github.com/grafana/grafana/issues/80951), [@gabor](https://github.com/gabor)
- **Folders:** Fix creating/updating a folder whose title has leading and trailing spaces. [#80909](https://github.com/grafana/grafana/issues/80909), [@papagian](https://github.com/papagian)
- **Loki:** Fix missing timerange in query builder values request. [#80829](https://github.com/grafana/grafana/issues/80829), [@svennergr](https://github.com/svennergr)
- **Elasticsearch:** Fix showing of logs when `__source` is log message field. [#80804](https://github.com/grafana/grafana/issues/80804), [@ivanahuckova](https://github.com/ivanahuckova)
- **Pyroscope:** Fix stale value for query in query editor. [#80753](https://github.com/grafana/grafana/issues/80753), [@joey-grafana](https://github.com/joey-grafana)
- **Stat:** Fix data links that refer to fields. [#80693](https://github.com/grafana/grafana/issues/80693), [@ajwerner](https://github.com/ajwerner)
- **RBAC:** Clean up data source permissions after data source deletion. [#80654](https://github.com/grafana/grafana/issues/80654), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Alerting:** Fix MuteTiming Get API to return provenance status. [#80494](https://github.com/grafana/grafana/issues/80494), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Tempo:** Fix regression caused by #79938. [#80465](https://github.com/grafana/grafana/issues/80465), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Alerting:** Fix preview getting the correct queries from the form. [#80458](https://github.com/grafana/grafana/issues/80458), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Fix firing alerts title when showing active in Insights panel. [#80414](https://github.com/grafana/grafana/issues/80414), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Postgres:** Fix enabling the socks proxy. [#80361](https://github.com/grafana/grafana/issues/80361), [@gabor](https://github.com/gabor)
- **Alerting:** Fix group filter. [#80358](https://github.com/grafana/grafana/issues/80358), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Increase size of kvstore value type for MySQL to LONGTEXT. [#80331](https://github.com/grafana/grafana/issues/80331), [@JacobsonMT](https://github.com/JacobsonMT)
- **Annotations:** Split cleanup into separate queries and deletes to avoid deadlocks on MySQL. [#80329](https://github.com/grafana/grafana/issues/80329), [@alexweav](https://github.com/alexweav)
- **Loki:** Fix bug duplicating parsed labels across multiple log lines. [#80292](https://github.com/grafana/grafana/issues/80292), [@svennergr](https://github.com/svennergr)
- **Alerting:** Fix NoData & Error alerts not resolving when rule is reset. [#80184](https://github.com/grafana/grafana/issues/80184), [@JacobsonMT](https://github.com/JacobsonMT)
- **Loki:** Fix metric time splitting to split starting with the start time. [#80085](https://github.com/grafana/grafana/issues/80085), [@svennergr](https://github.com/svennergr)
- **Rendering:** Fix streaming panels always reaching timeout. [#80022](https://github.com/grafana/grafana/issues/80022), [@AgnesToulet](https://github.com/AgnesToulet)
- **Plugins:** Fix colon in CallResource URL returning an error when creating plugin resource request. [#79746](https://github.com/grafana/grafana/issues/79746), [@GiedriusS](https://github.com/GiedriusS)
- **PDF:** Fix initialization when SMTP is disabled. (Enterprise)
- **PDF:** Fix repeated panels placement issue. (Enterprise)
- **Report CSV:** Fix timeout with streaming panels. (Enterprise)
- **RBAC:** Avoid repopulating removed basic role permissions if the permission scope has changed. (Enterprise)

### Breaking changes

We're adding a between the response of the ID token HD parameter and the list of allowed domains. This feature can be disabled through the configuration toggle `validate_hd `. Anyone using the legacy Google OAuth configuration should disable this validation if the ID Token response doesn't have the HD parameter. Issue [#83726](https://github.com/grafana/grafana/issues/83726)

If you use an automated provisioning (eg, Terraform) for custom roles, and have provisioned a role that includes permission with action `alert.instances:read` and some scope, you will need to update the permission in your provisioning files by removing the scope. Issue [#82202](https://github.com/grafana/grafana/issues/82202)

**The following breaking change occurs only when feature flag `nestedFolders` is enabled.**
If the folder title contains the symbol `/` (forward-slash) the notifications created from the rules that are placed in that folder will contain an escape sequence for that symbol in the label `grafana_folder`.
For example, the folder title is `Grafana / Folder`. Currently the label `grafana_folder` will contain the title as it is. If PR is merged - the label value will be `Grafana \/ Folder`.
This can break notifications if notification policies have matches that match that label and folder. Issue [#81214](https://github.com/grafana/grafana/issues/81214)

`PanelContext.onSplitOpen` is removed. In the context of Explore, plugins should use `field.getLinks` to get a list of data link models. Issue [#80087](https://github.com/grafana/grafana/issues/80087)

The unstable alert rule API has been changed and now expects a folder UID instead of the folder title as namespace path parameter.
I addition to this, the responses that used to return the folder title now return `<folder parent UID>/<folder title>` to uniquely identify them.
Any consumers of the specific API should be appropriately adapted. Issue [#74600](https://github.com/grafana/grafana/issues/74600)

### Plugin development fixes & changes

- **Grafana/UI:** Add new Splitter component . [#82357](https://github.com/grafana/grafana/issues/82357), [@torkelo](https://github.com/torkelo)

<!-- 10.4.0 END -->
<!-- 10.3.7 START -->

# 10.3.7 (2024-06-21)

### Bug fixes

- **Echo:** Suppress errors from frontend-metrics API call failing. [#89497](https://github.com/grafana/grafana/issues/89497), [@joshhunt](https://github.com/joshhunt)

<!-- 10.3.7 END -->
<!-- 10.3.6 START -->

# 10.3.6 (2024-05-13)

### Features and enhancements

- **Chore:** Upgrade go to 1.21.10. [#87474](https://github.com/grafana/grafana/issues/87474), [@stephaniehingtgen](https://github.com/stephaniehingtgen)
- **Chore:** Upgrade go to 1.21.10. (Enterprise)

### Bug fixes

- **Azure data sources:** Set selected config type before save. [#87584](https://github.com/grafana/grafana/issues/87584), [@bossinc](https://github.com/bossinc)
- **LibraryPanelRBAC:** Fix issue with importing dashboards containing library panels. [#86148](https://github.com/grafana/grafana/issues/86148), [@kaydelaney](https://github.com/kaydelaney)
- **AuthProxy:** Fix missing session for ldap auth proxy users. [#85250](https://github.com/grafana/grafana/issues/85250), [@Jguer](https://github.com/Jguer)
- **PDF:** Fix initialization when SMTP is disabled. (Enterprise)

<!-- 10.3.6 END -->
<!-- 10.3.5 START -->

# 10.3.5 (2024-03-20)

### Features and enhancements

- **Postgres:** Allow disabling SNI on SSL-enabled connections. [#84259](https://github.com/grafana/grafana/issues/84259), [@papagian](https://github.com/papagian)

### Bug fixes

- **Snapshots:** Require delete within same org (backport). [#84707](https://github.com/grafana/grafana/issues/84707), [@ryantxu](https://github.com/ryantxu)
- **Elasticsearch:** Fix legend for alerting, expressions and previously frontend queries. [#84684](https://github.com/grafana/grafana/issues/84684), [@ivanahuckova](https://github.com/ivanahuckova)
- **Dashboard:** Fix issue where out-of-view shared query panels caused blank dependent panels. [#84196](https://github.com/grafana/grafana/issues/84196), [@kaydelaney](https://github.com/kaydelaney)
- **Alerting:** Fix preview getting the correct queries from the form. [#81481](https://github.com/grafana/grafana/issues/81481), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)

<!-- 10.3.5 END -->
<!-- 10.3.4 START -->

# 10.3.4 (2024-03-06)

### Features and enhancements

- **Chore:** Improve domain validation for Google OAuth - Backport 83229 to v10.3.x. [#83725](https://github.com/grafana/grafana/issues/83725), [@linoman](https://github.com/linoman)

### Bug fixes

- **LDAP:** Fix LDAP users authenticated via auth proxy not being able to use LDAP active sync. [#83750](https://github.com/grafana/grafana/issues/83750), [@Jguer](https://github.com/Jguer)
- **Tempo:** Add template variable interpolation for filters (#83213). [#83706](https://github.com/grafana/grafana/issues/83706), [@joey-grafana](https://github.com/joey-grafana)
- **Elasticsearch:** Fix adhoc filters not applied in frontend mode. [#83596](https://github.com/grafana/grafana/issues/83596), [@svennergr](https://github.com/svennergr)
- **Dashboards:** Fixes issue where panels would not refresh if time range updated while in panel view mode. [#83525](https://github.com/grafana/grafana/issues/83525), [@kaydelaney](https://github.com/kaydelaney)
- **Auth:** Fix email verification bypass when using basic authentication. [#83484](https://github.com/grafana/grafana/issues/83484)
- **AuthProxy:** Invalidate previous cached item for user when changes are made to any header. [#83203](https://github.com/grafana/grafana/issues/83203), [@klesh](https://github.com/klesh)
- **LibraryPanels/RBAC:** Fix issue where folder scopes weren't being correctly inherited. [#82902](https://github.com/grafana/grafana/issues/82902), [@kaydelaney](https://github.com/kaydelaney)
- **LibraryPanels:** Fix issue with repeated library panels. [#82259](https://github.com/grafana/grafana/issues/82259), [@kaydelaney](https://github.com/kaydelaney)
- **Plugins:** Don't auto prepend app sub url to plugin asset paths. [#82147](https://github.com/grafana/grafana/issues/82147), [@wbrowne](https://github.com/wbrowne)
- **Elasticsearch:** Set middlewares from Grafana's `httpClientProvider`. [#81929](https://github.com/grafana/grafana/issues/81929), [@svennergr](https://github.com/svennergr)
- **Folders:** Fix failure to update folder in SQLite. [#81862](https://github.com/grafana/grafana/issues/81862), [@papagian](https://github.com/papagian)
- **Loki/Elastic:** Assert queryfix value to always be string. [#81463](https://github.com/grafana/grafana/issues/81463), [@svennergr](https://github.com/svennergr)

### Breaking changes

We're adding a between the response of the ID token HD parameter and the list of allowed domains. This feature can be disabled through the configuration toggle `validate_hd `. Anyone using the legacy Google OAuth configuration should disable this validation if the ID Token response doesn't have the HD parameter. Issue [#83725](https://github.com/grafana/grafana/issues/83725)

<!-- 10.3.4 END -->
<!-- 10.3.3 START -->

# 10.3.3 (2024-02-02)

### Bug fixes

- **Elasticsearch:** Fix creating of legend so it is backward compatible with frontend produced frames. [#81786](https://github.com/grafana/grafana/issues/81786), [@ivanahuckova](https://github.com/ivanahuckova)
- **ShareModal:** Fixes url sync issue that caused issue with save drawer. [#81721](https://github.com/grafana/grafana/issues/81721), [@ivanortegaalba](https://github.com/ivanortegaalba)

<!-- 10.3.3 END -->
<!-- 10.3.1 START -->

# 10.3.1 (2024-01-22)

To resolve a technical issue within the Grafana release package management process, we are releasing both Grafana 10.3.0 and Grafana 10.3.1 simultaneously. The 10.3.1 release contains no breaking or functional changes from 10.3.0. Please refer to the [What’s New](https://grafana.com/docs/grafana/latest/whatsnew/whats-new-in-v10-3/) post for Grafana 10.3.0 for details on new features and changes in this release.

<!-- 10.3.1 END -->
<!-- 10.3.0 START -->

# 10.3.0 (2024-01-22)

To resolve a technical issue within the Grafana release package management process, we are releasing both Grafana 10.3.0 and Grafana 10.3.1 simultaneously. The 10.3.1 release contains no breaking or functional changes from 10.3.0. Please refer to the [What’s New](https://grafana.com/docs/grafana/latest/whatsnew/whats-new-in-v10-3/) post for Grafana 10.3.0 for details on new features and changes in this release.

### Features and enhancements

- **Alerting:** Guided legacy alerting upgrade dry-run. [#80071](https://github.com/grafana/grafana/issues/80071), [@JacobsonMT](https://github.com/JacobsonMT)
- **Explore:** Preserve time range when creating a dashboard panel from Explore. [#80070](https://github.com/grafana/grafana/issues/80070), [@Elfo404](https://github.com/Elfo404)
- **Explore:** Init with mixed DS if there's no root DS in the URL and queries have multiple datasources. [#80068](https://github.com/grafana/grafana/issues/80068), [@Elfo404](https://github.com/Elfo404)
- **QueryEditor:** Display error even if error field is empty. [#79943](https://github.com/grafana/grafana/issues/79943), [@idastambuk](https://github.com/idastambuk)
- **K8s:** Enable api-server by default. [#79942](https://github.com/grafana/grafana/issues/79942), [@ryantxu](https://github.com/ryantxu)
- **Parca:** Add standalone building configuration. [#79896](https://github.com/grafana/grafana/issues/79896), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Auth:** Hide forgot password if grafana auth is disabled. [#79895](https://github.com/grafana/grafana/issues/79895), [@Jguer](https://github.com/Jguer)
- **Plugins:** Add uninstall requested message for cloud plugins. [#79748](https://github.com/grafana/grafana/issues/79748), [@oshirohugo](https://github.com/oshirohugo)
- **Loki:** Open log context in new tab. [#79723](https://github.com/grafana/grafana/issues/79723), [@svennergr](https://github.com/svennergr)
- **Alerting:** Allow linking to library panels. [#79693](https://github.com/grafana/grafana/issues/79693), [@gillesdemey](https://github.com/gillesdemey)
- **Loki:** Drop all errors in volume requests. [#79686](https://github.com/grafana/grafana/issues/79686), [@svennergr](https://github.com/svennergr)
- **Loki Logs volume:** Added a query splitting loading indicator to the Logs Volume graph. [#79681](https://github.com/grafana/grafana/issues/79681), [@matyax](https://github.com/matyax)
- **Plugins:** Disable add new data source for incomplete install. [#79658](https://github.com/grafana/grafana/issues/79658), [@oshirohugo](https://github.com/oshirohugo)
- **RBAC:** Render team, service account and user list when a user can see entities but not roles attached to them. [#79642](https://github.com/grafana/grafana/issues/79642), [@kalleep](https://github.com/kalleep)
- **InfluxDB:** Use database input for SQL configuration instead of metadata. [#79579](https://github.com/grafana/grafana/issues/79579), [@itsmylife](https://github.com/itsmylife)
- **Tempo:** Support special characters in identifiers. [#79565](https://github.com/grafana/grafana/issues/79565), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Alerting:** Display "Show all" button for cloud rules. [#79512](https://github.com/grafana/grafana/issues/79512), [@VikaCep](https://github.com/VikaCep)
- **React Hook Form:** Update to v 7.49.2. [#79493](https://github.com/grafana/grafana/issues/79493), [@Clarity-89](https://github.com/Clarity-89)
- **Loki:** Add timeRange to labels requests in LogContext to reduce loading times. [#79478](https://github.com/grafana/grafana/issues/79478), [@svennergr](https://github.com/svennergr)
- **InfluxDB:** Enable SQL support by default. [#79474](https://github.com/grafana/grafana/issues/79474), [@itsmylife](https://github.com/itsmylife)
- **OAuth:** Remove accessTokenExpirationCheck feature toggle. [#79455](https://github.com/grafana/grafana/issues/79455), [@mgyongyosi](https://github.com/mgyongyosi)
- **Units:** Add scalable unit option. [#79411](https://github.com/grafana/grafana/issues/79411), [@Develer](https://github.com/Develer)
- **Alerting:** Add export mute timings feature to the UI. [#79395](https://github.com/grafana/grafana/issues/79395), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Config:** Can add static headers to email messages. [#79365](https://github.com/grafana/grafana/issues/79365), [@owensmallwood](https://github.com/owensmallwood)
- **Alerting:** Drop NamespaceID from responses on unstable ngalert API endpoints in favor of NamespaceUID. [#79359](https://github.com/grafana/grafana/issues/79359), [@alexweav](https://github.com/alexweav)
- **Cloudwatch:** Update cloudwatchNewRegionsHandler to General Availability. [#79348](https://github.com/grafana/grafana/issues/79348), [@sarahzinger](https://github.com/sarahzinger)
- **Plugins:** Include Azure settings as a part of Grafana config sent in plugin requests. [#79342](https://github.com/grafana/grafana/issues/79342), [@aangelisc](https://github.com/aangelisc)
- **Plugins:** Add hide_angular_deprecation setting. [#79296](https://github.com/grafana/grafana/issues/79296), [@xnyo](https://github.com/xnyo)
- **Table:** Add select/unselect all column values to table filter. [#79290](https://github.com/grafana/grafana/issues/79290), [@ahuarte47](https://github.com/ahuarte47)
- **Anonymous:** Add configurable device limit. [#79265](https://github.com/grafana/grafana/issues/79265), [@Jguer](https://github.com/Jguer)
- **Frontend:** Detect new assets / versions / config changes. [#79258](https://github.com/grafana/grafana/issues/79258), [@ryantxu](https://github.com/ryantxu)
- **Plugins:** Add option to disable TLS in the socks proxy. [#79246](https://github.com/grafana/grafana/issues/79246), [@PoorlyDefinedBehaviour](https://github.com/PoorlyDefinedBehaviour)
- **Frontend:** Reload the browser when backend configuration/assets change. [#79057](https://github.com/grafana/grafana/issues/79057), [@torkelo](https://github.com/torkelo)
- **Chore:** Refactor dataviz aria-label e2e selectors to data-testid. [#78938](https://github.com/grafana/grafana/issues/78938), [@khushijain21](https://github.com/khushijain21)
- **SSO:** Add GitHub auth configuration page. [#78933](https://github.com/grafana/grafana/issues/78933), [@Clarity-89](https://github.com/Clarity-89)
- **PublicDashboards:** Add setting to disable the feature. [#78894](https://github.com/grafana/grafana/issues/78894), [@AgnesToulet](https://github.com/AgnesToulet)
- **Variables:** Interpolate variables used in custom variable definition. [#78800](https://github.com/grafana/grafana/issues/78800), [@torkelo](https://github.com/torkelo)
- **Table:** Highlight row on shared crosshair. [#78392](https://github.com/grafana/grafana/issues/78392), [@mdvictor](https://github.com/mdvictor)
- **Stat:** Add Percent Change Option. [#78250](https://github.com/grafana/grafana/issues/78250), [@drew08t](https://github.com/drew08t)
- **Plugins:** Add Command Palette extension point. [#78098](https://github.com/grafana/grafana/issues/78098), [@sd2k](https://github.com/sd2k)
- **Transformations:** Add frame source picker to allow transforming annotations. [#77842](https://github.com/grafana/grafana/issues/77842), [@leeoniya](https://github.com/leeoniya)
- **Pyroscope:** Send start/end with profile types query. [#77523](https://github.com/grafana/grafana/issues/77523), [@bryanhuhta](https://github.com/bryanhuhta)
- **Explore:** Create menu for short link button. [#77336](https://github.com/grafana/grafana/issues/77336), [@gelicia](https://github.com/gelicia)
- **Alerting:** Don't record annotations for mapped NoData transitions, when NoData is mapped to OK. [#77164](https://github.com/grafana/grafana/issues/77164), [@alexweav](https://github.com/alexweav)
- **Canvas:** Add Pan and Zoom. [#76705](https://github.com/grafana/grafana/issues/76705), [@drew08t](https://github.com/drew08t)
- **Alerting:** In migration, create one label per channel. [#76527](https://github.com/grafana/grafana/issues/76527), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Separate overlapping legacy and UA alerting routes. [#76517](https://github.com/grafana/grafana/issues/76517), [@JacobsonMT](https://github.com/JacobsonMT)
- **Tooltip:** Improved Timeseries and Candlestick tooltips. [#75841](https://github.com/grafana/grafana/issues/75841), [@adela-almasan](https://github.com/adela-almasan)
- **Alerting:** Support hysteresis command expression. [#75189](https://github.com/grafana/grafana/issues/75189), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Plugins:** Add update for instance plugins. (Enterprise)
- **React Hook Form:** Update to v 7.49.2. (Enterprise)
- **Plugins:** Improve cloud plugins install error treatment. (Enterprise)

### Bug fixes

- **Transformations:** Fix bug where having NaN in the input to regression analysis transformation causes all predictions to be NaN. [#80079](https://github.com/grafana/grafana/issues/80079), [@oscarkilhed](https://github.com/oscarkilhed)
- **Alerting:** Fix URL timestamp conversion in historian API in annotation mode. [#80026](https://github.com/grafana/grafana/issues/80026), [@alexweav](https://github.com/alexweav)
- **Fix:** Switch component not being styled as disabled when is checked. [#80012](https://github.com/grafana/grafana/issues/80012), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Tempo:** Fix Spans table format. [#79938](https://github.com/grafana/grafana/issues/79938), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Gauges:** Fixing broken auto sizing. [#79926](https://github.com/grafana/grafana/issues/79926), [@torkelo](https://github.com/torkelo)
- **Barchart:** Fix percent stacking regression. [#79903](https://github.com/grafana/grafana/issues/79903), [@nmarrs](https://github.com/nmarrs)
- **Alerting:** Fix reusing last url in tab when reopening a new tab in rule detail a…. [#79801](https://github.com/grafana/grafana/issues/79801), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Azure Monitor:** Fix multi-resource bug "Missing required region params, requested QueryParams: api-version:2017-12-01-preview...". [#79669](https://github.com/grafana/grafana/issues/79669), [@bossinc](https://github.com/bossinc)
- **Explore:** Fix URL sync with async queries import . [#79584](https://github.com/grafana/grafana/issues/79584), [@Elfo404](https://github.com/Elfo404)
- **Dashboards:** Skip inherited object variable names. [#79567](https://github.com/grafana/grafana/issues/79567), [@jarben](https://github.com/jarben)
- **Alerting:** Fix queries and expressions in rule view details. [#79497](https://github.com/grafana/grafana/issues/79497), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Tempo:** Fix cache in TraceQL editor. [#79468](https://github.com/grafana/grafana/issues/79468), [@adrapereira](https://github.com/adrapereira)
- **Nested Folders:** Fix /api/folders pagination. [#79447](https://github.com/grafana/grafana/issues/79447), [@papagian](https://github.com/papagian)
- **Elasticsearch:** Fix modify query with backslashes. [#79430](https://github.com/grafana/grafana/issues/79430), [@svennergr](https://github.com/svennergr)
- **Cloudwatch:** Fix errors while loading queries/datasource on Safari. [#79417](https://github.com/grafana/grafana/issues/79417), [@kevinwcyu](https://github.com/kevinwcyu)
- **Stat:** Fix inconsistent center padding. [#79389](https://github.com/grafana/grafana/issues/79389), [@torkelo](https://github.com/torkelo)
- **Tempo:** Fix autocompletion with strings. [#79370](https://github.com/grafana/grafana/issues/79370), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Alerting:** Fix for data source filter on cloud rules. [#79327](https://github.com/grafana/grafana/issues/79327), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Fix UI inheriting mute timings from parent when calculating the polic…. [#79295](https://github.com/grafana/grafana/issues/79295), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Auth:** Fix a panic during logout when OAuth provider is not set. [#79271](https://github.com/grafana/grafana/issues/79271), [@dmihai](https://github.com/dmihai)
- **Tempo:** Fix read-only assignment. [#79183](https://github.com/grafana/grafana/issues/79183), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Templating:** Json interpolation of single-value default selection does not create valid json. [#79137](https://github.com/grafana/grafana/issues/79137), [@kaydelaney](https://github.com/kaydelaney)
- **Heatmap:** Fix null options migration. [#79083](https://github.com/grafana/grafana/issues/79083), [@overvenus](https://github.com/overvenus)
- **Dashboards:** Run shared queries even when source panel is in collapsed row. [#77792](https://github.com/grafana/grafana/issues/77792), [@kaydelaney](https://github.com/kaydelaney)
- **PDF:** Fix support for large panels. (Enterprise)
- **Reporting:** Fix daylight saving time support for custom schedules. (Enterprise)
- **RBAC:** Fix role assignment removal . (Enterprise)

### Breaking changes

Users who have InfluxDB datasource configured with SQL querying language must update their database information. They have to enter their `bucket name` into the database field. Issue [#79579](https://github.com/grafana/grafana/issues/79579)

Removes `NamespaceID` from responses of all GET routes underneath the path `/api/ruler/grafana/api/v1/rules` - 3 affected endpoints. All affected routes are not in the publicly documented or `stable` marked portion of the ngalert API. This only breaks clients who are directly using the unstable portion of the API. Such clients should use `NamespaceUID` rather than `NamespaceID` to identify namespaces. Issue [#79359](https://github.com/grafana/grafana/issues/79359)

<!-- 10.3.0 END -->
<!-- 10.2.8 START -->

# 10.2.8 (2024-06-21)

### Bug fixes

- **Elasticsearch:** Fix URL creation and allowlist for `/_mapping` requests. [#87711](https://github.com/grafana/grafana/issues/87711), [@svennergr](https://github.com/svennergr)

<!-- 10.2.8 END -->
<!-- 10.2.7 START -->

# 10.2.7 (2024-05-13)

### Features and enhancements

- **Chore:** Upgrade go to 1.21.10. [#87475](https://github.com/grafana/grafana/issues/87475), [@stephaniehingtgen](https://github.com/stephaniehingtgen)
- **Chore:** Upgrade go to 1.21.10. (Enterprise)

### Bug fixes

- **Azure data sources:** Set selected config type before save. [#87583](https://github.com/grafana/grafana/issues/87583), [@bossinc](https://github.com/bossinc)

<!-- 10.2.7 END -->
<!-- 10.2.6 START -->

# 10.2.6 (2024-03-25)

### Features and enhancements

- **Postgres:** Allow disabling SNI on SSL-enabled connections. [#84258](https://github.com/grafana/grafana/issues/84258), [@papagian](https://github.com/papagian)

### Bug fixes

- **CloudMonitoring:** Only run query if filters are complete. [#85014](https://github.com/grafana/grafana/issues/85014), [@aangelisc](https://github.com/aangelisc)
- **Snapshots:** Require delete within same org (backport). [#84730](https://github.com/grafana/grafana/issues/84730), [@ryantxu](https://github.com/ryantxu)
- **Dashboard:** Fix issue where out-of-view shared query panels caused blank dependent panels. [#84195](https://github.com/grafana/grafana/issues/84195), [@kaydelaney](https://github.com/kaydelaney)
- **Dashboards:** Run shared queries even when source panel is in collapsed row. [#84166](https://github.com/grafana/grafana/issues/84166), [@kaydelaney](https://github.com/kaydelaney)
- **Prometheus:** Fix calculating rate interval when there is no interval specified. [#84082](https://github.com/grafana/grafana/issues/84082), [@itsmylife](https://github.com/itsmylife)
- **Prometheus:** Fix $\_\_rate_interval calculation. [#84063](https://github.com/grafana/grafana/issues/84063), [@tolzhabayev](https://github.com/tolzhabayev)

<!-- 10.2.6 END -->
<!-- 10.2.5 START -->

# 10.2.5 (2024-03-06)

### Features and enhancements

- **Alerting:** Add setting to distribute rule group evaluations over time. [#81404](https://github.com/grafana/grafana/issues/81404), [@alexweav](https://github.com/alexweav)

### Bug fixes

- **Cloudwatch:** Fix errors while loading queries/datasource on Safari. [#83842](https://github.com/grafana/grafana/issues/83842), [@kevinwcyu](https://github.com/kevinwcyu)
- **Elasticsearch:** Fix adhoc filters not applied in frontend mode. [#83595](https://github.com/grafana/grafana/issues/83595), [@svennergr](https://github.com/svennergr)
- **Auth:** Fix email verification bypass when using basic authentication. [#83489](https://github.com/grafana/grafana/issues/83489)
- **Alerting:** Fix queries and expressions in rule view details. [#82875](https://github.com/grafana/grafana/issues/82875), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Plugins:** Don't auto prepend app sub url to plugin asset paths. [#82146](https://github.com/grafana/grafana/issues/82146), [@wbrowne](https://github.com/wbrowne)
- **Folders:** Fix failure to update folder in SQLite. [#81861](https://github.com/grafana/grafana/issues/81861), [@papagian](https://github.com/papagian)

<!-- 10.2.5 END -->
<!-- 10.2.4 START -->

# 10.2.4 (2024-01-29)

### Features and enhancements

- **Chore:** Upgrade Go to 1.21.5. [#79560](https://github.com/grafana/grafana/issues/79560), [@tolzhabayev](https://github.com/tolzhabayev)

### Bug fixes

- **Field:** Fix perf regression in getUniqueFieldName(). [#81417](https://github.com/grafana/grafana/issues/81417), [@leeoniya](https://github.com/leeoniya)
- **Alerting:** Fix Graphite subqueries. [#80816](https://github.com/grafana/grafana/issues/80816), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Fix Graphite subqueries. [#80744](https://github.com/grafana/grafana/issues/80744), [@gillesdemey](https://github.com/gillesdemey)
- **Annotations:** Split cleanup into separate queries and deletes to avoid deadlocks on MySQL. [#80485](https://github.com/grafana/grafana/issues/80485), [@alexweav](https://github.com/alexweav)
- **Loki:** Fix bug duplicating parsed labels across multiple log lines. [#80368](https://github.com/grafana/grafana/issues/80368), [@svennergr](https://github.com/svennergr)
- **Alerting:** Fix NoData & Error alerts not resolving when rule is reset. [#80241](https://github.com/grafana/grafana/issues/80241), [@JacobsonMT](https://github.com/JacobsonMT)
- **Auth:** Fix a panic during logout when OAuth provider is not set. [#80221](https://github.com/grafana/grafana/issues/80221), [@dmihai](https://github.com/dmihai)
- **Gauges:** Fixing broken auto sizing. [#79940](https://github.com/grafana/grafana/issues/79940), [@torkelo](https://github.com/torkelo)
- **Templating:** Json interpolation of single-value default selection does not create valid json. [#79503](https://github.com/grafana/grafana/issues/79503), [@kaydelaney](https://github.com/kaydelaney)
- **Tempo:** Fix cache in TraceQL editor. [#79471](https://github.com/grafana/grafana/issues/79471), [@adrapereira](https://github.com/adrapereira)
- **Alerting:** Fix for data source filter on cloud rules. (#79327). [#79350](https://github.com/grafana/grafana/issues/79350), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)

<!-- 10.2.4 END -->
<!-- 10.2.3 START -->

# 10.2.3 (2023-12-18)

### Features and enhancements

- **Auth:** Improve groups claim setup docs for AzureAD. [#79227](https://github.com/grafana/grafana/issues/79227), [@mgyongyosi](https://github.com/mgyongyosi)
- **Alerting:** Attempt to retry retryable errors. [#79161](https://github.com/grafana/grafana/issues/79161), [@gotjosh](https://github.com/gotjosh)
- **Unified Alerting:** Set `max_attempts` to 1 by default. [#79095](https://github.com/grafana/grafana/issues/79095), [@gotjosh](https://github.com/gotjosh)
- **Auth:** Use SSO settings service to load social connectors + refactor. [#79005](https://github.com/grafana/grafana/issues/79005), [@mgyongyosi](https://github.com/mgyongyosi)
- **Cloudwatch:** Update error code metrics for ES/OpenSearch. [#78990](https://github.com/grafana/grafana/issues/78990), [@siddhikhapare](https://github.com/siddhikhapare)
- **Auth:** Add anonymous users view and stats. [#78965](https://github.com/grafana/grafana/issues/78965), [@Jguer](https://github.com/Jguer)
- **Flamegraph:** Add table filtering for Flamegraph panel. [#78962](https://github.com/grafana/grafana/issues/78962), [@Rperry2174](https://github.com/Rperry2174)
- **Pyroscope:** Improve label suggestions in query editor. [#78861](https://github.com/grafana/grafana/issues/78861), [@aleks-p](https://github.com/aleks-p)
- **InfluxDB:** Introduce influxqlStreamingParser feature toggle. [#78834](https://github.com/grafana/grafana/issues/78834), [@itsmylife](https://github.com/itsmylife)
- **Usagestats:** Add stat group for alert rule groups. [#78825](https://github.com/grafana/grafana/issues/78825), [@alexweav](https://github.com/alexweav)
- **Auth:** Improve groups claim setup docs for AzureAD. [#78791](https://github.com/grafana/grafana/issues/78791), [@mgyongyosi](https://github.com/mgyongyosi)
- **Loki:** Added support for "or" statements in line filters. [#78705](https://github.com/grafana/grafana/issues/78705), [@matyax](https://github.com/matyax)
- **Cloudwatch:** Add missing metrics for AWS/IVSRealtime namespace. [#78688](https://github.com/grafana/grafana/issues/78688), [@idastambuk](https://github.com/idastambuk)
- **Auth:** Add anonymous users view and stats. [#78685](https://github.com/grafana/grafana/issues/78685), [@eleijonmarck](https://github.com/eleijonmarck)
- **Alerting:** Filter insights panels (grafanacloud-usage ds) by instance_id. [#78657](https://github.com/grafana/grafana/issues/78657), [@VikaCep](https://github.com/VikaCep)
- **Login:** Improve accessibility of Login form. [#78652](https://github.com/grafana/grafana/issues/78652), [@joshhunt](https://github.com/joshhunt)
- **Tracing:** Full text search. [#78628](https://github.com/grafana/grafana/issues/78628), [@joey-grafana](https://github.com/joey-grafana)
- **Alerting:** In migration, fallback to '1s' for malformed min interval. [#78614](https://github.com/grafana/grafana/issues/78614), [@JacobsonMT](https://github.com/JacobsonMT)
- **AuthProxy:** Do not allow sessions to be assigned with other methods. [#78602](https://github.com/grafana/grafana/issues/78602), [@Jguer](https://github.com/Jguer)
- **Loki:** Filter by labels based on the type of label (structured, indexed, parsed). [#78595](https://github.com/grafana/grafana/issues/78595), [@svennergr](https://github.com/svennergr)
- **Loki:** Add structured metadata keys to autocomplete. [#78584](https://github.com/grafana/grafana/issues/78584), [@svennergr](https://github.com/svennergr)
- **Variables:** Remove alpha flag from variable support API. [#78573](https://github.com/grafana/grafana/issues/78573), [@sunker](https://github.com/sunker)
- **Azure Monitor:** Add Azure Infrastructure Monitoring Dashboard. [#78498](https://github.com/grafana/grafana/issues/78498), [@JohnJMartins](https://github.com/JohnJMartins)
- **Timeseries:** Remove cursor sync when x is not time. [#78496](https://github.com/grafana/grafana/issues/78496), [@adela-almasan](https://github.com/adela-almasan)
- **Auth:** Load ini/env vars settings in the fallback strategy. [#78495](https://github.com/grafana/grafana/issues/78495), [@mgyongyosi](https://github.com/mgyongyosi)
- **CloudWatch:** Add AWS Bedrock metrics definition. [#78478](https://github.com/grafana/grafana/issues/78478), [@thepalbi](https://github.com/thepalbi)
- **SSO:** Display provider list. [#78472](https://github.com/grafana/grafana/issues/78472), [@Clarity-89](https://github.com/Clarity-89)
- **Transformations:** Add regression analysis transformation. [#78457](https://github.com/grafana/grafana/issues/78457), [@oscarkilhed](https://github.com/oscarkilhed)
- **Auth:** Make clientTokenRotation enabled by default. [#78384](https://github.com/grafana/grafana/issues/78384), [@mgyongyosi](https://github.com/mgyongyosi)
- **Alerting:** In migration improve deduplication of title and group. [#78351](https://github.com/grafana/grafana/issues/78351), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Add clean_upgrade config and deprecate force_migration. [#78324](https://github.com/grafana/grafana/issues/78324), [@JacobsonMT](https://github.com/JacobsonMT)
- **Tempo:** Allow `!~` in Search tab. [#78315](https://github.com/grafana/grafana/issues/78315), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Avatar:** Allow browser caching of /avatar/. [#78314](https://github.com/grafana/grafana/issues/78314), [@oscarkilhed](https://github.com/oscarkilhed)
- **Transformations:** Move transformation addition into drawer. [#78299](https://github.com/grafana/grafana/issues/78299), [@codeincarnate](https://github.com/codeincarnate)
- **Alerting:** Update rule access control to return errutil errors. [#78284](https://github.com/grafana/grafana/issues/78284), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Licensing:** Update enterprise documentation. [#78276](https://github.com/grafana/grafana/issues/78276), [@leandro-deveikis](https://github.com/leandro-deveikis)
- **CloudWatch Logs:** Support fetching fields in monaco editor. [#78244](https://github.com/grafana/grafana/issues/78244), [@iwysiu](https://github.com/iwysiu)
- **Server:** Automatically generate a self-signed TLS cert if needed. [#78243](https://github.com/grafana/grafana/issues/78243), [@DanCech](https://github.com/DanCech)
- **Grafana/ui:** Move Grid out of unstable. [#78220](https://github.com/grafana/grafana/issues/78220), [@Clarity-89](https://github.com/Clarity-89)
- **Plugins:** Add AWS/MediaLive metric for CloudWatch. [#78163](https://github.com/grafana/grafana/issues/78163), [@arabian9ts](https://github.com/arabian9ts)
- **Transformations:** Move transformation variables to public preview. [#78148](https://github.com/grafana/grafana/issues/78148), [@oscarkilhed](https://github.com/oscarkilhed)
- **Plugins:** Share plugin context with the component-type extensions. [#78111](https://github.com/grafana/grafana/issues/78111), [@leventebalogh](https://github.com/leventebalogh)
- **Breadcrumbs:** Only dedupe breacrumb items for matching node names. [#78077](https://github.com/grafana/grafana/issues/78077), [@gillesdemey](https://github.com/gillesdemey)
- **Dashboards:** Implement natural sort for query variables. [#78024](https://github.com/grafana/grafana/issues/78024), [@bobrik](https://github.com/bobrik)
- **Alerting:** Adds the new alertingSimplifiedRouting feature toggle. [#77984](https://github.com/grafana/grafana/issues/77984), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Allow to clear datasource selection in panel list. [#77960](https://github.com/grafana/grafana/issues/77960), [@VikaCep](https://github.com/VikaCep)
- **Plugins:** Share the plugin context with apps and ui-extensions. [#77933](https://github.com/grafana/grafana/issues/77933), [@leventebalogh](https://github.com/leventebalogh)
- **InfluxDB:** Add new truthiness operators (`Is` and `Is Not`) to InfluxQL Query Builder. [#77923](https://github.com/grafana/grafana/issues/77923), [@btasker](https://github.com/btasker)
- **Auth:** Refactor OAuth connectors' initialization. [#77919](https://github.com/grafana/grafana/issues/77919), [@mgyongyosi](https://github.com/mgyongyosi)
- **InfluxDB:** Add support for `&gt;=` and `&lt;=` comparison operators to IQL Query Builder. [#77917](https://github.com/grafana/grafana/issues/77917), [@btasker](https://github.com/btasker)
- **Alerting:** Add actions extension point to alert instances table view. [#77900](https://github.com/grafana/grafana/issues/77900), [@sd2k](https://github.com/sd2k)
- **Dashboard:** Add ability to stop title/description generation. [#77896](https://github.com/grafana/grafana/issues/77896), [@adela-almasan](https://github.com/adela-almasan)
- **Tempo:** Allow quotes in tag names and attributes. [#77864](https://github.com/grafana/grafana/issues/77864), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Plugins:** Add grafana/user/profile/tab plugin extension point. [#77863](https://github.com/grafana/grafana/issues/77863), [@joeyorlando](https://github.com/joeyorlando)
- **DashList:** Update links with time range and variables change. [#77850](https://github.com/grafana/grafana/issues/77850), [@torkelo](https://github.com/torkelo)
- **Cloudwatch:** Migrate Config editor and Variable editor to new form stying under feature toggle. [#77838](https://github.com/grafana/grafana/issues/77838), [@idastambuk](https://github.com/idastambuk)
- **InfluxDB:** Template variable support for SQL language. [#77799](https://github.com/grafana/grafana/issues/77799), [@itsmylife](https://github.com/itsmylife)
- **Grafana/ui:** Unify flex shorthand props. [#77768](https://github.com/grafana/grafana/issues/77768), [@Clarity-89](https://github.com/Clarity-89)
- **Explore:** Default synced to true, only show synced status if panes are split. [#77759](https://github.com/grafana/grafana/issues/77759), [@gelicia](https://github.com/gelicia)
- **Tooltips:** Support long labels. [#77735](https://github.com/grafana/grafana/issues/77735), [@Develer](https://github.com/Develer)
- **Logs:** Update logic to process logs dataPlane frame with labels field. [#77708](https://github.com/grafana/grafana/issues/77708), [@ivanahuckova](https://github.com/ivanahuckova)
- **Snapshots:** Do not return internal database ids. [#77672](https://github.com/grafana/grafana/issues/77672), [@ryantxu](https://github.com/ryantxu)
- **Tempo:** Support comments in TraceQL. [#77646](https://github.com/grafana/grafana/issues/77646), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Alerting:** Avoid alert list view component being unmounted every time we fetch new data. [#77631](https://github.com/grafana/grafana/issues/77631), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Swagger:** Rename annotations model. [#77605](https://github.com/grafana/grafana/issues/77605), [@julienduchesne](https://github.com/julienduchesne)
- **Transformations:** Deduplicate names when using `extract fields` transformation. [#77569](https://github.com/grafana/grafana/issues/77569), [@oscarkilhed](https://github.com/oscarkilhed)
- **BrowseDashboards:** Add `RadioButtonGroup` to be able to chose between 'Browse' or 'List' view. [#77561](https://github.com/grafana/grafana/issues/77561), [@eledobleefe](https://github.com/eledobleefe)
- **Stack:** Use the component from grafana/ui. [#77543](https://github.com/grafana/grafana/issues/77543), [@Clarity-89](https://github.com/Clarity-89)
- **Tempo:** Handle empty responses in ServiceGraph. [#77539](https://github.com/grafana/grafana/issues/77539), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Tempo:** Embed flame graph in span details. [#77537](https://github.com/grafana/grafana/issues/77537), [@joey-grafana](https://github.com/joey-grafana)
- **CloudWatch:** Call query method from DataSourceWithBackend to support public dashboards. [#77532](https://github.com/grafana/grafana/issues/77532), [@kevinwcyu](https://github.com/kevinwcyu)
- **Chore:** Prepare to remove &lt;Graph /&gt; from @grafana/ui. [#77522](https://github.com/grafana/grafana/issues/77522), [@ryantxu](https://github.com/ryantxu)
- **Grafana/ui:** Move the Stack component out of unstable. [#77495](https://github.com/grafana/grafana/issues/77495), [@Clarity-89](https://github.com/Clarity-89)
- **Flamegraph:** Add collapsing for similar items in the stack. [#77461](https://github.com/grafana/grafana/issues/77461), [@aocenas](https://github.com/aocenas)
- **Tempo:** Added status to hard-coded fields. [#77393](https://github.com/grafana/grafana/issues/77393), [@adrapereira](https://github.com/adrapereira)
- **Alerting:** Adds contact point sorting and searching. [#77390](https://github.com/grafana/grafana/issues/77390), [@gillesdemey](https://github.com/gillesdemey)
- **Loki:** Add backend functionality to parse structured metadata from Loki. [#77361](https://github.com/grafana/grafana/issues/77361), [@svennergr](https://github.com/svennergr)
- **ValueFormats:** Use plural for time units. [#77337](https://github.com/grafana/grafana/issues/77337), [@utkarshdeepak](https://github.com/utkarshdeepak)
- **Calculations:** Update First _ and Last _ reducers to exclude NaNs. [#77323](https://github.com/grafana/grafana/issues/77323), [@nmarrs](https://github.com/nmarrs)
- **Chore:** Upgrade Go to 1.21.3. [#77304](https://github.com/grafana/grafana/issues/77304), [@ryantxu](https://github.com/ryantxu)
- **Tooltip:** Improved Trend tooltip. [#77251](https://github.com/grafana/grafana/issues/77251), [@adela-almasan](https://github.com/adela-almasan)
- **Dashboards:** Remove dummy trim dashboard api. [#77249](https://github.com/grafana/grafana/issues/77249), [@ryantxu](https://github.com/ryantxu)
- **Alerting:** Enable feature flag alertingNoDataErrorExecution by default. [#77242](https://github.com/grafana/grafana/issues/77242), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Cloudwatch:** Add DB_PERF_INSIGHTS to Metric Math. [#77241](https://github.com/grafana/grafana/issues/77241), [@iwysiu](https://github.com/iwysiu)
- **PluginExtensions:** Returns a clone of moment objects in context. [#77238](https://github.com/grafana/grafana/issues/77238), [@mckn](https://github.com/mckn)
- **Logs:** Deprecated `showContextToggle` in DataSourceWithLogsContextSupport. [#77232](https://github.com/grafana/grafana/issues/77232), [@matyax](https://github.com/matyax)
- **AzureMonitor:** Add Container Insights Syslog Dashboard. [#77229](https://github.com/grafana/grafana/issues/77229), [@JohnJMartins](https://github.com/JohnJMartins)
- **Loki:** Add optional stream selector to fetchLabelValues API. [#77207](https://github.com/grafana/grafana/issues/77207), [@ivanahuckova](https://github.com/ivanahuckova)
- **Alerting:** Add support for responders to Opsgenie integration. [#77159](https://github.com/grafana/grafana/issues/77159), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Chore:** Replace crewjam/saml with the latest grafana/saml lib. [#77153](https://github.com/grafana/grafana/issues/77153), [@mgyongyosi](https://github.com/mgyongyosi)
- **Tempo:** Add new intrinsics. [#77146](https://github.com/grafana/grafana/issues/77146), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **GrafanaUI:** Prevent code editors from 'trapping' scroll. [#77125](https://github.com/grafana/grafana/issues/77125), [@joshhunt](https://github.com/joshhunt)
- **Plugins:** Change managed plugins installation call. [#77120](https://github.com/grafana/grafana/issues/77120), [@oshirohugo](https://github.com/oshirohugo)
- **Alerting:** Show receiver in groups view to avoid duplication in the list. [#77109](https://github.com/grafana/grafana/issues/77109), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Allow more time before Alertmanager expire-resolves alerts. [#77094](https://github.com/grafana/grafana/issues/77094), [@alexweav](https://github.com/alexweav)
- **Tempo:** Add new structural operators. [#77056](https://github.com/grafana/grafana/issues/77056), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **ServiceAccount:** Add pagination to service account table. [#77044](https://github.com/grafana/grafana/issues/77044), [@kalleep](https://github.com/kalleep)
- **Transformations:** Cumulative and window modes for `Add field from calculation`. [#77029](https://github.com/grafana/grafana/issues/77029), [@mdvictor](https://github.com/mdvictor)
- **Plugins:** Allow disabling angular deprecation UI for specific plugins. [#77026](https://github.com/grafana/grafana/issues/77026), [@xnyo](https://github.com/xnyo)
- **Stat:** Add panel option to control wide layout. [#77018](https://github.com/grafana/grafana/issues/77018), [@nmarrs](https://github.com/nmarrs)
- **Logs Panel:** Column selection for experimental table visualization in explore. [#76983](https://github.com/grafana/grafana/issues/76983), [@gtk-grafana](https://github.com/gtk-grafana)
- **Alerting:** Update 'Create alert' to 'New alert rule' in the panel and docs. [#76950](https://github.com/grafana/grafana/issues/76950), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **InfluxDB:** Implement InfluxQL json streaming parser. [#76934](https://github.com/grafana/grafana/issues/76934), [@itsmylife](https://github.com/itsmylife)
- **Plugins:** Improvements to NodeGraph. [#76879](https://github.com/grafana/grafana/issues/76879), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Trace View:** Critical path highlighting. [#76857](https://github.com/grafana/grafana/issues/76857), [@adrapereira](https://github.com/adrapereira)
- **Caching:** Enable `useCachingService` feature toggle by default. [#76845](https://github.com/grafana/grafana/issues/76845), [@mmandrus](https://github.com/mmandrus)
- **Plugins:** Pass OTEL sampling config to plugins. [#76834](https://github.com/grafana/grafana/issues/76834), [@xnyo](https://github.com/xnyo)
- **Transformations:** Allow Timeseries to table transformation to handle multiple time series. [#76801](https://github.com/grafana/grafana/issues/76801), [@codeincarnate](https://github.com/codeincarnate)
- **Plugins:** Add managed instance installation resources. [#76767](https://github.com/grafana/grafana/issues/76767), [@oshirohugo](https://github.com/oshirohugo)
- **Nav:** Design changes in MegaMenu. [#76735](https://github.com/grafana/grafana/issues/76735), [@L-M-K-B](https://github.com/L-M-K-B)
- **Cloudwatch:** Add missing appsync metrics. [#76703](https://github.com/grafana/grafana/issues/76703), [@ctobolski](https://github.com/ctobolski)
- **Plugins:** Add status_source label to plugin request logs. [#76676](https://github.com/grafana/grafana/issues/76676), [@xnyo](https://github.com/xnyo)
- **Tracing:** Trace to profiles. [#76670](https://github.com/grafana/grafana/issues/76670), [@joey-grafana](https://github.com/joey-grafana)
- **InfluxDB:** Enable InfluxDB backend mode by default. [#76641](https://github.com/grafana/grafana/issues/76641), [@itsmylife](https://github.com/itsmylife)
- **Log Context:** Add Log Context support to mixed data sources. [#76623](https://github.com/grafana/grafana/issues/76623), [@matyax](https://github.com/matyax)
- **Alerting:** Add Alerting menu in getPanelMenu. [#76618](https://github.com/grafana/grafana/issues/76618), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Azure monitor:** Support Logs visualization. [#76594](https://github.com/grafana/grafana/issues/76594), [@bossinc](https://github.com/bossinc)
- **Transformations:** Support enum field conversion. [#76410](https://github.com/grafana/grafana/issues/76410), [@nmarrs](https://github.com/nmarrs)
- **Select:** Overflow ellipsis and control over multi value wrapping . [#76405](https://github.com/grafana/grafana/issues/76405), [@torkelo](https://github.com/torkelo)
- **Transformations:** Move debug to drawer. [#76281](https://github.com/grafana/grafana/issues/76281), [@codeincarnate](https://github.com/codeincarnate)
- **Gauge:** Simplify gauge dimension panel options. [#76216](https://github.com/grafana/grafana/issues/76216), [@nmarrs](https://github.com/nmarrs)
- **Loki:** Option to add derived fields based on labels. [#76162](https://github.com/grafana/grafana/issues/76162), [@5cat](https://github.com/5cat)
- **CloudWatch:** Add missing GameLift metrics . [#76102](https://github.com/grafana/grafana/issues/76102), [@fridgepoet](https://github.com/fridgepoet)
- **CloudWatch:** Update query batching logic. [#76075](https://github.com/grafana/grafana/issues/76075), [@iwysiu](https://github.com/iwysiu)
- **Bar Gauge:** Add max height option. [#76042](https://github.com/grafana/grafana/issues/76042), [@Develer](https://github.com/Develer)
- **Plugins:** Add feat toggle to install managed plugins. [#75973](https://github.com/grafana/grafana/issues/75973), [@oshirohugo](https://github.com/oshirohugo)
- **Correlations:** Add transformations to Explore Editor. [#75930](https://github.com/grafana/grafana/issues/75930), [@gelicia](https://github.com/gelicia)
- **Azure Monitor:** Add 5 curated dashboards for App insights troubleshooting experience. [#75916](https://github.com/grafana/grafana/issues/75916), [@yves-chan](https://github.com/yves-chan)
- **Loki Queries:** Query Splitting enabled by default. [#75876](https://github.com/grafana/grafana/issues/75876), [@matyax](https://github.com/matyax)
- **Alerting:** Fetch alerts from a remote Alertmanager. [#75844](https://github.com/grafana/grafana/issues/75844), [@santihernandezc](https://github.com/santihernandezc)
- **Tooltip:** Improved Heatmap tooltip. [#75712](https://github.com/grafana/grafana/issues/75712), [@adela-almasan](https://github.com/adela-almasan)
- **Dashboard:** DashboardGrid - don't animate if reduced-motion set. [#75540](https://github.com/grafana/grafana/issues/75540), [@dnwe](https://github.com/dnwe)
- **SQL:** Update configuration pages. [#75525](https://github.com/grafana/grafana/issues/75525), [@gwdawson](https://github.com/gwdawson)
- **Geomap:** Add more countries ISO 3166 Alpha-3-code to the gazetteer/countries.json. [#75311](https://github.com/grafana/grafana/issues/75311), [@alexsan92](https://github.com/alexsan92)
- **Log Rows:** Added popover menu with filter options when a log line is selected. [#75306](https://github.com/grafana/grafana/issues/75306), [@matyax](https://github.com/matyax)
- **Auth:** Split signout_redirect_url into per provider settings. [#75269](https://github.com/grafana/grafana/issues/75269), [@venkatbvc](https://github.com/venkatbvc)
- **Analytics:** Add option to pass destSDKBaseURL to rudderstack load method. [#74926](https://github.com/grafana/grafana/issues/74926), [@gassiss](https://github.com/gassiss)
- **SQL:** Add timeFilter macro to query builder. [#74575](https://github.com/grafana/grafana/issues/74575), [@zoltanbedi](https://github.com/zoltanbedi)
- **Storage:** Unified Storage based on Entity API. [#71977](https://github.com/grafana/grafana/issues/71977), [@DanCech](https://github.com/DanCech)
- **Policies:** Adds deprecation policy. [#68439](https://github.com/grafana/grafana/issues/68439), [@bergquist](https://github.com/bergquist)
- **Reports:** Do not show the unsaved changes modal for URL params change. (Enterprise)
- **Plugins:** Add endpoints to get instance plugins. (Enterprise)
- **Swagger:** Clean up Report struct names. (Enterprise)
- **Plugins:** Add managed installer. (Enterprise)
- **DatasourceACL:** Remove deprecated datasource permissions endpoints. (Enterprise)
- **RBAC:** Introduce a data source administrator role. (Enterprise)

### Bug fixes

- **Alerting:** Fix deleting rules in a folder with matching UID in another organization. [#79011](https://github.com/grafana/grafana/issues/79011), [@papagian](https://github.com/papagian)
- **CloudWatch:** Correctly quote metric names with special characters. [#78958](https://github.com/grafana/grafana/issues/78958), [@iwysiu](https://github.com/iwysiu)
- **Fix:** Use dashboard time range in prometheus variable editor. [#78950](https://github.com/grafana/grafana/issues/78950), [@itsmylife](https://github.com/itsmylife)
- **DeleteDashboard:** Redirect to home after deleting a dashboard. [#78936](https://github.com/grafana/grafana/issues/78936), [@ivanortegaalba](https://github.com/ivanortegaalba)
- **Alerting:** Change create/update permissions for silences. [#78920](https://github.com/grafana/grafana/issues/78920), [@VikaCep](https://github.com/VikaCep)
- **DeleteDashboard:** Redirect to home after deleting a dashboard. [#78918](https://github.com/grafana/grafana/issues/78918), [@ivanortegaalba](https://github.com/ivanortegaalba)
- **Alerting:** Fixes combination of multiple predicates for rule search. [#78910](https://github.com/grafana/grafana/issues/78910), [@gillesdemey](https://github.com/gillesdemey)
- **Timeseries to table transformation:** Fix misaligned table field values if some frames are missing a label. [#78909](https://github.com/grafana/grafana/issues/78909), [@domasx2](https://github.com/domasx2)
- **CloudWatch:** Fetch Dimension keys correctly from Dimension Picker. [#78831](https://github.com/grafana/grafana/issues/78831), [@iwysiu](https://github.com/iwysiu)
- **Plugins:** Only preload plugins if user is authenticated. [#78805](https://github.com/grafana/grafana/issues/78805), [@marefr](https://github.com/marefr)
- **Tempo:** Fix read-only access error. [#78801](https://github.com/grafana/grafana/issues/78801), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Stats:** Fix unregistered unified alerting metric. [#78777](https://github.com/grafana/grafana/issues/78777), [@alexweav](https://github.com/alexweav)
- **RBAC:** Adjust filter for acl list to check for permissions on service accounts. [#78681](https://github.com/grafana/grafana/issues/78681), [@kalleep](https://github.com/kalleep)
- **Bug:** Fix broken ui components when angular is disabled. [#78670](https://github.com/grafana/grafana/issues/78670), [@jackw](https://github.com/jackw)
- **Plugins:** Only set non-existing headers for core plugin requests. [#78633](https://github.com/grafana/grafana/issues/78633), [@aangelisc](https://github.com/aangelisc)
- **CloudWatch:** Fetch Dimension keys correctly from Dimension Picker. [#78556](https://github.com/grafana/grafana/issues/78556), [@iwysiu](https://github.com/iwysiu)
- **InfluxDB:** Parse data for table view to have parity with frontend parser. [#78551](https://github.com/grafana/grafana/issues/78551), [@itsmylife](https://github.com/itsmylife)
- **Elasticsearch:** Fix processing of raw_data with not-recognized time format. [#78380](https://github.com/grafana/grafana/issues/78380), [@ivanahuckova](https://github.com/ivanahuckova)
- **Command Palette:** Fix for chinese input and keystrokes being lost in slow environments. [#78373](https://github.com/grafana/grafana/issues/78373), [@ashharrison90](https://github.com/ashharrison90)
- **InfluxDB:** Parse data for table view to have parity with frontend parser. [#78365](https://github.com/grafana/grafana/issues/78365), [@itsmylife](https://github.com/itsmylife)
- **FeatureToggle:** Disable `dashgpt` by default and mark it as preview. [#78348](https://github.com/grafana/grafana/issues/78348), [@ivanortegaalba](https://github.com/ivanortegaalba)
- **Explore:** Fixes issue with adhoc filters when coming from dashboards. [#78339](https://github.com/grafana/grafana/issues/78339), [@torkelo](https://github.com/torkelo)
- **SaveDashboardPrompt:** Reduce time to open drawer when many changes applied. [#78283](https://github.com/grafana/grafana/issues/78283), [@ivanortegaalba](https://github.com/ivanortegaalba)
- **Elasticsearch:** Fix processing of raw_data with not-recognized time format. [#78262](https://github.com/grafana/grafana/issues/78262), [@ivanahuckova](https://github.com/ivanahuckova)
- **Alerting:** Fix deleting rules in a folder with matching UID in another organization. [#78258](https://github.com/grafana/grafana/issues/78258), [@papagian](https://github.com/papagian)
- **Bug:** Fix broken ui components when angular is disabled. [#78208](https://github.com/grafana/grafana/issues/78208), [@jackw](https://github.com/jackw)
- **Flamegraph:** Update threshold for collapsing and fix flickering. [#78206](https://github.com/grafana/grafana/issues/78206), [@aocenas](https://github.com/aocenas)
- **Prometheus:** Fix calculating rate interval when there is no interval specified. [#78193](https://github.com/grafana/grafana/issues/78193), [@itsmylife](https://github.com/itsmylife)
- **Variables:** Add support for aliasIDs to datasource variables (Fixes issue with Postgres datasource variables). [#78170](https://github.com/grafana/grafana/issues/78170), [@torkelo](https://github.com/torkelo)
- **Explore:** Fix queries (cached & non) count in usage insights. [#78097](https://github.com/grafana/grafana/issues/78097), [@Elfo404](https://github.com/Elfo404)
- **Dashboards:** Allow updating a dashboard if the user doesn't have access to the parent folder. [#78075](https://github.com/grafana/grafana/issues/78075), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Loki:** Fix escaping in cheatsheet. [#78046](https://github.com/grafana/grafana/issues/78046), [@ivanahuckova](https://github.com/ivanahuckova)
- **Transformations:** Fix Timeseries to table transformation trend reduction when result is 0. [#78026](https://github.com/grafana/grafana/issues/78026), [@oserde](https://github.com/oserde)
- **Alerting:** Fix export of notification policy to JSON. [#78021](https://github.com/grafana/grafana/issues/78021), [@rvillablanca](https://github.com/rvillablanca)
- **Dashboards:** Fix dashboard listing when user can't list any folders. [#77983](https://github.com/grafana/grafana/issues/77983), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Plugins:** Keep working when there is no internet access. [#77978](https://github.com/grafana/grafana/issues/77978), [@leventebalogh](https://github.com/leventebalogh)
- **DashList:** Update variables in links when they change. [#77787](https://github.com/grafana/grafana/issues/77787), [@joshhunt](https://github.com/joshhunt)
- **Alerting:** Disable cache in rktq when fetching export data. [#77678](https://github.com/grafana/grafana/issues/77678), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Fix export with modifications URL when mounted on subpath. [#77622](https://github.com/grafana/grafana/issues/77622), [@gillesdemey](https://github.com/gillesdemey)
- **Dashboards:** Fix issue causing crashes when saving new dashboard. [#77620](https://github.com/grafana/grafana/issues/77620), [@kaydelaney](https://github.com/kaydelaney)
- **Search:** Modify query for better performance. [#77576](https://github.com/grafana/grafana/issues/77576), [@papagian](https://github.com/papagian)
- **CloudWatch Logs:** Add labels to alert and expression queries. [#77529](https://github.com/grafana/grafana/issues/77529), [@iwysiu](https://github.com/iwysiu)
- **Explore:** Fix support for angular based datasource editors. [#77486](https://github.com/grafana/grafana/issues/77486), [@Elfo404](https://github.com/Elfo404)
- **Tempo:** Fix support for `statusMessage`. [#77438](https://github.com/grafana/grafana/issues/77438), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Plugins:** Fix status_source always being "plugin" in plugin request logs. [#77433](https://github.com/grafana/grafana/issues/77433), [@xnyo](https://github.com/xnyo)
- **Bug Fix:** Respect data source version when provisioning. [#77428](https://github.com/grafana/grafana/issues/77428), [@andresmgot](https://github.com/andresmgot)
- **Tempo:** Fix TraceQL autocompletion with missing `}`. [#77365](https://github.com/grafana/grafana/issues/77365), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **InfluxDB:** Fix parsing multiple tags on backend mode. [#77340](https://github.com/grafana/grafana/issues/77340), [@itsmylife](https://github.com/itsmylife)
- **Alerting:** Apply negative matchers for route matching. [#77292](https://github.com/grafana/grafana/issues/77292), [@gillesdemey](https://github.com/gillesdemey)
- **Explore:** Fix panes vertical scrollbar not being draggable. [#77284](https://github.com/grafana/grafana/issues/77284), [@Elfo404](https://github.com/Elfo404)
- **Explore:** Avoid reinitializing graph on every query run. [#77281](https://github.com/grafana/grafana/issues/77281), [@Elfo404](https://github.com/Elfo404)
- **Prometheus:** Fix $\_\_rate_interval calculation. [#77234](https://github.com/grafana/grafana/issues/77234), [@itsmylife](https://github.com/itsmylife)
- **Organize fields transformation:** Fix re-ordering of fields using drag and drop. [#77172](https://github.com/grafana/grafana/issues/77172), [@adela-almasan](https://github.com/adela-almasan)
- **Bug fix:** Correctly set permissions on provisioned dashboards. [#77155](https://github.com/grafana/grafana/issues/77155), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **InfluxDB:** Fix adhoc filter calls by properly checking optional parameter in metricFindQuery. [#77113](https://github.com/grafana/grafana/issues/77113), [@itsmylife](https://github.com/itsmylife)
- **Alerting:** Fix NoRulesSplash being rendered for some seconds, faster creating a rule. [#77048](https://github.com/grafana/grafana/issues/77048), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **RBAC:** Allow scoping access to root level dashboards. [#76987](https://github.com/grafana/grafana/issues/76987), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Alerting:** Dont show 1 firing series when no data in Expressions PreviewSummary. [#76981](https://github.com/grafana/grafana/issues/76981), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **InfluxDB:** Fix aliasing with $measurement or $m on backend mode. [#76917](https://github.com/grafana/grafana/issues/76917), [@itsmylife](https://github.com/itsmylife)
- **InfluxDB:** Fix table parsing with backend mode. [#76899](https://github.com/grafana/grafana/issues/76899), [@itsmylife](https://github.com/itsmylife)
- **NodeGraph:** Fix edges dataframe miscategorization. [#76842](https://github.com/grafana/grafana/issues/76842), [@lovasoa](https://github.com/lovasoa)
- **Tooltip:** Ensure tooltip text is correctly announced by screenreaders. [#76683](https://github.com/grafana/grafana/issues/76683), [@ashharrison90](https://github.com/ashharrison90)
- **Alerting:** Fix flaky SQLITE_BUSY when migrating with provisioned dashboards. [#76658](https://github.com/grafana/grafana/issues/76658), [@JacobsonMT](https://github.com/JacobsonMT)
- **TraceView:** Fix cursor not matching visual guide in the timeline when resizing. [#76587](https://github.com/grafana/grafana/issues/76587), [@neel1996](https://github.com/neel1996)
- **Search:** Fix empty folder details for nested folder items. [#76504](https://github.com/grafana/grafana/issues/76504), [@papagian](https://github.com/papagian)
- **Alerting:** Alert rule constraint violations return as 400s in provisioning API. [#76396](https://github.com/grafana/grafana/issues/76396), [@alexweav](https://github.com/alexweav)
- **A11y:** Fix no-static-element-interactions in xy chart editor. [#76170](https://github.com/grafana/grafana/issues/76170), [@chauchausoup](https://github.com/chauchausoup)
- **Alerting:** Fix incorrect decoding for alert rules with % characters. [#76148](https://github.com/grafana/grafana/issues/76148), [@gillesdemey](https://github.com/gillesdemey)
- **Chore:** Fix timeout issues when gathering prometheus datasource stats. [#74618](https://github.com/grafana/grafana/issues/74618), [@DanCech](https://github.com/DanCech)
- **Recorded Queries:** Add org isolation (remote write target per org), and fix cross org Delete/List. (Enterprise)
- **Auditing:** Fix missing action in alert manager routes. (Enterprise)
- **Reporting:** Fix report not sent when creating / updating reports. (Enterprise)
- **Recorded Queries:** Add org isolation (remote write target per org), and fix cross org Delete/List. (Enterprise)
- **UsageInsights:** Disable frontend features when backend is disabled. (Enterprise)
- **PresenceIndicators:** Do not retry failed views/recent API calls. (Enterprise)
- **Analytics:** Use panel renderer rather than legacy flot graph. (Enterprise)
- **Plugins:** Fix cloud plugins installer base url. (Enterprise)

### Breaking changes

In panels using the `extract fields` transformation, where one of the extracted names collides with one of the already existing fields, the extracted field will be renamed. Issue [#77569](https://github.com/grafana/grafana/issues/77569)

For the existing backend mode users who have table visualization might see some inconsistencies on their panels. We have updated the table column naming. This will potentially affect field transformations and/or field overrides. To resolve this either:

- Update transformation
- Update field override Issue [#76899](https://github.com/grafana/grafana/issues/76899)

For the existing backend mode users who have Transformations with the `time` field, **might** see their transformations are not working. Those panels that have broken transformations will fail to render. This is because we changed the field key. See related PR: https://github.com/grafana/grafana/pull/69865
To resolve this either:

- Remove the affected panel and re-create it
- Select the `Time` field again
- Edit the `time` field as `Time` for transformation in `panel.json` or `dashboard.json` Issue [#76641](https://github.com/grafana/grafana/issues/76641)

The following data source permission endpoints have been removed:

- `GET /datasources/:datasourceId/permissions`
- `POST /api/datasources/:datasourceId/permissions`
- `DELETE /datasources/:datasourceId/permissions`
- `POST /datasources/:datasourceId/enable-permissions`
- `POST /datasources/:datasourceId/disable-permissions`

Please use the following endpoints instead:

- `GET /api/access-control/datasources/:uid` for listing data source permissions
- `POST /api/access-control/datasources/:uid/users/:id`, `POST /api/access-control/datasources/:uid/teams/:id` and `POST /api/access-control/datasources/:uid/buildInRoles/:id` for adding or removing data source permissions

If you are using Terraform Grafana provider to manage data source permissions, you will need to upgrade your provider to [version 2.6.0](https://registry.terraform.io/providers/grafana/grafana/2.6.0/docs) or newer to ensure that data source permission provisioning keeps working.

### Deprecations

Since Grafana 10.2.3 we're deprecating the `showContextToggle` data source method. To signal support of Logs Context, it is enough to implement the `DataSourceWithLogsContextSupport` interface.

**Which issue(s) does this PR fix?**:

Fixes https://github.com/grafana/grafana/issues/66819
Related with https://github.com/grafana/grafana/issues/73568 and https://github.com/grafana/grafana/issues/73565

**Special notes for your reviewer:**

There should be no function change with this deprecation. Issue [#77232](https://github.com/grafana/grafana/issues/77232)

### Plugin development fixes & changes

- **Grafana UI:** Add description to Menu component. [#77808](https://github.com/grafana/grafana/issues/77808), [@axelavargas](https://github.com/axelavargas)

<!-- 10.2.3 END -->
<!-- 10.2.2 START -->

# 10.2.2 (2023-11-20)

### Bug fixes

- **FeatureToggle:** Disable `dashgpt` by default and mark it as preview. [#78349](https://github.com/grafana/grafana/issues/78349), [@ivanortegaalba](https://github.com/ivanortegaalba)
- **SaveDashboardPrompt:** Reduce time to open drawer when many changes applied. [#78308](https://github.com/grafana/grafana/issues/78308), [@ivanortegaalba](https://github.com/ivanortegaalba)
- **Alerting:** Fix export with modifications URL when mounted on subpath. [#78217](https://github.com/grafana/grafana/issues/78217), [@gillesdemey](https://github.com/gillesdemey)
- **Explore:** Fix queries (cached & non) count in usage insights. [#78216](https://github.com/grafana/grafana/issues/78216), [@Elfo404](https://github.com/Elfo404)
- **Plugins:** Keep working when there is no internet access. [#78092](https://github.com/grafana/grafana/issues/78092), [@leventebalogh](https://github.com/leventebalogh)

<!-- 10.2.2 END -->
<!-- 10.2.1 START -->

# 10.2.1 (2023-11-13)

### Features and enhancements

- **Stat:** Add panel option to control wide layout. [#78012](https://github.com/grafana/grafana/issues/78012), [@nmarrs](https://github.com/nmarrs)

### Bug fixes

- **Dashboards:** Fix dashboard listing when user can't list any folders. [#77988](https://github.com/grafana/grafana/issues/77988), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Search:** Modify query for better performance. [#77713](https://github.com/grafana/grafana/issues/77713), [@papagian](https://github.com/papagian)
- **Dashboards:** Fix issue causing crashes when saving new dashboard. [#77641](https://github.com/grafana/grafana/issues/77641), [@kaydelaney](https://github.com/kaydelaney)
- **RBAC:** Allow scoping access to root level dashboards. [#77608](https://github.com/grafana/grafana/issues/77608), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **CloudWatch Logs:** Add labels to alert and expression queries. [#77594](https://github.com/grafana/grafana/issues/77594), [@iwysiu](https://github.com/iwysiu)
- **Bug Fix:** Respect data source version when provisioning. [#77542](https://github.com/grafana/grafana/issues/77542), [@andresmgot](https://github.com/andresmgot)
- **Explore:** Fix support for angular based datasource editors. [#77505](https://github.com/grafana/grafana/issues/77505), [@Elfo404](https://github.com/Elfo404)
- **Plugins:** Fix status_source always being "plugin" in plugin request logs. [#77436](https://github.com/grafana/grafana/issues/77436), [@xnyo](https://github.com/xnyo)
- **InfluxDB:** Fix aliasing with $measurement or $m on backend mode. [#77383](https://github.com/grafana/grafana/issues/77383), [@itsmylife](https://github.com/itsmylife)
- **InfluxDB:** Fix parsing multiple tags on backend mode. [#77382](https://github.com/grafana/grafana/issues/77382), [@itsmylife](https://github.com/itsmylife)
- **Explore:** Fix panes vertical scrollbar not being draggable. [#77344](https://github.com/grafana/grafana/issues/77344), [@Elfo404](https://github.com/Elfo404)
- **Explore:** Avoid reinitializing graph on every query run. [#77290](https://github.com/grafana/grafana/issues/77290), [@Elfo404](https://github.com/Elfo404)
- **Bug fix:** Correctly set permissions on provisioned dashboards. [#77230](https://github.com/grafana/grafana/issues/77230), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **InfluxDB:** Fix adhoc filter calls by properly checking optional parameter in metricFindQuery. [#77145](https://github.com/grafana/grafana/issues/77145), [@itsmylife](https://github.com/itsmylife)
- **InfluxDB:** Fix table parsing with backend mode. [#76990](https://github.com/grafana/grafana/issues/76990), [@itsmylife](https://github.com/itsmylife)
- **Alerting:** Alert rule constraint violations return as 400s in provisioning API. [#76978](https://github.com/grafana/grafana/issues/76978), [@alexweav](https://github.com/alexweav)
- **PresenceIndicators:** Do not retry failed views/recent API calls. (Enterprise)
- **Analytics:** Use panel renderer rather than legacy flot graph. (Enterprise)

### Breaking changes

For the existing backend mode users who have table visualization might see some inconsistencies on their panels. We have updated the table column naming. This will potentially affect field transformations and/or field overrides. To resolve this either:

- Update transformation
- Update field override Issue [#76990](https://github.com/grafana/grafana/issues/76990)

<!-- 10.2.1 END -->
<!-- 10.2.0 START -->

# 10.2.0 (2023-10-24)

### Features and enhancements

- **Canvas:** Promote Button to beta. [#76582](https://github.com/grafana/grafana/issues/76582), [@adela-almasan](https://github.com/adela-almasan)
- **BarChart:** Improve data links UX in tooltip. [#76514](https://github.com/grafana/grafana/issues/76514), [@torkelo](https://github.com/torkelo)
- **PluginExtensions:** Make sure to pass default timeZone in context. [#76513](https://github.com/grafana/grafana/issues/76513), [@mckn](https://github.com/mckn)
- **PublicDashboards:** Enable feature by default for GA and remove public preview text. [#76484](https://github.com/grafana/grafana/issues/76484), [@juanicabanas](https://github.com/juanicabanas)
- **Grafana UI:** Add Avatar component. [#76429](https://github.com/grafana/grafana/issues/76429), [@Clarity-89](https://github.com/Clarity-89)
- **Alerting:** Add support for msteams contact point in external Alertmanagers. [#76392](https://github.com/grafana/grafana/issues/76392), [@alexweav](https://github.com/alexweav)
- **Alerting:** Enable Insights landing page. [#76381](https://github.com/grafana/grafana/issues/76381), [@VikaCep](https://github.com/VikaCep)
- **Transformations:** De-emphasize non-applicable transformations. [#76373](https://github.com/grafana/grafana/issues/76373), [@codeincarnate](https://github.com/codeincarnate)
- **Explore:** Use short units in graphs. [#76358](https://github.com/grafana/grafana/issues/76358), [@Elfo404](https://github.com/Elfo404)
- **Auth:** Enable `None` role for 10.2. [#76343](https://github.com/grafana/grafana/issues/76343), [@eleijonmarck](https://github.com/eleijonmarck)
- **Transformations:** Add context to transformation editor. [#76317](https://github.com/grafana/grafana/issues/76317), [@mdvictor](https://github.com/mdvictor)
- **Transformations:** Add support for setting timezone in Format time and Convert field type transformations. [#76316](https://github.com/grafana/grafana/issues/76316), [@codeincarnate](https://github.com/codeincarnate)
- **Playlist:** Add create+update timestamps to the database. [#76295](https://github.com/grafana/grafana/issues/76295), [@ryantxu](https://github.com/ryantxu)
- **Live:** Allow setting the engine password. [#76289](https://github.com/grafana/grafana/issues/76289), [@jcalisto](https://github.com/jcalisto)
- **Auth:** Add support for role mapping and allowed groups in Google OIDC. [#76266](https://github.com/grafana/grafana/issues/76266), [@Jguer](https://github.com/Jguer)
- **Alerting:** Add provenance field to /api/v1/provisioning/alert-rules. [#76252](https://github.com/grafana/grafana/issues/76252), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Plugins:** Add status_source label to plugin request metrics. [#76236](https://github.com/grafana/grafana/issues/76236), [@xnyo](https://github.com/xnyo)
- **PluginExtensions:** Made it possible to control modal size from extension. [#76232](https://github.com/grafana/grafana/issues/76232), [@mckn](https://github.com/mckn)
- **Loki:** Change run query button text based on number of queries. [#76196](https://github.com/grafana/grafana/issues/76196), [@ivanahuckova](https://github.com/ivanahuckova)
- **CloudWatch Logs:** Add pattern command to syntax. [#76152](https://github.com/grafana/grafana/issues/76152), [@iwysiu](https://github.com/iwysiu)
- **Caching:** Add feature toggle for memory efficient cache payload serialization. [#76145](https://github.com/grafana/grafana/issues/76145), [@mmandrus](https://github.com/mmandrus)
- **Flamegraph:** Make color by package the default color mode. [#76137](https://github.com/grafana/grafana/issues/76137), [@aocenas](https://github.com/aocenas)
- **Service Accounts:** Enable adding folder, dashboard and data source permissions to service accounts. [#76133](https://github.com/grafana/grafana/issues/76133), [@Jguer](https://github.com/Jguer)
- **SparklineCell:** Display absolute value. [#76125](https://github.com/grafana/grafana/issues/76125), [@domasx2](https://github.com/domasx2)
- **FeatureToggle:** Add awsDatasourcesNewFormStyling feature toggle. [#76110](https://github.com/grafana/grafana/issues/76110), [@idastambuk](https://github.com/idastambuk)
- **CloudWatch:** Add missing AWS/Transfer metrics. [#76079](https://github.com/grafana/grafana/issues/76079), [@jangaraj](https://github.com/jangaraj)
- **Transformations:** Add variable support to join by field. [#76056](https://github.com/grafana/grafana/issues/76056), [@oscarkilhed](https://github.com/oscarkilhed)
- **Alerting:** Add rules export on a folder level. [#76016](https://github.com/grafana/grafana/issues/76016), [@konrad147](https://github.com/konrad147)
- **PanelConfig:** Add option to calculate min/max per field instead of using the global min/max in the data frame. [#75952](https://github.com/grafana/grafana/issues/75952), [@oscarkilhed](https://github.com/oscarkilhed)
- **Transformations:** Add unary operations to Add field from calculation. [#75946](https://github.com/grafana/grafana/issues/75946), [@mdvictor](https://github.com/mdvictor)
- **Bar Gauge:** Add field name placement option. [#75932](https://github.com/grafana/grafana/issues/75932), [@nmarrs](https://github.com/nmarrs)
- **AzureMonitor:** Azure Monitor Cheat sheet. [#75931](https://github.com/grafana/grafana/issues/75931), [@alyssabull](https://github.com/alyssabull)
- **Chore:** Bump grafana-plugin-sdk-go to v0.179.0. [#75886](https://github.com/grafana/grafana/issues/75886), [@leandro-deveikis](https://github.com/leandro-deveikis)
- **Dashboards:** Add template variables to selectable options. [#75870](https://github.com/grafana/grafana/issues/75870), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Docs:** Update RBAC documentation. [#75869](https://github.com/grafana/grafana/issues/75869), [@mgyongyosi](https://github.com/mgyongyosi)
- **Alerting:** Export of contact points to HCL. [#75849](https://github.com/grafana/grafana/issues/75849), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **BrowseDashboards:** Enable new Browse Dashboards UI by default. [#75822](https://github.com/grafana/grafana/issues/75822), [@joshhunt](https://github.com/joshhunt)
- **Alerting:** Use new endpoints in the Modify Export. [#75796](https://github.com/grafana/grafana/issues/75796), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Transformations:** Rename "Transform" tab to "Transform data". [#75757](https://github.com/grafana/grafana/issues/75757), [@codeincarnate](https://github.com/codeincarnate)
- **Loki:** Support X-ray as internal link in derived fields. [#75756](https://github.com/grafana/grafana/issues/75756), [@harshabaddam](https://github.com/harshabaddam)
- **Table:** Make sparkline cell respect no value option. [#75750](https://github.com/grafana/grafana/issues/75750), [@oscarkilhed](https://github.com/oscarkilhed)
- **Transformations:** Extended support for variables in filter by name. [#75734](https://github.com/grafana/grafana/issues/75734), [@oscarkilhed](https://github.com/oscarkilhed)
- **Tempo:** TraceQL results as a spans list. [#75660](https://github.com/grafana/grafana/issues/75660), [@adrapereira](https://github.com/adrapereira)
- **Transformations:** Add naming mode to partition by value. [#75650](https://github.com/grafana/grafana/issues/75650), [@oscarkilhed](https://github.com/oscarkilhed)
- **Transformations:** Correct description of rename by regex. [#75641](https://github.com/grafana/grafana/issues/75641), [@oscarkilhed](https://github.com/oscarkilhed)
- **Team:** Support `sort` query param for teams search endpoint. [#75622](https://github.com/grafana/grafana/issues/75622), [@gamab](https://github.com/gamab)
- **CloudWatch Logs:** Make monaco query editor general availability. [#75589](https://github.com/grafana/grafana/issues/75589), [@iwysiu](https://github.com/iwysiu)
- **Explore:** Improve timeseries limit disclaimer. [#75587](https://github.com/grafana/grafana/issues/75587), [@Elfo404](https://github.com/Elfo404)
- **Stat:** Disable wide layout. [#75556](https://github.com/grafana/grafana/issues/75556), [@nmarrs](https://github.com/nmarrs)
- **DataSourceAPI:** Add adhoc filters to DataQueryRequest and make it not depend on global templateSrv. [#75552](https://github.com/grafana/grafana/issues/75552), [@torkelo](https://github.com/torkelo)
- **Playlist:** Remove unused/deprecated api and unused wrapper. [#75503](https://github.com/grafana/grafana/issues/75503), [@ryantxu](https://github.com/ryantxu)
- **Explore:** Make Explore Toolbar sticky. [#75500](https://github.com/grafana/grafana/issues/75500), [@harisrozajac](https://github.com/harisrozajac)
- **Elasticsearch:** Added support for calendar_interval in ES date histogram queries. [#75459](https://github.com/grafana/grafana/issues/75459), [@NikolayTsvetkov](https://github.com/NikolayTsvetkov)
- **Alerting:** Manage remote Alertmanager silences. [#75452](https://github.com/grafana/grafana/issues/75452), [@santihernandezc](https://github.com/santihernandezc)
- **TimeSeries:** Implement ad hoc y-zoom via Shift-drag. [#75408](https://github.com/grafana/grafana/issues/75408), [@leeoniya](https://github.com/leeoniya)
- **Cloudwatch:** Add missing AWS regions. [#75392](https://github.com/grafana/grafana/issues/75392), [@SijmenHuizenga](https://github.com/SijmenHuizenga)
- **Transformations:** Add support for dashboard variable in limit, sort by, filter by value, heatmap and histogram. [#75372](https://github.com/grafana/grafana/issues/75372), [@oscarkilhed](https://github.com/oscarkilhed)
- **GrafanaUI:** Smaller padding around Drawer's title, subtitle, and tabs. [#75354](https://github.com/grafana/grafana/issues/75354), [@polibb](https://github.com/polibb)
- **InteractiveTable:** Add controlled sort. [#75289](https://github.com/grafana/grafana/issues/75289), [@Clarity-89](https://github.com/Clarity-89)
- **Feature Toggles API:** Trigger webhook call when updating. [#75254](https://github.com/grafana/grafana/issues/75254), [@jcalisto](https://github.com/jcalisto)
- **Trace View:** Span list visual update. [#75238](https://github.com/grafana/grafana/issues/75238), [@adrapereira](https://github.com/adrapereira)
- **User:** Support `sort` query param for user and org user, search endpoints. [#75229](https://github.com/grafana/grafana/issues/75229), [@gamab](https://github.com/gamab)
- **Admin:** Use backend sort. [#75228](https://github.com/grafana/grafana/issues/75228), [@Clarity-89](https://github.com/Clarity-89)
- **Breadcrumbs:** Enable plugins to override breadcrumbs that are generated by pages defined in plugin.json. [#75218](https://github.com/grafana/grafana/issues/75218), [@torkelo](https://github.com/torkelo)
- **Cloudwatch:** Add Documentation on Temporary Credentials. [#75178](https://github.com/grafana/grafana/issues/75178), [@sarahzinger](https://github.com/sarahzinger)
- **Tracing:** Span filters reset show matches only. [#75150](https://github.com/grafana/grafana/issues/75150), [@joey-grafana](https://github.com/joey-grafana)
- **Toggle:** Enable Recorded Queries Multi support by default. [#75097](https://github.com/grafana/grafana/issues/75097), [@kylebrandt](https://github.com/kylebrandt)
- **GrafanaUI:** Support memoization of useStyles additional arguments. [#75000](https://github.com/grafana/grafana/issues/75000), [@joshhunt](https://github.com/joshhunt)
- **NodeGraph:** Allow to set node radius in dataframe. [#74963](https://github.com/grafana/grafana/issues/74963), [@piggito](https://github.com/piggito)
- **AdhocFilters:** Improve typing and signature of getTagKeys and getTagValues and behaviors. [#74962](https://github.com/grafana/grafana/issues/74962), [@torkelo](https://github.com/torkelo)
- **OpenSearch:** Add timeRange to parameters passed to getTagValues. [#74952](https://github.com/grafana/grafana/issues/74952), [@iwysiu](https://github.com/iwysiu)
- **PublicDashboards:** Refresh ds plugin supported list. [#74947](https://github.com/grafana/grafana/issues/74947), [@juanicabanas](https://github.com/juanicabanas)
- **Chore:** Update metrics for AWS/MediaConnect. [#74946](https://github.com/grafana/grafana/issues/74946), [@Deepali1211](https://github.com/Deepali1211)
- **Tempo:** Added not regex operator. [#74907](https://github.com/grafana/grafana/issues/74907), [@adrapereira](https://github.com/adrapereira)
- **MySQL:** Update configuration page styling. [#74902](https://github.com/grafana/grafana/issues/74902), [@gwdawson](https://github.com/gwdawson)
- **InteractiveTable:** Add horizontal scroll. [#74888](https://github.com/grafana/grafana/issues/74888), [@Clarity-89](https://github.com/Clarity-89)
- **SSE:** Reduce to apply Mode to instant vector (mathexp.Number). [#74859](https://github.com/grafana/grafana/issues/74859), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **CloudWatch:** Correctly add dimension values to labels. [#74847](https://github.com/grafana/grafana/issues/74847), [@iwysiu](https://github.com/iwysiu)
- **Alerting:** Add export drawer when exporting all Grafana managed alerts. [#74846](https://github.com/grafana/grafana/issues/74846), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Feature:** Allow to disable a plugin. [#74840](https://github.com/grafana/grafana/issues/74840), [@andresmgot](https://github.com/andresmgot)
- **Alerting:** Always show expression warnings and errors. [#74839](https://github.com/grafana/grafana/issues/74839), [@gillesdemey](https://github.com/gillesdemey)
- **Tempo:** Added spss config - spans per span set. [#74832](https://github.com/grafana/grafana/issues/74832), [@adrapereira](https://github.com/adrapereira)
- **Admin:** Use InteractiveTable for user and team tables. [#74821](https://github.com/grafana/grafana/issues/74821), [@Clarity-89](https://github.com/Clarity-89)
- **Canvas:** Button API Editor support template variables. [#74779](https://github.com/grafana/grafana/issues/74779), [@adela-almasan](https://github.com/adela-almasan)
- **PublicDashboards:** Title logo and footer redesign. [#74769](https://github.com/grafana/grafana/issues/74769), [@juanicabanas](https://github.com/juanicabanas)
- **Tempo:** Highlight errors in TraceQL query. [#74697](https://github.com/grafana/grafana/issues/74697), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Folders:** Do not allow modifying the folder UID via the API. [#74684](https://github.com/grafana/grafana/issues/74684), [@papagian](https://github.com/papagian)
- **Pyroscope:** Remove support for old pyroscope. [#74683](https://github.com/grafana/grafana/issues/74683), [@aocenas](https://github.com/aocenas)
- **AzureMonitor:** Improve Log Analytics query efficiency. [#74675](https://github.com/grafana/grafana/issues/74675), [@aangelisc](https://github.com/aangelisc)
- **Canvas:** Button API Editor support setting parameters. [#74637](https://github.com/grafana/grafana/issues/74637), [@adela-almasan](https://github.com/adela-almasan)
- **Alerting:** Support for single rule and multi-folder rule export. [#74625](https://github.com/grafana/grafana/issues/74625), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Loki:** Added query editor and builder support for new Logfmt features. [#74619](https://github.com/grafana/grafana/issues/74619), [@matyax](https://github.com/matyax)
- **Alerting:** Add export drawer with yaml and json formats, in policies and contact points view. [#74613](https://github.com/grafana/grafana/issues/74613), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Canvas:** Button API - Add support for GET requests. [#74566](https://github.com/grafana/grafana/issues/74566), [@adela-almasan](https://github.com/adela-almasan)
- **Explore:** Content Outline. [#74536](https://github.com/grafana/grafana/issues/74536), [@harisrozajac](https://github.com/harisrozajac)
- **Alerting:** Add Grafana-managed groups and rules export. [#74522](https://github.com/grafana/grafana/issues/74522), [@konrad147](https://github.com/konrad147)
- **Plugins:** Unset annotation editor variables. [#74519](https://github.com/grafana/grafana/issues/74519), [@oshirohugo](https://github.com/oshirohugo)
- **Internationalization:** Set lang of HTML page to user language preference. [#74513](https://github.com/grafana/grafana/issues/74513), [@ypnos](https://github.com/ypnos)
- **Chore:** Remove unused/deprecated method. [#74485](https://github.com/grafana/grafana/issues/74485), [@ryantxu](https://github.com/ryantxu)
- **Logging:** Add `WithContextualAttributes` to pass log params based on the given context. [#74428](https://github.com/grafana/grafana/issues/74428), [@svennergr](https://github.com/svennergr)
- **CloudWatch:** Add AWS/S3 replication metrics (#74416). [#74418](https://github.com/grafana/grafana/issues/74418), [@jordanefillatre](https://github.com/jordanefillatre)
- **Canvas:** New circle/ellipse element. [#74389](https://github.com/grafana/grafana/issues/74389), [@Develer](https://github.com/Develer)
- **Loki:** Add backend healthcheck. [#74330](https://github.com/grafana/grafana/issues/74330), [@svennergr](https://github.com/svennergr)
- **Transformations:** Show row index as percent in 'Add field from calculation'. [#74322](https://github.com/grafana/grafana/issues/74322), [@mdvictor](https://github.com/mdvictor)
- **Geomap:** Add Symbol Alignment Options. [#74293](https://github.com/grafana/grafana/issues/74293), [@drew08t](https://github.com/drew08t)
- **Dashboard:** Auto-generate panel title and description using AI. [#74284](https://github.com/grafana/grafana/issues/74284), [@nmarrs](https://github.com/nmarrs)
- **Alerting:** Adds additional pagination to several views. [#74268](https://github.com/grafana/grafana/issues/74268), [@gillesdemey](https://github.com/gillesdemey)
- **CloudWatch:** Add additional AWS/Firehose metrics for DynamicPartitioning support. [#74237](https://github.com/grafana/grafana/issues/74237), [@tristanburgess](https://github.com/tristanburgess)
- **Chore:** Replace entity GRN with infra/grn GRN. [#74198](https://github.com/grafana/grafana/issues/74198), [@DanCech](https://github.com/DanCech)
- **Dashboard:** Remove old panel code and leave only new panel design. [#74196](https://github.com/grafana/grafana/issues/74196), [@polibb](https://github.com/polibb)
- **Tempo:** Update default editor to TraceQL tab. [#74153](https://github.com/grafana/grafana/issues/74153), [@joey-grafana](https://github.com/joey-grafana)
- **Plugins:** Move filter back to DataSourceWithBackend. [#74147](https://github.com/grafana/grafana/issues/74147), [@ryantxu](https://github.com/ryantxu)
- **Axis:** Add separate show axis option. [#74117](https://github.com/grafana/grafana/issues/74117), [@Develer](https://github.com/Develer)
- **Alerting:** Do not show grouping when grouplabels are empty in email template. [#74090](https://github.com/grafana/grafana/issues/74090), [@gillesdemey](https://github.com/gillesdemey)
- **Currency:** Add Malaysian Ringgit (RM). [#74073](https://github.com/grafana/grafana/issues/74073), [@skangmy](https://github.com/skangmy)
- **Alerting:** Paginate silences table(s). [#74041](https://github.com/grafana/grafana/issues/74041), [@gillesdemey](https://github.com/gillesdemey)
- **Chore:** Update grafana-plugin-sdk-go version. [#74039](https://github.com/grafana/grafana/issues/74039), [@oshirohugo](https://github.com/oshirohugo)
- **Dashboards:** Add "import dashboard" to empty dashboard landing page. [#74018](https://github.com/grafana/grafana/issues/74018), [@ivanortegaalba](https://github.com/ivanortegaalba)
- **Dashlist:** Use new nested folder picker. [#74011](https://github.com/grafana/grafana/issues/74011), [@joshhunt](https://github.com/joshhunt)
- **Plugins:** Add dependency column in version table. [#73991](https://github.com/grafana/grafana/issues/73991), [@oshirohugo](https://github.com/oshirohugo)
- **Elasticsearch:** Unify default value for geo hash grid precision across the code to 3. [#73922](https://github.com/grafana/grafana/issues/73922), [@ivanahuckova](https://github.com/ivanahuckova)
- **Dashboard:** Store original JSON in DashboardModel. [#73881](https://github.com/grafana/grafana/issues/73881), [@Clarity-89](https://github.com/Clarity-89)
- **Grafana/ui:** Expose trigger method from `useForm` to children. [#73831](https://github.com/grafana/grafana/issues/73831), [@javiruiz01](https://github.com/javiruiz01)
- **RBAC:** Enable permission validation by default. [#73804](https://github.com/grafana/grafana/issues/73804), [@mgyongyosi](https://github.com/mgyongyosi)
- **Alerting:** Update provisioning to validate user-defined UID on create. [#73793](https://github.com/grafana/grafana/issues/73793), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Plugins:** Allow async panel migrations. [#73782](https://github.com/grafana/grafana/issues/73782), [@joshhunt](https://github.com/joshhunt)
- **Correlations:** Allow creating correlations for provisioned data sources. [#73737](https://github.com/grafana/grafana/issues/73737), [@ifrost](https://github.com/ifrost)
- **Alerting:** Add contact point for Grafana OnCall. [#73733](https://github.com/grafana/grafana/issues/73733), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Tempo:** Improve autocompletion and syntax highlighting for TraceQL tab. [#73707](https://github.com/grafana/grafana/issues/73707), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Auth:** Make sure that SAML responses with default namespaces are parsed correctly. [#73701](https://github.com/grafana/grafana/issues/73701), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **ArrayVector:** Add vector field value warning. [#73692](https://github.com/grafana/grafana/issues/73692), [@Develer](https://github.com/Develer)
- **Loki:** Implement `keep` and `drop` operations. [#73636](https://github.com/grafana/grafana/issues/73636), [@ivanahuckova](https://github.com/ivanahuckova)
- **Explore Logs:** Update log filtering functions to only have effect in the source query. [#73626](https://github.com/grafana/grafana/issues/73626), [@matyax](https://github.com/matyax)
- **Transforms:** Add 'Format String' Transform. [#73624](https://github.com/grafana/grafana/issues/73624), [@sjd210](https://github.com/sjd210)
- **Explore:** Improve handling time range keyboard shortcuts inside Explore. [#73600](https://github.com/grafana/grafana/issues/73600), [@ifrost](https://github.com/ifrost)
- **MSSQL:** Add support for MI authentication to MSSQL. [#73597](https://github.com/grafana/grafana/issues/73597), [@oscarkilhed](https://github.com/oscarkilhed)
- **Tracing:** Support remote, rate-limited, and probabilistic sampling in tracing.opentelemetry config section. [#73587](https://github.com/grafana/grafana/issues/73587), [@hairyhenderson](https://github.com/hairyhenderson)
- **Cloudwatch:** Upgrade grafana-aws-sdk. [#73580](https://github.com/grafana/grafana/issues/73580), [@sarahzinger](https://github.com/sarahzinger)
- **Pyroscope:** Template variable support. [#73572](https://github.com/grafana/grafana/issues/73572), [@aocenas](https://github.com/aocenas)
- **CloudWatch:** Add missing region Middle East (UAE) me-central-1. [#73560](https://github.com/grafana/grafana/issues/73560), [@gelldur](https://github.com/gelldur)
- **Feat:** Feature toggle admin page frontend write UI and InteractiveTable sorting. [#73533](https://github.com/grafana/grafana/issues/73533), [@IbrahimCSAE](https://github.com/IbrahimCSAE)
- **Cloudwatch:** Add back support for old Log Group picker. [#73524](https://github.com/grafana/grafana/issues/73524), [@sarahzinger](https://github.com/sarahzinger)
- **Google Cloud Monitor:** Prom query editor. [#73503](https://github.com/grafana/grafana/issues/73503), [@bossinc](https://github.com/bossinc)
- **Plugins:** Remove deprecated grafana-toolkit. [#73489](https://github.com/grafana/grafana/issues/73489), [@Ukochka](https://github.com/Ukochka)
- **LibraryPanels:** Add RBAC support. [#73475](https://github.com/grafana/grafana/issues/73475), [@kaydelaney](https://github.com/kaydelaney)
- **Chore:** Remove DashboardPickerByID. [#73466](https://github.com/grafana/grafana/issues/73466), [@Clarity-89](https://github.com/Clarity-89)
- **Elastic:** Add `id` field to Elastic responses to allow permalinking. [#73382](https://github.com/grafana/grafana/issues/73382), [@svennergr](https://github.com/svennergr)
- **Correlations:** Add an editor in Explore. [#73315](https://github.com/grafana/grafana/issues/73315), [@gelicia](https://github.com/gelicia)
- **Tempo:** Replace template variables in TraceQL tab when streaming is enabled. [#73259](https://github.com/grafana/grafana/issues/73259), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **CloudWatch Logs:** Wrap sync error from executeGetQueryResults. [#73252](https://github.com/grafana/grafana/issues/73252), [@iwysiu](https://github.com/iwysiu)
- **Elasticsearch:** Enable running of queries trough data source backend. [#73222](https://github.com/grafana/grafana/issues/73222), [@ivanahuckova](https://github.com/ivanahuckova)
- **Tempo:** Metrics summary. [#73201](https://github.com/grafana/grafana/issues/73201), [@joey-grafana](https://github.com/joey-grafana)
- **Alerting:** Export of alert rules in HCL format. [#73166](https://github.com/grafana/grafana/issues/73166), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **SSE:** Localize/Contain Errors within an Expression. [#73163](https://github.com/grafana/grafana/issues/73163), [@kylebrandt](https://github.com/kylebrandt)
- **Dashboards:** PanelChrome - remove untitled placeholder and add border when panel is transparent. [#73150](https://github.com/grafana/grafana/issues/73150), [@axelavargas](https://github.com/axelavargas)
- **CloudWatch:** Add missing AppFlow metrics. [#73149](https://github.com/grafana/grafana/issues/73149), [@ciancullinan](https://github.com/ciancullinan)
- **Flamegraph:** Move to package. [#73113](https://github.com/grafana/grafana/issues/73113), [@aocenas](https://github.com/aocenas)
- **Plugins:** Forward feature toggles to plugins. [#72995](https://github.com/grafana/grafana/issues/72995), [@oshirohugo](https://github.com/oshirohugo)
- **SSE:** Group data source node execution by data source. [#72935](https://github.com/grafana/grafana/issues/72935), [@kylebrandt](https://github.com/kylebrandt)
- **Dashboard:** Support template variables in Search tab for Tempo. [#72867](https://github.com/grafana/grafana/issues/72867), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Cloudwatch:** Upgrade aws-sdk and display external ids for temporary credentials. [#72821](https://github.com/grafana/grafana/issues/72821), [@sarahzinger](https://github.com/sarahzinger)
- **Dashboards:** Add megawatt hour (MWh) unit. [#72779](https://github.com/grafana/grafana/issues/72779), [@zuchka](https://github.com/zuchka)
- **Dashboard:** Add support for Tempo query variables. [#72745](https://github.com/grafana/grafana/issues/72745), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Auth:** Add key_id config param to auth.jwt. [#72711](https://github.com/grafana/grafana/issues/72711), [@mgyongyosi](https://github.com/mgyongyosi)
- **Alerting:** Move legacy alert migration from sqlstore migration to service. [#72702](https://github.com/grafana/grafana/issues/72702), [@JacobsonMT](https://github.com/JacobsonMT)
- **Loki:** Introduce `$__auto` range variable for metric queries. [#72690](https://github.com/grafana/grafana/issues/72690), [@ivanahuckova](https://github.com/ivanahuckova)
- **GLDS:** Move Text component from the `unstable` package to `grafana-ui`. [#72660](https://github.com/grafana/grafana/issues/72660), [@eledobleefe](https://github.com/eledobleefe)
- **Datasource Plugins:** Allow tracking for configuration usage. [#72650](https://github.com/grafana/grafana/issues/72650), [@sarahzinger](https://github.com/sarahzinger)
- **Cloudwatch Logs:** Set Alerting timeout to datasource config's logsTimeout (#72611). [#72611](https://github.com/grafana/grafana/issues/72611), [@idastambuk](https://github.com/idastambuk)
- **Flamegraph:** Add nice empty state for dashboard panel. [#72583](https://github.com/grafana/grafana/issues/72583), [@aocenas](https://github.com/aocenas)
- **Explore:** Unified Node Graph Container. [#72558](https://github.com/grafana/grafana/issues/72558), [@harisrozajac](https://github.com/harisrozajac)
- **Tracing:** Split name column in search results. [#72449](https://github.com/grafana/grafana/issues/72449), [@joey-grafana](https://github.com/joey-grafana)
- **Tracing:** Trace to metrics default range. [#72433](https://github.com/grafana/grafana/issues/72433), [@joey-grafana](https://github.com/joey-grafana)
- **Email:** Light theme email templates. [#72398](https://github.com/grafana/grafana/issues/72398), [@gillesdemey](https://github.com/gillesdemey)
- **Correlations:** Add organization id. [#72258](https://github.com/grafana/grafana/issues/72258), [@ifrost](https://github.com/ifrost)
- **Feat:** Feature toggle admin page frontend interface. [#72164](https://github.com/grafana/grafana/issues/72164), [@IbrahimCSAE](https://github.com/IbrahimCSAE)
- **Alerting:** Show annotations markers in TimeSeries panel when using Loki as …. [#72084](https://github.com/grafana/grafana/issues/72084), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Custom contact point for OnCall in Grafana AM. [#72021](https://github.com/grafana/grafana/issues/72021), [@konrad147](https://github.com/konrad147)
- **Frontend:** Allows PanelChrome to be collapsed. [#71991](https://github.com/grafana/grafana/issues/71991), [@harisrozajac](https://github.com/harisrozajac)
- **Elasticsearch:** Implement modify query using a Lucene parser. [#71954](https://github.com/grafana/grafana/issues/71954), [@matyax](https://github.com/matyax)
- **Table:** Support display of multiple sub tables. [#71953](https://github.com/grafana/grafana/issues/71953), [@joey-grafana](https://github.com/joey-grafana)
- **A11y:** Make Annotations and Template Variables list and edit pages responsive . [#71791](https://github.com/grafana/grafana/issues/71791), [@juanicabanas](https://github.com/juanicabanas)
- **Dashboard:** Select the last used data source by default when adding a panel to a dashboard. [#71777](https://github.com/grafana/grafana/issues/71777), [@axelavargas](https://github.com/axelavargas)
- **Trace to logs:** Add service name and namespace to default tags. [#71776](https://github.com/grafana/grafana/issues/71776), [@connorlindsey](https://github.com/connorlindsey)
- **Alerting:** Add new metrics and tracings to state manager and scheduler. [#71398](https://github.com/grafana/grafana/issues/71398), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Add configuration options to migrate to an external Alertmanager. [#71318](https://github.com/grafana/grafana/issues/71318), [@santihernandezc](https://github.com/santihernandezc)
- **Annotations:** Improve updating annotation tags queries. [#71201](https://github.com/grafana/grafana/issues/71201), [@sakjur](https://github.com/sakjur)
- **SSE:** Support hysteresis threshold expression. [#70998](https://github.com/grafana/grafana/issues/70998), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Dashboards:** Add alert and panel icon for dashboards that use Angular plugins. [#70951](https://github.com/grafana/grafana/issues/70951), [@xnyo](https://github.com/xnyo)
- **Chore:** Update ubuntu image to 22.04. [#70719](https://github.com/grafana/grafana/issues/70719), [@orgads](https://github.com/orgads)
- **Auth:** Add support for OIDC RP-Initiated Logout. [#70357](https://github.com/grafana/grafana/issues/70357), [@venkatbvc](https://github.com/venkatbvc)
- **Dashboard:** Field Config - Add CFP franc currency (XPF). [#70036](https://github.com/grafana/grafana/issues/70036), [@smortex](https://github.com/smortex)
- **Auth:** Check id token expiry date. [#69829](https://github.com/grafana/grafana/issues/69829), [@akselleirv](https://github.com/akselleirv)
- **Alerting:** Update Discord settings to treat 'url' as a secure setting. [#69588](https://github.com/grafana/grafana/issues/69588), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Prometheus:** Add $\_\_rate_interval_ms to go along with $\_\_interval_ms. [#69582](https://github.com/grafana/grafana/issues/69582), [@ywwg](https://github.com/ywwg)
- **Alerting:** Update state manager to change all current states in the case when Error\NoData is executed as Ok\Nomal. [#68142](https://github.com/grafana/grafana/issues/68142), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Tempo:** Integrate context aware autocomplete API. [#67845](https://github.com/grafana/grafana/issues/67845), [@adrapereira](https://github.com/adrapereira)
- **GrafanaUI:** Add aria-label prop to RadioButtonGroup. [#67019](https://github.com/grafana/grafana/issues/67019), [@khushijain21](https://github.com/khushijain21)
- **Search API:** Search by folder UID. [#65040](https://github.com/grafana/grafana/issues/65040), [@joshhunt](https://github.com/joshhunt)
- **Alerting:** Migrate old alerting templates to Go templates. [#62911](https://github.com/grafana/grafana/issues/62911), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **TeamGroupSync:** Delete group sync entries on team delete. (Enterprise)
- **ServiceAccounts:** Add SAs to managed permissions. (Enterprise)
- **PublicDashboards:** Title logo config. (Enterprise)
- **Caching:** Make cache payload serialization more resistant to out-of-memory crashes. (Enterprise)
- **Caching:** Change error logs for cache items not found to debug logs. (Enterprise)
- **Chore:** Add test console.warn catch. (Enterprise)
- **Emails:** Light theme. (Enterprise)
- **Reporting:** Switch to using dashboard UID. (Enterprise)
- **Recorded Queries:** Use new DS picker. (Enterprise)
- **Reporting:** Add ability to retry failed rendering requests (public preview). (Enterprise)

### Bug fixes

- **Snapshots:** Fix breakage of some panel types due to missing structureRev. [#76586](https://github.com/grafana/grafana/issues/76586), [@leeoniya](https://github.com/leeoniya)
- **Loki:** Fix Autocomplete in stream selector overwriting existing label names, or inserting autocomplete result within label value. [#76485](https://github.com/grafana/grafana/issues/76485), [@gtk-grafana](https://github.com/gtk-grafana)
- **Alerting:** Prevent cleanup of non-empty folders on migration revert. [#76439](https://github.com/grafana/grafana/issues/76439), [@JacobsonMT](https://github.com/JacobsonMT)
- **Flamegraph:** Fix inefficient regex generating error on some function names. [#76377](https://github.com/grafana/grafana/issues/76377), [@aocenas](https://github.com/aocenas)
- **Authn:** Prevent empty username and email during sync. [#76330](https://github.com/grafana/grafana/issues/76330), [@kalleep](https://github.com/kalleep)
- **RBAC:** Fix plugins pages access-control. [#76321](https://github.com/grafana/grafana/issues/76321), [@gamab](https://github.com/gamab)
- **Tabs:** Fixes focus style. [#76246](https://github.com/grafana/grafana/issues/76246), [@torkelo](https://github.com/torkelo)
- **Rendering:** Fix Windows plugin signature check. [#76123](https://github.com/grafana/grafana/issues/76123), [@AgnesToulet](https://github.com/AgnesToulet)
- **Dashboards:** It always detect changes when saving an existing dashboard . [#76116](https://github.com/grafana/grafana/issues/76116), [@ivanortegaalba](https://github.com/ivanortegaalba)
- **Flamegraph:** Fix theme propagation. [#76064](https://github.com/grafana/grafana/issues/76064), [@aocenas](https://github.com/aocenas)
- **Pyroscope:** Fix backend panic when querying out of bounds. [#76053](https://github.com/grafana/grafana/issues/76053), [@aocenas](https://github.com/aocenas)
- **DataSourcePicker:** Disable autocomplete for the search input . [#75898](https://github.com/grafana/grafana/issues/75898), [@ivanortegaalba](https://github.com/ivanortegaalba)
- **Loki:** Cache extracted labels. [#75842](https://github.com/grafana/grafana/issues/75842), [@gtk-grafana](https://github.com/gtk-grafana)
- **Tempo:** Fix service graph menu item links. [#75748](https://github.com/grafana/grafana/issues/75748), [@adrapereira](https://github.com/adrapereira)
- **Flamegraph:** Fix bug where package colors would be altered after focusin on a node. [#75695](https://github.com/grafana/grafana/issues/75695), [@aocenas](https://github.com/aocenas)
- **Legend:** Fix desc sort so NaNs are not display first. [#75685](https://github.com/grafana/grafana/issues/75685), [@nmarrs](https://github.com/nmarrs)
- **Transformations:** Fix bug with calculate field when using reduce and the all values calculation. [#75684](https://github.com/grafana/grafana/issues/75684), [@oscarkilhed](https://github.com/oscarkilhed)
- **Plugins:** Fix sorting issue with expandable rows. [#75553](https://github.com/grafana/grafana/issues/75553), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Alerting:** Show panels within collapsed rows in dashboard picker. [#75490](https://github.com/grafana/grafana/issues/75490), [@VikaCep](https://github.com/VikaCep)
- **Tempo:** Use timezone of selected range for timestamps. [#75438](https://github.com/grafana/grafana/issues/75438), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Flamegraph:** Fix css issues when embedded outside of Grafana. [#75369](https://github.com/grafana/grafana/issues/75369), [@aocenas](https://github.com/aocenas)
- **Alerting:** Make shareable alert rule link work if rule name contains forward slashes. [#75362](https://github.com/grafana/grafana/issues/75362), [@domasx2](https://github.com/domasx2)
- **SQLStore:** Fix race condition in RecursiveQueriesAreSupported. [#75274](https://github.com/grafana/grafana/issues/75274), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Connections:** Make the "Add new Connection" page work without internet access. [#75272](https://github.com/grafana/grafana/issues/75272), [@leventebalogh](https://github.com/leventebalogh)
- **TimeSeries:** Apply selected line style to custom pathBuilders. [#75261](https://github.com/grafana/grafana/issues/75261), [@leeoniya](https://github.com/leeoniya)
- **Alerting:** Fix non-applicable error checks for cloud and recording rules. [#75233](https://github.com/grafana/grafana/issues/75233), [@gillesdemey](https://github.com/gillesdemey)
- **TabsBar:** Fix height so that it aligns with grid, and alignItems center . [#75230](https://github.com/grafana/grafana/issues/75230), [@torkelo](https://github.com/torkelo)
- **Prometheus:** Fix creation of invalid dataframes with exemplars. [#75187](https://github.com/grafana/grafana/issues/75187), [@kylebrandt](https://github.com/kylebrandt)
- **Loki:** Fix filters not being added with multiple expressions and parsers. [#75152](https://github.com/grafana/grafana/issues/75152), [@svennergr](https://github.com/svennergr)
- **Pyroscope:** Fix error when no profile types are returned. [#75143](https://github.com/grafana/grafana/issues/75143), [@aocenas](https://github.com/aocenas)
- **BarChart:** Axes centered zero, borders, and colors. [#75136](https://github.com/grafana/grafana/issues/75136), [@leeoniya](https://github.com/leeoniya)
- **Plugins:** Refresh plugin info after installation. [#75074](https://github.com/grafana/grafana/issues/75074), [@oshirohugo](https://github.com/oshirohugo)
- **LDAP:** FIX Enable users on successful login . [#75073](https://github.com/grafana/grafana/issues/75073), [@gamab](https://github.com/gamab)
- **XYChart:** Fix numerous axis options. [#75044](https://github.com/grafana/grafana/issues/75044), [@leeoniya](https://github.com/leeoniya)
- **Trace View:** Remove "deployment.environment" default traces 2 logs tag. [#74986](https://github.com/grafana/grafana/issues/74986), [@domasx2](https://github.com/domasx2)
- **Snapshots:** Use appUrl on snapshot list page. [#74944](https://github.com/grafana/grafana/issues/74944), [@evictorero](https://github.com/evictorero)
- **Canvas:** Fix inconsistent element placement when changing element type. [#74942](https://github.com/grafana/grafana/issues/74942), [@linghaoSu](https://github.com/linghaoSu)
- **Connections:** Display the type of the datasource. [#74808](https://github.com/grafana/grafana/issues/74808), [@leventebalogh](https://github.com/leventebalogh)
- **Alerting:** Indicate panels without identifier. [#74746](https://github.com/grafana/grafana/issues/74746), [@gillesdemey](https://github.com/gillesdemey)
- **Notifications:** Don't show toasts after refreshing. [#74712](https://github.com/grafana/grafana/issues/74712), [@joshhunt](https://github.com/joshhunt)
- **Alerting:** Fix default policy timing summary. [#74549](https://github.com/grafana/grafana/issues/74549), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Handle custom dashboard permissions in migration service. [#74504](https://github.com/grafana/grafana/issues/74504), [@JacobsonMT](https://github.com/JacobsonMT)
- **CloudWatch Logs:** Fix log query display name when used with expressions. [#74497](https://github.com/grafana/grafana/issues/74497), [@iwysiu](https://github.com/iwysiu)
- **Dashboards:** Escape tags. [#74437](https://github.com/grafana/grafana/issues/74437), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Cloudwatch:** Fix Unexpected error. [#74420](https://github.com/grafana/grafana/issues/74420), [@sarahzinger](https://github.com/sarahzinger)
- **Transformations:** Fix group by field transformation field name text-overflow. [#74173](https://github.com/grafana/grafana/issues/74173), [@oscarkilhed](https://github.com/oscarkilhed)
- **LDAP:** Disable removed users on login. [#74016](https://github.com/grafana/grafana/issues/74016), [@gamab](https://github.com/gamab)
- **Time Range:** Using relative time takes timezone into account. [#74013](https://github.com/grafana/grafana/issues/74013), [@ashharrison90](https://github.com/ashharrison90)
- **Loki:** Fix filtering with structured metadata. [#73955](https://github.com/grafana/grafana/issues/73955), [@svennergr](https://github.com/svennergr)
- **Dashboard embed:** Use port instead of callbackUrl. [#73883](https://github.com/grafana/grafana/issues/73883), [@Clarity-89](https://github.com/Clarity-89)
- **Alerting:** Fix data source copy when switching alert rule types. [#73854](https://github.com/grafana/grafana/issues/73854), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Fix delete cloud rule from detail page. [#73850](https://github.com/grafana/grafana/issues/73850), [@gillesdemey](https://github.com/gillesdemey)
- **LDAP:** Fix active sync with large quantities of users. [#73834](https://github.com/grafana/grafana/issues/73834), [@gamab](https://github.com/gamab)
- **PublicDashboards:** Data discrepancy fix. Use real datasource plugin when it is a public dashboard. . [#73708](https://github.com/grafana/grafana/issues/73708), [@juanicabanas](https://github.com/juanicabanas)
- **A11y:** Fix exemplar marker accessibility. [#73493](https://github.com/grafana/grafana/issues/73493), [@Develer](https://github.com/Develer)
- **A11y:** Fix resource picker accessibility. [#73488](https://github.com/grafana/grafana/issues/73488), [@Develer](https://github.com/Develer)
- **A11y:** Fix resource cards accessibility. [#73487](https://github.com/grafana/grafana/issues/73487), [@Develer](https://github.com/Develer)
- **Template Variables:** Fix conversion from non standard data to dataFrame. [#73486](https://github.com/grafana/grafana/issues/73486), [@aocenas](https://github.com/aocenas)
- **A11y:** Fix canvas element accessibility. [#73483](https://github.com/grafana/grafana/issues/73483), [@Develer](https://github.com/Develer)
- **Tempo:** Fix [object Object] shown as an Event message in Trace view. [#73473](https://github.com/grafana/grafana/issues/73473), [@aocenas](https://github.com/aocenas)
- **A11y:** Fix canvas setting button accessibility. [#73413](https://github.com/grafana/grafana/issues/73413), [@Develer](https://github.com/Develer)
- **PublicDashboards:** Query order bug fixed. [#73293](https://github.com/grafana/grafana/issues/73293), [@juanicabanas](https://github.com/juanicabanas)
- **DatePicker:** Fix calendar not showing correct selected range when changing time zones. [#73273](https://github.com/grafana/grafana/issues/73273), [@ashharrison90](https://github.com/ashharrison90)
- **Cloud Monitoring:** Support AliasBy property in MQL mode. [#73116](https://github.com/grafana/grafana/issues/73116), [@alyssabull](https://github.com/alyssabull)
- **Alerting:** Fix cloud rules editing. [#72927](https://github.com/grafana/grafana/issues/72927), [@konrad147](https://github.com/konrad147)
- **Dashboard:** Fixes dashboard setting Links overflow. [#72428](https://github.com/grafana/grafana/issues/72428), [@chauchausoup](https://github.com/chauchausoup)
- **A11y:** Fix toggletip predictable focus for keyboard users. [#72100](https://github.com/grafana/grafana/issues/72100), [@ckbedwell](https://github.com/ckbedwell)
- **Gauge:** Add overflow scrolling support for vertical and horizontal orientations. [#71690](https://github.com/grafana/grafana/issues/71690), [@nmarrs](https://github.com/nmarrs)
- **Export:** Remove DS input when dashboard is imported with a lib panel that already exists. [#69412](https://github.com/grafana/grafana/issues/69412), [@juanicabanas](https://github.com/juanicabanas)
- **Auditing and UsageInsights:** FIX Loki configuration to use proxy env variables. (Enterprise)
- **PDF:** Fix parenthesis in dashboard title. (Enterprise)
- **Reporting:** Handle commas in variables. (Enterprise)
- **Caching:** Fix caching metrics being doubled. (Enterprise)

### Breaking changes

The deprecated `/playlists/{uid}/dashboards` API endpoint has been removed. Dashboard information can be retrieved from the `/dashboard/...` APIs. Issue [#75503](https://github.com/grafana/grafana/issues/75503)

The `PUT /api/folders/:uid` endpoint no more supports modifying the folder's `UID`. Issue [#74684](https://github.com/grafana/grafana/issues/74684)

This is a breaking change as we're removing support for `Intersection` (although it is replaced with an option that is nearly the same). Issue [#74675](https://github.com/grafana/grafana/issues/74675)

<Breaking change description>
Removed all components for the old panel header design. Issue [#74196](https://github.com/grafana/grafana/issues/74196)

### Deprecations

Correlations created before 10.1.0 do not have an organization id assigned and are treated as global. In some rare cases, it may lead to confusing behavior described in #72259. Organization id is now added when a correlation is created. Any existing correlations without organization id will be kept intact and work as before for backward compatibility during the deprecation period that is set to 6 months after handling organization id is released. After that time, correlations without org_id (or org_id = 0 in the database) will stop showing up in Grafana.

To migrate existing correlations to handle organization id correctly:

- re-provision any correlations that were created as part of provisioning
- re-create any correlations created with Admin/Correlations page Issue [#72258](https://github.com/grafana/grafana/issues/72258)

Starting with 10.2, `parentRowIndex` is deprecated. It will be removed in a future release. From 10.2, sub-tables are supported by adding `FieldType.nestedFrames` to the field that contains the nested data in your dataframe. Issue [#71953](https://github.com/grafana/grafana/issues/71953)

### Plugin development fixes & changes

- **Toggletip:** Add support to programmatically close it. [#75846](https://github.com/grafana/grafana/issues/75846), [@adela-almasan](https://github.com/adela-almasan)
- **Drawer:** Make content scroll by default. [#75287](https://github.com/grafana/grafana/issues/75287), [@ashharrison90](https://github.com/ashharrison90)

<!-- 10.2.0 END -->
<!-- 10.1.10 START -->

# 10.1.10 (2024-05-13)

### Features and enhancements

- **Chore:** Upgrade go to 1.21.10. [#87476](https://github.com/grafana/grafana/issues/87476), [@stephaniehingtgen](https://github.com/stephaniehingtgen)
- **Chore:** Upgrade go to 1.21.10. (Enterprise)

<!-- 10.1.10 END -->
<!-- 10.1.9 START -->

# 10.1.9 (2024-03-25)

### Bug fixes

- **Snapshots:** Require delete within same org (backport). [#84765](https://github.com/grafana/grafana/issues/84765), [@ryantxu](https://github.com/ryantxu)

<!-- 10.1.9 END -->
<!-- 10.1.8 START -->

# 10.1.8 (2024-03-06)

### Bug fixes

- **Auth:** Fix email verification bypass when using basic authentication. [#83492](https://github.com/grafana/grafana/issues/83492)

<!-- 10.1.8 END -->
<!-- 10.1.7 START -->

# 10.1.7 (2024-01-29)

### Bug fixes

- **Annotations:** Split cleanup into separate queries and deletes to avoid deadlocks on MySQL. [#80678](https://github.com/grafana/grafana/issues/80678), [@alexweav](https://github.com/alexweav)

<!-- 10.1.7 END -->
<!-- 10.1.6 START -->

# 10.1.6 (2023-12-18)

### Features and enhancements

- **Alerting:** Attempt to retry retryable errors. [#79211](https://github.com/grafana/grafana/issues/79211), [@gotjosh](https://github.com/gotjosh)
- **Unified Alerting:** Set `max_attempts` to 1 by default. [#79102](https://github.com/grafana/grafana/issues/79102), [@gotjosh](https://github.com/gotjosh)

### Bug fixes

- **Alerting:** Fix deleting rules in a folder with matching UID in another organization. [#79007](https://github.com/grafana/grafana/issues/79007), [@papagian](https://github.com/papagian)
- **Chore:** Fix timeout issues when gathering prometheus datasource stats. [#78858](https://github.com/grafana/grafana/issues/78858), [@DanCech](https://github.com/DanCech)
- **Provisioning:** Ensure that enterprise provisioning runs [10.1.x]. [#76686](https://github.com/grafana/grafana/issues/76686), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Alerting:** Make shareable alert rule link work if rule name contains forward slashes. [#75950](https://github.com/grafana/grafana/issues/75950), [@domasx2](https://github.com/domasx2)
- **Loki:** Cache extracted labels. [#75905](https://github.com/grafana/grafana/issues/75905), [@gtk-grafana](https://github.com/gtk-grafana)
- **DataSourcePicker:** Disable autocomplete for the search input . [#75900](https://github.com/grafana/grafana/issues/75900), [@ivanortegaalba](https://github.com/ivanortegaalba)
- **Plugins:** Refresh plugin info after installation. [#75225](https://github.com/grafana/grafana/issues/75225), [@oshirohugo](https://github.com/oshirohugo)
- **LDAP:** FIX Enable users on successful login . [#75176](https://github.com/grafana/grafana/issues/75176), [@gamab](https://github.com/gamab)
- **Loki:** Fix filters not being added with multiple expressions and parsers. [#75172](https://github.com/grafana/grafana/issues/75172), [@svennergr](https://github.com/svennergr)
- **Recorded Queries:** Add org isolation (remote write target per org), and fix cross org Delete/List. (Enterprise)
- **Auditing and UsageInsights:** FIX Loki configuration to use proxy env variables. (Enterprise)

<!-- 10.1.6 END -->
<!-- 10.1.5 START -->

# 10.1.5 (2023-10-11)

### Features and enhancements

- **Chore:** Upgrade Go to 1.20.10. [#76355](https://github.com/grafana/grafana/issues/76355), [@zerok](https://github.com/zerok)
- **Cloudwatch:** Backport 73524 Bring Back Legacy Log Group Picker. [#75031](https://github.com/grafana/grafana/issues/75031), [@sarahzinger](https://github.com/sarahzinger)

### Bug fixes

- **Cloudwatch:** Prevent log group requests with ARNs if feature flag is off. [#75691](https://github.com/grafana/grafana/issues/75691), [@sarahzinger](https://github.com/sarahzinger)
- **Alerting:** Add support for `keep_firing_for` field from external rulers. [#75257](https://github.com/grafana/grafana/issues/75257), [@rwwiv](https://github.com/rwwiv)
- **Canvas:** Avoid conflicting stylesheets when loading SVG icons. [#75032](https://github.com/grafana/grafana/issues/75032), [@adela-almasan](https://github.com/adela-almasan)
- **Alerting:** Prevent showing "Permissions denied" alert when not accurate. [#74925](https://github.com/grafana/grafana/issues/74925), [@VikaCep](https://github.com/VikaCep)
- **BrowseDashboards:** Only remember the most recent expanded folder. [#74809](https://github.com/grafana/grafana/issues/74809), [@joshhunt](https://github.com/joshhunt)
- **Tempo Service Map:** Fix context menu links in service map when namespace is present. [#74796](https://github.com/grafana/grafana/issues/74796), [@javiruiz01](https://github.com/javiruiz01)
- **Logs Panel:** Performance issue while scrolling within panel in safari. [#74747](https://github.com/grafana/grafana/issues/74747), [@gtk-grafana](https://github.com/gtk-grafana)
- **Bug:** Allow to uninstall a deprecated plugin. [#74704](https://github.com/grafana/grafana/issues/74704), [@andresmgot](https://github.com/andresmgot)
- **Licensing:** Pass func to update env variables when starting plugin. [#74678](https://github.com/grafana/grafana/issues/74678), [@leandro-deveikis](https://github.com/leandro-deveikis)
- **Nested folders:** Fix folder hierarchy in folder responses. [#74580](https://github.com/grafana/grafana/issues/74580), [@papagian](https://github.com/papagian)
- **Share link:** Use panel relative time for direct link rendered image. [#74518](https://github.com/grafana/grafana/issues/74518), [@Clarity-89](https://github.com/Clarity-89)
- **Alerting:** Do not exit if Redis ping fails when using redis-based Alertmanager clustering. [#74399](https://github.com/grafana/grafana/issues/74399), [@alexweav](https://github.com/alexweav)
- **Alerting:** Refactor AlertRuleForm and fix annotations step description for cloud rules. [#74193](https://github.com/grafana/grafana/issues/74193), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **RBAC:** Chore fix hasPermissionInOrg. (Enterprise)
- **Licensing:** Updated grpc plugin factory newPlugin signature. (Enterprise)
- **Reporting:** Add support for old dashboard schema. (Enterprise)

<!-- 10.1.5 END -->
<!-- 10.1.4 START -->

# 10.1.4 (2023-09-29)

### Features and enhancements

- **Azure:** Add support for Workload Identity authentication. [#75733](https://github.com/grafana/grafana/issues/75733), [@aangelisc](https://github.com/aangelisc)

<!-- 10.1.4 END -->
<!-- 10.1.2 START -->

# 10.1.2 (2023-09-18)

### Features and enhancements

- **Chore:** Upgrade Alpine base image to 3.18.3. [#74993](https://github.com/grafana/grafana/issues/74993), [@zerok](https://github.com/zerok)
- **Chore:** Upgrade Go to 1.20.8. [#74980](https://github.com/grafana/grafana/issues/74980), [@zerok](https://github.com/zerok)

<!-- 10.1.2 END -->
<!-- 10.1.1 START -->

# 10.1.1 (2023-08-29)

### Features and enhancements

- **Loki:** Remove `distinct` operation. [#74003](https://github.com/grafana/grafana/issues/74003), [@svennergr](https://github.com/svennergr)
- **Whitelabeling:** Add a config option to hide the Grafana edition from the footer. [#73491](https://github.com/grafana/grafana/issues/73491), [@JoaoSilvaGrafana](https://github.com/JoaoSilvaGrafana)
- **Alerting:** Optimize rule details page data fetching. [#73139](https://github.com/grafana/grafana/issues/73139), [@konrad147](https://github.com/konrad147)
- **Alerting:** Optimize external Loki queries. [#73050](https://github.com/grafana/grafana/issues/73050), [@JohnnyQQQQ](https://github.com/JohnnyQQQQ)

### Bug fixes

- **Alerting:** Limit redis pool size to 5 and make configurable. [#74059](https://github.com/grafana/grafana/issues/74059), [@alexweav](https://github.com/alexweav)
- **Elasticsearch:** Fix respecting of precision in geo hash grid. [#73933](https://github.com/grafana/grafana/issues/73933), [@ivanahuckova](https://github.com/ivanahuckova)
- **Dashboard:** Fix Variable Dropdown to Enforce Minimum One Selection when 'All' Option is Configured. [#73927](https://github.com/grafana/grafana/issues/73927), [@axelavargas](https://github.com/axelavargas)
- **Chore:** Fix Random Walk scenario for Grafana DS. [#73894](https://github.com/grafana/grafana/issues/73894), [@andresmgot](https://github.com/andresmgot)
- **AuthProxy:** Fix user retrieval through cache. [#73824](https://github.com/grafana/grafana/issues/73824), [@kalleep](https://github.com/kalleep)
- **Alerting:** Fix auto-completion snippets for KV properties. [#73741](https://github.com/grafana/grafana/issues/73741), [@jvmdc](https://github.com/jvmdc)
- **Alerting:** Fix incorrect timing meta information for policy. [#73695](https://github.com/grafana/grafana/issues/73695), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Add new Recording Rule button when the list is empty. [#73638](https://github.com/grafana/grafana/issues/73638), [@VikaCep](https://github.com/VikaCep)
- **Drawer:** Clicking a `Select` arrow within a `Drawer` no longer causes it to close. [#73634](https://github.com/grafana/grafana/issues/73634), [@ashharrison90](https://github.com/ashharrison90)
- **Logs:** Fix log samples not present with empty first frame. [#73622](https://github.com/grafana/grafana/issues/73622), [@svennergr](https://github.com/svennergr)
- **Alerting:** Fix Recording Rule QueryEditor builder view. [#73621](https://github.com/grafana/grafana/issues/73621), [@VikaCep](https://github.com/VikaCep)
- **Transforms:** Catch errors while running transforms. [#73527](https://github.com/grafana/grafana/issues/73527), [@ryantxu](https://github.com/ryantxu)
- **Dashboard:** Fix version restore. [#73482](https://github.com/grafana/grafana/issues/73482), [@Clarity-89](https://github.com/Clarity-89)
- **Logs:** Fix permalinks not scrolling into view. [#73477](https://github.com/grafana/grafana/issues/73477), [@svennergr](https://github.com/svennergr)
- **SqlDataSources:** Update metricFindQuery to pass on scopedVars to templateSrv. [#73398](https://github.com/grafana/grafana/issues/73398), [@torkelo](https://github.com/torkelo)
- **Rendering:** Fix dashboard screenshot. [#73361](https://github.com/grafana/grafana/issues/73361), [@AgnesToulet](https://github.com/AgnesToulet)
- **Loki:** Fix validation of `step` values to also allow e.g. `ms` values. [#73335](https://github.com/grafana/grafana/issues/73335), [@svennergr](https://github.com/svennergr)
- **Dashboard:** Fix repeated row panel placement with larger number of rows. [#73279](https://github.com/grafana/grafana/issues/73279), [@kaydelaney](https://github.com/kaydelaney)
- **CodeEditor:** Correctly fires onChange handler. [#73261](https://github.com/grafana/grafana/issues/73261), [@ashharrison90](https://github.com/ashharrison90)
- **Drawer:** Fix scrolling drawer content on Safari. [#73229](https://github.com/grafana/grafana/issues/73229), [@asimonok](https://github.com/asimonok)
- **Alerting:** Remove dump wrapper for yaml config. [#73215](https://github.com/grafana/grafana/issues/73215), [@VikaCep](https://github.com/VikaCep)
- **Alerting:** Always invalidate the AM config after mutation. [#73189](https://github.com/grafana/grafana/issues/73189), [@gillesdemey](https://github.com/gillesdemey)
- **Slug:** Combine various slugify fixes for special character handling. [#73173](https://github.com/grafana/grafana/issues/73173), [@DanCech](https://github.com/DanCech)
- **Logs:** Fix displaying the wrong field as body. [#73037](https://github.com/grafana/grafana/issues/73037), [@svennergr](https://github.com/svennergr)
- **Alerting:** Fix "see graph button" for cloud rules. [#73029](https://github.com/grafana/grafana/issues/73029), [@gillesdemey](https://github.com/gillesdemey)

<!-- 10.1.1 END -->
<!-- 10.1.0 START -->

# 10.1.0 (2023-08-22)

### Features and enhancements

- **Usage stats:** Tune collector execution startup and interval. [#72790](https://github.com/grafana/grafana/issues/72790), [@papagian](https://github.com/papagian)
- **Prometheus:** Add support for day_of_year. [#72403](https://github.com/grafana/grafana/issues/72403), [@gtk-grafana](https://github.com/gtk-grafana)
- **Transforms:** Add Alpha Format Time Transform. [#72319](https://github.com/grafana/grafana/issues/72319), [@codeincarnate](https://github.com/codeincarnate)
- **Prometheus:** Add present_over_time syntax highlighting. [#72283](https://github.com/grafana/grafana/issues/72283), [@arnaudlemaignen](https://github.com/arnaudlemaignen)
- **Login:** Show oauth error messages inline. [#72255](https://github.com/grafana/grafana/issues/72255), [@RoxanaAnamariaTurc](https://github.com/RoxanaAnamariaTurc)
- **Geomap:** Promote route + photos layer to beta, promote geojson layer to stable. [#72233](https://github.com/grafana/grafana/issues/72233), [@nmarrs](https://github.com/nmarrs)
- **Dashboards:** Add Angular deprecation alert in data source query editor. [#72211](https://github.com/grafana/grafana/issues/72211), [@xnyo](https://github.com/xnyo)
- **Auth:** Lock organization roles for users who are managed through an external auth provider. [#72204](https://github.com/grafana/grafana/issues/72204), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Transformations:** True OUTER JOIN in the join by field transformation used for tabular data . [#72176](https://github.com/grafana/grafana/issues/72176), [@bohandley](https://github.com/bohandley)
- **NestedFolders:** Enable new nested folder picker by default for nested folders. [#72129](https://github.com/grafana/grafana/issues/72129), [@joshhunt](https://github.com/joshhunt)
- **Alerting:** Add dashboardUID and panelID query parameters for loki state history. [#72119](https://github.com/grafana/grafana/issues/72119), [@alexweav](https://github.com/alexweav)
- **Feature toggles management:** Define get feature toggles api. [#72106](https://github.com/grafana/grafana/issues/72106), [@jcalisto](https://github.com/jcalisto)
- **Prometheus:** Turn browser resource cache on by default. [#72105](https://github.com/grafana/grafana/issues/72105), [@gtk-grafana](https://github.com/gtk-grafana)
- **Alerting:** Improve alerts names visibility on narrow panels. [#72104](https://github.com/grafana/grafana/issues/72104), [@konrad147](https://github.com/konrad147)
- **Data Sources:** Remove Admin/Data sources page in favour of Connections/Data sources. [#72102](https://github.com/grafana/grafana/issues/72102), [@mikkancso](https://github.com/mikkancso)
- **Loki:** Enable Query Splitting by default. [#72094](https://github.com/grafana/grafana/issues/72094), [@matyax](https://github.com/matyax)
- **AuthN:** Lock down manual role updates for users synced through Grafana Com portal. [#72044](https://github.com/grafana/grafana/issues/72044), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Tempo:** Remove traceqlSearch feature toggle. [#72029](https://github.com/grafana/grafana/issues/72029), [@adrapereira](https://github.com/adrapereira)
- **Alerting:** Keep legacy alert rule maxDataPoints and intervalMs during migration. [#71989](https://github.com/grafana/grafana/issues/71989), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Add min interval option to alert rule query creation. [#71986](https://github.com/grafana/grafana/issues/71986), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Add View YAML button for Grafana/provisioned rules. [#71983](https://github.com/grafana/grafana/issues/71983), [@VikaCep](https://github.com/VikaCep)
- **Plugin:** Remove error on invalid version. [#71951](https://github.com/grafana/grafana/issues/71951), [@oshirohugo](https://github.com/oshirohugo)
- **Traces:** Enable showing trace ids. [#71950](https://github.com/grafana/grafana/issues/71950), [@gabor](https://github.com/gabor)
- **RBAC:** Split non-empty scopes into `kind`, `attribute` and `identifier` fields for better search performance. [#71933](https://github.com/grafana/grafana/issues/71933), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Administration:** Feature toggle for feature toggle admin page. [#71887](https://github.com/grafana/grafana/issues/71887), [@IbrahimCSAE](https://github.com/IbrahimCSAE)
- **Alerting:** Improve performance of matching captures. [#71828](https://github.com/grafana/grafana/issues/71828), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **CommandPalette:** Remove parent search and fuzzy search for pages. [#71825](https://github.com/grafana/grafana/issues/71825), [@tskarhed](https://github.com/tskarhed)
- **Tracing:** Remove newTraceViewHeader feature toggle. [#71818](https://github.com/grafana/grafana/issues/71818), [@joey-grafana](https://github.com/joey-grafana)
- **FlameGraph:** Add column in table with buttons to filter and sandwich a symbol. [#71773](https://github.com/grafana/grafana/issues/71773), [@aocenas](https://github.com/aocenas)
- **Units:** Added support for Candela (cd). [#71696](https://github.com/grafana/grafana/issues/71696), [@Frankkkkk](https://github.com/Frankkkkk)
- **Alerting:** Add contact point provisioning file export. [#71692](https://github.com/grafana/grafana/issues/71692), [@JacobsonMT](https://github.com/JacobsonMT)
- **Redshift:** Support caching async aws queries. [#71682](https://github.com/grafana/grafana/issues/71682), [@iwysiu](https://github.com/iwysiu)
- **Alerting:** Save and restore condition reference while switching type. [#71629](https://github.com/grafana/grafana/issues/71629), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Explore:** Remove exploreMixedDatasource feature toggle. [#71534](https://github.com/grafana/grafana/issues/71534), [@Elfo404](https://github.com/Elfo404)
- **OAuth:** Introduce user_refresh_token setting and make it default for the selected providers. [#71533](https://github.com/grafana/grafana/issues/71533), [@mgyongyosi](https://github.com/mgyongyosi)
- **Alerting:** Adds support for toggling common labels. [#71497](https://github.com/grafana/grafana/issues/71497), [@gillesdemey](https://github.com/gillesdemey)
- **Plugin:** Validate plugin version on installation. [#71488](https://github.com/grafana/grafana/issues/71488), [@oshirohugo](https://github.com/oshirohugo)
- **Explore:** Replaced deprecated 'query' property with 'queries' in splitOpen. [#71484](https://github.com/grafana/grafana/issues/71484), [@harisrozajac](https://github.com/harisrozajac)
- **Plugins:** Remove logs button instead of disabling it. [#71448](https://github.com/grafana/grafana/issues/71448), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Traces:** Add inline validation and greater precision to duration fields in span filters. [#71404](https://github.com/grafana/grafana/issues/71404), [@joey-grafana](https://github.com/joey-grafana)
- **Alert:** Change error icon to exclamation-circle. [#71397](https://github.com/grafana/grafana/issues/71397), [@torkelo](https://github.com/torkelo)
- **Field Config:** Add new units (mΩ, kHz, MHz, GHz, ac, ha). [#71357](https://github.com/grafana/grafana/issues/71357), [@Develer](https://github.com/Develer)
- **Plugins:** Fail plugins installation on wrong args provided. [#71355](https://github.com/grafana/grafana/issues/71355), [@oshirohugo](https://github.com/oshirohugo)
- **Logs:** Display log row menu cell on displayed fields. [#71300](https://github.com/grafana/grafana/issues/71300), [@matyax](https://github.com/matyax)
- **Auth:** Move LDAP debug to Authentication menu. [#71285](https://github.com/grafana/grafana/issues/71285), [@Jguer](https://github.com/Jguer)
- **AzureMonitor:** Add switch to control time-range for Logs queries. [#71278](https://github.com/grafana/grafana/issues/71278), [@aangelisc](https://github.com/aangelisc)
- **Alerting:** Changes to evaluation group step. [#71251](https://github.com/grafana/grafana/issues/71251), [@VikaCep](https://github.com/VikaCep)
- **PanelInspect:** Clean table display settings from field config. [#71226](https://github.com/grafana/grafana/issues/71226), [@torkelo](https://github.com/torkelo)
- **QueryBuilder:** Preserve queries when switching from Mixed. [#71224](https://github.com/grafana/grafana/issues/71224), [@aangelisc](https://github.com/aangelisc)
- **Public Dashboard:** Redesign modal (v2). [#71151](https://github.com/grafana/grafana/issues/71151), [@polibb](https://github.com/polibb)
- **Tracing:** Add services, depth to span filters metadata. [#71084](https://github.com/grafana/grafana/issues/71084), [@joey-grafana](https://github.com/joey-grafana)
- **PluginExtensions:** Add category to link extensions. [#71074](https://github.com/grafana/grafana/issues/71074), [@mckn](https://github.com/mckn)
- **Alerting:** Add smart type selection when creating a new alert rule. [#71071](https://github.com/grafana/grafana/issues/71071), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Keep rule form buttons always on top. [#71056](https://github.com/grafana/grafana/issues/71056), [@VikaCep](https://github.com/VikaCep)
- **Feat:** Match allowed cookies with optional character. [#71047](https://github.com/grafana/grafana/issues/71047), [@itsmylife](https://github.com/itsmylife)
- **Plugins:** Add feature toggle for Temporary Credentials. [#71033](https://github.com/grafana/grafana/issues/71033), [@idastambuk](https://github.com/idastambuk)
- **Tracing:** Show next/prev buttons when span filters are collapsed. [#71025](https://github.com/grafana/grafana/issues/71025), [@joey-grafana](https://github.com/joey-grafana)
- **Heatmap:** Add datalink support. [#71016](https://github.com/grafana/grafana/issues/71016), [@kureshimiru](https://github.com/kureshimiru)
- **Table:** Add custom cell rendering option. [#70999](https://github.com/grafana/grafana/issues/70999), [@aocenas](https://github.com/aocenas)
- **Alerting:** Use new "Label" components for alert instance labels. [#70997](https://github.com/grafana/grafana/issues/70997), [@gillesdemey](https://github.com/gillesdemey)
- **Prometheus:** Add disableRecordingRules datasource config. [#70903](https://github.com/grafana/grafana/issues/70903), [@shantanualsi](https://github.com/shantanualsi)
- **Alerting:** Use ToggleTip instead of Hovercard in the info popup on Math expressions. [#70881](https://github.com/grafana/grafana/issues/70881), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Improve time range and max data points info in QueryEditor. [#70867](https://github.com/grafana/grafana/issues/70867), [@VikaCep](https://github.com/VikaCep)
- **A11y:** Do not force colors in the color swatch and icon series. [#70862](https://github.com/grafana/grafana/issues/70862), [@evictorero](https://github.com/evictorero)
- **A11y:** Add support for toggle buttons in high contrast mode. [#70838](https://github.com/grafana/grafana/issues/70838), [@evictorero](https://github.com/evictorero)
- **LogContext:** Make centered row unsticky on click. [#70832](https://github.com/grafana/grafana/issues/70832), [@svennergr](https://github.com/svennergr)
- **LogContext:** Add button to scroll to center. [#70821](https://github.com/grafana/grafana/issues/70821), [@svennergr](https://github.com/svennergr)
- **Alerting:** Render folder selector in options for Alert List Panel only when having Grafana datasource. [#70816](https://github.com/grafana/grafana/issues/70816), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Connections console:** Add Angular badge for Angular plugins. [#70789](https://github.com/grafana/grafana/issues/70789), [@xnyo](https://github.com/xnyo)
- **Flamegraph:** Add switch for color scheme by value or by package. [#70770](https://github.com/grafana/grafana/issues/70770), [@aocenas](https://github.com/aocenas)
- **Auth:** Enforce role sync except if skip org role sync is enabled. [#70766](https://github.com/grafana/grafana/issues/70766), [@Jguer](https://github.com/Jguer)
- **AuthZ:** Extend /api/search to work with self-contained permissions. [#70749](https://github.com/grafana/grafana/issues/70749), [@mgyongyosi](https://github.com/mgyongyosi)
- **Login:** Adjust error message when user exceed login attempts. [#70736](https://github.com/grafana/grafana/issues/70736), [@RoxanaAnamariaTurc](https://github.com/RoxanaAnamariaTurc)
- **Nested folders:** Paginate child folder items. [#70730](https://github.com/grafana/grafana/issues/70730), [@ashharrison90](https://github.com/ashharrison90)
- **Units:** Add events/messages/records/rows throughput units. [#70726](https://github.com/grafana/grafana/issues/70726), [@hhromic](https://github.com/hhromic)
- **Plugins:** Enable feature toggles for long running queries by default. [#70678](https://github.com/grafana/grafana/issues/70678), [@idastambuk](https://github.com/idastambuk)
- **I18n:** Translate phrases for new Browse Dashboards. [#70654](https://github.com/grafana/grafana/issues/70654), [@Bohdanator](https://github.com/Bohdanator)
- **Flamegraph:** Prevent cropping of tooltip by bottom of the viewport. [#70633](https://github.com/grafana/grafana/issues/70633), [@aocenas](https://github.com/aocenas)
- **Pyroscope:** Preselect default profile type or app in the query editor dropdown. [#70624](https://github.com/grafana/grafana/issues/70624), [@aocenas](https://github.com/aocenas)
- **Trend:** Support disconnect values and connect nulls options. [#70616](https://github.com/grafana/grafana/issues/70616), [@drew08t](https://github.com/drew08t)
- **StateTimeline:** Add disconnect value option. [#70610](https://github.com/grafana/grafana/issues/70610), [@drew08t](https://github.com/drew08t)
- **DSPicker:** Use new DS picker everywhere. [#70609](https://github.com/grafana/grafana/issues/70609), [@ivanortegaalba](https://github.com/ivanortegaalba)
- **Alerting:** Reduce number of unnecessary request in the alert list panel in case …. [#70583](https://github.com/grafana/grafana/issues/70583), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Docs:** Update query and resource caching documentation to improve clarity and add additional context. [#70556](https://github.com/grafana/grafana/issues/70556), [@mmandrus](https://github.com/mmandrus)
- **Alerting:** Adds in-app documentation for Classic Conditions. [#70540](https://github.com/grafana/grafana/issues/70540), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Display a warning when a contact point is not in use. [#70506](https://github.com/grafana/grafana/issues/70506), [@konrad147](https://github.com/konrad147)
- **Dashboards:** Support an auto refresh interval that is based on the query range. [#70479](https://github.com/grafana/grafana/issues/70479), [@ryantxu](https://github.com/ryantxu)
- **Loki:** Preserve pipeline stages in context query. [#70472](https://github.com/grafana/grafana/issues/70472), [@svennergr](https://github.com/svennergr)
- **Logs:** Link anchored logline when opening context in split view. [#70463](https://github.com/grafana/grafana/issues/70463), [@svennergr](https://github.com/svennergr)
- **Prometheus:** Add capability to filter label names by metric in template variable editor. [#70452](https://github.com/grafana/grafana/issues/70452), [@gtk-grafana](https://github.com/gtk-grafana)
- **Alerting:** Expression card improvements. [#70395](https://github.com/grafana/grafana/issues/70395), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Logs:** Show active state of "filter for value" buttons in Logs Details. [#70328](https://github.com/grafana/grafana/issues/70328), [@matyax](https://github.com/matyax)
- **Loki:** Deprecate resolution . [#70326](https://github.com/grafana/grafana/issues/70326), [@ivanahuckova](https://github.com/ivanahuckova)
- **PanelPlugin:** Allow hiding standard field config from defaults. [#70303](https://github.com/grafana/grafana/issues/70303), [@dprokop](https://github.com/dprokop)
- **InteractiveTable:** Add pagination and header tooltips. [#70281](https://github.com/grafana/grafana/issues/70281), [@abannachGrafana](https://github.com/abannachGrafana)
- **FlameGraph:** Add sandwich view. [#70268](https://github.com/grafana/grafana/issues/70268), [@aocenas](https://github.com/aocenas)
- **Login:** Show error messages inline in form instead of in toasts. [#70266](https://github.com/grafana/grafana/issues/70266), [@joshhunt](https://github.com/joshhunt)
- **Elasticsearch:** Enable logs samples for metric queries. [#70258](https://github.com/grafana/grafana/issues/70258), [@gwdawson](https://github.com/gwdawson)
- **Geomap:** Add network layer. [#70192](https://github.com/grafana/grafana/issues/70192), [@drew08t](https://github.com/drew08t)
- **Alerting:** Bump grafana/alerting and refactor the ImageStore/Provider to provide image URL/bytes. [#70182](https://github.com/grafana/grafana/issues/70182), [@santihernandezc](https://github.com/santihernandezc)
- **Auth:** Support google OIDC and group fetching. [#70140](https://github.com/grafana/grafana/issues/70140), [@Jguer](https://github.com/Jguer)
- **Alerting:** Make QueryEditor not collapsible. [#70112](https://github.com/grafana/grafana/issues/70112), [@VikaCep](https://github.com/VikaCep)
- **TimeSeries:** Add option to disconnect values. [#70097](https://github.com/grafana/grafana/issues/70097), [@drew08t](https://github.com/drew08t)
- **Logs:** Add toggle behavior support for "filter for" and "filter out" label within Logs Details. [#70091](https://github.com/grafana/grafana/issues/70091), [@matyax](https://github.com/matyax)
- **Plugins:** Periodically update public signing key. [#70080](https://github.com/grafana/grafana/issues/70080), [@andresmgot](https://github.com/andresmgot)
- **Navigation:** Add navigation customization options to config documentation. [#70072](https://github.com/grafana/grafana/issues/70072), [@ashharrison90](https://github.com/ashharrison90)
- **Config:** Add configuration option to define custom user-facing general error message for certain error types. [#70023](https://github.com/grafana/grafana/issues/70023), [@mmandrus](https://github.com/mmandrus)
- **Alerting:** Add notification policy provisioning file export. [#70009](https://github.com/grafana/grafana/issues/70009), [@JacobsonMT](https://github.com/JacobsonMT)
- **CloudWatch:** Add missing EventBridge Pipe metrics. [#69994](https://github.com/grafana/grafana/issues/69994), [@rrhodes](https://github.com/rrhodes)
- **SSE:** Support for ML query node. [#69963](https://github.com/grafana/grafana/issues/69963), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Database:** Make dialects independent of xorm Engine. [#69955](https://github.com/grafana/grafana/issues/69955), [@DanCech](https://github.com/DanCech)
- **Mysql Tests:** For mysql5.7 integration tests use utf8mb4 charset. [#69953](https://github.com/grafana/grafana/issues/69953), [@owensmallwood](https://github.com/owensmallwood)
- **Alerting:** Show disabled provisioned evaluation group. [#69932](https://github.com/grafana/grafana/issues/69932), [@gillesdemey](https://github.com/gillesdemey)
- **Auth:** Support Gitlab OIDC scopes. [#69890](https://github.com/grafana/grafana/issues/69890), [@Jguer](https://github.com/Jguer)
- **InfluxDB:** Backend parser compatibility with frontend parser. [#69865](https://github.com/grafana/grafana/issues/69865), [@itsmylife](https://github.com/itsmylife)
- **PublicDashboards:** Audit table pagination. [#69823](https://github.com/grafana/grafana/issues/69823), [@juanicabanas](https://github.com/juanicabanas)
- **CloudWatch:** Add missing AWS/FSx metrics. [#69816](https://github.com/grafana/grafana/issues/69816), [@kevinwcyu](https://github.com/kevinwcyu)
- **Variables:** Show description instead of definition in table. [#69786](https://github.com/grafana/grafana/issues/69786), [@ivanahuckova](https://github.com/ivanahuckova)
- **Alerting:** Repurpose rule testing endpoint to return potential alerts. [#69755](https://github.com/grafana/grafana/issues/69755), [@JacobsonMT](https://github.com/JacobsonMT)
- **NestedFolders:** Move `New folder` into a drawer. [#69706](https://github.com/grafana/grafana/issues/69706), [@ashharrison90](https://github.com/ashharrison90)
- **Loki:** Implement step editor. [#69648](https://github.com/grafana/grafana/issues/69648), [@ivanahuckova](https://github.com/ivanahuckova)
- **DataFrame:** Align frame (`__series.name`) and field naming (`__field.name`) . [#69621](https://github.com/grafana/grafana/issues/69621), [@torkelo](https://github.com/torkelo)
- **Auth:** Use auth broker by default. [#69620](https://github.com/grafana/grafana/issues/69620), [@Jguer](https://github.com/Jguer)
- **Dashboards:** Add dashboard embed route. [#69596](https://github.com/grafana/grafana/issues/69596), [@Clarity-89](https://github.com/Clarity-89)
- **Nested folders:** Improve loading states. [#69556](https://github.com/grafana/grafana/issues/69556), [@ashharrison90](https://github.com/ashharrison90)
- **Alerting:** Use monaco editor for admin page. [#69514](https://github.com/grafana/grafana/issues/69514), [@gillesdemey](https://github.com/gillesdemey)
- **Legend:** Sort by name. [#69490](https://github.com/grafana/grafana/issues/69490), [@adela-almasan](https://github.com/adela-almasan)
- **QueryField:** Set default value for onBlur prop. [#69487](https://github.com/grafana/grafana/issues/69487), [@idastambuk](https://github.com/idastambuk)
- **Tempo:** TraceQL editor - Match type of new values with values in dropdown. [#69468](https://github.com/grafana/grafana/issues/69468), [@adrapereira](https://github.com/adrapereira)
- **Logs:** Add permalink to log lines. [#69464](https://github.com/grafana/grafana/issues/69464), [@svennergr](https://github.com/svennergr)
- **Logs:** Implement "infinite" scrolling in log context. [#69459](https://github.com/grafana/grafana/issues/69459), [@gabor](https://github.com/gabor)
- **Tracing:** Use new DataSourceDescription component. [#69443](https://github.com/grafana/grafana/issues/69443), [@joey-grafana](https://github.com/joey-grafana)
- **Plugin Extensions:** Custom limits for extensions-per-plugin . [#69430](https://github.com/grafana/grafana/issues/69430), [@leventebalogh](https://github.com/leventebalogh)
- **Alerting:** Display error if repeat interval is lower than group interval. [#69413](https://github.com/grafana/grafana/issues/69413), [@VikaCep](https://github.com/VikaCep)
- **Tracing:** Move upload trace to button. [#69402](https://github.com/grafana/grafana/issues/69402), [@adrapereira](https://github.com/adrapereira)
- **I18n:** Add server config to detect browser language. [#69396](https://github.com/grafana/grafana/issues/69396), [@pbaumard](https://github.com/pbaumard)
- **Tempo:** Represent OTLP Span Intrinsics correctly. [#69394](https://github.com/grafana/grafana/issues/69394), [@joey-grafana](https://github.com/joey-grafana)
- **News:** Expose config option to disable News feed. [#69365](https://github.com/grafana/grafana/issues/69365), [@ashharrison90](https://github.com/ashharrison90)
- **Alerting:** Change how we display annotations in the rule form. [#69338](https://github.com/grafana/grafana/issues/69338), [@VikaCep](https://github.com/VikaCep)
- **Azure:** AzureMonitorMetrics - change response to be dataplane compliant. [#69308](https://github.com/grafana/grafana/issues/69308), [@kylebrandt](https://github.com/kylebrandt)
- **JoinDataFrames:** Keep field name if possible. [#69289](https://github.com/grafana/grafana/issues/69289), [@ryantxu](https://github.com/ryantxu)
- **Dashboards:** Data source template variable options now specify a current value using uid. [#69259](https://github.com/grafana/grafana/issues/69259), [@darrenjaneczek](https://github.com/darrenjaneczek)
- **Alerting:** Add more context to delete modals. [#69244](https://github.com/grafana/grafana/issues/69244), [@gillesdemey](https://github.com/gillesdemey)
- **Plugins:** Forbid loading Angular plugins when Angular is disabled. [#69225](https://github.com/grafana/grafana/issues/69225), [@xnyo](https://github.com/xnyo)
- **Tempo:** TraceQL query response streaming. [#69212](https://github.com/grafana/grafana/issues/69212), [@adrapereira](https://github.com/adrapereira)
- **Catalog:** Display badges for Angular plugins and disable install if Angular is disabled. [#69084](https://github.com/grafana/grafana/issues/69084), [@xnyo](https://github.com/xnyo)
- **Chore:** Adding "allowed_groups" Configuration Parameter to Generic OAuth Method. [#69025](https://github.com/grafana/grafana/issues/69025), [@vsychov](https://github.com/vsychov)
- **Loki:** Add support for distinct operation in autocomplete and query builder. [#69003](https://github.com/grafana/grafana/issues/69003), [@matyax](https://github.com/matyax)
- **Chore:** Avoid unnecessary byte/string conversions. [#69001](https://github.com/grafana/grafana/issues/69001), [@Juneezee](https://github.com/Juneezee)
- **Loki:** Implement `decolorize` logql operation. [#68972](https://github.com/grafana/grafana/issues/68972), [@ivanahuckova](https://github.com/ivanahuckova)
- **CloudWatch:** Wrap VariableEditor dimension fields. [#68967](https://github.com/grafana/grafana/issues/68967), [@iSatVeerSingh](https://github.com/iSatVeerSingh)
- **TimeSeries:** Add zoom-out functionality on double click. [#68936](https://github.com/grafana/grafana/issues/68936), [@simPod](https://github.com/simPod)
- **Plugins:** Bump Plugin SDK version and address instance management breaking changes. [#68900](https://github.com/grafana/grafana/issues/68900), [@wbrowne](https://github.com/wbrowne)
- **FlameGraph:** Add option to align text left or right. [#68893](https://github.com/grafana/grafana/issues/68893), [@aocenas](https://github.com/aocenas)
- **Logs:** Added copy-to-clipboard fallback support and visual feedback after copying. [#68874](https://github.com/grafana/grafana/issues/68874), [@matyax](https://github.com/matyax)
- **Auth:** Respect cache control for JWKS in auth.jwt. [#68872](https://github.com/grafana/grafana/issues/68872), [@Jguer](https://github.com/Jguer)
- **Pyroscope:** Rename phlare to grafana-pyroscope-datasource. [#68859](https://github.com/grafana/grafana/issues/68859), [@ryantxu](https://github.com/ryantxu)
- **Alerting:** Add notification policies preview in alert creation. [#68839](https://github.com/grafana/grafana/issues/68839), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Page:** Add inline rename functionality. [#68828](https://github.com/grafana/grafana/issues/68828), [@ashharrison90](https://github.com/ashharrison90)
- **Tracing:** Rename reset to clear for consistency. [#68821](https://github.com/grafana/grafana/issues/68821), [@joey-grafana](https://github.com/joey-grafana)
- **Alerting:** Adds support for timezones in mute timings. [#68813](https://github.com/grafana/grafana/issues/68813), [@gillesdemey](https://github.com/gillesdemey)
- **Datasources:** Deprecate and log creating/updating datasources with invalid UIDs. [#68800](https://github.com/grafana/grafana/issues/68800), [@xnyo](https://github.com/xnyo)
- **Tracing:** Upgrade tracing data source configuration editors. [#68764](https://github.com/grafana/grafana/issues/68764), [@joey-grafana](https://github.com/joey-grafana)
- **Loki:** Preserve pre-selected labels in the log context UI. [#68700](https://github.com/grafana/grafana/issues/68700), [@ivanahuckova](https://github.com/ivanahuckova)
- **NestedFolders:** Improve performance of Browse Dashboards by loading one page at a time. [#68617](https://github.com/grafana/grafana/issues/68617), [@joshhunt](https://github.com/joshhunt)
- **Plugins:** Add a new UI Extension type. [#68600](https://github.com/grafana/grafana/issues/68600), [@leventebalogh](https://github.com/leventebalogh)
- **StateTimeline:** Support hideFrom field config. [#68586](https://github.com/grafana/grafana/issues/68586), [@ryantxu](https://github.com/ryantxu)
- **Chore:** Remove alpha icon panel. [#68573](https://github.com/grafana/grafana/issues/68573), [@nmarrs](https://github.com/nmarrs)
- **PublicDashboards:** Support timezone on query API. [#68560](https://github.com/grafana/grafana/issues/68560), [@evictorero](https://github.com/evictorero)
- **API:** Add deprecation notice for updating folder UID. [#68543](https://github.com/grafana/grafana/issues/68543), [@papagian](https://github.com/papagian)
- **Accessibility:** Make QueryOptions in Phlare and Parca accessible. [#68515](https://github.com/grafana/grafana/issues/68515), [@joey-grafana](https://github.com/joey-grafana)
- **Chore:** Test datasource to support template $seriesIndex in label values. [#68497](https://github.com/grafana/grafana/issues/68497), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Loki:** Add functionality to revert to initial query in log context. [#68484](https://github.com/grafana/grafana/issues/68484), [@ivanahuckova](https://github.com/ivanahuckova)
- **Alerting:** Reorder new alert and export buttons. [#68418](https://github.com/grafana/grafana/issues/68418), [@VikaCep](https://github.com/VikaCep)
- **Accessibility:** Prevent TimePickerContent overflowing page height. [#68356](https://github.com/grafana/grafana/issues/68356), [@ashharrison90](https://github.com/ashharrison90)
- **Build:** Update plugin installation in custom Dockerfile. [#68310](https://github.com/grafana/grafana/issues/68310), [@hoptical](https://github.com/hoptical)
- **Alerting:** Enable alerts preview on notification policies page. [#68291](https://github.com/grafana/grafana/issues/68291), [@konrad147](https://github.com/konrad147)
- **Accessibility:** Adds aria tags to VizTooltip so screen readers announce them. [#68247](https://github.com/grafana/grafana/issues/68247), [@JoaoSilvaGrafana](https://github.com/JoaoSilvaGrafana)
- **Breadcrumbs:** Don't add breadcrumb for the current tab. [#68230](https://github.com/grafana/grafana/issues/68230), [@torkelo](https://github.com/torkelo)
- **NewsDrawer:** Add grot to news drawer (after news items) . [#68173](https://github.com/grafana/grafana/issues/68173), [@torkelo](https://github.com/torkelo)
- **Tempo:** Integrate scoped tags API. [#68106](https://github.com/grafana/grafana/issues/68106), [@joey-grafana](https://github.com/joey-grafana)
- **Auth:** Use PKCE by default (If OAuth provider supports PKCE). [#68095](https://github.com/grafana/grafana/issues/68095), [@arukiidou](https://github.com/arukiidou)
- **Accessibility:** Add `Skip to content` link. [#68065](https://github.com/grafana/grafana/issues/68065), [@ashharrison90](https://github.com/ashharrison90)
- **Auth:** Add alpha version of the Extended JWT client . [#67999](https://github.com/grafana/grafana/issues/67999), [@mgyongyosi](https://github.com/mgyongyosi)
- **Alerting:** Add option for memberlist label. [#67982](https://github.com/grafana/grafana/issues/67982), [@JohnnyQQQQ](https://github.com/JohnnyQQQQ)
- **Breadcrumbs:** Improve responsiveness. [#67955](https://github.com/grafana/grafana/issues/67955), [@torkelo](https://github.com/torkelo)
- **PluginExtensions:** Expose scopedVars via the context to plugins that extends the dashboard panel menu. [#67917](https://github.com/grafana/grafana/issues/67917), [@mckn](https://github.com/mckn)
- **Trace View:** Rename span detail attribute sections. [#67849](https://github.com/grafana/grafana/issues/67849), [@adrapereira](https://github.com/adrapereira)
- **Chore:** Upgrade Go to 1.20.4. [#67748](https://github.com/grafana/grafana/issues/67748), [@papagian](https://github.com/papagian)
- **Correlations:** Add links to prometheus dataframe where labels are split out. [#67736](https://github.com/grafana/grafana/issues/67736), [@gelicia](https://github.com/gelicia)
- **Theme:** Change dark theme borders to improve contrast on primary background. [#67699](https://github.com/grafana/grafana/issues/67699), [@torkelo](https://github.com/torkelo)
- **Alerting:** Refactor the ImageStore/Provider to provide image URL/bytes. [#67693](https://github.com/grafana/grafana/issues/67693), [@santihernandezc](https://github.com/santihernandezc)
- **Alerting:** Allow to tab onto elements for a11y. [#67684](https://github.com/grafana/grafana/issues/67684), [@VikaCep](https://github.com/VikaCep)
- **Grafana:** Upgrades mysql images from 5.7 to 8. [#67604](https://github.com/grafana/grafana/issues/67604), [@owensmallwood](https://github.com/owensmallwood)
- **Chore:** Bump github.com/go-sql-driver/mysql from 1.6.0 to 1.7.1. [#67584](https://github.com/grafana/grafana/issues/67584)
- **Frontend logging:** Remove Sentry javascript agent support. [#67493](https://github.com/grafana/grafana/issues/67493), [@domasx2](https://github.com/domasx2)
- **HTTP:** Add TLS version configurability for grafana server. [#67482](https://github.com/grafana/grafana/issues/67482), [@venkatbvc](https://github.com/venkatbvc)
- **NestedFolders:** Use new Browse Dashboards UI behind feature flag. [#67416](https://github.com/grafana/grafana/issues/67416), [@joshhunt](https://github.com/joshhunt)
- **CloudWatch:** Remove dynamic labels feature toggle. [#67371](https://github.com/grafana/grafana/issues/67371), [@fridgepoet](https://github.com/fridgepoet)
- **Suggestions:** Prioritize preferred visualizations for suggestion list. [#67326](https://github.com/grafana/grafana/issues/67326), [@sarahzinger](https://github.com/sarahzinger)
- **Explore:** Allow the use of plugin panels. [#66982](https://github.com/grafana/grafana/issues/66982), [@Umaaz](https://github.com/Umaaz)
- **Grafana/ui:** Add UserIcon and UsersIndicator components. [#66906](https://github.com/grafana/grafana/issues/66906), [@Clarity-89](https://github.com/Clarity-89)
- **Connections:** Simplify connections nav. [#66813](https://github.com/grafana/grafana/issues/66813), [@torkelo](https://github.com/torkelo)
- **Variables:** Add support for `$__timezone` template variable. [#66785](https://github.com/grafana/grafana/issues/66785), [@VictorColomb](https://github.com/VictorColomb)
- **Design System:** Refactor IconButton and update documentation. [#66774](https://github.com/grafana/grafana/issues/66774), [@L-M-K-B](https://github.com/L-M-K-B)
- **CloudWatch:** Update metric stat editor to match aws statistics. [#66532](https://github.com/grafana/grafana/issues/66532), [@sladyn98](https://github.com/sladyn98)
- **Chore:** Replace go-multierror with errors package. [#66432](https://github.com/grafana/grafana/issues/66432), [@iSatVeerSingh](https://github.com/iSatVeerSingh)
- **Explore:** Make toolbar action extendable by plugins. [#65524](https://github.com/grafana/grafana/issues/65524), [@mckn](https://github.com/mckn)
- **Loki:** Add the ability to prettify logql queries. [#64337](https://github.com/grafana/grafana/issues/64337), [@gwdawson](https://github.com/gwdawson)
- **TimeSeries / StateTimeline:** Add support for rendering enum fields. [#64179](https://github.com/grafana/grafana/issues/64179), [@leeoniya](https://github.com/leeoniya)
- **Elasticsearch:** Improve query type selection. [#63402](https://github.com/grafana/grafana/issues/63402), [@gabor](https://github.com/gabor)
- **Metrics:** Update Help to mention active viewers. [#63384](https://github.com/grafana/grafana/issues/63384), [@monteiro-renato](https://github.com/monteiro-renato)
- **MySQL:** Add option to allow cleartext passwords. [#63232](https://github.com/grafana/grafana/issues/63232), [@enginecan](https://github.com/enginecan)
- **Platform:** Add support for Postgresql pgpass file. [#61517](https://github.com/grafana/grafana/issues/61517), [@gjacquet](https://github.com/gjacquet)
- **ServiceAccounts:** Add secret scan service docs. [#57926](https://github.com/grafana/grafana/issues/57926), [@Jguer](https://github.com/Jguer)
- **Azure:** Configuration for user identity authentication in datasources (Experimental). [#50277](https://github.com/grafana/grafana/issues/50277), [@kostrse](https://github.com/kostrse)
- **Mysql Tests:** Mysql5.7 integration tests, use utf8mb4 charset. (Enterprise)
- **RBAC:** Validate provided Action for Create/Update Role. (Enterprise)
- **Reports:** Activate draft reports. (Enterprise)
- **Grafana:** Upgrades mysql images from 5.7 to 8. (Enterprise)
- **Usage Insights:** Use the insights components from grafana/ui. (Enterprise)

### Bug fixes

- **DataSourceProxy:** Fix url validation error handling. [#73322](https://github.com/grafana/grafana/issues/73322), [@ricci2511](https://github.com/ricci2511)
- **AzureMonitor:** Allow `serviceTags` and `tags` to be empty for trace results. [#73197](https://github.com/grafana/grafana/issues/73197), [@aangelisc](https://github.com/aangelisc)
- **UserSync:** Avoid UpdateLastSeenAt with invalid user ids. [#72784](https://github.com/grafana/grafana/issues/72784), [@ryantxu](https://github.com/ryantxu)
- **Nested folders:** Fix search query for empty self-contained permissions. [#72733](https://github.com/grafana/grafana/issues/72733), [@papagian](https://github.com/papagian)
- **Auth:** Lock down Grafana admin role updates if the role is externally synced. [#72691](https://github.com/grafana/grafana/issues/72691), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **DS Picker:** Ignore capitalization when sorting dropdown list. [#72668](https://github.com/grafana/grafana/issues/72668), [@ivanortegaalba](https://github.com/ivanortegaalba)
- **Logs:** Fix ui getting stuck when removing fields. [#72603](https://github.com/grafana/grafana/issues/72603), [@ivanahuckova](https://github.com/ivanahuckova)
- **Data sources:** Dashboards page now loads correctly from direct url. [#72495](https://github.com/grafana/grafana/issues/72495), [@ashharrison90](https://github.com/ashharrison90)
- **Provisioning:** Fix overwrite SecureJSONData on provisioning. [#72455](https://github.com/grafana/grafana/issues/72455), [@oshirohugo](https://github.com/oshirohugo)
- **Loki:** Run logs volume for query when switching from trace to logs. [#72268](https://github.com/grafana/grafana/issues/72268), [@ivanahuckova](https://github.com/ivanahuckova)
- **Alerting:** Fix refetching grafana rules on alert list panel. [#72242](https://github.com/grafana/grafana/issues/72242), [@konrad147](https://github.com/konrad147)
- **Alerting:** Fix contact point testing with secure settings. [#72235](https://github.com/grafana/grafana/issues/72235), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Exclude expression refIDs from NoData state. [#72219](https://github.com/grafana/grafana/issues/72219), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Fix state manager to not keep datasource_uid and ref_id labels in state after Error. [#72216](https://github.com/grafana/grafana/issues/72216), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Dashboards:** Fix small drop target for importing dashboards. [#72170](https://github.com/grafana/grafana/issues/72170), [@kunxl-gg](https://github.com/kunxl-gg)
- **TimeSeries:** Fix zoom not working after editing panel. [#72163](https://github.com/grafana/grafana/issues/72163), [@leeoniya](https://github.com/leeoniya)
- **Dashboard:** New Datasource picker link is keyboard accessible. [#72134](https://github.com/grafana/grafana/issues/72134), [@polibb](https://github.com/polibb)
- **CloudMonitoring:** Correctly set title and text fields for annotations. [#71888](https://github.com/grafana/grafana/issues/71888), [@aangelisc](https://github.com/aangelisc)
- **AzureMonitor:** Fix ResourcePicker hanging. [#71886](https://github.com/grafana/grafana/issues/71886), [@asimpson](https://github.com/asimpson)
- **Fix:** Hide Forward OAuth Identity toggle when azure auth is enabled. [#71640](https://github.com/grafana/grafana/issues/71640), [@itsmylife](https://github.com/itsmylife)
- **Flamegraph:** Fix wrong positioning of tooltip in dashboards. [#71396](https://github.com/grafana/grafana/issues/71396), [@aocenas](https://github.com/aocenas)
- **Dashboards:** Save tags on dashboard creation. [#71394](https://github.com/grafana/grafana/issues/71394), [@evictorero](https://github.com/evictorero)
- **A11y:** Fix keyboard accessibility in LayerDragDropList. [#71386](https://github.com/grafana/grafana/issues/71386), [@Develer](https://github.com/Develer)
- **DataLinks:** Fix bug where links which used built in variables could be hidden. [#71372](https://github.com/grafana/grafana/issues/71372), [@aocenas](https://github.com/aocenas)
- **LogContext:** Fix a bug where multiple logs with similar nanosecond timestamps were loaded too often. [#71319](https://github.com/grafana/grafana/issues/71319), [@svennergr](https://github.com/svennergr)
- **Dashboard:** Slider overlapping with right input field. [#71282](https://github.com/grafana/grafana/issues/71282), [@Develer](https://github.com/Develer)
- **Alerting:** Support spaces in alert names for creating silence links. [#71280](https://github.com/grafana/grafana/issues/71280), [@gillesdemey](https://github.com/gillesdemey)
- **Swagger:** Fix response for the search users endpoint. [#71272](https://github.com/grafana/grafana/issues/71272), [@papagian](https://github.com/papagian)
- **Auth:** Fix US gov azure ad oauth URL parsing. [#71254](https://github.com/grafana/grafana/issues/71254), [@douglasryanadams](https://github.com/douglasryanadams)
- **SSE:** DSNode to update result with names to make each value identifiable by labels (only Graphite and TestData). [#71246](https://github.com/grafana/grafana/issues/71246), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **PanelChrome:** Fixes issues with hover header and resizing panel above. [#71040](https://github.com/grafana/grafana/issues/71040), [@torkelo](https://github.com/torkelo)
- **Dashboard:** Add suggestion box for Flame Graph. [#70763](https://github.com/grafana/grafana/issues/70763), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Slug:** Use urlencoding to support non-ASCII characters. [#70691](https://github.com/grafana/grafana/issues/70691), [@sakjur](https://github.com/sakjur)
- **Checkbox:** Fix alignment in Safari. [#70673](https://github.com/grafana/grafana/issues/70673), [@ashharrison90](https://github.com/ashharrison90)
- **Alerting:** Fixes clone url for instances hosted on sub path. [#70543](https://github.com/grafana/grafana/issues/70543), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Support concurrent queries for saving alert instances. [#70525](https://github.com/grafana/grafana/issues/70525), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Dashboards:** Allow dashboards with same name in different folders. [#70378](https://github.com/grafana/grafana/issues/70378), [@joshhunt](https://github.com/joshhunt)
- **Query:** Fix concurrency handling for mixed datasource queries. [#70100](https://github.com/grafana/grafana/issues/70100), [@mmandrus](https://github.com/mmandrus)
- **Alerting:** Allow executing "hidden" queries. [#70064](https://github.com/grafana/grafana/issues/70064), [@gillesdemey](https://github.com/gillesdemey)
- **EchoBackend:** Make EchoSrvTransport batched. [#70012](https://github.com/grafana/grafana/issues/70012), [@kpelelis](https://github.com/kpelelis)
- **CodeEditor:** Ensure suggestions only apply to the instance of the editor that registered them. [#69995](https://github.com/grafana/grafana/issues/69995), [@ashharrison90](https://github.com/ashharrison90)
- **NestedFolders:** Ensure `New dashboard` page has the correct breadcrumb hierarchy. [#69758](https://github.com/grafana/grafana/issues/69758), [@ashharrison90](https://github.com/ashharrison90)
- **Transformations:** Config overrides being lost when config from query transform is applied. [#69720](https://github.com/grafana/grafana/issues/69720), [@IbrahimCSAE](https://github.com/IbrahimCSAE)
- **Azure:** Fix Kusto auto-completion for Azure datasources. [#69685](https://github.com/grafana/grafana/issues/69685), [@aangelisc](https://github.com/aangelisc)
- **Loki:** Fix parsing of escaped quotes in LogQL. [#69584](https://github.com/grafana/grafana/issues/69584), [@svennergr](https://github.com/svennergr)
- **Loki:** Fix showing of correct line limit in options. [#69572](https://github.com/grafana/grafana/issues/69572), [@ivanahuckova](https://github.com/ivanahuckova)
- **Alerting:** Fix notification policies inheritance algorithm. [#69304](https://github.com/grafana/grafana/issues/69304), [@gillesdemey](https://github.com/gillesdemey)
- **Checkbox:** Fix extraneous right hand margin when no label is present. [#68885](https://github.com/grafana/grafana/issues/68885), [@ashharrison90](https://github.com/ashharrison90)
- **Preferences:** Can reset timezone preference back to default correctly. [#68881](https://github.com/grafana/grafana/issues/68881), [@ashharrison90](https://github.com/ashharrison90)
- **Azuremonitor:** Multi resource fix. [#68759](https://github.com/grafana/grafana/issues/68759), [@bossinc](https://github.com/bossinc)
- **AzureMonitor:** Support multi-resource aliases and subscription aliases. [#68648](https://github.com/grafana/grafana/issues/68648), [@aangelisc](https://github.com/aangelisc)
- **Revert:** Allow editors to access GET /datasources. [#68632](https://github.com/grafana/grafana/issues/68632), [@eleijonmarck](https://github.com/eleijonmarck)
- **MySQL:** Use transaction_isolation instead of tx_isolation. [#68575](https://github.com/grafana/grafana/issues/68575), [@owensmallwood](https://github.com/owensmallwood)
- **Logs:** Change logic creating uid in LogRowModel. [#68569](https://github.com/grafana/grafana/issues/68569), [@ivanahuckova](https://github.com/ivanahuckova)
- **Dashboard:** Re-align Save form. [#68565](https://github.com/grafana/grafana/issues/68565), [@polibb](https://github.com/polibb)
- **Elasticsearch:** Implement filter query to not run hidden queries trough backend. [#68563](https://github.com/grafana/grafana/issues/68563), [@ivanahuckova](https://github.com/ivanahuckova)
- **Elasticsearch:** Fix passing of limit and datalinks to logs data frame. [#68554](https://github.com/grafana/grafana/issues/68554), [@ivanahuckova](https://github.com/ivanahuckova)
- **Dashboards:** Improve delete dashboard performance due to slow annotations query. [#68544](https://github.com/grafana/grafana/issues/68544), [@17billion](https://github.com/17billion)
- **Elasticsearch:** Handle no-index case in backend mode. [#68534](https://github.com/grafana/grafana/issues/68534), [@gabor](https://github.com/gabor)
- **GrafanaUI:** Support Tooltip as Dropdown child. [#68521](https://github.com/grafana/grafana/issues/68521), [@joshhunt](https://github.com/joshhunt)
- **Node graph:** Fix req/s in value. [#68441](https://github.com/grafana/grafana/issues/68441), [@domasx2](https://github.com/domasx2)
- **FlameGraph:** Debounce search update preventing too frequent rerenders . [#68405](https://github.com/grafana/grafana/issues/68405), [@aocenas](https://github.com/aocenas)
- **Settings:** Add ability to override `skip_org_role_sync` with Env variables. [#68364](https://github.com/grafana/grafana/issues/68364), [@eleijonmarck](https://github.com/eleijonmarck)
- **DarkTheme:** Fix dark theme shadows. [#68358](https://github.com/grafana/grafana/issues/68358), [@torkelo](https://github.com/torkelo)
- **Heatmap:** Fix color rendering for value ranges &lt; 1. [#68156](https://github.com/grafana/grafana/issues/68156), [@leeoniya](https://github.com/leeoniya)
- **AzureMonitor:** Clear queries if header value changes. [#67916](https://github.com/grafana/grafana/issues/67916), [@aangelisc](https://github.com/aangelisc)
- **AzureMonitor:** Fix logs query multi-resource and timespan values. [#67914](https://github.com/grafana/grafana/issues/67914), [@aangelisc](https://github.com/aangelisc)
- **CloudWatch:** Use grafana-aws-sdk v0.15.0. [#67876](https://github.com/grafana/grafana/issues/67876), [@iwysiu](https://github.com/iwysiu)
- **Datasource:** Fix missing raw SQL query in Query Inspector when query returns zero rows. [#67844](https://github.com/grafana/grafana/issues/67844), [@baldm0mma](https://github.com/baldm0mma)
- **LibraryPanels:** Don't include ScopedVars with persisted model. [#67843](https://github.com/grafana/grafana/issues/67843), [@kaydelaney](https://github.com/kaydelaney)
- **Elasticsearch:** Fix processing of logs with not-recognized time format. [#67767](https://github.com/grafana/grafana/issues/67767), [@ivanahuckova](https://github.com/ivanahuckova)
- **Google Cloud Monitor:** Fix mem usage for dropdown. [#67683](https://github.com/grafana/grafana/issues/67683), [@asimpson](https://github.com/asimpson)
- **Cloudwatch Logs:** Ignore non-time grouping fields in expressions and alerts. [#67608](https://github.com/grafana/grafana/issues/67608), [@iwysiu](https://github.com/iwysiu)
- **Correlations:** Enable traceView formatted links. [#67160](https://github.com/grafana/grafana/issues/67160), [@gelicia](https://github.com/gelicia)
- **SQL Datasources:** Reinstate SQL data source behavior around database selection when default configured databases already exist. [#65659](https://github.com/grafana/grafana/issues/65659), [@baldm0mma](https://github.com/baldm0mma)
- **API:** Fix status code when starring already starred dashboard. [#63478](https://github.com/grafana/grafana/issues/63478), [@MTLChrisLEE](https://github.com/MTLChrisLEE)
- **Dashboard:** Update query group options. [#63138](https://github.com/grafana/grafana/issues/63138), [@songhn233](https://github.com/songhn233)

### Breaking changes

This change impacts all instances that use external authentication providers to manage users and organization role assignments.

From Grafana 10.1, it will no longer be possible to manually update organization roles (Viewer, Editor and Admin) that are managed by an external auth provider. We are making this change to clearly separate between roles managed by an external auth provider and manually assigned roles, which increases security and clarity around role management.

If you prefer to manually set user organization roles, use `skip_org_role_sync` option in the Grafana configuration file of your OAuth provider.

Refer to the [release notes of Grafana 9.5](https://grafana.com/docs/grafana/latest/whatsnew/whats-new-in-v9-5/#auth-lock-organization-roles-synced-from-auth-providers) for context on the previous work done to build up to this change. Issue [#72204](https://github.com/grafana/grafana/issues/72204)

This change impacts GitHub OAuth, Gitlab OAuth, Okta OAuth and Generic OAuth

Currently if no organization role mapping is found for a user when connecting via OAuth, Grafana doesn’t update the user’s organization role.

With Grafana 10.1, on every login, if the role_attribute_path property does not return a role, then the user is assigned the role specified by [the auto_assign_org_role option](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#auto_assign_org_role).

To avoid overriding manually set roles, enable the `skip_org_role_sync` option in the Grafana configuration for your OAuth provider. Issue [#70766](https://github.com/grafana/grafana/issues/70766)

InfluxDB backend parser returns incompatible data with frontend. The data was being parsed by frontend and we moving towards migrating InfluxDB fully backend. One caveat is Frontend is generating data frames with fields `Time` and `Value`. The backend parser, however, generates `time` and `value`. This is causing issues and inconsistencies for the features (i.e. transformations) relying on those. In order to have a unique approach we choose to support what most of the users already have. Existing Transformations that depend on `time` fields have to be updated to use `Time` fields. Issue [#69865](https://github.com/grafana/grafana/issues/69865)

For accessibility reasons `tooltip` or `aria-label` are now required properties for `IconButton`. In order to continue to use `IconButton`, you must ensure all `IconButton` components have a corresponding tooltip or aria-label text. The tooltip text will also be used as the aria-label if you didn't set one separately. In case you add an aria-label the IconButton will not show a tooltip. Issue [#69699](https://github.com/grafana/grafana/issues/69699)

The implementation for template macro `${__series.name}` was not always correct, resulting in an interpolation that was very different from the series name displayed in the visualization. We have now fixed this issue so that it does show the same name. Depending on how `${__series.name}` is used this could result in a minor breaking change. Issue [#69621](https://github.com/grafana/grafana/issues/69621)

The data source template variable type has changed the way it represents its options. The `text` field still represents the data source name, but the `value` has been changed to the `uid` of the data source. This allows dashboards to declare the currently selected option by `uid`, however it changes how a datasource template variable value will be rendered by default. If the name of the data source is expected, the variable syntax will have to be changed to specify the [text format](https://grafana.com/docs/grafana/latest/dashboards/variables/variable-syntax/#text).

For example, given a data source variable (datasourceVariable), the following string:

```
${datasourceVariable}<br/>
Name: ${datasourceVariable:text}<br/>
UID: ${datasourceVariable:raw}
```

was previously interpolated as:

```
grafanacloud-k8smonitoring-prom
Name: grafanacloud-k8smonitoring-prom
UID: grafanacloud-k8smonitoring-prom
```

After these changes, it's interpolated as:

```
d7bbe725-9e48-4af8-a0cb-6cb255d873a3
Name: grafanacloud-k8smonitoring-prom
UID: d7bbe725-9e48-4af8-a0cb-6cb255d873a3
```

Any dashboards that are relying on the data source name being returned by `${datasourceVariable}` will have to update all their usages to `${datasourceVariable:text}` in order to get the previous behavior.

Affected use cases:

- Using `${datasourceVariable}` to display the data source name in text panel or in the panel title.
- Using `${datasourceVariable}` to use the data source name as part of the query content.

Unaffected use cases:

- Using the `${datasourceVariable}` to choose which data source to use for a query (through its data source picker) will not be affected since it can use both the name and the uid Issue [#69259](https://github.com/grafana/grafana/issues/69259)

We are changing the logic that creates `uid` in `LogRowModel`. Previously, for `uid` we used `id` field from log's data frame. Unfortunately, when users run multiple queries that returned duplicate logs data, `uid` was not unique which was causing bugs. To make `uid` unique across multiple queries that return duplicate logs data, we are now prepending `uid` with `refId` of query that produced the log line. We recommend not to rely on `LogRowModel` `uid` and instead use `dataFrame` `id` field. Issue [#68569](https://github.com/grafana/grafana/issues/68569)

The deprecated support for monitoring Grafana frontend using Sentry javascript agent has been removed in this release. If you have frontend logging enabled and are sending telemetry to Sentry by setting `sentry_dsn` configuration property, this will no longer work. Otherwise, if frontend logging is enabled, it will now automatically use Grafana Faro agent. Issue [#67493](https://github.com/grafana/grafana/issues/67493)

### Deprecations

The query parameter of Explore's `SplitOpen` function is deprecated (passed in `mapInternalLinkToExplore`). Please use the `queries` parameter instead, which allows passing multiple queries to `SplitOpen` function. To pass a single query to `SplitOpen` function, set the `queries` parameter to an array containing that single query.

Fixes: https://github.com/grafana/grafana/issues/62567 Issue [#71484](https://github.com/grafana/grafana/issues/71484)

Starting with 10.0, changing the folder UID is deprecated. It will be removed in a future release. Please avoid using it because it can result in folder losing its permissions. Issue [#68543](https://github.com/grafana/grafana/issues/68543)

### Plugin development fixes & changes

- **GrafanaUI:** Define tooltip or aria-label as required for IconButton. [#69699](https://github.com/grafana/grafana/issues/69699), [@L-M-K-B](https://github.com/L-M-K-B)
- **Select:** Performance improvements when opening menu and when hovering over options. [#69230](https://github.com/grafana/grafana/issues/69230), [@JoaoSilvaGrafana](https://github.com/JoaoSilvaGrafana)
- **ConfirmModal:** Ignore case for confirmation text. [#69000](https://github.com/grafana/grafana/issues/69000), [@ashharrison90](https://github.com/ashharrison90)
- **Grafana/ui:** Fix margin in RadioButtonGroup option when only icon is present. [#68899](https://github.com/grafana/grafana/issues/68899), [@aocenas](https://github.com/aocenas)

<!-- 10.1.0 END -->
<!-- 10.0.13 START -->

# 10.0.13 (2024-03-25)

### Bug fixes

- **Snapshots:** Require delete within same org (backport). [#84764](https://github.com/grafana/grafana/issues/84764), [@ryantxu](https://github.com/ryantxu)

<!-- 10.0.13 END -->
<!-- 10.0.12 START -->

# 10.0.12 (2024-03-06)

### Bug fixes

- **Auth:** Fix email verification bypass when using basic authentication. [#83493](https://github.com/grafana/grafana/issues/83493)

<!-- 10.0.12 END -->
<!-- 10.0.11 START -->

# 10.0.11 (2024-01-29)

### Bug fixes

- **Annotations:** Split cleanup into separate queries and deletes to avoid deadlocks on MySQL. [#80681](https://github.com/grafana/grafana/issues/80681), [@alexweav](https://github.com/alexweav)

<!-- 10.0.11 END -->
<!-- 10.0.10 START -->

# 10.0.10 (2023-12-18)

### Features and enhancements

- **Alerting:** Attempt to retry retryable errors. [#79210](https://github.com/grafana/grafana/issues/79210), [@gotjosh](https://github.com/gotjosh)
- **Unified Alerting:** Set `max_attempts` to 1 by default. [#79101](https://github.com/grafana/grafana/issues/79101), [@gotjosh](https://github.com/gotjosh)

### Bug fixes

- **Recorded Queries:** Add org isolation (remote write target per org), and fix cross org Delete/List. (Enterprise)

<!-- 10.0.10 END -->
<!-- 10.0.9 START -->

# 10.0.9 (2023-10-11)

### Features and enhancements

- **Chore:** Upgrade Go to 1.20.10. [#76365](https://github.com/grafana/grafana/issues/76365), [@zerok](https://github.com/zerok)

### Bug fixes

- **BrowseDashboards:** Only remember the most recent expanded folder. [#74819](https://github.com/grafana/grafana/issues/74819), [@joshhunt](https://github.com/joshhunt)
- **Licensing:** Pass func to update env variables when starting plugin. [#74679](https://github.com/grafana/grafana/issues/74679), [@leandro-deveikis](https://github.com/leandro-deveikis)
- **Nested folders:** Fix folder hierarchy in folder responses. [#74581](https://github.com/grafana/grafana/issues/74581), [@papagian](https://github.com/papagian)
- **RBAC:** Chore fix hasPermissionInOrg. (Enterprise)
- **Licensing:** Updated grpc plugin factory newPlugin signature. (Enterprise)

<!-- 10.0.9 END -->
<!-- 10.0.8 START -->

# 10.0.8 (2023-09-29)

### Features and enhancements

- **Azure:** Add support for Workload Identity authentication. [#75732](https://github.com/grafana/grafana/issues/75732), [@aangelisc](https://github.com/aangelisc)

<!-- 10.0.8 END -->
<!-- 10.0.6 START -->

# 10.0.6 (2023-09-18)

### Features and enhancements

- **Chore:** Upgrade Alpine base image to 3.18.3. [#74994](https://github.com/grafana/grafana/issues/74994), [@zerok](https://github.com/zerok)
- **Chore:** Upgrade Go to 1.20.8. [#74983](https://github.com/grafana/grafana/issues/74983), [@zerok](https://github.com/zerok)

<!-- 10.0.6 END -->
<!-- 10.0.5 START -->

# 10.0.5 (2023-09-05)

### Features and enhancements

- **SSE:** DSNode to update result with names to make each value identifiable by labels (only Graphite and TestData. [#73646](https://github.com/grafana/grafana/issues/73646), [@yuri-tceretian](https://github.com/yuri-tceretian)

### Bug fixes

- **LDAP:** Fix user disabling. [#74107](https://github.com/grafana/grafana/issues/74107), [@gamab](https://github.com/gamab)

<!-- 10.0.5 END -->
<!-- 10.0.4 START -->

# 10.0.4 (2023-08-22)

### Features and enhancements

- **Usage stats:** Tune collector execution startup and interval. [#72789](https://github.com/grafana/grafana/issues/72789), [@papagian](https://github.com/papagian)
- **Prometheus:** Add present_over_time syntax highlighting. [#72368](https://github.com/grafana/grafana/issues/72368), [@arnaudlemaignen](https://github.com/arnaudlemaignen)
- **Alerting:** Improve performance of matching captures. [#71999](https://github.com/grafana/grafana/issues/71999), [@grobinson-grafana](https://github.com/grobinson-grafana)

### Bug fixes

- **AzureMonitor:** Allow `serviceTags` and `tags` to be empty for trace results. [#73196](https://github.com/grafana/grafana/issues/73196), [@aangelisc](https://github.com/aangelisc)
- **Cloud Monitoring:** Support AliasBy property in MQL mode. [#73165](https://github.com/grafana/grafana/issues/73165), [@alyssabull](https://github.com/alyssabull)
- **Alerting:** Exclude expression refIDs from NoData state. [#72394](https://github.com/grafana/grafana/issues/72394), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Fix state manager to not keep datasource_uid and ref_id labels in state after Error. [#72393](https://github.com/grafana/grafana/issues/72393), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Dashboard:** New Datasource picker link is keyboard accessible. [#72371](https://github.com/grafana/grafana/issues/72371), [@polibb](https://github.com/polibb)
- **AzureMonitor:** Fix ResourcePicker hanging. [#72357](https://github.com/grafana/grafana/issues/72357), [@asimpson](https://github.com/asimpson)
- **Alerting:** Fix refetching grafana rules on alert list panel. [#72333](https://github.com/grafana/grafana/issues/72333), [@konrad147](https://github.com/konrad147)
- **Alerting:** Fix contact point testing with secure settings. [#72282](https://github.com/grafana/grafana/issues/72282), [@JacobsonMT](https://github.com/JacobsonMT)
- **TimeSeries:** Fix zoom not working after editing panel. [#72224](https://github.com/grafana/grafana/issues/72224), [@leeoniya](https://github.com/leeoniya)
- **CloudMonitoring:** Correctly set title and text fields for annotations. [#72153](https://github.com/grafana/grafana/issues/72153), [@aangelisc](https://github.com/aangelisc)

<!-- 10.0.4 END -->
<!-- 10.0.3 START -->

# 10.0.3 (2023-07-26)

### Features and enhancements

- **Alerting:** Sort NumberCaptureValues in EvaluationString. [#71931](https://github.com/grafana/grafana/issues/71931), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** No longer silence paused alerts during legacy migration. [#71761](https://github.com/grafana/grafana/issues/71761), [@JacobsonMT](https://github.com/JacobsonMT)
- **Auth:** Add support for custom signing keys in auth.azure_ad. [#71708](https://github.com/grafana/grafana/issues/71708), [@Jguer](https://github.com/Jguer)
- **Chore:** Upgrade Go to 1.20.6. [#71445](https://github.com/grafana/grafana/issues/71445), [@sakjur](https://github.com/sakjur)
- **Auth:** Remove ldap init sync. (Enterprise)
- **Chore:** Upgrade Go to 1.20.6. (Enterprise)

### Bug fixes

- **Alerting:** Fix edit / view of webhook contact point when no authorization is set. [#71972](https://github.com/grafana/grafana/issues/71972), [@gillesdemey](https://github.com/gillesdemey)
- **AzureMonitor:** Set timespan in Logs Portal URL link. [#71910](https://github.com/grafana/grafana/issues/71910), [@aangelisc](https://github.com/aangelisc)
- **AzureMonitor:** Fix resource selection growing over resource selection table. [#71862](https://github.com/grafana/grafana/issues/71862), [@adamyeats](https://github.com/adamyeats)
- **Plugins:** Only configure plugin proxy transport once. [#71742](https://github.com/grafana/grafana/issues/71742), [@wbrowne](https://github.com/wbrowne)
- **Elasticsearch:** Fix multiple max depth flatten of multi-level objects. [#71636](https://github.com/grafana/grafana/issues/71636), [@fridgepoet](https://github.com/fridgepoet)
- **Elasticsearch:** Fix histogram colors in backend mode. [#71447](https://github.com/grafana/grafana/issues/71447), [@gabor](https://github.com/gabor)
- **Alerting:** Fix state in expressions footer. [#71443](https://github.com/grafana/grafana/issues/71443), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **AppChromeService:** Fixes update to breadcrumb parent URL. [#71418](https://github.com/grafana/grafana/issues/71418), [@torkelo](https://github.com/torkelo)
- **Elasticsearch:** Fix using multiple indexes with comma separated string. [#71322](https://github.com/grafana/grafana/issues/71322), [@gabor](https://github.com/gabor)
- **Alerting:** Fix Alertmanager change detection for receivers with secure settings. [#71320](https://github.com/grafana/grafana/issues/71320), [@JacobsonMT](https://github.com/JacobsonMT)
- **Transformations:** Fix `extractFields` throwing Error if one value is undefined or null. [#71267](https://github.com/grafana/grafana/issues/71267), [@svennergr](https://github.com/svennergr)
- **XYChart:** Point size editor should reflect correct default (5). [#71229](https://github.com/grafana/grafana/issues/71229), [@Develer](https://github.com/Develer)
- **Annotations:** Fix database lock while updating annotations. [#71207](https://github.com/grafana/grafana/issues/71207), [@sakjur](https://github.com/sakjur)
- **TimePicker:** Fix issue with previous fiscal quarter not parsing correctly. [#71093](https://github.com/grafana/grafana/issues/71093), [@ashharrison90](https://github.com/ashharrison90)
- **AzureMonitor:** Correctly build multi-resource queries for Application Insights components. [#71039](https://github.com/grafana/grafana/issues/71039), [@aangelisc](https://github.com/aangelisc)
- **AzureMonitor:** Fix metric names for multi-resources. [#70994](https://github.com/grafana/grafana/issues/70994), [@asimpson](https://github.com/asimpson)
- **Logs:** Do not insert log-line into log-fields in json download. [#70954](https://github.com/grafana/grafana/issues/70954), [@gabor](https://github.com/gabor)
- **Loki:** Fix wrong query expression with inline comments. [#70948](https://github.com/grafana/grafana/issues/70948), [@svennergr](https://github.com/svennergr)
- **License:** Enable FeatureUserLimit for all products. (Enterprise)

<!-- 10.0.3 END -->
<!-- 10.0.2 START -->

# 10.0.2 (2023-07-11)

### Features and enhancements

- **Alerting:** Add limit query parameter to Loki-based ASH api, drop default limit from 5000 to 1000, extend visible time range for new ASH UI. [#70857](https://github.com/grafana/grafana/issues/70857), [@alexweav](https://github.com/alexweav)
- **Alerting:** Move rule UID from Loki stream labels into log lines. [#70686](https://github.com/grafana/grafana/issues/70686), [@rwwiv](https://github.com/rwwiv)
- **Explore:** Clean up query subscriptions when a query is canceled. [#70516](https://github.com/grafana/grafana/issues/70516), [@ifrost](https://github.com/ifrost)
- **Alerting:** Allow selecting the same custom group when swapping folders. [#70369](https://github.com/grafana/grafana/issues/70369), [@gillesdemey](https://github.com/gillesdemey)

### Bug fixes

- **Fix:** Change getExistingDashboardByTitleAndFolder to get dashboard by title, not slug. [#70936](https://github.com/grafana/grafana/issues/70936), [@yangkb09](https://github.com/yangkb09)
- **Login:** Fix footer from displaying under the login box. [#70909](https://github.com/grafana/grafana/issues/70909), [@joshhunt](https://github.com/joshhunt)
- **Alerting:** Convert 'Both' type Prometheus queries to 'Range' in migration. [#70854](https://github.com/grafana/grafana/issues/70854), [@JacobsonMT](https://github.com/JacobsonMT)
- **Variables:** Detect a name for duplicated variable. [#70823](https://github.com/grafana/grafana/issues/70823), [@Ugzuzg](https://github.com/Ugzuzg)
- **Logs:** Fix wrong `before` and `after` texts in log context. [#70802](https://github.com/grafana/grafana/issues/70802), [@svennergr](https://github.com/svennergr)
- **Elasticsearch:** Make it compatible with the new log context functionality. [#70748](https://github.com/grafana/grafana/issues/70748), [@gabor](https://github.com/gabor)
- **Alerting:** Fix HA alerting membership sync. [#70700](https://github.com/grafana/grafana/issues/70700), [@jcalisto](https://github.com/jcalisto)
- **Alerting:** Display correct results when using different filters on alerting panels. [#70639](https://github.com/grafana/grafana/issues/70639), [@VikaCep](https://github.com/VikaCep)
- **XYChart:** Fix axis range and scale overrides. [#70614](https://github.com/grafana/grafana/issues/70614), [@leeoniya](https://github.com/leeoniya)
- **LogContext:** Fix filtering out log lines with the same entry. [#70569](https://github.com/grafana/grafana/issues/70569), [@svennergr](https://github.com/svennergr)
- **Dashboard:** Fix issue where a panel with a description and a cached response displays 2 info icons. [#70566](https://github.com/grafana/grafana/issues/70566), [@axelavargas](https://github.com/axelavargas)
- **Navigation:** Fix toolbar actions flickering on mobile. [#70564](https://github.com/grafana/grafana/issues/70564), [@ashharrison90](https://github.com/ashharrison90)
- **XYChart:** Ensure color scale is field-local and synced with data updates. [#70481](https://github.com/grafana/grafana/issues/70481), [@leeoniya](https://github.com/leeoniya)
- **Alerting:** Fix unique violation when updating rule group with title chains/cycles. [#70467](https://github.com/grafana/grafana/issues/70467), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Add file and rule_group query params in request for filtering the res…. [#70417](https://github.com/grafana/grafana/issues/70417), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **SAML UI:** Enforce one option for configuring IdP metadata. (Enterprise)

### Plugin development fixes & changes

- **Grafana UI:** Fix behaviour regression on Tooltip component. [#70742](https://github.com/grafana/grafana/issues/70742), [@eledobleefe](https://github.com/eledobleefe)

<!-- 10.0.2 END -->
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
- **TextPanel:** Fix &lt;summary&gt; styling missing the disclosure triangle. [#70138](https://github.com/grafana/grafana/issues/70138), [@joshhunt](https://github.com/joshhunt)
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

The deprecated `plugin:create` and `component:create` commands in the Grafana Toolkit have been removed in this release. The replacement `create-plugin` tool is recommended for [scaffolding new plugins](https://grafana.com/developers/plugin-tools/) and a migration guide for moving from the toolkit is available [here](https://grafana.com/developers/plugin-tools/migration-guides/migrate-from-toolkit). Issue [#66729](https://github.com/grafana/grafana/issues/66729)

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
