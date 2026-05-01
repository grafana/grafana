// Code generated - EDITING IS FUTILE. DO NOT EDIT.
// Run `yarn ts-node --transpile-only scripts/codegen/gen-zod.ts` from the repository root to regenerate.
// Source: apps/dashboard/kinds/v2beta1/*.cue (via cue def --out openapi).
import { z } from 'zod/v4';

export const actionSchema = z.object({
  get type() {
    return actionTypeSchema;
  },
  title: z.string(),
  get fetch() {
    return fetchOptionsSchema.optional();
  },
  get infinity() {
    return infinityOptionsSchema.optional();
  },
  confirmation: z.optional(z.string()),
  oneClick: z.optional(z.boolean()),
  get variables() {
    return z.array(actionVariableSchema).optional();
  },
  style: z.optional(
    z.object({
      backgroundColor: z.optional(z.string()),
    })
  ),
});

export const actionTypeSchema = z.enum(['fetch', 'infinity']);

export const actionVariableSchema = z.object({
  key: z.string(),
  name: z.string(),
  get type() {
    return actionVariableTypeSchema.describe('Action variable type');
  },
});

/**
 * @description Action variable type
 */
export const actionVariableTypeSchema = z.enum(['string']).describe('Action variable type');

/**
 * @description Define the AdHocFilterWithLabels type
 */
export const adHocFilterWithLabelsSchema = z
  .object({
    key: z.string(),
    operator: z.string(),
    value: z.string(),
    values: z.optional(z.array(z.string())),
    keyLabel: z.optional(z.string()),
    valueLabels: z.optional(z.array(z.string())),
    forceEdit: z.optional(z.boolean()),
    get origin() {
      return filterOriginSchema.describe('Determine the origin of the adhoc variable filter').optional();
    },
    condition: z.optional(z.string().describe('@deprecated')),
  })
  .describe('Define the AdHocFilterWithLabels type');

/**
 * @description Adhoc variable kind
 */
export const adhocVariableKindSchema = z
  .object({
    kind: z.enum(['AdhocVariable']),
    group: z.string(),
    labels: z.optional(z.object({}).catchall(z.string())),
    datasource: z.optional(
      z.object({
        name: z.optional(z.string()),
      })
    ),
    get spec() {
      return adhocVariableSpecSchema.describe('Adhoc variable specification');
    },
  })
  .describe('Adhoc variable kind');

/**
 * @description Adhoc variable specification
 */
export const adhocVariableSpecSchema = z
  .object({
    name: z.string().default(''),
    get baseFilters() {
      return z.array(adHocFilterWithLabelsSchema.describe('Define the AdHocFilterWithLabels type'));
    },
    get filters() {
      return z.array(adHocFilterWithLabelsSchema.describe('Define the AdHocFilterWithLabels type'));
    },
    get defaultKeys() {
      return z.array(metricFindValueSchema.describe('Define the MetricFindValue type'));
    },
    label: z.optional(z.string()),
    get hide() {
      return variableHideSchema
        .default('dontHide')
        .describe(
          'Determine if the variable shows on dashboard\nAccepted values are `dontHide` (show label and value), `hideLabel` (show value only), `hideVariable` (show nothing), `inControlsMenu` (show in a drop-down menu).'
        );
    },
    skipUrlSync: z.boolean().default(false),
    description: z.optional(z.string()),
    allowCustomValue: z.boolean().default(true),
    enableGroupBy: z.optional(
      z.boolean().default(false).describe('Whether the group-by operator is enabled in the ad hoc filter combobox.')
    ),
    get origin() {
      return datasourceControlSourceRefSchema
        .describe('Source information for controls (e.g. variables or links)')
        .optional();
    },
  })
  .describe('Adhoc variable specification');

/**
 * @description Annotation event field mapping. Defines how to map a data frame field to an annotation event field.
 */
export const annotationEventFieldMappingSchema = z
  .object({
    get source() {
      return annotationEventFieldSourceSchema
        .default('field')
        .describe(
          'Annotation event field source. Defines how to obtain the value for an annotation event field.\n- "field": Find the value with a matching key (default)\n- "text": Write a constant string into the value\n- "skip": Do not include the field'
        )
        .optional();
    },
    value: z.optional(z.string().describe('Constant value to use when source is "text"')),
    regex: z.optional(z.string().describe('Regular expression to apply to the field value')),
  })
  .describe('Annotation event field mapping. Defines how to map a data frame field to an annotation event field.');

/**
 * @description Annotation event field source. Defines how to obtain the value for an annotation event field.\n- \"field\": Find the value with a matching key (default)\n- \"text\": Write a constant string into the value\n- \"skip\": Do not include the field
 */
export const annotationEventFieldSourceSchema = z
  .enum(['field', 'text', 'skip'])
  .default('field')
  .describe(
    'Annotation event field source. Defines how to obtain the value for an annotation event field.\n- "field": Find the value with a matching key (default)\n- "text": Write a constant string into the value\n- "skip": Do not include the field'
  );

export const annotationPanelFilterSchema = z.object({
  exclude: z.optional(z.boolean().default(false).describe('Should the specified panels be included or excluded')),
  ids: z.array(z.int().min(0).max(2147483647)).describe('Panel IDs that should be included or excluded'),
});

export const annotationQueryKindSchema = z.object({
  kind: z.literal('AnnotationQuery').optional().default('AnnotationQuery'),
  get spec() {
    return annotationQuerySpecSchema;
  },
});

/**
 * @description Annotation Query placement. Defines where the annotation query should be displayed.\n- \"inControlsMenu\" renders the annotation query in the dashboard controls dropdown menu
 */
export const annotationQueryPlacementSchema = z
  .enum(['inControlsMenu'])
  .describe(
    'Annotation Query placement. Defines where the annotation query should be displayed.\n- "inControlsMenu" renders the annotation query in the dashboard controls dropdown menu'
  );

export const annotationQuerySpecSchema = z.object({
  get query() {
    return dataQueryKindSchema;
  },
  enable: z.boolean(),
  hide: z.boolean(),
  iconColor: z.string(),
  name: z.string(),
  builtIn: z.optional(z.boolean().default(false)),
  get filter() {
    return annotationPanelFilterSchema.optional();
  },
  get placement() {
    return annotationQueryPlacementSchema
      .describe(
        'Annotation Query placement. Defines where the annotation query should be displayed.\n- "inControlsMenu" renders the annotation query in the dashboard controls dropdown menu'
      )
      .optional();
  },
  mappings: z.optional(
    z
      .object({})
      .catchall(
        z
          .lazy(() => annotationEventFieldMappingSchema)
          .describe(
            'Annotation event field mapping. Defines how to map a data frame field to an annotation event field.'
          )
      )
      .describe('Mappings define how to convert data frame fields to annotation event fields.')
  ),
  legacyOptions: z.optional(
    z
      .object({})
      .describe('Catch-all field for datasource-specific properties. Should not be available in as code tooling.')
  ),
});

export const autoGridLayoutItemKindSchema = z.object({
  kind: z.literal('AutoGridLayoutItem').optional().default('AutoGridLayoutItem'),
  get spec() {
    return autoGridLayoutItemSpecSchema;
  },
});

export const autoGridLayoutItemSpecSchema = z.object({
  get element() {
    return elementReferenceSchema;
  },
  get repeat() {
    return autoGridRepeatOptionsSchema.optional();
  },
  get conditionalRendering() {
    return conditionalRenderingGroupKindSchema.optional();
  },
});

export const autoGridLayoutKindSchema = z.object({
  kind: z.enum(['AutoGridLayout']),
  get spec() {
    return autoGridLayoutSpecSchema;
  },
});

export const autoGridLayoutSpecSchema = z.object({
  maxColumnCount: z.optional(z.number().default(3)),
  columnWidthMode: z.enum(['standard', 'narrow', 'wide', 'custom']).default('standard'),
  columnWidth: z.optional(z.number()),
  rowHeightMode: z.enum(['standard', 'short', 'tall', 'custom']).default('standard'),
  rowHeight: z.optional(z.number()),
  fillScreen: z.optional(z.boolean().default(false)),
  get items() {
    return z.array(autoGridLayoutItemKindSchema);
  },
});

export const autoGridRepeatOptionsSchema = z.object({
  get mode() {
    return repeatModeSchema;
  },
  value: z.string(),
});

export const conditionalRenderingDataKindSchema = z.object({
  kind: z.enum(['ConditionalRenderingData']),
  get spec() {
    return conditionalRenderingDataSpecSchema;
  },
});

export const conditionalRenderingDataSpecSchema = z.object({
  value: z.boolean(),
});

export const conditionalRenderingGroupKindSchema = z.object({
  kind: z.literal('ConditionalRenderingGroup').optional().default('ConditionalRenderingGroup'),
  get spec() {
    return conditionalRenderingGroupSpecSchema;
  },
});

