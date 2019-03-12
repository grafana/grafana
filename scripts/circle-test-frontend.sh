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

exit_if_fail npm run prettier:check
exit_if_fail npm run test

# On master also collect some and send some metrics
branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "${branch}" == "master" ]; then
  exit_if_fail ./scripts/circle-metrics.sh
fi
