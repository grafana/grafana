# End-to-end tests

Grafana Labs uses a minimal [homegrown solution](https://github.com/grafana/plugin-tools/tree/main/packages/plugin-e2e) built on top of [Playwright](https://playwright.dev/) for its end-to-end (E2E) tests.

Important notes:

- We generally store all element identifiers ([CSS selectors](https://mdn.io/docs/Web/CSS/CSS_Selectors)) within the framework for reuse and maintainability.
- We generally do not use stubs or mocks as to fully simulate a real user.
- We also use Playwright for the [plugins' end-to-end tests](contribute/style-guides/e2e-plugins.md).

## Framework structure

Our framework structure is inspired by [Martin Fowler's Page Object](https://martinfowler.com/bliki/PageObject.html).

- **`Selector`**: A unique identifier that is used from the E2E framework to retrieve an element from the browser
- **`Page`**: An abstraction for an object that contains one or more `Selector` identifiers with the `visit` function to go to the page.
- **`Component`**: An abstraction for an object that contains one or more `Selector` identifiers but without the `visit` function
- **`Flow`**: An abstraction that contains a sequence of actions on one or more `Page` abstractions that can be reused and shared between tests

## How to create an end-to-end Playwright test

### Basic example

Let's start with a simple [JSX](https://reactjs.org/docs/introducing-jsx.html) example containing a single input field that we want to populate during our E2E test:

```jsx
<input className="login-form-input" type="text" />
```

It is possible to target the field with a CSS selector like `.login-form-input`. However, doing so is a brittle solution because style changes occur frequently.

Furthermore, there is nothing that signals to future developers that this input is part of an E2E test. At Grafana, we use `data-testid` attributes as our preferred way of defining selectors. See [Aria-Labels vs data-testid](#aria-labels-vs-data-testid) for more details.

```jsx
<input data-testid="Username input field" className="login-form-input" type="text" />
```

The next step is to add the `Login` page to the `versionedPages` export within [_\<repo-root>/packages/grafana-e2e-selectors/src/selectors/pages.ts_](../../packages/grafana-e2e-selectors/src/selectors/pages.ts) so that it appears when we type `selectors.pages` in your IDE.

```typescript
export const versionedPages = {
  [...]
  Login: {
    url: {
      [MIN_GRAFANA_VERSION]: '/login',
    },
    username: {
      '10.2.3': 'data-testid Username input field',
      [MIN_GRAFANA_VERSION]: 'Username input field',
    },
    password: {
      '10.2.3': 'data-testid Password input field',
      [MIN_GRAFANA_VERSION]: 'Password input field',
    },
    submit: {
      '10.2.3': 'data-testid Login button',
      [MIN_GRAFANA_VERSION]: 'Login button',
    },
    skip: {
      '10.2.3': 'data-testid Skip change password button',
    },
  },
[...]
```

In this example, the username selector is prefixed with `data-testid` and specifies the minimum Grafana version for which the value is valid. The prefix is a signal to the framework to look for the selector in the `data-testid` attribute.

Now that we have a page called `Login` in our `versionedPages` const, use it to add a selector in our HTML as shown in the following example. This page really signals to future developers that it is part of an E2E test.

Example:

```jsx
import { selectors } from '@grafana/e2e-selectors';

<input data-testid={selectors.pages.Login.username} className="login-form-input" type="text" />;
```

The last step in our example is to use our `Login` page as part of a test.

- Use the `url` property whenever you call the [`page.goto()`](https://playwright.dev/docs/api/class-page#page-goto) in Playwright.
- Access any defined selector from the `Login` page by invoking it: [`page.getByTestId()`](https://playwright.dev/docs/api/class-page#page-get-by-test-id).

```typescript
test(
  'Can login successfully',
  {
    tag: ['@acceptance'],
  },
  async ({ selectors, page, grafanaAPICredentials }) => {
    test.skip(grafanaAPICredentials.password === 'admin', 'Does not run with default password');

    await page.goto(selectors.pages.Login.url);

    await page.getByTestId(selectors.pages.Login.username).fill(grafanaAPICredentials.user);
    await page.getByTestId(selectors.pages.Login.password).fill(grafanaAPICredentials.password);

    await page.getByTestId(selectors.pages.Login.submit).click();

    await expect(page.getByTestId(selectors.components.NavToolbar.commandPaletteTrigger)).toBeVisible();
  }
);
```

### Advanced example

Let's take a look at an example that uses the same selector for multiple items in a list for instance. In this example app, there's a list of data sources that we want to click on during an E2E test.

```jsx
<ul>
  {dataSources.map(({ id, name }) => (
    <li className="card-item-wrapper" key={id}>
      <a className="card-item" href={`datasources/edit/${id}`}>
        <div className="card-item-name">{name}</div>
      </a>
    </li>
  ))}
</ul>
```

Like in the basic example, start by creating a page abstraction:

```typescript
export const versionedPages = {
[...]
  DataSources: {
    url: {
      [MIN_GRAFANA_VERSION]: '/datasources',
    },
    dataSources: {
      [MIN_GRAFANA_VERSION]: (dataSourceName: string) => `Data source list item ${dataSourceName}`,
    },
  },
[...]
};
```

You might have noticed that instead of a simple string as the selector, there's a function that takes a string parameter as an argument and returns a formatted string using the argument.

Just as before, you need to add the `DataSources` url to the exported const `versionedPages` in `packages/grafana-e2e-selectors/src/selectors/pages.ts`.

The next step is to use the `dataSources` selector function as in the following example:

```jsx
<ul>
  {dataSources.map(({ id, name }) => (
    <li className="card-item-wrapper" key={id}>
      <a className="card-item" href={`datasources/edit/${id}`}>
        <div className="card-item-name" data-testid={selectors.pages.DataSources.dataSources(name)}>
          {name}
        </div>
      </a>
    </li>
  ))}
</ul>
```

When this list is rendered with the data sources with names `A`, `B` and `C` ,the resulting HTML looks like this:

```html
<div class="card-item-name" data-testid="data-testid Data source list item A">A</div>
<div class="card-item-name" data-testid="data-testid Data source list item B">B</div>
<div class="card-item-name" data-testid="data-testid Data source list item C">C</div>
```

Now we can write our test. The one thing that differs from the previous [basic example](#basic-example) is that we pass in which data source we want to click as an argument to the selector function:

```typescript
test(
  'List test clicks on data source named B',
  {
    tag: ['@datasources'],
  },
  async ({ selectors, page }) => {
    await page.goto(selectors.pages.Datasources.url);
    // Select datasource
    const dataSource = 'B';
    await page.getByTextId(dataSource).click();
  }
);
```

## How to run the Playwright tests:

**Note:** If you're using VS Code as your development editor, it's recommended to install the [Playwright test extension](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright). It allows you to run, debug and generate Playwright tests from within the editor. For more information about the extension and how to use reports to analyze failing tests, refer to the [Playwright documentation](https://playwright.dev/docs/getting-started-vscode).

Each version of Playwright needs specific versions of browser binaries to operate. You need to use the Playwright CLI to install these browsers.

```
yarn playwright install chromium
```

The following script starts a Grafana [development server](https://github.com/grafana/grafana/blob/main/scripts/grafana-server/start-server) (same server that is being used when running e2e tests in CI) on port 3001 and runs all the Playwright tests. The development server is provisioned with the [devenv](https://github.com/grafana/grafana/blob/main/contribute/developer-guide.md#add-data-sources) dashboards, data sources and apps.

```
yarn e2e:playwright
```

You can run against an arbitrary instance by setting the `GRAFANA_URL` environment variable:

```
GRAFANA_URL=http://localhost:3000 yarn e2e:playwright
```

Note this will not start a development server, so you must ensure that Grafana is running and accessible at the specified URL.

### Commands commonly used:

1 - **To open the Playwright UI**. It starts the Grafana server and then Playwright, which runs against this server.

```
yarn e2e:playwright --ui
```

2 - **To run an individual test**. It will run the test that matches the string passed to _grep_. Playwright will run all of them if you use a string that matches multiple tests.

```
yarn e2e:playwright --grep <testname>
```

You can also run all the tests matching a specific tag with _@tagName_.

```
yarn e2e:playwright --grep @<tagname>
```

3 - **To run a project**. It will run the entire project. You can find them in [grafana/playwright.config.ts](https://github.com/grafana/grafana/blob/main/playwright.config.ts#L90).

```
yarn e2e:playwright --project <projectname>
```

4- **To open the last HTML report**. It will open a Chrome window with the test list and the related info (success/error, name, time, steps, ...).

```
yarn playwright show-report
```

You can open an arbitrary report with `yarn playwright show-report <reportLocation>`. For Grafanistas, the reports are also downloable from CI by:

- Clicking through to _End-to-end tests_/_All Playwright tests complete_.
- Clicking _Summary_.
- Download the _playwright-html-<number>_ artifact.
- Unzip.
- Run `yarn playwright show-report <reportLocation>`

You can see the full list in [the Playwright documentation](https://playwright.dev/docs/test-cli#all-options) if you are curious about other commands.

## Playwright for plugins

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

> ### Playwright tests in Grafana Enterprise
>
> We are currently working on make Playwright available for creating end-to-end tests in [grafana-enterprise](https://github.com/grafana/grafana-enterprise).
