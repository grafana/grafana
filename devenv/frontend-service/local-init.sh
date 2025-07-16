#!/bin/bash

# Used to check if the local dev environment is set up correctly

IS_OKAY=true

if ! docker ps &> /dev/null; then
    echo "Error: docker is not installed or running"
    echo "See https://docs.docker.com/get-docker/ for installation instructions"
    echo ""
    IS_OKAY=false
fi

if ! tilt version &> /dev/null; then
    echo "Error: tilt is not installed"
    echo "See https://docs.tilt.dev/install.html for installation instructions."
    echo "For frontend-service, you can ignore the kubernetes instructions."
    echo ""
    IS_OKAY=false
fi


if [ "$IS_OKAY" = false ]; then
    echo "Please fix the above errors before continuing"
    exit 1
fi
