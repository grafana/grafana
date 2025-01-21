package checks

var factories = []Factory{}

// AddFactory adds a check factory to the list.
func AddFactory(r Factory) {
	factories = append(factories, r)
}

// GetFactories returns the list of check factories.
func GetFactories() []Factory {
	return factories
}
