---
aliases:
  - ../plugins/developing/
description: Resources for creating Grafana plugins
title: Build a plugin
weight: 200
---

# Welcome to the Grafana plugin developer's guide

Grafana is an open source software project for creating, exploring, and sharing all of your data through beautiful, flexible dashboards. Plugins extend its built-in functionality so that users can accomplish specialized tasks to make Grafana even more useful for them. 

Many plugins are available in the [Catalog](https://grafana.com/grafana/plugins/) and others are built by developers for private use or to contribute them to the open source community. 

If you are a Grafana plugin developer or want to become one, this documentation is for you. Use it to get productive quickly, follow along with step-by-step tutorials, or you can refer back to it as you develop.  

## Plugin basics

These are among the types of plugins you can create:

- **Panel plugins** - Visualize data and navigating between dashboards.
- **Data source plugins** - Link to new databases or other sources of data.
- **App plugins** - Bundle panels and data sources together to create a better user experience.
- **Other plugins** - Visualize data source logs or streaming data sources.

   Note: To learn more about the types of plugins you can build, refer to the [Plugin Overview]({{< relref "../../administration/plugin-management/" >}}) documentation.

## Contents of this developer's guide

The following topics give you an idea of what to expect from this guide:

- **[Get started with plugins](get-started-with-plugins/)** - The easiest way to start developing Grafana plugins is to use the Create-plugin tool. Use it to get your plugin up and running as fast as possible. 
- **[Introduction to plugin development](introduction-to-plugin-development/)** - Ground yourself by learning the key concepts involved in Grafana plugin development. For example, learn about frontend and backend development processes, data frames, and error handling. 
- **[Create a Grafana plugin](create-a-grafana-plugin)** - If you are already familiar with plugin creation basics, then it's time to dive deeper into specific development scenarios. You will find tutorials for creating panel plugins, data source plugins, and more. 
- **[Migrate a plugin](migration-guide)** - Learn how to upgrade from a previous version of a Grafana plugin, rewrite an old Angular plugin in React, or update to a newer version. 
- **[Publish a Grafana plugin](publish-a-plugin/)**  - Here you'll find what you need to know if you want to publish a plugin to the Grafana Catalog, including publishing criteria, signing process, and publishing.
- **[Legacy plugins](legacy/)** - If you find yourself needing to work with Legacy plugins, check here for recommendations.
- **[Reference](reference/)** - Description of the Plugin.json schema and plugin metadata.

## Go further

Learn more about additional tools and find useful examples of a variety of plugin types.

### User interface creation

Explore the many UI components in our [Grafana UI library](https://developers.grafana.com/ui).

### Code examples

For inspiration, check out our [plugin examples](https://github.com/grafana/grafana-plugin-examples).

### SDK

Learn more about [Grafana Plugin SDK for Go]({{< relref "backend/grafana-plugin-sdk-for-go.md" >}}).
