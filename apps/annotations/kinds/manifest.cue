package kinds

manifest: {
  appName: "annotations"
  groupOverride: "annotation.grafana.app"
  versions: {
    "v0alpha1": v0alpha1
  }
}

v0alpha1: {
  kinds: [annotations]
  served: true
  codegen: {
    ts: {
      enabled: false
    }
    go: {
      enabled: true
    }
  }
}
