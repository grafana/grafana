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

This guide will help you get started and acquainted with Grafana.

## Install Grafana

This step varies according to your computer operating system. Refer to the instructions for your OS in the [Installation]({{< relref "../installation/_index.md" >}}) section for instructions.

## Log in for the first time 

1. Open your web browser and go to http://localhost:3000/. `3000` is the default HTTP port that Grafana listens to if you haven’t configured a different port.
1. On the login page, type `admin` for the username and password.
1. Change your password. 

> **Note:** We strongly encourage you to follow Grafana best practices and change the default administrator password. Don't forget to record your credentials!

## Create a dashboard

1. Click **New dashboard**.
1. Click **Add Query**. Grafana creates a basic graph panel with the Random Walk scenario.
1. Save your dashboard. Click the **Save dashboard** icon in the top corner of the screen.

 Congratulations, you have gotten started with Grafana! You have a dashboard and are displaying results. Feel free to experiment with what you have built, continue on to add another data source, or explore [Next steps](#next-steps).

## Add a data source

{{< docs-imagebox img="/img/docs/v52/sidemenu-datasource.png" max-width="250px" class="docs-image--right docs-image--no-shadow">}}

Before you create your first real dashboard, you need to add your data source.

First move your cursor to the cog on the side menu which will show you the configuration menu. If the side menu is not visible click the Grafana icon in the upper left corner. The first item on the configuration menu is data sources, click on that and you'll be taken to the data sources page where you can add and edit data sources. You can also simply click the cog.


Click Add data source and you will come to the settings page of your new data source.

{{< docs-imagebox img="/img/docs/v52/add-datasource.png" max-width="700px" class="docs-image--no-shadow">}}

First, give the data source a Name and then select which Type of data source you'll want to create, see [Supported data sources]({{< relref "../features/datasources/#supported-data-sources/" >}}) for more information and how to configure your data source.


{{< docs-imagebox img="/img/docs/v52/datasource-settings.png" max-width="700px" class="docs-image--no-shadow">}}

After you have configured your data source you are ready to save and test.

## Next steps

There is so much you can do in Grafana, it can be hard to know where to begin. Your next steps will be different depending on whether you are using Grafana just for yourself or if you are an administrating Grafana for an organization.

### All users

All users might want to learn about:

* [Panels]({{< relref "../features/panels/panels.md" >}})
* [Dashboards]({{< relref "../features/dashboard/dashboards.md" >}})
* [Keyboard shortcuts]({{< relref "../features/shortcuts.md" >}})
* [Explore workflow]({{< relref "../features/explore/index.md" >}})
* [Plugins](https://grafana.com/grafana/plugins?orderBy=weight&direction=asc)

### Admins

Administrators might want to learn about:

* [Grafana configuration]({{< relref "../installation/configuration.md" >}})
* [Authentication]({{< relref "../auth/overview.md" >}})
* [User permissions and roles]({{< relref "../permissions/overview.md" >}})
* [Provisioning]({{< relref "../administration/provisioning.md" >}})
* [Grafana CLI]({{< relref "../administration/cli.md" >}})
