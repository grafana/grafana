# Develop for accessibility at Grafana

At Grafana we pay special attention to accessibility (a11y) and that's why it's important that all components are written with it in mind. This document contains some best practices for writing accessible components.

### grafana/ui components

Some `grafana/ui` components have specific built-in mechanisms that make it easier to write accessible components.

#### Form elements

One of the important accessibility considerations when working with form elements is to make sure form controls are properly labelled.
For example, a `label` element should be associated with the respective form control.
One way to do that is to provide a `for` attribute to the label that matches the `id` attribute of the form control.

The form components from `grafana/ui` provide an easier way to achieve that. The form elements, used inside `Field` components, get the `label` properly associated with them. This is appropriate because the element has a specified `id` (in case of `Select`, the prop is `inputId`).

For example:

```tsx
const id = useId(); // React's useId provides a stable globally unique identifier

return (
  <Field label="Name">
    <Input id={id} placeholder="Enter a name" />
  </Field>
);
```

In the previous example, the code is rendered as:

```html
<div>
  <label for=":r0:"> Name </label>
  <input name="name" type="text" id=":r0:" placeholder="Enter a name" value="" />
</div>
```

As long as the form element has a globally unique `id` attribute specified and is the direct child element of Field, it's automatically accessible when rendered.

Make sure you test that each field can be selected by clicking its label!

### Write tests with accessibility in mind

We use the [React Testing Library](https://testing-library.com/docs/react-testing-library/intro) (RTL) for writing unit tests.
The library is built with accessibility in mind and makes it easier to ensure the written code is accessible to all users.

When querying DOM elements with RTL, you should prefer using `*ByRole` queries as they resemble closely how the users interact with the page. These queries use mouse and visual displays and assistive technologies.

As a rule of thumb, when code is written with accessibility concerns in
mind, `*ByRole` queries are sufficient in most cases. However, there are exceptions because not all the elements have defined [ARIA roles](https://www.w3.org/TR/html-aria/#docconformance).

For example:

```tsx
<Field label="Username">
  <Input id="username" placeholder="Enter a name" value={'Test'} />
</Field>
```

In the previous example, the test case is the following code:

```tsx
it('has username set', () => {
  expect(screen.getByRole('textbox', { name: 'Username' })).toHaveValue('Test');
});
```

Input with type `text` (that is, the default type value) has a role of `textbox`. Also, the `name` option isn't the name attribute given to the input elements, but their [accessible name](https://www.tpgi.com/what-is-an-accessible-name/). The accessible name in this case is the text content associated with the input label.

### Pull requests that introduce accessibility errors:

We use [pa11y-ci](https://github.com/pa11y/pa11y-ci) to collect accessibility errors on [some URLs in the project](https://github.com/grafana/grafana/issues/36555). The thresholds of accessibility errors are specified per URL.

If the contribution introduces new a11y errors, our continuous integration will fail, preventing you from merging to the main branch. In those cases there are two alternatives for moving forward:

- Check the error log on the pipeline step `test-a11y-frontend-pr`, identify the nature of the error, and then fix it.
- Locally run the command `yarn test:accessibility-report` that generates an HTML accessibility report, and then go to the URL that contains your change. On this URL, identify the error, and then fix it. Keep in mind that a local end-to-end Grafana instance is going to be running on `http://localhost:3001`.

You can also avoid introducing accessibility errors by installing an a11y plugin in your browser. For example, you could use axe DevTools or Accessibility Insights for Web, among others.
