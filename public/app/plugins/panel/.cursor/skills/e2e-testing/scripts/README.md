# E2E Testing Scripts

## test-debug.sh

LLM-optimized Playwright test runner with verbose CLI output.

**Prerequisites:**

Grafana server must be running. Start it first:

```bash
npm run server  # In separate terminal
```

**Usage:**

```bash
# Run all tests
./.opencode/skills/e2e-testing/scripts/test-debug.sh

# Run specific test file
./.opencode/skills/e2e-testing/scripts/test-debug.sh e2e/specs/panel.spec.ts

# Run tests matching pattern
./.opencode/skills/e2e-testing/scripts/test-debug.sh --grep "Builder mode"

# Run single test by line number
./.opencode/skills/e2e-testing/scripts/test-debug.sh e2e/specs/panel.spec.ts:40
```

**Features:**

- `--reporter=list`: Line-by-line test output (no HTML)
- `--workers=1`: Sequential execution for deterministic output
- `--retries=0`: No retries, fail fast
- `--timeout=30000`: 30s timeout per test

**Why use this over `npm run e2e`?**

The standard `npm run e2e` uses Docker with HTML/monocart reporters optimized for humans. This script provides clean, parseable CLI output ideal for LLM debugging and analysis.

**Important:**

This does NOT start Grafana automatically. Use for local debugging only.
For full CI-like runs with automatic server setup, use `npm run e2e`.
