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
	{
		Type:        SubscriberTypeMultiple,
		Description: "apply multiple subscribers",
	},
	{
		Type:        SubscriberTypeAuthorizeRole,
		Description: "authorize user role",
	},
}

var OutputsRegistry = []EntityInfo{
	{
		Type:        OutputTypeManagedStream,
		Description: "Only send schema when structure changes.  Note this also requires a matching subscriber",
		Example:     ManagedStreamOutputConfig{},
	},
	{
		Type:        OutputTypeMultiple,
		Description: "Send the output to multiple destinations",
		Example:     MultipleOutputterConfig{},
	},
	{
		Type:        OutputTypeConditional,
		Description: "send to an output depending on frame values",
		Example:     ConditionalOutputConfig{},
	},
	{
		Type: OutputTypeRedirect,
	},
	{
		Type: OutputTypeThreshold,
	},
	{
		Type: OutputTypeChangeLog,
	},
	{
		Type: OutputTypeRemoteWrite,
	},
}

var ConvertersRegistry = []EntityInfo{
	{
		Type: ConverterTypeJsonAuto,
	},
	{
		Type: ConverterTypeJsonExact,
	},
	{
		Type:        ConverterTypeInfluxAuto,
		Description: "accept influx line protocol",
		Example:     AutoInfluxConverterConfig{},
	},
	{
		Type: ConverterTypeJsonFrame,
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
	{
		Type:        ProcessorTypeMultiple,
		Description: "apply multiple processors",
		Example:     MultipleProcessorConfig{},
	},
}
