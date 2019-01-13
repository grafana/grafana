#!/usr/bin/env bash

RELEASE_TYPE="${1:-}"
GPG_PASS="${2:-}"

RELEASE_TAG="${3:-}"
REPO="rpm"

if [ -z "$RELEASE_TYPE" -o -z "$GPG_PASS" ]; then
    echo "Both RELEASE_TYPE (arg 1) and GPG_PASS (arg 2) has to be set"
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
BUCKET="gs://grafana-repo/$RELEASE_TYPE/$REPO"
mkdir -p /rpm-repo

# Download the database
gsutil -m rsync -r "$BUCKET" /rpm-repo

# Add the new release to the repo
cp ./dist/*.rpm /rpm-repo
rm /rpm-repo/grafana-latest-1*.rpm || true
cd /rpm-repo
createrepo .

# Setup signing and sign the repo

echo "allow-loopback-pinentry" > ~/.gnupg/gpg-agent.conf
echo "pinentry-mode loopback" > ~/.gnupg/gpg.conf

rm /rpm-repo/repodata/repomd.xml.asc || true
pkill gpg-agent || true
./scripts/build/update_repo/sign-rpm-repo.sh "$GPG_PASS"

# Update the repo and db on gcp
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