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
  // gradient. arc__ fields must not be defined if used [nodes + edges]
  color = 'color',

  // Id of the source node [required] [edges]
  source = 'source',
  // Id of the target node [required] [edges]
  target = 'target',

  // Prefix for fields which will be shown in a context menu [nodes + edges]
  detail = 'detail__',

  // Radius of the node [nodes]
  nodeRadius = 'noderadius',

  // Thickness of the edge [edges]
  thickness = 'thickness',

  // Whether the node or edge should be highlighted (e.g., shown in red) in the UI [nodes + edges]
  // @deprecated -- for edges use color instead
  highlighted = 'highlighted',

  // Defines the stroke dash array for the edge [edges]. See SVG strokeDasharray definition for syntax.
  strokeDasharray = 'strokedasharray',

  // Supplies a fixed X position for the node to have in the finished graph.
  fixedX = 'fixedx',

  // Supplies a fixed Y position for the node to have in the finished graph.
  fixedY = 'fixedy',

  // Whether the node is instrumented or not
  isInstrumented = 'isinstrumented',
}
