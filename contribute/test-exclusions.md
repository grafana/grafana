# Excluding flaky tests from CI

`.github/test-exclusions.json` lists tests that CI skips, so a flaky test does not block merges. Remove your entry when the test is fixed.

```json
[{ "type": "go", "test": "TestFoo", "codeowner": "@grafana/my-squad" }]
```

- `type`: `go`, `jest` or `playwright`.
- `test`: the exact name, never a pattern.
  - `go`: a top-level test function, such as `TestFoo`. Subtests can't be excluded individually.
  - `jest`: the full test name, with `describe` titles and the test title joined by spaces.
  - `playwright`: the full title as printed by `yarn playwright test --list`, without the project and file prefix.
- `codeowner`: the team or user responsible for fixing the test.

Edits to the file need approval from its CODEOWNERS entry, and `scripts/ci/validate-test-exclusions.sh` checks the format in CI.
