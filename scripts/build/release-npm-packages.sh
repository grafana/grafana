#!/usr/bin/env bash

PACKAGES=("@grafana/ui" "@grafana/data" "@grafana/toolkit" "@grafana/runtime" "@grafana/e2e" "@grafana/e2e-selectors" "@grafana/schema")

GRAFANA_TAG=${1:-}
RELEASE_CHANNEL="latest"

if echo "$GRAFANA_TAG" | grep -q "^v"; then
	_grafana_version=$(echo "${GRAFANA_TAG}" | cut -d "v" -f 2)
else
  echo "Provided tag is not a version tag, skipping packages release..."
	exit
fi

if grep -q "beta" <<< "$GRAFANA_TAG"; then
  RELEASE_CHANNEL="next"
fi

echo "$_grafana_version"

# lerna bootstrap might have created yarn.lock
git checkout .

# Get current version from lerna.json
# Since this happens on tagged branch, the lerna.json version and package.json file SHOULD be updated already
# as specified in release guideline
PACKAGE_VERSION=$(grep '"version"' lerna.json | cut -d '"' -f 4)

echo "Releasing grafana packages @ ${PACKAGE_VERSION} under ${RELEASE_CHANNEL} channel"

if [ $RELEASE_CHANNEL == "latest" ]; then
  SCRIPT="publishLatest"
elif [ $RELEASE_CHANNEL == "next" ]; then
  SCRIPT="publishNext"
else
  echo "Unknown channel, skipping packages release"
  exit
fi

# Publish to NPM registry
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" >> ~/.npmrc

echo $'\nPublishing packages to NPM registry'
yarn packages:${SCRIPT}

# When releasing stable(latest) version of packages we are updating previously published next tag(beta) to be the same version as latest
if [ $RELEASE_CHANNEL == "latest" ]; then
  for i in "${PACKAGES[@]}"
  do
    :
    npm dist-tag add "$i"@"$PACKAGE_VERSION" next
  done
fi

# When releasing stable(latest) version of packages we are updating previously published next tag(beta) to be the same version as latest
if [ $RELEASE_CHANNEL == "latest" ]; then
  for i in "${PACKAGES[@]}"
  do
    :
    npm dist-tag add "$i"@"$PACKAGE_VERSION" next
  done
fi

