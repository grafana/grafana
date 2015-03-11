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

## Security

### admin_user
The name of the default grafana admin user (who has full permissions). Defaults to `admin`.

### admin_password
The password of the default grafana admin.  Defaults to `admin`.

### disable_user_signup
Set to `false` to prohibit users from creating user accounts. Defaults to `false`.

### login_remember_days
The number of days the keep me logged in / remember me cookie lasts.

### secret_key
Used for signing keep me logged in / remember me cookies.

## [session]

### provider
Valid values are "memory", "file", "mysql", 'postgres'. Default is "memory".

### provider_config
This option should be configured differently depending on what type of session provider you have configured.

- **file:** session file path, e.g. `data/sessions`
- **mysql:** go-sql-driver/mysql dsn config string, e.g. `root:password@/session_table`

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


