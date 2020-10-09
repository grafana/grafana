+++
title = "Add an interval variable"
type = "docs"
aliases = ["/docs/grafana/latest/variables/add-interval-variable.md"]
[menu.docs]
identifier = "add-interval-variable"
parent = "variable-types"
weight = 600
+++

# Add an interval variable

Use an _interval_ variable to represents time spans such as `1m`,`1h`, `1d`. You can think of them as a dashboard-wide "group by time" command. Interval variables change how the data is grouped in the visualization. You can also use the Auto Option to return a set number of data points per time span.

You can use an interval variable as a parameter to group by time (for InfluxDB), date histogram interval (for Elasticsearch), or as a summarize function parameter (for Graphite).

## Enter General options

1. Navigate to the dashboard you want to make a variable for and then click the **Dashboard settings** (gear) icon at the top of the page.
1. On the Variables tab, click **New**.
1. Enter a **Name** for your variable.
1. In the **Type** list, select **Interval**.
1. (optional) In **Label**, enter the display name of the variable dropdown. If you don't enter a display name, then the dropdown label will be the variable name.
1. Choose a **Hide** option:
   - **No selection (blank) -** The variable dropdown displays the variable **Name** or **Label** value. This is the default.
   - **Label -** The variable dropdown only displays the selected variable value and a down arrow.
   - **Variable -** No variable dropdown is displayed on the dashboard.

## Enter Interval Options

1. In the **Values** field, enter the time range intervals that you want to appear in the variable drop-down list. The following time units are supported: `s (seconds)`, `m (minutes)`, `h (hours)`, `d (days)`, `w (weeks)`, `M (months)`, and `y (years)`. You can also accept or edit the default values: `1m,10m,30m,1h,6h,12h,1d,7d,14d,30d`.
1. (optional) Turn on the **Auto Option** if you want to add the `auto` option to the list. This option allows you to specify how many times the current time range should be divided to calculate the current `auto` time span. If you turn it on, then two more options appear:
   - **Step count -** Select the number of times the current time range will be divided to calculate the value, similar to the **Max data points** query option. For example, if the current visible time range is 30 minutes, then the `auto` interval groups the data into 30 one-minute increments. The default value is 30 steps.
   - **Min Interval -** The minimum threshold below which the step count intervals will not divide the time. To continue the 30 minute example, if the minimum interval is set to 2m, then Grafana would group the data into 15 two-minute increments.
1. In **Preview of values**, Grafana displays a list of the current variable values. Review them to ensure they match what you expect.
1. Click **Add** to add the variable to the dashboard.

## Interval variable examples

Example using the template variable `myinterval` in a Graphite function:

```
summarize($myinterval, sum, false)
```

A more complex Graphite example, from the [Graphite Template Nested Requests panel](https://play.grafana.org/d/000000056/graphite-templated-nested?editPanel=2&orgId=1):

```
groupByNode(summarize(movingAverage(apps.$app.$server.counters.requests.count, 5), '$interval', 'sum', false), 2, 'sum')
```