#!/bin/bash

version=${1:-$TAG}
# echo $version

# Make a request to the GCOM API to retrieve the artifacts for the specified version
# JEV: GCOM requires gcloud authentication. this works in my shell, but that's only because I'm already authenticated...
artifacts=$(gcom /downloads/grafana/versions/$version)

# echo $artifacts

# Use Node.js to parse the JSON response and extract the download URLs
urls=$(node -e "
  const artifacts = JSON.parse(JSON.stringify($artifacts));
  const downloadUrls = artifacts.packages.map((package) => package.links.find((link) => link.rel === 'download').href);
  console.log(downloadUrls.join('\n'));
")

# echo $urls

failed_urls=$(echo "$urls" | xargs -I{} -P0 sh -c \
             'status_code=$(curl -L -s -o /dev/null -w "%{http_code}" "$1"); \
             if [ "$status_code" -ne 200 ]; then echo "$1"; fi' \
             -- {})

if [ -n "$failed_urls" ]; then
  echo "The following URLs did not return a 200 status code:"
  echo "$failed_urls"
  exit 1
else
  echo "All URLs returned a 200 status code. Download links are valid for version $version."
  exit 0
fi
