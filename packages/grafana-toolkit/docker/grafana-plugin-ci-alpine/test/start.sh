#!/bin/bash

function finish {
  echo "Exiting and cleaning up docker image"
  docker-compose down
}
trap finish EXIT

# Enter the docker container
docker-compose run citest sh -c "cd /home/circleci; exec sh --login -i"
