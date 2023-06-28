---
title: Build a logs data source plugin
description: How to build a logs data source plugin.
aliases:
  - ../../../plugins/build-a-logs-data-source-plugin/
keywords:
  - grafana
  - plugins
  - plugin
  - logs
  - logs data source
  - datasource
weight: 500
---

# Build a logs data source plugin

Grafana data source plugins support metrics, logs, and other data types. The steps to build a logs data source plugin are largely the same as for a metrics data source, but there are a few differences which we will explain in this guide.

## Before you begin

This guide assumes that you're already familiar with how to [Build a data source plugin]({{< relref "./build-a-data-source-plugin" >}}) for metrics. We recommend that you review this material before continuing.

## Add logs support to your data source

To add logs support to an existing data source, you need to:

1. Enable logs support
1. Construct the log data

When these steps are done, then you can improve the user experience with one or more [optional features](#enhance-your-logs-data-source-plugin-with-optional-features).

### Step 1: Enable logs support

Tell Grafana that your data source plugin can return log data, by adding `"logs": true` to the [plugin.json]({{< relref "../../metadata.md" >}}) file.

```json
{
  "logs": true
}
```

### Step 2: Construct the log data

As it does with metrics data, Grafana expects your plugin to return log data as a [data frame]({{< relref "../../introduction-to-plugin-development/data-frames.md" >}}).

To return log data, return a data frame with at least one time field and one text field from the data source's `query` method.

**Example:**

```ts
const frame = new MutableDataFrame({
  refId: query.refId,
  fields: [
    { name: 'time', type: FieldType.time },
    { name: 'content', type: FieldType.string },
  ],
});

frame.add({ time: 1589189388597, content: 'user registered' });
frame.add({ time: 1589189406480, content: 'user logged in' });
```

That's all you need to start returning log data from your data source. Go ahead and try it out in [Explore]({{< relref "../../../../explore" >}}) or by adding a [Logs panel]({{< relref "../../../../panels-visualizations/visualizations/logs" >}}).

Congratulations, you just wrote your first logs data source plugin! Next, let's look at a couple of features that can further improve the experience for the user.

## Enhance your logs data source plugin with optional features

Add visualization type hints, labels, and other optional features to logs.

### Add a preferred visualization type hint to the data frame

To make sure Grafana recognizes data as logs and shows logs visualization automatically in Explore, set `meta.preferredVisualisationType` to `'logs'` in the returned data frame. See [Selecting preferred visualization section]({{< relref "../extend-a-plugin/add-support-for-explore-queries#select-a-preferred-visualization-type" >}})

**Example:**

```ts
const frame = new MutableDataFrame({
  refId: query.refId,
  meta: {
    preferredVisualisationType: 'logs',
  },
  fields: [
    { name: 'time', type: FieldType.time },
    { name: 'content', type: FieldType.string },
  ],
});
```

### Add labels to your logs

Many log systems let you query logs based on metadata, or _labels_, to help filter log lines.

Add labels to a stream of logs by setting the `labels` property on the Field.

**Example**:

```ts
const frame = new MutableDataFrame({
  refId: query.refId,
  fields: [
    { name: 'time', type: FieldType.time },
    { name: 'content', type: FieldType.string, labels: { filename: 'file.txt' } },
  ],
});

frame.add({ time: 1589189388597, content: 'user registered' });
frame.add({ time: 1589189406480, content: 'user logged in' });
```

### Extract detected fields from your logs

Add additional information about each log line by supplying more data frame fields.

If a data frame has more than one text field, then Grafana assumes the first field in the data frame to be the actual log line. Grafana treats subsequent text fields as detected fields.

Any number of custom fields can be added to your data frame; Grafana comes with two dedicated fields: `levels` and `id`.

#### Levels

To set the level for each log line, add a `level` field.

**Example:**

```ts
const frame = new MutableDataFrame({
  refId: query.refId,
  fields: [
    { name: 'time', type: FieldType.time },
    { name: 'content', type: FieldType.string, labels: { filename: 'file.txt' } },
    { name: 'level', type: FieldType.string },
  ],
});

frame.add({ time: 1589189388597, content: 'user registered', level: 'info' });
frame.add({ time: 1589189406480, content: 'unknown error', level: 'error' });
```

#### 'id' for assigning unique identifiers to log lines

By default, Grafana offers basic support for deduplicating log lines. You can improve the support by adding an `id` field to explicitly assign identifiers to each log line.

**Example:**

```ts
const frame = new MutableDataFrame({
  refId: query.refId,
  fields: [
    { name: 'time', type: FieldType.time },
    { name: 'content', type: FieldType.string, labels: { filename: 'file.txt' } },
    { name: 'level', type: FieldType.string },
    { name: 'id', type: FieldType.string },
  ],
});

frame.add({ time: 1589189388597, content: 'user registered', level: 'info', id: 'd3b07384d113edec49eaa6238ad5ff00' });
frame.add({ time: 1589189406480, content: 'unknown error', level: 'error', id: 'c157a79031e1c40f85931829bc5fc552' });
```
