#!/bin/bash

version="${TAG}" # JEV: is this accessable here?

# Make a request to the GCOM API to retrieve the artifacts for the specified version
artifacts=$(gcom /downloads/grafana/versions/$version)

# Use Node.js to parse the JSON response and extract the download URLs
urls=$(node -e "
  const artifacts = JSON.parse('$artifacts');
  const downloadUrls = artifacts.flatMap(artifact =>
    artifact.packages.links.filter(link => link.rel === 'download').map(link => link.href)
  );
  console.log(downloadUrls.join('\n'));
")

# Check the status of each download URL
for url in $urls; do
  status_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  if [ "$status_code" -ne 200 ]; then
    echo "Failed to verify download URL: $url (Status Code: $status_code)"
    exit 1
  fi
done

echo "All download URLs are accessible"