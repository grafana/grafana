#!/bin/bash

function finish {
  echo "Exiting and cleaning up docker image"
  docker-compose down
}
trap finish EXIT

# Enter the docker container
docker-compose run citest bash -c "cd /home/circleci; exec bash --login -i"
