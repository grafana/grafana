# Testing Guidelines

The goal of this document is to address the most frequently asked "How to" questions related to unit testing.

## Best practices

- Default to the `*ByRole` queries when testing components as it encourages testing with accessibility concerns in mind. It's also possible to use `*ByLabelText` queries. However, the `*ByRole` queries are [more robust](https://testing-library.com/docs/queries/bylabeltext/#name) and are generally recommended over the former.

## Testing User Interactions

We use the [user-event](https://testing-library.com/docs/user-event/intro) library for simulating user interactions during testing. This library is preferred over the built-in `fireEvent` method, as it more accurately mirrors real user interactions with elements.

There are two important considerations when working with `userEvent`:

1. All methods in `userEvent` are asynchronous, and thus require the use of `await` when called.
2. Directly calling methods from `userEvent` may not be supported in future versions. As such, it's necessary to first call `userEvent.setup()` prior to the tests. This method returns a `userEvent` instance, complete with all its methods. This setup process can be simplified using a utility function:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

function setup(jsx: JSX.Element) {
  return {
    user: userEvent.setup(),
    ...render(jsx),
  };
}

it('should render', async () => {
  const { user } = setup(<Button />);
  await user.click(screen.getByRole('button'));
});
```

## Debugging Tests

There are a few utilities that can be useful for debugging tests:

- [screen.debug()](https://testing-library.com/docs/queries/about/#screendebug) - This function prints a human-readable representation of the document's DOM tree when called without arguments, or the DOM tree of specific node(s) when provided with arguments. It is internally using `console.log` to log the output to terminal.
- [Testing Playground](https://testing-playground.com/) - An interactive sandbox that allows testing which queries work with specific HTML elements.
- [logRoles](https://testing-library.com/docs/dom-testing-library/api-debugging/#prettydom) - A utility function that prints out all the implicit ARIA roles for a given DOM tree.

## Testing Select Components

Here, the [OrgRolePicker](https://github.com/grafana/grafana/blob/38863844e7ac72c7756038a1097f89632f9985ff/public/app/features/admin/OrgRolePicker.tsx) component is used as an example. This component essentially serves as a wrapper for the `Select` component, complete with its own set of options.

```tsx
import { OrgRole } from '@grafana/data';
import { Select } from '@grafana/ui';

interface Props {
  value: OrgRole;
  disabled?: boolean;
  'aria-label'?: string;
  inputId?: string;
  onChange: (role: OrgRole) => void;
  autoFocus?: boolean;
  width?: number | 'auto';
}

const options = Object.keys(OrgRole).map((key) => ({ label: key, value: key }));

export function OrgRolePicker({ value, onChange, 'aria-label': ariaLabel, inputId, autoFocus, ...restProps }: Props) {
  return (
    <Select
      inputId={inputId}
      value={value}
      options={options}
      onChange={(val) => onChange(val.value as OrgRole)}
      placeholder="Choose role..."
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      {...restProps}
    />
  );
}
```

### Querying the Select Component

The recommended way to query `Select` components is by using a label. Add a `label` element and provide the `htmlFor` prop with a matching `inputId`. Alternatively, `aria-label` can be specified on the `Select`.

```tsx
describe('OrgRolePicker', () => {
  it('should render the picker', () => {
    setup(
      <>
        <label htmlFor={'role-picker'}>Role picker</label>
        <OrgRolePicker value={OrgRole.Admin} inputId={'role-picker'} onChange={() => {}} />
      </>
    );
    expect(screen.getByRole('combobox', { name: 'Role picker' })).toBeInTheDocument();
  });
});
```

### Testing the Display of Correct Options

At times, it might be necessary to verify that the `Select` component is displaying the correct options. In such instances, the best solution is to click the `Select` component and match the desired option using the `*ByText` query.

```tsx
it('should have an "Editor" option', async () => {
  const { user } = setup(
    <>
      <label htmlFor={'role-picker'}>Role picker</label>
      <OrgRolePicker value={OrgRole.Admin} inputId={'role-picker'} onChange={() => {}} />
    </>
  );
  await user.click(screen.getByRole('combobox', { name: 'Role picker' }));
  expect(screen.getByText('Editor')).toBeInTheDocument();
});
```

### Selecting an option

To simplify the process of selecting an option from a `Select` component, there is a `selectOptionInTest` utility function. This function is a wrapper over the [react-select-event](https://testing-library.com/docs/ecosystem-react-select-event/) package.

```tsx
it('should select an option', async () => {
  const mockOnChange = jest.fn();
  setup(
    <>
      <label htmlFor={'role-picker'}>Role picker</label>
      <OrgRolePicker value={OrgRole.Admin} inputId={'role-picker'} onChange={mockOnChange} />
    </>
  );
  await selectOptionInTest(screen.getByRole('combobox', { name: 'Role picker' }), 'Viewer');
  expect(mockOnChange).toHaveBeenCalledWith('Viewer');
});
```

## Mocking Objects and Functions

### Mocking the `window` Object and Its Methods

The recommended approach for mocking the `window` object is to use Jest spies. Jest's spy functions provide a built-in mechanism for restoring mocks. This feature eliminates the need to manually save a reference to the `window` object.

```tsx
let windowSpy: jest.SpyInstance;

beforeAll(() => {
  windowSpy = jest.spyOn(window, 'location', 'get');
});

afterAll(() => {
  windowSpy.mockRestore();
});

it('should test with window', function () {
  windowSpy.mockImplementation(() => ({
    href: 'www.example.com',
  }));
  expect(window.location.href).toBe('www.example.com');
});
```

### Mocking getBackendSrv()

The `getBackendSrv()` function is used to make HTTP requests to the Grafana backend. It is possible to mock this function using the `jest.mock` method.

```tsx
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    post: postMock,
  }),
}));
```

#### Mocking getBackendSrv for AsyncSelect

The `AsyncSelect` component is used to asynchronously load options. As such, it often relies on the `getBackendSrv` for loading the options.

Here's how the test would look like for this [OrgPicker](https://github.com/grafana/grafana/blob/38863844e7ac72c7756038a1097f89632f9985ff/public/app/core/components/Select/OrgPicker.tsx) component, which uses `AsyncSelect` under the hood.

```tsx
import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { OrgPicker } from './OrgPicker';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    get: () =>
      Promise.resolve([
        { name: 'Org 1', id: 0 },
        { name: 'Org 2', id: 1 },
      ]),
  }),
}));

function setup(jsx: JSX.Element) {
  return {
    user: userEvent.setup(),
    ...render(jsx),
  };
}

describe('OrgPicker', () => {
  it('should render', async () => {
    render(
      <>
        <label htmlFor={'picker'}>Org picker</label>
        <OrgPicker onSelected={() => {}} inputId={'picker'} />
      </>
    );

    expect(await screen.findByRole('combobox', { name: 'Org picker' })).toBeInTheDocument();
  });

  it('should have the options', async () => {
    const { user } = setup(
      <>
        <label htmlFor={'picker'}>Org picker</label>
        <OrgPicker onSelected={() => {}} inputId={'picker'} />
      </>
    );
    await user.click(await screen.findByRole('combobox', { name: 'Org picker' }));
    expect(screen.getByText('Org 1')).toBeInTheDocument();
    expect(screen.getByText('Org 2')).toBeInTheDocument();
  });
});
```
