---
name: unit-test-react-components
description: Write Jest tests for React components using @testing-library/react. Use when testing component rendering, user interactions, and accessibility. Avoid brittle implementation testing - focus on behavior from user perspective.
compatibility: Requires Jest, @testing-library/react, @testing-library/user-event
metadata:
  framework: jest
  version: '1.0'
  target: react-components
---

# Unit Testing React Components

Test React components focusing on user behavior, not implementation details.

## ⚠️ Read First

**Before testing components, read [Test Failure Investigation Protocol](../test-failure-investigation/SKILL.md).**

## Philosophy: Test Behavior, Not Implementation

**Avoid:**

- Testing internal state
- Mocking child components excessively
- Testing CSS classes or DOM structure
- Checking how many times a function was called

**Prefer:**

- Testing what user sees and does
- Checking rendered output
- Simulating real user interactions
- Verifying accessible behavior

## Testing Library Queries

**Priority order:**

1. **getByRole** - Most accessible, semantic

   ```typescript
   screen.getByRole('button', { name: 'Submit' });
   screen.getByRole('textbox', { name: 'Email' });
   ```

2. **getByLabelText** - Form inputs

   ```typescript
   screen.getByLabelText('Email address');
   ```

3. **getByPlaceholderText** - When no label

   ```typescript
   screen.getByPlaceholderText('Enter email');
   ```

4. **getByText** - Visible text content

   ```typescript
   screen.getByText(/welcome back/i);
   ```

5. **getByTestId** - Last resort for non-semantic elements
   ```typescript
   screen.getByTestId('custom-svg-icon');
   ```

**Avoid:** getByClassName, querySelector - brittle and tied to implementation

## Basic Component Test Structure

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should display welcome message', () => {
    render(<MyComponent name="Alice" />);
    expect(screen.getByText('Welcome, Alice')).toBeInTheDocument();
  });

  it('should call onChange when button clicked', async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();

    render(<MyComponent onChange={handleChange} />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(handleChange).toHaveBeenCalledWith(expect.any(String));
  });
});
```

## When to Test Components

**Test:**

- Critical user workflows in the component
- Conditional rendering based on props
- User interactions (clicks, typing, selections)
- Error states and validation
- Accessibility features

**Don't test:**

- Third-party components (Button from @grafana/ui)
- Simple presentational wrappers
- Exact styling/layout (use E2E for visual testing)
- Every prop combination (focus on common scenarios)

## Mocking Strategy

### Minimal Mocking for Components

Only mock what you must:

```typescript
// ✅ Good - Mock external API calls
jest.mock('../api', () => ({
  fetchData: jest.fn(() => Promise.resolve({ data: 'test' })),
}));

// ❌ Bad - Mocking child components unnecessarily
jest.mock('./ChildComponent', () => ({ ChildComponent: () => <div>Mock</div> }));
```

### Mocking Grafana Dependencies

```typescript
// Mock minimal Grafana context
jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: () => ({
    replace: (str: string) => str,
  }),
}));
```

## User Interactions

Use `@testing-library/user-event` for realistic interactions:

```typescript
import userEvent from '@testing-library/user-event';

it('should update input on typing', async () => {
  const user = userEvent.setup();
  render(<SearchBox />);

  const input = screen.getByRole('textbox');
  await user.type(input, 'hello');

  expect(input).toHaveValue('hello');
});

it('should submit form', async () => {
  const user = userEvent.setup();
  const onSubmit = jest.fn();

  render(<Form onSubmit={onSubmit} />);

  await user.type(screen.getByLabelText('Name'), 'Alice');
  await user.click(screen.getByRole('button', { name: 'Submit' }));

  expect(onSubmit).toHaveBeenCalledWith({ name: 'Alice' });
});
```

## Async Behavior

Use `waitFor` and `findBy` queries for async updates:

```typescript
import { render, screen, waitFor } from '@testing-library/react';

it('should load and display data', async () => {
  render(<DataComponent />);

  // Wait for loading to finish
  expect(screen.getByText(/loading/i)).toBeInTheDocument();

  // Wait for data to appear
  const data = await screen.findByText('Data loaded');
  expect(data).toBeInTheDocument();
});

it('should handle errors', async () => {
  render(<DataComponent />);

  await waitFor(() => {
    expect(screen.getByText(/error occurred/i)).toBeInTheDocument();
  });
});
```

## Coverage Focus

**Aim for ~80% coverage of:**

- User-facing functionality
- Conditional rendering logic
- Event handlers
- Error boundaries

**Skip testing:**

- Pure presentational components with no logic
- Grafana framework integrations (tested by E2E)
- Complex visual layouts (use E2E or visual regression)

## Common Patterns

### Testing Conditional Rendering

```typescript
it('should show error when invalid', () => {
  render(<InputField value="" isValid={false} />);
  expect(screen.getByText(/invalid input/i)).toBeInTheDocument();
});

it('should hide error when valid', () => {
  render(<InputField value="test" isValid={true} />);
  expect(screen.queryByText(/invalid input/i)).not.toBeInTheDocument();
});
```

### Testing Lists

```typescript
it('should render all items', () => {
  const items = ['Item 1', 'Item 2', 'Item 3'];
  render(<ItemList items={items} />);

  items.forEach((item) => {
    expect(screen.getByText(item)).toBeInTheDocument();
  });
});
```

### Testing Modals/Overlays

```typescript
it('should open modal on button click', async () => {
  const user = userEvent.setup();
  render(<ComponentWithModal />);

  await user.click(screen.getByRole('button', { name: 'Open' }));

  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText('Modal Title')).toBeInTheDocument();
});
```

## Commands

- **Run tests**: `../unit-testing/scripts/test-debug.sh`
- **Pattern match**: Add `--testPathPattern=ComponentName`

## Common Corrections

1. **Read [Test Failure Investigation Protocol](../test-failure-investigation/SKILL.md)** before modifying tests
2. **Use getByRole over getByTestId** - More accessible, semantic
3. **Test user behavior, not implementation** - Don't check state or mock internals
4. **Use userEvent over fireEvent** - More realistic interactions
5. **Avoid over-mocking** - Test real component behavior when possible
6. **Use findBy for async** - Handles waiting automatically
7. **Query with queryBy when checking absence** - Doesn't throw when not found
