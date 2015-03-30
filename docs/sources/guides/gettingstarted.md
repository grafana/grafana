---
page_title: Getting started
page_description: Getting started
page_keywords: grafana, guide, documentation
---

# Getting started
This guide will help you get started and acquainted with the Grafana user interface. It assumes you have a working Grafana 2.0 instance, and have added at least one Grafana data source.

## Interface overview

The interface is three main areas

1. Dashboard header
2. Grafana sidebar
3. Dashboard

### Dashboard header
<img class="no-shadow" src="/img/v2/v2_top_nav_annotated.png">

Every Dashboard-related feature can be accessed from the main Dashboard header.

1. Side menubar toggle: This toggles the side menu, allowing you to focus on the data presented in the dashboard. The side menu provides access to features unrelated to a Dashboard such as Users, Organizations, and Data Sources.
2. Dashboard dropdown: This dropdown shows you which Dashboard you are currently viewing, and allows you to easily switch to a new Dashboard. From here you can also create a new Dashboard, Import existing Dashboards, and manage Dashboard playlists. 
3. Star Dashboard: Star (or unstar) the current Dashboar. Starred Dashboards will show up on your own Home Dashboard by default, and are a convenient way to mark Dashboards that you're interested in.
4. Share Dashboard: Share the current dashboard by creating a link or create a static Snapshot of it. Make sure the Dashboard is saved before sharing.
5. Save dashboard: The current Dashboard will be saved with the current Dashboard name. 
6. Settings: Manage Dashboard settings and features such as Templating and Annotations. 

<img src="/img/v1/interface_guide1.png" class="no-sthadow">

## Dashboards

Dashboards are at the core of what Grafana is all about. Dashboards are composed of individual Panels arranged on a number of Rows. By adjusting the flexible display properties of Panels and Rows, you can customize the perfect Dashboard for your exact needs/

Each panel can interact with data from any configured Grafana Data Source (currently InfluxDB, Graphite, OpenTSDB, and KairosDB). This allows you to create a single dashboard that unifies the data across your organization. Panels use the time range specificed in the main Time Picker in the upper right, but they can also have relative time overrides.

Grafana makes it easy to create, customize, and share Dashboards. Let's create our first one:

![](/img/animated_gifs/new_dashboard.gif)

## Rows

To the right of each row you have two colored rectangles, hover over these to get access to quick Row controls.
![](/img/animated_gifs/row_edit_menu.gif)

You can add as many rows as you want, and control the height of each row. Think of Rows as containers for a group of Panels. 

## Panels

Panels are where the magic happens. Let's add a Panel to a Row. There are many types of Panels in Grafana (such as graph, singlestat, and text), and more to come. The graph Panel is a particularly powerful way of visualizing time series data.

Add a graph Panel to a Row by clicking the green Row icon and selecting 'graph' from the 'Add panel' option.

## The graph Panel

Click on the Graph Panel's title and then ``Edit`` to open a panel in edit mode.
![](/img/v1/edit_graph_ui_guide.png)

From the graph Panel edit mode, you can control the styling of the graph, which Data Source it will pull data from, and the specific queries that will generate data to visualize. Let's take a quick look at some of the more interesting tabs:

The 'Metrics' tab is where it all comes together. The interface and capabilities for this tab will depend on the Data Source. From here you can build a list of queries that can be visualized, or used as the basis for other queries that are visualized. The Grafana query editor strives to make it easy for you to ask the right questions of yoru Data Source without having to understand the nuances of its query syntax. 

Through the 'Axis and Gris' and 'Display' tabs you can control the exact styling and rendering options for that graph Panels. You can configure things like styling, rendering options, units, and axis through these tabs.

Read the graph Panel documentation for more about this panel.

## Drag-and-Drop panels

You can Drag-and-Drop Panels within and between Rows. Click and hold the Panel title, and drag it to its new location.

![](/img/animated_gifs/drag_drop.gif)

## Tips and shortcuts

* Click the graph title and in the dropdown menu quickly change span or duplicate the panel.
* Click the Save icon in the menu to save the dashboard with a new name
* Click the Save icon in the menu and then advanced to export the dashboard to json file, or set it as your default dashboard.
* Click the colored icon in the legend to select series color
* Click series name in the legend to hide series
* Ctrl/Shift/Meta + Click legend name to hide other series

## Grafana loves the keyboard:

* Ctrl+S Saves the current dashboard
* Ctrl+F Opens the dashboard finder / search
* Ctrl+H Hides all controls (good for tv displays)
* Hit Escape to exit graph when in fullscreen or edit mode













