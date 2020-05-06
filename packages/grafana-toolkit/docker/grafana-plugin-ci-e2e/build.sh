#!/bin/bash
set -eo pipefail

source ./common.sh

output=$(docker build . | tee /dev/tty)
hash=$(echo "$output" | tail -1 | sed -ne "s/^Successfully built \(.*\)/\1/p")
if [ ${#hash} -gt 0 ]; then
	docker tag "$hash" $DOCKER_IMAGE_NAME:latest
	docker push $DOCKER_IMAGE_NAME:latest
fi

