# Grafana internal packages

As part of meeting the prerequisites for the experimental Intent API, Grafana will be cleanly separating its public-facing Go package API from internal-only packages. This directory will contain the latter.

**FOR NOW, only folks working on the new experimental Intent API should put anything in this subdirectory.** New rules and guidelines for package organization will be prototyped out in this directory, and until they're firmed up, nothing outside of that experiment should be put here.

_(Reminder: Go `internal` import rules dictate that packages here are not importable from Grafana Enterprise packages.)_
