---
name: frontend-testing-strategy
description: Write and review meaningful frontend unit, component, and E2E tests; diagnose weak assertions and flaky async tests. Read repository testing guidance for commands and fixtures.
---

# Frontend testing strategy

Read the repository's `contribute/testing.md` adapter and contributor guide before choosing commands, fixtures,
or a runner. These principles work with Jest, Vitest, and other runners. Do not introduce a
new runner just to follow this skill. For visualization behavior, also read the panel companion.

## Choose meaningful coverage

- Extend existing focused tests. Test production code, not test-local helpers or framework behavior.
- Use unit tests for logic, component/integration tests for collaboration and observable UI behavior,
  and targeted E2E tests for critical user journeys. Keep static checks as the foundation.
- Name each test for the behavior its assertions establish. Consolidate duplicate cases; use
  table-driven tests for meaningful variants. Avoid testing trivial initial values or mere rendering.
- Add tests with features and fixes. A regression test must fail without the fix and pass with it.
  Verify this using a reversible local change; restore production code before finishing.
- Before updating a failing assertion or snapshot, trace the failure and distinguish an intended
  behavior change from a regression. Never update expectations merely to obtain a green run.
- Review AI-generated tests for readability, real coverage, and unnecessary mocks. Coverage
  percentages do not substitute for a test that catches the intended regression.

## Assert the contract

Assert concrete computed values, visible behavior, or exact collaborator arguments. Existence,
"did not throw", and lengths that merely mirror input are insufficient by themselves.
Use independent expected values: do not call the implementation or duplicate its formula to
compute the expectation. A small, reviewed inline snapshot can freeze awkward deterministic
values. Broad DOM snapshots are not a substitute for behavioral assertions.

For consumers of theme colors, assert the intended semantic token from the supplied theme,
rather than today's hex value. When testing the palette or resolver itself, use independent
expected values. For query builders, compare the complete deterministic query, not a fragment.

Set every precondition needed to reach the target branch: flags, input shape, loading state,
and permissions. Check that deliberately breaking the behavior makes the test fail. Test names
must not claim more than the assertions prove.

## Exercise real behavior

Prefer real component trees over mocked children. Mock external boundaries, controlled time,
or APIs unavailable in the environment; keep working storage implementations and simple helpers
real. Use the repository's real feature-flag test utilities. Restore mocks and timers between tests.
Use the runner's typed mock helper rather than scattered unsafe casts.

Use semantic roles and accessible names for UI queries. When those are insufficient, use the
repository's stable selectors, scoped to the owning component. Drive interactions through
user-facing controls, not internal component state.

## Avoid flakes

- Establish a positive expected state before checking absence: an empty render must not pass.
- Await asynchronous UI with retrying assertions or find queries, not fixed sleeps. Retry callbacks
  must throw on failure. Do not repeat side effects inside retry callbacks.
- Pin time, locale, timezone, randomness, and dimensions when they affect the assertion.
- Scope locators to avoid previews and duplicate widgets. Wait for renderer or data readiness.
- Use deterministic interactions instead of unsupported DOM geometry hacks. Avoid reading
  transient text while virtualized or animated content is settling.
- Run focused tests in non-watch mode. Report commands, results, and unavailable checks accurately.
  Retries and broad suppressions must not conceal an unresolved failure.

Review meaningful interaction, error, empty-data, and accessibility states as applicable. Before
preview or release, review intentional coverage of critical journeys rather than simply counting tests.
