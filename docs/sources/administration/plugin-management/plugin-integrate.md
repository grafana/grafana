---
title: Integrate your plugins
description: Allow plugin frontends to communicate locally with the backends of other installed plugins.
labels:
  products:
    - enterprise
    - oss
    - cloud
keywords:
  - grafana
  - plugins
  - plugin
  - navigation
  - customize
  - configuration
  - grafana.ini
  - sandbox
  - frontend
weight: 350
---

# Integrate your plugins

You can configure your Grafana instance to let the frontends of installed plugins directly communicate locally with the backends of other installed plugins.

By default, you can only communicate with plugin backends remotely. You can use this configuration to, for example, enable a [canvas panel](https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/canvas/) to call an application resource API that is permitted by the `actions_allow_post_url` option.

To enable backend communication between plugins:

1. Set the plugins you want to communicate with. In your configuration file (`grafana.ini` or `custom.ini` depending on your operating system) remove the semicolon to enable and then set the following configuration option:

   ```
   actions_allow_post_url=
   ```

   This is a comma-separated list that uses glob matching.
   - To allow access to all plugins that have a backend:

     ```
     actions_allow_post_url=/api/plugins/*
     ```

   - To access to the backend of only one plugin:

     ```
     actions_allow_post_url=/api/plugins/<GRAFANA_SPECIAL_APP>
     ```
