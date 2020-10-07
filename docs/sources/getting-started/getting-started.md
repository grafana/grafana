+++
title = "Getting started with Grafana"
description = "Guide for getting started with Grafana"
keywords = ["grafana", "intro", "guide", "started"]
type = "docs"
aliases = ["/docs/grafana/latest/guides/gettingstarted","/docs/grafana/latest/guides/getting_started"]
[menu.docs]
identifier = "getting_started-grafana"
parent = "guides"
weight = 200
+++

# Getting Started with Grafana

This topic will help you get started with Grafana and build your first dashboard. To learn more about Grafana, refer to [What is Grafana?]({{< relref "what-is-grafana.md" >}}).

## Step 1: Install Grafana

Grafana can be installed on many different operating systems. For a list of minimum hardware and software requirements, as well as instructions on installing Grafana, refer to [Install Grafana]({{< relref "../installation/_index.md" >}}).

## Step 2: Log in

To login to Grafana for the first time:

1. Open your web browser and go to http://localhost:3000/. The default HTTP port that Grafana listens to is `3000` unless you have configured a different port.
1. On the login page, enter `admin` for username and password.
1. Click **Log In**.
1. If login is successful, you will see a prompt to change the password.
1. Click **OK** on the prompt, then change your password.

> **Note:** We strongly recommend that you follow Grafana's best practices and change the default administrator password. Don't forget to record your credentials!

## Step 3: Create a dashboard

To create your first dashboard:

1. Click the **+** icon on the left panel, select **Create Dashboard**, then click **Add new panel**.
1. In the New Dashbard/Edit Panel view, go to the **Query** tab.
1. Configure your [query]({{< relref "../panels/queries.md" >}}) by selecting ``-- Grafana --`` from the [data source selector]({{< relref "../panels/queries.md/#data-source-selector" >}}). This generates the Random Walk dashboard.
1. Click the  **Save** icon in the top right corner of your screen to save the dashboard.
1. Add a descriptive name, and click **Save**.

 Congratulations, you have created your first dashboard and it is displaying results.

## Next steps

 Continue to experiment with what you have built, try the [explore workflow]({{< relref "../explore/index.md" >}}) or another visualization feature. Refer to [Data sources]({{< relref "../features/datasources/data-sources.md" >}}) for a list of supported data sources and instructions on how to [add a data source]({{< relref "../features/datasources/add-a-data-source.md" >}}). The following topics will be of interest to you:  

- [Panels]({{< relref "../panels/panels-overview.md" >}})
- [Dashboards]({{< relref "../dashboards/_index.md" >}})
- [Keyboard shortcuts]({{< relref "../dashboards/shortcuts.md" >}})
- [Plugins](https://grafana.com/grafana/plugins?orderBy=weight&direction=asc)

### Admins

The following topics are of interest to team admin or server admin users:

- [Grafana configuration]({{< relref "../administration/configuration.md" >}})
- [Authentication]({{< relref "../auth/overview.md" >}})
- [User permissions and roles]({{< relref "../permissions/overview.md" >}})
- [Provisioning]({{< relref "../administration/provisioning.md" >}})
- [Grafana CLI]({{< relref "../administration/cli.md" >}})
