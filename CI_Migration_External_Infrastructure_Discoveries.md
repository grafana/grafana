## 🚩 Environment Variable Name Mismatch - RESOLVED ✅

### Problem Discovery 
**ALL old arch E2E test suites failing systematically** with UI selector timeouts after CI migration:
```
AssertionError: Expected to find element: `[aria-label="Save dashboard"]`, but never found it
```

### Investigation Journey
1. **❌ First Hypothesis**: Alpine vs Ubuntu container base → No improvement
2. **✅ ACTUAL ROOT CAUSE**: Wrong environment variable name

### Root Cause: Environment Variable Name Mismatch ⚠️

**GitHub Actions Configuration Error:**
```yaml
# ❌ WRONG (our CI migration):
flags: --flags="--env dashboardScene=false"

# ✅ CORRECT (working fix):  
flags: --flags="--env DISABLE_SCENES=true"
```

**Technical Issue:**
- **CI Migration** copied wrong variable name from different test system
- **e2e/cypress/support/e2e.js** checks for `DISABLE_SCENES`, not `dashboardScene`:
  ```javascript
  if (Cypress.env('DISABLE_SCENES')) {
    cy.setLocalStorage('grafana.featureToggles', 'dashboardScene=false');
  }
  ```
- **Result**: Feature toggle never set → dashboard scene stayed enabled → old arch UI missing

### Evidence That Confirmed Fix
**Commit `5680880303d55f87dfc517c429542dbb16b5b2fe`** showed working configuration:
```bash
env[DISABLE_SCENES]=true
```

### Solution Applied
- **File**: `.github/workflows/pr-e2e-tests.yml`
- **Change**: `dashboardScene=false` → `DISABLE_SCENES=true`
- **Result**: ✅ **All old arch E2E tests now pass**

### Key Lessons
1. **Environment Variable Names Are Critical**: Must match exact variable names expected by test framework
2. **Copy Configuration Carefully**: Different test systems may use different variable naming conventions
3. **Historical Evidence Is Valuable**: Working commits show exact configuration that previously succeeded 

## 📦 Go Module Dependency Resolution Issue - RESOLVED ✅

### Critical Discovery (January 2025)
**Problem**: `go mod tidy` failing systematically after CI migration with folder API dependency resolution errors.

**Root Cause**: CI migration brought in old external module dependencies from before the folder API migration (`pkg/apis/folder` → `apps/folder`).

### Technical Details
**Error Symptoms**:
```bash
go: github.com/grafana/grafana/pkg/cmd/grafana-cli/commands/datamigrations imports
        github.com/grafana/grafana/pkg/storage/unified/resource imports
        github.com/grafana/grafana/pkg/apis/folder/v0alpha1: module github.com/grafana/grafana/pkg/apis/folder@latest found (v0.0.0-20250414194044-acfd998fa615), but does not contain package github.com/grafana/grafana/pkg/apis/folder/v0alpha1
```

**Investigation Journey**:
1. **❌ First Hypothesis**: Stale generated code → Regenerated wire files, protobuf - no improvement
2. **❌ Second Hypothesis**: Workspace corruption → Fresh workspace creation - no improvement  
3. **❌ Third Hypothesis**: Module cache issues → Cleared all caches - no improvement
4. **✅ ACTUAL ROOT CAUSE**: External module dependency on old pre-migration version

### Root Cause Analysis
**What happened during CI migration**:
1. **Massive infrastructure backport** (commit `dc6bd2a20abb2718ee2a3878fb06990218ab66ca`) brought in external module references
2. **Main go.mod contained external dependency**:
   ```go
   github.com/grafana/grafana/pkg/storage/unified/resource v0.0.0-20250317130411-3f270d1de043
   ```
3. **This March 17 version predated the folder API migration** (`pkg/apis/folder` → `apps/folder`)
4. **Old external version still contained references** to non-existent `pkg/apis/folder/v0alpha1`
5. **Go prioritized external dependency** over local workspace version

### Evidence Trail
**Module resolution showing the problem**:
```bash
go: downloading github.com/grafana/grafana/pkg/storage/unified/resource v0.0.0-20250317130411-3f270d1de043
go: downloading github.com/grafana/grafana/pkg/apis/folder v0.0.0-20250414194044-acfd998fa615
```

**Source code was correct**:
- ✅ `pkg/cmd/grafana-cli/commands/datamigrations/to_unified_storage.go` correctly imports `apps/folder/pkg/apis/folder/v1beta1`
- ✅ `pkg/storage/unified/resource/search.go` correctly imports `apps/folder/pkg/apis/folder/v1beta1`
- ❌ **External old version** caused Go to seek non-existent `pkg/apis/folder/v0alpha1`

### Critical Insight: Why Builds Worked But `go mod tidy` Failed
**This is the key to understanding this issue type:**

