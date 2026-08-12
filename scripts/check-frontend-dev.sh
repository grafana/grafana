#!/usr/bin/env sh

# Exit early if running in CI environment
if [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ] || [ -n "$IGNORE_NODE_VERSION_CHECK" ]; then
  exit 0
fi

# Colors for prettier output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Check if .nvmrc file exists
if [ ! -f ".nvmrc" ]; then
    printf "%b\n" ""
    printf "%b\n" "${RED}⚠️  ERROR  ⚠️${NC}"
    printf "%b\n" "${YELLOW}${BOLD}.nvmrc file not found!${NC} Run '${BLUE}git checkout main -- .nvmrc${NC}' to fix."
    printf "%b\n" ""
    exit 1
fi

REQUIRED_VERSION=$(sed 's/v//' .nvmrc)
CURRENT_VERSION=$(node --version | sed 's/v//')

if [ "$CURRENT_VERSION" != "$REQUIRED_VERSION" ]; then
    printf "%b\n" ""
    printf "%b\n" "${RED}⚠️  WARNING  ⚠️${NC}"
    printf "%b\n" "${YELLOW}${BOLD}Node.js version mismatch!${NC}"
    printf "%b\n" ""
    printf "%b\n" "${BOLD}${CYAN}Recommended:${NC} ${GREEN}$REQUIRED_VERSION${NC} (from .nvmrc)"
    printf "%b\n" "${BOLD}${CYAN}Current:${NC}     ${RED}$CURRENT_VERSION${NC}"
    printf "%b\n" ""
    printf "%b\n" "${BOLD}${YELLOW}⚠️ We only test and support developing Grafana with the specific LTS Node.js release.${NC}"
    printf "%b\n" "   Using a different version may lead to unexpected build issues or runtime errors."
    printf "%b\n" ""
    printf "%b\n" "${BOLD}💡 Consider using a node version manager and configuring it to auto-switch to the recommended version:${NC}"
    printf "%b\n" "   • ${BLUE}nvm${NC} - Node Version Manager"
    printf "%b\n" "   • ${BLUE}fnm${NC} - Fast Node Manager"
    printf "%b\n" ""
    printf "%b\n" "${BLUE}${BOLD}If you experience issues building Grafana, first switch to the recommended version of Node.js.${NC}"
    printf "%b\n" ""
fi


