---
name: testing-strategy
description: Testing strategy and coverage goals for the project. Use when deciding what tests to write, what coverage to aim for, and how to balance unit vs e2e tests. Focuses on test pyramid with strong base (unit) and pinnacle (e2e).
metadata:
  type: foundational
  version: '1.0'
---

# Testing Strategy

## Test Pyramid Focus

Prioritize two layers:

1. **Base: Jest unit tests** - Pure functions, business logic, data transformations
2. **Pinnacle: Playwright E2E tests** - Critical user flows, integration points

Avoid the middle (brittle mocks, over-integration).

## Coverage Goals

- **Target: >80% overall coverage**
- **100% coverage is overkill** - Don't chase the last 20%
- **Exception: Pure functions can/should be 100%** - No side effects, easy to test exhaustively

## What to Unit Test

Focus on:

- Pure functions (data transformations, parsers, validators)
- Business logic (calculations, rules, algorithms)
- Utilities (helpers, formatters)
- Edge cases and error conditions

Avoid:

- Complex mocks of external dependencies
- Testing framework code (React hooks, Grafana APIs)
- Trivial code (getters, simple wrappers)

## What to E2E Test

Focus on:

- Critical user workflows end-to-end
- Integration between components
- Real browser interactions
- Visual/rendering behavior

## Avoid Brittle Mocks

Mocks become maintenance burdens when they:

- Replicate complex implementation details
- Break on internal refactors
- Drift from actual API behavior

**Better alternatives:**

- Test pure logic without mocks
- Use E2E tests for integration points
- Mock only at system boundaries (network, filesystem)

## Test Quality Over Quantity

Write tests that:

- Catch real bugs
- Document expected behavior
- Are easy to maintain
- Don't slow down development

Skip tests that:

- Just verify framework behavior
- Are fragile and flaky
- Require extensive mocking infrastructure
- Test implementation details vs behavior

## Commands

- **Unit tests**: `npm test` (watch), `npm run test:ci` (coverage)
- **E2E tests**: `npm run e2e`
- **Coverage report**: `npm run coverage` (merges unit + e2e)
