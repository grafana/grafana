#!/bin/bash

# abort if we get any error
set -eo pipefail

# building grafana packages
echo "building grafana packages..."
yarn packages:build

# extract packages api documentation json
echo "extracting packages documentation data..."
yarn packages:docsExtract

# generating api documentation markdown
echo "generating markdown from documentation data..."
yarn packages:docsToMarkdown

# cleaning packages
echo "cleaning up packages build files..."
lerna run clean
