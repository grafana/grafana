#!/bin/bash

# abort if we get any error
set -e

# this script needs to be run after the packages have been build and the api-extractor have completed.
REPORT_PATH="$(realpath $(dirname $0)/../reports/docs/)"
WARNINGS_COUNT="$(find $REPORT_PATH -type f -name \*.log | xargs grep -o "\[33mWarning:" | wc -l | xargs)"
WARNINGS_COUNT_LIMIT=900

if [ "$WARNINGS_COUNT" -gt $WARNINGS_COUNT_LIMIT ]; then
  echo -e "API Extractor warnings/errors $WARNINGS_COUNT exceeded $WARNINGS_COUNT_LIMIT so failing build.\n"
  echo -e "Please go to: https://github.com/grafana/grafana/blob/master/contribute/style-guides/code-comments.md for more information on how to add code comments."
  exit 1
fi

if [ "$WARNINGS_COUNT" -lt $WARNINGS_COUNT_LIMIT ]; then
  echo -e "Wohoo! Less number of warnings compared to last build 🎉🎈🍾✨\n\nYou can lower the threshold from $WARNINGS_COUNT_LIMIT to $WARNINGS_COUNT in the:\nscripts/ci-reference-docs-metrics.sh"
  exit 0
fi

echo -e "API Extractor total warnings: $WARNINGS_COUNT"

