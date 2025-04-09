---
aliases:
  - ../guides/getting_started/
  - ../guides/gettingstarted/
  - getting-started/
description: Learn how to get started with Grafana by adding a preconfigured dashboard.
labels:
  products:
    - enterprise
    - oss
title: Build your first dashboard
weight: 200
---

# Build your first dashboard

This topic helps you get started with Grafana and build your first dashboard using the built-in `Grafana` data source. To learn more about Grafana, refer to [Introduction to Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/introduction/).

{{< admonition type="note" >}}
Grafana also offers a [free account with Grafana Cloud](/signup/cloud/connect-account?pg=gsdocs) to help getting started even easier and faster. You can install Grafana to self-host or get a free Grafana Cloud account.
{{< /admonition >}}

#### Install Grafana

Grafana can be installed on many different operating systems. For a list of the minimum hardware and software requirements, as well as instructions on installing Grafana, refer to [Install Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/installation/).

#### Sign in to Grafana

To sign in to Grafana for the first time:

1. Open your web browser and go to http://localhost:3000/.

   The default HTTP port that Grafana listens to is `3000` unless you have configured a different port.

1. On the sign-in page, enter `admin` for both the username and password.
1. Click **Sign in**.

   If successful, you'll see a prompt to change the password.

1. Click **OK** on the prompt and change your password.

{{< admonition type="note" >}}
We strongly recommend that you change the default administrator password.
{{< /admonition >}}

#### Create a dashboard

If you've already set up a data source that you know how to query, refer to [Create a dashboard](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/create-dashboard/) instead.

To create your first dashboard using the built-in `-- Grafana --` data source:

1. Click **Dashboards** in the main menu.
1. On the **Dashboards** page, click **New** and select **New Dashboard** from the drop-down menu.
1. On the dashboard, click **+ Add visualization**.

   ![Empty dashboard state](/media/docs/grafana/dashboards/empty-dashboard-10.2.png)

1. In the dialog box that opens, click `-- Grafana --`:

   {{< figure class="float-right"  src="/media/docs/grafana/dashboards/screenshot-data-source-selector-10.0.png" max-width="800px" alt="Select data source dialog box" >}}

   This configures your [query](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/#add-a-query) and generates the Random Walk dashboard.

1. Click **Refresh** to query the data source.
1. When you've finished editing your panel, click **Save dashboard**.

   Alternatively, click **Back to dashboard** if you want to see your changes applied to the dashboard first. Then click **Save dashboard** when you're ready.

1. Add a descriptive title for the dashboard, or have Grafana create one using [generative AI features](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/manage-dashboards#set-up-generative-ai-features-for-dashboards), and then click **Save**.
1. Click **Back to dashboard** and then **Exit edit**.

Congratulations, you have created your first dashboard and it's displaying results.

#### Next steps

Continue to experiment with what you have built, try the [explore workflow](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/) or another visualization feature. Refer to [Data sources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/) for a list of supported data sources and instructions on how to [add a data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/#add-a-data-source). The following topics will be of interest to you:

- [Panels and visualizations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/)
- [Dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/)
- [Keyboard shortcuts](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/use-dashboards/#keyboard-shortcuts)
- [Plugins](/grafana/plugins?orderBy=weight&direction=asc)

##### Admins

The following topics are of interest to Grafana server admin users:

- [Grafana configuration](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/)
- [Authentication](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/)
- [User permissions and roles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/)
- [Provisioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/)
- [Grafana CLI](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/cli/)
