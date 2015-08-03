---
page_title: Configuration
page_description: Configuration guide for Grafana.
page_keywords: grafana, configuration, documentation
---

# Configuration

The Grafana back-end has a number of configuration options that can be
specified in a `.ini` configuration file or specified using environment variables.

## Config file locations

- Default configuration from `$WORKING_DIR/conf/defaults.ini`
- Custom configuration from `$WORKING_DIR/conf/custom.ini`
- The custom configuration file path can be overridden using the `--config` parameter

> **Note.** If you have installed Grafana using the `deb` or `rpm`
> packages, then your configuration file is located at
> `/etc/grafana/grafana.ini`. This path is specified in the Grafana
> init.d script using `-config` file parameter.

## Using environment variables

All options in the configuration file (listed below) can be overridden
using environment variables using the syntax:

    GF_<SectionName>_<KeyName>

Where the section name is the text within the brackets. Everything
should be upper case, `.` should be replaced by `_`. For example, given these configuration settings:

    [security]
    admin_user = admin

    [auth.google]
    client_secret = 0ldS3cretKey


Then you can override that using:

    export GF_SECURITY_ADMIN_USER=true
    export GF_AUTH_GOOGLE_CLIENT_SECRET=newS3cretKey

<hr>

### instance_id

Identifier used for this grafana instance (for instrumentation and collectorcontroller)
Should be unique across all grafana instances in your infrastructure (on same or different hosts)
Defaults to "default"

## [paths]

### data

Path to where Grafana stores the sqlite3 database (if used), file based
sessions (if used), and other data.  This path is usually specified via
command line in the init.d script or the systemd service file.
It should be unique if you run multiple grafana processes on the same machine.

### logs

Path to where Grafana will store logs. This path is usually specified via
command line in the init.d script or the systemd service file.  It can
be overridden in the configuration file or in the default environment variable
file.

## [server]

### http_addr

The IP address to bind to, if empty will bind to all interfaces

### http_port

The port to bind to, defaults to `3000`. To use port 80 you need to
either give the Grafana binary permission for example:

    $ sudo setcap 'cap_net_bind_service=+ep' /opt/grafana/current/grafana

Or redirect port 80 to the Grafana port using:

    $ sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 3000

Another way is put a webserver like Nginx or Apache in front of Grafana and have them proxy requests to Grafana.

### protocol

`http` or `https`

### domain

This setting is only used in as a part of the `root_url` setting (see below). Important if you
use GitHub or Google OAuth.

### enforce_domain

Redirect to correct domain if host header does not match domain.
Prevents DNS rebinding attacks. Default is false.

### root_url

This is the full URL used to access Grafana from a web browser. This is
important if you use Google or GitHub OAuth authentication (for the
callback URL to be correct).

> **Note** This setting is also important if you have a reverse proxy
> in front of Grafana that exposes it through a subpath. In that
> case add the subpath to the end of this URL setting.

### static_root_path

The path to the directory where the front end files (HTML, JS, and CSS
files). Default to `public` which is why the Grafana binary needs to be
executed with working directory set to the installation path.

### cert_file

Path to the certificate file (if `protocol` is set to `https`).

### cert_key

Path to the certificate key file (if `protocol` is set to `https`).

<hr>

<hr>

## [database]

Grafana needs a database to store users and dashboards (and other
things). By default it is configured to use `sqlite3` which is an
embedded database (included in the main Grafana binary).

### type

Either `mysql`, `postgres` or `sqlite3`, it's your choice.

### path

Only applicable for `sqlite3` database. The file path where the database
will be stored.

### host

Only applicable to MySQL or Postgres. Includes IP or hostname and port.
For example, for MySQL running on the same host as Grafana: `host =
127.0.0.1:3306`

### name

The name of the Grafana database. Leave it set to `grafana` or some
other name.

### user

The database user (not applicable for `sqlite3`).

### password

The database user's password (not applicable for `sqlite3`).

### ssl_mode

For `postgres` only, either `disable`, `require` or `verify-full`.

<hr>

## [security]

### admin_user

The name of the default Grafana admin user (who has full permissions).
Defaults to `admin`.

### admin_password

The password of the default Grafana admin.  Defaults to `admin`.

### login_remember_days

The number of days the keep me logged in / remember me cookie lasts.

### secret_key

