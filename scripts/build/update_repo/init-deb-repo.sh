#!/usr/bin/env bash

# Run this if you need to recreate the debian repository for some reason

# Setup environment
cp scripts/build/update_repo/aptly.conf /etc/aptly.conf
mkdir -p /deb-repo/db   \
         /deb-repo/repo \
         /deb-repo/tmp

aptly repo create -distribution=stable -component=main grafana
aptly repo create -distribution=beta -component=main beta

aptly publish repo -architectures=amd64,i386,arm64,armhf grafana filesystem:repo:grafana
aptly publish repo -architectures=amd64,i386,arm64,armhf beta filesystem:repo:grafana
