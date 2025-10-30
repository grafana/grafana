#!/usr/bin/env bash

# This script checks if profiling artifacts exist and if any profiled tests failed.
# It sets GitHub Actions output variables for use in subsequent steps.
#
# Outputs:
#   upload_artifact: 'true' if profiles exist and any profiled test failed, 'false' otherwise
#   shard: The shard identifier with '/' replaced by '-' for artifact naming

# Early exit if no profiles directory or empty
if [ ! -d "profiles" ] || [ -z "$(ls -A profiles 2>/dev/null)" ]; then
  echo "upload_artifact=false" >> "$GITHUB_OUTPUT"
  echo "⏭️  No profiling data"
  exit 0
fi

echo "✅ Profiling data found"

# Check if any profiled test failed
HAS_FAILURES=false
for exit_file in profiles/exit_*.code; do
  if [ -f "$exit_file" ]; then
    EXIT_CODE=$(cat "$exit_file")
    if [ "$EXIT_CODE" -ne 0 ]; then
      echo "  Found failure in $(basename "$exit_file"): exit code $EXIT_CODE"
      HAS_FAILURES=true
    fi
  fi
done

if [ "$HAS_FAILURES" = false ]; then
  echo "upload_artifact=false" >> "$GITHUB_OUTPUT"
  echo "⏭️  Skipping upload (all profiled tests passed)"
  exit 0
fi

# Upload profiles when failures found
SHARD_VALUE="${SHARD:-unknown}"
SHARD_SAFE="${SHARD_VALUE//\//-}"
echo "shard=$SHARD_SAFE" >> "$GITHUB_OUTPUT"
echo "upload_artifact=true" >> "$GITHUB_OUTPUT"
echo "📤 Will upload profiles (profiled tests failed)"
