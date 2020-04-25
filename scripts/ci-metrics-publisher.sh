#!/bin/bash

echo "Publishing CI Metrics"

data=""

for ((i = 1; i <= $#; i++ )); do
  remainder="${!i}"
  # Find everything until last = character (= is included in the result)
  # This allows to add tags to metric names
  metricName=$(grep -o "\(.*\)=" <<< "$remainder")
  # Get the metric value
  value=${remainder#"$metricName"}
  # Remove remaining = character from metric name
  metricName=${metricName%?};


  if [ -n "$data" ]; then
    data="$data,"
  fi
  data=''$data'{"name": "'${metricName}'", "value": '${value}', "interval": 60, "mtype": "gauge", "time": '$(date +%s)'}'
done

echo "Publishing metrics:"
echo "$data"
curl "https://6371:$GRAFANA_MISC_STATS_API_KEY@graphite-us-central1.grafana.net/metrics" \
  -H 'Content-type: application/json' \
  -d "[$data]"
