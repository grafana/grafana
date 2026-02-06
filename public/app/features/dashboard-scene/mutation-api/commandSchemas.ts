/**
 * Dashboard Command Schema Definitions
 *
 * Defines the command schemas exposed by the Dashboard Mutation API.
 * Only implemented commands are listed here -- add new schemas as handlers are implemented.
 */

import { CommandSchemaDefinition, ResourceSchemaDefinition, PromptSchemaDefinition } from './types';

/**
 * Command schemas for implemented dashboard mutation commands.
 */
export const DASHBOARD_COMMAND_SCHEMAS: CommandSchemaDefinition[] = [
  {
    name: 'GET_DASHBOARD_INFO',
    status: 'implemented',
    description: `Get information about the currently loaded dashboard and available mutation commands.

Returns dashboard metadata including:
- uid: Dashboard unique identifier
- title: Dashboard title
- canEdit: Whether the current user has edit permissions
- isEditing: Whether the dashboard is currently in edit mode
- availableCommands: List of available mutation command names

Use this command to check the current dashboard state before making mutations.`,
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  {
    name: 'ENTER_EDIT_MODE',
    status: 'implemented',
    description:
      'Enter edit mode on the dashboard. Required before making mutations if the dashboard is not already in edit mode.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  {
    name: 'ADD_PANEL',
    status: 'implemented',
    description:
      'Add a new panel to the dashboard. Creates both the panel definition in elements and a layout item. Automatically generates a unique element name and positions the panel.',
    inputSchema: {
      type: 'object',
      properties: {
        panel: {
          type: 'object',
          description: 'Panel definition using PanelKind structure',
          properties: {
            kind: { type: 'string', enum: ['Panel'] },
            spec: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Panel title' },
                description: { type: 'string', description: 'Panel description' },
                transparent: { type: 'boolean', description: 'Transparent background' },
                vizConfig: {
                  type: 'object',
                  description: 'Visualization configuration',
                  properties: {
                    kind: { type: 'string', enum: ['VizConfig'] },
                    group: { type: 'string', description: 'Plugin ID (e.g., "timeseries", "stat", "gauge", "table")' },
                    version: { type: 'string' },
                    spec: {
                      type: 'object',
                      properties: {
                        options: { type: 'object', description: 'Visualization-specific options' },
                        fieldConfig: {
                          type: 'object',
                          description: 'Field configuration (units, thresholds, mappings)',
                        },
                      },
                    },
                  },
                  required: ['group'],
                },
                data: {
                  type: 'object',
                  description: 'Query group with queries and transformations',
                },
              },
              required: ['title', 'vizConfig'],
            },
          },
          required: ['kind', 'spec'],
        },
        position: {
          type: 'object',
          description: 'Panel position in the layout grid',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            width: { type: 'number' },
            height: { type: 'number' },
          },
        },
      },
      required: ['panel'],
    },
  },

  {
    name: 'REMOVE_PANEL',
    status: 'implemented',
    description: 'Remove a panel from the dashboard by element name or panel ID.',
    inputSchema: {
      type: 'object',
      properties: {
        elementName: { type: 'string', description: 'Element name (e.g., "panel-1")' },
        panelId: { type: 'number', description: 'Alternative: numeric panel ID' },
      },
    },
  },

  {
    name: 'UPDATE_PANEL',
    status: 'implemented',
    description: "Update an existing panel's properties, queries, or configuration. Only provided fields are changed.",
    inputSchema: {
      type: 'object',
      properties: {
        elementName: { type: 'string', description: 'Element name to update' },
        panelId: { type: 'number', description: 'Alternative: panel ID' },
        updates: {
          type: 'object',
          description: 'Partial panel spec with fields to update',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            transparent: { type: 'boolean' },
            vizConfig: { type: 'object', description: 'Updated visualization config' },
            data: { type: 'object', description: 'Updated query group' },
          },
        },
      },
      required: ['updates'],
    },
  },

  {
    name: 'ADD_VARIABLE',
    status: 'implemented',
    description: 'Add a template variable to the dashboard using v2beta1 VariableKind format.',
    inputSchema: {
      type: 'object',
      properties: {
        variable: {
          type: 'object',
          description: 'Variable definition (VariableKind)',
          properties: {
            kind: {
              type: 'string',
              description: 'Variable type',
              enum: [
                'QueryVariable',
                'CustomVariable',
                'DatasourceVariable',
                'IntervalVariable',
                'TextVariable',
                'ConstantVariable',
              ],
            },
            spec: {
              type: 'object',
              description: 'Variable specification',
              properties: {
                name: { type: 'string', description: 'Variable name (used in queries as $name)' },
                label: { type: 'string', description: 'Display label' },
              },
              required: ['name'],
            },
          },
          required: ['kind', 'spec'],
        },
        position: { type: 'number', description: 'Position in variables list (optional, appends if not set)' },
      },
      required: ['variable'],
    },
  },

  {
    name: 'REMOVE_VARIABLE',
    status: 'implemented',
    description: 'Remove a template variable from the dashboard by name.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Variable name to remove' },
      },
      required: ['name'],
    },
  },

  {
    name: 'UPDATE_VARIABLE',
    status: 'implemented',
    description: 'Replace an existing template variable with a new definition, preserving its position.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Variable name to update' },
        variable: {
          type: 'object',
          description: 'New variable definition (VariableKind)',
          properties: {
            kind: { type: 'string' },
            spec: { type: 'object' },
          },
          required: ['kind', 'spec'],
        },
      },
      required: ['name', 'variable'],
    },
  },

  {
    name: 'LIST_VARIABLES',
    status: 'implemented',
    description: 'List all template variables in the current dashboard in v2beta1 VariableKind format.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'UPDATE_TIME_SETTINGS',
    status: 'implemented',
    description: 'Update dashboard time range and refresh settings.',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Start time (e.g., "now-6h", "now-1d")' },
        to: { type: 'string', description: 'End time (e.g., "now")' },
        timezone: { type: 'string', description: 'Timezone (e.g., "browser", "utc", "America/New_York")' },
        autoRefresh: { type: 'string', description: 'Auto-refresh interval (e.g., "5s", "1m", "" to disable)' },
      },
    },
  },

  {
    name: 'UPDATE_DASHBOARD_META',
    status: 'implemented',
    description: 'Update dashboard metadata (title, description, tags).',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Dashboard title' },
        description: { type: 'string', description: 'Dashboard description' },
        tags: { type: 'array', description: 'Dashboard tags', items: { type: 'string' } },
        editable: { type: 'boolean', description: 'Whether the dashboard is editable' },
      },
    },
  },
];

/**
 * Resource schemas for dashboard resources that can be accessed.
 */
export const DASHBOARD_RESOURCE_SCHEMAS: ResourceSchemaDefinition[] = [];

/**
 * Prompt schemas for common dashboard operations.
 */
export const DASHBOARD_PROMPT_SCHEMAS: PromptSchemaDefinition[] = [];

/**
 * Get a command schema by name (case-insensitive).
 */
export function getCommandSchemaByName(name: string): CommandSchemaDefinition | undefined {
  const normalized = name.toUpperCase();
  return DASHBOARD_COMMAND_SCHEMAS.find((cmd) => cmd.name === normalized);
}

/**
 * Get a resource schema by URI.
 */
export function getResourceSchemaByUri(uri: string): ResourceSchemaDefinition | undefined {
  return DASHBOARD_RESOURCE_SCHEMAS.find((resource) => {
    if (resource.uriTemplate) {
      const pattern = resource.uri.replace(/\{[^}]+\}/g, '[^/]+');
      return new RegExp(`^${pattern}$`).test(uri);
    }
    return resource.uri === uri;
  });
}
