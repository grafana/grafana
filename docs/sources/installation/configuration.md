---
page_title: Configuration
page_description: Configuration guide for Grafana.
page_keywords: grafana, configuration, documentation
---

# Configuration

The Grafana backend has a number of configuration options that can be specified in a `.ini` config file
or specified using `ENV` variables.

## Config file locations

- Default configuration from `$WORKING_DIR/conf/defaults.ini`
- Custom configuration from `$WORKING_DIR/conf/custom.ini`
- The custom config file path can be overriden using the `--config` parameter

> **Note.** If you have installed grafana using the `deb` or `rpm` packages, then your configuration file is located
> at `/etc/grafana/grafana.ini`. This path is specified in the grafana init.d script using `--config` file
> parameter.

## Using ENV variables
All options in the config file (listed below) can be overriden using ENV variables using the syntax:

    GF_<SectionName>_<KeyName>

Where the section name is the text within the brackets. Everything should be upper case.

Example, given this config setting:

    [security]
    admin_user = admin

Then you can override that using:

    export GF_SECURITY_ADMIN_USER=true

<hr>
## [server]

### http_addr
The ip address to bind to, if empty will bind to all interfaces

### http_port
The port to bind to, defaults to `3000`

### domain
This setting is only used in as a part of the root_url setting (see below). Important if you
use github or google oauth.

### root_url
This is the full url used to access grafana from a web browser. This is important if you use
google or github oauth authentication (for the callback url to be correct).

> **Note** This setting is also important if you have a reverse proxy infront of Grafana
> that exposes grafana through a subpath. In that case add the subpath to the end of this url setting.

### static_root_path
The path to the directory where the frontend files (html & js & css). Default to `public` which is
why the Grafana binary needs to be executed with working directory set to the installation path.

<hr>

<hr>
## [database]

Grafana needs a database to store users and dashboards (and other things). By default it is configured to
use `sqlite3` which is an embedded database (included in the main Grafana binary).

### type
Either `mysql`, `postgres` or `sqlite3`, it's your choice.

### path
Only applicable for `sqlite3` database. The file path where the database will be stored.

### host
Only applicable to mysql or postgres. Include ip/hostname & port.
Example for mysql same host as Grafana: `host = 127.0.0.1:3306`

### name
The name of the grafana database. Leave it set to `grafana` or some other name.

### user
The database user (not applicable for `sqlite3`).

### password
The database user's password (not applicable for `sqlite3`).

### ssl_mode
For `postgres` only, either "disable", "require" or "verify-full".

<hr>
## [security]

### admin_user
The name of the default grafana admin user (who has full permissions). Defaults to `admin`.

### admin_password
The password of the default grafana admin.  Defaults to `admin`.

### login_remember_days
The number of days the keep me logged in / remember me cookie lasts.

### secret_key
Used for signing keep me logged in / remember me cookies.

<hr>
## [user]

### allow_sign_up
Set to `false` to prohibit users from being able to sign up / create user accounts. Defaults to `true`.
The admin can still create users from the [Grafana Admin Pages](../reference/admin.md)

### allow_org_create
Set to `false` to prohibit users from creating new organizations. Defaults to `true`.

### auto_assign_org
Set to `true` to automatically add new users to the main organization (id 1). When set to `false`,
new users will automatically cause a new organization to be created for that new user.

### auto_assign_org_role
The role new users will be assigned for the main organization (if the above setting is set to true).
Defaults to `Viewer`, other valid options are `Admin` and `Editor`.

<hr>
## [auth.anonymous]

### enabled
Set to `true` to enable anonymous access. Defaults to `false`
### org_name
Set the organization name that should be used for anonymous users. If you change your organization name
in the Grafana UI this setting needs to be updated to match the new name.
### org_role
Specify role for anonymous users. Defaults to `Viewer`, other valid options are `Editor` and `Admin`.


## [auth.github]
You need to create a github application (you find this under the github profile page). When
you create the application you will need to specify a callback URL. Specify this as callback:

    http://<my_grafana_server_name_or_ip>:<grafana_server_port>/login/github

This callback url must match the full http address that you use in your browser to access grafana, but
with the prefix path of `/login/github`. When the github application is created you will get a
Client ID and a Client Secret. Specify these in the grafana config file. Example:

    [auth.github]
    enabled = true
    client_id = YOUR_GITHUB_APP_CLIENT_ID
    client_secret = YOUR_GITHUB_APP_CLIENT_SECRET
    scopes = user:email
    auth_url = https://github.com/login/oauth/authorize
    token_url = https://github.com/login/oauth/access_token

Restart the grafana backend. You should now see a github login button on the login page. You can
now login or signup with your github accounts.

## [auth.google]
You need to create a google project. You can do this in the [Google Developer Console](https://console.developers.google.com/project).
When you create the project you will need to specify a callback URL. Specify this as callback:

    http://<my_grafana_server_name_or_ip>:<grafana_server_port>/login/google

This callback url must match the full http address that you use in your browser to access grafana, but
with the prefix path of `/login/google`. When the google project is created you will get a
Client ID and a Client Secret. Specify these in the grafana config file. Example:

    [auth.google]
    enabled = true
    client_id = YOUR_GOOGLE_APP_CLIENT_ID
    client_secret = YOUR_GOOGLE_APP_CLIENT_SECRET
    scopes = https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email
    auth_url = https://accounts.google.com/o/oauth2/auth
    token_url = https://accounts.google.com/o/oauth2/token

Restart the grafana backend. You should now see a google login button on the login page. You can
now login or signup with your google accounts.

<hr>
## [session]

### provider
Valid values are "memory", "file", "mysql", 'postgres'. Default is "memory".

### provider_config
This option should be configured differently depending on what type of session provider you have configured.

- **file:** session file path, e.g. `data/sessions`
- **mysql:** go-sql-driver/mysql dsn config string, e.g. `user:password@tcp(127.0.0.1)/database_name`

if you use mysql or postgres as session store you need to create the session table manually.
Mysql Example:

    CREATE TABLE `session` (
        `key`       CHAR(16) NOT NULL,
        `data`      BLOB,
        `expiry`    INT(11) UNSIGNED NOT NULL,
        PRIMARY KEY (`key`)
    ) ENGINE=MyISAM DEFAULT CHARSET=utf8;

### cookie_name
The name of the grafana session cookie

### cookie_secure
Set to true if you host Grafana behind HTTPs only. Defaults to `false`.

### session_life_time
How long sessions lasts in seconds. Defaults to `86400` (24 hours).

## [analytics]

### reporting-enabled
When enabled Grafana will send anonymous usage statistics to stats.grafana.org.
No ip addresses are being tracked, only simple counters to track running instances,
versions, dashboard & error counts. It is very helpful to us, please leave this
enabled. Counters are sent every 24 hours.

### google_analytics_ua_id
If you want to track Grafana usage via Google analytics specify *your* Univeral Analytics ID
here. By defualt this feature is disabled.


