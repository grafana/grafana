/**
 * Dashboard Mutation API -- Canonical Valibot Schemas & Payload Definitions
 *
 * This file contains two layers:
 *
 * 1. BUILDING-BLOCK SCHEMAS -- v2beta1 data structures (VariableKind, etc.)
 *    used internally by core code.
 *
 * 2. PAYLOAD SCHEMAS & `payloads` RECORD -- one Valibot schema per mutation
 *    command, accessible via DashboardMutationAPI.getPayloadSchema().
 *
 * This file only depends on Valibot, keeping it safe for import from any
 * internal module without pulling in the DashboardScene dependency tree.
 *
 * DEFAULTS: Literal `kind` and `version` fields use optional(schema, default)
 * so consumers (e.g. LLM tools) can omit boilerplate. After parsing, these
 * fields are always present in the output.
 *
 * The metadata() annotations flow into generated JSON Schema via
 * Valibot's toJSONSchema() and are used by LLM tool consumers for guidance.
 */

import {
  type GenericSchema,
  array,
  boolean as vBoolean,
  getMetadata,
  literal,
  metadata,
  number as vNumber,
  object,
  optional,
  picklist,
  pipe,
  record,
  regex,
  strictObject,
  string as vString,
  union,
  unknown,
  variant,
} from 'valibot';

export const dataQueryKindSchema = object({
  kind: optional(literal('DataQuery'), 'DataQuery'),
  group: pipe(vString(), metadata({ description: 'Datasource type (e.g., "prometheus", "loki", "mysql")' })),
  version: optional(vString(), 'v0'),
  datasource: optional(
    object({
      name: optional(vString()),
    })
  ),
  spec: pipe(
    record(vString(), unknown()),
    metadata({ description: 'Query-specific fields (e.g., expr for Prometheus, rawSql for SQL)' })
  ),
});

// Variable building-block schemas (v2beta1)

export const variableOptionSchema = object({
  selected: pipe(optional(vBoolean()), metadata({ description: 'Flag indicating if the value is selected' })),
  text: pipe(
    union([vString(), array(vString())]),
    metadata({ description: 'The text or list of texts of the current value' })
  ),
  value: pipe(
    union([vString(), array(vString())]),
    metadata({ description: 'The value or list of values of the current value' })
  ),
  properties: pipe(
    optional(record(vString(), vString())),
    metadata({ description: 'Additional properties for multi-props variables' })
  ),
});

const variableHideSchema = pipe(
  optional(picklist(['dontHide', 'hideLabel', 'hideVariable', 'inControlsMenu']), 'dontHide'),
  metadata({
    description: `Flag indicating if the variable should be:
- "dontHide": show label and value (visible)
- "hideLabel": show value only (label hidden)
- "hideVariable": show nothing (fully hidden)
- "inControlsMenu": show in a drop-down menu`,
  })
);

const variableRefreshSchema = pipe(
  optional(picklist(['never', 'onDashboardLoad', 'onTimeRangeChanged']), 'never'),
  metadata({
    description: `Options to config when to refresh a variable:
- "never": Never refresh the variable
- "onDashboardLoad": Queries the data source every time the dashboard loads
- "onTimeRangeChanged": Queries the data source when the dashboard time range changes`,
  })
);

const variableSortSchema = pipe(
  optional(
    picklist([
      'disabled',
      'alphabeticalAsc',
      'alphabeticalDesc',
      'numericalAsc',
      'numericalDesc',
      'alphabeticalCaseInsensitiveAsc',
      'alphabeticalCaseInsensitiveDesc',
      'naturalAsc',
      'naturalDesc',
    ]),
    'disabled'
  ),
  metadata({
    description: `Sort variable options. Accepted values are:
- "disabled": No sorting
- "alphabeticalAsc": Alphabetical ASC
- "alphabeticalDesc": Alphabetical DESC
- "numericalAsc": Numerical ASC
- "numericalDesc": Numerical DESC
- "alphabeticalCaseInsensitiveAsc": Alphabetical Case Insensitive ASC
- "alphabeticalCaseInsensitiveDesc": Alphabetical Case Insensitive DESC
- "naturalAsc": Natural ASC
- "naturalDesc": Natural DESC`,
  })
);

