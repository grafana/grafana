# Malformed Dashboard JSON Fix

## Problem

Dashboards with empty string keys (`""`) in panel objects cause JSON parsing errors during search indexing:

```
ReadArray: expect [ or , or ] or n, but found {, error found in #10 byte of ...
```

Example malformed panel:
```json
{
  "": {"type":"prometheus","uid":"grafanacloud-prom"},
  "description":"...",
  "title":"..."
}
```

Should be:
```json
{
  "datasource": {"type":"prometheus","uid":"grafanacloud-prom"},
  "description":"...",
  "title":"..."
}
```

## Fix Applied

Added error checking in dashboard JSON parsing to handle malformed data gracefully:

1. `pkg/services/store/kind/dashboard/dashboard.go`:
   - Added error checks in `readDashboardIter()` after each `ReadObject()` call
   - Added error checks in `readpanelInfo()` after each `ReadObject()` call

2. `pkg/services/store/kind/dashboard/targets.go`:
   - Added error checks in `addTarget()` after each `ReadObject()` call

3. Added test case `TestReadDashboardWithMalformedJSON` to verify error handling

## Impact

- Search indexing will now log errors for malformed dashboards and skip them instead of failing
- Other valid dashboards will continue to be indexed
- The parser won't panic or hang on malformed JSON

## Next Steps

### 1. Identify Affected Dashboards

Query the database to find dashboards with empty string keys:

```sql
-- For PostgreSQL
SELECT id, uid, org_id, title, created, updated
FROM dashboard
WHERE data::text LIKE '%"": {%';

-- For MySQL
SELECT id, uid, org_id, title, created, updated
FROM dashboard
WHERE data LIKE '%"": {%';
```

### 2. Fix Affected Dashboards

Create a migration script to fix the malformed JSON. The empty string keys are likely meant to be `"datasource"` fields.

### 3. Add Validation

Add validation in the dashboard save/update API to prevent empty string keys:

- Validate dashboard JSON before saving
- Reject dashboards with empty string keys
- Return clear error messages to users

### 4. Investigate Root Cause

Determine how these malformed dashboards are being created:

- Check dashboard import logic
- Check dashboard provisioning logic
- Check dashboard API endpoints
- Check frontend dashboard editor
- Review recent changes to dashboard serialization

## Testing

Run the test to verify the fix:

```bash
go test -v ./pkg/services/store/kind/dashboard -run TestReadDashboardWithMalformedJSON
```

Run all dashboard tests:

```bash
go test -v ./pkg/services/store/kind/dashboard
```

## Related Files

- `pkg/services/store/kind/dashboard/dashboard.go` - Main parsing logic
- `pkg/services/store/kind/dashboard/targets.go` - Target parsing logic
- `pkg/services/store/kind/dashboard/dashboard_test.go` - Tests
- `pkg/storage/unified/search/dashboard.go` - Search document builder
- `pkg/storage/unified/resource/search.go` - Search indexing

