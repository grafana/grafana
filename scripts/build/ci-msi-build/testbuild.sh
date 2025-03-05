#!/bin/bash

_image="ee-msi-build"
_container="ee-build"

docker build -t $_image .

docker run --rm -d --name $_container $_image sleep 100
docker cp $_container:/tmp/scratch .
docker stop $_container

