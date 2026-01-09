/**
 * Dashboard MCP Tool Definitions
 *
 * Defines the MCP tools exposed by the Dashboard MCP Server.
 * These tools allow AI assistants to modify dashboards programmatically.
 */

import { MCPToolDefinition, MCPResourceDefinition, MCPPromptDefinition } from './types';

// ============================================================================
// Tool Definitions
// ============================================================================

export const DASHBOARD_MCP_TOOLS: MCPToolDefinition[] = [
  // Dashboard Info (read-only)
  {
    name: 'get_dashboard_info',
    description: `Get information about the currently loaded dashboard and available mutation tools.

Returns dashboard metadata including:
- uid: Dashboard unique identifier
- title: Dashboard title
- canEdit: Whether the current user has edit permissions
- isEditing: Whether the dashboard is currently in edit mode
- availableTools: List of available mutation tool names

Use this tool to check the current dashboard state before making mutations.`,
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    annotations: {
      title: 'Get Dashboard Info',
      readOnlyHint: true,
    },
  },

  // Panel Operations
  {
    name: 'add_panel',
    description:
      'Add a new panel to the dashboard. Creates both the panel definition in elements and a layout item. Automatically generates a unique element name and positions the panel.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Panel title displayed at the top of the panel',
        },
        vizType: {
          type: 'string',
          description: 'Visualization type (e.g., "timeseries", "stat", "gauge", "table", "text", "logs")',
          enum: ['timeseries', 'stat', 'gauge', 'table', 'text', 'logs', 'barchart', 'piechart', 'heatmap'],
        },
        description: {
          type: 'string',
          description: 'Optional panel description shown in panel info',
        },
        queries: {
          type: 'array',
          description: 'Data queries for the panel',
          items: {
            type: 'object',
            properties: {
              refId: { type: 'string', description: 'Query reference ID (e.g., "A", "B")' },
              datasource: {
                type: 'object',
                properties: {
                  uid: { type: 'string' },
                  type: { type: 'string' },
                },
              },
              expr: { type: 'string', description: 'PromQL expression (for Prometheus)' },
              query: { type: 'string', description: 'Query string (generic)' },
            },
            required: ['refId'],
          },
        },
        position: {
          type: 'object',
          description: 'Panel position in the layout',
          properties: {
            x: { type: 'number', description: 'X position (0-23 in 24-column grid)' },
            y: { type: 'number', description: 'Y position (row number)' },
            width: { type: 'number', description: 'Width in grid units (1-24)' },
            height: { type: 'number', description: 'Height in grid units' },
            targetRow: { type: 'string', description: 'Row name to place panel in (for RowsLayout)' },
            targetTab: { type: 'string', description: 'Tab name to place panel in (for TabsLayout)' },
          },
        },
        options: {
          type: 'object',
          description: 'Visualization-specific options',
        },
        fieldConfig: {
          type: 'object',
          description: 'Field configuration (units, thresholds, mappings)',
        },
      },
      required: ['title', 'vizType'],
    },
    annotations: {
      title: 'Add Panel',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  },

  {
    name: 'remove_panel',
    description:
      'Remove a panel from the dashboard. Deletes both the element definition and all layout items referencing it.',
    inputSchema: {
      type: 'object',
      properties: {
        elementName: {
          type: 'string',
          description: 'Element name in the elements map (e.g., "panel-cpu-usage")',
        },
        panelId: {
          type: 'number',
          description: 'Alternative: Panel ID (numeric)',
        },
      },
    },
    annotations: {
      title: 'Remove Panel',
      readOnlyHint: false,
      destructiveHint: true,
      confirmationHint: true,
    },
  },

  {
    name: 'update_panel',
    description: "Update an existing panel's properties, queries, or configuration.",
    inputSchema: {
      type: 'object',
      properties: {
        elementName: {
          type: 'string',
          description: 'Element name to update',
        },
        panelId: {
          type: 'number',
          description: 'Alternative: Panel ID',
        },
        updates: {
          type: 'object',
          description: 'Properties to update',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            vizType: { type: 'string' },
            queries: { type: 'array' },
            options: { type: 'object' },
            fieldConfig: { type: 'object' },
          },
        },
      },
      required: ['updates'],
    },
    annotations: {
      title: 'Update Panel',
      readOnlyHint: false,
      destructiveHint: false,
    },
  },

  {
    name: 'move_panel',
    description: 'Move a panel to a new position or container (row/tab).',
    inputSchema: {
      type: 'object',
      properties: {
        elementName: {
          type: 'string',
          description: 'Element name to move',
        },
        targetPosition: {
          type: 'object',
          description: 'Target position',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            width: { type: 'number' },
            height: { type: 'number' },
            targetRow: { type: 'string' },
            targetTab: { type: 'string' },
          },
        },
      },
      required: ['elementName', 'targetPosition'],
    },
    annotations: {
      title: 'Move Panel',
      readOnlyHint: false,
      destructiveHint: false,
    },
  },

  {
    name: 'duplicate_panel',
    description: 'Create a copy of an existing panel.',
    inputSchema: {
      type: 'object',
      properties: {
        elementName: {
          type: 'string',
          description: 'Element name to duplicate',
        },
        newTitle: {
          type: 'string',
          description: 'Title for the new panel (defaults to "Copy of {original}")',
        },
      },
      required: ['elementName'],
    },
    annotations: {
      title: 'Duplicate Panel',
      readOnlyHint: false,
      destructiveHint: false,
    },
  },

  // Variable Operations
  {
    name: 'add_variable',
    description: 'Add a template variable to the dashboard.',
    inputSchema: {
      type: 'object',
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
            description: { type: 'string' },
            hide: { type: 'string', enum: ['dontHide', 'hideLabel', 'hideVariable'] },
            multi: { type: 'boolean', description: 'Allow multiple selections' },
            includeAll: { type: 'boolean', description: 'Include "All" option' },
            query: { type: 'string', description: 'Query for QueryVariable' },
            regex: { type: 'string', description: 'Regex filter' },
            options: {
              type: 'array',
              description: 'Options for CustomVariable',
              items: {
                type: 'object',
                properties: {
                  text: { type: 'string' },
                  value: { type: 'string' },
                },
              },
            },
          },
          required: ['name'],
        },
      },
      required: ['kind', 'spec'],
    },
    annotations: {
      title: 'Add Variable',
      readOnlyHint: false,
      destructiveHint: false,
    },
  },

  {
    name: 'remove_variable',
    description:
      'Remove a template variable from the dashboard. Warning: This may break panels or other variables that reference it.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Variable name to remove',
        },
      },
      required: ['name'],
    },
    annotations: {
      title: 'Remove Variable',
      readOnlyHint: false,
      destructiveHint: true,
      confirmationHint: true,
    },
  },

  {
    name: 'update_variable',
    description: 'Update an existing template variable.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Variable name to update',
        },
        updates: {
          type: 'object',
          description: 'Properties to update',
          properties: {
            label: { type: 'string' },
            description: { type: 'string' },
            hide: { type: 'string' },
            multi: { type: 'boolean' },
            includeAll: { type: 'boolean' },
            query: { type: 'string' },
            regex: { type: 'string' },
          },
        },
      },
      required: ['name', 'updates'],
    },
    annotations: {
      title: 'Update Variable',
      readOnlyHint: false,
      destructiveHint: false,
    },
  },

  // Row Operations
  {
    name: 'add_row',
    description: 'Add a row container to organize panels. Requires RowsLayout.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Row title',
        },
        collapsed: {
          type: 'boolean',
          description: 'Whether the row is initially collapsed',
        },
        position: {
          type: 'number',
          description: 'Row index (0 = first)',
        },
      },
      required: ['title'],
    },
    annotations: {
      title: 'Add Row',
      readOnlyHint: false,
      destructiveHint: false,
    },
  },

  {
    name: 'remove_row',
    description: 'Remove a row from the dashboard.',
    inputSchema: {
      type: 'object',
      properties: {
        rowTitle: {
          type: 'string',
          description: 'Row title to remove',
        },
        rowIndex: {
          type: 'number',
          description: 'Alternative: Row index',
        },
        panelHandling: {
          type: 'string',
          description: 'What to do with panels in the row',
          enum: ['delete', 'moveToRoot'],
        },
      },
    },
    annotations: {
      title: 'Remove Row',
      readOnlyHint: false,
      destructiveHint: true,
      confirmationHint: true,
    },
  },

  // Dashboard Settings
  {
    name: 'update_time_settings',
    description: 'Update dashboard time range and refresh settings.',
    inputSchema: {
      type: 'object',
      properties: {
        from: {
          type: 'string',
          description: 'Start time (e.g., "now-6h", "now-1d")',
        },
        to: {
          type: 'string',
          description: 'End time (e.g., "now")',
        },
        timezone: {
          type: 'string',
          description: 'Timezone (e.g., "browser", "utc", "America/New_York")',
        },
        autoRefresh: {
          type: 'string',
          description: 'Auto-refresh interval (e.g., "5s", "1m", "5m", "" to disable)',
        },
        hideTimepicker: {
          type: 'boolean',
          description: 'Hide the time picker',
        },
      },
    },
    annotations: {
      title: 'Update Time Settings',
      readOnlyHint: false,
      destructiveHint: false,
    },
  },

  {
    name: 'update_dashboard_meta',
    description: 'Update dashboard metadata (title, description, tags).',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Dashboard title',
        },
        description: {
          type: 'string',
          description: 'Dashboard description',
        },
        tags: {
          type: 'array',
          description: 'Dashboard tags',
          items: { type: 'string' },
        },
        editable: {
          type: 'boolean',
          description: 'Whether the dashboard is editable',
        },
      },
    },
    annotations: {
      title: 'Update Dashboard Metadata',
      readOnlyHint: false,
      destructiveHint: false,
    },
  },

  // Batch Operations
  {
    name: 'batch_mutations',
    description: 'Apply multiple mutations atomically. All succeed or all fail with rollback.',
    inputSchema: {
      type: 'object',
      properties: {
        mutations: {
          type: 'array',
          description: 'Array of mutations to apply',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                description: 'Mutation type',
                enum: [
                  'ADD_PANEL',
                  'REMOVE_PANEL',
                  'UPDATE_PANEL',
                  'MOVE_PANEL',
                  'ADD_VARIABLE',
                  'REMOVE_VARIABLE',
                  'ADD_ROW',
                  'UPDATE_TIME_SETTINGS',
                ],
              },
              payload: {
                type: 'object',
                description: 'Mutation payload',
              },
            },
            required: ['type', 'payload'],
          },
        },
      },
      required: ['mutations'],
    },
    annotations: {
      title: 'Batch Mutations',
      readOnlyHint: false,
      destructiveHint: false,
    },
  },

  // Read Operations (for context)
  {
    name: 'get_panel_info',
    description: 'Get information about a specific panel.',
    inputSchema: {
      type: 'object',
      properties: {
        elementName: { type: 'string' },
        panelId: { type: 'number' },
      },
    },
    annotations: {
      title: 'Get Panel Info',
      readOnlyHint: true,
      destructiveHint: false,
    },
  },

  {
    name: 'list_panels',
    description: 'List all panels in the current dashboard with their element names and titles.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: {
      title: 'List Panels',
      readOnlyHint: true,
      destructiveHint: false,
    },
  },

  {
    name: 'list_variables',
    description: 'List all template variables in the current dashboard.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: {
      title: 'List Variables',
      readOnlyHint: true,
      destructiveHint: false,
    },
  },

  // ============================================================================
  // Tab Operations
  // ============================================================================

  {
    name: 'add_tab',
    description: 'Add a tab container to the dashboard. Requires TabsLayout.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Tab title',
        },
        position: {
          type: 'number',
          description: 'Tab index (0 = first)',
        },
      },
      required: ['title'],
    },
    annotations: {
      title: 'Add Tab',
      readOnlyHint: false,
      destructiveHint: false,
    },
  },

  {
    name: 'remove_tab',
    description: 'Remove a tab from the dashboard.',
    inputSchema: {
      type: 'object',
      properties: {
        tabTitle: {
          type: 'string',
          description: 'Tab title to remove',
        },
        tabIndex: {
          type: 'number',
          description: 'Alternative: Tab index',
        },
        panelHandling: {
          type: 'string',
          description: 'What to do with panels in the tab',
          enum: ['delete', 'moveToRoot'],
        },
      },
    },
    annotations: {
      title: 'Remove Tab',
      readOnlyHint: false,
      destructiveHint: true,
      confirmationHint: true,
    },
  },

  // ============================================================================
  // Library Panel Operations
  // ============================================================================

  {
    name: 'add_library_panel',
    description: 'Add a library panel to the dashboard by its UID or name.',
    inputSchema: {
      type: 'object',
      properties: {
        libraryPanelUid: {
          type: 'string',
          description: 'Library panel UID',
        },
        libraryPanelName: {
          type: 'string',
          description: 'Alternative: Library panel name',
        },
        position: {
          type: 'object',
          description: 'Position in layout',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            width: { type: 'number' },
            height: { type: 'number' },
            targetRow: { type: 'string' },
            targetTab: { type: 'string' },
          },
        },
      },
    },
    annotations: {
      title: 'Add Library Panel',
      readOnlyHint: false,
      destructiveHint: false,
    },
  },

  {
    name: 'unlink_library_panel',
    description: 'Convert a library panel to a regular panel (unlink from library).',
    inputSchema: {
      type: 'object',
      properties: {
        elementName: {
          type: 'string',
          description: 'Element name of the library panel to unlink',
        },
      },
      required: ['elementName'],
    },
    annotations: {
      title: 'Unlink Library Panel',
      readOnlyHint: false,
      destructiveHint: false,
    },
  },

  {
    name: 'save_as_library_panel',
    description: 'Save an existing panel as a library panel.',
    inputSchema: {
      type: 'object',
      properties: {
        elementName: {
          type: 'string',
          description: 'Element name of the panel to save',
        },
        libraryPanelName: {
          type: 'string',
          description: 'Name for the new library panel',
        },
        folderUid: {
          type: 'string',
          description: 'Folder UID to save the library panel in',
        },
      },
      required: ['elementName', 'libraryPanelName'],
    },
    annotations: {
      title: 'Save as Library Panel',
      readOnlyHint: false,
      destructiveHint: false,
    },
  },

  // ============================================================================
  // Repeat Configuration
  // ============================================================================

  {
    name: 'configure_panel_repeat',
    description: 'Configure a panel to repeat based on a variable.',
    inputSchema: {
      type: 'object',
      properties: {
        elementName: {
          type: 'string',
          description: 'Element name of the panel',
        },
        variableName: {
          type: 'string',
          description: 'Variable to repeat by (or null to disable repeat)',
        },
        direction: {
          type: 'string',
          description: 'Repeat direction',
          enum: ['h', 'v'],
        },
        maxPerRow: {
          type: 'number',
          description: 'Maximum panels per row (for horizontal repeat)',
        },
      },
      required: ['elementName'],
    },
    annotations: {
      title: 'Configure Panel Repeat',
      readOnlyHint: false,
      destructiveHint: false,
    },
  },

  {
    name: 'configure_row_repeat',
    description: 'Configure a row to repeat based on a variable.',
    inputSchema: {
      type: 'object',
      properties: {
        rowTitle: {
          type: 'string',
          description: 'Row title',
        },
        rowIndex: {
          type: 'number',
          description: 'Alternative: Row index',
        },
        variableName: {
          type: 'string',
          description: 'Variable to repeat by (or null to disable repeat)',
        },
      },
      required: ['variableName'],
    },
    annotations: {
      title: 'Configure Row Repeat',
      readOnlyHint: false,
      destructiveHint: false,
    },
  },

  // ============================================================================
  // Conditional Rendering (Show/Hide)
  // ============================================================================

  {
    name: 'set_conditional_rendering',
    description: 'Configure conditional rendering (show/hide) for a panel, row, or tab.',
    inputSchema: {
      type: 'object',
      properties: {
        elementName: {
          type: 'string',
          description: 'Element name (panel, row, or tab)',
        },
        visibility: {
          type: 'string',
          description: 'Show or hide when conditions match',
          enum: ['show', 'hide'],
        },
        condition: {
          type: 'string',
          description: 'How to combine multiple conditions',
          enum: ['and', 'or'],
        },
        rules: {
          type: 'array',
          description: 'Conditional rules',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['variable', 'data', 'timeRangeSize'],
              },
              variable: { type: 'string' },
              operator: {
                type: 'string',
                enum: ['equals', 'notEquals', 'matches', 'notMatches'],
              },
              value: { type: 'string' },
            },
          },
        },
      },
      required: ['elementName', 'visibility'],
    },
    annotations: {
      title: 'Set Conditional Rendering',
      readOnlyHint: false,
      destructiveHint: false,
    },
  },

  // ============================================================================
  // Layout Type
  // ============================================================================

  {
    name: 'change_layout_type',
    description: 'Switch the dashboard layout type (e.g., from GridLayout to RowsLayout or AutoGridLayout).',
    inputSchema: {
      type: 'object',
      properties: {
        layoutType: {
          type: 'string',
          description: 'Target layout type',
          enum: ['GridLayout', 'RowsLayout', 'AutoGridLayout', 'TabsLayout'],
        },
        options: {
          type: 'object',
          description: 'Layout-specific options',
          properties: {
            // AutoGridLayout options
            maxColumnCount: { type: 'number' },
            columnWidthMode: { type: 'string', enum: ['narrow', 'standard', 'wide', 'custom'] },
            rowHeightMode: { type: 'string', enum: ['short', 'standard', 'tall', 'custom'] },
          },
        },
      },
      required: ['layoutType'],
    },
    annotations: {
      title: 'Change Layout Type',
      readOnlyHint: false,
      destructiveHint: false,
      confirmationHint: true,
    },
  },

  // ============================================================================
  // Annotations
  // ============================================================================

  {
    name: 'add_annotation',
    description: 'Add an annotation query to the dashboard.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Annotation name',
        },
        datasource: {
          type: 'object',
          properties: {
            uid: { type: 'string' },
            type: { type: 'string' },
          },
        },
        query: {
          type: 'object',
          description: 'Datasource-specific query',
        },
        iconColor: {
          type: 'string',
          description: 'Annotation icon color',
        },
        enable: {
          type: 'boolean',
          description: 'Whether the annotation is enabled',
        },
        hide: {
          type: 'boolean',
          description: 'Whether to hide the annotation',
        },
        filter: {
          type: 'object',
          description: 'Panel filter',
          properties: {
            exclude: { type: 'boolean' },
            ids: { type: 'array', items: { type: 'number' } },
          },
        },
      },
      required: ['name', 'datasource'],
    },
    annotations: {
      title: 'Add Annotation',
      readOnlyHint: false,
      destructiveHint: false,
    },
  },

  {
    name: 'update_annotation',
    description: 'Update an existing annotation query.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Annotation name to update',
        },
        updates: {
          type: 'object',
          description: 'Properties to update',
          properties: {
            name: { type: 'string' },
            iconColor: { type: 'string' },
            enable: { type: 'boolean' },
            hide: { type: 'boolean' },
            query: { type: 'object' },
          },
        },
      },
      required: ['name', 'updates'],
    },
    annotations: {
      title: 'Update Annotation',
      readOnlyHint: false,
      destructiveHint: false,
    },
  },

  {
    name: 'remove_annotation',
    description: 'Remove an annotation query from the dashboard.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Annotation name to remove',
        },
      },
      required: ['name'],
    },
    annotations: {
      title: 'Remove Annotation',
      readOnlyHint: false,
      destructiveHint: true,
    },
  },

  // ============================================================================
  // Dashboard Links
  // ============================================================================

  {
    name: 'add_dashboard_link',
    description: 'Add a link to the dashboard (to another dashboard or external URL).',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Link title',
        },
        type: {
          type: 'string',
          description: 'Link type',
          enum: ['link', 'dashboards'],
        },
        url: {
          type: 'string',
          description: 'URL (for type "link")',
        },
        tags: {
          type: 'array',
          description: 'Dashboard tags filter (for type "dashboards")',
          items: { type: 'string' },
        },
        targetBlank: {
          type: 'boolean',
          description: 'Open in new tab',
        },
        includeVars: {
          type: 'boolean',
          description: 'Include template variables in URL',
        },
        keepTime: {
          type: 'boolean',
          description: 'Include time range in URL',
        },
        asDropdown: {
          type: 'boolean',
          description: 'Show as dropdown (for type "dashboards")',
        },
      },
      required: ['title', 'type'],
    },
    annotations: {
      title: 'Add Dashboard Link',
      readOnlyHint: false,
      destructiveHint: false,
    },
  },

  {
    name: 'remove_dashboard_link',
    description: 'Remove a dashboard link.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Link title to remove',
        },
        index: {
          type: 'number',
          description: 'Alternative: Link index',
        },
      },
    },
    annotations: {
      title: 'Remove Dashboard Link',
      readOnlyHint: false,
      destructiveHint: true,
    },
  },

  // ============================================================================
  // Panel Links and Data Links
  // ============================================================================

  {
    name: 'add_panel_link',
    description: 'Add a link to a panel.',
    inputSchema: {
      type: 'object',
      properties: {
        elementName: {
          type: 'string',
          description: 'Panel element name',
        },
        title: {
          type: 'string',
          description: 'Link title',
        },
        url: {
          type: 'string',
          description: 'Link URL (can include variables like ${__data.fields.name})',
        },
        targetBlank: {
          type: 'boolean',
          description: 'Open in new tab',
        },
      },
      required: ['elementName', 'title', 'url'],
    },
    annotations: {
      title: 'Add Panel Link',
      readOnlyHint: false,
      destructiveHint: false,
    },
  },

  {
    name: 'add_data_link',
    description: 'Add a data link to a panel (links that appear when clicking on data points).',
    inputSchema: {
      type: 'object',
      properties: {
        elementName: {
          type: 'string',
          description: 'Panel element name',
        },
        title: {
          type: 'string',
          description: 'Link title',
        },
        url: {
          type: 'string',
          description: 'Link URL (can include field variables)',
        },
        targetBlank: {
          type: 'boolean',
          description: 'Open in new tab',
        },
      },
      required: ['elementName', 'title', 'url'],
    },
    annotations: {
      title: 'Add Data Link',
      readOnlyHint: false,
      destructiveHint: false,
    },
  },

  // ============================================================================
  // Field Configuration (Transformations, Overrides)
  // ============================================================================

  {
    name: 'add_field_override',
    description: 'Add a field override to a panel (customize display for specific fields).',
    inputSchema: {
      type: 'object',
      properties: {
        elementName: {
          type: 'string',
          description: 'Panel element name',
        },
        matcher: {
          type: 'object',
          description: 'Field matcher',
          properties: {
            id: {
              type: 'string',
              enum: ['byName', 'byRegexp', 'byType', 'byFrameRefID'],
            },
            options: { type: 'string' },
          },
        },
        properties: {
          type: 'array',
          description: 'Properties to override',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Property ID (e.g., "displayName", "unit", "color")' },
              value: { description: 'Property value' },
            },
          },
        },
      },
      required: ['elementName', 'matcher', 'properties'],
    },
    annotations: {
      title: 'Add Field Override',
      readOnlyHint: false,
      destructiveHint: false,
    },
  },

  {
    name: 'add_value_mapping',
    description: 'Add a value mapping to a panel (map values to text/colors).',
    inputSchema: {
      type: 'object',
      properties: {
        elementName: {
          type: 'string',
          description: 'Panel element name',
        },
        mappingType: {
          type: 'string',
          description: 'Mapping type',
          enum: ['value', 'range', 'regex', 'special'],
        },
        options: {
          type: 'object',
          description: 'Mapping options (depends on type)',
        },
      },
      required: ['elementName', 'mappingType', 'options'],
    },
    annotations: {
      title: 'Add Value Mapping',
      readOnlyHint: false,
      destructiveHint: false,
    },
  },

  {
    name: 'add_transformation',
    description: 'Add a data transformation to a panel.',
    inputSchema: {
      type: 'object',
      properties: {
        elementName: {
          type: 'string',
          description: 'Panel element name',
        },
        transformationId: {
          type: 'string',
          description: 'Transformation ID (e.g., "reduce", "merge", "filterFieldsByName")',
        },
        options: {
          type: 'object',
          description: 'Transformation options',
        },
      },
      required: ['elementName', 'transformationId'],
    },
    annotations: {
      title: 'Add Transformation',
      readOnlyHint: false,
      destructiveHint: false,
    },
  },

  // ============================================================================
  // Dashboard Management (requires backend)
  // ============================================================================

  {
    name: 'move_to_folder',
    description: 'Move the dashboard to a different folder.',
    inputSchema: {
      type: 'object',
      properties: {
        folderUid: {
          type: 'string',
          description: 'Target folder UID',
        },
        folderTitle: {
          type: 'string',
          description: 'Alternative: Target folder title',
        },
      },
    },
    annotations: {
      title: 'Move to Folder',
      readOnlyHint: false,
      destructiveHint: false,
      confirmationHint: true,
    },
  },

  {
    name: 'toggle_favorite',
    description: 'Mark or unmark the dashboard as a favorite.',
    inputSchema: {
      type: 'object',
      properties: {
        favorite: {
          type: 'boolean',
          description: 'True to mark as favorite, false to unmark',
        },
      },
      required: ['favorite'],
    },
    annotations: {
      title: 'Toggle Favorite',
      readOnlyHint: false,
      destructiveHint: false,
    },
  },

  // ============================================================================
  // Version Management (requires backend)
  // ============================================================================

  {
    name: 'list_versions',
    description: 'List dashboard version history.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of versions to return',
        },
      },
    },
    annotations: {
      title: 'List Versions',
      readOnlyHint: true,
      destructiveHint: false,
    },
  },

  {
    name: 'compare_versions',
    description: 'Compare two dashboard versions.',
    inputSchema: {
      type: 'object',
      properties: {
        baseVersion: {
          type: 'number',
          description: 'Base version number',
        },
        newVersion: {
          type: 'number',
          description: 'New version number',
        },
      },
      required: ['baseVersion', 'newVersion'],
    },
    annotations: {
      title: 'Compare Versions',
      readOnlyHint: true,
      destructiveHint: false,
    },
  },

  {
    name: 'restore_version',
    description: 'Restore the dashboard to a previous version.',
    inputSchema: {
      type: 'object',
      properties: {
        version: {
          type: 'number',
          description: 'Version number to restore',
        },
      },
      required: ['version'],
    },
    annotations: {
      title: 'Restore Version',
      readOnlyHint: false,
      destructiveHint: true,
      confirmationHint: true,
    },
  },
];

