# Accessibility at Grafana

At Grafana we pay special attention to accessibility and that's why it's important that all components are written with it in
mind.

The goal of this document is to list best practices and recommendations when it comes to writing accessible components.

### grafana/ui components

Some grafana/ui components have specific mechanisms built-in that make it easier to write accessible components.

#### Form elements

One of the important accessibility considerations when working with form elements is to make sure form controls are
properly labelled. For that a `label` element has to be associated with the respective form control. One way to
do that is to provide `for` attribute to the label that matches the `id` attribute of the form control.

The form components from grafana/ui provide an easier way to achieve that. The form elements, used inside `Field`
components, will get the `label` properly associated with them given that the element has `id` (in case of `Select` the prop is `inputId`) specified.

As an example, this code

```tsx
<Field label="Name">
  <Input id="name" placeholder="Enter a name" />
</Field>
```

will be rendered as (simplified)

```html
<div>
  <label for="name"> Name </label>
  <input name="name" type="text" id="name" placeholder="Enter a name" value="" />
</div>
```

As long as the form element has a unique `id` attribute specified, it will be automatically accessible when rendered.

### Writing tests with accessibility in mind

We use [React Testing Library](https://testing-library.com/docs/react-testing-library/intro) (RTL) for writing unit tests.
The library is built with accessibility in mind and makes it easier to ensure the written code is accessible to all users.
When querying DOM elements with RTL prefer using `*ByRole` queries as they resemble closely how the users interact
with the page - both using mouse/visual display and assistive technologies.
As a rule of thumb, if code is written with the accessibility concerns in
mind, `*ByRole` queries will be sufficient in most of the cases. There are certainly exceptions here, as not all the elements have defined [ARIA role](https://www.w3.org/TR/html-aria/#docconformance).

As an example, for this code

```tsx
<Field label="Username">
  <Input id="username" placeholder="Enter a name" value={'Test'} />
</Field>
```

the test could case be as follows

```tsx
it('has username set', () => {
  expect(screen.getByRole('textbox', { name: 'Username' })).toHaveValue('Test');
});
```

Input with type `text` (default type value) has a role of `textbox` and the `name` option is not the name attribute
given to the input elements but their [accessible name](https://www.tpgi.com/what-is-an-accessible-name/), which in this case is the text content of the associated with input label.

### Pull requests that introduce accessibility(a11y) errors:

We use [pa11y-ci](https://github.com/pa11y/pa11y-ci) to collect accessibility errors on [some URLs in the project](https://github.com/grafana/grafana/issues/36555), threshold errors are specified per URL.

If the contribution introduces new a11y errors, our continuous integration will fail, preventing you to merge to the main branch. In those cases there are two alternatives for moving forward:

- Check the error log on the pipeline step `test-a11y-frontend-pr`, identify what was the error, and fix it.
- Locally run the command `yarn test:accessibility-report` that generates an HTML accessibility report, then go to the URL that contains your change, identify the error, and fix it. Keep in mind, a local e2e Grafana instance is going to be running on `http://localhost:3001`.

You can also prevent introducing a11y errors by installing an a11y plugin in your browser, for example, axe DevTools, Accessibility Insights for Web among others.
