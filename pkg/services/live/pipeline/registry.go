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

var FrameOutputsRegistry = []EntityInfo{
	{
		Type:        FrameOutputTypeManagedStream,
		Description: "only send schema when structure changes (note this also requires a matching subscriber)",
		Example:     ManagedStreamOutputConfig{},
	},
	{
		Type:        FrameOutputTypeConditional,
		Description: "send to an output depending on frame values",
		Example:     ConditionalOutputConfig{},
	},
	{
		Type:        FrameOutputTypeRedirect,
		Description: "redirect for processing by another channel rule",
	},
	{
		Type:        FrameOutputTypeThreshold,
		Description: "output field threshold boundaries cross into new channel",
	},
	{
		Type:        FrameOutputTypeChangeLog,
		Description: "output field changes into new channel",
	},
	{
		Type:        FrameOutputTypeRemoteWrite,
		Description: "output to remote write endpoint",
	},
	{
		Type:        FrameOutputTypeLoki,
		Description: "output frame as JSON to Loki",
	},
}

var ConvertersRegistry = []EntityInfo{
	{
		Type:        ConverterTypeJsonAuto,
		Description: "automatic recursive JSON to Frame conversion",
	},
	{
		Type:        ConverterTypeInfluxAuto,
		Description: "accept influx line protocol",
		Example: AutoInfluxConverterConfig{
			FrameFormat: "labels_column",
		},
	},
	{
		Type:        ConverterTypeJsonFrame,
		Description: "JSON-encoded Grafana data frame",
	},
}

var FrameProcessorsRegistry = []EntityInfo{
	{
		Type:        FrameProcessorTypeKeepFields,
		Description: "list the fields that should stay",
		Example:     KeepFieldsFrameProcessorConfig{},
	},
	{
		Type:        FrameProcessorTypeDropFields,
		Description: "list the fields that should be removed",
		Example:     DropFieldsFrameProcessorConfig{},
	},
}

var DataOutputsRegistry = []EntityInfo{
	{
		Type:        DataOutputTypeBuiltin,
		Description: "use builtin publish handler",
	},
	{
		Type:        DataOutputTypeRedirect,
		Description: "redirect data processing to another channel rule",
	},
	{
		Type:        DataOutputTypeLoki,
		Description: "output data to Loki as logs",
	},
}
