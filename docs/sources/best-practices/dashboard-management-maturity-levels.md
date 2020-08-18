+++
title = "Dashboard management maturity levels"
description = "Explanation of dashboard management maturity levels"
type = "docs"
[menu.docs]
weight = 200
+++

# Dashboard management maturity levels

_Dashboard management maturity_ refers to how well-designed and efficient your dashboard ecosystem is. We recommend periodically reviewing your dashboard setup to gauge where you are and how you can improve.

Broadly speaking, dashboard maturity can be defined as low, medium, or high.

Much of the content for this topic was taken from the KubeCon 2019 talk [Fool-Proof Kubernetes Dashboards for Sleep-Deprived Oncalls](https://www.youtube.com/watch?v=YE2aQFiMGfY).

## Low - default state

At this stage, you have no coherent dashboard management strategy. Almost everyone starts here.

How can you tell you are here?

- Everyone can modify your dashboards.
- Lots of copied dashboards, little to no dashboard reuse.
- One-off dashboards that hang around forever.
- No version control (dashboard JSON in version control).
- Lots of browsing for dashboards, searching for the right dashboard. This means lots of wasted time trying to find the dashboard you need.
- Not having any alerts to direct you to the right dashboard.

## Medium - methodical dashboards

At this stage, you are starting to manage your dashboard use with methodical dashboards. You might have laid out a strategy, but there are some things you could improve.

How can you tell you are here?

- Prevent sprawl by using template variables. For example, you don't need a separate dashboard for each node, you can use query variables. Even better, you can make the data source a template variable too, so you can reuse the same dashboard across different clusters and monitoring backends.

  {{< imgbox max-width="90%" img="/img/docs/best-practices/use-variables-example.gif" caption="Example of using variables" >}}

- Methodical dashboards according to an [observability strategy]({{< relref "common-observability-strategies.md" >}}).
- Hierarchical dashboards with drill-downs to the next level.

  {{< imgbox max-width="90%" img="/img/docs/best-practices/drill-down-example.png" caption="Example of using drill-down" >}}

- Dashboard design reflects service hierarchies. The example shown below uses the RED method (request and error rate on the left, latency duration on the right) with one row per service. The row order reflects the data flow.

  {{< imgbox max-width="90%" img="/img/docs/best-practices/service-hierarchy-example.png" caption="Example of a service hierarchy" >}}

- Compare like to like: split service dashboards when the magnitude differs. Make sure aggregated metrics don't drown out important information.
- Expressive charts with meaningful use of color and normalizing axes where you can. 
  - Example of meaningful color: Green means it's good, red means it's bad. [Thresholds]({{< relref "../panels/thresholds.md" >}}) can help with that.
  - Example of normalizing axes: When comparing CPU usage, measure by percentage rather than raw number, because each CPU might be a different size. This reduces cognitive load, because the user doesn't have to compute how much space is left on the CPU.
- Directed browsing cuts down on "guessing."
  - Template variables make it harder to “just browse” randomly or aimlessly.
  - Most dashboards should be linked to by alerts.
  - Browsing is directed with links. For more information, refer to [Linking]({{< relref "../linking/_index.md" >}}).
- Version-controlled dashboard JSON.

## High - optimized use

At this stage, you have optimized your dashboard management use with a consistent and thoughtful strategy. It requires maintenance, but the results are worth it. Other IT departments want to grow up and be like you.

- Actively reducing sprawl.
  - Regularly review existing dashboards to make sure they are still relevant.
  - Only approved dashboards added to master dashboard list.
  - Tracking dashboard use. If you're an Enterprise user, you might take advantage of [Usage insights]({{< relref "../enterprise/usage-insights.md" >}}).
- Consistency by design.
- Use scripting libraries to generate dashboards, ensure consistency in pattern and style.
  - grafonnet (Jsonnet)
  - grafanalib (Python)
- No editing in the browser. Dashboard viewers change views with variables.
- Browsing for dashboards is the exception, not the rule.

[Fool-Proof Kubernetes Dashboards for Sleep-Deprived Oncalls - David Kaltschmidt, Grafana Labs](https://www.youtube.com/watch?v=YE2aQFiMGfY)