#!/bin/bash
# Delete all Git Sync provisioning test resources (repositories, then connections).
# Targets a local/dev Grafana only. Override with GRAFANA_BASE / GRAFANA_AUTH.
set -euo pipefail

BASE="${GRAFANA_BASE:-http://localhost:3000}/apis/provisioning.grafana.app/v0alpha1/namespaces/default"
AUTH="${GRAFANA_AUTH:-admin:admin}"

# K8s object names are DNS-1123 subdomains; anything else never goes into a URL.
valid_name() { [[ "$1" =~ ^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$ ]]; }

delete_all() {
  local kind="$1" name
  curl -sSf -u "$AUTH" "$BASE/$kind" | jq -r '.items[]?.metadata.name // empty' |
    while IFS= read -r name; do
      if ! valid_name "$name"; then
        echo "Skipping $kind entry with unexpected name: $name" >&2
        continue
      fi
      echo "Deleting $kind entry: $name"
      curl -sSf -X DELETE -u "$AUTH" "$BASE/$kind/$name" > /dev/null
    done
}

# Repositories must be deleted before their connections
delete_all repositories
delete_all connections

echo "Remaining repositories: $(curl -sSf -u "$AUTH" "$BASE/repositories" | jq '.items | length')"
echo "Remaining connections: $(curl -sSf -u "$AUTH" "$BASE/connections" | jq '.items | length')"
echo "Cleanup complete."
