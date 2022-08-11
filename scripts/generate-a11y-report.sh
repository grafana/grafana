#!/usr/bin/env bash

set -x

# Clean up old report
jsonReport="pa11y-ci-results.json"
if [ -f "$jsonReport" ] ; then
    rm "$jsonReport"
fi

# Clean up old folder
report="pa11y-ci-report/"

if [ -d "$report" ] ; then
    rm -R "$report"
fi


# Run e2e grafana instance

if [ "$BASE_URL" != "" ]; then
    echo -e "BASE_URL set, skipping starting server"
else
  # Start it in the background
  ./scripts/grafana-server/start-server > scripts/grafana-server/server.log &
  ./scripts/grafana-server/wait-for-grafana
fi

# Run accessibility command
yarn dlx --quiet pa11y-ci@3.0.1 --config .pa11yci.conf.js --json > pa11y-ci-results.json

# Generate HTML report
yarn dlx pa11y-ci-reporter-html@3.0.1 pa11y-ci-reporter-html

# Start local server
yarn http-server pa11y-ci-report -p 1234
