package apis

// This is used to collect all the apis before starting the api-server
type GroupBuilderCollection struct {
	builders []APIGroupBuilder
}

func ProvideGroupBuilderCollection() *GroupBuilderCollection {
	return &GroupBuilderCollection{
		builders: make([]APIGroupBuilder, 0),
	}
}

func (c *GroupBuilderCollection) AddAPI(b APIGroupBuilder) error {
	c.builders = append(c.builders, b)
	return nil
}

func (c *GroupBuilderCollection) GetAPIs() []APIGroupBuilder {
	return c.builders
}
