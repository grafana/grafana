#!/bin/bash

# ensure DRONE_SERVER and DRONE_TOKEN env variables are set
if [ -z "$DRONE_SERVER" ]; then
    echo "DRONE_SERVER environment variable is not set."
    exit 1
fi

if [ -z "$DRONE_TOKEN" ]; then
    echo "DRONE_TOKEN environment variable is not set."
    exit 1
fi