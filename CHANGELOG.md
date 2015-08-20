# 2.5.1 (unreleased)

<<<<<<< c814803908eaf6f16fbd17dd456f30a419308e8b
### Enhancements
* **CloudWatch**: Support for multiple AWS Credentials, closes [#3053](https://github.com/grafana/grafana/issues/3053), [#3080](https://github.com/grafana/grafana/issues/3080)
* **Elasticsearch**: Support for dynamic daily indices for annotations, closes [#3061](https://github.com/grafana/grafana/issues/3061)

### Bug Fixes
* **cloudwatch**: fix for handling of period for long time ranges, fixes [#3086](https://github.com/grafana/grafana/issues/3086)
* **dashboard**: fix for collapse row by clicking on row title, fixes [#3065](https://github.com/grafana/grafana/issues/3065)
* **influxdb**: fix for relative time ranges `last x months` and `last x years`, fixes [#3067](https://github.com/grafana/grafana/issues/3067)
* **graph**: layout fix for color picker when right side legend was enabled, fixes [#3093](https://github.com/grafana/grafana/issues/3093)

# 2.5 (2015-10-28)

<<<<<<< f0efbe4a9386646dfe4e47b4a1226d4cdb19e63f
<<<<<<< 1b7ba34e481f3622a64f26c0c03e83fc5fbc7115
=======
>>>>>>> Fix changelog formatting
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
<<<<<<< f0efbe4a9386646dfe4e47b4a1226d4cdb19e63f
- Org admin can now send email invites (or invite links) to people who are not yet Grafana users
- Sign up flow now supports email verification (if enabled)
- See [Issue #2353](https://github.com/grafana/grafana/issues/2353) for more info.

**Other new Features && Enhancements**
- [Pull  #2720](https://github.com/grafana/grafana/pull/2720). Admin: Initial basic quota support (per Org)
- [Issue #2577](https://github.com/grafana/grafana/issues/2577). Panel: Resize handles in panel bottom right corners for easy width and height change
=======
=======
>>>>>>> feat(mixed datasources): feature ready to merge to master, closes #436
** New Feature: Mix data sources **
A built in data source is now available named `-- Mixed --`, When picked in the metrics tab,
it allows you to add queries of differnet data source types & instances to the same graph/panel!
[Issue #436](https://github.com/grafana/grafana/issues/436)

<<<<<<< c814803908eaf6f16fbd17dd456f30a419308e8b
** User Onboarding **
=======
>>>>>>> Fix changelog formatting
- Org admin can now send email invites (or invite links) to people who are not yet Grafana users
- Sign up flow now supports email verification (if enabled)
- See [Issue #2353](https://github.com/grafana/grafana/issues/2354) for more info.

<<<<<<< 31a27040669945f4e47872f1e01cb25495295b71
<<<<<<< 5f1059eac9232552c927fc69f1d7fb2003e899fd
** Other new Features && Enhancements**
<<<<<<< ec194cf65e5adad36faa3d7dc1197348cbf20bc3
>>>>>>> feat(mixed datasources): feature ready to merge to master, closes #436
=======
<<<<<<< 837588f1a3d775ba83edd14154141add863da630
=======
=======
=======
>>>>>>> Fix "Link to Prometheus" button for proxied Prometheus sources.
**Other new Features && Enhancements**
- [Pull  #2720](https://github.com/grafana/grafana/pull/2720). Admin: Initial basic quota support (per Org)
- [Issue #2577](https://github.com/grafana/grafana/issues/2577). Panel: Resize handles in panel bottom right corners for easy width and height change
<<<<<<< 31a27040669945f4e47872f1e01cb25495295b71
>>>>>>> Update CHANGELOG.md
>>>>>>> Update CHANGELOG.md
=======
>>>>>>> Fix "Link to Prometheus" button for proxied Prometheus sources.
=======
** Other new Features && Enhancements**
>>>>>>> feat(mixed datasources): feature ready to merge to master, closes #436
- [Issue #2457](https://github.com/grafana/grafana/issues/2457). Admin: admin page for all grafana organizations (list / edit view)
- [Issue #1186](https://github.com/grafana/grafana/issues/1186). Time Picker: New option `today`, will set time range from midnight to now
<<<<<<< 4479e2ade71003c3617865b40b20a526895f33bb
<<<<<<< d104f4300a7fa4055bd18b83f31793eaf059416e
=======
>>>>>>> Fix changelog (double issue entry and missing version headline)
- [Issue #2647](https://github.com/grafana/grafana/issues/2647). InfluxDB: You can now set group by time interval on each query
- [Issue #2599](https://github.com/grafana/grafana/issues/2599). InfluxDB: Improved alias support, you can now use the `AS` clause for each select statement
- [Issue #2708](https://github.com/grafana/grafana/issues/2708). InfluxDB: You can now set math expression for select clauses.
- [Issue #1575](https://github.com/grafana/grafana/issues/1575). Drilldown link: now you can click on the external link icon in the panel header to access drilldown links!
- [Issue #1646](https://github.com/grafana/grafana/issues/1646). OpenTSDB: Fetch list of aggregators from OpenTSDB
- [Issue #2955](https://github.com/grafana/grafana/issues/2955). Graph: More axis units (Length, Volume, Temperature, Pressure, etc), thanks @greglook
- [Issue #2928](https://github.com/grafana/grafana/issues/2928). LDAP: Support for searching for groups memberships, i.e. POSIX (no memberOf) schemas, also multiple ldap servers, and root ca cert, thanks @abligh
=======
- [Issue #1186](https://github.com/grafana/grafana/issues/1186). Time Picker: New option `today`, will set time range from midnight to now
>>>>>>> feat(influxdb): More alias options, can now use  syntax to reference part of a measurement name (seperated by dots), closes #2599

**Fixes**
<<<<<<< 9c8007789396fce71f0339932b02c78232578c7e
<<<<<<< c090b41b12d3d766f06d7f482270e5f215cda12a
- [Issue #2413](https://github.com/grafana/grafana/issues/2413). InfluxDB 0.9: Fix for handling empty series object in response from influxdb
- [Issue #2574](https://github.com/grafana/grafana/issues/2574). Snapshot: Fix for snapshot with expire 7 days option, 7 days option not correct, was 7 hours
- [Issue #2568](https://github.com/grafana/grafana/issues/2568). AuthProxy: Fix for server side rendering of panel when using auth proxy
- [Issue #2490](https://github.com/grafana/grafana/issues/2490). Graphite: Dashboard import was broken in 2.1 and 2.1.1, working now
<<<<<<< 6b5ec9cca4c653a84ca9b54e7b0ebc9dd933894c
<<<<<<< c10fe447537d93e6d63c09ca7cf1094861ce635e
- [Issue #2565](https://github.com/grafana/grafana/issues/2565). TimePicker: Fix for when you applied custom time range it did not refreh dashboard
- [Issue #2563](https://github.com/grafana/grafana/issues/2563). Annotations: Fixed issue when html sanitizer failes for title to annotation body, now fallbacks to html escaping title and text
- [Issue #2564](https://github.com/grafana/grafana/issues/2564). Templating: Another atempt at fixing #2534 (Init multi value template var used in repeat panel from url)
<<<<<<< 87da3e6148514d2c7aa30542ecd298b9e39815c9
<<<<<<< ea77587ba297693ec3a2a6a24f2f9dd24da79d68
- [Issue #2620](https://github.com/grafana/grafana/issues/2620). Graph: multi series tooltip did no highlight correct point when stacking was enabled and series were of different resolution
- [Issue #2636](https://github.com/grafana/grafana/issues/2636). InfluxDB: Do no show template vars in dropdown for tag keys and group by keys
<<<<<<< a5d6ff308a8abf031604f8c4d746dc083d967405
<<<<<<< d104f4300a7fa4055bd18b83f31793eaf059416e
<<<<<<< ac35be77e28c74f9dbd5978d04b194c19356dfb8
<<<<<<< 5607ec0260725145f7500df845f7a38dc0025e6e
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
<<<<<<< ed50e2846bc8380710f0ddcbde24a79bcbd3cce1
<<<<<<< 350904500dc0256857920fc88984a84ee9ac44d8
<<<<<<< 65d0d096a2b4b75b95d6288ba17fb3951389520f
- [Issue #2558](https://github.com/grafana/grafana/issues/2558). DragDrop: Fix for broken drag drop behavior
- [Issue #2534](https://github.com/grafana/grafana/issues/2534). Templating: fix for setting template variable value via url and having repeated panels or rows
=======
panels or rows, fixes #2534
>>>>>>> fix(templating): fix for setting template variable value via url and having repeated panels or rows, fixes #2534
=======
- [Issue #2558](https://github.com/grafana/grafana/issues/2558). DragDrop: Fix for broken drag drop behavior
- [Issue #2534](https://github.com/grafana/grafana/issues/2534). Templating: fix for setting template variable value via url and having repeated panels or rows
>>>>>>> fix(dragdrop): Fix for broken drag drop behavior, fixes #2558
=======
=======
- [Issue #2568](https://github.com/grafana/grafana/issues/2568). AuthProxy: Fix for server side rendering of panel when using auth proxy
>>>>>>> fix(auth proxy): Fix for server side rendering of panel when using auth proxy, fixes #2568
- [Issue #2490](https://github.com/grafana/grafana/issues/2490). Graphite: Dashboard import was broken in 2.1 and 2.1.1, working now
- [Issue #2565](https://github.com/grafana/grafana/issues/2565). TimePicker: Fix for when you applied custom time range it did not refreh dashboard
<<<<<<< 9d8ec5825aa59a8d30e71063b9a3b5404f305e67
fixes #2565
>>>>>>> fix(TimePicker): Fix for when you applied custom time range it did not refreh dashboard, fixes #2565
=======
- [Issue #2563](https://github.com/grafana/grafana/issues/2563). Annotations: Fixed issue when html sanitizer failes for title to annotation body, now fallbacks to html escaping title and text
<<<<<<< 60d380de0b3a72973df2f20eb2809ec4f30c17e3
now fallbacks to html escaping title and text, fixes #2563
>>>>>>> fix(annotations): Fixed issue when html sanitizer failes for title to annotation body, now fallbacks to html escaping title and text, fixes #2563
=======
- [Issue #2564](https://github.com/grafana/grafana/issues/2564). Templating: Another atempt at fixing #2534 (Init multi value template var used in repeat panel from url)
repeat panel from url), fixes #2564
>>>>>>> fix(templating): Another atempt at fixing #2534 (Init multi value template var used in repeat panel from url), fixes #2564
=======
>>>>>>> fix(templating): Another atempt at fixing #2534 (Init multi value template var used in repeat panel from url), fixes #2564
=======
- [Issue #2620](https://github.com/grafana/grafana/issues/2620). Graph: multi series tooltip did no highlight correct point when stacking was enabled and series were of different resolution
>>>>>>> feat(signup): progress on new signup flow, #2353
=======
>>>>>>> fix(influxdb): fixes and refactorings of influxdb 0.9 editor, no longer shows template vars in keys dropdown and group by dropdownm, fixes #2636
=======
- [Issue #2651](https://github.com/grafana/grafana/issues/2651). InfluxDB: Fixed issue when using the eye to disable queries in the query editor and when applying aliases
>>>>>>> fix(influxdb): Fixed issue when using the eye to disable queries in the query editor and when applying aliases, #2651
=======
- [Issue #2599](https://github.com/grafana/grafana/issues/2599). InfluxDB: More alias options, can now use `$[0-9]` syntax to reference part of a measurement name (seperated by dots)
>>>>>>> feat(influxdb): More alias options, can now use  syntax to reference part of a measurement name (seperated by dots), closes #2599
=======
- [Issue #2604](https://github.com/grafana/grafana/issues/2604). InfluxDB: More alias options, can now use `$[0-9]` syntax to reference part of a measurement name (seperated by dots)
>>>>>>> fix(): fixed problems in last commit
=======
- [Issue #2558](https://github.com/grafana/grafana/issues/2558). DragDrop: Fix for broken drag drop behavior
- [Issue #2534](https://github.com/grafana/grafana/issues/2534). Templating: fix for setting template variable value via url and having repeated panels or rows
>>>>>>> fix(dragdrop): Fix for broken drag drop behavior, fixes #2558
=======
- [Issue #2490](https://github.com/grafana/grafana/issues/2490). Graphite: Dashboard import was broken in 2.1 and 2.1.1, working now
- [Issue #2565](https://github.com/grafana/grafana/issues/2565). TimePicker: Fix for when you applied custom time range it did not refreh dashboard
fixes #2565
>>>>>>> fix(TimePicker): Fix for when you applied custom time range it did not refreh dashboard, fixes #2565

**Breaking Changes**
repeat panel from url), fixes #2564
- Notice to makers/users of custom data sources, there is a minor breaking change in 2.2 that
require an update to custom data sources for them to work in 2.2. [Read this doc](https://github.com/grafana/grafana/tree/master/docs/sources/datasources/plugin_api.md) for more on the
data source api change.
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
=======
panels or rows, fixes #2534
>>>>>>> fix(templating): fix for setting template variable value via url and having repeated panels or rows, fixes #2534

** Breaking Changes **
- Notice to makers/users of custom data sources, there is a minor breaking change in 2.2 that
require and update to custom data sources for them to work in 2.2. [Read this doc](https://github.com/grafana/grafana/tree/master/docs/sources/datasources/plugin_api.md) for more on the
data source api change.

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

Read this [blog post](http://grafana.org/blog/2014/09/11/grafana-1-8-0-rc1-released.html) for an overview of all improvements.

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
