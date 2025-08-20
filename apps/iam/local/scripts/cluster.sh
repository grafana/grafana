#!/usr/bin/env bash
set -eufo pipefail

CLUSTER_NAME="grafana-iam-operator"

create_cluster() {
  K3D_CONFIG="${1:-k3d-config.json}"

  if ! k3d cluster list "${CLUSTER_NAME}" >/dev/null 2>&1; then
    # Array of extra options to add to the k3d cluster create command
    EXTRA_K3D_OPTS=()

    # Bug in k3d for btrfs filesystems workaround, see https://k3d.io/v5.2.2/faq/faq/#issues-with-btrfs
    # Apple is APFS/HFS and stat has a different API, so we might as well skip that
    if [[ "${OSTYPE}" != "darwin*" ]]; then
      ROOTFS="$(stat -f --format="%T" "/")"
      if [[ "${ROOTFS}" == "btrfs" ]]; then
        EXTRA_K3D_OPTS+=("-v" "/dev/mapper:/dev/mapper")
      fi
    fi

    k3d cluster create "${CLUSTER_NAME}" --config "${K3D_CONFIG}" ${EXTRA_K3D_OPTS[@]+"${EXTRA_K3D_OPTS[@]}"}
  else
    echo "Cluster already exists"
  fi
}

delete_cluster() {
  k3d cluster delete "${CLUSTER_NAME}"
}

if [ $# -lt 1 ]; then
  echo "Usage: ./cluster.sh [create|delete]"
  exit 1
fi

if [ $1 == "create" ]; then
  create_cluster $2
elif [ $1 == "delete" ]; then
  delete_cluster
else
  echo "Unknown argument ${1}"
fi
