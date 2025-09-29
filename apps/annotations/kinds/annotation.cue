package annotation

annotationv0alpha1: {
  kind: "Annotation"
  plural: "annotations"
  scope: "Namespaced"
  schema: {
    spec: {
      text: string
      time: int64 
      timeEnd?: int64
      dashboardUID?: string  
      panelID?: int64   
      alertUID?: string 
      tags?: [...string]
      data?: _         
      prevState?: string 
      newState?: string  
    }
  }
}
