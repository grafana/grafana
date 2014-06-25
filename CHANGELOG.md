vNext

**Changes**
- Use unix epoch for Graphite from/to for absolute time ranges (Closes #536)

# 1.6.1 (2014-06-24)

**New features or improvements**
- Ability to set y min/max for right y-axis (RR #519, Closes #360) - thx @acedrew

**Fixes**

- Fixes regex InfluxDB queries intoduced in 1.6.0 (PR #500)
- Bug in when using % sign in legends (aliases), fixed by removing url decoding of metric names (Fixes #506)
- Series names and column name typeahead cache fix (Fixes #522)
- Fixed influxdb issue with raw query that caused wrong value column detection (Fixes #504)
- Default property that marks which datasource is default in config.js is now optional (Fixes #526)
- Auto-refresh caused 2 refreshes (and hence mulitple queries) each time (at least in firefox) (Fixes #342)

# 1.6.0 (2014-06-16)

#### New features or improvements
- New Y-axis formater for metric values that represent seconds (Issue #427) - thx @jippi
- Allow special characters in serie names (influxdb datasource), PR #390 - thx  @majst01
- Refactoring of filterSrv (Issue #428), thx @Tetha
- New config for playlist feature. Set playlist_timespan to set default playlist interval (Issue #445) - thx @rmca
- New graphite function definition added isNonNull (PR #461), - thx @tmonk42
- New InfluxDB function difference add to function dropdown (PR #455)
- Added parameter to keepLastValue graphite function definition (default 100), Closes #459
- improved asset (css/js) build pipeline, added revision to css and js. Will remove issues related
  to the browser cache when upgrading grafana and improve load performance (Fixes #418)
- Partial support for url encoded metrics when using Graphite datasource (PR #327) - thx @axe-felix
- Improvement to InfluxDB query editor and function/value column selection (Issue #473)
- Initial support for filtering (templated queries) for InfluxDB (PR #375) - thx @mavimo
- Row editing and adding new panel is now a lot quicker and easier with the new row menu (Issue #475)
- New datasource! Initial support for OpenTSDB (PR #211) - thx @mpage
- Improvement and polish to the OpenTSDB query editor (Issue #492)
- Influxdb group by support (Issue #441) thx @piis3


#### Changes
- Graphite panel is now renamed graph (Existing dashboards will still work)
- Add panel icon and Row edit button is replaced by the Row edit menu (Issue #475)
- New graphs now have a default empty query
- Add Row button now creates a row with default height of 250px (no longer opens dashboard settings modal)
- Clean up of config.sample.js, graphiteUrl removed (still works, but depricated, removed in future)
  Use datasources config instead. panel_names removed from config.js. Use plugins.panels to add custom panels

#### Fixes
- Graphite query lexer change, can now handle regex parameters for aliasSub function (Fixes #126)
- Filter option loading when having muliple nested filters now works better.
  Options are now reloaded correctly and there are no multiple renders/refresh inbetween (#447),
  After an option is changed and a nested template param is also reloaded, if the current value
  exists after the options are reloaded the current selected value is kept (Closes #447, Closes #412)
- Legend Current value did not display when value was zero, Fixes #460
- Fix to series toggling bug that caused annotations to be hidden when toggling (hiding) series. Fixes #328
- Fix for graphite function selection menu that some times draws outside screen. It now displays upward (Fixes #293)
- Fix for exclusive series toggling (hold down CTRL, SHIFT or META key) and left click a series for exclusive toggling
  CTRL does not work on MAC OSX but SHIFT or META should (depending on browser) (Closes #350, Fixes #472)

# 1.5.4 (2014-05-13)
### New features and improvements
- InfluxDB enhancement: support for multiple hosts (with retries) and raw queries (Issue #318, thx @toddboom)
- Added rounding for graphites from and to time range filters
  for very short absolute ranges (Issue #320)
- Increased resolution for graphite datapoints (maxDataPoints), now equal to panel pixel width. (Closes #5)
- Improvement to influxdb query editor, can now add where clause and alias (Issue #331, thanks @mavimo)
- New config setting for graphite datasource to control if json render request is POST or GET (Issue #345)
- Unsaved changes warning feature (Issue #324)
- Improvement to series toggling, CTRL+MouseClick on series name will now hide all others (Issue #350)

### Changes
- Graph default setting for Y-Min changed from zero to auto scalling (will not effect existing dashboards). (Issue #386) - thx @kamaradclimber

### Fixes
- Fixes to filters and "All" option. It now never uses "*" as value, but all options in a {node1, node2, node3} expression (Issue #228, #359)
- Fix for InfluxDB query generation with columns containing dots or dashes (Issue #369, #348) - Thanks to @jbripley


# 1.5.3 (2014-04-17)
- Add support for async scripted dashboards (Issue #274)
- Text panel now accepts html (for links to other dashboards, etc) (Issue #236)
- Fix for Text panel, now changes take effect directly (Issue #251)
- Fix when adding functions without params that did not cause graph to update (Issue #267)
- Graphite errors are now much easier to see and troubleshoot with the new inspector (Issue #265)
- Use influxdb aliases to distinguish between multiple columns (Issue #283)
- Correction to ms axis formater, now formats days correctly. (Issue #189)
- Css fix for Firefox and using top menu dropdowns in panel fullscren / edit mode (Issue #106)
- Browser page title is now Grafana - {{dashboard title}} (Issue #294)
- Disable auto refresh zooming in (every time you change to an absolute time range), refresh will be restored when you change time range back to relative (Issue #282)
- More graphite functions

# 1.5.2 (2014-03-24)
### New Features and improvements
- Support for second optional params for functions like aliasByNode (Issue #167). Read the wiki on the [Function Editor](https://github.com/torkelo/grafana/wiki/Graphite-Function-Editor) for more info.
- More functions added to InfluxDB query editor (Issue #218)
- Filters can now be used inside other filters (templated segments) (Issue #128)
- More graphite functions added

### Fixes
- Float arguments now work for functions like scale (Issue #223)
- Fix for graphite function editor, the graph & target was not updated after adding a function and leaving default params as is #191

The zip files now contains a sub folder with project name and version prefix. (Issue #209)

# 1.5.1 (2014-03-10)
### Fixes
- maxDataPoints must be an integer #184 (thanks @frejsoya for fixing this)

For people who are find Grafana slow for large time spans or high resolution metrics. This is most likely due to graphite returning a large number of datapoints. The maxDataPoints parameter solves this issue. For maxDataPoints to work you need to run the latest graphite-web (some builds of 0.9.12 does not include this feature).

Read this for more info:
[Performance for large time spans](https://github.com/torkelo/grafana/wiki/Performance-for-large-time-spans)

# 1.5.0 (2014-03-09)
### New Features and improvements
- New function editor [video demo](http://youtu.be/I90WHRwE1ZM) (Issue #178)
- Links to function documentation from function editor (Issue #3)
- Reorder functions (Issue #130)
- [Initial support for InfluxDB](https://github.com/torkelo/grafana/wiki/InfluxDB) as metric datasource (#103), need feedback!
- [Dashboard playlist](https://github.com/torkelo/grafana/wiki/Dashboard-playlist) (Issue #36)
- When adding aliasByNode smartly set node number (Issue #175)
- Support graphite identifiers with embedded colons (Issue #173)
- Typeahead & autocomplete when adding new function (Issue #164)
- More graphite function definitions
- Make "ms" axis format include hour, day, weeks, month and year (Issue #149)
- Microsecond axis format (Issue #146)
- Specify template paramaters in URL (Issue #123)

### Fixes
- Basic Auth fix (Issue #152)
- Fix to annotations with graphite source & null values (Issue #138)

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
- Fixes #28 - Relative time range caused 500 graphite error in some cases (thx rsommer for the fix)

# 1.0.3 (2014-01-23)
- #9 Add Y-axis format for milliseconds
- #16 Add support for Basic Auth (use http://username:password@yourgraphitedomain.com)
- #13 Relative time ranges now uses relative time ranges when issuing graphite query

# 1.0.2 (2014-01-21)
- Fixes #12, should now work ok without ElasticSearch

# 1.0.1 (2014-01-21)
- Resize fix
- Improvements to drag & drop
- Added a few graphite function definitions
- Fixed duplicate panel bug
- Updated default dashboard with welcome message and randomWalk graph

# 1.0.0 (2014-01-19)

First public release
