# Excluding flaky tests from CI

`.github/test-exclusions.json` lists tests that CI skips, so a flaky test does not block merges. Remove your entry when the test is fixed.

```json
[{ "type": "go", "test": "TestFoo", "codeowner": "@grafana/my-squad" }]
```

- `type`: `go`, `jest` or `playwright`.
- `test`: the exact name, never a pattern.
  - `go`: a top-level test function, such as `TestFoo`.
  - `jest`: the full test name, with `describe` titles and the test title joined by spaces.
  - `playwright`: the full title as printed by `yarn playwright test --list`, without the project and file prefix.
- `codeowner`: the team or user responsible for fixing the test.

Edits to the file need approval from its CODEOWNERS entry, and `scripts/ci/validate-test-exclusions.sh` checks the format in CI.

## Caveats

These apply to every type, and matter when deciding whether an exclusion is safe.

- **Names match across packages and files.** An entry matches by name alone, so a common name excludes every test that shares it, in every package. Prefer excluding a distinctly named test, or rename the flaky one first.
- **A stale entry is silent.** If the test is renamed or deleted, the entry stops matching and nothing fails. Entries are not checked against real test names.
- **Excluded tests vanish from the output.** They are not reported as skipped, so the only record of an exclusion is this file.
- **A fully excluded package or file still passes.** Go reports `ok [no tests to run]`, so excluding everything in a package turns it green rather than red.

### Go

- **Subtests cannot be excluded individually.** `go test -skip` matches each `/`-separated element, so entries must be the top-level `TestFoo`, not `TestFoo/case`. A flaky table case means excluding the whole parent test, and the validator rejects anything that is not a top-level name.
- The exclusion applies to the enterprise module too, since every Go job reads the same list.

### Jest and Playwright

- Excludes by full test title, so a `describe` or test rename breaks the entry.
- `test.each` and `describe.each` titles are the interpolated ones, not the templates.
- Passing your own `--testNamePattern` or `--grep-invert` overrides the exclusions.
