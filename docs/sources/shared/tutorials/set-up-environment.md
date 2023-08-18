---
labels:
  products:
    - enterprise
    - oss
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

### Alternative method: Docker compose

If you don't want to install Grafana on your local machine, you can use [Docker Compose](https://docs.docker.com/compose).

The template create by `@grafana/create-plugin` contains a `docker-compose.yaml` file with everything necessary and you just have to run:

```
docker compose up -d
```

or you can you use the provided `package.json` scripts:

```
npm run server
```

and if you need a Grafana version different than what is defined in the `docker-compose.yaml`, set the `GRAFANA_VERSION` environment variable when running
the previous commands.


Since Grafana only loads plugins on start-up, you need to restart the container whenever you add or remove a plugin.

```
docker compose restart
```
