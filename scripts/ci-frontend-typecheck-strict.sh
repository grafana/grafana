#!/bin/bash

echo -e "Typechecking with strict null checks enabled"

ERROR_COUNT_LIMIT=699

ERROR_COUNT="$(./node_modules/.bin/tsc --project tsconfig.json --noEmit --strictNullChecks true | grep -oP 'Found \K(\d+)')"

if [ "$ERROR_COUNT" -gt $ERROR_COUNT_LIMIT ]; then
  echo -e "Typescript strict errors $ERROR_COUNT exceeded $ERROR_COUNT_LIMIT so failing build"
	exit 1
fi