const adHocFilterSchema = object({
  key: pipe(vString(), metadata({ description: 'Filter key (dimension name)' })),
  operator: pipe(vString(), metadata({ description: 'Comparison operator (e.g., "=", "!=", "=~")' })),
  value: pipe(vString(), metadata({ description: 'Filter value' })),
  values: pipe(optional(array(vString())), metadata({ description: 'Multiple filter values' })),
  keyLabel: pipe(optional(vString()), metadata({ description: 'Display label for the key' })),
  valueLabels: pipe(optional(array(vString())), metadata({ description: 'Display labels for values' })),
  forceEdit: optional(vBoolean()),
  origin: optional(literal('dashboard')),
});

const metricFindValueSchema = object({
  text: pipe(vString(), metadata({ description: 'Display text' })),
  value: pipe(optional(union([vString(), vNumber()])), metadata({ description: 'Option value' })),
  group: optional(vString()),
  expandable: optional(vBoolean()),
});

const defaultVariableOption = { text: '', value: '' };

// Common spec fields shared by all variable types
const commonVariableSpecFields = {
  name: pipe(vString(), metadata({ description: 'The name of the variable. Must be unique within the dashboard.' })),
  label: pipe(optional(vString()), metadata({ description: 'The label of the variable displayed in the UI dropdown' })),
  description: pipe(
    optional(vString()),
    metadata({ description: 'The description of the variable, shown as tooltip' })
  ),
  hide: variableHideSchema,
  skipUrlSync: pipe(
    optional(vBoolean(), false),
    metadata({ description: 'Whether the variable value should be managed by URL query params or not' })
  ),
};

// Per-type variable kind schemas (v2beta1)

export const queryVariableKindSchema = pipe(
  object({
    kind: literal('QueryVariable'),
    spec: object({
      ...commonVariableSpecFields,
      query: pipe(
        dataQueryKindSchema,
        metadata({
          description:
            'The data query to use for fetching variable options. Uses v2beta1 DataQueryKind format. For Prometheus string queries use { "__grafana_string_value": "label_values(metric, label)" } in spec.',
        })
      ),
      refresh: variableRefreshSchema,
      regex: pipe(
        optional(vString(), ''),
        metadata({
          description:
            'Regex used to extract part of a series name or metric node segment. Named capture groups can be used to separate the display text and value.',
        })
      ),
      regexApplyTo: pipe(
        optional(picklist(['value', 'text'])),
        metadata({
          description: 'Whether regex applies to variable "value" (used in queries) or "text" (shown to users)',
        })
      ),
      sort: variableSortSchema,
      multi: pipe(
        optional(vBoolean(), false),
        metadata({ description: 'Flag indicating if the variable can have multiple values' })
      ),
      includeAll: pipe(
        optional(vBoolean(), false),
        metadata({ description: "Flag indicating if the variable should include the 'All' option" })
      ),
      allValue: pipe(optional(vString()), metadata({ description: "Custom value to use when 'All' is selected" })),
      allowCustomValue: pipe(
        optional(vBoolean(), true),
        metadata({ description: 'Flag indicating if the variable can have a custom value' })
      ),
      current: pipe(
        optional(variableOptionSchema, defaultVariableOption),
        metadata({ description: 'The current value of the variable' })
      ),
      options: pipe(
        optional(array(variableOptionSchema), []),
        metadata({
          description: 'The available options for the variable (populated automatically from the query)',
        })
      ),
      placeholder: pipe(optional(vString()), metadata({ description: 'Placeholder text when no value is selected' })),
      definition: pipe(optional(vString()), metadata({ description: 'Query definition string for display' })),
      staticOptions: pipe(
        optional(array(variableOptionSchema)),
        metadata({ description: 'Static options to include alongside query results' })
      ),
      staticOptionsOrder: pipe(
        optional(picklist(['before', 'after', 'sorted'])),
        metadata({ description: 'Where to place static options relative to query results' })
      ),
    }),
  }),
  metadata({
    description:
      'QueryVariable: Query-generated list of values such as metric names, server names, sensor IDs, data centers, and so on.',
  })
);

