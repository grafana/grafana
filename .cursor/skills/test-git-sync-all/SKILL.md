---
name: test-git-sync-all
description: >
  Use when asked to run the full Git Sync provisioning test suite. Executes
  PAT wizard, GitHub App wizard, and multi-role resource operations sequentially.
---

# Git Sync Full Test Suite

This skill runs all three test skills sequentially: PAT wizard, GitHub App wizard, and multi-role resource operations. Each skill cleans up after itself before the next begins.

## Execution Rules

**This is a test-only run. You MUST follow these rules:**

1. **No code changes.** Do not modify any Grafana source code or test files. Configuration files (e.g., feature toggles) may be changed only as directed by the Prerequisites section. You are testing the product as-is, not fixing it.
2. **Do not stop on failure.** When a step fails, encounters a bug, or produces unexpected behavior -- document it and move on to the next step. Do not attempt to debug, fix, or work around the issue.
3. **Complete the entire flow.** Execute every step from start to finish, including cleanup. Skipping steps after a failure loses coverage.
4. **Produce a final report.** After completing all steps (or reaching the end), output a structured report:

   ### Report Format

   ```
   ## Test Run Report

   **Skill:** <skill name>
   **Date:** <date>
   **Status:** PASS | PARTIAL | FAIL

   ### Steps Completed
   - Step N: <description> -- PASS | FAIL
     - [if FAIL] **Issue:** <what happened, expected vs actual>

   ### Summary
   - Total steps: N
   - Passed: N
   - Failed: N
   - Blocked (could not attempt due to prior failure state): N

   ### Issues Found
   1. **[Step N] <title>**: <description of the bug or unexpected behavior>
   ```

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
