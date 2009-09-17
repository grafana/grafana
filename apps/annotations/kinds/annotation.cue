package annotation

annotationv0alpha1: {
  kind: "Annotation"
  plural: "annotations"
  scope: "Namespaced"
  // validation: {
  //   operations: [
  //     "CREATE",
  //     "UPDATE",
  //   ]
  // }
  // mutation: {
  //   operations: [
  //     "CREATE",
  //     "UPDATE",
  //   ]
  // }
  schema: {
    spec: {
      // Core annotation content (required)
      text: string
      
      // Time range
      time: int64  // Start time (epoch milliseconds)
      timeEnd?: int64  // End time (epoch milliseconds) - optional for point annotations
      
      // Scoping - either organization or dashboard/panel level
      dashboardUID?: string  // Dashboard UID for dashboard-scoped annotations
      panelId?: int64       // Panel ID for panel-scoped annotations
      
      // Alert-related fields
      alertId?: int64       // Legacy alert ID (deprecated, comment out if issues)
      // alertUID?: string  // Alert UID - commented out as not in DB schema yet
      
      // User-defined metadata
      tags?: [...string]    // Array of tags for filtering/categorization
      data?: _              // Additional arbitrary JSON data
      
      // Alert state tracking (for alert annotations)
      prevState?: string    // Previous alert state
      newState?: string     // New alert state
    }
    
    status?: {
      // System metadata (read-only)
      created?: int64      // Creation timestamp (epoch milliseconds)
      updated?: int64      // Last update timestamp (epoch milliseconds)
      
      // User information (populated by system)
      userId?: int64       // Internal user ID
      userLogin?: string   // User login name
      userEmail?: string   // User email
      avatarUrl?: string   // User avatar URL
      
      // Alert information (for alert annotations)
      alertName?: string   // Alert rule name
      
      // Legacy fields (may be removed in future)
      // dashboardId?: int64  // Legacy dashboard ID (deprecated)
      // type?: string        // Legacy type field
      // title?: string       // Legacy title field
    }
  }
}
