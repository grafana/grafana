#!/bin/bash

set -e

if [ -z "$GPG_KEY_PASSWORD" ]; then
    echo "GPG_KEY_PASSWORD has to be set"
    exit 1
fi

gpg --allow-secret-key-import --import /private.key

cp ./scripts/build/rpmmacros ~/.rpmmacros

for package in dist/*.rpm; do
    [ -e "$package" ] || continue
    ./scripts/build/sign_expect "$GPG_KEY_PASSWORD" "$package"
done
