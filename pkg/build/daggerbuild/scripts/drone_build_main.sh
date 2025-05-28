#!/usr/bin/env sh

local_dst="dist/${DRONE_BUILD_EVENT}"
set -e

docker run --privileged --rm tonistiigi/binfmt:qemu-v7.0.0-28 --uninstall 'qemu-*'
# This command enables qemu emulators for building Docker images for arm64/armv6/armv7/etc on the host.
docker run --privileged --rm tonistiigi/binfmt:qemu-v7.0.0-28 --install all

dagger run --silent go run ./pkg/build/cmd \
 artifacts \
  -a targz:grafana:linux/amd64 \
  -a targz:grafana:linux/arm64 \
  -a targz:grafana:linux/arm/v6 \
  -a targz:grafana:linux/arm/v7 \
  -a targz:grafana:windows/amd64 \
  -a targz:grafana:darwin/amd64 \
  -a deb:grafana:linux/amd64 \
  -a deb:grafana:linux/arm64 \
  -a deb:grafana:linux/arm/v6 \
  -a deb:grafana:linux/arm/v7 \
  -a docker:grafana:linux/amd64 \
  -a docker:grafana:linux/arm64 \
  -a docker:grafana:linux/arm/v7 \
  --yarn-cache=${YARN_CACHE_FOLDER} \
  --checksum \
  --build-id=${DRONE_BUILD_NUMBER} \
  --grafana-dir=${GRAFANA_DIR} \
  --github-token=${GITHUB_TOKEN} \
  --ubuntu-base=${UBUNTU_BASE} \
  --alpine-base=${ALPINE_BASE} \
  --destination=${local_dst} > assets.txt

echo "Final list of artifacts:"
cat assets.txt

# Move the tar.gz packages to their expected locations
cat assets.txt | IS_MAIN=true go run ./pkg/build/daggerbuild/scripts/move_packages.go ./dist/main
