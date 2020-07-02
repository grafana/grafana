+++
title = "Configuration"
description = "Configuration documentation"
keywords = ["grafana", "configuration", "documentation"]
type = "docs"
aliases = ["/docs/grafana/latest/installation/configuration/"]
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

_Do not_ change `defaults.ini`! Grafana defaults are stored in this file. Depending on your OS, make all configuration changes in either `custom.ini` or `grafana.ini`.

- Default configuration from `$WORKING_DIR/conf/defaults.ini`
- Custom configuration from `$WORKING_DIR/conf/custom.ini`
- The custom configuration file path can be overridden using the `--config` parameter

### Linux

If you installed Grafana using the `deb` or `rpm` packages, then your configuration file is located at `/etc/grafana/grafana.ini` and a separate `custom.ini` is not used. This path is specified in the Grafana init.d script using `--config` file parameter.

### Docker

Refer to [Configure a Grafana Docker image]({{< relref "../installation/configure-docker.md" >}}) for information about environmental variables, persistent storage, and building custom Docker images.

### Windows

`sample.ini` is in the same directory as `defaults.ini` and contains all the settings commented out. Copy `sample.ini` and name it `custom.ini`.

### MacOS

By default, the configuration file is located at `/usr/local/etc/grafana/grafana.ini`. To configure Grafana, add a configuration file named `custom.ini` to the `conf` folder to override any of the settings defined in `conf/defaults.ini`.

## Comments in .ini Files

Semicolons (the `;` char) are the standard way to comment out lines in a `.ini` file. If you want to change a setting, you must delete the semicolon (`;`) in front of the setting before it will work.

**Example**

```
# The HTTP port  to use
;http_port = 3000
```

A common problem is forgetting to uncomment a line in the `custom.ini` (or `grafana.ini`) file which causes the configuration option to be ignored.

## Configure with environment variables

All options in the configuration file can be overridden using environment variables using the syntax:

```bash
GF_<SectionName>_<KeyName>
```

Where the section name is the text within the brackets. Everything should be uppercase, `.` and `-` should be replaced by `_`. For example, if you have these configuration settings:

```bash
# default section
instance_name = ${HOSTNAME}

[security]
admin_user = admin

[auth.google]
client_secret = 0ldS3cretKey

[plugin.grafana-image-renderer]
rendering_ignore_https_errors = true
```

You can override them on Linux machines with:

```bash
export GF_DEFAULT_INSTANCE_NAME=my-instance
export GF_SECURITY_ADMIN_USER=owner
export GF_AUTH_GOOGLE_CLIENT_SECRET=newS3cretKey
export GF_PLUGIN_GRAFANA_IMAGE_RENDERER_RENDERING_IGNORE_HTTPS_ERRORS=true
```

## Variable expansion

> Only available in Grafana 7.1+.

> For any changes to `conf/grafana.ini` (or corresponding environment variables) to take effect, you must restart Grafana.

If any of your options contains the expression `$__<provider>{<argument>}`
or `${<environment variable>}`, then they will be processed by Grafana's
variable expander. The expander runs the provider with the provided argument
to get the final value of the option.

There are three providers: `env`, `file`, and `vault`.

### Env provider

The `env` provider can be used to expand an environment variable. If you
set an option to `$__env{PORT}` the `PORT` environment variable will be
used in its place. For environment variables you can also use the
short-hand syntax `${PORT}`.
Grafana's log directory would be set to the `grafana` directory in the
directory behind the `LOGDIR` environment variable in the following
example.

```ini
[paths]
logs = $__env{LOGDIR}/grafana
```

### File provider

`file` reads a file from the filesystem. It trims whitespace from the
beginning and the end of files.
The database password in the following example would be replaced by
the content of the `/etc/secrets/gf_sql_password` file:

```ini
[database]
password = $__file{/etc/secrets/gf_sql_password}
```

### Vault provider