export const conditionalRenderingGroupSpecSchema = z.object({
  visibility: z.enum(['show', 'hide']),
  condition: z.enum(['and', 'or']),
  get items() {
    return z.array(
      z.union([
        conditionalRenderingVariableKindSchema,
        conditionalRenderingDataKindSchema,
        conditionalRenderingTimeRangeSizeKindSchema,
      ])
    );
  },
});

export const conditionalRenderingTimeRangeSizeKindSchema = z.object({
  kind: z.enum(['ConditionalRenderingTimeRangeSize']),
  get spec() {
    return conditionalRenderingTimeRangeSizeSpecSchema;
  },
});

export const conditionalRenderingTimeRangeSizeSpecSchema = z.object({
  value: z.string(),
});

export const conditionalRenderingVariableKindSchema = z.object({
  kind: z.enum(['ConditionalRenderingVariable']),
  get spec() {
    return conditionalRenderingVariableSpecSchema;
  },
});

export const conditionalRenderingVariableSpecSchema = z.object({
  variable: z.string(),
  operator: z.enum(['equals', 'notEquals', 'matches', 'notMatches']),
  value: z.string(),
});

/**
 * @description Constant variable kind
 */
export const constantVariableKindSchema = z
  .object({
    kind: z.enum(['ConstantVariable']),
    get spec() {
      return constantVariableSpecSchema.describe('Constant variable specification');
    },
  })
  .describe('Constant variable kind');

/**
 * @description Constant variable specification
 */
export const constantVariableSpecSchema = z
  .object({
    name: z.string().default(''),
    query: z.string().default(''),
    get current() {
      return z
        .union([
          variableOptionSchema.and(z.any()),
          z.object({
            text: z.enum(['']),
            value: z.enum(['']),
          }),
        ])
        .default({});
    },
    label: z.optional(z.string()),
    get hide() {
      return variableHideSchema
        .default('dontHide')
        .describe(
          'Determine if the variable shows on dashboard\nAccepted values are `dontHide` (show label and value), `hideLabel` (show value only), `hideVariable` (show nothing), `inControlsMenu` (show in a drop-down menu).'
        );
    },
    skipUrlSync: z.boolean().default(false),
    description: z.optional(z.string()),
    get origin() {
      return datasourceControlSourceRefSchema
        .describe('Source information for controls (e.g. variables or links)')
        .optional();
    },
  })
  .describe('Constant variable specification');

/**
 * @description Source information for controls (e.g. variables or links)
 */
export const controlSourceRefSchema = z
  .object({
    type: z.enum(['datasource']),
    group: z.string().describe('The plugin type-id'),
  })
  .describe('Source information for controls (e.g. variables or links)');

/**
 * @description Custom formatter variable
 */
export const customFormatterVariableSchema = z
  .object({
    name: z.string(),
    get type() {
      return variableTypeSchema.describe(
        'Dashboard variable type\n`query`: Query-generated list of values such as metric names, server names, sensor IDs, data centers, and so on.\n`adhoc`: Key/value filters that are automatically added to all metric queries for a data source (Prometheus, Loki, InfluxDB, and Elasticsearch only).\n`constant`: \tDefine a hidden constant.\n`datasource`: Quickly change the data source for an entire dashboard.\n`interval`: Interval variables represent time spans.\n`textbox`: Display a free text input field with an optional default value.\n`custom`: Define the variable options manually using a comma-separated list.\n`system`: Variables defined by Grafana. See: https://grafana.com/docs/grafana/latest/dashboards/variables/add-template-variables/#global-variables'
      );
    },
    multi: z.boolean(),
    includeAll: z.boolean(),
  })
  .describe('Custom formatter variable');

/**
 * @description Custom variable kind
 */
export const customVariableKindSchema = z
  .object({
    kind: z.enum(['CustomVariable']),
    get spec() {
      return customVariableSpecSchema.describe('Custom variable specification');
    },
  })
  .describe('Custom variable kind');

/**
 * @description Custom variable specification
 */
export const customVariableSpecSchema = z
  .object({
    name: z.string().default(''),
    query: z.string().default(''),
    get current() {
      return variableOptionSchema.describe('Variable option specification');
    },
    get options() {
      return z.array(variableOptionSchema.describe('Variable option specification'));
    },
    multi: z.boolean().default(false),
    includeAll: z.boolean().default(false),
    allValue: z.optional(z.string()),
    label: z.optional(z.string()),
    get hide() {
      return variableHideSchema
        .default('dontHide')
        .describe(
          'Determine if the variable shows on dashboard\nAccepted values are `dontHide` (show label and value), `hideLabel` (show value only), `hideVariable` (show nothing), `inControlsMenu` (show in a drop-down menu).'
        );
    },
    skipUrlSync: z.boolean().default(false),
    description: z.optional(z.string()),
    allowCustomValue: z.boolean().default(true),
    valuesFormat: z.optional(z.enum(['csv', 'json'])),
    get origin() {
      return datasourceControlSourceRefSchema
        .describe('Source information for controls (e.g. variables or links)')
        .optional();
    },
  })
  .describe('Custom variable specification');

/**
 * @description Custom variable value
 */
export const customVariableValueSchema = z
  .object({
    get formatter() {
      return z
        .union([variableCustomFormatterFnSchema, z.string()])
        .describe('The format name or function used in the expression')
        .nullable();
    },
  })
  .describe('Custom variable value');

/**
 * @description \"Off\" for no shared crosshair or tooltip (default).\n\"Crosshair\" for shared crosshair.\n\"Tooltip\" for shared crosshair AND shared tooltip.
 */
export const dashboardCursorSyncSchema = z
  .enum(['Off', 'Tooltip', 'Crosshair'])
  .default('Off')
  .describe(
    '"Off" for no shared crosshair or tooltip (default).\n"Crosshair" for shared crosshair.\n"Tooltip" for shared crosshair AND shared tooltip.'
  );

/**
 * @description Dashboard Link placement. Defines where the link should be displayed.\n- \"inControlsMenu\" renders the link in bottom part of the dashboard controls dropdown menu
 */
export const dashboardLinkPlacementSchema = z
  .enum(['inControlsMenu'])
  .describe(
    'Dashboard Link placement. Defines where the link should be displayed.\n- "inControlsMenu" renders the link in bottom part of the dashboard controls dropdown menu'
  );

/**
 * @description Links with references to other dashboards or external resources
 */
export const dashboardLinkSchema = z
  .object({
    title: z.string().describe('Title to display with the link'),
    get type() {
      return dashboardLinkTypeSchema.describe(
        'Dashboard Link type. Accepted values are dashboards (to refer to another dashboard) and link (to refer to an external resource)'
      );
    },
    icon: z.string().describe('Icon name to be displayed with the link'),
    tooltip: z.string().describe('Tooltip to display when the user hovers their mouse over it'),
    url: z.optional(z.string().describe('Link URL. Only required/valid if the type is link')),
    tags: z
      .array(z.string())
      .describe(
        'List of tags to limit the linked dashboards. If empty, all dashboards will be displayed. Only valid if the type is dashboards'
      ),
    asDropdown: z
      .boolean()
      .default(false)
      .describe(
        'If true, all dashboards links will be displayed in a dropdown. If false, all dashboards links will be displayed side by side. Only valid if the type is dashboards'
      ),
    targetBlank: z.boolean().default(false).describe('If true, the link will be opened in a new tab'),
    includeVars: z
      .boolean()
      .default(false)
      .describe('If true, includes current template variables values in the link as query params'),
    keepTime: z.boolean().default(false).describe('If true, includes current time range in the link as query params'),
    get placement() {
      return dashboardLinkPlacementSchema
        .describe(
          'Dashboard Link placement. Defines where the link should be displayed.\n- "inControlsMenu" renders the link in bottom part of the dashboard controls dropdown menu'
        )
        .optional();
    },
    get origin() {
      return datasourceControlSourceRefSchema
        .describe('Source information for controls (e.g. variables or links)')
        .optional();
    },
  })
  .describe('Links with references to other dashboards or external resources');

/**
 * @description Dashboard Link type. Accepted values are dashboards (to refer to another dashboard) and link (to refer to an external resource)
 */
export const dashboardLinkTypeSchema = z
  .enum(['link', 'dashboards'])
  .describe(
    'Dashboard Link type. Accepted values are dashboards (to refer to another dashboard) and link (to refer to an external resource)'
  );

