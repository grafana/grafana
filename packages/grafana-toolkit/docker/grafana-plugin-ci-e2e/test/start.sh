#!/bin/bash

function finish {
  echo "Exiting and cleaning up docker image"
  docker-compose down
}
trap finish EXIT

# Enter the docker container
if [ "$1" = "built" ]; then
  docker-compose run cibuilt sh -c "cd /root; exec bash --login -i"
else 
  docker-compose run citest sh -c "cd /root; exec bash --login -i"
fi
