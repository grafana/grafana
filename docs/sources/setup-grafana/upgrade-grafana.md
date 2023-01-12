---
aliases:
  - ../installation/upgrading/
description: Guide for upgrading Grafana
keywords:
  - grafana
  - configuration
  - documentation
  - upgrade
title: Upgrade Grafana
weight: 500
---

# Upgrade Grafana

We recommend that you upgrade Grafana often to stay up to date with the latest fixes and enhancements.
In order to make this a reality, Grafana upgrades are backward compatible and the upgrade process is simple and quick.

Upgrading between many minor versions and one major version is generally safe, and dashboards and graphs will look the same.
There might be minor breaking changes in some releases.
We outline these in the [What's New overviews]({{< relref "../whatsnew/" >}}) for each release.
For versions of Grafana prior to v9.2, we also published additional information in the [Release Notes]({{< relref "../release-notes/" >}}).
We also list all changes, with links to pull requests or issues when available, in the [Changelog](https://github.com/grafana/grafana/blob/main/CHANGELOG.md).

## Backup

We recommend that you backup a few things in case you have to rollback the upgrade.

- Installed plugins - Back them up before you upgrade them in case you want to rollback the Grafana version and want to get the exact same versions you were running before the upgrade.
- Configuration files do not need to be backed up. However, you might want to in case you add new configuration options after upgrade and then rollback.

### Database backup

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
sudo apt-get install -y adduser
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

We recommend that you save your custom configuration changes in a file named `<grafana_install_dir>/conf/custom.ini`.
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

If you downloaded the Windows binary package you can just download a newer package and extract to the same location (and overwrite the existing files). This might overwrite your configuration changes. We recommend that you save your configuration changes in a file named `<grafana_install_dir>/conf/custom.ini` as this will make upgrades easier without risking losing your configuration changes.

## Update plugins

After you have upgraded, we strongly recommend that you update all your plugins as a new version of Grafana
can make older plugins stop working properly.

You can update all plugins using

```bash
grafana-cli plugins update-all
```

## Upgrading to v9.2

Beginning in v9.2, Grafana has a [supported database versions policy]({{< relref "./installation/#supported-databases" >}}). As of this release, MySQL versions from 5.7, postgres versions from v10, and SQLite 3 are supported databases.

## Upgrading to 9.0

### Role-based access control: changes for general release

Fine-grained access control is now called "Role-based access control (RBAC)". As part of the Grafana 9.0 release, the feature is generally available, and there are several breaking changes:

- Built-in roles are now called basic roles. They now consist of permissions, not roles.
- The Terraform `builtin_role_assignment` resource is deprecated. Please use [grafana_role](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/role) resource instead.
- Grafana provisioning has a new schema. Please refer to [Provisioning RBAC with Grafana](https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/access-control/rbac-grafana-provisioning/) to learn more about provisioning.
- Basic roles no longer support permission inheritance. Previously, when permissions of a Viewer basic role were modified, it was propagated to the Editor and Admin basic roles. With the Grafana 9.0 release, this is not the case anymore.
- Several role-based access control actions have been renamed. All database entries that use legacy action names will be migrated to use the new names, but provisioning files and scripts will have to be updated by the user. This change also means that if Grafana is downgraded from 9.0 to a lower version, some role-based access control permissions will not be resolved correctly.

### Loki: logs data format changed

In the Loki data source, the data format used to represent Loki logs-data has been changed to a more efficient format. (NOTE: this change applies to logs data only, it does not apply to numeric data)
The logs are represented by a single dataframe with a "labels" field added, instead of separate dataframes for every label combination. Displaying logs data in explore, or in a dashboard using the logs panel will continue to work without changes. But, when displaying logs data in other dashboard panels, for example in a table visualization, changes will be visible, and configurations might need to be adjusted. For example, if the "Labels to fields" transformation was used, it has to be replaced with an “Extract fields” transformation, where the “labels” field is chosen as the source.

### Loki: NaN values representation changed in numeric data

In the Loki data source, when grafana receives numeric data from Loki, it may contain NaN (not a number) values. For consistency and performance reasons we changed how we represent such values in Grafana. In previous versions, the behavior was different between alerting queries and other queries (like dashboard queries or explore queries). Alerting queries kept NaN values unchanged, but other queries converted these values to “null”. Starting with grafana 9.0.0, we will always keep these values unchanged. In other words, queries in dashboards and explore will behave the same as alerting queries in this regard.

### Elasticsearch: Support for versions after their end of life was removed

Support for Elasticsearch versions that are after their end of life ( based on https://www.elastic.co/support/eol ) was removed. This means that versions older than Elasticsearch 7.10.0 will not be supported in Grafana 9.0.0.

### Elasticsearch: Support for browser access mode removed

In the Elasticsearch data source, browser access mode was deprecated in grafana 7.4.0 and removed in 9.0.0. If you used this mode, please switch to server access mode on the data source configuration page.

### Prometheus: NaN values representation changed in numeric data

In the Prometheus data source, when grafana receives numeric data from Prometheus, it may contain NaN (not a number) values. For consistency and performance reasons we changed how we represent such values in Grafana. In previous versions, the behavior was different between alerting queries and other queries (like dashboard queries or explore queries). Alerting queries kept NaN values unchanged, but other queries converted these values to “null”. Starting with grafana 9.0.0, we will always keep NaN values unchanged for all queries.

<!-- ### InfluxDB: Support for browser access mode removed (should this stay??)

In the InfluxDB data source, browser access mode was deprecated in grafana 8.0.0 and we are removing this feature in 9.0.0. If you are using this mode, you need to [switch to server access mode]({{< relref "../datasources/influxdb/##influxql-classic-influxdb-query" >}}) on the data source configuration page or you can do this via provisioning. -->

### Transformations: Allow more complex regex expressions in rename by regex

The rename by regex transformation has been improved to allow global patterns of the form `/<stringToReplace>/g`. Depending on the regex match used, this may cause some transformations to behave slightly differently. You can guarantee the same behavior as before by wrapping the match string in forward slashes (`/`), for example, `(.*)` would become `/(.*)/`. ([Github Issue #48179](https://github.com/grafana/grafana/pull/48179))

### Clock Panel

We have updated [clock panel](https://grafana.com/grafana/plugins/grafana-clock-panel/) to version `2.0.0` to make it compatible with Grafana 9. The previous version `1.3.1` will cause the Grafana 9 to [crash](https://github.com/grafana/clock-panel/issues/106) when being used in a dashboard, we encourage you to update the panel before migrating to Grafana 9.

### Polystat Panel

We have updated [polystat panel](https://grafana.com/grafana/plugins/grafana-polystat-panel/) to version `1.2.10` to make it compatible with Grafana 9. The previous versions `1.2.8` and below will render empty in Grafana 9. We encourage you to update the panel before or immediately after migrating to Grafana 9.

### Envelope encryption enabled by default

Since v8.3 a new kind of encryption called "envelope encryption" was added, for those secrets stored in the Grafana
database (data source credentials, alerting notification channel credentials, oauth tokens, etc), behind a feature
toggle named `envelopeEncryption`.

In v9.0, `envelopeEncryption` feature toggle has been replaced in favor of `disableEnvelopeEncryption` and envelope encryption is
the encryption mechanism used by default.

Therefore, any secret created or updated in Grafana v9.0 won't be decryptable by any previous Grafana version unless the
feature toggle `envelopeEncryption` is enabled in the previous version (only available since v8.3).
This needs to be considered in high availability setups, progressive rollouts or in case of need to roll back to a previous Grafana version for any reason.

The recommendation here is to enable `envelopeEncryption` for older versions, or alternatively enable `disableEnvelopeEncryption`
before upgrading to v9.0. However, the latter is probably going to be removed in one of the next releases, so we hugely
encourage to move on with envelope encryption.

Find [here]({{< relref "../setup-grafana/configure-security/configure-database-encryption/" >}}) more details and some
possible workarounds in case you end up in an undesired situation.

### A note on Grafana Enterprise licensing

When we release Grafana 9.0 on June 14th, Grafana will no longer enforce viewers and editor-admins differently. That means that regardless of whether your Grafana Enterprise license is tiered or combined, instead of seeing this on the Stats & Licensing page:

{{< figure src="/static/img/docs/enterprise/separate-licenses.png" max-width="500px" caption="Separate license" >}}

You will see this:

{{< figure src="/static/img/docs/enterprise/combined-licenses.png" max-width="500px" caption="Combined license" >}}

It also means that Grafana will count all users the same, regardless of their role, including org roles (Viewer, Editor, Admin) and fine-grained roles (Dashboard Editor, Reports Editor, etc.). You won’t see a separate warning banner or see users locked out if you hit your limit of viewers or editor-admins, only your total combined limit of active users.

For example, if you have a license for 10 active admins and 100 active viewers in your Grafana Enterprise license, then starting in v9.0 you will have a limit of 110 active users, and it doesn’t matter what roles those users have, they will all be counted and enforced the same.

This is a more permissive policy than before.

## Upgrading to 8.5

The concept of a `default` data source existed in Grafana since the beginning. However, the meaning and behavior were not clear. The default data source was not just the starting data source for new panels but it was also saved using a special value (null). This made it possible to change the default data source to another and have that change impact all dashboards that used the default data source.

This behavior was not very intuitive and creates issues for users who want to change the default without it impacting existing dashboards.
That is why we are changing the behavior in 8.5. From now on, the `default` data source will not be a persisted property but just the starting data source for new panels and queries.
Existing dashboards that still have panels with a `datasource` set to null will be migrated when the dashboard opens. The migration will set the data source property to the **current** default data source.

## Upgrading to 8.3

In 8.3, Grafana dashboards now reference data sources using an object with `uid` and `type` properties instead of the data source name property. A schema migration is applied when existing dashboards open. If you provision dashboards to multiple Grafana instances, then we recommend that you also provision data sources. You can specify the `uid` to be the same for data sources across your instances.
If you need to find the `uid` for a data source created in the UI, check the URL of the data source settings page. The URL follows the pattern ` /data source/edit/${uid}`, meaning the last part is the `uid`.

## Upgrading to v8.1

### Use of unencrypted passwords for data sources no longer supported

As of Grafana v8.1, we no longer support unencrypted storage of passwords and basic auth passwords.

> **Note:** Since Grafana v6.2, new or updated data sources store passwords and basic auth passwords encrypted. See [upgrade note]({{< relref "#ensure-encryption-of-data-source-secrets" >}}) for more information. However, unencrypted passwords and basic auth passwords were also allowed.

To migrate to encrypted storage, follow the instructions from the [v6.2 upgrade notes]({{< relref "#ensure-encryption-of-data-source-secrets" >}}). You can also use a `grafana-cli` command to migrate all of your data sources to use encrypted storage of secrets. See [migrate data and encrypt passwords]({{< relref "../cli/#migrate-data-and-encrypt-passwords" >}}) for further instructions.

## Upgrading to v8.0

### Plugins

Grafana now requires all plugins to be signed. If a plugin is not signed Grafana will not load/start it. This is an additional security measure to make sure plugin files and binaries haven't been tampered with. All Grafana Labs authored plugins, including Enterprise plugins, are now signed. It's possible to allow unsigned plugins using a configuration setting, but is something we strongly advise against doing. For more information about this setting, refer to [allow loading unsigned plugins]({{< relref "../administration/#allow_loading_unsigned_plugins" >}}).

### Grafana Live

Grafana now maintains persistent WebSocket connections for real-time messaging needs.

When WebSocket connection is established, Grafana checks the request Origin header due to security reasons (for example, to prevent hijacking of WebSocket connection). If you have a properly defined public URL (`root_url` server option) then the origin check should successfully pass for WebSocket requests originating from public URL pages. In case of an unsuccessful origin check, Grafana returns a 403 error. It's also possible to add a list of additional origin patterns for the origin check.

To handle many concurrent WebSocket connections you may need to tune your OS settings or infrastructure. Grafana Live is enabled by default and supports 100 concurrent WebSocket connections max to avoid possible problems with the file descriptor OS limit. As soon as your setup meets the requirements to scale the number of persistent connections this limit can be increased. You also have an option to disable Grafana Live.

Refer to [Grafana Live configuration]({{< relref "set-up-grafana-live/" >}}) documentation for more information.

### Postgres, MySQL, Microsoft SQL Server data sources

Grafana v8.0 changes the underlying data structure to [data frames]({{< relref "../developers/plugins/data-frames/" >}}) for the Postgres, MySQL, Microsoft SQL Server data sources. As a result, a _Time series_ query result gets returned in a [wide format]({{< relref "../developers/plugins/data-frames/#wide-format" >}}). To make the visualizations work as they did before, you might have to do some manual migrations.

For any existing panels/visualizations using a _Time series_ query, where the time column is only needed for filtering the time range, for example, using the bar gauge or pie chart panel, we recommend that you use a _Table query_ instead and exclude the time column as a field in the response.
Refer to this [issue comment](https://github.com/grafana/grafana/issues/35534#issuecomment-861519658) for detailed instructions and workarounds.

#### Prefix added to series names

When you have a query where there's a time value and a numeric value selected together with a string value that's not named _metric_, the graph panel renders series names as `value <hostname>` rather than just `<hostname>` which was the case before Grafana 8.

```sql
SELECT
  $__timeGroup("createdAt",'10m'),
  avg(value) as "value",
  hostname
FROM grafana_metric
WHERE $__timeFilter("createdAt")
GROUP BY time, hostname
ORDER BY time
```

There are two possible workarounds to resolve this problem:

1. In Grafana v8.0.3, use an alias of the string column selected as `metric`. for example, `hostname as metric`.
2. Use the [Standard field definitions' display name]({{< relref "../panels-visualizations/configure-standard-options/#display-name" >}}) to format the alias. For the preceding example query, you would use `${__field.labels.hostname}` option.

For more information, refer to the our relational databases documentation of [Postgres]({{< relref "../datasources/postgres/#time-series-queries" >}}), [MySQL]({{< relref "../datasources/mysql/#time-series-queries" >}}), [Microsoft SQL Server]({{< relref "../datasources/mssql/#time-series-queries" >}}).
