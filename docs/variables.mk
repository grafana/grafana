# List of projects to provide to the make-docs script.
PROJECTS := grafana

# Use the doc-validator image defined in CI by default.
export DOC_VALIDATOR_IMAGE := $(shell sed -En 's, *image: "(grafana/doc-validator[^"]+)",\1,p' "$(shell git rev-parse --show-toplevel)/.github/workflows/doc-validator.yml")

# Skip some doc-validator checks.
export DOC_VALIDATOR_SKIP_CHECKS := $(shell sed -En "s, *'--skip-checks=(.+)',\1,p" "$(shell git rev-parse --show-toplevel)/.github/workflows/doc-validator.yml")

# Only run on sections that have been enabled in CI.
export DOC_VALIDATOR_INCLUDE := $(shell sed -En "s, *'--include=\\^docs/sources/(.+)',/hugo/content/docs/grafana/latest/\1,p" "$(shell git rev-parse --show-toplevel)/.github/workflows/doc-validator.yml")
