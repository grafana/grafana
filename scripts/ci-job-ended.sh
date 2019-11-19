#!/bin/bash
# shellcheck source=./scripts/helpers/exit-if-fail.sh
source "$(dirname "$0")/../helpers/exit-if-fail.sh"

echo -e "Echo job start date"

echo "$GF_JOB_START"
echo "$CIRCLE_JOB"

 exit_if_fail echo "./scripts/ci-metrics-publisher.sh grafana.ci-buildtimes.$CIRCLE_JOB=$GF_JOB_START"
 
