#!/bin/bash

echo "Publishing CI Metrics"

data=""

for ((i = 1; i <= $#; i++ )); do
  remainder="${!i}"
  first="${remainder%%=*}"; remainder="${remainder#*=}"
  if [ -n "$data" ]; then
    data="$data,"
  fi
  data=''$data'{"name": "'${first}'", "value": '${remainder}', "interval": 60, "mtype": "gauge", "time": '$(date +%s)'}'
done

curl "https://6371:$GRAFANA_MISC_STATS_API_KEY@graphite-us-central1.grafana.net/metrics" \
  -H 'Content-type: application/json' \
  -d "[$data]"
