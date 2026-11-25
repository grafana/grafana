# AGENTS.md

Guidance for changes under `.github/` (workflows and actions).

- After adding, renaming, or removing a workflow, run `make .policy.yml` and commit the result in the same change.
- `./.github/actions/setup-go` keeps one shared build cache per go.mod hash, saved by whichever job finishes first.
  Set `cache-build: 'false'` on jobs that compile little, such as lint, codegen, and checks, so they do not save a near-empty cache for every other job.
