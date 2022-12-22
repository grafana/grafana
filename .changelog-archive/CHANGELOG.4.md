# 4.6.4 (2018-08-29)

### Important fix for LDAP & OAuth login vulnerability

See [security announcement](https://community.grafana.com/t/grafana-5-2-3-and-4-6-4-security-update/10050) for details.

# 4.6.3 (2017-12-14)

## Fixes

- **Gzip**: Fixes bug gravatar images when gzip was enabled [#5952](https://github.com/grafana/grafana/issues/5952)
- **Alert list**: Now shows alert state changes even after adding manual annotations on dashboard [#9951](https://github.com/grafana/grafana/issues/9951)
- **Alerting**: Fixes bug where rules evaluated as firing when all conditions was false and using OR operator. [#9318](https://github.com/grafana/grafana/issues/9318)
- **Cloudwatch**: CloudWatch no longer display metrics' default alias [#10151](https://github.com/grafana/grafana/issues/10151), thx [@mtanda](https://github.com/mtanda)

# 4.6.2 (2017-11-16)

## Important

- **Prometheus**: Fixes bug with new prometheus alerts in Grafana. Make sure to download this version if you're using Prometheus for alerting. More details in the issue. [#9777](https://github.com/grafana/grafana/issues/9777)

## Fixes

- **Color picker**: Bug after using textbox input field to change/paste color string [#9769](https://github.com/grafana/grafana/issues/9769)
- **Cloudwatch**: Fix for cloudwatch templating query `ec2_instance_attribute` [#9667](https://github.com/grafana/grafana/issues/9667), thanks [@mtanda](https://github.com/mtanda)
- **Heatmap**: Fixed tooltip for "time series buckets" mode [#9332](https://github.com/grafana/grafana/issues/9332)
- **InfluxDB**: Fixed query editor issue when using `>` or `<` operators in WHERE clause [#9871](https://github.com/grafana/grafana/issues/9871)

# 4.6.1 (2017-11-01)

- **Singlestat**: Lost thresholds when using save dashboard as [#9681](https://github.com/grafana/grafana/issues/9681)
- **Graph**: Fix for series override color picker [#9715](https://github.com/grafana/grafana/issues/9715)
- **Go**: build using golang 1.9.2 [#9713](https://github.com/grafana/grafana/issues/9713)
- **Plugins**: Fixed problem with loading plugin js files behind auth proxy [#9509](https://github.com/grafana/grafana/issues/9509)
- **Graphite**: Annotation tooltip should render empty string when undefined [#9707](https://github.com/grafana/grafana/issues/9707)

# 4.6.0 (2017-10-26)

## Fixes

- **Alerting**: Viewer can no longer pause alert rules [#9640](https://github.com/grafana/grafana/issues/9640)
- **Playlist**: Bug where playlist controls was missing [#9639](https://github.com/grafana/grafana/issues/9639)
- **Firefox**: Creating region annotations now work in firefox [#9638](https://github.com/grafana/grafana/issues/9638)

# 4.6.0-beta3 (2017-10-23)

## Fixes

- **Prometheus**: Fix for browser crash for short time ranges. [#9575](https://github.com/grafana/grafana/issues/9575)
- **Heatmap**: Fix for y-axis not showing. [#9576](https://github.com/grafana/grafana/issues/9576)
- **Save to file**: Fix for save to file in export modal. [#9586](https://github.com/grafana/grafana/issues/9586)
- **Postgres**: modify group by time macro so it can be used in select clause [#9527](https://github.com/grafana/grafana/pull/9527), thanks [@svenklemm](https://github.com/svenklemm)

# 4.6.0-beta2 (2017-10-17)

## Fixes

- **ColorPicker**: Fix for color picker not showing [#9549](https://github.com/grafana/grafana/issues/9549)
- **Alerting**: Fix for broken test rule button in alert tab [#9539](https://github.com/grafana/grafana/issues/9539)
- **Cloudwatch**: Provide error message when failing to add cloudwatch data source [#9534](https://github.com/grafana/grafana/pull/9534), thx [@mtanda](https://github.com/mtanda)
- **Cloudwatch**: Fix unused period parameter [#9536](https://github.com/grafana/grafana/pull/9536), thx [@mtanda](https://github.com/mtanda)
- **CSV Export**: Fix for broken CSV export [#9525](https://github.com/grafana/grafana/issues/9525)
- **Text panel**: Fix for issue with break lines in Firefox [#9491](https://github.com/grafana/grafana/issues/9491)
- **Annotations**: Fix for issue saving annotation event in MySQL DB [#9550](https://github.com/grafana/grafana/issues/9550), thanks [@krise3k](https://github.com/krise3k)

# 4.6.0-beta1 (2017-10-13)

## New Features

- **Annotations**: Add support for creating annotations from graph panel [#8197](https://github.com/grafana/grafana/pull/8197)
- **GCS**: Adds support for Google Cloud Storage [#8370](https://github.com/grafana/grafana/issues/8370) thx [@chuhlomin](https://github.com/chuhlomin)
- **Prometheus**: Adds /metrics endpoint for exposing Grafana metrics. [#9187](https://github.com/grafana/grafana/pull/9187)
- **Graph**: Add support for local formatting in axis. [#1395](https://github.com/grafana/grafana/issues/1395), thx [@m0nhawk](https://github.com/m0nhawk)
- **Jaeger**: Add support for open tracing using jaeger in Grafana. [#9213](https://github.com/grafana/grafana/pull/9213)
- **Unit types**: New date & time unit types added, useful in singlestat to show dates & times. [#3678](https://github.com/grafana/grafana/issues/3678), [#6710](https://github.com/grafana/grafana/issues/6710), [#2764](https://github.com/grafana/grafana/issues/2764)
- **CLI**: Make it possible to install plugins from any url [#5873](https://github.com/grafana/grafana/issues/5873)
- **Prometheus**: Add support for instant queries [#5765](https://github.com/grafana/grafana/issues/5765), thx [@mtanda](https://github.com/mtanda)
- **Cloudwatch**: Add support for alerting using the cloudwatch data source [#8050](https://github.com/grafana/grafana/pull/8050), thx [@mtanda](https://github.com/mtanda)
- **Pagerduty**: Include triggering series in pagerduty notification [#8479](https://github.com/grafana/grafana/issues/8479), thx [@rickymoorhouse](https://github.com/rickymoorhouse)
- **Timezone**: Time ranges like Today & Yesterday now work correctly when timezone setting is set to UTC [#8916](https://github.com/grafana/grafana/issues/8916), thx [@ctide](https://github.com/ctide)
- **Prometheus**: Align \$\_\_interval with the step parameters. [#9226](https://github.com/grafana/grafana/pull/9226), thx [@alin-amana](https://github.com/alin-amana)
- **Prometheus**: Autocomplete for label name and label value [#9208](https://github.com/grafana/grafana/pull/9208), thx [@mtanda](https://github.com/mtanda)
- **Postgres**: New Postgres data source [#9209](https://github.com/grafana/grafana/pull/9209), thx [@svenklemm](https://github.com/svenklemm)
- **Data sources**: Make data source HTTP requests verify TLS by default. closes [#9371](https://github.com/grafana/grafana/issues/9371), [#5334](https://github.com/grafana/grafana/issues/5334), [#8812](https://github.com/grafana/grafana/issues/8812), thx [@mattbostock](https://github.com/mattbostock)
- **OAuth**: Verify TLS during OAuth callback [#9373](https://github.com/grafana/grafana/issues/9373), thx [@mattbostock](https://github.com/mattbostock)

## Minor

- **SMTP**: Make it possible to set specific HELO for smtp client. [#9319](https://github.com/grafana/grafana/issues/9319)
- **Dataproxy**: Allow grafana to renegotiate tls connection [#9250](https://github.com/grafana/grafana/issues/9250)
- **HTTP**: set net.Dialer.DualStack to true for all http clients [#9367](https://github.com/grafana/grafana/pull/9367)
- **Alerting**: Add diff and percent diff as series reducers [#9386](https://github.com/grafana/grafana/pull/9386), thx [@shanhuhai5739](https://github.com/shanhuhai5739)
- **Slack**: Allow images to be uploaded to slack when Token is present [#7175](https://github.com/grafana/grafana/issues/7175), thx [@xginn8](https://github.com/xginn8)
- **Opsgenie**: Use their latest API instead of old version [#9399](https://github.com/grafana/grafana/pull/9399), thx [@cglrkn](https://github.com/cglrkn)
- **Table**: Add support for displaying the timestamp with milliseconds [#9429](https://github.com/grafana/grafana/pull/9429), thx [@s1061123](https://github.com/s1061123)
- **Hipchat**: Add metrics, message and image to hipchat notifications [#9110](https://github.com/grafana/grafana/issues/9110), thx [@eloo](https://github.com/eloo)
- **Kafka**: Add support for sending alert notifications to kafka [#7104](https://github.com/grafana/grafana/issues/7104), thx [@utkarshcmu](https://github.com/utkarshcmu)
- **Alerting**: add count_non_null as series reducer [#9516](https://github.com/grafana/grafana/issues/9516)

## Tech

- **Go**: Grafana is now built using golang 1.9
- **Webpack**: Changed from systemjs to webpack (see readme or building from source guide for new build instructions). Systemjs is still used to load plugins but now plugins can only import a limited set of dependencies. See [PLUGIN_DEV.md](https://github.com/grafana/grafana/blob/master/PLUGIN_DEV.md) for more details on how this can effect some plugins.

# 4.5.2 (2017-09-22)

## Fixes

- **Graphite**: Fix for issues with jsonData & graphiteVersion null errors [#9258](https://github.com/grafana/grafana/issues/9258)
- **Graphite**: Fix for Grafana internal metrics to Graphite sending NaN values [#9279](https://github.com/grafana/grafana/issues/9279)
- **HTTP API**: Fix for HEAD method requests [#9307](https://github.com/grafana/grafana/issues/9307)
- **Templating**: Fix for duplicate template variable queries when refresh is set to time range change [#9185](https://github.com/grafana/grafana/issues/9185)
- **Metrics**: don't write NaN values to graphite [#9279](https://github.com/grafana/grafana/issues/9279)

# 4.5.1 (2017-09-15)

## Fixes

- **MySQL**: Fixed issue with query editor not showing [#9247](https://github.com/grafana/grafana/issues/9247)

## Breaking changes

- **Metrics**: The metric structure for internal metrics about Grafana published to graphite has changed. This might break dashboards for internal metrics.

# 4.5.0 (2017-09-14)

## Fixes & Enhancements since beta1

- **Security**: Security fix for api vulnerability (in multiple org setups).
- **Shortcuts**: Adds shortcut for creating new dashboard [#8876](https://github.com/grafana/grafana/pull/8876) thx [@mtanda](https://github.com/mtanda)
- **Graph**: Right Y-Axis label position fixed [#9172](https://github.com/grafana/grafana/pull/9172)
- **General**: Improve rounding of time intervals [#9197](https://github.com/grafana/grafana/pull/9197), thx [@alin-amana](https://github.com/alin-amana)

# 4.5.0-beta1 (2017-09-05)

## New Features

- **Table panel**: Render cell values as links that can have an url template that uses variables from current table row. [#3754](https://github.com/grafana/grafana/issues/3754)
- **Elasticsearch**: Add ad hoc filters directly by clicking values in table panel [#8052](https://github.com/grafana/grafana/issues/8052).
- **MySQL**: New rich query editor with syntax highlighting
- **Prometheus**: New rich query editor with syntax highlighting, metric & range auto complete and integrated function docs. [#5117](https://github.com/grafana/grafana/issues/5117)

## Enhancements

- **GitHub OAuth**: Support for GitHub organizations with 100+ teams. [#8846](https://github.com/grafana/grafana/issues/8846), thx [@skwashd](https://github.com/skwashd)
- **Graphite**: Calls to Graphite api /metrics/find now include panel or dashboard time range (from & until) in most cases, [#8055](https://github.com/grafana/grafana/issues/8055)
- **Graphite**: Added new graphite 1.0 functions, available if you set version to 1.0.x in data source settings. New Functions: mapSeries, reduceSeries, isNonNull, groupByNodes, offsetToZero, grep, weightedAverage, removeEmptySeries, aggregateLine, averageOutsidePercentile, delay, exponentialMovingAverage, fallbackSeries, integralByInterval, interpolate, invert, linearRegression, movingMin, movingMax, movingSum, multiplySeriesWithWildcards, pow, powSeries, removeBetweenPercentile, squareRoot, timeSlice, closes [#8261](https://github.com/grafana/grafana/issues/8261)

- **Elasticsearch**: Ad-hoc filters now use query phrase match filters instead of term filters, works on non keyword/raw fields [#9095](https://github.com/grafana/grafana/issues/9095).

### Breaking change

- **InfluxDB/Elasticsearch**: The panel & data source option named "Group by time interval" is now named "Min time interval" and does now always define a lower limit for the auto group by time. Without having to use `>` prefix (that prefix still works). This should in theory have close to zero actual impact on existing dashboards. It does mean that if you used this setting to define a hard group by time interval of, say "1d", if you zoomed to a time range wide enough the time range could increase above the "1d" range as the setting is now always considered a lower limit.
- **Elasticsearch**: Elasticsearch metric queries without date histogram now return table formatted data making table panel much easier to use for this use case. Should not break/change existing dashboards with stock panels but external panel plugins can be affected.

## Changes

- **InfluxDB**: Change time range filter for absolute time ranges to be inclusive instead of exclusive [#8319](https://github.com/grafana/grafana/issues/8319), thx [@Oxydros](https://github.com/Oxydros)
- **InfluxDB**: Added parenthesis around tag filters in queries [#9131](https://github.com/grafana/grafana/pull/9131)

## Bug Fixes

- **Modals**: Maintain scroll position after opening/leaving modal [#8800](https://github.com/grafana/grafana/issues/8800)
- **Templating**: You cannot select data source variables as data source for other template variables [#7510](https://github.com/grafana/grafana/issues/7510)
- **MySQL/Postgres**: Fix for max_idle_conn option default which was wrongly set to zero which does not mean unlimited but means zero, which in practice kind of disables connection pooling, which is not good. Fixes [#8513](https://github.com/grafana/grafana/issues/8513)

# 4.4.3 (2017-08-07)

## Bug Fixes

- **Search**: Fix for issue that caused search view to hide when you clicked starred or tags filters, fixes [#8981](https://github.com/grafana/grafana/issues/8981)
- **Modals**: ESC key now closes modal again, fixes [#8981](https://github.com/grafana/grafana/issues/8988), thx [@j-white](https://github.com/j-white)

# 4.4.2 (2017-08-01)

## Bug Fixes

- **GrafanaDB(mysql)**: Fix for dashboard_version.data column type, now changed to MEDIUMTEXT, fixes [#8813](https://github.com/grafana/grafana/issues/8813)
- **Dashboard(settings)**: Closing setting views using ESC key did not update url correctly, fixes [#8869](https://github.com/grafana/grafana/issues/8869)
- **InfluxDB**: Wrong username/password parameter name when using direct access, fixes [#8789](https://github.com/grafana/grafana/issues/8789)
- **Forms(TextArea)**: Bug fix for no scroll in text areas [#8797](https://github.com/grafana/grafana/issues/8797)
- **Png Render API**: Bug fix for timeout url parameter. It now works as it should. Default value was also increased from 30 to 60 seconds [#8710](https://github.com/grafana/grafana/issues/8710)
- **Search**: Fix for not being able to close search by clicking on right side of search result container, [8848](https://github.com/grafana/grafana/issues/8848)
- **Cloudwatch**: Fix for using variables in templating metrics() query, [8965](https://github.com/grafana/grafana/issues/8965)

## Changes

- **Settings(defaults)**: allow_sign_up default changed from true to false [#8743](https://github.com/grafana/grafana/issues/8743)
- **Settings(defaults)**: allow_org_create default changed from true to false

# 4.4.1 (2017-07-05)

## Bug Fixes

- **Migrations**: migration fails where dashboard.created_by is null [#8783](https://github.com/grafana/grafana/issues/8783)

# 4.4.0 (2017-07-04)

## New Features

**Dashboard History**: View dashboard version history, compare any two versions (summary & json diffs), restore to old version. This big feature
was contributed by **Walmart Labs**. Big thanks to them for this massive contribution!
Initial feature request: [#4638](https://github.com/grafana/grafana/issues/4638)
Pull Request: [#8472](https://github.com/grafana/grafana/pull/8472)

## Enhancements

- **Elasticsearch**: Added filter aggregation label [#8420](https://github.com/grafana/grafana/pull/8420), thx [@tianzk](github.com/tianzk)
- **Sensu**: Added option for source and handler [#8405](https://github.com/grafana/grafana/pull/8405), thx [@joemiller](github.com/joemiller)
- **CSV**: Configurable csv export datetime format [#8058](https://github.com/grafana/grafana/issues/8058), thx [@cederigo](github.com/cederigo)
- **Table Panel**: Column style that preserves formatting/indentation (like pre tag) [#6617](https://github.com/grafana/grafana/issues/6617)
- **DingDing**: Add DingDing Alert Notifier [#8473](https://github.com/grafana/grafana/pull/8473) thx [@jiamliang](https://github.com/jiamliang)

## Minor Enhancements

- **Elasticsearch**: Add option for result set size in raw_document [#3426](https://github.com/grafana/grafana/issues/3426) [#8527](https://github.com/grafana/grafana/pull/8527), thx [@mk-dhia](github.com/mk-dhia)

## Bug Fixes

- **Graph**: Bug fix for negative values in histogram mode [#8628](https://github.com/grafana/grafana/issues/8628)

# 4.3.2 (2017-05-31)

## Bug fixes

- **InfluxDB**: Fixed issue with query editor not showing ALIAS BY input field when in text editor mode [#8459](https://github.com/grafana/grafana/issues/8459)
- **Graph Log Scale**: Fixed issue with log scale going below x-axis [#8244](https://github.com/grafana/grafana/issues/8244)
- **Playlist**: Fixed dashboard play order issue [#7688](https://github.com/grafana/grafana/issues/7688)
- **Elasticsearch**: Fixed table query issue with ES 2.x [#8467](https://github.com/grafana/grafana/issues/8467), thx [@goldeelox](https://github.com/goldeelox)

## Changes

- **Lazy Loading Of Panels**: Panels are no longer loaded as they are scrolled into view, this was reverted due to Chrome bug, might be reintroduced when Chrome fixes it's JS blocking behavior on scroll. [#8500](https://github.com/grafana/grafana/issues/8500)

# 4.3.1 (2017-05-23)

## Bug fixes

- **S3 image upload**: Fixed image url issue for us-east-1 (us standard) region. If you were missing slack images for alert notifications this should fix it. [#8444](https://github.com/grafana/grafana/issues/8444)

# 4.3.0-stable (2017-05-23)

## Bug fixes

- **Gzip**: Fixed crash when gzip was enabled [#8380](https://github.com/grafana/grafana/issues/8380)
- **Graphite**: Fixed issue with Toggle edit mode did in query editor [#8377](https://github.com/grafana/grafana/issues/8377)
- **Alerting**: Fixed issue with state history not showing query execution errors [#8412](https://github.com/grafana/grafana/issues/8412)
- **Alerting**: Fixed issue with missing state history events/annotations when using sqlite3 database [#7992](https://github.com/grafana/grafana/issues/7992)
- **Sqlite**: Fixed with database table locked and using sqlite3 database [#7992](https://github.com/grafana/grafana/issues/7992)
- **Alerting**: Fixed issue with annotations showing up in unsaved dashboards, new graph & alert panel. [#8361](https://github.com/grafana/grafana/issues/8361)
- **webdav**: Fixed http proxy env variable support for webdav image upload [#7922](https://github.com/grafana/grafana/issues/79222), thx [@berghauz](https://github.com/berghauz)
- **Prometheus**: Fixed issue with hiding query [#8413](https://github.com/grafana/grafana/issues/8413)

## Enhancements

- **VictorOps**: Now supports panel image & auto resolve [#8431](https://github.com/grafana/grafana/pull/8431), thx [@davidmscott](https://github.com/davidmscott)
- **Alerting**: Alert annotations now provide more info [#8421](https://github.com/grafana/grafana/pull/8421)

# 4.3.0-beta1 (2017-05-12)

## Enhancements

- **InfluxDB**: influxdb query builder support for ORDER BY and LIMIT (allows TOPN queries) [#6065](https://github.com/grafana/grafana/issues/6065) Support influxdb's SLIMIT Feature [#7232](https://github.com/grafana/grafana/issues/7232) thx [@thuck](https://github.com/thuck)
- **Panels**: Delay loading & Lazy load panels as they become visible (scrolled into view) [#5216](https://github.com/grafana/grafana/issues/5216) thx [@jifwin](https://github.com/jifwin)
- **Graph**: Support auto grid min/max when using log scale [#3090](https://github.com/grafana/grafana/issues/3090), thx [@bigbenhur](https://github.com/bigbenhur)
- **Graph**: Support for histograms [#600](https://github.com/grafana/grafana/issues/600)
- **Prometheus**: Support table response formats (column per label) [#6140](https://github.com/grafana/grafana/issues/6140), thx [@mtanda](https://github.com/mtanda)
- **Single Stat Panel**: support for non time series data [#6564](https://github.com/grafana/grafana/issues/6564)
- **Server**: Monitoring Grafana (health check endpoint) [#3302](https://github.com/grafana/grafana/issues/3302)
- **Heatmap**: Heatmap Panel [#7934](https://github.com/grafana/grafana/pull/7934)
- **Elasticsearch**: histogram aggregation [#3164](https://github.com/grafana/grafana/issues/3164)

## Minor Enhancements

- **InfluxDB**: Small fix for the "glow" when focus the field for LIMIT and SLIMIT [#7799](https://github.com/grafana/grafana/pull/7799) thx [@thuck](https://github.com/thuck)
- **Prometheus**: Make Prometheus query field a textarea [#7663](https://github.com/grafana/grafana/issues/7663), thx [@hagen1778](https://github.com/hagen1778)
- **Prometheus**: Step parameter changed semantics to min step to reduce the load on Prometheus and rendering in browser [#8073](https://github.com/grafana/grafana/pull/8073), thx [@bobrik](https://github.com/bobrik)
- **Templating**: Should not be possible to create self-referencing (recursive) template variable definitions [#7614](https://github.com/grafana/grafana/issues/7614) thx [@thuck](https://github.com/thuck)
- **Cloudwatch**: Correctly obtain IAM roles within ECS container tasks [#7892](https://github.com/grafana/grafana/issues/7892) thx [@gomlgs](https://github.com/gomlgs)
- **Units**: New number format: Scientific notation [#7781](https://github.com/grafana/grafana/issues/7781) thx [@cadnce](https://github.com/cadnce)
- **Oauth**: Add common type for oauth authorization errors [#6428](https://github.com/grafana/grafana/issues/6428) thx [@amenzhinsky](https://github.com/amenzhinsky)
- **Templating**: Data source variable now supports multi value and panel repeats [#7030](https://github.com/grafana/grafana/issues/7030) thx [@mtanda](https://github.com/mtanda)
- **Telegram**: Telegram alert is not sending metric and legend. [#8110](https://github.com/grafana/grafana/issues/8110), thx [@bashgeek](https://github.com/bashgeek)
- **Graph**: Support dashed lines [#514](https://github.com/grafana/grafana/issues/514), thx [@smalik03](https://github.com/smalik03)
- **Table**: Support to change column header text [#3551](https://github.com/grafana/grafana/issues/3551)
- **Alerting**: Better error when SMTP is not configured [#8093](https://github.com/grafana/grafana/issues/8093)
- **Pushover**: Add an option to attach graph image link in Pushover notification [#8043](https://github.com/grafana/grafana/issues/8043) thx [@devkid](https://github.com/devkid)
- **WebDAV**: Allow to set different ImageBaseUrl for WebDAV upload and image link [#7914](https://github.com/grafana/grafana/issues/7914)
- **Panels**: type-ahead mixed data source selection [#7697](https://github.com/grafana/grafana/issues/7697) thx [@mtanda](https://github.com/mtanda)
- **Security**:User enumeration problem [#7619](https://github.com/grafana/grafana/issues/7619)
- **InfluxDB**: Register new queries available in InfluxDB - Holt Winters [#5619](https://github.com/grafana/grafana/issues/5619) thx [@rikkuness](https://github.com/rikkuness)
- **Server**: Support listening on a UNIX socket [#4030](https://github.com/grafana/grafana/issues/4030), thx [@mitjaziv](https://github.com/mitjaziv)
- **Graph**: Support log scaling for values smaller 1 [#5278](https://github.com/grafana/grafana/issues/5278)
- **InfluxDB**: Slow 'select measurement' rendering for InfluxDB [#2524](https://github.com/grafana/grafana/issues/2524), thx [@sbhenderson](https://github.com/sbhenderson)
- **Config**: Configurable signout menu activation [#7968](https://github.com/grafana/grafana/pull/7968), thx [@seuf](https://github.com/seuf)

## Fixes

- **Table Panel**: Fixed annotation display in table panel, [#8023](https://github.com/grafana/grafana/issues/8023)
- **Dashboard**: If refresh is blocked due to tab not visible, then refresh when it becomes visible [#8076](https://github.com/grafana/grafana/issues/8076) thanks [@SimenB](https://github.com/SimenB)
- **Snapshots**: Fixed problem with annotations & snapshots [#7659](https://github.com/grafana/grafana/issues/7659)
- **Graph**: MetricSegment loses type when value is an asterisk [#8277](https://github.com/grafana/grafana/issues/8277), thx [@Gordiychuk](https://github.com/Gordiychuk)
- **Alerting**: Alert notifications do not show charts when using a non public S3 bucket [#8250](https://github.com/grafana/grafana/issues/8250) thx [@rogerswingle](https://github.com/rogerswingle)
- **Graph**: 100% client CPU usage on red alert glow animation [#8222](https://github.com/grafana/grafana/issues/8222)
- **InfluxDB**: Templating: "All" query does match too much [#8165](https://github.com/grafana/grafana/issues/8165)
- **Dashboard**: Description tooltip is not fully displayed [#7970](https://github.com/grafana/grafana/issues/7970)
- **Proxy**: Redirect after switching Org does not obey sub path in root_url (using reverse proxy) [#8089](https://github.com/grafana/grafana/issues/8089)
- **Templating**: Restoration of ad-hoc variable from URL does not work correctly [#8056](https://github.com/grafana/grafana/issues/8056) thx [@tamayika](https://github.com/tamayika)
- **InfluxDB**: timeFilter cannot be used twice in alerts [#7969](https://github.com/grafana/grafana/issues/7969)
- **MySQL**: 4-byte UTF8 not supported when using MySQL database (allows Emojis) [#7958](https://github.com/grafana/grafana/issues/7958)
- **Alerting**: api/alerts and api/alert/:id hold previous data for "message" and "Message" field when field value is changed from "some string" to empty string. [#7927](https://github.com/grafana/grafana/issues/7927)
- **Graph**: Cannot add fill below to series override [#7916](https://github.com/grafana/grafana/issues/7916)
- **InfluxDB**: Influxb Data source test passes even if the Database doesn't exist [#7864](https://github.com/grafana/grafana/issues/7864)
- **Prometheus**: Displaying Prometheus annotations is incredibly slow [#7750](https://github.com/grafana/grafana/issues/7750), thx [@mtanda](https://github.com/mtanda)
- **Graphite**: grafana generates empty find query to graphite -> 422 Unprocessable Entity [#7740](https://github.com/grafana/grafana/issues/7740)
- **Admin**: make organization filter case insensitive [#8194](https://github.com/grafana/grafana/issues/8194), thx [@Alexander-N](https://github.com/Alexander-N)

## Changes

- **Elasticsearch**: Changed elasticsearch Terms aggregation to default to Min Doc Count to 1, and sort order to Top [#8321](https://github.com/grafana/grafana/issues/8321)

## Tech

- **Library Upgrade**: inconshreveable/log15 outdated - no support for solaris [#8262](https://github.com/grafana/grafana/issues/8262)
- **Library Upgrade**: Upgrade Macaron [#7600](https://github.com/grafana/grafana/issues/7600)

# 4.2.0 (2017-03-22)

## Minor Enhancements

- **Templates**: Prevent use of the prefix `__` for templates in web UI [#7678](https://github.com/grafana/grafana/issues/7678)
- **Threema**: Add emoji to Threema alert notifications [#7676](https://github.com/grafana/grafana/pull/7676) thx [@dbrgn](https://github.com/dbrgn)
- **Panels**: Support dm3 unit [#7695](https://github.com/grafana/grafana/issues/7695) thx [@mitjaziv](https://github.com/mitjaziv)
- **Docs**: Added some details about Sessions in Postgres [#7694](https://github.com/grafana/grafana/pull/7694) thx [@rickard-von-essen](https://github.com/rickard-von-essen)
- **Influxdb**: Allow commas in template variables [#7681](https://github.com/grafana/grafana/issues/7681) thx [@thuck](https://github.com/thuck)
- **Cloudwatch**: stop using deprecated session.New() [#7736](https://github.com/grafana/grafana/issues/7736) thx [@mtanda](https://github.com/mtanda)
  \*TSDB**: Fix always take dashboard timezone into consideration when handle custom time ranges**: Pass dropcounter rate option if no max counter and no reset value or reset value as 0 is specified [#7743](https://github.com/grafana/grafana/pull/7743) thx [@r4um](https://github.com/r4um)
- **Templating**: support full resolution for \$interval variable [#7696](https://github.com/grafana/grafana/pull/7696) thx [@mtanda](https://github.com/mtanda)
- **Elasticsearch**: Unique Count on string fields in ElasticSearch [#3536](https://github.com/grafana/grafana/issues/3536), thx [@pyro2927](https://github.com/pyro2927)
- **Templating**: Data source template variable that refers to other variable in regex filter [#6365](https://github.com/grafana/grafana/issues/6365) thx [@rlodge](https://github.com/rlodge)
- **Admin**: Global User List: add search and pagination [#7469](https://github.com/grafana/grafana/issues/7469)
- **User Management**: Invite UI is now disabled when login form is disabled [#7875](https://github.com/grafana/grafana/issues/7875)

## Bugfixes

- **Webhook**: Use proxy settings from environment variables [#7710](https://github.com/grafana/grafana/issues/7710)
- **Panels**: Deleting a dashboard with unsaved changes raises an error message [#7591](https://github.com/grafana/grafana/issues/7591) thx [@thuck](https://github.com/thuck)
- **Influxdb**: Query builder detects regex to easily for measurement [#7276](https://github.com/grafana/grafana/issues/7276) thx [@thuck](https://github.com/thuck)
- **Docs**: router_logging not documented [#7723](https://github.com/grafana/grafana/issues/7723)
- **Alerting**: Spelling mistake [#7739](https://github.com/grafana/grafana/pull/7739) thx [@woutersmit](https://github.com/woutersmit)
- **Alerting**: Graph legend scrolls to top when an alias is toggled/clicked [#7680](https://github.com/grafana/grafana/issues/7680) thx [@p4ddy1](https://github.com/p4ddy1)
- **Panels**: Fixed panel tooltip description after scrolling down [#7708](https://github.com/grafana/grafana/issues/7708) thx [@askomorokhov](https://github.com/askomorokhov)

# 4.2.0-beta1 (2017-02-27)

## Enhancements

- **Telegram**: Added Telegram alert notifier [#7098](https://github.com/grafana/grafana/pull/7098), thx [@leonoff](https://github.com/leonoff)
- **Templating**: Make $\_\_interval and $\_\_interval_ms global built in variables that can be used in by any data source (in panel queries), closes [#7190](https://github.com/grafana/grafana/issues/7190), closes [#6582](https://github.com/grafana/grafana/issues/6582)
- **S3 Image Store**: External s3 image store (used in alert notifications) now support AWS IAM Roles, closes [#6985](https://github.com/grafana/grafana/issues/6985), [#7058](https://github.com/grafana/grafana/issues/7058) thx [@mtanda](https://github.com/mtanda)
- **SingleStat**: Implements diff aggregation method for singlestat [#7234](https://github.com/grafana/grafana/issues/7234), thx [@oliverpool](https://github.com/oliverpool)
- **Dataproxy**: Added setting to enable more verbose logging in dataproxy [#7209](https://github.com/grafana/grafana/pull/7209), thx [@Ricky-N](https://github.com/Ricky-N)
- **Alerting**: Better information about why an alert triggered [#7035](https://github.com/grafana/grafana/issues/7035)
- **LINE**: Add LINE as alerting notification channel [#7301](https://github.com/grafana/grafana/pull/7301), thx [@huydx](https://github.com/huydx)
- **LINE**: Adds image to notification message [#7417](https://github.com/grafana/grafana/pull/7417), thx [@Erliz](https://github.com/Erliz)
- **Hipchat**: Adds support for sending alert notifications to hipchat [#6451](https://github.com/grafana/grafana/issues/6451), thx [@jregovic](https://github.com/jregovic)
- **Alerting**: Uploading images for alert notifications is now optional [#7419](https://github.com/grafana/grafana/issues/7419)
- **Dashboard**: Adds shortcut for collapsing/expanding all rows [#552](https://github.com/grafana/grafana/issues/552), thx [@mtanda](https://github.com/mtanda)
- **Alerting**: Adds de duping of alert notifications [#7632](https://github.com/grafana/grafana/pull/7632)
- **Orgs**: Sharing dashboards using Grafana share feature will now redirect to correct org. [#1613](https://github.com/grafana/grafana/issues/1613)
- **Pushover**: Add Pushover alert notifications [#7526](https://github.com/grafana/grafana/pull/7526) thx [@devkid](https://github.com/devkid)
- **Threema**: Add Threema Gateway alert notification integration [#7482](https://github.com/grafana/grafana/pull/7482) thx [@dbrgn](https://github.com/dbrgn)

## Minor Enhancements

- **Optimization**: Never issue refresh event when Grafana tab is not visible [#7218](https://github.com/grafana/grafana/issues/7218), thx [@mtanda](https://github.com/mtanda)
- **Browser History**: Browser back/forward now works time ranges / zoom, [#7259](https://github.com/grafana/grafana/issues/7259)
- **Elasticsearch**: Support for Min Doc Count options in Terms aggregation [#7324](https://github.com/grafana/grafana/pull/7324), thx [@lpic10](https://github.com/lpic10)
- **Elasticsearch**: Term aggregation limit can now be changed in template queries [#7112](https://github.com/grafana/grafana/issues/7112), thx [@FFalcon](https://github.com/FFalcon)
- **Elasticsearch**: Ad-hoc filters now support all operators [#7612](https://github.com/grafana/grafana/issues/7612), thx [@tamayika](https://github.com/tamayika)
- **Graph**: Add full series name as title for legends. [#7493](https://github.com/grafana/grafana/pull/7493), thx [@kolobaev](https://github.com/kolobaev)
- **Table**: Add a message when queries returns no data. [#6109](https://github.com/grafana/grafana/issues/6109), thx [@xginn8](https://github.com/xginn8)
- **Graph**: Set max width for series names in legend tables. [#2385](https://github.com/grafana/grafana/issues/2385), thx [@kolobaev](https://github.com/kolobaev)
- **Database**: Allow max db connection pool configuration [#7427](https://github.com/grafana/grafana/issues/7427), thx [@huydx](https://github.com/huydx)
- **Data Sources** Delete datsource by name [#7476](https://github.com/grafana/grafana/issues/7476), thx [@huydx](https://github.com/huydx)
- **Dataproxy**: Only allow get that begins with api/ to access Prometheus [#7459](https://github.com/grafana/grafana/pull/7459), thx [@mtanda](https://github.com/mtanda)
- **Snapshot**: Make timeout for snapshot creation configurable [#7449](https://github.com/grafana/grafana/pull/7449) thx [@ryu1-sakai](https://github.com/ryu1-sakai)
- **Panels**: Add more physics units [#7554](https://github.com/grafana/grafana/pull/7554) thx [@ryantxu](https://github.com/ryantxu)
- **Email**: Add sender's name on email [#2131](https://github.com/grafana/grafana/issues/2131) thx [@jacobbednarz](https://github.com/jacobbednarz)
- **HTTPS**: Set tls 1.2 as lowest tls version. [#7347](https://github.com/grafana/grafana/pull/7347) thx [@roman-vynar](https://github.com/roman-vynar)
- **Table**: Added suppressing of empty results to table plugin. [#7602](https://github.com/grafana/grafana/pull/7602) thx [@LLIyRiK](https://github.com/LLIyRiK)

## Tech

- **Library Upgrade**: Upgraded angularjs from 1.5.8 to 1.6.1 [#7274](https://github.com/grafana/grafana/issues/7274)
- **Backend**: Grafana is now built using golang 1.8

## Bugfixes

- **Alerting**: Fixes missing support for no_data and execution error when testing alerts [#7149](https://github.com/grafana/grafana/issues/7149)
- **Dashboard**: Avoid duplicate data in dashboard json for panels with alerts [#7256](https://github.com/grafana/grafana/pull/7256)
- **Alertlist**: Only show scrollbar when required [#7269](https://github.com/grafana/grafana/issues/7269)
- **SMTP**: Set LocalName to hostname [#7223](https://github.com/grafana/grafana/issues/7223)
- **Sidemenu**: Disable sign out in sidemenu for AuthProxyEnabled [#7377](https://github.com/grafana/grafana/pull/7377), thx [@solugebefola](https://github.com/solugebefola)
- **Prometheus**: Add support for basic auth in Prometheus tsdb package [#6799](https://github.com/grafana/grafana/issues/6799), thx [@hagen1778](https://github.com/hagen1778)
- **OAuth**: Redirect to original page when logging in with OAuth [#7513](https://github.com/grafana/grafana/issues/7513)
- **Annotations**: Wrap text in annotations tooltip [#7542](https://github.com/grafana/grafana/pull/7542), thx [@xginn8](https://github.com/xginn8)
- **Templating**: Fixes error when using numeric sort on empty strings [#7382](https://github.com/grafana/grafana/issues/7382)
- **Templating**: Fixed issue detecting template variable dependency [#7354](https://github.com/grafana/grafana/issues/7354)

# 4.1.2 (2017-02-13)

### Bugfixes

- **Table**: Fixes broken annotation rendering mode in the table panel [#7268](https://github.com/grafana/grafana/issues/7268)
- **Data Sources**: Sorting for lists of data sources in UI is now case insensitive [#7491](https://github.com/grafana/grafana/issues/7491)
- **Admin**: Support more then 1000 users in global users list [#7469](https://github.com/grafana/grafana/issues/7469)

# 4.1.1 (2017-01-11)

### Bugfixes

- **Graph Panel**: Fixed issue with legend height in table mode [#7221](https://github.com/grafana/grafana/issues/7221)

# 4.1.0 (2017-01-11)

### Bugfixes

- **Server side PNG rendering**: Fixed issue with y-axis label rotation in phantomjs rendered images [#6924](https://github.com/grafana/grafana/issues/6924)
- **Graph**: Fixed centering of y-axis label [#7099](https://github.com/grafana/grafana/issues/7099)
- **Graph**: Fixed graph legend table mode and always visible scrollbar [#6828](https://github.com/grafana/grafana/issues/6828)
- **Templating**: Fixed template variable value groups/tags feature [#6752](https://github.com/grafana/grafana/issues/6752)
- **Webhook**: Fixed webhook username mismatch [#7195](https://github.com/grafana/grafana/pull/7195), thx [@theisenmark](https://github.com/theisenmark)
- **Influxdb**: Handles time(auto) the same way as time(\$interval) [#6997](https://github.com/grafana/grafana/issues/6997)

## Enhancements

- **Elasticsearch**: Added support for all moving average options [#7154](https://github.com/grafana/grafana/pull/7154), thx [@vaibhavinbayarea](https://github.com/vaibhavinbayarea)

# 4.1-beta1 (2016-12-21)

### Enhancements

- **Postgres**: Add support for Certs for Postgres database [#6655](https://github.com/grafana/grafana/issues/6655)
- **Victorops**: Add VictorOps notification integration [#6411](https://github.com/grafana/grafana/issues/6411), thx [@ichekrygin](https://github.com/ichekrygin)
- **Opsgenie**: Add OpsGenie notification integration [#6687](https://github.com/grafana/grafana/issues/6687), thx [@kylemcc](https://github.com/kylemcc)
- **Singlestat**: New aggregation on singlestat panel [#6740](https://github.com/grafana/grafana/pull/6740), thx [@dirk-leroux](https://github.com/dirk-leroux)
- **Cloudwatch**: Make it possible to specify access and secret key on the data source config page [#6697](https://github.com/grafana/grafana/issues/6697)
- **Table**: Added Hidden Column Style for Table Panel [#5677](https://github.com/grafana/grafana/pull/5677), thx [@bmundt](https://github.com/bmundt)
- **Graph**: Shared crosshair option renamed to shared tooltip, shows tooltip on all graphs as you hover over one graph. [#1578](https://github.com/grafana/grafana/pull/1578), [#6274](https://github.com/grafana/grafana/pull/6274)
- **Elasticsearch**: Added support for Missing option (bucket) for terms aggregation [#4244](https://github.com/grafana/grafana/pull/4244), thx [@shanielh](https://github.com/shanielh)
- **Elasticsearch**: Added support for Elasticsearch 5.x [#5740](https://github.com/grafana/grafana/issues/5740), thx [@lpic10](https://github.com/lpic10)
- **CLI**: Make it possible to reset the admin password using the grafana-cli. [#5479](https://github.com/grafana/grafana/issues/5479)
- **Influxdb**: Support multiple tags in InfluxDB annotations. [#4550](https://github.com/grafana/grafana/pull/4550), thx [@adrianlzt](https://github.com/adrianlzt)
- **LDAP**: Basic Auth now supports LDAP username and password, [#6940](https://github.com/grafana/grafana/pull/6940), thx [@utkarshcmu](https://github.com/utkarshcmu)
- **LDAP**: Now works with Auth Proxy, role and organization mapping & sync will regularly be performed. [#6895](https://github.com/grafana/grafana/pull/6895), thx [@Seuf](https://github.com/seuf)
- **Alerting**: Adds OK as no data option. [#6866](https://github.com/grafana/grafana/issues/6866)
- **Alert list**: Order alerts based on state. [#6676](https://github.com/grafana/grafana/issues/6676)
- **Alerting**: Add api endpoint for pausing all alerts. [#6589](https://github.com/grafana/grafana/issues/6589)
- **Panel**: Added help text for panels. [#4079](https://github.com/grafana/grafana/issues/4079), thx [@utkarshcmu](https://github.com/utkarshcmu)

### Bugfixes

- **API**: HTTP API for deleting org returning incorrect message for a non-existing org [#6679](https://github.com/grafana/grafana/issues/6679)
- **Dashboard**: Posting empty dashboard result in corrupted dashboard [#5443](https://github.com/grafana/grafana/issues/5443)
- **Logging**: Fixed logging level config issue [#6978](https://github.com/grafana/grafana/issues/6978)
- **Notifications**: Remove html escaping the email subject. [#6905](https://github.com/grafana/grafana/issues/6905)
- **Influxdb**: Fixes broken field dropdown when using template vars as measurement. [#6473](https://github.com/grafana/grafana/issues/6473)

# 4.0.2 (2016-12-08)

### Enhancements

- **Playlist**: Add support for kiosk mode [#6727](https://github.com/grafana/grafana/issues/6727)

### Bugfixes

- **Alerting**: Add alert message to webhook notifications [#6807](https://github.com/grafana/grafana/issues/6807)
- **Alerting**: Fixes a bug where avg() reducer treated null as zero. [#6879](https://github.com/grafana/grafana/issues/6879)
- **PNG Rendering**: Fix for server side rendering when using non default http addr bind and domain setting [#6813](https://github.com/grafana/grafana/issues/6813)
- **PNG Rendering**: Fix for server side rendering when setting enforce_domain to true [#6769](https://github.com/grafana/grafana/issues/6769)
- **Webhooks**: Add content type json to outgoing webhooks [#6822](https://github.com/grafana/grafana/issues/6822)
- **Keyboard shortcut**: Fixed zoom out shortcut [#6837](https://github.com/grafana/grafana/issues/6837)
- **Webdav**: Adds basic auth headers to webdav uploader [#6779](https://github.com/grafana/grafana/issues/6779)

# 4.0.1 (2016-12-02)

> **Notice**
> 4.0.0 had serious connection pooling issue when using a data source in proxy access. This bug caused lots of resource issues
> due to too many connections/file handles on the data source backend. This problem is fixed in this release.

### Bugfixes

- **Metrics**: Fixes nil pointer dereference on my arm build [#6749](https://github.com/grafana/grafana/issues/6749)
- **Data proxy**: Fixes a tcp pooling issue in the data source reverse proxy [#6759](https://github.com/grafana/grafana/issues/6759)

# 4.0-stable (2016-11-29)

### Bugfixes

- **Server-side rendering**: Fixed address used when rendering panel via phantomjs and using non default http_addr config [#6660](https://github.com/grafana/grafana/issues/6660)
- **Graph panel**: Fixed graph panel tooltip sort order issue [#6648](https://github.com/grafana/grafana/issues/6648)
- **Unsaved changes**: You now navigate to the intended page after saving in the unsaved changes dialog [#6675](https://github.com/grafana/grafana/issues/6675)
- **TLS Client Auth**: Support for TLS client authentication for data source proxies [#2316](https://github.com/grafana/grafana/issues/2316)
- **Alerts out of sync**: Saving dashboards with broken alerts causes sync problem[#6576](https://github.com/grafana/grafana/issues/6576)
- **Alerting**: Saving an alert with condition "HAS NO DATA" throws an error[#6701](https://github.com/grafana/grafana/issues/6701)
- **Config**: Improve error message when parsing broken config file [#6731](https://github.com/grafana/grafana/issues/6731)
- **Table**: Render empty dates as - instead of current date [#6728](https://github.com/grafana/grafana/issues/6728)

# 4.0-beta2 (2016-11-21)

### Bugfixes

- **Graph Panel**: Log base scale on right Y-axis had no effect, max value calc was not applied, [#6534](https://github.com/grafana/grafana/issues/6534)
- **Graph Panel**: Bar width if bars was only used in series override, [#6528](https://github.com/grafana/grafana/issues/6528)
- **UI/Browser**: Fixed issue with page/view header gradient border not showing in Safari, [#6530](https://github.com/grafana/grafana/issues/6530)
- **Cloudwatch**: Fixed cloudwatch data source requesting to many datapoints, [#6544](https://github.com/grafana/grafana/issues/6544)
- **UX**: Panel Drop zone visible after duplicating panel, and when entering fullscreen/edit view, [#6598](https://github.com/grafana/grafana/issues/6598)
- **Templating**: Newly added variable was not visible directly only after dashboard reload, [#6622](https://github.com/grafana/grafana/issues/6622)

### Enhancements

- **Singlestat**: Support repeated template variables in prefix/postfix [#6595](https://github.com/grafana/grafana/issues/6595)
- **Templating**: Don't persist variable options with refresh option [#6586](https://github.com/grafana/grafana/issues/6586)
- **Alerting**: Add ability to have OR conditions (and mixing AND & OR) [#6579](https://github.com/grafana/grafana/issues/6579)
- **InfluxDB**: Fix for Ad-Hoc Filters variable & changing dashboards [#6821](https://github.com/grafana/grafana/issues/6821)

# 4.0-beta1 (2016-11-09)

### Enhancements

- **Login**: Adds option to disable username/password logins, closes [#4674](https://github.com/grafana/grafana/issues/4674)
- **SingleStat**: Add seriesName as option in singlestat panel, closes [#4740](https://github.com/grafana/grafana/issues/4740)
- **Localization**: Week start day now dependent on browser locale setting, closes [#3003](https://github.com/grafana/grafana/issues/3003)
- **Templating**: Update panel repeats for variables that change on time refresh, closes [#5021](https://github.com/grafana/grafana/issues/5021)
- **Templating**: Add support for numeric and alphabetical sorting of variable values, closes [#2839](https://github.com/grafana/grafana/issues/2839)
- **Elasticsearch**: Support to set Precision Threshold for Unique Count metric, closes [#4689](https://github.com/grafana/grafana/issues/4689)
- **Navigation**: Add search to org switcher, closes [#2609](https://github.com/grafana/grafana/issues/2609)
- **Database**: Allow database config using one property, closes [#5456](https://github.com/grafana/grafana/pull/5456)
- **Graphite**: Add support for groupByNodes, closes [#5613](https://github.com/grafana/grafana/pull/5613)
- **Influxdb**: Add support for elapsed(), closes [#5827](https://github.com/grafana/grafana/pull/5827)
- **OpenTSDB**: Add support for explicitTags for OpenTSDB>=2.3, closes [#6360](https://github.com/grafana/grafana/pull/6361)
- **OAuth**: Add support for generic oauth, closes [#4718](https://github.com/grafana/grafana/pull/4718)
- **Cloudwatch**: Add support to expand multi select template variable, closes [#5003](https://github.com/grafana/grafana/pull/5003)
- **Background Tasks**: Now support automatic purging of old snapshots, closes [#4087](https://github.com/grafana/grafana/issues/4087)
- **Background Tasks**: Now support automatic purging of old rendered images, closes [#2172](https://github.com/grafana/grafana/issues/2172)
- **Dashboard**: After inactivity hide nav/row actions, fade to nice clean view, can be toggled with `d v`, also added kiosk mode, toggled via `d k` [#6476](https://github.com/grafana/grafana/issues/6476)
- **Dashboard**: Improved dashboard row menu & add panel UX [#6442](https://github.com/grafana/grafana/issues/6442)
- **Graph Panel**: Support for stacking null values [#2912](https://github.com/grafana/grafana/issues/2912), [#6287](https://github.com/grafana/grafana/issues/6287), thanks @benrubson!

### Breaking changes

- **SystemD**: Change systemd description, closes [#5971](https://github.com/grafana/grafana/pull/5971)
- **lodash upgrade**: Upgraded lodash from 2.4.2 to 4.15.0, this contains a number of breaking changes that could effect plugins. closes [#6021](https://github.com/grafana/grafana/pull/6021)

### Bug fixes

- **Table Panel**: Fixed problem when switching to Mixed data source in metrics tab, fixes [#5999](https://github.com/grafana/grafana/pull/5999)
- **Playlist**: Fixed problem with play order not matching order defined in playlist, fixes [#5467](https://github.com/grafana/grafana/pull/5467)
- **Graph panel**: Fixed problem with auto decimals on y axis when datamin=datamax, fixes [#6070](https://github.com/grafana/grafana/pull/6070)
- **Snapshot**: Can view embedded panels/png rendered panels in snapshots without login, fixes [#3769](https://github.com/grafana/grafana/pull/3769)
- **Elasticsearch**: Fix for query template variable when looking up terms without query, no longer relies on elasticsearch default field, fixes [#3887](https://github.com/grafana/grafana/pull/3887)
- **Elasticsearch**: Fix for displaying IP address used in terms aggregations, fixes [#4393](https://github.com/grafana/grafana/pull/4393)
- **PNG Rendering**: Fix for server side rendering when using auth proxy, fixes [#5906](https://github.com/grafana/grafana/pull/5906)
- **OpenTSDB**: Fixed multi-value nested templating for opentsdb, fixes [#6455](https://github.com/grafana/grafana/pull/6455)
- **Playlist**: Remove playlist items when dashboard is removed, fixes [#6292](https://github.com/grafana/grafana/issues/6292)