export const dashboardSpecSchema = z.object({
  get annotations() {
    return z.array(annotationQueryKindSchema);
  },
  get cursorSync() {
    return dashboardCursorSyncSchema
      .default('Off')
      .describe(
        '"Off" for no shared crosshair or tooltip (default).\n"Crosshair" for shared crosshair.\n"Tooltip" for shared crosshair AND shared tooltip.'
      );
  },
  description: z.optional(z.string().describe('Description of dashboard.')),
  editable: z.optional(z.boolean().default(true).describe('Whether a dashboard is editable or not.')),
  elements: z.object({}).catchall(z.union([z.lazy(() => elementSchema), z.any()]).default({})),
  get layout() {
    return z.union([gridLayoutKindSchema, rowsLayoutKindSchema, autoGridLayoutKindSchema, tabsLayoutKindSchema]);
  },
  get links() {
    return z
      .array(dashboardLinkSchema.describe('Links with references to other dashboards or external resources'))
      .describe('Links with references to other dashboards or external websites.');
  },
  liveNow: z.optional(
    z
      .boolean()
      .describe(
        'When set to true, the dashboard will redraw panels at an interval matching the pixel width.\nThis will keep data "moving left" regardless of the query refresh rate. This setting helps\navoid dashboards presenting stale live data.'
      )
  ),
  preload: z
    .boolean()
    .default(false)
    .describe("When set to true, the dashboard will load all panels in the dashboard when it's loaded."),
  revision: z.optional(
    z
      .int()
      .min(0)
      .max(65535)
      .describe(
        'Plugins only. The version of the dashboard installed together with the plugin.\nThis is used to determine if the dashboard should be updated when the plugin is updated.'
      )
  ),
  tags: z.array(z.string()).describe('Tags associated with dashboard.'),
  get timeSettings() {
    return timeSettingsSpecSchema.describe(
      'Time configuration\nIt defines the default time config for the time picker, the refresh picker for the specific dashboard.'
    );
  },
  title: z.string().describe('Title of dashboard.'),
  get variables() {
    return z.array(variableKindSchema).describe('Configured template variables.');
  },
});

export const dataLinkSchema = z.object({
  title: z.string(),
  url: z.string(),
  targetBlank: z.optional(z.boolean()),
});

export const dataQueryKindSchema = z.object({
  kind: z.literal('DataQuery').optional().default('DataQuery'),
  group: z.string(),
  version: z.string().default('v0'),
  labels: z.optional(z.object({}).catchall(z.string())),
  datasource: z.optional(
    z
      .object({
        name: z.optional(z.string()),
      })
      .describe(
        'New type for datasource reference\nNot creating a new type until we figure out how to handle DS refs for group by, adhoc, and every place that uses DataSourceRef in TS.'
      )
  ),
  spec: z.object({}),
});

/**
 * @description A topic is attached to DataFrame metadata in query results.\nThis specifies where the data should be used.
 */
export const dataTopicSchema = z
  .enum(['series', 'annotations', 'alertStates'])
  .describe(
    'A topic is attached to DataFrame metadata in query results.\nThis specifies where the data should be used.'
  );

/**
 * @description Transformations allow to manipulate data returned by a query before the system applies a visualization.\nUsing transformations you can: rename fields, join time series data, perform mathematical operations across queries,\nuse the output of one transformation as the input to another transformation, etc.
 */
export const dataTransformerConfigSchema = z
  .object({
    id: z.string().describe('Unique identifier of transformer'),
    disabled: z.optional(z.boolean().describe('Disabled transformations are skipped')),
    get filter() {
      return matcherConfigSchema
        .describe(
          'Matcher is a predicate configuration. Based on the config a set of field(s) or values is filtered in order to apply override / transformation.\nIt comes with in id ( to resolve implementation from registry) and a configuration that’s specific to a particular matcher type.'
        )
        .optional();
    },
    get topic() {
      return dataTopicSchema
        .describe(
          'A topic is attached to DataFrame metadata in query results.\nThis specifies where the data should be used.'
        )
        .optional();
    },
    options: z.any().describe('Options to be passed to the transformer\nValid options depend on the transformer id'),
  })
  .describe(
    'Transformations allow to manipulate data returned by a query before the system applies a visualization.\nUsing transformations you can: rename fields, join time series data, perform mathematical operations across queries,\nuse the output of one transformation as the input to another transformation, etc.'
  );

/**
 * @description Source information for controls (e.g. variables or links)
 */
export const datasourceControlSourceRefSchema = z
  .object({
    type: z.enum(['datasource']),
    group: z.string().describe('The plugin type-id'),
  })
  .describe('Source information for controls (e.g. variables or links)');

/**
 * @description Datasource variable kind
 */
export const datasourceVariableKindSchema = z
  .object({
    kind: z.enum(['DatasourceVariable']),
    get spec() {
      return datasourceVariableSpecSchema.describe('Datasource variable specification');
    },
  })
  .describe('Datasource variable kind');

/**
 * @description Datasource variable specification
 */
export const datasourceVariableSpecSchema = z
  .object({
    name: z.string().default(''),
    pluginId: z.string().default(''),
    get refresh() {
      return variableRefreshSchema
        .default('never')
        .describe(
          'Options to config when to refresh a variable\n`never`: Never refresh the variable\n`onDashboardLoad`: Queries the data source every time the dashboard loads.\n`onTimeRangeChanged`: Queries the data source when the dashboard time range changes.'
        );
    },
    regex: z.string().default(''),
    get current() {
      return z
        .union([
          variableOptionSchema.and(z.any()),
          z.object({
            text: z.enum(['']),
            value: z.enum(['']),
          }),
        ])
        .default({});
    },
    get options() {
      return z.array(variableOptionSchema.describe('Variable option specification'));
    },
    multi: z.boolean().default(false),
    includeAll: z.boolean().default(false),
    allValue: z.optional(z.string()),
    label: z.optional(z.string()),
    get hide() {
      return variableHideSchema
        .default('dontHide')
        .describe(
          'Determine if the variable shows on dashboard\nAccepted values are `dontHide` (show label and value), `hideLabel` (show value only), `hideVariable` (show nothing), `inControlsMenu` (show in a drop-down menu).'
        );
    },
    skipUrlSync: z.boolean().default(false),
    description: z.optional(z.string()),
    allowCustomValue: z.boolean().default(true),
    get origin() {
      return datasourceControlSourceRefSchema
        .describe('Source information for controls (e.g. variables or links)')
        .optional();
    },
  })
  .describe('Datasource variable specification');

export const dynamicConfigValueSchema = z.object({
  id: z.string().default(''),
  value: z.optional(z.any()),
});

export const elementReferenceSchema = z.object({
  kind: z.literal('ElementReference').optional().default('ElementReference'),
  name: z.string(),
});

/**
 * @description Supported dashboard elements
 */
export const elementSchema = z
  .union([z.lazy(() => panelKindSchema), z.lazy(() => libraryPanelKindSchema)])
  .describe('Supported dashboard elements');

export const fetchOptionsSchema = z.object({
  get method() {
    return httpRequestMethodSchema;
  },
  url: z.string(),
  body: z.optional(z.string()),
  queryParams: z.optional(
    z
      .array(z.array(z.string()))
      .describe(
        "These are 2D arrays of strings, each representing a key-value pair\nWe are defining them this way because we can't generate a go struct that\nthat would have exactly two strings in each sub-array"
      )
  ),
  headers: z.optional(z.array(z.array(z.string()))),
});

/**
 * @description Color mode for a field. You can specify a single color, or select a continuous (gradient) color schemes, based on a value.\nContinuous color interpolates a color using the percentage of a value relative to min and max.\nAccepted values are:\n`thresholds`: From thresholds. Informs Grafana to take the color from the matching threshold\n`palette-classic`: Classic palette. Grafana will assign color by looking up a color in a palette by series index. Useful for Graphs and pie charts and other categorical data visualizations\n`palette-classic-by-name`: Classic palette (by name). Grafana will assign color by looking up a color in a palette by series name. Useful for Graphs and pie charts and other categorical data visualizations\n`continuous-viridis`: Continuous Viridis palette mode\n`continuous-magma`: Continuous Magma palette mode\n`continuous-plasma`: Continuous Plasma palette mode\n`continuous-inferno`: Continuous Inferno palette mode\n`continuous-cividis`: Continuous Cividis palette mode\n`continuous-GrYlRd`: Continuous Green-Yellow-Red palette mode\n`continuous-RdYlGr`: Continuous Red-Yellow-Green palette mode\n`continuous-BlYlRd`: Continuous Blue-Yellow-Red palette mode\n`continuous-YlRd`: Continuous Yellow-Red palette mode\n`continuous-BlPu`: Continuous Blue-Purple palette mode\n`continuous-YlBl`: Continuous Yellow-Blue palette mode\n`continuous-blues`: Continuous Blue palette mode\n`continuous-reds`: Continuous Red palette mode\n`continuous-greens`: Continuous Green palette mode\n`continuous-purples`: Continuous Purple palette mode\n`shades`: Shades of a single color. Specify a single color, useful in an override rule.\n`fixed`: Fixed color mode. Specify a single color, useful in an override rule.
 */
