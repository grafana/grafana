+++
title = "Getting Started"
description = "Getting started with Grafana guide"
keywords = ["grafana", "intro", "guide", "started"]
type = "docs"
aliases = ["/docs/grafana/latest/guides/gettingstarted"]
[menu.docs]
name = "Getting Started"
identifier = "getting_started_guide"
parent = "guides"
weight = 1
+++

# Getting started

This guide will help you get started and acquainted with Grafana. It assumes you have a working Grafana server up and running. If not please read the [installation guide]({{< relref "../installation/" >}}).

## Log in for the first time

To run Grafana, open your browser and go to http://localhost:3000/. 3000 is the default HTTP port that Grafana listens to if you haven't [configured a different port]({{< relref "../installation/configuration/#http-port" >}}).

There you will see the login page. Default username is admin and default password is admin. When you log in for the first time you will be asked to change your password. We strongly encourage you to follow Grafana’s best practices and change the default administrator password. You can later go to user preferences and change your user name.

## Add a data source

Before you create your first dashboard, you need to add your data source. Following are the list of instructions to create one.

1. Move your cursor to the cog on the side menu which will show you the configuration menu. If the side menu is not visible click the Grafana icon in the upper left corner. Click on **Configuration** > **Data Sources** in the side menu and you'll be taken to the data sources page
   where you can add add and edit data sources. You can also click the cog.
{{< docs-imagebox img="/img/docs/v52/sidemenu-datasource.png" max-width="250px" class="docs-image--no-shadow">}}

2. Click **Add data source** and you will come to the settings page of your new data source.

    {{< docs-imagebox img="/img/docs/v52/add-datasource.png" max-width="700px" class="docs-image--no-shadow">}}

3. In the **Name** box, enter a name for this data source. 

    {{< docs-imagebox img="/img/docs/v52/datasource-settings.png" max-width="700px" class="docs-image--no-shadow">}}

4. In the **Type**, select the type of data source. See [Supported data sources]({{< relref "../features/datasources/#supported-data-sources/" >}}) for more information and how to configure your data source.

5. Click **Save & Test**.







