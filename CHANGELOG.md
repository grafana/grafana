<!-- 11.6.5 START -->

# 11.6.5 (2025-08-13)

### Features and enhancements

- **Alerting:** Bump alerting package to include change to NewTLSClient [#108817](https://github.com/grafana/grafana/pull/108817), [@rwwiv](https://github.com/rwwiv)
- **Go:** Update to 1.24.6 [#109314](https://github.com/grafana/grafana/pull/109314), [@Proximyst](https://github.com/Proximyst)

<!-- 11.6.5 END -->
<!-- 11.6.4 START -->

# 11.6.4 (2025-07-23)

### Features and enhancements

- **Dependencies:** Bump github.com/go-viper/mapstructure/v2 from 2.2.1 to 2.3.0 [#107555](https://github.com/grafana/grafana/pull/107555), [@macabu](https://github.com/macabu)
- **StateTimeline:** Add endTime to tooltip [#107605](https://github.com/grafana/grafana/pull/107605), [@adela-almasan](https://github.com/adela-almasan)
- **Unified storage:** Respect GF_DATABASE_URL override [#107573](https://github.com/grafana/grafana/pull/107573), [@pstibrany](https://github.com/pstibrany)

### Bug fixes

- **Alerting:** Fix group interval override when adding new rules [#107496](https://github.com/grafana/grafana/pull/107496), [@konrad147](https://github.com/konrad147)
- **Azure:** Fix legend formatting [#106934](https://github.com/grafana/grafana/pull/106934), [@aangelisc](https://github.com/aangelisc)
- **Azure:** Fix resource name determination in template variable queries [#106939](https://github.com/grafana/grafana/pull/106939), [@aangelisc](https://github.com/aangelisc)
- **Graphite:** Fix annotation queries [#106940](https://github.com/grafana/grafana/pull/106940), [@aangelisc](https://github.com/aangelisc)
- **Graphite:** Fix date mutation [#107523](https://github.com/grafana/grafana/pull/107523), [@aangelisc](https://github.com/aangelisc)
- **Graphite:** Fix nested variable interpolation for repeated rows [#107564](https://github.com/grafana/grafana/pull/107564), [@aangelisc](https://github.com/aangelisc)
- **Security:** Fixes for CVE-2025-6197 and CVE-2025-6023 [#108281](https://github.com/grafana/grafana/pull/108281), [@volcanonoodle](https://github.com/volcanonoodle)

<!-- 11.6.4 END -->
<!-- 11.6.3 START -->

# 11.6.3 (2025-06-17)

### Bug fixes

- **Security:** Fixes CVE-2025-3415

<!-- 11.6.3 END -->
<!-- 11.6.2 START -->

# 11.6.2 (2025-05-22)

### Features and enhancements

- **Chore:** Bump Go version to 1.24.3 [#105103](https://github.com/grafana/grafana/pull/105103), [@macabu](https://github.com/macabu)
- **Dependencies:** Bump github.com/blevesearch/bleve/v2 from v2.4.4-git to v2.5.0 [#105443](https://github.com/grafana/grafana/pull/105443), [@macabu](https://github.com/macabu)
- **Dependencies:** Bump github.com/openfga/openfga from v1.8.6 to v1.8.12 [#105369](https://github.com/grafana/grafana/pull/105369), [@macabu](https://github.com/macabu)
- **Dependencies:** Unpin and bump github.com/getkin/kin-openapi from v0.126.0 to v0.132.0 [#105251](https://github.com/grafana/grafana/pull/105251), [@macabu](https://github.com/macabu)

### Bug fixes

- **Dashboard:** Fixes issue with row repeats and first row [#104467](https://github.com/grafana/grafana/pull/104467), [@torkelo](https://github.com/torkelo)
- **Graphite:** Ensure template variables are interpolated correctly [#105388](https://github.com/grafana/grafana/pull/105388), [@aangelisc](https://github.com/aangelisc)
- **Graphite:** Fix Graphite series interpolation [#104568](https://github.com/grafana/grafana/pull/104568), [@aangelisc](https://github.com/aangelisc)
- **Prometheus:** Fix semver import path [#104943](https://github.com/grafana/grafana/pull/104943), [@jackw](https://github.com/jackw)
- **Security:** Fix CVE-2025-3454
- **Security:** Fix CVE-2025-2703

<!-- 11.6.2 END -->
<!-- 11.6.1 START -->

# 11.6.1 (2025-04-23)

### Features and enhancements

- **Chore:** Update JWT library (CVE-2025-30204) [#102727](https://github.com/grafana/grafana/pull/102727), [@grambbledook](https://github.com/grambbledook)
- **DashboardScenePage:** Correct slug in self referencing data links [#103854](https://github.com/grafana/grafana/pull/103854), [@Sergej-Vlasov](https://github.com/Sergej-Vlasov)
- **Dependencies:** Bump github.com/redis/go-redis/v9 to 9.7.3 to address CVE-2025-29923 [#102863](https://github.com/grafana/grafana/pull/102863), [@macabu](https://github.com/macabu)
- **Go:** Bump to 1.24.2 [#103523](https://github.com/grafana/grafana/pull/103523), [@Proximyst](https://github.com/Proximyst)
- **Go:** Bump to 1.24.2 (Enterprise)
- **GrafanaUI:** Use safePolygon close handler for interactive tooltips instead of a delay [#102869](https://github.com/grafana/grafana/pull/102869), [@mthorning](https://github.com/mthorning)
- **Prometheus:** Add support for cloud partners Prometheus data sources [#103941](https://github.com/grafana/grafana/pull/103941), [@kevinwcyu](https://github.com/kevinwcyu)

### Bug fixes

- **Alertmanager:** Add Role-Based Access Control via reqAction Field [#103479](https://github.com/grafana/grafana/pull/103479), [@olegpixel](https://github.com/olegpixel)
- **GrafanaUI:** Remove blurred background from overlay backdrops to improve performance [#103647](https://github.com/grafana/grafana/pull/103647), [@joshhunt](https://github.com/joshhunt)
- **InfluxDB:** Fix nested variable interpolation [#104096](https://github.com/grafana/grafana/pull/104096), [@aangelisc](https://github.com/aangelisc)
- **LDAP test:** Fix page crash [#102684](https://github.com/grafana/grafana/pull/102684), [@ashharrison90](https://github.com/ashharrison90)
- **Org redirection:** Fix linking between orgs [#102870](https://github.com/grafana/grafana/pull/102870), [@ashharrison90](https://github.com/ashharrison90)
- **Security:** Fix CVE-2025-3454
- **Security:** Fix CVE-2025-2703
- **Security:** Fix CVE-2025-3260

<!-- 11.6.1 END -->
<!-- 11.6.0 START -->

# 11.6.0 (2025-03-25)

### Features and enhancements

- **API keys:** Migrate API keys to service accounts at startup [#96924](https://github.com/grafana/grafana/pull/96924), [@dmihai](https://github.com/dmihai)
- **AccessControl:** Allow plugin roles to include `plugins:write` [#101089](https://github.com/grafana/grafana/pull/101089), [@gamab](https://github.com/gamab)
- **Alerting:** Add DAG errors to alert rule creation and view [#99423](https://github.com/grafana/grafana/pull/99423), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Add Jira integration to cloud AMs [#100482](https://github.com/grafana/grafana/pull/100482), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Add alert rule version history - part1 [#99490](https://github.com/grafana/grafana/pull/99490), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Add migration to clean up rule versions table [#102562](https://github.com/grafana/grafana/pull/102562), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Add multiple threshold operators [#99516](https://github.com/grafana/grafana/pull/99516), [@paulojmdias](https://github.com/paulojmdias)
- **Alerting:** Add tracking for the mode used in query and notifications step when c… [#100824](https://github.com/grafana/grafana/pull/100824), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Adding color option for slack receiver [#99615](https://github.com/grafana/grafana/pull/99615), [@wymangr](https://github.com/wymangr)
- **Alerting:** Allow selection of recording rule write target on per-rule basis. [#101778](https://github.com/grafana/grafana/pull/101778), [@stevesg](https://github.com/stevesg)
- **Alerting:** Allow specifying uid for new rules added to groups [#99858](https://github.com/grafana/grafana/pull/99858), [@moustafab](https://github.com/moustafab)
- **Alerting:** Improve template testing by trying non-root scopes [#101471](https://github.com/grafana/grafana/pull/101471), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Include time range in template dashboard and panel urls [#101095](https://github.com/grafana/grafana/pull/101095), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Keep the latest version of deleted rule in version table [#101481](https://github.com/grafana/grafana/pull/101481), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Promote alertingSaveStateCompressed flag to public preview [#99935](https://github.com/grafana/grafana/pull/99935), [@alexander-akhmetov](https://github.com/alexander-akhmetov)
- **Alerting:** Remove ID and OrgID from hash calculation [#100140](https://github.com/grafana/grafana/pull/100140), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Remove feature toggle alertingNoNormalState [#99905](https://github.com/grafana/grafana/pull/99905), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Remove rule group edit from single rule editor [#100191](https://github.com/grafana/grafana/pull/100191), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Return 404 when /api/ruler/grafana/api/v1/rules/{Namespace}/{Groupname} does not exist [#100264](https://github.com/grafana/grafana/pull/100264), [@fayzal-g](https://github.com/fayzal-g)
- **Alerting:** Rule history restore feature [#100609](https://github.com/grafana/grafana/pull/100609), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Support Jira Integration [#100480](https://github.com/grafana/grafana/pull/100480), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Track if new gm rules are created with queries and expressions transformable to simple mode [#101121](https://github.com/grafana/grafana/pull/101121), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Update IRM copies in Configuration Tracker [#100069](https://github.com/grafana/grafana/pull/100069), [@teodosii](https://github.com/teodosii)
- **Alerting:** Update design of rule details tab and add `updated by` [#99895](https://github.com/grafana/grafana/pull/99895), [@tomratcliffe](https://github.com/tomratcliffe)
- **Alerting:** Update irm links for incident and oncall in case new irm plugin is present [#99952](https://github.com/grafana/grafana/pull/99952), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Use exponential backoff in the remote Alertmanager readiness check [#99756](https://github.com/grafana/grafana/pull/99756), [@santihernandezc](https://github.com/santihernandezc)
- **Alerting:** Use uid instead of id in AnnotationsStateHistory [#101207](https://github.com/grafana/grafana/pull/101207), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Auth:** Add IP address login attempt validation [#98123](https://github.com/grafana/grafana/pull/98123), [@colin-stuart](https://github.com/colin-stuart)
- **Auth:** Add support for the TlsSkipVerify parameter to JWT Auth [#91514](https://github.com/grafana/grafana/pull/91514), [@Ret2Me](https://github.com/Ret2Me)
- **Auth:** Make ssoSettingsSAML GA and enabled by default [#101766](https://github.com/grafana/grafana/pull/101766), [@mgyongyosi](https://github.com/mgyongyosi)
- **Azure Monitor:** Filter namespaces by resource group [#100325](https://github.com/grafana/grafana/pull/100325), [@alyssabull](https://github.com/alyssabull)
- **Azure:** Resource picker improvements [#101462](https://github.com/grafana/grafana/pull/101462), [@aangelisc](https://github.com/aangelisc)
- **Azure:** Variable editor and resource picker improvements [#101695](https://github.com/grafana/grafana/pull/101695), [@alyssabull](https://github.com/alyssabull)
- **Badge:** Add darkgrey color [#100699](https://github.com/grafana/grafana/pull/100699), [@Clarity-89](https://github.com/Clarity-89)
- **Canvas:** One click links and actions [#99616](https://github.com/grafana/grafana/pull/99616), [@adela-almasan](https://github.com/adela-almasan)
- **Chore:** Bump Go to 1.23.7 [#101576](https://github.com/grafana/grafana/pull/101576), [@macabu](https://github.com/macabu)
- **Chore:** Bump Go to 1.23.7 (Enterprise)
- **Chore:** Bump github.com/expr-lang/expr to v1.17.0 to address CVE-2025-29786 [#102533](https://github.com/grafana/grafana/pull/102533), [@macabu](https://github.com/macabu)
- **Chore:** Remove `sqlQuerybuilderFunctionParameters` feature toggle [#100809](https://github.com/grafana/grafana/pull/100809), [@zoltanbedi](https://github.com/zoltanbedi)
- **CloudWatch:** Track Logs Insights query language [#100254](https://github.com/grafana/grafana/pull/100254), [@idastambuk](https://github.com/idastambuk)
- **Configuration tracker:** Update copy in IRM and point to new IRM slack integration [#100440](https://github.com/grafana/grafana/pull/100440), [@teodosii](https://github.com/teodosii)
- **Dashboard:** Folder move unexpected behavior [#100394](https://github.com/grafana/grafana/pull/100394), [@yincongcyincong](https://github.com/yincongcyincong)
- **Dashboards:** Allow custom quick time ranges specified in dashboard model [#93724](https://github.com/grafana/grafana/pull/93724), [@sknaumov](https://github.com/sknaumov)
- **Dashboards:** Monitor dashboard loading performance [#99629](https://github.com/grafana/grafana/pull/99629), [@dprokop](https://github.com/dprokop)
- **Dashboards:** Remove default empty string from variable create view [#98922](https://github.com/grafana/grafana/pull/98922), [@yincongcyincong](https://github.com/yincongcyincong)
- **Dashboards:** WeekStart is now of type WeekStart | undefined instead of string [#101123](https://github.com/grafana/grafana/pull/101123), [@oscarkilhed](https://github.com/oscarkilhed)
- **DesignSystem:** Menu and popover styling update to use new elevated background token [#100255](https://github.com/grafana/grafana/pull/100255), [@torkelo](https://github.com/torkelo)
- **Docker:** Use our own glibc 2.40 binaries [#99903](https://github.com/grafana/grafana/pull/99903), [@DanCech](https://github.com/DanCech)
- **Docs:** Add a note on query caching for Cloudwatch datasource [#100180](https://github.com/grafana/grafana/pull/100180), [@idastambuk](https://github.com/idastambuk)
- **Drilldown:** Require `datasources:explore` RBAC action [#101366](https://github.com/grafana/grafana/pull/101366), [@svennergr](https://github.com/svennergr)
- **Elasticsearch:** Remove frontend testDatasource method [#99894](https://github.com/grafana/grafana/pull/99894), [@idastambuk](https://github.com/idastambuk)
- **Elasticsearch:** Replace level in adhoc filters with level field name [#100315](https://github.com/grafana/grafana/pull/100315), [@iwysiu](https://github.com/iwysiu)
- **Elasticsearch:** Replace term size dropdown with text input [#99718](https://github.com/grafana/grafana/pull/99718), [@iwysiu](https://github.com/iwysiu)
- **Explore:** Add `hide_logs_download` and hide button to download logs [#99512](https://github.com/grafana/grafana/pull/99512), [@svennergr](https://github.com/svennergr)
- **Explore:** Move drilldown apps from Explore to a new navbar item "Drilldown" [#100409](https://github.com/grafana/grafana/pull/100409), [@adrapereira](https://github.com/adrapereira)
- **ExploreMetrics:** Add toggle to enable routing to externalized Explore Metrics app plugin [#99481](https://github.com/grafana/grafana/pull/99481), [@NWRichmond](https://github.com/NWRichmond)
- **Feat:** OSS connections page state filter and update all added [#100688](https://github.com/grafana/grafana/pull/100688), [@s4kh](https://github.com/s4kh)
- **Features:** Remove openSearchBackendFlowEnabled feature toggle [#99068](https://github.com/grafana/grafana/pull/99068), [@idastambuk](https://github.com/idastambuk)
- **Folders:** Add validation that folder is not a parent of itself [#101569](https://github.com/grafana/grafana/pull/101569), [@stephaniehingtgen](https://github.com/stephaniehingtgen)
- **Geomap:** WebGL for Marker Layer [#95457](https://github.com/grafana/grafana/pull/95457), [@drew08t](https://github.com/drew08t)
- **Grafana/ui:** Export UsersIndicator [#100698](https://github.com/grafana/grafana/pull/100698), [@Clarity-89](https://github.com/Clarity-89)
- **Graphite:** Compare query builder query to raw query [#101104](https://github.com/grafana/grafana/pull/101104), [@bossinc](https://github.com/bossinc)
- **Histogram:** Handle multiple native histograms [#98404](https://github.com/grafana/grafana/pull/98404), [@domasx2](https://github.com/domasx2)
- **Image Renderer:** Add support for SSL in plugin mode [#98009](https://github.com/grafana/grafana/pull/98009), [@nmarrs](https://github.com/nmarrs)
- **ImportDashboards:** Use NestedFolderPicker [#99696](https://github.com/grafana/grafana/pull/99696), [@joshhunt](https://github.com/joshhunt)
- **Loki:** Removal of `Resolution` in query editors [#101860](https://github.com/grafana/grafana/pull/101860), [@svennergr](https://github.com/svennergr)
- **Menu:** Uniform padding to make menu item hover state look better [#100275](https://github.com/grafana/grafana/pull/100275), [@torkelo](https://github.com/torkelo)
- **MetricsDrilldown:** Update name of queryless metrics experience [#100675](https://github.com/grafana/grafana/pull/100675), [@yangkb09](https://github.com/yangkb09)
- **MultiCombobox:** Export from grafana/ui [#100368](https://github.com/grafana/grafana/pull/100368), [@Clarity-89](https://github.com/Clarity-89)
- **NodeGraph:** Improve view traces for uninstrumented services [#98442](https://github.com/grafana/grafana/pull/98442), [@edvard-falkskar](https://github.com/edvard-falkskar)
- **PluginExtensions:** Added support for sharing functions [#98888](https://github.com/grafana/grafana/pull/98888), [@theSuess](https://github.com/theSuess)
- **PluginExtensions:** Added support for sharing functions (Enterprise)
- **PluginExtensions:** Exposing registry meta for components returned via `usePluginComponents` [#100587](https://github.com/grafana/grafana/pull/100587), [@mckn](https://github.com/mckn)
- **Plugins:** Improve plugin details UX for core plugins [#99830](https://github.com/grafana/grafana/pull/99830), [@oshirohugo](https://github.com/oshirohugo)
- **Plugins:** Remove managedPluginsInstall feature toggle [#100416](https://github.com/grafana/grafana/pull/100416), [@oshirohugo](https://github.com/oshirohugo)
- **Plugins:** Remove managedPluginsInstall feature toggle (Enterprise)
- **Plugins:** Remove uninstall plugin step from cli plugins update-all [#101632](https://github.com/grafana/grafana/pull/101632), [@oshirohugo](https://github.com/oshirohugo)
- **Prometheus:** Get the utcOffset value of timezone when it's specified [#99910](https://github.com/grafana/grafana/pull/99910), [@itsmylife](https://github.com/itsmylife)
- **Prometheus:** Remove query assistant and related components [#100669](https://github.com/grafana/grafana/pull/100669), [@edwardcqian](https://github.com/edwardcqian)
- **QueryOptions:** Handle invalid time shift values [#101670](https://github.com/grafana/grafana/pull/101670), [@ivanortegaalba](https://github.com/ivanortegaalba)
- **RBAC:** Remove accessControlOnCall feature toggle [#101222](https://github.com/grafana/grafana/pull/101222), [@gamab](https://github.com/gamab)
- **RBAC:** Remove accessControlOnCall feature toggle (Enterprise)
- **Reporting:** Add email subject support (Enterprise)
- **Security:** Update to Go 1.23.5 (Enterprise)
- **Tempo:** Support TraceQL instant metrics queries [#99732](https://github.com/grafana/grafana/pull/99732), [@joey-grafana](https://github.com/joey-grafana)
- **Tempo:** TraceQL metrics streaming [#99037](https://github.com/grafana/grafana/pull/99037), [@adrapereira](https://github.com/adrapereira)
- **Time regions:** Add option for cron syntax to support complex schedules [#99548](https://github.com/grafana/grafana/pull/99548), [@leeoniya](https://github.com/leeoniya)
- **TimePicker:** Ability to manually specify quick ranges [#101465](https://github.com/grafana/grafana/pull/101465), [@Sergej-Vlasov](https://github.com/Sergej-Vlasov)
- **TimeRangePicker:** Options list padding [#100343](https://github.com/grafana/grafana/pull/100343), [@torkelo](https://github.com/torkelo)
- **TopNav:** Move news into profile menu [#99535](https://github.com/grafana/grafana/pull/99535), [@bergquist](https://github.com/bergquist)
- **Trace View:** Add link from the Trace View to the Profiles Drilldown [#101422](https://github.com/grafana/grafana/pull/101422), [@joey-grafana](https://github.com/joey-grafana)
- **Transformation:** Add support for variables to ALL transformations [#100225](https://github.com/grafana/grafana/pull/100225), [@dprokop](https://github.com/dprokop)
- **Transformations:** Add round() to Unary mode of `Add field from calc` [#101295](https://github.com/grafana/grafana/pull/101295), [@leeoniya](https://github.com/leeoniya)
- **VizActions:** Add confirmation message [#100012](https://github.com/grafana/grafana/pull/100012), [@adela-almasan](https://github.com/adela-almasan)
- **grafana-ui:** Update InlineField error prop type to React.ReactNode [#100347](https://github.com/grafana/grafana/pull/100347), [@Clarity-89](https://github.com/Clarity-89)

### Bug fixes

- **Alerting:** Add error handling for missing data source [#101508](https://github.com/grafana/grafana/pull/101508), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Call RLock() before reading sendAlertsTo map [#99812](https://github.com/grafana/grafana/pull/99812), [@santihernandezc](https://github.com/santihernandezc)
- **Alerting:** Disable create rule menu item from panel when unifiedAlerting is disabled [#100701](https://github.com/grafana/grafana/pull/100701), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Fix KeyValueMap input bug [#101367](https://github.com/grafana/grafana/pull/101367), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Fix crash when invalid matcher is used in silence query params [#101500](https://github.com/grafana/grafana/pull/101500), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Fix evaluation of rules with no-op math expressions [#101436](https://github.com/grafana/grafana/pull/101436), [@moustafab](https://github.com/moustafab)
- **Alerting:** Fix exporting new rule with a new group [#101404](https://github.com/grafana/grafana/pull/101404), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Fix fieldSelector encoding [#99751](https://github.com/grafana/grafana/pull/99751), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Fix inheritance of the timing options for policy tree [#99398](https://github.com/grafana/grafana/pull/99398), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Fix notification templates layout [#101232](https://github.com/grafana/grafana/pull/101232), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Fix state reason [#101530](https://github.com/grafana/grafana/pull/101530), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Fix token-based Slack image upload to work with channel names [#100988](https://github.com/grafana/grafana/pull/100988), [@JacobsonMT](https://github.com/JacobsonMT)
- **App Platform:** Pin bleve to fix CVE-2022-31022 [#102531](https://github.com/grafana/grafana/pull/102531), [@Proximyst](https://github.com/Proximyst)
- **App:** Fix web app behaviour on iOS [#100382](https://github.com/grafana/grafana/pull/100382), [@ashharrison90](https://github.com/ashharrison90)
- **Auth:** Fix AzureAD config UI's ClientAuthentication dropdown [#100752](https://github.com/grafana/grafana/pull/100752), [@mgyongyosi](https://github.com/mgyongyosi)
- **Auth:** Fix redirect with JWT auth URL login [#100295](https://github.com/grafana/grafana/pull/100295), [@mgyongyosi](https://github.com/mgyongyosi)
- **AuthN:** Refetch user on "ErrUserAlreadyExists" [#100346](https://github.com/grafana/grafana/pull/100346), [@kalleep](https://github.com/kalleep)
- **Caching:** Fix duplicate metric registration for cache size (Enterprise)
- **CloudWatch:** Fix condition for running annotation queries to require dimensions [#101660](https://github.com/grafana/grafana/pull/101660), [@kevinwcyu](https://github.com/kevinwcyu)
- **Combobox:** Fix list not being virtualized initially in some cases [#100188](https://github.com/grafana/grafana/pull/100188), [@tskarhed](https://github.com/tskarhed)
- **Dashboard:** Fix for overwriting an edited dashboard in the old architecture [#100247](https://github.com/grafana/grafana/pull/100247), [@bfmatei](https://github.com/bfmatei)
- **Dashboard:** Fix the unintentional time range and variables updates on saving [#101475](https://github.com/grafana/grafana/pull/101475), [@harisrozajac](https://github.com/harisrozajac)
- **Dashboard:** Playlist - Fix issue with back button [#99401](https://github.com/grafana/grafana/pull/99401), [@yincongcyincong](https://github.com/yincongcyincong)
- **DashboardList:** Throttle the re-renders [#99982](https://github.com/grafana/grafana/pull/99982), [@bfmatei](https://github.com/bfmatei)
- **Dashboards:** Bring back scripted dashboards [#100575](https://github.com/grafana/grafana/pull/100575), [@dprokop](https://github.com/dprokop)
- **Dashboards:** Fix missing `v/e/i` keybindings to return back to dashboard [#102364](https://github.com/grafana/grafana/pull/102364), [@mdvictor](https://github.com/mdvictor)
- **Explore:** Fix resizing split view with Loki query editor [#100257](https://github.com/grafana/grafana/pull/100257), [@ifrost](https://github.com/ifrost)
- **ExploreMetrics:** Fix escaping of regex metacharacters in label filters [#100513](https://github.com/grafana/grafana/pull/100513), [@NWRichmond](https://github.com/NWRichmond)
- **Fix:** Optimise frontend Postgresql plugin cache busting [#100406](https://github.com/grafana/grafana/pull/100406), [@jackw](https://github.com/jackw)
- **InfluxDB:** Improve handling of template variables contained in regular expressions (InfluxQL) [#100762](https://github.com/grafana/grafana/pull/100762), [@aangelisc](https://github.com/aangelisc)
- **Interval variable:** Fix $\_\_auto value behavior [#100479](https://github.com/grafana/grafana/pull/100479), [@yincongcyincong](https://github.com/yincongcyincong)
- **Log Context:** Fix bug where variables are not replaced in dashboards [#100433](https://github.com/grafana/grafana/pull/100433), [@svennergr](https://github.com/svennergr)
- **OpenTSDB:** Support v2.4 [#100673](https://github.com/grafana/grafana/pull/100673), [@aangelisc](https://github.com/aangelisc)
- **PDF:** Fix repeating panels when there are less items than maxPerRow (Enterprise)
- **Plugin Metrics:** Eliminate data race in plugin metrics middleware [#99396](https://github.com/grafana/grafana/pull/99396), [@clord](https://github.com/clord)
- **Plugins:** Fix update button behavior on downgrade [#101048](https://github.com/grafana/grafana/pull/101048), [@oshirohugo](https://github.com/oshirohugo)
- **Plugins:** Fix version tab breaking for non semantic version [#101225](https://github.com/grafana/grafana/pull/101225), [@oshirohugo](https://github.com/oshirohugo)
- **PromLib:** Take AdHoc filters into account when requesting suggestions without label [#101555](https://github.com/grafana/grafana/pull/101555), [@tskarhed](https://github.com/tskarhed)
- **Prometheus:** Fix cursor jump in prometheus code editor [#100273](https://github.com/grafana/grafana/pull/100273), [@itsmylife](https://github.com/itsmylife)
- **Prometheus:** Fix operator handling when making label expressions utf-8 friendly [#100475](https://github.com/grafana/grafana/pull/100475), [@NWRichmond](https://github.com/NWRichmond)
- **Prometheus:** Fix setting utcOffset when absolute time range is used [#101065](https://github.com/grafana/grafana/pull/101065), [@itsmylife](https://github.com/itsmylife)
- **RBAC:** Don't check folder access if `annotationPermissionUpdate` FT is enabled [#99717](https://github.com/grafana/grafana/pull/99717), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **SSO:** Fix team_ids validation for Generic OAuth [#100732](https://github.com/grafana/grafana/pull/100732), [@dmihai](https://github.com/dmihai)
- **Service Accounts:** Don't show error pop-ups for Service Account and Renderer UI flows [#101776](https://github.com/grafana/grafana/pull/101776), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Share:** Fix short links when root_url is different from the browser URL [#99950](https://github.com/grafana/grafana/pull/99950), [@AgnesToulet](https://github.com/AgnesToulet)

### Breaking changes

- **Data source:** Change Permissions for query to only have query and not `read OR query` (Enterprise)

### Plugin development fixes & changes

- **GrafanaUI:** Deprecate Select in favor of Combobox [#100294](https://github.com/grafana/grafana/pull/100294), [@joshhunt](https://github.com/joshhunt)
- **Multi/Combobox:** Use pointer cursor when not focused [#100878](https://github.com/grafana/grafana/pull/100878), [@tskarhed](https://github.com/tskarhed)
- **Slider:** Fix text input box being too wide [#100138](https://github.com/grafana/grafana/pull/100138), [@joshhunt](https://github.com/joshhunt)

<!-- 11.6.0 END -->
<!-- 11.5.2 START -->

# 11.5.2 (2025-02-18)

### Features and enhancements

- **Docker:** Use our own glibc 2.40 binaries [#99918](https://github.com/grafana/grafana/pull/99918), [@DanCech](https://github.com/DanCech)
- **TransformationFilter:** Include transformation outputs in transformation filtering options [#99878](https://github.com/grafana/grafana/pull/99878), [@Sergej-Vlasov](https://github.com/Sergej-Vlasov)
- **grafana-ui:** Update InlineField error prop type to React.ReactNode [#100373](https://github.com/grafana/grafana/pull/100373), [@Clarity-89](https://github.com/Clarity-89)

### Bug fixes

- **Alerting:** Allow specifying uid for new rules added to groups [#100450](https://github.com/grafana/grafana/pull/100450), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Allow specifying uid for new rules added to groups [#100450](https://github.com/grafana/grafana/pull/100450), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Call RLock() before reading sendAlertsTo map [#99880](https://github.com/grafana/grafana/pull/99880), [@santihernandezc](https://github.com/santihernandezc)
- **Auth:** Fix redirect with JWT auth URL login [#100355](https://github.com/grafana/grafana/pull/100355), [@mgyongyosi](https://github.com/mgyongyosi)
- **AuthN:** Refetch user on "ErrUserAlreadyExists" [#100582](https://github.com/grafana/grafana/pull/100582), [@kalleep](https://github.com/kalleep)
- **Azure:** Correctly set application insights resource values [#99599](https://github.com/grafana/grafana/pull/99599), [@aangelisc](https://github.com/aangelisc)
- **CodeEditor:** Fix cursor alignment [#99863](https://github.com/grafana/grafana/pull/99863), [@ashharrison90](https://github.com/ashharrison90)
- **DashboardList:** Throttle the re-renders [#100046](https://github.com/grafana/grafana/pull/100046), [@bfmatei](https://github.com/bfmatei)
- **Dashboards:** Bring back scripted dashboards [#100633](https://github.com/grafana/grafana/pull/100633), [@dprokop](https://github.com/dprokop)
- **Plugin Metrics:** Eliminate data race in plugin metrics middleware [#100078](https://github.com/grafana/grafana/pull/100078), [@clord](https://github.com/clord)
- **RBAC:** Don't check folder access if `annotationPermissionUpdate` FT is enabled [#100117](https://github.com/grafana/grafana/pull/100117), [@IevaVasiljeva](https://github.com/IevaVasiljeva)

<!-- 11.5.2 END -->
<!-- 11.4.2 START -->

# 11.4.2 (2025-02-18)

### Features and enhancements

- **Docker:** Use our own glibc 2.40 binaries [#99924](https://github.com/grafana/grafana/pull/99924), [@DanCech](https://github.com/DanCech)

### Bug fixes

- **Auth:** Fix redirect with JWT auth URL login [#100494](https://github.com/grafana/grafana/pull/100494), [@mgyongyosi](https://github.com/mgyongyosi)
- **AuthN:** Refetch user on "ErrUserAlreadyExists" [#100585](https://github.com/grafana/grafana/pull/100585), [@kalleep](https://github.com/kalleep)
- **Azure:** Correctly set application insights resource values [#99598](https://github.com/grafana/grafana/pull/99598), [@aangelisc](https://github.com/aangelisc)
- **Dashboards:** Bring back scripted dashboards [#100629](https://github.com/grafana/grafana/pull/100629), [@dprokop](https://github.com/dprokop)
- **Plugin Metrics:** Eliminate data race in plugin metrics middleware [#100077](https://github.com/grafana/grafana/pull/100077), [@clord](https://github.com/clord)
- **RBAC:** Don't check folder access if `annotationPermissionUpdate` FT is enabled [#100116](https://github.com/grafana/grafana/pull/100116), [@IevaVasiljeva](https://github.com/IevaVasiljeva)

<!-- 11.4.2 END -->
<!-- 11.3.4 START -->

# 11.3.4 (2025-02-18)

### Features and enhancements

- **Docker:** Use our own glibc 2.40 binaries [#99923](https://github.com/grafana/grafana/pull/99923), [@DanCech](https://github.com/DanCech)

### Bug fixes

- **Auth:** Fix redirect with JWT auth URL login [#100495](https://github.com/grafana/grafana/pull/100495), [@mgyongyosi](https://github.com/mgyongyosi)
- **Azure:** Correctly set application insights resource values [#99597](https://github.com/grafana/grafana/pull/99597), [@aangelisc](https://github.com/aangelisc)
- **Dashboards:** Bring back scripted dashboards [#100627](https://github.com/grafana/grafana/pull/100627), [@dprokop](https://github.com/dprokop)
- **Plugin Metrics:** Eliminate data race in plugin metrics middleware [#100076](https://github.com/grafana/grafana/pull/100076), [@clord](https://github.com/clord)

<!-- 11.3.4 END -->
<!-- 11.2.7 START -->

# 11.2.7 (2025-02-18)

### Features and enhancements

- **Docker:** Use our own glibc 2.40 binaries [#99922](https://github.com/grafana/grafana/pull/99922), [@DanCech](https://github.com/DanCech)

### Bug fixes

- **Azure:** Correctly set application insights resource values [#99596](https://github.com/grafana/grafana/pull/99596), [@aangelisc](https://github.com/aangelisc)

<!-- 11.2.7 END -->
<!-- 11.1.12 START -->

# 11.1.12 (2025-02-18)

### Features and enhancements

- **Docker:** Use our own glibc 2.40 binaries [#99917](https://github.com/grafana/grafana/pull/99917), [@DanCech](https://github.com/DanCech)

### Bug fixes

- **Azure:** Correctly set application insights resource values [#99595](https://github.com/grafana/grafana/pull/99595), [@aangelisc](https://github.com/aangelisc)

<!-- 11.1.12 END -->
<!-- 11.0.11 START -->

# 11.0.11 (2025-02-18)

### Features and enhancements

- **Docker:** Use our own glibc 2.40 binaries [#100730](https://github.com/grafana/grafana/pull/100730), [@DanCech](https://github.com/DanCech)

### Bug fixes

- **Azure:** Correctly set application insights resource values [#99594](https://github.com/grafana/grafana/pull/99594), [@aangelisc](https://github.com/aangelisc)

<!-- 11.0.11 END -->
<!-- 10.4.16 START -->

# 10.4.16 (2025-02-18)

### Features and enhancements

- **Docker:** Use our own glibc 2.40 binaries [#99920](https://github.com/grafana/grafana/pull/99920), [@DanCech](https://github.com/DanCech)

### Bug fixes

- **Dashboard:** Fix for overwriting an edited dashboard in the old architecture [#100288](https://github.com/grafana/grafana/pull/100288), [@bfmatei](https://github.com/bfmatei)

<!-- 10.4.16 END -->
<!-- 11.5.1 START -->

# 11.5.1 (2025-02-03)

### Bug fixes

- **CodeEditor:** Fix cursor alignment [#99090](https://github.com/grafana/grafana/pull/99090), [@ashharrison90](https://github.com/ashharrison90)
- **TransformationFilter**: Include transformation outputs in transformation filtering options: Include transformation outputs in transformation filtering options [#98323](https://github.com/grafana/grafana/pull/98323), [@Sergej-Vlasov](https://github.com/Sergej-Vlasov)

<!-- 11.5.1 END -->
<!-- 11.5.0 START -->

# 11.5.0 (2025-01-28)

### Features and enhancements

- **CloudMigration:** Create authapi service [#96581](https://github.com/grafana/grafana/pull/96581), [@leandro-deveikis](https://github.com/leandro-deveikis)
- **Alerting:** Add new button for exporting new alert rule in HCL format [#96785](https://github.com/grafana/grafana/pull/96785), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Add option to show inactive alerts in alert list panel [#96888](https://github.com/grafana/grafana/pull/96888), [@bradleypettit](https://github.com/bradleypettit)
- **Alerting:** Add state_periodic_save_batch_size config option [#98019](https://github.com/grafana/grafana/pull/98019), [@alexander-akhmetov](https://github.com/alexander-akhmetov)
- **Alerting:** Change default for max_attempts to 3. [#97461](https://github.com/grafana/grafana/pull/97461), [@stevesg](https://github.com/stevesg)
- **Alerting:** Consume k8s API for notification policies tree [#96147](https://github.com/grafana/grafana/pull/96147), [@konrad147](https://github.com/konrad147)
- **Alerting:** Enable flag alertingApiServer by default [#98282](https://github.com/grafana/grafana/pull/98282), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Explore button in Insights view [#96496](https://github.com/grafana/grafana/pull/96496), [@ppcano](https://github.com/ppcano)
- **Alerting:** Improve performance ash page [#97619](https://github.com/grafana/grafana/pull/97619), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Make alert rule policies preview use k8s API [#97070](https://github.com/grafana/grafana/pull/97070), [@tomratcliffe](https://github.com/tomratcliffe)
- **Alerting:** Return default builtin templates in k8s templategroup API and UI [#96330](https://github.com/grafana/grafana/pull/96330), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Simplify notification step [#96430](https://github.com/grafana/grafana/pull/96430), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Update state manager to take image only once per rule evaluation [#98289](https://github.com/grafana/grafana/pull/98289), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Analytics Views:** Deprecate :dashboardID endpoints in favor of uid/:dashboardUID (Enterprise)
- **Analytics:** Summaries: Deprecate dashboard_id endpoints in favor of dashboard_uid (Enterprise)
- **Announcement Banners:** Enable feature for all cloud tiers (Enterprise)
- **Announcement banner:** Remove feature toggle [#98782](https://github.com/grafana/grafana/pull/98782), [@Clarity-89](https://github.com/Clarity-89)
- **Announcement banner:** Remove feature toggle (Enterprise)
- **Announcement banner:** Sort by last updated (Enterprise)
- **Auth:** Return error when retries have been exhausted for OAuth token refresh [#98034](https://github.com/grafana/grafana/pull/98034), [@mgyongyosi](https://github.com/mgyongyosi)
- **Azure Monitor:** Add a feature flag to toggle user auth for Azure Monitor only [#96858](https://github.com/grafana/grafana/pull/96858), [@adamyeats](https://github.com/adamyeats)
- **Azure:** Improve Azure Prometheus exemplars UI/UX [#97198](https://github.com/grafana/grafana/pull/97198), [@aangelisc](https://github.com/aangelisc)
- **Azure:** Unify credentials in frontend for Prometheus [#96568](https://github.com/grafana/grafana/pull/96568), [@yjsong11](https://github.com/yjsong11)
- **Chore:** Bump Go to 1.23.4 [#98853](https://github.com/grafana/grafana/pull/98853), [@Proximyst](https://github.com/Proximyst)
- **Chore:** Bump Go to 1.23.4 (Enterprise)
- **Chore:** Remove experimental Storage UI [#96887](https://github.com/grafana/grafana/pull/96887), [@ryantxu](https://github.com/ryantxu)
- **Chore:** Update to node 22 [#97779](https://github.com/grafana/grafana/pull/97779), [@ashharrison90](https://github.com/ashharrison90)
- **CloudMigrations:** Enable feature toggle by default in 11.5 [#98686](https://github.com/grafana/grafana/pull/98686), [@mmandrus](https://github.com/mmandrus)
- **CloudMigrations:** Introduce RBAC role for migration assistant [#98588](https://github.com/grafana/grafana/pull/98588), [@macabu](https://github.com/macabu)
- **CloudWatch:** Add OpenSearch PPL and SQL support in Logs Insights [#97508](https://github.com/grafana/grafana/pull/97508), [@idastambuk](https://github.com/idastambuk)
- **CloudWatch:** Batch different time ranges separately [#98230](https://github.com/grafana/grafana/pull/98230), [@iwysiu](https://github.com/iwysiu)
- **Cloudwatch:** Accept empty string for logstimeout and mark errors downstream [#96947](https://github.com/grafana/grafana/pull/96947), [@iwysiu](https://github.com/iwysiu)
- **Cloudwatch:** Update grafana-aws-sdk for AWS/AmplifyHosting metrics [#97799](https://github.com/grafana/grafana/pull/97799), [@iwysiu](https://github.com/iwysiu)
- **Dashboard Scene:** Shows usages in variables list [#96000](https://github.com/grafana/grafana/pull/96000), [@harisrozajac](https://github.com/harisrozajac)
- **Dashboards:** Add option to specify explicit percent change text size for stat panels [#96952](https://github.com/grafana/grafana/pull/96952), [@XZCendence](https://github.com/XZCendence)
- **Dashboards:** Allow DashboardDS subqueries in MixedDS [#97116](https://github.com/grafana/grafana/pull/97116), [@mdvictor](https://github.com/mdvictor)
- **Dashboards:** Update docs of the `overwrite` param in Save Dashboard API Call [#97011](https://github.com/grafana/grafana/pull/97011), [@ArturWierzbicki](https://github.com/ArturWierzbicki)
- **Datasources:** Add toggle to control default behaviour of 'Manage alerts via Alerts UI' toggle [#98441](https://github.com/grafana/grafana/pull/98441), [@macabu](https://github.com/macabu)
- **Datasources:** Allow clearing trace to logs, metrics and profiles datasource pickers [#96554](https://github.com/grafana/grafana/pull/96554), [@adrapereira](https://github.com/adrapereira)
- **Docker:** Don't use legacy ENV syntax [#93218](https://github.com/grafana/grafana/pull/93218), [@simPod](https://github.com/simPod)
- **Elasticsearch:** Health endpoint should handle http errors [#96803](https://github.com/grafana/grafana/pull/96803), [@iwysiu](https://github.com/iwysiu)
- **Elasticsearch:** Use \_field_caps instead of \_mapping to get fields [#97607](https://github.com/grafana/grafana/pull/97607), [@iwysiu](https://github.com/iwysiu)
- **Explore Profiles:** Preinstall for onprem Grafana instances [#97775](https://github.com/grafana/grafana/pull/97775), [@ifrost](https://github.com/ifrost)
- **Explore metrics:** Consolidate filters with the OTel experience [#98371](https://github.com/grafana/grafana/pull/98371), [@bohandley](https://github.com/bohandley)
- **Explore:** Show links to queryless apps [#96625](https://github.com/grafana/grafana/pull/96625), [@ifrost](https://github.com/ifrost)
- **Expressions:** Add notification for Strict Mode behavior in Reduce component [#97224](https://github.com/grafana/grafana/pull/97224), [@shubhankarunhale](https://github.com/shubhankarunhale)
- **Faro:** Improve performance of TRACKING_URLS regex [#98022](https://github.com/grafana/grafana/pull/98022), [@kpelelis](https://github.com/kpelelis)
- **FeatureToggles:** Make newFiltersUI feature toggle generally available [#97460](https://github.com/grafana/grafana/pull/97460), [@Sergej-Vlasov](https://github.com/Sergej-Vlasov)
- **Features:** Remove cloudwatchMetricInsightsCrossAccount feature toggle [#98826](https://github.com/grafana/grafana/pull/98826), [@idastambuk](https://github.com/idastambuk)
- **Frontend Sandbox:** Add switch to toggle plugins frontend sandbox via catalog UI (Enterprise)
- **Graphite:** Set `maxDataPoints` based on user value in alerting [#97178](https://github.com/grafana/grafana/pull/97178), [@aangelisc](https://github.com/aangelisc)
- **Licensing:** Tidy up license token database code (Enterprise)
- **LoginAttempt:** Add setting to control max number of attempts before user login gets locked [#97091](https://github.com/grafana/grafana/pull/97091), [@kalleep](https://github.com/kalleep)
- **Logs Panel:** Add infinite scrolling support for Dashboards and Apps [#97095](https://github.com/grafana/grafana/pull/97095), [@matyax](https://github.com/matyax)
- **Logs Panel:** Allow text selection without changing Log Details state [#96995](https://github.com/grafana/grafana/pull/96995), [@matyax](https://github.com/matyax)
- **Logs Panel:** Limit displayed characters to MAX_CHARACTERS [#96997](https://github.com/grafana/grafana/pull/96997), [@matyax](https://github.com/matyax)
- **Logs:** Added option to show the log line body when displayed fields are used [#97209](https://github.com/grafana/grafana/pull/97209), [@matyax](https://github.com/matyax)
- **Logs:** Added support to disable and re-enable the popover menu [#98254](https://github.com/grafana/grafana/pull/98254), [@matyax](https://github.com/matyax)
- **Logs:** Allow scroll to reach the bottom of the log list before loading more [#96668](https://github.com/grafana/grafana/pull/96668), [@matyax](https://github.com/matyax)
- **Loki:** Added support for disabled operations in Query Builder [#96751](https://github.com/grafana/grafana/pull/96751), [@matyax](https://github.com/matyax)
- **Loki:** Added support to show label types in Log Details [#97284](https://github.com/grafana/grafana/pull/97284), [@matyax](https://github.com/matyax)
- **Loki:** Allow regex in `label` derived field [#96609](https://github.com/grafana/grafana/pull/96609), [@svennergr](https://github.com/svennergr)
- **Loki:** Hide internal labels [#97323](https://github.com/grafana/grafana/pull/97323), [@svennergr](https://github.com/svennergr)
- **Loki:** Sync query direction with sort order in Explore and Dashboards [#98722](https://github.com/grafana/grafana/pull/98722), [@matyax](https://github.com/matyax)
- **OAuth:** Support client_secret_jwt for oauth providers when doing token exchange [#95455](https://github.com/grafana/grafana/pull/95455), [@naizerjohn-ms](https://github.com/naizerjohn-ms)
- **OAuth:** Use the attached external session data in OAuthToken and OAuthTokenSync [#96655](https://github.com/grafana/grafana/pull/96655), [@mgyongyosi](https://github.com/mgyongyosi)
- **Org Selection:** Show correct selected org when select is open [#96601](https://github.com/grafana/grafana/pull/96601), [@yincongcyincong](https://github.com/yincongcyincong)
- **PDF:** Add new zoom options (Enterprise)
- **Plugin Extensions:** Only load app plugins when necessary [#86624](https://github.com/grafana/grafana/pull/86624), [@leventebalogh](https://github.com/leventebalogh)
- **Plugins:** Add token to gcom requests [#96261](https://github.com/grafana/grafana/pull/96261), [@oshirohugo](https://github.com/oshirohugo)
- **Plugins:** Add token to gcom requests (Enterprise)
- **Plugins:** Disable version install when angular version is not supported [#97189](https://github.com/grafana/grafana/pull/97189), [@oshirohugo](https://github.com/oshirohugo)
- **Plugins:** Disable version installation for specific plugin types [#98597](https://github.com/grafana/grafana/pull/98597), [@oshirohugo](https://github.com/oshirohugo)
- **Plugins:** Update to latest go plugin SDK (v0.260.3) w/ arrow v18 [#97561](https://github.com/grafana/grafana/pull/97561), [@ryantxu](https://github.com/ryantxu)
- **Plugins:** Use grafana-com sso_api_token [#97096](https://github.com/grafana/grafana/pull/97096), [@oshirohugo](https://github.com/oshirohugo)
- **Plugins:** Use grafana-com sso_api_token (Enterprise)
- **Prometheus datasource:** Show info annotations in the UI [#97978](https://github.com/grafana/grafana/pull/97978), [@zenador](https://github.com/zenador)
- **Prometheus:** Improve handling of special chars in label values [#96067](https://github.com/grafana/grafana/pull/96067), [@NWRichmond](https://github.com/NWRichmond)
- **PublicDashboards:** Remove publicDashboards FF [#96578](https://github.com/grafana/grafana/pull/96578), [@juanicabanas](https://github.com/juanicabanas)
- **Reporting:** Add allow list email domain configuration (Enterprise)
- **Reporting:** Include the apiserver by default and deprecated internal ids (Enterprise)
- **RuntimeDataSource:** Support in core for runtime registered data sources [#93956](https://github.com/grafana/grafana/pull/93956), [@torkelo](https://github.com/torkelo)
- **SAML:** Add the ability to specify EntityID (Enterprise)
- **SAML:** Implement correct SLO with NameID and SessionIndex handling (Enterprise)
- **Security:** Update to Go 1.23.5 - Backport to v11.5.x [#99122](https://github.com/grafana/grafana/pull/99122), [@Proximyst](https://github.com/Proximyst)
- **Security:** Update to Go 1.23.5 - Backport to v11.5.x (Enterprise)
- **Snapshots:** Add RBAC roles for creating and deleting [#96126](https://github.com/grafana/grafana/pull/96126), [@evictorero](https://github.com/evictorero)
- **Storage:** Removes integration tests for MySQL 5.7 since it is EOL [#98013](https://github.com/grafana/grafana/pull/98013), [@inf0rmer](https://github.com/inf0rmer)
- **Tempo:** Add support for TraceQL Metrics exemplars [#96859](https://github.com/grafana/grafana/pull/96859), [@adrapereira](https://github.com/adrapereira)
- **Tempo:** Honor datasource TLS settings for gRPC requests [#97484](https://github.com/grafana/grafana/pull/97484), [@mdisibio](https://github.com/mdisibio)
- **Tempo:** Improve handling of multiple values in the Search tab query generation [#98427](https://github.com/grafana/grafana/pull/98427), [@adrapereira](https://github.com/adrapereira)
- **ToolbarButton:** Auto width on smaller screen sizes [#96023](https://github.com/grafana/grafana/pull/96023), [@yincongcyincong](https://github.com/yincongcyincong)
- **Trace View:** Set span filters as panel options [#98328](https://github.com/grafana/grafana/pull/98328), [@adrapereira](https://github.com/adrapereira)
- **TransformationFilter:** Implement RefID multi picker [#96841](https://github.com/grafana/grafana/pull/96841), [@Sergej-Vlasov](https://github.com/Sergej-Vlasov)
- **Transformations:** Add Delimiter format option to Extract fields [#97340](https://github.com/grafana/grafana/pull/97340), [@tskarhed](https://github.com/tskarhed)
- **Transformations:** Add RegExp option to Extract fields transformer [#96593](https://github.com/grafana/grafana/pull/96593), [@leeoniya](https://github.com/leeoniya)
- **Transformations:** GroupToMatrix add 0 as special value [#97642](https://github.com/grafana/grafana/pull/97642), [@tskarhed](https://github.com/tskarhed)
- **Zipkin:** Run queries through backend [#97754](https://github.com/grafana/grafana/pull/97754), [@ivanahuckova](https://github.com/ivanahuckova)

### Bug fixes

- **Alerting:** AlertingQueryRunner should skip descendant nodes of invalid queries [#97528](https://github.com/grafana/grafana/pull/97528), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Allow notification policy filters to match quoted matchers [#98525](https://github.com/grafana/grafana/pull/98525), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Fix alert rule list view summaries [#98433](https://github.com/grafana/grafana/pull/98433), [@yincongcyincong](https://github.com/yincongcyincong)
- **Alerting:** Fix alert rules unpausing after moving rule to different folder [#97580](https://github.com/grafana/grafana/pull/97580), [@santihernandezc](https://github.com/santihernandezc)
- **Alerting:** Fix ash not showing history graph in firefox [#98128](https://github.com/grafana/grafana/pull/98128), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Fix bug when saving a rule more than once [#96658](https://github.com/grafana/grafana/pull/96658), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Fix data-testid in RuleEditorSection [#97473](https://github.com/grafana/grafana/pull/97473), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Fix filtering rule group permissions based on their full path (Enterprise)
- **Alerting:** Fix go template parsing [#97145](https://github.com/grafana/grafana/pull/97145), [@konrad147](https://github.com/konrad147)
- **Alerting:** Fix label escaping in rule export [#97985](https://github.com/grafana/grafana/pull/97985), [@moustafab](https://github.com/moustafab)
- **Alerting:** Fix missing instances and history when Grafana rule is stored in folder with / [#97956](https://github.com/grafana/grafana/pull/97956), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Fix navigating to URLs with "%25" [#96992](https://github.com/grafana/grafana/pull/96992), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Fix no-change scenario in provisioning rule update API [#98389](https://github.com/grafana/grafana/pull/98389), [@alexander-akhmetov](https://github.com/alexander-akhmetov)
- **Alerting:** Fix not being able to remove a reducer when using range query [#97757](https://github.com/grafana/grafana/pull/97757), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Fix recording rules rendering simplified condition [#97497](https://github.com/grafana/grafana/pull/97497), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Fix removing reducer when inital value is instant [#97054](https://github.com/grafana/grafana/pull/97054), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Fix simplified query step [#97046](https://github.com/grafana/grafana/pull/97046), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Fix slack image uploading to use new api [#97817](https://github.com/grafana/grafana/pull/97817), [@moustafab](https://github.com/moustafab)
- **Alerting:** Fix terraform export of notification policy [#98429](https://github.com/grafana/grafana/pull/98429), [@moustafab](https://github.com/moustafab)
- **Alerting:** Fix updating condition when refId changes [#97753](https://github.com/grafana/grafana/pull/97753), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Fix using stacks- prefix instead of stack- for checking the namespace in boot data [#97492](https://github.com/grafana/grafana/pull/97492), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Anonymous User:** Adds validator service for anonymous users (Enterprise)
- **Auth:** Fix SAML user IsExternallySynced not being set correctly [#98487](https://github.com/grafana/grafana/pull/98487), [@volcanonoodle](https://github.com/volcanonoodle)
- **Azure Monitor:** Add safety around usage of frame.Meta.Custom struct [#97766](https://github.com/grafana/grafana/pull/97766), [@adamyeats](https://github.com/adamyeats)
- **Azure/GCM:** Improve error display [#96921](https://github.com/grafana/grafana/pull/96921), [@aangelisc](https://github.com/aangelisc)
- **CloudWatch:** Fix conditions for fetching wildcards [#98648](https://github.com/grafana/grafana/pull/98648), [@iwysiu](https://github.com/iwysiu)
- **CloudWatch:** Fix interpolation of log groups when fetching fields [#98054](https://github.com/grafana/grafana/pull/98054), [@idastambuk](https://github.com/idastambuk)
- **Dashboard:** Fixes issue with compatability of old DashboardModel.annotations [#97328](https://github.com/grafana/grafana/pull/97328), [@torkelo](https://github.com/torkelo)
- **Dashboards:** Fix issue where filtered panels would not react to variable changes [#98718](https://github.com/grafana/grafana/pull/98718), [@oscarkilhed](https://github.com/oscarkilhed)
- **Dashboards:** Fixes week relative time ranges when weekStart was changed [#98167](https://github.com/grafana/grafana/pull/98167), [@torkelo](https://github.com/torkelo)
- **Dashboards:** Panel react for `timeFrom` and `timeShift` changes using variables [#98510](https://github.com/grafana/grafana/pull/98510), [@Sergej-Vlasov](https://github.com/Sergej-Vlasov)
- **DateTimePicker:** Fixes issue with date picker showing invalid date [#97888](https://github.com/grafana/grafana/pull/97888), [@torkelo](https://github.com/torkelo)
- **Fix:** Add support for datasource variable queries [#98098](https://github.com/grafana/grafana/pull/98098), [@sunker](https://github.com/sunker)
- **Fix:** Do not fetch Orgs if the user is authenticated by apikey/sa or render key [#97162](https://github.com/grafana/grafana/pull/97162), [@mgyongyosi](https://github.com/mgyongyosi)
- **Fix:** Double encoding of URLs when using data proxy [#98494](https://github.com/grafana/grafana/pull/98494), [@s4kh](https://github.com/s4kh)
- **Font:** Disable contextual font ligatures [#98521](https://github.com/grafana/grafana/pull/98521), [@ashharrison90](https://github.com/ashharrison90)
- **GrafanaUI:** Fix inconsistent controlled/uncontrolled state in AutoSizeInput [#96696](https://github.com/grafana/grafana/pull/96696), [@joshhunt](https://github.com/joshhunt)
- **GrafanaUI:** Revert: Fix inconsistent controlled/uncontrolled state in AutoSizeInput [#97551](https://github.com/grafana/grafana/pull/97551), [@itsmylife](https://github.com/itsmylife)
- **InfluxDB:** Adhoc filters can use template vars as values [#98567](https://github.com/grafana/grafana/pull/98567), [@bossinc](https://github.com/bossinc)
- **Library Panel:** Fix issue where library panels did not display panel links. [#98655](https://github.com/grafana/grafana/pull/98655), [@yincongcyincong](https://github.com/yincongcyincong)
- **LibraryPanel:** Fallback to panel title if library panel title is not set [#99411](https://github.com/grafana/grafana/pull/99411), [@ivanortegaalba](https://github.com/ivanortegaalba)
- **Loki:** Fix a bug when reading frames without values but warnings [#97197](https://github.com/grafana/grafana/pull/97197), [@svennergr](https://github.com/svennergr)
- **Loki:** Only hide a set of labels instead of every label starting with `__` [#98730](https://github.com/grafana/grafana/pull/98730), [@svennergr](https://github.com/svennergr)
- **Org:** Fix redirection logic to work consistently [#96521](https://github.com/grafana/grafana/pull/96521), [@yincongcyincong](https://github.com/yincongcyincong)
- **Panel inspect:** Fix file names of data download included uninterpolated variable names. [#98832](https://github.com/grafana/grafana/pull/98832), [@alexrosenfeld10](https://github.com/alexrosenfeld10)
- **Scenes:** Upgrade to 5.36.3 [#98661](https://github.com/grafana/grafana/pull/98661), [@ivanortegaalba](https://github.com/ivanortegaalba)
- **Snapshot:** Show proper breadcrumb path [#98806](https://github.com/grafana/grafana/pull/98806), [@ashharrison90](https://github.com/ashharrison90)
- **Time Picker:** Fix "Fiscal year start month" selection behaviour [#98576](https://github.com/grafana/grafana/pull/98576), [@ashharrison90](https://github.com/ashharrison90)
- **Unified Storage:** Add support for verify-full in postgres [#96825](https://github.com/grafana/grafana/pull/96825), [@chaudyg](https://github.com/chaudyg)
- **Unified Storage:** Use tls preferred when grafana db using ssl [#97378](https://github.com/grafana/grafana/pull/97378), [@owensmallwood](https://github.com/owensmallwood)
- **Usage Insights:** Fix usage insight errors being logged as [object Object] [#93502](https://github.com/grafana/grafana/pull/93502), [@mmandrus](https://github.com/mmandrus)

### Breaking changes

- **Loki:** Default to `/labels` API with `query` param instead of `/series` API [#97935](https://github.com/grafana/grafana/pull/97935), [@svennergr](https://github.com/svennergr)

### Plugin development fixes & changes

- **Grafana UI:** Re-add react-router-dom as a dependency [#97540](https://github.com/grafana/grafana/pull/97540), [@leventebalogh](https://github.com/leventebalogh)

<!-- 11.5.0 END -->
<!-- 11.4.1 START -->

# 11.4.1 (2025-01-28)

### Features and enhancements

- **Security:** Update to Go 1.23.5 - Backport to v11.4.x [#99123](https://github.com/grafana/grafana/pull/99123), [@Proximyst](https://github.com/Proximyst)
- **Security:** Update to Go 1.23.5 - Backport to v11.4.x (Enterprise)

### Bug fixes

- **Alerting:** AlertingQueryRunner should skip descendant nodes of invalid queries [#97830](https://github.com/grafana/grafana/pull/97830), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Fix alert rules unpausing after moving rule to different folder [#97583](https://github.com/grafana/grafana/pull/97583), [@santihernandezc](https://github.com/santihernandezc)
- **Alerting:** Fix label escaping in rule export [#98649](https://github.com/grafana/grafana/pull/98649), [@moustafab](https://github.com/moustafab)
- **Alerting:** Fix slack image uploading to use new api [#98066](https://github.com/grafana/grafana/pull/98066), [@moustafab](https://github.com/moustafab)
- **Azure/GCM:** Improve error display [#97594](https://github.com/grafana/grafana/pull/97594), [@aangelisc](https://github.com/aangelisc)
- **Dashboards:** Fix issue where filtered panels would not react to variable changes [#98734](https://github.com/grafana/grafana/pull/98734), [@oscarkilhed](https://github.com/oscarkilhed)
- **Dashboards:** Fixes issue with panel header showing even when hide time override was enabled [#98747](https://github.com/grafana/grafana/pull/98747), [@torkelo](https://github.com/torkelo)
- **Dashboards:** Fixes week relative time ranges when weekStart was changed [#98269](https://github.com/grafana/grafana/pull/98269), [@torkelo](https://github.com/torkelo)
- **Dashboards:** Panel react for `timeFrom` and `timeShift` changes using variables [#98659](https://github.com/grafana/grafana/pull/98659), [@Sergej-Vlasov](https://github.com/Sergej-Vlasov)
- **DateTimePicker:** Fixes issue with date picker showing invalid date [#97971](https://github.com/grafana/grafana/pull/97971), [@torkelo](https://github.com/torkelo)
- **Fix:** Add support for datasource variable queries [#98119](https://github.com/grafana/grafana/pull/98119), [@sunker](https://github.com/sunker)
- **InfluxDB:** Adhoc filters can use template vars as values [#98786](https://github.com/grafana/grafana/pull/98786), [@bossinc](https://github.com/bossinc)
- **LibraryPanel:** Fallback to panel title if library panel title is not set [#99410](https://github.com/grafana/grafana/pull/99410), [@ivanortegaalba](https://github.com/ivanortegaalba)

### Plugin development fixes & changes

- **Grafana UI:** Re-add react-router-dom as a dependency [#98422](https://github.com/grafana/grafana/pull/98422), [@leventebalogh](https://github.com/leventebalogh)

<!-- 11.4.1 END -->
<!-- 11.3.3 START -->

# 11.3.3 (2025-01-28)

### Features and enhancements

- **Azure Monitor:** Add a feature flag to toggle user auth for Azure Monitor only [#97576](https://github.com/grafana/grafana/pull/97576), [@adamyeats](https://github.com/adamyeats)
- **Security:** Update to Go 1.23.5 - Backport to v11.3.x [#99124](https://github.com/grafana/grafana/pull/99124), [@Proximyst](https://github.com/Proximyst)
- **Security:** Update to Go 1.23.5 - Backport to v11.3.x (Enterprise)

### Bug fixes

- **Alerting:** AlertingQueryRunner should skip descendant nodes of invalid queries [#97829](https://github.com/grafana/grafana/pull/97829), [@gillesdemey](https://github.com/gillesdemey)
- **Azure/GCM:** Improve error display [#97593](https://github.com/grafana/grafana/pull/97593), [@aangelisc](https://github.com/aangelisc)
- **Dashboard:** Fixes issue with compatability of old DashboardModel.annotations [#97467](https://github.com/grafana/grafana/pull/97467), [@torkelo](https://github.com/torkelo)
- **Dashboards:** Fix issue where filtered panels would not react to variable changes [#98733](https://github.com/grafana/grafana/pull/98733), [@oscarkilhed](https://github.com/oscarkilhed)
- **Dashboards:** Fixes issue with panel header showing even when hide time override was enabled [#97389](https://github.com/grafana/grafana/pull/97389), [@torkelo](https://github.com/torkelo)
- **Dashboards:** Fixes week relative time ranges when weekStart was changed [#98268](https://github.com/grafana/grafana/pull/98268), [@torkelo](https://github.com/torkelo)
- **DateTimePicker:** Fixes issue with date picker showing invalid date [#97970](https://github.com/grafana/grafana/pull/97970), [@torkelo](https://github.com/torkelo)
- **Fix:** Add support for datasource variable queries [#98118](https://github.com/grafana/grafana/pull/98118), [@sunker](https://github.com/sunker)
- **InfluxDB:** Adhoc filters can use template vars as values [#98785](https://github.com/grafana/grafana/pull/98785), [@bossinc](https://github.com/bossinc)
- **Unified Storage:** Use tls preferred when grafana db using ssl [#97379](https://github.com/grafana/grafana/pull/97379), [@owensmallwood](https://github.com/owensmallwood)

### Plugin development fixes & changes

- **Grafana UI:** Re-add react-router-dom as a dependency [#98421](https://github.com/grafana/grafana/pull/98421), [@leventebalogh](https://github.com/leventebalogh)

<!-- 11.3.3 END -->
<!-- 11.2.6 START -->

# 11.2.6 (2025-01-28)

### Features and enhancements

- **Azure Monitor:** Add a feature flag to toggle user auth for Azure Monitor only [#97565](https://github.com/grafana/grafana/pull/97565), [@adamyeats](https://github.com/adamyeats)
- **Security:** Update to Go 1.22.11 - Backport to v11.2.x [#99125](https://github.com/grafana/grafana/pull/99125), [@Proximyst](https://github.com/Proximyst)
- **Security:** Update to Go 1.22.11 - Backport to v11.2.x (Enterprise)

### Bug fixes

- **Azure/GCM:** Improve error display [#97591](https://github.com/grafana/grafana/pull/97591), [@aangelisc](https://github.com/aangelisc)

<!-- 11.2.6 END -->
<!-- 11.1.11 START -->

# 11.1.11 (2025-01-28)

### Features and enhancements

- **Security:** Update to Go 1.22.11 - Backport to v11.1.x [#99126](https://github.com/grafana/grafana/pull/99126), [@Proximyst](https://github.com/Proximyst)
- **Security:** Update to Go 1.22.11 - Backport to v11.1.x (Enterprise)

### Bug fixes

- **Azure/GCM:** Improve error display [#97595](https://github.com/grafana/grafana/pull/97595), [@aangelisc](https://github.com/aangelisc)

<!-- 11.1.11 END -->
<!-- 11.0.10 START -->

# 11.0.10 (2025-01-28)

### Features and enhancements

- **Security:** Update to Go 1.22.11 - Backport to v11.0.x [#99127](https://github.com/grafana/grafana/pull/99127), [@Proximyst](https://github.com/Proximyst)
- **Security:** Update to Go 1.22.11 - Backport to v11.0.x (Enterprise)

### Bug fixes

- **Azure/GCM:** Improve error display [#97592](https://github.com/grafana/grafana/pull/97592), [@aangelisc](https://github.com/aangelisc)

<!-- 11.0.10 END -->
<!-- 10.4.15 START -->

# 10.4.15 (2025-01-28)

### Features and enhancements

- **Security:** Update to Go 1.22.11 - Backport to v10.4.x [#99128](https://github.com/grafana/grafana/pull/99128), [@Proximyst](https://github.com/Proximyst)
- **Security:** Update to Go 1.22.11 - Backport to v10.4.x (Enterprise)

### Bug fixes

- **Azure/GCM:** Improve error display [#97590](https://github.com/grafana/grafana/pull/97590), [@aangelisc](https://github.com/aangelisc)

<!-- 10.4.15 END -->
<!-- 11.4.0 START -->

# 11.4.0 (2024-12-05)

### Features and enhancements

- **Cloudwatch:** OpenSearch PPL and SQL support in Logs Insights

<!-- 11.4.0 END -->
<!-- 11.3.2 START -->

# 11.3.2 (2024-12-04)

### Features and enhancements

- **Backport:** Announcement Banners: Enable feature for all cloud tiers (Enterprise)

### Bug fixes

- **Fix:** Do not fetch Orgs if the user is authenticated by apikey/sa or render key [#97262](https://github.com/grafana/grafana/pull/97262), [@mgyongyosi](https://github.com/mgyongyosi)

<!-- 11.3.2 END -->
<!-- 11.2.5 START -->

# 11.2.5 (2024-12-04)

### Bug fixes

- **Fix:** Do not fetch Orgs if the user is authenticated by apikey/sa or render key [#97264](https://github.com/grafana/grafana/pull/97264), [@mgyongyosi](https://github.com/mgyongyosi)

<!-- 11.2.5 END -->
<!-- 11.1.10 START -->

# 11.1.10 (2024-12-04)

### Bug fixes

- **Fix:** Do not fetch Orgs if the user is authenticated by apikey/sa or render key [#97261](https://github.com/grafana/grafana/pull/97261), [@mgyongyosi](https://github.com/mgyongyosi)

<!-- 11.1.10 END -->
<!-- 11.0.9 START -->

# 11.0.9 (2024-12-04)

### Bug fixes

- **Fix:** Do not fetch Orgs if the user is authenticated by apikey/sa or render key [#97265](https://github.com/grafana/grafana/pull/97265), [@mgyongyosi](https://github.com/mgyongyosi)

<!-- 11.0.9 END -->
<!-- 10.4.14 START -->

# 10.4.14 (2024-12-04)

### Bug fixes

- **Fix:** Do not fetch Orgs if the user is authenticated by apikey/sa or render key [#97263](https://github.com/grafana/grafana/pull/97263), [@mgyongyosi](https://github.com/mgyongyosi)

<!-- 10.4.14 END -->
<!-- 11.3.1 START -->

# 11.3.1 (2024-11-19)

### Features and enhancements

- **Alerting:** Make context deadline on AlertNG service startup configurable [#96135](https://github.com/grafana/grafana/pull/96135), [@fayzal-g](https://github.com/fayzal-g)
- **MigrationAssistant:** Restrict dashboards, folders and datasources by the org id of the signed in user [#96345](https://github.com/grafana/grafana/pull/96345), [@leandro-deveikis](https://github.com/leandro-deveikis)
- **User:** Check SignedInUser OrgID in RevokeInvite [#95490](https://github.com/grafana/grafana/pull/95490), [@mgyongyosi](https://github.com/mgyongyosi)

### Bug fixes

- **Alerting:** Fix escaping of silence matchers in utf8 mode [#95347](https://github.com/grafana/grafana/pull/95347), [@tomratcliffe](https://github.com/tomratcliffe)
- **Alerting:** Fix overflow for long receiver names [#95133](https://github.com/grafana/grafana/pull/95133), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Fix saving advanced mode toggle state in the alert rule editor [#95981](https://github.com/grafana/grafana/pull/95981), [@alexander-akhmetov](https://github.com/alexander-akhmetov)
- **Alerting:** Fix setting datasource uid, when datasource is string in old version [#96273](https://github.com/grafana/grafana/pull/96273), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Force refetch prom rules when refreshing panel [#96125](https://github.com/grafana/grafana/pull/96125), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Anonymous User:** Adds validator service for anonymous users [#94994](https://github.com/grafana/grafana/pull/94994), [@leandro-deveikis](https://github.com/leandro-deveikis)
- **Anonymous User:** Adds validator service for anonymous users (Enterprise)
- **Azure Monitor:** Support metric namespaces fallback [#95155](https://github.com/grafana/grafana/pull/95155), [@aangelisc](https://github.com/aangelisc)
- **Azure:** Fix duplicated traces in multi-resource trace query [#95247](https://github.com/grafana/grafana/pull/95247), [@aangelisc](https://github.com/aangelisc)
- **Azure:** Handle namespace request rejection [#95909](https://github.com/grafana/grafana/pull/95909), [@aangelisc](https://github.com/aangelisc)
- **CloudWatch:** Interpolate region in log context query [#94990](https://github.com/grafana/grafana/pull/94990), [@iwysiu](https://github.com/iwysiu)
- **Dashboard datasource:** Return annotations as series when query topic is "annotations" [#95971](https://github.com/grafana/grafana/pull/95971), [@kaydelaney](https://github.com/kaydelaney)
- **Dashboard:** Append orgId to URL [#95963](https://github.com/grafana/grafana/pull/95963), [@bfmatei](https://github.com/bfmatei)
- **Dashboards:** Fixes performance issue expanding a row [#95321](https://github.com/grafana/grafana/pull/95321), [@torkelo](https://github.com/torkelo)
- **Flame Graph:** Fix crash when it receives empty data [#96211](https://github.com/grafana/grafana/pull/96211), [@yincongcyincong](https://github.com/yincongcyincong)
- **Folders:** Add admin permissions upon creation of a folder w. SA [#95365](https://github.com/grafana/grafana/pull/95365), [@eleijonmarck](https://github.com/eleijonmarck)
- **Folders:** Don't show error pop-up if the user can't fetch the root folder [#95600](https://github.com/grafana/grafana/pull/95600), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Migration:** Remove table aliasing in delete statement to make it work for mariadb [#95232](https://github.com/grafana/grafana/pull/95232), [@kalleep](https://github.com/kalleep)
- **ServerLock:** Fix pg concurrency/locking issue [#95935](https://github.com/grafana/grafana/pull/95935), [@mgyongyosi](https://github.com/mgyongyosi)
- **Service Accounts:** Run service account creation in transaction [#94803](https://github.com/grafana/grafana/pull/94803), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Table:** Fix text wrapping applying to wrong field [#95425](https://github.com/grafana/grafana/pull/95425), [@codeincarnate](https://github.com/codeincarnate)
- **Unified Storage:** Use ssl_mode instead of sslmode [#95662](https://github.com/grafana/grafana/pull/95662), [@chaudyg](https://github.com/chaudyg)

<!-- 11.3.1 END -->
<!-- 11.2.4 START -->

# 11.2.4 (2024-11-19)

### Features and enhancements

- **Alerting:** Make context deadline on AlertNG service startup configurable [#96133](https://github.com/grafana/grafana/pull/96133), [@fayzal-g](https://github.com/fayzal-g)
- **MigrationAssistant:** Restrict dashboards, folders and datasources by the org id of the signed in user [#96344](https://github.com/grafana/grafana/pull/96344), [@leandro-deveikis](https://github.com/leandro-deveikis)
- **Transformations:** Add 'transpose' transform [#95076](https://github.com/grafana/grafana/pull/95076), [@jmdane](https://github.com/jmdane)
- **User:** Check SignedInUser OrgID in RevokeInvite [#95489](https://github.com/grafana/grafana/pull/95489), [@mgyongyosi](https://github.com/mgyongyosi)

### Bug fixes

- **Alerting:** Force refetch prom rules when refreshing panel [#96124](https://github.com/grafana/grafana/pull/96124), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Anonymous User:** Adds validator service for anonymous users [#94993](https://github.com/grafana/grafana/pull/94993), [@leandro-deveikis](https://github.com/leandro-deveikis)
- **Anonymous User:** Adds validator service for anonymous users (Enterprise)
- **Azure Monitor:** Support metric namespaces fallback [#95154](https://github.com/grafana/grafana/pull/95154), [@aangelisc](https://github.com/aangelisc)
- **Azure:** Fix duplicated traces in multi-resource trace query [#95246](https://github.com/grafana/grafana/pull/95246), [@aangelisc](https://github.com/aangelisc)
- **Azure:** Handle namespace request rejection [#95908](https://github.com/grafana/grafana/pull/95908), [@aangelisc](https://github.com/aangelisc)
- **Folders:** Add admin permissions upon creation of a folder w. SA [#95416](https://github.com/grafana/grafana/pull/95416), [@eleijonmarck](https://github.com/eleijonmarck)
- **Migration:** Remove table aliasing in delete statement to make it work for mariadb [#95231](https://github.com/grafana/grafana/pull/95231), [@kalleep](https://github.com/kalleep)
- **ServerLock:** Fix pg concurrency/locking issue [#95934](https://github.com/grafana/grafana/pull/95934), [@mgyongyosi](https://github.com/mgyongyosi)
- **ServerSideExpressions:** Disable SQL Expressions to prevent RCE and LFI vulnerability [#94959](https://github.com/grafana/grafana/pull/94959), [@samjewell](https://github.com/samjewell)

<!-- 11.2.4 END -->
<!-- 11.1.9 START -->

# 11.1.9 (2024-11-19)

### Features and enhancements

- **Alerting:** Make context deadline on AlertNG service startup configurable [#96132](https://github.com/grafana/grafana/pull/96132), [@fayzal-g](https://github.com/fayzal-g)
- **User:** Check SignedInUser OrgID in RevokeInvite [#95488](https://github.com/grafana/grafana/pull/95488), [@mgyongyosi](https://github.com/mgyongyosi)

### Bug fixes

- **Alerting:** Force refetch prom rules when refreshing panel [#96123](https://github.com/grafana/grafana/pull/96123), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Anonymous User:** Adds validator service for anonymous users [#94992](https://github.com/grafana/grafana/pull/94992), [@leandro-deveikis](https://github.com/leandro-deveikis)
- **Anonymous User:** Adds validator service for anonymous users (Enterprise)
- **Azure Monitor:** Support metric namespaces fallback [#95153](https://github.com/grafana/grafana/pull/95153), [@aangelisc](https://github.com/aangelisc)
- **Azure:** Fix duplicated traces in multi-resource trace query [#95245](https://github.com/grafana/grafana/pull/95245), [@aangelisc](https://github.com/aangelisc)
- **Azure:** Handle namespace request rejection [#95907](https://github.com/grafana/grafana/pull/95907), [@aangelisc](https://github.com/aangelisc)
- **Migration:** Remove table aliasing in delete statement to make it work for mariadb [#95230](https://github.com/grafana/grafana/pull/95230), [@kalleep](https://github.com/kalleep)
- **Prometheus:** Fix interpolating adhoc filters with template variables [#95977](https://github.com/grafana/grafana/pull/95977), [@cazeaux](https://github.com/cazeaux)
- **ServerLock:** Fix pg concurrency/locking issue [#95933](https://github.com/grafana/grafana/pull/95933), [@mgyongyosi](https://github.com/mgyongyosi)
- **ServerSideExpressions:** Disable SQL Expressions to prevent RCE and LFI vulnerability [#94969](https://github.com/grafana/grafana/pull/94969), [@scottlepp](https://github.com/scottlepp)

<!-- 11.1.9 END -->
<!-- 11.0.8 START -->

# 11.0.8 (2024-11-19)

### Features and enhancements

- **Alerting:** Make context deadline on AlertNG service startup configurable [#96131](https://github.com/grafana/grafana/pull/96131), [@fayzal-g](https://github.com/fayzal-g)
- **User:** Check SignedInUser OrgID in RevokeInvite [#95487](https://github.com/grafana/grafana/pull/95487), [@mgyongyosi](https://github.com/mgyongyosi)

### Bug fixes

- **Anonymous User:** Adds validator service for anonymous users [#95151](https://github.com/grafana/grafana/pull/95151), [@leandro-deveikis](https://github.com/leandro-deveikis)
- **Anonymous User:** Adds validator service for anonymous users (Enterprise)
- **Azure Monitor:** Support metric namespaces fallback [#95152](https://github.com/grafana/grafana/pull/95152), [@aangelisc](https://github.com/aangelisc)
- **Azure:** Fix duplicated traces in multi-resource trace query [#95244](https://github.com/grafana/grafana/pull/95244), [@aangelisc](https://github.com/aangelisc)
- **Azure:** Handle namespace request rejection [#95906](https://github.com/grafana/grafana/pull/95906), [@aangelisc](https://github.com/aangelisc)
- **Migration:** Remove table aliasing in delete statement to make it work for mariadb [#95229](https://github.com/grafana/grafana/pull/95229), [@kalleep](https://github.com/kalleep)
- **Prometheus:** Fix interpolating adhoc filters with template variables [#95986](https://github.com/grafana/grafana/pull/95986), [@cazeaux](https://github.com/cazeaux)
- **ServerLock:** Fix pg concurrency/locking issue [#95932](https://github.com/grafana/grafana/pull/95932), [@mgyongyosi](https://github.com/mgyongyosi)
- **ServerSideExpressions:** Disable SQL Expressions to prevent RCE and LFI vulnerability [#94971](https://github.com/grafana/grafana/pull/94971), [@samjewell](https://github.com/samjewell)

<!-- 11.0.8 END -->
<!-- 10.4.13 START -->

# 10.4.13 (2024-11-19)

<!-- 10.4.13 END -->
<!-- 11.3.0+security-01 START -->

# 11.3.0+security-01 (2024-11-12)

### Bug fixes

- **MigrationAssistant:** Fix Migration Assistant issue [CVE-2024-9476]

<!-- 11.3.0+security-01 END -->
<!-- 11.2.3+security-01 START -->

# 11.2.3+security-01 (2024-11-12)

- **MigrationAssistant:** Fix Migration Assistant issue [CVE-2024-9476]

<!-- 11.2.3+security-01 END -->
<!-- 10.4.12 START -->

# 10.4.12 (2024-11-08)

### Bug fixes

- **Alerting:** Make context deadline on AlertNG service startup configurable [#96058](https://github.com/grafana/grafana/pull/96058), [@fayzal-g](https://github.com/fayzal-g)

<!-- 10.4.12 END -->
<!-- 11.3.0 START -->

# 11.3.0 (2024-10-22)

### Features and enhancements

- **Alerting:** Add manage permissions UI logic for Contact Points [#92885](https://github.com/grafana/grafana/pull/92885), [@tomratcliffe](https://github.com/tomratcliffe)
- **Alerting:** Allow linking to silence form with `__alert_rule_uid__` value preset [#93526](https://github.com/grafana/grafana/pull/93526), [@tomratcliffe](https://github.com/tomratcliffe)
- **Alerting:** Hide query name when using simplified mode in the alert rule [#93779](https://github.com/grafana/grafana/pull/93779), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Limit and clean up old alert rules versions [#89754](https://github.com/grafana/grafana/pull/89754), [@igloo12](https://github.com/igloo12)
- **Alerting:** Style nits for the simple query mode [#93930](https://github.com/grafana/grafana/pull/93930), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Update texts in annotations step [#93977](https://github.com/grafana/grafana/pull/93977), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Use useProduceNewAlertmanagerConfiguration for contact points [#88456](https://github.com/grafana/grafana/pull/88456), [@gillesdemey](https://github.com/gillesdemey)
- **Auth:** Attach external session info to Grafana session [#93849](https://github.com/grafana/grafana/pull/93849), [@mgyongyosi](https://github.com/mgyongyosi)
- **Auth:** Replace jmespath/go-jmespath with jmespath-community/go-jmespath [#94203](https://github.com/grafana/grafana/pull/94203), [@mgyongyosi](https://github.com/mgyongyosi)
- **CloudMigrations:** Add support for migration of Library Elements (Panels) resources [#93898](https://github.com/grafana/grafana/pull/93898), [@macabu](https://github.com/macabu)
- **Cloudwatch:** Update grafana-aws-sdk [#94155](https://github.com/grafana/grafana/pull/94155), [@iwysiu](https://github.com/iwysiu)
- **Explore Logs:** Preinstall for onprem Grafana instances [#94221](https://github.com/grafana/grafana/pull/94221), [@svennergr](https://github.com/svennergr)
- **ExploreMetrics:** Ensure compatibility with Incremental Querying [#94355](https://github.com/grafana/grafana/pull/94355), [@NWRichmond](https://github.com/NWRichmond)
- **FieldConfig:** Add support for Actions [#92874](https://github.com/grafana/grafana/pull/92874), [@adela-almasan](https://github.com/adela-almasan)
- **Plugin Extensions:** Require meta-data to be defined in `plugin.json` during development mode [#93429](https://github.com/grafana/grafana/pull/93429), [@leventebalogh](https://github.com/leventebalogh)
- **Reporting:** Display template variables in the PDF (Enterprise)
- **Tempo:** Add deprecation notice for Aggregate By [#94050](https://github.com/grafana/grafana/pull/94050), [@joey-grafana](https://github.com/joey-grafana)

### Bug fixes

- **Alerting/Chore:** Fix TimeRangeInput not working across multiple months [#93622](https://github.com/grafana/grafana/pull/93622), [@tomratcliffe](https://github.com/tomratcliffe)
- **Alerting:** Fix default value for input in simple condition [#94248](https://github.com/grafana/grafana/pull/94248), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Fix eval interval not being saved when creating a new group [#93821](https://github.com/grafana/grafana/pull/93821), [@tomratcliffe](https://github.com/tomratcliffe)
- **Alerting:** Fix incorrect permission on POST external rule groups endpoint [CVE-2024-8118] [#93940](https://github.com/grafana/grafana/pull/93940), [@alexweav](https://github.com/alexweav)
- **Alerting:** Fix panics when attempting to create an Alertmanager after failing [#94023](https://github.com/grafana/grafana/pull/94023), [@santihernandezc](https://github.com/santihernandezc)
- **DashboardScene:** Fixes url issue with subpath when exiting edit mode [#93962](https://github.com/grafana/grafana/pull/93962), [@torkelo](https://github.com/torkelo)
- **Dashboards:** Enable scenes by default [#93818](https://github.com/grafana/grafana/pull/93818), [@ivanortegaalba](https://github.com/ivanortegaalba)
- **Dashboards:** Fixes view & edit keyboard shortcuts when grafana is behind a subpath [#93955](https://github.com/grafana/grafana/pull/93955), [@torkelo](https://github.com/torkelo)
- **ElasticSearch:** Fix errorsource in newInstanceSettings [#93859](https://github.com/grafana/grafana/pull/93859), [@iwysiu](https://github.com/iwysiu)
- **Reporting:** Fix reports on multi-org instance (Enterprise)
- **SubMenu:** Fix expanding sub menu items on touch devices [#93208](https://github.com/grafana/grafana/pull/93208), [@yincongcyincong](https://github.com/yincongcyincong)

<!-- 11.3.0 END -->
<!-- 11.2.3 START -->

# 11.2.3 (2024-10-22)

### Bug fixes

- **Alerting:** Fix incorrect permission on POST external rule groups endpoint [CVE-2024-8118] [#93947](https://github.com/grafana/grafana/pull/93947), [@alexweav](https://github.com/alexweav)
- **AzureMonitor:** Fix App Insights portal URL for multi-resource trace queries [#94475](https://github.com/grafana/grafana/pull/94475), [@aangelisc](https://github.com/aangelisc)
- **Canvas:** Allow API calls to grafana origin [#94129](https://github.com/grafana/grafana/pull/94129), [@adela-almasan](https://github.com/adela-almasan)
- **Folders:** Correctly show new folder button under root folder [#94712](https://github.com/grafana/grafana/pull/94712), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **OrgSync:** Do not set default Organization for a user to a non-existent Organization [#94549](https://github.com/grafana/grafana/pull/94549), [@mgyongyosi](https://github.com/mgyongyosi)
- **Plugins:** Skip install errors if dependency plugin already exists [#94717](https://github.com/grafana/grafana/pull/94717), [@wbrowne](https://github.com/wbrowne)
- **ServerSideExpressions:** Disable SQL Expressions to prevent RCE and LFI vulnerability [#94959](https://github.com/grafana/grafana/pull/94959), [@samjewell](https://github.com/samjewell)

<!-- 11.2.3 END -->
<!-- 11.2.2+security-01 START -->

# 11.2.2+security-01 (2024-10-17)

### Bug fixes

- **SQL Expressions**: Fixes CVE-2024-9264

<!-- 11.2.2+security-01 END -->
<!-- 11.2.1+security-01 START -->

# 11.2.1+security-01 (2024-10-17)

### Features and enhancements

### Bug fixes

- **SQL Expressions**: Fixes CVE-2024-9264

<!-- 11.2.1+security-01 END -->
<!-- 11.1.8 START -->

# 11.1.8 (2024-10-22)

### Bug fixes

- **Alerting:** Fix incorrect permission on POST external rule groups endpoint [CVE-2024-8118] [#93948](https://github.com/grafana/grafana/pull/93948), [@alexweav](https://github.com/alexweav)
- **AzureMonitor:** Fix App Insights portal URL for multi-resource trace queries [#94474](https://github.com/grafana/grafana/pull/94474), [@aangelisc](https://github.com/aangelisc)
- **OrgSync:** Do not set default Organization for a user to a non-existent Organization [#94551](https://github.com/grafana/grafana/pull/94551), [@mgyongyosi](https://github.com/mgyongyosi)
- **ServerSideExpressions:** Disable SQL Expressions to prevent RCE and LFI vulnerability [#94969](https://github.com/grafana/grafana/pull/94969), [@scottlepp](https://github.com/scottlepp)

<!-- 11.1.8 END -->
<!-- 11.1.7+security-01 START -->

# 11.1.7+security-01 (2024-10-17)

### Bug fixes

- **SQL Expressions**: Fixes CVE-2024-9264

<!-- 11.1.7+security-01 END -->
<!-- 11.1.6+security-01 START -->

# 11.1.6+security-01 (2024-10-17)

### Bug fixes

- **SQL Expressions**: Fixes CVE-2024-9264

<!-- 11.1.6+security-01 END -->
<!-- 11.0.6+security-01 START -->

# 11.0.6+security-01 (2024-10-17)

### Bug fixes

- **SQL Expressions**: Fixes CVE-2024-9264

<!-- 11.0.6+security-01 END -->
<!-- 11.0.5+security-01 START -->

# 11.0.5+security-01 (2024-10-17)

### Bug fixes

- **SQL Expressions**: Fixes CVE-2024-9264

<!-- 11.0.5+security-01 END -->
<!-- 11.2.2 START -->

# 11.2.2 (2024-10-01)

### Features and enhancements

- **Chore:** Bump Go to 1.22.7 [#93353](https://github.com/grafana/grafana/pull/93353), [@hairyhenderson](https://github.com/hairyhenderson)
- **Chore:** Bump Go to 1.22.7 (Enterprise)
- **Data sources:** Hide the datasource redirection banner for users who can't interact with data sources [#93103](https://github.com/grafana/grafana/pull/93103), [@IevaVasiljeva](https://github.com/IevaVasiljeva)

### Bug fixes

- **Alerting:** Fix preview of silences when label name contains spaces [#93051](https://github.com/grafana/grafana/pull/93051), [@tomratcliffe](https://github.com/tomratcliffe)
- **Alerting:** Make query wrapper match up datasource UIDs if necessary [#93114](https://github.com/grafana/grafana/pull/93114), [@tomratcliffe](https://github.com/tomratcliffe)
- **AzureMonitor:** Deduplicate resource picker rows [#93705](https://github.com/grafana/grafana/pull/93705), [@aangelisc](https://github.com/aangelisc)
- **AzureMonitor:** Improve resource picker efficiency [#93440](https://github.com/grafana/grafana/pull/93440), [@aangelisc](https://github.com/aangelisc)
- **AzureMonitor:** Remove Basic Logs retention warning [#93123](https://github.com/grafana/grafana/pull/93123), [@aangelisc](https://github.com/aangelisc)
- **CloudWatch:** Fix segfault when migrating legacy queries [#93544](https://github.com/grafana/grafana/pull/93544), [@iwysiu](https://github.com/iwysiu)
- **Correlations:** Limit access to correlations page to users who can access Explore [#93676](https://github.com/grafana/grafana/pull/93676), [@ifrost](https://github.com/ifrost)
- **DashboardScene:** Fix broken error handling and error rendering [#93690](https://github.com/grafana/grafana/pull/93690), [@torkelo](https://github.com/torkelo)
- **Plugins:** Avoid returning 404 for `AutoEnabled` apps [#93488](https://github.com/grafana/grafana/pull/93488), [@wbrowne](https://github.com/wbrowne)

<!-- 11.2.2 END -->
<!-- 11.1.7 START -->

# 11.1.7 (2024-10-01)

### Features and enhancements

- **Chore:** Bump Go to 1.22.7 [#93355](https://github.com/grafana/grafana/pull/93355), [@hairyhenderson](https://github.com/hairyhenderson)
- **Chore:** Bump Go to 1.22.7 (Enterprise)

### Bug fixes

- **Alerting:** Fix preview of silences when label name contains spaces [#93050](https://github.com/grafana/grafana/pull/93050), [@tomratcliffe](https://github.com/tomratcliffe)
- **Alerting:** Make query wrapper match up datasource UIDs if necessary [#93115](https://github.com/grafana/grafana/pull/93115), [@tomratcliffe](https://github.com/tomratcliffe)
- **AzureMonitor:** Deduplicate resource picker rows [#93704](https://github.com/grafana/grafana/pull/93704), [@aangelisc](https://github.com/aangelisc)
- **AzureMonitor:** Improve resource picker efficiency [#93439](https://github.com/grafana/grafana/pull/93439), [@aangelisc](https://github.com/aangelisc)
- **AzureMonitor:** Remove Basic Logs retention warning [#93122](https://github.com/grafana/grafana/pull/93122), [@aangelisc](https://github.com/aangelisc)
- **Correlations:** Limit access to correlations page to users who can access Explore [#93675](https://github.com/grafana/grafana/pull/93675), [@ifrost](https://github.com/ifrost)
- **Plugins:** Avoid returning 404 for `AutoEnabled` apps [#93487](https://github.com/grafana/grafana/pull/93487), [@wbrowne](https://github.com/wbrowne)

<!-- 11.1.7 END -->
<!-- 11.0.7 START -->

# 11.0.7 (2024-10-22)

### Bug fixes

- **Alerting:** Fix incorrect permission on POST external rule groups endpoint [CVE-2024-8118] [#93949](https://github.com/grafana/grafana/pull/93949), [@alexweav](https://github.com/alexweav)
- **AzureMonitor:** Fix App Insights portal URL for multi-resource trace queries [#94489](https://github.com/grafana/grafana/pull/94489), [@aangelisc](https://github.com/aangelisc)
- **Dashboard:** Make dashboard search faster [#94702](https://github.com/grafana/grafana/pull/94702), [@knuzhdin](https://github.com/knuzhdin)
- **OrgSync:** Do not set default Organization for a user to a non-existent Organization [#94552](https://github.com/grafana/grafana/pull/94552), [@mgyongyosi](https://github.com/mgyongyosi)
- **ServerSideExpressions:** Disable SQL Expressions to prevent RCE and LFI vulnerability [#94971](https://github.com/grafana/grafana/pull/94971), [@samjewell](https://github.com/samjewell)

<!-- 11.0.7 END -->
<!-- 11.0.6 START -->

# 11.0.6 (2024-10-01)

### Features and enhancements

- **Chore:** Bump Go to 1.22.7 [#93358](https://github.com/grafana/grafana/pull/93358), [@hairyhenderson](https://github.com/hairyhenderson)
- **Chore:** Bump Go to 1.22.7 (Enterprise)

### Bug fixes

- **AzureMonitor:** Deduplicate resource picker rows [#93703](https://github.com/grafana/grafana/pull/93703), [@aangelisc](https://github.com/aangelisc)
- **AzureMonitor:** Improve resource picker efficiency [#93438](https://github.com/grafana/grafana/pull/93438), [@aangelisc](https://github.com/aangelisc)
- **Correlations:** Limit access to correlations page to users who can access Explore [#93674](https://github.com/grafana/grafana/pull/93674), [@ifrost](https://github.com/ifrost)
- **Plugins:** Avoid returning 404 for `AutoEnabled` apps [#93486](https://github.com/grafana/grafana/pull/93486), [@wbrowne](https://github.com/wbrowne)

<!-- 11.0.6 END -->
<!-- 10.4.11 START -->

# 10.4.11 (2024-10-22)

### Bug fixes

- **Alerting:** Fix broken panelId links [#94686](https://github.com/grafana/grafana/pull/94686), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Fix incorrect permission on POST external rule groups endpoint [CVE-2024-8118] [#93946](https://github.com/grafana/grafana/pull/93946), [@alexweav](https://github.com/alexweav)
- **Dashboard:** Make dashboard search faster [#94703](https://github.com/grafana/grafana/pull/94703), [@knuzhdin](https://github.com/knuzhdin)

<!-- 10.4.11 END -->
<!-- 10.4.10 START -->

# 10.4.10 (2024-10-01)

### Features and enhancements

- **Chore:** Bump Go to 1.22.7 [#93359](https://github.com/grafana/grafana/pull/93359), [@hairyhenderson](https://github.com/hairyhenderson)
- **Chore:** Bump Go to 1.22.7 (Enterprise)

### Bug fixes

- **AzureMonitor:** Deduplicate resource picker rows [#93702](https://github.com/grafana/grafana/pull/93702), [@aangelisc](https://github.com/aangelisc)
- **Correlations:** Limit access to correlations page to users who can access Explore [#93673](https://github.com/grafana/grafana/pull/93673), [@ifrost](https://github.com/ifrost)

<!-- 10.4.10 END -->
<!-- 10.3.12 START -->

# 10.3.12 (2024-10-22)

### Bug fixes

- **Alerting:** Fix incorrect permission on POST external rule groups endpoint [CVE-2024-8118] [#93945](https://github.com/grafana/grafana/pull/93945), [@alexweav](https://github.com/alexweav)
- **Dashboard:** Make dashboard search faster [#94704](https://github.com/grafana/grafana/pull/94704), [@knuzhdin](https://github.com/knuzhdin)

<!-- 10.3.12 END -->
<!-- 10.3.11 START -->

# 10.3.11 (2024-10-01)

### Features and enhancements

- **Chore:** Bump Go to 1.22.7 [#93360](https://github.com/grafana/grafana/pull/93360), [@hairyhenderson](https://github.com/hairyhenderson)
- **Chore:** Bump Go to 1.22.7 (Enterprise)

### Bug fixes

- **Correlations:** Limit access to correlations page to users who can access Explore [#93672](https://github.com/grafana/grafana/pull/93672), [@ifrost](https://github.com/ifrost)

<!-- 10.3.11 END -->
<!-- 11.2.1 START -->

# 11.2.1 (2024-09-26)

### Features and enhancements

- **Alerting:** Support for optimistic concurrency in priovisioning Tempate API [#92251](https://github.com/grafana/grafana/pull/92251), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Logs panel:** Enable displayedFields in dashboards and apps [#92675](https://github.com/grafana/grafana/pull/92675), [@matyax](https://github.com/matyax)
- **State timeline:** Add pagination support [#92257](https://github.com/grafana/grafana/pull/92257), [@kevinputera](https://github.com/kevinputera)

### Bug fixes

- **Authn:** No longer hash service account token twice during authentication [#92639](https://github.com/grafana/grafana/pull/92639), [@kalleep](https://github.com/kalleep)
- **CloudMigrations:** Fix snapshot creation on Windows systems [#92981](https://github.com/grafana/grafana/pull/92981), [@macabu](https://github.com/macabu)
- **DashGPT:** Fixes issue with generation on Safari [#92952](https://github.com/grafana/grafana/pull/92952), [@kaydelaney](https://github.com/kaydelaney)
- **Dashboard:** Fix Annotation runtime error when a data source does not support annotations [#92830](https://github.com/grafana/grafana/pull/92830), [@axelavargas](https://github.com/axelavargas)
- **Grafana SQL:** Fix broken import in NumberInput component [#92808](https://github.com/grafana/grafana/pull/92808), [@chessman](https://github.com/chessman)
- **Logs:** Show older logs button when infinite scroll is enabled and sort order is descending [#92867](https://github.com/grafana/grafana/pull/92867), [@matyax](https://github.com/matyax)
- **RBAC:** Fix an issue with server admins not being able to manage users in orgs that they don't belong to [#92274](https://github.com/grafana/grafana/pull/92274), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **RBAC:** Fix an issue with server admins not being able to manage users in orgs that they don't belong to (Enterprise)
- **Reporting:** Disable dashboardSceneSolo when rendering PDFs the old way (Enterprise)
- **Templating:** Fix searching non-latin template variables [#92893](https://github.com/grafana/grafana/pull/92893), [@leeoniya](https://github.com/leeoniya)
- **TutorialCard:** Fix link to tutorial not opening [#92647](https://github.com/grafana/grafana/pull/92647), [@eledobleefe](https://github.com/eledobleefe)
- **Alerting:** Fixed CVE-2024-8118.

### Plugin development fixes & changes

- **AutoSizeInput:** Allow to be controlled by value [#92999](https://github.com/grafana/grafana/pull/92999), [@ivanortegaalba](https://github.com/ivanortegaalba)

<!-- 11.2.1 END -->
<!-- 11.1.6 START -->

# 11.1.6 (2024-09-26)

### Features and enhancements

- **Chore:** Update swagger ui (4.3.0 to 5.17.14) [#92341](https://github.com/grafana/grafana/pull/92341), [@ryantxu](https://github.com/ryantxu)

### Bug fixes

- **Templating:** Fix searching non-latin template variables [#92892](https://github.com/grafana/grafana/pull/92892), [@leeoniya](https://github.com/leeoniya)
- **TutorialCard:** Fix link to tutorial not opening [#92646](https://github.com/grafana/grafana/pull/92646), [@eledobleefe](https://github.com/eledobleefe)

### Plugin development fixes & changes

- **Bugfix:** QueryField typeahead missing background color [#92316](https://github.com/grafana/grafana/pull/92316), [@mckn](https://github.com/mckn)
- **Alerting:** Fixed CVE-2024-8118.

<!-- 11.1.6 END -->
<!-- 11.0.5 START -->

# 11.0.5 (2024-09-26)

### Features and enhancements

- **Chore:** Update swagger ui (4.3.0 to 5.17.14) [#92345](https://github.com/grafana/grafana/pull/92345), [@ryantxu](https://github.com/ryantxu)

### Bug fixes

- **Provisioning:** Prevent provisioning folder errors from failing startup [#92588](https://github.com/grafana/grafana/pull/92588), [@suntala](https://github.com/suntala)
- **TutorialCard:** Fix link to tutorial not opening [#92645](https://github.com/grafana/grafana/pull/92645), [@eledobleefe](https://github.com/eledobleefe)
- **Alerting:** Fixed CVE-2024-8118.

<!-- 11.0.5 END -->
<!-- 10.4.9 START -->

# 10.4.9 (2024-09-26)

### Features and enhancements

- **Chore:** Update swagger ui (4.3.0 to 5.17.14) [#92344](https://github.com/grafana/grafana/pull/92344), [@ryantxu](https://github.com/ryantxu)

### Bug fixes

- **Provisioning:** Prevent provisioning folder errors from failing startup [#92591](https://github.com/grafana/grafana/pull/92591), [@suntala](https://github.com/suntala)
- **Alerting:** Fixed CVE-2024-8118.

<!-- 10.4.9 END -->
<!-- 10.3.10 START -->

# 10.3.10 (2024-09-26)

### Bug fixes

- **Alerting:** Fixed CVE-2024-8118.

<!-- 10.3.10 END -->
<!-- 11.2.0 START -->

# 11.2.0 (2024-08-27)

### Features and enhancements

- **@grafana/data:** Introduce new getTagKeys/getTagValues response interface [#88369](https://github.com/grafana/grafana/pull/88369), [@kaydelaney](https://github.com/kaydelaney)
- **AWS:** Update deprecated aws-sdk functions from env variable versions [#89643](https://github.com/grafana/grafana/pull/89643), [@iwysiu](https://github.com/iwysiu)
- **Alerting:** Add ha_reconnect_timeout configuration option [#88823](https://github.com/grafana/grafana/pull/88823), [@JacobValdemar](https://github.com/JacobValdemar)
- **Alerting:** Add setting for maximum allowed rule evaluation results [#89468](https://github.com/grafana/grafana/pull/89468), [@alexander-akhmetov](https://github.com/alexander-akhmetov)
- **Alerting:** Add warning in telegram contact point [#89397](https://github.com/grafana/grafana/pull/89397), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Central alert history part4 [#90088](https://github.com/grafana/grafana/pull/90088), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Don't crash the page when trying to filter rules by regex [#89466](https://github.com/grafana/grafana/pull/89466), [@tomratcliffe](https://github.com/tomratcliffe)
- **Alerting:** Enable remote primary mode using feature toggles [#88976](https://github.com/grafana/grafana/pull/88976), [@santihernandezc](https://github.com/santihernandezc)
- **Alerting:** Hide edit/view rule buttons according to deleting/creating state [#90375](https://github.com/grafana/grafana/pull/90375), [@tomratcliffe](https://github.com/tomratcliffe)
- **Alerting:** Implement UI for grafana-managed recording rules [#90360](https://github.com/grafana/grafana/pull/90360), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Improve performance of /api/prometheus for large numbers of alerts. [#89268](https://github.com/grafana/grafana/pull/89268), [@stevesg](https://github.com/stevesg)
- **Alerting:** Include a list of ref_Id and aggregated datasource UIDs to alerts when state reason is NoData [#88819](https://github.com/grafana/grafana/pull/88819), [@wasim-nihal](https://github.com/wasim-nihal)
- **Alerting:** Instrument outbound requests for Loki Historian and Remote Alertmanager with tracing [#89185](https://github.com/grafana/grafana/pull/89185), [@alexweav](https://github.com/alexweav)
- **Alerting:** Limit instances on alert detail view unless in instances tab [#89368](https://github.com/grafana/grafana/pull/89368), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Make alert group editing safer [#88627](https://github.com/grafana/grafana/pull/88627), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Make whitespace more visible on labels [#90223](https://github.com/grafana/grafana/pull/90223), [@tomratcliffe](https://github.com/tomratcliffe)
- **Alerting:** Remove option to return settings from api/v1/receivers and restrict provisioning action access [#90861](https://github.com/grafana/grafana/pull/90861), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Resend resolved notifications for ResolvedRetention duration [#88938](https://github.com/grafana/grafana/pull/88938), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Show Insights page only on cloud (when required ds's are available) [#89679](https://github.com/grafana/grafana/pull/89679), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Show repeat interval in timing options meta [#89414](https://github.com/grafana/grafana/pull/89414), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Support median in reduce expressions [#91119](https://github.com/grafana/grafana/pull/91119), [@alexander-akhmetov](https://github.com/alexander-akhmetov)
- **Alerting:** Track central ash interactions [#90330](https://github.com/grafana/grafana/pull/90330), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Update alerting state history API to authorize access using RBAC [#89579](https://github.com/grafana/grafana/pull/89579), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Update warning message for Telegram parse_mode and default to empty value [#89630](https://github.com/grafana/grafana/pull/89630), [@tomratcliffe](https://github.com/tomratcliffe)
- **Alerting:** Use Runbook URL label everywhere and add validation in the alert rule… [#90523](https://github.com/grafana/grafana/pull/90523), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Use cloud notifier types for metadata on Cloud AMs [#91054](https://github.com/grafana/grafana/pull/91054), [@tomratcliffe](https://github.com/tomratcliffe)
- **Alerting:** Use stable identifier of a group when export to HCL [#90196](https://github.com/grafana/grafana/pull/90196), [@KyriosGN0](https://github.com/KyriosGN0)
- **Alerting:** Use stable identifier of a group,contact point,mute timing when export to HCL [#90917](https://github.com/grafana/grafana/pull/90917), [@KyriosGN0](https://github.com/KyriosGN0)
- **Alertmanager:** Support limits for silences [#90826](https://github.com/grafana/grafana/pull/90826), [@santihernandezc](https://github.com/santihernandezc)
- **Angular deprecation:** Disable dynamic angular inspector if CheckForPluginUpdates is false [#91194](https://github.com/grafana/grafana/pull/91194), [@xnyo](https://github.com/xnyo)
- **App events:** Add "info" variant [#89903](https://github.com/grafana/grafana/pull/89903), [@Clarity-89](https://github.com/Clarity-89)
- **Auth:** Add org to role mappings support to AzureAD/Entra integration [#88861](https://github.com/grafana/grafana/pull/88861), [@mgyongyosi](https://github.com/mgyongyosi)
- **Auth:** Add organization mapping configuration to the UI [#90003](https://github.com/grafana/grafana/pull/90003), [@mgyongyosi](https://github.com/mgyongyosi)
- **Auth:** Add support for escaping colon characters in org_mapping [#89951](https://github.com/grafana/grafana/pull/89951), [@mgyongyosi](https://github.com/mgyongyosi)
- **Azure:** Add new Azure infrastructure dashboards [#88869](https://github.com/grafana/grafana/pull/88869), [@yves-chan](https://github.com/yves-chan)
- **BrowseDashboards:** Update results when starred param changes [#89944](https://github.com/grafana/grafana/pull/89944), [@Clarity-89](https://github.com/Clarity-89)
- **Caching:** Handle memcached reconnects [#91498](https://github.com/grafana/grafana/pull/91498), [@mmandrus](https://github.com/mmandrus)
- **Calendar:** Add labels for next/previous month [#89019](https://github.com/grafana/grafana/pull/89019), [@ashharrison90](https://github.com/ashharrison90)
- **Canvas:** Element level data links [#89079](https://github.com/grafana/grafana/pull/89079), [@adela-almasan](https://github.com/adela-almasan)
- **Canvas:** Improved tooltip [#90162](https://github.com/grafana/grafana/pull/90162), [@adela-almasan](https://github.com/adela-almasan)
- **Canvas:** Support template variables in base URL of actions [#91227](https://github.com/grafana/grafana/pull/91227), [@nmarrs](https://github.com/nmarrs)
- **Chore:** Add missing build elements to Dockerfile [#89714](https://github.com/grafana/grafana/pull/89714), [@azilly-de](https://github.com/azilly-de)
- **Chore:** Add unit test for cloudmigration package [#88868](https://github.com/grafana/grafana/pull/88868), [@leandro-deveikis](https://github.com/leandro-deveikis)
- **Chore:** Commit results of bingo get [#90256](https://github.com/grafana/grafana/pull/90256), [@mmandrus](https://github.com/mmandrus)
- **CloudMigrations:** Change onPremToCloudMigrations feature toggle to public preview [#90757](https://github.com/grafana/grafana/pull/90757), [@mmandrus](https://github.com/mmandrus)
- **CloudWatch:** Add errorsource for QueryData [#91085](https://github.com/grafana/grafana/pull/91085), [@iwysiu](https://github.com/iwysiu)
- **CloudWatch:** Update grafana-aws-sdk for updated metrics [#91364](https://github.com/grafana/grafana/pull/91364), [@iwysiu](https://github.com/iwysiu)
- **Cloudwatch:** Clear cached PDC transport when PDC is disabled [#91357](https://github.com/grafana/grafana/pull/91357), [@njvrzm](https://github.com/njvrzm)
- **Cloudwatch:** Metrics Query Builder should clear old query [#88950](https://github.com/grafana/grafana/pull/88950), [@iwysiu](https://github.com/iwysiu)
- **Cloudwatch:** Remove awsDatasourcesNewFormStyling feature toggle [#90128](https://github.com/grafana/grafana/pull/90128), [@idastambuk](https://github.com/idastambuk)
- **Cloudwatch:** Rename Metric Query to Metric Insights [#89955](https://github.com/grafana/grafana/pull/89955), [@idastambuk](https://github.com/idastambuk)
- **Cloudwatch:** Round up endTime in GetMetricData to next minute [#89341](https://github.com/grafana/grafana/pull/89341), [@idastambuk](https://github.com/idastambuk)
- **Dashboard:** Use preferred timezone on create [#89833](https://github.com/grafana/grafana/pull/89833), [@Clarity-89](https://github.com/Clarity-89)
- **Datalinks:** UX improvements [#91352](https://github.com/grafana/grafana/pull/91352), [@adela-almasan](https://github.com/adela-almasan)
- **DateTimePicker:** Add "timeZone" prop [#90031](https://github.com/grafana/grafana/pull/90031), [@Clarity-89](https://github.com/Clarity-89)
- **Dynatrace:** Add to list of DS with custom label logic [#90258](https://github.com/grafana/grafana/pull/90258), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Elasticsearch:** Decouple backend from infra/http [#90408](https://github.com/grafana/grafana/pull/90408), [@njvrzm](https://github.com/njvrzm)
- **Elasticsearch:** Decouple backend from infra/log [#90527](https://github.com/grafana/grafana/pull/90527), [@njvrzm](https://github.com/njvrzm)
- **Elasticsearch:** Decouple backend from infra/tracing [#90528](https://github.com/grafana/grafana/pull/90528), [@njvrzm](https://github.com/njvrzm)
- **Explore:** Add setting for default time offset [#90401](https://github.com/grafana/grafana/pull/90401), [@gelicia](https://github.com/gelicia)
- **Feat:** Extending report interaction with static context that can be appended to all interaction events [#88927](https://github.com/grafana/grafana/pull/88927), [@tolzhabayev](https://github.com/tolzhabayev)
- **Feature management:** Add openSearchBackendFlowEnabled feature toggle [#89208](https://github.com/grafana/grafana/pull/89208), [@idastambuk](https://github.com/idastambuk)
- **Features:** Add cloudwatchMetricInsightsCrossAccount feature toggle [#89848](https://github.com/grafana/grafana/pull/89848), [@idastambuk](https://github.com/idastambuk)
- **Features:** Release Cloudwatch Metric Insights cross-account querying to public preview [#91066](https://github.com/grafana/grafana/pull/91066), [@idastambuk](https://github.com/idastambuk)
- **FlameGraph:** Remove flameGraphItemCollapsing feature toggle [#90190](https://github.com/grafana/grafana/pull/90190), [@joey-grafana](https://github.com/joey-grafana)
- **GCP:** Update GKE monitoring dashboard [#90091](https://github.com/grafana/grafana/pull/90091), [@aangelisc](https://github.com/aangelisc)
- **GOps:** Add Grafana SLO steps to IRM configuration tracker [#88098](https://github.com/grafana/grafana/pull/88098), [@obetomuniz](https://github.com/obetomuniz)
- **Grafana:** Enables use of encrypted certificates with password for https [#91418](https://github.com/grafana/grafana/pull/91418), [@leandro-deveikis](https://github.com/leandro-deveikis)
- **IDToken:** Add current user's DisplayName to the ID token [#90992](https://github.com/grafana/grafana/pull/90992), [@colin-stuart](https://github.com/colin-stuart)
- **IDToken:** Add current user's Username and UID to the ID token [#90240](https://github.com/grafana/grafana/pull/90240), [@mgyongyosi](https://github.com/mgyongyosi)
- **Keybinds:** Allow move time range shortcuts (t left / t right) to be chained [#88904](https://github.com/grafana/grafana/pull/88904), [@joshhunt](https://github.com/joshhunt)
- **LibraryPanels:** Use new folder picker when creating a library panel [#89228](https://github.com/grafana/grafana/pull/89228), [@joshhunt](https://github.com/joshhunt)
- **Log:** Added panel support for filtering callbacks [#88980](https://github.com/grafana/grafana/pull/88980), [@matyax](https://github.com/matyax)
- **Logs:** Add log line to content outline when clicking on datalinks [#90207](https://github.com/grafana/grafana/pull/90207), [@gtk-grafana](https://github.com/gtk-grafana)
- **Loki:** Add option to issue forward queries [#91181](https://github.com/grafana/grafana/pull/91181), [@svennergr](https://github.com/svennergr)
- **Loki:** Added support for negative numbers in LogQL [#88719](https://github.com/grafana/grafana/pull/88719), [@matyax](https://github.com/matyax)
- **Loki:** Also replace `step` with vars [#91031](https://github.com/grafana/grafana/pull/91031), [@svennergr](https://github.com/svennergr)
- **Loki:** Remove `instant` query type from Log queries [#90137](https://github.com/grafana/grafana/pull/90137), [@svennergr](https://github.com/svennergr)
- **Loki:** Respect pre-selected filters in adhoc filter queries [#89022](https://github.com/grafana/grafana/pull/89022), [@ivanahuckova](https://github.com/ivanahuckova)
- **MSSQL:** Password auth for Azure AD [#89746](https://github.com/grafana/grafana/pull/89746), [@bossinc](https://github.com/bossinc)
- **Metrics:** Add ability to disable classic histogram for HTTP metric [#88315](https://github.com/grafana/grafana/pull/88315), [@hairyhenderson](https://github.com/hairyhenderson)
- **Nav:** Add items to saved [#89908](https://github.com/grafana/grafana/pull/89908), [@Clarity-89](https://github.com/Clarity-89)
- **OpenAPI:** Document the `/api/health` endpoint [#88203](https://github.com/grafana/grafana/pull/88203), [@julienduchesne](https://github.com/julienduchesne)
- **PanelChrome:** Use labelledby for accessible title [#88781](https://github.com/grafana/grafana/pull/88781), [@tskarhed](https://github.com/tskarhed)
- **Plugins:** Add filters by update available [#91526](https://github.com/grafana/grafana/pull/91526), [@oshirohugo](https://github.com/oshirohugo)
- **Plugins:** Add logs to for plugin management actions [#90587](https://github.com/grafana/grafana/pull/90587), [@oshirohugo](https://github.com/oshirohugo)
- **Plugins:** Disable install controls for provisioned plugin in cloud [#90479](https://github.com/grafana/grafana/pull/90479), [@oshirohugo](https://github.com/oshirohugo)
- **Plugins:** Expose functions to plugins for checking RBAC permissions [#89047](https://github.com/grafana/grafana/pull/89047), [@jackw](https://github.com/jackw)
- **Plugins:** Improve levitate / breaking changes report in grafana/grafana [#89822](https://github.com/grafana/grafana/pull/89822), [@oshirohugo](https://github.com/oshirohugo)
- **Plugins:** Support > 1 levels of plugin dependencies [#90174](https://github.com/grafana/grafana/pull/90174), [@wbrowne](https://github.com/wbrowne)
- **Plugins:** Update CLI check if plugin is already installed [#91213](https://github.com/grafana/grafana/pull/91213), [@wbrowne](https://github.com/wbrowne)
- **Prometheus:** Deprecation message for SigV4 in core Prom [#90250](https://github.com/grafana/grafana/pull/90250), [@bohandley](https://github.com/bohandley)
- **Prometheus:** Reintroduce Azure audience override feature flag [#90339](https://github.com/grafana/grafana/pull/90339), [@aangelisc](https://github.com/aangelisc)
- **RBAC:** Allow plugins to use scoped actions [#90946](https://github.com/grafana/grafana/pull/90946), [@gamab](https://github.com/gamab)
- **RBAC:** Default to plugins.app:access for plugin includes [#90969](https://github.com/grafana/grafana/pull/90969), [@gamab](https://github.com/gamab)
- **Restore dashboards:** Add RBAC [#90270](https://github.com/grafana/grafana/pull/90270), [@Clarity-89](https://github.com/Clarity-89)
- **Revert:** Calcs: Update diff percent to be a percent [#91563](https://github.com/grafana/grafana/pull/91563), [@Develer](https://github.com/Develer)
- **SAML:** Add button to generate a certificate and private key (Enterprise)
- **SSO:** Make SAML certificate/private key optional (Enterprise)
- **SearchV2:** Support soft deletion [#90217](https://github.com/grafana/grafana/pull/90217), [@ryantxu](https://github.com/ryantxu)
- **Select:** Add orange indicator to selected item [#88695](https://github.com/grafana/grafana/pull/88695), [@tskarhed](https://github.com/tskarhed)
- **Snapshots:** Remove deprecated option snapshot_remove_expired [#91231](https://github.com/grafana/grafana/pull/91231), [@ryantxu](https://github.com/ryantxu)
- **Table panel:** Add alt and title text options to image cell type [#89930](https://github.com/grafana/grafana/pull/89930), [@codeincarnate](https://github.com/codeincarnate)
- **Tempo:** Add toggle for streaming [#88685](https://github.com/grafana/grafana/pull/88685), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Tempo:** Remove kind=server from metrics summary [#89419](https://github.com/grafana/grafana/pull/89419), [@joey-grafana](https://github.com/joey-grafana)
- **Tempo:** Run `go get` [#89335](https://github.com/grafana/grafana/pull/89335), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Tempo:** TraceQL metrics step option [#89434](https://github.com/grafana/grafana/pull/89434), [@adrapereira](https://github.com/adrapereira)
- **Tempo:** Virtualize tags select to improve performance [#90269](https://github.com/grafana/grafana/pull/90269), [@adrapereira](https://github.com/adrapereira)
- **Tempo:** Virtualized search dropdowns for attribute values [#88569](https://github.com/grafana/grafana/pull/88569), [@RonanQuigley](https://github.com/RonanQuigley)
- **TimePicker:** Improve screen reader support [#89409](https://github.com/grafana/grafana/pull/89409), [@tskarhed](https://github.com/tskarhed)
- **TimeRangePicker:** Add weekStart prop [#89650](https://github.com/grafana/grafana/pull/89650), [@Clarity-89](https://github.com/Clarity-89)
- **TimeRangePicker:** Use week start [#89765](https://github.com/grafana/grafana/pull/89765), [@Clarity-89](https://github.com/Clarity-89)
- **Tooltip:** Add tooltip support to Histogram [#89196](https://github.com/grafana/grafana/pull/89196), [@adela-almasan](https://github.com/adela-almasan)
- **Trace View:** Add Session for this span button [#89656](https://github.com/grafana/grafana/pull/89656), [@javiruiz01](https://github.com/javiruiz01)
- **Tracing:** Add regex support for span filters [#89885](https://github.com/grafana/grafana/pull/89885), [@ektasorathia](https://github.com/ektasorathia)
- **Transformations:** Add variable support to select groupingToMatrix [#88551](https://github.com/grafana/grafana/pull/88551), [@kazeborja](https://github.com/kazeborja)
- **Transformations:** Move transformation variables to general availability [#89111](https://github.com/grafana/grafana/pull/89111), [@samjewell](https://github.com/samjewell)
- **Transformations:** Promote add field from calc stat function cumulative and window calcs as generally available [#91160](https://github.com/grafana/grafana/pull/91160), [@nmarrs](https://github.com/nmarrs)
- **Transformations:** Promote format string as generally available [#91161](https://github.com/grafana/grafana/pull/91161), [@nmarrs](https://github.com/nmarrs)
- **Transformations:** Promote group to nested table as generally available [#90253](https://github.com/grafana/grafana/pull/90253), [@nmarrs](https://github.com/nmarrs)
- **Users:** Add config option to control how often last_seen is updated [#88721](https://github.com/grafana/grafana/pull/88721), [@parambath92](https://github.com/parambath92)
- **XYChart:** Promote to generally available [#91417](https://github.com/grafana/grafana/pull/91417), [@nmarrs](https://github.com/nmarrs)

### Bug fixes

- **Admin:** Fixes logic for enabled a user [#88117](https://github.com/grafana/grafana/pull/88117), [@gonvee](https://github.com/gonvee)
- **Alerting:** Add validation for path separators in the rule group edit modal [#90887](https://github.com/grafana/grafana/pull/90887), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Allow future relative time [#89405](https://github.com/grafana/grafana/pull/89405), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Disable simplified routing when internal alert manager is disabled [#90648](https://github.com/grafana/grafana/pull/90648), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Do not check evaluation interval for external rulers [#89354](https://github.com/grafana/grafana/pull/89354), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Do not count rule health for totals [#89349](https://github.com/grafana/grafana/pull/89349), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Fix Recording Rules creation issues [#90362](https://github.com/grafana/grafana/pull/90362), [@tomratcliffe](https://github.com/tomratcliffe)
- **Alerting:** Fix contact point export 500 error and notifications/receivers missing settings [#90342](https://github.com/grafana/grafana/pull/90342), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Fix permissions for prometheus rule endpoints [#91409](https://github.com/grafana/grafana/pull/91409), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Fix persisting result fingerprint that is used by recovery threshold [#91224](https://github.com/grafana/grafana/pull/91224), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Fix rule storage to filter by group names using case-sensitive comparison [#88992](https://github.com/grafana/grafana/pull/88992), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Fix saving telegram contact point to Cloud AM config [#89182](https://github.com/grafana/grafana/pull/89182), [@tomratcliffe](https://github.com/tomratcliffe)
- **Alerting:** Fix setting of existing Telegram Chat ID value [#89287](https://github.com/grafana/grafana/pull/89287), [@tomratcliffe](https://github.com/tomratcliffe)
- **Alerting:** Fix silencing from policy instances [#90417](https://github.com/grafana/grafana/pull/90417), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Fix some status codes returned from provisioning API. [#90117](https://github.com/grafana/grafana/pull/90117), [@stevesg](https://github.com/stevesg)
- **Alerting:** Fix stale values associated with states that have gone to NoData, unify values calculation [#89807](https://github.com/grafana/grafana/pull/89807), [@alexweav](https://github.com/alexweav)
- **Alerting:** Refactor PromQL-style matcher parsing [#90129](https://github.com/grafana/grafana/pull/90129), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Skip fetching alerts for unsaved dashboards [#90061](https://github.com/grafana/grafana/pull/90061), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Skip loading alert rules for dashboards when disabled [#89361](https://github.com/grafana/grafana/pull/89361), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Support `utf8_strict_mode: false` in Mimir [#90092](https://github.com/grafana/grafana/pull/90092), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Time interval Delete API to check for usages in alert rules [#90500](https://github.com/grafana/grafana/pull/90500), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Analytics:** Fix ApplicationInsights integration [#89299](https://github.com/grafana/grafana/pull/89299), [@ashharrison90](https://github.com/ashharrison90)
- **Azure Monitor:** Add validation for namespace field in AdvancedResourcePicker when entering a forward slash [#89288](https://github.com/grafana/grafana/pull/89288), [@adamyeats](https://github.com/adamyeats)
- **AzureMonitor:** Fix out of bounds error when accessing `metricNamespaceArray` and `resourceNameArray` in `buildResourceURI` [#89222](https://github.com/grafana/grafana/pull/89222), [@adamyeats](https://github.com/adamyeats)
- **BrowseDashboards:** Prepend subpath to New Browse Dashboard actions [#89109](https://github.com/grafana/grafana/pull/89109), [@joshhunt](https://github.com/joshhunt)
- **CloudWatch:** Fix labels for raw metric search queries [#88943](https://github.com/grafana/grafana/pull/88943), [@iwysiu](https://github.com/iwysiu)
- **CloudWatch:** Fix raw queries with dimensions set [#90348](https://github.com/grafana/grafana/pull/90348), [@iwysiu](https://github.com/iwysiu)
- **Correlations:** Fix wrong target data source name in the form [#90340](https://github.com/grafana/grafana/pull/90340), [@aocenas](https://github.com/aocenas)
- **DashboardScene:** Fixes issue removing override rule [#89124](https://github.com/grafana/grafana/pull/89124), [@torkelo](https://github.com/torkelo)
- **DashboardScene:** Fixes lack of re-render when updating field override properties [#88796](https://github.com/grafana/grafana/pull/88796), [@torkelo](https://github.com/torkelo)
- **DataSourcePicker:** Create new data source does not work for subpath [#90536](https://github.com/grafana/grafana/pull/90536), [@ivanortegaalba](https://github.com/ivanortegaalba)
- **Docs:** Add fixed role UUIDs to docs for terraform provisioning [#89457](https://github.com/grafana/grafana/pull/89457), [@Jguer](https://github.com/Jguer)
- **Echo:** Suppress errors from frontend-metrics API call failing [#89379](https://github.com/grafana/grafana/pull/89379), [@joshhunt](https://github.com/joshhunt)
- **Explore Metrics:** Implement grouping with metric prefixes [#89481](https://github.com/grafana/grafana/pull/89481), [@itsmylife](https://github.com/itsmylife)
- **Fix:** Portuguese Brazilian wasn't loading translations [#89302](https://github.com/grafana/grafana/pull/89302), [@JoaoSilvaGrafana](https://github.com/JoaoSilvaGrafana)
- **Folders:** Fix folder pagination for cloud instances with many folders [#90008](https://github.com/grafana/grafana/pull/90008), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Folders:** Improve folder move permission checks [#90588](https://github.com/grafana/grafana/pull/90588), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **InfluxDB:** Fix query builder produces invalid SQL query when using wildcard column name [#89032](https://github.com/grafana/grafana/pull/89032), [@wasim-nihal](https://github.com/wasim-nihal)
- **Inspect:** Include only BOM char for excel files [#88994](https://github.com/grafana/grafana/pull/88994), [@ivanortegaalba](https://github.com/ivanortegaalba)
- **Jaeger:** Fix calling of search query with the correct time range [#90320](https://github.com/grafana/grafana/pull/90320), [@EgorKluch](https://github.com/EgorKluch)
- **Metrics:** Fix internal metrics endpoint not accessible from browser if basic auth is enabled [#86904](https://github.com/grafana/grafana/pull/86904), [@wasim-nihal](https://github.com/wasim-nihal)
- **Notifications:** Redact URL from errors [#85687](https://github.com/grafana/grafana/pull/85687), [@alexweav](https://github.com/alexweav)
- **PDF:** Fix layout for page-size panel after row (Enterprise)
- **Panel:** Fix text aliasing bug when panel is loading [#89538](https://github.com/grafana/grafana/pull/89538), [@ashharrison90](https://github.com/ashharrison90)
- **Plugin extensions:** Return react components from `usePluginComponents()` [#89237](https://github.com/grafana/grafana/pull/89237), [@leventebalogh](https://github.com/leventebalogh)
- **Plugins:** Ensure grafana cli can install multiple plugin dependencies [#91230](https://github.com/grafana/grafana/pull/91230), [@yincongcyincong](https://github.com/yincongcyincong)
- **Prometheus:** Fix interpolating adhoc filters with template variables [#88626](https://github.com/grafana/grafana/pull/88626), [@cazeaux](https://github.com/cazeaux)
- **Prometheus:** Fix query builder visualization when a query has by() clause for quantile [#88480](https://github.com/grafana/grafana/pull/88480), [@yuri-rs](https://github.com/yuri-rs)
- **QueryEditor:** Break with Scenes because the default query is not empty string [#90583](https://github.com/grafana/grafana/pull/90583), [@ivanortegaalba](https://github.com/ivanortegaalba)
- **RBAC:** Fix seeder failures when inserting duplicated permissions (Enterprise)
- **RBAC:** List only the folders that the user has access to [#88599](https://github.com/grafana/grafana/pull/88599), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Scenes/Dashboards:** Fix issue where changes in panel height weren't saved [#91125](https://github.com/grafana/grafana/pull/91125), [@kaydelaney](https://github.com/kaydelaney)
- **Scenes:** Fixes issue with panel repeat height calculation [#90221](https://github.com/grafana/grafana/pull/90221), [@kaydelaney](https://github.com/kaydelaney)
- **Scenes:** Implement 't a' shortcut [#89619](https://github.com/grafana/grafana/pull/89619), [@kaydelaney](https://github.com/kaydelaney)
- **Table Panel:** Fix Image hover without datalinks [#89751](https://github.com/grafana/grafana/pull/89751), [@codeincarnate](https://github.com/codeincarnate)
- **Table component:** Fix sub-table rows not displaying correctly [#89082](https://github.com/grafana/grafana/pull/89082), [@codeincarnate](https://github.com/codeincarnate)
- **Tempo:** Fix grpc streaming support over pdc-agent [#89883](https://github.com/grafana/grafana/pull/89883), [@taylor-s-dean](https://github.com/taylor-s-dean)
- **Tempo:** Fix query history [#89991](https://github.com/grafana/grafana/pull/89991), [@joey-grafana](https://github.com/joey-grafana)

### Breaking changes

- **Folders:** Allow folder editors and admins to create subfolders without any additional permissions [#91215](https://github.com/grafana/grafana/pull/91215), [@IevaVasiljeva](https://github.com/IevaVasiljeva)

### Plugin development fixes & changes

- **Runtime:** Add provider and access hook for location service [#90759](https://github.com/grafana/grafana/pull/90759), [@aocenas](https://github.com/aocenas)

<!-- 11.2.0 END -->
<!-- 11.1.5 START -->

# 11.1.5 (2024-08-27)

### Bug fixes

- **Alerting:** Fix permissions for prometheus rule endpoints [#91414](https://github.com/grafana/grafana/pull/91414), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Fix persisting result fingerprint that is used by recovery threshold [#91290](https://github.com/grafana/grafana/pull/91290), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Auditing:** Fix a possible crash when audit logger parses responses for failed requests (Enterprise)
- **RBAC:** Fix an issue with server admins not being able to manage users in orgs that they don't belong to [#92273](https://github.com/grafana/grafana/pull/92273), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **RBAC:** Fix an issue with server admins not being able to manage users in orgs that they dont belong to (Enterprise)
- **RBAC:** Fix seeder failures when inserting duplicated permissions (Enterprise)
- **Snapshots:** Fix panic when snapshot_remove_expired is true [#91232](https://github.com/grafana/grafana/pull/91232), [@ryantxu](https://github.com/ryantxu)
- **VizTooltip:** Fix positioning at bottom and right edges on mobile [#92137](https://github.com/grafana/grafana/pull/92137), [@leeoniya](https://github.com/leeoniya)

### Plugin development fixes & changes

- **Bugfix:** QueryField typeahead missing background color [#92316](https://github.com/grafana/grafana/pull/92316), [@mckn](https://github.com/mckn)

<!-- 11.1.5 END -->
<!-- 11.0.4 START -->

# 11.0.4 (2024-08-27)

### Bug fixes

- **Alerting:** Fix persisting result fingerprint that is used by recovery threshold [#91328](https://github.com/grafana/grafana/pull/91328), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Auditing:** Fix a possible crash when audit logger parses responses for failed requests (Enterprise)
- **RBAC:** Fix seeder failures when inserting duplicated permissions (Enterprise)
- **Snapshots:** Fix panic when snapshot_remove_expired is true [#91330](https://github.com/grafana/grafana/pull/91330), [@ryantxu](https://github.com/ryantxu)

<!-- 11.0.4 END -->
<!-- 10.4.8 START -->

# 10.4.8 (2024-08-27)

### Bug fixes

- **Alerting:** Fix persisting result fingerprint that is used by recovery threshold [#91331](https://github.com/grafana/grafana/pull/91331), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Auditing:** Fix a possible crash when audit logger parses responses for failed requests (Enterprise)
- **RBAC:** Fix seeder failures when inserting duplicated permissions (Enterprise)
- **Snapshots:** Fix panic when snapshot_remove_expired is true [#91329](https://github.com/grafana/grafana/pull/91329), [@ryantxu](https://github.com/ryantxu)

<!-- 10.4.8 END -->
<!-- 10.3.9 START -->

# 10.3.9 (2024-08-27)

<!-- 10.3.9 END -->
<!-- 11.1.4 START -->

# 11.1.4 (2024-08-14)

### Bug fixes

- **Swagger:** Fixed CVE-2024-6837.

<!-- 11.1.4 END -->
<!-- 11.0.3 START -->

# 11.0.3 (2024-08-14)

### Bug fixes

- **Swagger:** Fixed CVE-2024-6837.

<!-- 11.0.3 END -->
<!-- 10.4.7 START -->

# 10.4.7 (2024-08-14)

### Bug fixes

- **Swagger:** Fixed CVE-2024-6837.

<!-- 10.4.7 END -->
<!-- 11.1.3 START -->

# 11.1.3 (2024-07-26)

### Bug fixes

- **RBAC**: Allow plugins to use scoped actions [#90946](https://github.com/grafana/grafana/pull/90946), [@gamab](https://github.com/gamab)

<!-- 11.1.3 END -->
<!-- 11.0.2 START -->

# 11.0.2 (2024-07-25)

### Features and enhancements

- **Alerting:** Update grafana/alerting to c340765c985a12603bbdfcd10576ddfdbf9dc284 [#90388](https://github.com/grafana/grafana/pull/90388), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Prometheus:** Reintroduce Azure audience override feature flag [#90558](https://github.com/grafana/grafana/pull/90558), [@aangelisc](https://github.com/aangelisc)

### Bug fixes

- **Alerting:** Skip loading alert rules for dashboards when disabled [#89904](https://github.com/grafana/grafana/pull/89904), [@gillesdemey](https://github.com/gillesdemey)
- **Folders:** Improve folder move permission checks [#90849](https://github.com/grafana/grafana/pull/90849), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Folders:** Improve folder move permission checks [#90849](https://github.com/grafana/grafana/pull/90849), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Folders:** Improve folder move permission checks [#90849](https://github.com/grafana/grafana/pull/90849), [@IevaVasiljeva](https://github.com/IevaVasiljeva)

<!-- 11.0.2 END -->
<!-- 10.4.6 START -->

# 10.4.6 (2024-07-25)

### Features and enhancements

- **Alerting:** Update grafana/alerting to ce0d024b67ea714b06d0f5309025466f50e381ef [#90389](https://github.com/grafana/grafana/pull/90389), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Prometheus:** Reintroduce Azure audience override feature flag [#90557](https://github.com/grafana/grafana/pull/90557), [@aangelisc](https://github.com/aangelisc)

### Bug fixes

- **Alerting:** Fix panic in provisioning filter contacts by unknown name [#90440](https://github.com/grafana/grafana/pull/90440), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Skip loading alert rules for dashboards when disabled [v10.4.x] [#90331](https://github.com/grafana/grafana/pull/90331), [@gillesdemey](https://github.com/gillesdemey)
- **Echo:** Suppress errors from frontend-metrics API call failing [#89498](https://github.com/grafana/grafana/pull/89498), [@joshhunt](https://github.com/joshhunt)

<!-- 10.4.6 END -->
<!-- 11.1.1 START -->

# 11.1.1 (2024-07-25)

### Bug fixes

- **Alerting:** Skip fetching alerts for unsaved dashboards [#90074](https://github.com/grafana/grafana/pull/90074), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Skip loading alert rules for dashboards when disabled [#89905](https://github.com/grafana/grafana/pull/89905), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Support `utf8_strict_mode: false` in Mimir [#90148](https://github.com/grafana/grafana/pull/90148), [@gillesdemey](https://github.com/gillesdemey)
- **Scenes:** Fixes issue with panel repeat height calculation [#90232](https://github.com/grafana/grafana/pull/90232), [@kaydelaney](https://github.com/kaydelaney)
- **Table Panel:** Fix Image hover without datalinks [#89922](https://github.com/grafana/grafana/pull/89922), [@codeincarnate](https://github.com/codeincarnate)
- **Tempo:** Fix grpc streaming support over pdc-agent [#90055](https://github.com/grafana/grafana/pull/90055), [@taylor-s-dean](https://github.com/taylor-s-dean)
- **RBAC**: Allow plugins to use scoped actions [#90946](https://github.com/grafana/grafana/pull/90946), [@gamab](https://github.com/gamab)

<!-- 11.1.1 END -->
<!-- 11.1.0 START -->

# 11.1.0 (2024-06-21)

### Features and enhancements

- **Tracing:** Enable traces to profiles. [#88896](https://github.com/grafana/grafana/issues/88896), [@marefr](https://github.com/marefr)
- **Auth:** Add org to role mappings support to Google integration. [#88891](https://github.com/grafana/grafana/issues/88891), [@kalleep](https://github.com/kalleep)
- **Alerting:** Support AWS SNS integration in Grafana. [#88867](https://github.com/grafana/grafana/issues/88867), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Auth:** Add org to role mappings support to Okta integration. [#88770](https://github.com/grafana/grafana/issues/88770), [@mgyongyosi](https://github.com/mgyongyosi)
- **Auth:** Add org to role mappings support to Gitlab integration. [#88751](https://github.com/grafana/grafana/issues/88751), [@kalleep](https://github.com/kalleep)
- **Cloudwatch:** Use the metric map from grafana-aws-sdk. [#88733](https://github.com/grafana/grafana/issues/88733), [@iwysiu](https://github.com/iwysiu)
- **Alerting:** Add option to use Redis in cluster mode for Alerting HA. [#88696](https://github.com/grafana/grafana/issues/88696), [@fayzal-g](https://github.com/fayzal-g)
- **VizTooltip:** Allow setting the `maxWidth` option. [#88652](https://github.com/grafana/grafana/issues/88652), [@adela-almasan](https://github.com/adela-almasan)
- **Auth:** Add org to role mappings support to GitHub integration . [#88537](https://github.com/grafana/grafana/issues/88537), [@mgyongyosi](https://github.com/mgyongyosi)
- **CloudWatch:** Handle permissions error and update docs. [#88524](https://github.com/grafana/grafana/issues/88524), [@iwysiu](https://github.com/iwysiu)
- **Alerting:** Correctly handle duplicating notification templates. [#88487](https://github.com/grafana/grafana/issues/88487), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Mute Timing service to prevent changing provenance status to none. [#88462](https://github.com/grafana/grafana/issues/88462), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Ensure we fetch AM config before saving new configuration. [#88458](https://github.com/grafana/grafana/issues/88458), [@tomratcliffe](https://github.com/tomratcliffe)
- **Alerting:** Remove regex reference in silences filter tooltip. [#88455](https://github.com/grafana/grafana/issues/88455), [@tomratcliffe](https://github.com/tomratcliffe)
- **Cloudwatch:** Update AWS DynamoDB Metrics. [#88418](https://github.com/grafana/grafana/issues/88418), [@LeonardoBoleli](https://github.com/LeonardoBoleli)
- **Alerting:** Make regex notification routing preview consistent with notification policies implementation. [#88413](https://github.com/grafana/grafana/issues/88413), [@tomratcliffe](https://github.com/tomratcliffe)
- **DateTimePicker:** Return cleared value in onChange. [#88377](https://github.com/grafana/grafana/issues/88377), [@Clarity-89](https://github.com/Clarity-89)
- **NodeGraph:** Add msagl and the layered layout code. [#88375](https://github.com/grafana/grafana/issues/88375), [@aocenas](https://github.com/aocenas)
- **API:** Add in theme support to /render/\* endpoint. [#88304](https://github.com/grafana/grafana/issues/88304), [@timlevett](https://github.com/timlevett)
- **Alerting:** Add filters for RouteGetRuleStatuses. [#88295](https://github.com/grafana/grafana/issues/88295), [@fayzal-g](https://github.com/fayzal-g)
- **Plugins:** Update the `plugin.json` schema with UI extensions meta-data. [#88288](https://github.com/grafana/grafana/issues/88288), [@leventebalogh](https://github.com/leventebalogh)
- **Auth:** Update SAML lib to improve HTTP-Post binding. [#88287](https://github.com/grafana/grafana/issues/88287), [@mgyongyosi](https://github.com/mgyongyosi)
- **Tempo:** Send current filters when retrieving tags for AdHocFilters. [#88270](https://github.com/grafana/grafana/issues/88270), [@joey-grafana](https://github.com/joey-grafana)
- **Tempo:** Support standard span convention. [#88268](https://github.com/grafana/grafana/issues/88268), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **ValueFormats:** Add Uruguay peso currency. [#88260](https://github.com/grafana/grafana/issues/88260), [@lfdominguez](https://github.com/lfdominguez)
- **DateTimePicker:** Add clearable prop. [#88215](https://github.com/grafana/grafana/issues/88215), [@Clarity-89](https://github.com/Clarity-89)
- **Correlations:** Enable feature toggle by default (on-prem). [#88208](https://github.com/grafana/grafana/issues/88208), [@ifrost](https://github.com/ifrost)
- **Stat:** Add percent change color modes. [#88205](https://github.com/grafana/grafana/issues/88205), [@drew08t](https://github.com/drew08t)
- **Logs:** Added multi-line display control to the "wrap lines" option. [#88144](https://github.com/grafana/grafana/issues/88144), [@matyax](https://github.com/matyax)
- **Tempo:** Update lezer autocomplete (histogram, quantile) and add missing functions. [#88131](https://github.com/grafana/grafana/issues/88131), [@joey-grafana](https://github.com/joey-grafana)
- **AnnotationsPlugin2:** Implement support for rectangular annotations in Heatmap. [#88107](https://github.com/grafana/grafana/issues/88107), [@adrapereira](https://github.com/adrapereira)
- **CodeEditor:** Improved styles when the code editor is loading. [#88102](https://github.com/grafana/grafana/issues/88102), [@NWRichmond](https://github.com/NWRichmond)
- **CloudWatch:** Add additional AWS/KinesisAnalytics metrics . [#88101](https://github.com/grafana/grafana/issues/88101), [@tristanburgess](https://github.com/tristanburgess)
- **Cloudwatch:** Add AWS/Events Metrics. [#88097](https://github.com/grafana/grafana/issues/88097), [@LeonardoBoleli](https://github.com/LeonardoBoleli)
- **Azure:** Basic Logs support. [#88025](https://github.com/grafana/grafana/issues/88025), [@aangelisc](https://github.com/aangelisc)
- **Dashboard:** Make dashboard search faster. [#88019](https://github.com/grafana/grafana/issues/88019), [@knuzhdin](https://github.com/knuzhdin)
- **Alerting:** Support custom API URL for PagerDuty integration. [#88007](https://github.com/grafana/grafana/issues/88007), [@gaurav1999](https://github.com/gaurav1999)
- **Alerting:** Add optional metadata via query param to silence GET requests. [#88000](https://github.com/grafana/grafana/issues/88000), [@JacobsonMT](https://github.com/JacobsonMT)
- **Store:** Enable adding extra middleware. [#87984](https://github.com/grafana/grafana/issues/87984), [@Clarity-89](https://github.com/Clarity-89)
- **Tempo:** Don't modify the passed time range when using timeShiftEnabled. [#87980](https://github.com/grafana/grafana/issues/87980), [@aocenas](https://github.com/aocenas)
- **InfluxDB:** Introduce maxDataPoints setting for flux variable query editor. [#87935](https://github.com/grafana/grafana/issues/87935), [@itsmylife](https://github.com/itsmylife)
- **Alerting:** New list view UI – Part 1. [#87907](https://github.com/grafana/grafana/issues/87907), [@gillesdemey](https://github.com/gillesdemey)
- **NodeGraph:** Remove msagl lib and layered layout option. [#87905](https://github.com/grafana/grafana/issues/87905), [@aocenas](https://github.com/aocenas)
- **InfluxDB:** Introduce custom variable support. [#87903](https://github.com/grafana/grafana/issues/87903), [@itsmylife](https://github.com/itsmylife)
- **Gops:** Add tracking for data source check. [#87886](https://github.com/grafana/grafana/issues/87886), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **AzureMonitor:** Prometheus exemplars support . [#87742](https://github.com/grafana/grafana/issues/87742), [@aangelisc](https://github.com/aangelisc)
- **Feature Management:** Move awsDatasourcesNewFormStyling to GA. [#87696](https://github.com/grafana/grafana/issues/87696), [@idastambuk](https://github.com/idastambuk)
- **TimeRangePicker:** Announce to screen reader when time range is updated. [#87692](https://github.com/grafana/grafana/issues/87692), [@tskarhed](https://github.com/tskarhed)
- **Alerting:** Template selector in contact points form. [#87689](https://github.com/grafana/grafana/issues/87689), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Azure:** Load custom clouds from ini file. [#87667](https://github.com/grafana/grafana/issues/87667), [@JonCole](https://github.com/JonCole)
- **Loki:** Kick start your query now applies templates to the current query. [#87658](https://github.com/grafana/grafana/issues/87658), [@matyax](https://github.com/matyax)
- **Elasticsearch:** Queries no longer executed while typing. [#87652](https://github.com/grafana/grafana/issues/87652), [@matyax](https://github.com/matyax)
- **Alerting:** Add options to configure TLS for HA using Redis. [#87567](https://github.com/grafana/grafana/issues/87567), [@fayzal-g](https://github.com/fayzal-g)
- **VizLegend:** Represent line style in series legend and tooltip. [#87558](https://github.com/grafana/grafana/issues/87558), [@domasx2](https://github.com/domasx2)
- **FeatureBadge:** Update FeatureBadge to support current release stages. [#87555](https://github.com/grafana/grafana/issues/87555), [@ivanahuckova](https://github.com/ivanahuckova)
- **Logs:** Infinite scrolling in Explore enabled by default. [#87493](https://github.com/grafana/grafana/issues/87493), [@matyax](https://github.com/matyax)
- **Plugins:** Improve frontend loader cache. [#87488](https://github.com/grafana/grafana/issues/87488), [@jackw](https://github.com/jackw)
- **Chore:** Upgrade go from 1.21.0 to 1.21.10. [#87479](https://github.com/grafana/grafana/issues/87479), [@stephaniehingtgen](https://github.com/stephaniehingtgen)
- **Chore:** Upgrade go to 1.22.3. [#87463](https://github.com/grafana/grafana/issues/87463), [@stephaniehingtgen](https://github.com/stephaniehingtgen)
- **Team:** Add an endpoint for bulk team membership updates. [#87441](https://github.com/grafana/grafana/issues/87441), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Flamegraph:** Add collapse and expand group buttons to toolbar. [#87395](https://github.com/grafana/grafana/issues/87395), [@aocenas](https://github.com/aocenas)
- **OIDC:** Support Generic OAuth org to role mappings. [#87394](https://github.com/grafana/grafana/issues/87394), [@sathieu](https://github.com/sathieu)
- **Search:** Announce to screen reader when query returns no result. [#87382](https://github.com/grafana/grafana/issues/87382), [@tskarhed](https://github.com/tskarhed)
- **Logs:** Added support for numeric log levels. [#87366](https://github.com/grafana/grafana/issues/87366), [@nailgun](https://github.com/nailgun)
- **Prometheus:** Place custom inputs first when using regex filter values in the query builder. [#87360](https://github.com/grafana/grafana/issues/87360), [@NWRichmond](https://github.com/NWRichmond)
- **Alerting:** Remove requirement for datasource query on rule read. [#87349](https://github.com/grafana/grafana/issues/87349), [@rwwiv](https://github.com/rwwiv)
- **Alerting:** Add RBAC logic for silences creation. [#87322](https://github.com/grafana/grafana/issues/87322), [@tomratcliffe](https://github.com/tomratcliffe)
- **Alerting:** Update silences creation to support `__alert_rule_uid__` and move into drawer. [#87320](https://github.com/grafana/grafana/issues/87320), [@tomratcliffe](https://github.com/tomratcliffe)
- **Flamegraph:** Add diff mode color legend. [#87319](https://github.com/grafana/grafana/issues/87319), [@aocenas](https://github.com/aocenas)
- **Dashboard:** Keyboard and mouse panel shortcuts improvement. [#87317](https://github.com/grafana/grafana/issues/87317), [@tskarhed](https://github.com/tskarhed)
- **PanelHeaderCorner:** Remove font-awesome icons. [#87303](https://github.com/grafana/grafana/issues/87303), [@Clarity-89](https://github.com/Clarity-89)
- **Alerting:** Add OAuth2 to HTTP settings for vanilla Alertmanager / Mimir. [#87272](https://github.com/grafana/grafana/issues/87272), [@gillesdemey](https://github.com/gillesdemey)
- **Plugins:** Allow apps to expose components. Update the extensions API. [#87236](https://github.com/grafana/grafana/issues/87236), [@leventebalogh](https://github.com/leventebalogh)
- **Plugins:** Catalog to show all plugins by default. [#87168](https://github.com/grafana/grafana/issues/87168), [@sympatheticmoose](https://github.com/sympatheticmoose)
- **Prometheus:** Ensure values in metric selector are visible. [#87150](https://github.com/grafana/grafana/issues/87150), [@NWRichmond](https://github.com/NWRichmond)
- **Select:** Add data-testid to Input. [#87105](https://github.com/grafana/grafana/issues/87105), [@Clarity-89](https://github.com/Clarity-89)
- **Prometheus:** Add native histogram types metric explorer to allow filter by type. [#87090](https://github.com/grafana/grafana/issues/87090), [@bohandley](https://github.com/bohandley)
- **Prometheus:** Add hints for native histograms. [#87017](https://github.com/grafana/grafana/issues/87017), [@bohandley](https://github.com/bohandley)
- **Alerting:** Reduce number of request fetching rules in the dashboard view using rtkq. [#86991](https://github.com/grafana/grafana/issues/86991), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Plugins:** Make grafana-com API URL usage consistent. [#86920](https://github.com/grafana/grafana/issues/86920), [@oshirohugo](https://github.com/oshirohugo)
- **Stack:** Add size props. [#86900](https://github.com/grafana/grafana/issues/86900), [@Clarity-89](https://github.com/Clarity-89)
- **Table Panel:** Enable Text Wrapping. [#86895](https://github.com/grafana/grafana/issues/86895), [@codeincarnate](https://github.com/codeincarnate)
- **Alerting:** Get grafana-managed alert rule by UID. [#86845](https://github.com/grafana/grafana/issues/86845), [@fayzal-g](https://github.com/fayzal-g)
- **Cloudwatch:** Add Kendra metrics. [#86809](https://github.com/grafana/grafana/issues/86809), [@scottschreckengaust](https://github.com/scottschreckengaust)
- **Auth:** Added support to filter for parent teams in GitHub connector's team membership filter. [#86754](https://github.com/grafana/grafana/issues/86754), [@wasim-nihal](https://github.com/wasim-nihal)
- **Alerting:** Hook up GMA silence APIs to new authentication handler. [#86625](https://github.com/grafana/grafana/issues/86625), [@JacobsonMT](https://github.com/JacobsonMT)
- **GeoMap:** Pan and zoom keyboard support. [#86573](https://github.com/grafana/grafana/issues/86573), [@tskarhed](https://github.com/tskarhed)
- **Alerting:** Optimize rule status gathering APIs when a limit is applied. [#86568](https://github.com/grafana/grafana/issues/86568), [@stevesg](https://github.com/stevesg)
- **Plugins:** Add an auto-generated part to the `plugin.json` schema. [#86520](https://github.com/grafana/grafana/issues/86520), [@leventebalogh](https://github.com/leventebalogh)
- **Loki/Prometheus Query Editor:** Disabled cmd/ctrl+f keybinding within the editor. [#86418](https://github.com/grafana/grafana/issues/86418), [@matyax](https://github.com/matyax)
- **Grafana packages:** Remove E2E workspace. [#86416](https://github.com/grafana/grafana/issues/86416), [@sunker](https://github.com/sunker)
- **RefreshPicker:** Change running state to be less distracting . [#86405](https://github.com/grafana/grafana/issues/86405), [@torkelo](https://github.com/torkelo)
- **Prometheus:** Cancellable label values requests. [#86403](https://github.com/grafana/grafana/issues/86403), [@NWRichmond](https://github.com/NWRichmond)
- **SQLStore:** Improve recursive CTE support detection. [#86397](https://github.com/grafana/grafana/issues/86397), [@mildwonkey](https://github.com/mildwonkey)
- **CloudMonitoring:** Ensure variables can be used in all variable queries. [#86377](https://github.com/grafana/grafana/issues/86377), [@aangelisc](https://github.com/aangelisc)
- **Common labels/displayed fields:** Show label names with values. [#86345](https://github.com/grafana/grafana/issues/86345), [@matyax](https://github.com/matyax)
- **AuthZ:** Further protect admin endpoints. [#86285](https://github.com/grafana/grafana/issues/86285), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Explore:** Deprecate local storage singular datasource key. [#86250](https://github.com/grafana/grafana/issues/86250), [@gelicia](https://github.com/gelicia)
- **Loki:** Add label filters after label_format if present. [#86124](https://github.com/grafana/grafana/issues/86124), [@matyax](https://github.com/matyax)
- **Alerting:** Immutable plugin rules and alerting plugins extensions. [#86042](https://github.com/grafana/grafana/issues/86042), [@konrad147](https://github.com/konrad147)
- **Tempo:** Group by template vars. [#86022](https://github.com/grafana/grafana/issues/86022), [@joey-grafana](https://github.com/joey-grafana)
- **Short Links:** Add setting for changing expiration time. [#86003](https://github.com/grafana/grafana/issues/86003), [@gelicia](https://github.com/gelicia)
- **Prometheus:** Add native histogram functions. [#86002](https://github.com/grafana/grafana/issues/86002), [@bohandley](https://github.com/bohandley)
- **Plugins:** Removed feature toggle pluginsDynamicAngularDetectionPatterns. [#85956](https://github.com/grafana/grafana/issues/85956), [@xnyo](https://github.com/xnyo)
- **Plugins:** Removed feature toggle enablePluginsTracingByDefault. [#85953](https://github.com/grafana/grafana/issues/85953), [@xnyo](https://github.com/xnyo)
- **Tracing:** Allow otel service name and attributes to be overridden from env. [#85937](https://github.com/grafana/grafana/issues/85937), [@marefr](https://github.com/marefr)
- **PanelChrome:** Improve accessibility landmark markup. [#85863](https://github.com/grafana/grafana/issues/85863), [@tskarhed](https://github.com/tskarhed)
- **Gops:** Add configuration tracker on the existing IRM page. [#85838](https://github.com/grafana/grafana/issues/85838), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **CloudWatch:** Add additional Glue metrics. [#85798](https://github.com/grafana/grafana/issues/85798), [@tristanburgess](https://github.com/tristanburgess)
- **CloudWatch:** Add labels for Metric Query type queries. [#85766](https://github.com/grafana/grafana/issues/85766), [@kevinwcyu](https://github.com/kevinwcyu)
- **Util:** Support parsing and splitting strings enclosed in quotes in util.SplitString. [#85735](https://github.com/grafana/grafana/issues/85735), [@mgyongyosi](https://github.com/mgyongyosi)
- **Loki:** Handle `X-Scope-OrgID` and tenant IDs. [#85726](https://github.com/grafana/grafana/issues/85726), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **CloudWatch:** Add a Performance Insights and other missing metrics to aws/rds. [#85680](https://github.com/grafana/grafana/issues/85680), [@kgeckhart](https://github.com/kgeckhart)
- **Prometheus:** Respect dashboard queries when querying ad hoc filter labels. [#85674](https://github.com/grafana/grafana/issues/85674), [@itsmylife](https://github.com/itsmylife)
- **Pyroscope:** Add adhoc filters support. [#85601](https://github.com/grafana/grafana/issues/85601), [@aocenas](https://github.com/aocenas)
- **Table Panel:** Update background colors to respect transparency. [#85565](https://github.com/grafana/grafana/issues/85565), [@codeincarnate](https://github.com/codeincarnate)
- **Canvas:** Add support for line animation. [#85556](https://github.com/grafana/grafana/issues/85556), [@adela-almasan](https://github.com/adela-almasan)
- **Reducers:** Add in basic Percentile Support. [#85554](https://github.com/grafana/grafana/issues/85554), [@timlevett](https://github.com/timlevett)
- **Storage:** Watch tests. [#85496](https://github.com/grafana/grafana/issues/85496), [@DanCech](https://github.com/DanCech)
- **Plugins:** Show update buttons when instance version is different. [#85486](https://github.com/grafana/grafana/issues/85486), [@oshirohugo](https://github.com/oshirohugo)
- **Tempo:** Always use time range even if timeShiftEnabled is false. [#85477](https://github.com/grafana/grafana/issues/85477), [@ogxd](https://github.com/ogxd)
- **Alerting:** Gops labels integration. [#85467](https://github.com/grafana/grafana/issues/85467), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Explore:** Set X-Cache-Skip to true for query requests. [#85460](https://github.com/grafana/grafana/issues/85460), [@Elfo404](https://github.com/Elfo404)
- **Explore:** Make Explore breadcrumb clickable. [#85437](https://github.com/grafana/grafana/issues/85437), [@Elfo404](https://github.com/Elfo404)
- **Prometheus:** Fuzzy search for metric names in Code Mode. [#85396](https://github.com/grafana/grafana/issues/85396), [@NWRichmond](https://github.com/NWRichmond)
- **Storage Api:** Adds traces. [#85391](https://github.com/grafana/grafana/issues/85391), [@owensmallwood](https://github.com/owensmallwood)
- **Storage Api:** Add metrics. [#85316](https://github.com/grafana/grafana/issues/85316), [@owensmallwood](https://github.com/owensmallwood)
- **Alerting:** Improve paused alert visibility and allow pausing/resuming from alert list view. [#85116](https://github.com/grafana/grafana/issues/85116), [@tomratcliffe](https://github.com/tomratcliffe)
- **CloudWatch:** Clarify match exact tooltip and docs. [#85095](https://github.com/grafana/grafana/issues/85095), [@iwysiu](https://github.com/iwysiu)
- **Alerting:** Evaluation quick buttons. [#85010](https://github.com/grafana/grafana/issues/85010), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Add state history polling interval. [#84837](https://github.com/grafana/grafana/issues/84837), [@gillesdemey](https://github.com/gillesdemey)
- **CloudWatch:** Improve metric label parsing. [#84835](https://github.com/grafana/grafana/issues/84835), [@iwysiu](https://github.com/iwysiu)
- **Alerting:** Improve template preview. [#84798](https://github.com/grafana/grafana/issues/84798), [@konrad147](https://github.com/konrad147)
- **Alerting:** New settings page. [#84501](https://github.com/grafana/grafana/issues/84501), [@gillesdemey](https://github.com/gillesdemey)
- **Explore:** Move Query History to be screen wide. [#84321](https://github.com/grafana/grafana/issues/84321), [@gelicia](https://github.com/gelicia)
- **MixedDataSource:** Support multi value data source variable that issues a query to each data source. [#83356](https://github.com/grafana/grafana/issues/83356), [@torkelo](https://github.com/torkelo)
- **PluginExtensions:** Make the extensions registry reactive. [#83085](https://github.com/grafana/grafana/issues/83085), [@mckn](https://github.com/mckn)
- **Loki:** Use label/&lt;name&gt;/values API instead of series API for label values discovery. [#83044](https://github.com/grafana/grafana/issues/83044), [@yuri-rs](https://github.com/yuri-rs)
- **Tempo:** Escape backslash in span name for promsql query. [#83024](https://github.com/grafana/grafana/issues/83024), [@ttshivers](https://github.com/ttshivers)
- **Alerting:** Export and provisioning rules into subfolders. [#77450](https://github.com/grafana/grafana/issues/77450), [@papagian](https://github.com/papagian)
- **Notification banner:** Integrate with RBAC. (Enterprise)
- **Auth:** Assign users using SAML to AutoAssignOrgRole if no role matches. (Enterprise)
- **Notification banner:** Display preview. (Enterprise)
- **Auth:** Add None and Viewer roles as options to SAML UI config. (Enterprise)
- **SAML:** Add nonce to the generated script tag. (Enterprise)
- **Notification banner:** Add settings page. (Enterprise)
- **Notification banner:** Add API client. (Enterprise)
- **Chore:** Upgrade go version to 1.22.3. (Enterprise)
- **Auditing:** Correctly parse the URL for auditing through Loki. (Enterprise)
- **Auditlog:** Refactor action to post-action in default auditlogging. (Enterprise)
- **Plugins:** Make grafana-com API URL usage consistent. (Enterprise)
- **Plugins:** Make grafana-com API URL usage consistent. (Enterprise)
- **Caching:** Implement mtls-enabled memcached integration. (Enterprise)
- **OpenAPI:** Document the datasource caching API. (Enterprise)

### Bug fixes

- **Alerting:** Fix go-swagger extraction and several embedded types from Alertmanager in Swagger docs. [#88879](https://github.com/grafana/grafana/issues/88879), [@alexweav](https://github.com/alexweav)
- **DashboardScene:** Fixes inspect with transforms issue. [#88843](https://github.com/grafana/grafana/issues/88843), [@torkelo](https://github.com/torkelo)
- **Elasticsearch:** Fix stripping of trailing slashes in datasource URLs. [#88779](https://github.com/grafana/grafana/issues/88779), [@ivanahuckova](https://github.com/ivanahuckova)
- **Loki:** Fix editor history in wrong order. [#88666](https://github.com/grafana/grafana/issues/88666), [@svennergr](https://github.com/svennergr)
- **Cli:** Fix bug where password is hashed twice. [#88589](https://github.com/grafana/grafana/issues/88589), [@kalleep](https://github.com/kalleep)
- **AzureMonitor:** Fix bug detecting app insights queries. [#88572](https://github.com/grafana/grafana/issues/88572), [@aangelisc](https://github.com/aangelisc)
- **SSE:** Fix threshold unmarshal to avoid panic. [#88521](https://github.com/grafana/grafana/issues/88521), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Dashboard:** Fix Variables query hides fields with non-supported datasources. [#88516](https://github.com/grafana/grafana/issues/88516), [@axelavargas](https://github.com/axelavargas)
- **Explore:** Align time filters properly to day boundaries in query history. [#88498](https://github.com/grafana/grafana/issues/88498), [@aocenas](https://github.com/aocenas)
- **Access Control:** Clean up permissions for deprovisioned data sources. [#88483](https://github.com/grafana/grafana/issues/88483), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Dashboards:** Correctly display Admin access to dashboards in the UI. [#88439](https://github.com/grafana/grafana/issues/88439), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **LibraryPanels/RBAC:** Ignore old folder permission check when deleting/patching lib panel. [#88422](https://github.com/grafana/grafana/issues/88422), [@kaydelaney](https://github.com/kaydelaney)
- **LogsTable:** Fix default sort by time. [#88398](https://github.com/grafana/grafana/issues/88398), [@svennergr](https://github.com/svennergr)
- **Dashboards:** Fix regression when deleting folder. [#88311](https://github.com/grafana/grafana/issues/88311), [@papagian](https://github.com/papagian)
- **Docker:** Fix renderer plugin in custom Dockerfile. [#88223](https://github.com/grafana/grafana/issues/88223), [@AgnesToulet](https://github.com/AgnesToulet)
- **Alerting:** Fix rules deleting when reordering whilst filtered. [#88221](https://github.com/grafana/grafana/issues/88221), [@tomratcliffe](https://github.com/tomratcliffe)
- **Alerting:** Fix "copy link" not including full URL. [#88210](https://github.com/grafana/grafana/issues/88210), [@tomratcliffe](https://github.com/tomratcliffe)
- **Alerting:** Fix typo in JSON response for rule export. [#88028](https://github.com/grafana/grafana/issues/88028), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Fix scheduler to sort rules before evaluation. [#88006](https://github.com/grafana/grafana/issues/88006), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **CloudMonitoring:** Fix query type selection issue. [#87990](https://github.com/grafana/grafana/issues/87990), [@aangelisc](https://github.com/aangelisc)
- **Alerting:** Assume built-in AM is receiving alerts in case of not having admin config. [#87893](https://github.com/grafana/grafana/issues/87893), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **DashboardScene:** Skip panel repeats when values are the same. [#87788](https://github.com/grafana/grafana/issues/87788), [@torkelo](https://github.com/torkelo)
- **Alerting:** Fix deleting rules when silencing/resuming rule from a panel alert tab. [#87710](https://github.com/grafana/grafana/issues/87710), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Dashboards:** Don't set dashboard creator/updater if the action is done by an API key. [#87704](https://github.com/grafana/grafana/issues/87704), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Elasticsearch:** Fix setting of default maxConcurrentShardRequests. [#87703](https://github.com/grafana/grafana/issues/87703), [@ivanahuckova](https://github.com/ivanahuckova)
- **Graphite:** Fix alignment of elements in the query editor. [#87662](https://github.com/grafana/grafana/issues/87662), [@NWRichmond](https://github.com/NWRichmond)
- **DashboardScene:** Fixing major row repeat issues. [#87539](https://github.com/grafana/grafana/issues/87539), [@torkelo](https://github.com/torkelo)
- **Alerting:** Do not store series values from past evaluations in state manager for no reason. [#87525](https://github.com/grafana/grafana/issues/87525), [@alexweav](https://github.com/alexweav)
- **RBAC:** Update role picker in team page, fix a bug with roles being removed upon team setting update. [#87519](https://github.com/grafana/grafana/issues/87519), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Transformations:** Fix true inner join in `joinByField` transformation. [#87409](https://github.com/grafana/grafana/issues/87409), [@baldm0mma](https://github.com/baldm0mma)
- **Alerting:** Do not retry rule evaluations with "input data must be a wide series but got type long" style errors. [#87343](https://github.com/grafana/grafana/issues/87343), [@alexweav](https://github.com/alexweav)
- **Tempo:** Fix sorting for nested tables. [#87214](https://github.com/grafana/grafana/issues/87214), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Cloudwatch Logs:** Fix bug where we did not return errors to user. [#87190](https://github.com/grafana/grafana/issues/87190), [@sarahzinger](https://github.com/sarahzinger)
- **CloudWatch:** Fix apostrophes in dimension values not being escaped. [#87182](https://github.com/grafana/grafana/issues/87182), [@kevinwcyu](https://github.com/kevinwcyu)
- **AnnotationList:** Fix link for annotation with no panel or dashboard. [#87048](https://github.com/grafana/grafana/issues/87048), [@tskarhed](https://github.com/tskarhed)
- **Graphite:** Fix splitting expressions in tag_value with template variables. [#86958](https://github.com/grafana/grafana/issues/86958), [@EduardZaydler](https://github.com/EduardZaydler)
- **SQL Query Editor:** Fix label-for IDs, associate "Table" label. [#86944](https://github.com/grafana/grafana/issues/86944), [@timo](https://github.com/timo)
- **SSO:** Add SSO settings to secrets migrator. [#86913](https://github.com/grafana/grafana/issues/86913), [@dmihai](https://github.com/dmihai)
- **Plugins:** Preserve trailing slash in plugin proxy. [#86859](https://github.com/grafana/grafana/issues/86859), [@marefr](https://github.com/marefr)
- **TimeSeries:** Improve keyboard focus and fix spacebar override. [#86848](https://github.com/grafana/grafana/issues/86848), [@tskarhed](https://github.com/tskarhed)
- **NodeGraph:** Use values from fixedX/fixedY column for layout. [#86643](https://github.com/grafana/grafana/issues/86643), [@timo](https://github.com/timo)
- **Alerting:** Prevent simplified routing zero duration GroupInterval and RepeatInterval. [#86561](https://github.com/grafana/grafana/issues/86561), [@JacobsonMT](https://github.com/JacobsonMT)
- **Loki:** Fix setting of tenant ID. [#86433](https://github.com/grafana/grafana/issues/86433), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **DashboardScene:** Fixes checkbox orienation in save forms. [#86408](https://github.com/grafana/grafana/issues/86408), [@torkelo](https://github.com/torkelo)
- **CloudMonitoring:** Correctly interpolate multi-valued template variables in PromQL queries. [#86391](https://github.com/grafana/grafana/issues/86391), [@aangelisc](https://github.com/aangelisc)
- **Expressions:** Fix erroneous sorting of metrics and expressions. [#86372](https://github.com/grafana/grafana/issues/86372), [@NWRichmond](https://github.com/NWRichmond)
- **CloudMonitoring:** Allow a custom group by value. [#86288](https://github.com/grafana/grafana/issues/86288), [@aangelisc](https://github.com/aangelisc)
- **DataLinks:** Fixes datalinks with onClick and variables in url not being interpolated . [#86253](https://github.com/grafana/grafana/issues/86253), [@gng0](https://github.com/gng0)
- **I18N:** Fix untranslated descriptions in data source picker. [#86216](https://github.com/grafana/grafana/issues/86216), [@joshhunt](https://github.com/joshhunt)
- **RBAC:** Fix global role deletion in hosted Grafana. [#85980](https://github.com/grafana/grafana/issues/85980), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Expression:** Fix a bug of the display name of the threshold expression result. [#85912](https://github.com/grafana/grafana/issues/85912), [@lingyufei](https://github.com/lingyufei)
- **Alerting:** Fix incorrect display of pending period in alert rule form. [#85893](https://github.com/grafana/grafana/issues/85893), [@tomratcliffe](https://github.com/tomratcliffe)
- **Alerting:** Fix redirect after saving a notification template. [#85667](https://github.com/grafana/grafana/issues/85667), [@tomratcliffe](https://github.com/tomratcliffe)
- **Alerting:** Get oncall metada only when we have alert manager configuration data. [#85622](https://github.com/grafana/grafana/issues/85622), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Return better error for invalid time range on alert queries. [#85611](https://github.com/grafana/grafana/issues/85611), [@alexweav](https://github.com/alexweav)
- **CloudWatch:** Fix SageMaker MBP namespace typo. [#85557](https://github.com/grafana/grafana/issues/85557), [@tristanburgess](https://github.com/tristanburgess)
- **Alerting:** Only append `/alertmanager` when sending alerts to mimir targets if not already present. [#85543](https://github.com/grafana/grafana/issues/85543), [@alexweav](https://github.com/alexweav)
- **Alerting:** Set mimir implementation in jsonData by default when creating a new a…. [#85513](https://github.com/grafana/grafana/issues/85513), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Alerting:** Persist silence state immediately on Create/Delete . [#84705](https://github.com/grafana/grafana/issues/84705), [@JacobsonMT](https://github.com/JacobsonMT)
- **NodeGraph:** Fix configuring arc colors with mixed case field names. [#84609](https://github.com/grafana/grafana/issues/84609), [@timo](https://github.com/timo)
- **Auditing:** Fix Loki URL parsing. (Enterprise)
- **Provisioning:** Add override option to role provisioning. (Enterprise)
- **Alerting:** Check pointers before use to prevent segfault. (Enterprise)
- **Reporting:** Fix UI errors when using linked variables. (Enterprise)

### Breaking changes

Users that provision alert rules into folders whose titles contain slashes from now on they should escape them:
eg. if an alert group contains:
`folder: folder_with_/_in_title`
it should become:
`folder: folder_with_\/_in_title` Issue [#77450](https://github.com/grafana/grafana/issues/77450)

### Deprecations

The `grafana.explore.richHistory.activeDatasourceOnly` local storage key is deprecated, and will be removed in Grafana 12. You may experience loss of your Explore query history or autocomplete data if you upgrade to Grafana 12 under 2 weeks of Grafana 11.1. Actual risk of data loss depends on your query history retention policy. Issue [#86250](https://github.com/grafana/grafana/issues/86250)

### Plugin development fixes & changes

- **Select:** Change `Select` group headers to always be visible. [#88178](https://github.com/grafana/grafana/issues/88178), [@ashharrison90](https://github.com/ashharrison90)
- **Select:** Ensure virtualised menu scrolls active option into view when using arrow keys. [#87743](https://github.com/grafana/grafana/issues/87743), [@ashharrison90](https://github.com/ashharrison90)
- **Switch:** Improve disabled active state. [#87694](https://github.com/grafana/grafana/issues/87694), [@ashharrison90](https://github.com/ashharrison90)
- **Button:** Allow disabled button to still be focused. [#87516](https://github.com/grafana/grafana/issues/87516), [@JoaoSilvaGrafana](https://github.com/JoaoSilvaGrafana)
- **GrafanaUI:** Add `tabular` prop to Text component for tabular numbers. [#87440](https://github.com/grafana/grafana/issues/87440), [@JoaoSilvaGrafana](https://github.com/JoaoSilvaGrafana)

<!-- 11.1.0 END -->
<!-- 11.0.1 START -->

# 11.0.1 (2024-06-21)

### Bug fixes

- **Echo:** Suppress errors from frontend-metrics API call failing. [#89493](https://github.com/grafana/grafana/issues/89493), [@joshhunt](https://github.com/joshhunt)
- **Fix:** Portuguese Brazilian wasn't loading translations. [#89374](https://github.com/grafana/grafana/issues/89374), [@JoaoSilvaGrafana](https://github.com/JoaoSilvaGrafana)
- **Analytics:** Fix ApplicationInsights integration. [#89300](https://github.com/grafana/grafana/issues/89300), [@ashharrison90](https://github.com/ashharrison90)
- **DashboardScene:** Fixes issue removing override rule. [#89134](https://github.com/grafana/grafana/issues/89134), [@torkelo](https://github.com/torkelo)
- **BrowseDashboards:** Prepend subpath to New Browse Dashboard actions. [#89130](https://github.com/grafana/grafana/issues/89130), [@joshhunt](https://github.com/joshhunt)
- **Alerting:** Fix rule storage to filter by group names using case-sensitive comparison. [#89063](https://github.com/grafana/grafana/issues/89063), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **RBAC:** List only the folders that the user has access to. [#89015](https://github.com/grafana/grafana/issues/89015), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **DashboardScene:** Fixes lack of re-render when updating field override properties. [#88985](https://github.com/grafana/grafana/issues/88985), [@torkelo](https://github.com/torkelo)
- **DashboardScene:** Fixes inspect with transforms issue. [#88862](https://github.com/grafana/grafana/issues/88862), [@torkelo](https://github.com/torkelo)
- **AzureMonitor:** Fix bug detecting app insights queries. [#88787](https://github.com/grafana/grafana/issues/88787), [@aangelisc](https://github.com/aangelisc)
- **Access Control:** Clean up permissions for deprovisioned data sources. [#88700](https://github.com/grafana/grafana/issues/88700), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Loki:** Fix editor history in wrong order. [#88669](https://github.com/grafana/grafana/issues/88669), [@svennergr](https://github.com/svennergr)
- **SSE:** Fix threshold unmarshal to avoid panic. [#88651](https://github.com/grafana/grafana/issues/88651), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **LibraryPanels/RBAC:** Ignore old folder permission check when deleting/patching lib panel. [#88493](https://github.com/grafana/grafana/issues/88493), [@kaydelaney](https://github.com/kaydelaney)
- **Dashboards:** Correctly display Admin access to dashboards in the UI. [#88473](https://github.com/grafana/grafana/issues/88473), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **LogsTable:** Fix default sort by time. [#88434](https://github.com/grafana/grafana/issues/88434), [@svennergr](https://github.com/svennergr)
- **Alerting:** Fix rules deleting when reordering whilst filtered. [#88285](https://github.com/grafana/grafana/issues/88285), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** Fix typo in JSON response for rule export. [#88090](https://github.com/grafana/grafana/issues/88090), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **CloudMonitoring:** Fix query type selection issue. [#88024](https://github.com/grafana/grafana/issues/88024), [@aangelisc](https://github.com/aangelisc)
- **Alerting:** Fix scheduler to sort rules before evaluation. [#88021](https://github.com/grafana/grafana/issues/88021), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **DashboardScene:** Skip panel repeats when values are the same. [#87896](https://github.com/grafana/grafana/issues/87896), [@torkelo](https://github.com/torkelo)
- **Alerting:** Do not store series values from past evaluations in state manager for no reason. [#87845](https://github.com/grafana/grafana/issues/87845), [@alexweav](https://github.com/alexweav)
- **DashboardScene:** Fixing major row repeat issues. [#87800](https://github.com/grafana/grafana/issues/87800), [@torkelo](https://github.com/torkelo)
- **DashboardScene:** Fixes checkbox orienation in save forms. [#86490](https://github.com/grafana/grafana/issues/86490), [@torkelo](https://github.com/torkelo)
- **Provisioning:** Add override option to role provisioning. (Enterprise)

### Breaking changes

If you had selected your language as "Português Brasileiro" previously, this will be reset. You have to select it again in your Preferences for the fix to be applied and the translations will then be shown. Issue [#89374](https://github.com/grafana/grafana/issues/89374)

<!-- 11.0.1 END -->
<!-- 11.0.0 START -->

# 11.0.0 (2024-05-14)

### Features and enhancements

- **Alerting:** Add two sets of provisioning actions for rules and notifications . [#87572](https://github.com/grafana/grafana/issues/87572), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Chore:** Upgrade go to 1.21.10. [#87472](https://github.com/grafana/grafana/issues/87472), [@stephaniehingtgen](https://github.com/stephaniehingtgen)
- **Auth:** Force lowercase login/email for users. [#86985](https://github.com/grafana/grafana/issues/86985), [@eleijonmarck](https://github.com/eleijonmarck)
- **Navigation:** Add a return to previous button when navigating to different sections. [#86797](https://github.com/grafana/grafana/issues/86797), [@eledobleefe](https://github.com/eledobleefe)
- **DashboardScene:** Move add library panel view from grid item to drawer. [#86409](https://github.com/grafana/grafana/issues/86409), [@torkelo](https://github.com/torkelo)
- **CloudWatch :** Add missing AWS/ES metrics. [#86271](https://github.com/grafana/grafana/issues/86271), [@thepalbi](https://github.com/thepalbi)
- **Alerting:** Reduce set of fields that could trigger alert state change. [#86266](https://github.com/grafana/grafana/issues/86266), [@benoittgt](https://github.com/benoittgt)
- **OAuth:** Make sub claim required for generic oauth behind feature toggle. [#86118](https://github.com/grafana/grafana/issues/86118), [@kalleep](https://github.com/kalleep)
- **Grafana E2E:** Add deprecation notice and update docs. [#85778](https://github.com/grafana/grafana/issues/85778), [@sunker](https://github.com/sunker)
- **Loki:** Remove API restrictions on resource calls. [#85201](https://github.com/grafana/grafana/issues/85201), [@svennergr](https://github.com/svennergr)
- **Chore:** Upgrade go to 1.21.10. (Enterprise)

### Bug fixes

- **AuthN:** Fix signout redirect url. [#87681](https://github.com/grafana/grafana/issues/87681), [@kalleep](https://github.com/kalleep)
- **CloudMonitoring:** Improve legacy query migrations. [#87648](https://github.com/grafana/grafana/issues/87648), [@aangelisc](https://github.com/aangelisc)
- **Azure data sources:** Set selected config type before save. [#87632](https://github.com/grafana/grafana/issues/87632), [@bossinc](https://github.com/bossinc)
- **Loki:** Fix log context when no label types are present. [#87600](https://github.com/grafana/grafana/issues/87600), [@svennergr](https://github.com/svennergr)
- **DashboardScene:** Fixes editing transformations after toggling table view. [#87485](https://github.com/grafana/grafana/issues/87485), [@torkelo](https://github.com/torkelo)
- **DashboardDataSource:** Fixes issue where sometimes untransformed data could be returned . [#87484](https://github.com/grafana/grafana/issues/87484), [@torkelo](https://github.com/torkelo)
- **Provisioning:** Look up provisioned folders by UID when possible. [#87468](https://github.com/grafana/grafana/issues/87468), [@DanCech](https://github.com/DanCech)
- **Cloudwatch:** Update grafana-aws-sdk to fix sts endpoints. [#87345](https://github.com/grafana/grafana/issues/87345), [@iwysiu](https://github.com/iwysiu)
- **Select:** Fixes issue preserving search term (input) when selecting a value. [#87249](https://github.com/grafana/grafana/issues/87249), [@torkelo](https://github.com/torkelo)
- **Alerting:** Prevent search from locking the browser. [#87230](https://github.com/grafana/grafana/issues/87230), [@gillesdemey](https://github.com/gillesdemey)
- **DashboardScene:** Fixes issue referring to library panel in dashboard data source . [#87173](https://github.com/grafana/grafana/issues/87173), [@torkelo](https://github.com/torkelo)
- **Data source:** Maintain the default data source permissions when switching from unlicensed to licensed Grafana. [#87142](https://github.com/grafana/grafana/issues/87142), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Alerting:** Allow deleting contact points referenced only by auto-generated policies. [#87115](https://github.com/grafana/grafana/issues/87115), [@gillesdemey](https://github.com/gillesdemey)
- **Auth:** Sign sigV4 request after adding headers. [#87072](https://github.com/grafana/grafana/issues/87072), [@iwysiu](https://github.com/iwysiu)
- **DashboardScene:** Fixes issues with relative time range in panel edit. [#87026](https://github.com/grafana/grafana/issues/87026), [@torkelo](https://github.com/torkelo)
- **DashboardScene:** Fixes issue with dashboard links and variables. [#87025](https://github.com/grafana/grafana/issues/87025), [@torkelo](https://github.com/torkelo)
- **SQLStore:** Disable redundant create and drop unique index migrations on dashboard table. [#86867](https://github.com/grafana/grafana/issues/86867), [@papagian](https://github.com/papagian)
- **LogContext:** Fix structured metadata labels being added as stream selectors. [#86826](https://github.com/grafana/grafana/issues/86826), [@svennergr](https://github.com/svennergr)
- **DashboardScene:** Fixes issue with editing panels that uses instanceState. [#86824](https://github.com/grafana/grafana/issues/86824), [@torkelo](https://github.com/torkelo)
- **DashboardScene:** Fixes deleting dirty dashboard. [#86757](https://github.com/grafana/grafana/issues/86757), [@torkelo](https://github.com/torkelo)
- **Alerting:** Take receivers into account when custom grouping Alertmanager groups. [#86699](https://github.com/grafana/grafana/issues/86699), [@konrad147](https://github.com/konrad147)
- **LDAP:** Fix listing all non-matching groups. [#86689](https://github.com/grafana/grafana/issues/86689), [@mgyongyosi](https://github.com/mgyongyosi)
- **Alerting:** Fix simplified routing group by override. [#86563](https://github.com/grafana/grafana/issues/86563), [@JacobsonMT](https://github.com/JacobsonMT)
- **NodeGraph:** Fix invisible arrow tips in Editor. [#86548](https://github.com/grafana/grafana/issues/86548), [@timo](https://github.com/timo)
- **Dashboard:** DashboardPageProxy - Use chaining operators to prevent runtime error. [#86536](https://github.com/grafana/grafana/issues/86536), [@axelavargas](https://github.com/axelavargas)
- **Cli:** Check missing plugin parameter of plugin update command. [#86522](https://github.com/grafana/grafana/issues/86522), [@VergeDX](https://github.com/VergeDX)
- **DashboardScene:** Fixes issue saving new dashboard from panel edit. [#86480](https://github.com/grafana/grafana/issues/86480), [@torkelo](https://github.com/torkelo)
- **DashboardScene:** Fixes minor issue transitioning between dashboards. [#86475](https://github.com/grafana/grafana/issues/86475), [@torkelo](https://github.com/torkelo)
- **MSSQL:** Add `SQL_VARIANT` converter and update test. [#86469](https://github.com/grafana/grafana/issues/86469), [@aangelisc](https://github.com/aangelisc)
- **DashboardScene:** Fixes react panels with old angular options. [#86411](https://github.com/grafana/grafana/issues/86411), [@torkelo](https://github.com/torkelo)
- **Alerting:** Fix simplified routes '...' groupBy creating invalid routes. [#86376](https://github.com/grafana/grafana/issues/86376), [@JacobsonMT](https://github.com/JacobsonMT)
- **AWS DataSource:** Fix namespaces in sagemaker metrics. [#86363](https://github.com/grafana/grafana/issues/86363), [@tristanburgess](https://github.com/tristanburgess)
- **DashboardScene:** Fixes saving dashboard with angular panels . [#86255](https://github.com/grafana/grafana/issues/86255), [@torkelo](https://github.com/torkelo)
- **DashboardScene:** Fix empty row repeat issue. [#86254](https://github.com/grafana/grafana/issues/86254), [@torkelo](https://github.com/torkelo)
- **Nodegraph:** Fix issue with rendering single node. [#86195](https://github.com/grafana/grafana/issues/86195), [@aocenas](https://github.com/aocenas)
- **Datasources:** Add fixed width to name field in config editor. [#86179](https://github.com/grafana/grafana/issues/86179), [@sunker](https://github.com/sunker)
- **Alerting:** Return a 400 and errutil error when trying to delete a contact point that is referenced by a policy. [#86163](https://github.com/grafana/grafana/issues/86163), [@alexweav](https://github.com/alexweav)
- **Table Panel:** Fix image disappearing when datalinks applied. [#86160](https://github.com/grafana/grafana/issues/86160), [@codeincarnate](https://github.com/codeincarnate)
- **LibraryPanelRBAC:** Fix issue with importing dashboards containing library panels. [#86149](https://github.com/grafana/grafana/issues/86149), [@kaydelaney](https://github.com/kaydelaney)
- **DashboardScene:** Fixes issue moving between dashboards. [#86096](https://github.com/grafana/grafana/issues/86096), [@torkelo](https://github.com/torkelo)
- **Alerting:** Fix evaluation metrics to not count retries. [#86059](https://github.com/grafana/grafana/issues/86059), [@stevesg](https://github.com/stevesg)
- **Google Cloud Monitor:** Fix interface conversion for incorrect type in `cloudMonitoringProm.run`. [#85928](https://github.com/grafana/grafana/issues/85928), [@adamyeats](https://github.com/adamyeats)
- **Dashboard:** Allow `auto` refresh option when saving a dashboard. [#85922](https://github.com/grafana/grafana/issues/85922), [@bfmatei](https://github.com/bfmatei)
- **Time Zones:** Fix relative time when using UTC timezone. [#85779](https://github.com/grafana/grafana/issues/85779), [@ashharrison90](https://github.com/ashharrison90)
- **PostgreSQL:** Fix the verify-ca mode. [#85775](https://github.com/grafana/grafana/issues/85775), [@gabor](https://github.com/gabor)
- **DashboardScene:** Fixes issue with mobile responsive layout due to repeated grid item class. [#85741](https://github.com/grafana/grafana/issues/85741), [@torkelo](https://github.com/torkelo)
- **DashboardScene:** Fixes panel edit issue with clearing title not resulting in hover header mode . [#85633](https://github.com/grafana/grafana/issues/85633), [@torkelo](https://github.com/torkelo)
- **Angular deprecation:** Prefer local "angularDetected" value to the remote one. [#85632](https://github.com/grafana/grafana/issues/85632), [@xnyo](https://github.com/xnyo)
- **Chore:** Fix trailing spaces in prometheus min step. [#85579](https://github.com/grafana/grafana/issues/85579), [@euniceek](https://github.com/euniceek)
- **SAML:** Fix Authn request generation in case of HTTP-POST binding. (Enterprise)
- **Reporting:** Fix CSVs for library panels within folders. (Enterprise)

### Breaking changes

The `@grafana/e2e` package is deprecated in Grafana 11.0.0. If your Grafana plugin has end-to-end tests that use `@grafana/e2e`, it's recommended to replace them with [`@grafana/plugin-e2e`](https://www.npmjs.com/package/@grafana/plugin-e2e?activeTab=readme) and Playwright. For information on how to migrate, please refer to the plugin-e2e [docs](https://grafana.com/developers/plugin-tools/e2e-test-a-plugin/migrate-from-grafana-e2e). Issue [#85778](https://github.com/grafana/grafana/issues/85778)

### Plugin development fixes & changes

- **DateTimePicker:** Alternate timezones now behave correctly. [#87041](https://github.com/grafana/grafana/issues/87041), [@ashharrison90](https://github.com/ashharrison90)
- **TimeOfDayPicker:** Fix text colours in light mode. [#86776](https://github.com/grafana/grafana/issues/86776), [@ashharrison90](https://github.com/ashharrison90)

<!-- 11.0.0 END -->
<!-- 11.0.0-preview START -->

# 11.0.0-preview

### Features and enhancements

- **Alerting:** Editor role can access all provisioning API. [#85022](https://github.com/grafana/grafana/issues/85022), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **CloudWatch:** Add additional AWS/SageMaker metrics. [#85009](https://github.com/grafana/grafana/issues/85009), [@tristanburgess](https://github.com/tristanburgess)
- **SQLStore:** Enable migration locking by default. [#84983](https://github.com/grafana/grafana/issues/84983), [@papagian](https://github.com/papagian)
- **Auth:** Remove `oauth_skip_org_role_update_sync` as an option. [#84972](https://github.com/grafana/grafana/issues/84972), [@eleijonmarck](https://github.com/eleijonmarck)
- **Canvas:** Add "infinite" pan / zoom functionality. [#84968](https://github.com/grafana/grafana/issues/84968), [@nmarrs](https://github.com/nmarrs)
- **InteractiveTable:** Add expand all to column. [#84966](https://github.com/grafana/grafana/issues/84966), [@abannachGrafana](https://github.com/abannachGrafana)
- **Snapshots:** Viewers can not create a Snapshot. [#84952](https://github.com/grafana/grafana/issues/84952), [@evictorero](https://github.com/evictorero)
- **GenAI:** Autogenerate title and description for panels and dashboards. [#84933](https://github.com/grafana/grafana/issues/84933), [@ivanortegaalba](https://github.com/ivanortegaalba)
- **Canvas:** Add corner radius option. [#84873](https://github.com/grafana/grafana/issues/84873), [@drew08t](https://github.com/drew08t)
- **Alerting:** Enable simplified routing FF by default. [#84856](https://github.com/grafana/grafana/issues/84856), [@JacobsonMT](https://github.com/JacobsonMT)
- **Auth:** Enable case insensitive logins/emails by default. [#84840](https://github.com/grafana/grafana/issues/84840), [@eleijonmarck](https://github.com/eleijonmarck)
- **RBAC:** Enable annotation permission update by default. [#84787](https://github.com/grafana/grafana/issues/84787), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Azure:** Support multi-resource namespace (NetApp Volumes). [#84779](https://github.com/grafana/grafana/issues/84779), [@aangelisc](https://github.com/aangelisc)
- **Prometheus:** Default support labels value endpoint with match param when prom type and version not set. [#84778](https://github.com/grafana/grafana/issues/84778), [@bohandley](https://github.com/bohandley)
- **MSSQL:** Add Windows AD/Kerberos auth. [#84742](https://github.com/grafana/grafana/issues/84742), [@asimpson](https://github.com/asimpson)
- **Chore:** Disable angular support by default. [#84738](https://github.com/grafana/grafana/issues/84738), [@tolzhabayev](https://github.com/tolzhabayev)
- **Elasticsearch:** Remove xpack button and make includeFrozen not dependant on it. [#84734](https://github.com/grafana/grafana/issues/84734), [@ivanahuckova](https://github.com/ivanahuckova)
- **Plugins:** Enable feature toggle `pluginsDynamicAngularDetectionPatterns` by default. [#84723](https://github.com/grafana/grafana/issues/84723), [@xnyo](https://github.com/xnyo)
- **Plugins:** Enable managedPluginsInstall by default. [#84721](https://github.com/grafana/grafana/issues/84721), [@oshirohugo](https://github.com/oshirohugo)
- **Alerting:** Stop persisting silences and nflog to disk. [#84706](https://github.com/grafana/grafana/issues/84706), [@JacobsonMT](https://github.com/JacobsonMT)
- **Histogram:** Add support for stacking mode. [#84693](https://github.com/grafana/grafana/issues/84693), [@adela-almasan](https://github.com/adela-almasan)
- **Datasource:** Change query filtering. [#84656](https://github.com/grafana/grafana/issues/84656), [@sunker](https://github.com/sunker)
- **Feature toggles:** Remove redshiftAsyncQueryDataSupport and athenaAsyncQueryDataSupport feature toggles. [#84653](https://github.com/grafana/grafana/issues/84653), [@idastambuk](https://github.com/idastambuk)
- **Teams:** Display teams page to team reader if they also have the access to list team permissions. [#84650](https://github.com/grafana/grafana/issues/84650), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Plugins:** Enable feature toggle `enablePluginsTracingByDefault` by default. [#84645](https://github.com/grafana/grafana/issues/84645), [@xnyo](https://github.com/xnyo)
- **NestedFolders:** Enable nested folders by default. [#84631](https://github.com/grafana/grafana/issues/84631), [@zserge](https://github.com/zserge)
- **Canvas:** Add direction options for connections. [#84620](https://github.com/grafana/grafana/issues/84620), [@drew08t](https://github.com/drew08t)
- **CloudWatch:** Static labels should use label name. [#84611](https://github.com/grafana/grafana/issues/84611), [@iwysiu](https://github.com/iwysiu)
- **Tempo:** Deprecate old search. [#84498](https://github.com/grafana/grafana/issues/84498), [@joey-grafana](https://github.com/joey-grafana)
- **Canvas:** Support dashed connection lines. [#84496](https://github.com/grafana/grafana/issues/84496), [@Develer](https://github.com/Develer)
- **I18n:** Add Brazilian Portuguese. [#84461](https://github.com/grafana/grafana/issues/84461), [@joshhunt](https://github.com/joshhunt)
- **I18n:** Expose current UI language in @grafana/runtime config. [#84457](https://github.com/grafana/grafana/issues/84457), [@joshhunt](https://github.com/joshhunt)
- **Canvas:** Add snapping to vertex edit. [#84417](https://github.com/grafana/grafana/issues/84417), [@drew08t](https://github.com/drew08t)
- **CloudWatch Logs:** Remove toggle for cloudWatchLogsMonacoEditor. [#84414](https://github.com/grafana/grafana/issues/84414), [@iwysiu](https://github.com/iwysiu)
- **Prometheus:** Use frontend package in Prometheus DS with a feature toggle. [#84397](https://github.com/grafana/grafana/issues/84397), [@bohandley](https://github.com/bohandley)
- **Alerting:** Show error message when error is thrown after clicking create alert f…. [#84367](https://github.com/grafana/grafana/issues/84367), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Tempo:** Remove Loki tab. [#84346](https://github.com/grafana/grafana/issues/84346), [@joey-grafana](https://github.com/joey-grafana)
- **Storage:** Add support for listing resource history. [#84331](https://github.com/grafana/grafana/issues/84331), [@DanCech](https://github.com/DanCech)
- **Cloudwatch:** Remove cloudWatchWildCardDimensionValues feature toggle. [#84329](https://github.com/grafana/grafana/issues/84329), [@iwysiu](https://github.com/iwysiu)
- **Plugin Extensions:** Add prop types to component extensions. [#84295](https://github.com/grafana/grafana/issues/84295), [@leventebalogh](https://github.com/leventebalogh)
- **Canvas:** New basic elements. [#84205](https://github.com/grafana/grafana/issues/84205), [@Develer](https://github.com/Develer)
- **Tempo:** Update TraceQLStreaming feature toggle stage. [#84203](https://github.com/grafana/grafana/issues/84203), [@joey-grafana](https://github.com/joey-grafana)
- **Canvas:** Add universal data link support. [#84142](https://github.com/grafana/grafana/issues/84142), [@nmarrs](https://github.com/nmarrs)
- **Chore:** Remove repetitive words. [#84132](https://github.com/grafana/grafana/issues/84132), [@carrychair](https://github.com/carrychair)
- **Documentation:** Updated yaml for influxdb data sources. [#84119](https://github.com/grafana/grafana/issues/84119), [@ldomesjo](https://github.com/ldomesjo)
- **Queries:** Improve debug logging of metrics queries. [#84048](https://github.com/grafana/grafana/issues/84048), [@mmandrus](https://github.com/mmandrus)
- **Storage:** Support listing deleted entities. [#84043](https://github.com/grafana/grafana/issues/84043), [@DanCech](https://github.com/DanCech)
- **Explore:** Remove deprecated `query` option from `splitOpen`. [#83973](https://github.com/grafana/grafana/issues/83973), [@Elfo404](https://github.com/Elfo404)
- **Chore:** Remove deprecated ExploreQueryFieldProps. [#83972](https://github.com/grafana/grafana/issues/83972), [@Elfo404](https://github.com/Elfo404)
- **Chore:** Remove deprecated exploreId from QueryEditorProps. [#83971](https://github.com/grafana/grafana/issues/83971), [@Elfo404](https://github.com/Elfo404)
- **Alerting:** Disallow invalid rule namespace UIDs in provisioning API. [#83938](https://github.com/grafana/grafana/issues/83938), [@rwwiv](https://github.com/rwwiv)
- **Auth:** Set the default org after User login. [#83918](https://github.com/grafana/grafana/issues/83918), [@mgyongyosi](https://github.com/mgyongyosi)
- **Canvas:** Add datalink support to rectangle and ellipse elements. [#83870](https://github.com/grafana/grafana/issues/83870), [@nmarrs](https://github.com/nmarrs)
- **NodeGraph:** Edge color and stroke-dasharray support. [#83855](https://github.com/grafana/grafana/issues/83855), [@morrro01](https://github.com/morrro01)
- **InfluxDB:** Add configuration option for enabling insecure gRPC connections. [#83834](https://github.com/grafana/grafana/issues/83834), [@jmickey](https://github.com/jmickey)
- **Plugins:** Fetch instance provisioned plugins in cloud, to check full installation. [#83784](https://github.com/grafana/grafana/issues/83784), [@oshirohugo](https://github.com/oshirohugo)
- **Alerting:** Implement correct RBAC checks for creating new notification templates. [#83767](https://github.com/grafana/grafana/issues/83767), [@gillesdemey](https://github.com/gillesdemey)
- **Library panels:** Ensure all filters are visible on mobile . [#83759](https://github.com/grafana/grafana/issues/83759), [@ashharrison90](https://github.com/ashharrison90)
- **AuthProxy:** Allow disabling Auth Proxy cache. [#83755](https://github.com/grafana/grafana/issues/83755), [@Jguer](https://github.com/Jguer)
- **Switch:** Remove "transparent" prop. [#83705](https://github.com/grafana/grafana/issues/83705), [@Clarity-89](https://github.com/Clarity-89)
- **Alerting:** Allow inserting before or after existing policy. [#83704](https://github.com/grafana/grafana/issues/83704), [@gillesdemey](https://github.com/gillesdemey)
- **Chore:** Taint ArrayVector with `never` to further discourage. [#83681](https://github.com/grafana/grafana/issues/83681), [@joshhunt](https://github.com/joshhunt)
- **Alerting:** Remove legacy alerting. [#83671](https://github.com/grafana/grafana/issues/83671), [@gillesdemey](https://github.com/gillesdemey)
- **Canvas:** Add vertex control to connections. [#83653](https://github.com/grafana/grafana/issues/83653), [@drew08t](https://github.com/drew08t)
- **Alerting:** Disable legacy alerting for ever. [#83651](https://github.com/grafana/grafana/issues/83651), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Table:** Preserve filtered value state. [#83631](https://github.com/grafana/grafana/issues/83631), [@codeincarnate](https://github.com/codeincarnate)
- **Canvas:** Add ability to edit selected connections in the inline editor. [#83625](https://github.com/grafana/grafana/issues/83625), [@nmarrs](https://github.com/nmarrs)
- **Auth:** Add all settings to Azure AD SSO config UI. [#83618](https://github.com/grafana/grafana/issues/83618), [@mgyongyosi](https://github.com/mgyongyosi)
- **Cfg:** Add a setting to configure if the local file system is available. [#83616](https://github.com/grafana/grafana/issues/83616), [@mgyongyosi](https://github.com/mgyongyosi)
- **Server:** Reload TLS certs without a server restart. [#83589](https://github.com/grafana/grafana/issues/83589), [@chalapat](https://github.com/chalapat)
- **Accessibility:** Improve landmark markup. [#83576](https://github.com/grafana/grafana/issues/83576), [@tskarhed](https://github.com/tskarhed)
- **Snapshots:** Change default expiration. [#83550](https://github.com/grafana/grafana/issues/83550), [@evictorero](https://github.com/evictorero)
- **Transformations:** Add substring matcher to the 'Filter by Value' transformation. [#83548](https://github.com/grafana/grafana/issues/83548), [@timlevett](https://github.com/timlevett)
- **Folders:** Allow listing folders with write permission. [#83527](https://github.com/grafana/grafana/issues/83527), [@papagian](https://github.com/papagian)
- **Chore:** Remove React 17 peer deps. [#83524](https://github.com/grafana/grafana/issues/83524), [@ashharrison90](https://github.com/ashharrison90)
- **Alerting:** Support deleting rule groups in the provisioning API. [#83514](https://github.com/grafana/grafana/issues/83514), [@joeblubaugh](https://github.com/joeblubaugh)
- **Cloudwatch:** Bump grafana/aws-sdk-go to 0.24.0. [#83480](https://github.com/grafana/grafana/issues/83480), [@idastambuk](https://github.com/idastambuk)
- **Alerting:** Stop persisting user-defined templates to disk. [#83456](https://github.com/grafana/grafana/issues/83456), [@JacobsonMT](https://github.com/JacobsonMT)
- **Transformer:** Config from Query: set threshold colours. [#83366](https://github.com/grafana/grafana/issues/83366), [@LarsStegman](https://github.com/LarsStegman)
- **CloudWatch:** Refactor "getDimensionValuesForWildcards". [#83335](https://github.com/grafana/grafana/issues/83335), [@iwysiu](https://github.com/iwysiu)
- **CloudWatch:** Fetch externalId from settings instead of env. [#83332](https://github.com/grafana/grafana/issues/83332), [@iwysiu](https://github.com/iwysiu)
- **Tracing:** Add node graph panel suggestion. [#83311](https://github.com/grafana/grafana/issues/83311), [@joey-grafana](https://github.com/joey-grafana)
- **Canvas:** Add ability to rotate elements. [#83295](https://github.com/grafana/grafana/issues/83295), [@nmarrs](https://github.com/nmarrs)
- **Tempo:** Add support for ad-hoc filters. [#83290](https://github.com/grafana/grafana/issues/83290), [@joey-grafana](https://github.com/joey-grafana)
- **DataTrails:** Sticky controls. [#83286](https://github.com/grafana/grafana/issues/83286), [@torkelo](https://github.com/torkelo)
- **CloudWatch:** Move SessionCache onto the instance. [#83278](https://github.com/grafana/grafana/issues/83278), [@iwysiu](https://github.com/iwysiu)
- **Alerting:** Deprecate max_annotations_to_keep and max_annotation_age in [alerting] configuration section. [#83266](https://github.com/grafana/grafana/issues/83266), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Annotation query:** Render query result in alert box. [#83230](https://github.com/grafana/grafana/issues/83230), [@sunker](https://github.com/sunker)
- **Chore:** Query oauth info from a new instance. [#83229](https://github.com/grafana/grafana/issues/83229), [@linoman](https://github.com/linoman)
- **CloudWatch:** Add Firehose kms-related metrics. [#83192](https://github.com/grafana/grafana/issues/83192), [@thepalbi](https://github.com/thepalbi)
- **Chore:** Add go workspace. [#83191](https://github.com/grafana/grafana/issues/83191), [@toddtreece](https://github.com/toddtreece)
- **Accessibility:** Improve HelpModal markup. [#83171](https://github.com/grafana/grafana/issues/83171), [@tskarhed](https://github.com/tskarhed)
- **Chore:** Delete Input Datasource. [#83163](https://github.com/grafana/grafana/issues/83163), [@jackw](https://github.com/jackw)
- **Traces:** Add traces panel suggestion. [#83089](https://github.com/grafana/grafana/issues/83089), [@joey-grafana](https://github.com/joey-grafana)
- **CloudWatch:** Update AWS/EC2 metrics. [#83039](https://github.com/grafana/grafana/issues/83039), [@jangaraj](https://github.com/jangaraj)
- **CloudWatch:** Update AWS/Lambda metrics. [#83038](https://github.com/grafana/grafana/issues/83038), [@jangaraj](https://github.com/jangaraj)
- **CloudWatch:** Update AWS/ES metrics. [#83037](https://github.com/grafana/grafana/issues/83037), [@jangaraj](https://github.com/jangaraj)
- **CloudWatch:** Update AWS/AutoScaling metrics. [#83036](https://github.com/grafana/grafana/issues/83036), [@jangaraj](https://github.com/jangaraj)
- **CloudWatch:** Update AWS/Kafka metrics. [#83035](https://github.com/grafana/grafana/issues/83035), [@jangaraj](https://github.com/jangaraj)
- **Page:** Use browser native scrollbars for the main page content. [#82919](https://github.com/grafana/grafana/issues/82919), [@joshhunt](https://github.com/joshhunt)
- **Parca:** Apply template variables for labelSelector in query. [#82910](https://github.com/grafana/grafana/issues/82910), [@lzakharov](https://github.com/lzakharov)
- **Grafana/UI:** Replace Splitter with useSplitter hook and refactor PanelEdit snapping logic to useSnappingSplitter hook . [#82895](https://github.com/grafana/grafana/issues/82895), [@torkelo](https://github.com/torkelo)
- **Cloudwatch:** Add linting to restrict imports from core. [#82538](https://github.com/grafana/grafana/issues/82538), [@idastambuk](https://github.com/idastambuk)
- **Grafana/icons:** Add icons package. [#82314](https://github.com/grafana/grafana/issues/82314), [@Clarity-89](https://github.com/Clarity-89)
- **Storage:** Watch support. [#82282](https://github.com/grafana/grafana/issues/82282), [@DanCech](https://github.com/DanCech)
- **Image Rendering:** Add settings for default width, height and scale. [#82040](https://github.com/grafana/grafana/issues/82040), [@khushijain21](https://github.com/khushijain21)
- **AzureMonitor:** User authentication support. [#81918](https://github.com/grafana/grafana/issues/81918), [@aangelisc](https://github.com/aangelisc)
- **Plugins:** Disable uninstall while cloud uninstall is not completed. [#81907](https://github.com/grafana/grafana/issues/81907), [@oshirohugo](https://github.com/oshirohugo)
- **Plugins:** Disable update button when cloud install is not completed. [#81716](https://github.com/grafana/grafana/issues/81716), [@oshirohugo](https://github.com/oshirohugo)
- **Expressions:** Sql expressions with Duckdb. [#81666](https://github.com/grafana/grafana/issues/81666), [@scottlepp](https://github.com/scottlepp)
- **BarChart:** TooltipPlugin2. [#80920](https://github.com/grafana/grafana/issues/80920), [@leeoniya](https://github.com/leeoniya)
- **Grafana:** Replace magic number with a constant variable in response status. [#80132](https://github.com/grafana/grafana/issues/80132), [@rlaisqls](https://github.com/rlaisqls)
- **Alerting:** Update rule access control to explicitly check for permissions "alert.rules:read" and "folders:read". [#78289](https://github.com/grafana/grafana/issues/78289), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Alerting:** Update provisioning API to support regular permissions. [#77007](https://github.com/grafana/grafana/issues/77007), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Whitelabelling:** Override version in UI from config. (Enterprise)
- **Alerting:** Remove legacy alerting. (Enterprise)
- **Reporting:** Delete Deprecated Endpoint for Single Dashboard. (Enterprise)
- **Plugins:** Add endpoint to get provisioned plugins from an instance. (Enterprise)
- **Reporting:** Delete Deprecated Endpoint for Scheduling. (Enterprise)
- **Reporting:** Delete Deprecated Endpoint for Email. (Enterprise)

### Bug fixes

- **RBAC:** Fix access checks for interactions with RBAC roles in hosted Grafana. [#85520](https://github.com/grafana/grafana/issues/85520), [@IevaVasiljeva](https://github.com/IevaVasiljeva)
- **Keybindings:** Replace mod+h as help shortcut with ? . [#85449](https://github.com/grafana/grafana/issues/85449), [@tskarhed](https://github.com/tskarhed)
- **RBAC:** Fix slow user permission search query on MySQL. [#85410](https://github.com/grafana/grafana/issues/85410), [@gamab](https://github.com/gamab)
- **BrowseDashboards:** Add subpath to URLs on Browse Dashboards page. [#85354](https://github.com/grafana/grafana/issues/85354), [@butkovv](https://github.com/butkovv)
- **Dashboards:** Fix issue where long ad-hoc values broke UI. [#85290](https://github.com/grafana/grafana/issues/85290), [@kaydelaney](https://github.com/kaydelaney)
- **NodeGraph:** Fix possible metadata mismatch between nodes in graph. [#85261](https://github.com/grafana/grafana/issues/85261), [@aocenas](https://github.com/aocenas)
- **Alerting:** Fix receiver inheritance when provisioning a notification policy. [#85193](https://github.com/grafana/grafana/issues/85193), [@julienduchesne](https://github.com/julienduchesne)
- **AuthProxy:** Fix missing session for ldap auth proxy users. [#85136](https://github.com/grafana/grafana/issues/85136), [@Jguer](https://github.com/Jguer)
- **RBAC:** Fix slow user permission search query on MySQL. [#85058](https://github.com/grafana/grafana/issues/85058), [@gamab](https://github.com/gamab)
- **CloudMonitoring:** Only run query if filters are complete. [#85004](https://github.com/grafana/grafana/issues/85004), [@aangelisc](https://github.com/aangelisc)
- **BrowseDashboards:** Add subpath to URLs on Browse Dashboards page. [#84992](https://github.com/grafana/grafana/issues/84992), [@butkovv](https://github.com/butkovv)
- **Datasources:** Fix expressions that reference hidden queries. [#84977](https://github.com/grafana/grafana/issues/84977), [@sunker](https://github.com/sunker)
- **Canvas:** Fix crash when trying to add wind turbine element. [#84962](https://github.com/grafana/grafana/issues/84962), [@nmarrs](https://github.com/nmarrs)
- **InfluxDB:** Fix alias interpolation when it has $\_\_interval or multiple tags. [#84940](https://github.com/grafana/grafana/issues/84940), [@itsmylife](https://github.com/itsmylife)
- **Alerting:** Stop returning autogen routes for non-admin on api/v2/status. [#84864](https://github.com/grafana/grafana/issues/84864), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Fix broken panelId links. [#84839](https://github.com/grafana/grafana/issues/84839), [@gillesdemey](https://github.com/gillesdemey)
- **Alerting:** External AM fix parsing basic auth with escape characters. [#84681](https://github.com/grafana/grafana/issues/84681), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Support PromQL-style matchers. [#84672](https://github.com/grafana/grafana/issues/84672), [@gillesdemey](https://github.com/gillesdemey)
- **FolderPicker:** Add permission filter to nested folder picker. [#84644](https://github.com/grafana/grafana/issues/84644), [@joshhunt](https://github.com/joshhunt)
- **RolePicker:** Don't try to fetch roles for new form. [#84630](https://github.com/grafana/grafana/issues/84630), [@kalleep](https://github.com/kalleep)
- **Pyroscope:** Fix template variable support. [#84477](https://github.com/grafana/grafana/issues/84477), [@aocenas](https://github.com/aocenas)
- **Scenes:** Fix public dashboard email sharing section. [#84467](https://github.com/grafana/grafana/issues/84467), [@juanicabanas](https://github.com/juanicabanas)
- **Alerting:** Fix AlertsFolderView not showing rules when using nested folders. [#84465](https://github.com/grafana/grafana/issues/84465), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **Jaeger:** Fix flaky test. [#84441](https://github.com/grafana/grafana/issues/84441), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Scenes:** Fix issue with discarding unsaved changes modal in new dashboards. [#84369](https://github.com/grafana/grafana/issues/84369), [@kaydelaney](https://github.com/kaydelaney)
- **PostgreSQL:** Display correct initial value for tls mode. [#84356](https://github.com/grafana/grafana/issues/84356), [@gabor](https://github.com/gabor)
- **Cloudwatch:** Fix issue with Grafana Assume Role. [#84315](https://github.com/grafana/grafana/issues/84315), [@sarahzinger](https://github.com/sarahzinger)
- **Playlists:** Fix kiosk mode not activating when starting a playlist. [#84262](https://github.com/grafana/grafana/issues/84262), [@joshhunt](https://github.com/joshhunt)
- **Google Cloud Monitor:** Fix `res` being accessed after it becomes `nil` in `promql_query.go`. [#84223](https://github.com/grafana/grafana/issues/84223), [@adamyeats](https://github.com/adamyeats)
- **Elasticsearch:** Fix using of individual query time ranges when querying. [#84201](https://github.com/grafana/grafana/issues/84201), [@ivanahuckova](https://github.com/ivanahuckova)
- **InfluxDB:** Fix for wrong query generated with template variable and non regex operator on frontend mode. [#84175](https://github.com/grafana/grafana/issues/84175), [@wasim-nihal](https://github.com/wasim-nihal)
- **Prometheus:** Remove &lt; and &gt; from Query Builder Label Matcher operations. [#83981](https://github.com/grafana/grafana/issues/83981), [@kylebrandt](https://github.com/kylebrandt)
- **Worker:** Use CorsWorker to avoid CORS issues. [#83976](https://github.com/grafana/grafana/issues/83976), [@ivanortegaalba](https://github.com/ivanortegaalba)
- **Tempo:** Fix by operator to support multiple arguments. [#83947](https://github.com/grafana/grafana/issues/83947), [@fabrizio-grafana](https://github.com/fabrizio-grafana)
- **Plugins Catalog:** Fix plugin details page initial flickering. [#83896](https://github.com/grafana/grafana/issues/83896), [@leventebalogh](https://github.com/leventebalogh)
- **Loki:** Interpolate variables in live queries. [#83831](https://github.com/grafana/grafana/issues/83831), [@ivanahuckova](https://github.com/ivanahuckova)
- **Table Panel:** Fix condition for showing footer options. [#83801](https://github.com/grafana/grafana/issues/83801), [@codeincarnate](https://github.com/codeincarnate)
- **Alerting:** Fix bug in screenshot service using incorrect limit. [#83786](https://github.com/grafana/grafana/issues/83786), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** Fix editing Grafana folder via alert rule editor. [#83771](https://github.com/grafana/grafana/issues/83771), [@gillesdemey](https://github.com/gillesdemey)
- **Cloudwatch:** Fix new ConfigEditor to add the custom namespace field . [#83762](https://github.com/grafana/grafana/issues/83762), [@idastambuk](https://github.com/idastambuk)
- **LDAP:** Fix LDAP users authenticated via auth proxy not being able to use LDAP active sync. [#83715](https://github.com/grafana/grafana/issues/83715), [@Jguer](https://github.com/Jguer)
- **Elasticsearch:** Fix adhoc filters not applied in frontend mode. [#83592](https://github.com/grafana/grafana/issues/83592), [@svennergr](https://github.com/svennergr)
- **RBAC:** Fix delete team permissions on team delete. [#83442](https://github.com/grafana/grafana/issues/83442), [@gamab](https://github.com/gamab)
- **Dashboards:** Fixes issue where panels would not refresh if time range updated while in panel view mode. [#83418](https://github.com/grafana/grafana/issues/83418), [@kaydelaney](https://github.com/kaydelaney)
- **AzureMonitor:** Fix mishandled resources vs workspaces. [#83184](https://github.com/grafana/grafana/issues/83184), [@adamyeats](https://github.com/adamyeats)
- **Sql:** Fix an issue with connection limits not updating when jsonData is updated. [#83175](https://github.com/grafana/grafana/issues/83175), [@jarben](https://github.com/jarben)
- **Alerting:** Use time_intervals instead of the deprecated mute_time_intervals in a…. [#83147](https://github.com/grafana/grafana/issues/83147), [@soniaAguilarPeiron](https://github.com/soniaAguilarPeiron)
- **DataFrame:** Improve typing of arrayToDataFrame helper and fix null/undefined handling. [#83104](https://github.com/grafana/grafana/issues/83104), [@aocenas](https://github.com/aocenas)
- **Cloudwatch:** Fix filter button issue in VariableEditor. [#83082](https://github.com/grafana/grafana/issues/83082), [@wilguo](https://github.com/wilguo)
- **Alerting:** Fix panic in provisioning filter contacts by unknown name. [#83070](https://github.com/grafana/grafana/issues/83070), [@JacobsonMT](https://github.com/JacobsonMT)
- **Search:** Include collapsed panels in search v2. [#83047](https://github.com/grafana/grafana/issues/83047), [@suntala](https://github.com/suntala)
- **Plugins:** Fix loading modules that only export a default. [#82299](https://github.com/grafana/grafana/issues/82299), [@sd2k](https://github.com/sd2k)
- **Table:** Fix units showing in footer after reductions without units. [#82081](https://github.com/grafana/grafana/issues/82081), [@codeincarnate](https://github.com/codeincarnate)
- **AuthProxy:** Invalidate previous cached item for user when changes are made to any header. [#81445](https://github.com/grafana/grafana/issues/81445), [@klesh](https://github.com/klesh)
- **Unit:** Add SI prefix for empty unit. [#79897](https://github.com/grafana/grafana/issues/79897), [@raymalt](https://github.com/raymalt)
- **Variables:** Multi-select DataSource variables are inconsistently displayed in the Data source picker. [#76039](https://github.com/grafana/grafana/issues/76039), [@polibb](https://github.com/polibb)
- **SAML:** Better error message for saml private key type errors. (Enterprise)
- **Reporting:** Fix monthly schedule text and modify monthly schedule inputs behavior. (Enterprise)

### Breaking changes

In 9.3 we released a way to set `case_insensitive_login` to true. This enables, lowercased username, login for users signing up with Grafana, for more information read our [blog post](https://grafana.com/blog/2022/12/12/guide-to-using-the-new-grafana-cli-user-identity-conflict-tool-in-grafana-9.3/).

If you encounter any issues with users signing up, we recommend everyone to use lowercase in their login, username otherwise refer to the blog post for how to solve any of the users that can be conflicting with their login/username. Issue [#84972](https://github.com/grafana/grafana/issues/84972)

This is a breaking change for users who use uppercase in their login or emails. The users are by default now using lowercase as part of their login and emails.

Before this code change, users would be able to still log in as either `aUser@user.com` or `auser@user.com`, users are now only able to login and signup with grafana using lowercasing `auser@user.com`.

We recommend reviewing the [blog post](https://grafana.com/blog/2022/12/12/guide-to-using-the-new-grafana-cli-user-identity-conflict-tool-in-grafana-9.3/#:~:text=A%20user%20identity%20conflict%20occurs,more%20capitalized%20letters%20%E2%80%9Cgrafana_LOGIN%E2%80%9D.) about using the CLI and why this is important for us to consolidate our security efforts. Issue [#84840](https://github.com/grafana/grafana/issues/84840)

This is a breaking change for users who have restricted the default access to annotation permissions by removing annotation related actions from the Viewer or Editor basic roles. In such cases we are not able to complete the permission migration automatically, and you will see the following log in your Grafana server logs: `basic role permissions missing annotation permissions, skipping annotation permission migration`. You will also notice that dashboard and folder permissions do not appear in the user interface. Don't worry, all the permissions that you assigned are still there, they are just not being displayed.

We recommend reviewing what annotation permissions you have revoked from the basic roles (you can reference [our documentation](https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/access-control/rbac-fixed-basic-role-definitions/) to see what permissions are missing). If you are fine granting them back to the basic roles, do that, then run the following data base command: `DELETE FROM migration_log WHERE migration_id="managed dashboard permissions annotation actions migration"` and restart Grafana. This will make sure that the annotation permission migration gets run again, and this time it should succeed.

If you are not willing to grant the annotation permissions back to the basic roles, please disable `annotationPermissionUpdate` feature toggle (add `annotationPermissionUpdate = false` to `[feature_toggles]` in Grafana's configuration file) and reach out to Grafana's support team. When we can learn more about your use case, we will work with you to find a solution. Issue [#84787](https://github.com/grafana/grafana/issues/84787)

Angular support is turned `off` by default starting Grafana 11, you can find all the details in a [dedicated documentation page.](https://grafana.com/docs/grafana/latest/developers/angular_deprecation/)

Issue [#84738](https://github.com/grafana/grafana/issues/84738)

The **xpack** checkbox dependency for enabling the **Include Frozen Indices** functionality has been removed, allowing direct control over frozen indices inclusion. Users should review their datasource settings to ensure the "Include Frozen Indices" option is configured as desired, particularly if xpack was previously disabled. This change aims to simplify configuration options and may affect queries if settings are not adjusted accordingly. Issue [#84734](https://github.com/grafana/grafana/issues/84734)

For data sources that extend `DataSourceWithBackend`, the `filterQuery` method is now called **before** the data source `query` method. If the `filterQuery` method assumes that some kind of query migration happens before this method is called, you now need to do the migration inside this method.

Users of data source plugins that did not previously remove hidden queries will see a change of behaviour: Before this change, clicking the `Disable query` button had no impact on the query result, but starting from Grafana 11 responses associated with hidden queries will no longer be returned to the panel. Issue [#84656](https://github.com/grafana/grafana/issues/84656)

SystemJS is no longer exported from `@grafana/runtime`. Plugin developers should instead rely on importing modules / packages using standard TS import syntax and npm/yarn for package installation.

Issue [#84561](https://github.com/grafana/grafana/issues/84561)

We've removed the Loki tab from the Tempo data source. You can still access Logs through the Loki data source or can also create a link from Tempo to Loki via our [trace to logs](https://grafana.com/docs/grafana/latest/datasources/tempo/configure-tempo-data-source/#trace-to-logs) feature. Issue [#84346](https://github.com/grafana/grafana/issues/84346)

The `query` option in `splitOpen` was deprecated in `10.1` and is now being removed. Issue [#83973](https://github.com/grafana/grafana/issues/83973)

Since <https://github.com/grafana/grafana/pull/38942> (Grafana `8.2.0`) the `ExploreQueryFieldProps` type was deprecated and is now removed. Issue [#83972](https://github.com/grafana/grafana/issues/83972)

Since <https://github.com/grafana/grafana/pull/38942> `exploreId` is no longer supplied to query editors in Explore. The property was deprecated in `10.3.0` and is now removed. If your query editor needs to know from which app is being rendered, you can check the `app` prop in `QueryEditorProps`. Issue [#83971](https://github.com/grafana/grafana/issues/83971)

The Vector interface that was deprecated in Grafana 10 has been further deprecated. Using it will now generate build-time Typescript errors, but remain working at runtime. If you're still using ArrayVector in your code, it should be removed immediately and replaced with plain arrays. Plugins compiled against older versions and depend on calling get/set will continue to work because the Array prototype still has a modified prototype. This will be removed in the future Issue [#83681](https://github.com/grafana/grafana/issues/83681)

In Grafana 11 the legacy alerting reaches the end-of-life. Users cannot enable it and Grafana will refuse to start if the settings are not updated to run the new Grafana Alerting. Migration from legacy alerting is not available as well. Grafana 10.4.x is the last version that offers the migration.

- If the setting `[alerting].enable` is set to `true` Grafana will not start and emit the log message with recommendations to change the configuration

- Setting `[alerting].max_annotation_age` is replaced by `[unified_alerting.state_history.annotations].max_age`
- Setting `[alerting].max_annotations_to_keep` is replaced by `[unified_alerting.state_history.annotations].max_annotations_to_keep`

- setting `[unified_alerting].execute_alerts` does not fall back to the legacy `[alerting].execute_alerts` anymore. Instead, the default value `true` is used.
- setting `[unified_alerting].evaluation_timeout` does not fall back to the legacy setting `[alerting].evaluation_timeout_seconds` in the case when it is either invalid or has the default value. Now, if the setting is invalid, it will cause Grafana to exit.
- setting `[unified_alerting].min_interval` does not fall back to the legacy setting `[alerting].min_interval_seconds` in the case when it is either invalid or has the default value. Now, if the setting is invalid, it will cause Grafana to exit. Issue [#83651](https://github.com/grafana/grafana/issues/83651)

We've removed React 17 as a peer dependency from our packages. Anyone using the new versions of these packages should ensure they've upgraded to React 18 following the upgrade steps: <https://react.dev/blog/2022/03/08/react-18-upgrade-guide> Issue [#83524](https://github.com/grafana/grafana/issues/83524)

We're adding a validation between the response of the ID token HD parameter and the list of allowed domains as an extra layer of security. In the event that the HD parameter doesn't match the list of allowed domains, we're denying access to Grafana.

If you set Google OAuth configuration using `api_url,` you might be using the legacy implementation of OAuth, which doesn't have the HD parameter describing the organisation the approved token comes from. This could break your login flow.

This feature can be turned off through the configuration toggle `validate_hd`. Anyone using the legacy Google OAuth configuration should turn off this validation if the ID Token response doesn't have the HD parameter. Issue [#83229](https://github.com/grafana/grafana/issues/83229)

The direct input datasource plugin has been removed in Grafana 11. It has been in alpha for 4 years and is superseded by [TestData](https://grafana.com/docs/grafana/latest/datasources/testdata/) that ships with Grafana.

Issue [#83163](https://github.com/grafana/grafana/issues/83163)

The alert rule API methods now require more permissions for users to perform changes to rules. To create a new rule or update or delete an existing one, the user must have permission to read from the folder that stores the rules (i.e. permission `folder:read` in the scope of the rule's folder) and permission to read alert rules in that folder (i.e. permission `alert.rules:read`

The standard roles already have all required permissions, and therefore, neither OSS nor Grafana Enterprise users who use the fixed roles (standard roles provided by Grafana) are affected. **Only Grafana Enterprise users who create custom roles can be affected** Issue [#78289](https://github.com/grafana/grafana/issues/78289)

The deprecated endpoint for rendering pdf of a single dashboard `GET /render/pdf/:dashboardID` and report model fields `dashboardId`, `dashboardName`, `dashboardUid`, and `templateVars` have been removed. Only new endpoint `GET /api/reports/render/pdfs` accepting `dashboards` list is support moving forward Issue [#6362](https://github.com/grafana/grafana/issues/6362)

The deprecated old schedule setting with separate fields `hour,` `minute`, `day` have been removed. Only new schedule setting with `startDate` will be supported moving forward Issue [#6329](https://github.com/grafana/grafana/issues/6329)

The deprecated `email` field to send a report via `/api/reports/email` endpoint have been removed. Only `emails` field will be supported moving forward. Issue [#6328](https://github.com/grafana/grafana/issues/6328)

### Plugin development fixes & changes

- **GrafanaUI:** Add new `EmptyState` component. [#84891](https://github.com/grafana/grafana/issues/84891), [@ashharrison90](https://github.com/ashharrison90)
- **Grafana/Runtime:** Remove SystemJS export. [#84561](https://github.com/grafana/grafana/issues/84561), [@jackw](https://github.com/jackw)
- **Grafana UI:** Add code variant to Text component. [#82318](https://github.com/grafana/grafana/issues/82318), [@tskarhed](https://github.com/tskarhed)

<!-- 11.0.0-preview END -->

<!-- previous CHANGELOG entries can be found in /.changelog-archive >