export const fieldColorModeIdSchema = z
  .enum([
    'thresholds',
    'palette-classic',
    'palette-classic-by-name',
    'continuous-viridis',
    'continuous-magma',
    'continuous-plasma',
    'continuous-inferno',
    'continuous-cividis',
    'continuous-GrYlRd',
    'continuous-RdYlGr',
    'continuous-BlYlRd',
    'continuous-YlRd',
    'continuous-BlPu',
    'continuous-YlBl',
    'continuous-blues',
    'continuous-reds',
    'continuous-greens',
    'continuous-purples',
    'fixed',
    'shades',
  ])
  .describe(
    'Color mode for a field. You can specify a single color, or select a continuous (gradient) color schemes, based on a value.\nContinuous color interpolates a color using the percentage of a value relative to min and max.\nAccepted values are:\n`thresholds`: From thresholds. Informs Grafana to take the color from the matching threshold\n`palette-classic`: Classic palette. Grafana will assign color by looking up a color in a palette by series index. Useful for Graphs and pie charts and other categorical data visualizations\n`palette-classic-by-name`: Classic palette (by name). Grafana will assign color by looking up a color in a palette by series name. Useful for Graphs and pie charts and other categorical data visualizations\n`continuous-viridis`: Continuous Viridis palette mode\n`continuous-magma`: Continuous Magma palette mode\n`continuous-plasma`: Continuous Plasma palette mode\n`continuous-inferno`: Continuous Inferno palette mode\n`continuous-cividis`: Continuous Cividis palette mode\n`continuous-GrYlRd`: Continuous Green-Yellow-Red palette mode\n`continuous-RdYlGr`: Continuous Red-Yellow-Green palette mode\n`continuous-BlYlRd`: Continuous Blue-Yellow-Red palette mode\n`continuous-YlRd`: Continuous Yellow-Red palette mode\n`continuous-BlPu`: Continuous Blue-Purple palette mode\n`continuous-YlBl`: Continuous Yellow-Blue palette mode\n`continuous-blues`: Continuous Blue palette mode\n`continuous-reds`: Continuous Red palette mode\n`continuous-greens`: Continuous Green palette mode\n`continuous-purples`: Continuous Purple palette mode\n`shades`: Shades of a single color. Specify a single color, useful in an override rule.\n`fixed`: Fixed color mode. Specify a single color, useful in an override rule.'
  );

/**
 * @description Map a field to a color.
 */
export const fieldColorSchema = z
  .object({
    get mode() {
      return fieldColorModeIdSchema.describe(
        'Color mode for a field. You can specify a single color, or select a continuous (gradient) color schemes, based on a value.\nContinuous color interpolates a color using the percentage of a value relative to min and max.\nAccepted values are:\n`thresholds`: From thresholds. Informs Grafana to take the color from the matching threshold\n`palette-classic`: Classic palette. Grafana will assign color by looking up a color in a palette by series index. Useful for Graphs and pie charts and other categorical data visualizations\n`palette-classic-by-name`: Classic palette (by name). Grafana will assign color by looking up a color in a palette by series name. Useful for Graphs and pie charts and other categorical data visualizations\n`continuous-viridis`: Continuous Viridis palette mode\n`continuous-magma`: Continuous Magma palette mode\n`continuous-plasma`: Continuous Plasma palette mode\n`continuous-inferno`: Continuous Inferno palette mode\n`continuous-cividis`: Continuous Cividis palette mode\n`continuous-GrYlRd`: Continuous Green-Yellow-Red palette mode\n`continuous-RdYlGr`: Continuous Red-Yellow-Green palette mode\n`continuous-BlYlRd`: Continuous Blue-Yellow-Red palette mode\n`continuous-YlRd`: Continuous Yellow-Red palette mode\n`continuous-BlPu`: Continuous Blue-Purple palette mode\n`continuous-YlBl`: Continuous Yellow-Blue palette mode\n`continuous-blues`: Continuous Blue palette mode\n`continuous-reds`: Continuous Red palette mode\n`continuous-greens`: Continuous Green palette mode\n`continuous-purples`: Continuous Purple palette mode\n`shades`: Shades of a single color. Specify a single color, useful in an override rule.\n`fixed`: Fixed color mode. Specify a single color, useful in an override rule.'
      );
    },
    fixedColor: z.optional(z.string().describe('The fixed color value for fixed or shades color modes.')),
    get seriesBy() {
      return fieldColorSeriesByModeSchema
        .describe(
          'Defines how to assign a series color from "by value" color schemes. For example for an aggregated data points like a timeseries, the color can be assigned by the min, max or last value.'
        )
        .optional();
    },
  })
  .describe('Map a field to a color.');

/**
 * @description Defines how to assign a series color from \"by value\" color schemes. For example for an aggregated data points like a timeseries, the color can be assigned by the min, max or last value.
 */
export const fieldColorSeriesByModeSchema = z
  .enum(['min', 'max', 'last'])
  .describe(
    'Defines how to assign a series color from "by value" color schemes. For example for an aggregated data points like a timeseries, the color can be assigned by the min, max or last value.'
  );

/**
 * @description The data model used in Grafana, namely the data frame, is a columnar-oriented table structure that unifies both time series and table query results.\nEach column within this structure is called a field. A field can represent a single time series or table column.\nField options allow you to change how the data is displayed in your visualizations.
 */
export const fieldConfigSchema = z
  .object({
    displayName: z.optional(
      z.string().describe('The display value for this field.  This supports template variables blank is auto')
    ),
    displayNameFromDS: z.optional(
      z
        .string()
        .describe(
          'This can be used by data sources that return and explicit naming structure for values and labels\nWhen this property is configured, this value is used rather than the default naming strategy.'
        )
    ),
    description: z.optional(z.string().describe('Human readable field metadata')),
    path: z.optional(
      z
        .string()
        .describe(
          'An explicit path to the field in the datasource.  When the frame meta includes a path,\nThis will default to `${frame.meta.path}/${field.name}\n\nWhen defined, this value can be used as an identifier within the datasource scope, and\nmay be used to update the results'
        )
    ),
    writeable: z.optional(
      z.boolean().describe('True if data source can write a value to the path. Auth/authz are supported separately')
    ),
    filterable: z.optional(z.boolean().describe('True if data source field supports ad-hoc filters')),
    unit: z.optional(
      z
        .string()
        .describe(
          'Unit a field should use. The unit you select is applied to all fields except time.\nYou can use the units ID available in Grafana or a custom unit.\nAvailable units in Grafana: https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/valueFormats/categories.ts\nAs custom unit, you can use the following formats:\n`suffix:<suffix>` for custom unit that should go after value.\n`prefix:<prefix>` for custom unit that should go before value.\n`time:<format>` For custom date time formats type for example `time:YYYY-MM-DD`.\n`si:<base scale><unit characters>` for custom SI units. For example: `si: mF`. This one is a bit more advanced as you can specify both a unit and the source data scale. So if your source data is represented as milli (thousands of) something prefix the unit with that SI scale character.\n`count:<unit>` for a custom count unit.\n`currency:<unit>` for custom a currency unit.'
        )
    ),
    decimals: z.optional(
      z
        .number()
        .describe(
          'Specify the number of decimals Grafana includes in the rendered value.\nIf you leave this field blank, Grafana automatically truncates the number of decimals based on the value.\nFor example 1.1234 will display as 1.12 and 100.456 will display as 100.\nTo display all decimals, set the unit to `String`.'
        )
    ),
    min: z.optional(
      z
        .number()
        .describe(
          'The minimum value used in percentage threshold calculations. Leave blank for auto calculation based on all series and fields.'
        )
    ),
    max: z.optional(
      z
        .number()
        .describe(
          'The maximum value used in percentage threshold calculations. Leave blank for auto calculation based on all series and fields.'
        )
    ),
    get mappings() {
      return z.array(valueMappingSchema).describe('Convert input values into a display string').optional();
    },
    get thresholds() {
      return thresholdsConfigSchema.optional();
    },
    get color() {
      return fieldColorSchema.describe('Map a field to a color.').optional();
    },
    links: z.optional(z.array(z.any()).describe('The behavior when clicking on a result')),
    get actions() {
      return z
        .array(actionSchema)
        .describe('Define interactive HTTP requests that can be triggered from data visualizations.')
        .optional();
    },
    noValue: z.optional(z.string().describe('Alternative to empty string')),
    custom: z.optional(z.object({}).describe('custom is specified by the FieldConfig field\nin panel plugin schemas.')),
    fieldMinMax: z.optional(z.boolean().describe('Calculate min max per field')),
    get nullValueMode() {
      return nullValueModeSchema.describe('How null values should be handled').optional();
    },
  })
  .describe(
    'The data model used in Grafana, namely the data frame, is a columnar-oriented table structure that unifies both time series and table query results.\nEach column within this structure is called a field. A field can represent a single time series or table column.\nField options allow you to change how the data is displayed in your visualizations.'
  );

/**
 * @description The data model used in Grafana, namely the data frame, is a columnar-oriented table structure that unifies both time series and table query results.\nEach column within this structure is called a field. A field can represent a single time series or table column.\nField options allow you to change how the data is displayed in your visualizations.
 */
