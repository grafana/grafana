---
aliases:
  - ../guides/getting_started/
  - ../guides/gettingstarted/
description: Guide for getting started with Grafana
keywords:
  - grafana
  - intro
  - guide
  - started
title: With Grafana
weight: 200
---

# Getting started with Grafana

This topic helps you get started with Grafana and build your first dashboard. To learn more about Grafana, refer to [What is Grafana?]({{< relref "_index.md" >}}).

> **Note:** Grafana also offers a [free account with Grafana Cloud](https://grafana.com/signup/cloud/connect-account?pg=gsdocs) to help getting started even easier and faster. You can install Grafana to self-host or get a free Grafana Cloud account.

## Step 1: Install Grafana

Grafana can be installed on many different operating systems. For a list of the minimum hardware and software requirements, as well as instructions on installing Grafana, refer to [Install Grafana]({{< relref "../installation/_index.md" >}}).

## Step 2: Log in

To log in to Grafana for the first time:

1. Open your web browser and go to http://localhost:3000/. The default HTTP port that Grafana listens to is `3000` unless you have configured a different port.
1. On the login page, enter `admin` for username and password.
1. Click **Log in**. If login is successful, then you will see a prompt to change the password.
1. Click **OK** on the prompt, then change your password.

> **Note:** We strongly recommend that you follow Grafana's best practices and change the default administrator password. Don't forget to record your credentials!

## Step 3: Create a dashboard

To create your first dashboard:

1. Click the **+** icon on the side menu.
1. On the dashboard, click **Add an empty panel**.
1. In the New dashboard/Edit panel view, go to the **Query** tab.
1. Configure your [query]({{< relref "../panels/query-a-data-source/add-a-query" >}}) by selecting `-- Grafana --` from the data source selector. This generates the Random Walk dashboard.
1. Click the **Save** icon in the top right corner of your screen to save the dashboard.
1. Add a descriptive name, and then click **Save**.

Congratulations, you have created your first dashboard and it is displaying results.

## Next steps

Continue to experiment with what you have built, try the [explore workflow]({{< relref "../explore/_index.md" >}}) or another visualization feature. Refer to [Data sources]({{< relref "../datasources" >}}) for a list of supported data sources and instructions on how to [add a data source]({{< relref "../datasources/add-a-data-source.md" >}}). The following topics will be of interest to you:

- [Panels]({{< relref "../panels/_index.md" >}})
- [Dashboards]({{< relref "../dashboards/_index.md" >}})
- [Keyboard shortcuts]({{< relref "../dashboards/shortcuts.md" >}})
- [Plugins](https://grafana.com/grafana/plugins?orderBy=weight&direction=asc)

### Admins

The following topics are of interest to Grafana server admin users:

- [Grafana configuration]({{< relref "../administration/configuration.md" >}})
- [Authentication]({{< relref "../auth/overview.md" >}})
- [User permissions and roles]({{< relref "../permissions/_index.md" >}})
- [Provisioning]({{< relref "../administration/provisioning.md" >}})
- [Grafana CLI]({{< relref "../administration/cli.md" >}})
