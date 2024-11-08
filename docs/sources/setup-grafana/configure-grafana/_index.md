---
aliases:
  - ../administration/configuration/
  - ../installation/configuration/
description: Configuration documentation
labels:
  products:
    - enterprise
    - oss
title: Configure Grafana
weight: 200
---

# Configure Grafana

Grafana has default and custom configuration files. You can customize your Grafana instance by modifying the custom configuration file or by using environment variables. To see the list of settings for a Grafana instance, refer to [View server settings]({{< relref "../../administration/stats-and-license#view-server-settings" >}}).

{{% admonition type="note" %}}
After you add custom options, [uncomment](#remove-comments-in-the-ini-files) the relevant sections of the configuration file. Restart Grafana for your changes to take effect.
{{% /admonition %}}

## Configuration file location

The default settings for a Grafana instance are stored in the `$WORKING_DIR/conf/defaults.ini` file. _Do not_ change this file.

Depending on your OS, your custom configuration file is either the `$WORKING_DIR/conf/custom.ini` file or the `/usr/local/etc/grafana/grafana.ini` file. The custom configuration file path can be overridden using the `--config` parameter.

### Linux

If you installed Grafana using the `deb` or `rpm` packages, then your configuration file is located at `/etc/grafana/grafana.ini` and a separate `custom.ini` is not used. This path is specified in the Grafana init.d script using `--config` file parameter.

### Docker

Refer to [Configure a Grafana Docker image]({{< relref "../configure-docker" >}}) for information about environmental variables, persistent storage, and building custom Docker images.

### Windows

On Windows, the `sample.ini` file is located in the same directory as `defaults.ini` file. It contains all the settings commented out. Copy `sample.ini` and name it `custom.ini`.

### macOS

By default, the configuration file is located at `/opt/homebrew/etc/grafana/grafana.ini` or `/usr/local/etc/grafana/grafana.ini`. For a Grafana instance installed using Homebrew, edit the `grafana.ini` file directly. Otherwise, add a configuration file named `custom.ini` to the `conf` folder to override the settings defined in `conf/defaults.ini`.

## Remove comments in the .ini files

Grafana uses semicolons (the `;` char) to comment out lines in a `.ini` file. You must uncomment each line in the `custom.ini` or the `grafana.ini` file that you are modify by removing `;` from the beginning of that line. Otherwise your changes will be ignored.

For example:

```
# The HTTP port  to use
;http_port = 3000
```

## Override configuration with environment variables

Do not use environment variables to _add_ new configuration settings. Instead, use environmental variables to _override_ existing options.

To override an option:

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

[feature_toggles]
enable = newNavigation
```

You can override variables on Linux machines with:

```bash
export GF_DEFAULT_INSTANCE_NAME=my-instance
export GF_SECURITY_ADMIN_USER=owner
export GF_AUTH_GOOGLE_CLIENT_SECRET=newS3cretKey
export GF_PLUGIN_GRAFANA_IMAGE_RENDERER_RENDERING_IGNORE_HTTPS_ERRORS=true
export GF_FEATURE_TOGGLES_ENABLE=newNavigation
```

## Variable expansion

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

> Vault provider is only available in Grafana Enterprise v7.1+. For more information, refer to [Vault integration]({{< relref "../configure-security/configure-database-encryption/integrate-with-hashicorp-vault" >}}) in [Grafana Enterprise]({{< relref "../../introduction/grafana-enterprise" >}}).

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

Override log path using the command line argument `cfg:default.paths.logs`:

```bash
./grafana-server --config /custom/config.ini --homepath /custom/homepath cfg:default.paths.logs=/custom/path
```

**macOS:** By default, the log file should be located at `/usr/local/var/log/grafana/grafana.log`.

### plugins

Directory where Grafana automatically scans and looks for plugins. For information about manually or automatically installing plugins, refer to [Install Grafana plugins]({{< relref "../../administration/plugin-management#install-grafana-plugins" >}}).

**macOS:** By default, the Mac plugin location is: `/usr/local/var/lib/grafana/plugins`.

### provisioning

Folder that contains [provisioning]({{< relref "../../administration/provisioning" >}}) config files that Grafana will apply on startup. Dashboards will be reloaded when the json files changes.

<hr />

## [server]

### protocol

`http`,`https`,`h2` or `socket`

### min_tls_version

The TLS Handshake requires a minimum TLS version. The available options are TLS1.2 and TLS1.3.
If you do not specify a version, the system uses TLS1.2.

### http_addr

The host for the server to listen on. If your machine has more than one network interface, you can use this setting to expose the Grafana service on only one network interface and not have it available on others, such as the loopback interface. An empty value is equivalent to setting the value to `0.0.0.0`, which means the Grafana service binds to all interfaces.

In environments where network address translation (NAT) is used, ensure you use the network interface address and not a final public address; otherwise, you might see errors such as `bind: cannot assign requested address` in the logs.

### http_port

The port to bind to, defaults to `3000`. To use port 80 you need to either give the Grafana binary permission for example:

```bash
$ sudo setcap 'cap_net_bind_service=+ep' /usr/sbin/grafana-server
```

Or redirect port 80 to the Grafana port using:

```bash
$ sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 3000
```

Another way is to put a web server like Nginx or Apache in front of Grafana and have them proxy requests to Grafana.

### domain

This setting is only used in as a part of the `root_url` setting (see below). Important if you use GitHub or Google OAuth.

### enforce_domain

Redirect to correct domain if the host header does not match the domain. Prevents DNS rebinding attacks. Default is `false`.

### root_url

This is the full URL used to access Grafana from a web browser. This is
important if you use Google or GitHub OAuth authentication (for the
callback URL to be correct).

{{% admonition type="note" %}}
This setting is also important if you have a reverse proxy
in front of Grafana that exposes it through a subpath. In that
case add the subpath to the end of this URL setting.
{{% /admonition %}}

### serve_from_sub_path

Serve Grafana from subpath specified in `root_url` setting. By default it is set to `false` for compatibility reasons.

By enabling this setting and using a subpath in `root_url` above, e.g.`root_url = http://localhost:3000/grafana`, Grafana is accessible on `http://localhost:3000/grafana`. If accessed without subpath Grafana will redirect to
an URL with the subpath.

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

### certs_watch_interval

Controls whether `cert_key` and `cert_file` are periodically watched for changes.
Disabled, by default. When enabled, `cert_key` and `cert_file`
are watched for changes. If there is change, the new certificates are loaded automatically.

{{% admonition type="warning" %}}
After the new certificates are loaded, connections with old certificates
will not work. You must reload the connections to the old certs for them to work.
{{% /admonition %}}

### socket_gid

GID where the socket should be set when `protocol=socket`.
Make sure that the target group is in the group of Grafana process and that Grafana process is the file owner before you change this setting.
It is recommended to set the gid as http server user gid.
Not set when the value is -1.

### socket_mode

Mode where the socket should be set when `protocol=socket`. Make sure that Grafana process is the file owner before you change this setting.

### socket

Path where the socket should be created when `protocol=socket`. Make sure Grafana has appropriate permissions for that path before you change this setting.

### cdn_url

Specify a full HTTP URL address to the root of your Grafana CDN assets. Grafana will add edition and version paths.

For example, given a cdn url like `https://cdn.myserver.com` grafana will try to load a javascript file from
`http://cdn.myserver.com/grafana-oss/7.4.0/public/build/app.<hash>.js`.

### read_timeout

Sets the maximum time using a duration format (5s/5m/5ms) before timing out read of an incoming request and closing idle connections.
`0` means there is no timeout for reading the request.

<hr />

## [server.custom_response_headers]

This setting enables you to specify additional headers that the server adds to HTTP(S) responses.

```
exampleHeader1 = exampleValue1
exampleHeader2 = exampleValue2
```

<hr />

## [database]

Grafana needs a database to store users and dashboards (and other
things). By default it is configured to use [`sqlite3`](https://www.sqlite.org/index.html) which is an
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

The maximum number of open connections to the database. For MYSQL, configure this setting on both Grafana and the database. For more information, refer to [`sysvar_max_connections`](https://dev.mysql.com/doc/refman/8.0/en/server-system-variables.html#sysvar_max_connections).

### conn_max_lifetime

Sets the maximum amount of time a connection may be reused. The default is 14400 (which means 14400 seconds or 4 hours). For MySQL, this setting should be shorter than the [`wait_timeout`](https://dev.mysql.com/doc/refman/5.7/en/server-system-variables.html#sysvar_wait_timeout) variable.

### migration_locking

Set to `false` to disable database locking during the migrations. Default is true.

### locking_attempt_timeout_sec

For "mysql" and "postgres" only. Specify the time (in seconds) to wait before failing to lock the database for the migrations. Default is 0.

### log_queries

Set to `true` to log the sql calls and execution times.

### ssl_mode

For Postgres, use use any [valid libpq `sslmode`](https://www.postgresql.org/docs/current/libpq-ssl.html#LIBPQ-SSL-SSLMODE-STATEMENTS), e.g.`disable`, `require`, `verify-full`, etc.
For MySQL, use either `true`, `false`, or `skip-verify`.

### ssl_sni

For Postgres, set to `0` to disable [Server Name Indication](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNECT-SSLSNI). This is enabled by default on SSL-enabled connections.

### isolation_level

Only the MySQL driver supports isolation levels in Grafana. In case the value is empty, the driver's default isolation level is applied. Available options are "READ-UNCOMMITTED", "READ-COMMITTED", "REPEATABLE-READ" or "SERIALIZABLE".

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

### wal

For "sqlite3" only. Setting to enable/disable [Write-Ahead Logging](https://sqlite.org/wal.html). The default value is `false` (disabled).

### query_retries

This setting applies to `sqlite` only and controls the number of times the system retries a query when the database is locked. The default value is `0` (disabled).

### transaction_retries

This setting applies to `sqlite` only and controls the number of times the system retries a transaction when the database is locked. The default value is `5`.

### instrument_queries

Set to `true` to add metrics and tracing for database queries. The default value is `false`.

<hr />

## [remote_cache]

Caches authentication details and session information in the configured database, Redis or Memcached. This setting does not configure [Query Caching in Grafana Enterprise]({{< relref "../../administration/data-source-management#query-and-resource-caching" >}}).

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

### keep_alive_seconds

Interval between keep-alive probes. Default is `30` seconds. For more details check the [Dialer.KeepAlive](https://golang.org/pkg/net/#Dialer.KeepAlive) documentation.

### tls_handshake_timeout_seconds

The length of time that Grafana will wait for a successful TLS handshake with the datasource. Default is `10` seconds. For more details check the [Transport.TLSHandshakeTimeout](https://golang.org/pkg/net/http/#Transport.TLSHandshakeTimeout) documentation.

### expect_continue_timeout_seconds

The length of time that Grafana will wait for a datasource’s first response headers after fully writing the request headers, if the request has an “Expect: 100-continue” header. A value of `0` will result in the body being sent immediately. Default is `1` second. For more details check the [Transport.ExpectContinueTimeout](https://golang.org/pkg/net/http/#Transport.ExpectContinueTimeout) documentation.

### max_conns_per_host

Optionally limits the total number of connections per host, including connections in the dialing, active, and idle states. On limit violation, dials are blocked. A value of `0` means that there are no limits. Default is `0`.
For more details check the [Transport.MaxConnsPerHost](https://golang.org/pkg/net/http/#Transport.MaxConnsPerHost) documentation.

### max_idle_connections

The maximum number of idle connections that Grafana will maintain. Default is `100`. For more details check the [Transport.MaxIdleConns](https://golang.org/pkg/net/http/#Transport.MaxIdleConns) documentation.

### idle_conn_timeout_seconds

The length of time that Grafana maintains idle connections before closing them. Default is `90` seconds. For more details check the [Transport.IdleConnTimeout](https://golang.org/pkg/net/http/#Transport.IdleConnTimeout) documentation.

### send_user_header

If enabled and user is not anonymous, data proxy will add X-Grafana-User header with username into the request. Default is `false`.

### response_limit

Limits the amount of bytes that will be read/accepted from responses of outgoing HTTP requests. Default is `0` which means disabled.

### row_limit

Limits the number of rows that Grafana will process from SQL (relational) data sources. Default is `1000000`.

### user_agent

Sets a custom value for the `User-Agent` header for outgoing data proxy requests. If empty, the default value is `Grafana/<BuildVersion>` (for example `Grafana/9.0.0`).

<hr />

## [analytics]

### enabled

This option is also known as _usage analytics_. When `false`, this option disables the writers that write to the Grafana database and the associated features, such as dashboard and data source insights, presence indicators, and advanced dashboard search. The default value is `true`.

### reporting_enabled

When enabled Grafana will send anonymous usage statistics to
`stats.grafana.org`. No IP addresses are being tracked, only simple counters to
track running instances, versions, dashboard and error counts. It is very helpful
to us, so please leave this enabled. Counters are sent every 24 hours. Default
value is `true`.

### check_for_updates

Set to false, disables checking for new versions of Grafana from Grafana's GitHub repository. When enabled, the check for a new version runs every 10 minutes. It will notify, via the UI, when a new version is available. The check itself will not prompt any auto-updates of the Grafana software, nor will it send any sensitive information.

### check_for_plugin_updates

Set to false disables checking for new versions of installed plugins from https://grafana.com. When enabled, the check for a new plugin runs every 10 minutes. It will notify, via the UI, when a new plugin update exists. The check itself will not prompt any auto-updates of the plugin, nor will it send any sensitive information.

### google_analytics_ua_id

If you want to track Grafana usage via Google analytics specify _your_ Universal
Analytics ID here. By default this feature is disabled.

### google_analytics_4_id

If you want to track Grafana usage via Google Analytics 4 specify _your_ GA4 ID here. By default this feature is disabled.

### google_tag_manager_id

Google Tag Manager ID, only enabled if you enter an ID here.

### rudderstack_write_key

If you want to track Grafana usage via Rudderstack specify _your_ Rudderstack
Write Key here. The `rudderstack_data_plane_url` must also be provided for this
feature to be enabled. By default this feature is disabled.

### rudderstack_data_plane_url

Rudderstack data plane url that will receive Rudderstack events. The
`rudderstack_write_key` must also be provided for this feature to be enabled.

### rudderstack_sdk_url

Optional. If tracking with Rudderstack is enabled, you can provide a custom
URL to load the Rudderstack SDK.

### rudderstack_config_url

Optional. If tracking with Rudderstack is enabled, you can provide a custom
URL to load the Rudderstack config.

### rudderstack_integrations_url

Optional. If tracking with Rudderstack is enabled, you can provide a custom
URL to load the SDK for destinations running in device mode. This setting is only valid for
Rudderstack version 1.1 and higher.

### application_insights_connection_string

If you want to track Grafana usage via Azure Application Insights, then specify _your_ Application Insights connection string. Since the connection string contains semicolons, you need to wrap it in backticks (`). By default, tracking usage is disabled.

### application_insights_endpoint_url

Optionally, use this option to override the default endpoint address for Application Insights data collecting. For details, refer to the [Azure documentation](https://docs.microsoft.com/en-us/azure/azure-monitor/app/custom-endpoints?tabs=js).

<hr />

### feedback_links_enabled

Set to `false` to remove all feedback links from the UI. Default is `true`.

## [security]

### disable_initial_admin_creation

Disable creation of admin user on first start of Grafana. Default is `false`.

### admin_user

The name of the default Grafana Admin user, who has full permissions.
Default is `admin`.

### admin_password

The password of the default Grafana Admin. Set once on first-run. Default is `admin`.

### admin_email

The email of the default Grafana Admin, created on startup. Default is `admin@localhost`.

### secret_key

Used for signing some data source settings like secrets and passwords, the encryption format used is AES-256 in CFB mode. Cannot be changed without requiring an update
to data source settings to re-encode them.

### disable_gravatar

Set to `true` to disable the use of Gravatar for user profile images.
Default is `false`.

### data_source_proxy_whitelist

Define a whitelist of allowed IP addresses or domains, with ports, to be used in data source URLs with the Grafana data source proxy. Format: `ip_or_domain:port` separated by spaces. PostgreSQL, MySQL, and MSSQL data sources do not use the proxy and are therefore unaffected by this setting.

### disable_brute_force_login_protection

Set to `true` to disable [brute force login protection](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#account-lockout). Default is `false`. An existing user's account will be locked after 5 attempts in 5 minutes.

### cookie_secure

Set to `true` if you host Grafana behind HTTPS. Default is `false`.

### cookie_samesite

Sets the `SameSite` cookie attribute and prevents the browser from sending this cookie along with cross-site requests. The main goal is to mitigate the risk of cross-origin information leakage. This setting also provides some protection against cross-site request forgery attacks (CSRF), [read more about SameSite here](https://owasp.org/www-community/SameSite). Valid values are `lax`, `strict`, `none`, and `disabled`. Default is `lax`. Using value `disabled` does not add any `SameSite` attribute to cookies.

### allow_embedding

When `false`, the HTTP header `X-Frame-Options: deny` will be set in Grafana HTTP responses which will instruct
browsers to not allow rendering Grafana in a `<frame>`, `<iframe>`, `<embed>` or `<object>`. The main goal is to
mitigate the risk of [Clickjacking](https://owasp.org/www-community/attacks/Clickjacking). Default is `false`.

### strict_transport_security

Set to `true` if you want to enable HTTP `Strict-Transport-Security` (HSTS) response header. Only use this when HTTPS is enabled in your configuration, or when there is another upstream system that ensures your application does HTTPS (like a frontend load balancer). HSTS tells browsers that the site should only be accessed using HTTPS.

### strict_transport_security_max_age_seconds

Sets how long a browser should cache HSTS in seconds. Only applied if strict_transport_security is enabled. The default value is `86400`.

### strict_transport_security_preload

Set to `true` to enable HSTS `preloading` option. Only applied if strict_transport_security is enabled. The default value is `false`.

### strict_transport_security_subdomains

Set to `true` to enable the HSTS includeSubDomains option. Only applied if strict_transport_security is enabled. The default value is `false`.

### x_content_type_options

Set to `false` to disable the X-Content-Type-Options response header. The X-Content-Type-Options response HTTP header is a marker used by the server to indicate that the MIME types advertised in the Content-Type headers should not be changed and be followed. The default value is `true`.

### x_xss_protection

Set to `false` to disable the X-XSS-Protection header, which tells browsers to stop pages from loading when they detect reflected cross-site scripting (XSS) attacks. The default value is `true`.

### content_security_policy

Set to `true` to add the Content-Security-Policy header to your requests. CSP allows to control resources that the user agent can load and helps prevent XSS attacks.

### content_security_policy_template

Set the policy template that will be used when adding the `Content-Security-Policy` header to your requests. `$NONCE` in the template includes a random nonce.

### content_security_policy_report_only

Set to `true` to add the `Content-Security-Policy-Report-Only` header to your requests. CSP in Report Only mode enables you to experiment with policies by monitoring their effects without enforcing them.
You can enable both policies simultaneously.

### content_security_policy_template

Set the policy template that will be used when adding the `Content-Security-Policy-Report-Only` header to your requests. `$NONCE` in the template includes a random nonce.

### actions_allow_post_url

Sets API paths to be accessible between plugins using the POST verb. If the value is empty, you can only pass remote requests through the proxy. If the value is set, you can also send authenticated POST requests to the local server. You typically use this to enable backend communication between plugins.

This is a comma-separated list which uses glob matching.

This will allow access to all plugins that have a backend:

`actions_allow_post_url=/api/plugins/*`

This will limit access to the backend of a single plugin:

`actions_allow_post_url=/api/plugins/grafana-special-app`

<hr />

### angular_support_enabled

This is set to false by default, meaning that the angular framework and support components will not be loaded. This means that
all [plugins]({{< relref "../../developers/angular_deprecation/angular-plugins" >}}) and core features that depend on angular support will stop working.

The core features that depend on angular are:

- Old graph panel
- Old table panel

These features each have supported alternatives, and we recommend using them.

### csrf_trusted_origins

List of additional allowed URLs to pass by the CSRF check. Suggested when authentication comes from an IdP.

### csrf_additional_headers

List of allowed headers to be set by the user. Suggested to use for if authentication lives behind reverse proxies.

### csrf_always_check

Set to `true` to execute the CSRF check even if the login cookie is not in a request (default `false`).

### enable_frontend_sandbox_for_plugins

Comma-separated list of plugins ids that will be loaded inside the frontend sandbox.

## [snapshots]

### enabled

Set to `false` to disable the snapshot feature (default `true`).

### external_enabled

Set to `false` to disable external snapshot publish endpoint (default `true`).

### external_snapshot_url

Set root URL to a Grafana instance where you want to publish external snapshots (defaults to https://snapshots.raintank.io).

### external_snapshot_name

Set name for external snapshot button. Defaults to `Publish to snapshots.raintank.io`.

### public_mode

Set to true to enable this Grafana instance to act as an external snapshot server and allow unauthenticated requests for creating and deleting snapshots. Default is `false`.

<hr />

## [dashboards]

### versions_to_keep

Number dashboard versions to keep (per dashboard). Default: `20`, Minimum: `1`.

### min_refresh_interval

This feature prevents users from setting the dashboard refresh interval to a lower value than a given interval value. The default interval value is 5 seconds.
The interval string is a possibly signed sequence of decimal numbers, followed by a unit suffix (ms, s, m, h, d), e.g. `30s` or `1m`.

This also limits the refresh interval options in Explore.

### default_home_dashboard_path

Path to the default home dashboard. If this value is empty, then Grafana uses StaticRootPath + "dashboards/home.json".

{{% admonition type="note" %}}
On Linux, Grafana uses `/usr/share/grafana/public/dashboards/home.json` as the default home dashboard location.
{{% /admonition %}}

<hr />

## [sql_datasources]

### max_open_conns_default

For SQL data sources (MySql, Postgres, MSSQL) you can override the default maximum number of open connections (default: 100). The value configured in data source settings will be preferred over the default value.

### max_idle_conns_default

For SQL data sources (MySql, Postgres, MSSQL) you can override the default allowed number of idle connections (default: 100). The value configured in data source settings will be preferred over the default value.

### max_conn_lifetime_default

For SQL data sources (MySql, Postgres, MSSQL) you can override the default maximum connection lifetime specified in seconds (default: 14400). The value configured in data source settings will be preferred over the default value.

<hr/>

## [users]

### allow_sign_up

Set to `false` to prohibit users from being able to sign up / create
user accounts. Default is `false`. The admin user can still create
users. For more information about creating a user, refer to [Add a user]({{< relref "../../administration/user-management/server-user-management#add-a-user" >}}).

### allow_org_create

Set to `false` to prohibit users from creating new organizations.
Default is `false`.

### auto_assign_org

Set to `true` to automatically add new users to the main organization
(id 1). When set to `false`, new users automatically cause a new
organization to be created for that new user. The organization will be
created even if the `allow_org_create` setting is set to `false`. Default is `true`.

### auto_assign_org_id

Set this value to automatically add new users to the provided org.
This requires `auto_assign_org` to be set to `true`. Please make sure
that this organization already exists. Default is 1.

### auto_assign_org_role

The `auto_assign_org_role` setting determines the default role assigned to new users in the main organization if `auto_assign_org` setting is set to `true`.
You can set this to one of the following roles: (`Viewer` (default), `Admin`, `Editor`, and `None`). For example:

`auto_assign_org_role = Viewer`

### verify_email_enabled

Require email validation before sign up completes or when updating a user email address. Default is `false`.

### login_default_org_id

Set the default organization for users when they sign in. The default is `-1`.

### login_hint

Text used as placeholder text on login page for login/username input.

### password_hint

Text used as placeholder text on login page for password input.

### default_theme

Sets the default UI theme: `dark`, `light`, or `system`. The default theme is `dark`.

`system` matches the user's system theme.

### default_language

This option will set the default UI language if a supported IETF language tag like `en-US` is available.
If set to `detect`, the default UI language will be determined by browser preference.
The default is `en-US`.

### home_page

Path to a custom home page. Users are only redirected to this if the default home dashboard is used. It should match a frontend route and contain a leading slash.

### External user management

If you manage users externally you can replace the user invite button for organizations with a link to an external site together with a description.

### viewers_can_edit

Viewers can access and use [Explore]({{< relref "../../explore" >}}) and perform temporary edits on panels in dashboards they have access to. They cannot save their changes. Default is `false`.

### editors_can_admin

Editors can administrate dashboards, folders and teams they create.
Default is `false`.

### user_invite_max_lifetime_duration

The duration in time a user invitation remains valid before expiring.
This setting should be expressed as a duration. Examples: 6h (hours), 2d (days), 1w (week).
Default is `24h` (24 hours). The minimum supported duration is `15m` (15 minutes).

### verification_email_max_lifetime_duration

The duration in time a verification email, used to update the email address of a user, remains valid before expiring.
This setting should be expressed as a duration. Examples: 6h (hours), 2d (days), 1w (week).
Default is 1h (1 hour).

### last_seen_update_interval

The frequency of updating a user's last seen time.
This setting should be expressed as a duration. Examples: 1h (hour), 15m (minutes)
Default is `15m` (15 minutes). The minimum supported duration is `5m` (5 minutes). The maximum supported duration is `1h` (1 hour).

### hidden_users

This is a comma-separated list of usernames. Users specified here are hidden in the Grafana UI. They are still visible to Grafana administrators and to themselves.

<hr>

## [auth]

Grafana provides many ways to authenticate users. Refer to the Grafana [Authentication overview]({{< relref "../configure-security/configure-authentication" >}}) and other authentication documentation for detailed instructions on how to set up and configure authentication.

### login_cookie_name

The cookie name for storing the auth token. Default is `grafana_session`.

### login_maximum_inactive_lifetime_duration

The maximum lifetime (duration) an authenticated user can be inactive before being required to login at next visit. Default is 7 days (7d).
This setting should be expressed as a duration, e.g. 5m (minutes), 6h (hours), 10d (days), 2w (weeks), 1M (month). The lifetime resets at each successful token rotation (token_rotation_interval_minutes).

### login_maximum_lifetime_duration

The maximum lifetime (duration) an authenticated user can be logged in since login time before being required to login. Default is 30 days (30d).
This setting should be expressed as a duration, e.g. 5m (minutes), 6h (hours), 10d (days), 2w (weeks), 1M (month).

### token_rotation_interval_minutes

How often auth tokens are rotated for authenticated users when the user is active. The default is each 10 minutes.

### disable_login_form

Set to true to disable (hide) the login form, useful if you use OAuth. Default is false.

### disable_signout_menu

Set to `true` to disable the signout link in the side menu. This is useful if you use auth.proxy. Default is `false`.

### signout_redirect_url

The URL the user is redirected to upon signing out. To support [OpenID Connect RP-Initiated Logout](https://openid.net/specs/openid-connect-rpinitiated-1_0.html), the user must add `post_logout_redirect_uri` to the `signout_redirect_url`.

Example:

signout_redirect_url = http://localhost:8087/realms/grafana/protocol/openid-connect/logout?post_logout_redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Flogin

### oauth_auto_login

{{% admonition type="note" %}}
This option is deprecated - use `auto_login` option for specific OAuth provider instead.
{{% /admonition %}}

Set to `true` to attempt login with OAuth automatically, skipping the login screen.
This setting is ignored if multiple OAuth providers are configured. Default is `false`.

### oauth_state_cookie_max_age

How many seconds the OAuth state cookie lives before being deleted. Default is `600` (seconds)
Administrators can increase this if they experience OAuth login state mismatch errors.

### oauth_login_error_message

A custom error message for when users are unauthorized. Default is a key for an internationalized phrase in the frontend, `Login provider denied login request`.

### oauth_refresh_token_server_lock_min_wait_ms

Minimum wait time in milliseconds for the server lock retry mechanism. Default is `1000` (milliseconds). The server lock retry mechanism is used to prevent multiple Grafana instances from simultaneously refreshing OAuth tokens. This mechanism waits at least this amount of time before retrying to acquire the server lock.

There are five retries in total, so with the default value, the total wait time (for acquiring the lock) is at least 5 seconds (the wait time between retries is calculated as random(n, n + 500)), which means that the maximum token refresh duration must be less than 5-6 seconds.

If you experience issues with the OAuth token refresh mechanism, you can increase this value to allow more time for the token refresh to complete.

### oauth_skip_org_role_update_sync

{{% admonition type="note" %}}
This option is removed from G11 in favor of OAuth provider specific `skip_org_role_sync` settings. The following sections explain settings for each provider.
{{% /admonition %}}

If you want to change the `oauth_skip_org_role_update_sync` setting from `true` to `false`, then each provider you have set up, use the `skip_org_role_sync` setting to specify whether you want to skip the synchronization.

{{% admonition type="warning" %}}
Currently if no organization role mapping is found for a user, Grafana doesn't update the user's organization role.
With Grafana 10, if `oauth_skip_org_role_update_sync` option is set to `false`, users with no mapping will be
reset to the default organization role on every login. [See `auto_assign_org_role` option]({{< relref "#auto_assign_org_role" >}}).
{{% /admonition %}}

### skip_org_role_sync

`skip_org_role_sync` prevents the synchronization of organization roles for a specific OAuth integration, while the deprecated setting `oauth_skip_org_role_update_sync` affects all configured OAuth providers.

The default value for `skip_org_role_sync` is `false`.

With `skip_org_role_sync` set to `false`, the users' organization and role is reset on every new login, based on the external provider's role. See your provider in the tables below.

With `skip_org_role_sync` set to `true`, when a user logs in for the first time, Grafana sets the organization role based on the value specified in `auto_assign_org_role` and forces the organization to `auto_assign_org_id` when specified, otherwise it falls back to OrgID `1`.

> **Note**: Enabling `skip_org_role_sync` also disables the synchronization of Grafana Admins from the external provider, as such `allow_assign_grafana_admin` is ignored.

Use this setting when you want to manage the organization roles of your users from within Grafana and be able to manually assign them to multiple organizations, or to prevent synchronization conflicts when they can be synchronized from another provider.

The behavior of `oauth_skip_org_role_update_sync` and `skip_org_role_sync`, can be seen in the tables below:

**[auth.grafana_com]**
| `oauth_skip_org_role_update_sync` | `skip_org_role_sync` | **Resulting Org Role** | Modifiable |
|-----------------------------------|----------------------|-------------------------------------------------------------------------------------------------------------------------------------|---------------------------|
| false | false | Synchronize user organization role with Grafana.com role. If no role is provided, `auto_assign_org_role` is set. | false |
| true | false | Skips organization role synchronization for all OAuth providers' users. Role is set to `auto_assign_org_role`. | true |
| false | true | Skips organization role synchronization for Grafana.com users. Role is set to `auto_assign_org_role`. | true |
| true | true | Skips organization role synchronization for Grafana.com users and all other OAuth providers. Role is set to `auto_assign_org_role`. | true |

**[auth.azuread]**
| `oauth_skip_org_role_update_sync` | `skip_org_role_sync` | **Resulting Org Role** | Modifiable |
|-----------------------------------|----------------------|---------------------------------------------------------------------------------------------------------------------------------|---------------------------|
| false | false | Synchronize user organization role with AzureAD role. If no role is provided, `auto_assign_org_role` is set. | false |
| true | false | Skips organization role synchronization for all OAuth providers' users. Role is set to `auto_assign_org_role`. | true |
| false | true | Skips organization role synchronization for AzureAD users. Role is set to `auto_assign_org_role`. | true |
| true | true | Skips organization role synchronization for AzureAD users and all other OAuth providers. Role is set to `auto_assign_org_role`. | true |

**[auth.google]**
| `oauth_skip_org_role_update_sync` | `skip_org_role_sync` | **Resulting Org Role** | Modifiable |
|-----------------------------------|----------------------|----------------------------------------------------------------------------------------|---------------------------|
| false | false | User organization role is set to `auto_assign_org_role` and cannot be changed. | false |
| true | false | User organization role is set to `auto_assign_org_role` and can be changed in Grafana. | true |
| false | true | User organization role is set to `auto_assign_org_role` and can be changed in Grafana. | true |
| true | true | User organization role is set to `auto_assign_org_role` and can be changed in Grafana. | true |

{{% admonition type="note" %}}
For GitLab, GitHub, Okta, Generic OAuth providers, Grafana synchronizes organization roles and sets Grafana Admins. The `allow_assign_grafana_admin` setting is also accounted for, to allow or not setting the Grafana Admin role from the external provider.
{{% /admonition %}}

**[auth.github]**
| `oauth_skip_org_role_update_sync` | `skip_org_role_sync` | **Resulting Org Role** | Modifiable |
|-----------------------------------|----------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------|
| false | false | Synchronize user organization role with GitHub role. If no role is provided, `auto_assign_org_role` is set. | false |
| true | false | Skips organization role synchronization for all OAuth providers' users. Role is set to `auto_assign_org_role`. | true |
| false | true | Skips organization role and Grafana Admin synchronization for GitHub users. Role is set to `auto_assign_org_role`. | true |
| true | true | Skips organization role synchronization for all OAuth providers and skips Grafana Admin synchronization for GitHub users. Role is set to `auto_assign_org_role`. | true |

**[auth.gitlab]**
| `oauth_skip_org_role_update_sync` | `skip_org_role_sync` | **Resulting Org Role** | Modifiable |
|-----------------------------------|----------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------|
| false | false | Synchronize user organization role with Gitlab role. If no role is provided, `auto_assign_org_role` is set. | false |
| true | false | Skips organization role synchronization for all OAuth providers' users. Role is set to `auto_assign_org_role`. | true |
| false | true | Skips organization role and Grafana Admin synchronization for Gitlab users. Role is set to `auto_assign_org_role`. | true |
| true | true | Skips organization role synchronization for all OAuth providers and skips Grafana Admin synchronization for Gitlab users. Role is set to `auto_assign_org_role`. | true |

**[auth.generic_oauth]**
| `oauth_skip_org_role_update_sync` | `skip_org_role_sync` | **Resulting Org Role** | Modifiable |
|-----------------------------------|----------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------|
| false | false | Synchronize user organization role with the provider's role. If no role is provided, `auto_assign_org_role` is set. | false |
| true | false | Skips organization role synchronization for all OAuth providers' users. Role is set to `auto_assign_org_role`. | true |
| false | true | Skips organization role and Grafana Admin synchronization for the provider's users. Role is set to `auto_assign_org_role`. | true |
| true | true | Skips organization role synchronization for all OAuth providers and skips Grafana Admin synchronization for the provider's users. Role is set to `auto_assign_org_role`. | true |

**[auth.okta]**
| `oauth_skip_org_role_update_sync` | `skip_org_role_sync` | **Resulting Org Role** | Modifiable |
|-----------------------------------|----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------|
| false | false | Synchronize user organization role with Okta role. If no role is provided, `auto_assign_org_role` is set. | false |
| true | false | Skips organization role synchronization for all OAuth providers' users. Role is set to `auto_assign_org_role`. | true |
| false | true | Skips organization role and Grafana Admin synchronization for Okta users. Role is set to `auto_assign_org_role`. | true |
| true | true | Skips organization role synchronization for all OAuth providers and skips Grafana Admin synchronization for Okta users. Role is set to `auto_assign_org_role`. | true |

#### Example skip_org_role_sync

[auth.google]
| `oauth_skip_org_role_update_sync` | `skip_org_role_sync` | **Resulting Org Role** | **Example Scenario** |
|-----------------------------------|----------------------|-----------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| false | false | Synchronized with Google Auth organization roles | A user logs in to Grafana using their Google account and their organization role is automatically set based on their role in Google. |
| true | false | Skipped synchronization of organization roles from all OAuth providers | A user logs in to Grafana using their Google account and their organization role is **not** set based on their role. But Grafana Administrators can modify the role from the UI. |
| false | true | Skipped synchronization of organization roles Google | A user logs in to Grafana using their Google account and their organization role is **not** set based on their role in Google. But Grafana Administrators can modify the role from the UI. |
| true | true | Skipped synchronization of organization roles from all OAuth providers including Google | A user logs in to Grafana using their Google account and their organization role is **not** set based on their role in Google. But Grafana Administrators can modify the role from the UI. |

### api_key_max_seconds_to_live

Limit of API key seconds to live before expiration. Default is -1 (unlimited).

### sigv4_auth_enabled

Set to `true` to enable the AWS Signature Version 4 Authentication option for HTTP-based datasources. Default is `false`.

### sigv4_verbose_logging

Set to `true` to enable verbose request signature logging when AWS Signature Version 4 Authentication is enabled. Default is `false`.

<hr />

### managed_service_accounts_enabled

> Only available in Grafana 11.3+.

Set to `true` to enable the use of managed service accounts for plugin authentication. Default is `false`.

> **Limitations:**
> This feature currently **only supports single-organization deployments**.
> The plugin's service account is automatically created in the default organization. This means the plugin can only access data and resources within that specific organization.

## [auth.anonymous]

Refer to [Anonymous authentication]({{< relref "../configure-security/configure-authentication/grafana#anonymous-authentication" >}}) for detailed instructions.

<hr />

## [auth.github]

Refer to [GitHub OAuth2 authentication]({{< relref "../configure-security/configure-authentication/github" >}}) for detailed instructions.

<hr />

## [auth.gitlab]

Refer to [Gitlab OAuth2 authentication]({{< relref "../configure-security/configure-authentication/gitlab" >}}) for detailed instructions.

<hr />

## [auth.google]

Refer to [Google OAuth2 authentication]({{< relref "../configure-security/configure-authentication/google" >}}) for detailed instructions.

<hr />

## [auth.grafananet]

Legacy key names, still in the config file so they work in env variables.

<hr />

## [auth.grafana_com]

Legacy key names, still in the config file so they work in env variables.

<hr />

## [auth.azuread]

Refer to [Azure AD OAuth2 authentication]({{< relref "../configure-security/configure-authentication/azuread" >}}) for detailed instructions.

<hr />

## [auth.okta]

Refer to [Okta OAuth2 authentication]({{< relref "../configure-security/configure-authentication/okta" >}}) for detailed instructions.

<hr />

## [auth.generic_oauth]

Refer to [Generic OAuth authentication]({{< relref "../configure-security/configure-authentication/generic-oauth" >}}) for detailed instructions.

<hr />

## [auth.basic]

Refer to [Basic authentication]({{< relref "../configure-security/configure-authentication#basic-authentication" >}}) for detailed instructions.

<hr />

## [auth.proxy]

Refer to [Auth proxy authentication]({{< relref "../configure-security/configure-authentication/auth-proxy" >}}) for detailed instructions.

<hr />

## [auth.ldap]

Refer to [LDAP authentication]({{< relref "../configure-security/configure-authentication/ldap" >}}) for detailed instructions.

## [aws]

You can configure core and external AWS plugins.

### allowed_auth_providers

Specify what authentication providers the AWS plugins allow. For a list of allowed providers, refer to the data-source configuration page for a given plugin. If you configure a plugin by provisioning, only providers that are specified in `allowed_auth_providers` are allowed.

Options: `default` (AWS SDK default), `keys` (Access and secret key), `credentials` (Credentials file), `ec2_iam_role` (EC2 IAM role)

### assume_role_enabled

Set to `false` to disable AWS authentication from using an assumed role with temporary security credentials. For details about assume roles, refer to the AWS API reference documentation about the [AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html) operation.

If this option is disabled, the **Assume Role** and the **External Id** field are removed from the AWS data source configuration page. If the plugin is configured using provisioning, it is possible to use an assumed role as long as `assume_role_enabled` is set to `true`.

### list_metrics_page_limit

Use the [List Metrics API](https://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/API_ListMetrics.html) option to load metrics for custom namespaces in the CloudWatch data source. By default, the page limit is 500.

<hr />

## [azure]

Grafana supports additional integration with Azure services when hosted in the Azure Cloud.

### cloud

Azure cloud environment where Grafana is hosted:

| Azure Cloud                                      | Value                  |
| ------------------------------------------------ | ---------------------- |
| Microsoft Azure public cloud                     | AzureCloud (_default_) |
| Microsoft Chinese national cloud                 | AzureChinaCloud        |
| US Government cloud                              | AzureUSGovernment      |
| Microsoft German national cloud ("Black Forest") | AzureGermanCloud       |

### clouds_config

The JSON config defines a list of Azure clouds and their associated properties when hosted in custom Azure environments.

For example:

```ini
clouds_config = `[
		{
			"name":"CustomCloud1",
			"displayName":"Custom Cloud 1",
			"aadAuthority":"https://login.cloud1.contoso.com/",
			"properties":{
				"azureDataExplorerSuffix": ".kusto.windows.cloud1.contoso.com",
				"logAnalytics":            "https://api.loganalytics.cloud1.contoso.com",
				"portal":                  "https://portal.azure.cloud1.contoso.com",
				"prometheusResourceId":    "https://prometheus.monitor.azure.cloud1.contoso.com",
				"resourceManager":         "https://management.azure.cloud1.contoso.com"
			}
		}]`
```

### managed_identity_enabled

Specifies whether Grafana hosted in Azure service with Managed Identity configured (e.g. Azure Virtual Machines instance). Disabled by default, needs to be explicitly enabled.

### managed_identity_client_id

The client ID to use for user-assigned managed identity.

Should be set for user-assigned identity and should be empty for system-assigned identity.

### workload_identity_enabled

Specifies whether Azure AD Workload Identity authentication should be enabled in datasources that support it.

For more documentation on Azure AD Workload Identity, review [Azure AD Workload Identity](https://azure.github.io/azure-workload-identity/docs/) documentation.

Disabled by default, needs to be explicitly enabled.

### workload_identity_tenant_id

Tenant ID of the Azure AD Workload Identity.

Allows to override default tenant ID of the Azure AD identity associated with the Kubernetes service account.

### workload_identity_client_id

Client ID of the Azure AD Workload Identity.

Allows to override default client ID of the Azure AD identity associated with the Kubernetes service account.

### workload_identity_token_file

Custom path to token file for the Azure AD Workload Identity.

Allows to set a custom path to the projected service account token file.

### user_identity_enabled

Specifies whether user identity authentication (on behalf of currently signed-in user) should be enabled in datasources that support it (requires AAD authentication).

Disabled by default, needs to be explicitly enabled.

### user_identity_fallback_credentials_enabled

Specifies whether user identity authentication fallback credentials should be enabled in data sources. Enabling this allows data source creators to provide fallback credentials for backend-initiated requests, such as alerting, recorded queries, and so on.

It is by default and needs to be explicitly disabled. It will not have any effect if user identity authentication is disabled.

### user_identity_token_url

Override token URL for Azure Active Directory.

By default is the same as token URL configured for AAD authentication settings.

### user_identity_client_id

Override ADD application ID which would be used to exchange users token to an access token for the datasource.

By default is the same as used in AAD authentication or can be set to another application (for OBO flow).

### user_identity_client_secret

Override the AAD application client secret.

By default is the same as used in AAD authentication or can be set to another application (for OBO flow).

### forward_settings_to_plugins

Set plugins that will receive Azure settings via plugin context.

By default, this will include all Grafana Labs owned Azure plugins or those that use Azure settings (Azure Monitor, Azure Data Explorer, Prometheus, MSSQL).

### azure_entra_password_credentials_enabled

Specifies whether Entra password auth can be used for the MSSQL data source. This authentication is not recommended and consideration should be taken before enabling this.

Disabled by default, needs to be explicitly enabled.

## [auth.jwt]

Refer to [JWT authentication]({{< relref "../configure-security/configure-authentication/jwt" >}}) for more information.

<hr />

## [smtp]

Email server settings.

### enabled

Enable this to allow Grafana to send email. Default is `false`.

### host

Default is `localhost:25`. Use port 465 for implicit TLS.

### user

In case of SMTP auth, default is `empty`.

### password

In case of SMTP auth, default is `empty`. If the password contains `#` or `;`, then you have to wrap it with triple quotes. Example: """#password;"""

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

### enable_tracing

Enable trace propagation in e-mail headers, using the `traceparent`, `tracestate` and (optionally) `baggage` fields. Default is `false`. To enable, you must first configure tracing in one of the `tracing.opentelemetry.*` sections.

<hr>

## [smtp.static_headers]

Enter key-value pairs on their own lines to be included as headers on outgoing emails. All keys must be in canonical mail header format.
Examples: `Foo=bar`, `Foo-Header=bar`.

<hr>

## [emails]

### welcome_email_on_sign_up

Default is `false`.

### templates_pattern

Enter a comma separated list of template patterns. Default is `emails/*.html, emails/*.txt`.

### content_types

Enter a comma-separated list of content types that should be included in the emails that are sent. List the content types according descending preference, e.g. `text/html, text/plain` for HTML as the most preferred. The order of the parts is significant as the mail clients will use the content type that is supported and most preferred by the sender. Supported content types are `text/html` and `text/plain`. Default is `text/html`.

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

### user_facing_default_error

Use this configuration option to set the default error message shown to users. This message is displayed instead of sensitive backend errors, which should be obfuscated. The default message is `Please inspect the Grafana server log for details.`.

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

<hr>

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

## [log.frontend]

### enabled

Faro javascript agent is initialized. Default is `false`.

### custom_endpoint

Custom HTTP endpoint to send events captured by the Faro agent to. Default, `/log-grafana-javascript-agent`, will log the events to stdout.

### log_endpoint_requests_per_second_limit

Requests per second limit enforced per an extended period, for Grafana backend log ingestion endpoint, `/log-grafana-javascript-agent`. Default is `3`.

### log_endpoint_burst_limit

Maximum requests accepted per short interval of time for Grafana backend log ingestion endpoint, `/log-grafana-javascript-agent`. Default is `15`.

### instrumentations_all_enabled

Enables all Faro default instrumentation by using `getWebInstrumentations`. Overrides other instrumentation flags.

### instrumentations_errors_enabled

Turn on error instrumentation. Only affects Grafana Javascript Agent.

### instrumentations_console_enabled

Turn on console instrumentation. Only affects Grafana Javascript Agent

### instrumentations_webvitals_enabled

Turn on webvitals instrumentation. Only affects Grafana Javascript Agent

### instrumentations_tracing_enabled

Turns on tracing instrumentation. Only affects Grafana Javascript Agent.

### api_key

If `custom_endpoint` required authentication, you can set the API key here. Only relevant for Grafana Javascript Agent provider.

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

### org_alert_rule

Limit the number of alert rules that can be entered per organization. Default is 100.

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

### global_alert_rule

Sets a global limit on number of alert rules that can be created. Default is -1 (unlimited).

### global_correlations

Sets a global limit on number of correlations that can be created. Default is -1 (unlimited).

### alerting_rule_evaluation_results

Limit the number of query evaluation results per alert rule. If the condition query of an alert rule produces more results than this limit, the evaluation results in an error. Default is -1 (unlimited).

<hr>

## [unified_alerting]

For more information about the Grafana alerts, refer to [Grafana Alerting]({{< relref "../../alerting" >}}).

### enabled

Enable or disable Grafana Alerting. The default value is `true`.

Alerting rules migrated from dashboards and panels will include a link back via the `annotations`.

### disabled_orgs

Comma-separated list of organization IDs for which to disable Grafana 8 Unified Alerting.

### admin_config_poll_interval

Specify the frequency of polling for admin config changes. The default value is `60s`.

The interval string is a possibly signed sequence of decimal numbers, followed by a unit suffix (ms, s, m, h, d), e.g. 30s or 1m.

### alertmanager_config_poll_interval

Specify the frequency of polling for Alertmanager config changes. The default value is `60s`.

The interval string is a possibly signed sequence of decimal numbers, followed by a unit suffix (ms, s, m, h, d), e.g. 30s or 1m.

### ha_redis_address

The Redis server address that should be connected to.

{{< admonition type="note" >}}
For more information on Redis, refer to [Enable alerting high availability using Redis](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-high-availability/#enable-alerting-high-availability-using-redis).
{{< /admonition >}}

### ha_redis_username

The username that should be used to authenticate with the Redis server.

### ha_redis_password

The password that should be used to authenticate with the Redis server.

### ha_redis_db

The Redis database. The default value is `0`.

### ha_redis_prefix

A prefix that is used for every key or channel that is created on the Redis server as part of HA for alerting.

### ha_redis_peer_name

The name of the cluster peer that will be used as an identifier. If none is provided, a random one will be generated.

### ha_redis_max_conns

The maximum number of simultaneous Redis connections.

### ha_listen_address

Listen IP address and port to receive unified alerting messages for other Grafana instances. The port is used for both TCP and UDP. It is assumed other Grafana instances are also running on the same port. The default value is `0.0.0.0:9094`.

### ha_advertise_address

Explicit IP address and port to advertise other Grafana instances. The port is used for both TCP and UDP.

### ha_peers

Comma-separated list of initial instances (in a format of host:port) that will form the HA cluster. Configuring this setting will enable High Availability mode for alerting.

### ha_peer_timeout

Time to wait for an instance to send a notification via the Alertmanager. In HA, each Grafana instance will
be assigned a position (e.g. 0, 1). We then multiply this position with the timeout to indicate how long should
each instance wait before sending the notification to take into account replication lag. The default value is `15s`.

The interval string is a possibly signed sequence of decimal numbers, followed by a unit suffix (ms, s, m, h, d), e.g. 30s or 1m.

### ha_label

The label is an optional string to include on each packet and stream. It uniquely identifies the cluster and prevents cross-communication issues when sending gossip messages in an environment with multiple clusters.

### ha_gossip_interval

The interval between sending gossip messages. By lowering this value (more frequent) gossip messages are propagated
across cluster more quickly at the expense of increased bandwidth usage. The default value is `200ms`.

The interval string is a possibly signed sequence of decimal numbers, followed by a unit suffix (ms, s, m, h, d), e.g. 30s or 1m.

### ha_reconnect_timeout

Length of time to attempt to reconnect to a lost peer. When running Grafana in a Kubernetes cluster, set this duration to less than `15m`.

The string is a possibly signed sequence of decimal numbers followed by a unit suffix (ms, s, m, h, d), such as `30s` or `1m`.

### ha_push_pull_interval

The interval between gossip full state syncs. Setting this interval lower (more frequent) will increase convergence speeds
across larger clusters at the expense of increased bandwidth usage. The default value is `60s`.

The interval string is a possibly signed sequence of decimal numbers, followed by a unit suffix (ms, s, m, h, d), e.g. 30s or 1m.

### execute_alerts

Enable or disable alerting rule execution. The default value is `true`. The alerting UI remains visible.

### evaluation_timeout

Sets the alert evaluation timeout when fetching data from the data source. The default value is `30s`.

The timeout string is a possibly signed sequence of decimal numbers, followed by a unit suffix (ms, s, m, h, d), e.g. 30s or 1m.

### max_attempts

Sets a maximum number of times we'll attempt to evaluate an alert rule before giving up on that evaluation. The default value is `1`.

### min_interval

Sets the minimum interval to enforce between rule evaluations. The default value is `10s` which equals the scheduler interval. Rules will be adjusted if they are less than this value or if they are not multiple of the scheduler interval (10s). Higher values can help with resource management as we'll schedule fewer evaluations over time.

The interval string is a possibly signed sequence of decimal numbers, followed by a unit suffix (ms, s, m, h, d), e.g. 30s or 1m.

> **Note.** This setting has precedence over each individual rule frequency. If a rule frequency is lower than this value, then this value is enforced.

<hr>

## [unified_alerting.screenshots]

For more information about screenshots, refer to [Images in notifications]({{< relref "../../alerting/configure-notifications/template-notifications/images-in-notifications" >}}).

### capture

Enable screenshots in notifications. This option requires a remote HTTP image rendering service. Please see `[rendering]` for further configuration options.

### capture_timeout

The timeout for capturing screenshots. If a screenshot cannot be captured within the timeout then the notification is sent without a screenshot.
The maximum duration is 30 seconds. This timeout should be less than the minimum Interval of all Evaluation Groups to avoid back pressure on alert rule evaluation.

### max_concurrent_screenshots

The maximum number of screenshots that can be taken at the same time. This option is different from `concurrent_render_request_limit` as `max_concurrent_screenshots` sets the number of concurrent screenshots that can be taken at the same time for all firing alerts where as concurrent_render_request_limit sets the total number of concurrent screenshots across all Grafana services.

### upload_external_image_storage

Uploads screenshots to the local Grafana server or remote storage such as Azure, S3 and GCS. Please see `[external_image_storage]` for further configuration options. If this option is false then screenshots will be persisted to disk for up to `temp_data_lifetime`.

<hr>

## [unified_alerting.reserved_labels]

For more information about Grafana Reserved Labels, refer to [Labels in Grafana Alerting](/docs/grafana/next/alerting/fundamentals/annotation-label/how-to-use-labels/)

### disabled_labels

Comma-separated list of reserved labels added by the Grafana Alerting engine that should be disabled.

For example: `disabled_labels=grafana_folder`

<hr>

## [unified_alerting.state_history.annotations]

This section controls retention of annotations automatically created while evaluating alert rules when alerting state history backend is configured to be annotations (see setting [unified_alerting.state_history].backend)

### max_age

Configures for how long alert annotations are stored. Default is 0, which keeps them forever. This setting should be expressed as an duration. Ex 6h (hours), 10d (days), 2w (weeks), 1M (month).

### max_annotations_to_keep

Configures max number of alert annotations that Grafana stores. Default value is 0, which keeps all alert annotations.

<hr>

## [annotations]

### cleanupjob_batchsize

Configures the batch size for the annotation clean-up job. This setting is used for dashboard, API, and alert annotations.

### tags_length

Enforces the maximum allowed length of the tags for any newly introduced annotations. It can be between 500 and 4096 (inclusive). Default value is 500. Setting it to a higher value would impact performance therefore is not recommended.

## [annotations.dashboard]

Dashboard annotations means that annotations are associated with the dashboard they are created on.

### max_age

Configures how long dashboard annotations are stored. Default is 0, which keeps them forever.
This setting should be expressed as a duration. Examples: 6h (hours), 10d (days), 2w (weeks), 1M (month).

### max_annotations_to_keep

Configures max number of dashboard annotations that Grafana stores. Default value is 0, which keeps all dashboard annotations.

## [annotations.api]

API annotations means that the annotations have been created using the API without any association with a dashboard.

### max_age

Configures how long Grafana stores API annotations. Default is 0, which keeps them forever.
This setting should be expressed as a duration. Examples: 6h (hours), 10d (days), 2w (weeks), 1M (month).

### max_annotations_to_keep

Configures max number of API annotations that Grafana keeps. Default value is 0, which keeps all API annotations.

<hr>

## [explore]

For more information about this feature, refer to [Explore]({{< relref "../../explore" >}}).

### enabled

Enable or disable the Explore section. Default is `enabled`.

### defaultTimeOffset

Set a default time offset from now on the time picker. Default is 1 hour.
This setting should be expressed as a duration. Examples: 1h (hour), 1d (day), 1w (week), 1M (month).

## [help]

Configures the help section.

### enabled

Enable or disable the Help section. Default is `enabled`.

## [profile]

Configures the Profile section.

### enabled

Enable or disable the Profile section. Default is `enabled`.

## [news]

### news_feed_enabled

Enables the news feed section. Default is `true`

<hr>

## [query]

### concurrent_query_limit

Set the number of queries that can be executed concurrently in a mixed data source panel. Default is the number of CPUs.

## [query_history]

Configures Query history in Explore.

### enabled

Enable or disable the Query history. Default is `enabled`.

<hr>

## [short_links]

Configures settings around the short link feature.

### expire_time

Short links that are never accessed are considered expired or stale and will be deleted as cleanup. Set the expiration time in days. The default is `7` days. The maximum is `365` days, and setting above the maximum will have `365` set instead. Setting `0` means the short links will be cleaned up approximately every 10 minutes. A negative value such as `-1` will disable expiry.

{{< admonition type="caution" >}}
Short links without an expiration increase the size of the database and can’t be deleted.
{{< /admonition >}}

<hr>

## [metrics]

For detailed instructions, refer to [Internal Grafana metrics]({{< relref "../set-up-grafana-monitoring" >}}).

### enabled

Enable metrics reporting. defaults true. Available via HTTP API `<URL>/metrics`.

### interval_seconds

Flush/write interval when sending metrics to external TSDB. Defaults to `10`.

### disable_total_stats

If set to `true`, then total stats generation (`stat_totals_*` metrics) is disabled. Default is `false`.

### total_stats_collector_interval_seconds

Sets the total stats collector interval. The default is 1800 seconds (30 minutes).

### basic_auth_username and basic_auth_password

If both are set, then basic authentication is required to access the metrics endpoint.

<hr>

## [metrics.environment_info]

Adds dimensions to the `grafana_environment_info` metric, which can expose more information about the Grafana instance.

```
; exampleLabel1 = exampleValue1
; exampleLabel2 = exampleValue2
```

## [metrics.graphite]

Use these options if you want to send internal Grafana metrics to Graphite.

### address

Enable by setting the address. Format is `<Hostname or ip>`:port.

### prefix

Graphite metric prefix. Defaults to `prod.grafana.%(instance_name)s.`

<hr>

## [grafana_net]

Refer to [grafana_com] config as that is the new and preferred config name.
The grafana_net config is still accepted and parsed to grafana_com config.

<hr>

## [grafana_com]

### url

Default is https://grafana.com.
The default authentication identity provider for Grafana Cloud.

<hr>

## [tracing.jaeger]

[Deprecated - use tracing.opentelemetry.jaeger or tracing.opentelemetry.otlp instead]

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

_To override this setting, enter `sampler_type` in the `tracing.opentelemetry` section._

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

_Setting `sampler_param` in the `tracing.opentelemetry` section will override this setting._

### sampling_server_url

sampling_server_url is the URL of a sampling manager providing a sampling strategy.

_Setting `sampling_server_url` in the `tracing.opentelemetry` section will override this setting._

### zipkin_propagation

Default value is `false`.

Controls whether or not to use Zipkin's span propagation format (with `x-b3-` HTTP headers). By default, Jaeger's format is used.

Can be set with the environment variable and value `JAEGER_PROPAGATION=b3`.

### disable_shared_zipkin_spans

Default value is `false`.

Setting this to `true` turns off shared RPC spans. Leaving this available is the most common setting when using Zipkin elsewhere in your infrastructure.

<hr>

## [tracing.opentelemetry]

Configure general parameters shared between OpenTelemetry providers.

### custom_attributes

Comma-separated list of attributes to include in all new spans, such as `key1:value1,key2:value2`.

Can be set or overridden with the environment variable `OTEL_RESOURCE_ATTRIBUTES` (use `=` instead of `:` with the environment variable). The service name can be set or overridden using attributes or with the environment variable `OTEL_SERVICE_NAME`.

### sampler_type

Default value is `const`.

Specifies the type of sampler: `const`, `probabilistic`, `ratelimiting`, or `remote`.

### sampler_param

Default value is `1`.

Depending on the value of `sampler_type`, the sampler configuration parameter can be `0`, `1`, or any decimal value between `0` and `1`.

- For the `const` sampler, use `0` to never sample or `1` to always sample
- For the `probabilistic` sampler, you can use a decimal value between `0.0` and `1.0`
- For the `rateLimiting` sampler, enter the number of spans per second
- For the `remote` sampler, use a decimal value between `0.0` and `1.0`
  to specify the initial sampling rate used before the first update
  is received from the sampling server

### sampling_server_url

When `sampler_type` is `remote`, this specifies the URL of the sampling server. This can be used by all tracing providers.

Use a sampling server that supports the Jaeger remote sampling API, such as jaeger-agent, jaeger-collector, opentelemetry-collector-contrib, or [Grafana Alloy](https://grafana.com/oss/alloy-opentelemetry-collector/).

<hr>

## [tracing.opentelemetry.jaeger]

Configure Grafana's Jaeger client for distributed tracing.

### address

The host:port destination for reporting spans. (ex: `localhost:14268/api/traces`)

### propagation

The propagation specifies the text map propagation format. The values `jaeger` and `w3c` are supported. Add a comma (`,`) between values to specify multiple formats (for example, `"jaeger,w3c"`). The default value is `w3c`.

<hr>

## [tracing.opentelemetry.otlp]

Configure Grafana's otlp client for distributed tracing.

### address

The host:port destination for reporting spans. (ex: `localhost:4317`)

### propagation

The propagation specifies the text map propagation format. The values `jaeger` and `w3c` are supported. Add a comma (`,`) between values to specify multiple formats (for example, `"jaeger,w3c"`). The default value is `w3c`.

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

{{% admonition type="note" %}}
This option is specific to the Amazon S3 service.
{{% /admonition %}}

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

Optional URL to send to users in notifications. If the string contains the sequence `{{file}}`, it is replaced with the uploaded filename. Otherwise, the file name is appended to the path part of the URL, leaving any query string unchanged.

<hr>

## [external_image_storage.gcs]

### key_file

Optional path to JSON key file associated with a Google service account to authenticate and authorize. If no value is provided it tries to use the [application default credentials](https://cloud.google.com/docs/authentication/production#finding_credentials_automatically).
Service Account keys can be created and downloaded from https://console.developers.google.com/permissions/serviceaccounts.

Service Account should have "Storage Object Writer" role. The access control model of the bucket needs to be "Set object-level and bucket-level permissions". Grafana itself will make the images public readable when signed urls are not enabled.

### bucket

Bucket Name on Google Cloud Storage.

### path

Optional extra path inside bucket.

### enable_signed_urls

If set to true, Grafana creates a [signed URL](https://cloud.google.com/storage/docs/access-control/signed-urls) for
the image uploaded to Google Cloud Storage.

### signed_url_expiration

Sets the signed URL expiration, which defaults to seven days.

## [external_image_storage.azure_blob]

### account_name

Storage account name.

### account_key

Storage account key

### container_name

Container name where to store "Blob" images with random names. Creating the blob container beforehand is required. Only public containers are supported.

### sas_token_expiration_days

Number of days for SAS token validity. If specified SAS token will be attached to image URL. Allow storing images in private containers.

<hr>

## [external_image_storage.local]

This option does not require any configuration.

<hr>

## [rendering]

Options to configure a remote HTTP image rendering service, e.g. using https://github.com/grafana/grafana-image-renderer.

#### renderer_token

An auth token will be sent to and verified by the renderer. The renderer will deny any request without an auth token matching the one configured on the renderer.

### server_url

URL to a remote HTTP image renderer service, e.g. http://localhost:8081/render, will enable Grafana to render panels and dashboards to PNG-images using HTTP requests to an external service.

### callback_url

If the remote HTTP image renderer service runs on a different server than the Grafana server you may have to configure this to a URL where Grafana is reachable, e.g. http://grafana.domain/.

### concurrent_render_request_limit

Concurrent render request limit affects when the /render HTTP endpoint is used. Rendering many images at the same time can overload the server,
which this setting can help protect against by only allowing a certain number of concurrent requests. Default is `30`.

### default_image_width

Configures the width of the rendered image. The default width is `1000`.

### default_image_height

Configures the height of the rendered image. The default height is `500`.

### default_image_scale

Configures the scale of the rendered image. The default scale is `1`.

## [panels]

### enable_alpha

Set to `true` if you want to test alpha panels that are not yet ready for general usage. Default is `false`.

### disable_sanitize_html

{{% admonition type="note" %}}
This configuration is not available in Grafana Cloud instances.
{{% /admonition %}}

If set to true Grafana will allow script tags in text panels. Not recommended as it enables XSS vulnerabilities. Default is false.

## [plugins]

### enable_alpha

Set to `true` if you want to test alpha plugins that are not yet ready for general usage. Default is `false`.

### allow_loading_unsigned_plugins

Enter a comma-separated list of plugin identifiers to identify plugins to load even if they are unsigned. Plugins with modified signatures are never loaded.

We do _not_ recommend using this option. For more information, refer to [Plugin signatures]({{< relref "../../administration/plugin-management#plugin-signatures" >}}).

### plugin_admin_enabled

Available to Grafana administrators only, enables installing / uninstalling / updating plugins directly from the Grafana UI. Set to `true` by default. Setting it to `false` will hide the install / uninstall / update controls.

For more information, refer to [Plugin catalog]({{< relref "../../administration/plugin-management#plugin-catalog" >}}).

### plugin_admin_external_manage_enabled

Set to `true` if you want to enable external management of plugins. Default is `false`. This is only applicable to Grafana Cloud users.

### plugin_catalog_url

Custom install/learn more URL for enterprise plugins. Defaults to https://grafana.com/grafana/plugins/.

### plugin_catalog_hidden_plugins

Enter a comma-separated list of plugin identifiers to hide in the plugin catalog.

### public_key_retrieval_disabled

Disable download of the public key for verifying plugin signature. The default is `false`. If disabled, it will use the hardcoded public key.

### public_key_retrieval_on_startup

Force download of the public key for verifying plugin signature on startup. The default is `false`. If disabled, the public key will be retrieved every 10 days. Requires `public_key_retrieval_disabled` to be false to have any effect.

### disable_plugins

Enter a comma-separated list of plugin identifiers to avoid loading (including core plugins). These plugins will be hidden in the catalog.

<hr>

## [live]

### max_connections

The `max_connections` option specifies the maximum number of connections to the Grafana Live WebSocket endpoint per Grafana server instance. Default is `100`.

Refer to [Grafana Live configuration documentation]({{< relref "../set-up-grafana-live" >}}) if you specify a number higher than default since this can require some operating system and infrastructure tuning.

0 disables Grafana Live, -1 means unlimited connections.

### allowed_origins

The `allowed_origins` option is a comma-separated list of additional origins (`Origin` header of HTTP Upgrade request during WebSocket connection establishment) that will be accepted by Grafana Live.

If not set (default), then the origin is matched over [root_url]({{< relref "#root_url" >}}) which should be sufficient for most scenarios.

Origin patterns support wildcard symbol "\*".

For example:

```ini
[live]
allowed_origins = "https://*.example.com"
```

### ha_engine

**Experimental**

The high availability (HA) engine name for Grafana Live. By default, it's not set. The only possible value is "redis".

For more information, refer to the [Configure Grafana Live HA setup]({{< relref "../set-up-grafana-live#configure-grafana-live-ha-setup" >}}).

### ha_engine_address

**Experimental**

Address string of selected the high availability (HA) Live engine. For Redis, it's a `host:port` string. Example:

```ini
[live]
ha_engine = redis
ha_engine_address = 127.0.0.1:6379
```

<hr>

## [plugin.plugin_id]

This section can be used to configure plugin-specific settings. Replace the `plugin_id` attribute with the plugin ID present in `plugin.json`.

Properties described in this section are available for all plugins, but you must set them individually for each plugin.

### tracing

{{% admonition type="note" %}}
[OpenTelemetry must be configured as well](#tracingopentelemetry).
{{% /admonition %}}

If `true`, propagate the tracing context to the plugin backend and enable tracing (if the backend supports it).

## as_external

Load an external version of a core plugin if it has been installed.

Experimental. Requires the feature toggle `externalCorePlugins` to be enabled.

<hr>

## [plugin.grafana-image-renderer]

For more information, refer to [Image rendering]({{< relref "../image-rendering" >}}).

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

### rendering_timing_metrics

> **Note:** Available from grafana-image-renderer v3.9.0+

Instruct a headless browser instance on whether to record metrics for the duration of every rendering step. Default is `false`.

Setting this to `true` when optimizing the rendering mode settings to improve the plugin performance or when troubleshooting can be useful.

### rendering_args

Additional arguments to pass to the headless browser instance. Defaults are `--no-sandbox,--disable-gpu`. The list of Chromium flags can be found at (https://peter.sh/experiments/chromium-command-line-switches/). Separate multiple arguments with commas.

### rendering_chrome_bin

You can configure the plugin to use a different browser binary instead of the pre-packaged version of Chromium.

Please note that this is _not_ recommended. You might encounter problems if the installed version of Chrome/Chromium is not compatible with the plugin.

### rendering_mode

Instruct how headless browser instances are created. Default is `default` and will create a new browser instance on each request.

Mode `clustered` will make sure that only a maximum of browsers/incognito pages can execute concurrently.

Mode `reusable` will have one browser instance and will create a new incognito page on each request.

### rendering_clustering_mode

When rendering_mode = clustered, you can instruct how many browsers or incognito pages can execute concurrently. Default is `browser` and will cluster using browser instances.

Mode `context` will cluster using incognito pages.

### rendering_clustering_max_concurrency

When rendering_mode = clustered, you can define the maximum number of browser instances/incognito pages that can execute concurrently. Default is `5`.

### rendering_clustering_timeout

{{% admonition type="note" %}}
Available in grafana-image-renderer v3.3.0 and later versions.
{{% /admonition %}}

When rendering_mode = clustered, you can specify the duration a rendering request can take before it will time out. Default is `30` seconds.

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

For more information about Grafana Enterprise, refer to [Grafana Enterprise]({{< relref "../../introduction/grafana-enterprise" >}}).

<hr>

## [feature_toggles]

### enable

Keys of features to enable, separated by space.

### FEATURE_TOGGLE_NAME = false

Some feature toggles for stable features are on by default. Use this setting to disable an on-by-default feature toggle with the name FEATURE_TOGGLE_NAME, for example, `exploreMixedDatasource = false`.

<hr>

## [feature_management]

The options in this section configure the experimental Feature Toggle Admin Page feature, which is enabled using the `featureToggleAdminPage` feature toggle. Grafana Labs offers support on a best-effort basis, and breaking changes might occur prior to the feature being made generally available.

Please see [Configure feature toggles]({{< relref "./feature-toggles" >}}) for more information.

### allow_editing

Lets you switch the feature toggle state in the feature management page. The default is `false`.

### update_webhook

Set the URL of the controller that manages the feature toggle updates. If not set, feature toggles in the feature management page will be read-only.

{{% admonition type="note" %}}
The API for feature toggle updates has not been defined yet.
{{% /admonition %}}

### hidden_toggles

Hide additional specific feature toggles from the feature management page. By default, feature toggles in the `unknown`, `experimental`, and `private preview` stages are hidden from the UI. Use this option to hide toggles in the `public preview`, `general availability`, and `deprecated` stages.

### read_only_toggles

Use to disable updates for additional specific feature toggles in the feature management page. By default, feature toggles can only be updated if they are in the `general availability` and `deprecated`stages. Use this option to disable updates for toggles in those stages.

<hr>

## [date_formats]

This section controls system-wide defaults for date formats used in time ranges, graphs, and date input boxes.

The format patterns use [Moment.js](https://momentjs.com/docs/#/displaying/) formatting tokens.

### full_date

Full date format used by time range picker and in other places where a full date is rendered.

### intervals

These intervals formats are used in the graph to show only a partial date or time. For example, if there are only
minutes between Y-axis tick labels then the `interval_minute` format is used.

Defaults

```
interval_second = HH:mm:ss
interval_minute = HH:mm
interval_hour = MM/DD HH:mm
interval_day = MM/DD
interval_month = YYYY-MM
interval_year = YYYY
```

### use_browser_locale

Set this to `true` to have date formats automatically derived from your browser location. Defaults to `false`. This is an experimental feature.

### default_timezone

Used as the default time zone for user preferences. Can be either `browser` for the browser local time zone or a time zone name from the IANA Time Zone database, such as `UTC` or `Europe/Amsterdam`.

### default_week_start

Set the default start of the week, valid values are: `saturday`, `sunday`, `monday` or `browser` to use the browser locale to define the first day of the week. Default is `browser`.

## [expressions]

### enabled

Set this to `false` to disable expressions and hide them in the Grafana UI. Default is `true`.

## [geomap]

This section controls the defaults settings for Geomap Plugin.

### default_baselayer_config

The json config used to define the default base map. Four base map options to choose from are `carto`, `esriXYZTiles`, `xyzTiles`, `standard`.
For example, to set cartoDB light as the default base layer:

```ini
default_baselayer_config = `{
  "type": "xyz",
  "config": {
    "attribution": "Open street map",
    "url": "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
  }
}`
```

### enable_custom_baselayers

Set this to `false` to disable loading other custom base maps and hide them in the Grafana UI. Default is `true`.

## [rbac]

Refer to [Role-based access control]({{< relref "../../administration/roles-and-permissions/access-control" >}}) for more information.

## [navigation.app_sections]

Move an app plugin (referenced by its id), including all its pages, to a specific navigation section. Format: `<pluginId> = <sectionId> <sortWeight>`

## [navigation.app_standalone_pages]

Move an individual app plugin page (referenced by its `path` field) to a specific navigation section.
Format: `<pageUrl> = <sectionId> <sortWeight>`

## [public_dashboards]

This section configures the [shared dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/share-dashboards-panels/shared-dashboards/) feature.

### enabled

Set this to `false` to disable the shared dashboards feature. This prevents users from creating new shared dashboards and disables existing ones.
