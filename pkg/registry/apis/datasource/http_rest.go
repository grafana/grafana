package datasource

func (b *DataSourceAPIBuilder) initHTTPHandlers() {
	b.handlers = NewHTTPHandlers(HTTPHandlerOptions{
		Group:                b.GetGroupVersion().Group,
		PluginID:             b.pluginJSON.ID,
		HandlerOrigin:        b.cfg.HandlerOrigin,
		Client:               b.client,
		PluginContext:        b.getPluginContext,
		ContextProvider:      b.contextProvider,
		Datasources:          b.datasources,
		RequestValidator:     b.dataSourceRequestValidator,
		EnableChunkedQueries: b.cfg.EnableChunkedQueryStreaming,
	})
}
