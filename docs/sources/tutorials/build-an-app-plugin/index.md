---
title: Build an app plugin
summary: Learn at how to create an app for Grafana.
description: Learn at how to create an app for Grafana.
id: build-an-app-plugin
categories: ['plugins']
tags: ['beginner']
status: Published
authors: ['grafana_labs']
Feedback Link: https://github.com/grafana/tutorials/issues/new
weight: 50
draft: true
---

## Introduction

App plugins are Grafana plugins that can bundle data source and panel plugins within one package. They also let you create _custom pages_ within Grafana. Custom pages enable the plugin author to include things like documentation, sign-up forms, or to control other services over HTTP.

Data source and panel plugins will show up like normal plugins. The app pages will be available in the main menu.

{{% class "prerequisite-section" %}}

### Prerequisites

- Grafana 7.0
- NodeJS 12.x
- yarn
  {{% /class %}}

## Set up your environment

{{< docs/shared lookup="tutorials/set-up-environment.md" source="grafana" version="latest" >}}

## Create a new plugin

{{< docs/shared lookup="tutorials/create-plugin.md" source="grafana" version="latest" >}}

## Anatomy of a plugin

{{< docs/shared lookup="tutorials/plugin-anatomy.md" source="grafana" version="latest" >}}

## App plugins

App plugins let you bundle resources such as dashboards, panels, and data sources into a single plugin.

Any resource you want to include needs to be added to the `includes` property in the `plugin.json` file. To add a resource to your app plugin, you need to include it to the `plugin.json`.

Plugins that are included in an app plugin are available like any other plugin.

Dashboards and pages can be added to the app menu by setting `addToNav` to `true`.

By setting `"defaultNav": true`, users can navigate to the dashboard by clicking the app icon in the side menu.

## Add a custom page

App plugins let you extend the Grafana user interface through the use of _custom pages_.

Any requests sent to `/a/<plugin-id>`, e.g. `/a/myorgid-simple-app/`, are routed to the _root page_ of the app plugin. The root page is a React component that returns the content for a given route.

While you're free to implement your own routing, in this tutorial you'll use a tab-based navigation page that you can use by calling `onNavChange`.

Let's add a tab for managing server instances.

1. In the `src/pages` directory, add a new file called `Instances.tsx`. This component contains the content for the new tab.

   ```ts
   import { AppRootProps } from '@grafana/data';
   import React from 'react';

   export const Instances = ({ query, path, meta }: AppRootProps) => {
     return <p>Hello</p>;
   };
   ```

1. Register the page by adding it to the `pages` array in `src/pages/index.ts`.

   **index.ts**

   ```ts
   import { Instances } from './Instances';
   ```

   ```ts
   {
     component: Instances,
     icon: 'file-alt',
     id: 'instances',
     text: 'Instances',
   }
   ```

1. Add the page to the app menu, by including it in `plugin.json`. This will be the main view of the app, so we'll set `defaultNav` to let users quickly get to it by clicking the app icon in the side menu.

   **plugin.json**

   ```json
   "includes": [
     {
       "type": "page",
       "name": "Instances",
       "path": "/a/myorgid-simple-app?tab=instances",
       "role": "Viewer",
       "addToNav": true,
       "defaultNav": true
     }
   ]
   ```

> **Note:** While `page` includes typically reference pages created by the app, you can set `path` to any URL, internal or external. Try setting `path` to `https://grafana.com`.

## Configure the app

Let's add a new configuration page where users are able to configure default zone and regions for any instances they create.

1. In `module.ts`, add new configuration page using the `addConfigPage` method. `body` is the React component that renders the page content.

   **module.ts**

   ```ts
   .addConfigPage({
     title: 'Defaults',
     icon: 'fa fa-info',
     body: DefaultsConfigPage,
     id: 'defaults',
   })
   ```

## Add a dashboard

#### Include a dashboard in your app

1. In `src/`, create a new directory called `dashboards`.
1. Create a file called `overview.json` in the `dashboards` directory.
1. Copy the JSON definition for the dashboard you want to include and paste it into `overview.json`. If you don't have one available, you can find a sample dashboard at the end of this step.
1. In `plugin.json`, add the following object to the `includes` property.

   - The `name` of the dashboard needs to be the same as the `title` in the dashboard JSON model.
   - `path` points out the file that contains the dashboard definition, relative to the `plugin.json` file.

   ```json
   "includes": [
     {
       "type": "dashboard",
       "name": "System overview",
       "path": "dashboards/overview.json",
       "addToNav": true
     }
   ]
   ```

1. Save and restart Grafana to load the new changes.

## Bundle a plugin

An app plugin can contain panel and data source plugins that get installed along with the app plugin.

In this step, you'll add a data source to your app plugin. You can add panel plugins the same way by changing `datasource` to `panel`.

1. In `src/`, create a new directory called `datasources`.
1. Create a new data source using Grafana create-plugin tool in a temporary directory.

   ```bash
   mkdir tmp
   cd tmp
   npx @grafana/create-plugin@latest
   ```

1. Move the `src` directory in the data source plugin to `src/datasources`, and rename it to `my-datasource`.

   ```bash
   mv ./my-datasource/src ../src/datasources/my-datasource
   ```

Any bundled plugins are built along with the app plugin. Grafana looks for any subdirectory containing a `plugin.json` file and attempts to load a plugin in that directory.

To let users know that your plugin bundles other plugins, you can optionally display it on the plugin configuration page. This is not done automatically, so you need to add it to the `plugin.json`.

1. Include the data source in the `plugin.json`. The `name` property is only used for displaying in the Grafana UI.

   ```json
   "includes": [
     {
       "type": "datasource",
       "name": "My data source"
     }
   ]
   ```

#### Include external plugins

If you want to let users know that your app requires an existing plugin, you can add it as a dependency in `plugin.json`. Note that they'll still need to install it themselves.

```json
"dependencies": {
  "plugins": [
    {
      "type": "panel",
      "name": "Worldmap Panel",
      "id": "grafana-worldmap-panel",
      "version": "^0.3.2"
    }
  ]
}
```

## Summary

In this tutorial you learned how to create an app plugin.
