# End-to-end tests for plugins

When end-to-end testing Grafana plugins, a best practice is to use the [`@grafana/plugin-e2e`](https://www.npmjs.com/package/@grafana/plugin-e2e?activeTab=readme) testing tool. The `@grafana/plugin-e2e` tool extends [`@playwright/test`](https://playwright.dev/) capabilities with relevant fixtures, models, and expect matchers. Use it to enable comprehensive end-to-end testing of Grafana plugins across multiple versions of Grafana.

> **Note:** To learn more, refer to our documentation on [plugin development](https://grafana.com/developers/plugin-tools/) and [end-to-end plugin testing](https://grafana.com/developers/plugin-tools/e2e-test-a-plugin/get-started).

## Add end-to-end tests for a core plugin

You can add Playwright end-to-end tests for plugins to the [`e2e-playwright/plugin-e2e`](https://github.com/grafana/grafana/tree/main/e2e-playwright/plugin-e2e) directory.

1. Add a new directory that has the name as your plugin [`here`](https://github.com/grafana/grafana/tree/main/e2e-playwright/plugin-e2e). This is the directory where your plugin tests will be kept.

1. Playwright uses [projects](https://playwright.dev/docs/test-projects) to logically group tests together. All tests in a project share the same configuration.
   In the [Playwright config file](https://github.com/grafana/grafana/blob/main/playwright.config.ts), add a new project item. Make sure the `name` and the `testDir` subdirectory match the name of the directory that contains your plugin tests.
   Add `'authenticate'` to the list of dependencies and specify `'playwright/.auth/admin.json'` as the storage state to ensure that all tests in your project will start already authenticated as an admin user. If you want to use a different role for and perhaps test RBAC for some of your tests, refer to our [documentation](https://grafana.com/developers/plugin-tools/e2e-test-a-plugin/use-authentication).

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

1. Update the [CODEOWNERS](https://github.com/grafana/grafana/blob/main/.github/CODEOWNERS/#L315) file so that your team is owner of the tests in the directory you added in step 1.

## Commands

- `yarn e2e:playwright` runs all Playwright tests. Optionally, you can provide the `--project mysql` argument to run tests in a specific project.

  The `yarn e2e:playwright` command starts a Grafana [development server](https://github.com/grafana/grafana/blob/main/scripts/grafana-server/start-server) on port 3001 and runs the Playwright tests.

  You can run against an arbitrary instance by setting the `GRAFANA_URL` environment variable:

  `GRAFANA_URL=http://localhost:3000 yarn e2e:playwright`

  Note this will not start a development server, so you must ensure that Grafana is running and accessible at the specified URL.

- You can provision the development server with the [devenv](https://github.com/grafana/grafana/blob/main/contribute/developer-guide.md#add-data-sources) dashboards, data sources, and apps.
