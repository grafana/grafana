# Provisioning API Authorization Test Coverage Analysis

This document analyzes test coverage for all authorization paths in the provisioning API.

## Authorization Matrix

| Resource | Subresource | Verb | Fallback Role | Test File | Test Function | Coverage Status |
|----------|-------------|------|---------------|-----------|---------------|-----------------|
| **Repositories** | (CRUD) | create | Admin | `repository_test.go` | `TestIntegrationProvisioning_CreatingAndGetting` | ✅ Tested (viewer denied) |
| Repositories | (CRUD) | read | Admin | `repository_test.go` | `TestIntegrationProvisioning_CreatingAndGetting` | ✅ Tested (viewer denied) |
| Repositories | (CRUD) | update | Admin | `repository_test.go` | Various | ✅ Tested (implicitly) |
| Repositories | (CRUD) | delete | Admin | `repository_test.go` | `TestIntegrationProvisioning_DeleteRepositoryAndReleaseResources` | ✅ Tested |
| Repositories | test | POST | Admin | `repository_subresources_auth_test.go` | `TestIntegrationProvisioning_RepositorySubresourcesAuthorization` | ✅ Tested (admin allowed, editor/viewer denied) |
| Repositories | files | GET | Any auth (route) | `files_test.go` | `TestIntegrationProvisioning_FilesAuthorization` | ✅ Tested (viewer/editor/admin) |
| Repositories | files | POST | Any auth (route) | `files_test.go` | `TestIntegrationProvisioning_FilesAuthorization` | ✅ Tested (viewer/editor/admin) |
| Repositories | files | PUT | Any auth (route) | `files_test.go` | `TestIntegrationProvisioning_FilesAuthorization` | ✅ Tested (viewer/editor/admin) |
| Repositories | files | DELETE | Any auth (route) | `files_test.go` | `TestIntegrationProvisioning_FilesAuthorization` | ✅ Tested (viewer/editor/admin) |
| Repositories | refs | GET | Editor | `repository_test.go` | `TestIntegrationProvisioning_RefsPermissions` | ✅ Tested (editor allowed, viewer denied) |
| Repositories | resources | GET | Admin | `repository_subresources_auth_test.go` | `TestIntegrationProvisioning_RepositorySubresourcesAuthorization` | ✅ Tested (admin allowed, editor/viewer denied) |
| Repositories | history | GET | Admin | `repository_subresources_auth_test.go` | `TestIntegrationProvisioning_RepositorySubresourcesAuthorization` | ✅ Tested (admin allowed, editor/viewer denied) |
| Repositories | status | GET | Admin | `repository_subresources_auth_test.go` | `TestIntegrationProvisioning_RepositorySubresourcesAuthorization` | ✅ Tested (admin allowed, editor/viewer denied) |
| Repositories | jobs | POST | Editor | `repository_test.go` | `TestIntegrationProvisioning_JobPermissions` | ✅ Tested (editor allowed, viewer denied) |
| Repositories | jobs | GET | Editor | `repository_test.go` | `TestIntegrationProvisioning_JobPermissions` | ✅ Tested (implicitly) |
| **Connections** | (CRUD) | create | Admin | `connection_test.go` | `TestIntegrationProvisioning_ConnectionCRUDL` | ✅ Tested (viewer denied) |
| Connections | (CRUD) | read | Admin | `connection_test.go` | `TestIntegrationProvisioning_ConnectionCRUDL` | ✅ Tested (viewer denied) |
| Connections | (CRUD) | update | Admin | `connection_test.go` | `TestIntegrationProvisioning_ConnectionCRUDL` | ✅ Tested |
| Connections | (CRUD) | delete | Admin | `connection_test.go` | `TestIntegrationProvisioning_ConnectionCRUDL` | ✅ Tested |
| Connections | status | GET | Admin | `connection_status_auth_test.go` | `TestIntegrationProvisioning_ConnectionStatusAuthorization` | ✅ Tested (admin allowed, editor/viewer denied) |
| **Jobs** | (CRUD) | create | Editor | `repository_test.go` | `TestIntegrationProvisioning_JobPermissions` | ✅ Tested (editor allowed, viewer denied) |
| Jobs | (CRUD) | read | Editor | Various job tests | Various | ✅ Tested (implicitly) |
| Jobs | (CRUD) | update | Editor | Various job tests | Various | ✅ Tested (implicitly) |
| Jobs | (CRUD) | delete | Editor | `deletejob_test.go` | Various | ✅ Tested (implicitly) |
| **HistoricJobs** | - | GET | Admin | `historicjobs_auth_test.go` | `TestIntegrationProvisioning_HistoricJobsAuthorization` | ✅ Tested (admin allowed, editor/viewer denied) |
| **Settings** | - | GET | Viewer | `settings_stats_auth_test.go` | `TestIntegrationProvisioning_SettingsAuthorization` | ✅ Tested (viewer/editor/admin all allowed) |
| **Stats** | - | GET | Admin | `settings_stats_auth_test.go` | `TestIntegrationProvisioning_StatsAuthorization` | ✅ Tested (admin allowed, editor/viewer denied) |

