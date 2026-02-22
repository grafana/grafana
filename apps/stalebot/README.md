# Stalebot App

The Stalebot app is a Grafana application that helps track and manage stale dashboards. It monitors dashboards for inactivity based on configurable thresholds and provides visibility into which dashboards are no longer being actively used.

## Overview

The app introduces a new Kubernetes-style resource called `StaleDashboardTracker` that allows you to configure monitoring for specific dashboards. The reconciler periodically checks dashboard activity and updates the status to reflect whether a dashboard has become stale.

## Features

- Track dashboard staleness based on view activity
- Track dashboard staleness based on update activity
- Configurable threshold (in days) for determining staleness
- Optional notification support for stale dashboards
- Status reporting with last accessed/updated timestamps

## Resource: StaleDashboardTracker

### Spec Fields

- `dashboardUID` (string, required): The UID of the dashboard to track
- `staleDaysThreshold` (int32, required): Number of days of inactivity before a dashboard is considered stale (1-365)
- `trackViews` (bool, default: true): Whether to check dashboard view activity
- `trackUpdates` (bool, default: true): Whether to check dashboard update activity
- `notification` (optional): Notification settings
  - `enabled` (bool): Enable notifications for stale dashboards
  - `channels` ([]string): List of notification channels to use

### Status Fields

- `isStale` (bool): Whether the dashboard is currently stale
- `lastAccessedTime` (string): Timestamp of last dashboard access
- `lastUpdatedTime` (string): Timestamp of last dashboard update
- `daysSinceActivity` (int32): Number of days since last activity
- `lastCheckedTime` (string): Timestamp of last staleness check
- `observedGeneration` (int64): Last processed generation of the spec
- `conditions` (array): Status conditions

## Example

```yaml
apiVersion: stalebot.grafana.app/v1alpha1
kind: StaleDashboardTracker
metadata:
  name: my-dashboard-tracker
  namespace: default
spec:
  dashboardUID: 'abc123'
  staleDaysThreshold: 30
  trackViews: true
  trackUpdates: true
  notification:
    enabled: true
    channels:
      - 'slack-channel'
```

## Development

### Prerequisites

- Go 1.26+
- Grafana App SDK v0.51.3

### Building

```bash
cd apps/stalebot
make generate
go build ./...
```

### Generating Code

After modifying CUE definitions in the `kinds/` directory:

```bash
make generate
```

This will regenerate the Go types in `pkg/apis/`.

## Configuration

The app accepts the following configuration options:

- `DefaultStaleDaysThreshold` (int32): Default threshold if not specified per tracker
- `CheckIntervalMinutes` (int): How often to run staleness checks
- `EnableNotifications` (bool): Global toggle for notifications

## TODO

The following features are planned but not yet implemented:

- [ ] Integration with dashboard API to fetch last accessed/updated times
- [ ] Actual staleness calculation logic
- [ ] Notification system integration
- [ ] Status condition management
- [ ] Validation of dashboardUID existence
- [ ] Reconciler client initialization

## API Group

`stalebot.grafana.app/v1alpha1`