export const fieldConfigSourceSchema = z
  .object({
    get defaults() {
      return fieldConfigSchema.describe(
        'The data model used in Grafana, namely the data frame, is a columnar-oriented table structure that unifies both time series and table query results.\nEach column within this structure is called a field. A field can represent a single time series or table column.\nField options allow you to change how the data is displayed in your visualizations.'
      );
    },
    overrides: z
      .array(
        z.object({
          __systemRef: z.optional(
            z.string().describe('Describes config override rules created when interacting with Grafana.')
          ),
          get matcher() {
            return matcherConfigSchema.describe(
              'Matcher is a predicate configuration. Based on the config a set of field(s) or values is filtered in order to apply override / transformation.\nIt comes with in id ( to resolve implementation from registry) and a configuration that’s specific to a particular matcher type.'
            );
          },
          get properties() {
            return z.array(dynamicConfigValueSchema);
          },
        })
      )
      .describe('Overrides are the options applied to specific fields overriding the defaults.'),
  })
  .describe(
    'The data model used in Grafana, namely the data frame, is a columnar-oriented table structure that unifies both time series and table query results.\nEach column within this structure is called a field. A field can represent a single time series or table column.\nField options allow you to change how the data is displayed in your visualizations.'
  );

/**
 * @description Determine the origin of the adhoc variable filter
 */
export const filterOriginSchema = z.enum(['dashboard']).describe('Determine the origin of the adhoc variable filter');

export const gridLayoutItemKindSchema = z.object({
  kind: z.literal('GridLayoutItem').optional().default('GridLayoutItem'),
  get spec() {
    return gridLayoutItemSpecSchema;
  },
});

export const gridLayoutItemSpecSchema = z.object({
  x: z.int(),
  y: z.int(),
  width: z.int(),
  height: z.int(),
  get element() {
    return elementReferenceSchema;
  },
  get repeat() {
    return repeatOptionsSchema.optional();
  },
});

export const gridLayoutKindSchema = z.object({
  kind: z.enum(['GridLayout']),
  get spec() {
    return gridLayoutSpecSchema;
  },
});

export const gridLayoutSpecSchema = z.object({
  get items() {
    return z.array(gridLayoutItemKindSchema);
  },
});

/**
 * @description Group variable kind
 */
export const groupByVariableKindSchema = z
  .object({
    kind: z.enum(['GroupByVariable']),
    group: z.string(),
    labels: z.optional(z.object({}).catchall(z.string())),
    datasource: z.optional(
      z.object({
        name: z.optional(z.string()),
      })
    ),
    get spec() {
      return groupByVariableSpecSchema.describe('GroupBy variable specification');
    },
  })
  .describe('Group variable kind');

/**
 * @description GroupBy variable specification
 */
export const groupByVariableSpecSchema = z
  .object({
    name: z.string().default(''),
    get defaultValue() {
      return variableOptionSchema.describe('Variable option specification').optional();
    },
    get current() {
      return z
        .union([
          variableOptionSchema.and(z.any()),
          z.object({
            text: z.enum(['']),
            value: z.enum(['']),
          }),
        ])
        .default({});
    },
    get options() {
      return z.array(variableOptionSchema.describe('Variable option specification'));
    },
    multi: z.boolean().default(false),
    label: z.optional(z.string()),
    get hide() {
      return variableHideSchema
        .default('dontHide')
        .describe(
          'Determine if the variable shows on dashboard\nAccepted values are `dontHide` (show label and value), `hideLabel` (show value only), `hideVariable` (show nothing), `inControlsMenu` (show in a drop-down menu).'
        );
    },
    skipUrlSync: z.boolean().default(false),
    description: z.optional(z.string()),
    get origin() {
      return datasourceControlSourceRefSchema
        .describe('Source information for controls (e.g. variables or links)')
        .optional();
    },
  })
  .describe('GroupBy variable specification');

export const httpRequestMethodSchema = z.enum(['GET', 'PUT', 'POST', 'DELETE', 'PATCH']);

export const infinityOptionsSchema = z
  .lazy(() => fetchOptionsSchema)
  .and(z.any())
  .and(
    z.object({
      datasourceUid: z.optional(z.string()),
    })
  );

/**
 * @description Interval variable kind
 */
export const intervalVariableKindSchema = z
  .object({
    kind: z.enum(['IntervalVariable']),
    get spec() {
      return intervalVariableSpecSchema.describe('Interval variable specification');
    },
  })
  .describe('Interval variable kind');

/**
 * @description Interval variable specification
 */
export const intervalVariableSpecSchema = z
  .object({
    name: z.string().default(''),
    query: z.string().default(''),
    get current() {
      return z
        .union([
          variableOptionSchema.and(z.any()),
          z.object({
            text: z.enum(['']),
            value: z.enum(['']),
          }),
        ])
        .default({});
    },
    get options() {
      return z.array(variableOptionSchema.describe('Variable option specification'));
    },
    auto: z.boolean().default(false),
    auto_min: z.string().default(''),
    auto_count: z.int().default(0),
    refresh: z.enum(['onTimeRangeChanged']),
    label: z.optional(z.string()),
    get hide() {
      return variableHideSchema
        .default('dontHide')
        .describe(
          'Determine if the variable shows on dashboard\nAccepted values are `dontHide` (show label and value), `hideLabel` (show value only), `hideVariable` (show nothing), `inControlsMenu` (show in a drop-down menu).'
        );
    },
    skipUrlSync: z.boolean().default(false),
    description: z.optional(z.string()),
    get origin() {
      return datasourceControlSourceRefSchema
        .describe('Source information for controls (e.g. variables or links)')
        .optional();
    },
  })
  .describe('Interval variable specification');

/**
 * @description --- Common types ---
 */
export const kindSchema = z
  .object({
    kind: z.string(),
    spec: z.any(),
    metadata: z.optional(z.any()),
  })
  .describe('--- Common types ---');

export const libraryPanelKindSchema = z.object({
  kind: z.enum(['LibraryPanel']),
  get spec() {
    return libraryPanelKindSpecSchema;
  },
});

export const libraryPanelKindSpecSchema = z.object({
  id: z.int().min(0).max(2147483647).describe('Panel ID for the library panel in the dashboard'),
  title: z.string().describe('Title for the library panel in the dashboard'),
  get libraryPanel() {
    return libraryPanelRefSchema.describe(
      'A library panel is a reusable panel that you can use in any dashboard.\nWhen you make a change to a library panel, that change propagates to all instances of where the panel is used.\nLibrary panels streamline reuse of panels across multiple dashboards.'
    );
  },
});

/**
 * @description A library panel is a reusable panel that you can use in any dashboard.\nWhen you make a change to a library panel, that change propagates to all instances of where the panel is used.\nLibrary panels streamline reuse of panels across multiple dashboards.
 */
export const libraryPanelRefSchema = z
  .object({
    name: z.string().describe('Library panel name'),
    uid: z.string().describe('Library panel uid'),
  })
  .describe(
    'A library panel is a reusable panel that you can use in any dashboard.\nWhen you make a change to a library panel, that change propagates to all instances of where the panel is used.\nLibrary panels streamline reuse of panels across multiple dashboards.'
  );

/**
 * @description Supported value mapping types\n`value`: Maps text values to a color or different display text and color. For example, you can configure a value mapping so that all instances of the value 10 appear as Perfection! rather than the number.\n`range`: Maps numerical ranges to a display text and color. For example, if a value is within a certain range, you can configure a range value mapping to display Low or High rather than the number.\n`regex`: Maps regular expressions to replacement text and a color. For example, if a value is www.example.com, you can configure a regex value mapping so that Grafana displays www and truncates the domain.\n`special`: Maps special values like Null, NaN (not a number), and boolean values like true and false to a display text and color. See SpecialValueMatch to see the list of special values. For example, you can configure a special value mapping so that null values appear as N/A.
 */
export const mappingTypeSchema = z
  .enum(['value', 'range', 'regex', 'special'])
  .describe(
    'Supported value mapping types\n`value`: Maps text values to a color or different display text and color. For example, you can configure a value mapping so that all instances of the value 10 appear as Perfection! rather than the number.\n`range`: Maps numerical ranges to a display text and color. For example, if a value is within a certain range, you can configure a range value mapping to display Low or High rather than the number.\n`regex`: Maps regular expressions to replacement text and a color. For example, if a value is www.example.com, you can configure a regex value mapping so that Grafana displays www and truncates the domain.\n`special`: Maps special values like Null, NaN (not a number), and boolean values like true and false to a display text and color. See SpecialValueMatch to see the list of special values. For example, you can configure a special value mapping so that null values appear as N/A.'
  );

/**
 * @description Matcher is a predicate configuration. Based on the config a set of field(s) or values is filtered in order to apply override / transformation.\nIt comes with in id ( to resolve implementation from registry) and a configuration that’s specific to a particular matcher type.
 */