// ============================================================================
// Resource Definitions
// ============================================================================

export const DASHBOARD_MCP_RESOURCES: MCPResourceDefinition[] = [
  {
    uri: 'dashboard://current',
    name: 'Current Dashboard',
    description: 'The currently active dashboard in the browser',
    mimeType: 'application/json',
  },
  {
    uri: 'dashboard://{uid}',
    uriTemplate: true,
    name: 'Dashboard by UID',
    description: 'Fetch a specific dashboard by its UID',
    mimeType: 'application/json',
  },
  {
    uri: 'dashboard://{uid}/panels',
    uriTemplate: true,
    name: 'Dashboard Panels',
    description: 'List of panels in a dashboard with element names, titles, and basic info',
    mimeType: 'application/json',
  },
  {
    uri: 'dashboard://{uid}/variables',
    uriTemplate: true,
    name: 'Dashboard Variables',
    description: 'Template variables configured in the dashboard',
    mimeType: 'application/json',
  },
  {
    uri: 'dashboard://{uid}/layout',
    uriTemplate: true,
    name: 'Dashboard Layout',
    description: 'Layout structure (rows, tabs, panel positions)',
    mimeType: 'application/json',
  },
  {
    uri: 'schema://v2beta1/dashboard',
    name: 'Dashboard V2 Schema',
    description: 'JSON Schema for v2beta1 dashboard spec',
    mimeType: 'application/json',
  },
  {
    uri: 'schema://v2beta1/panel',
    name: 'Panel Schema',
    description: 'JSON Schema for panel definitions',
    mimeType: 'application/json',
  },
];

