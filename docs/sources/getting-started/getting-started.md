+++
title = "Getting started"
description = "Guide for getting started with Grafana"
keywords = ["grafana", "intro", "guide", "started"]
type = "docs"
aliases = ["/docs/grafana/latest/guides/gettingstarted","/docs/grafana/latest/guides/getting_started"]
[menu.docs]
name = "Getting started"
identifier = "getting_started_guide"
parent = "guides"
weight = 200
+++

# Getting started

This guide will help you get started and acquainted with Grafana. To learn more about Grafana in general, refer to [What is Grafana?]({{< relref "what-is-grafana.md" >}}).

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

## Next steps

Different user types will have different interests. Some suggestions are listed below, or refer to [What is Grafana?]({{< relref "what-is-grafana.md" >}}) for a general overview of Grafana features.

### All users

All users might want to learn about:

- [Panels]({{< relref "../panels/panels-overview.md" >}})
- [Dashboards]({{< relref "../dashboards/_index.md" >}})
- [Data sources]({{< relref "../features/datasources/data-sources.md" >}}) and [Add a data source]({{< relref "../features/datasources/add-a-data-source.md" >}})
- [Keyboard shortcuts]({{< relref "../dashboards/shortcuts.md" >}})
- [Explore workflow]({{< relref "../explore/index.md" >}})
- [Plugins](https://grafana.com/grafana/plugins?orderBy=weight&direction=asc)

### Admins

Administrators might want to learn about:

- [Grafana configuration]({{< relref "../administration/configuration.md" >}})
- [Authentication]({{< relref "../auth/overview.md" >}})
- [User permissions and roles]({{< relref "../permissions/overview.md" >}})
- [Provisioning]({{< relref "../administration/provisioning.md" >}})
- [Grafana CLI]({{< relref "../administration/cli.md" >}})
