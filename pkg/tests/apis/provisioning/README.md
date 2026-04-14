# Provisioning Integration Tests

## Shared Grafana Server Strategy

Each integration test package starts **one Grafana server** shared across all
`TestIntegration*` functions in that package. This replaces the previous pattern
where every test started its own server, which was the main source of slowness.

### How It Works

1. **`common.SharedEnv`** encapsulates `sync.Once`, server init, and `TestMain`
   lifecycle. Each package creates one at the package level.
2. **`GetHelper(t)`** starts the server on the first call and reuses it for all
   subsequent tests. It also handles the integration-mode skip check.
3. **`RunTestMain(m)`** replaces `testsuite.Run(m)` — it sets up the DB, runs
   all tests, shuts down the shared server, and cleans up.
4. Each package defines a thin `sharedHelper(t)` that calls `env.GetHelper(t)`
   and adds package-specific per-test cleanup.

### Key Files

| File | Purpose |
| ---- | ------- |
| `testinfra/testinfra.go` | `StartGrafanaEnvWithManualCleanup` — returns a cleanup func instead of registering on `t.Cleanup` |
| `apis/helper.go` | `NewK8sTestHelperShared` — wraps the manual-cleanup variant |
| `common/testing.go` | `SharedEnv`, `SharedGitEnv`, `ProvisioningTestHelper`, `GitTestHelper`, `CleanupAllResources` |
| `<pkg>/helpers_test.go` | Package-level `env` + `sharedHelper(t)` + `TestMain` |

### Pattern for `helpers_test.go`

```go
var env = common.NewSharedEnv()  // pass GrafanaOptions here if needed

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
    t.Helper()
    helper := env.GetCleanHelper(t)  // cleans all resources, fails test on cleanup error
    helper.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient()
    return helper
}

func TestMain(m *testing.M) {
    env.RunTestMain(m)
}
```

### Git-backed Tests (SharedGitEnv)

Tests that need a real git server use `common.SharedGitEnv` instead of
`common.SharedEnv`. It starts both a Grafana server and a gittest server,
shared across all tests in the package.

`GitTestHelper` embeds `*ProvisioningTestHelper`, so all provisioning
helpers (cleanup, repo creation, REST clients, dashboard/folder clients,
etc.) are available on the git helper.

**When to use which:**

| Environment | Use for |
| ----------- | ------- |
| `SharedEnv` | Local-filesystem repos, GitHub mock repos, general provisioning |
| `SharedGitEnv` | Tests that push/pull against a real git server (sync, export, incremental) |

#### Pattern for git `helpers_test.go`

```go
var env = common.NewSharedGitEnv()  // pass GrafanaOptions here if needed

func sharedGitHelper(t *testing.T) *common.GitTestHelper {
    t.Helper()
    return env.GetCleanHelper(t)
}

func TestMain(m *testing.M) {
    env.RunTestMain(m)
}
```

### Change Per Test

Each test function changes one line:

```diff
 func TestIntegrationProvisioning_Example(t *testing.T) {
-    testutil.SkipIntegrationTestInShortMode(t)
-    helper := common.RunGrafana(t)
+    helper := sharedHelper(t)
     ctx := context.Background()
     // ... rest unchanged ...
 }
```

### Test Isolation

`GetCleanHelper(t)` runs `CleanupAllResources(t, ctx)` at the start of every
test, deleting resources in dependency order (repositories → connections →
dashboards → folders). Cleanup failures are **fatal** to prevent cross-test
contamination — if resources from a prior test can't be cleaned, the current
test fails immediately rather than running against dirty state.

### Enterprise Tests

All enterprise-specific provisioning tests live in the `enterprise/` sibling
package. This keeps enterprise concerns out of the OSS test packages and gives
enterprise tests their own shared server with enterprise-specific options.
Their `sharedHelper` includes the `IsEnterprise` guard:

