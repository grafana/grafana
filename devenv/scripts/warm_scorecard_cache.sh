#!/bin/sh
# warm_scorecard_cache.sh
#
# Warms the plugin scorecard kvstore cache by sequentially fetching insights
# for every installed plugin. Run this once after starting Grafana and the
# scorecard sidecar to pre-populate scores before demoing.
#
# Uses /api/plugins (installed plugins only) with the locally installed version,
# which matches the version key the frontend uses for installed plugins.
#
# Requires: curl, jq
#
# Usage:
#   ./devenv/scripts/warm_scorecard_cache.sh [grafana_url] [username] [password]
#
# Defaults:
#   grafana_url = http://localhost:3000
#   username    = admin
#   password    = admin

GRAFANA_URL="${1:-http://localhost:3000}"
USERNAME="${2:-admin}"
PASSWORD="${3:-admin}"

echo "Warming plugin scorecard cache from $GRAFANA_URL"
echo ""

plugins=$(curl -s -u "$USERNAME:$PASSWORD" "$GRAFANA_URL/api/plugins" 2>/dev/null)

if [ -z "$plugins" ]; then
  echo "ERROR: Could not reach Grafana at $GRAFANA_URL. Is it running?"
  exit 1
fi

total=$(echo "$plugins" | jq '[.[] | select(.info.version != "" and .info.version != null)] | length')
echo "Found $total installed plugins with versions. Fetching scorecard for each..."
echo ""

count=0

echo "$plugins" | jq -r '.[] | select(.info.version != "" and .info.version != null) | .id + "|" + .info.version' | \
while IFS='|' read -r plugin_id version; do
  count=$((count + 1))
  printf "[%s/%s] %-50s %s ... " "$count" "$total" "$plugin_id" "$version"

  result=$(curl -s --max-time 120 \
    -u "$USERNAME:$PASSWORD" \
    "$GRAFANA_URL/api/gnet/plugins/$plugin_id/versions/$version/insights" \
    2>/dev/null)

  if [ -z "$result" ]; then
    echo "TIMEOUT"
  else
    reason=$(echo "$result" | jq -r '
      if .conditions then .conditions[0].reason
      elif (.insights | length) > 0 then "Ready (\(.insights | length) dimensions)"
      else "NoData"
      end
    ' 2>/dev/null)
    echo "${reason:-ParseError}"
  fi
done

echo ""
echo "Done. Scores will appear on next page load."
