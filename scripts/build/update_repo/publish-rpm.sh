#!/usr/bin/env bash

RELEASE_TYPE="${1:-}"
RELEASE_TAG="${2:-}"
GCP_REPO_BUCKET="${3:-grafana-repo}"

REPO="rpm"

if [ -z "$RELEASE_TYPE" ]; then
    echo "RELEASE_TYPE (arg 1) has to be set"
    exit 1
fi

if [[ "$RELEASE_TYPE" != "oss" && "$RELEASE_TYPE" != "enterprise" ]]; then
    echo "RELEASE_TYPE (arg 1) must be either oss or enterprise."
    exit 1
fi

if echo "$RELEASE_TAG" | grep -q "beta"; then
    REPO="rpm-beta"
fi

set -e

# Setup environment
BUCKET="gs://$GCP_REPO_BUCKET/$RELEASE_TYPE/$REPO"

# Update the repo and db on gcp
gsutil -m cp /rpm-repo/*.rpm "$BUCKET" # sync binaries first to avoid cache misses
gsutil -m rsync -r -d /rpm-repo "$BUCKET"

# usage:
# [grafana]
# name=grafana
# baseurl=https://packages.grafana.com/oss/rpm
# repo_gpgcheck=1
# enabled=1
# gpgcheck=1
# gpgkey=https://packages.grafana.com/gpg.key
# sslverify=1
# sslcacert=/etc/pki/tls/certs/ca-bundle.crt
