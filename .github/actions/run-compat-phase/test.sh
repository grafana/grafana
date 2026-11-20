#!/usr/bin/env bash
set -euo pipefail

action_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# Run the action's inline script with the same Bash options GitHub Actions uses.
awk '
  /^      run: \|$/ { reading = 1; next }
  reading && /^        / { print substr($0, 9); next }
  reading && /^$/ { print; next }
  reading { exit }
' "$action_dir/action.yml" > "$work/phase.sh"
test -s "$work/phase.sh"

export CHECKOUT="$work/checkout"
export NEWER_CHECKOUT="$CHECKOUT"
export NEWER_BINARIES="$work/bin"
export OLDER_BINARIES="$NEWER_BINARIES"
export GRAFANA_COMPAT_ROLE=older
export TEST=TestCompatSetup
mkdir -p "$CHECKOUT/pkg/tests/compat/smoke" "$NEWER_BINARIES"

cat > "$work/fixture_test.go" <<'EOF'
package fixture

import (
	"fmt"
	"os"
	"testing"
)

func TestMain(m *testing.M) {
	if os.Getenv("GRAFANA_COMPAT_PRINT_OWNERS") == "1" {
		if os.Getenv("COMPAT_TEST_SCENARIO") == "unknown-owner" {
			fmt.Fprintln(os.Stderr, "fixture: no CODEOWNERS entry")
			os.Exit(1)
		}
		fmt.Println("@example/compat")
		return
	}
	code := m.Run()
	if os.Getenv("COMPAT_TEST_SCENARIO") != "pass" {
		os.Exit(7)
	}
	os.Exit(code)
}

func TestCompatSetup(t *testing.T) {}
EOF
go test -c -o "$NEWER_BINARIES/smoke.test" "$work/fixture_test.go"

run_phase() {
  local scenario="$1"
  touch "$work/$scenario.md"
  COMPAT_TEST_SCENARIO="$scenario" GRAFANA_COMPAT_DIR="$work/$scenario" \
    LOG="$work/$scenario.log" GITHUB_STEP_SUMMARY="$work/$scenario.md" \
    bash --noprofile --norc -eo pipefail "$work/phase.sh"
}

run_phase pass
diff -u /dev/null "$work/pass.md"

check_failed_phase() {
  local scenario="$1" ownership="$2" status=0 expected
  run_phase "$scenario" > "$work/$scenario.step.log" 2>&1 || status=$?
  if [ "$status" -ne 1 ]; then
    echo "Expected the runner to fail after the test process exited nonzero, got $status" >&2
    cat "$work/$scenario.step.log" >&2
    exit 1
  fi
  jq -e --arg test "$TEST" 'select(.Test == $test and .Action == "pass")' "$work/$scenario-smoke.json" > /dev/null
  expected="- \`smoke/TestCompatSetup\` (older, $scenario) failed, $ownership"
  printf '%s\n' "$expected" | diff -u - "$work/$scenario.md"
  grep -Fx -- "$expected" "$work/$scenario.step.log"
  grep -Fx -- "$expected" "$work/$scenario.log" > /dev/null
}

check_failed_phase post-pass-failure "package owned by @example/compat"
check_failed_phase unknown-owner "owners unknown"
grep -Fx -- "fixture: no CODEOWNERS entry" "$work/unknown-owner.step.log"
grep -Fx -- "::warning::Could not resolve package owners for smoke" "$work/unknown-owner.step.log" > /dev/null
