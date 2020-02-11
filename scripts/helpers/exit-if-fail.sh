#!/bin/bash

function exit_if_fail {
    # shellcheck disable=SC2124
    command=$@
    echo "Executing '$command'"
    eval "$command"
    rc=$?
    if [ $rc -ne 0 ]; then
        echo "'$command' returned $rc."
        exit $rc
    fi
}
