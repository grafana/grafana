#!/usr/bin/env bash
#
# Runs the TimeComparison performance benchmark (#125104) with GC exposed for stable heap numbers.
# The benchmark itself lives in timeCompare.perf.test.ts and is skipped in CI unless opted in.
#
# Usage (from anywhere in the repo):
#   ./public/app/plugins/panel/timeseries/timeCompare.perf.sh
#
# Tunables (env): SERIES, WINDOW_HOURS, INTERVAL_SEC, OFFSET_HOURS, ITERATIONS
#   SERIES=1000 ./public/app/plugins/panel/timeseries/timeCompare.perf.sh
#
# Extra args are forwarded to jest, e.g. `... timeCompare.perf.sh --silent`.

set -euo pipefail

# Resolve the repo root from this script's location so it runs from any cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../../../.." && pwd)"

cd "${REPO_ROOT}"

RUN_TIMECOMPARE_BENCH=1 node --expose-gc node_modules/.bin/jest \
  public/app/plugins/panel/timeseries/timeCompare.perf.test.ts \
  --runInBand --no-coverage --watchAll=false "$@"
