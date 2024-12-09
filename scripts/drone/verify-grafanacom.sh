#!/bin/bash

version=${1:-$TAG}

# Construct the URL based on the provided version and edition
if [ "$EDITION" = "enterprise" ]; then
    url="https://grafana.com/api/downloads/grafana-enterprise/versions/$version"
else
    url="https://grafana.com/api/downloads/grafana/versions/$version"
fi

# Make a request to the GCOM API to retrieve the artifacts for the specified version. Exit if the request fails.
if ! artifacts=$(curl "$url"); then
  echo "Failed to retrieve artifact URLs from Grafana.com API. Please check the API key, authentication, edition, and version."
  exit 1
fi

# Use Node.js to parse the JSON response and extract the download URLs
url_string=$(node -e "
  const artifacts = JSON.parse(JSON.stringify($artifacts));
  const downloadUrls = artifacts.packages.map((package) => package.links.find((link) => link.rel === 'download').href);
  console.log(downloadUrls.join(' '));
")

# Convert the url_string to a Bash array
read -r -a urls <<< "$url_string"

# If empty, no artifact URLs were found for the specified version. Exit with an error.
if [ ${#urls[@]} -eq 0 ]; then
  echo "No artifact URLs found for version $version. Please check the provided version."
  exit 1
fi

# Iterate over the URLs and check the status code of each. If any URL does not return a 200 status code, add it to the failed_urls string.
failed_urls=""
for url in "${urls[@]}"; do
  status_code=$(curl -L -s -o /dev/null -w "%{http_code}" "$url")
  if [ "$status_code" -ne 200 ]; then
    failed_urls+="$url\n"
  fi
done

# If any URLs failed, print them and exit with an error.
if [ -n "$failed_urls" ]; then
  echo "The following URLs did not return a 200 status code:"
  echo "$failed_urls"
  exit 1
else
  echo "All URLs returned a 200 status code. Download links are valid for version $version."
  exit 0
fi
