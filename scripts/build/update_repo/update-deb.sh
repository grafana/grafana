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
mkdir -p /deb-repo/tmp

# Download the database
gsutil -m rsync -r "gs://grafana-aptly-db/$RELEASE_TYPE" /deb-repo/db

# Add the new release to the repo
aptly publish drop squeeze filesystem:repo:grafana || true
cp ./dist/*.deb /deb-repo/tmp
rm /deb-repo/tmp/grafana_latest*.deb || true
aptly repo add grafana ./dist

# Setup signing and sign the repo

echo "allow-loopback-pinentry" > ~/.gnupg/gpg-agent.conf
echo "pinentry-mode loopback" > ~/.gnupg/gpg.conf

./scripts/build/update_repo/sign-deb-repo.sh "$GPG_PASS"

# Update the repo and db on gcp
gsutil -m rsync -r -d /deb-repo/db "gs://grafana-aptly-db/$RELEASE_TYPE"
gsutil -m rsync -r -d /deb-repo/repo/grafana "gs://grafana-repo/$RELEASE_TYPE/deb"

# usage:
# curl https://packages.grafana.com/gpg.key | apt-key add -
# deb https://packages.grafana.com/oss/deb stable main
