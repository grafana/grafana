# List of projects to provide to the make-docs script.
# Format is PROJECT[:[VERSION][:[REPOSITORY][:[DIRECTORY]]]]
# The following PROJECTS value mounts content into the "grafana" project, at the "latest" version, which is the default if not explicitly set.
# This results in the content being served at /docs/grafana/latest/.
# The source of the content is the current repository which is determined by the name of the parent directory of the git root.
# This overrides the default behavior of assuming the repository directory is the same as the project name.
PROJECTS := grafana::$(notdir $(basename $(shell git rev-parse --show-toplevel)))
