# List of projects to provide to the make-docs script.
PROJECTS = grafana

# Use the doc-validator image defined in CI by default.
export DOC_VALIDATOR_IMAGE := $(shell sed -En 's, *image: "(grafana/doc-validator[^"]+)",\1,p' "$(shell git rev-parse --show-toplevel)/.github/workflows/doc-validator.yml")

# Skip some doc-validator checks.
export DOC_VALIDATOR_SKIP_CHECKS := ^(?:image.+|canonical-does-not-match-pretty-URL)$

# Use alternative image until make-docs 3.0.0 is rolled out.
export DOCS_IMAGE := grafana/docs-base:dbd975af06
