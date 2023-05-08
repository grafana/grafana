---
aliases:
  - ../plugins/developing/
description: Resources for creating Grafana plugins
title: Plugin developer's guide
weight: 200
---

# Grafana plugin developer's guide

You can extend Grafana's built-in capabilities with plugins. Plugins enable Grafana to accomplish specialized tasks, custom-tailored to your requirements. By making a plugin for your organization, you can connect Grafana to other data sources, ticketing tools, and CI/CD tooling.

You can create plugins for private use or contribute them to the open source community by publishing to the [Grafana plugin catalog](https://grafana.com/grafana/plugins/). This catalog has hundreds of other community and commercial plugins.

If you are a Grafana plugin developer or want to become one, this plugin developer's guide contains the tutorials and reference materials to help you get started. 

## Plugin basics

You can create several types of plugins, including:

- **Panel plugins** - Visualize data and navigate between dashboards.
- **Data source plugins** - Link to new databases or other sources of data.
- **App plugins** - Create rich applications for custom out-of-the-box experiences.

> **Note:** To learn more about the types of plugins you can build, refer to the [Plugin management]({{< relref "../../administration/plugin-management" >}}) documentation.

## Contents of this developer's guide

The following topics give you an idea of what to expect from this guide:

- **[Get started with plugins]({{< relref "./get-started-with-plugins" >}})** - The easiest way to start developing Grafana plugins is to use the [Create-plugin](https://www.npmjs.com/package/@grafana/create-plugin) tool.
- **[Introduction to plugin development]({{< relref "./introduction-to-plugin-development" >}})** - Ground yourself in the fundamentals of Grafana plugin development: frontend and backend development processes, data frames, error handling, and more.
- **[Create a Grafana plugin]({{< relref "./create-a-grafana-plugin" >}})** - If you're already familiar with plugin creation basics, then it's time to dive deeper into specific development scenarios. You'll find tutorials for creating panel plugins, data source plugins, and more.
- **[Migrate a plugin]({{< relref "./migration-guide" >}})** - Learn how to upgrade from a previous version of a Grafana plugin, rewrite an old Angular plugin in React, or update to a newer version.
- **[Publish a Grafana plugin]({{< relref "./publish-a-plugin" >}})** - Learn about publishing a plugin to the Grafana plugin catalog, including publishing criteria, packaging, and deployment.
- **[Reference]({{< relref "metadata.md" >}})** - Description of the `plugin.json` schema and plugin metadata.

## Go further

Learn more about additional tools and find useful examples of a variety of plugin types.

### User interface creation

Explore the many UI components in our [Grafana UI library](https://developers.grafana.com/ui).

### Plugin examples

Grafana Labs provides a number of best practice example plugins for different use cases to help you quickly get started. Browse our [plugin examples](https://github.com/grafana/grafana-plugin-examples).

### SDK

Learn more about [Grafana Plugin SDK for Go]({{< relref "./backend/grafana-plugin-sdk-for-go" >}}).
