# 3.1.2 (unreleased)

- **Templating**: Fixed issue when combining row & panel repeats, fixes [#5790](https://github.com/grafana/grafana/issues/5790)
- **Drag&Drop**: Fixed issue with drag and drop in latest Chrome(51+), fixes [#5767](https://github.com/grafana/grafana/issues/5767)
- **Internal Metrics**: Fixed issue with dots in instance_name when sending internal metrics to Graphite, fixes [#5739](https://github.com/grafana/grafana/issues/5739)
- **Grafana-CLI**: Add default plugin path for MAC OS, fixes [#5806](https://github.com/grafana/grafana/issues/5806)
- **Grafana-CLI**: Improve error message for upgrade-all command, fixes [#5885](https://github.com/grafana/grafana/issues/5885)

# 3.1.1 (2016-08-01)

- **IFrame embedding**: Fixed issue of using full iframe height, fixes [#5605](https://github.com/grafana/grafana/issues/5606)
- **Panel PNG rendering**: Fixed issue detecting render completion, fixes [#5605](https://github.com/grafana/grafana/issues/5606)
- **Elasticsearch**: Fixed issue with templating query and json parse error, fixes [#5615](https://github.com/grafana/grafana/issues/5615)
- **Tech**: Upgraded JQuery to 2.2.4 to fix Security vulnerabilities in 2.1.4, fixes [#5627](https://github.com/grafana/grafana/issues/5627)
- **Graphite**: Fixed issue with mixed data sources and Graphite, fixes [#5617](https://github.com/grafana/grafana/issues/5617)
- **Templating**: Fixed issue with template variable query was issued multiple times during dashboard load, fixes [#5637](https://github.com/grafana/grafana/issues/5637)
- **Zoom**: Fixed issues with zoom in and out on embedded (iframed) panel, fixes [#4489](https://github.com/grafana/grafana/issues/4489), [#5666](https://github.com/grafana/grafana/issues/5666)

# 3.1.0 stable (2016-07-12)

### Bugfixes & Enhancements,

- **User Alert Notices**: Backend error alert popups did not show properly, fixes [#5435](https://github.com/grafana/grafana/issues/5435)
- **Table**: Added sanitize HTML option to allow links in table cells, fixes [#4596](https://github.com/grafana/grafana/issues/4596)
- **Apps**: App dashboards are automatically synced to DB at startup after plugin update, fixes [#5529](https://github.com/grafana/grafana/issues/5529)

# 3.1.0-beta1 (2016-06-23)

### Enhancements

- **Dashboard Export/Import**: Dashboard export now templatize data sources and constant variables, users pick these on import, closes [#5084](https://github.com/grafana/grafana/issues/5084)
- **Dashboard Url**: Time range changes updates url, closes [#458](https://github.com/grafana/grafana/issues/458)
- **Dashboard Url**: Template variable change updates url, closes [#5002](https://github.com/grafana/grafana/issues/5002)
- **Singlestat**: Add support for range to text mappings, closes [#1319](https://github.com/grafana/grafana/issues/1319)
- **Graph**: Adds sort order options for graph tooltip, closes [#1189](https://github.com/grafana/grafana/issues/1189)
- **Theme**: Add default theme to config file [#5011](https://github.com/grafana/grafana/pull/5011)
- **Page Footer**: Added page footer with links to docs, shows Grafana version and info if new version is available, closes [#4889](https://github.com/grafana/grafana/pull/4889)
- **InfluxDB**: Add spread function, closes [#5211](https://github.com/grafana/grafana/issues/5211)
- **Scripts**: Use restart instead of start for deb package script, closes [#5282](https://github.com/grafana/grafana/pull/5282)
- **Logging**: Moved to structured logging lib, and moved to component specific level filters via config file, closes [#4590](https://github.com/grafana/grafana/issues/4590)
- **OpenTSDB**: Support nested template variables in tag_values function, closes [#4398](https://github.com/grafana/grafana/issues/4398)
- **Data Source**: Pending data source requests are canceled before new ones are issues (Graphite & Prometheus), closes [#5321](https://github.com/grafana/grafana/issues/5321)

### Breaking changes

- **Logging** : Changed default logging output format (now structured into message, and key value pairs, with logger key acting as component). You can also no change in config to json log output.
- **Graphite** : The Graph panel no longer have a Graphite PNG option. closes [#5367](https://github.com/grafana/grafana/issues/5367)

### Bug fixes

- **PNG rendering**: Fixed phantomjs rendering and y-axis label rotation. fixes [#5220](https://github.com/grafana/grafana/issues/5220)
- **CLI**: The cli tool now supports reading plugin.json from dist/plugin.json. fixes [#5410](https://github.com/grafana/grafana/issues/5410)

# 3.0.4 Patch release (2016-05-25)

- **Panel**: Fixed blank dashboard issue when switching to other dashboard while in fullscreen edit mode, fixes [#5163](https://github.com/grafana/grafana/pull/5163)
- **Templating**: Fixed issue with nested multi select variables and cascading and updating child variable selection state, fixes [#4861](https://github.com/grafana/grafana/pull/4861)
- **Templating**: Fixed issue with using templated data source in another template variable query, fixes [#5165](https://github.com/grafana/grafana/pull/5165)
- **Singlestat gauge**: Fixed issue with gauge render position, fixes [#5143](https://github.com/grafana/grafana/pull/5143)
- **Home dashboard**: Fixes broken home dashboard api, fixes [#5167](https://github.com/grafana/grafana/issues/5167)

# 3.0.3 Patch release (2016-05-23)

- **Annotations**: Annotations can now use a template variable as data source, closes [#5054](https://github.com/grafana/grafana/issues/5054)
- **Time picker**: Fixed issue timepicker and UTC when reading time from URL, fixes [#5078](https://github.com/grafana/grafana/issues/5078)
- **CloudWatch**: Support for Multiple Account by AssumeRole, closes [#3522](https://github.com/grafana/grafana/issues/3522)
- **Singlestat**: Fixed alignment and minimum height issue, fixes [#5113](https://github.com/grafana/grafana/issues/5113), fixes [#4679](https://github.com/grafana/grafana/issues/4679)
- **Share modal**: Fixed link when using grafana under dashboard sub url, fixes [#5109](https://github.com/grafana/grafana/issues/5109)
- **Prometheus**: Fixed bug in query editor that caused it not to load when reloading page, fixes [#5107](https://github.com/grafana/grafana/issues/5107)
- **Elasticsearch**: Fixed bug when template variable query returns numeric values, fixes [#5097](https://github.com/grafana/grafana/issues/5097), fixes [#5088](https://github.com/grafana/grafana/issues/5088)
- **Logging**: Fixed issue with reading logging level value, fixes [#5079](https://github.com/grafana/grafana/issues/5079)
- **Timepicker**: Fixed issue with timepicker and UTC when reading time from URL, fixes [#5078](https://github.com/grafana/grafana/issues/5078)
- **Docs**: Added docs for org & user preferences HTTP API, closes [#5069](https://github.com/grafana/grafana/issues/5069)
- **Plugin list panel**: Now shows correct enable state for apps when not enabled, fixes [#5068](https://github.com/grafana/grafana/issues/5068)
- **Elasticsearch**: Templating & Annotation queries that use template variables are now formatted correctly, fixes [#5135](https://github.com/grafana/grafana/issues/5135)

# 3.0.2 Patch release (2016-05-16)

- **Templating**: Fixed issue mixing row repeat and panel repeats, fixes [#4988](https://github.com/grafana/grafana/issues/4988)
- **Templating**: Fixed issue detecting dependencies in nested variables, fixes [#4987](https://github.com/grafana/grafana/issues/4987), fixes [#4986](https://github.com/grafana/grafana/issues/4986)
- **Graph**: Fixed broken PNG rendering in graph panel, fixes [#5025](https://github.com/grafana/grafana/issues/5025)
- **Graph**: Fixed broken xaxis on graph panel, fixes [#5024](https://github.com/grafana/grafana/issues/5024)

- **Influxdb**: Fixes crash when hiding middle series, fixes [#5005](https://github.com/grafana/grafana/issues/5005)

# 3.0.1 Stable (2016-05-11)

### Bug fixes

- **Templating**: Fixed issue with new data source variable not persisting current selected value, fixes [#4934](https://github.com/grafana/grafana/issues/4934)

# 3.0.0-beta7 (2016-05-02)

### Bug fixes

- **Dashboard title**: Fixed max dashboard title width (media query) for large screens, fixes [#4859](https://github.com/grafana/grafana/issues/4859)
- **Annotations**: Fixed issue with entering annotation edit view, fixes [#4857](https://github.com/grafana/grafana/issues/4857)
- **Remove query**: Fixed issue with removing query for data sources without collapsible query editors, fixes [#4856](https://github.com/grafana/grafana/issues/4856)
- **Graphite PNG**: Fixed issue graphite png rendering option, fixes [#4864](https://github.com/grafana/grafana/issues/4864)
- **InfluxDB**: Fixed issue missing plus group by iconn, fixes [#4862](https://github.com/grafana/grafana/issues/4862)
- **Graph**: Fixes missing line mode for thresholds, fixes [#4902](https://github.com/grafana/grafana/pull/4902)

### Enhancements

- **InfluxDB**: Added new functions moving_average and difference to query editor, closes [#4698](https://github.com/grafana/grafana/issues/4698)

# 3.0.0-beta6 (2016-04-29)

### Enhancements

- **Singlestat**: Support for gauges in singlestat panel. closes [#3688](https://github.com/grafana/grafana/pull/3688)
- **Templating**: Support for data source as variable, closes [#816](https://github.com/grafana/grafana/pull/816)

### Bug fixes

- **InfluxDB 0.12**: Fixed issue templating and `show tag values` query only returning tags for first measurement, fixes [#4726](https://github.com/grafana/grafana/issues/4726)
- **Templating**: Fixed issue with regex formatting when matching multiple values, fixes [#4755](https://github.com/grafana/grafana/issues/4755)
- **Templating**: Fixed issue with custom all value and escaping, fixes [#4736](https://github.com/grafana/grafana/issues/4736)
- **Dashlist**: Fixed issue dashboard list panel and caching tags, fixes [#4768](https://github.com/grafana/grafana/issues/4768)
- **Graph**: Fixed issue with unneeded scrollbar in legend for Firefox, fixes [#4760](https://github.com/grafana/grafana/issues/4760)
- **Table panel**: Fixed issue table panel formatting string array properties, fixes [#4791](https://github.com/grafana/grafana/issues/4791)
- **grafana-cli**: Improve error message when failing to install plugins due to corrupt response, fixes [#4651](https://github.com/grafana/grafana/issues/4651)
- **Singlestat**: Fixes prefix an postfix for gauges, fixes [#4812](https://github.com/grafana/grafana/issues/4812)
- **Singlestat**: Fixes auto-refresh on change for some options, fixes [#4809](https://github.com/grafana/grafana/issues/4809)

### Breaking changes

**Data Source Query Editors**: Issue [#3900](https://github.com/grafana/grafana/issues/3900)

Query editors have been updated to use the new form styles. External data source plugins needs to be
updated to work. Sorry to introduce breaking change this late in beta phase. We wanted to get this change
in before 3.0 stable is released so we don't have to break data sources in next release (3.1). If you are
a data source plugin author and want help for how the new form styles work please ask for help in
slack channel (link to slack channel in readme).

# 3.0.0-beta5 (2016-04-15)

### Bug fixes

- **grafana-cli**: Fixed issue grafana-cli tool, did not detect the right plugin dir, fixes [#4723](https://github.com/grafana/grafana/issues/4723)
- **Graph**: Fixed issue with light theme text color issue in tooltip, fixes [#4702](https://github.com/grafana/grafana/issues/4702)
- **Snapshot**: Fixed issue with empty snapshots, fixes [#4706](https://github.com/grafana/grafana/issues/4706)

# 3.0.0-beta4 (2016-04-13)

### Bug fixes

- **Home dashboard**: Fixed issue with permission denied error on home dashboard, fixes [#4686](https://github.com/grafana/grafana/issues/4686)
- **Templating**: Fixed issue templating variables that use regex extraction, fixes [#4672](https://github.com/grafana/grafana/issues/4672)

# 3.0.0-beta3 (2016-04-12)

### Enhancements

- **InfluxDB**: Changed multi query encoding to work with InfluxDB 0.11 & 0.12, closes [#4533](https://github.com/grafana/grafana/issues/4533)
- **Timepicker**: Add arrows and shortcuts for moving back and forth in current dashboard, closes [#119](https://github.com/grafana/grafana/issues/119)

### Bug fixes

- **Postgres**: Fixed page render crash when using postgres, fixes [#4558](https://github.com/grafana/grafana/issues/4558)
- **Table panel**: Fixed table panel bug when trying to show annotations in table panel, fixes [#4563](https://github.com/grafana/grafana/issues/4563)
- **App Config**: Fixed app config issue showing content of other app config, fixes [#4575](https://github.com/grafana/grafana/issues/4575)
- **Graph Panel**: Fixed legend option max not updating, fixes [#4601](https://github.com/grafana/grafana/issues/4601)
- **Graph Panel**: Fixed issue where newly added graph panels shared same axes config, fixes [#4582](https://github.com/grafana/grafana/issues/4582)
- **Graph Panel**: Fixed issue with axis labels overlapping Y-axis, fixes [#4626](https://github.com/grafana/grafana/issues/4626)
- **InfluxDB**: Fixed issue with templating query containing template variable, fixes [#4602](https://github.com/grafana/grafana/issues/4602)
- **Graph Panel**: Fixed issue with hiding series and stacking, fixes [#4557](https://github.com/grafana/grafana/issues/4557)
- **Graph Panel**: Fixed issue with legend height in table mode with few series, affected iframe embedding as well, fixes [#4640](https://github.com/grafana/grafana/issues/4640)

# 3.0.0-beta2 (2016-04-04)

### New Features (introduces since 3.0-beta1)

- **Preferences**: Set home dashboard on user and org level, closes [#1678](https://github.com/grafana/grafana/issues/1678)
- **Preferences**: Set timezone on user and org level, closes [#3214](https://github.com/grafana/grafana/issues/3214), [#1200](https://github.com/grafana/grafana/issues/1200)
- **Preferences**: Set theme on user and org level, closes [#3214](https://github.com/grafana/grafana/issues/3214), [#1917](https://github.com/grafana/grafana/issues/1917)

### Bug fixes

- **Dashboard**: Fixed dashboard panel layout for mobile devices, fixes [#4529](https://github.com/grafana/grafana/issues/4529)
- **Table Panel**: Fixed issue with table panel sort, fixes [#4532](https://github.com/grafana/grafana/issues/4532)
- **Page Load Crash**: A data source with null jsonData would make Grafana fail to load page, fixes [#4536](https://github.com/grafana/grafana/issues/4536)
- **Metrics tab**: Fix for missing data source name in data source selector, fixes [#4541](https://github.com/grafana/grafana/issues/4540)
- **Graph**: Fix legend in table mode with series on right-y axis, fixes [#4551](https://github.com/grafana/grafana/issues/4551), [#1145](https://github.com/grafana/grafana/issues/1145)

# 3.0.0-beta1 (2016-03-31)

### New Features

- **Playlists**: Playlists can now be persisted and started from urls, closes [#3655](https://github.com/grafana/grafana/issues/3655)
- **Metadata**: Settings panel now shows dashboard metadata, closes [#3304](https://github.com/grafana/grafana/issues/3304)
- **InfluxDB**: Support for policy selection in query editor, closes [#2018](https://github.com/grafana/grafana/issues/2018)
- **Snapshots UI**: Dashboard snapshots list can be managed through UI, closes[#1984](https://github.com/grafana/grafana/issues/1984)
- **Prometheus**: Prometheus annotation support, closes[#2883](https://github.com/grafana/grafana/pull/2883)
- **Cli**: New cli tool for downloading and updating plugins
- **Annotations**: Annotations can now contain links that can be clicked (you can navigate on to annotation popovers), closes [#1588](https://github.com/grafana/grafana/issues/1588)
- **Opentsdb**: Opentsdb 2.2 filters support, closes[#3077](https://github.com/grafana/grafana/issues/3077)

### Breaking changes

- **Plugin API**: Both data source and panel plugin api (and plugin.json schema) have been updated, requiring an update to plugins. See [plugin api](https://github.com/grafana/grafana/blob/master/public/app/plugins/plugin_api.md) for more info.
- **InfluxDB 0.8.x** The data source for the old version of influxdb (0.8.x) is no longer included in default builds, but can easily be installed via improved plugin system, closes [#3523](https://github.com/grafana/grafana/issues/3523)
- **KairosDB** The data source is no longer included in default builds, but can easily be installed via improved plugin system, closes [#3524](https://github.com/grafana/grafana/issues/3524)
- **Templating**: Templating value formats (glob/regex/pipe etc) are now handled automatically and not specified by the user, this makes variable values possible to reuse in many contexts. It can in some edge cases break existing dashboards that have template variables that do not reload on dashboard load. To fix any issue just go into template variable options and update the variable (so it's values are reloaded.).

### Enhancements

- **LDAP**: Support for nested LDAP Groups, closes [#4401](https://github.com/grafana/grafana/issues/4401), [#3808](https://github.com/grafana/grafana/issues/3808)
- **Sessions**: Support for memcached as session storage, closes [#3458](https://github.com/grafana/grafana/issues/3458)
- **mysql**: Grafana now supports ssl for mysql, closes [#3584](https://github.com/grafana/grafana/issues/3584)
- **snapshot**: Annotations are now included in snapshots, closes [#3635](https://github.com/grafana/grafana/issues/3635)
- **Admin**: Admin can now have global overview of Grafana setup, closes [#3812](https://github.com/grafana/grafana/issues/3812)
- **graph**: Right side legend height is now fixed at row height, closes [#1277](https://github.com/grafana/grafana/issues/1277)
- **Table**: All content in table panel is now html escaped, closes [#3673](https://github.com/grafana/grafana/issues/3673)
- **graph**: Template variables can now be used in TimeShift and TimeFrom, closes[#1960](https://github.com/grafana/grafana/issues/1960)
- **Tooltip**: Optionally add milliseconds to timestamp in tool tip, closes[#2248](https://github.com/grafana/grafana/issues/2248)
- **Opentsdb**: Support milliseconds when using openTSDB data source, closes [#2865](https://github.com/grafana/grafana/issues/2865)
- **Opentsdb**: Add support for annotations, closes[#664](https://github.com/grafana/grafana/issues/664)

### Bug fixes

- **Playlist**: Fix for memory leak when running a playlist, closes [#3794](https://github.com/grafana/grafana/pull/3794)
- **InfluxDB**: Fix for InfluxDB and table panel when using Format As Table and having group by time, fixes [#3928](https://github.com/grafana/grafana/issues/3928)
- **Panel Time shift**: Fix for panel time range and using dashboard times like `Today` and `This Week`, fixes [#3941](https://github.com/grafana/grafana/issues/3941)
- **Row repeat**: Repeated rows will now appear next to each other and not by the bottom of the dashboard, fixes [#3942](https://github.com/grafana/grafana/issues/3942)
- **Png renderer**: Fix for phantomjs path on windows, fixes [#3657](https://github.com/grafana/grafana/issues/3657)
