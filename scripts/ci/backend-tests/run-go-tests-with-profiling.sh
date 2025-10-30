#!/usr/bin/env bash
set -euo pipefail

usage() {
    {
        echo "run-go-tests-with-profiling.sh: Run tests with optional profiling for flaky packages."
        echo "usage: $0 [-h] -t <tags> [-r <run-pattern>] [-p <parallel>] [-o <output-dir>] [-T <timeout>] [-P <packages>]"
        echo
        echo "Options:"
        echo "  -h: Show this help message."
        echo "  -t: Go tags (e.g., sqlite, mysql, postgres). Required."
        echo "  -r: Test run pattern (e.g., '^TestIntegration'). Default: '^TestIntegration'"
        echo "  -p: Parallelism for main tests. Default: 4"
        echo "  -o: Output directory for profiling data. Default: profiles"
        echo "  -T: Timeout for tests. Default: 8m"
        echo "  -P Package paths to test."
        echo "      Can be repeated to specify multiple packages."
        echo "      Can be - to read from stdin (one package per line)."
        echo "      Default: none (all packages with tests)"
        echo
        echo "Environment Variables:"
        echo "  PROFILE_PACKAGES: Newline-separated list of packages to profile."
        echo "                    These packages will run in background with profiling enabled."
        echo "  PROFILE_PARALLEL_RUNS: Newline-separated list of parallel run counts."
        echo "                         Must have same number of entries as PROFILE_PACKAGES."
        echo "  MAX_WAIT_MINUTES: Maximum time to wait for profiled tests after main tests (in minutes)."
        echo "                    Default: 10 minutes"
        echo
        echo "Examples:"
        echo "  # Single package with profiling:"
        echo "  export PROFILE_PACKAGES=\"pkg/tests/apis/folder\""
        echo "  export PROFILE_PARALLEL_RUNS=\"3\""
        echo "  echo \"./pkg/tests/apis/folder\" | $0 -t sqlite -r '^TestIntegration' -P -"
        echo
        echo "  # Multiple packages with profiling:"
        echo "  export PROFILE_PACKAGES=\"pkg/tests/apis/folder"
        echo "  pkg/tests/apis/dashboard\""
        echo "  export PROFILE_PARALLEL_RUNS=\"1"
        echo "  2\""
        echo "  echo \"./pkg/tests/apis/folder ./pkg/tests/apis/dashboard\" | $0 -t sqlite -r '^TestIntegration' -P -"
        echo
        echo "Analyzing Downloaded Artifacts:"
        echo "  When profiled tests fail, artifacts are generated containing:"
        echo "    - CPU profiles (cpu_*.prof)"
        echo "    - Memory profiles (mem_*.prof)"
        echo "    - Execution traces (trace_*.out)"
        echo "    - Test logs (test_*.log)"
        echo "    - Exit codes (exit_*.code)"
        echo
        echo "  # Analyze profiles and traces:"
        echo "  go tool pprof cpu_pkg_tests_apis_dashboard_run1.prof"
        echo "  go tool pprof -alloc_space mem_pkg_tests_apis_datasource_run1.prof"
        echo "  go tool trace trace_pkg_tests_apis_datasource_run1.out"
        echo
        echo "  For more information:"
        echo "    - CPU/Memory profiling: https://go.dev/blog/pprof"
        echo "    - Execution traces: https://pkg.go.dev/cmd/trace https://go.dev/blog/execution-traces-2024"
    } >&2
}

is_int() {
    if [[ "$1" =~ ^[0-9]+$ ]]; then
        return 0
    else
        return 1
    fi
}

# Array of packages to profile (flaky tests that need detailed profiling)
profile_packages=()
# Number of parallel runs for each package (must match profile_packages indices)
profile_parallel_runs=()

if [[ -n "${PROFILE_PACKAGES:-}" ]]; then
  readarray -t profile_packages <<<"${PROFILE_PACKAGES}"
fi

