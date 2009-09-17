package annotation

manifest: {
  appName: "annotation"  // Singular form
  groupOverride: "annotation.grafana.app"  // Match our pkg/apis implementation
  versions: {
    "v0alpha1": {
      codegen: {
        ts: {enabled: false}  // Disable TypeScript generation for now
        go: {enabled: true}   // Enable Go generation
      }
      kinds: [
        annotationv0alpha1,
      ]
    }
  }
}
