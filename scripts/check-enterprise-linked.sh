#!/usr/bin/env sh

# Colors for prettier output
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

ENTERPRISE_FE_EXT_FILE="public/app/extensions/index.ts"

if [ ! -f "$ENTERPRISE_FE_EXT_FILE" ]; then
    printf "%b\n" ""
    printf "%b\n" "${RED}⚠️  ERROR  ⚠️${NC}"
    printf "%b\n" "${YELLOW}${BOLD}Enterprise is not linked!${NC}"
    printf "%b\n" ""
    printf "%b\n" "${BOLD}${CYAN}Missing:${NC} ${ENTERPRISE_FE_EXT_FILE}"
    printf "%b\n" ""
    printf "%b\n" "${BOLD}Knip relies on enterprise entry points to detect which code is actually used."
    printf "%b\n" "Running it without enterprise linked will report large amounts of legitimate code as unused.${NC}"
    printf "%b\n" ""
    printf "%b\n" "${BOLD}💡 To link enterprise, ensure ${BLUE}grafana-enterprise${NC}${BOLD} is cloned in a sibling directory and run:${NC}"
    printf "%b\n" "   ${BLUE}make enterprise-dev${NC}"
    printf "%b\n" ""
    exit 1
fi
