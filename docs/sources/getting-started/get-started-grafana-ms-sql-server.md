---
aliases:
  - ../guides/getting_started/
  - ../guides/gettingstarted/
  - getting-started-sql/
description: Learn how to build your first MS SQL Server dashboard in Grafana.
labels:
  products:
    - enterprise
    - oss
title: Get started with Grafana and MS SQL Server
weight: 500
---

# Get started with Grafana and MS SQL Server

Microsoft SQL Server is a popular relational database management system that is widely used in development and production environments. This topic walks you through the steps to create a series of dashboards in Grafana to display metrics from a MS SQL Server database.

#### Download MS SQL Server

MS SQL Server can be installed on Windows or Linux operating systems and also on Docker containers. Refer to the [MS SQL Server downloads page](https://www.microsoft.com/en-us/sql-server/sql-server-downloads), for a complete list of all available options.

#### Install MS SQL Server

You can install MS SQL Server on the host running Grafana or on a remote server. To install the software from the [downloads page](https://www.microsoft.com/en-us/sql-server/sql-server-downloads), follow their setup prompts.

If you are on a Windows host but want to use Grafana and MS SQL data source on a Linux environment, refer to the [WSL to set up your Grafana development environment](/blog/2021/03/03/how-to-set-up-a-grafana-development-environment-on-a-windows-pc-using-wsl) blog post. This will allow you to leverage the resources available in [grafana/grafana](https://github.com/grafana/grafana) GitHub repository. Here you will find a collection of supported data sources, including MS SQL Server, along with test data and pre-configured dashboards for use.

#### Add the MS SQL data source

There are several ways to authenticate in MSSQL. Start by:

1. Click **Connections** in the left-side menu and filter by `mssql`.
1. Select the **Microsoft SQL Server** option.
1. Click **Create a Microsoft SQL Server data source** in the top right corner to open the configuration page.
1. Select the desired authentication method and fill in the right information as detailed below.
1. Click **Save & test**.

##### General configuration

| Name       | Description                                                                                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------------- |
| `Name`     | The data source name. This is how you refer to the data source in panels and queries.                                 |
| `Host`     | The IP address/hostname and optional port of your MS SQL instance. If port is omitted, the default 1433 will be used. |
| `Database` | Name of your MS SQL database.                                                                                         |

##### SQL Server Authentication

| Name       | Description                     |
| ---------- | ------------------------------- |
| `User`     | Database user's login/username. |
| `Password` | Database user's password.       |

##### Windows Active Directory (Kerberos)

Below are the four possible ways to authenticate via Windows Active Directory/Kerberos.

{{< admonition type="note" >}}
Windows Active Directory (Kerberos) authentication is not supported in Grafana Cloud at the moment.
{{< /admonition >}}

| Method                    | Description                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Username + password**   | Enter the domain user and password                                                                                                                           |
| **Keytab file**           | Specify the path to a valid keytab file to use that for authentication.                                                                                      |
| **Credential cache**      | Log in on the host via `kinit` and pass the path to the credential cache. The cache path can be found by running `klist` on the host in question.            |
| **Credential cache file** | This option allows multiple valid configurations to be present and matching is performed on host, database, and user. See the example JSON below this table. |

```json
[
  {
    "user": "grot@GF.LAB",
    "database": "dbone",
    "address": "mysql1.mydomain.com:3306",
    "credentialCache": "/tmp/krb5cc_1000"
  },
  {
    "user": "grot@GF.LAB",
    "database": "dbtwo",
    "address": "mysql2.gf.lab",
    "credentialCache": "/tmp/krb5cc_1000"
  }
]
```

For installations from the [grafana/grafana](https://github.com/grafana/grafana/tree/main) repository, `gdev-mssql` data source is available. Once you add this data source, you can use the `Datasource tests - MSSQL` dashboard with three panels showing metrics generated from a test database.

![MS SQL Server dashboard](/static/img/docs/getting-started/gdev-sql-dashboard.png)

Optionally, play around this dashboard and customize it to:

- Create different panels.
- Change titles for panels.
- Change frequency of data polling.
- Change the period for which the data is displayed.
- Rearrange and resize panels.

#### Start building dashboards

Now that you have gained some idea of using the pre-packaged MS SQL data source and some test data, the next step is to setup your own instance of MS SQL Server database and data your development or sandbox area.

To fetch data from your own instance of MS SQL Server, add the data source using instructions in Step 4 of this topic. In Grafana [Explore]({{< relref "../explore" >}}) build queries to experiment with the metrics you want to monitor.

Once you have a curated list of queries, create [dashboards]({{< relref "../dashboards" >}}) to render metrics from the SQL Server database. For troubleshooting, user permissions, known issues, and query examples, refer to [Using Microsoft SQL Server in Grafana]({{< relref "../datasources/mssql" >}}).
