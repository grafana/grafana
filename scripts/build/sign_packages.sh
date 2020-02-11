#!/bin/bash

set -e

_files=$*

if [ -z "$_files" ]; then
    echo "_files (arg 1) has to be set"
    exit 1
fi

if [ -z "$GPG_KEY_PASSWORD" ]; then
    echo "GPG_KEY_PASSWORD has to be set"
    exit 1
fi

gpg --batch --allow-secret-key-import --import ~/private-repo/signing/private.key

cp ./scripts/build/rpmmacros ~/.rpmmacros
echo "$GPG_KEY_PASSWORD" > /tmp/gpg-passphrase

for package in $_files; do
    [ -e "$package" ] || continue
    rpm --addsign "$package"
done
