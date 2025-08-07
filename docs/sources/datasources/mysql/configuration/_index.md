---
description: This document provides instructions for configuring the MySQL data source and explains available configuration options.
keywords:
  - grafana
  - mysql
  - guide
  - configure
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure the MySQL data source
title: Configure the MySQL data source
weight: 10
refs:
  add-template-variables-interval:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#__interval
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/add-template-variables/#__interval
  add-template-variables-interval-ms:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#__interval_ms
    - pattern: /docs/grafana-cloud/
      destination: docs/grafana-cloud/visualizations/dashboards/variables/add-template-variables/#__interval_ms
  provisioning-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
  data-source-management:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
---

# Configure the MySQL data source

This document provides instructions for configuring the MySQL data source and explains available configuration options. For general information on managing data sources refer to [Data source management](ref:data-source-management).

## Before you begin

You must have the `Organization administrator` role in order to configure the MySQL data source.
Administrators can also [configure the data source via YAML](#provision-the-data-source) with Grafana's provisioning system.

{{< admonition type="note" >}}
Grafana ships with the MySQL data source by default, so no additional installation is required.
{{< /admonition >}}

{{< admonition type="caution" >}}
When adding a data source, ensure the database user you specify has only `SELECT` permissions on the relevant database and tables. Grafana does not validate the safety of queries, which means they can include potentially harmful SQL statements, such as `USE otherdb;` or `DROP TABLE user;`, which could get executed.

To minimize this risk, Grafana strongly recommends creating a dedicated MySQL user with restricted permissions.
{{< /admonition >}}

Example:

```sql
 CREATE USER 'grafanaReader' IDENTIFIED BY 'password';
 GRANT SELECT ON mydatabase.mytable TO 'grafanaReader';
```

Use wildcards (`*`) in place of a database or table if you want to grant access to more databases and tables.

## Add the MySQL data source

To add the MySQL data source complete the following steps:

1. Click **Connections** in the left-side menu.
1. Click **Add new connection** and type `MySQL` in the search bar.
1. Select the **MySQL data source** option.
1. Click **Add new data source** in the upper right.

You are taken to the **Settings** tab where you will configure the data source.

## MySQL configuration options

Following is a list of MySQL configuration options:

- **Name** - Sets the name you use to refer to the data source in panels and queries. Examples:
  `mysql-assets-1`, `mysqldb1`.
- **Default** - Toggle to make this specific MySQL data source the default pre-selected data source in panels and visualizations.

**Connection:**

- **Host URL** - Enter the IP address/hostname and optional port of your MySQL instance. If the port is omitted the default `3306` port will be used.
- **Database** - Enter the name of your MySQL database.

**Authentication:**

- **Username**- Enter the username used to connect to your MySQL database.
- **Password** - Enter the password used to connect to the MySQL database.
- **Use TLS Client Auth** - Toggle to enable TLS authentication using the client certificate specified in the secure JSON configuration. Refer to [Using TLS Connections](https://dev.mysql.com/doc/refman/8.4/en/mysql-cluster-tls-using.html) and [Configuring MySQL to Use Encrypted Connections](https://dev.mysql.com/doc/refman/8.4/en/using-encrypted-connections.html) for more information regarding TLS and configuring encrypted connections in MySQL. Provide the client certificate under **TLS/SSL Client Certificate**. Provide the key under **TLS/SSL Client Key**.
- **With CA Cert** - Toggle to authenticate using a CA certificate. Required for verifying self-signed TLS Certs. Follow the instructions of your CA (Certificate Authority) to download the certificate file. Provide the root certificate under **TLS/SSL Root Certificate** if TLS/SSL mode requires it.
- **Skip TLS Verification** - Toggle to skip verification of the MySQL server's TLS certificate chain and host name.
- **Allow Cleartext Passwords** - Toggle to allow the use of the [cleartext client-side plugin](https://dev.mysql.com/doc/en/cleartext-pluggable-authentication.html) when required by a specific type of account, such as one defined with the [PAM authentication plugin](https://dev.mysql.com/doc/refman/8.4/en/pam-pluggable-authentication.html). Note that transmitting passwords in plain text can pose a security risk in certain configurations. To prevent password-related issues, it is recommended that clients connect to a MySQL server using a secure method that protects the password. Options include [TLS/SSL](https://github.com/go-sql-driver/mysql#tls), IPsec, or a private network.

## Additional settings

The following are additional MySQL settings.

**MySQL options:**

- **Session Timezone** - Specifies the timezone used in the database session, such as `Europe/Berlin` or `+02:00`. Required if the timezone of the database (or the host of the database) is set to something other than UTC. Set this to `+00:00` so Grafana can handle times properly. Set the value used in the session with `SET time_zone='...'`. If you leave this field empty, the timezone will not be updated. For more information, refer to [MySQL Server Time Zone Support](https://dev.mysql.com/doc/en/time-zone-support.html).
- **Min time interval** - Defines a lower limit for the [`$__interval`](ref:add-template-variables-interval) and [`$__interval_ms`](ref:add-template-variables-interval-ms) variables. Grafana recommends aligning this setting with the data write frequency. For example, set it to `1m` if your data is written every minute. Refer to [Min time interval](#min-time-interval) for format examples.

**Connection limits:**

- **Max open** - The maximum number of open connections to the database, default `100`.
- **Max idle** - The maximum number of connections in the idle connection pool, default `100`.
- **Auto (max idle)** - Toggle to set the maximum number of idle connections to the number of maximum open connections. The default is `true`.
- **Max lifetime** - The maximum amount of time in seconds a connection may be reused. This should always be lower than configured [wait_timeout](https://dev.mysql.com/doc/en/server-system-variables.html#sysvar_wait_timeout) in MySQL. The default is `14400`, or 4 hours.

**Private data source connect:**

**Private data source connect** - _Only for Grafana Cloud users._ Private data source connect, or PDC, allows you to establish a private, secured connection between a Grafana Cloud instance, or stack, and data sources secured within a private network. Click the drop-down to locate the URL for PDC. For more information regarding Grafana PDC refer to [Private data source connect (PDC)](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/).

Click **Manage private data source connect** to be taken to your PDC connection page, where you’ll find your PDC configuration details.

Once you have added your MySQL connection settings, click **Save & test** to test and save the data source connection.

### Min time interval

The **Min time interval** setting defines a lower limit for the [`$__interval`](ref:add-template-variables-interval) and [`$__interval_ms`](ref:add-template-variables-interval-ms) variables.

This value must be formatted as a number followed by a valid time identifier:

| Identifier | Description |
| ---------- | ----------- |
| `y`        | year        |
| `M`        | month       |
| `w`        | week        |
| `d`        | day         |
| `h`        | hour        |
| `m`        | minute      |
| `s`        | second      |
| `ms`       | millisecond |

You can override this setting in a dashboard panel under its data source options.

## Provision the data source

You can define and configure the data source in YAML files as part of Grafana's provisioning system.
For more information about provisioning, and available configuration options, refer to [Provision Grafana](ref:provisioning-data-sources).

### MySQL provisioning examples

**Basic provisioning:**

```yaml
apiVersion: 1

datasources:
  - name: MySQL
    type: mysql
    url: localhost:3306
    user: grafana
    jsonData:
      database: grafana
      maxOpenConns: 100
      maxIdleConns: 100
      maxIdleConnsAuto: true
      connMaxLifetime: 14400
    secureJsonData:
      password: ${GRAFANA_MYSQL_PASSWORD}
```

**Using TLS verification:**

```yaml
apiVersion: 1

datasources:
  - name: MySQL
    type: mysql
    url: localhost:3306
    user: grafana
    jsonData:
      tlsAuth: true
      database: grafana
      maxOpenConns: 100
      maxIdleConns: 100
      maxIdleConnsAuto: true
      connMaxLifetime: 14400
    secureJsonData:
      password: ${GRAFANA_MYSQL_PASSWORD}
      tlsClientCert: ${GRAFANA_TLS_CLIENT_CERT}
      tlsCACert: ${GRAFANA_TLS_CA_CERT}
```

**Use TLS and skip certificate verification:**

```yaml
apiVersion: 1

datasources:
  - name: MySQL
    type: mysql
    url: localhost:3306
    user: grafana
    jsonData:
      tlsAuth: true
      tlsSkipVerify: true
      database: grafana
      maxOpenConns: 100
      maxIdleConns: 100
      maxIdleConnsAuto: true
      connMaxLifetime: 14400
    secureJsonData:
      password: ${GRAFANA_MYSQL_PASSWORD}
      tlsClientCert: ${GRAFANA_TLS_CLIENT_CERT}
      tlsCACert: ${GRAFANA_TLS_CA_CERT}
```
