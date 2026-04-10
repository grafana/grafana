#!/bin/bash
# LLM-friendly Jest test runner
# Optimized for clear, debuggable CLI output without HTML reports

npx jest \
  --no-coverage \
  --verbose \
  --expand \
  --testLocationInResults \
  --bail \
  --maxWorkers=1 \
  --no-cache \
  "$@"
