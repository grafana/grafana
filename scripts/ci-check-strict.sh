#!/bin/bash
set -e

echo -e "Collecting code stats (typescript errors & more)"

ERROR_COUNT_LIMIT=592
ERROR_COUNT="$(./node_modules/.bin/tsc --project tsconfig.json --noEmit --strict true | grep -oP 'Found \K(\d+)')"

if [ "$ERROR_COUNT" -gt $ERROR_COUNT_LIMIT ]; then
  echo -e "Typescript strict errors $ERROR_COUNT exceeded $ERROR_COUNT_LIMIT so failing build"
	exit 1
fi

