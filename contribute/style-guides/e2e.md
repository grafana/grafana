# End to end test framework

Grafana Labs uses a minimal home grown solution built on top of Cypress for our end to end (e2e) tests.

## Commands

- `yarn e2e` Creates an isolated grafana-server home under `<repo-root>/e2e/tmp` with provisioned data sources and dashboards. This
  copies locally build binary and frontend assets from your repo root so you need to have a built backend and frontend
  for this to run locally. The server starts on port 3001 so it does not conflict with your normal dev server.
- `yarn e2e:debug` Same as above but runs the tests in chrome and does not shutdown after completion.
- `yarn e2e:dev` Same as above but does not run any tests on startup. It lets you pick a test first.

If you already have a Grafana instance running, you can provide a specific URL by setting the `BASE_URL` environment variable:

```
BASE_URL=http://172.0.10.2:3333 yarn e2e
```

The above commands use some utils scripts under `<repo-root>/e2e` that can also be used for more control.

- `./e2e/start-server` This creates a fresh new grafana server working dir, setup's config and starts the server. It
  will also kill any previously started server that is still running using pid file at `<repo-root>/e2e/tmp/pid`.
- `./e2e/wait-for-grafana` waits for `$HOST` and `$PORT` to be available. Per default localhost and 3001.
- `./e2e/run-suite <debug|dev|noarg>` Starts cypress in different modes.

## Test Suites

All the integration tests are located at `e2e/suite<x>/specs`. The page objects and reusable flows are in the
`packages/grafana-e2e` package.

## Basic concepts

Here is a good introduction to e2e best practices: https://martinfowler.com/bliki/PageObject.html.

- `Selector`: A unique identifier that is used from the e2e framework to retrieve an element from the Browser
- `Page`: An abstraction for an object that contains one or more `Selectors` with `visit` function to navigate to the page.
- `Component`: An abstraction for an object that contains one or more `Selectors` but without `visit` function
- `Flow`: An abstraction that contains a sequence of actions on one or more `Pages` that can be reused and shared between tests

## Basic example

Let's start with a simple example with a single selector. For simplicity, all examples are in JSX.

In our example app, we have an input that we want to type some text into during our e2e test.

```jsx harmony
<div>
  <input type="text" className="gf-form-input login-form-input" />
</div>
```

