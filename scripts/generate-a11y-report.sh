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
  ./e2e/start-server > e2e/server.log &
  ./e2e/wait-for-grafana
fi

# Run accessibility command
yarn run -s test:accessibility --json > pa11y-ci-results.json

# Generate HTML report
pa11y-ci-reporter-html

# Start local server
yarn http-server pa11y-ci-report -p 1234
