#!/usr/bin/env sh
set -e
local_dst="${DRONE_WORKSPACE}/dist"

docker run --privileged --rm tonistiigi/binfmt:qemu-v7.0.0-28 --uninstall 'qemu-*'
# This command enables qemu emulators for building Docker images for arm64/armv6/armv7/etc on the host.
docker run --privileged --rm tonistiigi/binfmt:qemu-v7.0.0-28 --install all

dagger run --silent go run ./pkg/build/cmd \
  artifacts \
  -a targz:grafana:linux/amd64 \
  -a targz:grafana:linux/arm64 \
  -a targz:grafana:linux/arm/v7 \
  -a targz:grafana:linux/arm/v6 \
  -a deb:grafana:linux/amd64:nightly \
  -a deb:grafana:linux/arm64:nightly \
  -a deb:grafana:linux/arm/v6:nightly \
  -a deb:grafana:linux/arm/v7:nightly \
  -a rpm:grafana:linux/amd64:sign:nightly \
  -a rpm:grafana:linux/arm64:sign:nightly \
  -a targz:grafana:windows/amd64 \
  -a targz:grafana:windows/arm64 \
  -a targz:grafana:darwin/amd64 \
  -a targz:grafana:darwin/arm64 \
  -a zip:grafana:windows/amd64 \
  -a msi:grafana:windows/amd64 \
  -a docker:grafana:linux/amd64 \
  -a docker:grafana:linux/arm64 \
  -a docker:grafana:linux/arm/v7 \
  -a docker:grafana:linux/amd64:ubuntu \
  -a docker:grafana:linux/arm64:ubuntu \
  -a docker:grafana:linux/arm/v7:ubuntu \
  --checksum \
  --verify \
  --build-id=${DRONE_BUILD_NUMBER} \
  --grafana-dir=${GRAFANA_DIR} \
  --github-token=${GITHUB_TOKEN} \
  --destination=${local_dst} \
  --yarn-cache=${YARN_CACHE_FOLDER} \
  --ubuntu-base="${UBUNTU_BASE}" \
  --alpine-base="${ALPINE_BASE}" > assets.txt

cat assets.txt
