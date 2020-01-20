#!/usr/bin/env bash

set -e

gpg --batch --allow-secret-key-import --import ~/private-repo/signing/private.key
pkill gpg-agent
