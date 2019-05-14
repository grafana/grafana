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

export GRAFANA_TEST_DB=mysql

go test -tags=integration -count=1 ./pkg/infra/serverlock/...
# time for d in $(go list ./pkg/...); do
#   exit_if_fail go test -tags=integration $d
# done