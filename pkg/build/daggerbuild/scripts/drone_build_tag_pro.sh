#!/usr/bin/env sh
local_dst="dist/${DRONE_BUILD_EVENT}"
set -e

docker run --privileged --rm tonistiigi/binfmt:qemu-v7.0.0-28 --uninstall 'qemu-*'
# This command enables qemu emulators for building Docker images for arm64/armv6/armv7/etc on the host.
docker run --privileged --rm tonistiigi/binfmt:qemu-v7.0.0-28 --install all

# Build all of the grafana.tar.gz packages.
dagger run --silent go run ./pkg/build/cmd \
  artifacts \
  -a frontend:enterprise \
  -a targz:pro:linux/amd64 \
  -a targz:pro:linux/arm64 \
  -a targz:pro:linux/arm/v6 \
  -a targz:pro:linux/arm/v7 \
  -a deb:pro:linux/amd64 \
  -a deb:pro:linux/arm64 \
  -a targz:pro:darwin/amd64 \
  -a targz:pro:windows/amd64 \
  -a docker:pro:linux/amd64 \
  -a docker:pro:linux/arm64 \
  -a docker:pro:linux/arm/v7 \
  -a docker:pro:linux/amd64:ubuntu \
  -a docker:pro:linux/arm64:ubuntu \
  -a docker:pro:linux/arm/v7:ubuntu \
  --checksum \
  --parallel=2 \
  --yarn-cache=${YARN_CACHE_FOLDER} \
  --build-id=${DRONE_BUILD_NUMBER} \
  --enterprise-ref=${DRONE_TAG} \
  --grafana-ref=${DRONE_TAG} \
  --grafana-repo=https://github.com/grafana/grafana-security-mirror.git \
  --github-token=${GITHUB_TOKEN} \
  --version=${DRONE_TAG} \
  --ubuntu-base="${UBUNTU_BASE}" \
  --alpine-base="${ALPINE_BASE}" \
  --destination=${local_dst} > assets.txt

# Move the tar.gz packages to their expected locations
cat assets.txt | go run ./pkg/build/daggerbuild/scripts/move_packages.go ./dist/prerelease
