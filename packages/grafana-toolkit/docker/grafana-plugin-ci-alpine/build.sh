#!/bin/bash
set -eo pipefail

source ./common.sh

#
# No longer required, but useful to keep just in case we want to deploy
# changes in toolkit directly to the docker image
#
if [ -n "$INCLUDE_TOOLKIT" ]; then
	/bin/rm -rfv install/grafana-toolkit
	mkdir -pv install/grafana-toolkit
	cp -rv ../../bin install/grafana-toolkit
	cp -rv ../../src install/grafana-toolkit
	cp -v ../../package.json install/grafana-toolkit
	cp -v ../../tsconfig.json install/grafana-toolkit
fi

docker build -t ${DOCKER_IMAGE_NAME} .
docker push $DOCKER_IMAGE_NAME

[ -n "$INCLUDE_TOOLKIT" ] && /bin/rm -rfv install/grafana-toolkit