The `vault` provider allows you to manage your secrets with [Hashicorp Vault](https://www.hashicorp.com/products/vault).

> Vault provider is only available in Grafana Enterprise v7.1+. For more information, refer to [Vault integration]({{< relref "../enterprise/vault.md" >}}) in [Grafana Enterprise]({{< relref "../enterprise" >}}).

<hr />

## app_mode

Options are `production` and `development`. Default is `production`. _Do not_ change this option unless you are working on Grafana development.

## instance_name

Set the name of the grafana-server instance. Used in logging, internal metrics, and clustering info. Defaults to: `${HOSTNAME}`, which will be replaced with
environment variable `HOSTNAME`, if that is empty or does not exist Grafana will try to use system calls to get the machine name.

<hr />

## [paths]

### data

Path to where Grafana stores the sqlite3 database (if used), file-based sessions (if used), and other data. This path is usually specified via command line in the init.d script or the systemd service file.

**macOS:** The default SQLite database is located at `/usr/local/var/lib/grafana`

### temp_data_lifetime

How long temporary images in `data` directory should be kept. Defaults to: `24h`. Supported modifiers: `h` (hours),
`m` (minutes), for example: `168h`, `30m`, `10h30m`. Use `0` to never clean up temporary files.

### logs

Path to where Grafana stores logs. This path is usually specified via command line in the init.d script or the systemd service file. You can override it in the configuration file or in the default environment variable file. However, please note that by overriding this the default log path will be used temporarily until Grafana has fully initialized/started.

Override log path using the command line argument `cfg:default.paths.log`:

```bash
./grafana-server --config /custom/config.ini --homepath /custom/homepath cfg:default.paths.logs=/custom/path
```

**macOS:** By default, the log file should be located at `/usr/local/var/log/grafana/grafana.log`.

### plugins

Directory where Grafana automatically scans and looks for plugins. Manually or automatically install any plugins here.

**macOS:** By default, the Mac plugin location is: `/usr/local/var/lib/grafana/plugins`.

### provisioning

Folder that contains [provisioning]({{< relref "provisioning.md" >}}) config files that grafana will apply on startup. Dashboards will be reloaded when the json files changes

<hr />

## [server]

### protocol

`http`,`https`,`h2` or `socket`

> **Note:** Grafana versions earlier than 3.0 are vulnerable to [POODLE](https://en.wikipedia.org/wiki/POODLE). So we strongly recommend to upgrade to 3.x or use a reverse proxy for SSL termination.

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

> Available in Grafana 6.3+.

Serve Grafana from subpath specified in `root_url` setting. By default it is set to `false` for compatibility reasons.

By enabling this setting and using a subpath in `root_url` above, e.g.
`root_url = http://localhost:3000/grafana`, Grafana is accessible on
`http://localhost:3000/grafana`.

### router_logging

Set to `true` for Grafana to log all HTTP requests (not just errors). These are logged as Info level events to the Grafana log.

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

### socket

Path where the socket should be created when `protocol=socket`. Make sure that Grafana has appropriate permissions before you change this setting.

<hr />

## [database]

Grafana needs a database to store users and dashboards (and other
things). By default it is configured to use `sqlite3` which is an
embedded database (included in the main Grafana binary).

### type

Either `mysql`, `postgres` or `sqlite3`, it's your choice.

### host

Only applicable to MySQL or Postgres. Includes IP or hostname and port or in case of Unix sockets the path to it.
For example, for MySQL running on the same host as Grafana: `host = 127.0.0.1:3306` or with Unix sockets: `host = /var/run/mysqld/mysqld.sock`

### name

The name of the Grafana database. Leave it set to `grafana` or some
other name.

### user

The database user (not applicable for `sqlite3`).

### password

The database user's password (not applicable for `sqlite3`). If the password contains `#` or `;` you have to wrap it with triple quotes. For example `"""#password;"""`

### url

Use either URL or the other fields below to configure the database
Example: `mysql://user:secret@host:port/database`

### max_idle_conn

The maximum number of connections in the idle connection pool.

### max_open_conn

The maximum number of open connections to the database.

### conn_max_lifetime

Sets the maximum amount of time a connection may be reused. The default is 14400 (which means 14400 seconds or 4 hours). For MySQL, this setting should be shorter than the [`wait_timeout`](https://dev.mysql.com/doc/refman/5.7/en/server-system-variables.html#sysvar_wait_timeout) variable.

### log_queries

Set to `true` to log the sql calls and execution times.

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

### path

Only applicable for `sqlite3` database. The file path where the database
will be stored.

### cache_mode

For "sqlite3" only. [Shared cache](https://www.sqlite.org/sharedcache.html) setting used for connecting to the database. (private, shared)
Defaults to `private`.

<hr />

## [remote_cache]

### type

Either `redis`, `memcached`, or `database`. Defaults to `database`

### connstr

The remote cache connection string. The format depends on the `type` of the remote cache. Options are `database`, `redis`, and `memcache`.

#### database

Leave empty when using `database` since it will use the primary database.

#### redis

Example connstr: `addr=127.0.0.1:6379,pool_size=100,db=0,ssl=false`

- `addr` is the host `:` port of the redis server.
- `pool_size` (optional) is the number of underlying connections that can be made to redis.
- `db` (optional) is the number identifier of the redis database you want to use.
- `ssl` (optional) is if SSL should be used to connect to redis server. The value may be `true`, `false`, or `insecure`. Setting the value to `insecure` skips verification of the certificate chain and hostname when making the connection.

#### memcache

Example connstr: `127.0.0.1:11211`

<hr />

## [dataproxy]

### logging

This enables data proxy logging, default is `false`.

### timeout

How long the data proxy should wait before timing out. Default is 30 seconds.

This setting also applies to core backend HTTP data sources where query requests use an HTTP client with timeout set.

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

### check_for_updates

Set to false to disable all checks to https://grafana.com for new versions of installed plugins and to the Grafana GitHub repository to check for a newer version of Grafana. The version information is used in some UI views to notify that a new Grafana update or a plugin update exists. This option does not cause any auto updates, nor send any sensitive information. The check is run every 10 minutes.

### google_analytics_ua_id

If you want to track Grafana usage via Google analytics specify _your_ Universal
Analytics ID here. By default this feature is disabled.

### google_tag_manager_id

Google Tag Manager ID, only enabled if you enter an ID here.

<hr />

## [security]

### disable_initial_admin_creation

> Only available in Grafana v6.5+.

Disable creation of admin user on first start of Grafana. Default is `false`.

### admin_user

The name of the default Grafana Admin user, who has full permissions.
Default is `admin`.

### admin_password

The password of the default Grafana Admin. Set once on first-run. Default is `admin`.

### secret_key

Used for signing some data source settings like secrets and passwords, the encryption format used is AES-256 in CFB mode. Cannot be changed without requiring an update
to data source settings to re-encode them.

### disable_gravatar

Set to `true` to disable the use of Gravatar for user profile images.
Default is `false`.

### data_source_proxy_whitelist

Define a whitelist of allowed IP addresses or domains, with ports, to be used in data source URLs with the Grafana data source proxy. Format: `ip_or_domain:port` separated by spaces. PostgreSQL, MySQL, and MSSQL data sources do not use the proxy and are therefore unaffected by this setting.

### disable_brute_force_login_protection

Set to `true` to disable [brute force login protection](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#account-lockout). Default is `false`.

### cookie_secure

Set to `true` if you host Grafana behind HTTPS. Default is `false`.

### cookie_samesite

Sets the `SameSite` cookie attribute and prevents the browser from sending this cookie along with cross-site requests. The main goal is to mitigate the risk of cross-origin information leakage. This setting also provides some protection against cross-site request forgery attacks (CSRF), [read more about SameSite here](https://www.owasp.org/index.php/SameSite). Valid values are `lax`, `strict`, `none`, and `disabled`. Default is `lax`. Using value `disabled` does not add any `SameSite` attribute to cookies.

### allow_embedding

When `false`, the HTTP header `X-Frame-Options: deny` will be set in Grafana HTTP responses which will instruct
browsers to not allow rendering Grafana in a `<frame>`, `<iframe>`, `<embed>` or `<object>`. The main goal is to
mitigate the risk of [Clickjacking](https://www.owasp.org/index.php/Clickjacking). Default is `false`.

### strict_transport_security

Set to `true` if you want to enable HTTP `Strict-Transport-Security` (HSTS) response header. This is only sent when HTTPS is enabled in this configuration. HSTS tells browsers that the site should only be accessed using HTTPS.

### strict_transport_security_max_age_seconds

Sets how long a browser should cache HSTS in seconds. Only applied if strict_transport_security is enabled. The default value is `86400`.

### strict_transport_security_preload

Set to `true` to enable HSTS `preloading` option. Only applied if strict_transport_security is enabled. The default value is `false`.

### strict_transport_security_subdomains

Set to `true` if to enable the HSTS includeSubDomains option. Only applied if strict_transport_security is enabled. The default value is `false`.

### x_content_type_options

Set to `true` to enable the X-Content-Type-Options response header. The X-Content-Type-Options response HTTP header is a marker used by the server to indicate that the MIME types advertised in the Content-Type headers should not be changed and be followed. The default value is `false`.

### x_xss_protection

Set to `false` to disable the X-XSS-Protection header, which tells browsers to stop pages from loading when they detect reflected cross-site scripting (XSS) attacks. The default value is `false` until the next minor release, `6.3`.

<hr />

## [snapshots]

### external_enabled

Set to `false` to disable external snapshot publish endpoint (default `true`).

### external_snapshot_url

Set root URL to a Grafana instance where you want to publish external snapshots (defaults to https://snapshots-origin.raintank.io).

### external_snapshot_name

Set name for external snapshot button. Defaults to `Publish to snapshot.raintank.io`.

### public_mode

Set to true to enable this Grafana instance to act as an external snapshot server and allow unauthenticated requests for creating and deleting snapshots. Default is `false`.

### snapshot_remove_expired

Enable this to automatically remove expired snapshots. Default is `true`.

<hr />

## [dashboards]

### versions_to_keep

Number dashboard versions to keep (per dashboard). Default: `20`, Minimum: `1`.

### min_refresh_interval

> Only available in Grafana v6.7+.

This prevents users from setting the dashboard refresh interval of a lower than given interval. Per default this is 5 seconds.
The interval string is a possibly signed sequence of decimal numbers, followed by a unit suffix (ms, s, m, h, d), e.g. `30s` or `1m`.

<hr />

## [users]

### allow_sign_up

Set to `false` to prohibit users from being able to sign up / create
user accounts. Default is `false`. The admin user can still create
users from the [Grafana Admin Pages](/reference/admin).

### allow_org_create

Set to `false` to prohibit users from creating new organizations.
Default is `false`.

### auto_assign_org

Set to `true` to automatically add new users to the main organization
(id 1). When set to `false`, new users automatically cause a new
organization to be created for that new user. Default is `true`.

### auto_assign_org_id

Set this value to automatically add new users to the provided org.
This requires `auto_assign_org` to be set to `true`. Please make sure
that this organization already exists. Default is 1.

### auto_assign_org_role

The role new users will be assigned for the main organization (if the
above setting is set to true). Defaults to `Viewer`, other valid
options are `Admin` and `Editor`. e.g.:

`auto_assign_org_role = Viewer`

### verify_email_enabled

Require email validation before sign up completes. Default is `false`.

### login_hint

Text used as placeholder text on login page for login/username input.

### password_hint

Text used as placeholder text on login page for password input.

### default_theme

Set the default UI theme: `dark` or `light`. Default is `dark`.

### External user management

If you manage users externally you can replace the user invite button for organizations with a link to an external site together with a description.

### viewers_can_edit

Viewers can edit/inspect dashboard settings in the browser, but not save the dashboard.
Default is `false`.

### editors_can_admin

Editors can administrate dashboards, folders and teams they create.
Default is `false`.

<hr>

## [auth]

Grafana provides many ways to authenticate users. Refer to the Grafana [Authentication overview]({{< relref "../auth/overview.md" >}}) and other authentication documentation for detailed instructions on how to set up and configure authentication.

### login_cookie_name

The cookie name for storing the auth token. Default is `grafana_session`.

### login_maximum_inactive_lifetime_days

The lifetime (days) an authenticated user can be inactive before being required to log in at next visit. Default is 7 days.

### login_maximum_lifetime_days

The maximum lifetime (days) an authenticated user can be logged in before being required to login. Default is 30 days.

### token_rotation_interval_minutes

How often auth tokens are rotated for authenticated users when the user is active. The default is each 10 minutes.

### disable_login_form

Set to true to disable (hide) the login form, useful if you use OAuth. Default is false.

### disable_signout_menu

Set to `true` to disable the signout link in the side menu. This is useful if you use auth.proxy. Default is `false`.

### signout_redirect_url

URL to redirect the user to after they sign out.

### oauth_auto_login

Set to `true` to attempt login with OAuth automatically, skipping the login screen.
This setting is ignored if multiple OAuth providers are configured. Default is `false`.

### oauth_state_cookie_max_age

How long the OAuth state cookie lives before being deleted. Default is `60` (seconds)
Administrators can increase this if they experience OAuth login state mismatch errors.

### api_key_max_seconds_to_live

Limit of API key seconds to live before expiration. Default is -1 (unlimited).

### default_home_dashboard_path

Path to the default home dashboard. If this value is empty, then Grafana uses StaticRootPath + "dashboards/home.json"

<hr />

## [auth.anonymous]

Refer to [Anonymous authentication]({{< relref "../auth/#anonymous-authentication" >}}) for detailed instructions.

<hr />

## [auth.github]

Refer to [GitHub OAuth2 authentication]({{< relref "../auth/github.md" >}}) for detailed instructions.

<hr />

## [auth.gitlab]

Refer to [Gitlab OAuth2 authentication]({{< relref "../auth/gitlab.md" >}}) for detailed instructions.

<hr />

## [auth.google]

Refer to [Google OAuth2 authentication]({{< relref "../auth/google.md" >}}) for detailed instructions.

<hr />

## [auth.grafananet]

Legacy key names, still in the config file so they work in env variables.

<hr />

## [auth.grafana_com]

Legacy key names, still in the config file so they work in env variables.

<hr />

## [auth.azuread]

Refer to [Azure AD OAuth2 authentication]({{< relref "../auth/azuread.md" >}}) for detailed instructions.

<hr />

## [auth.okta]

Refer to [Okta OAuth2 authentication]({{< relref "../auth/okta.md" >}}) for detailed instructions.

<hr />

## [auth.generic_oauth]

Refer to [Generic OAuth authentication]({{< relref "../auth/generic-oauth.md" >}}) for detailed instructions.

<hr />

## [auth.basic]

Refer to [Basic authentication]({{< relref "../auth/overview.md#basic-authentication" >}}) for detailed instructions.

<hr />

## [auth.proxy]

Refer to [Auth proxy authentication]({{< relref "../auth/auth-proxy.md" >}}) for detailed instructions.

<hr />

## [auth.ldap]

Refer to [LDAO authentication]({{< relref "../auth/ldap.md" >}}) for detailed instructions.

<hr />

## [smtp]

Email server settings.

### enabled

Enable this to allow Grafana to send email. Default is `false`.

If the password contains `#` or `;`, then you have to wrap it with triple quotes. Example: """#password;"""

### host

Default is `localhost:25`.

### user

In case of SMTP auth, default is `empty`.

### password

In case of SMTP auth, default is `empty`.

### cert_file

File path to a cert file, default is `empty`.

### key_file

File path to a key file, default is `empty`.

### skip_verify

Verify SSL for SMTP server, default is `false`.

### from_address

Address used when sending out emails, default is `admin@grafana.localhost`.

### from_name

Name to be used when sending out emails, default is `Grafana`.

### ehlo_identity

Name to be used as client identity for EHLO in SMTP dialog, default is `<instance_name>`.

### startTLS_policy

Either "OpportunisticStartTLS", "MandatoryStartTLS", "NoStartTLS". Default is `empty`.

<hr>

## [emails]

### welcome_email_on_sign_up

Default is `false`.

### templates_pattern

Default is `emails/*.html`.

<hr>

## [log]

Grafana logging options.

### mode

Options are "console", "file", and "syslog". Default is "console" and "file". Use spaces to separate multiple modes, e.g. `console file`.

### level

Options are "debug", "info", "warn", "error", and "critical". Default is `info`.

### filters

Optional settings to set different levels for specific loggers.
For example: `filters = sqlstore:debug`

<hr>

## [log.console]

Only applicable when "console" is used in `[log]` mode.

### level

Options are "debug", "info", "warn", "error", and "critical". Default is inherited from `[log]` level.

### format

Log line format, valid options are text, console and json. Default is `console`.

<hr>

## [log.file]

Only applicable when "file" used in `[log]` mode.

### level

Options are "debug", "info", "warn", "error", and "critical". Default is inherited from `[log]` level.

### format

Log line format, valid options are text, console and json. Default is `text`.

### log_rotate

Enable automated log rotation, valid options are `false` or `true`. Default is `true`.
When enabled use the `max_lines`, `max_size_shift`, `daily_rotate` and `max_days` to configure the behavior of the log rotation.

### max_lines

Maximum lines per file before rotating it. Default is `1000000`.

### max_size_shift

Maximum size of file before rotating it. Default is `28`, which means `1 << 28`, `256MB`.

### daily_rotate

Enable daily rotation of files, valid options are `false` or `true`. Default is `true`.

### max_days

Maximum number of days to keep log files. Default is `7`.

## [log.syslog]

Only applicable when "syslog" used in `[log]` mode.

### level

Options are "debug", "info", "warn", "error", and "critical". Default is inherited from `[log]` level.

### format

Log line format, valid options are text, console, and json. Default is `text`.

### network and address

Syslog network type and address. This can be UDP, TCP, or UNIX. If left blank, then the default UNIX endpoints are used.

### facility

Syslog facility. Valid options are user, daemon or local0 through local7. Default is empty.

### tag

Syslog tag. By default, the process's `argv[0]` is used.

<hr>

## [quota]

Set quotas to `-1` to make unlimited.

### enabled

Enable usage quotas. Default is `false`.

### org_user

Limit the number of users allowed per organization. Default is 10.

### org_dashboard

Limit the number of dashboards allowed per organization. Default is 100.

### org_data_source

Limit the number of data sources allowed per organization. Default is 10.

### org_api_key

Limit the number of API keys that can be entered per organization. Default is 10.

### user_org

Limit the number of organizations a user can create. Default is 10.

### global_user

Sets a global limit of users. Default is -1 (unlimited).

### global_org

Sets a global limit on the number of organizations that can be created. Default is -1 (unlimited).

### global_dashboard

Sets a global limit on the number of dashboards that can be created. Default is -1 (unlimited).

### global_api_key

Sets global limit of API keys that can be entered. Default is -1 (unlimited).

### global_session

Sets a global limit on number of users that can be logged in at one time. Default is -1 (unlimited).

<hr>

## [alerting]

For more information about the Alerting feature in Grafana, refer to [Alerts overview]({{< relref "../alerting/alerts-overview.md" >}}).

### enabled

Set to `false` to disable alerting engine and hide Alerting in the Grafana UI. Default is `true`.

### execute_alerts

Turns off alert rule execution, but Alerting is still visible in the Grafana UI.

### error_or_timeout

Default setting for new alert rules. Defaults to categorize error and timeouts as alerting. (alerting, keep_state)

### nodata_or_nullvalues

Defines how Grafana handles nodata or null values in alerting. Options are `alerting`, `no_data`, `keep_state`, and `ok`. Default is `no_data`.

### concurrent_render_limit

Alert notifications can include images, but rendering many images at the same time can overload the server.
This limit protects the server from render overloading and ensures notifications are sent out quickly. Default value is `5`.

### evaluation_timeout_seconds

Sets the alert calculation timeout. Default value is `30`.

### notification_timeout_seconds

Sets the alert notification timeout. Default value is `30`.

### max_attempts

Sets a maximum limit on attempts to sending alert notifications. Default value is `3`.

### min_interval_seconds

Sets the minimum interval between rule evaluations. Default value is `1`.

> **Note.** This setting has precedence over each individual rule frequency. If a rule frequency is lower than this value, then this value is enforced.

<hr>

## [explore]

For more information about this feature, refer to [Explore]({{< relref "../features/explore/index.md" >}}).

### enabled

Enable or disable the Explore section. Default is `enabled`.

## [metrics]

For detailed instructions, refer to [Internal Grafana metrics]({{< relref "metrics.md" >}}).

### enabled

Enable metrics reporting. defaults true. Available via HTTP API `<URL>/metrics`.

### interval_seconds

Flush/write interval when sending metrics to external TSDB. Defaults to `10`.

### disable_total_stats

If set to `true`, then total stats generation (`stat_totals_*` metrics) is disabled. Default is `false`.

### basic_auth_username and basic_auth_password

If both are set, then basic authentication is required to access the metrics endpoint.

<hr>

## [metrics.graphite]

Use these options if you want to send internal Grafana metrics to Graphite.

### address

Enable by setting the address. Format is `<Hostname or ip>`:port.

### prefix

Graphite metric prefix. Defaults to `prod.grafana.%(instance_name)s.`

<hr>

## [grafana_net]

### url

Default is https://grafana.com.

<hr>

## [grafana_com]

### url

Default is https://grafana.com.

<hr>

## [tracing.jaeger]

Configure Grafana's Jaeger client for distributed tracing.

You can also use the standard `JAEGER_*` environment variables to configure
Jaeger. See the table at the end of https://www.jaegertracing.io/docs/1.16/client-features/
for the full list. Environment variables will override any settings provided here.

### address

The host:port destination for reporting spans. (ex: `localhost:6831`)

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

<hr>

## [external_image_storage]

These options control how images should be made public so they can be shared on services like Slack or email message.

### provider

Options are s3, webdav, gcs, azure_blob, local). If left empty, then Grafana ignores the upload action.

<hr>

## [external_image_storage.s3]

### endpoint

Optional endpoint URL (hostname or fully qualified URI) to override the default generated S3 endpoint. If you want to
keep the default, just leave this empty. You must still provide a `region` value if you specify an endpoint.

### path_style_access

Set this to true to force path-style addressing in S3 requests, i.e., `http://s3.amazonaws.com/BUCKET/KEY`, instead
of the default, which is virtual hosted bucket addressing when possible (`http://BUCKET.s3.amazonaws.com/KEY`).

> Note: This option is specific to the Amazon S3 service.

### bucket_url

(for backward compatibility, only works when no bucket or region are configured)
Bucket URL for S3. AWS region can be specified within URL or defaults to 'us-east-1', e.g.

- http://grafana.s3.amazonaws.com/
- https://grafana.s3-ap-southeast-2.amazonaws.com/

### bucket

Bucket name for S3. e.g. grafana.snapshot.

### region

Region name for S3. e.g. 'us-east-1', 'cn-north-1', etc.

### path

Optional extra path inside bucket, useful to apply expiration policies.

### access_key

Access key, e.g. AAAAAAAAAAAAAAAAAAAA.

Access key requires permissions to the S3 bucket for the 's3:PutObject' and 's3:PutObjectAcl' actions.

### secret_key

Secret key, e.g. AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA.

<hr>

## [external_image_storage.webdav]

### url

URL where Grafana sends PUT request with images.

### username

Basic auth username.

### password

Basic auth password.

### public_url

Optional URL to send to users in notifications. If the string contains the sequence \${file}, it is replaced with the uploaded filename. Otherwise, the file name is appended to the path part of the URL, leaving any query string unchanged.

<hr>

## [external_image_storage.gcs]

### key_file

Path to JSON key file associated with a Google service account to authenticate and authorize.
Service Account keys can be created and downloaded from https://console.developers.google.com/permissions/serviceaccounts.

Service Account should have "Storage Object Writer" role. The access control model of the bucket needs to be "Set object-level and bucket-level permissions". Grafana itself will make the images public readable.

### bucket

Bucket Name on Google Cloud Storage.

### path

Optional extra path inside bucket.

## [external_image_storage.azure_blob]

### account_name

Storage account name.

### account_key

Storage account key

### container_name

Container name where to store "Blob" images with random names. Creating the blob container beforehand is required. Only public containers are supported.

<hr>

## [external_image_storage.local]

This option does not require any configuration.

<hr>

## [rendering]

Options to configure a remote HTTP image rendering service, e.g. using https://github.com/grafana/grafana-image-renderer.

### server_url

URL to a remote HTTP image renderer service, e.g. http://localhost:8081/render, will enable Grafana to render panels and dashboards to PNG-images using HTTP requests to an external service.

### callback_url

If the remote HTTP image renderer service runs on a different server than the Grafana server you may have to configure this to a URL where Grafana is reachable, e.g. http://grafana.domain/.

### concurrent_render_request_limit

Concurrent render request limit affects when the /render HTTP endpoint is used. Rendering many images at the same time can overload the server,
which this setting can help protect against by only allowing a certain amount of concurrent requests. Default is `30`.

## [panels]

### enable_alpha

Set to `true` if you want to test alpha panels that are not yet ready for general usage. Default is `false`.

### disable_sanitize_html

If set to true Grafana will allow script tags in text panels. Not recommended as it enable XSS vulnerabilities. Default is false. This settings was introduced in Grafana v6.0.

## [plugins]

### enable_alpha

Set to `true` if you want to test alpha plugins that are not yet ready for general usage. Default is `false`.

### allow_loading_unsigned_plugins

Enter a comma-separated list of plugin identifiers to identify plugins that are allowed to be loaded even if they lack a valid signature.

<hr>

## [plugin.grafana-image-renderer]

For more information, refer to [Image rendering]({{< relref "image_rendering.md" >}}).

### rendering_timezone

Instruct headless browser instance to use a default timezone when not provided by Grafana, e.g. when rendering panel image of alert. See [ICUs metaZones.txt](https://cs.chromium.org/chromium/src/third_party/icu/source/data/misc/metaZones.txt) for a list of supported timezone IDs. Fallbacks to TZ environment variable if not set.

### rendering_language

Instruct headless browser instance to use a default language when not provided by Grafana, e.g. when rendering panel image of alert.
Refer to the HTTP header Accept-Language to understand how to format this value, e.g. 'fr-CH, fr;q=0.9, en;q=0.8, de;q=0.7, \*;q=0.5'.

### rendering_viewport_device_scale_factor

Instruct headless browser instance to use a default device scale factor when not provided by Grafana, e.g. when rendering panel image of alert.
Default is `1`. Using a higher value will produce more detailed images (higher DPI), but requires more disk space to store an image.

### rendering_ignore_https_errors

Instruct headless browser instance whether to ignore HTTPS errors during navigation. Per default HTTPS errors are not ignored. Due to the security risk, we do not recommend that you ignore HTTPS errors.

### rendering_verbose_logging

Instruct headless browser instance whether to capture and log verbose information when rendering an image. Default is `false` and will only capture and log error messages.

When enabled, debug messages are captured and logged as well.

For the verbose information to be included in the Grafana server log you have to adjust the rendering log level to debug, configure [log].filter = rendering:debug.

### rendering_dumpio

Instruct headless browser instance whether to output its debug and error messages into running process of remote rendering service. Default is `false`.

It can be useful to set this to `true` when troubleshooting.

### rendering_args

Additional arguments to pass to the headless browser instance. Default is --no-sandbox. The list of Chromium flags can be found at (https://peter.sh/experiments/chromium-command-line-switches/). Separate multiple arguments with commas.

### rendering_chrome_bin

You can configure the plugin to use a different browser binary instead of the pre-packaged version of Chromium.

Please note that this is _not_ recommended. You might encounter problems if the installed version of Chrome/Chromium is not compatible with the plugin.

### rendering_mode

Instruct how headless browser instances are created. Default is `default` and will create a new browser instance on each request.

Mode `clustered` will make sure that only a maximum of browsers/incognito pages can execute concurrently.

Mode `reusable` will have one browser instance and will create a new incognito page on each request.

### rendering_clustering_mode

When rendering_mode = clustered you can instruct how many browsers or incognito pages can execute concurrently. Default is `browser` and will cluster using browser instances.

Mode `context` will cluster using incognito pages.

### rendering_clustering_max_concurrency

When rendering_mode = clustered you can define maximum number of browser instances/incognito pages that can execute concurrently..

### rendering_viewport_max_width

Limit the maximum viewport width that can be requested.

### rendering_viewport_max_height

Limit the maximum viewport height that can be requested.

### rendering_viewport_max_device_scale_factor

Limit the maximum viewport device scale factor that can be requested.

### grpc_host

Change the listening host of the gRPC server. Default host is `127.0.0.1`.

### grpc_port

Change the listening port of the gRPC server. Default port is `0` and will automatically assign a port not in use.

<hr>

## [enterprise]

For more information about Grafana Enterprise, refer to [Grafana Enterprise]({{< relref "../enterprise/_index.md" >}}).

<hr>

## [feature_toggles]

### enable

Keys of alpha features to enable, separated by space. Available alpha features are: `transformations`
