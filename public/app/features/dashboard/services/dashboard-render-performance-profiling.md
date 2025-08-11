# Grafana Dashboard Render Performance Metrics

This documentation describes the dashboard render performance metrics exposed from Grafana's frontend.

## Overview

The exposed dashboard performance metrics feature provides comprehensive tracking and profiling of dashboard interactions, allowing administrators and developers to analyze dashboard render performance, user interactions, and identify performance bottlenecks.

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
}
```

### Collected Metrics

For each tracked interaction, the system collects:

- **Dashboard Metadata**: UID, title
- **Performance Metrics**:
  - `duration`: Total interaction time from start to finish
  - `networkDuration`: Time spent on network requests (API calls, data fetching)
  - `processingTime`: Client-side processing time calculated as `duration - networkDuration`
- **Memory Metrics**: JavaScript heap usage statistics
- **Timing Information**: Time since boot, profile start and end timestamps
- **Interaction Context**: Type of user interaction

#### Performance Metric Breakdown

The performance metrics provide detailed insights into where time is spent during dashboard interactions:

- **Total Duration (`duration`)**: Complete time from interaction start to completion
- **Network Time (`networkDuration`)**: Time spent waiting for server responses (data source queries, API calls)
- **Processing Time (`processingTime`)**: Time spent on client-side operations (rendering, computations, DOM updates)

## Debugging and Development

### Enable Profiler Debug Logging

To observe profiling events in the browser console:

```javascript
localStorage.setItem('grafana.debug.scenes', 'true');
```

#### Console Output

When debug logging is enabled, you'll see console logs for each profiling event:

```
SceneRenderProfiler: Profile started: {origin: <NAME_OF_INTERACTION>, crumbs: Array(0)}
... // intermediate steps adding profile crumbs
SceneRenderProfiler: Stopped recording, total measured time (network included): 2123
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

Dashboard interactions can be recorded in the browser's performance profiler, where they appear as:

```
Dashboard Interaction <NAME_OF_INTERACTION>
```

## Analytics Integration

### Interaction Reporting

Performance data is integrated with Grafana's analytics system through:

- **`reportInteraction`**: Reports interaction events to Echo service with performance data
- **`logMeasurement`**: Records Faro's performance measurements with metadata

### Data Collection

The system reports the following data for each interaction:

```typescript
{
  interactionType: string,      // Type of interaction
  uid: string,                  // Dashboard UID
  duration: number,             // Total duration
  networkDuration: number,      // Network time
  processingTime: number,       // Client-side processing time (duration - networkDuration)
  startTs: number,              // Profile start timestamp
  endTs: number,                // Profile end timestamp
  totalJSHeapSize: number,      // Memory metrics
  usedJSHeapSize: number,
  jsHeapSizeLimit: number,
  timeSinceBoot: number         // Time since frontend boot
}
```

## Implementation Details

The profiler is integrated into dashboard creation paths and uses a singleton pattern to share profiler instances across dashboard reloads. The performance tracking is implemented using the `SceneRenderProfiler` from the `@grafana/scenes` library.

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
