+++
title = "Configuration"
description = "Configuration documentation"
keywords = ["grafana", "configuration", "documentation"]
type = "docs"
[menu.docs]
name = "Configuration"
identifier = "config"
parent = "admin"
weight = 1
+++

# Configuration

Grafana has a number of configuration options that you can specify in a `.ini` configuration file or specified using environment variables.

> **Note:** You must restart Grafana for any configuration changes to take effect.

## Config file locations

*Do not* change `defaults.ini`! Grafana defaults are stored in this file. Depending on your OS, make all configuration changes in either `custom.ini` or `grafana.ini`.

- Default configuration from `$WORKING_DIR/conf/defaults.ini`
- Custom configuration from `$WORKING_DIR/conf/custom.ini`
- The custom configuration file path can be overridden using the `--config` parameter

### Linux
If you installed Grafana using the `deb` or `rpm` packages, then your configuration file is located at `/etc/grafana/grafana.ini` and a separate `custom.ini` is not used. This path is specified in the Grafana init.d script using `--config` file parameter.

### Docker
Refer to [Configure a Grafana Docker image]({{< relref "configure-docker.md" >}}) for information about environmental variables, persistent storage, and building custom Docker images.

### Windows
`sample.ini` is in the same directory as `defaults.ini` and contains all the settings commented out. Copy `sample.ini` and name it `custom.ini`.

### MacOS
By default, the configuration file is located at `/usr/local/etc/grafana/grafana.ini`. To configure Grafana, add a configuration file named `custom.ini` to the `conf` folder to override any of the settings defined in `conf/defaults.ini`.

## Comments in .ini Files

Semicolons (the `;` char) are the standard way to comment out lines in a `.ini` file. If you want to change a setting, you must delete the semicolon (`;`) in front of the setting before it will work.

**Example**
```
# The http port  to use
;http_port = 3000
```

A common problem is forgetting to uncomment a line in the `custom.ini` (or `grafana.ini`) file which causes the configuration option to be ignored.

## Configure with environment variables

All options in the configuration file can be overridden using environment variables using the syntax:

```bash
GF_<SectionName>_<KeyName>
```

Where the section name is the text within the brackets. Everything should be uppercase, `.` should be replaced by `_`. For example, if you have these configuration settings:

```bash
# default section
instance_name = ${HOSTNAME}

[security]
admin_user = admin

[auth.google]
client_secret = 0ldS3cretKey
```

You can override them on Linux machines with:

```bash
export GF_DEFAULT_INSTANCE_NAME=my-instance
export GF_SECURITY_ADMIN_USER=owner
export GF_AUTH_GOOGLE_CLIENT_SECRET=newS3cretKey
```

> For any changes to `conf/grafana.ini` (or corresponding environment variables) to take effect, you must restart Grafana for the changes to take effect.

## instance_name

Set the name of the grafana-server instance. Used in logging and internal metrics and in
clustering info. Defaults to: `${HOSTNAME}`, which will be replaced with
environment variable `HOSTNAME`, if that is empty or does not exist Grafana will try to use
system calls to get the machine name.

## [paths]

### data

Path to where Grafana stores the sqlite3 database (if used), file based sessions (if used), and other data. This path is usually specified via command line in the init.d script or the systemd service file.

**macOS:** The default SQLite database is located at `/usr/local/var/lib/grafana`

### temp_data_lifetime

How long temporary images in `data` directory should be kept. Defaults to: `24h`. Supported modifiers: `h` (hours),
`m` (minutes), for example: `168h`, `30m`, `10h30m`. Use `0` to never clean up temporary files.

### logs

Path to where Grafana will store logs. This path is usually specified via command line in the init.d script or the systemd service file. You can override it in the configuration file or in the default environment variable file. However, please note that by overriding this the default log path will be used temporarily until Grafana has fully initialized/started.

Override log path using the command line argument `cfg:default.paths.log`:

```bash
./grafana-server --config /custom/config.ini --homepath /custom/homepath cfg:default.paths.logs=/custom/path
```

**macOS:** By default, the log file should be located at `/usr/local/var/log/grafana/grafana.log`.

