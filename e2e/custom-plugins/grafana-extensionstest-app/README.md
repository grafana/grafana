# Extensions test plugins

This is an app plugin containing nested app plugins that are used for testing the plugins ui extensions APIs.

Further reading:

- [Plugin Ui Extensions docs](https://grafana.com/developers/plugin-tools/how-to-guides/ui-extensions/)
- [Plugin E2e testing docs](https://grafana.com/developers/plugin-tools/e2e-test-a-plugin/introduction)

## Build

To build this plugin run `yarn e2e:plugin:build`.

## Development

To develop this plugin run `yarn e2e:plugin:build:dev`.

Note that this plugin extends the `@grafana/plugin-configs` configs which is why it has no src directory and uses a custom webpack config to copy necessary files.

## Testing

Testing locally can be done by first building this plugin then starting the server and running the tests:

- run either `yarn e2e:plugin:build`, `yarn e2e:plugin:build:dev` depending on your needs
- `yarn e2e:playwright:server`
- `yarn e2e:playwright`
