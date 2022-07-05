#!/usr/bin/env bash

FRONTEND_FLAG=$1
PATHS=($2)

frontend_coverage() {
    ## Coverage paths are slightly differently formatted compared to test paths
    COVERAGE_PATHS=""
    declare -a TEST_PATHS=()
    CMD=('jest' '--coverage' '--collectCoverageFrom=')
    for i in "${!PATHS[@]}"; do
        ## Identify which plugin path has been passed in
        PLUGIN=$(echo ${PATHS[i]} | awk -F '/' '{ print $NF }')
        echo "Running frontend coverage check for: $PLUGIN"
        ## If this is the last element do not append a comma
        if [ $i -lt $((${#PATHS[@]} - 1)) ]; then
            COVERAGE_PATHS="$COVERAGE_PATHS\"${PATHS[i]}/**\","
        else
            COVERAGE_PATHS="$COVERAGE_PATHS\"${PATHS[i]}/**\""
        fi
        TEST_PATHS+=("--testPathPattern=\"${PATHS[i]}/*\"")
    done
    FULL_CMD="${CMD[*]}'[$COVERAGE_PATHS]' ${TEST_PATHS[*]}"
    RESULT=$(yarn exec $FULL_CMD)

    PLUGIN_COVERAGE=""
    ## Set field delimiter so that we can easily split the path
    IFS='/'
    for i in "${!PATHS[@]}"; do
        read -a splitpath <<<${PATHS[i]}
        ## Retrive line coverage from result
        PLUGIN_COVERAGE="$PLUGIN_COVERAGE$(echo $RESULT | grep ${splitpath[-1]} | head -1 | cut -d '|' -f 1,5) + "
    done
    echo -e $PLUGIN_COVERAGE
}

backend_coverage() {
    ## Create directory for backend coverage output
    mkdir backend_coverage
    CMD=('go' 'test' '-coverprofile')
    PLUGIN_COVERAGE=""
    for i in "${!PATHS[@]}"; do
        ## Identify plugin
        PLUGIN=$(echo ${PATHS[i]} | awk -F '/' '{ print $NF }')
        echo "Running backend coverage check for: $PLUGIN"
        FULL_CMD="${CMD[*]} backend_coverage/$PLUGIN.cov ./${PATHS[i]}"
        ## This command generates the HTML report
        HTML_CMD=('go' 'tool' 'cover' "-html=backend_coverage/$PLUGIN.cov" "-o backend_coverage/$PLUGIN.html")
        RESULT=$($FULL_CMD)
        $(${HTML_CMD[*]})
        ## Retrieve coverage from result
        PLUGIN_COVERAGE="$PLUGIN_COVERAGE$PLUGIN | $(echo $RESULT | cut -d ':' -f 2 | grep -Eo '[0-9]+\.[0-9]+') + "
    done
    echo -e $PLUGIN_COVERAGE
}

if [ "$FRONTEND_FLAG" = true ]; then
    echo "Executing frontend coverage"
    frontend_coverage
else
    echo "Executing backend coverage"
    backend_coverage
fi
