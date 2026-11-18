/**
 * Dashboard Mutation API -- Canonical Zod Schemas & Payload Definitions
 *
 * This file contains two layers:
 *
 * 1. BUILDING-BLOCK SCHEMAS -- v2beta1 data structures (VariableKind, etc.)
 *    used internally by core code.
 *
 * 2. PAYLOAD SCHEMAS & `payloads` RECORD -- one Zod schema per mutation
 *    command, accessible via DashboardMutationAPI.getPayloadSchema().
 *
 * This file only depends on Zod and enum constants from @grafana/data,
 * keeping it safe for import from any internal module without pulling in
 * the DashboardScene dependency tree.
 *
 * DEFAULTS: Literal `kind` and `version` fields use z._default(schema, ...)
 * so consumers (e.g. LLM tools) can omit boilerplate. After parsing, these
 * fields are always present in the output.
 *
 * The `.check(z.describe(...))` annotations flow into generated JSON Schema via
 * `z.toJSONSchema()` and are used by LLM tool consumers for guidance.
 */

import * as z from 'zod/mini';

import { FieldMatcherID } from '@grafana/data';
import type { GridLayoutItemKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { isRecord } from 'app/core/utils/isRecord';

import { annotationQueryKindSchema, supportedVariableKindSchemas } from '../../v2schema/dashboardV2Schema';

import { GROUP_BY_VARIABLE_UNSUPPORTED } from './deprecatedGroupByVariable';

// The canonical schema lets `spec.name` default to '' (the v2 CUE has
// `name: string | *""`, valid for a full spec). A create/update command must
// name the variable, so payloads require a non-empty name on top of the shared
// structural schema. Commands must not author the deprecated GroupByVariable, so it is left out of the
// union (and the JSON schema) and gets an error naming its replacement, even when the payload is incomplete.
const namedVariableKindSchema = z
  .discriminatedUnion('kind', supportedVariableKindSchemas, {
    error: (issue) =>
      isRecord(issue.input) && issue.input.kind === 'GroupByVariable' ? GROUP_BY_VARIABLE_UNSUPPORTED : undefined,
  })
  .check(
    z.refine((variable) => typeof variable.spec.name === 'string' && variable.spec.name.trim().length > 0, {
      message: 'Variable spec.name is required and must be non-empty',
      path: ['spec', 'name'],
    })
  );

const dataQueryKindSchema = z.object({
  kind: z._default(z.literal('DataQuery'), 'DataQuery'),
  group: z.string().check(z.describe('Datasource type (e.g., "prometheus", "loki", "mysql")')),
  version: z._default(z.string(), 'v0'),
  datasource: z.optional(
    z.object({
      name: z.optional(z.string()),
    })
  ),
  spec: z
    .record(z.string(), z.unknown())
    .check(z.describe('Query-specific fields (e.g., expr for Prometheus, rawSql for SQL)')),
});

const emptyPayloadSchema = z.strictObject({});

// Layout building-block schemas (v2beta1)

const elementReferenceSchema = z.object({
  kind: z._default(z.literal('ElementReference'), 'ElementReference'),
  name: z.string().check(z.describe('Element key in the dashboard elements map')),
});

const layoutPathSchema = z
  .string()
  .check(
    z.regex(/^\/([a-z]+\/\d+(\/[a-z]+\/\d+)*)?$/),
    z.describe(
      'Path to a location in the layout tree, from GET_LAYOUT output. ' +
        'Examples: "/" (root), "/rows/0" (first row), "/tabs/1/rows/0" (first row inside second tab).'
    )
  );

const gridPositionSchema = z
  .object({
    x: z.optional(z.number()).check(z.describe('Column position (0-23 in a 24-column grid)')),
    y: z.optional(z.number()).check(z.describe('Row position')),
    width: z.optional(z.number()).check(z.describe('Width in grid columns (1-24)')),
    height: z.optional(z.number()).check(z.describe('Height in grid units')),
  })
  .check(z.describe('Grid position (partial GridLayoutItemSpec). Keeps current values for omitted fields.'));

const rowRepeatOptionsSchema = z
  .object({
    mode: z.literal('variable'),
    value: z.string().check(z.describe('Variable name to repeat by')),
  })
  .check(z.describe('Repeat options matching v2beta1 RowRepeatOptions'));

const tabRepeatOptionsSchema = z
  .object({
    mode: z.literal('variable'),
    value: z.string().check(z.describe('Variable name to repeat by')),
  })
  .check(z.describe('Repeat options matching v2beta1 TabRepeatOptions'));

const repeatOptionsSchema = z
  .object({
    mode: z.literal('variable'),
    value: z.string().check(z.describe('Variable name to repeat by')),
    direction: z.optional(z.enum(['h', 'v'])).check(z.describe('Repeat direction: horizontal or vertical')),
    maxPerRow: z.optional(z.number()).check(z.describe('Maximum panels per row when direction is "h"')),
  })
  .check(z.describe('Repeat options matching v2beta1 RepeatOptions'));

const conditionalRenderingVariableKindSchema = z.object({
  kind: z.literal('ConditionalRenderingVariable'),
  spec: z.object({
    variable: z.string().check(z.describe('Name of the dashboard template variable')),
    operator: z.enum(['equals', 'notEquals', 'matches', 'notMatches']),
    value: z.string().check(z.describe('Value to compare against. For matches/notMatches this is a regex.')),
  }),
});

const conditionalRenderingDataKindSchema = z.object({
  kind: z.literal('ConditionalRenderingData'),
  spec: z.object({
    value: z.boolean().check(z.describe('true = "has data", false = "no data"')),
  }),
});

const conditionalRenderingTimeRangeSizeKindSchema = z.object({
  kind: z.literal('ConditionalRenderingTimeRangeSize'),
  spec: z.object({
    value: z.string().check(z.describe('Duration threshold (e.g. "5m", "1h", "7d", "6M", "1y")')),
  }),
});

const conditionalRenderingGroupKindSchema = z.object({
  kind: z._default(z.literal('ConditionalRenderingGroup'), 'ConditionalRenderingGroup'),
  spec: z.object({
    visibility: z.enum(['show', 'hide']).check(z.describe('Whether to show or hide the element when conditions match')),
    condition: z.enum(['and', 'or']).check(z.describe('"and" = match all rules; "or" = match any rule')),
    items: z
      .array(
        z.discriminatedUnion('kind', [
          conditionalRenderingVariableKindSchema,
          conditionalRenderingDataKindSchema,
          conditionalRenderingTimeRangeSizeKindSchema,
        ])
      )
      .check(z.describe('List of conditions. Pass an empty array to remove all rules.')),
  }),
});

const rowsLayoutRowSpecSchema = z.object({
  title: z.optional(z.string()).check(z.describe('Row heading title')),
  collapse: z._default(z.boolean(), false).check(z.describe('Whether the row starts collapsed')),
  hideHeader: z._default(z.boolean(), false).check(z.describe('Hide the row header')),
  fillScreen: z._default(z.boolean(), false).check(z.describe('Row fills viewport height')),
  repeat: z.optional(rowRepeatOptionsSchema).check(z.describe('Repeat row for each value of a variable')),
  conditionalRendering: z
    .optional(conditionalRenderingGroupKindSchema)
    .check(z.describe('Show/hide rules for this row')),
  variables: z.optional(z.array(namedVariableKindSchema)).check(z.describe('Section-scoped variables for this row.')),
});

const partialRowSpecSchema = z
  .object({
    title: z.optional(z.string()).check(z.describe('Row heading title')),
    collapse: z.optional(z.boolean()).check(z.describe('Whether the row is collapsed')),
    hideHeader: z.optional(z.boolean()).check(z.describe('Hide the row header')),
    fillScreen: z.optional(z.boolean()).check(z.describe('Row fills viewport height')),
    repeat: z
      .optional(rowRepeatOptionsSchema)
      .check(z.describe('Repeat row for each value of a variable. Omit to leave unchanged.')),
    conditionalRendering: z
      .optional(conditionalRenderingGroupKindSchema)
      .check(z.describe('Show/hide rules for this row. Omit to leave unchanged.')),
    variables: z
      .optional(z.array(namedVariableKindSchema))
      .check(
        z.describe(
          'Section-scoped variables for this row. Omit to leave unchanged. Pass [] to clear section variables.'
        )
      ),
  })
  .check(z.describe('Fields to update (partial RowsLayoutRowSpec)'));

const tabsLayoutTabSpecSchema = z.object({
  title: z.optional(z.string()).check(z.describe('Tab title')),
  repeat: z.optional(tabRepeatOptionsSchema).check(z.describe('Repeat tab for each value of a variable')),
  conditionalRendering: z
    .optional(conditionalRenderingGroupKindSchema)
    .check(z.describe('Show/hide rules for this tab')),
  variables: z.optional(z.array(namedVariableKindSchema)).check(z.describe('Section-scoped variables for this tab.')),
});

const partialTabSpecSchema = z
  .object({
    title: z.optional(z.string()).check(z.describe('Tab title')),
    repeat: z
      .optional(tabRepeatOptionsSchema)
      .check(z.describe('Repeat tab for each value of a variable. Omit to leave unchanged.')),
    conditionalRendering: z
      .optional(conditionalRenderingGroupKindSchema)
      .check(z.describe('Show/hide rules for this tab. Omit to leave unchanged.')),
    variables: z
      .optional(z.array(namedVariableKindSchema))
      .check(
        z.describe(
          'Section-scoped variables for this tab. Omit to leave unchanged. Pass [] to clear section variables.'
        )
      ),
  })
  .check(z.describe('Fields to update (partial TabsLayoutTabSpec)'));

// Annotation building-block schemas (v2beta1)

const annotationEventFieldMappingSchema = z.object({
  source: z.optional(z.string()).check(z.describe('Source type for the field value (e.g., "field", "text")')),
  value: z.optional(z.string()).check(z.describe('Constant value to use when source is "text"')),
  regex: z.optional(z.string()).check(z.describe('Regular expression applied to the field value')),
});

const partialAnnotationPanelFilterSchema = z.object({
  exclude: z
    .optional(z.boolean())
    .check(z.describe('When true, the listed panels are excluded; otherwise only those panels show the annotation')),
  ids: z.optional(z.array(z.number())).check(z.describe('Panel IDs to include or exclude (replaces existing array)')),
});

const partialDataQueryKindSchema = z.object({
  kind: z.optional(z.literal('DataQuery')),
  group: z.optional(z.string()).check(z.describe('Datasource type (e.g., "prometheus", "loki", "grafana")')),
  version: z.optional(z.string()),
  datasource: z.optional(
    z.object({
      name: z.optional(z.string()),
    })
  ),
  spec: z
    .optional(z.record(z.string(), z.unknown()))
    .check(z.describe('Query-specific fields. Deep-merged into the existing query spec.')),
});

const partialAnnotationQueryKindSchema = z.object({
  kind: z.optional(z.literal('AnnotationQuery')),
  spec: z
    .object({
      name: z.optional(z.string()).check(z.describe('Rename the annotation. Must remain unique within the dashboard.')),
      enable: z.optional(z.boolean()),
      hide: z.optional(z.boolean()),
      iconColor: z.optional(z.string()),
      placement: z.optional(z.literal('inControlsMenu')),
      filter: z.optional(partialAnnotationPanelFilterSchema),
      mappings: z.optional(z.record(z.string(), annotationEventFieldMappingSchema)),
      legacyOptions: z.optional(z.record(z.string(), z.unknown())),
      query: z
        .optional(partialDataQueryKindSchema)
        .check(z.describe('Partial query update; deep-merged into existing query.')),
    })
    .check(z.describe('Fields to update (partial AnnotationQuerySpec). Omitted fields are left unchanged.')),
});

// Payload schemas -- one per mutation command.
// These compose the building-block schemas above into the exact shape
// each command's `payload` field expects.

const addVariablePayloadSchema = z.object({
  variable: namedVariableKindSchema.check(z.describe('Variable definition (VariableKind)')),
  position: z.optional(z.number()).check(z.describe('Position in variables list (optional, appends if not set)')),
  parentPath: z
    ._default(layoutPathSchema, '/')
    .check(
      z.describe(
        'Variable scope: "/" (default) = dashboard-level variables; "/rows/N" or "/tabs/N" (or nested) = section variables on that row or tab.'
      )
    ),
});

const updateVariablePayloadSchema = z.object({
  name: z.string().check(z.describe('Variable name to update')),
  variable: namedVariableKindSchema.check(z.describe('New variable definition (VariableKind)')),
  parentPath: z
    .optional(layoutPathSchema)
    .check(
      z.describe(
        'Variable scope: omit or "/" = dashboard-level. Pass a row/tab path (e.g. "/rows/0") to target section scope. ' +
          'Runtime returns a friendly error if the variable exists only on a section and parentPath is omitted.'
      )
    ),
});

const removeVariablePayloadSchema = z.object({
  name: z.string().check(z.describe('Variable name to remove')),
  parentPath: z
    .optional(layoutPathSchema)
    .check(
      z.describe(
        'Variable scope: omit or "/" = dashboard-level. Pass a row/tab path to target section scope. ' +
          'Runtime returns a friendly error if the variable exists only on a section and parentPath is omitted.'
      )
    ),
});

const listVariablesPayloadSchema = z.object({
  parentPath: z
    ._default(layoutPathSchema, '/')
    .check(
      z.describe(
        'Variable scope: "/" (default) = list dashboard-level variables; "/rows/N" or "/tabs/N" = list variables for that section only.'
      )
    ),
});

// Annotation payload schemas

const addAnnotationPayloadSchema = z.object({
  annotation: annotationQueryKindSchema.check(z.describe('Annotation definition (AnnotationQueryKind)')),
  position: z.optional(z.number()).check(z.describe('Position in annotations list (optional, appends if not set)')),
});

const updateAnnotationPayloadSchema = z.object({
  name: z.string().check(z.describe('Annotation name to update')),
  annotation: partialAnnotationQueryKindSchema.check(
    z.describe(
      'Partial annotation update. Only provided fields are applied. Object fields are deep-merged. ' +
        'Arrays (e.g. filter.ids) are replaced wholesale.'
    )
  ),
});

const removeAnnotationPayloadSchema = z.object({
  name: z.string().check(z.describe('Annotation name to remove')),
});

// Layout payload schemas

const getLayoutPayloadSchema = emptyPayloadSchema;

const addRowPayloadSchema = z.object({
  row: z.object({
    kind: z._default(z.literal('RowsLayoutRow'), 'RowsLayoutRow'),
    spec: rowsLayoutRowSpecSchema,
  }),
  parentPath: z
    ._default(layoutPathSchema, '/')
    .check(z.describe('Path to the parent container. "/" for root, or e.g. "/tabs/0" to add inside a tab.')),
  position: z
    .optional(z.number())
    .check(z.describe('Zero-based index within the parent to insert at (appends if omitted)')),
});

const removeRowPayloadSchema = z.object({
  path: layoutPathSchema.check(z.describe('Path to the row (e.g., "/rows/1", "/tabs/0/rows/2")')),
  moveContentTo: z
    .optional(layoutPathSchema)
    .check(z.describe('Path to another group to move contained content to. Content is deleted if omitted.')),
});

const updateRowPayloadSchema = z.object({
  path: layoutPathSchema.check(z.describe('Path to the row')),
  spec: partialRowSpecSchema,
});

const moveRowPayloadSchema = z.object({
  path: layoutPathSchema.check(z.describe('Current path to the row (e.g., "/rows/2", "/tabs/0/rows/1")')),
  toParent: z
    .optional(layoutPathSchema)
    .check(z.describe('Path to the destination parent. Omit to reorder within the same parent.')),
  toPosition: z.optional(z.number()).check(z.describe('Zero-based index at the destination (appends if omitted)')),
});

const addTabPayloadSchema = z.object({
  tab: z.object({
    kind: z._default(z.literal('TabsLayoutTab'), 'TabsLayoutTab'),
    spec: tabsLayoutTabSpecSchema,
  }),
  parentPath: z
    ._default(layoutPathSchema, '/')
    .check(z.describe('Path to the parent container. "/" for root, or e.g. "/rows/0" to add inside a row.')),
  position: z
    .optional(z.number())
    .check(z.describe('Zero-based index within the parent to insert at (appends if omitted)')),
});

const removeTabPayloadSchema = z.object({
  path: layoutPathSchema.check(z.describe('Path to the tab (e.g., "/tabs/1", "/rows/0/tabs/2")')),
  moveContentTo: z
    .optional(layoutPathSchema)
    .check(z.describe('Path to another group to move contained content to. Content is deleted if omitted.')),
});

const updateTabPayloadSchema = z.object({
  path: layoutPathSchema.check(z.describe('Path to the tab')),
  spec: partialTabSpecSchema,
});

const moveTabPayloadSchema = z.object({
  path: layoutPathSchema.check(z.describe('Current path to the tab (e.g., "/tabs/2", "/rows/0/tabs/1")')),
  toParent: z
    .optional(layoutPathSchema)
    .check(z.describe('Path to the destination parent. Omit to reorder within the same parent.')),
  toPosition: z.optional(z.number()).check(z.describe('Zero-based index at the destination (appends if omitted)')),
});

const layoutTypeSchema = z.enum(['RowsLayout', 'TabsLayout', 'GridLayout', 'AutoGridLayout']);

export const autoGridOptionsSchema = z
  .object({
    maxColumnCount: z.optional(z.number()).check(z.describe('Maximum number of columns')),
    columnWidthMode: z
      .optional(z.enum(['narrow', 'standard', 'wide', 'custom']))
      .check(z.describe('Column width preset. Use "custom" with columnWidth for pixel values.')),
    columnWidth: z
      .optional(z.number())
      .check(z.describe('Custom column width in pixels (only used when columnWidthMode is "custom")')),
    rowHeightMode: z
      .optional(z.enum(['short', 'standard', 'tall', 'custom']))
      .check(z.describe('Row height preset. Use "custom" with rowHeight for pixel values.')),
    rowHeight: z
      .optional(z.number())
      .check(z.describe('Custom row height in pixels (only used when rowHeightMode is "custom")')),
    fillScreen: z.optional(z.boolean()).check(z.describe('Whether the grid fills the viewport height')),
  })
  .check(z.describe('Options for AutoGridLayout only. Rejected for other layout types.'));

// Panel building-block schemas (v2beta1)

const dataLinkSchema = z.object({
  title: z.string().check(z.describe('Link title')),
  url: z.string().check(z.describe('Link URL')),
  targetBlank: z.optional(z.boolean()).check(z.describe('Open link in new tab')),
});

const panelQueryKindSchema = z
  .object({
    kind: z._default(z.literal('PanelQuery'), 'PanelQuery'),
    spec: z.object({
      query: dataQueryKindSchema.check(z.describe('The data query (DataQueryKind)')),
      refId: z.string().check(z.describe('Unique query reference ID (e.g., "A", "B")')),
      hidden: z._default(z.boolean(), false).check(z.describe('Whether this query is hidden from the panel')),
    }),
  })
  .check(z.describe('A single panel query wrapping a DataQueryKind with refId and hidden flag'));

export type PanelQueryKind = z.infer<typeof panelQueryKindSchema>;

const transformationKindSchema = z
  .object({
    kind: z.literal('Transformation').check(z.describe('Fixed literal "Transformation"')),
    group: z.string().check(z.describe('Transformation ID (e.g., "organize", "sortBy", "filterByValue")')),
    spec: z.object({
      refId: z
        .optional(z.string())
        .check(
          z.describe('Unique identifier of this transformation instance (e.g., "T1"), used to name its output frame')
        ),
      disabled: z.optional(z.boolean()).check(z.describe('Disabled transformations are skipped')),
      filter: z
        .optional(
          z.object({
            id: z.string().check(z.describe('Matcher ID')),
            options: z.optional(z.unknown()).check(z.describe('Matcher options')),
          })
        )
        .check(z.describe('Optional frame matcher to scope the transformation')),
      topic: z
        .optional(z.enum(['series', 'annotations', 'alertStates']))
        .check(z.describe('Data topic to pull frames from as input')),
      options: z._default(z.record(z.string(), z.unknown()), {}).check(z.describe('Transformation-specific options')),
    }),
  })
  .check(z.describe('A data transformation applied to query results'));

export type TransformationKind = z.infer<typeof transformationKindSchema>;

const queryOptionsSpecSchema = z
  .object({
    timeFrom: z.optional(z.string()).check(z.describe('Relative time override (e.g., "1h", "6h")')),
    maxDataPoints: z.optional(z.number()).check(z.describe('Maximum data points to return')),
    timeShift: z.optional(z.string()).check(z.describe('Time shift (e.g., "1h", "1d")')),
    queryCachingTTL: z.optional(z.number()).check(z.describe('Query caching TTL in milliseconds')),
    interval: z.optional(z.string()).check(z.describe('Min interval (e.g., "10s", "1m")')),
    cacheTimeout: z.optional(z.string()).check(z.describe('Cache timeout')),
    hideTimeOverride: z.optional(z.boolean()).check(z.describe('Hide time override info in panel header')),
    timeCompare: z.optional(z.string()).check(z.describe('Time comparison offset (e.g., "1d", "7d")')),
  })
  .check(z.describe('Query options for time range overrides and data point limits'));

const fieldConfigSchema = z
  .object({
    defaults: z
      ._default(z.record(z.string(), z.unknown()), {})
      .check(z.describe('Default field config applied to all fields')),
    overrides: z
      ._default(
        z.array(
          z.object({
            matcher: z.object({
              id: z
                .enum(FieldMatcherID)
                .check(
                  z.describe('Field matcher ID (e.g., "byName", "byRegexp", "byType", "byFrameRefID", "byValue")')
                ),
              options: z.optional(z.unknown()).check(z.describe('Matcher options')),
            }),
            properties: z.array(
              z.object({
                id: z.string().check(z.describe('Property ID')),
                value: z.optional(z.unknown()).check(z.describe('Property value')),
              })
            ),
          })
        ),
        []
      )
      .check(z.describe('Field config overrides for specific fields')),
  })
  .check(z.describe('Field configuration (defaults and overrides)'));

const vizConfigKindSchema = z
  .object({
    kind: z._default(z.literal('VizConfig'), 'VizConfig'),
    group: z
      .string()
      .check(
        z.minLength(1),
        z.describe('Plugin ID (e.g., "timeseries", "stat", "gauge", "table", "barchart", "piechart")')
      ),
    version: z._default(z.string(), ''),
    spec: z._default(
      z.object({
        options: z
          ._default(z.record(z.string(), z.unknown()), {})
          .check(z.describe('Panel-specific visualization options')),
        fieldConfig: z
          ._default(fieldConfigSchema, { defaults: {}, overrides: [] })
          .check(z.describe('Field configuration')),
      }),
      { options: {}, fieldConfig: { defaults: {}, overrides: [] } }
    ),
  })
  .check(z.describe('Visualization configuration (plugin + options + field config)'));

const queryGroupKindSchema = z
  .object({
    kind: z._default(z.literal('QueryGroup'), 'QueryGroup'),
    spec: z.object({
      queries: z.array(panelQueryKindSchema).check(z.describe('Array of panel queries')),
      transformations: z
        ._default(z.array(transformationKindSchema), [])
        .check(z.describe('Data transformations to apply after queries')),
      queryOptions: z
        ._default(queryOptionsSpecSchema, {})
        .check(z.describe('Query options (time overrides, max data points)')),
    }),
  })
  .check(z.describe('Query group containing queries, transformations, and query options'));

const panelKindSchema = z
  .object({
    kind: z._default(z.literal('Panel'), 'Panel'),
    spec: z.object({
      title: z.string().check(z.describe('Panel title')),
      description: z._default(z.string(), '').check(z.describe('Panel description')),
      links: z._default(z.array(dataLinkSchema), []).check(z.describe('Panel header links')),
      data: queryGroupKindSchema.check(z.describe('Query group (queries, transformations, query options)')),
      vizConfig: vizConfigKindSchema.check(
        z.describe('Visualization configuration (plugin type, options, field config)')
      ),
      transparent: z._default(z.boolean(), false).check(z.describe('Whether the panel background is transparent')),
    }),
  })
  .check(z.describe('A dashboard panel element (v2beta1 PanelKind)'));

const partialPanelKindSchema = z
  .object({
    kind: z._default(z.literal('Panel'), 'Panel'),
    spec: z.object({
      title: z.optional(z.string()).check(z.describe('Panel title')),
      description: z.optional(z.string()).check(z.describe('Panel description')),
      links: z.optional(z.array(dataLinkSchema)).check(z.describe('Panel header links (replaces existing)')),
      data: z
        .optional(
          z.object({
            kind: z._default(z.literal('QueryGroup'), 'QueryGroup'),
            spec: z.object({
              queries: z.optional(z.array(panelQueryKindSchema)).check(z.describe('Replace all queries')),
              transformations: z
                .optional(z.array(transformationKindSchema))
                .check(z.describe('Replace all transformations')),
              queryOptions: z.optional(queryOptionsSpecSchema).check(z.describe('Query options')),
            }),
          })
        )
        .check(z.describe('Query group (partial). When provided, spec is required.')),
      vizConfig: z
        .optional(
          z.object({
            kind: z._default(z.literal('VizConfig'), 'VizConfig'),
            group: z.optional(z.string()).check(z.describe('Change plugin ID (e.g., "timeseries" to "stat")')),
            version: z.optional(z.string()),
            spec: z.optional(
              z.object({
                options: z
                  .optional(z.record(z.string(), z.unknown()))
                  .check(z.describe('Panel options (deep-merged into existing)')),
                fieldConfig: z
                  .optional(fieldConfigSchema)
                  .check(z.describe('Field config (deep-merged into existing)')),
              })
            ),
          })
        )
        .check(z.describe('Visualization configuration (partial)')),
      transparent: z.optional(z.boolean()).check(z.describe('Whether the panel background is transparent')),
    }),
  })
  .check(z.describe('Partial panel update (all fields optional, only provided fields are applied)'));

// Layout item schemas (v2beta1)
// Canonical schemas match the generated v2beta1 types exactly (validated via `satisfies`).
// The input schema (`layoutItemInputSchema`) is derived with relaxed constraints for callers.

const gridLayoutItemKindSchema = z.object({
  kind: z._default(z.literal('GridLayoutItem'), 'GridLayoutItem'),
  spec: z.object({
    x: z.number().check(z.describe('Column position (0-23 in a 24-column grid)')),
    y: z.number().check(z.describe('Row position')),
    width: z.number().check(z.describe('Width in grid columns (1-24)')),
    height: z.number().check(z.describe('Height in grid units')),
    element: elementReferenceSchema,
    repeat: z.optional(repeatOptionsSchema).check(z.describe('Repeat for each value of a variable')),
  }),
}) satisfies z.ZodMiniType<GridLayoutItemKind>;

const layoutItemInputSchema = z
  .object({
    kind: z
      .optional(z.enum(['GridLayoutItem', 'AutoGridLayoutItem']))
      .check(
        z.describe(
          'Layout item type hint. If omitted, automatically determined from the target layout. ' +
            'A warning is emitted if the provided kind does not match the target layout.'
        )
      ),
    spec: z._default(
      z.partial(
        z.extend(z.omit(gridLayoutItemKindSchema.shape.spec, { element: true }), {
          conditionalRendering: z
            .optional(conditionalRenderingGroupKindSchema)
            .check(
              z.describe(
                'Show/hide rules (Auto grid layout only). ' +
                  'On ADD_PANEL, ignored with a warning if the target is not Auto grid. ' +
                  'On UPDATE_PANEL, returns an error.'
              )
            ),
        })
      ),
      {}
    ),
  })
  .check(
    z.describe(
      'Layout item with optional sizing hints. The kind is optional and auto-detected from the target layout. ' +
        'For GridLayout targets, provide x/y/width/height in spec. For AutoGridLayout targets, position is auto-arranged.'
    )
  );

const updateLayoutPayloadSchema = z.object({
  path: layoutPathSchema.check(z.describe('Path to the layout node (e.g. "/", "/rows/0", "/tabs/0")')),
  layoutType: z
    .optional(layoutTypeSchema)
    .check(
      z.describe(
        'Target layout type. If omitted, keeps current type and just applies options. ' +
          'Group conversions: RowsLayout <-> TabsLayout. Grid conversions: GridLayout <-> AutoGridLayout.'
      )
    ),
  options: z
    .optional(autoGridOptionsSchema)
    .check(z.describe('AutoGridLayout properties. Rejected for other layout types.')),
});

// Panel payload schemas

const addPanelPayloadSchema = z.object({
  panel: panelKindSchema.check(
    z.describe('Panel to add (v2beta1 PanelKind). The id field is ignored and auto-assigned.')
  ),
  parentPath: z
    ._default(layoutPathSchema, '/')
    .check(
      z.describe('Path to the parent container. "/" for root, or e.g. "/rows/0", "/tabs/1" to add inside a group.')
    ),
  layoutItem: z
    .optional(layoutItemInputSchema)
    .check(
      z.describe(
        'Layout item with sizing hints. The kind is adapted to match the target layout (warning emitted if converted). ' +
          'If omitted, defaults are used.'
      )
    ),
});

const updatePanelPayloadSchema = z
  .object({
    element: elementReferenceSchema.check(z.describe('Panel to update, identified by element name')),
    panel: z
      .optional(partialPanelKindSchema)
      .check(
        z.describe(
          'Partial panel update. Only provided fields are applied. Options and fieldConfig are deep-merged. ' +
            'Can be omitted when only setting conditionalRendering.'
        )
      ),
    conditionalRendering: z
      .optional(conditionalRenderingGroupKindSchema)
      .check(z.describe('Show/hide rules for this panel (Auto grid layout only). Omit to leave unchanged.')),
  })
  .check(
    z.superRefine((data, ctx) => {
      if (!data.panel && data.conditionalRendering === undefined) {
        ctx.addIssue({
          code: 'custom',
          // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
          message: 'At least one of panel or conditionalRendering must be provided.',
        });
      }
    })
  );

const removePanelPayloadSchema = z.object({
  elements: z
    .array(elementReferenceSchema)
    .check(z.maxLength(10), z.describe('Panels to remove, identified by element name')),
});

const listPanelsPayloadSchema = z.object({
  elements: z
    .optional(z.array(z.string()))
    .check(z.describe('Element names to return (e.g. ["panel-1", "panel-5"]). Omit to return all.')),
  evaluateVariables: z
    ._default(z.boolean(), false)
    .check(z.describe('When true, include evaluatedQueries with template variables resolved to current values')),
  includeStatus: z
    ._default(z.boolean(), false)
    .check(
      z.describe(
        'When true, include per-panel runtime status: loadingState, hasError, hasNoData, a structured errors array (source query/plugin/notice, message, refId/type), and info/warning notices'
      )
    ),
  includeSchema: z
    ._default(z.boolean(), false)
    .check(
      z.describe(
        'When true, include per-panel dataSchema: the fields each result frame produced ({ name, type, labels }), for targeting field names in transformations or byName overrides'
      )
    ),
});

const movePanelPayloadSchema = z.object({
  element: elementReferenceSchema.check(z.describe('Element to move, identified by name')),
  toParent: z
    .optional(layoutPathSchema)
    .check(
      z.describe(
        'Path to the destination group (e.g., "/rows/1", "/tabs/0/rows/2"). Stays in current group if omitted.'
      )
    ),
  layoutItem: z
    .optional(layoutItemInputSchema)
    .check(
      z.describe(
        'Layout item with sizing hints. The kind is adapted to match the target layout (warning emitted if converted). ' +
          'If omitted, preserves current dimensions.'
      )
    ),
  /** @deprecated Use layoutItem instead */
  position: z.optional(gridPositionSchema).check(z.describe('DEPRECATED: Use layoutItem instead.')),
});

const dashboardLinkSchema = z.object({
  title: z.string().check(z.describe('Link label shown in the dashboard top bar')),
  url: z.optional(z.string()).check(z.describe('Link target URL (required when type is "link")')),
  type: z
    ._default(z.enum(['link', 'dashboards']), 'link')
    .check(z.describe('Link type: "link" (single URL) or "dashboards" (by tags)')),
  tooltip: z.optional(z.string()).check(z.describe('Hover tooltip')),
  icon: z.optional(z.string()).check(z.describe('Icon name, e.g. "external link"')),
  targetBlank: z.optional(z.boolean()).check(z.describe('Open in a new tab')),
  asDropdown: z.optional(z.boolean()).check(z.describe('Render tag-based links as a dropdown')),
  includeVars: z.optional(z.boolean()).check(z.describe('Append current template variable values to the link')),
  keepTime: z.optional(z.boolean()).check(z.describe('Append the current time range to the link')),
  tags: z.optional(z.array(z.string())).check(z.describe('Tags used when type is "dashboards"')),
  placement: z
    .optional(z.literal('inControlsMenu'))
    .check(z.describe('Render the link in the dashboard controls dropdown menu instead of above the panels')),
});

const timeSettingsSchema = z
  .object({
    from: z.optional(z.string()).check(z.describe('Start of time range (e.g. "now-6h")')),
    to: z.optional(z.string()).check(z.describe('End of time range (e.g. "now")')),
    autoRefresh: z
      .optional(z.string())
      .check(
        z.describe('Auto-refresh interval (e.g. "5s", "1m", "5m", "15m", "30m", "1h", "2h", "1d", "" to disable)')
      ),
    timezone: z.optional(z.string()).check(z.describe('Timezone ("browser", "utc", or IANA timezone)')),
  })
  .check(z.describe('Dashboard time settings. Partial update: only the provided fields change.'));

const updateDashboardSettingsPayloadSchema = z.object({
  title: z.optional(z.string()).check(z.describe('Dashboard title')),
  description: z.optional(z.string()).check(z.describe('Dashboard description')),
  tags: z.optional(z.array(z.string())).check(z.describe('Dashboard tags')),
  editable: z.optional(z.boolean()).check(z.describe('Whether the dashboard is editable')),
  cursorSync: z
    .optional(z.enum(['Off', 'Crosshair', 'Tooltip']))
    .check(z.describe('Shared crosshair/tooltip behavior across panels')),
  links: z
    .optional(z.array(dashboardLinkSchema))
    .check(z.describe('Replaces the full dashboard links list. Pass [] to clear all links.')),
  timeSettings: z.optional(timeSettingsSchema),
  liveNow: z.optional(z.boolean()).check(z.describe('Continuously redraw panels to keep live data moving left')),
  preload: z.optional(z.boolean()).check(z.describe('Load all panels when the dashboard loads')),
});

const getSpecPayloadSchema = z.strictObject({
  validate: z
    ._default(z.boolean(), false)
    .check(z.describe('When true, validate the serialized spec against the v2 schema and fail if it is invalid.')),
});

const applySpecPayloadSchema = z.object({
  spec: z
    .record(z.string(), z.unknown())
    .check(z.describe('A complete v2 DashboardSpec to apply (same shape GET_SPEC returns).')),
  validate: z
    ._default(z.boolean(), false)
    .check(z.describe('When true, validate the spec against the v2 schema and reject the mutation if it is invalid.')),
});

const expectedActorSchema = z
  .optional(z.string())
  .check(z.describe('Refuse, changing nothing, unless the entry was made by this actor (e.g. "mutation-api").'));

const expectedBatchIdSchema = z
  .optional(z.string())
  .check(z.describe('Refuse, changing nothing, unless the entry is the batch START_BATCH returned this batchId for.'));

const scopeSelectionSchema = z.union([
  z.literal('all'),
  z.literal('none'),
  z.array(z.string()).check(z.describe('Variable names in this scope')),
]);

// Literal (not the AnnoKey import) so this file stays free of the apiserver/scene graph.
const useCrossDashboardVariablesAnnoKey = 'grafana.app/useCrossDashboardVariables';

const useCrossDashboardVariablesValueSchema = z.object({
  global: scopeSelectionSchema.check(z.describe('Which org-wide variables this dashboard receives')),
  folder: scopeSelectionSchema.check(z.describe('Which folder-scoped variables this dashboard receives')),
});

const metadataAnnotationKeySchema = z
  .enum([useCrossDashboardVariablesAnnoKey])
  .check(z.describe('Allowlisted metadata.annotations key'));

const getMetadataAnnotationsPayloadSchema = z.strictObject({
  annotations: z
    .array(metadataAnnotationKeySchema)
    .check(
      z.minLength(1),
      z.describe(
        'Metadata annotation keys to read. Only grafana.app/useCrossDashboardVariables is allowed today; unknown keys are rejected. This is not a query annotation layer.'
      )
    ),
});

const updateMetadataAnnotationsPayloadSchema = z.strictObject({
  annotations: z
    .strictObject({
      [useCrossDashboardVariablesAnnoKey]: z
        .union([useCrossDashboardVariablesValueSchema, z.null()])
        .check(
          z.describe(
            'Which global and folder-scoped variables this dashboard receives. null or both scopes "none" clears the opt-in.'
          )
        ),
    })
    .check(
      z.describe(
        'Metadata annotations to write. Only grafana.app/useCrossDashboardVariables is allowed today; unknown keys are rejected. This is not a query annotation layer.'
      )
    ),
});

const PLAN_GRID_COLUMNS = 24;

const renderPlanPanelShape = {
  title: z.string().check(z.describe('Panel title')),
  vizType: z.string().check(z.describe('Visualization plugin id (e.g. "timeseries", "piechart", "table")')),
};

const renderPlanGridPosSchema = z
  .object({
    x: z.number().check(z.int(), z.minimum(0)),
    y: z.number().check(z.int(), z.minimum(0)),
    w: z.number().check(z.int(), z.minimum(1)),
    h: z.number().check(z.int(), z.minimum(1)),
  })
  .check(
    z.refine(({ x, w }) => x + w <= PLAN_GRID_COLUMNS, {
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      message: `A panel cannot extend past the ${PLAN_GRID_COLUMNS}-column grid.`,
    })
  );

/** Plan fields an editable preview keeps, so the plan it hands back still has everything it was given. */
const renderPlanEditablePanelShape = {
  ...renderPlanPanelShape,
  id: z
    .optional(z.number().check(z.int(), z.positive()))
    .check(
      z.describe(
        'Stable id, unique in the plan. Becomes the panel key "panel-<id>", which the built dashboard keeps. ' +
          'Panels without one get the next free id.'
      )
    ),
  gridPos: z
    .optional(renderPlanGridPosSchema)
    .check(
      z.describe(
        "Position on the section's 24-column grid. Used only when every panel in the section has one; " +
          'otherwise the section is packed automatically.'
      )
    ),
  intent: z.optional(z.string()).check(z.describe('What the panel should show, shown on the placeholder')),
  visualization: z.optional(z.string()).check(z.describe("The plan's own wording for the visualization, kept as is")),
  repeatFor: z.optional(z.string()).check(z.describe('Variable the panel repeats for, kept as is')),
};

const renderPlanEditableSectionShape = {
  id: z
    .optional(z.string().check(z.minLength(1)))
    .check(z.describe('Stable id, unique in the plan. Sections without one get a generated id.')),
  repeatFor: z.optional(z.string()).check(z.describe('Variable the section repeats for, kept as is')),
};

function buildRenderPlanFields<P extends z.core.$ZodShape, S extends z.core.$ZodShape>(panelShape: P, sectionShape: S) {
  const panels = z.array(z.object(panelShape));
  const row = z.object({
    ...sectionShape,
    title: z.string().check(z.describe('Row title')),
    panels: panels.check(z.describe('Panels in this row, rendered as query-less placeholders')),
  });
  const section = z.object({
    ...sectionShape,
    title: z.string().check(z.describe('Row or tab title')),
    panels: panels.check(z.describe('Panels in this row/tab, rendered as query-less placeholders')),
    sections: z
      .optional(z.array(row))
      .check(
        z.describe(
          'Rows nested inside a tab, one level deep. Only valid when layout is "tabs"; a tab with rows must have ' +
            'empty panels, since its panels belong to the rows.'
        )
      ),
  });

  return z.object({
    planId: z
      .string()
      .check(z.describe('Opaque identity for this plan, used to match a later END_PLANNING call to it')),
    title: z.string().check(z.describe('Dashboard title the plan proposes')),
    description: z.optional(z.string()).check(z.describe('Dashboard description the plan proposes')),
    layout: z
      ._default(z.enum(['rows', 'tabs']), 'rows')
      .check(z.describe('Whether sections render as rows or as tabs')),
    sections: z.array(section).check(z.describe('The plan’s rows or tabs, each with its own panels')),
    variables: z
      .optional(z.array(z.string()))
      .check(
        z.describe(
          'Names of stand-in variables to preview alongside the plan. Sample values are generated here -- ' +
            'the plan names only the variable, not what its values should look like.'
        )
      ),
  });
}

const renderPlanPreviewFields = buildRenderPlanFields(renderPlanPanelShape, {});
const renderPlanEditableFields = buildRenderPlanFields(renderPlanEditablePanelShape, renderPlanEditableSectionShape);

const renderPlanPhaseShape = {
  phase: z
    ._default(z.enum(['preview', 'building']), 'preview')
    .check(
      z.describe(
        '"preview" renders the plan with sample data and Build/Dismiss actions. "building" shows a loading ' +
          'screen instead, while the plan is built: the first write replaces it, and END_PLANNING ends it ' +
          'when the build writes nothing.'
      )
    ),
};

function validateRenderPlanSections<T extends z.infer<typeof renderPlanPreviewFields>>(
  data: T,
  ctx: z.core.$RefinementCtx<T>
) {
  data.sections.forEach((section, index) => {
    if (!section.sections?.length) {
      return;
    }
    if (data.layout !== 'tabs') {
      ctx.addIssue({
        code: 'custom',
        path: ['sections', index, 'sections'],
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        message: 'Nested rows are only supported inside tabs (layout "tabs").',
      });
    }
    if (section.panels.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['sections', index, 'panels'],
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        message: 'A tab with nested rows cannot also have its own panels.',
      });
    }
  });
}

