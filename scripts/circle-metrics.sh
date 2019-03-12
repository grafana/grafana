#!/bin/bash

ERROR_COUNT="$(./node_modules/.bin/tsc --project tsconfig.json --noEmit --noImplicitAny true | grep -oP 'Found \K(\d+)')"
DIRECTIVES="$(grep -r -o  directive public/app/**/*  | wc -l)"
CONTROLLERS="${grep -r -oP \"class .*Ctrl\" public/app/**/*  | wc -l}"

echo "Typescript errors: $ERROR_COUNT"
echo "Directives: $DIRECTIVES"
echo "Controllers: $CONTROLLERS"

curl \
  -d "{\"metrics\":{\"noImplicitAny\": $ERROR_COUNT}}" \
  -H "Content-Type: application/json" \
  -u ci:$CIRCLE_STATS \
  -X POST https://stats.grafana.org/metric-receiver