Used for signing keep me logged in / remember me cookies.

### disable_gravatar

Set to `true` to disable the use of Gravatar for user profile images.
Default is `false`.

<hr>

## [users]

### allow_sign_up

Set to `false` to prohibit users from being able to sign up / create
user accounts. Defaults to `true`.  The admin user can still create
users from the [Grafana Admin Pages](../reference/admin.md)

### allow_org_create

Set to `false` to prohibit users from creating new organizations.
Defaults to `true`.

### auto_assign_org

Set to `true` to automatically add new users to the main organization
(id 1). When set to `false`, new users will automatically cause a new
organization to be created for that new user.

### auto_assign_org_role

The role new users will be assigned for the main organization (if the
above setting is set to true).  Defaults to `Viewer`, other valid
options are `Admin` and `Editor`.

<hr>

## [auth.anonymous]

### enabled

Set to `true` to enable anonymous access. Defaults to `false`

### org_name

Set the organization name that should be used for anonymous users. If
you change your organization name in the Grafana UI this setting needs
to be updated to match the new name.

### org_role

Specify role for anonymous users. Defaults to `Viewer`, other valid
options are `Editor` and `Admin`.

## [auth.github]

You need to create a GitHub application (you find this under the GitHub
profile page). When you create the application you will need to specify
a callback URL. Specify this as callback:

    http://<my_grafana_server_name_or_ip>:<grafana_server_port>/login/github

This callback URL must match the full HTTP address that you use in your
browser to access Grafana, but with the prefix path of `/login/github`.
When the GitHub application is created you will get a Client ID and a
Client Secret. Specify these in the Grafana configuration file. For
example:

    [auth.github]
    enabled = true
    client_id = YOUR_GITHUB_APP_CLIENT_ID
    client_secret = YOUR_GITHUB_APP_CLIENT_SECRET
    scopes = user:email
    auth_url = https://github.com/login/oauth/authorize
    token_url = https://github.com/login/oauth/access_token
    allow_sign_up = false
    team_ids =

Restart the Grafana back-end. You should now see a GitHub login button
on the login page. You can now login or sign up with your GitHub
accounts.

You may allow users to sign-up via GitHub authentication by setting the
`allow_sign_up` option to `true`. When this option is set to `true`, any
user successfully authenticating via GitHub authentication will be
automatically signed up.

### team_ids

Require an active team membership for at least one of the given teams on
GitHub.  If the authenticated user isn't a member of at least one the
teams they will not be able to register or authenticate with your
Grafana instance. For example:

    [auth.github]
    enabled = true
    client_id = YOUR_GITHUB_APP_CLIENT_ID
    client_secret = YOUR_GITHUB_APP_CLIENT_SECRET
    scopes = user:email
    team_ids = 150,300
    auth_url = https://github.com/login/oauth/authorize
    token_url = https://github.com/login/oauth/access_token
    allow_sign_up = false

<hr>

## [auth.google]

