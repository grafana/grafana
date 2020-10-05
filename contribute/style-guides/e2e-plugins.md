# End-to-End Tests for plugins

Be sure that you've read the [generalized E2E document](e2e.md).

## Commands

- `yarn test:e2e` will run [Grafana's E2E utility](../../packages/grafana-e2e) against an already running Grafana server.
- `yarn test:e2e:update` will run `test:e2e` but instead of asserting that screenshots match their expected fixtures, they'll be replaced with new ones.

Your running Grafana instance can be targeted by setting the `CYPRESS_BASE_URL`, `CYPRESS_USERNAME` and `CYPRESS_PASSWORD` environment variableS:

```shell
CYPRESS_BASE_URL=https://localhost:3000 CYPRESS_USERNAME=admin CYPRESS_PASSWORD=admin yarn test:e2e
```

## Test suites

All tests are located at _\<repo-root>/cypress/integration_ by default.

## Things to test

- Add data source (if applicable)
- Add panel
- Edit panel
- Annotations (if applicable)
- Aliases (if applicable)
- Template variables
- "Explore" view
