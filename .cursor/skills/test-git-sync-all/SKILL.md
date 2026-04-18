---
name: test-git-sync-all
description: >
  Use when asked to run the full Git Sync provisioning test suite. Executes
  wizard flows for every provider whose credentials are configured (GitHub PAT,
  GitLab token, Bitbucket token, GitHub App) plus multi-role resource operations.
---

# Git Sync Full Test Suite

This skill runs the wizard test skills sequentially for every configured provider, then runs multi-role resource operations. Each skill cleans up after itself before the next begins. Skills whose credentials are not configured are skipped with a note in the report.

## Execution Rules

**This is a test-only run. You MUST follow these rules:**

1. **No code changes.** Do not modify any Grafana source code or test files. Configuration files (e.g., feature toggles) may be changed only as directed by the Prerequisites section. You are testing the product as-is, not fixing it.
2. **Do not stop on failure.** When a step fails, encounters a bug, or produces unexpected behavior -- document it and move on to the next step. Do not attempt to debug or fix the root cause. If a failure blocks subsequent steps, apply a minimal workaround to unblock the flow and note it in the report. **Workaround must use the same mechanism as the original step** (e.g., retry with slightly different input, skip to a later step that creates the needed state). Do not switch to a different API or creation method -- the resource may not behave the same way in subsequent steps.
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

5. **Budget your time.** Allocate effort across all phases, not just the first. If a phase is consuming disproportionate time due to repeated failures or workarounds, document what you've observed and advance to the next phase. Partial coverage of every phase is more valuable than exhaustive coverage of one.

## Prerequisites

Requires **at least** the GitHub PAT secrets (used by Resource Ops). GitLab and Bitbucket flows are optional -- they run only when their credentials are present.

| Variable                                    | Flow                           | Required |
| ------------------------------------------- | ------------------------------ | -------- |
| `GIT_SYNC_TEST_PAT_REPO_URL`                | PAT + Resource Ops + None Role | Yes      |
| `GIT_SYNC_TEST_PAT`                         | PAT + Resource Ops + None Role | Yes      |
| `GIT_SYNC_TEST_GITLAB_REPO_URL`             | GitLab wizard                  | No       |
| `GIT_SYNC_TEST_GITLAB_TOKEN`                | GitLab wizard                  | No       |
| `GIT_SYNC_TEST_BITBUCKET_REPO_URL`          | Bitbucket wizard               | No       |
| `GIT_SYNC_TEST_BITBUCKET_TOKEN`             | Bitbucket wizard               | No       |
| `GIT_SYNC_TEST_BITBUCKET_TOKEN_USER`        | Bitbucket wizard               | No       |
| `GIT_SYNC_TEST_APP_REPO_URL`                | GitHub App                     | No       |
| `GIT_SYNC_TEST_GITHUB_APP_ID`               | GitHub App                     | No       |
| `GIT_SYNC_TEST_GITHUB_APP_INSTALLATION_ID`  | GitHub App                     | No       |
| `GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY_PATH` | GitHub App (local)             | No       |
| `GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY`      | GitHub App (cloud)             | No       |

See each skill's SKILL.md for full prerequisites (feature toggles, Grafana setup, login).

## Execution

Source credentials first: `source .cursor/skills/git-sync-shared/scripts/load-env.sh`
The loader reports which flows are configured. Run only the skills whose flows were confirmed.

1. Read and execute `../test-git-sync-pat/SKILL.md` -- GitHub PAT wizard test (wizard Steps 1-5, verify, cleanup).
2. **If GitLab credentials are configured**, read and execute `../test-git-sync-gitlab/SKILL.md` -- GitLab token wizard test (wizard Steps 1-5, verify, cleanup).
3. **If Bitbucket credentials are configured**, read and execute `../test-git-sync-bitbucket/SKILL.md` -- Bitbucket token wizard test (wizard Steps 1-5, verify, cleanup).
4. **If GitHub App credentials are configured**, read and execute `../test-git-sync-github-app/SKILL.md` -- GitHub App wizard test (wizard Steps 1-5, verify, cleanup including connection deletion).
5. **After all wizard flows complete and are fully cleaned up**, read and execute `../test-git-sync-resource-ops/SKILL.md` -- multi-role resource operations (API setup, 4-phase 17-step lifecycle across Viewer/Editor/Admin roles, cleanup including test user deletion).
6. **After resource operations complete and are fully cleaned up**, read and execute `../test-git-sync-none-role/SKILL.md` -- None-role access restrictions (API setup, 3-phase 10-step lifecycle verifying zero-permission access, cleanup including test user deletion).

Each skill uses a distinct repo path to avoid conflicts:

| Skill             | Path in repo         |
| ----------------- | -------------------- |
| PAT wizard        | `dev/pat-test`       |
| GitLab wizard     | `dev/gitlab-test`    |
| Bitbucket wizard  | `dev/bitbucket-test` |
| GitHub App wizard | `dev/app-test`       |
| Resource ops      | `dev/ops-test`       |
| None role         | `dev/none-test`      |

Do not abbreviate or collapse steps for any run.
