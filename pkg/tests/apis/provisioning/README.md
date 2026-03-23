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
|------|---------|
| `testinfra/testinfra.go` | `StartGrafanaEnvWithManualCleanup` — returns a cleanup func instead of registering on `t.Cleanup` |
| `apis/helper.go` | `NewK8sTestHelperShared` — wraps the manual-cleanup variant |
| `common/testing.go` | `SharedEnv`, `RunGrafanaShared`, cleanup helpers (`CleanupConnections`, `CleanupAllResources`, etc.) |
| `<pkg>/helpers_test.go` | Package-level `env` + `sharedHelper(t)` + `TestMain` |

### Pattern for `helpers_test.go`

```go
var env = common.NewSharedEnv()  // pass GrafanaOptions here if needed

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
    t.Helper()
    helper := env.GetHelper(t)

    // Per-test cleanup — reset state so tests don't interfere
    helper.CleanupConnections(context.Background())
    helper.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient()
    return helper
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

`sharedHelper(t)` runs at the start of every test and performs cleanup.
Available cleanup methods on `ProvisioningTestHelper`:

- `CleanupConnections(ctx)` — deletes all connections
- `CleanupRepositories(ctx)` — deletes all repositories
- `CleanupFolders(ctx)` — deletes all folders
- `CleanupDashboards(ctx)` — deletes all dashboards
- `CleanupAllResources(ctx)` — all of the above in dependency order

Pick the ones relevant to your package's resource types.

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
    helper := env.GetHelper(t)
    helper.CleanupConnections(context.Background())
    return helper
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

## Migration Checklist for Other Packages

1. Create `helpers_test.go` with `common.NewSharedEnv(...)` + `sharedHelper` + `TestMain`
2. Replace `common.RunGrafana(t)` with `sharedHelper(t)` in each test (one-line change)
3. Remove `testutil.SkipIntegrationTestInShortMode(t)` from each test (handled by `GetHelper`)
4. Add resource cleanup to `sharedHelper` for the resource types the package uses
5. Move enterprise tests to the `enterprise/` sibling package
6. Verify no assertions depend on global state without prior cleanup
