// Package remote provides integration with remote Alertmanagers (e.g., Mimir)
// allowing Grafana to replace its internal Alertmanager with an external one.
//
// # Overview
//
// The remote Alertmanager feature enables Grafana to use an external Alertmanager
// implementation (such as Mimir) instead of or alongside its internal Alertmanager.
// This is useful for:
//   - Scaling alerting beyond a single Grafana instance
//   - Centralized alert management across multiple Grafana instances
//   - Migration from internal to external Alertmanager implementations
//
// # Operating Modes
//
// The package supports two operating modes:
//
// ## Primary Mode (RemotePrimaryForkedAlertmanager)
//
// In Primary mode, the remote Alertmanager is the source of truth:
//   - All read operations (silences, alerts, status) go to the remote Alertmanager
//   - All write operations (create/delete silences, config changes) go to the remote Alertmanager first
//   - The internal Alertmanager runs in parallel for comparison and rollback purposes
//   - Internal Alertmanager errors are logged but don't fail operations
//   - Use this mode when migrating to or running primarily on a remote Alertmanager
//
// ## Secondary Mode (RemoteSecondaryForkedAlertmanager)
//
// In Secondary mode, the internal Alertmanager is the source of truth:
//   - All read operations go to the internal Alertmanager
//   - All write operations go to the internal Alertmanager
//   - Configuration is periodically synced to the remote Alertmanager in the background
//   - State (silences, notification log) can be fetched from remote and merged at startup
//   - Remote Alertmanager errors are logged but don't fail operations
//   - Use this mode when running primarily on internal Alertmanager but want to replicate to remote
//
// # Configuration Flow
//
// Configuration synchronization follows this flow:
//
//  1. Configuration is loaded and decrypted
//  2. Auto-generated routes are added (for contact points)
//  3. Configuration hash is calculated for comparison
//  4. Configuration is compared with remote (if already exists)
//  5. If different, configuration is uploaded to remote
//
// The configuration sync respects a configurable interval to avoid overwhelming
// the remote Alertmanager with frequent updates.
//
// # State Synchronization
//
// State synchronization handles silences and notification logs:
//
// ## Primary Mode State Flow:
//   - State is uploaded from internal to remote on startup
//   - Ongoing state changes happen directly on remote
//
// ## Secondary Mode State Flow:
//   - State can be fetched from remote and merged with internal at startup
//   - State is uploaded from internal to remote on shutdown
//   - This allows graceful migration between instances
//
// State is encoded as protobuf messages containing three parts:
//   - "sil:<tenantID>": Silence state
//   - "nfl:<tenantID>": Notification log entries
//   - "fls:<tenantID>": Flush log entries
//
// # Usage
//
// To use a remote Alertmanager, configure it via the factory functions:
//
//	// For Primary mode:
//	factory := NewRemotePrimaryFactory(cfg, store, crypto, autogenFn, metrics, tracer)
//	multiOrgAM.SetAlertmanagerFactory(factory)
//
//	// For Secondary mode:
//	factory := NewRemoteSecondaryFactory(cfg, store, cfgStore, syncInterval, crypto, autogenFn, metrics, tracer, withRemoteState)
//	multiOrgAM.SetAlertmanagerFactory(factory)
//
// The factory wraps the default Alertmanager factory and creates forked
// instances that coordinate between internal and remote implementations.
package remote
