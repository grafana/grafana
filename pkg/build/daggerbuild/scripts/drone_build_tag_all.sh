#!/usr/bin/env bash
dst="${DESTINATION}/${DRONE_BUILD_EVENT}"
local_dst="./dist/${DRONE_BUILD_EVENT}"
set -e

dagger run go run ./cmd artifacts \
  -a frontend:enterprise \
  -a storybook \
  -a npm:grafana \
  -a targz:grafana:linux/amd64 \
  -a targz:grafana:linux/arm64 \
  -a targz:grafana:linux/riscv64 \
  -a targz:grafana:linux/arm/v6 \
  -a targz:grafana:linux/arm/v7 \
  -a targz:enterprise:linux/amd64 \
  -a targz:enterprise:linux/arm64 \
  -a targz:enterprise:linux/riscv64 \
  -a targz:enterprise:linux/arm/v6 \
  -a targz:enterprise:linux/arm/v7 \
  -a targz:boring:linux/amd64/dynamic \
  -a deb:grafana:linux/amd64 \
  -a deb:grafana:linux/arm64 \
  -a deb:grafana:linux/arm/v6 \
  -a deb:grafana:linux/arm/v7 \
  -a deb:enterprise:linux/amd64 \
  -a deb:enterprise:linux/arm64 \
  -a deb:enterprise:linux/arm/v6 \
  -a deb:enterprise:linux/arm/v7 \
  -a rpm:grafana:linux/amd64:sign \
  -a rpm:grafana:linux/arm64:sign \
  -a rpm:enterprise:linux/amd64 \
  -a rpm:enterprise:linux/arm64 \
  -a docker:grafana:linux/amd64 \
  -a docker:grafana:linux/arm64 \
  -a docker:grafana:linux/amd64:ubuntu \
  -a docker:grafana:linux/arm64:ubuntu \
  -a docker:enterprise:linux/amd64 \
  -a docker:enterprise:linux/arm64 \
  -a docker:enterprise:linux/amd64:ubuntu \
  -a docker:enterprise:linux/arm64:ubuntu \
  -a docker:boring:linux/amd64/dynamic \
  -a zip:grafana:windows/amd64 \
  -a zip:enterprise:windows/amd64 \
  -a zip:grafana:windows/arm64 \
  -a zip:enterprise:windows/arm64 \
  -a msi:grafana:windows/amd64 \
  -a msi:enterprise:windows/amd64 \
  --parallel=2 \
  --ubuntu-base="${UBUNTU_BASE}" \
  --alpine-base="${ALPINE_BASE}" \
  --go-version="${GO_VERSION}" \
  -build-id=103 \
  --checksum > out.txt

# Move the tar.gz packages to their expected locations
cat assets.txt | go run ./scripts/move_packages.go ./dist/prerelease
