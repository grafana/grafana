# Unit Testing Scripts

## test-debug.sh

LLM-optimized Jest test runner with verbose CLI output.

**Usage:**

```bash
# Run all tests
./test-debug.sh

# Run specific test file
./test-debug.sh --testPathPattern=data.test

# Run tests matching name pattern
./test-debug.sh -t "should validate"
```

**Features:**

- `--verbose`: Full test hierarchy with pass/fail indicators
- `--expand`: Complete assertion diffs (not truncated patches)
- `--testLocationInResults`: File paths and line numbers
- `--bail`: Stops at first failure
- `--no-coverage`: Skips HTML reports
- `--maxWorkers=1`: Sequential execution for deterministic output
- `--no-cache`: Fresh run every time

**Why use this over `npm test`?**

The standard `npm test` uses watch mode and coverage reports optimized for humans with HTML output. This script provides clean, parseable CLI output ideal for LLM debugging and analysis.
