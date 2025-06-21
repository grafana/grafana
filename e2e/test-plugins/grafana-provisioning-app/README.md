# App Provisioning test plugin

This app plugin is used to assert that provisioned dashboards work as expected.

Further reading:

- [App plugin provisioning docs](https://grafana.com/developers/plugin-tools/key-concepts/plugin-types-usage#provisioning-of-app-plugins)
- [Plugin E2e testing docs](https://grafana.com/developers/plugin-tools/e2e-test-a-plugin/introduction)

## Build

To build this plugin run `yarn e2e:plugin:build`.

## Development

1: Install frontend dependencies:
`yarn install --immutable`

2: Build and watch the core frontend
`yarn start`

3: Build and watch the test plugins
`yarn e2e:plugin:build:dev`

4: Build the backend
`make build-go`

5: Start the Grafana e2e test server with the provisioned test plugin
`PORT=3000 ./scripts/grafana-server/start-server`

Note that this plugin extends the `@grafana/plugin-configs` configs which is why it has no src directory and uses a custom webpack config to copy necessary files.

## Run Playwright tests

- `yarn playwright test --project extensions-test-app`
