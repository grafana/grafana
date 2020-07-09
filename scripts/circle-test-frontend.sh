#!/bin/bash

# shellcheck source=./scripts/helpers/exit-if-fail.sh
source "$(dirname "$0")/helpers/exit-if-fail.sh"

start=$(date +%s)

export TEST_MAX_WORKERS=2

exit_if_fail yarn run prettier:check
exit_if_fail yarn run packages:typecheck
exit_if_fail yarn run typecheck
exit_if_fail yarn run test

end=$(date +%s)
seconds=$((end - start))

exit_if_fail ./scripts/ci-frontend-metrics.sh

if [ "${CIRCLE_BRANCH}" == "master" ]; then
	exit_if_fail ./scripts/ci-metrics-publisher.sh grafana.ci-performance.frontend-tests=$seconds
fi

