#!/usr/bin/env sh

# Exit early if running in CI environment
if [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ]; then
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


REQUIRED_VERSION=$(cat .nvmrc | sed 's/v//')
CURRENT_VERSION=$(node --version | sed 's/v//')

if [ "$CURRENT_VERSION" != "$REQUIRED_VERSION" ]; then
    echo ""
    echo "${RED}⚠️  WARNING  ⚠️${NC}"
    echo "${YELLOW}${BOLD}Node.js version mismatch!${NC}"
    echo ""
    echo "${BOLD}${CYAN}Recommended:${NC} ${GREEN}$REQUIRED_VERSION${NC} (from .nvmrc)"
    echo "${BOLD}${CYAN}Current:${NC}     ${RED}$CURRENT_VERSION${NC}"
    echo ""
    echo "${BOLD}${YELLOW}⚠️  We only test and support developing Grafana with the specific LTS Node.js release.${NC}"
    echo "    Using a different version may lead to unexpected build issues or runtime errors."
    echo ""
    echo "${BOLD}💡 Consider using a node version manager and configuring it to auto-switch to the recommended version:${NC}"
    echo "   • ${BLUE}nvm${NC} - Node Version Manager"
    echo "   • ${BLUE}fnm${NC} - Fast Node Manager"
    echo ""
    echo "${BLUE}${BOLD}If you experience issues building Grafana, first switch to the recommended version of Node.js.${NC}"
    echo ""
fi


