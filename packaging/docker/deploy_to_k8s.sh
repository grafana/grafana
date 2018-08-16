#!/bin/sh

curl -s --header "Content-Type: application/json" \
     --data "{\"build_parameters\": {\"CIRCLE_JOB\": \"deploy\", \"IMAGE_NAMES\": \"$1\"}}" \
     --request POST \
     https://circleci.com/api/v1.1/project/github/raintank/deployment_tools/tree/master?circle-token=$CIRCLE_TOKEN
