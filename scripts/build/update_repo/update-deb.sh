#!/usr/bin/env bash

RELEASE_TYPE="${1:-}"
GPG_PASS="${2:-}"

if [ -z "$RELEASE_TYPE" -o -z "$GPG_PASS" ]; then
    echo "Both RELEASE_TYPE (arg 1) and GPG_PASS (arg 2) has to be set"
    exit 1
fi

set -e

# Setup environment
cp scripts/build/update_repo/aptly.conf /etc/aptly.conf
mkdir -p /deb-repo/db
mkdir -p /deb-repo/repo

# Download the database
gsutil -m rsync -r gs://grafana-aptly-db/repo-db /deb-repo/db

# Add the new release to the repo
set +e
aptly publish drop squeeze filesystem:repo:grafana
set -e
aptly repo add grafana ./dist

# Setup signing and sign the repo

echo "allow-loopback-pinentry" > ~/.gnupg/gpg-agent.conf
echo "pinentry-mode loopback" > ~/.gnupg/gpg.conf

./scripts/build/update_repo/sign-deb-repo.sh "$GPG_PASS"

# Update the repo and db on gcp
gsutil -m rsync -r -d /deb-repo/db gs://grafana-aptly-db/repo-db
gsutil -m rsync -r -d /deb-repo/repo/grafana "gs://grafana-repo/$RELEASE_TYPE/deb"

# usage:
# deb https://grafana-repo.storage.googleapis.com/oss/deb squeeze main
#
# later:
# deb https://repo.grafana.com/oss/deb squeeze main