export const customVariableKindSchema = pipe(
  object({
    kind: literal('CustomVariable'),
    spec: object({
      ...commonVariableSpecFields,
      query: pipe(
        vString(),
        metadata({
          description:
            'Comma-separated list of options defining the variable values (e.g., "dev,staging,prod"). Avoid for single options.',
        })
      ),
      multi: pipe(
        optional(vBoolean(), false),
        metadata({ description: 'Flag indicating if the variable can have multiple values' })
      ),
      includeAll: pipe(
        optional(vBoolean(), false),
        metadata({ description: "Flag indicating if the variable should include the 'All' option" })
      ),
      allValue: pipe(optional(vString()), metadata({ description: "Custom value to use when 'All' is selected" })),
      allowCustomValue: pipe(
        optional(vBoolean(), true),
        metadata({ description: 'Flag indicating if the variable can have a custom value' })
      ),
      current: pipe(
        optional(variableOptionSchema, defaultVariableOption),
        metadata({ description: 'The current value of the variable' })
      ),
      options: pipe(
        optional(array(variableOptionSchema), []),
        metadata({ description: 'The available options for the variable' })
      ),
      valuesFormat: pipe(
        optional(picklist(['csv', 'json'])),
        metadata({ description: 'Format for multi-value output' })
      ),
    }),
  }),
  metadata({
    description: 'CustomVariable: Define the variable options manually using a comma-separated list.',
  })
);

export const datasourceVariableKindSchema = pipe(
  object({
    kind: literal('DatasourceVariable'),
    spec: object({
      ...commonVariableSpecFields,
      pluginId: pipe(
        vString(),
        metadata({
          description:
            'The datasource plugin type to list instances of (e.g., "prometheus", "loki", "mysql"). Allows switching between different instances of the same datasource type.',
        })
      ),
      refresh: variableRefreshSchema,
      regex: pipe(
        optional(vString(), ''),
        metadata({ description: 'Regex to filter the datasource instances shown in the dropdown' })
      ),
      multi: pipe(
        optional(vBoolean(), false),
        metadata({ description: 'Flag indicating if the variable can have multiple values' })
      ),
      includeAll: pipe(
        optional(vBoolean(), false),
        metadata({ description: "Flag indicating if the variable should include the 'All' option" })
      ),
      allValue: pipe(optional(vString()), metadata({ description: "Custom value to use when 'All' is selected" })),
      allowCustomValue: pipe(
        optional(vBoolean(), true),
        metadata({ description: 'Flag indicating if the variable can have a custom value' })
      ),
      current: pipe(
        optional(variableOptionSchema, defaultVariableOption),
        metadata({ description: 'The currently selected datasource' })
      ),
      options: pipe(
        optional(array(variableOptionSchema), []),
        metadata({ description: 'The available datasource options (populated automatically)' })
      ),
    }),
  }),
  metadata({
    description: 'DatasourceVariable: Quickly change the data source for an entire dashboard.',
  })
);

export const intervalVariableKindSchema = pipe(
  object({
    kind: literal('IntervalVariable'),
    spec: object({
      ...commonVariableSpecFields,
      query: pipe(
        vString(),
        metadata({
          description:
            'Comma-separated time intervals representing the available options (e.g., "1m,5m,15m,1h,6h,12h,1d,7d")',
        })
      ),
      auto: pipe(
        optional(vBoolean(), false),
        metadata({
          description: 'Enable automatic interval calculation based on the current time range and panel width',
        })
      ),
      auto_min: pipe(
        optional(vString(), ''),
        metadata({
          description: 'Minimum auto interval (e.g., "10s", "1m"). Prevents intervals from becoming too small.',
        })
      ),
      auto_count: pipe(
        optional(vNumber(), 0),
        metadata({ description: 'Target number of data points for auto interval calculation' })
      ),
      refresh: optional(literal('onTimeRangeChanged'), 'onTimeRangeChanged'),
      current: pipe(
        optional(variableOptionSchema, defaultVariableOption),
        metadata({ description: 'The currently selected interval' })
      ),
      options: pipe(
        optional(array(variableOptionSchema), []),
        metadata({ description: 'The available interval options (populated from query)' })
      ),
    }),
  }),
  metadata({
    description:
      'IntervalVariable: Represents time spans (e.g., "1m", "1h") for controlling time aggregations in queries.',
  })
);

export const constantVariableKindSchema = pipe(
  object({
    kind: literal('ConstantVariable'),
    spec: object({
      ...commonVariableSpecFields,
      query: pipe(
        vString(),
        metadata({
          description:
            'The constant value. Useful for internal dashboard logic or complex query parts you do not want users to change.',
        })
      ),
      current: pipe(
        optional(variableOptionSchema, defaultVariableOption),
        metadata({ description: 'The current value of the variable' })
      ),
    }),
  }),
  metadata({
    description:
      "ConstantVariable: A hidden, fixed value. Useful for internal dashboard logic or complex query parts you don't want users to change.",
  })
);

