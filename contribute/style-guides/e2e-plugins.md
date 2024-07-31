# E2E tests for plugins

Grafana provides the [`@grafana/plugin-e2e`](https://www.npmjs.com/package/@grafana/plugin-e2e?activeTab=readme) tool for testing end-to-end Grafana plugins. The `@grafana/plugin-e2e` tool extends [`@playwright/test`](https://playwright.dev/) capabilities with relevant fixtures, models, and expect matchers to simplify plugin development.

You can use the tool to enable comprehensive end-to-end testing of Grafana plugins across multiple versions of Grafana. For information on how to get started with plugin end-to-end testing and Playwright, refer to the [E2E Get started](https://grafana.com/developers/plugin-tools/e2e-test-a-plugin/get-started) guide.

## Add end-to-end tests for a core plugin

Playwright end-to-end tests for plugins should be added to the [`e2e/plugin-e2e`](https://github.com/grafana/grafana/tree/main/e2e/plugin-e2e) directory in a specific _project_. In Playwright's terminology, [projects](https://playwright.dev/docs/test-projects) are logical groupings of tests. All tests in a Playwright project share the same configuration.

1. Add a new directory with the same name as your plugin at [`https://github.com/grafana/grafana/tree/main/e2e/plugin-e2e`](https://github.com/grafana/grafana/tree/main/e2e/plugin-e2e). This is where your plugin tests are kept.

1. In the [Playwright configuration file](https://github.com/grafana/grafana/blob/main/playwright.config.ts), add a new project item. Make sure the `name` and the `testDir` subdirectory match the name of the directory that contains your plugin tests.

1. Add `'authenticate'` to the list of dependencies and specify `'playwright/.auth/admin.json'` as a storage state to ensure that all tests in your project start already authenticated as an admin user.

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

   > **Note:** If you want to use a different role or test RBAC for some of your tests, refer to the plugin-e2e [documentation](https://grafana.com/developers/plugin-tools/e2e-test-a-plugin/use-authentication).

1. Update the [`CODEOWNERS`](https://github.com/grafana/grafana/blob/main/.github/CODEOWNERS/#L315) file so that your team is specified as the owner of the tests in the directory you previously added in step 1.

## E2E test commands

The `yarn e2e:playwright` command runs all Playwright tests. Optionally, you can provide the `--project mysql` argument to run tests in a specific project.

The `yarn e2e:playwright` script assumes that you have Grafana running on `localhost:3000`. You can change the host by supplying environment variables. For example:

- `HOST=127.0.0.1 PORT=3001 yarn e2e:playwright`

The `yarn e2e:playwright:server` command starts a Grafana [development server](https://github.com/grafana/grafana/blob/main/scripts/grafana-server/start-server) on port `3001` and runs the Playwright tests. This development server is provisioned with the [devenv](https://github.com/grafana/grafana/blob/main/contribute/developer-guide.md#add-data-sources) dashboards, data sources, and apps.
