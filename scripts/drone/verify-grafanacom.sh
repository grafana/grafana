#!/bin/bash

version=${1:-$TAG}

# Make a request to the GCOM API to retrieve the artifacts for the specified version. Exit if the request fails.
if ! artifacts=$(gcom /downloads/grafana/versions/$version); then
  echo "Failed to retrieve artifact URLs from Grafana.com API. Please check the API key, authentication, and version."
  exit 1
fi

# Use Node.js to parse the JSON response and extract the download URLs
urls=$(node -e "
  const artifacts = JSON.parse(JSON.stringify($artifacts));
  const downloadUrls = artifacts.packages.map((package) => package.links.find((link) => link.rel === 'download').href);
  console.log(downloadUrls.join('\n'));
")

# If empty, no artifact URLs were found for the specified version. Exit with an error.
if [ -z "$urls" ]; then
  echo "No artifact URLs found for version $version. Please check the provided version."
  exit 1
fi

failed_urls=$(echo "$urls" | xargs -I{} -P0 sh -c \
             'status_code=$(curl -L -s -o /dev/null -w "%{http_code}" "$1"); \
             if [ "$status_code" -ne 200 ]; then echo "$1"; fi' \
             -- {})

# If any URLs failed, print them and exit with an error.
if [ -n "$failed_urls" ]; then
  echo "The following URLs did not return a 200 status code:"
  echo "$failed_urls"
  exit 1
else
  echo "All URLs returned a 200 status code. Download links are valid for version $version."
  exit 0
fi