/** Ids name panels and sections across revisions, so two of either sharing one would be ambiguous. */
function validateRenderPlanIds<T extends z.infer<typeof renderPlanEditableFields>>(
  data: T,
  ctx: z.core.$RefinementCtx<T>
) {
  const panelIds = new Set<number>();
  const sectionIds = new Set<string>();
  const sections = data.sections.flatMap((section) => [section, ...(section.sections ?? [])]);
  for (const section of sections) {
    if (section.id !== undefined) {
      if (sectionIds.has(section.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['sections'],
          // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
          message: `Section id "${section.id}" is used more than once.`,
        });
      }
      sectionIds.add(section.id);
    }
    for (const panel of section.panels) {
      if (panel.id !== undefined) {
        if (panelIds.has(panel.id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['sections'],
            // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
            message: `Panel id ${panel.id} is used more than once.`,
          });
        }
        panelIds.add(panel.id);
      }
    }
  }
}

function validateEditableRenderPlan<T extends z.infer<typeof renderPlanEditableFields>>(
  data: T,
  ctx: z.core.$RefinementCtx<T>
) {
  validateRenderPlanSections(data, ctx);
  validateRenderPlanIds(data, ctx);
}

const RENDER_PLAN_PREVIEW_DESCRIPTION =
  'Open a dashboard plan preview and render query-less sample panels for the whole plan in one call. The dashboard never enters edit mode while previewing.';
