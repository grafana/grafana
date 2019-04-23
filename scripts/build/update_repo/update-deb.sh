#!/usr/bin/env bash

RELEASE_TYPE="${1:-}"
GPG_PASS="${2:-}"
RELEASE_TAG="${3:-}"
DIST_PATH="${4:-}"
GCP_DB_BUCKET="${5:-grafana-aptly-db}"
GCP_REPO_BUCKET="${6:-grafana-repo}"

REPO="grafana"

if [ -z "$RELEASE_TYPE" -o -z "$GPG_PASS" -o -z "$DIST_PATH" ]; then
    echo "Both RELEASE_TYPE (arg 1), GPG_PASS (arg 2) and DIST_PATH (arg 4) has to be set"
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
cp scripts/build/update_repo/aptly.conf ~/.aptly.conf

mkdir -p /deb-repo/db   \
         /deb-repo/repo \
         /deb-repo/tmp

# Download the database
gsutil -m rsync -r -d "gs://$GCP_DB_BUCKET/$RELEASE_TYPE" /deb-repo/db

# Add the new release to the repo
cp $DIST_PATH/*.deb /deb-repo/tmp
rm /deb-repo/tmp/grafana_latest*.deb || true
aptly repo add "$REPO" /deb-repo/tmp #adds too many packages in enterprise

# Setup signing and sign the repo

echo "allow-loopback-pinentry" > ~/.gnupg/gpg-agent.conf
echo "pinentry-mode loopback" > ~/.gnupg/gpg.conf

pkill gpg-agent || true
touch /tmp/sign-this
rm /tmp/sign-this.asc || true
./scripts/build/update_repo/unlock-gpg-key.sh "$GPG_PASS"
rm /tmp/sign-this /tmp/sign-this.asc

aptly publish update stable filesystem:repo:grafana
aptly publish update beta filesystem:repo:grafana

# Update the repo and db on gcp

gsutil -m rsync -r -d /deb-repo/db "gs://$GCP_DB_BUCKET/$RELEASE_TYPE"

# Uploads the binaries before the metadata (to prevent 404's for debs)
gsutil -m rsync -r /deb-repo/repo/grafana/pool "gs://$GCP_REPO_BUCKET/$RELEASE_TYPE/deb/pool"

gsutil -m rsync -r -d /deb-repo/repo/grafana "gs://$GCP_REPO_BUCKET/$RELEASE_TYPE/deb"

# usage:
# 
# deb https://packages.grafana.com/oss/deb stable main
