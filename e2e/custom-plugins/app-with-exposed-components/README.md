# App with exposed components

This directory contains two apps - `myorg-componentconsumer-app` and `myorg-componentexposer-app` which is nested inside `myorg-componentconsumer-app`.

`myorg-componentconsumer-app` exposes a simple React component using the [`exposeComponent`](https://grafana.com/developers/plugin-tools/reference/ui-extensions#exposecomponent) api. `myorg-componentconsumer-app` in turn, consumes this compoment using the [`https://grafana.com/developers/plugin-tools/reference/ui-extensions#useplugincomponent`](https://grafana.com/developers/plugin-tools/reference/ui-extensions#useplugincomponent) hook.

To test this app:

```sh
# start e2e test instance (it will install this plugin)
PORT=3000 ./scripts/grafana-server/start-server
# run Playwright tests using Playwright VSCode extension or with the following script
yarn e2e:playwright
```

or

```
PORT=3000 ./scripts/grafana-server/start-server
yarn start
yarn e2e
```
