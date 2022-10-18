#!/usr/bin/env bash
set -euo pipefail
set -x

# shellcheck disable=SC2153
readarray -t tools <<<"${TOOLS?}"
if [ "${#tools[@]}" -eq 1 ] && [ -z "${tools[0]:-}" ]; then
	# Parameter was set to empty string
	tools=()
fi

sudo apt-get update
sudo apt-get install graphviz

# If we need to setup python
if grep <<<"${TOOLS}" '^python$'; then
	# See https://github.com/pyenv/pyenv/wiki#suggested-build-environment
	sudo apt-get install make build-essential libssl-dev zlib1g-dev \
		libbz2-dev libreadline-dev libsqlite3-dev wget curl llvm \
		libncursesw5-dev xz-utils tk-dev libxml2-dev libxmlsec1-dev libffi-dev liblzma-dev
fi

(yes || true) | ./.circleci/scripts/manage_tools.sh setup "${tools[@]}"
