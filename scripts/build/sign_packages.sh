#!/bin/bash

git clone git@github.com:torkelo/private.git ~/private-repo

gpg --allow-secret-key-import --import ~/private-repo/signing/private.key

cp rpmmacros ~/.rpmmacros

./sign_expect $GPG_KEY_PASSWORD dist/*.rpm
