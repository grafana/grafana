#!/usr/bin/env bash

set -e

git clone git@github.com:torkelo/private.git ~/private-repo
gpg --batch --allow-secret-key-import --import ~/private-repo/signing/private.key
pkill gpg-agent