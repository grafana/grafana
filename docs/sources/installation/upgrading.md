+++
title = "Upgrade Grafana"
description = "Guide for upgrading Grafana"
keywords = ["grafana", "configuration", "documentation", "upgrade"]
type = "docs"
[menu.docs]
name = "Upgrade Grafana"
identifier = "upgrading"
parent = "installation"
weight = 800
+++

# Upgrade Grafana

We recommend that you upgrade Grafana often to stay up to date with the latest fixes and enhancements.
In order to make this a reality, Grafana upgrades are backward compatible and the upgrade process is simple and quick.

Upgrading is generally safe (between many minor and one major version) and dashboards and graphs will look the same. There may be minor breaking changes in some edge cases, which are outlined in the [Release Notes](https://community.grafana.com/c/releases) and [Changelog](https://github.com/grafana/grafana/blob/master/CHANGELOG.md)

## Update plugins

After you have upgraded it is highly recommended that you update all your plugins as a new version of Grafana
can make older plugins stop working properly.

You can update all plugins using

```bash
grafana-cli plugins update-all
```

## Database backup

Before upgrading it can be a good idea to backup your Grafana database. This will ensure that you can always rollback to your previous version. During startup, Grafana will automatically migrate the database schema (if there are changes or new tables). Sometimes this can cause issues if you later want to downgrade.

#### sqlite

If you use sqlite you only need to make a backup of your `grafana.db` file. This is usually located at `/var/lib/grafana/grafana.db` on Unix systems.
If you are unsure what database you use and where it is stored check you grafana configuration file. If you
installed grafana to custom location using a binary tar/zip it is usually in `<grafana_install_dir>/data`.

#### mysql

```bash
backup:
> mysqldump -u root -p[root_password] [grafana] > grafana_backup.sql

restore:
> mysql -u root -p grafana < grafana_backup.sql
```

#### postgres

```bash
backup:
> pg_dump grafana > grafana_backup

restore:
> psql grafana < grafana_backup
```

### Ubuntu or Debian

You can upgrade Grafana by following the same procedure as when you installed it.

#### Upgrade Debian package

If you installed Grafana by downloading a Debian package (`.deb`), then you can execute the same `dpkg -i` command but with the new package. It will upgrade your Grafana installation.

Go to the [download page](https://grafana.com/grafana/download?platform=linux) for the latest download
links.

```bash
wget <debian package url>
sudo apt-get install -y adduser libfontconfig1
sudo dpkg -i grafana_<version>_amd64.deb
```

#### Upgrade from APT repository

If you installed Grafana from our APT repository, then Grafana will automatically update when you run apt-get upgrade to upgrade all system packages.

```bash
sudo apt-get update
sudo apt-get upgrade
```

#### Upgrade from binary .tar file

If you downloaded the binary `.tar.gz` package, then you can just download and extract the new package and overwrite all your existing files. However, this might overwrite your config changes.

We recommend that you save your custom config changes in a file named `<grafana_install_dir>/conf/custom.ini`.
This allows you to upgrade Grafana without risking losing your configuration changes.

### Centos / RHEL

If you installed Grafana by downloading an RPM package you can just follow the same installation guide and execute the same `yum install` or `rpm -i` command but with the new package. It will upgrade your Grafana installation.

If you used our YUM repository:

```bash
sudo yum update grafana
```

### Docker

This just an example, details depend on how you configured your grafana container.

```bash
docker pull grafana/grafana
docker stop my-grafana-container
docker rm my-grafana-container
docker run -d --name=my-grafana-container --restart=always -v /var/lib/grafana:/var/lib/grafana grafana/grafana
```

### Windows

If you downloaded the Windows binary package you can just download a newer package and extract to the same location (and overwrite the existing files). This might overwrite your config changes. We recommend that you save your config changes in a file named `<grafana_install_dir>/conf/custom.ini` as this will make upgrades easier without risking losing your config changes.

## Upgrading from 1.x

[Migrating from 1.x to 2.x]({{< relref "migrating_to2.md" >}})

## Upgrading from 2.x

We are not aware of any issues upgrading directly from 2.x to 4.x but to be on the safe side go via 3.x => 4.x.

## Upgrading to v5.0

The dashboard grid layout engine has changed. All dashboards will be automatically upgraded to new positioning system when you load them in v5. Dashboards saved in v5 will not work in older versions of Grafana. Some external panel plugins might need to be updated to work properly.

For more details on the new panel positioning system, [click here]({{< relref "../reference/dashboard.md#panel-size-position" >}})

## Upgrading to v5.2

One of the database migrations included in this release will update all annotation timestamps from second to millisecond precision. If you have a large amount of annotations the database migration may take a long time to complete which may cause problems if you use systemd to run Grafana.

We've got one report where using systemd, PostgreSQL and a large amount of annotations (table size 1645mb) took 8-20 minutes for the database migration to complete. However, the grafana-server process was killed after 90 seconds by systemd. Any database migration queries in progress when systemd kills the grafana-server process continues to execute in database until finished.

If you're using systemd and have a large amount of annotations consider temporary adjusting the systemd `TimeoutStartSec` setting to something high like `30m` before upgrading.

## Upgrading to v6.0

If you have text panels with script tags they will no longer work due to a new setting that per default disallow unsanitized HTML.
Read more [here]({{< relref "configuration/#disable-sanitize-html" >}}) about this new setting.

### Authentication and security

If your using Grafana's builtin, LDAP (without Auth Proxy) or OAuth authentication all users will be required to login upon the next visit after the upgrade.

If you have `cookie_secure` set to `true` in the `session` section you probably want to change the `cookie_secure` to `true` in the `security` section as well. Ending up with a configuration like this:

```ini
[session]
cookie_secure = true

[security]
cookie_secure = true
```

The `login_remember_days`, `cookie_username` and `cookie_remember_name` settings in the `security` section are no longer being used so they're safe to remove.

If you have `login_remember_days` configured to 0 (zero) you should change your configuration to this to accomplish similar behavior, i.e. a logged in user will maximum be logged in for 1 day until being forced to login again:

```ini
[auth]
login_maximum_inactive_lifetime_days = 1
login_maximum_lifetime_days = 1
```

The default cookie name for storing the auth token is `grafana_session`. you can configure this with `login_cookie_name` in `[auth]` settings.

## Upgrading to v6.2

### Ensure encryption of data source secrets

Data sources store passwords and basic auth passwords in secureJsonData encrypted (AES-256 in CFB mode) by default. Existing data source
will keep working with unencrypted passwords. If you want to migrate to encrypted storage for your existing data sources
you can do that by:

- For data sources created through UI, you need to go to data source config, re enter the password or basic auth
password and save the data source.
- For data sources created by provisioning, you need to update your config file and use secureJsonData.password or
secureJsonData.basicAuthPassword field. See [provisioning docs]({{< relref "../administration/provisioning" >}}) for example of current
configuration.

### Embedding Grafana

If you're embedding Grafana in a `<frame>`, `<iframe>`, `<embed>` or `<object>` on a different website it will no longer work due to a new setting
that per default instructs the browser to not allow Grafana to be embedded. Read more [here]({{< relref "configuration/#allow-embedding" >}}) about
this new setting.

### Session storage is no longer used

In 6.2 we completely removed the backend session storage since we replaced the previous login session implementation with an auth token.
If you are using Auth proxy with LDAP an shared cached is used in Grafana so you might want configure [remote_cache] instead. If not
Grafana will fallback to using the database as an shared cache.

### Upgrading Elasticsearch to v7.0+

The semantics of `max concurrent shard requests` changed in Elasticsearch v7.0, see [release notes](https://www.elastic.co/guide/en/elasticsearch/reference/7.0/breaking-changes-7.0.html#semantics-changed-max-concurrent-shared-requests) for reference.

If you upgrade Elasticsearch to v7.0+ you should make sure to update the data source configuration in Grafana so that version
is `7.0+` and `max concurrent shard requests` properly configured. 256 was the default in pre v7.0 versions. In v7.0 and above 5 is the default.

## Upgrading to v6.4

### Annotations database migration

One of the database migrations included in this release will merge multiple rows used to represent an annotation range into a single row. If you have a large number of region annotations the database migration may take a long time to complete. See [Upgrading to v5.2](#upgrading-to-v5-2) for tips on how to manage this process.

### Docker

Grafana’s docker image is now based on [Alpine](http://alpinelinux.org) instead of [Ubuntu](https://ubuntu.com/).

### Plugins that need updating

- [Splunk](https://grafana.com/grafana/plugins/grafana-splunk-datasource)

## Upgrading to v6.5

Pre Grafana 6.5.0, the CloudWatch datasource used the GetMetricStatistics API for all queries that did not have an ´id´ and did not have an ´expression´ defined in the query editor. The GetMetricStatistics API has a limit of 400 transactions per second (TPS). In this release, all queries use the GetMetricData API which has a limit of 50 TPS and 100 metrics per transaction. We expect this transition to be smooth for most of our users, but in case you do face throttling issues we suggest you increase the TPS quota. To do that, please visit the [AWS Service Quotas console](https://console.aws.amazon.com/servicequotas/home?r#!/services/monitoring/quotas/L-5E141212). For more details around CloudWatch API limits, [see CloudWatch docs](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch_limits.html).

Each request to the GetMetricData API can include 100 queries. This means that each panel in Grafana will only issue one GetMetricData request, regardless of the number of query rows that are present in the panel. Consequently as it is no longer possible to set `HighRes` on a per query level anymore, this switch is now removed from the query editor. High resolution can still be achieved by choosing a smaller minimum period in the query editor.

The handling of multi-valued template variables in dimension values has been changed in Grafana 6.5. When a multi template variable is being used, Grafana will generate a search expression. In the GetMetricData API, expressions are limited to 1024 characters, so it might be the case that this limit is reached when a multi-valued template variable that has a lot of values is being used. If this is the case, we suggest you start using `*` wildcard as dimension value instead of a multi-valued template variable.

## Upgrading to v6.6

The Generic OAuth setting `send_client_credentials_via_post`, used for supporting non-compliant providers, has been removed. From now on, Grafana will automatically detect if credentials should be sent as part of the URL or request body for a specific provider. The result will be remembered and used for additional OAuth requests for that provider.

### Important changes regarding SameSite cookie attribute

Chrome 80 treats cookies as `SameSite=Lax` by default if no `SameSite` attribute is specified, see https://www.chromestatus.com/feature/5088147346030592.

Due to this change in Chrome, the `[security]` setting `cookie_samesite` configured to `none` now renders cookies with `SameSite=None` attribute compared to before where no `SameSite` attribute was added to cookies. To get the old behavior, use value `disabled` instead of `none`, see [cookie_samesite in Configuration]({{< relref "configuration/#cookie-samesite" >}}) for more information.

**Note:** There is currently a bug affecting Mac OSX and iOS that causes `SameSite=None` cookies to be treated as `SameSite=Strict` and therefore not sent with cross-site requests, see https://bugs.webkit.org/show_bug.cgi?id=198181 for details. Until this is fixed, `SameSite=None` might not work properly on Safari.

This version of Chrome also rejects insecure `SameSite=None` cookies. See https://www.chromestatus.com/feature/5633521622188032 for more information. Make sure that you
change the `[security]` setting `cookie_secure` to `true` and use HTTPS when `cookie_samesite` is configured to `none`, otherwise authentication in Grafana won't work properly.

## Upgrading to v7.0

### PhantomJS removed

PhantomJS was deprecated in [Grafana v6.4](https://grafana.com/docs/grafana/latest/guides/whats-new-in-v6-4/#phantomjs-deprecation) and starting from Grafana v7.0.0, all PhantomJS support has been removed. This means that Grafana no longer ships with a built-in image renderer, and we adwise you to install the [Grafana Image Renderer plugin](https://grafana.com/grafana/plugins/grafana-image-renderer).

### Dashboard minimum refresh interval enforced

A global minimum dashboard refresh interval is now enforced and defaults to 5 seconds. Read more [here]({{< relref "configuration/#min-refresh-interval" >}}) about this setting.
