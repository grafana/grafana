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
- **Tranformations:** True OUTER JOIN in the join by field transformation used for tabular data . [#72176](https://github.com/grafana/grafana/issues/72176), [@bohandley](https://github.com/bohandley)
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
- **Adminstration:** Feature toggle for feature toggle admin page. [#71887](https://github.com/grafana/grafana/issues/71887), [@IbrahimCSAE](https://github.com/IbrahimCSAE)
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
- **Plugins:** Enable feature toggles for long running queries by deafult. [#70678](https://github.com/grafana/grafana/issues/70678), [@idastambuk](https://github.com/idastambuk)
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
- **Alerting:** Make QueryEditor not collapsable. [#70112](https://github.com/grafana/grafana/issues/70112), [@VikaCep](https://github.com/VikaCep)
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

# 10.0.3 (2023-07-18)

### Features and enhancements

- **Alerting:** Sort NumberCaptureValues in EvaluationString. [#71931](https://github.com/grafana/grafana/issues/71931), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** No longer silence paused alerts during legacy migration. [#71761](https://github.com/grafana/grafana/issues/71761), [@JacobsonMT](https://github.com/JacobsonMT)
- **Auth:** Add support for custom signing keys in auth.azure_ad. [#71708](https://github.com/grafana/grafana/issues/71708), [@Jguer](https://github.com/Jguer)
- **Chore:** Upgrade Go to 1.20.6. [#71445](https://github.com/grafana/grafana/issues/71445), [@sakjur](https://github.com/sakjur)
- **Chore:** Upgrade Go to 1.20.6. (Enterprise)

### Bug fixes

- **Alerting:** Fix edit / view of webhook contact point when no authorization is set. [#71972](https://github.com/grafana/grafana/issues/71972), [@gillesdemey](https://github.com/gillesdemey)
- **AzureMonitor:** Set timespan in Logs Portal URL link. [#71910](https://github.com/grafana/grafana/issues/71910), [@aangelisc](https://github.com/aangelisc)
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

The deprecated `plugin:create` and `component:create` commands in the Grafana Toolkit have been removed in this release. The replacement `create-plugin` tool is recommended for [scaffolding new plugins](https://grafana.github.io/plugin-tools/docs/getting-started/creating-a-plugin) and a migration guide for moving from the toolkit is available [here](https://grafana.github.io/plugin-tools/docs/getting-started/migrating-from-toolkit). Issue [#66729](https://github.com/grafana/grafana/issues/66729)

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
<!-- 9.5.7 START -->

# 9.5.7 (2023-07-20)

### Features and enhancements

- **Alerting:** Sort NumberCaptureValues in EvaluationString. [#71930](https://github.com/grafana/grafana/issues/71930), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Alerting:** No longer silence paused alerts during legacy migration. [#71765](https://github.com/grafana/grafana/issues/71765), [@JacobsonMT](https://github.com/JacobsonMT)
- **Chore:** Upgrade Go to 1.20.6. [#71446](https://github.com/grafana/grafana/issues/71446), [@sakjur](https://github.com/sakjur)
- **Alerting:** Remove and revert flag alertingBigTransactions. [#70910](https://github.com/grafana/grafana/issues/70910), [@santihernandezc](https://github.com/santihernandezc)
- **Alerting:** Migrate unknown NoData\Error settings to the default. [#70905](https://github.com/grafana/grafana/issues/70905), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Tempo:** Escape regex-sensitive characters in span name before building promql query. [#68318](https://github.com/grafana/grafana/issues/68318), [@joey-grafana](https://github.com/joey-grafana)
- **Alerting:** Update grafana/alerting to ce9fba9. [#67685](https://github.com/grafana/grafana/issues/67685), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Chore:** Upgrade Go to 1.20.6. (Enterprise)

### Bug fixes

- **Plugins:** Only configure plugin proxy transport once. [#71741](https://github.com/grafana/grafana/issues/71741), [@wbrowne](https://github.com/wbrowne)
- **Alerting:** Fix unique violation when updating rule group with title chains/cycles. [#71330](https://github.com/grafana/grafana/issues/71330), [@grobinson-grafana](https://github.com/grobinson-grafana)
- **Fix:** Change getExistingDashboardByTitleAndFolder to get dashboard by title, not slug. [#70961](https://github.com/grafana/grafana/issues/70961), [@yangkb09](https://github.com/yangkb09)
- **Alerting:** Convert 'Both' type Prometheus queries to 'Range' in migration. [#70907](https://github.com/grafana/grafana/issues/70907), [@JacobsonMT](https://github.com/JacobsonMT)
- **Alerting:** Support newer http_config struct. [#69718](https://github.com/grafana/grafana/issues/69718), [@gillesdemey](https://github.com/gillesdemey)
- **InfluxDB:** Interpolate retention policies. [#69299](https://github.com/grafana/grafana/issues/69299), [@itsmylife](https://github.com/itsmylife)
- **StatusHistory:** Fix rendering of value-mapped null. [#69107](https://github.com/grafana/grafana/issues/69107), [@leeoniya](https://github.com/leeoniya)
- **Alerting:** Fix provenance guard checks for Alertmanager configuration to not cause panic when compared nested objects. [#69092](https://github.com/grafana/grafana/issues/69092), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **AnonymousAuth:** Fix concurrent read-write crash. [#68802](https://github.com/grafana/grafana/issues/68802), [@Jguer](https://github.com/Jguer)
- **AzureMonitor:** Ensure legacy properties containing template variables are correctly migrated. [#68790](https://github.com/grafana/grafana/issues/68790), [@aangelisc](https://github.com/aangelisc)
- **Explore:** Remove data source onboarding page. [#68643](https://github.com/grafana/grafana/issues/68643), [@harisrozajac](https://github.com/harisrozajac)
- **Dashboard:** Re-align Save form. [#68625](https://github.com/grafana/grafana/issues/68625), [@polibb](https://github.com/polibb)
- **Azure Monitor:** Fix bug that did not show alert rule preview. [#68582](https://github.com/grafana/grafana/issues/68582), [@alyssabull](https://github.com/alyssabull)
- **Histogram:** Respect min/max panel settings for x-axis. [#68244](https://github.com/grafana/grafana/issues/68244), [@leeoniya](https://github.com/leeoniya)
- **Heatmap:** Fix color rendering for value ranges < 1. [#68163](https://github.com/grafana/grafana/issues/68163), [@leeoniya](https://github.com/leeoniya)
- **Heatmap:** Handle unsorted timestamps in calculate mode. [#68150](https://github.com/grafana/grafana/issues/68150), [@leeoniya](https://github.com/leeoniya)
- **Google Cloud Monitor:** Fix mem usage for dropdown. [#67949](https://github.com/grafana/grafana/issues/67949), [@asimpson](https://github.com/asimpson)
- **AzureMonitor:** Fix logs query multi-resource and timespan values. [#67932](https://github.com/grafana/grafana/issues/67932), [@aangelisc](https://github.com/aangelisc)
- **Utils:** Reimplement util.GetRandomString to avoid modulo bias. [#66970](https://github.com/grafana/grafana/issues/66970), [@DanCech](https://github.com/DanCech)
- **License:** Enable FeatureUserLimit for all products. (Enterprise)
- **Auth:** Remove ldap init sync. (Enterprise)

<!-- 9.5.7 END -->
<!-- 9.5.6 START -->

# 9.5.6 (2023-07-11)

### Bug fixes

- **Dashboard:** Fix library panels in collapsed rows not getting updated. [#66640](https://github.com/grafana/grafana/issues/66640), [@VictorColomb](https://github.com/VictorColomb)
- **Auth:** Add and document option for enabling email lookup. [@vtorosyan](https://github.com/vtorosyan)

<!-- 9.5.6 END -->
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
