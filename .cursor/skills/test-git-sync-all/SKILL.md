---
name: test-git-sync-all
description: >
  Use when asked to run the full Git Sync provisioning test suite. Executes
  PAT wizard, GitHub App wizard, and multi-role resource operations sequentially.
---

# Git Sync Full Test Suite

This skill runs all three test skills sequentially: PAT wizard, GitHub App wizard, and multi-role resource operations. Each skill cleans up after itself before the next begins.

## Prerequisites

Requires **ALL** secrets from both auth flows:

| Variable                                    | Flow               |
| ------------------------------------------- | ------------------ |
| `GIT_SYNC_TEST_PAT_REPO_URL`                | PAT + Resource Ops |
| `GIT_SYNC_TEST_PAT`                         | PAT + Resource Ops |
| `GIT_SYNC_TEST_APP_REPO_URL`                | GitHub App         |
| `GIT_SYNC_TEST_GITHUB_APP_ID`               | GitHub App         |
| `GIT_SYNC_TEST_GITHUB_APP_INSTALLATION_ID`  | GitHub App         |
| `GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY_PATH` | GitHub App (local) |
| `GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY`      | GitHub App (cloud) |

See each skill's SKILL.md for full prerequisites (feature toggles, Grafana setup, login).

## Execution

1. Read and execute `../test-git-sync-pat/SKILL.md` -- PAT wizard test (wizard Steps 1-5, verify, cleanup).
2. **After PAT completes and is fully cleaned up**, read and execute `../test-git-sync-github-app/SKILL.md` -- GitHub App wizard test (wizard Steps 1-5, verify, cleanup including connection deletion).
3. **After GitHub App completes and is fully cleaned up**, read and execute `../test-git-sync-resource-ops/SKILL.md` -- multi-role resource operations (API setup, 4-phase 17-step lifecycle across Viewer/Editor/Admin roles, cleanup including test user deletion).

Each skill uses a distinct repo path to avoid conflicts:

| Skill             | Path in repo   |
| ----------------- | -------------- |
| PAT wizard        | `dev/pat-test` |
| GitHub App wizard | `dev/app-test` |
| Resource ops      | `dev/ops-test` |

Do not abbreviate or collapse steps for any run.
