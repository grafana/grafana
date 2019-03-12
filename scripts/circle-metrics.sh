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

curl https://6371:$GRAFANA_MISC_STATS_API_KEY@graphite-us-central1.grafana.net/metrics \
  -H 'Content-type: application/json' \
  -d '[
      {"name":"grafana.ci-code.noImplicitAny", "interval":60, "value": '$ERROR_COUNT', "mtype": "gauge", "time": '$(date +%s)'},
      {"name":"grafana.ci-code.directives", "interval":60, "value": '$DIRECTIVES', "mtype": "gauge", "time": '$(date +%s)'},
      {"name":"grafana.ci-code.controllers", "interval":60, "value": '$CONTROLLERS', "mtype": "gauge", "time": '$(date +%s)'}
   ]'
