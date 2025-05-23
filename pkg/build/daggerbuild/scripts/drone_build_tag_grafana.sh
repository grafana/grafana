#!/usr/bin/env bash
dst="${DESTINATION}/${DRONE_BUILD_EVENT}"
local_dst="file://dist/${DRONE_BUILD_EVENT}"
set -e

docker run --privileged --rm tonistiigi/binfmt:qemu-v7.0.0-28 --uninstall 'qemu-*'
# This command enables qemu emulators for building Docker images for arm64/armv6/armv7/etc on the host.
docker run --privileged --rm tonistiigi/binfmt:qemu-v7.0.0-28 --install all

dagger run --silent go run ./pkg/build/cmd \
 artifacts \
  -a npm:grafana \
  -a storybook \
  -a targz:grafana:linux/amd64 \
  -a targz:grafana:linux/arm64 \
  -a targz:grafana:linux/arm/v6 \
  -a targz:grafana:linux/arm/v7 \
  -a deb:grafana:linux/amd64 \
  -a deb:grafana:linux/arm64 \
  -a deb:grafana:linux/arm/v6 \
  -a deb:grafana:linux/arm/v7 \
  -a rpm:grafana:linux/amd64:sign \
  -a rpm:grafana:linux/arm64:sign \
  -a docker:grafana:linux/amd64 \
  -a docker:grafana:linux/arm64 \
  -a docker:grafana:linux/arm/v7 \
  -a docker:grafana:linux/amd64:ubuntu \
  -a docker:grafana:linux/arm64:ubuntu \
  -a docker:grafana:linux/arm/v7:ubuntu \
  -a targz:grafana:windows/amd64 \
  -a targz:grafana:windows/arm64 \
  -a targz:grafana:darwin/amd64 \
  -a targz:grafana:darwin/arm64 \
  -a zip:grafana:windows/amd64 \
  -a msi:grafana:windows/amd64 \
  --yarn-cache=${YARN_CACHE_FOLDER} \
  --checksum \
  --verify \
  --build-id=${DRONE_BUILD_NUMBER} \
  --grafana-dir=${GRAFANA_DIR} \
  --github-token=${GITHUB_TOKEN} \
  --ubuntu-base="${UBUNTU_BASE}" \
  --alpine-base="${ALPINE_BASE}" \
  --version=${DRONE_TAG} \
  --destination=${local_dst} > assets.txt

cat assets.txt | go run ./pkg/build/daggerbuild/scripts/move_packages.go ./dist/prerelease
