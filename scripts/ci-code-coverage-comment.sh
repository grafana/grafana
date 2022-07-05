#!/usr/bin/env bash

IFS="+"
FRONTEND_FLAG=$1
PR_NUMBER=$2
PR_COVERAGE=($3)
MAIN_COVERAGE=($4)

COMMENT="code coverage report for PR #$PR_NUMBER\n| Plugin |          Main                       |   PR   | Difference |\n| ------ | ----------------------------------- | ------ | ---------- |\n"

for i in "${!PR_COVERAGE[@]}"; do
    CURR_PR_LINE=${PR_COVERAGE[i]}
    CURR_MAIN_LINE=${MAIN_COVERAGE[i]}
    PLUGIN=$(echo $CURR_PR_LINE | cut -d '|' -f 1 | xargs)
    PR_COV=$(echo $CURR_PR_LINE | cut -d '|' -f 2 | xargs)
    MAIN_COV=$(echo $CURR_MAIN_LINE | cut -d '|' -f 2 | xargs)
    COMMENT="$COMMENT|  $PLUGIN |   $MAIN_COV%  |   $PR_COV%    |   $(bc <<<"$PR_COV - $MAIN_COV")% |\n"
done

if [ "$FRONTEND_FLAG" = true ]; then
    echo "Creating frontend comment"
    echo -e "Frontend $COMMENT"
else
    echo "Creating backend comment"
    echo -e "Backend $COMMENT"
fi
