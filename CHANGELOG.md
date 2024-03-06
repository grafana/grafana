<!-- 9.5.17 START -->

# 9.5.17 (2024-03-05)

### Features and enhancements

- Bump go-git to v5.11.0. [#83711](https://github.com/grafana/grafana/issues/83711), [@papagian](https://github.com/papagian)
- **Plugins:** Bump otelgrpc instrumentation to 0.47.0. [#83674](https://github.com/grafana/grafana/issues/83674), [@wbrowne](https://github.com/wbrowne)

### Bug fixes

- **Auth:** Fix email verification bypass when using basic authentication. [#83494](https://github.com/grafana/grafana/issues/83494)

<!-- 9.5.17 END -->
<!-- 9.5.16 START -->

# 9.5.16 (2024-01-29)

### Bug fixes

- **Annotations:** Split cleanup into separate queries and deletes to avoid deadlocks on MySQL. [#80682](https://github.com/grafana/grafana/issues/80682), [@alexweav](https://github.com/alexweav)

<!-- 9.5.16 END -->
<!-- 9.5.15 START -->

# 9.5.15 (2023-12-18)

### Features and enhancements

- **Alerting:** Attempt to retry retryable errors. [#79209](https://github.com/grafana/grafana/issues/79209), [@gotjosh](https://github.com/gotjosh)
- **Unified Alerting:** Set to 1 by default. [#79109](https://github.com/grafana/grafana/issues/79109), [@gotjosh](https://github.com/gotjosh)

### Bug fixes

- **Recorded Queries:** Add org isolation (remote write target per org), and fix cross org Delete/List. (Enterprise)

<!-- 9.5.15 END -->
<!-- 9.5.14 START -->

# 9.5.14 (2023-11-13)

### Bug fixes

- **Alerting:** Fix state manager to not keep datasource_uid and ref_id labels in state after Error. [#77391](https://github.com/grafana/grafana/issues/77391), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Transformations:** Config overrides being lost when config from query transform is applied. [#75347](https://github.com/grafana/grafana/issues/75347), [@IbrahimCSAE](https://github.com/IbrahimCSAE)
- **LDAP:** FIX Enable users on successfull login . [#75192](https://github.com/grafana/grafana/issues/75192), [@gamab](https://github.com/gamab)
- **Auditing and UsageInsights:** FIX Loki configuration to use proxy env variables. (Enterprise)

<!-- 9.5.14 END -->
<!-- 9.5.13 START -->

# 9.5.13 (2023-10-11)

### Features and enhancements

- **Chore:** Upgrade Go to 1.20.10. [#76367](https://github.com/grafana/grafana/issues/76367), [@zerok](https://github.com/zerok)
- **Licensing:** Updated grpc plugin factory newPlugin signature. (Enterprise)

### Bug fixes

- **BrowseDashboards:** Only remember the most recent expanded folder. [#74817](https://github.com/grafana/grafana/issues/74817), [@joshhunt](https://github.com/joshhunt)
- **Licensing:** Pass func to update env variables when starting plugin. [#74681](https://github.com/grafana/grafana/issues/74681), [@leandro-deveikis](https://github.com/leandro-deveikis)
- **RBAC:** Chore fix hasPermissionInOrg. (Enterprise)

<!-- 9.5.13 END -->
<!-- 9.5.12 START -->

# 9.5.12 (2023-09-29)

### Features and enhancements

- **Azure:** Add support for Workload Identity authentication. [#75730](https://github.com/grafana/grafana/issues/75730), [@aangelisc](https://github.com/aangelisc)

<!-- 9.5.12 END -->
<!-- 9.5.10 START -->

# 9.5.10 (2023-09-18)

### Features and enhancements

- **Chore:** Upgrade Alpine base image to 3.18.3. [#74995](https://github.com/grafana/grafana/issues/74995), [@zerok](https://github.com/zerok)
- **Chore:** Upgrade Go to 1.20.8. [#74982](https://github.com/grafana/grafana/issues/74982), [@zerok](https://github.com/zerok)

<!-- 9.5.10 END -->
<!-- 9.5.9 START -->

# 9.5.9 (2023-09-05)

### Features and enhancements

- **SSE:** DSNode to update result with names to make each value identifiable by labels (only Graphite and TestData). [#73642](https://github.com/grafana/grafana/issues/73642), [@yuri-tceretian](https://github.com/yuri-tceretian)
- **Prometheus:** Add present_over_time syntax highlighting. [#72367](https://github.com/grafana/grafana/issues/72367), [@arnaudlemaignen](https://github.com/arnaudlemaignen)
- **Alerting:** Improve performance of matching captures. [#71998](https://github.com/grafana/grafana/issues/71998), [@grobinson-grafana](https://github.com/grobinson-grafana)

### Bug fixes

- **LDAP:** Fix user disabling. [#74096](https://github.com/grafana/grafana/issues/74096), [@gamab](https://github.com/gamab)

<!-- 9.5.9 END -->
<!-- 9.5.8 START -->

# 9.5.8 (2023-08-16)

### Features and enhancements

- **GenericOAuth:** Set sub as auth id. [#73223](https://github.com/grafana/grafana/issues/73223), [@kalleep](https://github.com/kalleep)

### Bug fixes

- **DataSourceProxy:** Fix url validation error handling. [#73320](https://github.com/grafana/grafana/issues/73320), [@ricci2511](https://github.com/ricci2511)

<!-- 9.5.8 END -->
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
<!-- 9.4.15 START -->

# 9.4.15 (2023-09-18)

### Features and enhancements

- **Chore:** Upgrade Alpine base image to 3.18.3. [#74996](https://github.com/grafana/grafana/issues/74996), [@zerok](https://github.com/zerok)
- **Chore:** Upgrade Go to 1.20.8. [#74981](https://github.com/grafana/grafana/issues/74981), [@zerok](https://github.com/zerok)

<!-- 9.4.15 END -->
<!-- 9.4.14 START -->

# 9.4.14 (2023-09-05)

### Features and enhancements

- **Prometheus:** Add present_over_time syntax highlighting. [#72366](https://github.com/grafana/grafana/issues/72366), [@arnaudlemaignen](https://github.com/arnaudlemaignen)

### Bug fixes

- **LDAP:** Fix user disabling. [#74318](https://github.com/grafana/grafana/issues/74318), [@gamab](https://github.com/gamab)
- **Plugins:** Only configure plugin proxy transport once. [#71740](https://github.com/grafana/grafana/issues/71740), [@wbrowne](https://github.com/wbrowne)
- **InfluxDB:** Interpolate retention policies. [#71202](https://github.com/grafana/grafana/issues/71202), [@itsmylife](https://github.com/itsmylife)
- **Azure Monitor:** Fix bug that did not show alert rule preview. [#68561](https://github.com/grafana/grafana/issues/68561), [@alyssabull](https://github.com/alyssabull)

<!-- 9.4.14 END -->
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
