---
name: all
description: >
  Use when asked to run the full Git Sync provisioning test suite. Executes
  wizard flows for every provider whose credentials are configured (GitHub PAT,
  GitLab token, Bitbucket token, GitHub App) plus multi-role resource operations.
---

# Git Sync Full Test Suite

This skill runs the wizard test skills sequentially for every configured provider, then runs multi-role resource operations. Each skill cleans up after itself before the next begins. Skills whose credentials are not configured are skipped with a note in the report.

## Execution Rules

**This is a test-only run.** Read `../shared/execution-rules.md` FIRST and follow all of its rules: no code changes, do not stop on failure, complete the entire flow including cleanup, budget your time, and produce the final report in the format it defines.

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

Source credentials first: `source .claude/skills/git-sync/shared/scripts/load-env.sh`
The loader reports which flows are configured. Run only the skills whose flows were confirmed.

1. Read and execute `../pat/SKILL.md` -- GitHub PAT wizard test (wizard Steps 1-5, verify, cleanup).
2. **If GitLab credentials are configured**, read and execute `../gitlab/SKILL.md` -- GitLab token wizard test (wizard Steps 1-5, verify, cleanup).
3. **If Bitbucket credentials are configured**, read and execute `../bitbucket/SKILL.md` -- Bitbucket token wizard test (wizard Steps 1-5, verify, cleanup).
4. **If GitHub App credentials are configured**, read and execute `../github-app/SKILL.md` -- GitHub App wizard test (wizard Steps 1-5, verify, cleanup including connection deletion).
5. **After all wizard flows complete and are fully cleaned up**, read and execute `../resource-ops/SKILL.md` -- multi-role resource operations (API setup, 4-phase 17-step lifecycle across Viewer/Editor/Admin roles, cleanup including test user deletion).
6. **After resource operations complete and are fully cleaned up**, read and execute `../none-role/SKILL.md` -- None-role access restrictions (API setup, 3-phase 10-step lifecycle verifying zero-permission access, cleanup including test user deletion).

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
