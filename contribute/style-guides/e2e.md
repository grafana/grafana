# E2E tests

Grafana Labs uses a minimal [homegrown solution](../../e2e/utils/index.ts) built on top of [Cypress](https://cypress.io) for its end-to-end (E2E) tests.

> **Note:** Grafana plugins are tested differently. Test them with a different [solution](e2e-plugins.md) that uses [Playwright](https://playwright.dev/).

## Framework structure

Grafana end-to-end tests generally store all element identifiers ([CSS selectors](https://mdn.io/docs/Web/CSS/CSS_Selectors)) in the test framework for reuse and maintainability.

We use a framework structure inspired by https://martinfowler.com/bliki/PageObject.html. The key features of this structure include:

- `Selector`: A unique identifier that is used from the end-to-end framework to retrieve an element from the browser.
- `Page`: An abstraction for an object that contains one or more `Selectors` with a `visit` function to navigate to the page.
- `Component`: An abstraction for an object that contains one or more `Selectors` but without the `visit` function.
- `Flow`: An abstraction that contains a sequence of actions on one or more `Pages` that can be reused and shared between tests.

## Basic JSX example

Let's start with a simple [JSX](https://reactjs.org/docs/introducing-jsx.html) example with a single input field that we want to populate during our end-to-end test:

```jsx
<input className="gf-form-input login-form-input" type="text" />
```

You can target the field with a CSS selector like `.gf-form-input.login-form-input`, but that is a brittle solution because style changes occur frequently. Furthermore, there is nothing that signals to future developers that this input is part of an E2E test. Accordingly, it is a best practice to use `data-testid` attributes as the preferred way to define selectors. Refer to [Aria-Labels vs `data-testid`](#aria-labels-vs-data-testid) for more details.

1. Use the`data-testid` attribute to define the CSS selectors:

   ```jsx
   <input data-testid="Username input field" className="gf-form-input login-form-input" type="text" />
   ```

1. Create a `Page` representation in our E2E framework to glue the test with the real implementation using the `pageFactory` function. For that function, we can supply a `url` and `selectors` like in the example below:

   ```typescript
   export const Login = {
     // Call via `Login.visit()`
     url: '/login',
     // Call via `Login.username()`
     username: 'data-testid Username input field',
   };
   ```

   > **Note:** the selector is prefixed with `data-testid`. This attribute is a signal to the framework to look for the selector in `data-testid`.

1. Add the `Login` page to the `Pages` export within [_\<repo-root>/packages/grafana-e2e-selectors/src/selectors/pages.ts_](../../packages/grafana-e2e-selectors/src/selectors/pages.ts) so that it appears when we type `e2e.pages` in our IDE. For example:

   ```typescript
   export const Pages = {
     Login,
     …,
     …,
     …,
   };
   ```

1. Now that we have a `Page` called `Login` in our `Pages` const, you can use that page to add a selector in our HTML like the code shown below. This code now signals to future developers that it is part of an E2E test.

   ```jsx
   import { selectors } from '@grafana/e2e-selectors';

   <input data-testid={selectors.pages.Login.username} className="gf-form-input login-form-input" type="text" />;
   ```

1. Finally, use our `Login` page as part of a test. Use code similar to the following:

```typescript
describe('Login test', () => {
  it('passes', () => {
    e2e.pages.Login.visit();
    // To prevent flaky tests, always do a `.should` on any selector that you expect to be in the DOM.
    // Read more here: https://docs.cypress.io/guides/core-concepts/retry-ability.html#Commands-vs-assertions
    e2e.pages.Login.username().should('be.visible').type('admin');
  });
});
```

In this example, the `url` property is used whenever we call the `visit` function and is equivalent to the Cypress' [`cy.visit()`](https://docs.cypress.io/api/commands/visit.html#Syntax). Furthermore, you can access any defined selector from the `Login` page by invoking it. This is equivalent to the result of the Cypress function [`cy.get(…)`](https://docs.cypress.io/api/commands/get.html#Syntax).

## Advanced JSX example

Let's take a look at an example app that uses the same `selector` for multiple items in a list. In this example, we have a list of data sources that we want to click on during an E2E test:

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

1. Just as before in the basic example, begin by creating a page abstraction using the `pageFactory` function:

   ```typescript
   export const DataSources = {
     url: '/datasources',
     dataSources: (dataSourceName: string) => `data-testid Data source list item ${dataSourceName}`,
   };
   ```

   You might have noticed that instead of a simple string as the selector, we're using a function that takes a string parameter as an argument and returns a formatted string using the argument.

1. Just as before, add the `DataSources` page to the exported const `Pages` in `packages/grafana-e2e-selectors/src/selectors/pages.ts`.

1. Use the `dataSources` selector function as shown in the following example:

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

   When this list is rendered with the data sources names of `A`, `B` and `C`, the resulting HTML looks like this:

   ```html
   <div class="card-item-name" data-testid="data-testid Data source list item A">A</div>
   <div class="card-item-name" data-testid="data-testid Data source list item B">B</div>
   <div class="card-item-name" data-testid="data-testid Data source list item C">C</div>
   ```

1. Pass in the name of the data source we want to select as an argument to the selector function:

   ```typescript
   describe('List test', () => {
     it('clicks on data source named B', () => {
       e2e.pages.DataSources.visit();
       // To prevent flaky tests, always do a .should on any selector that you expect to be in the DOM.
       // Read more here: https://docs.cypress.io/guides/core-concepts/retry-ability.html#Commands-vs-assertions
       e2e.pages.DataSources.dataSources('B').should('be.visible').click();
     });
   });
   ```

## The aria-label attribute vs. data-testid attribute

Our selectors are set up to work with both `aria-label` attributes and `data-testid` attributes. An `aria-label` helps assistive technologies such as screen readers identify interactive elements of a page for users.

A good example of a time to use an aria-label is if you have a button with an "X" to close:

```
<button aria-label="close">X<button>
```

Although it might be clear visually that the "X" closes the modal, audibly it may not be clear. For example.

```
<button aria-label="close">Close<button>
```

In this example, the label might be read aloud to a user as "Close, Close" or something similar.

However, adding an `aria-label` to elements that are already clearly labeled or not interactive can be confusing and redundant for users with assistive technologies.

In such cases, don't add an unnecessary `aria-label` to components so as to make them selectable for testing. Instead, use a `data-testid` attribute that is not read aloud with an assistive technology. For example:

    ```typescript
    <button data-testid="modal-close-button">Close<button>
    ```

1. Prefix your selector string with `data-testid`:

   ```typescript
   export const Components = {
     Login: {
       openButton: 'open-button', // this looks for an aria-label
       closeButton: 'data-testid modal-close-button', // this looks for a data-testid
     },
   };
   ```

1. In your component, import the selectors and add the `data-testid`:

   ```
   <button data-testid={Selectors.Components.Login.closeButton}>
   ```

## See also

If you are unfamiliar with the use of promises in Cypress, refer to [Cypress' documentation](https://docs.cypress.io/guides/core-concepts/introduction-to-cypress.html#Mixing-Async-and-Sync-code). 
>>>>>>> refs/remotes/origin/josmperez/e2e-style