if [[ -n "${PROFILE_PARALLEL_RUNS:-}" ]]; then
  readarray -t profile_parallel_runs <<<"${PROFILE_PARALLEL_RUNS}"
fi

if [ ${#profile_packages[@]} -ne ${#profile_parallel_runs[@]} ]; then
    echo "❌ ERROR: profile_packages and profile_parallel_runs must have the same number of elements"
    echo "   profile_packages: ${#profile_packages[@]} elements"
    echo "   profile_parallel_runs: ${#profile_parallel_runs[@]} elements"
    exit 1
fi

# Show configuration summary
if [ ${#profile_packages[@]} -gt 0 ]; then
  echo ""
  echo "📋 Profile Configuration Summary:"
  echo "   Packages to profile: ${#profile_packages[@]}"
  for i in "${!profile_packages[@]}"; do
    echo "     • ${profile_packages[$i]} → ${profile_parallel_runs[$i]} parallel run(s)"
  done
  echo ""
fi

# Default values
TEST_TAGS=""
RUN_PATTERN="^TestIntegration"
packages=()
PROFILE_OUTPUT_DIR="profiles"
GO_TEST_TIMEOUT="8m"
GO_TEST_PARALLEL=4

while getopts ":h:t:r:P:o:T:p:" opt; do
    case $opt in
        h)
            usage
            exit 0
            ;;
        t)
            TEST_TAGS="$OPTARG"
            ;;
        r)
            RUN_PATTERN="$OPTARG"
            ;;
        p)
            if ! is_int "$OPTARG"; then
                echo "Error: -p must be an integer." >&2
                usage
                exit 1
            fi
            GO_TEST_PARALLEL=$OPTARG
            ;;
        o)
            PROFILE_OUTPUT_DIR="$OPTARG"
            ;;
        T)
            GO_TEST_TIMEOUT="$OPTARG"
            ;;
        P)
            packages+=("$OPTARG")
            ;;
        \?)
            echo "Invalid option: -$OPTARG" >&2
            usage
            exit 1
            ;;
        :)
            echo "Option -$OPTARG requires an argument." >&2
            usage
            exit 1
            ;;
    esac
done
shift $((OPTIND - 1))

# Validate required arguments
if [ -z "$TEST_TAGS" ]; then
    echo "Error: -t (tags) is required." >&2
    usage
    exit 1
fi