We could define a selector using `JQuery` [type selectors](https://api.jquery.com/category/selectors/) with a string like `'.gf-form-input.login-form-input'` but that would be brittle as style changes occur frequently. Furthermore there is nothing that signals to future developers that this input is part of an e2e test.

At Grafana, we use `aria-label` as our preferred way of defining selectors instead of `data-*` attributes. This also aids in accessibility.
Let's add a descriptive `aria-label` to our simple example.

```jsx harmony
<div>
  <input type="text" className="gf-form-input login-form-input" aria-label="Username input field" />
</div>
```

Now that we added the `aria-label` we suddenly get more information about this particular field. It's an input field that represents a username, but there it's still not really signaling that it's part of an e2e test.

The next step is to create a `Page` representation in our e2e test framework to glue the test with the real implementation using the `pageFactory` function. For that function we can supply a `url` and `selectors` like in the example below:

```typescript
export const Login = {
  url: '/login', // used when called from Login.visit()
  username: 'Username input field', // used when called from Login.username().type('Hello World')
};
```

The next step is to add the `Login` page to the exported const `Pages` in `packages/grafana-e2e-selectors/src/selectors/pages.ts` so that it appears when we type `e2e.pages` in our IDE.

```ecmascript 6
export const Pages = {
  Login,
  ...,
  ...,
  ...,
};

```

Now that we have a `Page` called `Login` in our `Pages` const we can use that to add a selector in our html like shown below and now this really signals to future developers that it is part of an e2e test.

```jsx harmony
<div>
  <input type="text" className="gf-form-input login-form-input" aria-label={selectors.pages.Login.username} />
</div>
```

The last step in our example is to use our `Login` page as part of a test.

- The `url` property is used whenever we call the `visit` function and is equivalent to the Cypress function [cy.visit()](https://docs.cypress.io/api/commands/visit.html#Syntax).
  > Best practice after calling `visit` is to always call `should` on a selector to prevent flaky tests when you try to access an element that isn't ready. For more information, refer to [Commands vs. assertions](https://docs.cypress.io/guides/core-concepts/retry-ability.html#Commands-vs-assertions).
- Any defined selector can be accessed from the `Login` page by invoking it. This is equivalent to the result of the Cypress function [cy.get(...)](https://docs.cypress.io/api/commands/get.html#Syntax).

```ecmascript 6
describe('Login test', () => {
  it('Should pass', () => {
    e2e.pages.Login.visit();
    // To prevent flaky tests, always do a .should on any selector that you expect to be in the DOM.
    // Read more here: https://docs.cypress.io/guides/core-concepts/retry-ability.html#Commands-vs-assertions
    e2e.pages.Login.username().should('be.visible');
    e2e.pages.Login.username().type('admin');
  });
});
```

## Advanced example

Let's take a look at an example that uses the same `selector` for multiple items in a list for instance. In this example app we have a list of data sources that we want to click on during an e2e test.

```jsx harmony
<ul>
  {dataSources.map(dataSource => (
    <li className="card-item-wrapper" key={dataSource.id}>
      <a className="card-item" href={`datasources/edit/${dataSource.id}`}>
        <div className="card-item-name">{dataSource.name}</div>
      </a>
    </li>
  ))}
</ul>
```

````

Just as before in the basic example we'll start by creating a page abstraction using the `pageFactory` function:
```typescript
export const DataSources = {
  url: '/datasources',
  dataSources: (dataSourceName: string) => `Data source list item ${dataSourceName}`,
};
````

You might have noticed that instead of a simple `string` as the `selector`, we're using a `function` that takes a string parameter as an argument and returns a formatted string using the argument.

Just as before we need to add the `DataSources` page to the exported const `Pages` in `packages/grafana-e2e-selectors/src/selectors/pages.ts`.

The next step is to use the `dataSources` selector function as in our example below:

```jsx harmony
<ul>
  {dataSources.map(dataSource => (
    <li className="card-item-wrapper" key={dataSource.id}>
      <a className="card-item" href={`datasources/edit/${dataSource.id}`}>
        <div className="card-item-name" aria-label={selectors.pages.DataSources.dataSources(dataSource.name)}>
          {dataSource.name}
        </div>
      </a>
    </li>
  ))}
</ul>
```

When this list is rendered with the data sources with names `A`, `B`, `C` the resulting html would become:

```jsx harmony
<div class="card-item-name" aria-label="Data source list item A">
 A
</div>
...
<div class="card-item-name" aria-label="Data source list item B">
 B
</div>
...
<div class="card-item-name" aria-label="Data source list item C">
 C
</div>
```

Now we can write our test. The one thing that differs from the `Basic example` is that we pass in which data source we want to click on as an argument to the selector function:

> Best practice after calling `visit` is to always call `should` on a selector to prevent flaky tests when you try to access an element that isn't ready. For more information, refer to [Commands vs. assertions](https://docs.cypress.io/guides/core-concepts/retry-ability.html#Commands-vs-assertions).

```ecmascript 6
describe('List test', () => {
  it('Clicking on data source named B', () => {
    e2e.pages.DataSources.visit();
    // To prevent flaky tests, always do a .should on any selector that you expect to be in the DOM.
    // Read more here: https://docs.cypress.io/guides/core-concepts/retry-ability.html#Commands-vs-assertions
    e2e.pages.DataSources.dataSources('B').should('be.visible');
    e2e.pages.DataSources.dataSources('B').click();
  });
});
```
