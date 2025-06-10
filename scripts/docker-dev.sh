#!/bin/bash

# Docker Development Environment Helper Script
# Simplified version with only essential commands

set -e

COMPOSE_FILE="docker-compose.dev.yml"

function usage() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start     Start the backend development container"
    echo "  stop      Stop the backend development container" 
    echo "  logs      Show backend logs"
    echo "  build     Rebuild the backend container (only when needed)"
    echo ""
}

function check_requirements() {
    if ! command -v docker &> /dev/null; then
        echo "Error: Docker is not installed or not in PATH"
        exit 1
    fi

    # Determine which docker compose command to use
    if docker compose version &> /dev/null 2>&1; then
        DOCKER_COMPOSE="docker compose"
    else
        DOCKER_COMPOSE="docker-compose"
    fi
}

function start_dev() {
    echo "Starting Grafana backend container..."
    
    # Start backend container (no build unless needed)
    $DOCKER_COMPOSE -f $COMPOSE_FILE up -d
    
    echo ""
    echo "✅ Backend started!"
    echo "  - Grafana: http://localhost:3000"
    echo ""
    echo "🎯 Next step:"
    echo "  Run frontend locally: yarn start or yarn start:liveReload for live reload"
}

function stop_dev() {
    echo "Stopping backend container..."
    $DOCKER_COMPOSE -f $COMPOSE_FILE down
}

function show_logs() {
    $DOCKER_COMPOSE -f $COMPOSE_FILE logs -f grafana-dev
}

function build_dev() {
    echo "Rebuilding backend container..."
    $DOCKER_COMPOSE -f $COMPOSE_FILE build --no-cache
    echo "✅ Container rebuilt!"
}

# Check requirements first
check_requirements

# Parse command
case "${1:-}" in
    start)
        start_dev
        ;;
    stop)
        stop_dev
        ;;
    logs)
        show_logs
        ;;
    build)
        build_dev
        ;;
    help|--help|-h)
        usage
        ;;
    "")
        echo "Error: No command specified"
        echo ""
        usage
        exit 1
        ;;
    *)
        echo "Error: Unknown command '$1'"
        echo ""
        usage
        exit 1
        ;;
esac 