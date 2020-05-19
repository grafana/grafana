#!/bin/bash

# abort if we get any error
set -e

REPORT_PATH="$(realpath $(dirname $0)/../reports/docs/)"
WARNINGS_COUNT="$(find $REPORT_PATH -type f -name \*.log | xargs grep -o "\[33mWarning:" | wc -l | xargs)"
WARNINGS_COUNT_LIMIT=868

if [ "$WARNINGS_COUNT" -gt $WARNINGS_COUNT_LIMIT ]; then
  echo -e "API Extractor warnings/errors $WARNINGS_COUNT exceeded $WARNINGS_COUNT_LIMIT so failing build"
  exit 1
fi

if [ "$WARNINGS_COUNT" -lt $WARNINGS_COUNT_LIMIT ]; then
  echo -e "Wohoo! Less number of warnings compared to last build. Will lower the threshold by $(expr $WARNINGS_COUNT_LIMIT - $WARNINGS_COUNT).\n"
  echo -e "Previous limit: $WARNINGS_COUNT_LIMIT"
  echo -e "New limit: $WARNINGS_COUNT"
  
  # using sed to update the WARNINGS_COUNT_LIMIT in this script
  sed -i -e "s/WARNINGS_COUNT_LIMIT=$WARNINGS_COUNT_LIMIT/WARNINGS_COUNT_LIMIT=$WARNINGS_COUNT/g" $(realpath $0)
  rm $(realpath $0)-e
fi

echo -e "API Extractor total warnings: $WARNINGS_COUNT"
exit 0
