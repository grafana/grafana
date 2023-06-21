---
title: Set up Environment
---

Before you can get started building plugins, you need to set up your environment for plugin development.

To discover plugins, Grafana scans a _plugin directory_, the location of which depends on your operating system.

1. Create a directory called `grafana-plugins` in your preferred workspace.

1. Find the `plugins` property in the Grafana configuration file and set the `plugins` property to the path of your `grafana-plugins` directory. Refer to the [Grafana configuration documentation](/docs/grafana/latest/installation/configuration/#plugins) for more information.

   ```ini
   [paths]
   plugins = "/path/to/grafana-plugins"
   ```

1. Restart Grafana if it's already running, to load the new configuration.

### Alternative method: Docker

If you don't want to install Grafana on your local machine, you can use [Docker](https://www.docker.com).

To set up Grafana for plugin development using Docker, run the following command:

```
docker run -d -p 3000:3000 -v "$(pwd)"/grafana-plugins:/var/lib/grafana/plugins --name=grafana grafana/grafana:7.0.0
```

Since Grafana only loads plugins on start-up, you need to restart the container whenever you add or remove a plugin.

```
docker restart grafana
```