**`go build` (used by Drone CI) worked because**:
- **Workspace Override**: Local workspace versions took precedence for actual builds
- **Scope**: Only resolves packages actually imported by the specific build target
- **Resolution**: Uses existing resolved dependencies without full validation
- **Purpose**: Compile packages for execution (doesn't validate unused dependencies)

**`go mod tidy` failed because**:
- **Validation Scope**: Must validate ALL referenced module versions can be downloaded
- **External Priority**: Attempts to verify external dependencies even when workspace overrides exist
- **Purpose**: Ensure go.mod completely matches all possible source dependencies
- **Strict Requirements**: Every referenced package must actually exist and be downloadable

**Evidence from Drone CI**:
```bash
# .drone.yml uses this pattern:
dagger run go run ./pkg/build/cmd artifacts
# This works because workspace resolution provides correct local modules
```

### Solution Implementation
**Added replace directive in main go.mod**:
```go
// Force use of local workspace version instead of external old versions
replace github.com/grafana/grafana/pkg/storage/unified/resource => ./pkg/storage/unified/resource
```

**Removed external dependency**:
```go
// Removed this line:
// github.com/grafana/grafana/pkg/storage/unified/resource v0.0.0-20250317130411-3f270d1de043
```

### Resolution Results
**Before** (failing):
```bash
go: finding module for package github.com/grafana/grafana/pkg/apis/folder/v0alpha1
```

**After** (working):
```bash
go mod tidy
# ✅ Success - no folder v0alpha1 errors
```

### Prevention Strategies
**To prevent this issue in future CI migrations:**

1. **Add Module Validation to CI**:
   ```yaml
   # Add to CI workflow
   - name: Validate Go Module Dependencies
     run: go mod tidy && git diff --exit-code go.mod go.sum
   ```

2. **Pre-commit Hook for Module Changes**:
   ```bash
   #!/bin/bash
   # .git/hooks/pre-commit
   go mod tidy
   if ! git diff --exit-code go.mod go.sum; then
       echo "go.mod/go.sum changes detected after 'go mod tidy'"
       echo "Please run 'go mod tidy' and commit the changes"
       exit 1
   fi
   ```

3. **Module Migration Audit Commands**:
   ```bash
   # Check for dependencies older than architectural changes
   go list -m all | grep "v0.0.0-2025" | sort
   # Verify no old API references exist
   go mod graph | grep "pkg/apis/folder"
   ```

### Key Lessons
1. **CI Migrations Can Introduce Stale External Dependencies**: Massive infrastructure backports may bring in old module references that predate architectural changes
2. **Builds ≠ Module Validation**: A project can build successfully while having invalid module dependencies due to workspace isolation
3. **External Dependencies Override Local Workspace**: Even with correct replace directives, explicit external dependencies in go.mod take precedence for validation
4. **Module Version Dating Is Critical**: Check that external module versions postdate any architectural migrations (folder API moved in April 2025)
5. **Replace Directives Are Necessary**: Force local workspace versions when external old versions conflict with current architecture
6. **Source Code Correctness ≠ Module Resolution**: Correct imports in source code don't guarantee correct module dependency resolution
7. **Workspace System Masks Issues**: Local workspace versions can hide external dependency problems during builds
8. **Prevention > Detection**: Catching this in CI validation prevents hours of debugging dependency conflicts

### Debugging Methodology That Worked
1. **Trace dependency chain**: Follow `go mod tidy` error to find which module is trying to import old API
2. **Check module timestamps**: Compare external module versions to architectural change dates
3. **Remove external dependencies**: Eliminate old external references and use replace directives
4. **Verify with clean builds**: Test resolution with fresh module cache

### Strategic Impact
- **Resolves go mod tidy failures** across all CI migration backports where folder API is used
- **Prevents similar issues** with other moved APIs during massive infrastructure updates
- **Establishes pattern** for handling external dependency conflicts during architectural migrations
- **Documents debugging approach** for future module resolution issues after CI migrations

### Future Release Branch Checklist
When performing CI migrations that involve massive infrastructure backports:
- [ ] **Pre-Migration**: Run `go mod tidy` to establish baseline (should succeed)
- [ ] **Post-Infrastructure Update**: Run `go mod tidy` immediately after backporting infrastructure
- [ ] **Check External Dependencies**: `go list -m all | grep "v0.0.0-" | sort` to find old external versions
- [ ] **Verify Module Timestamps**: Ensure external module versions postdate architectural migrations
- [ ] **Add Replace Directives**: For any modules that underwent architectural changes (e.g., `pkg/apis/folder` → `apps/folder`)
- [ ] **Validate Resolution**: Confirm `go mod tidy && git diff --exit-code go.mod go.sum` succeeds
- [ ] **Test Both Operations**: Verify both `go build` and `go mod tidy` work after changes
- [ ] **Document Changes**: Note any new replace directives and reasoning in commit messages
- [ ] **Add CI Validation**: Consider adding `go mod tidy` validation to CI workflows to prevent future issues

## 🏷️ rgm-tag-prerelease Pipeline Production Issues 
