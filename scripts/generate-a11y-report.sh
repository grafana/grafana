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

# Run accessibility command
yarn wait-on http://localhost:3000

yarn run -s test:accessibility --json > pa11y-ci-results.json

# Generate HTML report
pa11y-ci-reporter-html

# Start local server
yarn http-server pa11y-ci-report -p 1234
