# Testing Guidelines

The goal of this document is to address the most frequently asked "How to" questions related to unit testing.

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

Here, the [OrgRolePicker](https://github.com/grafana/grafana/blob/main/public/app/features/admin/OrgRolePicker.tsx) component is used as an example. This component essentially serves as a wrapper for the `Select` component, complete with its own set of options.

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

There are a few methods to query the `Select` component:

1. One approach is to explicitly pass the `aria-label` prop and then use the `getByRole` method:

```tsx
describe('OrgRolePicker', () => {
  it('should render the picker', () => {
    setup(<OrgRolePicker value={OrgRole.Admin} aria-label={'Role picker'} onChange={() => {}} />);
    expect(screen.getByRole('combobox', { name: 'Role picker' })).toBeInTheDocument();
  });
});
```

2. Alternatively, add a `label` element and provide the `htmlFor` prop. In this scenario, a matching `inputId` should be passed to the `Select` component:

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

It's also possible to use `*ByLabelText` queries. However, the `*ByRole` queries are [more robust](https://testing-library.com/docs/queries/bylabeltext/#name) and are generally recommended over the former.

### Testing the Display of Correct Options

At times, it might be necessary to verify that the `Select` component is displaying the correct options. In such instances, the best solution is to click the `Select` component and match the desired option using the `*ByText` query.

```tsx
it('should have an "Editor" option', async () => {
  const { user } = setup(<OrgRolePicker value={OrgRole.Admin} aria-label={'Role picker'} onChange={() => {}} />);
  await user.click(screen.getByRole('combobox', { name: 'Role picker' }));
  expect(screen.getByText('Editor')).toBeInTheDocument();
});
```

### Selecting an option

To simplify the process of selecting an option from a `Select` component, there is a `selectOptionInTest` utility function. This function is a wrapper over the [react-select-event](https://testing-library.com/docs/ecosystem-react-select-event/) package.

```tsx
it('should select an option', async () => {
  const mockOnChange = jest.fn();
  setup(<OrgRolePicker value={OrgRole.Admin} aria-label={'Role picker'} onChange={mockOnChange} />);
  await selectOptionInTest(screen.getByRole('combobox', { name: 'Role picker' }), 'Viewer');
  expect(mockOnChange).toHaveBeenCalledWith('Viewer');
});
```

## Mocking Objects and Functions

### Mocking the `window` Object and Its Methods

There are several approaches to mock the `window` object. The most common methods are using `Object.defineProperty` and Jest spies.

#### Using `Object.defineProperty`

This method allows for the creation of a new property directly on an object, or modification of an existing one.

```tsx
const originalLocation = window.location;
beforeAll(() => {
  Object.defineProperty(window, 'location', {
    value: { href: 'www.example.com' },
  });
});

afterAll(() => {
  Object.defineProperty(window, 'location', { value: originalLocation });
});
```

It's important to include `writable: true` in case the `window` object or its properties need to be redefined in another test.

#### Using Jest Spies

This approach leverages the built-in mocking capabilities of Jest.

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

Jest's spy functions provide a built-in mechanism for restoring mocks. This feature eliminates the need to manually save a reference to the `window` object.

### Mocking getBackendSrv()

The `getBackendSrv()` function is used to make HTTP requests to the Grafana backend. It is possible to mock this object using the `jest.mock` method.

```tsx
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    post: postMock,
  }),
}));
```

#### Mocking getBackendSrv for AsyncSelect

The `AsyncSelect` component is used to asynchronously load options. It is possible to mock the `getBackendSrv` function using the `jest.mock` method.

```tsx
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    get: jest.fn(),
    post: jest.fn(),
  }),
}));
```

Here's how the test would look like for this [OrgPicker](https://github.com/grafana/grafana/blob/main/public/app/core/components/Select/OrgPicker.tsx) component.

```tsx
import React, { useEffect } from 'react';
import { useAsyncFn } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { AsyncSelect } from '@grafana/ui';
import { Organization, UserOrg } from 'app/types';

export type OrgSelectItem = SelectableValue<Organization>;

export interface Props {
  onSelected: (org: OrgSelectItem) => void;
  className?: string;
  inputId?: string;
  autoFocus?: boolean;
  excludeOrgs?: UserOrg[];
}

export function OrgPicker({ onSelected, className, inputId, autoFocus, excludeOrgs }: Props) {
  useEffect(() => {
    if (autoFocus && inputId) {
      document.getElementById(inputId)?.focus();
    }
  }, [autoFocus, inputId]);

  const [orgOptionsState, getOrgOptions] = useAsyncFn(async () => {
    const orgs: Organization[] = await getBackendSrv().get('/api/orgs');
    const allOrgs = orgs.map((org) => ({ value: { id: org.id, name: org.name }, label: org.name }));
    if (excludeOrgs) {
      let idArray = excludeOrgs.map((anOrg) => anOrg.orgId);
      const filteredOrgs = allOrgs.filter((item) => {
        return !idArray.includes(item.value.id);
      });
      return filteredOrgs;
    } else {
      return allOrgs;
    }
  });

  return (
    <AsyncSelect
      inputId={inputId}
      className={className}
      isLoading={orgOptionsState.loading}
      defaultOptions={true}
      isSearchable={false}
      loadOptions={getOrgOptions}
      onChange={onSelected}
      placeholder="Select organization"
      noOptionsMessage="No organizations found"
    />
  );
}
```

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
