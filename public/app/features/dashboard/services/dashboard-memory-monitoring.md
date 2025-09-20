# Grafana Dashboard Memory Monitoring

This documentation describes the dashboard memory monitoring functionality that tracks frontend JavaScript heap usage in Grafana dashboards.

## Overview

Dashboard memory monitoring provides comprehensive tracking of JavaScript memory usage in Grafana dashboards, allowing administrators and developers to identify memory leaks, monitor heap usage, and optimize dashboard performance.

## Configuration

### Enabling Memory Monitoring

Dashboard memory monitoring is configured in the Grafana configuration file (`grafana.ini`) under the `[dashboards]` section:

```ini
[dashboards]
# Dashboards UIDs to monitor memory usage for. * can be used to monitor all dashboards
dashboard_memory_monitoring = *

# Set the interval for periodic memory measurements (minimum: 1s, default: 30s)
dashboard_memory_monitoring_interval = 30s
```

**Configuration Options:**

- **`*`** - Enable memory monitoring on all dashboards
- **`<comma-separated-list-of-dashboard-uid>`** - Enable monitoring on specific dashboards only
- **`""` (empty)** - Disable memory monitoring (default)

**Examples:**

```ini
# Enable for all dashboards with 10-second intervals
dashboard_memory_monitoring = *
dashboard_memory_monitoring_interval = 10s

# Enable for specific dashboards with 1-minute intervals
dashboard_memory_monitoring = dashboard-uid-1,dashboard-uid-2,dashboard-uid-3
dashboard_memory_monitoring_interval = 1m

# Disable memory monitoring
dashboard_memory_monitoring =
```

## Memory Metrics Collected

When enabled, Grafana collects the following memory metrics using the browser's `performance.memory` API:

| Metric                  | Description                              | Unit  | Browser Support |
| ----------------------- | ---------------------------------------- | ----- | --------------- |
| `totalJSHeapSize`       | Total heap size allocated for JavaScript | Bytes | Chrome/Edge     |
| `usedJSHeapSize`        | Currently used heap size                 | Bytes | Chrome/Edge     |
| `jsHeapSizeLimit`       | Maximum heap size allowed                | Bytes | Chrome/Edge     |
| `memoryUsagePercentage` | Percentage of heap used                  | %     | Chrome/Edge     |

### Browser Compatibility

| Browser     | Support Level                                                   |
| ----------- | --------------------------------------------------------------- |
| Chrome/Edge | Full support with all metrics                                   |
| Firefox     | Limited support (requires `dom.enable_performance_memory` flag) |
| Safari      | Graceful degradation (monitoring enabled but no memory data)    |

**Firefox Configuration:**

1. Navigate to `about:config`
2. Search for `dom.enable_performance_memory`
3. Set to `true`
4. Restart browser

## Monitoring Behavior

### Measurement Timing

Memory measurements are captured at specific times:

1. **Immediate**: When dashboard monitoring starts (on navigation)
2. **Periodic**: At configured intervals while dashboard is active
3. **Stop**: When navigating away from dashboard

### Data Collection

Memory measurements are sent to two systems:

#### 1. Echo Service (Debug Logging)

- **Event Type**: `memory-usage`
- **Purpose**: Internal debug logging when debug mode is enabled
- **Payload Structure**:

```typescript
{
  totalJSHeapSize: number,
  usedJSHeapSize: number,
  jsHeapSizeLimit: number,
  memoryUsagePercentage: number,
  dashboardUid: string,
  dashboardTitle: string
}
```

#### 2. Faro (Observability)

- **Measurement Type**: `dashboard_memory`
- **Purpose**: Time-series monitoring and analysis
- **Context Data**:

```typescript
{
  dashboard: string,      // Dashboard UID
  title: string,         // Dashboard title
  monitoringInterval: string // Interval in milliseconds
}
```

## Implementation Details

### Integration Architecture

The memory monitoring system uses a behavior-based architecture that integrates with Grafana's scene system:

#### DashboardMemoryMonitor (Service)

- Singleton service responsible for scheduling and taking memory measurements
- Handles configuration parsing and interval management
- Reports measurements to Echo and Faro services

#### DashboardMemoryMonitorBehavior (Scene Behavior)

- Scene behavior that automatically attaches to dashboard scenes
- Starts/stops monitoring based on scene lifecycle
- Extracts dashboard context (UID, title) from scene state

#### Integration Pattern

```typescript
// Scene-based dashboards (automatic)
export class DashboardScene extends SceneObjectBase {
  constructor(options: DashboardSceneOptions) {
    super({
      ...options,
      $behaviors: [
        createDashboardMemoryMonitorBehavior(options.uid),
        // ... other behaviors
      ],
    });
  }
}

// Manual integration (legacy dashboards)
const memoryMonitor = new DashboardMemoryMonitor();
memoryMonitor.startMonitoring({
  dashboardUid: 'dashboard-123',
  dashboardTitle: 'My Dashboard',
});
```

