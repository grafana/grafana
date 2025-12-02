package preferences

datasourcestacksV1alpha1: {
  kind: "DataSourceStack"
  pluralName: "DataSourceStacks"
  scope: "Namespaced"
  schema: {
    spec: {
      template: TemplateSpec
      modes: [...ModeSpec]
    }
  }
}


TemplateSpec: {
  [string]: DataSourceStackTemplateItem
}

DataSourceStackTemplateItem: {
  group: string // type
  name: string // variable name / display name
}

ModeSpec: {
  name: string
  uid: string
  definition: Mode
}

Mode: [string]: ModeItem

ModeItem: {
  dataSourceRef: string // grafana data source uid
}
