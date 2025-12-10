# Dashboard Conversion Error Handling Fix

## Summary

Fix conversion error handling to properly report metrics and logs by standardizing all conversion functions to return errors instead of swallowing them.

## Problem

### Root Cause

Two different error handling patterns existed in the codebase:

**Pattern A (Correct)** - Used in some functions like `Convert_V0_to_V1beta1`:

```go
if err := ConvertDashboard_V0_to_V1beta1(...); err != nil {
    out.Status.Conversion.Failed = true
    out.Status.Conversion.Error = err.Error()
    return err  // Returns error for metrics/logging
}
```

**Pattern B (Incorrect)** - Used in functions like `Convert_V2beta1_to_V0`:

```go
if err := Convert_V2beta1_to_V1beta1(...); err != nil {
    out.Status.Conversion.Failed = true
    out.Status.Conversion.Error = err.Error()
    return nil  // Swallows error, metrics/logs never see it
}
```

### Impact

When Pattern B swallowed errors:

1. `withConversionMetrics` received `err = nil`
2. It assumed conversion succeeded
3. It ran `checkConversionDataLoss()` on a partially converted dashboard
4. The target dashboard had empty/nil `Spec.Object` (because conversion failed internally)
5. Data loss was detected (comparing source panels vs target's zero panels)
6. Result: False `conversion_data_loss_error` metrics instead of actual conversion errors

### Symptoms in Production

- Success metrics stopped being reported around December 3rd
- `conversion_data_loss_error` metrics increased unexpectedly
- Real conversion errors were hidden
- No error logs appeared for conversion failures

### Affected Conversion Paths

- `v2beta1 -> v0alpha1`
- `v2beta1 -> v1beta1`
- `v2alpha1 -> v0alpha1`
- `v2alpha1 -> v1beta1`
- `v1beta1 -> v2alpha1`
- `v0alpha1 -> v2alpha1`

## Solution

### Changes Made

1. **Standardized on Pattern A**: Changed all conversion functions to return errors properly
2. **Simplified metrics.go**: Removed the `isConversionStatusFailed` helper function
3. **Maintained API stability**: `withConversionMetrics` still returns `nil` to avoid 500 errors

### Files Modified

| File | Changes |
|------|---------|
| `v0.go` | Fixed `Convert_V0_to_V2alpha1` to return errors |
| `v1.go` | Fixed `Convert_V1beta1_to_V2alpha1` to return errors |
| `v2.go` | Fixed `Convert_V2alpha1_to_V0`, `Convert_V2alpha1_to_V1beta1`, `Convert_V2beta1_to_V0`, `Convert_V2beta1_to_V1beta1` |
| `metrics.go` | Removed `isConversionStatusFailed` helper, simplified logic |
| `v0_test.go` | Updated tests to expect errors |

### Code Flow After Fix

```
withConversionMetrics
│
├─> err := conversionFunc(a, b, scope)
│   └─> Now returns actual error (Pattern A)
│
├─> if err == nil:
│   └─> checkConversionDataLoss()  // Only on success
│
├─> if err != nil:
│   ├─> Record FAILURE metric
│   └─> Log ERROR with details
│
├─> else:
│   └─> Record SUCCESS metric
│
└─> return nil  // Always, to avoid 500 errors
```

## Expected Metric Changes

### Failure Metrics by Error Type

| Error Type | Before | After | Reason |
|------------|--------|-------|--------|
| `conversion_error` | Low/Zero | **Increase** | Previously hidden errors now visible |
| `schema_version_migration_error` | Normal | Same | Already worked correctly |
| `schema_minimum_version_error` | Normal | Same | Already worked correctly |
| `conversion_data_loss_error` | **Inflated** | **Decrease** | False positives eliminated |

### Success Metrics

| Metric | Before | After | Reason |
|--------|--------|-------|--------|
| Success count | **Artificially low** | **Increase** | Real successes no longer masked by false data loss |

### Summary Table

| Scenario | Data Loss Check | Metric Recorded |
|----------|-----------------|-----------------|
| Conversion fails | Skipped | `conversion_failure_total` (type: `conversion_error`) |
| Conversion succeeds, data loss detected | Runs | `conversion_failure_total` (type: `conversion_data_loss_error`) |
| Conversion succeeds, no data loss | Runs | `conversion_success_total` |

## Log Output

After the fix, error logs will appear for all conversion failures:

```json
{
  "level": "error",
  "msg": "Dashboard conversion failed",
  "logger": "dashboard.conversion",
  "sourceVersionAPI": "dashboard.grafana.app/v2beta1",
  "targetVersionAPI": "dashboard.grafana.app/v0alpha1",
  "erroredConversionFunc": "Convert_V2beta1_to_V1beta1",
  "dashboardUID": "abc123xyz",
  "errorType": "conversion_error",
  "error": "schema migration from version 0 to 42 failed: ..."
}
```

## Observability Queries

### Prometheus Queries

```promql
# Conversion errors by type
sum by (error_type) (
  rate(grafana_dashboard_conversion_failure_total[5m])
)

# Conversion success rate by path
sum by (source_version, target_version) (
  rate(grafana_dashboard_conversion_success_total[5m])
)
/
(
  sum by (source_version, target_version) (
    rate(grafana_dashboard_conversion_success_total[5m])
  )
  +
  sum by (source_version, target_version) (
    rate(grafana_dashboard_conversion_failure_total[5m])
  )
)

# Real data loss detection
rate(grafana_dashboard_conversion_failure_total{error_type="conversion_data_loss_error"}[5m])
```

### Loki Queries

```logql
# All conversion errors
{app="grafana"} |= "Dashboard conversion failed"

# Specific conversion path errors
{app="grafana"} |= "Dashboard conversion failed" | json | sourceVersionAPI="dashboard.grafana.app/v2beta1" | targetVersionAPI="dashboard.grafana.app/v0alpha1"

# By error type
{app="grafana"} |= "Dashboard conversion failed" | json | errorType="conversion_error"
```

## Testing

Run conversion tests:

```bash
go test ./apps/dashboard/pkg/migration/conversion/...
```

## API Behavior

No change to API behavior:
- Conversion errors do NOT cause 500 errors
- `withConversionMetrics` always returns `nil` to the API server
- `Status.Conversion.Failed` is still set on the dashboard object for client inspection

## Additional Fixes: Conversion Consistency

During the investigation, several other inconsistencies were found and fixed:

### 1. Missing Success Status

Some conversion functions did not set `Status.Conversion` on successful conversion, making it impossible for clients to verify the conversion succeeded.

| Function | Before | After |
|----------|--------|-------|
| `Convert_V0_to_V1beta1` | No success status | Sets `Failed: false, StoredVersion: v0alpha1` |
| `Convert_V0_to_V2alpha1` | No success status | Sets `Failed: false, StoredVersion: v0alpha1` |
| `Convert_V0_to_V2beta1` | No success status | Sets `Failed: false, StoredVersion: v0alpha1` |
| `Convert_V1beta1_to_V2alpha1` | No success status | Sets `Failed: false, StoredVersion: v1beta1` |
| `Convert_V1beta1_to_V2beta1` | No success status | Sets `Failed: false, StoredVersion: v1beta1` |

### 2. Missing ObjectMeta/APIVersion/Kind on Error

Some conversion functions did not set `ObjectMeta`, `APIVersion`, and `Kind` on the target when conversion failed, resulting in incomplete error responses.

Fixed in:
- `Convert_V0_to_V1beta1`
- `Convert_V0_to_V2alpha1`
- `Convert_V0_to_V2beta1`
- `Convert_V1beta1_to_V2alpha1`
- `Convert_V1beta1_to_V2beta1`

### 3. Missing Layout Default on Error for v2beta1 Targets

Functions targeting `v2alpha1` had protection against JSON marshaling issues by setting a default `GridLayout` on error. Functions targeting `v2beta1` did not have this protection.

| Function | Before | After |
|----------|--------|-------|
| `Convert_V0_to_V2beta1` | No layout default on error | Sets default `GridLayout` |
| `Convert_V1beta1_to_V2beta1` | No layout default on error | Sets default `GridLayout` |

This prevents JSON marshaling errors when conversion fails.

### Summary of All Files Modified

| File | Error Handling Fix | Consistency Fix |
|------|-------------------|-----------------|
| `v0.go` | Return errors instead of nil | Added success status, ObjectMeta on error, layout default for v2beta1 |
| `v1.go` | Return errors instead of nil | Added success status, ObjectMeta on error, layout default for v2beta1 |
| `v2.go` | Return errors instead of nil | Already had success status and ObjectMeta |
| `metrics.go` | Removed `isConversionStatusFailed` helper | - |
| `v0_test.go` | Updated tests to expect errors | - |
| `v1_test.go` | - | Updated tests to expect success status |
| `testdata/*` | - | Regenerated fixtures with success status |
