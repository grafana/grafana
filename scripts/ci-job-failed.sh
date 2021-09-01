#!/bin/bash

# shellcheck source=./scripts/helpers/exit-if-fail.sh
source "$(dirname "$0")/helpers/exit-if-fail.sh"

echo -e "Report build times and build outcome"

start=$GF_JOB_START
runtime=$((($(date +%s%N) - start)/1000000))

echo -e "The job $CIRCLE_JOB took $runtime (ms)"

if [ "${CIRCLE_BRANCH}" == "main" ]; then
exit_if_fail ./scripts/ci-metrics-publisher.sh "grafana.ci-buildtimes.$CIRCLE_JOB=$runtime"
exit_if_fail ./scripts/ci-metrics-publisher.sh "grafana.ci-buildoutcome.$CIRCLE_JOB=0"
fi
