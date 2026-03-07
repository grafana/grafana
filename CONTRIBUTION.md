# Contribution: Pie Chart Keyboard Focus Indicator Fix

## Issue
**Issue #114227**: Keyboard focus indicator is not visible on data links in Pie Chart visualization

When keyboard users navigate through a Pie Chart panel using the Tab key, data links (clickable links on chart segments) do not show a visible focus indicator. This makes it impossible for keyboard-only users to know which element is currently focused, reducing navigation clarity and accessibility.

## Problem Analysis

### Root Cause
1. Pie chart slices with data links are rendered as SVG `<g>` elements
2. These elements are not naturally keyboard focusable (SVG elements need `tabIndex` to be focusable)
3. No focus event handlers were attached to trigger visual feedback
4. No keyboard activation support (Enter/Space keys)

### Two Rendering Cases
- **Single link case**: `DataLinksContextMenu` wraps the slice in an `<a>` tag
- **Multiple links case**: `DataLinksContextMenu` provides an `openMenu` function via render prop

## Solution Approach

### 1. Data Link Detection
- Check for data links using `arc.data.hasLinks` and `arc.data.getLinks`
- Determine if slice should be focusable based on presence of links

### 2. Keyboard Accessibility
- Added `tabIndex={0}` for slices with data links (multiple links case)
- Added `tabIndex={-1}` for slices wrapped in `<a>` tag (single link case) to prevent double focus
- Added `role="link"` and `aria-label` for proper screen reader support

### 3. Focus Indicator
- Leveraged Grafana's existing `DataHoverEvent` system for highlighting
- On focus, publish `DataHoverEvent` to trigger the same visual highlight as mouse hover
- On blur, publish `DataHoverClearEvent` to clear the highlight
- Used a small delay on blur to prevent flickering during focus transitions

### 4. Keyboard Activation
- Added `handleKeyDown` to handle Enter key presses
- For multiple links: Create synthetic mouse event and call `openMenu` directly
- For single link: Dispatch native click event to trigger the `<a>` tag's default behavior

### 5. Single Link Case Handling
- Detected when slice is wrapped in `<a>` tag (when `openMenu` is undefined)
- Attached focus/blur event listeners to the parent `<a>` tag
- Ensured inner `<g>` element has `tabIndex={-1}` to prevent tab order conflicts
- Ensured `<a>` tag is properly focusable (remove any `tabIndex="-1"` if present)

### 6. Tab Order Optimization
- Sorted slices with data links first in the DOM to ensure proper tab order
- This ensures keyboard users reach interactive elements before non-interactive ones

## Implementation Details

### Key Changes in `PieChart.tsx`

1. **Imports**: Added `useRef` and `useEffect` from React

2. **SliceProps Interface**: Added `outerRadius` and `innerRadius` props to calculate click coordinates

3. **PieSlice Component**:
   - Added `elementRef` and `blurTimeoutRef` for DOM manipulation and blur handling
   - Detected data links: `hasDataLinksDirect` and `hasDataLinks`
   - Determined focusability: `shouldBeFocusable` (true only for multiple links case)
   - Added `useEffect` hook to handle single link case (`<a>` tag focus/blur)
   - Added `handleFocus` callback to publish `DataHoverEvent` on focus
   - Added `handleBlur` callback to publish `DataHoverClearEvent` on blur (with delay)
   - Added `handleKeyDown` callback to handle Enter key activation
   - Updated `<g>` element with accessibility attributes:
     - `tabIndex={shouldBeFocusable ? 0 : -1}`
     - `role={shouldBeFocusable ? 'link' : undefined}`
     - `aria-label={shouldBeFocusable ? ... : undefined}`
     - `onKeyDown={shouldBeFocusable ? handleKeyDown : undefined}`
     - `onFocus={hasDataLinks ? handleFocus : undefined}`
     - `onBlur={hasDataLinks ? handleBlur : undefined}`
     - `style={{ outline: 'none' }}` to remove browser default outline

4. **PieChart Component**:
   - Added sorting to `pie.arcs.map` to put slices with data links first
   - Passed `outerRadius` and `innerRadius` to `PieSlice` components

## Testing

### Expected Behavior
- Tab navigation reaches slices with data links
- Focused slice shows visual highlight (scales up, others fade)
- Enter key activates the data link menu
- Tab order is logical (data link slices appear before non-link slices)

## Files Modified

- `public/app/plugins/panel/piechart/PieChart.tsx`

## References

- [WCAG 2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html)
- [Grafana Contributing Guide](https://github.com/grafana/grafana/blob/main/CONTRIBUTING.md)
- Issue: https://github.com/grafana/grafana/issues/114227