// ============================================================================
// Prompt Definitions
// ============================================================================

export const DASHBOARD_MCP_PROMPTS: MCPPromptDefinition[] = [
  {
    name: 'add_monitoring_panel',
    description: 'Add a panel to monitor a specific metric with recommended visualization defaults',
    arguments: [
      { name: 'metric', description: 'The metric to monitor (e.g., cpu_usage, memory_percent)', required: true },
      { name: 'datasource', description: 'Datasource UID to query', required: true },
    ],
  },
  {
    name: 'create_sre_dashboard',
    description: 'Create a standard SRE dashboard with RED metrics (Rate, Errors, Duration)',
    arguments: [
      { name: 'service', description: 'Service name to monitor', required: true },
      { name: 'datasource', description: 'Prometheus datasource UID', required: true },
    ],
  },
  {
    name: 'add_alert_annotations',
    description: 'Add annotation queries for alerts related to this dashboard',
    arguments: [{ name: 'alertmanager', description: 'Alertmanager datasource UID', required: true }],
  },
  {
    name: 'organize_panels_into_rows',
    description: 'Reorganize existing panels into logical row groupings',
    arguments: [
      { name: 'grouping', description: 'How to group panels (e.g., "by-datasource", "by-type")', required: true },
    ],
  },
];

// ============================================================================
// Helper to get tool by name
// ============================================================================

export function getToolDefinition(name: string): MCPToolDefinition | undefined {
  return DASHBOARD_MCP_TOOLS.find((tool) => tool.name === name);
}

export function getResourceDefinition(uri: string): MCPResourceDefinition | undefined {
  return DASHBOARD_MCP_RESOURCES.find((resource) => {
    if (resource.uriTemplate) {
      // Simple template matching
      const pattern = resource.uri.replace(/\{[^}]+\}/g, '[^/]+');
      return new RegExp(`^${pattern}$`).test(uri);
    }
    return resource.uri === uri;
  });
}
