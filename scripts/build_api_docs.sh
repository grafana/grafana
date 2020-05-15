#!/usr/bin/env bash

# abort if we get any error
set -e

# always make sure we have a clean workspace
if ! git diff-index --quiet HEAD --; then
    echo -e "\033[91mgit workspace is dirty and contains changes\033[0"
    echo -e "\033[91mmake sure you have a clean workspace before running this script\033[0m"
    exit 1
fi

# building grafana packages
echo "bulding grafana packages..."
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