const RENDER_PLAN_DESCRIPTION =
  'Open a dashboard plan preview and render query-less sample panels for the whole plan in one call, or show a loading screen while the plan is built. The dashboard never enters edit mode while previewing.';

/** RENDER_PLAN without `phase`, as advertised while the plan building screen is off. */
const renderPlanPreviewPayloadSchema = renderPlanPreviewFields.check(
  z.superRefine(validateRenderPlanSections),
  z.describe(RENDER_PLAN_PREVIEW_DESCRIPTION)
);

const renderPlanBuildingPayloadSchema = z
  .extend(renderPlanPreviewFields, renderPlanPhaseShape)
  .check(z.superRefine(validateRenderPlanSections), z.describe(RENDER_PLAN_DESCRIPTION));

const renderPlanEditablePreviewPayloadSchema = renderPlanEditableFields.check(
  z.superRefine(validateEditableRenderPlan),
  z.describe(RENDER_PLAN_PREVIEW_DESCRIPTION)
);

/** Everything RENDER_PLAN accepts. A caller is shown only the parts that are on; see renderPlanPayloadSchemaFor. */
const renderPlanPayloadSchema = z
  .extend(renderPlanEditableFields, renderPlanPhaseShape)
  .check(z.superRefine(validateEditableRenderPlan), z.describe(RENDER_PLAN_DESCRIPTION));

