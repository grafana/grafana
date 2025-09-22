package kinds

annotations: {
  kind:    "Annotation"
  pluralName:  "Annotations"
  validation: operations: ["CREATE"] // must have title or text
  schema: {
    spec: {
      // Display text (supports markdown)
      text: string

      // Query tags
      tags?: [...string]

      // milliseconds to draw the annotation
			epoch: int64	

      // when the annotation is a range, this is the right side
			epochEnd?: int64	

      dashboard?: #Dashboard

			// The source alert data
      alert?: #Alert
    }

		#Dashboard: {
			name: string
			panel?: int64  
		}

		#Alert: {
			id?: int64
			name: string
			prevState: string  
			newState: string  
			data: [string]: _ 
		}
  }
}
