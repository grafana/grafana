#!/usr/bin/env bash

set -e

gpg --batch --allow-secret-key-import --import /private.key
pkill gpg-agent