/**
 * RENDER_PLAN as advertised to a caller, which detects what this Grafana supports by whether a field
 * survives a parse. A field for something that is off is left out, so the caller never sends it.
 */
export function renderPlanPayloadSchemaFor({ building, editing }: { building: boolean; editing: boolean }) {
  if (editing) {
    return building ? renderPlanPayloadSchema : renderPlanEditablePreviewPayloadSchema;
  }
  return building ? renderPlanBuildingPayloadSchema : renderPlanPreviewPayloadSchema;
}

/** Parses RENDER_PLAN for execution, leaving out plan editing's fields while it is off. */
export function parseRenderPlanPayload(payload: unknown, { editing }: { editing: boolean }) {
  return editing ? renderPlanPayloadSchema.safeParse(payload) : renderPlanBuildingPayloadSchema.safeParse(payload);
}

const getPlanPayloadSchema = z.object({
  planId: z.string().check(z.describe('The plan being previewed. GET_PLAN is refused if this does not match.')),
});

const endPlanningPayloadSchema = z.object({
  planId: z.string().check(z.describe('The plan being previewed. END_PLANNING is refused if this does not match.')),
  restoreUserLocation: z
    .optional(z.boolean())
    .check(z.describe('Return to the page that was open before previewing; omit when building')),
});