### Memory Measurement Process

```typescript
// Simplified measurement flow
class DashboardMemoryMonitor {
  private takeMemoryMeasurement() {
    if (!performance.memory) {
      // Graceful degradation for unsupported browsers
      return;
    }

    const measurement = {
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      memoryUsagePercentage: (performance.memory.usedJSHeapSize / performance.memory.totalJSHeapSize) * 100,
    };

    // Report to Echo service
    getEchoSrv().addEvent({
      type: EchoEventType.MemoryUsage,
      payload: {
        ...measurement,
        dashboardUid: this.currentDashboardUid,
        dashboardTitle: this.currentDashboardTitle,
      },
    });

    // Report to Faro
    logMeasurement('dashboard_memory', measurement, {
      dashboard: this.currentDashboardUid || '',
      title: this.currentDashboardTitle || '',
      monitoringInterval: this.intervalMs.toString(),
    });
  }
}
```

## Debugging and Development

### Enable Memory Debug Logging

To observe memory monitoring events in the browser console:

```javascript
localStorage.setItem('grafana.debug.memory', 'true');
```

#### Console Output

When debug logging is enabled, you'll see console logs for each memory measurement:

```
Memory usage measurements for dashboard: {
  totalJSHeapSize: 123456789,
  usedJSHeapSize: 98765432,
  jsHeapSizeLimit: 2147483648,
  memoryUsagePercentage: 80.1,
  dashboardUid: "dashboard-123",
  dashboardTitle: "My Dashboard"
}
```

### ASCII Memory Graph Visualization

For visual debugging of memory trends, the dashboard memory monitoring system provides an on-demand ASCII graph generator available through the browser debug interface.

#### Enable Graph Visualization

First, enable memory debug logging:

```javascript
localStorage.setItem('grafana.debug.memory', 'true');
```

#### Generate ASCII Graph

Access the graph visualization functions via the debug interface:

```javascript
// Render ASCII memory graph
_debug.dashboardMemory.drawGraph();

// Get raw measurement history data
_debug.dashboardMemory.getHistory();
```

#### Example ASCII Graph Output

```
📊 Memory Usage (MB) [Dashboard: my-dashboard-title] [Last 15 measurements]
 280 |                          .  .     .
 260 |    .  . .   .         . .      . .
 240 | .  .    .   . . .   .         .   . .
 220 |.              .   .               .
     └───────────────────────────────────────────
     0    5    10   15   20   25   30   (count)
Usage: 224MB/4096MB (5%) → +0.1MB/min
📈 Call: _debug.dashboardMemory.getHistory() for raw data
```

#### Debug Interface Commands

| Command                               | Description                             |
| ------------------------------------- | --------------------------------------- |
| `_debug.dashboardMemory.drawGraph()`  | Render ASCII memory trend visualization |
| `_debug.dashboardMemory.getHistory()` | Return array of raw measurement data    |

#### Browser Compatibility

The ASCII graph visualization requires:

- Debug mode enabled (`localStorage.getItem('grafana.debug.memory') === 'true'`)
- Memory monitoring active on current dashboard
- Browser console access
- At least one memory measurement recorded

## Troubleshooting

### Common Issues

#### No Memory Data

**Symptoms**: All memory values are 0 or undefined
**Causes**:

- Browser doesn't support `performance.memory` (Safari)
- Running in incognito/private mode
- Firefox flag not enabled

**Solutions**:

- Use Chrome/Edge for full functionality
- Enable Firefox flag: `dom.enable_performance_memory = true`
- Accept graceful degradation in Safari

#### Memory Monitoring Not Starting

**Symptoms**: No measurements captured
**Causes**:

- Dashboard not configured in `dashboard_memory_monitoring`
- Scene behavior not attached
- Configuration parsing error

**Debug Steps**:

1. Check configuration:

```bash
grep -A 2 "\[dashboards\]" /path/to/grafana.ini
```

2. Enable debug logging:

```javascript
localStorage.setItem('grafana.debug.memory', 'true');
```

3. Verify dashboard UID in configuration

## Performance Considerations

### Memory API Limitations

- Chrome/Edge: Full functionality
- Firefox: Requires manual flag enablement
- Safari: No memory data but graceful degradation
- Memory values may be rounded for privacy

## Related Documentation

- [Dashboard Render Performance Profiling](./dashboard-render-performance-profiling.md)
- [Grafana Configuration Documentation](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/)
- [Browser Performance Memory API](https://developer.mozilla.org/en-US/docs/Web/API/Performance/memory)
