---
title: Build a data source backend plugin
description: Create a backend for your data source plugin.
weight: 400
keywords:
  - grafana
  - plugins
  - plugin
  - backend
  - backend data source
  - datasource
---

## Introduction

Grafana supports a wide range of data sources, including Prometheus, MySQL, and even Datadog. There's a good chance you can already visualize metrics from the systems you have set up. In some cases, though, you already have an in-house metrics solution that you’d like to add to your Grafana dashboards. This tutorial teaches you to build a support for your data source.

For more information about backend plugins, refer to the documentation on [Backend plugins](/docs/grafana/latest/developers/plugins/backend/).

In this tutorial, you'll:

- Build a backend for your data source
- Implement a health check for your data source
- Enable Grafana Alerting for your data source

{{% class "prerequisite-section" %}}

#### Prerequisites

- Knowledge about how data sources are implemented in the frontend.
- Grafana 7.0
- Go ([Version](https://github.com/grafana/plugin-tools/blob/main/packages/create-plugin/templates/backend/go.mod#L3))
- [Mage](https://magefile.org/)
- NodeJS ([Version](https://github.com/grafana/plugin-tools/blob/main/packages/create-plugin/templates/common/package.json#L66))
- yarn
  {{% /class %}}

## Set up your environment

{{< docs/shared lookup="tutorials/set-up-environment.md" source="grafana" version="latest" >}}

## Create a new plugin

To build a backend for your data source plugin, Grafana requires a binary that it can execute when it loads the plugin during start-up. In this guide, we will build a binary using the [Grafana plugin SDK for Go]({{< relref "../../introduction-to-plugin-development/backend/grafana-plugin-sdk-for-go" >}}).

The easiest way to get started is to use the Grafana [create-plugin tool](https://www.npmjs.com/package/@grafana/create-plugin). Navigate to the plugin folder that you configured in step 1 and type:

```
npx @grafana/create-plugin@latest
```

Follow the steps and select **datasource** as your plugin type and answer **yes** when prompted to create a backend for your plugin.

```bash
cd my-plugin
```

Install frontend dependencies and build frontend parts of the plugin to _dist_ directory:

```bash
yarn install
yarn build
```

Run the following to update [Grafana plugin SDK for Go]({{< relref "../../introduction-to-plugin-development/backend/grafana-plugin-sdk-for-go" >}}) dependency to the latest minor version:

```bash
go get -u github.com/grafana/grafana-plugin-sdk-go
go mod tidy
```

Build backend plugin binaries for Linux, Windows and Darwin to _dist_ directory:

```bash
mage -v
```

Now, let's verify that the plugin you've built so far can be used in Grafana when creating a new data source:

1. Restart your Grafana instance.
1. Open Grafana in your web browser.
1. Navigate via the side-menu to **Configuration** -> **Data Sources**.
1. Click **Add data source**.
1. Find your newly created plugin and select it.
1. Enter a name and then click **Save & Test** (ignore any errors reported for now).

You now have a new data source instance of your plugin that is ready to use in a dashboard:

1. Navigate via the side-menu to **Create** -> **Dashboard**.
1. Click **Add new panel**.
1. In the query tab, select the data source you just created.
1. A line graph is rendered with one series consisting of two data points.
1. Save the dashboard.

### Troubleshooting

#### Grafana doesn't load my plugin

By default, Grafana requires backend plugins to be signed. To load unsigned backend plugins, you need to
configure Grafana to [allow unsigned plugins](/docs/grafana/latest/plugins/plugin-signature-verification/#allow-unsigned-plugins).
For more information, refer to [Plugin signature verification](/docs/grafana/latest/plugins/plugin-signature-verification/#backend-plugins).

## Anatomy of a backend plugin

The folders and files used to build the backend for the data source are:

| file/folder        | description                                                                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Magefile.go`      | It’s not a requirement to use mage build files, but we strongly recommend using it so that you can use the build targets provided by the plugin SDK. |
| `/go.mod `         | Go modules dependencies, [reference](https://golang.org/cmd/go/#hdr-The_go_mod_file)                                                                 |
| `/src/plugin.json` | A JSON file describing the backend plugin                                                                                                            |
| `/pkg/main.go`     | Starting point of the plugin binary.                                                                                                                 |

#### plugin.json

The [plugin.json](/docs/grafana/latest/developers/plugins/metadata/) file is required for all plugins. When building a backend plugin these properties are important:

| property   | description                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| backend    | Should be set to `true` for backend plugins. This tells Grafana that it should start a binary when loading the plugin.                                        |
| executable | This is the name of the executable that Grafana expects to start, see [plugin.json reference](/docs/grafana/latest/developers/plugins/metadata/) for details. |
| alerting   | Should be set to `true` if your backend datasource supports alerting.                                                                                         |

In the next step we will look at the query endpoint!

## Implement data queries

We begin by opening the file `/pkg/plugin/plugin.go`. In this file you will see the `SampleDatasource` struct which implements the [backend.QueryDataHandler](https://pkg.go.dev/github.com/grafana/grafana-plugin-sdk-go/backend?tab=doc#QueryDataHandler) interface. The `QueryData` method on this struct is where the data fetching happens for a data source plugin.

Each request contains multiple queries to reduce traffic between Grafana and plugins. So you need to loop over the slice of queries, process each query, and then return the results of all queries.

In the tutorial we have extracted a method named `query` to take care of each query model. Since each plugin has their own unique query model, Grafana sends it to the backend plugin as JSON. Therefore the plugin needs to `Unmarshal` the query model into something easier to work with.

As you can see the sample only returns static numbers. Try to extend the plugin to return other types of data.

You can read more about how to [build data frames in our docs](/docs/grafana/latest/developers/plugins/data-frames/).

## Add support for health checks

Implementing the health check handler allows Grafana to verify that a data source has been configured correctly.

When editing a data source in Grafana's UI, you can **Save & Test** to verify that it works as expected.

In this sample data source, there is a 50% chance that the health check will be successful. Make sure to return appropriate error messages to the users, informing them about what is misconfigured in the data source.

Open `/pkg/plugin/plugin.go`. In this file you'll see that the `SampleDatasource` struct also implements the [backend.CheckHealthHandler](https://pkg.go.dev/github.com/grafana/grafana-plugin-sdk-go/backend?tab=doc#CheckHealthHandler) interface. Navigate to the `CheckHealth` method to see how the health check for this sample plugin is implemented.

## Add authentication

Implementing authentication allows your plugin to access protected resources like databases or APIs. To learn more about how to authenticate using a backend plugin, refer to [our documentation]({{< relref "../extend-a-plugin/add-authentication-for-data-source-plugins/#authenticate-using-a-backend-plugin" >}}).

## Enable Grafana Alerting

1. Open _src/plugin.json_.
1. Add the top level `backend` property with a value of `true` to specify that your plugin supports Grafana Alerting, e.g.
   ```json
   {
     ...
     "backend": true,
     "executable": "gpx_simple_datasource_backend",
     "alerting": true,
     "info": {
     ...
   }
   ```
1. Rebuild frontend parts of the plugin to _dist_ directory:

```bash
yarn build
```

1. Restart your Grafana instance.
1. Open Grafana in your web browser.
1. Open the dashboard you created earlier in the _Create a new plugin_ step.
1. Edit the existing panel.
1. Click on the _Alert_ tab.
1. Click on _Create Alert_ button.
1. Edit condition and specify _IS ABOVE 10_. Change _Evaluate every_ to _10s_ and clear the _For_ field to make the alert rule evaluate quickly.
1. Save the dashboard.
1. After some time the alert rule evaluates and transitions into _Alerting_ state.

## Summary

In this tutorial you created a backend for your data source plugin.
