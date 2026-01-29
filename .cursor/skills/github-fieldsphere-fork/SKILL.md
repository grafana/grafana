---
name: github-fieldsphere-fork
description: Ensure GitHub context, issues, and pull request work targets the fieldsphere/grafana fork. Use for any GitHub-related task, including issues, PRs, commits, searches, or repository context.
---

# GitHub fork targeting: fieldsphere/grafana

## Instructions

- Always use `fieldsphere/grafana` for GitHub queries and operations (issues, PRs, commits, code search, and repo context).
- For `gh` CLI commands, pass `--repo fieldsphere/grafana` unless the local repo and remote are verified as the fork.
- For GitHub MCP tools, set owner to `fieldsphere` and repo to `grafana` (or include this in the tool query when required).
- Do not fetch from `grafana/grafana`. Only use it if the user explicitly requests the upstream repository.
- If the target repo is ambiguous, check `git remote -v` and still prefer `fieldsphere/grafana`.
