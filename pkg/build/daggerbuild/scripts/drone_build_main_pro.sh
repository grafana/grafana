#!/usr/bin/env sh
local_dst="./dist/${DRONE_BUILD_EVENT}"
set -e

docker run --privileged --rm tonistiigi/binfmt:qemu-v7.0.0-28 --uninstall 'qemu-*'
# This command enables qemu emulators for building Docker images for arm64/armv6/armv7/etc on the host.
docker run --privileged --rm tonistiigi/binfmt:qemu-v7.0.0-28 --install all
# Build all of the grafana.tar.gz packages.
dagger run --silent go run ./pkg/build/cmd \
  artifacts \
  -a targz:pro:linux/amd64 \
  -a targz:pro:linux/arm64 \
  -a deb:pro:linux/amd64 \
  -a deb:pro:linux/arm64 \
  -a frontend:enterprise \
  --yarn-cache=${YARN_CACHE_FOLDER} \
  --checksum \
  --build-id=${DRONE_BUILD_NUMBER} \
  --grafana-ref=${SOURCE_COMMIT} \
  --grafana-repo="https://github.com/grafana/grafana.git" \
  --enterprise-ref=${DRONE_COMMIT} \
  --github-token=${GITHUB_TOKEN} \
  --ubuntu-base=${UBUNTU_BASE} \
  --alpine-base=${ALPINE_BASE} \
  --patches-repo=${PATCHES_REPO} \
  --patches-path=${PATCHES_PATH} \
  --destination=${local_dst} > assets.txt

echo "Final list of artifacts:"
# Move the tar.gz packages to their expected locations
cat assets.txt | grep -v "public" | DESTINATION=gs://grafana-downloads-enterprise2 IS_MAIN=true go run ./pkg/build/daggerbuild/scripts/move_packages.go ./dist/main
cat assets.txt | grep "public" | DESTINATION=gs://grafana-static-assets IS_MAIN=true go run ./pkg/build/daggerbuild/scripts/move_packages.go ./dist/cdn
