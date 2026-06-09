# Agent Result

## Root Cause

In `public/app/plugins/datasource/cloud-monitoring/functions.ts`, the `labelsToGroupedOptions` function was building each dropdown option with `label: curr` where `curr` is the full label ID (e.g. `metadata.system_labels.cloud_account`). This caused the Group By dropdown to show the full dotted path instead of just the last segment like the GCM console does.

The function already split the label by `.` and applied `startCase` to each segment (stored in `arr`), but only used that array to compute the group header - not the individual option label.

## Change Made

**`public/app/plugins/datasource/cloud-monitoring/functions.ts` - `labelsToGroupedOptions`**

Changed the option label from `label: curr` (full ID) to `label: arr[arr.length - 1]` (last segment with startCase applied). For example, `metadata.system_labels.cloud_account` now displays as `Cloud Account` in the dropdown, while its stored value remains the full ID. The grouping header (e.g. `Metadata System Labels`) is unchanged.

Updated tests in:
- `functions.test.ts` - updated `labelsToGroupedOptions` test expectations to match new short labels, and added a test case covering a 3-segment label like `metadata.system_labels.cloud_account`.
- `components/GroupBy.test.tsx` - updated the "can select a group by" test to look for the displayed label `Cloud Account` while still asserting the full value `metadata.system_labels.cloud_account` is passed to `onChange`.

## Testing

Ran the relevant test suites using the plugin's local jest config:

```
Test Suites: 2 passed, 2 total
Tests:       21 passed, 21 total
```

Both `functions.test.ts` and `components/GroupBy.test.tsx` pass.

## Lint

Lint was not run (frontend-only change, no Go files modified). The change is a one-line TypeScript edit with no new imports or style deviations.
