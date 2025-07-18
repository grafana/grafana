#!/usr/bin/env sh
set -e
local_dst="${DRONE_WORKSPACE}/dist"

docker run --privileged --rm tonistiigi/binfmt:qemu-v7.0.0-28 --uninstall 'qemu-*'
# This command enables qemu emulators for building Docker images for arm64/armv6/armv7/etc on the host.
docker run --privileged --rm tonistiigi/binfmt:qemu-v7.0.0-28 --install all

  # -a targz:enterprise:linux/arm/v6 \
  # -a targz:enterprise:linux/arm/v7 \
  # -a deb:enterprise:linux/arm/v6:nightly \
  # -a deb:enterprise:linux/arm/v7:nightly \
  # -a docker:enterprise:linux/arm/v7 \
  # -a docker:enterprise:linux/arm/v7:ubuntu \

dagger run --silent go run ./pkg/build/cmd \
  artifacts \
  -a targz:enterprise:linux/amd64 \
  -a targz:enterprise:linux/arm64 \
  -a targz:enterprise:linux/arm/v7 \
  -a targz:enterprise:linux/arm/v6 \
  -a deb:enterprise:linux/amd64:nightly \
  -a deb:enterprise:linux/arm64:nightly \
  -a deb:enterprise:linux/arm/v6:nightly \
  -a deb:enterprise:linux/arm/v7:nightly \
  -a rpm:enterprise:linux/amd64:sign:nightly \
  -a rpm:enterprise:linux/arm64:sign:nightly \
  -a targz:enterprise:windows/amd64 \
  -a targz:enterprise:windows/arm64 \
  -a targz:enterprise:darwin/amd64 \
  -a targz:enterprise:darwin/arm64 \
  -a zip:enterprise:windows/amd64 \
  -a msi:enterprise:windows/amd64 \
  -a docker:enterprise:linux/amd64 \
  -a docker:enterprise:linux/arm64 \
  -a docker:enterprise:linux/arm/v7 \
  -a docker:enterprise:linux/amd64:ubuntu \
  -a docker:enterprise:linux/arm64:ubuntu \
  -a docker:enterprise:linux/arm/v7:ubuntu \
  --checksum \
  --verify=false \
  --build-id=${DRONE_BUILD_NUMBER} \
  --grafana-ref=main \
  --enterprise-ref=main \
  --grafana-repo=https://github.com/grafana/grafana.git \
  --github-token=${GITHUB_TOKEN} \
  --destination=${local_dst} \
  --yarn-cache=${YARN_CACHE_FOLDER} \
  --ubuntu-base="${UBUNTU_BASE}" \
  --alpine-base="${ALPINE_BASE}" > assets.txt

cat assets.txt
