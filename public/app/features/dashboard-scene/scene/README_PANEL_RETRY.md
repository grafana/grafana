# Panel Error Handling and Retry Functionality

## Overview

This enhancement adds panel-specific retry functionality for dashboard panels that encounter errors (such as timeouts, data source query failures, etc.).

## Features

### Enhanced Error Display
- When a panel encounters an error, a prominent error notice is displayed overlay-style on the panel
- Shows the error message with a clear "Retry" button
- Displays additional error count if multiple errors occurred
- Non-intrusive design that doesn't break the dashboard layout

### Direct Retry Access
- **Retry Button**: Immediately accessible retry button without needing to navigate through inspect drawer
- **Loading State**: Shows loading indicator during retry attempts
- **Context Preservation**: Maintains the same time range, variables, and query context when retrying

### Error Details Drawer
- **Details Button**: Opens a drawer with comprehensive error information
- **Multiple Errors**: Displays all errors if multiple queries failed
- **Formatted Error Messages**: Shows error messages in a readable format with query references
- **Retry from Drawer**: Can retry directly from the details view

## Technical Implementation

### Components

1. **PanelNotices** (`PanelNotices.tsx`)
   - Enhanced to detect error states in panel data
   - Integrates with existing PanelHeaderNotices
   - Conditionally renders PanelErrorNotice when errors are present

2. **PanelErrorNotice** (`PanelErrorNotice.tsx`)
   - New component that provides the enhanced error UI
   - Handles retry logic with proper loading states
   - Manages error details drawer

### Error Detection
- Checks `data.data?.error` for direct query errors
- Scans `data.data?.series` frame notices for error severity notices
- Supports both single and multiple error scenarios

### Retry Mechanism
- Uses existing `getQueryRunnerFor()` utility to find the appropriate query runner
- Calls `queryRunner.runQueries()` to retry with the same context
- Maintains all existing query parameters, time range, and variable values

## Usage

### For Users
1. **When a panel shows an error**: An error notice appears on the panel with error details
2. **Quick retry**: Click the "Retry" button to immediately retry the query
3. **Detailed view**: Click "Details" to see comprehensive error information and retry from there

### For Developers
The enhancement is backward compatible and doesn't change existing error handling:
- Existing PanelHeaderNotices continue to work as before
- Inspect drawer functionality remains unchanged
- Only adds enhanced UI when errors are present

## Error Types Supported
- Data source timeouts
- Query execution errors
- Network connectivity issues
- Authorization errors
- Any error that results in DataQueryError or frame notice with error severity

## Benefits
1. **Better UX**: Users can quickly retry failed panels without navigating through multiple UI layers
2. **Context Preservation**: Retries maintain the exact same conditions as the original query
3. **Error Visibility**: More prominent error display makes issues more noticeable
4. **Detailed Information**: Easy access to comprehensive error details when needed

## Migration Notes
- No breaking changes
- Existing error handling continues to work
- New functionality is additive only
- Compatible with all existing dashboard scene components