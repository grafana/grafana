---
name: unit-test-utils
description: Write Jest unit tests for pure utility functions, data transformations, parsers, and business logic. Use for testing deterministic functions without mocks. Focus on 80% coverage of testable units.
compatibility: Requires Jest
metadata:
  framework: jest
  version: '1.0'
  target: utilities
---

# Unit Testing Utils

Write Jest tests for pure utility functions and business logic without complex mocking.

## ⚠️ Read First: Test Failure Investigation

**Before writing or modifying any tests, read [Test Failure Investigation Protocol](../test-failure-investigation/SKILL.md).**

This foundational skill covers critical principles including:

- Why failing tests should NOT be modified without investigation
- How tests prove their value when they catch regressions
- When it's appropriate to update tests vs fix implementations
- Investigation checklist for handling test failures

The test failure investigation protocol is **required reading** for understanding the philosophy and approach to testing in this project.

## Test Framework & Commands

- **Framework**: Jest with @testing-library/react
- **Run tests**: `npm test` (watch mode, changed files only)
- **Run CI tests**: `npm run test:ci` (coverage, all tests)
- **Debug tests (LLM-friendly)**: `.skills/unit-testing/scripts/test-debug.sh` (verbose CLI output, no HTML)
- **Coverage**: V8 provider with monocart reports

### LLM-Friendly Test Debugging

When investigating test failures or debugging, use the provided script for optimal CLI output:

```bash
# Run all tests with verbose output
.skills/unit-testing/scripts/test-debug.sh

# Run specific test file
.skills/unit-testing/scripts/test-debug.sh --testPathPattern=data.test

# Run tests matching name
.skills/unit-testing/scripts/test-debug.sh -t "should validate"
```

This script provides:

- Verbose test hierarchy with pass/fail status
- Full assertion diffs (not truncated)
- File paths and line numbers for failures
- Stops at first failure for faster iteration
- No HTML coverage reports cluttering output
- Sequential execution for deterministic output

## File Naming & Location

- Test files use `.test.ts` or `.test.tsx` extension
- Place test files adjacent to source files (e.g., `data.ts` → `data.test.ts`)
- Import functions from relative paths: `import { functionName } from './moduleName'`

## Test Structure Patterns

### Use testCases Arrays for Parameterized Tests

When testing multiple scenarios for the same function, use a `testCases` array with `forEach`:

```typescript
describe('functionName', () => {
  const testCases = [
    {
      name: 'should handle basic case',
      input: 'value',
      expected: 'result',
    },
    {
      name: 'should handle edge case',
      input: 'edge',
      expected: 'edgeResult',
    },
  ];

  testCases.forEach(({ name, input, expected }) => {
    it(name, () => {
      expect(functionName(input)).toBe(expected);
    });
  });
});
```

### Individual Test Cases

For unique scenarios or complex setup, use individual `it` blocks:

```typescript
it('should return null for invalid input', () => {
  const result = functionName(null);
  expect(result).toBeNull();
});
```

## Test Naming Conventions

- Use descriptive `it` or `test` names that explain behavior
- Start with "should" for clarity: `'should return true for valid input'`
- Be specific: `'should return last value when multiple values exist'`
- Avoid generic names like "test 1" or "works"

## Mocking Patterns

### Mock Grafana DataFrames

```typescript
import { DataFrame, FieldType } from '@grafana/data';

const frames: DataFrame[] = [
  {
    fields: [
      {
        name: 'fieldName',
        type: FieldType.string,
        values: ['value1', 'value2'],
        config: {},
      },
    ],
    length: 2,
  } as DataFrame,
];
```

### Mock Complex Objects

```typescript
const mockEdge = {
  attributes: { get: () => null },
  targets: [{ id: 'A' }, { id: 'B' }],
};
```

## Assertions

Use appropriate matchers:

- `.toBe()` for primitives and references
- `.toEqual()` for objects/arrays
- `.toBeNull()`, `.toBeUndefined()`, `.toBeDefined()` for null checks
- `.toThrow()` for errors (with optional message substring)
- `.not.toThrow()` for validating no errors

## Testing Exceptions

```typescript
it('should throw for invalid input', () => {
  expect(() => validateInput('bad')).toThrow('Expected error message');
});

it('should not throw for valid input', () => {
  expect(() => validateInput('good')).not.toThrow();
});
```

## Test Coverage Best Practices

1. **Happy path**: Test expected behavior with valid inputs
2. **Edge cases**: Empty strings, null, undefined, empty arrays
3. **Boundary conditions**: Min/max values, exactly at limits
4. **Error conditions**: Invalid inputs, exceptions
5. **Multiple scenarios**: Different input combinations

## Example: Complete Test Suite

```typescript
import { functionName } from './module';

describe('moduleName', () => {
  describe('functionName', () => {
    const testCases = [
      {
        name: 'should handle basic input',
        input: { foo: 'bar' },
        expected: 'bar',
      },
      {
        name: 'should handle special characters',
        input: { foo: 'hello-world' },
        expected: 'hello-world',
      },
    ];

    testCases.forEach(({ name, input, expected }) => {
      it(name, () => {
        expect(functionName(input)).toBe(expected);
      });
    });

    it('should return null for missing property', () => {
      expect(functionName({})).toBeNull();
    });

    it('should throw for null input', () => {
      expect(() => functionName(null)).toThrow('Input required');
    });
  });
});
```

## Common Corrections

1. **Read [Test Failure Investigation Protocol](../test-failure-investigation/SKILL.md) before modifying failing tests** - Critical principles apply
2. **Always use testCases arrays** - to table test similar scenarios with different inputs
3. **Never skip describe blocks** - group related tests logically
4. **Be specific in test names** - explain what behavior is being tested
5. **Mock @grafana types properly** - use `as DataFrame` type assertions
6. **Test edge cases** - don't just test the happy path
7. **Use appropriate matchers** - `.toBe()` vs `.toEqual()` matters
8. **Cover error paths** - test both success and failure scenarios

## TypeScript Considerations

- Import types from `@grafana/data` for DataFrames and FieldTypes
- Use type assertions when mocking: `as DataFrame`, `as any` (sparingly)
- Ensure test types match implementation types

## When Writing Tests

1. Read similar test files first to understand patterns
2. Use testCases arrays for parameterized scenarios
3. Write descriptive test names
4. Test edge cases and error conditions
5. Run tests locally: `npm test`
6. Ensure all tests pass before committing