```go
var env = common.NewSharedEnv(
    common.WithRepositoryTypes([]string{"github", "gitlab", "bitbucket"}),
)

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
    t.Helper()
    if !extensions.IsEnterprise {
        t.Skip("Skipping enterprise integration test")
    }
    return env.GetCleanHelper(t)
}

func TestMain(m *testing.M) {
    env.RunTestMain(m)
}
```

### Parallel Readiness

- `sync.Once` is goroutine-safe, so `t.Parallel()` can be added later.
- For parallel execution: replace per-test cleanup in `sharedHelper` with
  unique resource names and `t.Cleanup` per test instead.
- Tests that mutate shared mocks (e.g. `GithubRepoFactory.Client`) must
  remain sequential or use per-test mock instances.

## The `common` Package

All shared test infrastructure lives in `common/testing.go`:

| Type / Function | Purpose |
| --------------- | ------- |
| `ProvisioningTestHelper` | Wraps `*apis.K8sTestHelper` with provisioning-specific clients (Repositories, Jobs, Folders, DashboardsV1, REST clients) |
| `GitTestHelper` | Embeds `*ProvisioningTestHelper` + gittest.Server; adds git-specific helpers (CreateGitRepo, SyncAndWait, export helpers) |
| `SharedEnv` | Lazily starts one Grafana server per package for non-git tests |
| `SharedGitEnv` | Lazily starts one Grafana + gittest server per package for git tests |
| `RunGrafana(t, opts...)` | Starts a standalone Grafana server for a single test |
| `RunGrafanaWithGitServer(t, opts...)` | Starts a standalone Grafana + git server for a single test |
| `GrafanaOption` | Functional option type (`WithoutProvisioningFolderMetadata`, `WithRepositoryTypes`, etc.) |

## Package Layout

### SharedEnv packages (no git server)

| Package | Env Options |
| ------- | ----------- |
| `provisioning/` (root) | `WithoutProvisioningFolderMetadata`, `SecretsManagerEnableDBMigrations`, `WithoutExportFeatureFlag` |
| `connection/` | none |
| `repository/` | none |
| `quota/` | `WithoutProvisioningFolderMetadata` |
| `jobs/` | `WithoutProvisioningFolderMetadata` (GitHub mock in helper) |
| `jobs/conflict/` | `DisableControllers` — controllers race with manual job updates |
| `jobs/instanceauth/` | none — requires isolated server for instance-scoped RBAC checks |
| `enterprise/` | enterprise repo types (skipped in OSS) |

### SharedGitEnv packages (git server required)

| Package | Env Options |
| ------- | ----------- |
| `git/` | `WithoutProvisioningFolderMetadata` |
| `git/sourcepath_guard/` | `WithoutProvisioningFolderMetadata` |
| `foldermetadata/` | `WithRepositoryTypes(["git","local"])` — mixed-env (see below) |
| `foldermetadata/incremental/` | none |
| `foldermetadata/full/` | `WithoutProvisioningFolderMetadata` |

### Mixed-env package

`foldermetadata/` uses `SharedGitEnv` with `WithRepositoryTypes(["git","local"])`
to support both local-filesystem tests and git-backed tests in a single package.
The `provisioningFolderMetadata` flag is GA and enabled by default, so no explicit
opt-in is needed. The non-git tests use `sharedHelper(t)` (returns
`*ProvisioningTestHelper`), while git-backed tests use `sharedGitHelper(t)`
(returns `*GitTestHelper`). Packages that still rely on the pre-flag behavior use
`WithoutProvisioningFolderMetadata` to explicitly disable it.

## Migration Checklist for Other Packages

1. Create `helpers_test.go` with `common.NewSharedEnv(...)` or `common.NewSharedGitEnv(...)` + helper func + `TestMain`
2. Replace `common.RunGrafana(t)` / `common.RunGrafanaWithGitServer(t)` with the shared helper (one-line change)
3. Remove `testutil.SkipIntegrationTestInShortMode(t)` from each test (handled by `GetHelper`)
4. Add resource cleanup to the helper for the resource types the package uses
5. Move enterprise tests to the `enterprise/` sibling package
6. Verify no assertions depend on global state without prior cleanup
