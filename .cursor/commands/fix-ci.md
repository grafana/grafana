# Fix CI

Use the GitHub CLI (`gh`) **read-only** to diagnose CI for the current branch (or `$ARGUMENTS` if a PR URL / run ID is provided).

## Do

1. Resolve the current branch and any open PR (`gh pr view` / `gh run list --branch …`).
2. Show the latest workflow run status and failing jobs.
3. Pull failing job logs with `gh run view --log-failed` (or equivalent) and extract the first actionable error.
4. Propose a minimal fix; implement only if the user asked to fix, not only to inspect.

## Constraints

- Do not create or modify PRs, issues, or workflow files unless the user explicitly asked.
- Prefer `gh` over scraping the GitHub UI.
- If `gh` is unauthenticated, say so and stop.