## Test Coverage Status

✅ **All authorization paths are now covered by tests!**

### Recently Added Tests

1. **Repositories/test subresource** (POST) - ✅ Added in `repository_subresources_auth_test.go`
2. **Repositories/resources subresource** (GET) - ✅ Added in `repository_subresources_auth_test.go`
3. **Repositories/history subresource** (GET) - ✅ Added in `repository_subresources_auth_test.go`
4. **Repositories/status subresource** (GET) - ✅ Added in `repository_subresources_auth_test.go`
5. **Connections/status subresource** (GET) - ✅ Added in `connection_status_auth_test.go`
6. **HistoricJobs resource** (GET) - ✅ Added in `historicjobs_auth_test.go`
7. **Settings resource** (GET) - ✅ Completed in `settings_stats_auth_test.go`
8. **Stats resource** (GET) - ✅ Completed in `settings_stats_auth_test.go`

## Test Patterns

### Successful Authorization Test Pattern
```go
t.Run("editor can GET refs", func(t *testing.T) {
    var statusCode int
    result := helper.EditorREST.Get().
        Namespace("default").
        Resource("repositories").
        Name(repo).
        SubResource("refs").
        Do(ctx).StatusCode(&statusCode)
    
    require.NoError(t, result.Error(), "editor should be able to GET refs")
    require.Equal(t, http.StatusOK, statusCode, "should return 200 OK")
})
```

### Denied Authorization Test Pattern
```go
t.Run("viewer cannot GET refs", func(t *testing.T) {
    var statusCode int
    result := helper.ViewerREST.Get().
        Namespace("default").
        Resource("repositories").
        Name(repo).
        SubResource("refs").
        Do(ctx).StatusCode(&statusCode)
    
    require.Error(t, result.Error(), "viewer should not be able to GET refs")
    require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
    require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
})
```

## Test Files

- `repository_subresources_auth_test.go` - Tests for test, resources, history, status subresources
- `connection_status_auth_test.go` - Tests for connection status subresource
- `historicjobs_auth_test.go` - Tests for HistoricJobs resource
- `settings_stats_auth_test.go` - Tests for Settings and Stats resources
- `repository_test.go` - Tests for repository CRUD, refs, jobs
- `connection_test.go` - Tests for connection CRUD
- `files_test.go` - Tests for files subresource authorization

## Notes

- Files subresource authorization is tested at the route level (any authenticated user) and at the resource level (via DualReadWriter)
- Jobs subresource is well covered with explicit editor/viewer/admin tests
- Repository CRUD operations are covered with viewer denial tests
- Connection CRUD operations are covered with viewer denial tests

