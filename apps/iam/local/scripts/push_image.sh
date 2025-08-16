#!/usr/bin/env bash
set -eufo pipefail

CLUSTER_NAME="grafana-iam-operator"
IMAGE="$1"

if [[ "$IMAGE" == "" ]]; then
  echo "usage: push_image.sh <image_name:tag>"
  exit 1
fi

k3d image import "${IMAGE}" -c "${CLUSTER_NAME}"