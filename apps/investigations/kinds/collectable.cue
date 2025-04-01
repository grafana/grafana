package investigations

// Collectable represents an item collected during investigation
#Collectable: {
	id:             string
	createdAt:      string
	
	title:          string
	origin:         string
	type:           string
	queries:        [...#Query] // +listType=atomic
	timeRange:      #TimeRange
	datasource:     #DatasourceRef
	url:            string
	logoPath?:      string

	note: 	        string
	noteUpdatedAt:  string
}

#CollectableSummary: {
	id: string
	title: string
	logoPath: string
	origin: string
}

// Query represents a data query
#Query: {
	refId:               string
	queryType:           string
	editorMode:          string
	supportingQueryType: string
	legendFormat:        string
	expr:               string
} 

// TimeRange represents a time range with both absolute and relative values
#TimeRange: {
	from: string
	to:   string
	raw: {
		from: string
		to:   string
	}
} 

// DatasourceRef is a reference to a datasource
#DatasourceRef: {
	uid: string
} 
