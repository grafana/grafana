---
name: unit-test-react-hooks
description: Write Jest tests for custom React hooks using @testing-library/react-hooks or renderHook. Use when testing hook logic, state management, and side effects. Test hooks in isolation for pure logic testing.
compatibility: Requires Jest, @testing-library/react
metadata:
  framework: jest
  version: '1.0'
  target: react-hooks
---

# Unit Testing React Hooks

Test custom React hooks focusing on logic and state management.

## ⚠️ Read First

**Before testing hooks, read [Test Failure Investigation Protocol](../test-failure-investigation/SKILL.md).**

## When to Test Hooks

**Test custom hooks when they:**

- Manage complex state logic
- Handle side effects (API calls, subscriptions)
- Provide reusable logic across components
- Contain business rules or calculations

**Don't test:**

- Simple useState wrappers with no logic
- Hooks from libraries (React, @grafana)
- Hooks better tested via component integration

## Testing Strategy

### Option 1: Test via Component (Preferred)

Test hooks through components when possible - more realistic:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

function TestComponent() {
  const { value, increment } = useCounter(0);
  return (
    <div>
      <span>Count: {value}</span>
      <button onClick={increment}>Increment</button>
    </div>
  );
}

it('should increment counter', async () => {
  const user = userEvent.setup();
  render(<TestComponent />);

  expect(screen.getByText('Count: 0')).toBeInTheDocument();

  await user.click(screen.getByRole('button'));

  expect(screen.getByText('Count: 1')).toBeInTheDocument();
});
```

### Option 2: Test in Isolation with renderHook

For pure hook logic testing:

```typescript
import { renderHook, act } from '@testing-library/react';
import { useCounter } from './useCounter';

it('should increment counter', () => {
  const { result } = renderHook(() => useCounter(0));

  expect(result.current.value).toBe(0);

  act(() => {
    result.current.increment();
  });

  expect(result.current.value).toBe(1);
});
```

## Example: Testing State Management Hook

```typescript
import { renderHook, act } from '@testing-library/react';
import { useConfirmation } from './useConfirmation';

describe('useConfirmation', () => {
  it('should open confirmation dialog', () => {
    const onConfirm = jest.fn();
    const { result } = renderHook(() => useConfirmation(onConfirm));

    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.request({ id: '123' });
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.itemToConfirm).toEqual({ id: '123' });
  });

  it('should call onConfirm and close dialog', () => {
    const onConfirm = jest.fn();
    const { result } = renderHook(() => useConfirmation(onConfirm));

    act(() => {
      result.current.request({ id: '123' });
    });

    act(() => {
      result.current.confirm();
    });

    expect(onConfirm).toHaveBeenCalledWith({ id: '123' });
    expect(result.current.isOpen).toBe(false);
    expect(result.current.itemToConfirm).toBeNull();
  });

  it('should close dialog without confirming', () => {
    const onConfirm = jest.fn();
    const { result } = renderHook(() => useConfirmation(onConfirm));

    act(() => {
      result.current.request({ id: '123' });
    });

    act(() => {
      result.current.cancel();
    });

    expect(onConfirm).not.toHaveBeenCalled();
    expect(result.current.isOpen).toBe(false);
  });
});
```

## Testing Async Hooks

Use `waitFor` for async operations:

```typescript
import { renderHook, waitFor } from '@testing-library/react';

it('should fetch data', async () => {
  const { result } = renderHook(() => useFetchData('/api/data'));

  expect(result.current.loading).toBe(true);

  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  expect(result.current.data).toEqual({ name: 'Test' });
});

it('should handle errors', async () => {
  const { result } = renderHook(() => useFetchData('/api/error'));

  await waitFor(() => {
    expect(result.current.error).toBeTruthy();
  });

  expect(result.current.data).toBeNull();
});
```

## Testing Hooks with Dependencies

Pass changing props via `rerender`:

```typescript
it('should update when prop changes', () => {
  const { result, rerender } = renderHook(({ id }) => useFetchData(id), { initialProps: { id: '1' } });

  expect(result.current.data).toEqual({ id: '1' });

  rerender({ id: '2' });

  expect(result.current.data).toEqual({ id: '2' });
});
```

## Testing useEffect Side Effects

```typescript
it('should subscribe on mount and cleanup on unmount', () => {
  const subscribe = jest.fn(() => jest.fn());
  const { unmount } = renderHook(() => useSubscription(subscribe));

  expect(subscribe).toHaveBeenCalledTimes(1);

  const cleanup = subscribe.mock.results[0].value;

  unmount();

  expect(cleanup).toHaveBeenCalledTimes(1);
});
```

## Mocking Strategy

### Mock External Dependencies Only

```typescript
// ✅ Good - Mock external API
jest.mock('../api', () => ({
  fetchData: jest.fn(() => Promise.resolve({ data: 'test' })),
}));

// ❌ Bad - Over-mocking React hooks
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: jest.fn(),
}));
```

## Coverage Focus

**Aim for ~80% coverage of:**

- State transitions and updates
- Side effect logic (useEffect)
- Error handling
- Callback functions

**Skip testing:**

- Trivial useState/useCallback wrappers
- Hooks that just compose other hooks without logic
- React's built-in hooks

## Common Patterns

### Testing State Updates

```typescript
it('should update state correctly', () => {
  const { result } = renderHook(() => useForm({ name: '' }));

  act(() => {
    result.current.setValue('name', 'Alice');
  });

  expect(result.current.values).toEqual({ name: 'Alice' });
});
```

### Testing Memoization

```typescript
it('should memoize expensive calculation', () => {
  const calculate = jest.fn((n) => n * 2);
  const { result, rerender } = renderHook(({ value }) => useExpensiveCalc(value, calculate), {
    initialProps: { value: 5 },
  });

  expect(result.current).toBe(10);
  expect(calculate).toHaveBeenCalledTimes(1);

  // Rerender with same value
  rerender({ value: 5 });

  // Should not recalculate
  expect(calculate).toHaveBeenCalledTimes(1);
});
```

### Testing Callbacks

```typescript
it('should call callback with correct args', () => {
  const onSubmit = jest.fn();
  const { result } = renderHook(() => useFormSubmit(onSubmit));

  act(() => {
    result.current.submit({ name: 'Alice' });
  });

  expect(onSubmit).toHaveBeenCalledWith({ name: 'Alice' });
});
```

## Commands

- **Run tests**: `../unit-testing/scripts/test-debug.sh`
- **Pattern match**: Add `--testPathPattern=hookName`

## Common Corrections

1. **Read [Test Failure Investigation Protocol](../test-failure-investigation/SKILL.md)** before modifying tests
2. **Wrap state updates in act()** - Required for React warnings
3. **Test via components when possible** - More realistic than isolated testing
4. **Use waitFor for async** - Don't use arbitrary timeouts
5. **Don't over-mock React** - Test real hook behavior
6. **Test behavior, not implementation** - Focus on what hook returns, not internal state
