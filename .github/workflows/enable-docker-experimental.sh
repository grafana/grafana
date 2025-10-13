#!/bin/bash

set -ex

jq '.experimental = true' < /etc/docker/daemon.json > docker.json
mv docker.json /etc/docker/daemon.json
cat /etc/docker/daemon.json
service docker restart

exec docker version -f '{{ .Server.Experimental }}'
