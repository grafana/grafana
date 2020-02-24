+++
title = "Getting started"
description = "Guide for getting started with Grafana"
keywords = ["grafana", "intro", "guide", "started"]
type = "docs"
aliases = ["/docs/grafana/latest/guides/gettingstarted"]
[menu.docs]
name = "Getting started"
identifier = "getting_started_guide"
parent = "guides"
weight = 100
+++

# Getting started

This guide will help you get started and acquainted with Grafana. For a more in-depth explanation of Grafana process and capabilities, refer to [Introduction to Grafana]({{< relref "intro-to-grafana.md" >}}).

## Install Grafana

This step varies according to your computer operating system. Refer to the instructions for your OS in the [Installation]({{< relref "../installation/_index.md" >}}) section for instructions.

## Log in for the first time 

1. Open your web browser and go to http://localhost:3000/. `3000` is the default HTTP port that Grafana listens to if you haven’t configured a different port.
1. On the login page, type `admin` for the username and password.
1. Change your password. 

> **Note:** We strongly encourage you to follow Grafana best practices and change the default administrator password. Don't forget to record your credentials!

## 3. Add TestData DB data source

Next...Import Streaming Example data source? Might not be ready for primetime.

## 4. Create a dashboard
1. Got to Create > Dashboard
1. Add Query. This creates a graph.
1. Save dashboard.

Now you have a dashboard and are displaying results. Feel free to experiment with what you have built, skip down to explore Next Steps, or keep going to see what else you can do with Grafana.

## 4. Import a dashboard

## Change your user name

## 5. Create a playlist



## Next steps
, regular users vs developers vs admins
- Add Prometheus (or other) data sources
- Import dashboards/plugins
- Configure Grafana
- Add users
- Share dashboard/panel

## Log in for the first time

To run Grafana, open your browser and go to http://localhost:3000/. 3000 is the default HTTP port that Grafana listens to if you haven't [configured a different port]({{< relref "../installation/configuration/#http-port" >}}).

There you will see the login page. Default username is admin and default password is admin. When you log in for the first time you will be asked to change your password. We strongly encourage you to follow Grafana’s best practices and change the default administrator password. You can later go to user preferences and change your user name.

## Add a data source

{{< docs-imagebox img="/img/docs/v52/sidemenu-datasource.png" max-width="250px" class="docs-image--right docs-image--no-shadow">}}

Before you create your first dashboard, you need to add your data source.

First move your cursor to the cog on the side menu which will show you the configuration menu. If the side menu is not visible click the Grafana icon in the upper left corner. The first item on the configuration menu is data sources, click on that and you'll be taken to the data sources page where you can add and edit data sources. You can also simply click the cog.


Click Add data source and you will come to the settings page of your new data source.

{{< docs-imagebox img="/img/docs/v52/add-datasource.png" max-width="700px" class="docs-image--no-shadow">}}

First, give the data source a Name and then select which Type of data source you'll want to create, see [Supported data sources]({{< relref "../features/datasources/#supported-data-sources/" >}}) for more information and how to configure your data source.


{{< docs-imagebox img="/img/docs/v52/datasource-settings.png" max-width="700px" class="docs-image--no-shadow">}}

After you have configured your data source you are ready to save and test.
