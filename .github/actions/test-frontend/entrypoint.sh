#/bin/bash
set -xeo pipefail

yarn install --frozen-lockfile --no-progress
yarn run prettier:check
yarn run packages:typecheck
yarn run typecheck
yarn run test
