# One Click Filter Implementation for Bar Charts

## Overview

This implementation adds One Click filtering functionality to bar charts when no data links are configured. When a user clicks on a bar, it will immediately apply an ad-hoc filter for that value instead of requiring them to pin the tooltip and click a filter button.

## How It Works

### Decision Logic
When a user clicks on a bar in the bar chart:

1. **Check for One Click data links**: If any data link has `oneClick: true`, open that link (existing behavior)
2. **Check for any data links**: If there are no data links at all AND filtering is available, trigger immediate filtering  
3. **Fallback**: Pin the tooltip (existing behavior)

### Implementation Details

#### TooltipPlugin2 Changes
- Added `onAddAdHocFilter?: OnAddAdHocFilterCallback` prop for filter callback
- Added `getFilterInfo?: GetFilterInfoCallback` prop to extract field name and value for filtering
- Modified click handler to support One Click filtering when `dataLinks.length === 0`

#### BarChartPanel Changes
- Pass `onAddAdHocFilter` from panel context to TooltipPlugin2
- Implement `getFilterInfo` callback that extracts:
  - `key`: X-axis field name (e.g., "category", "time")
  - `value`: The actual value at the clicked data point

### Code Flow

```typescript
// In click handler (TooltipPlugin2.tsx)
if (oneClickLink != null) {
  // Existing: Open One Click data link
  window.open(oneClickLink.href, oneClickLink.target ?? '_self');
} else if (dataLinks.length === 0 && onAddAdHocFilter && getFilterInfo) {
  // NEW: One Click filtering when no data links
  const filterInfo = getFilterInfo(closestSeriesIdx, seriesIdxs[closestSeriesIdx]!);
  if (filterInfo) {
    onAddAdHocFilter({
      key: filterInfo.key,
      value: filterInfo.value,
      operator: FILTER_FOR_OPERATOR, // '='
    });
  }
} else {
  // Existing: Pin tooltip
  setTimeout(() => {
    _isPinned = true;
    scheduleRender(true);
  }, 0);
}
```

## Usage

### When One Click Filtering Activates
- No data links are configured on the field
- Ad-hoc filter functionality is available (dashboard has ad-hoc filter variables)
- User clicks directly on a bar (not just hovering)

### User Experience
1. **Hover**: Shows tooltip with "Filter for value" button
2. **Click**: Immediately applies filter `fieldName = clickedValue` to dashboard
3. **Result**: Dashboard updates to show only data matching the clicked value

### Backward Compatibility
- Existing One Click data links continue to work unchanged
- When data links exist, filtering does not activate (user must pin tooltip and click filter button)
- No changes to existing tooltip behavior when data links are present

## Benefits

- **Faster workflows**: Single click to filter instead of hover → pin → click button
- **Intuitive UX**: Clicking on data to filter is a natural interaction
- **Consistent with other panels**: Similar to how other Grafana visualizations handle filtering
- **Opt-in behavior**: Only activates when no data links are configured

## Files Modified

1. `packages/grafana-ui/src/components/uPlot/plugins/TooltipPlugin2.tsx`
   - Added filter support props and logic

2. `public/app/plugins/panel/barchart/BarChartPanel.tsx`
   - Pass filter props to TooltipPlugin2

3. `packages/grafana-ui/src/components/uPlot/plugins/TooltipPlugin2.test.tsx` (new)
   - Unit tests for the new functionality 
