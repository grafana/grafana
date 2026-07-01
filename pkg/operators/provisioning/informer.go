package provisioning

// natsWatch reports whether the controllers take their deltas from NATS. When
// they do, there is no informer cache (the NATS-backed informer keeps none), so
// the controllers reconcile through a client-backed getter reading from the API.
func (c *ControllerConfig) natsWatch() bool {
	return c.natsSubscriber != nil && c.natsSubscriber.Enabled()
}
