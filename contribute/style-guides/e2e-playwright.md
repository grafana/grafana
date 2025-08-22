# End-to-end tests

Grafana Labs uses a minimal [homegrown solution](../../e2e/utils/index.ts) built on top of [Playwright](https://playwright.dev/) for its end-to-end (E2E) tests.

Important notes:

- We generally store all element identifiers ([CSS selectors](https://mdn.io/docs/Web/CSS/CSS_Selectors)) within the framework for reuse and maintainability.
- We generally do not use stubs or mocks as to fully simulate a real user.

## Framework structure

Our framework structure is inspired by [Martin Fowler's Page Object](https://martinfowler.com/bliki/PageObject.html).

- **`Selector`**: A unique identifier that is used from the E2E framework to retrieve an element from the browser
- **`Page`**: An abstraction for an object that contains one or more `Selector` identifiers with the `visit` function to go to the page.
- **`Component`**: An abstraction for an object that contains one or more `Selector` identifiers but without the `visit` function
- **`Flow`**: An abstraction that contains a sequence of actions on one or more `Page` abstractions that can be reused and shared between tests

## Basic example

Let's start with a simple [JSX](https://reactjs.org/docs/introducing-jsx.html) example containing a single input field that we want to populate during our E2E test:

```jsx
<input className="gf-form-input login-form-input" type="text" />
```

It is possible to target the field with a CSS selector like `.gf-form-input.login-form-input`. However, doing so is a brittle solution because style changes occur frequently.

Furthermore, there is nothing that signals to future developers that this input is part of an E2E test. At Grafana, we use `data-testid` attributes as our preferred way of defining selectors. See [Aria-Labels vs data-testid](#aria-labels-vs-data-testid) for more details.

```jsx
<input data-testid="Username input field" className="gf-form-input login-form-input" type="text" />
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

<input data-testid={selectors.pages.Login.username} className="gf-form-input login-form-input" type="text" />;
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

## Advanced example

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
test.describe(
  'List test',
  {
    tag: ['@datasources'],
  },
  () => {
    test('clicks on data source named B', async ({ selectors, page }) => {
      await page.goto(selectors.pages.Datasources.url)
    // Select datasource
      const dataSource = 'B';
      await page.getByTextId(dataSource).click();
    }
  });
```

## aria-label versus data-testid

Our selectors are set up to work with both `aria-label` attributes and `data-testid` attributes. The `aria-label` attributes help assistive technologies such as screen readers identify interactive elements of a page for our users.

A good example of a time to use an aria-label might be if you have a button with an **X** to close:

```
<button aria-label="close">X<button>
```

It might be clear visually that the **X** closes the modal, but audibly it would not be clear, for example.

```
<button aria-label="close">Close<button>
```

The example might read aloud to a user as "Close, Close" or something similar.

However, adding an aria-label to an element that is already clearly labeled or not interactive can be confusing and redundant for users with assistive technologies.

In such cases, don't add an unnecessary aria-label to a component so as to make them selectable for testing. Instead, use a data attribute that will not be read aloud with an assistive technology. For example:

```
<button data-testid="modal-close-button">Close<button>
```

We have added support for data attributes in our selectors Prefix your selector string with `data-testid`:

```typescript
export const versionedComponents = {
    Drawer: {
        General: {
            title: {
                [MIN_GRAFANA_VERSION]: (title: string) => `Drawer title ${title}`,
            },
            expand: {
                [MIN_GRAFANA_VERSION]: 'Drawer expand',
            },
            contract: {
                [MIN_GRAFANA_VERSION]: 'Drawer contract',
            },
            close: {
                '10.3.0': 'data-testid Drawer close',
                [MIN_GRAFANA_VERSION]: 'Drawer close',
            },
            rcContentWrapper: { '9.4.0': () => '.rc-drawer-content-wrapper' },
            subtitle: {
                '10.4.0': 'data-testid drawer subtitle',
            },
        },
[...]
};
```

and in your component, import the selectors and add the `data-testid`:

```
<button data-testid={selectors.components.drawer.general.close}>
```
