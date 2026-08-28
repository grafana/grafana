# Extensions test plugins

This is an app plugin containing nested app plugins that are used for testing the plugins ui extensions APIs.

Further reading:

- [Plugin Ui Extensions docs](https://grafana.com/developers/plugin-tools/how-to-guides/ui-extensions/)
- [Plugin E2e testing docs](https://grafana.com/developers/plugin-tools/e2e-test-a-plugin/introduction)

## Build

To build this plugin run `pnpm run e2e:plugin:build`.

## Development

1: Install frontend dependencies:
`pnpm install --frozen-lockfile`

2: Build and watch the core frontend
`pnpm run start`

3: Build and watch the test plugins
`pnpm run e2e:plugin:build:dev`

4: Build the backend
`make build-go`

5: Start the Grafana e2e test server with the provisioned test plugin
`PORT=3000 ./scripts/grafana-server/start-server`

Note that this plugin extends the `@grafana/plugin-configs` configs which is why it has no src directory and uses a custom webpack config to copy necessary files.

## Run Playwright tests

- `pnpm exec playwright test --project extensions-test-app`