You need to create a Google project. You can do this in the [Google
Developer Console](https://console.developers.google.com/project).  When
you create the project you will need to specify a callback URL. Specify
this as callback:

    http://<my_grafana_server_name_or_ip>:<grafana_server_port>/login/google

This callback URL must match the full HTTP address that you use in your
browser to access Grafana, but with the prefix path of `/login/google`.
When the Google project is created you will get a Client ID and a Client
Secret. Specify these in the Grafana configuration file. For example:

    [auth.google]
    enabled = true
    client_id = YOUR_GOOGLE_APP_CLIENT_ID
    client_secret = YOUR_GOOGLE_APP_CLIENT_SECRET
    scopes = https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email
    auth_url = https://accounts.google.com/o/oauth2/auth
    token_url = https://accounts.google.com/o/oauth2/token
    allowed_domains = mycompany.com mycompany.org
    allow_sign_up = false

Restart the Grafana back-end. You should now see a Google login button
on the login page. You can now login or sign up with your Google
accounts. The `allowed_domains` option is optional, and domains were separated by space.

You may allow users to sign-up via Google authentication by setting the
`allow_sign_up` option to `true`. When this option is set to `true`, any
user successfully authenticating via Google authentication will be
automatically signed up.

<hr>

## [auth.basic]
### enable
When enable is `true` (default) the http api will accept basic authentication.

<hr>

## [auth.ldap]
### enable
Set to `true` to enable ldap integration (default: `false`)

### config_file
Path to the ldap specific configuration file (default: `/etc/grafana/ldap.toml`)

> For detail on LDAP Configuration, go to the [Ldap Integration](ldap.md) page.

<hr>

## [session]

### provider

Valid values are `memory`, `file`, `mysql`, `postgres`. Default is `file`.

### provider_config

This option should be configured differently depending on what type of
session provider you have configured.

- **file:** session file path, e.g. `data/sessions`
- **mysql:** go-sql-driver/mysql dsn config string, e.g. `user:password@tcp(127.0.0.1:3306)/database_name`
- **postgres:** ex:  user=a password=b host=localhost port=5432 dbname=c sslmode=disable

If you use MySQL or Postgres as the session store you need to create the
session table manually.

Mysql Example:

    CREATE TABLE `session` (
        `key`       CHAR(16) NOT NULL,
        `data`      BLOB,
        `expiry`    INT(11) UNSIGNED NOT NULL,
        PRIMARY KEY (`key`)
    ) ENGINE=MyISAM DEFAULT CHARSET=utf8;

### cookie_name

The name of the Grafana session cookie.

### cookie_secure

Set to true if you host Grafana behind HTTPs only. Defaults to `false`.

### session_life_time

How long sessions lasts in seconds. Defaults to `86400` (24 hours).

<hr>

## [alerting]

### enabled
`true` or `false`. Is disabled by default.

### handler
`amqp` to use the configured amqp queue, which lets you choose whether to run a scheduler and how many executors in this process (see below).
Setting to `builtin` does everything in process and requires the scheduler to be enabled and at least using at least one executor.
Defaults to `builtin`.

### tickqueue_size

If more than the given number of dispatch timestamps (ticks) queue up, than the database is really unreasonably slow
and grafana will skip the tick, resulting in lost job executions for that second.
so set this to whatever value you find tolerable, and watch your database query times.
Defaults to 20

### internal_jobqueue_size

this should be set to above the max amount of jobs you expect to ever be created in 1 shot
so we can queue them all at once and then workers can process them.
If more than this amount of jobs queue up, it means the workers can't process fast enough,
and the jobs will be skipped. Defaults to 1000.

### pre_amqp_jobqueue_size

There's two things to keep in mind for this setting:
* this should be set to above the max amount of jobs you expect to ever be created in 1 shot
  so we can queue them all at once and then they can be loaded into your queue.
  If more than this amount of jobs queue up, it means they aren't loaded into rabbitmq fast enough
  and the jobs will be skipped.
* you might want to take into account slowness or transient unavailability of your queue, and configure
  this to cover a certain timeframe worth of new jobs created. The other side of the coin is that you
  probably prefer your messages in your queue rather than the less safe in memory buffer.

Defaults to 1000.

### executor_lru_size

All executors within a grafana instance share an LRU cache.
Based on how many schedulers you have and whether they recently restarted,
jobs might be scheduled multiple times and the executors use the cache to avoid acting on the same job twice.
Defaults to 10000.

### EnableScheduler

Wether to run a scheduler. Defaults to true.

### executors

How many alerting executors should this instance of Grafana run?
They have low cpu and memory overhead but may query your datastore simultaneously.  Defaults to 10.

### write_individual_alert_results

Whether to write the individual state metrics for each alerting rule. Defaults to false

### inspect
`true` or `false`. Is disabled by default.
`true` will cause job executors to evaluate and debug log the results of the jobs, instead of actually treating
them as a real job (saving the results, sending notifications, instrumenting, etc)


<hr>

## [analytics]

### reporting_enabled

When enabled Grafana will send anonymous usage statistics to `stats.grafana.org`.
No IP addresses are being tracked, only simple counters to track running instances,
versions, dashboard & error counts. It is very helpful to us, please leave this
enabled. Counters are sent every 24 hours. Default value is `true`.

### google_analytics_ua_id

If you want to track Grafana usage via Google analytics specify *your* Universal Analytics ID
here. By default this feature is disabled.

<hr>

## [dashboards.json]

If you have a system that automatically builds dashboards as json files you can enable this feature to have the
Grafana backend index those json dashboards which will make them appear in regular dashboard search.

### enabled
`true` or `false`. Is disabled by default.

### path
The full path to a directory containing your json dashboards.