export const matcherConfigSchema = z
  .object({
    id: z
      .string()
      .default('')
      .describe('The matcher id. This is used to find the matcher implementation from registry.'),
    get scope() {
      return matcherScopeSchema.optional();
    },
    options: z.optional(z.any().describe('The matcher options. This is specific to the matcher implementation.')),
  })
  .describe(
    'Matcher is a predicate configuration. Based on the config a set of field(s) or values is filtered in order to apply override / transformation.\nIt comes with in id ( to resolve implementation from registry) and a configuration that’s specific to a particular matcher type.'
  );

export const matcherScopeSchema = z.enum(['series', 'nested', 'annotation', 'exemplar']);

/**
 * @description Define the MetricFindValue type
 */
export const metricFindValueSchema = z
  .object({
    text: z.string(),
    value: z.optional(z.union([z.string(), z.number()])),
    group: z.optional(z.string()),
    expandable: z.optional(z.boolean()),
  })
  .describe('Define the MetricFindValue type');

/**
 * @description How null values should be handled
 */
export const nullValueModeSchema = z
  .enum(['null', 'connected', 'null as zero'])
  .describe('How null values should be handled');

export const panelKindSchema = z.object({
  kind: z.enum(['Panel']),
  get spec() {
    return panelSpecSchema;
  },
});

export const panelQueryKindSchema = z.object({
  kind: z.literal('PanelQuery').optional().default('PanelQuery'),
  get spec() {
    return panelQuerySpecSchema;
  },
});

export const panelQuerySpecSchema = z.object({
  get query() {
    return dataQueryKindSchema;
  },
  refId: z.string().default('A'),
  hidden: z.boolean(),
});

export const panelSpecSchema = z.object({
  id: z.int().min(0).max(2147483647),
  title: z.string(),
  description: z.string(),
  get links() {
    return z.array(dataLinkSchema);
  },
  get data() {
    return queryGroupKindSchema;
  },
  get vizConfig() {
    return vizConfigKindSchema;
  },
  transparent: z.optional(z.boolean()),
});

export const queryGroupKindSchema = z.object({
  kind: z.literal('QueryGroup').optional().default('QueryGroup'),
  get spec() {
    return queryGroupSpecSchema;
  },
});

export const queryGroupSpecSchema = z.object({
  get queries() {
    return z.array(panelQueryKindSchema);
  },
  get transformations() {
    return z.array(transformationKindSchema);
  },
  get queryOptions() {
    return queryOptionsSpecSchema;
  },
});

export const queryOptionsSpecSchema = z.object({
  timeFrom: z.optional(z.string()),
  maxDataPoints: z.optional(z.int()),
  timeShift: z.optional(z.string()),
  queryCachingTTL: z.optional(z.int()),
  interval: z.optional(z.string()),
  cacheTimeout: z.optional(z.string()),
  hideTimeOverride: z.optional(z.boolean()),
  timeCompare: z.optional(z.string()),
});

/**
 * @description Query variable kind
 */
export const queryVariableKindSchema = z
  .object({
    kind: z.enum(['QueryVariable']),
    get spec() {
      return queryVariableSpecSchema.describe('Query variable specification');
    },
  })
  .describe('Query variable kind');

/**
 * @description Query variable specification
 */
export const queryVariableSpecSchema = z
  .object({
    name: z.string().default(''),
    get current() {
      return z
        .union([
          variableOptionSchema.and(z.any()),
          z.object({
            text: z.enum(['']),
            value: z.enum(['']),
          }),
        ])
        .default({});
    },
    label: z.optional(z.string()),
    get hide() {
      return variableHideSchema
        .default('dontHide')
        .describe(
          'Determine if the variable shows on dashboard\nAccepted values are `dontHide` (show label and value), `hideLabel` (show value only), `hideVariable` (show nothing), `inControlsMenu` (show in a drop-down menu).'
        );
    },
    get refresh() {
      return variableRefreshSchema
        .default('never')
        .describe(
          'Options to config when to refresh a variable\n`never`: Never refresh the variable\n`onDashboardLoad`: Queries the data source every time the dashboard loads.\n`onTimeRangeChanged`: Queries the data source when the dashboard time range changes.'
        );
    },
    skipUrlSync: z.boolean().default(false),
    description: z.optional(z.string()),
    get query() {
      return dataQueryKindSchema;
    },
    regex: z.string().default(''),
    get regexApplyTo() {
      return variableRegexApplyToSchema
        .default('value')
        .describe(
          'Determine whether regex applies to variable value or display text\nAccepted values are `value` (apply to value used in queries) or `text` (apply to display text shown to users)'
        )
        .optional();
    },
    get sort() {
      return variableSortSchema.describe(
        'Sort variable options\nAccepted values are:\n`disabled`: No sorting\n`alphabeticalAsc`: Alphabetical ASC\n`alphabeticalDesc`: Alphabetical DESC\n`numericalAsc`: Numerical ASC\n`numericalDesc`: Numerical DESC\n`alphabeticalCaseInsensitiveAsc`: Alphabetical Case Insensitive ASC\n`alphabeticalCaseInsensitiveDesc`: Alphabetical Case Insensitive DESC\n`naturalAsc`: Natural ASC\n`naturalDesc`: Natural DESC\nVariableSort enum with default value'
      );
    },
    definition: z.optional(z.string()),
    get options() {
      return z.array(variableOptionSchema.describe('Variable option specification'));
    },
    multi: z.boolean().default(false),
    includeAll: z.boolean().default(false),
    allValue: z.optional(z.string()),
    placeholder: z.optional(z.string()),
    allowCustomValue: z.boolean().default(true),
    get staticOptions() {
      return z.array(variableOptionSchema.describe('Variable option specification')).optional();
    },
    staticOptionsOrder: z.optional(z.enum(['before', 'after', 'sorted'])),
    get origin() {
      return datasourceControlSourceRefSchema
        .describe('Source information for controls (e.g. variables or links)')
        .optional();
    },
  })
  .describe('Query variable specification');

/**
 * @description Maps numerical ranges to a display text and color.\nFor example, if a value is within a certain range, you can configure a range value mapping to display Low or High rather than the number.
 */
export const rangeMapSchema = z
  .object({
    get type() {
      return mappingTypeSchema.and(z.enum(['range']));
    },
    options: z
      .object({
        from: z.nullable(
          z
            .number()
            .min(-1.7976931348623157e308)
            .max(1.7976931348623157e308)
            .describe('Min value of the range. It can be null which means -Infinity')
        ),
        to: z.nullable(
          z
            .number()
            .min(-1.7976931348623157e308)
            .max(1.7976931348623157e308)
            .describe('Max value of the range. It can be null which means +Infinity')
        ),
        get result() {
          return valueMappingResultSchema.describe(
            'Result used as replacement with text and color when the value matches'
          );
        },
      })
      .describe('Range to match against and the result to apply when the value is within the range'),
  })
  .describe(
    'Maps numerical ranges to a display text and color.\nFor example, if a value is within a certain range, you can configure a range value mapping to display Low or High rather than the number.'
  );

/**
 * @description Maps regular expressions to replacement text and a color.\nFor example, if a value is www.example.com, you can configure a regex value mapping so that Grafana displays www and truncates the domain.
 */
export const regexMapSchema = z
  .object({
    get type() {
      return mappingTypeSchema.and(z.enum(['regex']));
    },
    options: z
      .object({
        pattern: z.string().describe('Regular expression to match against'),
        get result() {
          return valueMappingResultSchema.describe(
            'Result used as replacement with text and color when the value matches'
          );
        },
      })
      .describe('Regular expression to match against and the result to apply when the value matches the regex'),
  })
  .describe(
    'Maps regular expressions to replacement text and a color.\nFor example, if a value is www.example.com, you can configure a regex value mapping so that Grafana displays www and truncates the domain.'
  );

export const repeatModeSchema = z.enum(['variable']);

export const repeatOptionsSchema = z.object({
  get mode() {
    return repeatModeSchema;
  },
  value: z.string(),
  direction: z.optional(z.enum(['h', 'v'])),
  maxPerRow: z.optional(z.int()),
});

export const rowRepeatOptionsSchema = z.object({
  get mode() {
    return repeatModeSchema;
  },
  value: z.string(),
});

export const rowsLayoutKindSchema = z.object({
  kind: z.enum(['RowsLayout']),
  get spec() {
    return rowsLayoutSpecSchema;
  },
});

export const rowsLayoutRowKindSchema = z.object({
  kind: z.literal('RowsLayoutRow').optional().default('RowsLayoutRow'),
  get spec() {
    return rowsLayoutRowSpecSchema;
  },
});

export const rowsLayoutRowSpecSchema = z.object({
  title: z.optional(z.string()),
  collapse: z.optional(z.boolean()),
  hideHeader: z.optional(z.boolean()),
  fillScreen: z.optional(z.boolean()),
  get conditionalRendering() {
    return conditionalRenderingGroupKindSchema.optional();
  },
  get repeat() {
    return rowRepeatOptionsSchema.optional();
  },
  get layout() {
    return z.union([gridLayoutKindSchema, autoGridLayoutKindSchema, tabsLayoutKindSchema, rowsLayoutKindSchema]);
  },
  get variables() {
    return z.array(variableKindSchema).optional();
  },
});

