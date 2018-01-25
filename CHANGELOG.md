# 5.0.0 (unreleased / master branch)

Grafana v5.0 is going to be the biggest and most foundational release Grafana has ever had, coming with a ton of UX improvements, a new dashboard grid engine, dashboard folders, user teams and permissions. Checkout out this [video preview](https://www.youtube.com/watch?v=BC_YRNpqj5k) of Grafana v5.

### New Features
- **Dashboards** Dashboard folders, [#1611](https://github.com/grafana/grafana/issues/1611)
- **Teams** User groups (teams) implemented. Can be used in folder & dashboard permission list.
- **Dashboard grid**: Panels are now layed out in a two dimensional grid (with x, y, w, h). [#9093](https://github.com/grafana/grafana/issues/9093).
- **Templating**: Vertical repeat direction for panel repeats.
- **UX**: Major update to page header and navigation
- **Dashboard settings**: Combine dashboard settings views into one with side menu, [#9750](https://github.com/grafana/grafana/issues/9750)

## New Dashboard Grid

The new grid engine is major upgrade for how you can position and move panels. It enables new layouts and a much easier dashboard building experience. The change is backwards compatible. Grafana will automatically upgrade your dashboards to the new schema and position panels to match your existing layout. There might be minor differences in panel height.

Dashboard panels and rows are positioned using a gridPos object `{x: 0, y: 0, w: 24, h: 5}`. Units are in grid dimensions (24 columns, 1 height unit 30px). Rows and Panels objects exist (together) in a flat array directly on the dashboard root object. Rows are not needed for layouts anymore and are mainly there for backward compatibility. Some panel plugins that do not respect their panel height might require an update.

## New Features
* **Alerting**: Add support for internal image store [#6922](https://github.com/grafana/grafana/issues/6922), thx [@FunkyM](https://github.com/FunkyM)

## Minor
* **Graph**: Don't hide graph display options (Lines/Points) when draw mode is unchecked [#9770](https://github.com/grafana/grafana/issues/9770), thx [@Jonnymcc](https://github.com/Jonnymcc)
* **Prometheus**: Show label name in paren after by/without/on/ignoring/group_left/group_right [#9664](https://github.com/grafana/grafana/pull/9664), thx [@mtanda](https://github.com/mtanda)

# 4.7.0 (unreleased / v4.7.x branch)

## Breaking changes

`[dashboard.json]` have been replaced with [dashboard provisioning](http://docs.grafana.org/administration/provisioning/).

Config files for provisioning datasources as configuration have changed from `/conf/datasources` to `/conf/provisioning/datasources`.
From `/etc/grafana/datasources` to `/etc/grafana/provisioning/datasources` when installed with deb/rpm packages.

The pagerduty notifier now defaults to not auto resolve incidents. More details at [#10222](https://github.com/grafana/grafana/issues/10222)

## New Features
* **Data Source Proxy**: Add support for whitelisting specified cookies that will be passed through to the data source when proxying data source requests [#5457](https://github.com/grafana/grafana/issues/5457), thanks [@robingustafsson](https://github.com/robingustafsson)
* **Postgres/MySQL**: add __timeGroup macro for mysql [#9596](https://github.com/grafana/grafana/pull/9596), thanks [@svenklemm](https://github.com/svenklemm)
* **Text**: Text panel are now edited in the ace editor. [#9698](https://github.com/grafana/grafana/pull/9698), thx [@mtanda](https://github.com/mtanda)
* **Teams**: Add Microsoft Teams notifier as  [#8523](https://github.com/grafana/grafana/issues/8523), thx [@anthu](https://github.com/anthu)
* **Datasources**: Its now possible to configure datasources with config files [#1789](https://github.com/grafana/grafana/issues/1789)
* **Graphite**: Query editor updated to support new query by tag features [#9230](https://github.com/grafana/grafana/issues/9230)
* **Dashboard history**: New config file option versions_to_keep sets how many versions per dashboard to store, [#9671](https://github.com/grafana/grafana/issues/9671)
* **Dashboard as cfg**: Load dashboards from file into Grafana on startup/change [#9654](https://github.com/grafana/grafana/issues/9654) [#5269](https://github.com/grafana/grafana/issues/5269)
* **Prometheus**: Grafana can now send alerts to Prometheus Alertmanager while firing [#7481](https://github.com/grafana/grafana/issues/7481), thx [@Thib17](https://github.com/Thib17) and [@mtanda](https://github.com/mtanda)
* **Table**: Support multiple table formated queries in table panel [#9170](https://github.com/grafana/grafana/issues/9170), thx [@davkal](https://github.com/davkal)

## Minor
* **Alert panel**: Adds placeholder text when no alerts are within the time range [#9624](https://github.com/grafana/grafana/issues/9624), thx [@straend](https://github.com/straend)
* **Mysql**: MySQL enable MaxOpenCon and MaxIdleCon regards how constring is configured.  [#9784](https://github.com/grafana/grafana/issues/9784), thx [@dfredell](https://github.com/dfredell)
* **Cloudwatch**: Fixes broken query inspector for cloudwatch [#9661](https://github.com/grafana/grafana/issues/9661), thx [@mtanda](https://github.com/mtanda)
* **Dashboard**: Make it possible to start dashboards from search and dashboard list panel [#1871](https://github.com/grafana/grafana/issues/1871)
* **Annotations**: Posting annotations now return the id of the annotation [#9798](https://github.com/grafana/grafana/issues/9798)
* **Systemd**: Use systemd notification ready flag [#10024](https://github.com/grafana/grafana/issues/10024), thx [@jgrassler](https://github.com/jgrassler)
* **Github**: Use organizations_url provided from github to verify user belongs in org. [#10111](https://github.com/grafana/grafana/issues/10111), thx
[@adiletmaratov](https://github.com/adiletmaratov)
* **Backend**: Fixed bug where Grafana exited before all sub routines where finished [#10131](https://github.com/grafana/grafana/issues/10131)
* **Azure**: Adds support for Azure blob storage as external image stor [#8955](https://github.com/grafana/grafana/issues/8955), thx [@saada](https://github.com/saada)
* **Telegram**: Add support for inline image uploads to telegram notifier plugin [#9967](https://github.com/grafana/grafana/pull/9967), thx [@rburchell](https://github.com/rburchell)

## Tech
* **RabbitMq**: Remove support for publishing events to RabbitMQ [#9645](https://github.com/grafana/grafana/issues/9645)


## Fixes
* **Sensu**: Send alert message to sensu output [#9551](https://github.com/grafana/grafana/issues/9551), thx [@cjchand](https://github.com/cjchand)
* **Singlestat**: suppress error when result contains no datapoints [#9636](https://github.com/grafana/grafana/issues/9636), thx [@utkarshcmu](https://github.com/utkarshcmu)
* **Postgres/MySQL**: Control quoting in SQL-queries when using template variables [#9030](https://github.com/grafana/grafana/issues/9030), thanks [@svenklemm](https://github.com/svenklemm)
* **Pagerduty**: Pagerduty dont auto resolve incidents by default anymore. [#10222](https://github.com/grafana/grafana/issues/10222)

# 4.6.3 (2017-12-14)

## Fixes
* **Gzip**: Fixes bug gravatar images when gzip was enabled [#5952](https://github.com/grafana/grafana/issues/5952)
* **Alert list**: Now shows alert state changes even after adding manual annotations on dashboard [#9951](https://github.com/grafana/grafana/issues/9951)
* **Alerting**: Fixes bug where rules evaluated as firing when all conditions was false and using OR operator. [#9318](https://github.com/grafana/grafana/issues/9318)
* **Cloudwatch**: CloudWatch no longer display metrics' default alias [#10151](https://github.com/grafana/grafana/issues/10151), thx [@mtanda](https://github.com/mtanda)

# 4.6.2 (2017-11-16)

## Important
* **Prometheus**: Fixes bug with new prometheus alerts in Grafana. Make sure to download this version if your using Prometheus for alerting. More details in the issue. [#9777](https://github.com/grafana/grafana/issues/9777)

## Fixes
* **Color picker**: Bug after using textbox input field to change/paste color string [#9769](https://github.com/grafana/grafana/issues/9769)
* **Cloudwatch**: Fix for cloudwatch templating query `ec2_instance_attribute` [#9667](https://github.com/grafana/grafana/issues/9667), thanks [@mtanda](https://github.com/mtanda)
* **Heatmap**: Fixed tooltip for "time series buckets" mode [#9332](https://github.com/grafana/grafana/issues/9332)
* **InfluxDB**: Fixed query editor issue when using `>` or `<` operators in WHERE clause [#9871](https://github.com/grafana/grafana/issues/9871)


# 4.6.1 (2017-11-01)

* **Singlestat**: Lost thresholds when using save dashboard as [#9681](https://github.com/grafana/grafana/issues/9681)
* **Graph**: Fix for series override color picker [#9715](https://github.com/grafana/grafana/issues/9715)
* **Go**: build using golang 1.9.2 [#9713](https://github.com/grafana/grafana/issues/9713)
* **Plugins**: Fixed problem with loading plugin js files behind auth proxy [#9509](https://github.com/grafana/grafana/issues/9509)
* **Graphite**: Annotation tooltip should render empty string when undefined [#9707](https://github.com/grafana/grafana/issues/9707)

# 4.6.0 (2017-10-26)

## Fixes
* **Alerting**: Viewer can no longer pause alert rules [#9640](https://github.com/grafana/grafana/issues/9640)
* **Playlist**: Bug where playlist controls was missing [#9639](https://github.com/grafana/grafana/issues/9639)
* **Firefox**: Creating region annotations now work in firefox [#9638](https://github.com/grafana/grafana/issues/9638)

# 4.6.0-beta3 (2017-10-23)

## Fixes
* **Prometheus**: Fix for browser crash for short time ranges. [#9575](https://github.com/grafana/grafana/issues/9575)
* **Heatmap**: Fix for y-axis not showing. [#9576](https://github.com/grafana/grafana/issues/9576)
* **Save to file**: Fix for save to file in export modal. [#9586](https://github.com/grafana/grafana/issues/9586)
* **Postgres**: modify group by time macro so it can be used in select clause [#9527](https://github.com/grafana/grafana/pull/9527), thanks [@svenklemm](https://github.com/svenklemm)

# 4.6.0-beta2 (2017-10-17)

## Fixes
* **ColorPicker**: Fix for color picker not showing [#9549](https://github.com/grafana/grafana/issues/9549)
* **Alerting**: Fix for broken test rule button in alert tab [#9539](https://github.com/grafana/grafana/issues/9539)
* **Cloudwatch**: Provide error message when failing to add cloudwatch datasource [#9534](https://github.com/grafana/grafana/pull/9534), thx [@mtanda](https://github.com/mtanda)
* **Cloudwatch**: Fix unused period parameter [#9536](https://github.com/grafana/grafana/pull/9536), thx [@mtanda](https://github.com/mtanda)
* **CSV Export**: Fix for broken CSV export [#9525](https://github.com/grafana/grafana/issues/9525)
* **Text panel**: Fix for issue with break lines in Firefox [#9491](https://github.com/grafana/grafana/issues/9491)
* **Annotations**: Fix for issue saving annotation event in MySQL DB [#9550](https://github.com/grafana/grafana/issues/9550), thanks [@krise3k](https://github.com/krise3k)


# 4.6.0-beta1 (2017-10-13)

## New Features
* **Annotations**: Add support for creating annotations from graph panel [#8197](https://github.com/grafana/grafana/pull/8197)
* **GCS**: Adds support for Google Cloud Storage [#8370](https://github.com/grafana/grafana/issues/8370) thx [@chuhlomin](https://github.com/chuhlomin)
* **Prometheus**: Adds /metrics endpoint for exposing Grafana metrics. [#9187](https://github.com/grafana/grafana/pull/9187)
* **Graph**: Add support for local formating in axis. [#1395](https://github.com/grafana/grafana/issues/1395), thx [@m0nhawk](https://github.com/m0nhawk)
* **Jaeger**: Add support for open tracing using jaeger in Grafana. [#9213](https://github.com/grafana/grafana/pull/9213)
* **Unit types**: New date & time unit types added, useful in singlestat to show dates & times. [#3678](https://github.com/grafana/grafana/issues/3678), [#6710](https://github.com/grafana/grafana/issues/6710), [#2764](https://github.com/grafana/grafana/issues/2764)
* **CLI**: Make it possible to install plugins from any url [#5873](https://github.com/grafana/grafana/issues/5873)
* **Prometheus**: Add support for instant queries [#5765](https://github.com/grafana/grafana/issues/5765), thx [@mtanda](https://github.com/mtanda)
* **Cloudwatch**: Add support for alerting using the cloudwatch datasource [#8050](https://github.com/grafana/grafana/pull/8050), thx [@mtanda](https://github.com/mtanda)
* **Pagerduty**: Include triggering series in pagerduty notification [#8479](https://github.com/grafana/grafana/issues/8479), thx [@rickymoorhouse](https://github.com/rickymoorhouse)
* **Timezone**: Time ranges like Today & Yesterday now work correctly when timezone setting is set to UTC [#8916](https://github.com/grafana/grafana/issues/8916), thx [@ctide](https://github.com/ctide)
* **Prometheus**: Align $__interval with the step parameters. [#9226](https://github.com/grafana/grafana/pull/9226), thx [@alin-amana](https://github.com/alin-amana)
* **Prometheus**: Autocomplete for label name and label value [#9208](https://github.com/grafana/grafana/pull/9208), thx [@mtanda](https://github.com/mtanda)
* **Postgres**: New Postgres data source [#9209](https://github.com/grafana/grafana/pull/9209), thx [@svenklemm](https://github.com/svenklemm)
* **Datasources**: Make datasource HTTP requests verify TLS by default. closes [#9371](https://github.com/grafana/grafana/issues/9371), [#5334](https://github.com/grafana/grafana/issues/5334), [#8812](https://github.com/grafana/grafana/issues/8812), thx [@mattbostock](https://github.com/mattbostock)
* **OAuth**: Verify TLS during OAuth callback [#9373](https://github.com/grafana/grafana/issues/9373), thx [@mattbostock](https://github.com/mattbostock)

## Minor
* **SMTP**: Make it possible to set specific HELO for smtp client. [#9319](https://github.com/grafana/grafana/issues/9319)
* **Dataproxy**: Allow grafana to renegotiate tls connection [#9250](https://github.com/grafana/grafana/issues/9250)
* **HTTP**: set net.Dialer.DualStack to true for all http clients [#9367](https://github.com/grafana/grafana/pull/9367)
* **Alerting**: Add diff and percent diff as series reducers [#9386](https://github.com/grafana/grafana/pull/9386), thx [@shanhuhai5739](https://github.com/shanhuhai5739)
* **Slack**: Allow images to be uploaded to slack when Token is present [#7175](https://github.com/grafana/grafana/issues/7175), thx [@xginn8](https://github.com/xginn8)
* **Opsgenie**: Use their latest API instead of old version [#9399](https://github.com/grafana/grafana/pull/9399), thx [@cglrkn](https://github.com/cglrkn)
* **Table**: Add support for displaying the timestamp with milliseconds [#9429](https://github.com/grafana/grafana/pull/9429), thx [@s1061123](https://github.com/s1061123)
* **Hipchat**: Add metrics, message and image to hipchat notifications [#9110](https://github.com/grafana/grafana/issues/9110), thx [@eloo](https://github.com/eloo)
* **Kafka**: Add support for sending alert notifications to kafka [#7104](https://github.com/grafana/grafana/issues/7104), thx [@utkarshcmu](https://github.com/utkarshcmu)
* **Alerting**: add count_non_null as series reducer [#9516](https://github.com/grafana/grafana/issues/9516)

## Tech
* **Go**: Grafana is now built using golang 1.9
* **Webpack**: Changed from systemjs to webpack (see readme or building from source guide for new build instructions). Systemjs is still used to load plugins but now plugins can only import a limited set of dependencies. See [PLUGIN_DEV.md](https://github.com/grafana/grafana/blob/master/PLUGIN_DEV.md) for more details on how this can effect some plugins.

# 4.5.2 (2017-09-22)

## Fixes
* **Graphite**: Fix for issues with jsonData & graphiteVersion null errors [#9258](https://github.com/grafana/grafana/issues/9258)
* **Graphite**: Fix for Grafana internal metrics to Graphite sending NaN values [#9279](https://github.com/grafana/grafana/issues/9279)
* **HTTP API**: Fix for HEAD method requests [#9307](https://github.com/grafana/grafana/issues/9307)
* **Templating**: Fix for duplicate template variable queries when refresh is set to time range change [#9185](https://github.com/grafana/grafana/issues/9185)
* **Metrics**: dont write NaN values to graphite [#9279](https://github.com/grafana/grafana/issues/9279)

# 4.5.1 (2017-09-15)

## Fixes
* **MySQL**: Fixed issue with query editor not showing [#9247](https://github.com/grafana/grafana/issues/9247)

## Breaking changes
* **Metrics**: The metric structure for internal metrics about Grafana published to graphite has changed. This might break dashboards for internal metrics.

# 4.5.0 (2017-09-14)

## Fixes & Enhancements since beta1
* **Security**: Security fix for api vulnerability (in multiple org setups).
* **Shortcuts**: Adds shortcut for creating new dashboard [#8876](https://github.com/grafana/grafana/pull/8876) thx [@mtanda](https://github.com/mtanda)
* **Graph**: Right Y-Axis label position fixed [#9172](https://github.com/grafana/grafana/pull/9172)
* **General**: Improve rounding of time intervals [#9197](https://github.com/grafana/grafana/pull/9197), thx [@alin-amana](https://github.com/alin-amana)

# 4.5.0-beta1 (2017-09-05)

## New Features

* **Table panel**: Render cell values as links that can have an url template that uses variables from current table row. [#3754](https://github.com/grafana/grafana/issues/3754)
* **Elasticsearch**: Add ad hoc filters directly by clicking values in table panel [#8052](https://github.com/grafana/grafana/issues/8052).
* **MySQL**: New rich query editor with syntax highlighting
* **Prometheus**: New rich query editor with syntax highlighting, metric & range auto complete and integrated function docs. [#5117](https://github.com/grafana/grafana/issues/5117)

## Enhancements

* **GitHub OAuth**: Support for GitHub organizations with 100+ teams. [#8846](https://github.com/grafana/grafana/issues/8846), thx [@skwashd](https://github.com/skwashd)
* **Graphite**: Calls to Graphite api /metrics/find now include panel or dashboad time range (from & until) in most cases, [#8055](https://github.com/grafana/grafana/issues/8055)
* **Graphite**: Added new graphite 1.0 functions, available if you set version to 1.0.x in data source settings. New Functions: mapSeries, reduceSeries, isNonNull, groupByNodes, offsetToZero, grep, weightedAverage, removeEmptySeries, aggregateLine, averageOutsidePercentile, delay, exponentialMovingAverage, fallbackSeries, integralByInterval, interpolate, invert, linearRegression, movingMin, movingMax, movingSum, multiplySeriesWithWildcards, pow, powSeries, removeBetweenPercentile, squareRoot, timeSlice, closes [#8261](https://github.com/grafana/grafana/issues/8261)
- **Elasticsearch**: Ad-hoc filters now use query phrase match filters instead of term filters, works on non keyword/raw fields [#9095](https://github.com/grafana/grafana/issues/9095).

### Breaking change

* **InfluxDB/Elasticsearch**: The panel & data source option named "Group by time interval" is now named "Min time interval" and does now always define a lower limit for the auto group by time. Without having to use `>` prefix (that prefix still works). This should in theory have close to zero actual impact on existing dashboards. It does mean that if you used this setting to define a hard group by time interval of, say "1d", if you zoomed to a time range wide enough the time range could increase above the "1d" range as the setting is now always considered a lower limit.
* **Elasticsearch**: Elasticsearch metric queries without date histogram now return table formated data making table panel much easier to use for this use case. Should not break/change existing dashboards with stock panels but external panel plugins can be affected.

## Changes

* **InfluxDB**: Change time range filter for absolute time ranges to be inclusive instead of exclusive [#8319](https://github.com/grafana/grafana/issues/8319), thx [@Oxydros](https://github.com/Oxydros)
* **InfluxDB**: Added paranthesis around tag filters in queries [#9131](https://github.com/grafana/grafana/pull/9131)

## Bug Fixes

* **Modals**: Maintain scroll position after opening/leaving modal [#8800](https://github.com/grafana/grafana/issues/8800)
* **Templating**: You cannot select data source variables as data source for other template variables [#7510](https://github.com/grafana/grafana/issues/7510)
* **MySQL/Postgres**: Fix for max_idle_conn option default which was wrongly set to zero which does not mean unlimited but means zero, which in practice kind of disables connection pooling, which is not good. Fixes [#8513](https://github.com/grafana/grafana/issues/8513)

# 4.4.3 (2017-08-07)

## Bug Fixes

* **Search**: Fix for issue that casued search view to hide  when you clicked starred or tags filters, fixes [#8981](https://github.com/grafana/grafana/issues/8981)
* **Modals**: ESC key now closes modal again, fixes [#8981](https://github.com/grafana/grafana/issues/8988), thx [@j-white](https://github.com/j-white)

# 4.4.2 (2017-08-01)

## Bug Fixes

* **GrafanaDB(mysql)**: Fix for dashboard_version.data column type, now changed to MEDIUMTEXT, fixes [#8813](https://github.com/grafana/grafana/issues/8813)
* **Dashboard(settings)**: Closing setting views using ESC key did not update url correctly, fixes [#8869](https://github.com/grafana/grafana/issues/8869)
* **InfluxDB**: Wrong username/password parameter name when using direct access, fixes [#8789](https://github.com/grafana/grafana/issues/8789)
* **Forms(TextArea)**: Bug fix for no scroll in text areas [#8797](https://github.com/grafana/grafana/issues/8797)
* **Png Render API**: Bug fix for timeout url parameter. It now works as it should. Default value was also increased from 30 to 60 seconds [#8710](https://github.com/grafana/grafana/issues/8710)
* **Search**: Fix for not being able to close search by clicking on right side of search result container, [8848](https://github.com/grafana/grafana/issues/8848)
* **Cloudwatch**: Fix for using variables in templating metrics() query, [8965](https://github.com/grafana/grafana/issues/8965)

## Changes

* **Settings(defaults)**: allow_sign_up default changed from true to false [#8743](https://github.com/grafana/grafana/issues/8743)
* **Settings(defaults)**: allow_org_create default changed from true to false

# 4.4.1 (2017-07-05)

## Bug Fixes

* **Migrations**: migration fails where dashboard.created_by is null [#8783](https://github.com/grafana/grafana/issues/8783)

# 4.4.0 (2017-07-04)

## New Features
**Dashboard History**: View dashboard version history, compare any two versions (summary & json diffs), restore to old version. This big feature
was contributed by **Walmart Labs**. Big thanks to them for this massive contribution!
Initial feature request: [#4638](https://github.com/grafana/grafana/issues/4638)
Pull Request: [#8472](https://github.com/grafana/grafana/pull/8472)

## Enhancements
* **Elasticsearch**: Added filter aggregation label [#8420](https://github.com/grafana/grafana/pull/8420), thx [@tianzk](github.com/tianzk)
* **Sensu**: Added option for source and handler [#8405](https://github.com/grafana/grafana/pull/8405), thx [@joemiller](github.com/joemiller)
* **CSV**: Configurable csv export datetime format [#8058](https://github.com/grafana/grafana/issues/8058), thx [@cederigo](github.com/cederigo)
* **Table Panel**: Column style that preserves formatting/indentation (like pre tag) [#6617](https://github.com/grafana/grafana/issues/6617)
* **DingDing**: Add DingDing Alert Notifier [#8473](https://github.com/grafana/grafana/pull/8473) thx [@jiamliang](https://github.com/jiamliang)

## Minor Enhancements

* **Elasticsearch**: Add option for result set size in raw_document [#3426](https://github.com/grafana/grafana/issues/3426) [#8527](https://github.com/grafana/grafana/pull/8527), thx [@mk-dhia](github.com/mk-dhia)

## Bug Fixes

* **Graph**: Bug fix for negative values in histogram mode [#8628](https://github.com/grafana/grafana/issues/8628)

# 4.3.2 (2017-05-31)

## Bug fixes

* **InfluxDB**: Fixed issue with query editor not showing ALIAS BY input field when in text editor mode [#8459](https://github.com/grafana/grafana/issues/8459)
* **Graph Log Scale**: Fixed issue with log scale going below x-axis [#8244](https://github.com/grafana/grafana/issues/8244)
* **Playlist**: Fixed dashboard play order issue [#7688](https://github.com/grafana/grafana/issues/7688)
* **Elasticsearch**: Fixed table query issue with ES 2.x [#8467](https://github.com/grafana/grafana/issues/8467), thx [@goldeelox](https://github.com/goldeelox)

## Changes
* **Lazy Loading Of Panels**: Panels are no longer loaded as they are scrolled into view, this was reverted due to Chrome bug, might be reintroduced when Chrome fixes it's JS blocking behavior on scroll. [#8500](https://github.com/grafana/grafana/issues/8500)

# 4.3.1 (2017-05-23)

## Bug fixes

* **S3 image upload**: Fixed image url issue for us-east-1 (us standard) region. If you were missing slack images for alert notifications this should fix it. [#8444](https://github.com/grafana/grafana/issues/8444)

# 4.3.0-stable (2017-05-23)

## Bug fixes

* **Gzip**: Fixed crash when gzip was enabled [#8380](https://github.com/grafana/grafana/issues/8380)
* **Graphite**: Fixed issue with Toggle edit mode did in query editor [#8377](https://github.com/grafana/grafana/issues/8377)
* **Alerting**: Fixed issue with state history not showing query execution errors [#8412](https://github.com/grafana/grafana/issues/8412)
* **Alerting**: Fixed issue with missing state history events/annotations when using sqlite3 database [#7992](https://github.com/grafana/grafana/issues/7992)
* **Sqlite**: Fixed with database table locked and using sqlite3 database [#7992](https://github.com/grafana/grafana/issues/7992)
* **Alerting**: Fixed issue with annotations showing up in unsaved dashboards, new graph & alert panel. [#8361](https://github.com/grafana/grafana/issues/8361)
* **webdav**: Fixed http proxy env variable support for webdav image upload [#7922](https://github.com/grafana/grafana/issues/79222), thx [@berghauz](https://github.com/berghauz)
* **Prometheus**: Fixed issue with hiding query [#8413](https://github.com/grafana/grafana/issues/8413)

## Enhancements

* **VictorOps**:  Now supports panel image & auto resolve [#8431](https://github.com/grafana/grafana/pull/8431), thx [@davidmscott](https://github.com/davidmscott)
* **Alerting**:  Alert annotations now provide more info [#8421](https://github.com/grafana/grafana/pull/8421)

# 4.3.0-beta1 (2017-05-12)

## Enhancements

* **InfluxDB**: influxdb query builder support for ORDER BY and LIMIT (allows TOPN queries) [#6065](https://github.com/grafana/grafana/issues/6065) Support influxdb's SLIMIT Feature [#7232](https://github.com/grafana/grafana/issues/7232) thx [@thuck](https://github.com/thuck)
* **Panels**: Delay loading & Lazy load panels as they become visible (scrolled into view) [#5216](https://github.com/grafana/grafana/issues/5216) thx [@jifwin](https://github.com/jifwin)
* **Graph**: Support auto grid min/max when using log scale [#3090](https://github.com/grafana/grafana/issues/3090), thx [@bigbenhur](https://github.com/bigbenhur)
* **Graph**: Support for histograms [#600](https://github.com/grafana/grafana/issues/600)
* **Prometheus**: Support table response formats (column per label) [#6140](https://github.com/grafana/grafana/issues/6140), thx [@mtanda](https://github.com/mtanda)
* **Single Stat Panel**: support for non time series data [#6564](https://github.com/grafana/grafana/issues/6564)
* **Server**: Monitoring Grafana (health check endpoint) [#3302](https://github.com/grafana/grafana/issues/3302)
* **Heatmap**: Heatmap Panel [#7934](https://github.com/grafana/grafana/pull/7934)
* **Elasticsearch**: histogram aggregation [#3164](https://github.com/grafana/grafana/issues/3164)

## Minor Enhancements

* **InfluxDB**: Small fix for the "glow" when focus the field for LIMIT and SLIMIT [#7799](https://github.com/grafana/grafana/pull/7799) thx [@thuck](https://github.com/thuck)
* **Prometheus**: Make Prometheus query field a textarea [#7663](https://github.com/grafana/grafana/issues/7663), thx [@hagen1778](https://github.com/hagen1778)
* **Prometheus**: Step parameter changed semantics to min step to reduce the load on Prometheus and rendering in browser [#8073](https://github.com/grafana/grafana/pull/8073), thx [@bobrik](https://github.com/bobrik)
* **Templating**: Should not be possible to create self-referencing (recursive) template variable definitions [#7614](https://github.com/grafana/grafana/issues/7614) thx [@thuck](https://github.com/thuck)
* **Cloudwatch**: Correctly obtain IAM roles within ECS container tasks [#7892](https://github.com/grafana/grafana/issues/7892) thx [@gomlgs](https://github.com/gomlgs)
* **Units**: New number format: Scientific notation [#7781](https://github.com/grafana/grafana/issues/7781) thx [@cadnce](https://github.com/cadnce)
* **Oauth**: Add common type for oauth authorization errors [#6428](https://github.com/grafana/grafana/issues/6428) thx [@amenzhinsky](https://github.com/amenzhinsky)
* **Templating**: Data source variable now supports multi value and panel repeats [#7030](https://github.com/grafana/grafana/issues/7030) thx [@mtanda](https://github.com/mtanda)
* **Telegram**: Telegram alert is not sending metric and legend. [#8110](https://github.com/grafana/grafana/issues/8110), thx [@bashgeek](https://github.com/bashgeek)
* **Graph**: Support dashed lines [#514](https://github.com/grafana/grafana/issues/514), thx [@smalik03](https://github.com/smalik03)
* **Table**: Support to change column header text [#3551](https://github.com/grafana/grafana/issues/3551)
* **Alerting**: Better error when SMTP is not configured [#8093](https://github.com/grafana/grafana/issues/8093)
* **Pushover**: Add an option to attach graph image link in Pushover notification [#8043](https://github.com/grafana/grafana/issues/8043) thx [@devkid](https://github.com/devkid)
* **WebDAV**: Allow to set different ImageBaseUrl for WebDAV upload and image link [#7914](https://github.com/grafana/grafana/issues/7914)
* **Panels**: type-ahead mixed datasource selection [#7697](https://github.com/grafana/grafana/issues/7697) thx [@mtanda](https://github.com/mtanda)
* **Security**:User enumeration problem [#7619](https://github.com/grafana/grafana/issues/7619)
* **InfluxDB**: Register new queries available in InfluxDB - Holt Winters [#5619](https://github.com/grafana/grafana/issues/5619) thx [@rikkuness](https://github.com/rikkuness)
* **Server**: Support listening on a UNIX socket [#4030](https://github.com/grafana/grafana/issues/4030), thx [@mitjaziv](https://github.com/mitjaziv)
* **Graph**: Support log scaling for values smaller 1 [#5278](https://github.com/grafana/grafana/issues/5278)
* **InfluxDB**: Slow 'select measurement' rendering for InfluxDB [#2524](https://github.com/grafana/grafana/issues/2524), thx [@sbhenderson](https://github.com/sbhenderson)
* **Config**: Configurable signout menu activation [#7968](https://github.com/grafana/grafana/pull/7968), thx [@seuf](https://github.com/seuf)

## Fixes
* **Table Panel**: Fixed annotation display in table panel, [#8023](https://github.com/grafana/grafana/issues/8023)
* **Dashboard**: If refresh is blocked due to tab not visible, then refresh when it becomes visible [#8076](https://github.com/grafana/grafana/issues/8076) thanks [@SimenB](https://github.com/SimenB)
* **Snapshots**: Fixed problem with annotations & snapshots [#7659](https://github.com/grafana/grafana/issues/7659)
* **Graph**: MetricSegment loses type when value is an asterisk [#8277](https://github.com/grafana/grafana/issues/8277), thx [@Gordiychuk](https://github.com/Gordiychuk)
* **Alerting**: Alert notifications do not show charts when using a non public S3 bucket [#8250](https://github.com/grafana/grafana/issues/8250) thx [@rogerswingle](https://github.com/rogerswingle)
* **Graph**: 100% client CPU usage on red alert glow animation [#8222](https://github.com/grafana/grafana/issues/8222)
* **InfluxDB**: Templating: "All" query does match too much [#8165](https://github.com/grafana/grafana/issues/8165)
* **Dashboard**: Description tooltip is not fully displayed [#7970](https://github.com/grafana/grafana/issues/7970)
* **Proxy**: Redirect after switching Org does not obey sub path in root_url (using reverse proxy) [#8089](https://github.com/grafana/grafana/issues/8089)
* **Templating**: Restoration of ad-hoc variable from URL does not work correctly [#8056](https://github.com/grafana/grafana/issues/8056) thx [@tamayika](https://github.com/tamayika)
* **InfluxDB**: timeFilter cannot be used twice in alerts [#7969](https://github.com/grafana/grafana/issues/7969)
* **MySQL**: 4-byte UTF8 not supported when using MySQL database (allows Emojis) [#7958](https://github.com/grafana/grafana/issues/7958)
* **Alerting**: api/alerts and api/alert/:id hold previous data for "message" and "Message" field when field value is changed from "some string" to empty string. [#7927](https://github.com/grafana/grafana/issues/7927)
* **Graph**: Cannot add fill below to series override [#7916](https://github.com/grafana/grafana/issues/7916)
* **InfluxDB**: Influxb Datasource test passes even if the Database doesn't exist [#7864](https://github.com/grafana/grafana/issues/7864)
* **Prometheus**: Displaying Prometheus annotations is incredibly slow [#7750](https://github.com/grafana/grafana/issues/7750), thx [@mtanda](https://github.com/mtanda)
* **Graphite**: grafana generates empty find query to graphite -> 422 Unprocessable Entity [#7740](https://github.com/grafana/grafana/issues/7740)
* **Admin**: make organisation filter case insensitive [#8194](https://github.com/grafana/grafana/issues/8194), thx [@Alexander-N](https://github.com/Alexander-N)

## Changes
* **Elasticsearch**: Changed elasticsearch Terms aggregation to default to Min Doc Count to 1, and sort order to Top [#8321](https://github.com/grafana/grafana/issues/8321)

## Tech

* **Library Upgrade**: inconshreveable/log15 outdated - no support for solaris [#8262](https://github.com/grafana/grafana/issues/8262)
* **Library Upgrade**: Upgrade Macaron [#7600](https://github.com/grafana/grafana/issues/7600)

# 4.2.0 (2017-03-22)
## Minor Enhancements
* **Templates**: Prevent use of the prefix `__` for templates in web UI [#7678](https://github.com/grafana/grafana/issues/7678)
* **Threema**: Add emoji to Threema alert notifications [#7676](https://github.com/grafana/grafana/pull/7676) thx [@dbrgn](https://github.com/dbrgn)
* **Panels**: Support dm3 unit [#7695](https://github.com/grafana/grafana/issues/7695) thx [@mitjaziv](https://github.com/mitjaziv)
* **Docs**: Added some details about Sessions in Postgres [#7694](https://github.com/grafana/grafana/pull/7694) thx [@rickard-von-essen](https://github.com/rickard-von-essen)
* **Influxdb**: Allow commas in template variables [#7681](https://github.com/grafana/grafana/issues/7681) thx [@thuck](https://github.com/thuck)
* **Cloudwatch**: stop using deprecated session.New() [#7736](https://github.com/grafana/grafana/issues/7736) thx [@mtanda](https://github.com/mtanda)
* **OpenTSDB**: Pass dropcounter rate option if no max counter and no reset value or reset value as 0 is specified [#7743](https://github.com/grafana/grafana/pull/7743) thx [@r4um](https://github.com/r4um)
* **Templating**: support full resolution for $interval variable [#7696](https://github.com/grafana/grafana/pull/7696) thx [@mtanda](https://github.com/mtanda)
* **Elasticsearch**: Unique Count on string fields in ElasticSearch [#3536](https://github.com/grafana/grafana/issues/3536), thx [@pyro2927](https://github.com/pyro2927)
* **Templating**: Data source template variable that refers to other variable in regex filter [#6365](https://github.com/grafana/grafana/issues/6365) thx [@rlodge](https://github.com/rlodge)
* **Admin**: Global User List: add search and pagination [#7469](https://github.com/grafana/grafana/issues/7469)
* **User Management**: Invite UI is now disabled when login form is disabled [#7875](https://github.com/grafana/grafana/issues/7875)

## Bugfixes
* **Webhook**: Use proxy settings from environment variables [#7710](https://github.com/grafana/grafana/issues/7710)
* **Panels**: Deleting a dashboard with unsaved changes raises an error message [#7591](https://github.com/grafana/grafana/issues/7591) thx [@thuck](https://github.com/thuck)
* **Influxdb**: Query builder detects regex to easily for measurement [#7276](https://github.com/grafana/grafana/issues/7276) thx [@thuck](https://github.com/thuck)
* **Docs**: router_logging not documented [#7723](https://github.com/grafana/grafana/issues/7723)
* **Alerting**: Spelling mistake [#7739](https://github.com/grafana/grafana/pull/7739) thx [@woutersmit](https://github.com/woutersmit)
* **Alerting**: Graph legend scrolls to top when an alias is toggled/clicked [#7680](https://github.com/grafana/grafana/issues/7680) thx [@p4ddy1](https://github.com/p4ddy1)
* **Panels**: Fixed panel tooltip description after scrolling down [#7708](https://github.com/grafana/grafana/issues/7708) thx [@askomorokhov](https://github.com/askomorokhov)

# 4.2.0-beta1 (2017-02-27)

## Enhancements
* **Telegram**: Added Telegram alert notifier [#7098](https://github.com/grafana/grafana/pull/7098), thx [@leonoff](https://github.com/leonoff)
* **Templating**: Make $__interval and $__interval_ms global built in variables that can be used in by any datasource (in panel queries), closes [#7190](https://github.com/grafana/grafana/issues/7190), closes [#6582](https://github.com/grafana/grafana/issues/6582)
* **S3 Image Store**: External s3 image store (used in alert notifications) now support AWS IAM Roles, closes [#6985](https://github.com/grafana/grafana/issues/6985), [#7058](https://github.com/grafana/grafana/issues/7058) thx [@mtanda](https://github.com/mtanda)
* **SingleStat**: Implements diff aggregation method for singlestat [#7234](https://github.com/grafana/grafana/issues/7234), thx [@oliverpool](https://github.com/oliverpool)
* **Dataproxy**: Added setting to enable more verbose logging in dataproxy [#7209](https://github.com/grafana/grafana/pull/7209), thx [@Ricky-N](https://github.com/Ricky-N)
* **Alerting**: Better information about why an alert triggered [#7035](https://github.com/grafana/grafana/issues/7035)
* **LINE**: Add LINE as alerting notification channel [#7301](https://github.com/grafana/grafana/pull/7301), thx [@huydx](https://github.com/huydx)
* **LINE**: Adds image to notification message [#7417](https://github.com/grafana/grafana/pull/7417), thx [@Erliz](https://github.com/Erliz)
* **Hipchat**: Adds support for sending alert notifications to hipchat [#6451](https://github.com/grafana/grafana/issues/6451), thx [@jregovic](https://github.com/jregovic)
* **Alerting**: Uploading images for alert notifications is now optional [#7419](https://github.com/grafana/grafana/issues/7419)
* **Dashboard**: Adds shortcut for collapsing/expanding all rows [#552](https://github.com/grafana/grafana/issues/552), thx [@mtanda](https://github.com/mtanda)
* **Alerting**: Adds de duping of alert notifications [#7632](https://github.com/grafana/grafana/pull/7632)
* **Orgs**: Sharing dashboards using Grafana share feature will now redirect to correct org. [#1613](https://github.com/grafana/grafana/issues/1613)
* **Pushover**: Add Pushover alert notifications [#7526](https://github.com/grafana/grafana/pull/7526) thx [@devkid](https://github.com/devkid)
* **Threema**: Add Threema Gateway alert notification integration [#7482](https://github.com/grafana/grafana/pull/7482) thx [@dbrgn](https://github.com/dbrgn)

## Minor Enhancements
* **Optimzation**: Never issue refresh event when Grafana tab is not visible [#7218](https://github.com/grafana/grafana/issues/7218), thx [@mtanda](https://github.com/mtanda)
* **Browser History**: Browser back/forward now works time ranges / zoom, [#7259](https://github.com/grafana/grafana/issues/7259)
* **Elasticsearch**: Support for Min Doc Count options in Terms aggregation [#7324](https://github.com/grafana/grafana/pull/7324), thx [@lpic10](https://github.com/lpic10)
* **Elasticsearch**: Term aggregation limit can now be changed in template queries [#7112](https://github.com/grafana/grafana/issues/7112), thx [@FFalcon](https://github.com/FFalcon)
* **Elasticsearch**: Ad-hoc filters now support all operators [#7612](https://github.com/grafana/grafana/issues/7612), thx [@tamayika](https://github.com/tamayika)
* **Graph**: Add full series name as title for legends. [#7493](https://github.com/grafana/grafana/pull/7493), thx [@kolobaev](https://github.com/kolobaev)
* **Table**: Add a message when queries returns no data. [#6109](https://github.com/grafana/grafana/issues/6109), thx [@xginn8](https://github.com/xginn8)
* **Graph**: Set max width for series names in legend tables. [#2385](https://github.com/grafana/grafana/issues/2385), thx [@kolobaev](https://github.com/kolobaev)
* **Database**: Allow max db connection pool configuration [#7427](https://github.com/grafana/grafana/issues/7427), thx [@huydx](https://github.com/huydx)
* **Datasources** Delete datsource by name [#7476](https://github.com/grafana/grafana/issues/7476), thx [@huydx](https://github.com/huydx)
* **Dataproxy**: Only allow get that begins with api/ to access Prometheus [#7459](https://github.com/grafana/grafana/pull/7459), thx [@mtanda](https://github.com/mtanda)
* **Snapshot**: Make timeout for snapshot creation configurable [#7449](https://github.com/grafana/grafana/pull/7449) thx [@ryu1-sakai](https://github.com/ryu1-sakai)
* **Panels**: Add more physics units [#7554](https://github.com/grafana/grafana/pull/7554) thx [@ryantxu](https://github.com/ryantxu)
* **Email**: Add sender's name on email [#2131](https://github.com/grafana/grafana/issues/2131) thx [@jacobbednarz](https://github.com/jacobbednarz)
* **HTTPS**: Set tls 1.2 as lowest tls version. [#7347](https://github.com/grafana/grafana/pull/7347) thx [@roman-vynar](https://github.com/roman-vynar)
* **Table**: Added suppressing of empty results to table plugin. [#7602](https://github.com/grafana/grafana/pull/7602) thx [@LLIyRiK](https://github.com/LLIyRiK)

## Tech

* **Library Upgrade**: Upgraded angularjs from 1.5.8 to 1.6.1 [#7274](https://github.com/grafana/grafana/issues/7274)
* **Backend**: Grafana is now built using golang 1.8

## Bugfixes
* **Alerting**: Fixes missing support for no_data and execution error when testing alerts [#7149](https://github.com/grafana/grafana/issues/7149)
* **Dashboard**: Avoid duplicate data in dashboard json for panels with alerts [#7256](https://github.com/grafana/grafana/pull/7256)
* **Alertlist**: Only show scrollbar when required [#7269](https://github.com/grafana/grafana/issues/7269)
* **SMTP**: Set LocalName to hostname [#7223](https://github.com/grafana/grafana/issues/7223)
* **Sidemenu**: Disable sign out in sidemenu for AuthProxyEnabled [#7377](https://github.com/grafana/grafana/pull/7377), thx [@solugebefola](https://github.com/solugebefola)
* **Prometheus**: Add support for basic auth in Prometheus tsdb package [#6799](https://github.com/grafana/grafana/issues/6799), thx [@hagen1778](https://github.com/hagen1778)
* **OAuth**: Redirect to original page when logging in with OAuth [#7513](https://github.com/grafana/grafana/issues/7513)
* **Annotations**: Wrap text in annotations tooltip [#7542](https://github.com/grafana/grafana/pull/7542), thx [@xginn8](https://github.com/xginn8)
* **Templating**: Fixes error when using numeric sort on empty strings [#7382](https://github.com/grafana/grafana/issues/7382)
* **Templating**: Fixed issue detecting template variable dependency [#7354](https://github.com/grafana/grafana/issues/7354)

# 4.1.2 (2017-02-13)

### Bugfixes
* **Table**: Fixes broken annotation rendering mode in the table panel [#7268](https://github.com/grafana/grafana/issues/7268)
* **Data Sources**: Sorting for lists of data sources in UI is now case insensitive [#7491](https://github.com/grafana/grafana/issues/7491)
* **Admin**: Support more then 1000 users in global users list [#7469](https://github.com/grafana/grafana/issues/7469)

# 4.1.1 (2017-01-11)

### Bugfixes
* **Graph Panel**: Fixed issue with legend height in table mode [#7221](https://github.com/grafana/grafana/issues/7221)

# 4.1.0 (2017-01-11)

### Bugfixes
* **Server side PNG rendering**: Fixed issue with y-axis label rotation in phantomjs rendered images [#6924](https://github.com/grafana/grafana/issues/6924)
* **Graph**: Fixed centering of y-axis label [#7099](https://github.com/grafana/grafana/issues/7099)
* **Graph**: Fixed graph legend table mode and always visible scrollbar [#6828](https://github.com/grafana/grafana/issues/6828)
* **Templating**: Fixed template variable value groups/tags feature [#6752](https://github.com/grafana/grafana/issues/6752)
* **Webhook**: Fixed webhook username mismatch [#7195](https://github.com/grafana/grafana/pull/7195), thx [@theisenmark](https://github.com/theisenmark)
* **Influxdb**: Handles time(auto) the same way as time($interval) [#6997](https://github.com/grafana/grafana/issues/6997)

## Enhancements
* **Elasticsearch**: Added support for all moving average options [#7154](https://github.com/grafana/grafana/pull/7154), thx [@vaibhavinbayarea](https://github.com/vaibhavinbayarea)

# 4.1-beta1 (2016-12-21)

### Enhancements
* **Postgres**: Add support for Certs for Postgres database [#6655](https://github.com/grafana/grafana/issues/6655)
* **Victorops**: Add VictorOps notification integration [#6411](https://github.com/grafana/grafana/issues/6411), thx [@ichekrygin](https://github.com/ichekrygin)
* **Opsgenie**: Add OpsGenie notification integratiion [#6687](https://github.com/grafana/grafana/issues/6687), thx [@kylemcc](https://github.com/kylemcc)
* **Singlestat**: New aggregation on singlestat panel [#6740](https://github.com/grafana/grafana/pull/6740), thx [@dirk-leroux](https://github.com/dirk-leroux)
* **Cloudwatch**: Make it possible to specify access and secret key on the data source config page [#6697](https://github.com/grafana/grafana/issues/6697)
* **Table**: Added Hidden Column Style for Table Panel [#5677](https://github.com/grafana/grafana/pull/5677), thx [@bmundt](https://github.com/bmundt)
* **Graph**: Shared crosshair option renamed to shared tooltip, shows tooltip on all graphs as you hover over one graph. [#1578](https://github.com/grafana/grafana/pull/1578), [#6274](https://github.com/grafana/grafana/pull/6274)
* **Elasticsearch**: Added support for Missing option (bucket) for terms aggregation [#4244](https://github.com/grafana/grafana/pull/4244), thx [@shanielh](https://github.com/shanielh)
* **Elasticsearch**: Added support for Elasticsearch 5.x [#5740](https://github.com/grafana/grafana/issues/5740), thx [@lpic10](https://github.com/lpic10)
* **CLI**: Make it possible to reset the admin password using the grafana-cli. [#5479](https://github.com/grafana/grafana/issues/5479)
* **Influxdb**: Support multiple tags in InfluxDB annotations. [#4550](https://github.com/grafana/grafana/pull/4550), thx [@adrianlzt](https://github.com/adrianlzt)
* **LDAP**:  Basic Auth now supports LDAP username and password, [#6940](https://github.com/grafana/grafana/pull/6940), thx [@utkarshcmu](https://github.com/utkarshcmu)
* **LDAP**: Now works with Auth Proxy, role and organisation mapping & sync will regularly be performed. [#6895](https://github.com/grafana/grafana/pull/6895), thx [@Seuf](https://github.com/seuf)
* **Alerting**: Adds OK as no data option. [#6866](https://github.com/grafana/grafana/issues/6866)
* **Alert list**: Order alerts based on state. [#6676](https://github.com/grafana/grafana/issues/6676)
* **Alerting**: Add api endpoint for pausing all alerts. [#6589](https://github.com/grafana/grafana/issues/6589)
* **Panel**: Added help text for panels. [#4079](https://github.com/grafana/grafana/issues/4079), thx [@utkarshcmu](https://github.com/utkarshcmu)

### Bugfixes
* **API**: HTTP API for deleting org returning incorrect message for a non-existing org [#6679](https://github.com/grafana/grafana/issues/6679)
* **Dashboard**: Posting empty dashboard result in corrupted dashboard [#5443](https://github.com/grafana/grafana/issues/5443)
* **Logging**: Fixed logging level confing issue [#6978](https://github.com/grafana/grafana/issues/6978)
* **Notifications**: Remove html escaping the email subject. [#6905](https://github.com/grafana/grafana/issues/6905)
* **Influxdb**: Fixes broken field dropdown when using template vars as measurement. [#6473](https://github.com/grafana/grafana/issues/6473)

# 4.0.2 (2016-12-08)

### Enhancements
* **Playlist**: Add support for kiosk mode [#6727](https://github.com/grafana/grafana/issues/6727)

### Bugfixes
* **Alerting**: Add alert message to webhook notifications [#6807](https://github.com/grafana/grafana/issues/6807)
* **Alerting**: Fixes a bug where avg() reducer treated null as zero. [#6879](https://github.com/grafana/grafana/issues/6879)
* **PNG Rendering**: Fix for server side rendering when using non default http addr bind and domain setting [#6813](https://github.com/grafana/grafana/issues/6813)
* **PNG Rendering**: Fix for server side rendering when setting enforce_domain to true [#6769](https://github.com/grafana/grafana/issues/6769)
* **Webhooks**: Add content type json to outgoing webhooks [#6822](https://github.com/grafana/grafana/issues/6822)
* **Keyboard shortcut**: Fixed zoom out shortcut [#6837](https://github.com/grafana/grafana/issues/6837)
* **Webdav**: Adds basic auth headers to webdav uploader [#6779](https://github.com/grafana/grafana/issues/6779)

# 4.0.1 (2016-12-02)

> **Notice**
4.0.0 had serious connection pooling issue when using a data source in proxy access. This bug caused lots of resource issues
due to too many connections/file handles on the data source backend. This problem is fixed in this release.

### Bugfixes
* **Metrics**: Fixes nil pointer dereference on my arm build [#6749](https://github.com/grafana/grafana/issues/6749)
* **Data proxy**: Fixes a tcp pooling issue in the datasource reverse proxy [#6759](https://github.com/grafana/grafana/issues/6759)

# 4.0-stable (2016-11-29)

### Bugfixes
* **Server-side rendering**: Fixed address used when rendering panel via phantomjs and using non default http_addr config [#6660](https://github.com/grafana/grafana/issues/6660)
* **Graph panel**: Fixed graph panel tooltip sort order issue [#6648](https://github.com/grafana/grafana/issues/6648)
* **Unsaved changes**: You now navigate to the intended page after saving in the unsaved changes dialog [#6675](https://github.com/grafana/grafana/issues/6675)
* **TLS Client Auth**: Support for TLS client authentication for datasource proxies [#2316](https://github.com/grafana/grafana/issues/2316)
* **Alerts out of sync**: Saving dashboards with broken alerts causes sync problem[#6576](https://github.com/grafana/grafana/issues/6576)
* **Alerting**: Saving an alert with condition "HAS NO DATA" throws an error[#6701](https://github.com/grafana/grafana/issues/6701)
* **Config**: Improve error message when parsing broken config file [#6731](https://github.com/grafana/grafana/issues/6731)
* **Table**: Render empty dates as - instead of current date [#6728](https://github.com/grafana/grafana/issues/6728)

# 4.0-beta2 (2016-11-21)

### Bugfixes
* **Graph Panel**: Log base scale on right Y-axis had no effect, max value calc was not applied, [#6534](https://github.com/grafana/grafana/issues/6534)
* **Graph Panel**: Bar width if bars was only used in series override, [#6528](https://github.com/grafana/grafana/issues/6528)
* **UI/Browser**: Fixed issue with page/view header gradient border not showing in Safari, [#6530](https://github.com/grafana/grafana/issues/6530)
* **Cloudwatch**: Fixed cloudwatch datasource requesting to many datapoints, [#6544](https://github.com/grafana/grafana/issues/6544)
* **UX**: Panel Drop zone visible after duplicating panel, and when entering fullscreen/edit view, [#6598](https://github.com/grafana/grafana/issues/6598)
* **Templating**: Newly added variable was not visible directly only after dashboard reload, [#6622](https://github.com/grafana/grafana/issues/6622)

### Enhancements
* **Singlestat**: Support repeated template variables in prefix/postfix [#6595](https://github.com/grafana/grafana/issues/6595)
* **Templating**: Don't persist variable options with refresh option [#6586](https://github.com/grafana/grafana/issues/6586)
* **Alerting**: Add ability to have OR conditions (and mixing AND & OR) [#6579](https://github.com/grafana/grafana/issues/6579)
* **InfluxDB**: Fix for Ad-Hoc Filters variable & changing dashboards [#6821](https://github.com/grafana/grafana/issues/6821)

# 4.0-beta1 (2016-11-09)

### Enhancements
* **Login**: Adds option to disable username/password logins, closes [#4674](https://github.com/grafana/grafana/issues/4674)
* **SingleStat**: Add seriename as option in singlestat panel, closes [#4740](https://github.com/grafana/grafana/issues/4740)
* **Localization**: Week start day now dependant on browser locale setting, closes [#3003](https://github.com/grafana/grafana/issues/3003)
* **Templating**: Update panel repeats for variables that change on time refresh, closes [#5021](https://github.com/grafana/grafana/issues/5021)
* **Templating**: Add support for numeric and alphabetical sorting of variable values, closes [#2839](https://github.com/grafana/grafana/issues/2839)
* **Elasticsearch**: Support to set Precision Threshold for Unique Count metric, closes [#4689](https://github.com/grafana/grafana/issues/4689)
* **Navigation**: Add search to org swithcer, closes [#2609](https://github.com/grafana/grafana/issues/2609)
* **Database**: Allow database config using one propertie, closes [#5456](https://github.com/grafana/grafana/pull/5456)
* **Graphite**: Add support for groupByNodes, closes [#5613](https://github.com/grafana/grafana/pull/5613)
* **Influxdb**: Add support for elapsed(), closes [#5827](https://github.com/grafana/grafana/pull/5827)
* **OpenTSDB**: Add support for explicitTags for OpenTSDB>=2.3, closes [#6360](https://github.com/grafana/grafana/pull/6361)
* **OAuth**: Add support for generic oauth, closes [#4718](https://github.com/grafana/grafana/pull/4718)
* **Cloudwatch**: Add support to expand multi select template variable, closes [#5003](https://github.com/grafana/grafana/pull/5003)
* **Background Tasks**: Now support automatic purging of old snapshots, closes [#4087](https://github.com/grafana/grafana/issues/4087)
* **Background Tasks**: Now support automatic purging of old rendered images, closes [#2172](https://github.com/grafana/grafana/issues/2172)
* **Dashboard**: After inactivity hide nav/row actions, fade to nice clean view, can be toggled with `d v`, also added kiosk mode, toggled via `d k` [#6476](https://github.com/grafana/grafana/issues/6476)
* **Dashboard**: Improved dashboard row menu & add panel UX [#6442](https://github.com/grafana/grafana/issues/6442)
* **Graph Panel**: Support for stacking null values [#2912](https://github.com/grafana/grafana/issues/2912), [#6287](https://github.com/grafana/grafana/issues/6287), thanks @benrubson!

### Breaking changes
* **SystemD**: Change systemd description, closes [#5971](https://github.com/grafana/grafana/pull/5971)
* **lodash upgrade**: Upgraded lodash from 2.4.2 to 4.15.0, this contains a number of breaking changes that could effect plugins. closes [#6021](https://github.com/grafana/grafana/pull/6021)

### Bug fixes
* **Table Panel**: Fixed problem when switching to Mixed datasource in metrics tab, fixes [#5999](https://github.com/grafana/grafana/pull/5999)
* **Playlist**: Fixed problem with play order not matching order defined in playlist, fixes [#5467](https://github.com/grafana/grafana/pull/5467)
* **Graph panel**: Fixed problem with auto decimals on y axis when datamin=datamax, fixes [#6070](https://github.com/grafana/grafana/pull/6070)
* **Snapshot**: Can view embedded panels/png rendered panels in snapshots without login, fixes [#3769](https://github.com/grafana/grafana/pull/3769)
* **Elasticsearch**: Fix for query template variable when looking up terms without query, no longer relies on elasticsearch default field, fixes [#3887](https://github.com/grafana/grafana/pull/3887)
* **Elasticsearch**: Fix for displaying IP address used in terms aggregations, fixes [#4393](https://github.com/grafana/grafana/pull/4393)
* **PNG Rendering**: Fix for server side rendering when using auth proxy, fixes [#5906](https://github.com/grafana/grafana/pull/5906)
* **OpenTSDB**: Fixed multi-value nested templating for opentsdb, fixes [#6455](https://github.com/grafana/grafana/pull/6455)
* **Playlist**: Remove playlist items when dashboard is removed, fixes [#6292](https://github.com/grafana/grafana/issues/6292)

# 3.1.2 (unreleased)
* **Templating**: Fixed issue when combining row & panel repeats, fixes [#5790](https://github.com/grafana/grafana/issues/5790)
* **Drag&Drop**: Fixed issue with drag and drop in latest Chrome(51+), fixes [#5767](https://github.com/grafana/grafana/issues/5767)
* **Internal Metrics**: Fixed issue with dots in instance_name when sending internal metrics to Graphite, fixes [#5739](https://github.com/grafana/grafana/issues/5739)
* **Grafana-CLI**: Add default plugin path for MAC OS, fixes [#5806](https://github.com/grafana/grafana/issues/5806)
* **Grafana-CLI**: Improve error message for upgrade-all command, fixes [#5885](https://github.com/grafana/grafana/issues/5885)

# 3.1.1 (2016-08-01)
* **IFrame embedding**: Fixed issue of using full iframe height, fixes [#5605](https://github.com/grafana/grafana/issues/5606)
* **Panel PNG rendering**: Fixed issue detecting render completion, fixes [#5605](https://github.com/grafana/grafana/issues/5606)
* **Elasticsearch**: Fixed issue with templating query and json parse error, fixes [#5615](https://github.com/grafana/grafana/issues/5615)
* **Tech**: Upgraded JQuery to 2.2.4 to fix Security vulnerabilitie in 2.1.4, fixes [#5627](https://github.com/grafana/grafana/issues/5627)
* **Graphite**: Fixed issue with mixed data sources and Graphite, fixes [#5617](https://github.com/grafana/grafana/issues/5617)
* **Templating**: Fixed issue with template variable query was issued multiple times during dashboard load, fixes [#5637](https://github.com/grafana/grafana/issues/5637)
* **Zoom**: Fixed issues with zoom in and out on embedded (iframed) panel, fixes [#4489](https://github.com/grafana/grafana/issues/4489), [#5666](https://github.com/grafana/grafana/issues/5666)

# 3.1.0 stable (2016-07-12)

### Bugfixes & Enhancements,
* **User Alert Notices**: Backend error alert popups did not show properly, fixes [#5435](https://github.com/grafana/grafana/issues/5435)
* **Table**: Added sanitize HTML option to allow links in table cells, fixes [#4596](https://github.com/grafana/grafana/issues/4596)
* **Apps**: App dashboards are automatically synced to DB at startup after plugin update, fixes [#5529](https://github.com/grafana/grafana/issues/5529)

# 3.1.0-beta1 (2016-06-23)

### Enhancements
* **Dashboard Export/Import**: Dashboard export now templetize data sources and constant variables, users pick these on import, closes [#5084](https://github.com/grafana/grafana/issues/5084)
* **Dashboard Url**: Time range changes updates url, closes [#458](https://github.com/grafana/grafana/issues/458)
* **Dashboard Url**: Template variable change updates url, closes [#5002](https://github.com/grafana/grafana/issues/5002)
* **Singlestat**: Add support for range to text mappings, closes [#1319](https://github.com/grafana/grafana/issues/1319)
* **Graph**: Adds sort order options for graph tooltip, closes  [#1189](https://github.com/grafana/grafana/issues/1189)
* **Theme**: Add default theme to config file [#5011](https://github.com/grafana/grafana/pull/5011)
* **Page Footer**: Added page footer with links to docs, shows Grafana version and info if new version is available, closes [#4889](https://github.com/grafana/grafana/pull/4889)
* **InfluxDB**: Add spread function, closes [#5211](https://github.com/grafana/grafana/issues/5211)
* **Scripts**: Use restart instead of start for deb package script, closes [#5282](https://github.com/grafana/grafana/pull/5282)
* **Logging**: Moved to structured logging lib, and moved to component specific level filters via config file, closes [#4590](https://github.com/grafana/grafana/issues/4590)
* **OpenTSDB**: Support nested template variables in tag_values function, closes [#4398](https://github.com/grafana/grafana/issues/4398)
* **Datasource**: Pending data source requests are cancelled before new ones are issues (Graphite & Prometheus), closes [#5321](https://github.com/grafana/grafana/issues/5321)

### Breaking changes
* **Logging** : Changed default logging output format (now structured into message, and key value pairs, with logger key acting as component). You can also no change in config to json log ouput.
* **Graphite** : The Graph panel no longer have a Graphite PNG option. closes [#5367](https://github.com/grafana/grafana/issues/5367)

### Bug fixes
* **PNG rendering**: Fixed phantomjs rendering and y-axis label rotation. fixes [#5220](https://github.com/grafana/grafana/issues/5220)
* **CLI**: The cli tool now supports reading plugin.json from dist/plugin.json. fixes [#5410](https://github.com/grafana/grafana/issues/5410)

# 3.0.4 Patch release (2016-05-25)
* **Panel**: Fixed blank dashboard issue when switching to other dashboard while in fullscreen edit mode, fixes [#5163](https://github.com/grafana/grafana/pull/5163)
* **Templating**: Fixed issue with nested multi select variables and cascading and updating child variable selection state, fixes [#4861](https://github.com/grafana/grafana/pull/4861)
* **Templating**: Fixed issue with using templated data source in another template variable query, fixes [#5165](https://github.com/grafana/grafana/pull/5165)
* **Singlestat gauge**: Fixed issue with gauge render position, fixes [#5143](https://github.com/grafana/grafana/pull/5143)
* **Home dashboard**: Fixes broken home dashboard api, fixes [#5167](https://github.com/grafana/grafana/issues/5167)

# 3.0.3 Patch release (2016-05-23)
* **Annotations**: Annotations can now use a template variable as data source, closes [#5054](https://github.com/grafana/grafana/issues/5054)
* **Time picker**: Fixed issue timepicker and UTC when reading time from URL, fixes [#5078](https://github.com/grafana/grafana/issues/5078)
* **CloudWatch**: Support for Multiple Account by AssumeRole, closes [#3522](https://github.com/grafana/grafana/issues/3522)
* **Singlestat**: Fixed alignment and minium height issue, fixes [#5113](https://github.com/grafana/grafana/issues/5113), fixes [#4679](https://github.com/grafana/grafana/issues/4679)
* **Share modal**: Fixed link when using grafana under dashboard sub url, fixes [#5109](https://github.com/grafana/grafana/issues/5109)
* **Prometheus**: Fixed bug in query editor that caused it not to load when reloading page, fixes [#5107](https://github.com/grafana/grafana/issues/5107)
* **Elasticsearch**: Fixed bug when template variable query returns numeric values, fixes [#5097](https://github.com/grafana/grafana/issues/5097), fixes [#5088](https://github.com/grafana/grafana/issues/5088)
* **Logging**: Fixed issue with reading logging level value, fixes [#5079](https://github.com/grafana/grafana/issues/5079)
* **Timepicker**: Fixed issue with timepicker and UTC when reading time from URL, fixes [#5078](https://github.com/grafana/grafana/issues/5078)
* **Docs**: Added docs for org & user preferences HTTP API, closes [#5069](https://github.com/grafana/grafana/issues/5069)
* **Plugin list panel**: Now shows correct enable state for apps when not enabled, fixes [#5068](https://github.com/grafana/grafana/issues/5068)
* **Elasticsearch**: Templating & Annotation queries that use template variables are now formatted correctly, fixes [#5135](https://github.com/grafana/grafana/issues/5135)

# 3.0.2 Patch release (2016-05-16)

* **Templating**: Fixed issue mixing row repeat and panel repeats, fixes [#4988](https://github.com/grafana/grafana/issues/4988)
* **Templating**: Fixed issue detecting dependencies in nested variables, fixes [#4987](https://github.com/grafana/grafana/issues/4987), fixes [#4986](https://github.com/grafana/grafana/issues/4986)
* **Graph**: Fixed broken PNG rendering in graph panel, fixes [#5025](https://github.com/grafana/grafana/issues/5025)
* **Graph**: Fixed broken xaxis on graph panel, fixes [#5024](https://github.com/grafana/grafana/issues/5024)

* **Influxdb**: Fixes crash when hiding middle serie, fixes [#5005](https://github.com/grafana/grafana/issues/5005)

# 3.0.1 Stable (2016-05-11)

### Bug fixes
* **Templating**: Fixed issue with new data source variable not persisting current selected value, fixes [#4934](https://github.com/grafana/grafana/issues/4934)

# 3.0.0-beta7 (2016-05-02)

### Bug fixes
* **Dashboard title**: Fixed max dashboard title width (media query) for large screens,  fixes [#4859](https://github.com/grafana/grafana/issues/4859)
* **Annotations**: Fixed issue with entering annotation edit view, fixes [#4857](https://github.com/grafana/grafana/issues/4857)
* **Remove query**: Fixed issue with removing query for data sources without collapsable query editors, fixes [#4856](https://github.com/grafana/grafana/issues/4856)
* **Graphite PNG**: Fixed issue graphite png rendering option, fixes [#4864](https://github.com/grafana/grafana/issues/4864)
* **InfluxDB**: Fixed issue missing plus group by iconn, fixes [#4862](https://github.com/grafana/grafana/issues/4862)
* **Graph**: Fixes missing line mode for thresholds, fixes [#4902](https://github.com/grafana/grafana/pull/4902)

### Enhancements
* **InfluxDB**: Added new functions moving_average and difference to query editor, closes [#4698](https://github.com/grafana/grafana/issues/4698)

# 3.0.0-beta6 (2016-04-29)

### Enhancements
* **Singlestat**: Support for gauges in singlestat panel. closes [#3688](https://github.com/grafana/grafana/pull/3688)
* **Templating**: Support for data source as variable, closes [#816](https://github.com/grafana/grafana/pull/816)

### Bug fixes
* **InfluxDB 0.12**: Fixed issue templating and `show tag values` query only returning tags for first measurement,  fixes [#4726](https://github.com/grafana/grafana/issues/4726)
* **Templating**: Fixed issue with regex formating when matching multiple values, fixes [#4755](https://github.com/grafana/grafana/issues/4755)
* **Templating**: Fixed issue with custom all value and escaping, fixes [#4736](https://github.com/grafana/grafana/issues/4736)
* **Dashlist**: Fixed issue dashboard list panel and caching tags, fixes [#4768](https://github.com/grafana/grafana/issues/4768)
* **Graph**: Fixed issue with unneeded scrollbar in legend for Firefox, fixes [#4760](https://github.com/grafana/grafana/issues/4760)
* **Table panel**: Fixed issue table panel formating string array properties, fixes [#4791](https://github.com/grafana/grafana/issues/4791)
* **grafana-cli**: Improve error message when failing to install plugins due to corrupt response, fixes [#4651](https://github.com/grafana/grafana/issues/4651)
* **Singlestat**: Fixes prefix an postfix for gauges, fixes [#4812](https://github.com/grafana/grafana/issues/4812)
* **Singlestat**: Fixes auto-refresh on change for some options, fixes [#4809](https://github.com/grafana/grafana/issues/4809)

### Breaking changes
**Data Source Query Editors**: Issue [#3900](https://github.com/grafana/grafana/issues/3900)

Query editors have been updated to use the new form styles. External data source plugins needs to be
updated to work. Sorry to introduce breaking change this late in beta phase. We wanted to get this change
in before 3.0 stable is released so we don't have to break data sources in next release (3.1). If you are
a data source plugin author and want help for how the new form styles work please ask for help in
slack channel (link to slack channel in readme).

# 3.0.0-beta5 (2016-04-15)

### Bug fixes
* **grafana-cli**: Fixed issue grafana-cli tool, did not detect the right plugin dir, fixes [#4723](https://github.com/grafana/grafana/issues/4723)
* **Graph**: Fixed issue with light theme text color issue in tooltip, fixes [#4702](https://github.com/grafana/grafana/issues/4702)
* **Snapshot**: Fixed issue with empty snapshots, fixes [#4706](https://github.com/grafana/grafana/issues/4706)

# 3.0.0-beta4 (2016-04-13)

### Bug fixes
* **Home dashboard**: Fixed issue with permission denied error on home dashboard, fixes [#4686](https://github.com/grafana/grafana/issues/4686)
* **Templating**: Fixed issue templating variables that use regex extraction, fixes [#4672](https://github.com/grafana/grafana/issues/4672)

# 3.0.0-beta3 (2016-04-12)

### Enhancements
* **InfluxDB**: Changed multi query encoding to work with InfluxDB 0.11 & 0.12, closes [#4533](https://github.com/grafana/grafana/issues/4533)
* **Timepicker**: Add arrows and shortcuts for moving back and forth in current dashboard, closes [#119](https://github.com/grafana/grafana/issues/119)

### Bug fixes
* **Postgres**: Fixed page render crash when using postgres, fixes [#4558](https://github.com/grafana/grafana/issues/4558)
* **Table panel**: Fixed table panel bug when trying to show annotations in table panel, fixes [#4563](https://github.com/grafana/grafana/issues/4563)
* **App Config**: Fixed app config issue showing content of other app config, fixes [#4575](https://github.com/grafana/grafana/issues/4575)
* **Graph Panel**: Fixed legend option max not updating, fixes [#4601](https://github.com/grafana/grafana/issues/4601)
* **Graph Panel**: Fixed issue where newly added graph panels shared same axes config, fixes [#4582](https://github.com/grafana/grafana/issues/4582)
* **Graph Panel**: Fixed issue with axis labels overlapping Y-axis, fixes [#4626](https://github.com/grafana/grafana/issues/4626)
* **InfluxDB**: Fixed issue with templating query containing template variable, fixes [#4602](https://github.com/grafana/grafana/issues/4602)
* **Graph Panel**: Fixed issue with hiding series and stacking, fixes [#4557](https://github.com/grafana/grafana/issues/4557)
* **Graph Panel**: Fixed issue with legend height in table mode with few series, affected iframe embedding as well, fixes [#4640](https://github.com/grafana/grafana/issues/4640)

# 3.0.0-beta2 (2016-04-04)

### New Features (introduces since 3.0-beta1)
* **Preferences**: Set home dashboard on user and org level, closes [#1678](https://github.com/grafana/grafana/issues/1678)
* **Preferences**: Set timezone on user and org level, closes [#3214](https://github.com/grafana/grafana/issues/3214), [#1200](https://github.com/grafana/grafana/issues/1200)
* **Preferences**: Set theme on user and org level, closes [#3214](https://github.com/grafana/grafana/issues/3214), [#1917](https://github.com/grafana/grafana/issues/1917)

### Bug fixes
* **Dashboard**: Fixed dashboard panel layout for mobile devices, fixes [#4529](https://github.com/grafana/grafana/issues/4529)
* **Table Panel**: Fixed issue with table panel sort, fixes [#4532](https://github.com/grafana/grafana/issues/4532)
* **Page Load Crash**: A Datasource with null jsonData would make Grafana fail to load page, fixes [#4536](https://github.com/grafana/grafana/issues/4536)
* **Metrics tab**: Fix for missing datasource name in datasource selector, fixes [#4541](https://github.com/grafana/grafana/issues/4540)
* **Graph**: Fix legend in table mode with series on right-y axis, fixes [#4551](https://github.com/grafana/grafana/issues/4551), [#1145](https://github.com/grafana/grafana/issues/1145)

# 3.0.0-beta1 (2016-03-31)

### New Features
* **Playlists**: Playlists can now be persisted and started from urls, closes [#3655](https://github.com/grafana/grafana/issues/3655)
* **Metadata**: Settings panel now shows dashboard metadata, closes [#3304](https://github.com/grafana/grafana/issues/3304)
* **InfluxDB**: Support for policy selection in query editor, closes [#2018](https://github.com/grafana/grafana/issues/2018)
* **Snapshots UI**: Dashboard snapshots list can be managed through UI, closes[#1984](https://github.com/grafana/grafana/issues/1984)
* **Prometheus**: Prometheus annotation support, closes[#2883](https://github.com/grafana/grafana/pull/2883)
* **Cli**: New cli tool for downloading and updating plugins
* **Annotations**: Annotations can now contain links that can be clicked (you can navigate on to annotation popovers), closes [#1588](https://github.com/grafana/grafana/issues/1588)
* **Opentsdb**: Opentsdb 2.2 filters support, closes[#3077](https://github.com/grafana/grafana/issues/3077)

### Breaking changes
* **Plugin API**: Both datasource and panel plugin api (and plugin.json schema) have been updated, requiring an update to plugins. See [plugin api](https://github.com/grafana/grafana/blob/master/public/app/plugins/plugin_api.md) for more info.
* **InfluxDB 0.8.x** The data source for the old version of influxdb (0.8.x) is no longer included in default builds, but can easily be installed via improved plugin system, closes [#3523](https://github.com/grafana/grafana/issues/3523)
* **KairosDB** The data source is no longer included in default builds, but can easily be installed via improved plugin system, closes [#3524](https://github.com/grafana/grafana/issues/3524)
* **Templating**: Templating value formats (glob/regex/pipe etc) are now handled automatically and not specified by the user, this makes variable values possible to reuse in many contexts. It can in some edge cases break existing dashboards that have template variables that do not reload on dashboard load. To fix any issue just go into template variable options and update the variable (so it's values are reloaded.).

### Enhancements
* **LDAP**: Support for nested LDAP Groups, closes [#4401](https://github.com/grafana/grafana/issues/4401), [#3808](https://github.com/grafana/grafana/issues/3808)
* **Sessions**: Support for memcached as session storage, closes [#3458](https://github.com/grafana/grafana/issues/3458)
* **mysql**: Grafana now supports ssl for mysql, closes [#3584](https://github.com/grafana/grafana/issues/3584)
* **snapshot**: Annotations are now included in snapshots, closes [#3635](https://github.com/grafana/grafana/issues/3635)
* **Admin**: Admin can now have global overview of Grafana setup, closes [#3812](https://github.com/grafana/grafana/issues/3812)
* **graph**: Right side legend height is now fixed at row height, closes [#1277](https://github.com/grafana/grafana/issues/1277)
* **Table**: All content in table panel is now html escaped, closes [#3673](https://github.com/grafana/grafana/issues/3673)
* **graph**: Template variables can now be used in TimeShift and TimeFrom, closes[#1960](https://github.com/grafana/grafana/issues/1960)
* **Tooltip**: Optionally add milliseconds to timestamp in tool tip, closes[#2248](https://github.com/grafana/grafana/issues/2248)
* **Opentsdb**: Support milliseconds when using openTSDB datasource, closes [#2865](https://github.com/grafana/grafana/issues/2865)
* **Opentsdb**: Add support for annotations, closes[#664](https://github.com/grafana/grafana/issues/664)

### Bug fixes
* **Playlist**: Fix for memory leak when running a playlist, closes [#3794](https://github.com/grafana/grafana/pull/3794)
* **InfluxDB**: Fix for InfluxDB and table panel when using Format As Table and having group by time, fixes [#3928](https://github.com/grafana/grafana/issues/3928)
* **Panel Time shift**: Fix for panel time range and using dashboard times liek `Today` and `This Week`, fixes [#3941](https://github.com/grafana/grafana/issues/3941)
* **Row repeat**: Repeated rows will now appear next to each other and not by the bottom of the dashboard, fixes [#3942](https://github.com/grafana/grafana/issues/3942)
* **Png renderer**: Fix for phantomjs path on windows, fixes [#3657](https://github.com/grafana/grafana/issues/3657)

# 2.6.1 (unrelased, 2.6.x branch)

### New Features
* **Elasticsearch**: Support for derivative unit option, closes [#3512](https://github.com/grafana/grafana/issues/3512)

### Bug fixes
* **Graph Panel**: Fixed typehead when adding series style override, closes [#3554](https://github.com/grafana/grafana/issues/3554)

# 2.6.0 (2015-12-14)

### New Features
* **Elasticsearch**: Support for pipeline aggregations Moving average and derivative, closes [#2715](https://github.com/grafana/grafana/issues/2715)
* **Elasticsearch**: Support for inline script and missing options for metrics, closes [#3500](https://github.com/grafana/grafana/issues/3500)
* **Syslog**: Support for syslog logging, closes [#3161](https://github.com/grafana/grafana/pull/3161)
* **Timepicker**: Always show refresh button even with refresh rate, closes [#3498](https://github.com/grafana/grafana/pull/3498)
* **Login**: Make it possible to change the login hint on the login page, closes [#2571](https://github.com/grafana/grafana/pull/2571)

### Bug Fixes
* **metric editors**: Fix for clicking typeahead auto dropdown option, fixes [#3428](https://github.com/grafana/grafana/issues/3428)
* **influxdb**: Fixed issue showing Group By label only on first query, fixes [#3453](https://github.com/grafana/grafana/issues/3453)
* **logging**: Add more verbose info logging for http reqeusts, closes [#3405](https://github.com/grafana/grafana/pull/3405)

# 2.6.0-Beta1 (2015-12-04)

### New Table Panel
* **table**:  New powerful and flexible table panel, closes [#215](https://github.com/grafana/grafana/issues/215)

### Enhancements
* **CloudWatch**: Support for multiple AWS Credentials, closes [#3053](https://github.com/grafana/grafana/issues/3053), [#3080](https://github.com/grafana/grafana/issues/3080)
* **Elasticsearch**: Support for dynamic daily indices for annotations, closes [#3061](https://github.com/grafana/grafana/issues/3061)
* **Elasticsearch**: Support for setting min_doc_count for date histogram, closes [#3416](https://github.com/grafana/grafana/issues/3416)
* **Graph Panel**: Option to hide series with all zeroes from legend and tooltip, closes [#1381](https://github.com/grafana/grafana/issues/1381), [#3336](https://github.com/grafana/grafana/issues/3336)

### Bug Fixes
* **cloudwatch**: fix for handling of period for long time ranges, fixes [#3086](https://github.com/grafana/grafana/issues/3086)
* **dashboard**: fix for collapse row by clicking on row title, fixes [#3065](https://github.com/grafana/grafana/issues/3065)
* **influxdb**: fix for relative time ranges `last x months` and `last x years`, fixes [#3067](https://github.com/grafana/grafana/issues/3067)
* **graph**: layout fix for color picker when right side legend was enabled, fixes [#3093](https://github.com/grafana/grafana/issues/3093)
* **elasticsearch**: disabling elastic query (via eye) caused error, fixes [#3300](https://github.com/grafana/grafana/issues/3300)

### Breaking changes
* **elasticsearch**: Manual json edited queries are not supported any more (They very barely worked in 2.5)

# 2.5 (2015-10-28)

**New Feature: Mix data sources**
- A built in data source is now available named `-- Mixed --`, When picked in the metrics tab,
it allows you to add queries of differnet data source types & instances to the same graph/panel!
[Issue #436](https://github.com/grafana/grafana/issues/436)

**New Feature: Elasticsearch Metrics Query Editor and Viz Support**
- Feature rich query editor and processing features enables you to issues all kind of metric queries to Elasticsearch
- See [Issue #1034](https://github.com/grafana/grafana/issues/1034) for more info.

**New Feature: New and much improved time picker**
- Support for quick ranges like `Today`, `This day last week`, `This week`, `The day so far`, etc.
- Improved UI and improved support for UTC, [Issue #2761](https://github.com/grafana/grafana/issues/2761) for more info.

**User Onboarding**
- Org admin can now send email invites (or invite links) to people who are not yet Grafana users
- Sign up flow now supports email verification (if enabled)
- See [Issue #2353](https://github.com/grafana/grafana/issues/2353) for more info.

**Other new Features && Enhancements**
- [Pull  #2720](https://github.com/grafana/grafana/pull/2720). Admin: Initial basic quota support (per Org)
- [Issue #2577](https://github.com/grafana/grafana/issues/2577). Panel: Resize handles in panel bottom right corners for easy width and height change
- [Issue #2457](https://github.com/grafana/grafana/issues/2457). Admin: admin page for all grafana organizations (list / edit view)
- [Issue #1186](https://github.com/grafana/grafana/issues/1186). Time Picker: New option `today`, will set time range from midnight to now
- [Issue #2647](https://github.com/grafana/grafana/issues/2647). InfluxDB: You can now set group by time interval on each query
- [Issue #2599](https://github.com/grafana/grafana/issues/2599). InfluxDB: Improved alias support, you can now use the `AS` clause for each select statement
- [Issue #2708](https://github.com/grafana/grafana/issues/2708). InfluxDB: You can now set math expression for select clauses.
- [Issue #1575](https://github.com/grafana/grafana/issues/1575). Drilldown link: now you can click on the external link icon in the panel header to access drilldown links!
- [Issue #1646](https://github.com/grafana/grafana/issues/1646). OpenTSDB: Fetch list of aggregators from OpenTSDB
- [Issue #2955](https://github.com/grafana/grafana/issues/2955). Graph: More axis units (Length, Volume, Temperature, Pressure, etc), thanks @greglook
- [Issue #2928](https://github.com/grafana/grafana/issues/2928). LDAP: Support for searching for groups memberships, i.e. POSIX (no memberOf) schemas, also multiple ldap servers, and root ca cert, thanks @abligh

**Fixes**
- [Issue #2413](https://github.com/grafana/grafana/issues/2413). InfluxDB 0.9: Fix for handling empty series object in response from influxdb
- [Issue #2574](https://github.com/grafana/grafana/issues/2574). Snapshot: Fix for snapshot with expire 7 days option, 7 days option not correct, was 7 hours
- [Issue #2568](https://github.com/grafana/grafana/issues/2568). AuthProxy: Fix for server side rendering of panel when using auth proxy
- [Issue #2490](https://github.com/grafana/grafana/issues/2490). Graphite: Dashboard import was broken in 2.1 and 2.1.1, working now
- [Issue #2565](https://github.com/grafana/grafana/issues/2565). TimePicker: Fix for when you applied custom time range it did not refreh dashboard
- [Issue #2563](https://github.com/grafana/grafana/issues/2563). Annotations: Fixed issue when html sanitizer failes for title to annotation body, now fallbacks to html escaping title and text
- [Issue #2564](https://github.com/grafana/grafana/issues/2564). Templating: Another atempt at fixing #2534 (Init multi value template var used in repeat panel from url)
- [Issue #2620](https://github.com/grafana/grafana/issues/2620). Graph: multi series tooltip did no highlight correct point when stacking was enabled and series were of different resolution
- [Issue #2636](https://github.com/grafana/grafana/issues/2636). InfluxDB: Do no show template vars in dropdown for tag keys and group by keys
- [Issue #2604](https://github.com/grafana/grafana/issues/2604). InfluxDB: More alias options, can now use `$[0-9]` syntax to reference part of a measurement name (seperated by dots)

**Breaking Changes**
- Notice to makers/users of custom data sources, there is a minor breaking change in 2.2 that
require an update to custom data sources for them to work in 2.2. [Read this doc](https://github.com/grafana/grafana/tree/master/docs/sources/datasources/plugin_api.md) for more on the
data source api change.
- Data source api changes, [PLUGIN_CHANGES.md](https://github.com/grafana/grafana/blob/master/public/app/plugins/PLUGIN_CHANGES.md)
- The duplicate query function used in data source editors is changed, and moveMetricQuery function was renamed

**Tech (Note for devs)**
Started using Typescript (transpiled to ES5), uncompiled typescript files and less files are in public folder (in source tree)
This folder is never modified by build steps. Compiled css and javascript files are put in public_gen, all other files
that do not undergo transformation are just copied from public to public_gen, it is public_gen that is used by grafana-server
if it is found.

Grunt & Watch tasks:
- `grunt` : default task, will remove public_gen, copy over all files from public, do less & typescript compilation
- `grunt watch`: will watch for changes to less, and typescript files and compile them to public_gen, and for other files it will just copy them to public_gen


# 2.1.3 (2015-08-24)

**Fixes**
- [Issue #2580](https://github.com/grafana/grafana/issues/2580). Packaging: ldap.toml was not marked as config file and could be overwritten in upgrade
- [Issue #2564](https://github.com/grafana/grafana/issues/2564). Templating: Another atempt at fixing #2534 (Init multi value template var used in repeat panel from url)

# 2.1.2 (2015-08-20)

**Fixes**
- [Issue #2558](https://github.com/grafana/grafana/issues/2558). DragDrop: Fix for broken drag drop behavior
- [Issue #2534](https://github.com/grafana/grafana/issues/2534). Templating: fix for setting template variable value via url and having repeated panels or rows

# 2.1.1 (2015-08-11)

**Fixes**
- [Issue #2443](https://github.com/grafana/grafana/issues/2443). Templating: Fix for buggy repeat row behavior when combined with with repeat panel due to recent change before 2.1 release
- [Issue #2442](https://github.com/grafana/grafana/issues/2442). Templating: Fix text panel when using template variables in text in in repeated panel
- [Issue #2446](https://github.com/grafana/grafana/issues/2446). InfluxDB: Fix for using template vars inside alias field (InfluxDB 0.9)
- [Issue #2460](https://github.com/grafana/grafana/issues/2460). SinglestatPanel: Fix to handle series with no data points
- [Issue #2461](https://github.com/grafana/grafana/issues/2461). LDAP: Fix for ldap users with empty email address
- [Issue #2484](https://github.com/grafana/grafana/issues/2484). Graphite: Fix bug when using series ref (#A-Z) and referenced series is hidden in query editor.
- [Issue #1896](https://github.com/grafana/grafana/issues/1896). Postgres: Dashboard search is now case insensitive when using Postgres

**Enhancements**
- [Issue #2477](https://github.com/grafana/grafana/issues/2477). InfluxDB(0.9): Added more condition operators (`<`, `>`, `<>`, `!~`), thx @thuck
- [Issue #2483](https://github.com/grafana/grafana/issues/2484). InfluxDB(0.9): Use $col as option in alias patterns, thx @thuck

# 2.1.0 (2015-08-04)

**Data sources**
- [Issue #1525](https://github.com/grafana/grafana/issues/1525). InfluxDB: Full support for InfluxDB 0.9 with new adapted query editor
- [Issue #2191](https://github.com/grafana/grafana/issues/2191). KariosDB: Grafana now ships with a KariosDB data source plugin, thx @masaori335
- [Issue #1177](https://github.com/grafana/grafana/issues/1177). OpenTSDB: Limit tags by metric, OpenTSDB config option tsd.core.meta.enable_realtime_ts must enabled for OpenTSDB lookup api
- [Issue #1250](https://github.com/grafana/grafana/issues/1250). OpenTSDB: Support for template variable values lookup queries

**New dashboard features**
- [Issue #1144](https://github.com/grafana/grafana/issues/1144). Templating: You can now select multiple template variables values at the same time.
- [Issue #1922](https://github.com/grafana/grafana/issues/1922). Templating: Specify multiple variable values via URL params.
- [Issue #1888](https://github.com/grafana/grafana/issues/1144). Templating: Repeat panel or row for each selected template variable value
- [Issue #1888](https://github.com/grafana/grafana/issues/1944). Dashboard: Custom Navigation links & dynamic links to related dashboards
- [Issue #590](https://github.com/grafana/grafana/issues/590).   Graph: Define series color using regex rule
- [Issue #2162](https://github.com/grafana/grafana/issues/2162). Graph: New series style override, negative-y transform and stack groups
- [Issue #2096](https://github.com/grafana/grafana/issues/2096). Dashboard list panel: Now supports search by multiple tags
- [Issue #2203](https://github.com/grafana/grafana/issues/2203). Singlestat: Now support string values

**User or Organization admin**
- [Issue #1899](https://github.com/grafana/grafana/issues/1899). Organization: You can now update the organization user role directly (without removing and readding the organization user).
- [Issue #2088](https://github.com/grafana/grafana/issues/2088). Roles: New user role `Read Only Editor` that replaces the old `Viewer` role behavior

**Backend**
- [Issue #2218](https://github.com/grafana/grafana/issues/2218). Auth: You can now authenicate against api with username / password using basic auth
- [Issue #2095](https://github.com/grafana/grafana/issues/2095). Search: Search now supports filtering by multiple dashboard tags
- [Issue #1905](https://github.com/grafana/grafana/issues/1905). Github OAuth: You can now configure a Github team membership requirement, thx @dewski
- [Issue #2052](https://github.com/grafana/grafana/issues/2052). Github OAuth: You can now configure a Github organization requirement, thx @indrekj
- [Issue #1891](https://github.com/grafana/grafana/issues/1891). Security: New config option to disable the use of gravatar for profile images
- [Issue #1921](https://github.com/grafana/grafana/issues/1921). Auth: Support for user authentication via reverse proxy header (like X-Authenticated-User, or X-WEBAUTH-USER)
- [Issue #960](https://github.com/grafana/grafana/issues/960).   Search: Backend can now index a folder with json files, will be available in search (saving back to folder is not supported, this feature is meant for static generated json dashboards)

**Breaking changes**
- [Issue #1826](https://github.com/grafana/grafana/issues/1826). User role 'Viewer' are now prohibited from entering edit mode (and doing other transient dashboard edits). A new role `Read Only Editor` will replace the old Viewer behavior
- [Issue #1928](https://github.com/grafana/grafana/issues/1928). HTTP API: GET /api/dashboards/db/:slug response changed property `model` to `dashboard` to match the POST request nameing
- Backend render URL changed from `/render/dashboard/solo` `render/dashboard-solo/` (in order to have consistent dashboard url `/dashboard/:type/:slug`)
- Search HTTP API response has changed (simplified), tags list moved to seperate HTTP resource URI
- Datasource HTTP api breaking change, ADD datasource is now POST /api/datasources/, update is now PUT /api/datasources/:id

**Fixes**
- [Issue #2185](https://github.com/grafana/grafana/issues/2185). Graph: fixed PNG rendering of panels with legend table to the right
- [Issue #2163](https://github.com/grafana/grafana/issues/2163). Backend: Load dashboards with capital letters in the dashboard url slug (url id)

# 2.0.3 (unreleased - 2.0.x branch)

**Fixes**
- [Issue #1872](https://github.com/grafana/grafana/issues/1872). Firefox/IE issue, invisible text in dashboard search fixed
- [Issue #1857](https://github.com/grafana/grafana/issues/1857). /api/login/ping Fix for issue when behind reverse proxy and subpath
- [Issue #1863](https://github.com/grafana/grafana/issues/1863). MySQL: Dashboard.data column type changed to mediumtext (sql migration added)

# 2.0.2 (2015-04-22)

**Fixes**
- [Issue #1832](https://github.com/grafana/grafana/issues/1832). Graph Panel + Legend Table mode: Many series casued zero height graph, now legend will never reduce the height of the graph below 50% of row height.
- [Issue #1846](https://github.com/grafana/grafana/issues/1846). Snapshots: Fixed issue with snapshoting dashboards with an interval template variable
- [Issue #1848](https://github.com/grafana/grafana/issues/1848). Panel timeshift: You can now use panel timeshift without a relative time override

# 2.0.1 (2015-04-20)

**Fixes**
- [Issue #1784](https://github.com/grafana/grafana/issues/1784). Data source proxy: Fixed issue with using data source proxy when grafana is behind nginx suburl
- [Issue #1749](https://github.com/grafana/grafana/issues/1749). Graph Panel: Table legends are now visible when rendered to PNG
- [Issue #1786](https://github.com/grafana/grafana/issues/1786). Graph Panel: Legend in table mode now aligns, graph area is reduced depending on how many series
- [Issue #1734](https://github.com/grafana/grafana/issues/1734). Support for unicode / international characters in dashboard title (improved slugify)
- [Issue #1782](https://github.com/grafana/grafana/issues/1782). Github OAuth: Now works with Github for Enterprise, thanks @williamjoy
- [Issue #1780](https://github.com/grafana/grafana/issues/1780). Dashboard snapshot: Should not require login to view snapshot, Fixes #1780

# 2.0.0-Beta3 (2015-04-12)

**RPM / DEB Package changes (to follow HFS)**
- binary name changed to grafana-server
- does not install to `/opt/grafana` any more, installs to `/usr/share/grafana`
- binary to `/usr/sbin/grafana-server`
- init.d script improvements, renamed to `/etc/init.d/grafana-server`
- added default file with environment variables,
  - `/etc/default/grafana-server` (deb/ubuntu)
  - `/etc/sysconfig/grafana-server` (centos/redhat)

- added systemd service file, tested on debian jessie and centos7
- config file in same location `/etc/grafana/grafana.ini` (now complete config file but with every setting commented out)
- data directory (where sqlite3) file is stored is now by default `/var/lib/grafana`
- no symlinking current to versions anymore
- For more info see [Issue #1758](https://github.com/grafana/grafana/issues/1758).

**Config breaking change (setting rename)**
- `[log] root_path` has changed to `[paths] logs`

# 2.0.0-Beta2  (...)

**Enhancements**
- [Issue #1701](https://github.com/grafana/grafana/issues/1701). Share modal: Override UI theme via URL param for Share link, rendered panel, or embedded panel
- [Issue #1660](https://github.com/grafana/grafana/issues/1660). OAuth: Specify allowed email address domains for google or and github oauth logins

**Fixes**
- [Issue #1649](https://github.com/grafana/grafana/issues/1649). HTTP API: grafana /render calls nows with api keys
- [Issue #1667](https://github.com/grafana/grafana/issues/1667). Datasource proxy & session timeout fix (casued 401 Unauthorized error after a while)
- [Issue #1707](https://github.com/grafana/grafana/issues/1707). Unsaved changes: Do not show for snapshots, scripted and file based dashboards
- [Issue #1703](https://github.com/grafana/grafana/issues/1703). Unsaved changes: Do not show for users with role `Viewer`
- [Issue #1675](https://github.com/grafana/grafana/issues/1675). Data source proxy: Fixed issue with Gzip enabled and data source proxy
- [Issue #1681](https://github.com/grafana/grafana/issues/1681). MySQL session: fixed problem using mysql as session store
- [Issue #1671](https://github.com/grafana/grafana/issues/1671). Data sources: Fixed issue with changing default data source (should not require full page load to take effect, now fixed)
- [Issue #1685](https://github.com/grafana/grafana/issues/1685). Search: Dashboard results should be sorted alphabetically
- [Issue #1673](https://github.com/grafana/grafana/issues/1673). Basic auth: Fixed issue when using basic auth proxy infront of Grafana

# 2.0.0-Beta1 (2015-03-30)

**Important Note**

Grafana 2.x is fundamentally different from 1.x; it now ships with an integrated backend server. Please read the [Documentation](http://docs.grafana.org) for more detailed about this SIGNIFCANT change to Grafana

**New features**
- [Issue #1623](https://github.com/grafana/grafana/issues/1623). Share Dashboard: Dashboard snapshot sharing (dash and data snapshot), save to local or save to public snapshot dashboard snapshots.raintank.io site
- [Issue #1622](https://github.com/grafana/grafana/issues/1622). Share Panel: The share modal now has an embed option, gives you an iframe that you can use to embedd a single graph on another web site
- [Issue #718](https://github.com/grafana/grafana/issues/718).   Dashboard: When saving a dashboard and another user has made changes inbetween the user is promted with a warning if he really wants to overwrite the other's changes
- [Issue #1331](https://github.com/grafana/grafana/issues/1331). Graph & Singlestat: New axis/unit format selector and more units (kbytes, Joule, Watt, eV), and new design for graph axis & grid tab and single stat options tab views
- [Issue #1241](https://github.com/grafana/grafana/issues/1242). Timepicker: New option in timepicker (under dashboard settings), to change ``now`` to be for example ``now-1m``, usefull when you want to ignore last minute because it contains incomplete data
- [Issue #171](https://github.com/grafana/grafana/issues/171).   Panel: Different time periods, panels can override dashboard relative time and/or add a time shift
- [Issue #1488](https://github.com/grafana/grafana/issues/1488). Dashboard: Clone dashboard / Save as
- [Issue #1458](https://github.com/grafana/grafana/issues/1458). User: persisted user option for dark or light theme  (no longer an option on a dashboard)
- [Issue #452](https://github.com/grafana/grafana/issues/452).   Graph: Adds logarithmic scale option for base 10, base 16 and base 1024

**Enhancements**
- [Issue #1366](https://github.com/grafana/grafana/issues/1366). Graph & Singlestat: Support for additional units, Fahrenheit (°F) and Celsius (°C), Humidity (%H), kW, watt-hour (Wh), kilowatt-hour (kWh), velocities (m/s, km/h, mpg, knot)
- [Issue #978](https://github.com/grafana/grafana/issues/978).   Graph: Shared tooltip improvement, can now support metrics of different resolution/intervals
- [Issue #1297](https://github.com/grafana/grafana/issues/1297). Graphite: Added cumulative and minimumBelow graphite functions
- [Issue #1296](https://github.com/grafana/grafana/issues/1296). InfluxDB: Auto escape column names with special characters. Thanks @steven-aerts
- [Issue #1321](https://github.com/grafana/grafana/issues/1321). SingleStatPanel: You can now use template variables in pre & postfix
- [Issue #599](https://github.com/grafana/grafana/issues/599).   Graph: Added right y axis label setting and graph support
- [Issue #1253](https://github.com/grafana/grafana/issues/1253). Graph & Singlestat: Users can now set decimal precision for legend and tooltips (override auto precision)
- [Issue #1255](https://github.com/grafana/grafana/issues/1255). Templating: Dashboard will now wait to load until all template variables that have refresh on load set or are initialized via url to be fully loaded and so all variables are in valid state before panels start issuing metric requests.
- [Issue #1344](https://github.com/grafana/grafana/issues/1344). OpenTSDB: Alias patterns (reference tag values), syntax is: $tag_tagname or [[tag_tagname]]

**Fixes**
- [Issue #1298](https://github.com/grafana/grafana/issues/1298). InfluxDB: Fix handling of empty array in templating variable query
- [Issue #1309](https://github.com/grafana/grafana/issues/1309). Graph: Fixed issue when using zero as a grid threshold
- [Issue #1345](https://github.com/grafana/grafana/issues/1345). UI: Fixed position of confirm modal when scrolled down
- [Issue #1372](https://github.com/grafana/grafana/issues/1372). Graphite: Fix for nested complex queries, where a query references a query that references another query (ie the #[A-Z] syntax)
- [Issue #1363](https://github.com/grafana/grafana/issues/1363). Templating: Fix to allow custom template variables to contain white space, now only splits on ','
- [Issue #1359](https://github.com/grafana/grafana/issues/1359). Graph: Fix for all series tooltip showing series with all null values when ``Hide Empty`` option is enabled
- [Issue #1497](https://github.com/grafana/grafana/issues/1497). Dashboard: Fixed memory leak when switching dashboards

**Changes**
- Dashboard title change & save will no longer create a new dashboard, it will just change the title.

**OpenTSDB breaking change**
- [Issue #1438](https://github.com/grafana/grafana/issues/1438). OpenTSDB: Automatic downsample interval passed to OpenTSDB (depends on timespan and graph width)
- NOTICE, Downsampling is now enabled by default, so if you have not picked a downsample aggregator in your metric query do so or your graphs will be missleading
- This will make Grafana a lot quicker for OpenTSDB users when viewing large time spans without having to change the downsample interval manually.

**Tech**
- [Issue #1311](https://github.com/grafana/grafana/issues/1311). Tech: Updated Font-Awesome from 3.2 to 4.2

# 1.9.1 (2014-12-29)

**Enhancements**
- [Issue #1028](https://github.com/grafana/grafana/issues/1028). Graph: New legend option ``hideEmtpy`` to hide series with only null values from legend
- [Issue #1242](https://github.com/grafana/grafana/issues/1242). OpenTSDB: Downsample query field now supports interval template variable
- [Issue #1126](https://github.com/grafana/grafana/issues/1126). InfluxDB: Support more than 10 series name segments when using alias ``$number`` patterns

**Fixes**
- [Issue #1251](https://github.com/grafana/grafana/issues/1251). Graph: Fix for y axis and scaled units (GiB etc) caused rounding, for example 400 GiB instead of 378 GiB
- [Issue #1199](https://github.com/grafana/grafana/issues/1199). Graph: fix for series tooltip when one series is hidden/disabled
- [Issue #1207](https://github.com/grafana/grafana/issues/1207). Graphite: movingAverage / movingMedian parameter type impovement, now handles int and interval parameter

# 1.9.0 (2014-12-02)

**Enhancements**
- [Issue #1130](https://github.com/grafana/grafana/issues/1130). SinglestatPanel: Added null point handling, and value to text mapping


**Fixes**
- [Issue #1087](https://github.com/grafana/grafana/issues/1087). Panel: Fixed IE9 crash due to angular drag drop
- [Issue #1093](https://github.com/grafana/grafana/issues/1093). SingleStatPanel: Fixed position for drilldown link tooltip when dashboard requires scrolling
- [Issue #1095](https://github.com/grafana/grafana/issues/1095). DrilldownLink: template variables in params property was not interpolated
- [Issue #1114](https://github.com/grafana/grafana/issues/1114). Graphite: Lexer fix, allow equal sign (=) in metric paths
- [Issue #1136](https://github.com/grafana/grafana/issues/1136). Graph: Fix to legend value Max and negative values
- [Issue #1150](https://github.com/grafana/grafana/issues/1150). SinglestatPanel: Fixed absolute drilldown link issue
- [Issue #1123](https://github.com/grafana/grafana/issues/1123). Firefox: Workaround for Firefox bug, casued input text fields to not be selectable and not have placeable cursor
- [Issue #1108](https://github.com/grafana/grafana/issues/1108). Graph: Fix for tooltip series order when series draw order was changed with zindex property

# 1.9.0-rc1 (2014-11-17)

**UI Improvements**
- [Issue #770](https://github.com/grafana/grafana/issues/770). UI: Panel dropdown menu replaced with a new panel menu

**Graph**
- [Issue #877](https://github.com/grafana/grafana/issues/877). Graph: Smart auto decimal precision when using scaled unit formats
- [Issue #850](https://github.com/grafana/grafana/issues/850). Graph: Shared tooltip that shows multiple series & crosshair line, thx @toni-moreno
- [Issue #940](https://github.com/grafana/grafana/issues/940). Graph: New series style override option "Fill below to", useful to visualize max & min as a shadow for the mean
- [Issue #1030](https://github.com/grafana/grafana/issues/1030). Graph: Legend table display/look changed, now includes column headers for min/max/avg, and full width (unless on right side)
- [Issue #861](https://github.com/grafana/grafana/issues/861). Graph: Export graph time series data as csv file

**New Panels**
- [Issue #951](https://github.com/grafana/grafana/issues/951). SingleStat: New singlestat panel

**Misc**
- [Issue #864](https://github.com/grafana/grafana/issues/846). Panel: Share panel feature, get a link to panel with the current time range
- [Issue #938](https://github.com/grafana/grafana/issues/938). Panel: Plugin panels now reside outside of app/panels directory
- [Issue #952](https://github.com/grafana/grafana/issues/952). Help: Shortcut "?" to open help modal with list of all shortcuts
- [Issue #991](https://github.com/grafana/grafana/issues/991). ScriptedDashboard: datasource services are now available in scripted dashboards, you can query datasource for metric keys, generate dashboards, and even save them in a scripted dashboard (see scripted_gen_and_save.js for example)
- [Issue #1041](https://github.com/grafana/grafana/issues/1041). Panel: All panels can now have links to other dashboards or absolute links, these links are available in the panel menu.

**Changes**
- [Issue #1007](https://github.com/grafana/grafana/issues/1007). Graph: Series hide/show toggle changed to be default exclusive, so clicking on a series name will show only that series. (SHIFT or meta)+click will toggle hide/show.

**OpenTSDB**
- [Issue #930](https://github.com/grafana/grafana/issues/930). OpenTSDB: Adding counter max and counter reset value to open tsdb query editor, thx @rsimiciuc
- [Issue #917](https://github.com/grafana/grafana/issues/917). OpenTSDB: Templating support for OpenTSDB series name and tags, thx @mchataigner

**InfluxDB**
- [Issue #714](https://github.com/grafana/grafana/issues/714). InfluxDB: Support for sub second resolution graphs

**Fixes**
- [Issue #925](https://github.com/grafana/grafana/issues/925). Graph: bar width calculation fix for some edge cases (bars would render on top of each other)
- [Issue #505](https://github.com/grafana/grafana/issues/505). Graph: fix for second y axis tick unit labels wrapping on the next line
- [Issue #987](https://github.com/grafana/grafana/issues/987). Dashboard: Collapsed rows became invisible when hide controls was enabled

=======
# 1.8.1 (2014-09-30)

**Fixes**
- [Issue #855](https://github.com/grafana/grafana/issues/855). Graph: Fix for scroll issue in graph edit mode when dropdown goes below screen
- [Issue #847](https://github.com/grafana/grafana/issues/847). Graph: Fix for series draw order not being the same after hiding/unhiding series
- [Issue #851](https://github.com/grafana/grafana/issues/851). Annotations: Fix for annotations not reloaded when switching between 2 dashboards with annotations
- [Issue #846](https://github.com/grafana/grafana/issues/846). Edit panes: Issue when open row or json editor when scrolled down the page, unable to scroll and you did not see editor
- [Issue #840](https://github.com/grafana/grafana/issues/840). Import: Fixes to import from json file and import from graphite. Issues was lingering state from previous dashboard.
- [Issue #859](https://github.com/grafana/grafana/issues/859). InfluxDB: Fix for bug when saving dashboard where title is the same as slugified url id
- [Issue #852](https://github.com/grafana/grafana/issues/852). White theme: Fixes for hidden series legend text and disabled annotations color

# 1.8.0 (2014-09-22)

Read this [blog post](https://grafana.com/blog/2014/09/11/grafana-1.8.0-rc1-released) for an overview of all improvements.

**Fixes**
- [Issue #802](https://github.com/grafana/grafana/issues/802). Annotations: Fix when using InfluxDB datasource
- [Issue #795](https://github.com/grafana/grafana/issues/795). Chrome: Fix for display issue in chrome beta & chrome canary when entering edit mode
- [Issue #818](https://github.com/grafana/grafana/issues/818). Graph: Added percent y-axis format
- [Issue #828](https://github.com/grafana/grafana/issues/828). Elasticsearch: saving new dashboard with title equal to slugified url would cause it to deleted.
- [Issue #830](https://github.com/grafana/grafana/issues/830). Annotations: Fix for elasticsearch annotations and mapping nested fields

# 1.8.0-RC1 (2014-09-12)

**UI polish / changes**
- [Issue #725](https://github.com/grafana/grafana/issues/725). UI: All modal editors are removed and replaced by an edit pane under menu. The look of editors is also updated and polished. Search dropdown is also shown as pane under menu and has seen some UI polish.

**Filtering/Templating feature overhaul**
- Filtering renamed to Templating, and filter items to variables
- Filter editing has gotten its own edit pane with much improved UI and options
- [Issue #296](https://github.com/grafana/grafana/issues/296). Templating: Can now retrieve variable values from a non-default data source
- [Issue #219](https://github.com/grafana/grafana/issues/219). Templating: Template variable value selection is now a typeahead autocomplete dropdown
- [Issue #760](https://github.com/grafana/grafana/issues/760). Templating: Extend template variable syntax to include $variable syntax replacement
- [Issue #234](https://github.com/grafana/grafana/issues/234). Templating: Interval variable type for time intervals summarize/group by parameter, included "auto" option, and auto step counts option.
- [Issue #262](https://github.com/grafana/grafana/issues/262). Templating: Ability to use template variables for function parameters via custom variable type, can be used as parameter for movingAverage or scaleToSeconds for example
- [Issue #312](https://github.com/grafana/grafana/issues/312). Templating: Can now use template variables in panel titles
- [Issue #613](https://github.com/grafana/grafana/issues/613). Templating: Full support for InfluxDB, filter by part of series names, extract series substrings, nested queries, multipe where clauses!
- Template variables can be initialized from url, with var-my_varname=value, breaking change, before it was just my_varname.
- Templating and url state sync has some issues that are not solved for this release, see [Issue #772](https://github.com/grafana/grafana/issues/772) for more details.

**InfluxDB Breaking changes**
- To better support templating, fill(0) and group by time low limit some changes has been made to the editor and query model schema
- Currently some of these changes are breaking
- If you used custom condition filter you need to open the graph in edit mode, the editor will update the schema, and the queries should work again
- If you used a raw query you need to remove the time filter and replace it with $timeFilter (this is done automatically when you switch from query editor to raw query, but old raw queries needs to updated)
- If you used group by and later removed the group by the graph could break, open in editor and should correct it
- InfluxDB annotation queries that used [[timeFilter]] should be updated to use $timeFilter syntax instead
- Might write an upgrade tool to update dashboards automatically, but right now master (1.8) includes the above breaking changes

**InfluxDB query editor enhancements**
- [Issue #756](https://github.com/grafana/grafana/issues/756). InfluxDB: Add option for fill(0) and fill(null), integrated help in editor for why this option is important when stacking series
- [Issue #743](https://github.com/grafana/grafana/issues/743). InfluxDB: A group by time option for all queries in graph panel that supports a low limit for auto group by time, very important for stacking and fill(0)
- The above to enhancements solves the problems associated with stacked bars and lines when points are missing, these issues are solved:
- [Issue #673](https://github.com/grafana/grafana/issues/673). InfluxDB: stacked bars missing intermediate data points, unless lines also enabled
- [Issue #674](https://github.com/grafana/grafana/issues/674). InfluxDB: stacked chart ignoring series without latest values
- [Issue #534](https://github.com/grafana/grafana/issues/534). InfluxDB: No order in stacked bars mode

**New features and improvements**
- [Issue #117](https://github.com/grafana/grafana/issues/117). Graphite: Graphite query builder can now handle functions that multiple series as arguments!
- [Issue #281](https://github.com/grafana/grafana/issues/281). Graphite: Metric node/segment selection is now a textbox with autocomplete dropdown, allow for custom glob expression for single node segment without entering text editor mode.
- [Issue #304](https://github.com/grafana/grafana/issues/304). Dashboard: View dashboard json, edit/update any panel using json editor, makes it possible to quickly copy a graph from one dashboard to another.
- [Issue #578](https://github.com/grafana/grafana/issues/578). Dashboard: Row option to display row title even when the row is visible
- [Issue #672](https://github.com/grafana/grafana/issues/672). Dashboard: panel fullscreen & edit state is present in url, can now link to graph in edit & fullscreen mode.
- [Issue #709](https://github.com/grafana/grafana/issues/709). Dashboard: Small UI look polish to search results, made dashboard title link are larger
- [Issue #425](https://github.com/grafana/grafana/issues/425). Graph: New section in 'Display Styles' tab to override any display setting on per series bases (mix and match lines, bars, points, fill, stack, line width etc)
- [Issue #634](https://github.com/grafana/grafana/issues/634). Dashboard: Dashboard tags now in different colors (from fixed palette) determined by tag name.
- [Issue #685](https://github.com/grafana/grafana/issues/685). Dashboard: New config.js option to change/remove window title prefix.
- [Issue #781](https://github.com/grafana/grafana/issues/781). Dashboard: Title URL is now slugified for greater URL readability, works with both ES & InfluxDB storage, is backward compatible
- [Issue #785](https://github.com/grafana/grafana/issues/785). Elasticsearch: Support for full elasticsearch lucene search grammar when searching for dashboards, better async search
- [Issue #787](https://github.com/grafana/grafana/issues/787). Dashboard: time range can now be read from URL parameters, will override dashboard saved time range

**Fixes**
- [Issue #696](https://github.com/grafana/grafana/issues/696). Graph: Fix for y-axis format 'none' when values are in scientific notation (ex 2.3e-13)
- [Issue #733](https://github.com/grafana/grafana/issues/733). Graph: Fix for tooltip current value decimal precision when 'none' axis format was selected
- [Issue #697](https://github.com/grafana/grafana/issues/697). Graphite: Fix for Glob syntax in graphite queries ([1-9] and ?) that made the query editor / parser bail and fallback to a text box.
- [Issue #702](https://github.com/grafana/grafana/issues/702). Graphite: Fix for nonNegativeDerivative function, now possible to not include optional first parameter maxValue
- [Issue #277](https://github.com/grafana/grafana/issues/277). Dashboard: Fix for timepicker date & tooltip when UTC timezone selected.
- [Issue #699](https://github.com/grafana/grafana/issues/699). Dashboard: Fix for bug when adding rows from dashboard settings dialog.
- [Issue #723](https://github.com/grafana/grafana/issues/723). Dashboard: Fix for hide controls setting not used/initialized on dashboard load
- [Issue #724](https://github.com/grafana/grafana/issues/724). Dashboard: Fix for zoom out causing right hand "to" range to be set in the future.

**Tech**
- Upgraded from angularjs 1.1.5 to 1.3 beta 17;
- Switch from underscore to lodash
- helpers to easily unit test angularjs controllers and services
- Test coverage through coveralls
- Upgrade from jquery 1.8.0 to 2.1.1 (**Removes support for IE7 & IE8**)

# 1.7.1 (unreleased)

**Fixes**
- [Issue #691](https://github.com/grafana/grafana/issues/691). Dashboard: Tooltip fixes, sometimes they would not show, and sometimes they would get stuck.
- [Issue #695](https://github.com/grafana/grafana/issues/695). Dashboard: Tooltip on goto home menu icon would get stuck after clicking on it

# 1.7.0 (2014-08-11)

**Fixes**
- [Issue #652](https://github.com/grafana/grafana/issues/652). Timepicker: Entering custom date range impossible when refresh is low (now is constantly reset)
- [Issue #450](https://github.com/grafana/grafana/issues/450). Graph: Tooltip does not disappear sometimes and would get stuck
- [Issue #655](https://github.com/grafana/grafana/issues/655). General: Auto refresh not initiated / started after dashboard loading
- [Issue #657](https://github.com/grafana/grafana/issues/657). General: Fix for refresh icon in IE browsers
- [Issue #661](https://github.com/grafana/grafana/issues/661). Annotations: Elasticsearch querystring with filter template replacements was not interpolated
- [Issue #660](https://github.com/grafana/grafana/issues/660). OpenTSDB: fix opentsdb queries that returned more than one series

**Change**
- [Issue #681](https://github.com/grafana/grafana/issues/681). Dashboard: The panel error bar has been replaced with a small error indicator, this indicator does not change panel height and is a lot less intrusive. Hover over it for short details, click on it for more details.

# 1.7.0-rc1 (2014-08-05)

**New features or improvements**
- [Issue #581](https://github.com/grafana/grafana/issues/581). InfluxDB: Add continuous query in series results (series typeahead).
- [Issue #584](https://github.com/grafana/grafana/issues/584). InfluxDB: Support for alias & alias patterns when using raw query mode
- [Issue #394](https://github.com/grafana/grafana/issues/394). InfluxDB: Annotation support
- [Issue #633](https://github.com/grafana/grafana/issues/633). InfluxDB: InfluxDB can now act as a datastore for dashboards
- [Issue #610](https://github.com/grafana/grafana/issues/610). InfluxDB: Support for InfluxdB v0.8 list series response schemea (series typeahead)
- [Issue #525](https://github.com/grafana/grafana/issues/525). InfluxDB: Enhanced series aliasing (legend names) with pattern replacements
- [Issue #266](https://github.com/grafana/grafana/issues/266). Graphite: New option cacheTimeout to override graphite default memcache timeout
- [Issue #606](https://github.com/grafana/grafana/issues/606). General: New global option in config.js to specify admin password (useful to hinder users from accidentally make changes)
- [Issue #201](https://github.com/grafana/grafana/issues/201). Annotations: Elasticsearch datasource support for events
- [Issue #344](https://github.com/grafana/grafana/issues/344). Annotations: Annotations can now be fetched from non default datasources
- [Issue #631](https://github.com/grafana/grafana/issues/631). Search: max_results config.js option & scroll in search results (To show more or all dashboards)
- [Issue #511](https://github.com/grafana/grafana/issues/511). Text panel: Allow [[..]] filter notation in all text panels (markdown/html/text)
- [Issue #136](https://github.com/grafana/grafana/issues/136). Graph: New legend display option "Align as table"
- [Issue #556](https://github.com/grafana/grafana/issues/556). Graph: New legend display option "Right side", will show legend to the right of the graph
- [Issue #604](https://github.com/grafana/grafana/issues/604). Graph: New axis format, 'bps' (SI unit in steps of 1000) useful for network gear metics
- [Issue #626](https://github.com/grafana/grafana/issues/626). Graph: Downscale y axis to more precise unit, value of 0.1 for seconds format will be formated as 100 ms. Thanks @kamaradclimber
- [Issue #618](https://github.com/grafana/grafana/issues/618). OpenTSDB: Series alias option to override metric name returned from opentsdb. Thanks @heldr

**Documentation**
- [Issue #635](https://github.com/grafana/grafana/issues/635). Docs for features and changes in v1.7, new troubleshooting guide, new Getting started guide, improved install & config guide.


**Changes**
- [Issue #536](https://github.com/grafana/grafana/issues/536). Graphite: Use unix epoch for Graphite from/to for absolute time ranges
- [Issue #641](https://github.com/grafana/grafana/issues/536). General: Dashboard save temp copy feature settings moved from dashboard to config.js, default is enabled, and ttl to 30 days
- [Issue #532](https://github.com/grafana/grafana/issues/532). Schema: Dashboard schema changes, "Unsaved changes" should not appear for schema changes. All changes are backward compatible with old schema.

**Fixes**
- [Issue #545](https://github.com/grafana/grafana/issues/545). Graph: Fix formatting negative values (axis formats, legend values)
- [Issue #460](https://github.com/grafana/grafana/issues/460). Graph: fix for max legend value when max value is zero
- [Issue #628](https://github.com/grafana/grafana/issues/628). Filtering: Fix for nested filters, changing a child filter could result in infinite recursion in some cases
- [Issue #528](https://github.com/grafana/grafana/issues/528). Graphite: Fix for graphite expressions parser failure when metric expressions starts with curly brace segment

# 1.6.1 (2014-06-24)

**New features or improvements**
- [Issue #360](https://github.com/grafana/grafana/issues/360). Ability to set y min/max for right y-axis (RR #519)

**Fixes**

- [Issue #500](https://github.com/grafana/grafana/issues/360). Fixes regex InfluxDB queries intoduced in 1.6.0
- [Issue #506](https://github.com/grafana/grafana/issues/506). Bug in when using % sign in legends (aliases), fixed by removing url decoding of metric names
- [Issue #522](https://github.com/grafana/grafana/issues/522). Series names and column name typeahead cache fix
- [Issue #504](https://github.com/grafana/grafana/issues/504). Fixed influxdb issue with raw query that caused wrong value column detection
- [Issue #526](https://github.com/grafana/grafana/issues/526). Default property that marks which datasource is default in config.js is now optional
- [Issue #342](https://github.com/grafana/grafana/issues/342). Auto-refresh caused 2 refreshes (and hence mulitple queries) each time (at least in firefox)

# 1.6.0 (2014-06-16)

#### New features or improvements
- [Issue #427](https://github.com/grafana/grafana/issues/427). New Y-axis formater for metric values that represent seconds, Thanks @jippi
- [Issue #390](https://github.com/grafana/grafana/issues/390). Allow special characters in serie names (influxdb datasource), Thanks @majst01
- [Issue #428](https://github.com/grafana/grafana/issues/428). Refactoring of filterSrv, Thanks @Tetha
- [Issue #445](https://github.com/grafana/grafana/issues/445). New config for playlist feature. Set playlist_timespan to set default playlist interval, Thanks @rmca
- [Issue #461](https://github.com/grafana/grafana/issues/461). New graphite function definition added isNonNull,  Thanks @tmonk42
- [Issue #455](https://github.com/grafana/grafana/issues/455). New InfluxDB function difference add to function dropdown
- [Issue #459](https://github.com/grafana/grafana/issues/459). Added parameter to keepLastValue graphite function definition (default 100)
  [Issue #418](https://github.com/grafana/grafana/issues/418). to the browser cache when upgrading grafana and improve load performance
- [Issue #327](https://github.com/grafana/grafana/issues/327). Partial support for url encoded metrics when using Graphite datasource. Thanks @axe-felix
- [Issue #473](https://github.com/grafana/grafana/issues/473). Improvement to InfluxDB query editor and function/value column selection
- [Issue #375](https://github.com/grafana/grafana/issues/375). Initial support for filtering (templated queries) for InfluxDB. Thanks @mavimo
- [Issue #475](https://github.com/grafana/grafana/issues/475). Row editing and adding new panel is now a lot quicker and easier with the new row menu
- [Issue #211](https://github.com/grafana/grafana/issues/211). New datasource! Initial support for OpenTSDB, Thanks @mpage
- [Issue #492](https://github.com/grafana/grafana/issues/492). Improvement and polish to the OpenTSDB query editor
- [Issue #441](https://github.com/grafana/grafana/issues/441). Influxdb group by support, Thanks @piis3
- improved asset (css/js) build pipeline, added revision to css and js. Will remove issues related


#### Changes
- [Issue #475](https://github.com/grafana/grafana/issues/475). Add panel icon and Row edit button is replaced by the Row edit menu
- New graphs now have a default empty query
- Add Row button now creates a row with default height of 250px (no longer opens dashboard settings modal)
- Clean up of config.sample.js, graphiteUrl removed (still works, but depricated, removed in future)
  Use datasources config instead. panel_names removed from config.js. Use plugins.panels to add custom panels
- Graphite panel is now renamed graph (Existing dashboards will still work)

#### Fixes
- [Issue #126](https://github.com/grafana/grafana/issues/126). Graphite query lexer change, can now handle regex parameters for aliasSub function
- [Issue #447](https://github.com/grafana/grafana/issues/447). Filter option loading when having muliple nested filters now works better. Options are now reloaded correctly and there are no multiple renders/refresh inbetween.
- [Issue #412](https://github.com/grafana/grafana/issues/412). After a filter option is changed and a nested template param is reloaded, if the current value exists after the options are reloaded the current selected value is kept.
- [Issue #460](https://github.com/grafana/grafana/issues/460). Legend Current value did not display when value was zero
- [Issue #328](https://github.com/grafana/grafana/issues/328). Fix to series toggling bug that caused annotations to be hidden when toggling/hiding series.
- [Issue #293](https://github.com/grafana/grafana/issues/293). Fix for graphite function selection menu that some times draws outside screen. It now displays upward
- [Issue #350](https://github.com/grafana/grafana/issues/350). Fix for exclusive series toggling (hold down CTRL, SHIFT or META key) and left click a series for exclusive toggling
- [Issue #472](https://github.com/grafana/grafana/issues/472). CTRL does not work on MAC OSX but SHIFT or META should (depending on browser)

# 1.5.4 (2014-05-13)
### New features and improvements
- InfluxDB enhancement: support for multiple hosts (with retries) and raw queries ([Issue #318](https://github.com/grafana/grafana/issues/318), thx @toddboom)
- Added rounding for graphites from and to time range filters
  for very short absolute ranges ([Issue #320](https://github.com/grafana/grafana/issues/320))
- Increased resolution for graphite datapoints (maxDataPoints), now equal to panel pixel width. ([Issue #5](https://github.com/grafana/grafana/issues/5))
- Improvement to influxdb query editor, can now add where clause and alias ([Issue #331](https://github.com/grafana/grafana/issues/331), thanks @mavimo)
- New config setting for graphite datasource to control if json render request is POST or GET ([Issue #345](https://github.com/grafana/grafana/issues/345))
- Unsaved changes warning feature ([Issue #324](https://github.com/grafana/grafana/issues/324))
- Improvement to series toggling, CTRL+MouseClick on series name will now hide all others ([Issue #350](https://github.com/grafana/grafana/issues/350))

### Changes
- Graph default setting for Y-Min changed from zero to auto scalling (will not effect existing dashboards). ([Issue #386](https://github.com/grafana/grafana/issues/386)) - thx @kamaradclimber

### Fixes
- Fixes to filters and "All" option. It now never uses "*" as value, but all options in a {node1, node2, node3} expression ([Issue #228](https://github.com/grafana/grafana/issues/228), #359)
- Fix for InfluxDB query generation with columns containing dots or dashes ([Issue #369](https://github.com/grafana/grafana/issues/369), #348) - Thanks to @jbripley


# 1.5.3 (2014-04-17)
- Add support for async scripted dashboards ([Issue #274](https://github.com/grafana/grafana/issues/274))
- Text panel now accepts html (for links to other dashboards, etc) ([Issue #236](https://github.com/grafana/grafana/issues/236))
- Fix for Text panel, now changes take effect directly ([Issue #251](https://github.com/grafana/grafana/issues/251))
- Fix when adding functions without params that did not cause graph to update ([Issue #267](https://github.com/grafana/grafana/issues/267))
- Graphite errors are now much easier to see and troubleshoot with the new inspector ([Issue #265](https://github.com/grafana/grafana/issues/265))
- Use influxdb aliases to distinguish between multiple columns ([Issue #283](https://github.com/grafana/grafana/issues/283))
- Correction to ms axis formater, now formats days correctly. ([Issue #189](https://github.com/grafana/grafana/issues/189))
- Css fix for Firefox and using top menu dropdowns in panel fullscren / edit mode ([Issue #106](https://github.com/grafana/grafana/issues/106))
- Browser page title is now Grafana - {{dashboard title}} ([Issue #294](https://github.com/grafana/grafana/issues/294))
- Disable auto refresh zooming in (every time you change to an absolute time range), refresh will be restored when you change time range back to relative ([Issue #282](https://github.com/grafana/grafana/issues/282))
- More graphite functions

# 1.5.2 (2014-03-24)
### New Features and improvements
- Support for second optional params for functions like aliasByNode ([Issue #167](https://github.com/grafana/grafana/issues/167)). Read the wiki on the [Function Editor](https://github.com/torkelo/grafana/wiki/Graphite-Function-Editor) for more info.
- More functions added to InfluxDB query editor ([Issue #218](https://github.com/grafana/grafana/issues/218))
- Filters can now be used inside other filters (templated segments) ([Issue #128](https://github.com/grafana/grafana/issues/128))
- More graphite functions added

### Fixes
- Float arguments now work for functions like scale ([Issue #223](https://github.com/grafana/grafana/issues/223))
- Fix for graphite function editor, the graph & target was not updated after adding a function and leaving default params as is #191

The zip files now contains a sub folder with project name and version prefix. ([Issue #209](https://github.com/grafana/grafana/issues/209))

# 1.5.1 (2014-03-10)
### Fixes
- maxDataPoints must be an integer #184 (thanks @frejsoya for fixing this)

For people who are find Grafana slow for large time spans or high resolution metrics. This is most likely due to graphite returning a large number of datapoints. The maxDataPoints parameter solves this issue. For maxDataPoints to work you need to run the latest graphite-web (some builds of 0.9.12 does not include this feature).

Read this for more info:
[Performance for large time spans](https://github.com/torkelo/grafana/wiki/Performance-for-large-time-spans)

# 1.5.0 (2014-03-09)
### New Features and improvements
- New function editor [video demo](http://youtu.be/I90WHRwE1ZM) ([Issue #178](https://github.com/grafana/grafana/issues/178))
- Links to function documentation from function editor ([Issue #3](https://github.com/grafana/grafana/issues/3))
- Reorder functions ([Issue #130](https://github.com/grafana/grafana/issues/130))
- [Initial support for InfluxDB](https://github.com/torkelo/grafana/wiki/InfluxDB) as metric datasource (#103), need feedback!
- [Dashboard playlist](https://github.com/torkelo/grafana/wiki/Dashboard-playlist) ([Issue #36](https://github.com/grafana/grafana/issues/36))
- When adding aliasByNode smartly set node number ([Issue #175](https://github.com/grafana/grafana/issues/175))
- Support graphite identifiers with embedded colons ([Issue #173](https://github.com/grafana/grafana/issues/173))
- Typeahead & autocomplete when adding new function ([Issue #164](https://github.com/grafana/grafana/issues/164))
- More graphite function definitions
- Make "ms" axis format include hour, day, weeks, month and year ([Issue #149](https://github.com/grafana/grafana/issues/149))
- Microsecond axis format ([Issue #146](https://github.com/grafana/grafana/issues/146))
- Specify template parameters in URL ([Issue #123](https://github.com/grafana/grafana/issues/123))

### Fixes
- Basic Auth fix ([Issue #152](https://github.com/grafana/grafana/issues/152))
- Fix to annotations with graphite source & null values ([Issue #138](https://github.com/grafana/grafana/issues/138))

# 1.4.0 (2014-02-21)
### New Features
- #44 Annotations! Required a lot of work to get right. Read wiki article for more info. Supported annotations data sources are graphite metrics and graphite events. Support for more will be added in the future!
- #35 Support for multiple graphite servers! (Read wiki article for more)
- #116 Back to dashboard link in top menu to easily exist full screen / edit mode.
- #114, #97 Legend values now use the same y axes formatter
- #77 Improvements and polish to the light theme

### Changes
- #98 Stack is no longer by default turned on in graph display settings.
- Hide controls (Ctrl+h) now hides the sub menu row (where filtering, and annotations are). So if you had filtering enabled and hide controls enabled you will not see the filtering sub menu.

### Fixes:
- #94 Fix for bug that caused dashboard settings to sometimes not contain timepicker tab.
- #110 Graph with many many metrics caused legend to push down graph editor below screen. You can now scroll in edit mode & full screen mode for graphs with lots of series & legends.
- #104 Improvement to graphite target editor, select wildcard now gives you a "select metric" link for the next node.
- #105 Added zero as a possible node value in groupByAlias function

# 1.3.0 (2014-02-13)
### New features or improvements
- #86 Dashboard tags and search (see wiki article for details)
- #54 Enhancement to filter / template. "Include All" improvement
- #82 Dashboard search result sorted in alphabetical order

### Fixes
- #91 Custom date selector is one day behind
- #89 Filter / template does not work after switching dashboard
- #88 Closed / Minimized row css bug
- #85 Added all parameters to summarize function
- #83 Stack as percent should now work a lot better!

# 1.2.0 (2014-02-10)
### New features
- #70 Grid Thresholds (warning and error regions or lines in graph)
- #72 Added an example of a scripted dashboard and a short wiki article documenting scripted dashboards.

### Fixes
- #81 Grid min/max values are ignored bug
- #80 "stacked as percent" graphs should always use "max" value of 100 bug
- #73 Left Y format change did not work
- #42 Fixes to grid min/max auto scaling
- #69 Fixes to lexer/parser for metrics segments like "10-20".
- #67 Allow decimal input for scale function
- #68 Bug when trying to open dashboard while in edit mode

# 1.1.0 (2014-02-06)
### New features:

- #22 Support for native graphite png renderer, does not support click and select zoom yet
- #60 Support for legend values (cactiStyle, min, max, current, total, avg). The options for these are found in the new "Axes & Grid" tab for now.
- #62 There is now a "New" button in the search/open dashboard view to quickly open a clean empty dashboard.
- #55 Basic auth is now supported for elastic search as well
- some new function definitions added (will focus more on this for next release).

### Fixes
- #45 zero values from graphite was handled as null.
- #63 Kibana / Grafana on same host would use same localStorage keys, now fixed
- #46 Impossible to edit graph without a name fixed.
- #24 fix for dashboard search when elastic search is configured to disable _all field.
- #38 Improvement to lexer / parser to support pure numeric literals in metric segments

Thanks to everyone who contributed fixes and provided feedback :+1:

# 1.0.4 (2014-01-24)
- [Issue #28](https://github.com/grafana/grafana/issues/28) - Relative time range caused 500 graphite error in some cases (thx rsommer for the fix)

# 1.0.3 (2014-01-23)
- #9 Add Y-axis format for milliseconds
- #16 Add support for Basic Auth (use http://username:password@yourgraphitedomain.com)
- #13 Relative time ranges now uses relative time ranges when issuing graphite query

# 1.0.2 (2014-01-21)
- [Issue #12](https://github.com/grafana/grafana/issues/12), should now work ok without ElasticSearch

# 1.0.1 (2014-01-21)
- Resize fix
- Improvements to drag & drop
- Added a few graphite function definitions
- Fixed duplicate panel bug
- Updated default dashboard with welcome message and randomWalk graph

# 1.0.0 (2014-01-19)

First public release
