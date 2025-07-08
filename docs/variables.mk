# List of projects to provide to the make-docs script.
# Format is PROJECT[:[VERSION][:[REPOSITORY][:[DIRECTORY]]]]
# The following PROJECTS value mounts content into the "grafana" project, at the "latest" version, which is the default if not explicitly set.
# This results in the content being served at /docs/grafana/latest/.
# The source of the content is the current repository which is determined by the name of the parent directory of the git root.
# This overrides the default behavior of assuming the repository directory is the same as the project name.
PROJECTS := grafana::$(notdir $(basename $(shell git rev-parse --show-toplevel)))

# Use the doc-validator image defined in CI by default.
export DOC_VALIDATOR_IMAGE := $(shell sed -En 's, *image: "(grafana/doc-validator[^"]+)",\1,p' "$(shell git rev-parse --show-toplevel)/.github/workflows/doc-validator.yml")

# Skip some doc-validator checks.
export DOC_VALIDATOR_SKIP_CHECKS := $(shell sed -En "s, *'--skip-checks=(.+)',\1,p" "$(shell git rev-parse --show-toplevel)/.github/workflows/doc-validator.yml")

# Only run on sections that have been enabled in CI.
export DOC_VALIDATOR_INCLUDE := $(shell sed -En "s, *'--include=\\^docs/sources/(.+)',/hugo/content/docs/grafana/latest/\1,p" "$(shell git rev-parse --show-toplevel)/.github/workflows/doc-validator.yml")