export const textVariableKindSchema = pipe(
  object({
    kind: literal('TextVariable'),
    spec: object({
      ...commonVariableSpecFields,
      query: pipe(
        optional(vString(), ''),
        metadata({ description: 'Default value for the free-form text input field' })
      ),
      current: pipe(
        optional(variableOptionSchema, defaultVariableOption),
        metadata({ description: 'The current value of the variable' })
      ),
    }),
  }),
  metadata({
    description: 'TextVariable: A free-form text input field for user-provided filters or parameters.',
  })
);

export const groupByVariableKindSchema = pipe(
  object({
    kind: literal('GroupByVariable'),
    group: pipe(vString(), metadata({ description: 'Datasource type (e.g., "prometheus", "loki")' })),
    datasource: pipe(
      optional(object({ name: optional(vString()) })),
      metadata({ description: 'Datasource reference' })
    ),
    spec: object({
      ...commonVariableSpecFields,
      defaultValue: pipe(optional(variableOptionSchema), metadata({ description: 'Default selected value' })),
      current: pipe(
        optional(variableOptionSchema, defaultVariableOption),
        metadata({ description: 'The current value of the variable' })
      ),
      options: pipe(
        optional(array(variableOptionSchema), []),
        metadata({ description: 'The available options for the variable' })
      ),
      multi: pipe(
        optional(vBoolean(), false),
        metadata({ description: 'Flag indicating if the variable can have multiple values' })
      ),
    }),
  }),
  metadata({
    description:
      'GroupByVariable: Group-by dimension selector. Allows grouping query results by a dimension. Has top-level group and datasource fields for data source binding.',
  })
);

export const adhocVariableKindSchema = pipe(
  object({
    kind: literal('AdhocVariable'),
    group: pipe(vString(), metadata({ description: 'Datasource type (e.g., "prometheus", "loki")' })),
    datasource: pipe(
      optional(object({ name: optional(vString()) })),
      metadata({ description: 'Datasource reference' })
    ),
    spec: object({
      ...commonVariableSpecFields,
      baseFilters: pipe(
        optional(array(adHocFilterSchema), []),
        metadata({ description: 'Base filters always applied to queries' })
      ),
      filters: pipe(
        optional(array(adHocFilterSchema), []),
        metadata({ description: 'User-configured ad-hoc filters applied to queries' })
      ),
      defaultKeys: pipe(
        optional(array(metricFindValueSchema), []),
        metadata({ description: 'Default dimension keys shown in the filter dropdown' })
      ),
      allowCustomValue: pipe(
        optional(vBoolean(), true),
        metadata({ description: 'Flag indicating if custom filter values can be entered' })
      ),
    }),
  }),
  metadata({
    description:
      'AdhocVariable: Ad-hoc filter builder that adds key/value filters to all queries for a data source. Has top-level group and datasource fields for data source binding.',
  })
);

export const switchVariableKindSchema = pipe(
  object({
    kind: literal('SwitchVariable'),
    spec: object({
      ...commonVariableSpecFields,
      current: pipe(
        optional(vString(), 'false'),
        metadata({ description: 'Current toggle state ("true" or "false")' })
      ),
      enabledValue: pipe(
        optional(vString(), 'true'),
        metadata({ description: 'Value substituted in queries when the toggle is enabled' })
      ),
      disabledValue: pipe(
        optional(vString(), 'false'),
        metadata({ description: 'Value substituted in queries when the toggle is disabled' })
      ),
    }),
  }),
  metadata({
    description:
      'SwitchVariable: A boolean toggle variable. Uses current as a string ("true"/"false"), not VariableOption.',
  })
);

export const variableKindSchema = variant('kind', [
  queryVariableKindSchema,
  customVariableKindSchema,
  datasourceVariableKindSchema,
  intervalVariableKindSchema,
  constantVariableKindSchema,
  textVariableKindSchema,
  groupByVariableKindSchema,
  adhocVariableKindSchema,
  switchVariableKindSchema,
]);

export const emptyPayloadSchema = strictObject({});

// Layout building-block schemas (v2beta1)

