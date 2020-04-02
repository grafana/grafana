#!/bin/bash

# Enter the docker container
docker-compose run citest bash -c "cd /home/circleci; exec bash --login -i"
