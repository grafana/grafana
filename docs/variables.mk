# Project target version to build by default.
TARGET := next

# List of projects to provide to the make-docs script.
PROJECTS := grafana:$(TARGET)

# Path to workflow containing doc-validator job.
WORKFLOW := "$(shell git rev-parse --show-toplevel)/.github/workflows/build-technical-documentation.yml"

# Use the doc-validator image defined in CI by default.
export DOC_VALIDATOR_IMAGE := $(shell sed -En 's, *image: (grafana/doc-validator.+),\1,p' $(WORKFLOW))

# Skip some doc-validator checks.
export DOC_VALIDATOR_SKIP_CHECKS := $(shell sed -En 's,^ *DOC_VALIDATOR_SKIP_CHECKS: (.+),\1,p' $(WORKFLOW))

# Only run on sections that have been enabled in CI.
export DOC_VALIDATOR_INCLUDE := $(shell sed -En 's,^ *DOC_VALIDATOR_INCLUDE: (.+),/hugo/content/docs/grafana/$(TARGET)/\1,p' $(WORKFLOW))
