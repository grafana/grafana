#!/usr/bin/env bash

RELEASE_TYPE="${1:-}"
GCP_DB_BUCKET="${2:-grafana-aptly-db}"
GCP_REPO_BUCKET="${3:-grafana-repo}"

if [ -z "$RELEASE_TYPE" ]; then
    echo "RELEASE_TYPE (arg 1) has to be set"
    exit 1
fi

if [[ "$RELEASE_TYPE" != "oss" && "$RELEASE_TYPE" != "enterprise" ]]; then
    echo "RELEASE_TYPE (arg 1) must be either oss or enterprise."
    exit 1
fi

set -e

# Update the repo and db on gcp

gsutil -m rsync -r -d /deb-repo/db "gs://$GCP_DB_BUCKET/$RELEASE_TYPE"

# Uploads the binaries before the metadata (to prevent 404's for debs)
gsutil -m rsync -r /deb-repo/repo/grafana/pool "gs://$GCP_REPO_BUCKET/$RELEASE_TYPE/deb/pool"

gsutil -m rsync -r -d /deb-repo/repo/grafana "gs://$GCP_REPO_BUCKET/$RELEASE_TYPE/deb"

# usage:
#
# deb https://packages.grafana.com/oss/deb stable main
