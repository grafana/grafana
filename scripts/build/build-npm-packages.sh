#!/usr/bin/env bash

# lerna bootstrap might have created yarn.lock
git checkout .

echo 'Building packages'
yarn packages:build