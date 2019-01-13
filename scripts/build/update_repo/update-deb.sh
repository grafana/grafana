#!/usr/bin/env bash

RELEASE_TYPE="${1:-}"
GPG_PASS="${2:-}"
RELEASE_TAG="${3:-}"
REPO="grafana"

if [ -z "$RELEASE_TYPE" -o -z "$GPG_PASS" ]; then
    echo "Both RELEASE_TYPE (arg 1) and GPG_PASS (arg 2) has to be set"
    exit 1
fi

if [[ "$RELEASE_TYPE" != "oss" && "$RELEASE_TYPE" != "enterprise" ]]; then
    echo "RELEASE_TYPE (arg 1) must be either oss or enterprise."
    exit 1
fi

if echo "$RELEASE_TAG" | grep -q "beta"; then
    REPO="beta"
fi

set -e

# Setup environment
cp scripts/build/update_repo/aptly.conf /etc/aptly.conf
mkdir -p /deb-repo/db   \
         /deb-repo/repo \
         /deb-repo/tmp

# Download the database
gsutil -m rsync -r "gs://grafana-aptly-db/$RELEASE_TYPE" /deb-repo/db

# Add the new release to the repo
aptly publish drop grafana filesystem:repo:grafana || true
aptly publish drop beta filesystem:repo:grafana || true
cp ./dist/*.deb /deb-repo/tmp
rm /deb-repo/tmp/grafana_latest*.deb || true
aptly repo add "$REPO" ./dist

# Setup signing and sign the repo

echo "allow-loopback-pinentry" > ~/.gnupg/gpg-agent.conf
echo "pinentry-mode loopback" > ~/.gnupg/gpg.conf

touch /tmp/sign-this
./scripts/build/update_repo/unlock-gpg-key.sh "$GPG_PASS"
rm /tmp/sign-this /tmp/sign-this.asc

aptly publish repo grafana filesystem:repo:grafana
aptly publish repo beta filesystem:repo:grafana

# Update the repo and db on gcp
gsutil -m rsync -r -d /deb-repo/db "gs://grafana-aptly-db/$RELEASE_TYPE"
gsutil -m rsync -r -d /deb-repo/repo/grafana "gs://grafana-repo/$RELEASE_TYPE/deb"

# usage:
# 
# deb https://packages.grafana.com/oss/deb stable main
