---
aliases:
  - ../../visualizations/traces/
keywords:
  - grafana
  - dashboard
  - documentation
  - panels
  - traces
title: Traces
weight: 850
---

# Traces panel

Traces are data that lets you follow a request as it traverses the services in your infrastructure.
The Traces panel visualizes this data into a diagram that allows you to easily interpret this data.

For more information about traces and how to use them, refer to the following documentation:

- [What are traces](/docs/grafana-cloud/traces)
- [Tracing in Explore]({{< relref "../../../explore/trace-integration/" >}})
- [Tempo data source]({{< relref "../../../datasources/tempo/" >}})
- [Getting started with Tempo](/docs/tempo/latest/getting-started)

{{< figure src="/static/img/docs/explore/trace-view-9-4.png" class="docs-image--no-shadow" max-width= "900px" caption="Screenshot of the trace view" >}}

## Add a panel with tracing visualizations

Once you have tracing data available in your Grafana instance, you can add tracing panels to your Grafana dashboards.

Using a dashboard variable, `traceID`, lets you create a query to show specific traces for a given trace ID.
For more information about dashboard variables, see the [Variables documentation]({{< relref "../../../dashboards/variables" >}}).

### Before you begin

To use this procedure, you need:

- A Grafana instance
- A Tempo data source connected to your Grafana instance (see [documentation](/docs/grafana/datasources/tempo/))

### Add the Tracing panel query

You need to add the tracing panel to your dashboard and define a query using the Panel editor.
The query determines the data that is displayed in the panel.
For more information on the Panel editor, see the [Panel editor]({{< relref "../../panels-visualizations/panel-editor-overview" >}}) documentation.

This procedure uses dashboard variables and templates to allow us to enter trace IDs which can then be visualized. We’re going to use a variable called `traceId` and add it as a template query.

1. From your Grafana instance, create a new dashboard or go to an existing dashboard where you would like to add tracing panels.
1. Select **Add visualization** from a new dashboard or select **Add Panel** on an existing dashboard.
1. Search for and select the appropriate tracing data source.
1. In the panel search pane on the right, select the **Visualizations** tab, search for and select for Traces.
1. On the **Panel editor**, enter a **Title** for your trace panel. For more information on the panel editor, see the [Panel editor documentation]({{< relref "../../panels-visualizations/panel-editor-overview" >}}).
1. Select the **TraceQL** query type tab from the query editor.
1. Enter `${traceId}` in the TraceQL query field to create a dashboard variable. This variable is used as the template query.
   {{< figure class="float-right"  src="/static/img/docs/panels/traces/screenshot-traces-template-query.png" caption="Add a template query" >}}

1. Select **Apply** in the Panel editor to add the panel to the dashboard.
1. Expand the size of the trace panel so that it fills the width of the dashboard. We’ll now use the dashboard settings to create the variable used in the panel’s template query.
1. Go to the dashboard **Settings** and add a new variable called `traceId`, of variable type **Custom**, giving it a label if required. Select **Apply** to add the variable to the dashboard.
  {{< figure class="float-right"  src="/static/img/docs/panels/traces/screenshot-traces-custom-variable.png" caption="Add a Custom variable" >}}

1. You can verify that the panel works by using a valid trace ID for the data source used for the trace panel and editing the ID in the dashboard variable.
  {{< figure class="float-right"  src="/static/img/docs/panels/traces/screenshot-traces-traceid-panel.png" caption="Results of query in Trace panel" >}}


## Add TraceQL with table visualizations

While you can add a trace panel visualization to a dashboard, having to manually add trace IDs as a dashboard variable is cumbersome.
It’s more useful to instead be able to use TraceQL queries to search for specific types of traces and then select appropriate traces from matching results.

1. In the same dashboard that we added the trace visualization, select **Add panel** to add a new visualization panel.
1. Select the same trace data source you used in the previous section.
1. In the panel search pane, select the Visualizations tab and search for **Table**.
1. Select the **TraceQL** tab from the query editor.
1. On the **Panel editor**, enter a **Title** for your trace panel.
1. Add an appropriate TraceQL query to search for traces that you would like to visualize in the dashboard. We’ll use a simple, static query as an example. You can write the TraceQL query as a template query to take advantage of other dashboard variables, if they exist. This lets you create dynamic queries based on these variables.
  {{< figure class="float-right" src="/static/img/docs/panels/traces/screenshot-traces-dynamic-query.png" caption="Create a dynamic query" >}}

When results are returned from a query, the results are rendered in the panel’s table.

{{< figure class="float-right" src="/static/img/docs/panels/traces/screenshot-traces-returned-query.png" caption="Results of a returned query in the panel table" >}}


### Use a variable to add other links to traces

Traces results include links to an Explorer page that render the trace. You can add other links to traces in the table that fill in the `traceId` dashboard variable when selected so that the trace is visualized in the same dashboard.

To do so, we’re going to create a set of data links in the panel.

1. Select **Add link** from the **Data links** section of the right menu.
1. Add a **Title** for the data link.
1. Find the UUID of the dashboard by looking in your browser’s address bar when the full dashboard is being rendered. Because this is a link to a dashboard in the same Grafana instance, only the path of the dashboard is required.
  {{< figure class="float-right"  src="/static/img/docs/panels/traces/screensnot-traces-uuid-url.png" caption="Unique identifier for the dashboard" >}}


1. In the `URL` edit field, we are going to make self-reference to the dashboard that contains both of the panels. This self-reference uses the value of the selected trace in the table to fill in the dashboard variable. We’ll use the path for the dashboard from the previous step and then fill in the value of `traceId` using the selected results from the TraceQL table. The trace ID is exposed using the `traceID` data field in the returned results, so we use that as the value for our dashboard variable.
  {{< figure class="float-right"  src="/static/img/docs/panels/traces/screenshot-traces-edit-link.png" caption="Edit link and add the Trace link" >}}

1. Select **Save** to save the data link.
1. Select **Apply** from the panel editor to apply the panel to the dashboard.
Extend the width of the new table panel so that it covers the width of your dashboard.
It’s also worth saving your dashboard at this point!

You should now see a list of matching traces in the Table visualization. While selecting the `TraceID` or `SpanID` fields will give you the option to either open an Explorer page to visualize the trace or following the data link, selecting any other field (such as `Start time`, `Name` or `Duration`) automatically follows the data link, filling in the `traceId` dashboard variable, and then shows the relevant trace in the trace panel.

{{< figure class="float-right"  src="/static/img/docs/panels/traces/screenshot-traces-trace-link.png" caption="Selecting the trace link" >}}

{{< figure class="float-right"  src="/static/img/docs/panels/traces/screenshot-traces-trace-link-follow.png" caption="Follow the trace link populates the traceID and displays the traces view" >}}