# Handle package input
# If packages is just ("-"), read from stdin instead
if [[ ${#packages[@]} -eq 1 && "${packages[0]}" == "-" ]]; then
    packages=()
    while IFS= read -r line; do
        # Split line by whitespace in case multiple packages are on same line
        if [[ -n "$line" ]]; then
            read -ra line_packages <<< "$line"
            for pkg in "${line_packages[@]}"; do
                [[ -n "$pkg" ]] && packages+=("$pkg")
            done
        fi
    done
fi

# Use packages directly - they're already full paths from shard.sh
PACKAGES=("${packages[@]}")
if [[ ${#PACKAGES[@]} -eq 0 ]]; then
    echo "Error: No packages provided. Use -d to specify packages or pipe from stdin." >&2
    usage
    exit 1
fi

# Find which profile packages are in this shard (maintain index alignment)
profile_packages_abs=()
for i in "${!profile_packages[@]}"; do
  profile_pkg="${profile_packages[$i]}"
  MATCHED=""
  for pkg in "${PACKAGES[@]}"; do
    if [[ "$pkg" == *"$profile_pkg"* ]]; then
      MATCHED="$pkg"
      break
    fi
  done
  profile_packages_abs+=("$MATCHED")
  if [ -n "$MATCHED" ]; then
    echo "🔍 Found '$profile_pkg' in this shard: $MATCHED"
  fi
done


# Setup trap to kill background processes on exit/cancellation
PROFILE_PIDS=()
cleanup_tests() {
  local exit_code=$?
  # shellcheck disable=SC2317
  if [ ${#PROFILE_PIDS[@]} -gt 0 ]; then
    echo "🛑 Cleaning up background test processes: ${PROFILE_PIDS[*]}" >&2
    for pid in "${PROFILE_PIDS[@]}"; do
      kill -TERM "$pid" 2>/dev/null || true
    done
    sleep 2
    for pid in "${PROFILE_PIDS[@]}"; do
      kill -KILL "$pid" 2>/dev/null || true
    done
  fi
  return "$exit_code"
}
trap cleanup_tests SIGTERM SIGINT EXIT

# Start profiled tests in background
PROFILE_FAILED=0
if [ ${#profile_packages[@]} -gt 0 ]; then
  # Check if any packages are actually in this shard
  HAS_PROFILED_PACKAGES=false
  if [ ${#profile_packages_abs[@]} -gt 0 ]; then
    for abs_pkg in "${profile_packages_abs[@]}"; do
      if [ -n "$abs_pkg" ]; then
        HAS_PROFILED_PACKAGES=true
        break
      fi
    done
  fi

  if [ "$HAS_PROFILED_PACKAGES" = true ]; then
    echo ""
    echo "📊 Starting profiled test runs in the background ..."
    mkdir -p "$PROFILE_OUTPUT_DIR"

    # Iterate through matched packages
    for i in "${!profile_packages[@]}"; do
      profile_pkg="${profile_packages[$i]}"
      PARALLEL_RUNS="${profile_parallel_runs[$i]}"

      if [ -n "${profile_packages_abs[$i]:-}" ]; then
        MATCHED_PKG="${profile_packages_abs[$i]}"
        PKG_NAME=$(echo "$profile_pkg" | tr '/' '_' | tr '.' '_')

        echo "  📦 $profile_pkg: ${PARALLEL_RUNS} parallel run(s)"

        # Start multiple runs in parallel
        for run in $(seq 1 "$PARALLEL_RUNS"); do
          (
            EXIT_CODE=0
            set +e # disable exit on error for capturing exit code
            go test -tags="$TEST_TAGS" -timeout="$GO_TEST_TIMEOUT" -run "$RUN_PATTERN" \
              -outputdir="$PROFILE_OUTPUT_DIR" \
              -cpuprofile="cpu_${PKG_NAME}_run${run}.prof" \
              -memprofile="mem_${PKG_NAME}_run${run}.prof" \
              -trace="trace_${PKG_NAME}_run${run}.out" \
              "$MATCHED_PKG" 2>&1 | tee "$PROFILE_OUTPUT_DIR/test_${PKG_NAME}_run${run}.log"
            EXIT_CODE=${PIPESTATUS[0]}
            set -e
            echo "$EXIT_CODE" > "$PROFILE_OUTPUT_DIR/exit_${PKG_NAME}_run${run}.code"
            echo "    ✓ Run $profile_pkg $run/$PARALLEL_RUNS completed with exit code: $EXIT_CODE"
          ) &
          pid=$!
          echo "    🏃 Run $run/$PARALLEL_RUNS started (PID: $pid)"
          PROFILE_PIDS+=("$pid")
        done
      fi
    done

    if [ ${#PROFILE_PIDS[@]} -gt 0 ]; then
      echo "📊 All profiled tests launched in background (PIDs: ${PROFILE_PIDS[*]})"
    else
      echo "⚠️  No profiled test processes were started"
    fi
  else
    echo "⏭️  No profiled packages in this shard"
  fi
fi

# Run main tests (while profiled tests run in background)
MAIN_FAILED=0
if [ ${#PACKAGES[@]} -gt 0 ]; then
  echo ""
  echo "▶️  Running ${#PACKAGES[@]} test packages in parallel with profiled tests..."
  go test -p="$GO_TEST_PARALLEL" -tags="$TEST_TAGS" -timeout="$GO_TEST_TIMEOUT" -run "$RUN_PATTERN" "${PACKAGES[@]}" || MAIN_FAILED=$?
  if [ $MAIN_FAILED -eq 0 ]; then
    echo "✅ Main tests passed"
  else
    echo "❌ Main tests failed (exit code: $MAIN_FAILED)"
  fi
else
  echo "⏭️  No main packages to test"
fi

# Wait for profiled tests to complete
if [ ${#PROFILE_PIDS[@]} -gt 0 ]; then
  echo "⏳ Waiting for profiled tests to complete (PIDs: ${PROFILE_PIDS[*]})..."

  # Configurable max wait time (in minutes)
  MAX_WAIT_MINUTES=${MAX_WAIT_MINUTES:-10}  # Default: 10 minutes
  MAX_WAIT=$((MAX_WAIT_MINUTES * 6))  # Convert to 10-second intervals
  echo "  Timeout configured: ${MAX_WAIT_MINUTES} minutes"

  WAIT_COUNT=0
  while [ ${#PROFILE_PIDS[@]} -gt 0 ] && [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    sleep 10
    WAIT_COUNT=$((WAIT_COUNT + 1))

    # Check which PIDs are still running
    REMAINING_PIDS=()
    for pid in "${PROFILE_PIDS[@]}"; do
      if kill -0 "$pid" 2>/dev/null; then
        REMAINING_PIDS+=("$pid")
      fi
    done
    PROFILE_PIDS=("${REMAINING_PIDS[@]}")

    if [ ${#PROFILE_PIDS[@]} -eq 0 ]; then
      echo "  ✅ All profiled tests completed"
      break
    fi
    echo "  ⏳ Still waiting for ${#PROFILE_PIDS[@]} profiled test process(es) (check ${WAIT_COUNT}/${MAX_WAIT})"
  done

  # Kill any hung profiled tests
  if [ ${#PROFILE_PIDS[@]} -gt 0 ]; then
    echo "  ⚠️  Killing hung profiled tests after ${MAX_WAIT_MINUTES}min: ${PROFILE_PIDS[*]}"
    for pid in "${PROFILE_PIDS[@]}"; do
      kill -KILL "$pid" 2>/dev/null || true
    done
    PROFILE_FAILED=1
  fi

  # Check profiled test results
  echo "📊 Profiled test results:"
  for i in "${!profile_packages[@]}"; do
    profile_pkg="${profile_packages[$i]}"
    PARALLEL_RUNS="${profile_parallel_runs[$i]}"

    if [ -n "${profile_packages_abs[$i]:-}" ]; then
      PKG_NAME=$(echo "$profile_pkg" | tr '/' '_' | tr '.' '_')
      for run in $(seq 1 "$PARALLEL_RUNS"); do
        EXIT_CODE_FILE="$PROFILE_OUTPUT_DIR/exit_${PKG_NAME}_run${run}.code"
        if [ -f "$EXIT_CODE_FILE" ]; then
          EXIT_CODE=$(cat "$EXIT_CODE_FILE")
          if [ "$EXIT_CODE" -ne 0 ]; then
            echo "  ❌ Run $run/$PARALLEL_RUNS of $profile_pkg failed (exit $EXIT_CODE)"
            PROFILE_FAILED=1
          else
            echo "  ✅ Run $run/$PARALLEL_RUNS of $profile_pkg passed"
          fi
        else
          echo "  ⚠️  Run $run/$PARALLEL_RUNS of $profile_pkg: No exit code"
          PROFILE_FAILED=1
        fi
      done
    fi
  done
fi

# Fail if either main or profiled tests failed
if [ $MAIN_FAILED -ne 0 ] || [ $PROFILE_FAILED -ne 0 ]; then
  echo "❌ Test failures detected:" >&2
  [ $MAIN_FAILED -ne 0 ] && echo "  - Main tests failed (exit code: $MAIN_FAILED)" >&2
  [ $PROFILE_FAILED -ne 0 ] && echo "  - Profiled tests failed" >&2
  exit 1
fi
