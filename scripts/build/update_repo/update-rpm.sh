#!/usr/bin/env bash

RELEASE_TYPE="${1:-}"
GPG_PASS="${2:-}"

if [ -z "$RELEASE_TYPE" -o -z "$GPG_PASS" ]; then
    echo "Both RELEASE_TYPE (arg 1) and GPG_PASS (arg 2) has to be set"
    exit 1
fi

set -e

# Setup environment
mkdir -p /rpm-repo

# Download the database
gsutil -m rsync -r "gs://grafana-repo/$RELEASE_TYPE/rpm" /rpm-repo

# Add the new release to the repo
cp ./dist/*.rpm /rpm-repo
rm /rpm-repo/grafana-latest-1*.rpm || true
cd /rpm-repo
createrepo .

# Setup signing and sign the repo

echo "allow-loopback-pinentry" > ~/.gnupg/gpg-agent.conf
echo "pinentry-mode loopback" > ~/.gnupg/gpg.conf

./scripts/build/update_repo/sign-rpm-repo.sh "$GPG_PASS"

# Update the repo and db on gcp
gsutil -m rsync -r -d /rpm-repo "gs://grafana-repo/$RELEASE_TYPE/rpm"

# usage:
# [grafana]
# name=grafana
# baseurl=https://grafana-repo.storage.googleapis.com/oss/rpm
# repo_gpgcheck=1
# enabled=1
# gpgcheck=1
# gpgkey=https://grafana-repo.storage.googleapis.com/gpg.key https://grafanarel.s3.amazonaws.com/RPM-GPG-KEY-grafana
# sslverify=1
# sslcacert=/etc/pki/tls/certs/ca-bundle.crt# later:
