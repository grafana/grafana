#!/bin/bash

# abort if we get any error
set -eo pipefail

pretty_print_result_of_report() {
  # $1 = result of current report

  echo -e "\n\n"
  echo -e "-----------------------------------------------------\n"
  echo -e "$1\n"
  echo "-----------------------------------------------------"
}

BUILD_MODE="${1-local}"
REPORT_PATH="$(realpath "$(dirname "$0")/../reports/docs/")"
BUILD_SCRIPT_PATH="$(realpath "$(dirname "$0")/ci-reference-docs-build.sh")"

if [ ! -d "$REPORT_PATH" ]; then
  # this script needs to be run after the packages have been built and the api-extractor has completed.
  # shellcheck source=/scripts/ci-reference-docs-build.sh
  if ! . "$BUILD_SCRIPT_PATH" "$BUILD_MODE";
    then
      echo "Failed to build packages and extract docs" >&2
      exit 1
    else
      echo "Successfully built packages and extracted docs"
  fi
fi

WARNINGS_COUNT="$(find "$REPORT_PATH" -type f -name \*.log -print0 | xargs -0 grep -o "Warning: " | wc -l | xargs)"
WARNINGS_COUNT_LIMIT=1077

if [ "$WARNINGS_COUNT" -gt $WARNINGS_COUNT_LIMIT ]; then
  echo -e "API Extractor warnings/errors $WARNINGS_COUNT exceeded $WARNINGS_COUNT_LIMIT so failing build.\n"
  echo "Please go to: https://github.com/grafana/grafana/blob/master/contribute/style-guides/code-comments.md for more information on how to add code comments."
  exit 1
fi

if [ "$WARNINGS_COUNT" -lt $WARNINGS_COUNT_LIMIT ]; then
  pretty_print_result_of_report "Wohoo! Fewer warnings compared to last build 🎉🎈🍾✨\n\nYou can lower the threshold from $WARNINGS_COUNT_LIMIT to $WARNINGS_COUNT in the:\nscripts/ci-reference-docs-metrics.sh"
fi

pretty_print_result_of_report "API Extractor total warnings: $WARNINGS_COUNT"
