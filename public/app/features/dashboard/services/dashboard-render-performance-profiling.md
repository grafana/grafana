# Grafana Dashboard Render Performance Metrics

This documentation describes the dashboard render performance metrics exposed from Grafana's frontend.

## Table of Contents

- [Overview](#overview)
- [Configuration](#configuration)
  - [Enabling Performance Metrics](#enabling-performance-metrics)
- [Tracked Interactions](#tracked-interactions)
  - [Core Performance-Tracked Interactions](#core-performance-tracked-interactions)
  - [Interaction Origin Mapping](#interaction-origin-mapping)
- [Panel-Level Performance Attribution](#panel-level-performance-attribution)
  - [Overview](#panel-level-overview)
  - [Panel Operations Tracked](#panel-operations-tracked)
  - [Performance Observer Architecture](#performance-observer-architecture)
- [Profiling Implementation](#profiling-implementation)
  - [Profile Data Structure](#profile-data-structure)
  - [Collected Metrics](#collected-metrics)
  - [Long Frame Detection](#long-frame-detection)
- [Analytics Integration](#analytics-integration)
  - [Analytics Components](#analytics-components)
  - [Chrome DevTools Integration](#chrome-devtools-integration)
  - [Data Collection](#data-collection)
- [Debugging and Development](#debugging-and-development)
  - [Enable Performance Debug Logging](#enable-performance-debug-logging)
  - [Console Output Examples](#console-output-examples)
  - [Browser Performance Profiler](#browser-performance-profiler)
- [Implementation Details](#implementation-details)
  - [Architecture Overview](#architecture-overview)
  - [Tab Inactivity Handling](#tab-inactivity-handling)
  - [Profile Isolation](#profile-isolation)
- [Related Documentation](#related-documentation)

## Overview

The exposed dashboard performance metrics feature provides comprehensive tracking and profiling of dashboard interactions, allowing administrators and developers to analyze dashboard render performance, user interactions, and identify performance bottlenecks.

The system includes **panel-level performance attribution** through an observer pattern architecture, providing visibility into individual panel operations within dashboard interactions. This enables identification of performance bottlenecks at both dashboard and panel levels, with comprehensive analytics reporting and Chrome DevTools integration.

## Configuration

### Enabling Performance Metrics

Dashboard performance metrics are configured in the Grafana configuration file (`grafana.ini`) under the `[dashboards]` section:

```ini
[dashboards]
# Dashboards UIDs to report performance metrics for. * can be used to report metrics for all dashboards
dashboard_performance_metrics = *
```

**Configuration Options:**

- **`*`** - Enable profiling on all dashboards
- **`<comma-separated-list-of-dashboard-uid>`** - Enable profiling on specific dashboards only
- **`""` (empty)** - Disable performance metrics (default)

**Examples:**

```ini
# Enable for all dashboards
dashboard_performance_metrics = *

# Enable for specific dashboards
dashboard_performance_metrics = dashboard-uid-1,dashboard-uid-2,dashboard-uid-3

# Disable performance metrics
dashboard_performance_metrics =
```

## Tracked Interactions

The system tracks various dashboard interaction types automatically using the [`@grafana/scenes`](https://github.com/grafana/scenes) library. Each interaction is captured with a specific origin identifier that describes the type of user action performed. In Grafana, these interaction events are then reported as `dashboard_render` events with interaction type information included.

### Core Performance-Tracked Interactions

The following dashboard interaction types are tracked for dashboard render performance profiling:

| Interaction Type         | Trigger                    | When Measured                                            |
| ------------------------ | -------------------------- | -------------------------------------------------------- |
| `dashboard_view`         | Dashboard view             | When user loads or navigates to a dashboard              |
| `refresh`                | Manual/Auto refresh        | When user clicks refresh button or auto-refresh triggers |
| `time_range_change`      | Time picker changes        | When user changes time range in time picker              |
| `filter_added`           | Ad-hoc filter addition     | When user adds a new filter to the dashboard             |
| `filter_removed`         | Ad-hoc filter removal      | When user removes a filter from the dashboard            |
| `filter_changed`         | Ad-hoc filter modification | When user changes filter values or operators             |
| `filter_restored`        | Ad-hoc filter restoration  | When user restores a previously applied filter           |
| `variable_value_changed` | Variable value changes     | When user changes dashboard variable values              |
| `scopes_changed`         | Scopes modifications       | When user modifies dashboard scopes                      |

The interactions mentioned above are reported to Echo service as well as sent to [Faro](https://grafana.com/docs/grafana-cloud/monitor-applications/frontend-observability/) as `dashboard_render` measurements:

```ts
const payload = {
  duration: e.duration,
  networkDuration: e.networkDuration,
  processingTime: e.duration - e.networkDuration,
  startTs: e.startTs,
  endTs: e.endTs,
  totalJSHeapSize: e.totalJSHeapSize,
  usedJSHeapSize: e.usedJSHeapSize,
  jsHeapSizeLimit: e.jsHeapSizeLimit,
  longFramesCount: e.longFramesCount,
  longFramesTotalTime: e.longFramesTotalTime,
  timeSinceBoot: performance.measure('time_since_boot', 'frontend_boot_js_done_time_seconds').duration,
};

reportInteraction('dashboard_render', {
  interactionType: e.origin,
  uid,
  ...payload,
});

logMeasurement(`dashboard_render`, payload, { interactionType: e.origin, dashboard: uid, title: title });
```

### Interaction Origin Mapping

The profiling system uses profiler event's `origin` directly as the `interactionType`, providing direct mapping between user actions and performance measurements.

## Panel-Level Performance Attribution

### Panel-Level Overview

The panel-level performance attribution system uses a observer pattern architecture built around `ScenePerformanceTracker` to provide comprehensive visibility into individual panel operations. When dashboard profiling is enabled, `VizPanelRenderProfiler` instances are automatically attached to all panels, providing granular tracking of panel lifecycle operations.

**Key Features:**

- **Complete lifecycle tracking**: Monitors plugin load, query execution, data transformation, field configuration, and rendering phases
- **Sub-millisecond precision timing**: Chrome DevTools integration via performance marks and measurements
- **Operation ID correlation**: UUID-based operation IDs with crypto fallback for cross-environment compatibility
- **Observer pattern architecture**: Clean separation between performance tracking and business logic with extensible observer support
- **Real-time analytics aggregation**: Structured data format ready for analytics reporting
- **Conditional profiling**: Analytics aggregator only initialized when profiling is enabled
- **Type-safe interfaces**: Comprehensive TypeScript support with event-specific interfaces

### Panel Operations Tracked

The system tracks the following panel operations:

| Operation     | Description           | When Tracked                                    |
| ------------- | --------------------- | ----------------------------------------------- |
| `plugin-load` | Plugin initialization | When panel plugin is loaded                     |
| `query`       | Data source queries   | When panel executes queries                     |
| `transform`   | Data transformations  | When data is transformed (SceneDataTransformer) |
| `fieldConfig` | Field configuration   | When field configurations are applied           |
| `render`      | Panel rendering       | When panel is rendered                          |

Each operation is tracked with:

- **Operation ID**: UUID-based unique identifier for correlating start/complete events (e.g., `query-a1b2c3d4-e5f6-7890-abcd-ef1234567890`)
- **Timing**: High-precision start and end timestamps with sub-millisecond duration calculation
- **Metadata**: Operation-specific data (query types, transformation IDs, plugin information, etc.)

### Operation ID Format

The system generates unique operation IDs using a standardized format:

```
<operation-type>-<uuid>
```

**Examples:**

- `plugin-load-550e8400-e29b-41d4-a716-446655440000`
- `query-a1b2c3d4-e5f6-7890-abcd-ef1234567890`
- `transform-b2c3d4e5-f6g7-8901-bcde-f23456789012`
- `fieldConfig-c3d4e5f6-g7h8-9012-cdef-345678901234`
- `render-d4e5f6g7-h8i9-0123-def0-456789012345`

**Benefits:**

- **Global Uniqueness**: UUIDs prevent ID collisions across dashboard sessions
- **Cross-Environment Compatibility**: Crypto fallback ensures operation in all environments
- **Operation Correlation**: Enables precise tracking of start/complete event pairs
- **Debugging**: Human-readable prefixes make log analysis easier

### Performance Observer Architecture

The system uses `ScenePerformanceTracker` as a centralized coordinator that manages performance observers through an event-driven architecture. The performance utilities are organized under the `performanceUtils` namespace.

```typescript
// Import performance utilities from scenes
import { performanceUtils } from '@grafana/scenes';

// Observer interface implemented by analytics components
interface ScenePerformanceObserver {
  onDashboardInteractionStart?(data: performanceUtils.DashboardInteractionStartData): void;
  onDashboardInteractionMilestone?(data: performanceUtils.DashboardInteractionMilestoneData): void;
  onDashboardInteractionComplete?(data: performanceUtils.DashboardInteractionCompleteData): void;
  onPanelOperationStart?(data: performanceUtils.PanelPerformanceData): void;
  onPanelOperationComplete?(data: performanceUtils.PanelPerformanceData): void;
  onQueryStart?(data: performanceUtils.QueryPerformanceData): void;
  onQueryComplete?(data: performanceUtils.QueryPerformanceData): void;
}

// Register observers with the performance tracker
const tracker = performanceUtils.getScenePerformanceTracker();
tracker.addObserver(myObserver);
```

**Operation ID Generation:**

The system generates unique operation IDs for correlating start/complete events using UUID with fallback support:

```typescript
// Uses crypto.randomUUID() when available, Math.random() fallback for compatibility
const operationId = performanceUtils.generateOperationId('panel-query');
// Result: "panel-query-550e8400-e29b-41d4-a716-446655440000"
```

**Registered Observers:**

- **`DashboardAnalyticsAggregator`**: Aggregates panel metrics for analytics reporting (conditionally initialized)
- **`ScenePerformanceLogger`**: Creates Chrome DevTools performance marks and console logs

## Profiling Implementation

### Profile Data Structure

Each interaction profile event captures:

```typescript
interface SceneInteractionProfileEvent {
  origin: string; // Interaction type
  duration: number; // Total interaction duration
  networkDuration: number; // Network requests duration
  totalJSHeapSize: number; // JavaScript heap size metrics
  usedJSHeapSize: number; // Used JavaScript heap size
  jsHeapSizeLimit: number; // JavaScript heap size limit
  startTs: number; // Profile start timestamp
  endTs: number; // Profile end timestamp
  longFramesCount: number; // Number of long frames (>50ms threshold)
  longFramesTotalTime: number; // Total time of long frames during interaction
}
```

### Collected Metrics

For each tracked interaction, the system collects:

- **Dashboard Metadata**: UID, title
- **Performance Metrics**:
  - `duration`: Total interaction time from start to finish
  - `networkDuration`: Time spent on network requests (API calls, data fetching)
  - `processingTime`: Client-side processing time calculated as `duration - networkDuration`
  - `longFramesCount`: Number of frames that exceeded the 50ms threshold
  - `longFramesTotalTime`: Cumulative time of all long frames during the interaction
- **Memory Metrics**: JavaScript heap usage statistics
- **Timing Information**: Time since boot, profile start and end timestamps
- **Interaction Context**: Type of user interaction

#### Performance Metric Breakdown

The performance metrics provide detailed insights into where time is spent during dashboard interactions:

- **Total Duration (`duration`)**: Complete time from interaction start to completion
- **Network Time (`networkDuration`)**: Time spent waiting for server responses (data source queries, API calls)
- **Processing Time (`processingTime`)**: Time spent on client-side operations (rendering, computations, DOM updates)
- **Long Frames (`longFramesCount` & `longFramesTotalTime`)**: Frames exceeding 50ms threshold indicate potential UI jank or performance issues

### Long Frame Detection

The profiler includes sophisticated long frame detection using the Long Animation Frame (LoAF) API when available, with automatic fallback to manual frame tracking:

#### Detection Methods

1. **Long Animation Frame API (Primary)**
   - **Browser Support**: Chrome 123+ (automatically detected)
   - **Threshold**: 50ms (standard LoAF threshold)
   - **Benefits**: Browser-level accuracy, script attribution, automatic buffering control

2. **Manual Frame Tracking (Fallback)**
   - **Browser Support**: All browsers
   - **Threshold**: 50ms (same as LoAF)
   - **Implementation**: Uses requestAnimationFrame for frame monitoring

#### Metrics Collected

- **`longFramesCount`**: Number of frames exceeding the 50ms threshold
- **`longFramesTotalTime`**: Cumulative duration of all long frames during interaction

This helps identify:

- Rendering performance issues impacting user experience
- Interactions causing UI jank or frame drops
- Performance optimization opportunities

## Analytics Integration

### Analytics Components

The performance tracking system integrates with Grafana's analytics through two main components:

#### DashboardAnalyticsAggregator

Aggregates panel-level performance metrics for analytics reporting:

- Collects and aggregates metrics for all panel operations
- Tracks operation counts and total time spent per panel
- Sends comprehensive analytics reports via `reportInteraction` and `logMeasurement`
- Provides detailed panel breakdowns including slow panel detection

#### ScenePerformanceLogger

Creates Chrome DevTools performance marks and measurements for debugging:

- Generates performance marks for all dashboard and panel operations
- Creates performance measurements for timing visualization
- Provides console logging for real-time debugging
- Integrates with Chrome DevTools Performance timeline

### Chrome DevTools Integration

Performance operations are recorded as marks and measurements in the Chrome DevTools Performance timeline:

**Dashboard-level marks:**

```
Dashboard Interaction Start: <operationId>
Dashboard Interaction End: <operationId>
Dashboard Milestone: <operationId>:<milestone>
```

**Panel-level marks:**

```
Panel Query Start: <panelKey>:<operationId>
Panel Query End: <panelKey>:<operationId>
Panel Render Start: <panelKey>:<operationId>
Panel Render End: <panelKey>:<operationId>
```

### Data Collection

The system collects and reports data at two levels:

#### Dashboard Interaction Data

Reported for each interaction via `reportInteraction` and `logMeasurement`:

```typescript
{
  interactionType: string,      // Type of interaction
  uid: string,                  // Dashboard UID
  duration: number,             // Total duration
  networkDuration: number,      // Network time
  processingTime: number,       // Client-side processing time
  startTs: number,              // Profile start timestamp
  endTs: number,                // Profile end timestamp
  longFramesCount: number,      // Number of long frames
  longFramesTotalTime: number,  // Total time of long frames
  totalJSHeapSize: number,      // Memory metrics
  usedJSHeapSize: number,
  jsHeapSizeLimit: number,
  timeSinceBoot: number         // Time since frontend boot
}
```

#### Panel-Level Metrics

Aggregated by `DashboardAnalyticsAggregator` for each panel with detailed operation tracking:

```typescript
{
  panelId: string,              // Panel identifier
  pluginId: string,             // Plugin type (e.g., 'timeseries', 'stat')
  pluginVersion?: string,       // Plugin version
  totalQueryTime: number,       // Total time spent in queries
  totalTransformationTime: number,  // Total time in transformations
  totalRenderTime: number,      // Total render time
  totalFieldConfigTime: number, // Total field config time
  pluginLoadTime: number,       // Plugin initialization time

  // Individual operations with UUID-based operation IDs
  pluginLoadOperations: Array<{
    operationId: string,        // e.g., "plugin-load-550e8400-e29b-41d4-a716-446655440000"
    duration: number,
    timestamp: number
  }>,
  queryOperations: Array<{      // Individual query operations
    operationId: string,        // e.g., "query-a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    duration: number,
    timestamp: number,
    queryType?: string
  }>,
  transformationOperations: Array<{
    duration: number,
    timestamp: number,
    transformationType?: string
  }>,
  fieldConfigOperations: Array<{
    duration: number,
    timestamp: number
  }>,
  renderOperations: Array<{     // Individual render operations
    duration: number,
    timestamp: number
  }>,

  // Performance analysis
  isSlowPanel: boolean,         // true if total time > SLOW_OPERATION_THRESHOLD_MS (500ms)
  slowOperationThreshold: number, // Current threshold value (500ms)
  totalPanelTime: number        // Sum of all operation times
}
```

## Debugging and Development

### Enable Performance Debug Logging

To observe performance profiling events in the browser console:

```javascript
// Enable performance debug logging
localStorage.setItem('grafana.debug.sceneProfiling', 'true');
```

### Performance Threshold Configuration

The system uses a const threshold to identify slow operations:

- **Default Threshold**: `SLOW_OPERATION_THRESHOLD_MS = 500` milliseconds
- **Applies to**: Individual panel operations and total panel performance
- **Slow Panel Detection**: Panels exceeding threshold display ⚠️ warnings in logs
- **Analytics Integration**: Slow panel count included in dashboard analytics reports

**Example Slow Operation Warning:**

```javascript
SPL: [PANEL] timeseries-panel-1 query [query-abc123]: 125.3ms ⚠️ SLOW
DAA: 🎨 Panel timeseries-panel-1: 125.3ms total ⚠️ SLOW
```

### Console Output Examples

With debug logging enabled, you'll see detailed performance logs:

#### Dashboard Interaction Logs

```
SRP: [PROFILER] dashboard_view started (clean)
LFD: Started tracking with LoAF API method, threshold: 50ms
SPL: [DASHBOARD] dashboard_view started: My Dashboard
SRP: [PROFILER] dashboard_view completed
  ├─ Duration: 156.8ms
  ├─ Long frames: 143.7ms (2 frames)
  └─ Network time: 45.2ms
```

#### Panel Operation Logs

```
SPL: [PANEL] timeseries-panel-1 plugin-load: 39.0ms
SPL: [PANEL] timeseries-panel-1 query [query-a1b2c3d4-e5f6-7890-abcd]: 45.2ms
SPL: [PANEL] timeseries-panel-1 transform: 12.3ms
SPL: [PANEL] timeseries-panel-1 fieldConfig: 5.0ms
SPL: [PANEL] timeseries-panel-1 render: 23.8ms ⚠️ SLOW
```

#### VizPanelRenderProfiler Logs

The `VizPanelRenderProfiler` provides lifecycle and error logging (only visible with scenes debug logging enabled):

```
VizPanelRenderProfiler [My Dashboard Panel]: Plugin changed to timeseries
VizPanelRenderProfiler [My Dashboard Panel]: Cleaned up
VizPanelRenderProfiler: Not attached to a VizPanel
VizPanelRenderProfiler: Panel has no key, skipping tracking
```

#### Analytics Aggregator Summary

The `DashboardAnalyticsAggregator` creates structured **collapsible console groups** for detailed analysis. Each panel gets its own expandable group in the browser console:

```
DAA: [ANALYTICS] dashboard_view | 4 panels analyzed | 1 slow panels ⚠️
  DAA: 📊 Dashboard (ms): {
    duration: 156.8,
    network: 45.2,
    interactionType: "dashboard_view",
    slowPanels: 1
  }
  DAA: 📈 Analytics payload: { /* comprehensive analytics data */ }

  // Per-panel detailed breakdown (console group for each panel)
  DAA: 🎨 Panel timeseries-panel-1: 125.3ms total ⚠️ SLOW
    DAA: 🔧 Plugin: {
      id: "timeseries",
      version: "10.0.0",
      panelId: "panel-1",
      panelKey: "panel-1"
    }
    DAA: ⚡ Performance (ms): {
      totalTime: 125.3,
      isSlowPanel: true,
      breakdown: {
        query: 45.2,
        transform: 12.3,
        render: 23.8,
        fieldConfig: 5.0,
        pluginLoad: 39.0
      }
    }
    DAA: 📊 Queries: {
      count: 2,
      details: [
        { operation: 1, duration: 25.1, timestamp: 1729692845100.123 },
        { operation: 2, duration: 20.1, timestamp: 1729692845125.456 }
      ]
    }
    DAA: 🔄 Transformations: {
      count: 1,
      details: [
        { operation: 1, duration: 12.3, timestamp: 1729692845150.789 }
      ]
    }
    DAA: 🎨 Renders: {
      count: 1,
      details: [
        { operation: 1, duration: 23.8, timestamp: 1729692845163.012 }
      ]
    }
```

**Note**: The indentation shows the **console group hierarchy**. In the browser console, each panel creates a collapsible group that can be expanded to see detailed operation breakdowns. The main dashboard analytics group contains nested panel groups for organized analysis.

### Enable Echo Service Debug Logging

To observe Echo events in the browser console:

```javascript
_debug.echo.enable();
```

#### Console Output

When Echo debug logging is enabled, you'll see console logs for each profiling event captured by Echo service:

```
[EchoSrv: interaction event]: {interactionName: 'dashboard_render', properties: {…}, meta: {…}}
```

### Browser Performance Profiler

Dashboard and panel operations are recorded in the Chrome DevTools Performance timeline with detailed marks and measurements:

**Dashboard Marks:**

```
Dashboard Interaction Start: dashboard-550e8400-e29b-41d4-a716-446655440000
Dashboard Interaction End: dashboard-550e8400-e29b-41d4-a716-446655440000
Dashboard Milestone: dashboard-550e8400-e29b-41d4-a716-446655440000:queries_complete
Dashboard Milestone: dashboard-550e8400-e29b-41d4-a716-446655440000:actual_interaction_complete
```

**Panel Marks:**

```
Panel Plugin Load Start: panel-1:plugin-load-a1b2c3d4-e5f6-7890-abcd-ef1234567890
Panel Plugin Load End: panel-1:plugin-load-a1b2c3d4-e5f6-7890-abcd-ef1234567890
Panel Query Start: panel-1:query-b2c3d4e5-f6g7-8901-bcde-f23456789012
Panel Query End: panel-1:query-b2c3d4e5-f6g7-8901-bcde-f23456789012
Panel Transform Start: panel-1:transform-c3d4e5f6-g7h8-9012-cdef-345678901234
Panel Transform End: panel-1:transform-c3d4e5f6-g7h8-9012-cdef-345678901234
Panel Field Config Start: panel-1:fieldConfig-d4e5f6g7-h8i9-0123-def0-456789012345
Panel Field Config End: panel-1:fieldConfig-d4e5f6g7-h8i9-0123-def0-456789012345
Panel Render Start: panel-1:render-e5f6g7h8-i9j0-1234-ef01-567890123456
Panel Render End: panel-1:render-e5f6g7h8-i9j0-1234-ef01-567890123456
```

These marks enable visual timeline analysis of:

- Overall dashboard interaction timing
- Individual panel operation performance
- Parallel vs sequential operations
- Performance bottlenecks

## Implementation Details

### Architecture Overview

The performance tracking system consists of multiple integrated components with observer pattern architecture:

1. **SceneRenderProfiler** (Scenes library - `performanceUtils` namespace)
   - Singleton profiler instance shared across dashboard reloads
   - Tracks dashboard interactions and manages long frame detection
   - Integrates with VizPanelRenderProfiler for comprehensive panel-level tracking

2. **ScenePerformanceTracker** (Scenes library - `performanceUtils` namespace)
   - Central coordinator implementing observer pattern architecture
   - Distributes performance events to registered observers without coupling
   - Provides type-safe interfaces for different event types
   - Supports extensible observer registration with clean separation of concerns

3. **VizPanelRenderProfiler** (Scenes library - `performanceUtils` namespace)
   - Automatically attached to individual panels when profiling is enabled
   - Tracks complete panel lifecycle: plugin-load, query, transform, fieldConfig, render
   - Uses UUID-based operation IDs with crypto fallback for cross-environment compatibility
   - Reports structured performance data to ScenePerformanceTracker

4. **DashboardAnalyticsAggregator** (Grafana)
   - **Conditionally initialized**: Only activated when `enableProfiling` is true
   - Aggregates panel metrics for analytics reporting with slow panel detection
   - Uses configurable threshold (SLOW_OPERATION_THRESHOLD_MS = 100ms)
   - Sends comprehensive reports via reportInteraction and logMeasurement

5. **ScenePerformanceLogger** (Grafana)
   - Creates Chrome DevTools performance marks and measurements
   - Provides structured console logging for debugging with localStorage controls
   - Maps operations to standardized performance mark names
   - Integrates with browser Performance Timeline API

### Tab Inactivity Handling

To prevent meaningless profiling data when users switch browser tabs, the `SceneRenderProfiler` implements dual protection mechanisms:

#### Page Visibility API

The profiler automatically cancels active profiling sessions when the browser tab becomes inactive:

```javascript
document.addEventListener('visibilitychange', () => {
  if (document.hidden && this.#profileInProgress) {
    this.cancelProfile();
  }
});
```

This provides immediate response to tab switches using the browser's native visibility change events.

#### Frame Length Measurement for Performance Analysis

The profiler measures frame lengths during the post-interaction recording window for performance analysis:

```javascript
const frameLength = currentFrameTime - lastFrameTime;
this.#recordedTrailingSpans.push(frameLength);
```

**Note**: Frame length measurement is used for performance analytics only. The profiler does **not** use frame length thresholds for tab inactivity detection. Tab inactivity protection relies exclusively on the Page Visibility API for accurate and immediate response to tab changes.

### Profile Isolation

To ensure accurate performance measurements, the profiler implements automatic profile cancellation when handling rapid user interactions:

**Trailing Frame Recording**: After an interaction completes, the profiler continues recording for 2 seconds (POST_STORM_WINDOW) to capture delayed rendering effects.

**Automatic Cancellation**: When a new interaction begins during trailing frame recording, the current profile is cancelled to prevent mixing performance data:

```javascript
if (this.#trailAnimationFrameId) {
  this.cancelProfile();
  this._startNewProfile(name, true); // forced profile
}
```

**Profile Types**:

- **Clean Start**: No active profile when starting
- **Forced Start**: Previous profile cancelled for new interaction

This ensures each interaction gets isolated measurements, preventing data contamination from overlapping operations.

## Related Documentation

### Foundational Performance System

- [PR #858 - Add SceneRenderProfiler to scenes](https://github.com/grafana/scenes/pull/858) ✅ Merged
- [PR #99629 - Dashboard render performance metrics](https://github.com/grafana/grafana/pull/99629) ✅ Merged
- [PR #108658 - Dashboard: Tweak interaction tracking](https://github.com/grafana/grafana/pull/108658) ✅ Merged

### Enhanced Profiling Features

- [PR #1195 - Enhance SceneRenderProfiler with additional interaction tracking](https://github.com/grafana/scenes/pull/1195) ✅ Merged
- [PR #1198 - Make SceneRenderProfiler optional and injectable](https://github.com/grafana/scenes/pull/1198) ✅ Merged
- [PR #1199 - SceneRenderProfiler: add start and end timestamps to profile events](https://github.com/grafana/scenes/pull/1199) ✅ Merged
- [PR #1205 - SceneRenderProfiler: Handle tab inactivity](https://github.com/grafana/scenes/pull/1205) ✅ Merged
- [PR #1209 - SceneRenderProfiler: Only capture network requests within measurement window](https://github.com/grafana/scenes/pull/1209) ✅ Merged
- [PR #1211 - SceneRenderProfiler: Improve profiler accuracy by adding cancellation and skipping inactive tabs](https://github.com/grafana/scenes/pull/1211) ✅ Merged
- [PR #1212 - SceneQueryController: Fix profiler query controller registration on scene re-activation](https://github.com/grafana/scenes/pull/1212) ✅ Merged
- [PR #1225 - SceneRenderProfiler: Handle overlapping profiles by cancelling previous profile](https://github.com/grafana/scenes/pull/1225) ✅ Merged
- [PR #1235 - Implement long frame detection with LoAF API and manual fallback](https://github.com/grafana/scenes/pull/1235) ✅ Merged

### Panel-Level Performance Attribution System

- [PR #1265 - Panel-level performance attribution system](https://github.com/grafana/scenes/pull/1265) 🔄 **In Review**
  - Modern observer pattern architecture with ScenePerformanceTracker
  - Complete panel lifecycle tracking (plugin-load, query, transform, fieldConfig, render)
  - UUID-based operation IDs with crypto fallback for cross-environment compatibility
  - performanceUtils namespace organization for clean API separation
  - Type-safe performance interfaces with comprehensive TypeScript support
  - Chrome DevTools integration via performance marks and measurements
- [PR #112137 - Dashboard performance analytics system with Scenes integration](https://github.com/grafana/grafana/pull/112137) 🔄 **In Review**
  - DashboardAnalyticsAggregator with conditional initialization
  - ScenePerformanceLogger for debugging and Chrome DevTools integration
  - Configurable performance thresholds (SLOW_OPERATION_THRESHOLD_MS)
  - Comprehensive analytics reporting via reportInteraction and logMeasurement
  - Integration with the panel-level performance attribution system from PR #1265