export const rowsLayoutSpecSchema = z.object({
  get rows() {
    return z.array(rowsLayoutRowKindSchema);
  },
});

/**
 * @description Maps special values like Null, NaN (not a number), and boolean values like true and false to a display text and color.\nSee SpecialValueMatch to see the list of special values.\nFor example, you can configure a special value mapping so that null values appear as N/A.
 */
export const specialValueMapSchema = z
  .object({
    get type() {
      return mappingTypeSchema.and(z.enum(['special']));
    },
    options: z.object({
      get match() {
        return specialValueMatchSchema.describe('Special value types supported by the `SpecialValueMap`');
      },
      get result() {
        return valueMappingResultSchema.describe(
          'Result used as replacement with text and color when the value matches'
        );
      },
    }),
  })
  .describe(
    'Maps special values like Null, NaN (not a number), and boolean values like true and false to a display text and color.\nSee SpecialValueMatch to see the list of special values.\nFor example, you can configure a special value mapping so that null values appear as N/A.'
  );

/**
 * @description Special value types supported by the `SpecialValueMap`
 */
export const specialValueMatchSchema = z
  .enum(['true', 'false', 'null', 'nan', 'null+nan', 'empty'])
  .describe('Special value types supported by the `SpecialValueMap`');

export const switchVariableKindSchema = z.object({
  kind: z.enum(['SwitchVariable']),
  get spec() {
    return switchVariableSpecSchema;
  },
});

export const switchVariableSpecSchema = z.object({
  name: z.string().default(''),
  current: z.string().default('false'),
  enabledValue: z.string().default('true'),
  disabledValue: z.string().default('false'),
  label: z.optional(z.string()),
  get hide() {
    return variableHideSchema
      .default('dontHide')
      .describe(
        'Determine if the variable shows on dashboard\nAccepted values are `dontHide` (show label and value), `hideLabel` (show value only), `hideVariable` (show nothing), `inControlsMenu` (show in a drop-down menu).'
      );
  },
  skipUrlSync: z.boolean().default(false),
  description: z.optional(z.string()),
  get origin() {
    return datasourceControlSourceRefSchema
      .describe('Source information for controls (e.g. variables or links)')
      .optional();
  },
});

export const tabRepeatOptionsSchema = z.object({
  get mode() {
    return repeatModeSchema;
  },
  value: z.string(),
});

export const tabsLayoutKindSchema = z.object({
  kind: z.enum(['TabsLayout']),
  get spec() {
    return tabsLayoutSpecSchema;
  },
});

export const tabsLayoutSpecSchema = z.object({
  get tabs() {
    return z.array(tabsLayoutTabKindSchema);
  },
});

export const tabsLayoutTabKindSchema = z.object({
  kind: z.literal('TabsLayoutTab').optional().default('TabsLayoutTab'),
  get spec() {
    return tabsLayoutTabSpecSchema;
  },
});

export const tabsLayoutTabSpecSchema = z.object({
  title: z.optional(z.string()),
  get layout() {
    return z.union([gridLayoutKindSchema, rowsLayoutKindSchema, autoGridLayoutKindSchema, tabsLayoutKindSchema]);
  },
  get conditionalRendering() {
    return conditionalRenderingGroupKindSchema.optional();
  },
  get repeat() {
    return tabRepeatOptionsSchema.optional();
  },
  get variables() {
    return z.array(variableKindSchema).optional();
  },
});

/**
 * @description Text variable kind
 */
export const textVariableKindSchema = z
  .object({
    kind: z.enum(['TextVariable']),
    get spec() {
      return textVariableSpecSchema.describe('Text variable specification');
    },
  })
  .describe('Text variable kind');

/**
 * @description Text variable specification
 */
export const textVariableSpecSchema = z
  .object({
    name: z.string().default(''),
    get current() {
      return z
        .union([
          variableOptionSchema.and(z.any()),
          z.object({
            text: z.enum(['']),
            value: z.enum(['']),
          }),
        ])
        .default({});
    },
    query: z.string().default(''),
    label: z.optional(z.string()),
    get hide() {
      return variableHideSchema
        .default('dontHide')
        .describe(
          'Determine if the variable shows on dashboard\nAccepted values are `dontHide` (show label and value), `hideLabel` (show value only), `hideVariable` (show nothing), `inControlsMenu` (show in a drop-down menu).'
        );
    },
    skipUrlSync: z.boolean().default(false),
    description: z.optional(z.string()),
    get origin() {
      return datasourceControlSourceRefSchema
        .describe('Source information for controls (e.g. variables or links)')
        .optional();
    },
  })
  .describe('Text variable specification');

export const thresholdSchema = z.object({
  value: z.nullable(z.number().describe('Value null means -Infinity')),
  color: z.string(),
});

export const thresholdsConfigSchema = z.object({
  get mode() {
    return thresholdsModeSchema;
  },
  get steps() {
    return z.array(thresholdSchema);
  },
});

export const thresholdsModeSchema = z.enum(['absolute', 'percentage']);

export const timeRangeOptionSchema = z.object({
  display: z.string().default('Last 6 hours'),
  from: z.string().default('now-6h'),
  to: z.string().default('now'),
});

/**
 * @description Time configuration\nIt defines the default time config for the time picker, the refresh picker for the specific dashboard.
 */
export const timeSettingsSpecSchema = z
  .object({
    timezone: z.optional(
      z
        .string()
        .default('browser')
        .describe('Timezone of dashboard. Accepted values are IANA TZDB zone ID or "browser" or "utc".')
    ),
    from: z
      .string()
      .default('now-6h')
      .describe(
        'Start time range for dashboard.\nAccepted values are relative time strings like "now-6h" or absolute time strings like "2020-07-10T08:00:00.000Z".'
      ),
    to: z
      .string()
      .default('now')
      .describe(
        'End time range for dashboard.\nAccepted values are relative time strings like "now-6h" or absolute time strings like "2020-07-10T08:00:00.000Z".'
      ),
    autoRefresh: z
      .string()
      .default('')
      .describe('Refresh rate of dashboard. Represented via interval string, e.g. "5s", "1m", "1h", "1d".'),
    autoRefreshIntervals: z.array(z.string()).describe('Interval options available in the refresh picker dropdown.'),
    get quickRanges() {
      return z
        .array(timeRangeOptionSchema)
        .describe('Selectable options available in the time picker dropdown. Has no effect on provisioned dashboard.')
        .optional();
    },
    hideTimepicker: z.boolean().default(false).describe('Whether timepicker is visible or not.'),
    weekStart: z.optional(
      z
        .enum(['saturday', 'monday', 'sunday'])
        .describe('Day when the week starts. Expressed by the name of the day in lowercase, e.g. "monday".')
    ),
    fiscalYearStartMonth: z
      .int()
      .default(0)
      .describe('The month that the fiscal year starts on. 0 = January, 11 = December'),
    nowDelay: z.optional(
      z
        .string()
        .describe(
          'Override the now time by entering a time delay. Use this option to accommodate known delays in data aggregation to avoid null values.'
        )
    ),
  })
  .describe(
    'Time configuration\nIt defines the default time config for the time picker, the refresh picker for the specific dashboard.'
  );

export const transformationKindSchema = z.object({
  kind: z.string().describe('The kind of a TransformationKind is the transformation ID'),
  get spec() {
    return dataTransformerConfigSchema.describe(
      'Transformations allow to manipulate data returned by a query before the system applies a visualization.\nUsing transformations you can: rename fields, join time series data, perform mathematical operations across queries,\nuse the output of one transformation as the input to another transformation, etc.'
    );
  },
});

/**
 * @description Maps text values to a color or different display text and color.\nFor example, you can configure a value mapping so that all instances of the value 10 appear as Perfection! rather than the number.
 */
export const valueMapSchema = z
  .object({
    get type() {
      return mappingTypeSchema.and(z.enum(['value']));
    },
    options: z
      .object({})
      .catchall(
        z
          .lazy(() => valueMappingResultSchema)
          .describe('Result used as replacement with text and color when the value matches')
      )
      .describe(
        'Map with <value_to_match>: ValueMappingResult. For example: { "10": { text: "Perfection!", color: "green" } }'
      ),
  })
  .describe(
    'Maps text values to a color or different display text and color.\nFor example, you can configure a value mapping so that all instances of the value 10 appear as Perfection! rather than the number.'
  );

/**
 * @description Result used as replacement with text and color when the value matches
 */
export const valueMappingResultSchema = z
  .object({
    text: z.optional(z.string().describe('Text to display when the value matches')),
    color: z.optional(z.string().describe('Text to use when the value matches')),
    icon: z.optional(z.string().describe('Icon to display when the value matches. Only specific visualizations.')),
    index: z.optional(z.int().describe('Position in the mapping array. Only used internally.')),
  })
  .describe('Result used as replacement with text and color when the value matches');

