---
aliases:
  - ../guides/getting_started/
  - ../guides/gettingstarted/
  - getting-started/
description: Learn how to get started with Grafana by adding a preconfigured dashboard.
title: Build your first dashboard
weight: 200
---

# Build your first dashboard

This topic helps you get started with Grafana and build your first dashboard. To learn more about Grafana, refer to [What is Grafana?]({{< relref "_index.md" >}}).

> **Note:** Grafana also offers a [free account with Grafana Cloud](https://grafana.com/signup/cloud/connect-account?pg=gsdocs) to help getting started even easier and faster. You can install Grafana to self-host or get a free Grafana Cloud account.

#### Install Grafana

Grafana can be installed on many different operating systems. For a list of the minimum hardware and software requirements, as well as instructions on installing Grafana, refer to [Install Grafana]({{< relref "../setup-grafana/installation/" >}}).

#### Sign in to Grafana

To sign in to Grafana for the first time:

1. Open your web browser and go to http://localhost:3000/.

   The default HTTP port that Grafana listens to is `3000` unless you have configured a different port.

1. On the sign-in page, enter `admin` for the username and password.
1. Click **Sign in**.

   If successful, you will see a prompt to change the password.

1. Click **OK** on the prompt and change your password.

> **Note:** We strongly recommend that you change the default administrator password.

#### Create a dashboard

To create your first dashboard:

1. Click the **New dashboard** item under the **Dashboards** icon in the side menu.
1. On the dashboard, click **Add a new panel**.
1. In the New dashboard/Edit panel view, go to the **Query** tab.
1. Configure your [query]({{< relref "../panels-visualizations/query-transform-data/#add-a-query" >}}) by selecting `-- Grafana --` from the data source selector.

   This generates the Random Walk dashboard.

1. Click the **Save** icon in the top right corner of your screen to save the dashboard.
1. Add a descriptive name, and then click **Save**.

Congratulations, you have created your first dashboard and it is displaying results.

#### Next steps

Continue to experiment with what you have built, try the [explore workflow]({{< relref "../explore/" >}}) or another visualization feature. Refer to [Data sources]({{< relref "../datasources/" >}}) for a list of supported data sources and instructions on how to [add a data source]({{< relref "../administration/data-source-management#add-a-data-source" >}}). The following topics will be of interest to you:

- [Panels and visualizations]({{< relref "../panels-visualizations/" >}})
- [Dashboards]({{< relref "../dashboards/" >}})
- [Keyboard shortcuts]({{< relref "../dashboards/use-dashboards/#keyboard-shortcuts" >}})
- [Plugins](https://grafana.com/grafana/plugins?orderBy=weight&direction=asc)

##### Admins

The following topics are of interest to Grafana server admin users:

- [Grafana configuration]({{< relref "../setup-grafana/configure-grafana/" >}})
- [Authentication]({{< relref "../setup-grafana/configure-security/configure-authentication/" >}})
- [User permissions and roles]({{< relref "../administration/roles-and-permissions/" >}})
- [Provisioning]({{< relref "../administration/provisioning/" >}})
- [Grafana CLI]({{< relref "../cli/" >}})
