package investigations

// Collectable represents an item collected during investigation
#Collectable: {
	id:             string
	createdAt:      string
	
	title:          string
	origin:         string
	type:           string
	queries:        [...string] // +listType=atomic
	timeRange:      #TimeRange
	datasource:     #DatasourceRef
	url:            string
	logoPath?:      string

	note: 	        string
	noteUpdatedAt:  string

	fieldConfig:    string
}

#CollectableSummary: {
	id: string
	title: string
	logoPath: string
	origin: string
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
