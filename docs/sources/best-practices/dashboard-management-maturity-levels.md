+++
title = "Dashboard management maturity levels"
description = "Explanation of dashboard management maturity levels"
type = "docs"
[menu.docs]
weight = 200
+++


1. A dashboard should tell a story.
2. Avoid "dashboard sprawl." Dashboard sprawl negatively affects time to find the right dashboard. Duplicating dashboards and changing “one thing” (worse: keeping original tags) is the easiest kind of sprawl
3. Your dashboarding practices should reduce cognitive load, not add to it.


# Dashboard management maturity levels

Low - Default state. No strategy.
- Sprawl
Everyone can modify, no reviews
Duplicate used regularly, tags lose meaning when copied with dashboards that are then altered
One-off dashboards that get in the way of finding what you need
A symptom of low maturity is browsing for dashboards
If you have to flip through a couple of dashboards to get to the right one
Not having any alerts to direct you to the right dashboard
Low
No strategy
(default state)

- Everyone can modify
- Duplicate used regularly
- One-off dashboards
- No version control (dashboard json in version control)
- Lots of browsing for dashboards, searching for the right dashboard. Wasted tie.



Medium - Managing use of methodical dashboards.

- Prevent sprawl by using template variables.
The first thing you can do to prevent sprawl of dashboards is to use template variables
What’s shown is a node dashboard for kubernetes. I don’t need a dashboard for each node, that can be part of a query variable
Even better, I can make the datasource a template variable too, so I can reuse the same dashboard across different clusters and monitoring backends
Link to strategies.md or move it to this folder.
- Hierarchal dashboards
Summary views with aggregate queries
Queries have breakdown by next level
Tree structure reflecting the k8s hierarchies
Hierarchal dashboards with drill-down to next level
- Service hierarchies
RED method example, Request and Error rate on the left, latency duration on the right
One row per service
Row order reflects data flow
- Expressive dashboards: Split service dashboards where magnitude differs
  - can be worth splitting an app services into different dashboards. Compare like to like. Make sure aggregated metrics don't drown out important info.
- Expressive charts
Meaningful use of color (green is good, red is bed)
Normalize axis where you can.
Understand the underlying metrics
- Normalized charts
  - Example: CPU usage by percentage rather than number, because each CPU might be a different size.
  - Example reduces cognitive load. Don't have to do math on "how much space do I have left?"
- Directed browsing
Template variables make it harder to “just browse” randomly/aimlessly. Cut down on "guessing."
Most dashboards should be linked to by alerts
Browsing is directed (drill-down)
- Managing dashboards
Version controlled dashboard sources
Currently by copy/pasting JSON
RFC in our design doc (provisioning?)

Medium
Managing use of methodical dashboards
- prevention of sprawl
- use of template variables to reuse dashboards, reduce sprawl (example: data source variables, instance variables, query variables)
- methodical dashboards
- hierarchical dashboards with drill-down to next level (ask Dave Kal for example)
- expressive charts
- version control
- directed browsing



High - Optimizing use. Consistency by design.
- Optimizing use
Actively reducing sprawl
Regularly reviewing existing dashboards
- Example: Only approved dashboards added to master dashboard list.
Tracking use (upcoming feature: meta-analytics)
- Consistency by design
Use of scripting libraries to generate dashboards, ensure consistency in pattern and style.
grafonnet (Jsonnet)
grafanalib (Python)
Consistent attributes and styles across all dashboards
Smaller change sets

Dashboard as code(?)

High
Optimizing use,
consistency by design
- active sprawl reduction
- use of scripting libraries
- use of mixins
- no editing in the browser
- browsing is the exception
- Link to mixins? Prometheus, K8, others?


[Fool-Proof Kubernetes Dashboards for Sleep-Deprived Oncalls - David Kaltschmidt, Grafana Labs](https://www.youtube.com/watch?v=YE2aQFiMGfY)