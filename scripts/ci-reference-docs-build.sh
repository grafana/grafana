#!/bin/bash

# abort if we get any error
set -eo pipefail

BUILD_MODE="${1-local}"

if [ "local" == "$BUILD_MODE" ]
  then
    # building grafana packages
    echo "building grafana packages..."
    yarn packages:build
  else
    echo "skip building grafana packages since it already built in previous steps..."
fi

# extract packages api documentation json
echo "extracting packages documentation data..."
yarn packages:docsExtract

# generating api documentation markdown
echo "generating markdown from documentation data..."
yarn packages:docsToMarkdown
