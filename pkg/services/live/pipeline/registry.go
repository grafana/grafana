package pipeline

type EntityInfo struct {
	Type        string      `json:"type"`
	Description string      `json:"description"`
	Example     interface{} `json:"example,omitempty"`
}

var SubscribersRegistry = []EntityInfo{
	{
		Type:        SubscriberTypeBuiltin,
		Description: "apply builtin feature subscribe logic",
	},
	{
		Type:        SubscriberTypeManagedStream,
		Description: "apply managed stream subscribe logic",
	},
}

var OutputsRegistry = []EntityInfo{
	{
		Type:        OutputTypeManagedStream,
		Description: "only send schema when structure changes (note this also requires a matching subscriber)",
		Example:     ManagedStreamOutputConfig{},
	},
	{
		Type:        OutputTypeConditional,
		Description: "send to an output depending on frame values",
		Example:     ConditionalOutputConfig{},
	},
	{
		Type:        OutputTypeRedirect,
		Description: "redirect for processing by another channel rule",
	},
	{
		Type:        OutputTypeThreshold,
		Description: "output field threshold boundaries cross into new channel",
	},
	{
		Type:        OutputTypeChangeLog,
		Description: "output field changes into new channel",
	},
	{
		Type:        OutputTypeRemoteWrite,
		Description: "output to remote write endpoint",
	},
}

var ConvertersRegistry = []EntityInfo{
	{
		Type:        ConverterTypeJsonAuto,
		Description: "automatic recursive JSON to Frame conversion",
	},
	{
		Type:        ConverterTypeJsonExact,
		Description: "JSON to Frame conversion according to exact list of fields",
	},
	{
		Type:        ConverterTypeInfluxAuto,
		Description: "accept influx line protocol",
		Example:     AutoInfluxConverterConfig{},
	},
	{
		Type:        ConverterTypeJsonFrame,
		Description: "JSON-encoded Grafana data frame",
	},
}

var ProcessorsRegistry = []EntityInfo{
	{
		Type:        ProcessorTypeKeepFields,
		Description: "list the fields that should stay",
		Example:     KeepFieldsProcessorConfig{},
	},
	{
		Type:        ProcessorTypeDropFields,
		Description: "list the fields that should be removed",
		Example:     DropFieldsProcessorConfig{},
	},
}
