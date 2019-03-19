#!/bin/bash

function exit_if_fail {
    command=$@
    echo "Executing '$command'"
    eval $command
    rc=$?
    if [ $rc -ne 0 ]; then
        echo "'$command' returned $rc."
        exit $rc
    fi
}

start=$(date +%s)

exit_if_fail npm run prettier:check
exit_if_fail npm run test

end=$(date +%s)
seconds=$((end - start))

if [ "${CIRCLE_BRANCH}" == "master" ]; then
	exit_if_fail ./scripts/ci-frontend-metrics.sh
	exit_if_fail ./scripts/ci-metrics-publisher.sh grafana.ci-performance.frontend-tests=$seconds
fi

