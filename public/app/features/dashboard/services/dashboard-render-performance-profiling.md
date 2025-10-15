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

The panel-level performance attribution system uses an observer pattern architecture built around `ScenePerformanceTracker` to provide visibility into individual panel operations. When dashboard profiling is enabled, `VizPanelRenderProfiler` instances are automatically attached to all panels via `PanelProfilingManager`.

**Key Features:**

- Tracking of individual panel operations with operation ID correlation
- Observer pattern for distributing performance events to analytics systems
- Chrome DevTools integration via performance marks and measurements
- Real-time performance data aggregation for analytics reporting
- Conditional debug logging controlled by localStorage flags

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

- **Operation ID**: Unique identifier for correlating start/complete events
- **Timing**: Start and end timestamps with duration calculation
- **Metadata**: Operation-specific data (query types, transformation IDs, etc.)

### Performance Observer Architecture

The system uses `ScenePerformanceTracker` as a centralized coordinator that manages performance observers:

```typescript
// Observer interface implemented by analytics components
interface ScenePerformanceObserver {
  onDashboardInteractionStart?(data: DashboardInteractionStartData): void;
  onDashboardInteractionMilestone?(data: DashboardInteractionMilestoneData): void;
  onDashboardInteractionComplete?(data: DashboardInteractionCompleteData): void;
  onPanelOperationStart?(data: PanelPerformanceData): void;
  onPanelOperationComplete?(data: PanelPerformanceData): void;
  onQueryStart?(data: QueryPerformanceData): void;
  onQueryComplete?(data: QueryPerformanceData): void;
}
```

**Registered Observers:**

- **`DashboardAnalyticsAggregator`**: Aggregates panel metrics for analytics reporting
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

Aggregated by `DashboardAnalyticsAggregator` for each panel:

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
  queryOperations: Array<{      // Individual query operations
    duration: number,
    timestamp: number,
    queryType?: string
  }>,
  renderOperations: Array<{     // Individual render operations
    duration: number,
    timestamp: number
  }>
  // ... similar arrays for other operations
}
```

## Debugging and Development

### Enable Performance Debug Logging

To observe performance profiling events in the browser console:

```javascript
// Enable performance debug logging
localStorage.setItem('grafana.debug.sceneProfiling', 'true');
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
SPL: [PANEL] timeseries-panel-1 query [q-abc123]: 45.2ms
SPL: [PANEL] timeseries-panel-1 transform: 12.3ms
SPL: [PANEL] timeseries-panel-1 render: 23.8ms
VizPanelRenderProfiler: Panel render completed
  ├─ Panel ID: panel-1
  ├─ Duration: 23.8ms
  └─ Operation ID: render-xyz789
```

#### Analytics Aggregator Summary

```
DAA: [ANALYTICS] dashboard_view | 4 panels analyzed | 1 slow panels ⚠️
DAA: 📊 Dashboard (ms): {
  duration: 156.8,
  network: 45.2,
  interactionType: "dashboard_view",
  slowPanels: 1
}
DAA: 🎨 Panel timeseries-panel-1: 125.3ms total ⚠️ SLOW
  ├─ ⚡ Performance (ms): {
  │     totalTime: 125.3,
  │     breakdown: {
  │       query: 45.2,
  │       transform: 12.3,
  │       render: 23.8,
  │       fieldConfig: 5.0,
  │       pluginLoad: 39.0
  │     }
  │   }
  └─ 📊 Queries: { count: 2, details: [...] }
```

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
Dashboard Interaction Start: op-dashboard-123456
Dashboard Interaction End: op-dashboard-123456
Dashboard Milestone: op-dashboard-123456:queries_complete
```

**Panel Marks:**

```
Panel Query Start: panel-1:q-abc123
Panel Query End: panel-1:q-abc123
Panel Transform Start: panel-1:merge+organize:tr-def456
Panel Transform End: panel-1:merge+organize:tr-def456
Panel Render Start: panel-1:render-ghi789
Panel Render End: panel-1:render-ghi789
```

These marks enable visual timeline analysis of:

