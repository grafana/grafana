# 5.4.5 (2019-08-29)

- **Security**: Urgent security patch release. Please read more in our [blog](https://grafana.com/blog/2019/08/29/grafana-5.4.5-and-6.3.4-released-with-important-security-fix/)

# 5.4.4 (2019-04-29)

- **Security**: Urgent security patch release. Please read more in our [blog](https://grafana.com/blog/2019/04/29/grafana-5.4.4-and-6.1.6-released-with-important-security-fix/)

# 5.4.3 (2019-01-14)

### Tech

- **Docker**: Build and publish docker images for armv7 and arm64 [#14617](https://github.com/grafana/grafana/pull/14617), thx [@johanneswuerbach](https://github.com/johanneswuerbach)
- **Backend**: Upgrade to golang 1.11.4 [#14580](https://github.com/grafana/grafana/issues/14580)
- **MySQL** only update session in mysql database when required [#14540](https://github.com/grafana/grafana/pull/14540)

### Bug fixes

- **Alerting** Invalid frequency causes division by zero in alert scheduler [#14810](https://github.com/grafana/grafana/issues/14810)
- **Dashboard** Dashboard links do not update when time range changes [#14493](https://github.com/grafana/grafana/issues/14493)
- **Limits** Support more than 1000 data sources per org [#13883](https://github.com/grafana/grafana/issues/13883)
- **Backend** fix signed in user for orgId=0 result should return active org id [#14574](https://github.com/grafana/grafana/pull/14574)
- **Provisioning** Adds orgId to user dto for provisioned dashboards [#14678](https://github.com/grafana/grafana/pull/14678)

# 5.4.2 (2018-12-13)

- **Data Source admin**: Fix for issue creating new data source when same name exists [#14467](https://github.com/grafana/grafana/issues/14467)
- **OAuth**: Fix for oauth auto login setting, can now be set using env variable [#14435](https://github.com/grafana/grafana/issues/14435)
- **Dashboard search**: Fix for searching tags in tags filter dropdown.

# 5.4.1 (2018-12-10)

- **Stackdriver**: Fixes issue with data proxy and Authorization header [#14262](https://github.com/grafana/grafana/issues/14262)
- **Units**: fixedUnit for Flow:l/min and mL/min [#14294](https://github.com/grafana/grafana/issues/14294), thx [@flopp999](https://github.com/flopp999).
- **Logging**: Fix for issue where data proxy logged a secret when debug logging was enabled, now redacted. [#14319](https://github.com/grafana/grafana/issues/14319)
- TSDB**: Fix always take dashboard timezone into consideration when handle custom time ranges**: Add support for alerting on InfluxDB queries that use the cumulative_sum function. [#14314](https://github.com/grafana/grafana/pull/14314), thx [@nitti](https://github.com/nitti)
- **Plugins**: Panel plugins should no receive the panel-initialized event again as usual.
- **Embedded Graphs**: Iframe graph panels should now work as usual. [#14284](https://github.com/grafana/grafana/issues/14284)
- **Postgres**: Improve PostgreSQL Query Editor if using different Schemas, [#14313](https://github.com/grafana/grafana/pull/14313)
- **Quotas**: Fixed for updating org & user quotas. [#14347](https://github.com/grafana/grafana/pull/14347), thx [#moznion](https://github.com/moznion)
- **Cloudwatch**: Add the AWS/SES Cloudwatch metrics of BounceRate and ComplaintRate to auto complete list. [#14401](https://github.com/grafana/grafana/pull/14401), thx [@sglajchEG](https://github.com/sglajchEG)
- **Dashboard Search**: Fixed filtering by tag issues.
- **Graph**: Fixed time region issues, [#14425](https://github.com/grafana/grafana/issues/14425), [#14280](https://github.com/grafana/grafana/issues/14280)
- **Graph**: Fixed issue with series color picker popover being placed outside window.

# 5.4.0 (2018-12-03)

- **Cloudwatch**: Fix invalid time range causes segmentation fault [#14150](https://github.com/grafana/grafana/issues/14150)
- **Cloudwatch**: AWS/CodeBuild metrics and dimensions [#14167](https://github.com/grafana/grafana/issues/14167), thx [@mmcoltman](https://github.com/mmcoltman)
- **MySQL**: Fix `$__timeFrom()` and `$__timeTo()` should respect local time zone [#14228](https://github.com/grafana/grafana/issues/14228)

### 5.4.0-beta1 fixes

- **Graph**: Fix legend always visible even if configured to be hidden [#14144](https://github.com/grafana/grafana/issues/14144)
- **Elasticsearch**: Fix regression when using data source version 6.0+ and alerting [#14175](https://github.com/grafana/grafana/pull/14175)

# 5.4.0-beta1 (2018-11-20)

### New Features

- **Alerting**: Introduce alert debouncing with the `FOR` setting. [#7886](https://github.com/grafana/grafana/issues/7886) & [#6202](https://github.com/grafana/grafana/issues/6202)
- **Alerting**: Option to disable OK alert notifications [#12330](https://github.com/grafana/grafana/issues/12330) & [#6696](https://github.com/grafana/grafana/issues/6696), thx [@davewat](https://github.com/davewat)
- **Postgres/MySQL/MSSQL**: Adds support for configuration of max open/idle connections and connection max lifetime. Also, panels with multiple SQL queries will now be executed concurrently [#11711](https://github.com/grafana/grafana/issues/11711), thx [@connection-reset](https://github.com/connection-reset)
- **MySQL**: Graphical query builder [#13762](https://github.com/grafana/grafana/issues/13762), thx [svenklemm](https://github.com/svenklemm)
- **MySQL**: Support connecting thru Unix socket for MySQL data source [#12342](https://github.com/grafana/grafana/issues/12342), thx [@Yukinoshita-Yukino](https://github.com/Yukinoshita-Yukino)
- **MSSQL**: Add encrypt setting to allow configuration of how data sent between client and server are encrypted [#13629](https://github.com/grafana/grafana/issues/13629), thx [@ramiro](https://github.com/ramiro)
- **Stackdriver**: Not possible to authenticate using GCE metadata server [#13669](https://github.com/grafana/grafana/issues/13669)
- **Teams**: Team preferences (theme, home dashboard, timezone) support [#12550](https://github.com/grafana/grafana/issues/12550)
- **Graph**: Time regions support enabling highlight of weekdays and/or certain timespans [#5930](https://github.com/grafana/grafana/issues/5930)
- **OAuth**: Automatic redirect to sign-in with OAuth [#11893](https://github.com/grafana/grafana/issues/11893), thx [@Nick-Triller](https://github.com/Nick-Triller)
- **Stackdriver**: Template query editor [#13561](https://github.com/grafana/grafana/issues/13561)

### Minor

- **Security**: Upgrade macaron session package to fix security issue. [#14043](https://github.com/grafana/grafana/pull/14043)
- **Cloudwatch**: Show all available CloudWatch regions [#12308](https://github.com/grafana/grafana/issues/12308), thx [@mtanda](https://github.com/mtanda)
- **Cloudwatch**: AWS/Connect metrics and dimensions [#13970](https://github.com/grafana/grafana/pull/13970), thx [@zcoffy](https://github.com/zcoffy)
- **Cloudwatch**: CloudHSM metrics and dimensions [#14129](https://github.com/grafana/grafana/pull/14129), thx [@daktari](https://github.com/daktari)
- **Cloudwatch**: Enable using variables in the stats field [#13810](https://github.com/grafana/grafana/issues/13810), thx [@mtanda](https://github.com/mtanda)
- **Postgres**: Add delta window function to postgres query builder [#13925](https://github.com/grafana/grafana/issues/13925), thx [svenklemm](https://github.com/svenklemm)
- **Elasticsearch**: Fix switching to/from es raw document metric query [#6367](https://github.com/grafana/grafana/issues/6367)
- **Elasticsearch**: Fix deprecation warning about terms aggregation order key in Elasticsearch 6.x [#11977](https://github.com/grafana/grafana/issues/11977)
- **Graph**: Render dots when no connecting line can be made [#13605](https://github.com/grafana/grafana/issues/13605), thx [@jsferrei](https://github.com/jsferrei)
- **Table**: Fix CSS alpha background-color applied twice in table cell with link [#13606](https://github.com/grafana/grafana/issues/13606), thx [@grisme](https://github.com/grisme)
- **Singlestat**: Fix XSS in prefix/postfix [#13946](https://github.com/grafana/grafana/issues/13946), thx [@cinaglia](https://github.com/cinaglia)
- **Units**: New clock time format, to format ms or second values as for example `01h:59m`, [#13635](https://github.com/grafana/grafana/issues/13635), thx [@franciscocpg](https://github.com/franciscocpg)
- **Alerting**: Increase default duration for queries [#13945](https://github.com/grafana/grafana/pull/13945)
- **Alerting**: More options for the Slack Alert notifier [#13993](https://github.com/grafana/grafana/issues/13993), thx [@andreykaipov](https://github.com/andreykaipov)
- **Alerting**: Can't receive DingDing alert when alert is triggered [#13723](https://github.com/grafana/grafana/issues/13723), thx [@Yukinoshita-Yukino](https://github.com/Yukinoshita-Yukino)
- **Alerting**: Increase Telegram captions length limit [#13876](https://github.com/grafana/grafana/pull/13876), thx [@skgsergio](https://github.com/skgsergio)
- **Internal metrics**: Renamed `grafana_info` to `grafana_build_info` and added branch, goversion and revision [#13876](https://github.com/grafana/grafana/pull/13876)
- **Data Source Proxy**: Keep trailing slash for data source proxy requests [#13326](https://github.com/grafana/grafana/pull/13326), thx [@ryantxu](https://github.com/ryantxu)
- **OAuth**: Fix Google OAuth relies on email, not google account id [#13924](https://github.com/grafana/grafana/issues/13924), thx [@vinicyusmacedo](https://github.com/vinicyusmacedo)
- **Dashboard**: Toggle legend using keyboard shortcut [#13655](https://github.com/grafana/grafana/issues/13655), thx [@davewat](https://github.com/davewat)
- **Dashboard**: Fix render dashboard row drag handle only in edit mode [#13555](https://github.com/grafana/grafana/issues/13555), thx [@praveensastry](https://github.com/praveensastry)
- **Teams**: Fix cannot select team if not included in initial search [#13425](https://github.com/grafana/grafana/issues/13425)
- **Render**: Support full height screenshots using phantomjs render script [#13352](https://github.com/grafana/grafana/pull/13352), thx [@amuraru](https://github.com/amuraru)
- **HTTP API**: Support retrieving teams by user [#14120](https://github.com/grafana/grafana/pull/14120), thx [@supercharlesliu](https://github.com/supercharlesliu)
- **Metrics**: Add basic authentication to metrics endpoint [#13577](https://github.com/grafana/grafana/issues/13577), thx [@bobmshannon](https://github.com/bobmshannon)

### Breaking changes

- Postgres/MySQL/MSSQL data sources now per default uses `max open connections` = `unlimited` (earlier 10), `max idle connections` = `2` (earlier 10) and `connection max lifetime` = `4` hours (earlier unlimited).

# 5.3.4 (2018-11-13)

- **Alerting**: Delete alerts when parent folder was deleted [#13322](https://github.com/grafana/grafana/issues/13322)
- **MySQL**: Fix `$__timeFilter()` should respect local time zone [#13769](https://github.com/grafana/grafana/issues/13769)
- **Dashboard**: Fix data source selection in panel by enter key [#13932](https://github.com/grafana/grafana/issues/13932)
- **Graph**: Fix table legend height when positioned below graph and using Internet Explorer 11 [#13903](https://github.com/grafana/grafana/issues/13903)
- **Dataproxy**: Drop origin and referer http headers [#13328](https://github.com/grafana/grafana/issues/13328) [#13949](https://github.com/grafana/grafana/issues/13949), thx [@roidelapluie](https://github.com/roidelapluie)

# 5.3.3 (2018-11-13)

### File Exfiltration vulnerability Security fix

See [security announcement](https://community.grafana.com/t/grafana-5-3-3-and-4-6-5-security-update/11961) for details.

# 5.3.2 (2018-10-24)

- **InfluxDB/Graphite/Postgres**: Prevent cross site scripting (XSS) in query editor [#13667](https://github.com/grafana/grafana/issues/13667), thx [@svenklemm](https://github.com/svenklemm)
- **Postgres**: Fix template variables error [#13692](https://github.com/grafana/grafana/issues/13692), thx [@svenklemm](https://github.com/svenklemm)
- **Cloudwatch**: Fix service panic because of race conditions [#13674](https://github.com/grafana/grafana/issues/13674), thx [@mtanda](https://github.com/mtanda)
- **Cloudwatch**: Fix check for invalid percentile statistics [#13633](https://github.com/grafana/grafana/issues/13633), thx [@apalaniuk](https://github.com/apalaniuk)
- **Stackdriver/Cloudwatch**: Allow user to change unit in graph panel if cloudwatch/stackdriver data source response doesn't include unit [#13718](https://github.com/grafana/grafana/issues/13718), thx [@mtanda](https://github.com/mtanda)
- **Stackdriver**: stackdriver user-metrics duplicated response when multiple resource types [#13691](https://github.com/grafana/grafana/issues/13691)
- **Variables**: Fix text box template variable doesn't work properly without a default value [#13666](https://github.com/grafana/grafana/issues/13666)
- **Variables**: Fix variable dependency check when using `${var}` format [#13600](https://github.com/grafana/grafana/issues/13600)
- **Dashboard**: Fix kiosk=1 url parameter should put dashboard in kiosk mode [#13764](https://github.com/grafana/grafana/pull/13764)
- **LDAP**: Fix super admins can also be admins of orgs [#13710](https://github.com/grafana/grafana/issues/13710), thx [@adrien-f](https://github.com/adrien-f)
- **Provisioning**: Fix deleting provisioned dashboard folder should cleanup provisioning meta data [#13280](https://github.com/grafana/grafana/issues/13280)

### Minor

- **Docker**: adds curl back into the docker image for utility. [#13794](https://github.com/grafana/grafana/pull/13794)

# 5.3.1 (2018-10-16)

- **Render**: Fix PhantomJS render of graph panel when legend displayed as table to the right [#13616](https://github.com/grafana/grafana/issues/13616)
- **Stackdriver**: Filter option disappears after removing initial filter [#13607](https://github.com/grafana/grafana/issues/13607)
- **Elasticsearch**: Fix no limit size in terms aggregation for alerting queries [#13172](https://github.com/grafana/grafana/issues/13172), thx [@Yukinoshita-Yukino](https://github.com/Yukinoshita-Yukino)
- **InfluxDB**: Fix for annotation issue that caused text to be shown twice [#13553](https://github.com/grafana/grafana/issues/13553)
- **Variables**: Fix nesting variables leads to exception and missing refresh [#13628](https://github.com/grafana/grafana/issues/13628)
- **Variables**: Prometheus: Single letter labels are not supported [#13641](https://github.com/grafana/grafana/issues/13641), thx [@olshansky](https://github.com/olshansky)
- **Graph**: Fix graph time formatting for Last 24h ranges [#13650](https://github.com/grafana/grafana/issues/13650)
- **Playlist**: Fix cannot add dashboards with long names to playlist [#13464](https://github.com/grafana/grafana/issues/13464), thx [@neufeldtech](https://github.com/neufeldtech)
- **HTTP API**: Fix /api/org/users so that query and limit querystrings works

# 5.3.0 (2018-10-10)

- **Stackdriver**: Filter wildcards and regex matching are not yet supported [#13495](https://github.com/grafana/grafana/issues/13495)
- **Stackdriver**: Support the distribution metric type for heatmaps [#13559](https://github.com/grafana/grafana/issues/13559)
- **Cloudwatch**: Automatically set graph yaxis unit [#13575](https://github.com/grafana/grafana/issues/13575), thx [@mtanda](https://github.com/mtanda)

# 5.3.0-beta3 (2018-10-03)

- **Stackdriver**: Fix for missing ngInject [#13511](https://github.com/grafana/grafana/pull/13511)
- **Permissions**: Fix for broken permissions selector [#13507](https://github.com/grafana/grafana/issues/13507)
- **Alerting**: Alert reminders deduping not working as expected when running multiple Grafana instances [#13492](https://github.com/grafana/grafana/issues/13492)

# 5.3.0-beta2 (2018-10-01)

### New Features

- **Annotations**: Enable template variables in tagged annotations queries [#9735](https://github.com/grafana/grafana/issues/9735)
- **Stackdriver**: Support for Google Stackdriver data source [#13289](https://github.com/grafana/grafana/pull/13289)

### Minor

- **Provisioning**: Dashboard Provisioning now support symlinks that changes target [#12534](https://github.com/grafana/grafana/issues/12534), thx [@auhlig](https://github.com/auhlig)
- **OAuth**: Allow oauth email attribute name to be configurable [#12986](https://github.com/grafana/grafana/issues/12986), thx [@bobmshannon](https://github.com/bobmshannon)
- **Tags**: Default sort order for GetDashboardTags [#11681](https://github.com/grafana/grafana/pull/11681), thx [@Jonnymcc](https://github.com/Jonnymcc)
- **Prometheus**: Label completion queries respect dashboard time range [#12251](https://github.com/grafana/grafana/pull/12251), thx [@mtanda](https://github.com/mtanda)
- **Prometheus**: Allow to display annotations based on Prometheus series value [#10159](https://github.com/grafana/grafana/issues/10159), thx [@mtanda](https://github.com/mtanda)
- **Prometheus**: Adhoc-filtering for Prometheus dashboards [#13212](https://github.com/grafana/grafana/issues/13212)
- **Singlestat**: Fix gauge display accuracy for percents [#13270](https://github.com/grafana/grafana/issues/13270), thx [@tianon](https://github.com/tianon)
- **Dashboard**: Prevent auto refresh from starting when loading dashboard with absolute time range [#12030](https://github.com/grafana/grafana/issues/12030)
- **Templating**: New templating variable type `Text box` that allows free text input [#3173](https://github.com/grafana/grafana/issues/3173)
- **Alerting**: Link to view full size image in Microsoft Teams alert notifier [#13121](https://github.com/grafana/grafana/issues/13121), thx [@holiiveira](https://github.com/holiiveira)
- **Alerting**: Fixes a bug where all alerts would send reminders after upgrade & restart [#13402](https://github.com/grafana/grafana/pull/13402)
- **Alerting**: Concurrent render limit for graphs used in notifications [#13401](https://github.com/grafana/grafana/pull/13401)
- **Postgres/MySQL/MSSQL**: Add support for replacing $\_\_interval and $\_\_interval_ms in alert queries [#11555](https://github.com/grafana/grafana/issues/11555), thx [@svenklemm](https://github.com/svenklemm)

# 5.3.0-beta1 (2018-09-06)

### New Major Features

- **Alerting**: Notification reminders [#7330](https://github.com/grafana/grafana/issues/7330), thx [@jbaublitz](https://github.com/jbaublitz)
- **Dashboard**: TV & Kiosk mode changes, new cycle view mode button in dashboard toolbar [#13025](https://github.com/grafana/grafana/pull/13025)
- **OAuth**: Gitlab OAuth with support for filter by groups [#5623](https://github.com/grafana/grafana/issues/5623), thx [@BenoitKnecht](https://github.com/BenoitKnecht)
- **Postgres**: Graphical query builder [#10095](https://github.com/grafana/grafana/issues/10095), thx [svenklemm](https://github.com/svenklemm)

### New Features

- **LDAP**: Define Grafana Admin permission in ldap group mappings [#2469](https://github.com/grafana/grafana/issues/2496), PR [#12622](https://github.com/grafana/grafana/issues/12622)
- **LDAP**: Client certificates support [#12805](https://github.com/grafana/grafana/issues/12805), thx [@nyxi](https://github.com/nyxi)
- **Profile**: List teams that the user is member of in current/active organization [#12476](https://github.com/grafana/grafana/issues/12476)
- **Configuration**: Allow auto-assigning users to specific organization (other than Main. Org) [#1823](https://github.com/grafana/grafana/issues/1823) [#12801](https://github.com/grafana/grafana/issues/12801), thx [@gzzo](https://github.com/gzzo) and [@ofosos](https://github.com/ofosos)
- **Dataproxy**: Pass configured/auth headers to a data source [#10971](https://github.com/grafana/grafana/issues/10971), thx [@mrsiano](https://github.com/mrsiano)
- **CloudWatch**: GetMetricData support [#11487](https://github.com/grafana/grafana/issues/11487), thx [@mtanda](https://github.com/mtanda)
- **Postgres**: TimescaleDB support, e.g. use `time_bucket` for grouping by time when option enabled [#12680](https://github.com/grafana/grafana/pull/12680), thx [svenklemm](https://github.com/svenklemm)
- **Cleanup**: Make temp file time to live configurable [#11607](https://github.com/grafana/grafana/issues/11607), thx [@xapon](https://github.com/xapon)

### Minor

- **Alerting**: Its now possible to configure the default value for how to handle errors and no data in alerting. [#10424](https://github.com/grafana/grafana/issues/10424)
- **Alerting**: Fix diff and percent_diff reducers [#11563](https://github.com/grafana/grafana/issues/11563), thx [@jessetane](https://github.com/jessetane)
- **Alerting**: Fix rendering timeout which could cause notifications to not be sent due to rendering timing out [#12151](https://github.com/grafana/grafana/issues/12151)
- **Docker**: Make it possible to set a specific plugin url [#12861](https://github.com/grafana/grafana/pull/12861), thx [ClementGautier](https://github.com/ClementGautier)
- **GrafanaCli**: Fixed issue with grafana-cli install plugin resulting in corrupt http response from source error. Fixes [#13079](https://github.com/grafana/grafana/issues/13079)
- **Provisioning**: Should allow one default data source per organization [#12229](https://github.com/grafana/grafana/issues/12229)
- **GitHub OAuth**: Allow changes of user info at GitHub to be synched to Grafana when signing in [#11818](https://github.com/grafana/grafana/issues/11818), thx [@rwaweber](https://github.com/rwaweber)
- **OAuth**: Fix overriding tls_skip_verify_insecure using environment variable [#12747](https://github.com/grafana/grafana/issues/12747), thx [@jangaraj](https://github.com/jangaraj)
- **Prometheus**: Fix graph panel bar width issue in aligned prometheus queries [#12379](https://github.com/grafana/grafana/issues/12379)
- **Prometheus**: Heatmap - fix unhandled error when some points are missing [#12484](https://github.com/grafana/grafana/issues/12484)
- **Prometheus**: Add $**interval, $**interval_ms, \$**range, $**range_s & $\_\_range_ms support for dashboard and template queries [#12597](https://github.com/grafana/grafana/issues/12597) [#12882](https://github.com/grafana/grafana/issues/12882), thx [@roidelapluie](https://github.com/roidelapluie)
- **Elasticsearch**: For alerting/backend, support having index name to the right of pattern in index pattern [#12731](https://github.com/grafana/grafana/issues/12731)
- **Graphite**: Fix for quoting of int function parameters (when using variables) [#11927](https://github.com/grafana/grafana/pull/11927)
- **InfluxDB**: Support timeFilter in query templating for InfluxDB [#12598](https://github.com/grafana/grafana/pull/12598), thx [kichristensen](https://github.com/kichristensen)
- **Postgres/MySQL/MSSQL**: New $\_\_unixEpochGroup and $\_\_unixEpochGroupAlias macros [#12892](https://github.com/grafana/grafana/issues/12892), thx [@svenklemm](https://github.com/svenklemm)
- **Postgres/MySQL/MSSQL**: Add previous fill mode to \$\_\_timeGroup macro which will fill in previously seen value when point is missing [#12756](https://github.com/grafana/grafana/issues/12756), thx [@svenklemm](https://github.com/svenklemm)
- **Postgres/MySQL/MSSQL**: Use floor rounding in \$\_\_timeGroup macro function [#12460](https://github.com/grafana/grafana/issues/12460), thx [@svenklemm](https://github.com/svenklemm)
- **Postgres/MySQL/MSSQL**: Use metric column as prefix when returning multiple value columns [#12727](https://github.com/grafana/grafana/issues/12727), thx [@svenklemm](https://github.com/svenklemm)
- **Postgres/MySQL/MSSQL**: New $\_\_timeGroupAlias macro. Postgres $\_\_timeGroup no longer automatically adds time column alias [#12749](https://github.com/grafana/grafana/issues/12749), thx [@svenklemm](https://github.com/svenklemm)
- **Postgres/MySQL/MSSQL**: Escape single quotes in variables [#12785](https://github.com/grafana/grafana/issues/12785), thx [@eMerzh](https://github.com/eMerzh)
- **Postgres/MySQL/MSSQL**: Min time interval support [#13157](https://github.com/grafana/grafana/issues/13157), thx [@svenklemm](https://github.com/svenklemm)
- **MySQL/MSSQL**: Use datetime format instead of epoch for $\_\_timeFilter, $**timeFrom and \$**timeTo macros [#11618](https://github.com/grafana/grafana/issues/11618) [#11619](https://github.com/grafana/grafana/issues/11619), thx [@AustinWinstanley](https://github.com/AustinWinstanley)
- **Postgres**: Escape ssl mode parameter in connectionstring [#12644](https://github.com/grafana/grafana/issues/12644), thx [@yogyrahmawan](https://github.com/yogyrahmawan)
- **Cloudwatch**: Improved error handling [#12489](https://github.com/grafana/grafana/issues/12489), thx [@mtanda](https://github.com/mtanda)
- **Cloudwatch**: AppSync metrics and dimensions [#12300](https://github.com/grafana/grafana/issues/12300), thx [@franciscocpg](https://github.com/franciscocpg)
- **Cloudwatch**: Direct Connect metrics and dimensions [#12762](https://github.com/grafana/grafana/pulls/12762), thx [@mindriot88](https://github.com/mindriot88)
- **Cloudwatch**: Added BurstBalance metric to list of AWS RDS metrics [#12561](https://github.com/grafana/grafana/pulls/12561), thx [@activeshadow](https://github.com/activeshadow)
- **Cloudwatch**: Add new Redshift metrics and dimensions [#12063](https://github.com/grafana/grafana/pulls/12063), thx [@A21z](https://github.com/A21z)
- **Dashboard**: Fix selecting current dashboard from search should not reload dashboard [#12248](https://github.com/grafana/grafana/issues/12248)
- **Dashboard**: Use uid when linking to dashboards internally in a dashboard [#10705](https://github.com/grafana/grafana/issues/10705)
- **Graph**: Option to hide series from tooltip [#3341](https://github.com/grafana/grafana/issues/3341), thx [@mtanda](https://github.com/mtanda)
- **Singlestat**: Make colorization of prefix and postfix optional in singlestat [#11892](https://github.com/grafana/grafana/pull/11892), thx [@ApsOps](https://github.com/ApsOps)
- **Table**: Adjust header contrast for the light theme [#12668](https://github.com/grafana/grafana/issues/12668)
- **Table**: Fix link color when using light theme and thresholds in use [#12766](https://github.com/grafana/grafana/issues/12766)
- **Table**: Fix for useless horizontal scrollbar for table panel [#9964](https://github.com/grafana/grafana/issues/9964)
- **Table**: Make table sorting stable when null values exist [#12362](https://github.com/grafana/grafana/pull/12362), thx [@bz2](https://github.com/bz2)
- **Heatmap**: Fix broken tooltip and crosshair on Firefox [#12486](https://github.com/grafana/grafana/issues/12486)
- **Data Source**: Fix UI issue with secret fields after updating data source [#11270](https://github.com/grafana/grafana/issues/11270)
- **Variables**: Skip unneeded extra query request when de-selecting variable values used for repeated panels [#8186](https://github.com/grafana/grafana/issues/8186), thx [@mtanda](https://github.com/mtanda)
- **Variables**: Limit amount of queries executed when updating variable that other variable(s) are dependent on [#11890](https://github.com/grafana/grafana/issues/11890)
- **Variables**: Support query variable refresh when another variable referenced in `Regex` field change its value [#12952](https://github.com/grafana/grafana/issues/12952), thx [@franciscocpg](https://github.com/franciscocpg)
- **Variables**: Support variables in query variable `Custom all value` field [#12965](https://github.com/grafana/grafana/issues/12965), thx [@franciscocpg](https://github.com/franciscocpg)
- **Units**: Change units to include characters for power of 2 and 3 [#12744](https://github.com/grafana/grafana/pull/12744), thx [@Worty](https://github.com/Worty)
- **Units**: Polish złoty currency [#12691](https://github.com/grafana/grafana/pull/12691), thx [@mwegrzynek](https://github.com/mwegrzynek)
- **Units**: Adds bitcoin axes unit. [#13125](https://github.com/grafana/grafana/pull/13125)
- **Api**: Delete nonexistent data source should return 404 [#12313](https://github.com/grafana/grafana/issues/12313), thx [@AustinWinstanley](https://github.com/AustinWinstanley)
- **Logging**: Reopen log files after receiving a SIGHUP signal [#13112](https://github.com/grafana/grafana/pull/13112), thx [@filewalkwithme](https://github.com/filewalkwithme)
- **Login**: Show loading animation while waiting for authentication response on login [#12865](https://github.com/grafana/grafana/issues/12865)
- **UI**: Fix iOS home screen "app" icon and Windows 10 app experience [#12752](https://github.com/grafana/grafana/issues/12752), thx [@andig](https://github.com/andig)
- **Plugins**: Convert URL-like text to links in plugins readme [#12843](https://github.com/grafana/grafana/pull/12843), thx [pgiraud](https://github.com/pgiraud)

### Breaking changes

- Postgres data source no longer automatically adds time column alias when using the \$\_\_timeGroup alias. However, there's code in place which should make this change backward compatible and shouldn't create any issues.
- Kiosk mode now also hides submenu (variables)
- ?inactive url parameter no longer supported, replaced with kiosk=tv url parameter

### New experimental features

These are new features that's still being worked on and are in an experimental phase. We encourage users to try these out and provide any feedback in related issue.

- **Dashboard**: Auto fit dashboard panels to optimize space used for current TV / Monitor [#12768](https://github.com/grafana/grafana/issues/12768)

### Tech

- **Frontend**: Convert all Frontend Karma tests to Jest tests [#12224](https://github.com/grafana/grafana/issues/12224)
- **Backend**: Upgrade to golang 1.11 [#13030](https://github.com/grafana/grafana/issues/13030)

# 5.2.4 (2018-09-07)

- **GrafanaCli**: Fixed issue with grafana-cli install plugin resulting in corrupt http response from source error. Fixes [#13079](https://github.com/grafana/grafana/issues/13079)

# 5.2.3 (2018-08-29)

### Important fix for LDAP & OAuth login vulnerability

See [security announcement](https://community.grafana.com/t/grafana-5-2-3-and-4-6-4-security-update/10050) for details.

# 5.2.2 (2018-07-25)

### Minor

- **Prometheus**: Fix graph panel bar width issue in aligned prometheus queries [#12379](https://github.com/grafana/grafana/issues/12379)
- **Dashboard**: Dashboard links not updated when changing variables [#12506](https://github.com/grafana/grafana/issues/12506)
- **Postgres/MySQL/MSSQL**: Fix connection leak [#12636](https://github.com/grafana/grafana/issues/12636) [#9827](https://github.com/grafana/grafana/issues/9827)
- **Plugins**: Fix loading of external plugins [#12551](https://github.com/grafana/grafana/issues/12551)
- **Dashboard**: Remove unwanted scrollbars in embedded panels [#12589](https://github.com/grafana/grafana/issues/12589)
- **Prometheus**: Prevent error using \$\_\_interval_ms in query [#12533](https://github.com/grafana/grafana/pull/12533), thx [@mtanda](https://github.com/mtanda)

# 5.2.1 (2018-06-29)

### Minor

- **Auth Proxy**: Important security fix for whitelist of IP address feature [#12444](https://github.com/grafana/grafana/pull/12444)
- **UI**: Fix - Grafana footer overlapping page [#12430](https://github.com/grafana/grafana/issues/12430)
- **Logging**: Errors should be reported before crashing [#12438](https://github.com/grafana/grafana/issues/12438)

# 5.2.0-stable (2018-06-27)

### Minor

- **Plugins**: Handle errors correctly when loading data source plugin [#12383](https://github.com/grafana/grafana/pull/12383) thx [@rozetko](https://github.com/rozetko)
- **Render**: Enhance error message if phantomjs executable is not found [#11868](https://github.com/grafana/grafana/issues/11868)
- **Dashboard**: Set correct text in drop down when variable is present in url [#11968](https://github.com/grafana/grafana/issues/11968)

### 5.2.0-beta3 fixes

- **LDAP**: Handle "dn" ldap attribute more gracefully [#12385](https://github.com/grafana/grafana/pull/12385), reverts [#10970](https://github.com/grafana/grafana/pull/10970)

# 5.2.0-beta3 (2018-06-21)

### Minor

- **Build**: All rpm packages should be signed [#12359](https://github.com/grafana/grafana/issues/12359)

# 5.2.0-beta2 (2018-06-20)

### New Features

- **Dashboard**: Import dashboard to folder [#10796](https://github.com/grafana/grafana/issues/10796)

### Minor

- **Permissions**: Important security fix for API keys with viewer role [#12343](https://github.com/grafana/grafana/issues/12343)
- **Dashboard**: Fix so panel titles doesn't wrap [#11074](https://github.com/grafana/grafana/issues/11074)
- **Dashboard**: Prevent double-click when saving dashboard [#11963](https://github.com/grafana/grafana/issues/11963)
- **Dashboard**: AutoFocus the add-panel search filter [#12189](https://github.com/grafana/grafana/pull/12189) thx [@ryantxu](https://github.com/ryantxu)
- **Units**: W/m2 (energy), l/h (flow) and kPa (pressure) [#11233](https://github.com/grafana/grafana/pull/11233), thx [@flopp999](https://github.com/flopp999)
- **Units**: Liter/min (flow) and milliLiter/min (flow) [#12282](https://github.com/grafana/grafana/pull/12282), thx [@flopp999](https://github.com/flopp999)
- **Alerting**: Fix mobile notifications for Microsoft Teams alert notifier [#11484](https://github.com/grafana/grafana/pull/11484), thx [@manacker](https://github.com/manacker)
- **Influxdb**: Add support for mode function [#12286](https://github.com/grafana/grafana/issues/12286)
- **Cloudwatch**: Fixes panic caused by bad timerange settings [#12199](https://github.com/grafana/grafana/issues/12199)
- **Auth Proxy**: Whitelist proxy IP address instead of client IP address [#10707](https://github.com/grafana/grafana/issues/10707)
- **User Management**: Make sure that a user always has a current org assigned [#11076](https://github.com/grafana/grafana/issues/11076)
- **Snapshots**: Fix: annotations not properly extracted leading to incorrect rendering of annotations [#12278](https://github.com/grafana/grafana/issues/12278)
- **LDAP**: Allow use of DN in group_search_filter_user_attribute and member_of [#3132](https://github.com/grafana/grafana/issues/3132), thx [@mmolnar](https://github.com/mmolnar)
- **Graph**: Fix legend decimals precision calculation [#11792](https://github.com/grafana/grafana/issues/11792)
- **Dashboard**: Make sure to process panels in collapsed rows when exporting dashboard [#12256](https://github.com/grafana/grafana/issues/12256)

### 5.2.0-beta1 fixes

- **Dashboard**: Dashboard link doesn't work when "As dropdown" option is checked [#12315](https://github.com/grafana/grafana/issues/12315)
- **Dashboard**: Fix regressions after save modal changes, including adhoc template issues [#12240](https://github.com/grafana/grafana/issues/12240)
- **Docker**: Config keys ending with \_FILE are not respected [#170](https://github.com/grafana/grafana-docker/issues/170)

# 5.2.0-beta1 (2018-06-05)

### New Features

- **Elasticsearch**: Alerting support [#5893](https://github.com/grafana/grafana/issues/5893), thx [@WPH95](https://github.com/WPH95)
- **Build**: Crosscompile and packages Grafana on arm, windows, linux and darwin [#11920](https://github.com/grafana/grafana/pull/11920), thx [@fg2it](https://github.com/fg2it)
- **Login**: Change admin password after first login [#11882](https://github.com/grafana/grafana/issues/11882)
- **Alert list panel**: Updated to support filtering alerts by name, dashboard title, folder, tags [#11500](https://github.com/grafana/grafana/issues/11500), [#8168](https://github.com/grafana/grafana/issues/8168), [#6541](https://github.com/grafana/grafana/issues/6541)

### Minor

- **Dashboard**: Modified time range and variables are now not saved by default [#10748](https://github.com/grafana/grafana/issues/10748), [#8805](https://github.com/grafana/grafana/issues/8805)
- **Graph**: Show invisible highest value bucket in histogram [#11498](https://github.com/grafana/grafana/issues/11498)
- **Dashboard**: Enable "Save As..." if user has edit permission [#11625](https://github.com/grafana/grafana/issues/11625)
- **Prometheus**: Query dates are now step-aligned [#10434](https://github.com/grafana/grafana/pull/10434)
- **Prometheus**: Table columns order now changes when rearrange queries [#11690](https://github.com/grafana/grafana/issues/11690), thx [@mtanda](https://github.com/mtanda)
- **Variables**: Fix variable interpolation when using multiple formatting types [#11800](https://github.com/grafana/grafana/issues/11800), thx [@svenklemm](https://github.com/svenklemm)
- **Dashboard**: Fix date selector styling for dark/light theme in time picker control [#11616](https://github.com/grafana/grafana/issues/11616)
- **Discord**: Alert notification channel type for Discord, [#7964](https://github.com/grafana/grafana/issues/7964) thx [@jereksel](https://github.com/jereksel),
- **InfluxDB**: Support SELECT queries in templating query, [#5013](https://github.com/grafana/grafana/issues/5013)
- **InfluxDB**: Support count distinct aggregation [#11645](https://github.com/grafana/grafana/issues/11645), thx [@kichristensen](https://github.com/kichristensen)
- **Dashboard**: JSON Model under dashboard settings can now be updated & changes saved, [#1429](https://github.com/grafana/grafana/issues/1429), thx [@jereksel](https://github.com/jereksel)
- **Security**: Fix XSS vulnerabilities in dashboard links [#11813](https://github.com/grafana/grafana/pull/11813)
- **Singlestat**: Fix "time of last point" shows local time when dashboard timezone set to UTC [#10338](https://github.com/grafana/grafana/issues/10338)
- **Prometheus**: Add support for passing timeout parameter to Prometheus [#11788](https://github.com/grafana/grafana/pull/11788), thx [@mtanda](https://github.com/mtanda)
- **Login**: Add optional option sign out url for generic oauth [#9847](https://github.com/grafana/grafana/issues/9847), thx [@roidelapluie](https://github.com/roidelapluie)
- **Login**: Use proxy server from environment variable if available [#9703](https://github.com/grafana/grafana/issues/9703), thx [@iyeonok](https://github.com/iyeonok)
- **Invite users**: Friendlier error message when smtp is not configured [#12087](https://github.com/grafana/grafana/issues/12087), thx [@thurt](https://github.com/thurt)
- **Graphite**: Don't send distributed tracing headers when using direct/browser access mode [#11494](https://github.com/grafana/grafana/issues/11494)
- **Sidenav**: Show create dashboard link for viewers if at least editor in one folder [#11858](https://github.com/grafana/grafana/issues/11858)
- **SQL**: Second epochs are now correctly converted to ms. [#12085](https://github.com/grafana/grafana/pull/12085)
- **Singlestat**: Fix singlestat threshold tooltip [#11971](https://github.com/grafana/grafana/issues/11971)
- **Dashboard**: Hide grid controls in fullscreen/low-activity views [#11771](https://github.com/grafana/grafana/issues/11771)
- **Dashboard**: Validate uid when importing dashboards [#11515](https://github.com/grafana/grafana/issues/11515)
- **Docker**: Support for env variables ending with \_FILE [grafana-docker #166](https://github.com/grafana/grafana-docker/pull/166), thx [@efrecon](https://github.com/efrecon)
- **Alert list panel**: Show alerts for user with viewer role [#11167](https://github.com/grafana/grafana/issues/11167)
- **Provisioning**: Verify checksum of dashboards before updating to reduce load on database [#11670](https://github.com/grafana/grafana/issues/11670)
- **Provisioning**: Support symlinked files in dashboard provisioning config files [#11958](https://github.com/grafana/grafana/issues/11958)
- **Dashboard list panel**: Search dashboards by folder [#11525](https://github.com/grafana/grafana/issues/11525)
- **Sidenav**: Always show server admin link in sidenav if grafana admin [#11657](https://github.com/grafana/grafana/issues/11657)

# 5.1.5 (2018-06-27)

- **Docker**: Config keys ending with \_FILE are not respected [#170](https://github.com/grafana/grafana-docker/issues/170)

# 5.1.4 (2018-06-19)

- **Permissions**: Important security fix for API keys with viewer role [#12343](https://github.com/grafana/grafana/issues/12343)

# 5.1.3 (2018-05-16)

- **Scroll**: Graph panel / legend texts shifts on the left each time we move scrollbar on firefox [#11830](https://github.com/grafana/grafana/issues/11830)

# 5.1.2 (2018-05-09)

- **Database**: Fix MySql migration issue [#11862](https://github.com/grafana/grafana/issues/11862)
- **Google Analytics**: Enable Google Analytics anonymizeIP setting for GDPR [#11656](https://github.com/grafana/grafana/pull/11656)

# 5.1.1 (2018-05-07)

- **LDAP**: LDAP login with MariaDB/MySQL database and dn>100 chars not possible [#11754](https://github.com/grafana/grafana/issues/11754)
- **Build**: AppVeyor Windows build missing version and commit info [#11758](https://github.com/grafana/grafana/issues/11758)
- **Scroll**: Scroll can't start in graphs on Chrome mobile [#11710](https://github.com/grafana/grafana/issues/11710)
- **Units**: Revert renaming of unit key ppm [#11743](https://github.com/grafana/grafana/issues/11743)

# 5.1.0 (2018-04-26)

- **Folders**: Default permissions on folder are not shown as inherited in its dashboards [#11668](https://github.com/grafana/grafana/issues/11668)
- **Templating**: Allow more than 20 previews when creating a variable [#11508](https://github.com/grafana/grafana/issues/11508)
- **Dashboard**: Row edit icon not shown [#11466](https://github.com/grafana/grafana/issues/11466)
- **SQL**: Unsupported data types for value column using time series query [#11703](https://github.com/grafana/grafana/issues/11703)
- **Prometheus**: Prometheus query inspector expands to be very large on autocomplete queries [#11673](https://github.com/grafana/grafana/issues/11673)

# 5.1.0-beta1 (2018-04-20)

- **MSSQL**: New Microsoft SQL Server data source [#10093](https://github.com/grafana/grafana/pull/10093), [#11298](https://github.com/grafana/grafana/pull/11298), thx [@linuxchips](https://github.com/linuxchips)
- **Prometheus**: The heatmap panel now support Prometheus histograms [#10009](https://github.com/grafana/grafana/issues/10009)
- **Postgres/MySQL**: Ability to insert 0s or nulls for missing intervals [#9487](https://github.com/grafana/grafana/issues/9487), thanks [@svenklemm](https://github.com/svenklemm)
- **Postgres/MySQL/MSSQL**: Fix precision for the time column in table mode [#11306](https://github.com/grafana/grafana/issues/11306)
- **Graph**: Align left and right Y-axes to one level [#1271](https://github.com/grafana/grafana/issues/1271) & [#2740](https://github.com/grafana/grafana/issues/2740) thx [@ilgizar](https://github.com/ilgizar)
- **Graph**: Thresholds for Right Y axis [#7107](https://github.com/grafana/grafana/issues/7107), thx [@ilgizar](https://github.com/ilgizar)
- **Graph**: Support multiple series stacking in histogram mode [#8151](https://github.com/grafana/grafana/issues/8151), thx [@mtanda](https://github.com/mtanda)
- **Alerting**: Pausing/un alerts now updates new_state_date [#10942](https://github.com/grafana/grafana/pull/10942)
- **Alerting**: Support Pagerduty notification channel using Pagerduty V2 API [#10531](https://github.com/grafana/grafana/issues/10531), thx [@jbaublitz](https://github.com/jbaublitz)
- **Templating**: Add comma templating format [#10632](https://github.com/grafana/grafana/issues/10632), thx [@mtanda](https://github.com/mtanda)
- **Prometheus**: Show template variable candidate in query editor [#9210](https://github.com/grafana/grafana/issues/9210), thx [@mtanda](https://github.com/mtanda)
- **Prometheus**: Support POST for query and query_range [#9859](https://github.com/grafana/grafana/pull/9859), thx [@mtanda](https://github.com/mtanda)
- **Alerting**: Add support for retries on alert queries [#5855](https://github.com/grafana/grafana/issues/5855), thx [@Thib17](https://github.com/Thib17)
- **Table**: Table plugin value mappings [#7119](https://github.com/grafana/grafana/issues/7119), thx [infernix](https://github.com/infernix)
- **IE11**: IE 11 compatibility [#11165](https://github.com/grafana/grafana/issues/11165)
- **Scrolling**: Better scrolling experience [#11053](https://github.com/grafana/grafana/issues/11053), [#11252](https://github.com/grafana/grafana/issues/11252), [#10836](https://github.com/grafana/grafana/issues/10836), [#11185](https://github.com/grafana/grafana/issues/11185), [#11168](https://github.com/grafana/grafana/issues/11168)
- **Docker**: Improved docker image (breaking changes regarding file ownership) [grafana-docker #141](https://github.com/grafana/grafana-docker/issues/141), thx [@Spindel](https://github.com/Spindel), [@ChristianKniep](https://github.com/ChristianKniep), [@brancz](https://github.com/brancz) and [@jangaraj](https://github.com/jangaraj)
- **Folders**: A folder admin cannot add user/team permissions for folder/its dashboards [#11173](https://github.com/grafana/grafana/issues/11173)
- **Provisioning**: Improved workflow for provisioned dashboards [#10883](https://github.com/grafana/grafana/issues/10883)

### Minor

- **OpsGenie**: Add triggered alerts as description [#11046](https://github.com/grafana/grafana/pull/11046), thx [@llamashoes](https://github.com/llamashoes)
- **Cloudwatch**: Support high resolution metrics [#10925](https://github.com/grafana/grafana/pull/10925), thx [@mtanda](https://github.com/mtanda)
- **Cloudwatch**: Add dimension filtering to CloudWatch `dimension_values()` [#10029](https://github.com/grafana/grafana/issues/10029), thx [@willyhutw](https://github.com/willyhutw)
- **Units**: Second to HH:mm:ss formatter [#11107](https://github.com/grafana/grafana/issues/11107), thx [@gladdiologist](https://github.com/gladdiologist)
- **Singlestat**: Add color to prefix and postfix in singlestat panel [#11143](https://github.com/grafana/grafana/pull/11143), thx [@ApsOps](https://github.com/ApsOps)
- **Dashboards**: Version cleanup fails on old databases with many entries [#11278](https://github.com/grafana/grafana/issues/11278)
- **Server**: Adjust permissions of unix socket [#11343](https://github.com/grafana/grafana/pull/11343), thx [@corny](https://github.com/corny)
- **Shortcuts**: Add shortcut for duplicate panel [#11102](https://github.com/grafana/grafana/issues/11102)
- **AuthProxy**: Support IPv6 in Auth proxy white list [#11330](https://github.com/grafana/grafana/pull/11330), thx [@corny](https://github.com/corny)
- **SMTP**: Don't connect to STMP server using TLS unless configured. [#7189](https://github.com/grafana/grafana/issues/7189)
- **Prometheus**: Escape backslash in labels correctly. [#10555](https://github.com/grafana/grafana/issues/10555), thx [@roidelapluie](https://github.com/roidelapluie)
- **Variables**: Case-insensitive sorting for template values [#11128](https://github.com/grafana/grafana/issues/11128) thx [@cross](https://github.com/cross)
- **Annotations (native)**: Change default limit from 10 to 100 when querying api [#11569](https://github.com/grafana/grafana/issues/11569), thx [@flopp999](https://github.com/flopp999)
- **MySQL/Postgres/MSSQL**: PostgreSQL data source generates invalid query with dates before 1970 [#11530](https://github.com/grafana/grafana/issues/11530) thx [@ryantxu](https://github.com/ryantxu)
- **Kiosk**: Adds url parameter for starting a dashboard in inactive mode [#11228](https://github.com/grafana/grafana/issues/11228), thx [@towolf](https://github.com/towolf)
- **Dashboard**: Enable closing timepicker using escape key [#11332](https://github.com/grafana/grafana/issues/11332)
- **Data Sources**: Rename direct access mode in the data source settings [#11391](https://github.com/grafana/grafana/issues/11391)
- **Search**: Display dashboards in folder indented [#11073](https://github.com/grafana/grafana/issues/11073)
- **Units**: Use B/s instead Bps for Bytes per second [#9342](https://github.com/grafana/grafana/pull/9342), thx [@mayli](https://github.com/mayli)
- **Units**: Radiation units [#11001](https://github.com/grafana/grafana/issues/11001), thx [@victorclaessen](https://github.com/victorclaessen)
- **Units**: Timeticks unit [#11183](https://github.com/grafana/grafana/pull/11183), thx [@jtyr](https://github.com/jtyr)
- **Units**: Concentration units and "Normal cubic meter" [#11211](https://github.com/grafana/grafana/issues/11211), thx [@flopp999](https://github.com/flopp999)
- **Units**: New currency - Czech koruna [#11384](https://github.com/grafana/grafana/pull/11384), thx [@Rohlik](https://github.com/Rohlik)
- **Avatar**: Fix DISABLE_GRAVATAR option [#11095](https://github.com/grafana/grafana/issues/11095)
- **Heatmap**: Disable log scale when using time time series buckets [#10792](https://github.com/grafana/grafana/issues/10792)
- **Provisioning**: Remove `id` from json when provisioning dashboards, [#11138](https://github.com/grafana/grafana/issues/11138)
- **Prometheus**: tooltip for legend format not showing properly [#11516](https://github.com/grafana/grafana/issues/11516), thx [@svenklemm](https://github.com/svenklemm)
- **Playlist**: Empty playlists cannot be deleted [#11133](https://github.com/grafana/grafana/issues/11133), thx [@kichristensen](https://github.com/kichristensen)
- **Switch Orgs**: Alphabetic order in Switch Organization modal [#11556](https://github.com/grafana/grafana/issues/11556)
- **Postgres**: improve `$__timeFilter` macro [#11578](https://github.com/grafana/grafana/issues/11578), thx [@svenklemm](https://github.com/svenklemm)
- **Permission list**: Improved ux [#10747](https://github.com/grafana/grafana/issues/10747)
- **Dashboard**: Sizing and positioning of settings menu icons [#11572](https://github.com/grafana/grafana/pull/11572)
- **Dashboard**: Add search filter/tabs to new panel control [#10427](https://github.com/grafana/grafana/issues/10427)
- **Folders**: User with org viewer role should not be able to save/move dashboards in/to general folder [#11553](https://github.com/grafana/grafana/issues/11553)
- **Influxdb**: Don't assume the first column in table response is time. [#11476](https://github.com/grafana/grafana/issues/11476), thx [@hahnjo](https://github.com/hahnjo)

### Tech

- Backend code simplification [#11613](https://github.com/grafana/grafana/pull/11613), thx [@knweiss](https://github.com/knweiss)
- Add codespell to CI [#11602](https://github.com/grafana/grafana/pull/11602), thx [@mjtrangoni](https://github.com/mjtrangoni)
- Migrated JavaScript files to TypeScript

# 5.0.4 (2018-03-28)

- **Docker** Can't start Grafana on Kubernetes 1.7.14, 1.8.9, or 1.9.4 [#140 in grafana-docker repo](https://github.com/grafana/grafana-docker/issues/140) thx [@suquant](https://github.com/suquant)
- **Dashboard** Fixed bug where collapsed panels could not be directly linked to/renderer [#11114](https://github.com/grafana/grafana/issues/11114) & [#11086](https://github.com/grafana/grafana/issues/11086) & [#11296](https://github.com/grafana/grafana/issues/11296)
- **Dashboard** Provisioning dashboard with alert rules should create alerts [#11247](https://github.com/grafana/grafana/issues/11247)
- **Snapshots** For snapshots, the Graph panel renders the legend incorrectly on right hand side [#11318](https://github.com/grafana/grafana/issues/11318)
- **Alerting** Link back to Grafana returns wrong URL if root_path contains sub-path components [#11403](https://github.com/grafana/grafana/issues/11403)
- **Alerting** Incorrect default value for upload images setting for alert notifiers [#11413](https://github.com/grafana/grafana/pull/11413)

# 5.0.3 (2018-03-16)

- **Mysql**: Mysql panic occurring occasionally upon Grafana dashboard access (a bigger patch than the one in 5.0.2) [#11155](https://github.com/grafana/grafana/issues/11155)

# 5.0.2 (2018-03-14)

- **Mysql**: Mysql panic occurring occasionally upon Grafana dashboard access [#11155](https://github.com/grafana/grafana/issues/11155)
- **Dashboards**: Should be possible to browse dashboard using only uid [#11231](https://github.com/grafana/grafana/issues/11231)
- **Alerting**: Fixes bug where alerts from hidden panels where deleted [#11222](https://github.com/grafana/grafana/issues/11222)
- **Import**: Fixes bug where dashboards with alerts couldn't be imported [#11227](https://github.com/grafana/grafana/issues/11227)
- **Teams**: Remove quota restrictions from teams [#11220](https://github.com/grafana/grafana/issues/11220)
- **Render**: Fixes bug with legacy url redirection for panel rendering [#11180](https://github.com/grafana/grafana/issues/11180)

# 5.0.1 (2018-03-08)

- **Postgres**: PostgreSQL error when using ipv6 address as hostname in connection string [#11055](https://github.com/grafana/grafana/issues/11055), thanks [@svenklemm](https://github.com/svenklemm)
- **Dashboards**: Changing templated value from dropdown is causing unsaved changes [#11063](https://github.com/grafana/grafana/issues/11063)
- **Prometheus**: Fixes bundled Prometheus 2.0 dashboard [#11016](https://github.com/grafana/grafana/issues/11016), thx [@roidelapluie](https://github.com/roidelapluie)
- **Sidemenu**: Profile menu "invisible" when gravatar is disabled [#11097](https://github.com/grafana/grafana/issues/11097)
- **Dashboard**: Fixes a bug with resizable handles for panels [#11103](https://github.com/grafana/grafana/issues/11103)
- **Alerting**: Telegram inline image mode fails when caption too long [#10975](https://github.com/grafana/grafana/issues/10975)
- **Alerting**: Fixes silent failing validation [#11145](https://github.com/grafana/grafana/pull/11145)
- **OAuth**: Only use jwt token if it contains an email address [#11127](https://github.com/grafana/grafana/pull/11127)

# 5.0.0-stable (2018-03-01)

### Fixes

- **oauth** Fix GitHub OAuth not working with private Organizations [#11028](https://github.com/grafana/grafana/pull/11028) [@lostick](https://github.com/lostick)
- **kiosk** white area over bottom panels in kiosk mode [#11010](https://github.com/grafana/grafana/issues/11010)
- **alerting** Fix OK state doesn't show up in Microsoft Teams [#11032](https://github.com/grafana/grafana/pull/11032), thx [@manacker](https://github.com/manacker)

# 5.0.0-beta5 (2018-02-26)

### Fixes

- **Orgs** Unable to switch org when too many orgs listed [#10774](https://github.com/grafana/grafana/issues/10774)
- **Folders** Make it easier/explicit to access/modify folders using the API [#10630](https://github.com/grafana/grafana/issues/10630)
- **Dashboard** Scrollbar works incorrectly in Grafana 5.0 Beta4 in some cases [#10982](https://github.com/grafana/grafana/issues/10982)
- **ElasticSearch** Custom aggregation sizes no longer allowed for Elasticsearch [#10124](https://github.com/grafana/grafana/issues/10124)
- **oauth** GitHub OAuth with allowed organizations fails to login [#10964](https://github.com/grafana/grafana/issues/10964)
- **heatmap** Heatmap panel has partially hidden legend [#10793](https://github.com/grafana/grafana/issues/10793)
- **snapshots** Expired snapshots not being cleaned up [#10996](https://github.com/grafana/grafana/pull/10996)

# 5.0.0-beta4 (2018-02-19)

### Fixes

- **Dashboard** Fixed dashboard overwrite permission issue [#10814](https://github.com/grafana/grafana/issues/10814)
- **Keyboard shortcuts** Fixed Esc key when in panel edit/view mode [#10945](https://github.com/grafana/grafana/issues/10945)
- **Save dashboard** Fixed issue with time range & variable reset after saving [#10946](https://github.com/grafana/grafana/issues/10946)

# 5.0.0-beta3 (2018-02-16)

### Fixes

- **MySQL** Fixed new migration issue with index length [#10931](https://github.com/grafana/grafana/issues/10931)
- **Modal** Escape key no closes modals everywhere, fixes [#10887](https://github.com/grafana/grafana/issues/10887)
- **Row repeats** Fix for repeating rows issue, fixes [#10932](https://github.com/grafana/grafana/issues/10932)
- **Docs** Team api documented, fixes [#10832](https://github.com/grafana/grafana/issues/10832)
- **Plugins** Plugin info page broken, fixes [#10943](https://github.com/grafana/grafana/issues/10943)

# 5.0.0-beta2 (2018-02-15)

### Fixes

- **Permissions** Fixed search permissions issues [#10822](https://github.com/grafana/grafana/issues/10822)
- **Permissions** Fixed problem issues displaying permissions lists [#10864](https://github.com/grafana/grafana/issues/10864)
- **PNG-Rendering** Fixed problem rendering legend to the right [#10526](https://github.com/grafana/grafana/issues/10526)
- **Reset password** Fixed problem with reset password form [#10870](https://github.com/grafana/grafana/issues/10870)
- **Light theme** Fixed problem with light theme in safari, [#10869](https://github.com/grafana/grafana/issues/10869)
- **Provisioning** Now handles deletes when dashboard json files removed from disk [#10865](https://github.com/grafana/grafana/issues/10865)
- **MySQL** Fixed issue with schema migration on old mysql (index too long) [#10779](https://github.com/grafana/grafana/issues/10779)
- **GitHub OAuth** Fixed fetching github orgs from private github org [#10823](https://github.com/grafana/grafana/issues/10823)
- **Embedding** Fixed issues embedding panel [#10787](https://github.com/grafana/grafana/issues/10787)

# 5.0.0-beta1 (2018-02-05)

Grafana v5.0 is going to be the biggest and most foundational release Grafana has ever had, coming with a ton of UX improvements, a new dashboard grid engine, dashboard folders, user teams and permissions. Checkout out this [video preview](https://www.youtube.com/watch?v=Izr0IBgoTZQ) of Grafana v5.

### New Major Features

- **Dashboards** Dashboard folders, [#1611](https://github.com/grafana/grafana/issues/1611)
- **Teams** User groups (teams) implemented. Can be used in folder & dashboard permission list.
- **Dashboard grid**: Panels are now laid out in a two dimensional grid (with x, y, w, h). [#9093](https://github.com/grafana/grafana/issues/9093).
- **Templating**: Vertical repeat direction for panel repeats.
- **UX**: Major update to page header and navigation
- **Dashboard settings**: Combine dashboard settings views into one with side menu, [#9750](https://github.com/grafana/grafana/issues/9750)
- **Persistent dashboard url's**: New url's for dashboards that allows renaming dashboards without breaking links. [#7883](https://github.com/grafana/grafana/issues/7883)

## Breaking changes

- **[dashboard.json]** have been replaced with [dashboard provisioning](http://docs.grafana.org/administration/provisioning/).
  Config files for provisioning data sources as configuration have changed from `/conf/datasources` to `/conf/provisioning/datasources`.
  From `/etc/grafana/datasources` to `/etc/grafana/provisioning/datasources` when installed with deb/rpm packages.

- **Pagerduty** The notifier now defaults to not auto resolve incidents. More details at [#10222](https://github.com/grafana/grafana/issues/10222)

- **HTTP API**
  - `GET /api/alerts` property dashboardUri renamed to url and is now the full url (that is including app sub url).

## New Dashboard Grid

The new grid engine is a major upgrade for how you can position and move panels. It enables new layouts and a much easier dashboard building experience. The change is backward compatible. So you can upgrade your current version to 5.0 without breaking dashboards, but you cannot downgrade from 5.0 to previous versions. Grafana will automatically upgrade your dashboards to the new schema and position panels to match your existing layout. There might be minor differences in panel height. If you upgrade to 5.0 and for some reason want to rollback to the previous version you can restore dashboards to previous versions using dashboard history. But that should only be seen as an emergency solution.

Dashboard panels and rows are positioned using a gridPos object `{x: 0, y: 0, w: 24, h: 5}`. Units are in grid dimensions (24 columns, 1 height unit 30px). Rows and Panels objects exist (together) in a flat array directly on the dashboard root object. Rows are not needed for layouts anymore and are mainly there for backward compatibility. Some panel plugins that do not respect their panel height might require an update.

## New Features

- **Alerting**: Add support for internal image store [#6922](https://github.com/grafana/grafana/issues/6922), thx [@FunkyM](https://github.com/FunkyM)
- **Data Source Proxy**: Add support for whitelisting specified cookies that will be passed through to the data source when proxying data source requests [#5457](https://github.com/grafana/grafana/issues/5457), thanks [@robingustafsson](https://github.com/robingustafsson)
- **Postgres/MySQL**: add \_\_timeGroup macro for mysql [#9596](https://github.com/grafana/grafana/pull/9596), thanks [@svenklemm](https://github.com/svenklemm)
- **Text**: Text panel are now edited in the ace editor. [#9698](https://github.com/grafana/grafana/pull/9698), thx [@mtanda](https://github.com/mtanda)
- **Teams**: Add Microsoft Teams notifier as [#8523](https://github.com/grafana/grafana/issues/8523), thx [@anthu](https://github.com/anthu)
- **Data Sources**: Its now possible to configure data sources with config files [#1789](https://github.com/grafana/grafana/issues/1789)
- **Graphite**: Query editor updated to support new query by tag features [#9230](https://github.com/grafana/grafana/issues/9230)
- **Dashboard history**: New config file option versions_to_keep sets how many versions per dashboard to store, [#9671](https://github.com/grafana/grafana/issues/9671)
- **Dashboard as cfg**: Load dashboards from file into Grafana on startup/change [#9654](https://github.com/grafana/grafana/issues/9654) [#5269](https://github.com/grafana/grafana/issues/5269)
- **Prometheus**: Grafana can now send alerts to Prometheus Alertmanager while firing [#7481](https://github.com/grafana/grafana/issues/7481), thx [@Thib17](https://github.com/Thib17) and [@mtanda](https://github.com/mtanda)
- **Table**: Support multiple table formatted queries in table panel [#9170](https://github.com/grafana/grafana/issues/9170), thx [@davkal](https://github.com/davkal)
- **Security**: Protect against brute force (frequent) login attempts [#7616](https://github.com/grafana/grafana/issues/7616)

## Minor

- **Graph**: Don't hide graph display options (Lines/Points) when draw mode is unchecked [#9770](https://github.com/grafana/grafana/issues/9770), thx [@Jonnymcc](https://github.com/Jonnymcc)
- **Prometheus**: Show label name in paren after by/without/on/ignoring/group_left/group_right [#9664](https://github.com/grafana/grafana/pull/9664), thx [@mtanda](https://github.com/mtanda)
- **Alert panel**: Adds placeholder text when no alerts are within the time range [#9624](https://github.com/grafana/grafana/issues/9624), thx [@straend](https://github.com/straend)
- **Mysql**: MySQL enable MaxOpenCon and MaxIdleCon regards how constring is configured. [#9784](https://github.com/grafana/grafana/issues/9784), thx [@dfredell](https://github.com/dfredell)
- **Cloudwatch**: Fixes broken query inspector for cloudwatch [#9661](https://github.com/grafana/grafana/issues/9661), thx [@mtanda](https://github.com/mtanda)
- **Dashboard**: Make it possible to start dashboards from search and dashboard list panel [#1871](https://github.com/grafana/grafana/issues/1871)
- **Annotations**: Posting annotations now return the id of the annotation [#9798](https://github.com/grafana/grafana/issues/9798)
- **Systemd**: Use systemd notification ready flag [#10024](https://github.com/grafana/grafana/issues/10024), thx [@jgrassler](https://github.com/jgrassler)
- **GitHub**: Use organizations_url provided from github to verify user belongs in org. [#10111](https://github.com/grafana/grafana/issues/10111), thx
  [@adiletmaratov](https://github.com/adiletmaratov)
- **Backend**: Fixed bug where Grafana exited before all sub routines where finished [#10131](https://github.com/grafana/grafana/issues/10131)
- **Azure**: Adds support for Azure blob storage as external image stor [#8955](https://github.com/grafana/grafana/issues/8955), thx [@saada](https://github.com/saada)
- **Telegram**: Add support for inline image uploads to telegram notifier plugin [#9967](https://github.com/grafana/grafana/pull/9967), thx [@rburchell](https://github.com/rburchell)

## Fixes

- **Sensu**: Send alert message to sensu output [#9551](https://github.com/grafana/grafana/issues/9551), thx [@cjchand](https://github.com/cjchand)
- **Singlestat**: suppress error when result contains no datapoints [#9636](https://github.com/grafana/grafana/issues/9636), thx [@utkarshcmu](https://github.com/utkarshcmu)
- **Postgres/MySQL**: Control quoting in SQL-queries when using template variables [#9030](https://github.com/grafana/grafana/issues/9030), thanks [@svenklemm](https://github.com/svenklemm)
- **Pagerduty**: Pagerduty don't auto resolve incidents by default anymore. [#10222](https://github.com/grafana/grafana/issues/10222)
- **Cloudwatch**: Fix for multi-valued templated queries. [#9903](https://github.com/grafana/grafana/issues/9903)

## Tech

- **RabbitMq**: Remove support for publishing events to RabbitMQ [#9645](https://github.com/grafana/grafana/issues/9645)

## Deprecation notes

### HTTP API

The following operations have been deprecated and will be removed in a future release:

- `GET /api/dashboards/db/:slug` -> Use `GET /api/dashboards/uid/:uid` instead
- `DELETE /api/dashboards/db/:slug` -> Use `DELETE /api/dashboards/uid/:uid` instead

The following properties have been deprecated and will be removed in a future release:

- `uri` property in `GET /api/search` -> Use new `url` or `uid` property instead
- `meta.slug` property in `GET /api/dashboards/uid/:uid` and `GET /api/dashboards/db/:slug` -> Use new `meta.url` or `dashboard.uid` property instead