### plugins

Directory where Grafana will automatically scan and look for plugins. Manually or automatically install any plugins here.

**macOS:** By default, the Mac plugin location is: `/usr/local/var/lib/grafana/plugins`.

### provisioning

Folder that contains [provisioning]({{< relref "../administration/provisioning" >}}) config files that grafana will apply on startup. Dashboards will be reloaded when the json files changes

## [server]

### http_addr

The IP address to bind to. If empty will bind to all interfaces

### http_port

The port to bind to, defaults to `3000`. To use port 80 you need to either give the Grafana binary permission for example:

```bash
$ sudo setcap 'cap_net_bind_service=+ep' /usr/sbin/grafana-server
```

Or redirect port 80 to the Grafana port using:

```bash
$ sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 3000
```

Another way is put a webserver like Nginx or Apache in front of Grafana and have them proxy requests to Grafana.

### protocol

`http`,`https`,`h2` or `socket`

> **Note:** Grafana versions earlier than 3.0 are vulnerable to [POODLE](https://en.wikipedia.org/wiki/POODLE). So we strongly recommend to upgrade to 3.x or use a reverse proxy for ssl termination.

### socket
Path where the socket should be created when `protocol=socket`. Please make sure that Grafana has appropriate permissions.

### domain

This setting is only used in as a part of the `root_url` setting (see below). Important if you use GitHub or Google OAuth.

### enforce_domain

Redirect to correct domain if host header does not match domain. Prevents DNS rebinding attacks. Default is `false`.

### root_url

This is the full URL used to access Grafana from a web browser. This is
important if you use Google or GitHub OAuth authentication (for the
callback URL to be correct).

> **Note:** This setting is also important if you have a reverse proxy
> in front of Grafana that exposes it through a subpath. In that
> case add the subpath to the end of this URL setting.

### serve_from_sub_path
> Available in 6.3 and above

Serve Grafana from subpath specified in `root_url` setting. By default it is set to `false` for compatibility reasons.

By enabling this setting and using a subpath in `root_url` above, e.g.
`root_url = http://localhost:3000/grafana`, Grafana will be accessible on
`http://localhost:3000/grafana`.

### static_root_path

The path to the directory where the front end files (HTML, JS, and CSS
files). Defaults to `public` which is why the Grafana binary needs to be
executed with working directory set to the installation path.

### enable_gzip

Set this option to `true` to enable HTTP compression, this can improve
transfer speed and bandwidth utilization. It is recommended that most
users set it to `true`. By default it is set to `false` for compatibility
reasons.

### cert_file

Path to the certificate file (if `protocol` is set to `https` or `h2`).

### cert_key

Path to the certificate key file (if `protocol` is set to `https` or `h2`).

### router_logging

Set to `true` for Grafana to log all HTTP requests (not just errors). These are logged as Info level events
to grafana log.

<hr />

## [database]

Grafana needs a database to store users and dashboards (and other
things). By default it is configured to use `sqlite3` which is an
embedded database (included in the main Grafana binary).

### url

Use either URL or the other fields below to configure the database
Example: `mysql://user:secret@host:port/database`

### type

Either `mysql`, `postgres` or `sqlite3`, it's your choice.

### path

Only applicable for `sqlite3` database. The file path where the database
will be stored.

### host

Only applicable to MySQL or Postgres. Includes IP or hostname and port or in case of Unix sockets the path to it.
For example, for MySQL running on the same host as Grafana: `host =
127.0.0.1:3306` or with Unix sockets: `host = /var/run/mysqld/mysqld.sock`

### name

The name of the Grafana database. Leave it set to `grafana` or some
other name.

### user

The database user (not applicable for `sqlite3`).

### password

The database user's password (not applicable for `sqlite3`). If the password contains `#` or `;` you have to wrap it with triple quotes. For example `"""#password;"""`

### ssl_mode

For Postgres, use either `disable`, `require` or `verify-full`.
For MySQL, use either `true`, `false`, or `skip-verify`.

### ca_cert_path

The path to the CA certificate to use. On many Linux systems, certs can be found in `/etc/ssl/certs`.

### client_key_path

The path to the client key. Only if server requires client authentication.

### client_cert_path

The path to the client cert. Only if server requires client authentication.

### server_cert_name

The common name field of the certificate used by the `mysql` or `postgres` server. Not necessary if `ssl_mode` is set to `skip-verify`.

### max_idle_conn
The maximum number of connections in the idle connection pool.

### max_open_conn
The maximum number of open connections to the database.

### conn_max_lifetime

Sets the maximum amount of time a connection may be reused. The default is 14400 (which means 14400 seconds or 4 hours). For MySQL, this setting should be shorter than the [`wait_timeout`](https://dev.mysql.com/doc/refman/5.7/en/server-system-variables.html#sysvar_wait_timeout) variable.

### log_queries

Set to `true` to log the sql calls and execution times.

### cache_mode

For "sqlite3" only. [Shared cache](https://www.sqlite.org/sharedcache.html) setting used for connecting to the database. (private, shared)
Defaults to `private`.

<hr />

## [remote_cache]

### type

Either `redis`, `memcached` or `database`. Defaults to `database`

### connstr

The remote cache connection string. The format depends on the `type` of the remote cache.

#### Database

Leave empty when using `database` since it will use the primary database.

#### Redis

Example connstr: `addr=127.0.0.1:6379,pool_size=100,db=0,ssl=false`

- `addr` is the host `:` port of the redis server.
- `pool_size` (optional) is the number of underlying connections that can be made to redis.
- `db` (optional) is the number indentifer of the redis database you want to use.
- `ssl` (optional) is if SSL should be used to connect to redis server. The value may be `true`, `false`, or `insecure`. Setting the value to `insecure` skips verification of the certificate chain and hostname when making the connection.

#### Memcache

Example connstr: `127.0.0.1:11211`

<hr />

## [security]

### disable_initial_admin_creation

> Only available in Grafana v6.5+.

Disable creation of admin user on first start of grafana.

### admin_user

The name of the default Grafana admin user (who has full permissions).
Defaults to `admin`.

### admin_password

The password of the default Grafana admin. Set once on first-run.  Defaults to `admin`.

### login_remember_days

The number of days the keep me logged in / remember me cookie lasts.

### secret_key

Used for signing some data source settings like secrets and passwords, the encryption format used is AES-256 in CFB mode. Cannot be changed without requiring an update
to data source settings to re-encode them.

### disable_gravatar

Set to `true` to disable the use of Gravatar for user profile images.
Default is `false`.

### data_source_proxy_whitelist

Define a whitelist of allowed IP addresses or domains, with ports, to be used in data source URLs with the Grafana data source proxy. Format: `ip_or_domain:port` separated by spaces. PostgreSQL, MySQL, and MSSQL data sources do not use the proxy and are therefore unaffected by this setting.

### cookie_secure

Set to `true` if you host Grafana behind HTTPS. Default is `false`.

### cookie_samesite

Sets the `SameSite` cookie attribute and prevents the browser from sending this cookie along with cross-site requests. The main goal is to mitigate the risk of cross-origin information leakage. This setting also provides some protection against cross-site request forgery attacks (CSRF),  [read more about SameSite here](https://www.owasp.org/index.php/SameSite). Valid values are `lax`, `strict`, `none`, and `disabled`. Default is `lax`. Using value `disabled` does not add any `SameSite` attribute to cookies.

### allow_embedding

When `false`, the HTTP header `X-Frame-Options: deny` will be set in Grafana HTTP responses which will instruct
browsers to not allow rendering Grafana in a `<frame>`, `<iframe>`, `<embed>` or `<object>`. The main goal is to
mitigate the risk of [Clickjacking](https://www.owasp.org/index.php/Clickjacking). Default is `false`.

### strict_transport_security

Set to `true` if you want to enable HTTP `Strict-Transport-Security` (HSTS) response header. This is only sent when HTTPS is enabled in this configuration. HSTS tells browsers that the site should only be accessed using HTTPS. The default value is `false` until the next minor release, `6.3`.

### strict_transport_security_max_age_seconds

Sets how long a browser should cache HSTS in seconds. Only applied if strict_transport_security is enabled. The default value is `86400`.

### strict_transport_security_preload

Set to `true` if to enable HSTS `preloading` option. Only applied if strict_transport_security is enabled. The default value is `false`.

### strict_transport_security_subdomains

Set to `true` if to enable the HSTS includeSubDomains option. Only applied if strict_transport_security is enabled. The default value is `false`.

### x_content_type_options

Set to `true` to enable the X-Content-Type-Options response header. The X-Content-Type-Options response HTTP header is a marker used by the server to indicate that the MIME types advertised in the Content-Type headers should not be changed and be followed. The default value is `false` until the next minor release, `6.3`.

### x_xss_protection

Set to `false` to disable the X-XSS-Protection header, which tells browsers to stop pages from loading when they detect reflected cross-site scripting (XSS) attacks. The default value is `false` until the next minor release, `6.3`.

<hr />

## [users]

### allow_sign_up

Set to `false` to prohibit users from being able to sign up / create
user accounts. Defaults to `false`.  The admin user can still create
users from the [Grafana Admin Pages](/reference/admin)

### allow_org_create

Set to `false` to prohibit users from creating new organizations.
Defaults to `false`.

### auto_assign_org

Set to `true` to automatically add new users to the main organization
(id 1). When set to `false`, new users will automatically cause a new
organization to be created for that new user.

### auto_assign_org_id

Set this value to automatically add new users to the provided org.
This requires `auto_assign_org` to be set to `true`. Please make sure
that this organization already exists.

### auto_assign_org_role

The role new users will be assigned for the main organization (if the
above setting is set to true).  Defaults to `Viewer`, other valid
options are `Admin` and `Editor`. e.g. :

`auto_assign_org_role = Viewer`

### viewers_can_edit

Viewers can edit/inspect dashboard settings in the browser, but not save the dashboard.
Defaults to `false`.

### editors_can_admin

Editors can administrate dashboards, folders and teams they create.
Defaults to `false`.

### login_hint

Text used as placeholder text on login page for login/username input.

### password_hint

Text used as placeholder text on login page for password input.

<hr>

## [auth]

Grafana provides many ways to authenticate users. The docs for authentication has been split in to many different pages
below.

- [Authentication Overview]({{< relref "../auth/overview.md" >}}) (anonymous access options, hide login and more)
- [Google OAuth]({{< relref "../auth/google.md" >}}) (auth.google)
- [GitHub OAuth]({{< relref "../auth/github.md" >}}) (auth.github)
- [Gitlab OAuth]({{< relref "../auth/gitlab.md" >}}) (auth.gitlab)
- [Generic OAuth]({{< relref "../auth/generic-oauth.md" >}}) (auth.generic_oauth, okta2, auth0, bitbucket, azure)
- [Basic Authentication]({{< relref "../auth/overview.md" >}}) (auth.basic)
- [LDAP Authentication]({{< relref "../auth/ldap.md" >}}) (auth.ldap)
- [Auth Proxy]({{< relref "../auth/auth-proxy.md" >}}) (auth.proxy)

## [dataproxy]

### logging

This enables data proxy logging, default is `false`.

### timeout

How long the data proxy should wait before timing out. Default is `30` (seconds)

### send_user_header

If enabled and user is not anonymous, data proxy will add X-Grafana-User header with username into the request. Default is `false`.

<hr />

## [analytics]

### reporting_enabled

When enabled Grafana will send anonymous usage statistics to
`stats.grafana.org`. No IP addresses are being tracked, only simple counters to
track running instances, versions, dashboard and error counts. It is very helpful
to us, so please leave this enabled. Counters are sent every 24 hours. Default
value is `true`.

### google_analytics_ua_id

If you want to track Grafana usage via Google analytics specify *your* Universal
Analytics ID here. By default this feature is disabled.

### check_for_updates

Set to false to disable all checks to https://grafana.com for new versions of installed plugins and to the Grafana GitHub repository to check for a newer version of Grafana. The version information is used in some UI views to notify that a new Grafana update or a plugin update exists. This option does not cause any auto updates, nor send any sensitive information. The check is run every 10 minutes.

<hr />

## [dashboards]

### versions_to_keep

Number dashboard versions to keep (per dashboard). Default: `20`, Minimum: `1`.

### min_refresh_interval

> Only available in Grafana v6.7+.

When set, this will restrict users to set the refresh interval of a dashboard lower than given interval. Per default this is not set/unrestricted.
The interval string is a possibly signed sequence of decimal numbers, followed by a unit suffix (ms, s, m, h, d), e.g. `30s` or `1m`.

## [dashboards.json]

> This have been replaced with dashboards [provisioning]({{< relref "../administration/provisioning" >}}) in 5.0+

### enabled
`true` or `false`. Is disabled by default.

### path
The full path to a directory containing your json dashboards.

## [smtp]
Email server settings.

### enabled
defaults to `false`

### host
defaults to `localhost:25`

### user
In case of SMTP auth, defaults to `empty`

### password
In case of SMTP auth, defaults to `empty`

### cert_file
File path to a cert file, defaults to `empty`

### key_file
File path to a key file, defaults to `empty`

### skip_verify
Verify SSL for smtp server? defaults to `false`

### from_address
Address used when sending out emails, defaults to `admin@grafana.localhost`

### from_name
Name to be used when sending out emails, defaults to `Grafana`

### ehlo_identity
Name to be used as client identity for EHLO in SMTP dialog, defaults to instance_name.

## [log]

### mode
Either "console", "file", "syslog". Default is "console" and "file".
Use spaces to separate multiple modes, e.g. `console file`

### level

Either "debug", "info", "warn", "error", "critical", default is `info`.

### filters

optional settings to set different levels for specific loggers.
For example `filters = sqlstore:debug`.

## [log.console]

Only applicable when "console" used in `[log]` mode.

### level

Either "debug", "info", "warn", "error", "critical", default is inherited from `[log]` level.

### format

Log line format, valid options are text, console and json. Default is `console`.

## [log.file]

Only applicable when "file" used in `[log]` mode.

### level

Either "debug", "info", "warn", "error", "critical", default is inherited from `[log]` level.

### format

Log line format, valid options are text, console and json. Default is `console`.

### log_rotate

Enable automated log rotation, valid options are false or true. Default is `true`.
When enabled use the `max_lines`, `max_size_shift`, `daily_rotate` and `max_days` below
to configure the behavior of the log rotation.

### max_lines

Maximum lines per file before rotating it. Default is 1000000.

### max_size_shift

Maximum size of file before rotating it. Default is `28` which means `1 << 28`, `256MB`.

### daily_rotate

Enable daily rotation of files, valid options are false or true. Default is `true`.

### max_days

Maximum number of days to keep log files. Default is `7`.

## [log.syslog]

Only applicable when "syslog" used in `[log]` mode.

### level

Either "debug", "info", "warn", "error", "critical", default is inherited from `[log]` level.

### format

Log line format, valid options are text, console and json. Default is `console`.

### network and address

Syslog network type and address. This can be udp, tcp, or unix. If left blank, the default unix endpoints will be used.

### facility

Syslog facility. Valid options are user, daemon or local0 through local7. Default is empty.

### tag

Syslog tag. By default, the process's `argv[0]` is used.

## [metrics]

### enabled
Enable metrics reporting. defaults true. Available via HTTP API `/metrics`.

### basic_auth_username
If set configures the username to use for basic authentication on the metrics endpoint.

### basic_auth_password
If set configures the password to use for basic authentication on the metrics endpoint.

### disable_total_stats
If set to `true`, then total stats generation (`stat_totals_*` metrics) is disabled. The default is `false`.

### interval_seconds

Flush/Write interval when sending metrics to external TSDB. Defaults to 10s.

## [metrics.graphite]
Include this section if you want to send internal Grafana metrics to Graphite.

### address
Format `<Hostname or ip>`:port

### prefix
Graphite metric prefix. Defaults to `prod.grafana.%(instance_name)s.`

## [snapshots]

### external_enabled
Set to `false` to disable external snapshot publish endpoint (default `true`)

### external_snapshot_url
Set root URL to a Grafana instance where you want to publish external snapshots (defaults to https://snapshots-origin.raintank.io)

### external_snapshot_name
Set name for external snapshot button. Defaults to `Publish to snapshot.raintank.io`

### snapshot_remove_expired
Enabled to automatically remove expired snapshots

## [external_image_storage]
These options control how images should be made public so they can be shared on services like slack.

### provider
You can choose between (s3, webdav, gcs, azure_blob, local). If left empty Grafana will ignore the upload action.

## [external_image_storage.s3]

### endpoint
Optional endpoint URL (hostname or fully qualified URI) to override the default generated S3 endpoint. If you want to
keep the default, just leave this empty. You must still provide a `region` value if you specify an endpoint.

## path_style_access
Set this to true to force path-style addressing in S3 requests, i.e., `http://s3.amazonaws.com/BUCKET/KEY`, instead
of the default, which is virtual hosted bucket addressing when possible (`http://BUCKET.s3.amazonaws.com/KEY`).

Note: This option is specific to the Amazon S3 service.

### bucket
Bucket name for S3. e.g. grafana.snapshot.

### region
Region name for S3. e.g. 'us-east-1', 'cn-north-1', etc.

### path
Optional extra path inside bucket, useful to apply expiration policies.

### bucket_url
(for backward compatibility, only works when no bucket or region are configured)
Bucket URL for S3. AWS region can be specified within URL or defaults to 'us-east-1', e.g.
- http://grafana.s3.amazonaws.com/
- https://grafana.s3-ap-southeast-2.amazonaws.com/

### access_key
Access key, e.g. AAAAAAAAAAAAAAAAAAAA.

Access key requires permissions to the S3 bucket for the 's3:PutObject' and 's3:PutObjectAcl' actions.

### secret_key
Secret key, e.g. AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA.

## [external_image_storage.webdav]

### url
URL to where Grafana will send PUT request with images

### public_url
Optional parameter. URL to send to users in notifications. If the string contains the sequence ${file}, it will be replaced with the uploaded filename. Otherwise, the file name will be appended to the path part of the URL, leaving any query string unchanged.

### username
basic auth username

### password
basic auth password

## [external_image_storage.gcs]

### key_file
Path to JSON key file associated with a Google service account to authenticate and authorize.
Service Account keys can be created and downloaded from https://console.developers.google.com/permissions/serviceaccounts.

Service Account should have "Storage Object Writer" role. The access control model of the bucket needs to be "Set object-level and bucket-level permissions". Grafana itself will make the images public readable.

### bucket
Bucket Name on Google Cloud Storage.

### path
Optional extra path inside bucket

## [external_image_storage.azure_blob]

### account_name
Storage account name

### account_key
Storage account key

### container_name
Container name where to store "Blob" images with random names. Creating the blob container beforehand is required. Only public containers are supported.

## [alerting]

### enabled
Defaults to `true`. Set to `false` to disable alerting engine and hide Alerting from UI.

### execute_alerts

Makes it possible to turn off alert rule execution.

### error_or_timeout
> Available in 5.3 and above

Default setting for new alert rules. Defaults to categorize error and timeouts as alerting. (alerting, keep_state)

### nodata_or_nullvalues
> Available in 5.3  and above

Default setting for how Grafana handles nodata or null values in alerting. (alerting, no_data, keep_state, ok)

### concurrent_render_limit

> Available in 5.3  and above

Alert notifications can include images, but rendering many images at the same time can overload the server.
This limit will protect the server from render overloading and make sure notifications are sent out quickly. Default
value is `5`.


### evaluation_timeout_seconds

Default setting for alert calculation timeout. Default value is `30`

### notification_timeout_seconds

Default setting for alert notification timeout. Default value is `30`

### max_attempts

Default setting for max attempts to sending alert notifications. Default value is `3`

### min_interval_seconds

Default setting for minimum interval between rule evaluations. Default value is `1`

> **Note.** This setting has precedence over each individual rule frequency. Therefore, if a rule frequency is lower than this value, this value will be enforced.

## [rendering]

Options to configure a remote HTTP image rendering service, e.g. using https://github.com/grafana/grafana-image-renderer.

### server_url

URL to a remote HTTP image renderer service, e.g. http://localhost:8081/render, will enable Grafana to render panels and dashboards to PNG-images using HTTP requests to an external service.

### callback_url

If the remote HTTP image renderer service runs on a different server than the Grafana server you may have to configure this to a URL where Grafana is reachable, e.g. http://grafana.domain/.

## [panels]

### disable_sanitize_html

If set to true Grafana will allow script tags in text panels. Not recommended as it enable XSS vulnerabilities. Default
is false. This settings was introduced in Grafana v6.0.

## [plugins]

### enable_alpha

Set to true if you want to test alpha plugins that are not yet ready for general usage.

## [feature_toggles]
### enable

Keys of alpha features to enable, separated by space. Available alpha features are: `transformations`

## [tracing.jaeger]

Configure Grafana's Jaeger client for distributed tracing.

You can also use the standard `JAEGER_*` environment variables to configure
Jaeger. See the table at the end of https://www.jaegertracing.io/docs/1.16/client-features/
for the full list. Environment variables will override any settings provided here.

### address

The host:port destination for reporting spans. (ex: `localhost:6381`)

Can be set with the environment variables `JAEGER_AGENT_HOST` and `JAEGER_AGENT_PORT`.

### always_included_tag

Comma-separated list of tags to include in all new spans, such as `tag1:value1,tag2:value2`.

Can be set with the environment variable `JAEGER_TAGS` (use `=` instead of `:` with the environment variable).

### sampler_type

Default value is `const`.

Specifies the type of sampler: `const`, `probabilistic`, `ratelimiting`, or `remote`.

Refer to https://www.jaegertracing.io/docs/1.16/sampling/#client-sampling-configuration for details on the different tracing types.

Can be set with the environment variable `JAEGER_SAMPLER_TYPE`.

### sampler_param

Default value is `1`.

This is the sampler configuration parameter. Depending on the value of `sampler_type`, it can be `0`, `1`, or a decimal value in between.

- For `const` sampler, `0` or `1` for always `false`/`true` respectively
- For `probabilistic` sampler, a probability between `0` and `1.0`
- For `rateLimiting` sampler, the number of spans per second
- For `remote` sampler, param is the same as for `probabilistic`
  and indicates the initial sampling rate before the actual one
  is received from the mothership

May be set with the environment variable `JAEGER_SAMPLER_PARAM`.

### zipkin_propagation

Default value is `false`.

Controls whether or not to use Zipkin's span propagation format (with `x-b3-` HTTP headers). By default, Jaeger's format is used.

Can be set with the environment variable and value `JAEGER_PROPAGATION=b3`.

### disable_shared_zipkin_spans

Default value is `false`.

Setting this to `true` turns off shared RPC spans. Leaving this available is the most common setting when using Zipkin elsewhere in your infrastructure.

<hr />

# Removed options
Please note that these options have been removed.

## [session]
**Removed starting from Grafana v6.2. Please use [remote_cache](#remote-cache) option instead.**

### provider

Valid values are `memory`, `file`, `mysql`, `postgres`, `memcache` or `redis`. Default is `file`.

### provider_config

This option should be configured differently depending on what type of
session provider you have configured.

- **file:** session file path, e.g. `data/sessions`
- **mysql:** go-sql-driver/mysql dsn config string, e.g. `user:password@tcp(127.0.0.1:3306)/database_name`
- **postgres:** ex:  `user=a password=b host=localhost port=5432 dbname=c sslmode=verify-full`
- **memcache:** ex:  `127.0.0.1:11211`
- **redis:** ex: `addr=127.0.0.1:6379,pool_size=100,prefix=grafana`. For Unix socket, use for example: `network=unix,addr=/var/run/redis/redis.sock,pool_size=100,db=grafana`

Postgres valid `sslmode` are `disable`, `require`, `verify-ca`, and `verify-full` (default).

### cookie_name

The name of the Grafana session cookie.

### cookie_secure

Set to true if you host Grafana behind HTTPS only. Defaults to `false`.

### session_life_time

How long sessions lasts in seconds. Defaults to `86400` (24 hours).
