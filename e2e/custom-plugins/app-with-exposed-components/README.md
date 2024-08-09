# App with exposed components

This myorg-componentconsumer-app app uses the `usePluginComponent` hook to render a component that is exposed by the myorg-componentexposer-app app. The myorg-componentexposer-app app is nested inside the myorg-componentconsumer-app app.

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
