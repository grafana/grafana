package kindsys

// Values in this file relate to the logic for producing summaries - the indexed form of objects.

#SummaryCore: {
	// summaryHandler determines what summarizer will be used for a given kind.
	//
	// Core kinds may rely entirely on the generic summarizer, or may opt to
	// write their own summarizer in Go.
	summaryHandler: "generic" | *"passthrough"
}

#SummaryCustom: {
	#SummaryCore
	// Custom kinds may only rely on generic summarization.
	summaryHandler: "generic"
}

//{
// TODO eventually we want to generate funcs for additional field indexing
//	summaryHandler: "perField"
//}