export const valueMappingSchema = z.union([
  z.lazy(() => valueMapSchema),
  z.lazy(() => rangeMapSchema),
  z.lazy(() => regexMapSchema),
  z.lazy(() => specialValueMapSchema),
]);

/**
 * @description Custom formatter function
 */
export const variableCustomFormatterFnSchema = z
  .object({
    value: z.any(),
    legacyVariableModel: z.object({
      name: z.string(),
      get type() {
        return variableTypeSchema.describe(
          'Dashboard variable type\n`query`: Query-generated list of values such as metric names, server names, sensor IDs, data centers, and so on.\n`adhoc`: Key/value filters that are automatically added to all metric queries for a data source (Prometheus, Loki, InfluxDB, and Elasticsearch only).\n`constant`: \tDefine a hidden constant.\n`datasource`: Quickly change the data source for an entire dashboard.\n`interval`: Interval variables represent time spans.\n`textbox`: Display a free text input field with an optional default value.\n`custom`: Define the variable options manually using a comma-separated list.\n`system`: Variables defined by Grafana. See: https://grafana.com/docs/grafana/latest/dashboards/variables/add-template-variables/#global-variables'
        );
      },
      multi: z.boolean(),
      includeAll: z.boolean(),
    }),
    get legacyDefaultFormatter() {
      return variableCustomFormatterFnSchema.describe('Custom formatter function').optional();
    },
  })
  .describe('Custom formatter function');

/**
 * @description Determine if the variable shows on dashboard\nAccepted values are `dontHide` (show label and value), `hideLabel` (show value only), `hideVariable` (show nothing), `inControlsMenu` (show in a drop-down menu).
 */
export const variableHideSchema = z
  .enum(['dontHide', 'hideLabel', 'hideVariable', 'inControlsMenu'])
  .default('dontHide')
  .describe(
    'Determine if the variable shows on dashboard\nAccepted values are `dontHide` (show label and value), `hideLabel` (show value only), `hideVariable` (show nothing), `inControlsMenu` (show in a drop-down menu).'
  );

export const variableKindSchema = z.union([
  z.lazy(() => queryVariableKindSchema),
  z.lazy(() => textVariableKindSchema),
  z.lazy(() => constantVariableKindSchema),
  z.lazy(() => datasourceVariableKindSchema),
  z.lazy(() => intervalVariableKindSchema),
  z.lazy(() => customVariableKindSchema),
  z.lazy(() => groupByVariableKindSchema),
  z.lazy(() => adhocVariableKindSchema),
  z.lazy(() => switchVariableKindSchema),
]);

/**
 * @description Variable option specification
 */
export const variableOptionSchema = z
  .object({
    selected: z.optional(z.boolean().describe('Whether the option is selected or not')),
    text: z.union([z.array(z.string()), z.string()]).describe('Text to be displayed for the option'),
    value: z.union([z.array(z.string()), z.string()]).describe('Value of the option'),
    properties: z.optional(
      z.object({}).catchall(z.string()).describe('Additional properties for multi-props variables')
    ),
  })
  .describe('Variable option specification');

/**
 * @description Options to config when to refresh a variable\n`never`: Never refresh the variable\n`onDashboardLoad`: Queries the data source every time the dashboard loads.\n`onTimeRangeChanged`: Queries the data source when the dashboard time range changes.
 */
export const variableRefreshSchema = z
  .enum(['never', 'onDashboardLoad', 'onTimeRangeChanged'])
  .default('never')
  .describe(
    'Options to config when to refresh a variable\n`never`: Never refresh the variable\n`onDashboardLoad`: Queries the data source every time the dashboard loads.\n`onTimeRangeChanged`: Queries the data source when the dashboard time range changes.'
  );

/**
 * @description Determine whether regex applies to variable value or display text\nAccepted values are `value` (apply to value used in queries) or `text` (apply to display text shown to users)
 */
export const variableRegexApplyToSchema = z
  .enum(['value', 'text'])
  .default('value')
  .describe(
    'Determine whether regex applies to variable value or display text\nAccepted values are `value` (apply to value used in queries) or `text` (apply to display text shown to users)'
  );

/**
 * @description Sort variable options\nAccepted values are:\n`disabled`: No sorting\n`alphabeticalAsc`: Alphabetical ASC\n`alphabeticalDesc`: Alphabetical DESC\n`numericalAsc`: Numerical ASC\n`numericalDesc`: Numerical DESC\n`alphabeticalCaseInsensitiveAsc`: Alphabetical Case Insensitive ASC\n`alphabeticalCaseInsensitiveDesc`: Alphabetical Case Insensitive DESC\n`naturalAsc`: Natural ASC\n`naturalDesc`: Natural DESC\nVariableSort enum with default value
 */
export const variableSortSchema = z
  .enum([
    'disabled',
    'alphabeticalAsc',
    'alphabeticalDesc',
    'numericalAsc',
    'numericalDesc',
    'alphabeticalCaseInsensitiveAsc',
    'alphabeticalCaseInsensitiveDesc',
    'naturalAsc',
    'naturalDesc',
  ])
  .describe(
    'Sort variable options\nAccepted values are:\n`disabled`: No sorting\n`alphabeticalAsc`: Alphabetical ASC\n`alphabeticalDesc`: Alphabetical DESC\n`numericalAsc`: Numerical ASC\n`numericalDesc`: Numerical DESC\n`alphabeticalCaseInsensitiveAsc`: Alphabetical Case Insensitive ASC\n`alphabeticalCaseInsensitiveDesc`: Alphabetical Case Insensitive DESC\n`naturalAsc`: Natural ASC\n`naturalDesc`: Natural DESC\nVariableSort enum with default value'
  );

/**
 * @description Dashboard variable type\n`query`: Query-generated list of values such as metric names, server names, sensor IDs, data centers, and so on.\n`adhoc`: Key/value filters that are automatically added to all metric queries for a data source (Prometheus, Loki, InfluxDB, and Elasticsearch only).\n`constant`: 	Define a hidden constant.\n`datasource`: Quickly change the data source for an entire dashboard.\n`interval`: Interval variables represent time spans.\n`textbox`: Display a free text input field with an optional default value.\n`custom`: Define the variable options manually using a comma-separated list.\n`system`: Variables defined by Grafana. See: https://grafana.com/docs/grafana/latest/dashboards/variables/add-template-variables/#global-variables
 */
export const variableTypeSchema = z
  .enum([
    'query',
    'adhoc',
    'groupby',
    'constant',
    'datasource',
    'interval',
    'textbox',
    'custom',
    'system',
    'snapshot',
    'switch',
  ])
  .describe(
    'Dashboard variable type\n`query`: Query-generated list of values such as metric names, server names, sensor IDs, data centers, and so on.\n`adhoc`: Key/value filters that are automatically added to all metric queries for a data source (Prometheus, Loki, InfluxDB, and Elasticsearch only).\n`constant`: \tDefine a hidden constant.\n`datasource`: Quickly change the data source for an entire dashboard.\n`interval`: Interval variables represent time spans.\n`textbox`: Display a free text input field with an optional default value.\n`custom`: Define the variable options manually using a comma-separated list.\n`system`: Variables defined by Grafana. See: https://grafana.com/docs/grafana/latest/dashboards/variables/add-template-variables/#global-variables'
  );

/**
 * @description FIXME: should we introduce this? --- Variable value option
 */
export const variableValueOptionSchema = z
  .object({
    label: z.string(),
    get value() {
      return variableValueSingleSchema;
    },
    group: z.optional(z.string()),
  })
  .describe('FIXME: should we introduce this? --- Variable value option');

/**
 * @description Variable types
 */
export const variableValueSchema = z
  .union([z.lazy(() => variableValueSingleSchema), z.array(z.lazy(() => variableValueSingleSchema))])
  .describe('Variable types');

export const variableValueSingleSchema = z.union([
  z.boolean(),
  z.lazy(() => customVariableValueSchema),
  z.string(),
  z.number(),
]);

export const vizConfigKindSchema = z.object({
  kind: z.literal('VizConfig').optional().default('VizConfig'),
  group: z.string().describe('The group is the plugin ID'),
  version: z.string(),
  get spec() {
    return vizConfigSpecSchema.describe('--- Kinds ---');
  },
});

/**
 * @description --- Kinds ---
 */
export const vizConfigSpecSchema = z
  .object({
    options: z.object({}),
    get fieldConfig() {
      return fieldConfigSourceSchema.describe(
        'The data model used in Grafana, namely the data frame, is a columnar-oriented table structure that unifies both time series and table query results.\nEach column within this structure is called a field. A field can represent a single time series or table column.\nField options allow you to change how the data is displayed in your visualizations.'
      );
    },
  })
  .describe('--- Kinds ---');
