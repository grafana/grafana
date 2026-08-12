# 2.6.1 (unreleased, 2.6.x branch)

### New Features

- **Elasticsearch**: Support for derivative unit option, closes [#3512](https://github.com/grafana/grafana/issues/3512)

### Bug fixes

- **Graph Panel**: Fixed typehead when adding series style override, closes [#3554](https://github.com/grafana/grafana/issues/3554)

# 2.6.0 (2015-12-14)

### New Features

- **Elasticsearch**: Support for pipeline aggregations Moving average and derivative, closes [#2715](https://github.com/grafana/grafana/issues/2715)
- **Elasticsearch**: Support for inline script and missing options for metrics, closes [#3500](https://github.com/grafana/grafana/issues/3500)
- **Syslog**: Support for syslog logging, closes [#3161](https://github.com/grafana/grafana/pull/3161)
- **Timepicker**: Always show refresh button even with refresh rate, closes [#3498](https://github.com/grafana/grafana/pull/3498)
- **Login**: Make it possible to change the login hint on the login page, closes [#2571](https://github.com/grafana/grafana/pull/2571)

### Bug Fixes

- **metric editors**: Fix for clicking typeahead auto dropdown option, fixes [#3428](https://github.com/grafana/grafana/issues/3428)
- **influxdb**: Fixed issue showing Group By label only on first query, fixes [#3453](https://github.com/grafana/grafana/issues/3453)
- **logging**: Add more verbose info logging for http requests, closes [#3405](https://github.com/grafana/grafana/pull/3405)

# 2.6.0-Beta1 (2015-12-04)

### New Table Panel

- **table**: New powerful and flexible table panel, closes [#215](https://github.com/grafana/grafana/issues/215)

### Enhancements

- **CloudWatch**: Support for multiple AWS Credentials, closes [#3053](https://github.com/grafana/grafana/issues/3053), [#3080](https://github.com/grafana/grafana/issues/3080)
- **Elasticsearch**: Support for dynamic daily indices for annotations, closes [#3061](https://github.com/grafana/grafana/issues/3061)
- **Elasticsearch**: Support for setting min_doc_count for date histogram, closes [#3416](https://github.com/grafana/grafana/issues/3416)
- **Graph Panel**: Option to hide series with all zeroes from legend and tooltip, closes [#1381](https://github.com/grafana/grafana/issues/1381), [#3336](https://github.com/grafana/grafana/issues/3336)

### Bug Fixes

- **cloudwatch**: fix for handling of period for long time ranges, fixes [#3086](https://github.com/grafana/grafana/issues/3086)
- **dashboard**: fix for collapse row by clicking on row title, fixes [#3065](https://github.com/grafana/grafana/issues/3065)
- **influxdb**: fix for relative time ranges `last x months` and `last x years`, fixes [#3067](https://github.com/grafana/grafana/issues/3067)
- **graph**: layout fix for color picker when right side legend was enabled, fixes [#3093](https://github.com/grafana/grafana/issues/3093)
- **elasticsearch**: disabling elastic query (via eye) caused error, fixes [#3300](https://github.com/grafana/grafana/issues/3300)

### Breaking changes

- **elasticsearch**: Manual json edited queries are not supported any more (They very barely worked in 2.5)

# 2.5 (2015-10-28)

**New Feature: Mix data sources**

- A built in data source is now available named `-- Mixed --`, When picked in the metrics tab,
  it allows you to add queries of different data source types & instances to the same graph/panel!
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

- [Pull #2720](https://github.com/grafana/grafana/pull/2720). Admin: Initial basic quota support (per Org)
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
- [Issue #2565](https://github.com/grafana/grafana/issues/2565). TimePicker: Fix for when you applied custom time range it did not refresh dashboard
- [Issue #2563](https://github.com/grafana/grafana/issues/2563). Annotations: Fixed issue when html sanitizer fails for title to annotation body, now fallbacks to html escaping title and text
- [Issue #2564](https://github.com/grafana/grafana/issues/2564). Templating: Another attempt at fixing #2534 (Init multi value template var used in repeat panel from url)
- [Issue #2620](https://github.com/grafana/grafana/issues/2620). Graph: multi series tooltip did no highlight correct point when stacking was enabled and series were of different resolution
- [Issue #2636](https://github.com/grafana/grafana/issues/2636). InfluxDB: Do no show template vars in dropdown for tag keys and group by keys
- [Issue #2604](https://github.com/grafana/grafana/issues/2604). InfluxDB: More alias options, can now use `$[0-9]` syntax to reference part of a measurement name (separated by dots)

**Breaking Changes**

- Notice to makers/users of custom data sources, there is a minor breaking change in 2.2 that
  require an update to custom data sources for them to work in 2.2. [Read this doc](https://github.com/grafana/grafana/tree/master/docs/sources/datasources/plugin_api.md) for more on the
  data source api change.
- Data source api changes, [PLUGIN_CHANGES.md](https://github.com/grafana/grafana/blob/main/public/app/plugins/PLUGIN_CHANGES.md)
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
- [Issue #2564](https://github.com/grafana/grafana/issues/2564). Templating: Another attempt at fixing #2534 (Init multi value template var used in repeat panel from url)

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
- [Issue #2483](https://github.com/grafana/grafana/issues/2484). InfluxDB(0.9): Use \$col as option in alias patterns, thx @thuck

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
- [Issue #590](https://github.com/grafana/grafana/issues/590). Graph: Define series color using regex rule
- [Issue #2162](https://github.com/grafana/grafana/issues/2162). Graph: New series style override, negative-y transform and stack groups
- [Issue #2096](https://github.com/grafana/grafana/issues/2096). Dashboard list panel: Now supports search by multiple tags
- [Issue #2203](https://github.com/grafana/grafana/issues/2203). Singlestat: Now support string values

**User or Organization admin**

- [Issue #1899](https://github.com/grafana/grafana/issues/1899). Organization: You can now update the organization user role directly (without removing and readding the organization user).
- [Issue #2088](https://github.com/grafana/grafana/issues/2088). Roles: New user role `Read Only Editor` that replaces the old `Viewer` role behavior

**Backend**

- [Issue #2218](https://github.com/grafana/grafana/issues/2218). Auth: You can now authenticate against api with username / password using basic auth
- [Issue #2095](https://github.com/grafana/grafana/issues/2095). Search: Search now supports filtering by multiple dashboard tags
- [Issue #1905](https://github.com/grafana/grafana/issues/1905). GitHub OAuth: You can now configure a GitHub team membership requirement, thx @dewski
- [Issue #2052](https://github.com/grafana/grafana/issues/2052). GitHub OAuth: You can now configure a GitHub organization requirement, thx @indrekj
- [Issue #1891](https://github.com/grafana/grafana/issues/1891). Security: New config option to disable the use of gravatar for profile images
- [Issue #1921](https://github.com/grafana/grafana/issues/1921). Auth: Support for user authentication via reverse proxy header (like X-Authenticated-User, or X-WEBAUTH-USER)
- [Issue #960](https://github.com/grafana/grafana/issues/960). Search: Backend can now index a folder with json files, will be available in search (saving back to folder is not supported, this feature is meant for static generated json dashboards)

**Breaking changes**

- [Issue #1826](https://github.com/grafana/grafana/issues/1826). User role 'Viewer' are now prohibited from entering edit mode (and doing other transient dashboard edits). A new role `Read Only Editor` will replace the old Viewer behavior
- [Issue #1928](https://github.com/grafana/grafana/issues/1928). HTTP API: GET /api/dashboards/db/:slug response changed property `model` to `dashboard` to match the POST request naming
- Backend render URL changed from `/render/dashboard/solo` `render/dashboard-solo/` (in order to have consistent dashboard url `/dashboard/:type/:slug`)
- Search HTTP API response has changed (simplified), tags list moved to separate HTTP resource URI
- Data source HTTP api breaking change, ADD data source is now POST /api/datasources/, update is now PUT /api/datasources/:id

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

- [Issue #1832](https://github.com/grafana/grafana/issues/1832). Graph Panel + Legend Table mode: Many series caused zero height graph, now legend will never reduce the height of the graph below 50% of row height.
- [Issue #1846](https://github.com/grafana/grafana/issues/1846). Snapshots: Fixed issue with snapshotting dashboards with an interval template variable
- [Issue #1848](https://github.com/grafana/grafana/issues/1848). Panel timeshift: You can now use panel timeshift without a relative time override

# 2.0.1 (2015-04-20)

**Fixes**

- [Issue #1784](https://github.com/grafana/grafana/issues/1784). Data source proxy: Fixed issue with using data source proxy when grafana is behind nginx suburl
- [Issue #1749](https://github.com/grafana/grafana/issues/1749). Graph Panel: Table legends are now visible when rendered to PNG
- [Issue #1786](https://github.com/grafana/grafana/issues/1786). Graph Panel: Legend in table mode now aligns, graph area is reduced depending on how many series
- [Issue #1734](https://github.com/grafana/grafana/issues/1734). Support for unicode / international characters in dashboard title (improved slugify)
- [Issue #1782](https://github.com/grafana/grafana/issues/1782). GitHub OAuth: Now works with GitHub for Enterprise, thanks @williamjoy
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

# 2.0.0-Beta2 (...)

**Enhancements**

- [Issue #1701](https://github.com/grafana/grafana/issues/1701). Share modal: Override UI theme via URL param for Share link, rendered panel, or embedded panel
- [Issue #1660](https://github.com/grafana/grafana/issues/1660). OAuth: Specify allowed email address domains for google or and github oauth logins

**Fixes**

- [Issue #1649](https://github.com/grafana/grafana/issues/1649). HTTP API: grafana /render calls nows with api keys
- [Issue #1667](https://github.com/grafana/grafana/issues/1667). Data source proxy & session timeout fix (caused 401 Unauthorized error after a while)
- [Issue #1707](https://github.com/grafana/grafana/issues/1707). Unsaved changes: Do not show for snapshots, scripted and file based dashboards
- [Issue #1703](https://github.com/grafana/grafana/issues/1703). Unsaved changes: Do not show for users with role `Viewer`
- [Issue #1675](https://github.com/grafana/grafana/issues/1675). Data source proxy: Fixed issue with Gzip enabled and data source proxy
- [Issue #1681](https://github.com/grafana/grafana/issues/1681). MySQL session: fixed problem using mysql as session store
- [Issue #1671](https://github.com/grafana/grafana/issues/1671). Data sources: Fixed issue with changing default data source (should not require full page load to take effect, now fixed)
- [Issue #1685](https://github.com/grafana/grafana/issues/1685). Search: Dashboard results should be sorted alphabetically
- [Issue #1673](https://github.com/grafana/grafana/issues/1673). Basic auth: Fixed issue when using basic auth proxy infront of Grafana

# 2.0.0-Beta1 (2015-03-30)

**Important Note**

Grafana 2.x is fundamentally different from 1.x; it now ships with an integrated backend server. Please read the [Documentation](http://docs.grafana.org) for more detailed about this SIGNIFICANT change to Grafana

**New features**

- [Issue #1623](https://github.com/grafana/grafana/issues/1623). Share Dashboard: Dashboard snapshot sharing (dash and data snapshot), save to local or save to public snapshot dashboard snapshots.raintank.io site
- [Issue #1622](https://github.com/grafana/grafana/issues/1622). Share Panel: The share modal now has an embed option, gives you an iframe that you can use to embed a single graph on another web site
- [Issue #718](https://github.com/grafana/grafana/issues/718). Dashboard: When saving a dashboard and another user has made changes in between the user is prompted with a warning if he really wants to overwrite the other's changes
- [Issue #1331](https://github.com/grafana/grafana/issues/1331). Graph & Singlestat: New axis/unit format selector and more units (kbytes, Joule, Watt, eV), and new design for graph axis & grid tab and single stat options tab views
- [Issue #1241](https://github.com/grafana/grafana/issues/1242). Timepicker: New option in timepicker (under dashboard settings), to change `now` to be for example `now-1m`, useful when you want to ignore last minute because it contains incomplete data
- [Issue #171](https://github.com/grafana/grafana/issues/171). Panel: Different time periods, panels can override dashboard relative time and/or add a time shift
- [Issue #1488](https://github.com/grafana/grafana/issues/1488). Dashboard: Clone dashboard / Save as
- [Issue #1458](https://github.com/grafana/grafana/issues/1458). User: persisted user option for dark or light theme (no longer an option on a dashboard)
- [Issue #452](https://github.com/grafana/grafana/issues/452). Graph: Adds logarithmic scale option for base 10, base 16 and base 1024

**Enhancements**

- [Issue #1366](https://github.com/grafana/grafana/issues/1366). Graph & Singlestat: Support for additional units, Fahrenheit (°F) and Celsius (°C), Humidity (%H), kW, watt-hour (Wh), kilowatt-hour (kWh), velocities (m/s, km/h, mpg, knot)
- [Issue #978](https://github.com/grafana/grafana/issues/978). Graph: Shared tooltip improvement, can now support metrics of different resolution/intervals
- [Issue #1297](https://github.com/grafana/grafana/issues/1297). Graphite: Added cumulative and minimumBelow graphite functions
- [Issue #1296](https://github.com/grafana/grafana/issues/1296). InfluxDB: Auto escape column names with special characters. Thanks @steven-aerts
- [Issue #1321](https://github.com/grafana/grafana/issues/1321). SingleStatPanel: You can now use template variables in pre & postfix
- [Issue #599](https://github.com/grafana/grafana/issues/599). Graph: Added right y axis label setting and graph support
- [Issue #1253](https://github.com/grafana/grafana/issues/1253). Graph & Singlestat: Users can now set decimal precision for legend and tooltips (override auto precision)
- [Issue #1255](https://github.com/grafana/grafana/issues/1255). Templating: Dashboard will now wait to load until all template variables that have refresh on load set or are initialized via url to be fully loaded and so all variables are in valid state before panels start issuing metric requests.
- [Issue #1344](https://github.com/grafana/grafana/issues/1344). OpenTSDB: Alias patterns (reference tag values), syntax is: \$tag_tagname or [[tag_tagname]]

**Fixes**

- [Issue #1298](https://github.com/grafana/grafana/issues/1298). InfluxDB: Fix handling of empty array in templating variable query
- [Issue #1309](https://github.com/grafana/grafana/issues/1309). Graph: Fixed issue when using zero as a grid threshold
- [Issue #1345](https://github.com/grafana/grafana/issues/1345). UI: Fixed position of confirm modal when scrolled down
- [Issue #1372](https://github.com/grafana/grafana/issues/1372). Graphite: Fix for nested complex queries, where a query references a query that references another query (ie the #[A-Z] syntax)
- [Issue #1363](https://github.com/grafana/grafana/issues/1363). Templating: Fix to allow custom template variables to contain white space, now only splits on ','
- [Issue #1359](https://github.com/grafana/grafana/issues/1359). Graph: Fix for all series tooltip showing series with all null values when `Hide Empty` option is enabled
- [Issue #1497](https://github.com/grafana/grafana/issues/1497). Dashboard: Fixed memory leak when switching dashboards

**Changes**

- Dashboard title change & save will no longer create a new dashboard, it will just change the title.

**OpenTSDB breaking change**

- [Issue #1438](https://github.com/grafana/grafana/issues/1438). OpenTSDB: Automatic downsample interval passed to OpenTSDB (depends on timespan and graph width)
- NOTICE, Downsampling is now enabled by default, so if you have not picked a downsample aggregator in your metric query do so or your graphs will be misleading
- This will make Grafana a lot quicker for OpenTSDB users when viewing large time spans without having to change the downsample interval manually.

**Tech**

- [Issue #1311](https://github.com/grafana/grafana/issues/1311). Tech: Updated Font-Awesome from 3.2 to 4.2
