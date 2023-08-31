export enum NodeGraphDataFrameFieldNames {
  // Unique identifier [required] [nodes + edges]
  id = 'id',
  // Text to show under the node [nodes]
  title = 'title',
  // Text to show under the node as second line [nodes]
  subTitle = 'subtitle',
  // Main value to be shown inside the node [nodes]
  mainStat = 'mainstat',
  // Second value to be shown inside the node under the mainStat [nodes]
  secondaryStat = 'secondarystat',
  // Prefix for fields which value will represent part of the color circle around the node, values should add up to 1 [nodes]
  arc = 'arc__',
  // Will show a named icon inside the node circle if defined. Can be used only with icons already available in
  // grafana/ui [nodes]
  icon = 'icon',
  // Defines a single color if string (hex or html named value) or color mode config can be used as threshold or
  // gradient. arc__ fields must not be defined if used [nodes]
  color = 'color',

  // Id of the source node [required] [edges]
  source = 'source',
  // The source name [required] [edges]
  sourceName = 'sourceName',
  // When the server includes a namespace, the source namespace [edges]
  sourceNamespace = 'sourceNamespace',
  // Id of the target node [required] [edges]
  target = 'target',
  // The target name [required] [edges]
  targetName = 'targetName',
  // When the server includes a namespace, the target namespace [edges]
  targetNamespace = 'targetNamespace',

  // Prefix for fields which will be shown in a context menu [nodes + edges]
  detail = 'detail__',
}
