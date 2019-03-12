#!/bin/bash

echo "Collecting code stats (typescript errors & more)"

ERROR_COUNT="$(./node_modules/.bin/tsc --project tsconfig.json --noEmit --noImplicitAny true | grep -oP 'Found \K(\d+)')"
DIRECTIVES="$(grep -r -o  directive public/app/**/*  | wc -l)"
CONTROLLERS="$(grep -r -oP 'class .*Ctrl' public/app/**/*  | wc -l)"

echo "Typescript errors: $ERROR_COUNT"
echo "Directives: $DIRECTIVES"
echo "Controllers: $CONTROLLERS"

curl \
   -d "{\"metrics\": {
        \"ci.code.noImplicitAny\": $ERROR_COUNT,
        \"ci.code.directives\": $DIRECTIVES,
        \"ci.code.controllers\": $CONTROLLERS
      }
    }" \
   -H "Content-Type: application/json" \
   -u ci:$CIRCLE_STATS_PWD \
   -X POST https://stats.grafana.org/metric-receiver

