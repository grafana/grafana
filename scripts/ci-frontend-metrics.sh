#!/bin/bash

echo -e "Collecting code stats (typescript errors & more)"

ERROR_COUNT_LIMIT=6850
DIRECTIVES_LIMIT=173
CONTROLLERS_LIMIT=136

ERROR_COUNT="$(./node_modules/.bin/tsc --project tsconfig.json --noEmit --noImplicitAny true | grep -oP 'Found \K(\d+)')"
DIRECTIVES="$(grep -r -o  directive public/app/**/*  | wc -l)"
CONTROLLERS="$(grep -r -oP 'class .*Ctrl' public/app/**/*  | wc -l)"

if [ $ERROR_COUNT -gt $ERROR_COUNT_LIMIT ]; then
  echo -e "Typescript errors $ERROR_COUNT exceeded $ERROR_COUNT_LIMIT so failing build"
	exit -1
fi

if [ $DIRECTIVES -gt $DIRECTIVES_LIMIT ]; then
  echo -e "Directive count $DIRECTIVES exceeded $DIRECTIVES_LIMIT so failing build"
	exit -1
fi

if [ $CONTROLLERS -gt $CONTROLLERS_LIMIT ]; then
  echo -e "Controllers count $CONTROLLERS exceeded $CONTROLLERS_LIMIT so failing build"
	exit -1
fi

echo -e "Typescript errors: $ERROR_COUNT"
echo -e "Directives: $DIRECTIVES"
echo -e "Controllers: $CONTROLLERS"

if [ "${CIRCLE_BRANCH}" == "master" ]; then
  ./scripts/ci-metrics-publisher.sh \
    grafana.ci-code.noImplicitAny=$ERROR_COUNT \
    grafana.ci-code.directives=$DIRECTIVES \
    grafana.ci-code.controllers=$CONTROLLERS
fi
