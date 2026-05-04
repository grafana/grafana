---
name: test-failure-investigation
description: Protocol for handling failing tests. Use when tests fail to determine whether to fix implementation or update test. Treats test failures as signals of regressions, not obstacles.
metadata:
  type: foundational
  version: '1.0'
---

# Test Failure Investigation

## CRITICAL: Don't Modify Failing Tests Without Investigation

**NEVER skip, comment out, or change failing tests without understanding why they fail.**

Tests prove their value when they fail. A failing test is doing its job: catching a change in behavior.

## When a Test Fails

1. **Assume the test is correct** - It documents expected behavior
2. **Investigate** - Failure likely indicates regression, breaking change, or side effect
3. **Fix implementation, not test** - Unless test has a bug (typo, wrong mock), fix the code
4. **Document if updating** - Explain why old expectation was wrong, what changed in requirements
5. **Never skip** - `.skip()`, `.only()`, `@Ignore` are debugging tools, not solutions

## Bad vs Good Responses

```typescript
// ❌ NEVER
it.skip('should validate', () => { ... });
// it('should validate', () => { ... });
expect(result).toBe(wrongValue); // Changed to pass

// ✅ FIX CODE
// Test expects throw for null, but code changed to return false.
// Breaking API contract. Reverting implementation.
expect(() => validateInput(null)).toThrow();

// ✅ OR JUSTIFY CHANGE
// Requirements changed per #1234: null now returns false
expect(validateInput(null)).toBe(false);
```

## Investigation Checklist

1. What behavior does the test document?
2. What changed recently?
3. Is the change intentional?
4. Does implementation violate documented contracts?
5. Do other tests/docs support original behavior?

## Valid Reasons to Update Tests

- Requirements changed (documented)
- Test has actual bug (typo, wrong mock setup)
- Refactoring test code (not expectations)
- Intentional API contract change (approved)

## Invalid Reasons

- Test failing after code changes
- Test seems "too strict"
- Test is inconvenient
- "Code works, so test is wrong"

## Red Flags

- Frequent test modifications in PRs
- Tests skipped without explanation
- Weakened assertions (`.toBe(value)` → `.toBeDefined()`)
- Generic "fix tests" commit messages
- Multiple failures after "small change"

These indicate implementation issues, not test issues.
