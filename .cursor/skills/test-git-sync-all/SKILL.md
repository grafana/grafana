---
name: test-git-sync-all
description: >
  Use when asked to run the full Git Sync provisioning test suite across both
  auth types (PAT and GitHub App). Executes each flow's complete lifecycle
  sequentially.
---

# Git Sync Full Test Suite

This skill runs both auth flows sequentially. Each flow creates resources, exercises all operations, and cleans up completely before the next flow begins.

## Prerequisites

Requires **ALL** secrets from both flows:

| Variable                                    | Flow               |
| ------------------------------------------- | ------------------ |
| `GIT_SYNC_TEST_PAT_REPO_URL`                | PAT                |
| `GIT_SYNC_TEST_PAT`                         | PAT                |
| `GIT_SYNC_TEST_APP_REPO_URL`                | GitHub App         |
| `GIT_SYNC_TEST_GITHUB_APP_ID`               | GitHub App         |
| `GIT_SYNC_TEST_GITHUB_APP_INSTALLATION_ID`  | GitHub App         |
| `GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY_PATH` | GitHub App (local) |
| `GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY`      | GitHub App (cloud) |

See each flow's skill for full prerequisites (feature toggles, Grafana setup, login).

## Execution

1. Read and execute `../test-git-sync-pat/SKILL.md` — the complete PAT lifecycle (wizard + 13-step resource lifecycle including branch workflow testing + cleanup).
2. **After PAT completes and is fully cleaned up**, read and execute `../test-git-sync-github-app/SKILL.md` — the complete GitHub App lifecycle (wizard + 13-step resource lifecycle including branch workflow testing + cleanup including connection deletion).

Both flows execute the **identical** 13-step lifecycle that exercises both the `write` (direct commit) and `branch` (PR creation) workflows. Do not abbreviate or collapse steps for the second run.

Each flow uses a distinct path in Step 2 (`dev/pat-test` and `dev/app-test` respectively) to avoid conflicts.
