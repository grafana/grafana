package preferences

datasourcestacksV1alpha1: {
  kind: "Datasources"
  pluralName: "Datasource"
  scope: "Namespaced"
  schema: {
    spec: {
      template: TemplateSpec
      modes: [...Mode]
    }
  }
}


TemplateSpec: {
  [string]: DataSourceTemplateSpec
}

DataSourceTemplateSpec: {
  group: string // type
  name: string // variable name / display name
}

Mode: {
  name: string
  uid: string
  definition: ModeSpec
}

ModeSpec: [string]: DataSourceRef

DataSourceRef: {
  name: string // grafana data source uid
}
