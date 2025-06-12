#!/usr/bin/env sh
local_dst="dist/${DRONE_BUILD_EVENT}"
set -e

docker run --privileged --rm tonistiigi/binfmt:qemu-v7.0.0-28 --uninstall 'qemu-*'
# This command enables qemu emulators for building Docker images for arm64/armv6/armv7/etc on the host.
docker run --privileged --rm tonistiigi/binfmt:qemu-v7.0.0-28 --install all

# Build all of the grafana.tar.gz packages.
dagger run --silent go run ./pkg/build/cmd \
  artifacts \
  -a targz:enterprise:linux/amd64 \
  -a targz:enterprise:linux/arm64 \
  -a targz:enterprise:linux/arm/v6 \
  -a targz:enterprise:linux/arm/v7 \
  -a deb:enterprise:linux/amd64 \
  -a deb:enterprise:linux/arm64 \
  -a deb:enterprise:linux/arm/v6 \
  -a deb:enterprise:linux/arm/v7 \
  -a rpm:enterprise:linux/amd64:sign \
  -a rpm:enterprise:linux/arm64:sign \
  -a targz:enterprise:windows/amd64 \
  -a targz:enterprise:windows/arm64 \
  -a targz:enterprise:darwin/amd64 \
  -a targz:enterprise:darwin/arm64 \
  -a targz:boring:linux/amd64/dynamic \
  -a zip:enterprise:windows/amd64 \
  -a msi:enterprise:windows/amd64 \
  -a docker:enterprise:linux/amd64 \
  -a docker:enterprise:linux/arm64 \
  -a docker:enterprise:linux/arm/v7 \
  -a docker:enterprise:linux/amd64:ubuntu \
  -a docker:enterprise:linux/arm64:ubuntu \
  -a docker:enterprise:linux/arm/v7:ubuntu \
  -a docker:boring:linux/amd64/dynamic \
  --yarn-cache=${YARN_CACHE_FOLDER} \
  --verify \
  --checksum \
  --parallel=5 \
  --build-id=${DRONE_BUILD_NUMBER} \
  --enterprise-ref=${DRONE_TAG} \
  --grafana-ref=${DRONE_TAG} \
  --grafana-repo=https://github.com/grafana/grafana-security-mirror.git \
  --github-token=${GITHUB_TOKEN} \
  --ubuntu-base="${UBUNTU_BASE}" \
  --alpine-base="${ALPINE_BASE}" \
  --version=${DRONE_TAG} \
  --destination=${local_dst} > assets.txt

# Move the tar.gz packages to their expected locations
cat assets.txt | go run ./pkg/build/daggerbuild/scripts/move_packages.go ./dist/prerelease
