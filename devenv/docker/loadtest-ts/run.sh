#!/usr/bin/env bash

if ((BASH_VERSINFO[0] < 4)); then
  echo "Bash ver >= 4 is needed to run this script"
  echo "Please upgrade your bash - run 'brew install bash' if you use Homebrew on MacOS"
  exit 1;
fi

declare -A cfg=(
  [grpcToken]=$GRPC_TOKEN
  [grpcAddress]="127.0.0.1:10000"
  [execution]="local"
  [test]="object-store-test"
  [k6CloudToken]=$K6_CLOUD_TOKEN
)

for ARGUMENT in "$@"
do
   KEY=$(echo $ARGUMENT | cut -f1 -d=)

   KEY_LENGTH=${#KEY}
   VALUE="${ARGUMENT:$KEY_LENGTH+1}"
   cfg["$KEY"]="$VALUE"
done

function usage() {
    echo "$0 grpcAddress= grpcToken= execution= k6CloudToken= test=
- 'grpcAddress' is the address of Grafana gRPC server. 127.0.0.1:10000 is the default.
- 'grpcToken' is the service account admin token used for Grafana gRPC server authentication.
- 'execution' is the test execution mode; one of 'local', 'cloud-output', 'cloud'. 'local' is the default.
- 'k6CloudToken' is the k6 cloud token required for 'cloud-output' and 'cloud' execution modes.
- 'test' is the filepath of the test to execute relative to ./src, without the extension. example 'object-store-test'"
    exit 0
}

if [ "${cfg[grpcToken]}" == "" ]; then
	usage
fi


if [ "${cfg[execution]}" == "cloud" ]; then
  echo "cloud execution mode is not yet implemented"
  exit 0
elif [ "${cfg[execution]}" == "cloud-output" ]; then
   if [ "${cfg[k6CloudToken]}" == "" ]; then
     usage
   fi
elif [ "${cfg[execution]}" != "local" ]; then
   usage
fi

yarn run build
yarn run prepare-testdata

TEST_PATH="./dist/${cfg[test]}.js"
echo "$(date '+%Y-%m-%d %H:%M:%S'): Executing test ${TEST_PATH} in ${cfg[execution]} mode"

if [ "${cfg[execution]}" == "cloud-output" ]; then
    GRPC_TOKEN="${cfg[grpcToken]}" GRPC_ADDRESS="${cfg[grpcAddress]}" K6_CLOUD_TOKEN="${cfg[k6CloudToken]}" k6 run --out cloud "$TEST_PATH"
elif [ "${cfg[execution]}" == "local" ]; then
    GRPC_TOKEN="${cfg[grpcToken]}" GRPC_ADDRESS="${cfg[grpcAddress]}" k6 run "$TEST_PATH"
fi


