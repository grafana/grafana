package kinds

annotations: {
  kind:    "Annotation"
  pluralName:  "Annotations"
  schema: {
    spec: {
      // Display text (supports markdown)
      text: string

      // Query tags
      tags?: [...string]

      // milliseconds to draw the annotation
      time: int64  

      // when the annotation is a range, this is the right side
      timeEnd?: int64  

      // Display the annotation on a specific dashboard + panel
      dashboard?: #Dashboard

      // The source alert data
      alert?: #Alert
    }

    #Dashboard: {
      name: string // The dashboard k8s name (grafana UID)
      panel?: int64  
    }

    #Alert: {
      id?: int64
      name: string // The alert k8s name (grafana UID)
      prevState: string  
      newState: string  
      data: [string]: _  // TODO? is there a more specific model
    }
  }
}