/**
 * Per-command payload schemas, accessible via DashboardMutationAPI.getPayloadSchema().
 *
 * Each value is a Zod schema with a `.check(z.describe(...))` annotation that serves
 * as the command description (flows into JSON Schema for LLM consumers).
 */
export const payloads = {
  addVariable: addVariablePayloadSchema.check(z.describe('Add a new template variable')),
  removeVariable: removeVariablePayloadSchema.check(z.describe('Remove a template variable')),
  updateVariable: updateVariablePayloadSchema.check(z.describe('Update an existing template variable')),
  addAnnotation: addAnnotationPayloadSchema.check(z.describe('Add a new dashboard annotation layer')),
  updateAnnotation: updateAnnotationPayloadSchema.check(
    z.describe('Update an existing dashboard annotation layer by name (partial update, deep-merge)')
  ),
  removeAnnotation: removeAnnotationPayloadSchema.check(z.describe('Remove a dashboard annotation layer by name')),
  listAnnotations: emptyPayloadSchema.check(z.describe('List all annotation layers on the dashboard')),
  listVariables: listVariablesPayloadSchema.check(
    z.describe('List template variables for a scope (dashboard or section)')
  ),
  enterEditMode: emptyPayloadSchema.check(z.describe('Enter dashboard edit mode')),
  getLayout: getLayoutPayloadSchema.check(z.describe('Get the dashboard layout tree and trimmed elements map')),
  addRow: addRowPayloadSchema.check(z.describe('Add a new row to the dashboard layout')),
  removeRow: removeRowPayloadSchema.check(z.describe('Remove a row from the dashboard layout')),
  updateRow: updateRowPayloadSchema.check(z.describe('Update a row in the dashboard layout')),
  moveRow: moveRowPayloadSchema.check(z.describe('Move or reorder a row in the dashboard layout')),
  addTab: addTabPayloadSchema.check(z.describe('Add a new tab to the dashboard layout')),
  removeTab: removeTabPayloadSchema.check(z.describe('Remove a tab from the dashboard layout')),
  updateTab: updateTabPayloadSchema.check(z.describe('Update a tab in the dashboard layout')),
  moveTab: moveTabPayloadSchema.check(z.describe('Move or reorder a tab in the dashboard layout')),
  updateLayout: updateLayoutPayloadSchema.check(z.describe('Update the layout type and/or properties at a given path')),
  addPanel: addPanelPayloadSchema.check(z.describe('Add a new panel to the dashboard')),
  updatePanel: updatePanelPayloadSchema.check(
    z.describe('Update an existing panel (partial update, deep-merge for options/fieldConfig)')
  ),
  removePanel: removePanelPayloadSchema.check(z.describe('Remove one or more panels from the dashboard')),
  getPanelErrors: z
    .pick(listPanelsPayloadSchema, { elements: true })
    .check(z.describe('Read current panel errors without panel specifications')),
  listPanels: listPanelsPayloadSchema.check(z.describe('List all panels on the dashboard with their layout items')),
  movePanel: movePanelPayloadSchema.check(
    z.describe('Move a panel to a different group or reposition within the current group')
  ),
  getDashboardInfo: emptyPayloadSchema.check(
    z.describe(
      'Get dashboard identity/folder metadata plus all settings (title, description, tags, editable, cursorSync, links, timeSettings, liveNow, preload)'
    )
  ),
  updateDashboardSettings: updateDashboardSettingsPayloadSchema.check(
    z.describe(
      'Update dashboard settings (title, description, tags, editable, cursorSync, links, timeSettings, liveNow, preload)'
    )
  ),
  getSpec: getSpecPayloadSchema.check(z.describe('Return the entire dashboard as a v2 DashboardSpec JSON object.')),
  applySpec: applySpecPayloadSchema.check(
    z.describe(
      'Replace the dashboard with a complete v2 DashboardSpec. The scene is rebuilt from the spec ' +
        '(settings, variables, annotations, panels, and nested rows/tabs layout).'
    )
  ),
  startBatch: z
    .strictObject({
      description: z.string().check(z.minLength(1), z.describe('Label of the undo entry the batch becomes.')),
    })
    .check(
      z.describe(
        'Start collecting edits into one undo entry, made by the "mutation-api" actor, until END_BATCH. ' +
          "Every dashboard edit in between joins it, including the user's, so end it as soon as the work is done. " +
          'Returns the batchId that names the entry.'
      )
    ),
  endBatch: z
    .strictObject({})
    .check(z.describe('Close the batch START_BATCH opened. A batch with no edits adds no entry.')),
  getLastAction: z
    .strictObject({})
    .check(
      z.describe(
        'Return the description, actor, and batchId (for an entry START_BATCH collected) of the newest undo ' +
          'entry (action) and of the newest undone entry (undoneAction), each null when there is none.'
      )
    ),
  undo: z
    .strictObject({ expectedActor: expectedActorSchema, expectedBatchId: expectedBatchIdSchema })
    .check(z.describe('Undo the newest dashboard undo entry. Reports undone=false when there is nothing to undo.')),
  redo: z
    .strictObject({ expectedActor: expectedActorSchema, expectedBatchId: expectedBatchIdSchema })
    .check(
      z.describe(
        'Redo the newest undone dashboard entry. Reports redone=false when there is nothing to redo; any new ' +
          'edit clears the redo history.'
      )
    ),
  getMetadataAnnotations: getMetadataAnnotationsPayloadSchema.check(
    z.describe(
      'Read allowlisted metadata.annotations. Currently only grafana.app/useCrossDashboardVariables is readable. Not a query annotation layer (use LIST_ANNOTATIONS). GET_SPEC / APPLY_SPEC do not include these annotations.'
    )
  ),
  updateMetadataAnnotations: updateMetadataAnnotationsPayloadSchema.check(
    z.describe(
      'Update allowlisted metadata.annotations. Currently only grafana.app/useCrossDashboardVariables is writable. Not a query annotation layer (use ADD_ANNOTATION / UPDATE_ANNOTATION). GET_SPEC / APPLY_SPEC do not include these annotations.'
    )
  ),
  renderPlan: renderPlanPayloadSchema,
  endPlanning: endPlanningPayloadSchema.check(z.describe('End the plan preview and clear the dashboard back to empty')),
  getPlan: getPlanPayloadSchema.check(
    z.describe(
      'Read the plan being previewed, with the layout the user has arranged, and its revision. The revision ' +
        'goes up with every change to the plan.'
    )
  ),
  reloadFromServer: z
    .strictObject({
      pendingChanges: z
        .optional(z.nullable(z.string()))
        .check(
          z.describe(
            'Preview these pending changes instead (see the pendingChanges URL parameter); null shows the saved dashboard. Omit to keep what the page shows.'
          )
        ),
    })
    .check(
      z.describe(
        'Reload the open dashboard from the server, for example after a newer version was saved through the HTTP API. Does nothing and reports reloaded=false when the open dashboard has unsaved changes.'
      )
    ),
};
