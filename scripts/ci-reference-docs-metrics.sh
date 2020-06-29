#!/bin/bash

# abort if we get any error
set -eo pipefail

report_reference_docs_metrics() {
  # $1 = branch that the script is running on.
  # $2 = number of warnings in current version of the code.

  if [ "${1}" == "master" ]; then
  ./scripts/ci-metrics-publisher.sh \
    grafana.ci-code.reference-docs.warnings="$2"
  fi
}

pretty_print_result_of_report() {
  # $1 = result of current report

  echo -e "\n\n"
  echo -e "-----------------------------------------------------\n"
  echo -e "$1\n"
  echo -e "-----------------------------------------------------"
}

REPORT_PATH="$(realpath "$(dirname "$0")/../reports/docs/")"
BUILD_SCRIPT_PATH="$(realpath "$(dirname "$0")/ci-reference-docs-build.sh")"

if [ ! -d "$REPORT_PATH" ]; then
  # this script needs to be run after the packages have been built and the api-extractor has completed.
  # shellcheck source=/scripts/ci-reference-docs-build.sh
  . "$BUILD_SCRIPT_PATH"
fi

WARNINGS_COUNT="$(find "$REPORT_PATH" -type f -name \*.log -print0 | xargs -0 grep -o "\[33mWarning:" | wc -l | xargs)"
WARNINGS_COUNT_LIMIT=900

if [ "$WARNINGS_COUNT" -gt $WARNINGS_COUNT_LIMIT ]; then
  echo -e "API Extractor warnings/errors $WARNINGS_COUNT exceeded $WARNINGS_COUNT_LIMIT so failing build.\n"
  echo -e "Please go to: https://github.com/grafana/grafana/blob/master/contribute/style-guides/code-comments.md for more information on how to add code comments."
  report_reference_docs_metrics "$CIRCLE_BRANCH" "$WARNINGS_COUNT"
  exit 1
fi

if [ "$WARNINGS_COUNT" -lt $WARNINGS_COUNT_LIMIT ]; then
  pretty_print_result_of_report "Wohoo! Fewer warnings compared to last build 🎉🎈🍾✨\n\nYou can lower the threshold from $WARNINGS_COUNT_LIMIT to $WARNINGS_COUNT in the:\nscripts/ci-reference-docs-metrics.sh"
  report_reference_docs_metrics "$CIRCLE_BRANCH" "$WARNINGS_COUNT"
  exit 0
fi

pretty_print_result_of_report "API Extractor total warnings: $WARNINGS_COUNT"
report_reference_docs_metrics "$CIRCLE_BRANCH" "$WARNINGS_COUNT"