export const elementReferenceSchema = object({
  kind: optional(literal('ElementReference'), 'ElementReference'),
  name: pipe(vString(), metadata({ description: 'Element key in the dashboard elements map' })),
});

export const layoutPathSchema = pipe(
  vString(),
  regex(/^\/([a-z]+\/\d+(\/[a-z]+\/\d+)*)?$/),
  metadata({
    description:
      'Path to a location in the layout tree, from GET_LAYOUT output. ' +
      'Examples: "/" (root), "/rows/0" (first row), "/tabs/1/rows/0" (first row inside second tab).',
  })
);

export const gridPositionSchema = pipe(
  object({
    x: pipe(optional(vNumber()), metadata({ description: 'Column position (0-23 in a 24-column grid)' })),
    y: pipe(optional(vNumber()), metadata({ description: 'Row position' })),
    width: pipe(optional(vNumber()), metadata({ description: 'Width in grid columns (1-24)' })),
    height: pipe(optional(vNumber()), metadata({ description: 'Height in grid units' })),
  }),
  metadata({ description: 'Grid position (partial GridLayoutItemSpec). Keeps current values for omitted fields.' })
);

export const rowRepeatOptionsSchema = pipe(
  object({
    mode: literal('variable'),
    value: pipe(vString(), metadata({ description: 'Variable name to repeat by' })),
  }),
  metadata({ description: 'Repeat options matching v2beta1 RowRepeatOptions' })
);

export const tabRepeatOptionsSchema = pipe(
  object({
    mode: literal('variable'),
    value: pipe(vString(), metadata({ description: 'Variable name to repeat by' })),
  }),
  metadata({ description: 'Repeat options matching v2beta1 TabRepeatOptions' })
);

export const rowsLayoutRowSpecSchema = object({
  title: pipe(optional(vString()), metadata({ description: 'Row heading title' })),
  collapse: pipe(optional(vBoolean(), false), metadata({ description: 'Whether the row starts collapsed' })),
  hideHeader: pipe(optional(vBoolean(), false), metadata({ description: 'Hide the row header' })),
  fillScreen: pipe(optional(vBoolean(), false), metadata({ description: 'Row fills viewport height' })),
  repeat: pipe(optional(rowRepeatOptionsSchema), metadata({ description: 'Repeat row for each value of a variable' })),
});

export const partialRowSpecSchema = pipe(
  object({
    title: pipe(optional(vString()), metadata({ description: 'Row heading title' })),
    collapse: pipe(optional(vBoolean()), metadata({ description: 'Whether the row is collapsed' })),
    hideHeader: pipe(optional(vBoolean()), metadata({ description: 'Hide the row header' })),
    fillScreen: pipe(optional(vBoolean()), metadata({ description: 'Row fills viewport height' })),
    repeat: pipe(
      optional(rowRepeatOptionsSchema),
      metadata({ description: 'Repeat row for each value of a variable. Omit to leave unchanged.' })
    ),
  }),
  metadata({ description: 'Fields to update (partial RowsLayoutRowSpec)' })
);

export const tabsLayoutTabSpecSchema = object({
  title: pipe(optional(vString()), metadata({ description: 'Tab title' })),
  repeat: pipe(optional(tabRepeatOptionsSchema), metadata({ description: 'Repeat tab for each value of a variable' })),
});

export const partialTabSpecSchema = pipe(
  object({
    title: pipe(optional(vString()), metadata({ description: 'Tab title' })),
    repeat: pipe(
      optional(tabRepeatOptionsSchema),
      metadata({ description: 'Repeat tab for each value of a variable. Omit to leave unchanged.' })
    ),
  }),
  metadata({ description: 'Fields to update (partial TabsLayoutTabSpec)' })
);

// Payload schemas -- one per mutation command.
// These compose the building-block schemas above into the exact shape
// each command's `payload` field expects.

export const addVariablePayloadSchema = object({
  variable: pipe(variableKindSchema, metadata({ description: 'Variable definition (VariableKind)' })),
  position: pipe(
    optional(vNumber()),
    metadata({ description: 'Position in variables list (optional, appends if not set)' })
  ),
});

export const updateVariablePayloadSchema = object({
  name: pipe(vString(), metadata({ description: 'Variable name to update' })),
  variable: pipe(variableKindSchema, metadata({ description: 'New variable definition (VariableKind)' })),
});

