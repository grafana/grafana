# App with extensions

This app was initially copied from the [app-with-extensions](https://github.com/grafana/grafana-plugin-examples/tree/main/examples/app-with-extensions) example plugin. The plugin bundle is using AMD, but it's not minified and the plugin feature set is small so it should be possible to make changes in this file if necessary.

To test this app:

```sh
# start e2e test instance (it will install this plugin)
PORT=3000 ./scripts/grafana-server/start-server
# run Playwright tests using Playwright VSCode extension or with the following script
yarn e2e:playwright
```
