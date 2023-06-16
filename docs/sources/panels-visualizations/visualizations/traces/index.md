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

Traces let you follow a request as it traverses the services in your infrastructure.
The Traces panel visualizes traces data into a diagram that allows you to easily interpret it.

For more information about traces and how to use them, refer to the following documentation:

- [Tracing in Explore]({{< relref "../../../explore/trace-integration/" >}})
- [Tempo data source]({{< relref "../../../datasources/tempo/" >}})
- [Getting started with Tempo](/docs/tempo/latest/getting-started)

{{< figure src="/static/img/docs/explore/trace-view-9-4.png" class="docs-image--no-shadow" max-width= "900px" caption="Screenshot of the trace view" >}}

## Add a panel with tracing visualizations

Once you have tracing data available in your Grafana stack, you can add tracing panels to your Grafana dashboards.

Using a dashboard variable, `traceID`, lets you create a query to show specific traces for a given trace ID.
For more information about dashboard variables, refer to the [Variables documentation]({{< relref "../../../dashboards/variables" >}}).

### Before you begin

To use this procedure, you need:

- A Grafana instance
- A Tempo data source connected to your Grafana instance (see [documentation](/docs/grafana/datasources/tempo/))

### Add the Traces panel query

To view and analyze traces data in a dashboard, you need to add the tracing panel to your dashboard and define a query using the panel editor.
The query determines the data that is displayed in the panel.
For more information on the panel editor, refer to the [Panel editor documentation]({{< relref "../../panel-editor-overview" >}}).

This procedure uses dashboard variables and templates to allow you to enter trace IDs which can then be visualized. You'll use a variable called `traceId` and add it as a template query.

1. From your Grafana stack, create a new dashboard or go to an existing dashboard where you'd like to add tracing panels.
1. Select **Add visualization** from a new dashboard or select **Add Panel** on an existing dashboard.
1. Search for and select the appropriate tracing data source.
1. In the top-right of the panel editor, select the **Visualizations** tab, search for, and select **Traces**.
1. Under the **Panel options**, enter a **Title** for your trace panel. For more information on the panel editor, refer to the [Configure panel options documentation]({{< relref "../../configure-panel-options" >}}).
1. In the query editor, select the **TraceQL** query type tab.
1. Enter `${traceId}` in the TraceQL query field to create a dashboard variable. This variable is used as the template query.

   {{< figure src="/static/img/docs/panels/traces/screenshot-traces-template-query.png" caption="Add a template query" >}}

1. Select **Apply** in the panel editor to add the panel to the dashboard.
1. Go to the dashboard **Settings** and add a new variable called `traceId`, of variable type **Custom**, giving it a label if required. Select **Apply** to add the variable to the dashboard.

   {{< figure  src="/static/img/docs/panels/traces/screenshot-traces-custom-variable.png" max-width="50%" caption="Add a Custom variable" >}}

1. Verify that the panel works by using a valid trace ID for the data source used for the trace panel and editing the ID in the dashboard variable.

   {{< figure src="/static/img/docs/panels/traces/screenshot-traces-traceid-panel.png" caption="Results of query in Trace panel" >}}

## Add TraceQL with table visualizations

While you can add a trace panel visualization to a dashboard, having to manually add trace IDs as a dashboard variable is cumbersome.
It’s more useful to instead be able to use TraceQL queries to search for specific types of traces and then select appropriate traces from matching results.

1. In the same dashboard where you added the trace visualization, select **Add panel** to add a new visualization panel.
1. Select the same trace data source you used in the previous section.
1. In the top-right of the panel editor, select the **Visualizations** tab, search for, and select **Table**.
1. In the query editor, select the **TraceQL** tab.
1. Under the **Panel options**, enter a **Title** for your trace panel.
1. Add an appropriate TraceQL query to search for traces that you would like to visualize in the dashboard. This example uses a simple, static query. You can write the TraceQL query as a template query to take advantage of other dashboard variables, if they exist. This lets you create dynamic queries based on these variables.

   {{< figure src="/static/img/docs/panels/traces/screenshot-traces-dynamic-query.png" caption="Create a dynamic query" >}}

When results are returned from a query, the results are rendered in the panel’s table.

{{< figure src="/static/img/docs/panels/traces/screenshot-traces-returned-query.png" caption="Results of a returned query in the panel table" >}}

### Use a variable to add other links to traces

The results in the Traces panel include links to the **Explore** page that renders the trace. You can add other links to traces in the table that fill in the `traceId` dashboard variable when selected, so that the trace is visualized in the same dashboard.

To create a set of data links in the panel, use the following steps:

1. In the right-side menu, under **Data links**, select **Add link**.
1. Add a **Title** for the data link.
1. Find the UUID of the dashboard by looking in your browser’s address bar when the full dashboard is being rendered. Because this is a link to a dashboard in the same Grafana stack, only the path of the dashboard is required.

   {{< figure src="/static/img/docs/panels/traces/screensnot-traces-uuid-url.png" caption="Unique identifier for the dashboard" >}}

1. In the **URL** field, make a self-reference to the dashboard that contains both of the panels. This self-reference uses the value of the selected trace in the table to fill in the dashboard variable. Use the path for the dashboard from the previous step and then fill in the value of `traceId` using the selected results from the TraceQL table.
   The trace ID is exposed using the `traceID` data field in the returned results, so use that as the value for the dashboard variable.

   {{< figure src="/static/img/docs/panels/traces/screenshot-traces-edit-link.png" caption="Edit link and add the Trace link" >}}

1. Select **Save** to save the data link.
1. Select **Apply** from the panel editor to apply the panel to the dashboard.
1. Save the dashboard.

You should now see a list of matching traces in the Table visualization. While selecting the **TraceID** or **SpanID** fields will give you the option to either open the **Explore** page to visualize the trace or following the data link, selecting any other field (such as **Start time**, **Name** or **Duration**) automatically follows the data link, filling in the `traceId` dashboard variable, and then shows the relevant trace in the trace panel.

{{< figure src="/static/img/docs/panels/traces/screenshot-traces-trace-link.png" caption="Selecting the trace link" >}}

{{< figure src="/static/img/docs/panels/traces/screenshot-traces-trace-link-follow.png" caption="Follow the trace link populates the trace ID and displays the traces view" >}}