export const removeVariablePayloadSchema = object({
  name: pipe(vString(), metadata({ description: 'Variable name to remove' })),
});

// Layout payload schemas

export const getLayoutPayloadSchema = emptyPayloadSchema;

export const addRowPayloadSchema = object({
  row: object({
    kind: optional(literal('RowsLayoutRow'), 'RowsLayoutRow'),
    spec: rowsLayoutRowSpecSchema,
  }),
  parentPath: pipe(
    optional(layoutPathSchema, '/'),
    metadata({
      description: 'Path to the parent container. "/" for root, or e.g. "/tabs/0" to add inside a tab.',
    })
  ),
  position: pipe(
    optional(vNumber()),
    metadata({ description: 'Zero-based index within the parent to insert at (appends if omitted)' })
  ),
});

export const removeRowPayloadSchema = object({
  path: pipe(layoutPathSchema, metadata({ description: 'Path to the row (e.g., "/rows/1", "/tabs/0/rows/2")' })),
  moveContentTo: pipe(
    optional(layoutPathSchema),
    metadata({
      description: 'Path to another group to move contained content to. Content is deleted if omitted.',
    })
  ),
});

export const updateRowPayloadSchema = object({
  path: pipe(layoutPathSchema, metadata({ description: 'Path to the row' })),
  spec: partialRowSpecSchema,
});

export const moveRowPayloadSchema = object({
  path: pipe(
    layoutPathSchema,
    metadata({ description: 'Current path to the row (e.g., "/rows/2", "/tabs/0/rows/1")' })
  ),
  toParent: pipe(
    optional(layoutPathSchema),
    metadata({
      description: 'Path to the destination parent. Omit to reorder within the same parent.',
    })
  ),
  toPosition: pipe(
    optional(vNumber()),
    metadata({ description: 'Zero-based index at the destination (appends if omitted)' })
  ),
});

export const addTabPayloadSchema = object({
  tab: object({
    kind: optional(literal('TabsLayoutTab'), 'TabsLayoutTab'),
    spec: tabsLayoutTabSpecSchema,
  }),
  parentPath: pipe(
    optional(layoutPathSchema, '/'),
    metadata({
      description: 'Path to the parent container. "/" for root, or e.g. "/rows/0" to add inside a row.',
    })
  ),
  position: pipe(
    optional(vNumber()),
    metadata({ description: 'Zero-based index within the parent to insert at (appends if omitted)' })
  ),
});

export const removeTabPayloadSchema = object({
  path: pipe(layoutPathSchema, metadata({ description: 'Path to the tab (e.g., "/tabs/1", "/rows/0/tabs/2")' })),
  moveContentTo: pipe(
    optional(layoutPathSchema),
    metadata({
      description: 'Path to another group to move contained content to. Content is deleted if omitted.',
    })
  ),
});

export const updateTabPayloadSchema = object({
  path: pipe(layoutPathSchema, metadata({ description: 'Path to the tab' })),
  spec: partialTabSpecSchema,
});

export const moveTabPayloadSchema = object({
  path: pipe(
    layoutPathSchema,
    metadata({ description: 'Current path to the tab (e.g., "/tabs/2", "/rows/0/tabs/1")' })
  ),
  toParent: pipe(
    optional(layoutPathSchema),
    metadata({
      description: 'Path to the destination parent. Omit to reorder within the same parent.',
    })
  ),
  toPosition: pipe(
    optional(vNumber()),
    metadata({ description: 'Zero-based index at the destination (appends if omitted)' })
  ),
});

export const layoutTypeSchema = picklist(['RowsLayout', 'TabsLayout', 'GridLayout', 'AutoGridLayout']);

export const autoGridOptionsSchema = pipe(
  object({
    maxColumnCount: pipe(optional(vNumber()), metadata({ description: 'Maximum number of columns' })),
    columnWidthMode: pipe(
      optional(picklist(['narrow', 'standard', 'wide', 'custom'])),
      metadata({ description: 'Column width preset. Use "custom" with columnWidth for pixel values.' })
    ),
    columnWidth: pipe(
      optional(vNumber()),
      metadata({ description: 'Custom column width in pixels (only used when columnWidthMode is "custom")' })
    ),
    rowHeightMode: pipe(
      optional(picklist(['short', 'standard', 'tall', 'custom'])),
      metadata({ description: 'Row height preset. Use "custom" with rowHeight for pixel values.' })
    ),
    rowHeight: pipe(
      optional(vNumber()),
      metadata({ description: 'Custom row height in pixels (only used when rowHeightMode is "custom")' })
    ),
    fillScreen: pipe(optional(vBoolean()), metadata({ description: 'Whether the grid fills the viewport height' })),
  }),
  metadata({ description: 'Options for AutoGridLayout only. Rejected for other layout types.' })
);

