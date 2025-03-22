#!/usr/bin/env bash

# devenv/launch_service.sh

service=$1
launch_dir=launch

if [ "$service" = "down" ]; then
    echo "Stopping all launched services..."
    # Find and kill any running grafana server processes
    pkill -f "grafana apiserver" || true
    exit 0
fi

if [ -z "$service" ]; then
    echo "Available services:"
    ls $launch_dir
    exit 0
fi

service_dir=$launch_dir/$service
if [ ! -d "$service_dir" ]; then
    echo "$service_dir is not a directory"
    exit 1
fi

# Copy template files if they don't exist
if [ -f "$service_dir/custom.ini.template" ] && [ ! -f "$service_dir/custom.ini" ]; then
    cp "$service_dir/custom.ini.template" "$service_dir/custom.ini"
fi
if [ -f "$service_dir/.env.example" ] && [ ! -f "$service_dir/.env" ]; then
    echo "Creating .env file from .env.example..."
    cp "$service_dir/.env.example" "$service_dir/.env"
    echo "Please update the values in $service_dir/.env before running the service"
    exit 1
fi

# Run the launch script if it exists
if [ -f "$service_dir/launch.sh" ]; then
    chmod +x "$service_dir/launch.sh"
    "$service_dir/launch.sh"
else
    echo "No launch.sh found in $service_dir"
    exit 1
fi