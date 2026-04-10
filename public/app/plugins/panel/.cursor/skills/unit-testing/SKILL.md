---
name: unit-testing
description: Write Jest unit tests for TypeScript/React code. Use when adding tests, fixing failing tests, or ensuring test quality. References specialized sub-skills for utils, React components, and React hooks.
compatibility: Requires Jest, @testing-library/react, @grafana dependencies
metadata:
  framework: jest
  version: '1.0'
---

# Unit Testing

Write Jest unit tests following established patterns. This skill references specialized sub-skills based on what you're testing.

## ⚠️ Read First: Test Failure Investigation

**Before writing or modifying any tests, read [Test Failure Investigation Protocol](../test-failure-investigation/SKILL.md).**

Critical: Don't modify failing tests without investigation - they catch regressions.

## What Are You Testing?

Choose the appropriate sub-skill based on what you're testing:

### 1. Pure Functions & Business Logic

→ **[unit-test-utils](../unit-test-utils/SKILL.md)**

Use for:

- Data transformations and parsers
- Utility functions
- Business logic and calculations
- Pure functions without side effects

Example: `graphvizAst.ts`, `data.ts`, `builderMode.ts`

### 2. React Components

→ **[unit-test-react-components](../unit-test-react-components/SKILL.md)**

Use for:

- Component rendering and output
- User interactions (clicks, typing)
- Conditional rendering
- Accessibility testing

Example: `EmptyStateContent`, `ErrorDisplay`, `BuilderModeOverlay`

### 3. React Hooks

→ **[unit-test-react-hooks](../unit-test-react-hooks/SKILL.md)**

Use for:

- Custom hooks with state logic
- Hooks with side effects
- Reusable hook logic
- Hook state management

Example: `useConfirmation`, `useModalForm`, `useDragEdge`

## Quick Reference

### Commands

```bash
# Run with verbose LLM-friendly output
.opencode/skills/unit-testing/scripts/test-debug.sh

# Run specific test file
.opencode/skills/unit-testing/scripts/test-debug.sh --testPathPattern=data.test

# Run tests matching name
.opencode/skills/unit-testing/scripts/test-debug.sh -t "should validate"
```

### Testing Strategy

From [testing-strategy](../testing-strategy/SKILL.md):

- **Target: >80% coverage** overall
- **100% is overkill** - Focus on testable units
- **Exception: Pure functions** can be 100% covered
- **Avoid brittle mocks** - Test real behavior when possible

### Core Principles

**All unit tests should:**

- Use descriptive test names (`should return X when Y`)
- Follow testCases array pattern for parameterized tests
- Test behavior, not implementation details
- Minimize mocking - only mock external boundaries
- Reference appropriate sub-skill for specific patterns

**Read the sub-skills for detailed patterns and examples.**

## Test Structure Pattern

```typescript
import { functionName } from './module';

describe('moduleName', () => {
  describe('functionName', () => {
    const testCases = [
      {
        name: 'should handle case A',
        input: 'valueA',
        expected: 'resultA',
      },
      {
        name: 'should handle case B',
        input: 'valueB',
        expected: 'resultB',
      },
    ];

    testCases.forEach(({ name, input, expected }) => {
      it(name, () => {
        expect(functionName(input)).toBe(expected);
      });
    });

    it('should handle edge case', () => {
      expect(functionName(null)).toBeNull();
    });
  });
});
```

## Framework & Commands

- **Framework**: Jest with @testing-library/react
- **Run tests**: `npm test` (watch mode, changed files only)
- **Run CI tests**: `npm run test:ci` (coverage, all tests)
- **Debug script**: `.opencode/skills/unit-testing/scripts/test-debug.sh`
- **Coverage**: V8 provider with monocart reports

## File Location

- Place test files adjacent to source: `module.ts` → `module.test.ts`
- Import from relative paths: `import { fn } from './module'`

## When Writing Tests

1. **Identify what you're testing** - Choose the right sub-skill
2. **Read the relevant sub-skill** - Follow specific patterns
3. **Read [testing-strategy](../testing-strategy/SKILL.md)** - Understand coverage goals
4. **Use testCases arrays** - For parameterized scenarios
5. **Test edge cases** - Null, undefined, empty, boundaries
6. **Run locally**: Use the test-debug.sh script
7. **Ensure tests pass** - Before committing

## Common Corrections

1. **Read [Test Failure Investigation Protocol](../test-failure-investigation/SKILL.md)** before modifying failing tests
2. **Choose the right sub-skill** - Utils vs Components vs Hooks have different patterns
3. **Avoid over-mocking** - Test real behavior when possible
4. **Use testCases arrays** - For similar scenarios with different inputs
5. **Test behavior, not implementation** - Focus on inputs/outputs, not internals
6. **Aim for 80% coverage** - Not 100%, focus on testable units