export const updateLayoutPayloadSchema = object({
  path: pipe(layoutPathSchema, metadata({ description: 'Path to the layout node (e.g. "/", "/rows/0", "/tabs/0")' })),
  layoutType: pipe(
    optional(layoutTypeSchema),
    metadata({
      description:
        'Target layout type. If omitted, keeps current type and just applies options. ' +
        'Group conversions: RowsLayout <-> TabsLayout. Grid conversions: GridLayout <-> AutoGridLayout.',
    })
  ),
  options: pipe(
    optional(autoGridOptionsSchema),
    metadata({ description: 'AutoGridLayout properties. Rejected for other layout types.' })
  ),
});

export const movePanelPayloadSchema = object({
  element: pipe(elementReferenceSchema, metadata({ description: 'Element to move, identified by name' })),
  toParent: pipe(
    optional(layoutPathSchema),
    metadata({
      description:
        'Path to the destination group (e.g., "/rows/1", "/tabs/0/rows/2"). Stays in current group if omitted.',
    })
  ),
  position: pipe(
    optional(gridPositionSchema),
    metadata({
      description:
        'New grid position (partial GridLayoutItemSpec). Keeps current values for omitted fields. ' +
        'Ignored for AutoGridLayout targets.',
    })
  ),
});

/**
 * Per-command payload schemas, accessible via DashboardMutationAPI.getPayloadSchema().
 *
 * Each value is a Valibot schema with a metadata() annotation that serves
 * as the command description (flows into JSON Schema for LLM consumers).
 */
/** Extract the description string from a schema's metadata action. */
export function getPayloadDescription<TSchema extends GenericSchema>(schema: TSchema): string {
  const metadata = getMetadata(schema);
  if (metadata && typeof metadata === 'object' && 'description' in metadata) {
    const desc = metadata.description;
    if (typeof desc === 'string') {
      return desc;
    }
  }
  return '';
}

export const payloads = {
  addVariable: pipe(addVariablePayloadSchema, metadata({ description: 'Add a new template variable' })),
  removeVariable: pipe(removeVariablePayloadSchema, metadata({ description: 'Remove a template variable' })),
  updateVariable: pipe(updateVariablePayloadSchema, metadata({ description: 'Update an existing template variable' })),
  listVariables: pipe(emptyPayloadSchema, metadata({ description: 'List all template variables on the dashboard' })),
  enterEditMode: pipe(emptyPayloadSchema, metadata({ description: 'Enter dashboard edit mode' })),
  getLayout: pipe(
    getLayoutPayloadSchema,
    metadata({ description: 'Get the dashboard layout tree and trimmed elements map' })
  ),
  addRow: pipe(addRowPayloadSchema, metadata({ description: 'Add a new row to the dashboard layout' })),
  removeRow: pipe(removeRowPayloadSchema, metadata({ description: 'Remove a row from the dashboard layout' })),
  updateRow: pipe(updateRowPayloadSchema, metadata({ description: 'Update a row in the dashboard layout' })),
  moveRow: pipe(moveRowPayloadSchema, metadata({ description: 'Move or reorder a row in the dashboard layout' })),
  addTab: pipe(addTabPayloadSchema, metadata({ description: 'Add a new tab to the dashboard layout' })),
  removeTab: pipe(removeTabPayloadSchema, metadata({ description: 'Remove a tab from the dashboard layout' })),
  updateTab: pipe(updateTabPayloadSchema, metadata({ description: 'Update a tab in the dashboard layout' })),
  moveTab: pipe(moveTabPayloadSchema, metadata({ description: 'Move or reorder a tab in the dashboard layout' })),
  movePanel: pipe(movePanelPayloadSchema, metadata({ description: 'Move a panel to a different group or position' })),
  updateLayout: pipe(
    updateLayoutPayloadSchema,
    metadata({ description: 'Update the layout type and/or properties at a given path' })
  ),
};
