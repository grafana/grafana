#!/bin/bash
# LLM-friendly Playwright E2E test runner
# Optimized for clear, debuggable CLI output without HTML reports
#
# Note: This runs Playwright directly, NOT via Docker.
# You must have Grafana server running separately.
# Use `npm run server` in another terminal first.

npx playwright test \
  --reporter=list \
  --workers=1 \
  --retries=0 \
  --timeout=30000 \
  "$@"
