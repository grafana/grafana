#!/bin/bash

echo -e "Collecting code stats (typescript errors & more)"

ERROR_COUNT="$(./node_modules/.bin/tsc --project tsconfig.json --noEmit --noImplicitAny true | grep -oP 'Found \K(\d+)')"
DIRECTIVES="$(grep -r -o  directive public/app/**/*  | wc -l)"
CONTROLLERS="$(grep -r -oP 'class .*Ctrl' public/app/**/*  | wc -l)"

echo -e "Typescript errors: $ERROR_COUNT"
echo -e "Directives: $DIRECTIVES"
echo -e "Controllers: $CONTROLLERS"

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

echo -e ""

./scripts/ci-metrics-publisher.sh \
  grafana.ci-code.noImplicitAny=$ERROR_COUNT \
  grafana.ci-code.directives=$DIRECTIVES \
  grafana.ci-code.controllers=$CONTROLLERS \



