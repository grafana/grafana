#!/bin/bash

. scripts/grafana-server/variables

LICENSE_PATH=""

if [ "$1" = "enterprise" ]; then
    if [ "$2" != "dev" ] && [ "$2" != "debug" ]; then
      LICENSE_PATH=$2/license.jwt
    else
      LICENSE_PATH=$3/license.jwt
    fi
fi

if [ "$BASE_URL" != "" ]; then
    echo -e "BASE_URL set, skipping starting server"
else
  # Start it in the background
  ./scripts/grafana-server/start-server $LICENSE_PATH 2>&1 > scripts/grafana-server/server.log &
  ./scripts/grafana-server/wait-for-grafana
fi

./e2e/run-suite "$@"
