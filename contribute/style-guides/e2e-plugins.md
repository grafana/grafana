# end-to-end tests for plugins

When end-to-end testing Grafana plugins, it's recommended to use the [`@grafana/plugin-e2e`](https://www.npmjs.com/package/@grafana/plugin-e2e?activeTab=readme) testing tool. `@grafana/plugin-e2e` extends [`@playwright/test`](https://playwright.dev/) capabilities with relevant fixtures, models, and expect matchers; enabling comprehensive end-to-end testing of Grafana plugins across multiple versions of Grafana. For information on how to get started with Plugin end-to-end testing and Playwright, checkout the [Get started](https://grafana.com/developers/plugin-tools/e2e-test-a-plugin/get-started) guide.

## Adding end-to-end tests for a core plugin

Playwright end-to-end tests for plugins should be added to the [`e2e/plugin-e2e`](https://github.com/grafana/grafana/tree/main/e2e/plugin-e2e) directory.

1. Add a new directory that has the name as your plugin [`here`](https://github.com/grafana/grafana/tree/main/e2e/plugin-e2e). This is where your plugin tests will be kept.

2. Playwright uses [projects](https://playwright.dev/docs/test-projects) to logically group tests together. All tests in a project share the same configuration.
   In the [Playwright config file](https://github.com/grafana/grafana/blob/main/playwright.config.ts), add a new project item. Make sure the `name` and the `testDir` sub directory matches the name of the directory that contains your plugin tests.
   Adding `'authenticate'` to the list of dependencies and specifying `'playwright/.auth/admin.json'` as storage state will ensure all tests in your project will start already authenticated as an admin user. If you wish to use a different role for and perhaps test RBAC for some of your tests, please refer to the plugin-e2e [documentation](https://grafana.com/developers/plugin-tools/e2e-test-a-plugin/use-authentication).

   ```ts
   {
      name: 'mysql',
      testDir: path.join(testDirRoot, '/mysql'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['authenticate'],
    },
   ```

3. Update the [CODEOWNERS](https://github.com/grafana/grafana/blob/main/.github/CODEOWNERS/#L315) file so that your team is owner of the tests in the directory you added in step 1.

## Commands

- `yarn e2e:playwright` will run all Playwright tests. Optionally, you can provide the `--project mysql` argument to run tests in a certain project.

The script above assumes you have Grafana running on `localhost:3000`. You may change this by providing environment variables.

`HOST=127.0.0.1 PORT=3001 yarn e2e:playwright`

- `yarn e2e:playwright:server` will start a Grafana [development server](https://github.com/grafana/grafana/blob/main/scripts/grafana-server/start-server) on port 3001 and run the Playwright tests. The development server is provisioned with the [devenv](https://github.com/grafana/grafana/blob/main/contribute/developer-guide.md#add-data-sources) dashboards, data sources and apps.
