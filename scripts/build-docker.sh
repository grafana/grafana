#!/bin/bash
#

base_type="${base_type:-ubuntu}"
node_env="${node_env:-production}"
arch="${arch:-amd64}"
platform=linux
js_platform=${platform}/${arch}
go_arch=${arch}
go_version=1.21.6
package_build_script=build

function usage {
    echo ""
    echo "Builds a docker image for Grafana for the specified architecture and node environment."
    echo ""
    echo "usage:"
    echo "  $0 --arch|-a string --node-env|-n string"
    echo ""
    echo "  --arch | -a        string   architecture to target (amd64/arm64)"
    echo "  --node-env | -n    string   type of node build (development/production)"
    echo "  --base | -b        string   base image type (alpine/ubuntu)"
    echo ""
}

while [ $# -gt 0 ]; do
  if [[ $1 == "-h" || $1 == "--help" ]]; then
    usage
    exit 0
  elif [[ $1 == "-n" || $1 == "--node-env" ]]; then
    node_env=$2
    shift
  elif [[ $1 == "-a" || $1 == "--arch" ]]; then
    arch=$2
    shift
  elif [[ $1 == "-b" || $1 == "--base" ]]; then
    base_type=$2
    shift
  else
    echo "$0: unknown option: $1"
    exit 1
  fi
  shift
done


#NODE_ENV=${node_env} make build-docker-full-${base_type} \
#    ARCH=${arch} \
#    GO_VERSION=${go_version} \
#    NODE_ENV=${node_env} \
#    PLATFORM=${platform}/${arch}

if [ "${node_env}" == "development" ]; then
  package_build_script=dev
fi

make build-docker-full-${base_type} \
    ARCH=${arch} \
    GO_VERSION=${go_version} \
    NODE_ENV=${node_env} \
    PLATFORM=${platform}/${arch} \
    PACKAGE_BUILD_SCRIPT=${package_build_script}
