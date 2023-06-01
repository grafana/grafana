# Testing tips

## Testing user interactions

We are using [user-event](https://testing-library.com/docs/user-event/intro) to test for user interactions, and it should be used instead of the built-in `fireEvent` method as it more closely resembles the way users interact with elements.

There are two things to remember when using `userEvent`:

1. All its methods are async, so should be called with `await`.
2. While it is possible to call the methods directly from `userEvent`, this will not work in the future versions and we need to call `userEvent.setup()` before the tests, which will return a `userEvent` instance with all its methods. This setting up can be simplified via a utility function:

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

## Debugging tests

There a few helpful utilities for debugging tests.

- [screen.debug()](https://testing-library.com/docs/queries/about/#screendebug) - prints a readable representation of a document DOM tree (when called without arguments) or a DOM tree of a specific node or nodes. It is internally using `console.log`, so no need to wrap it in it.
- [Testing Playground](https://testing-playground.com/) - an interactive sandbox for testing which queries work for specific HTML.
- [logRoles](https://testing-library.com/docs/dom-testing-library/api-debugging/#prettydom) - a utility to print out all the implicit ARIA roles for a tree of DOM nodes.

## Testing Select components

As an example, we'll use this `OrgRolePicker` component, which is basically a wrapper for `Select`.

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

### Matching the Select

There a few way to query the Select component.

1. Explicitly passing the aria-label prop and using `getByRole` method:

```tsx
describe('OrgRolePicker', () => {
  it('should render the picker', () => {
    setup(<OrgRolePicker value={OrgRole.Admin} aria-label={'Role picker'} onChange={() => {}} />);
    expect(screen.getByRole('combobox', { name: 'Role picker' })).toBeInTheDocument();
  });
});
```

2. Adding a `label` element with the `htmlFor` prop. In this case matching `inputId` should be passed to the `Select`.

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

It's also possible to use `*ByLabelText` queries, however `*ByRole` queries are [more robust](https://testing-library.com/docs/queries/bylabeltext/#name) and should be generally preferred.

### Testing that correct options are displayed

Sometimes it's necessary to test that `Select` displays correct options. In this case, the best solution is to click the `Select` and match the required option using `*ByText` query.

```tsx
it('should have an "Editor" option', async () => {
  const { user } = setup(<OrgRolePicker value={OrgRole.Admin} aria-label={'Role picker'} onChange={() => {}} />);
  await user.click(screen.getByLabelText('Role picker'));
  expect(screen.getByText('Editor')).toBeInTheDocument();
});
```

### Selecting an option

To make selecting an option from a Select component easier, there's a selectOptionInTest utility function, which is wrapper on top of [react-select-event](https://testing-library.com/docs/ecosystem-react-select-event/) package.

```tsx
it('should select an option', async () => {
  const mockOnChange = jest.fn();
  setup(<OrgRolePicker value={OrgRole.Admin} aria-label={'Role picker'} onChange={mockOnChange} />);
  await selectOptionInTest(screen.getByRole('combobox', { name: 'Role picker' }), 'Viewer');
  expect(mockOnChange).toHaveBeenCalledWith('Viewer');
});
```