- Overall dashboard interaction timing
- Individual panel operation performance
- Parallel vs sequential operations
- Performance bottlenecks

## Implementation Details

### Architecture Overview

The performance tracking system consists of multiple integrated components:

1. **SceneRenderProfiler** (Scenes library)
   - Singleton profiler instance shared across dashboard reloads
   - Tracks dashboard interactions and manages long frame detection
   - Integrates with PanelProfilingManager for panel-level tracking

2. **ScenePerformanceTracker** (Scenes library)
   - Central coordinator implementing observer pattern
   - Distributes performance events to registered observers
   - Provides type-safe interfaces for different event types

3. **VizPanelRenderProfiler** (Scenes library)
   - Attached to individual panels when profiling is enabled
   - Tracks panel operations: plugin-load, query, transform, fieldConfig, render
   - Reports to ScenePerformanceTracker

4. **DashboardAnalyticsAggregator** (Grafana)
   - Aggregates panel metrics for analytics reporting
   - Detects slow panels (>100ms total time)
   - Sends reports via reportInteraction and logMeasurement

5. **ScenePerformanceLogger** (Grafana)
   - Creates Chrome DevTools performance marks and measurements
   - Provides structured console logging for debugging
   - Maps operations to standardized performance mark names

### Tab Inactivity Handling

To prevent meaningless profiling data when users switch browser tabs, the `SceneRenderProfiler` implements dual protection mechanisms:

#### Primary Protection: Page Visibility API

The profiler automatically cancels active profiling sessions when the browser tab becomes inactive:

```javascript
document.addEventListener('visibilitychange', () => {
  if (document.hidden && this.#profileInProgress) {
    this.cancelProfile();
  }
});
```

This provides immediate response to tab switches using the browser's native visibility change events.

#### Fallback Protection: Frame Length Detection

As a backup mechanism, the profiler detects tab inactivity by monitoring frame duration:

```javascript
if (frameLength > TAB_INACTIVE_THRESHOLD) {
  // 1000ms
  this.cancelProfile();
  return;
}
```

This fallback catches cases where visibility events might be missed and prevents recording of artificially long frame times (hours instead of milliseconds) that occur when `requestAnimationFrame` callbacks resume after tab reactivation.

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

- [PR #858 - Add SceneRenderProfiler to scenes](https://github.com/grafana/scenes/pull/858)
- [PR #99629 - Dashboard render performance metrics](https://github.com/grafana/grafana/pull/99629)
- [PR #108658 - Dashboard: Tweak interaction tracking](https://github.com/grafana/grafana/pull/108658)
- [PR #1195 - Enhance SceneRenderProfiler with additional interaction tracking](https://github.com/grafana/scenes/pull/1195)
- [PR #1198 - Make SceneRenderProfiler optional and injectable](https://github.com/grafana/scenes/pull/1198)
- [PR #1199 - SceneRenderProfiler: add start and end timestamps to profile events](https://github.com/grafana/scenes/pull/1199)
- [PR #1205 - SceneRenderProfiler: Handle tab inactivity](https://github.com/grafana/scenes/pull/1205)
- [PR #1209 - SceneRenderProfiler: Only capture network requests within measurement window](https://github.com/grafana/scenes/pull/1209)
- [PR #1211 - SceneRenderProfiler: Improve profiler accuracy by adding cancellation and skipping inactive tabs](https://github.com/grafana/scenes/pull/1211)
- [PR #1212 - SceneQueryController: Fix profiler query controller registration on scene re-activation](https://github.com/grafana/scenes/pull/1212)
- [PR #1225 - SceneRenderProfiler: Handle overlapping profiles by cancelling previous profile](https://github.com/grafana/scenes/pull/1225)
- [PR #1235 - Implement long frame detection with LoAF API and manual fallback](https://github.com/grafana/scenes/pull/1235)
- [PR #1265 - Panel-level performance attribution system](https://github.com/grafana/scenes/pull/1265)
- [PR #112137 - Dashboard performance analytics system with Scenes integration](https://github.com/grafana/grafana/pull/112137)
