// This package provides an adapter layer between Grafana's background service registry
// and dskit's module and service managers. It enables Grafana background services to integrate
// with dskit's well-defined service states (New → Starting → Running → Stopping → Terminated)
// and module initialization order, allowing them to benefit from:
//
//   - Coordinated service initialization
//   - Observable service states and health monitoring
//   - Graceful shutdown with proper cleanup ordering
//
// Background services that don't already implement the dskit's NamedService interface are
// automatically wrapped with dskit's BasicService and registered with dskit's module Manager.
package adapter
