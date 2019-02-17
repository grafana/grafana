#!/bin/bash

git clone git@github.com:torkelo/private.git ~/private-repo

gpg --allow-secret-key-import --import ~/private-repo/signing/private.key

cp ./scripts/build/rpmmacros ~/.rpmmacros

for package in dist/*.rpm; do
    [ -e "$package" ] || continue
    ./scripts/build/sign_expect $GPG_KEY_PASSWORD $package
done
