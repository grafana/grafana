import { Panel, RowPanel } from '@grafana/schema';
import { Spec as DashboardV2Spec, RowsLayoutKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { ResponseTransformers } from './ResponseTransformers';
import { DashboardWithAccessInfo } from './types';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    datasources: {
      PromTest: {
        uid: 'xyz-abc',
        name: 'PromTest',
        id: 'prometheus',
        meta: {
          id: 'prometheus',
          name: 'PromTest',
          type: 'datasource',
        },
        isDefault: true,
        apiVersion: 'v2',
        type: 'prometheus',
      },
    },
    defaultDatasource: 'PromTest',
  },
}));

describe('ResponseTransformers Layout Conversion', () => {
  // Helper function to create a v2 dashboard from elements and layout
  function createV2Dashboard(
    elements: DashboardV2Spec['elements'],
    layout: DashboardV2Spec['layout']
  ): DashboardWithAccessInfo<DashboardV2Spec> {
    return {
      apiVersion: 'v2beta1',
      kind: 'DashboardWithAccessInfo',
      metadata: {
        name: 'test-dashboard',
        resourceVersion: '1',
        creationTimestamp: '2023-01-01T00:00:00Z',
        annotations: {},
        labels: {},
      },
      spec: {
        title: 'Test Dashboard',
        description: '',
        tags: [],
        cursorSync: 'Off',
        preload: false,
        liveNow: false,
        editable: true,
        timeSettings: {
          from: 'now-6h',
          to: 'now',
          timezone: 'browser',
          autoRefresh: '',
          autoRefreshIntervals: [],
          hideTimepicker: false,
          fiscalYearStartMonth: 0,
          weekStart: 'monday',
        },
        links: [],
        annotations: [],
        variables: [],
        elements,
        layout,
      },
      access: {
        url: '/d/test',
        canAdmin: true,
        canDelete: true,
        canEdit: true,
        canSave: true,
        canShare: true,
        canStar: true,
        annotationsPermissions: {
          dashboard: { canAdd: true, canEdit: true, canDelete: true },
          organization: { canAdd: true, canEdit: true, canDelete: true },
        },
      },
    };
  }

  describe('v2 -> v1: Nested layouts flattening', () => {
    it('should flatten nested RowsLayout to flat v1 panels', () => {
      // Create a v2 dashboard with nested rows
      const elements: DashboardV2Spec['elements'] = {
        'panel-1': {
          kind: 'Panel',
          spec: {
            id: 1,
            title: 'Panel 1',
            description: '',
            vizConfig: {
              kind: 'VizConfig',
              group: 'timeseries',
              version: '',
              spec: {
                fieldConfig: { defaults: {}, overrides: [] },
                options: {},
              },
            },
            data: {
              kind: 'QueryGroup',
              spec: {
                queries: [],
                transformations: [],
                queryOptions: {},
              },
            },
            links: [],
          },
        },
        'panel-2': {
          kind: 'Panel',
          spec: {
            id: 2,
            title: 'Panel 2',
            description: '',
            vizConfig: {
              kind: 'VizConfig',
              group: 'timeseries',
              version: '',
              spec: {
                fieldConfig: { defaults: {}, overrides: [] },
                options: {},
              },
            },
            data: {
              kind: 'QueryGroup',
              spec: {
                queries: [],
                transformations: [],
                queryOptions: {},
              },
            },
            links: [],
          },
        },
        'panel-3': {
          kind: 'Panel',
          spec: {
            id: 3,
            title: 'Panel 3',
            description: '',
            vizConfig: {
              kind: 'VizConfig',
              group: 'timeseries',
              version: '',
              spec: {
                fieldConfig: { defaults: {}, overrides: [] },
                options: {},
              },
            },
            data: {
              kind: 'QueryGroup',
              spec: {
                queries: [],
                transformations: [],
                queryOptions: {},
              },
            },
            links: [],
          },
        },
      };

      const layout: DashboardV2Spec['layout'] = {
        kind: 'RowsLayout',
        spec: {
          rows: [
            {
              kind: 'RowsLayoutRow',
              spec: {
                title: 'Outer Row',
                collapse: false,
                layout: {
                  kind: 'RowsLayout',
                  spec: {
                    rows: [
                      {
                        kind: 'RowsLayoutRow',
                        spec: {
                          title: 'Inner Row',
                          collapse: false,
                          layout: {
                            kind: 'GridLayout',
                            spec: {
                              items: [
                                {
                                  kind: 'GridLayoutItem',
                                  spec: {
                                    x: 0,
                                    y: 0,
                                    width: 12,
                                    height: 8,
                                    element: {
                                      kind: 'ElementReference',
                                      name: 'panel-1',
                                    },
                                  },
                                },
                              ],
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
            {
              kind: 'RowsLayoutRow',
              spec: {
                title: 'Second Row',
                collapse: false,
                layout: {
                  kind: 'GridLayout',
                  spec: {
                    items: [
                      {
                        kind: 'GridLayoutItem',
                        spec: {
                          x: 0,
                          y: 0,
                          width: 12,
                          height: 8,
                          element: {
                            kind: 'ElementReference',
                            name: 'panel-2',
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      };

      const v2Dashboard = createV2Dashboard(elements, layout);

      const v1Result = ResponseTransformers.ensureV1Response(v2Dashboard);

      // Should have flattened structure: outer row, inner row, second row, and panels
      expect(v1Result.dashboard.panels).toBeDefined();
      const panels = v1Result.dashboard.panels || [];

      // Should have row panels for "Outer Row", "Inner Row", and "Second Row"
      const rowPanels = panels.filter((p) => p.type === 'row') as RowPanel[];
      expect(rowPanels.length).toBeGreaterThanOrEqual(2);

      // Find the inner row panel (expanded row)
      const innerRow = rowPanels.find((r) => r.title === 'Inner Row');
      expect(innerRow).toBeDefined();
      expect(innerRow?.collapsed).toBe(false);
      // For expanded rows, panels should be at top level, not in row.panels array
      expect(innerRow?.panels?.length).toBe(0);

      // Find the second row panel (expanded row)
      const secondRow = rowPanels.find((r) => r.title === 'Second Row');
      expect(secondRow).toBeDefined();
      expect(secondRow?.collapsed).toBe(false);
      // For expanded rows, panels should be at top level, not in row.panels array
      expect(secondRow?.panels?.length).toBe(0);

      // Panels should be at the top level for expanded rows
      const panelsOutsideRows = panels.filter((p) => p.type !== 'row');
      expect(panelsOutsideRows.length).toBe(2);
      expect(panelsOutsideRows.find((p) => p.id === 1)).toBeDefined();
      expect(panelsOutsideRows.find((p) => p.id === 2)).toBeDefined();
    });

    it('should convert TabsLayout to RowPanels in v1', () => {
      const elements: DashboardV2Spec['elements'] = {
        'panel-1': {
          kind: 'Panel',
          spec: {
            id: 1,
            title: 'Panel 1',
            description: '',
            vizConfig: {
              kind: 'VizConfig',
              group: 'timeseries',
              version: '',
              spec: {
                fieldConfig: { defaults: {}, overrides: [] },
                options: {},
              },
            },
            data: {
              kind: 'QueryGroup',
              spec: {
                queries: [],
                transformations: [],
                queryOptions: {},
              },
            },
            links: [],
          },
        },
      };

      const layout: DashboardV2Spec['layout'] = {
        kind: 'TabsLayout',
        spec: {
          tabs: [
            {
              kind: 'TabsLayoutTab',
              spec: {
                title: 'Tab 1',
                layout: {
                  kind: 'GridLayout',
                  spec: {
                    items: [
                      {
                        kind: 'GridLayoutItem',
                        spec: {
                          x: 0,
                          y: 0,
                          width: 12,
                          height: 8,
                          element: {
                            kind: 'ElementReference',
                            name: 'panel-1',
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      };

      const v2Dashboard = createV2Dashboard(elements, layout);

      const v1Result = ResponseTransformers.ensureV1Response(v2Dashboard);

      expect(v1Result.dashboard.panels).toBeDefined();
      const panels = v1Result.dashboard.panels || [];
      const rowPanels = panels.filter((p) => p.type === 'row') as RowPanel[];

      // Tab should be converted to an expanded row panel
      expect(rowPanels.length).toBe(1);
      const tabRow = rowPanels[0];
      expect(tabRow.title).toBe('Tab 1');
      expect(tabRow.collapsed).toBe(false);
      // Tab rows are expanded, so panels array should be empty
      expect(tabRow.panels?.length).toBe(0);

      // Verify the row panel is in the dashboard panels array
      expect(panels).toContain(tabRow);

      // Verify gridPos ordering: row should have a gridPos
      expect(tabRow.gridPos).toBeDefined();
      const rowY = tabRow.gridPos?.y ?? 0;
      expect(tabRow.gridPos?.x).toBe(0);
      expect(tabRow.gridPos?.w).toBe(24);
      expect(tabRow.gridPos?.h).toBe(1);

      // Verify the panel is at the top level (not in row.panels)
      const allPanels = panels.filter((p) => p.type !== 'row') as Panel[];
      const panelFromTab = allPanels.find((p) => p.id === 1);
      expect(panelFromTab).toBeDefined();
      expect(panelFromTab?.gridPos).toBeDefined();
      // Panel Y position should be absolute: rowY + rowHeaderHeight (1) + relativeY (0) = rowY + 1
      expect(panelFromTab?.gridPos?.y).toBe(rowY + 1);
      expect(panelFromTab?.gridPos?.x).toBe(0);
      expect(panelFromTab?.gridPos?.w).toBe(12);
      expect(panelFromTab?.gridPos?.h).toBe(8);
    });

    it('should convert AutoGridLayout with default panel sizes', () => {
      const elements: DashboardV2Spec['elements'] = {
        'panel-1': {
          kind: 'Panel',
          spec: {
            id: 1,
            title: 'Panel 1',
            description: '',
            vizConfig: {
              kind: 'VizConfig',
              group: 'timeseries',
              version: '',
              spec: {
                fieldConfig: { defaults: {}, overrides: [] },
                options: {},
              },
            },
            data: {
              kind: 'QueryGroup',
              spec: {
                queries: [],
                transformations: [],
                queryOptions: {},
              },
            },
            links: [],
          },
        },
        'panel-2': {
          kind: 'Panel',
          spec: {
            id: 2,
            title: 'Panel 2',
            description: '',
            vizConfig: {
              kind: 'VizConfig',
              group: 'timeseries',
              version: '',
              spec: {
                fieldConfig: { defaults: {}, overrides: [] },
                options: {},
              },
            },
            data: {
              kind: 'QueryGroup',
              spec: {
                queries: [],
                transformations: [],
                queryOptions: {},
              },
            },
            links: [],
          },
        },
      };

      const layout: DashboardV2Spec['layout'] = {
        kind: 'AutoGridLayout',
        spec: {
          maxColumnCount: 3,
          columnWidthMode: 'standard',
          rowHeightMode: 'standard',
          items: [
            {
              kind: 'AutoGridLayoutItem',
              spec: {
                element: {
                  kind: 'ElementReference',
                  name: 'panel-1',
                },
              },
            },
            {
              kind: 'AutoGridLayoutItem',
              spec: {
                element: {
                  kind: 'ElementReference',
                  name: 'panel-2',
                },
              },
            },
          ],
        },
      };

      const v2Dashboard = createV2Dashboard(elements, layout);

      const v1Result = ResponseTransformers.ensureV1Response(v2Dashboard);

      expect(v1Result.dashboard.panels).toBeDefined();
      const panels = v1Result.dashboard.panels || [];
      const regularPanels = panels.filter((p) => p.type !== 'row') as Panel[];

      // Should have 2 panels with default sizes
      expect(regularPanels.length).toBe(2);
      expect(regularPanels[0].id).toBe(1);
      expect(regularPanels[1].id).toBe(2);

      // Check default sizes: width should be 24/3 = 8, height should be 9 for 'standard' rowHeight (320px)
      expect(regularPanels[0].gridPos?.w).toBe(8);
      expect(regularPanels[0].gridPos?.h).toBe(9);
      expect(regularPanels[1].gridPos?.w).toBe(8);
      expect(regularPanels[1].gridPos?.h).toBe(9);
    });

    it('should convert AutoGridLayout with short rowHeight', () => {
      const elements: DashboardV2Spec['elements'] = {
        'panel-1': {
          kind: 'Panel',
          spec: {
            id: 1,
            title: 'Panel 1',
            description: '',
            vizConfig: {
              kind: 'VizConfig',
              group: 'timeseries',
              version: '',
              spec: {
                fieldConfig: { defaults: {}, overrides: [] },
                options: {},
              },
            },
            data: {
              kind: 'QueryGroup',
              spec: {
                queries: [],
                transformations: [],
                queryOptions: {},
              },
            },
            links: [],
          },
        },
      };

      const layout: DashboardV2Spec['layout'] = {
        kind: 'AutoGridLayout',
        spec: {
          maxColumnCount: 3,
          columnWidthMode: 'standard',
          rowHeightMode: 'short',
          items: [
            {
              kind: 'AutoGridLayoutItem',
              spec: {
                element: {
                  kind: 'ElementReference',
                  name: 'panel-1',
                },
              },
            },
          ],
        },
      };

      const v2Dashboard = createV2Dashboard(elements, layout);
      const v1Result = ResponseTransformers.ensureV1Response(v2Dashboard);

      const panels = v1Result.dashboard.panels || [];
      const regularPanels = panels.filter((p) => p.type !== 'row') as Panel[];

      expect(regularPanels.length).toBe(1);
      // Short rowHeight (168px) should convert to ~5 grid units
      expect(regularPanels[0].gridPos?.h).toBe(5);
    });

    it('should convert AutoGridLayout with tall rowHeight', () => {
      const elements: DashboardV2Spec['elements'] = {
        'panel-1': {
          kind: 'Panel',
          spec: {
            id: 1,
            title: 'Panel 1',
            description: '',
            vizConfig: {
              kind: 'VizConfig',
              group: 'timeseries',
              version: '',
              spec: {
                fieldConfig: { defaults: {}, overrides: [] },
                options: {},
              },
            },
            data: {
              kind: 'QueryGroup',
              spec: {
                queries: [],
                transformations: [],
                queryOptions: {},
              },
            },
            links: [],
          },
        },
      };

      const layout: DashboardV2Spec['layout'] = {
        kind: 'AutoGridLayout',
        spec: {
          maxColumnCount: 3,
          columnWidthMode: 'standard',
          rowHeightMode: 'tall',
          items: [
            {
              kind: 'AutoGridLayoutItem',
              spec: {
                element: {
                  kind: 'ElementReference',
                  name: 'panel-1',
                },
              },
            },
          ],
        },
      };

      const v2Dashboard = createV2Dashboard(elements, layout);
      const v1Result = ResponseTransformers.ensureV1Response(v2Dashboard);

      const panels = v1Result.dashboard.panels || [];
      const regularPanels = panels.filter((p) => p.type !== 'row') as Panel[];

      expect(regularPanels.length).toBe(1);
      // Tall rowHeight (512px) should convert to ~14 grid units
      expect(regularPanels[0].gridPos?.h).toBe(14);
    });

    it('should convert AutoGridLayout with custom rowHeight', () => {
      const elements: DashboardV2Spec['elements'] = {
        'panel-1': {
          kind: 'Panel',
          spec: {
            id: 1,
            title: 'Panel 1',
            description: '',
            vizConfig: {
              kind: 'VizConfig',
              group: 'timeseries',
              version: '',
              spec: {
                fieldConfig: { defaults: {}, overrides: [] },
                options: {},
              },
            },
            data: {
              kind: 'QueryGroup',
              spec: {
                queries: [],
                transformations: [],
                queryOptions: {},
              },
            },
            links: [],
          },
        },
      };

      const layout: DashboardV2Spec['layout'] = {
        kind: 'AutoGridLayout',
        spec: {
          maxColumnCount: 3,
          columnWidthMode: 'standard',
          rowHeightMode: 'custom',
          rowHeight: 250,
          items: [
            {
              kind: 'AutoGridLayoutItem',
              spec: {
                element: {
                  kind: 'ElementReference',
                  name: 'panel-1',
                },
              },
            },
          ],
        },
      };

      const v2Dashboard = createV2Dashboard(elements, layout);
      const v1Result = ResponseTransformers.ensureV1Response(v2Dashboard);

      const panels = v1Result.dashboard.panels || [];
      const regularPanels = panels.filter((p) => p.type !== 'row') as Panel[];

      expect(regularPanels.length).toBe(1);
      // Custom rowHeight (250px) should convert to appropriate grid units
      // 250 / (GRID_CELL_HEIGHT + GRID_CELL_VMARGIN) ≈ 7-8
      expect(regularPanels[0].gridPos?.h).toBeGreaterThanOrEqual(7);
      expect(regularPanels[0].gridPos?.h).toBeLessThanOrEqual(8);
    });
  });

  describe('Round-trip conversion: v1 -> v2 -> v1', () => {
    it('should preserve dashboard structure through round-trip conversion', () => {
      const v1Dashboard = {
        uid: 'test-dashboard',
        id: 123,
        title: 'Test Dashboard',
        description: 'Test Description',
        tags: ['tag1'],
        schemaVersion: 40,
        graphTooltip: 0,
        preload: false,
        liveNow: false,
        editable: true,
        time: { from: 'now-6h', to: 'now' },
        timezone: 'browser',
        refresh: '',
        timepicker: {
          refresh_intervals: [],
          hidden: false,
        },
        fiscalYearStartMonth: 0,
        weekStart: 'monday',
        version: 1,
        links: [],
        annotations: { list: [] },
        templating: { list: [] },
        panels: [
          {
            id: 1,
            type: 'timeseries',
            title: 'Panel 1',
            gridPos: { x: 0, y: 0, w: 12, h: 8 },
            targets: [],
            datasource: { type: 'prometheus', uid: 'xyz-abc' },
            fieldConfig: { defaults: {}, overrides: [] },
            options: {},
            transparent: false,
            links: [],
            transformations: [],
          },
          {
            id: 2,
            type: 'row',
            title: 'Row 1',
            gridPos: { x: 0, y: 8, w: 24, h: 1 },
            collapsed: false,
            panels: [], // Expanded rows have empty panels array
          },
          {
            id: 3,
            type: 'timeseries',
            title: 'Panel in Row',
            gridPos: { x: 0, y: 9, w: 12, h: 8 }, // Absolute Y position after row (row Y + 1)
            targets: [],
            datasource: { type: 'prometheus', uid: 'xyz-abc' },
            fieldConfig: { defaults: {}, overrides: [] },
            options: {},
            transparent: false,
            links: [],
            transformations: [],
          },
        ],
      };

      const v1Input: DashboardWithAccessInfo<Record<string, unknown>> = {
        apiVersion: 'v1',
        kind: 'DashboardWithAccessInfo',
        metadata: {
          name: 'test-dashboard',
          resourceVersion: '1',
          creationTimestamp: '2023-01-01T00:00:00Z',
          annotations: {},
          labels: {},
        },
        spec: v1Dashboard,
        access: {
          url: '/d/test',
          canAdmin: true,
          canDelete: true,
          canEdit: true,
          canSave: true,
          canShare: true,
          canStar: true,
          annotationsPermissions: {
            dashboard: { canAdd: true, canEdit: true, canDelete: true },
            organization: { canAdd: true, canEdit: true, canDelete: true },
          },
        },
      };

      // Convert v1 -> v2
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v2Result = ResponseTransformers.ensureV2Response(v1Input as unknown as DashboardWithAccessInfo<any>);

      // Convert v2 -> v1
      const v1Output = ResponseTransformers.ensureV1Response(v2Result);

      // Compare dashboard structures directly
      const inputDashboard = v1Dashboard;
      const outputDashboard = v1Output.dashboard;

      // Compare dashboard properties
      expect(outputDashboard.title).toBe(inputDashboard.title);
      expect(outputDashboard.description).toBe(inputDashboard.description);
      expect(outputDashboard.tags).toEqual(inputDashboard.tags);
      expect(outputDashboard.schemaVersion).toBe(40);

      // Compare panels - order and structure must be preserved exactly
      const inputPanels = inputDashboard.panels || [];
      const outputPanels = outputDashboard.panels || [];

      expect(outputPanels.length).toBe(inputPanels.length);

      // Compare each panel in order
      for (let i = 0; i < inputPanels.length; i++) {
        const inputPanel = inputPanels[i];
        const outputPanel = outputPanels[i];

        expect(outputPanel.type).toBe(inputPanel.type);
        expect(outputPanel.title).toBe(inputPanel.title);

        if (inputPanel.type === 'row') {
          expect(outputPanel.collapsed).toBe(inputPanel.collapsed);
          const inputRowPanels = (inputPanel.panels as Array<Record<string, unknown>>) || [];
          const outputRowPanels = (outputPanel.panels as Array<Record<string, unknown>>) || [];

          // For collapsed rows, panels should be in row.panels array
          // For expanded rows, panels should be at top level (empty panels array)
          if (inputPanel.collapsed) {
            expect(outputRowPanels.length).toBe(inputRowPanels.length);
            // Compare panels within row
            for (let j = 0; j < inputRowPanels.length; j++) {
              const inputRowPanel = inputRowPanels[j] as Record<string, unknown>;
              const outputRowPanel = outputRowPanels[j] as Record<string, unknown>;
              expect(outputRowPanel.type).toBe(inputRowPanel.type);
              expect(outputRowPanel.title).toBe(inputRowPanel.title);
              expect(outputRowPanel.gridPos).toEqual(inputRowPanel.gridPos);
            }
          } else {
            // Expanded rows should have empty panels array
            expect(outputRowPanels.length).toBe(0);
          }
        } else {
          // Compare gridPos for non-row panels
          expect(outputPanel.gridPos).toEqual(inputPanel.gridPos);
        }
      }
    });

    it('should handle hidden header row special case in round-trip conversion', () => {
      // Create a v1 dashboard with panels before the first row
      const v1Dashboard = {
        uid: 'test-dashboard',
        id: 123,
        title: 'Test Dashboard',
        description: '',
        tags: [],
        schemaVersion: 40,
        graphTooltip: 0,
        preload: false,
        liveNow: false,
        editable: true,
        time: { from: 'now-6h', to: 'now' },
        timezone: 'browser',
        refresh: '',
        timepicker: {
          refresh_intervals: [],
          hidden: false,
        },
        fiscalYearStartMonth: 0,
        weekStart: 'monday',
        version: 1,
        links: [],
        annotations: { list: [] },
        templating: { list: [] },
        panels: [
          {
            id: 1,
            type: 'timeseries',
            title: 'Panel Before Row',
            gridPos: { x: 0, y: 0, w: 12, h: 8 },
            targets: [],
            datasource: { type: 'prometheus', uid: 'xyz-abc' },
            fieldConfig: { defaults: {}, overrides: [] },
            options: {},
            transparent: false,
            links: [],
            transformations: [],
          },
          {
            id: 2,
            type: 'timeseries',
            title: 'Another Panel Before Row',
            gridPos: { x: 12, y: 0, w: 12, h: 8 },
            targets: [],
            datasource: { type: 'prometheus', uid: 'xyz-abc' },
            fieldConfig: { defaults: {}, overrides: [] },
            options: {},
            transparent: false,
            links: [],
            transformations: [],
          },
          {
            id: 3,
            type: 'row',
            title: 'First Row',
            gridPos: { x: 0, y: 8, w: 24, h: 1 },
            collapsed: false,
            panels: [], // Expanded rows have empty panels array
          },
          {
            id: 4,
            type: 'timeseries',
            title: 'Panel in Row',
            gridPos: { x: 0, y: 9, w: 12, h: 8 }, // Absolute Y position after row (row Y + 1)
            targets: [],
            datasource: { type: 'prometheus', uid: 'xyz-abc' },
            fieldConfig: { defaults: {}, overrides: [] },
            options: {},
            transparent: false,
            links: [],
            transformations: [],
          },
        ],
      };

      const v1Input: DashboardWithAccessInfo<Record<string, unknown>> = {
        apiVersion: 'v1',
        kind: 'DashboardWithAccessInfo',
        metadata: {
          name: 'test-dashboard',
          resourceVersion: '1',
          creationTimestamp: '2023-01-01T00:00:00Z',
          annotations: {},
          labels: {},
        },
        spec: v1Dashboard,
        access: {
          url: '/d/test',
          canAdmin: true,
          canDelete: true,
          canEdit: true,
          canSave: true,
          canShare: true,
          canStar: true,
          annotationsPermissions: {
            dashboard: { canAdd: true, canEdit: true, canDelete: true },
            organization: { canAdd: true, canEdit: true, canDelete: true },
          },
        },
      };

      // Convert v1 -> v2
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v2Result = ResponseTransformers.ensureV2Response(v1Input as unknown as DashboardWithAccessInfo<any>);

      // Verify v2 has hidden header row
      expect(v2Result.spec.layout.kind).toBe('RowsLayout');
      const rowsLayout = v2Result.spec.layout as RowsLayoutKind;
      expect(rowsLayout.spec.rows.length).toBeGreaterThan(0);

      const firstRow = rowsLayout.spec.rows[0];
      expect(firstRow.spec.hideHeader).toBe(true);
      expect(firstRow.spec.title).toBe('');

      // Convert v2 -> v1
      const v1Output = ResponseTransformers.ensureV1Response(v2Result);

      // Compare dashboard structures directly
      const inputDashboard = v1Dashboard;
      const outputDashboard = v1Output.dashboard;

      // Compare dashboard properties
      expect(outputDashboard.title).toBe(inputDashboard.title);
      expect(outputDashboard.description).toBe(inputDashboard.description);
      expect(outputDashboard.tags).toEqual(inputDashboard.tags);

      // Compare panels - order and structure must be preserved exactly
      const inputPanels = inputDashboard.panels || [];
      const outputPanels = outputDashboard.panels || [];

      expect(outputPanels.length).toBe(inputPanels.length);

      // Compare each panel in order
      for (let i = 0; i < inputPanels.length; i++) {
        const inputPanel = inputPanels[i];
        const outputPanel = outputPanels[i];

        expect(outputPanel.type).toBe(inputPanel.type);
        expect(outputPanel.title).toBe(inputPanel.title);

        if (inputPanel.type === 'row') {
          expect(outputPanel.collapsed).toBe(inputPanel.collapsed);
          const inputRowPanels = (inputPanel.panels as Array<Record<string, unknown>>) || [];
          const outputRowPanels = (outputPanel.panels as Array<Record<string, unknown>>) || [];

          // For collapsed rows, panels should be in row.panels array
          // For expanded rows, panels should be at top level (empty panels array)
          if (inputPanel.collapsed) {
            expect(outputRowPanels.length).toBe(inputRowPanels.length);
            // Compare panels within row
            for (let j = 0; j < inputRowPanels.length; j++) {
              const inputRowPanel = inputRowPanels[j] as Record<string, unknown>;
              const outputRowPanel = outputRowPanels[j] as Record<string, unknown>;
              expect(outputRowPanel.type).toBe(inputRowPanel.type);
              expect(outputRowPanel.title).toBe(inputRowPanel.title);
              expect(outputRowPanel.gridPos).toEqual(inputRowPanel.gridPos);
            }
          } else {
            // Expanded rows should have empty panels array
            expect(outputRowPanels.length).toBe(0);
          }
        } else {
          // Compare gridPos for non-row panels
          expect(outputPanel.gridPos).toEqual(inputPanel.gridPos);
        }
      }
    });

    it('should treat hidden header row as regular row if it is not the first row', () => {
      // Create a v2 dashboard where the second row has hideHeader: true
      // This should be treated as a regular row panel, not as panels outside of a row
      const elements: DashboardV2Spec['elements'] = {
        'panel-1': {
          kind: 'Panel',
          spec: {
            id: 1,
            title: 'Panel 1',
            description: '',
            vizConfig: {
              kind: 'VizConfig',
              group: 'timeseries',
              version: '',
              spec: {
                fieldConfig: { defaults: {}, overrides: [] },
                options: {},
              },
            },
            data: {
              kind: 'QueryGroup',
              spec: {
                queries: [],
                transformations: [],
                queryOptions: {},
              },
            },
            links: [],
          },
        },
        'panel-2': {
          kind: 'Panel',
          spec: {
            id: 2,
            title: 'Panel 2',
            description: '',
            vizConfig: {
              kind: 'VizConfig',
              group: 'timeseries',
              version: '',
              spec: {
                fieldConfig: { defaults: {}, overrides: [] },
                options: {},
              },
            },
            data: {
              kind: 'QueryGroup',
              spec: {
                queries: [],
                transformations: [],
                queryOptions: {},
              },
            },
            links: [],
          },
        },
      };

      const layout: DashboardV2Spec['layout'] = {
        kind: 'RowsLayout',
        spec: {
          rows: [
            {
              kind: 'RowsLayoutRow',
              spec: {
                title: 'First Row',
                collapse: false,
                layout: {
                  kind: 'GridLayout',
                  spec: {
                    items: [
                      {
                        kind: 'GridLayoutItem',
                        spec: {
                          x: 0,
                          y: 0,
                          width: 12,
                          height: 8,
                          element: {
                            kind: 'ElementReference',
                            name: 'panel-1',
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
            {
              kind: 'RowsLayoutRow',
              spec: {
                title: '',
                collapse: false,
                hideHeader: true, // This is NOT the first row, so it should be treated as a regular row
                layout: {
                  kind: 'GridLayout',
                  spec: {
                    items: [
                      {
                        kind: 'GridLayoutItem',
                        spec: {
                          x: 0,
                          y: 0,
                          width: 12,
                          height: 8,
                          element: {
                            kind: 'ElementReference',
                            name: 'panel-2',
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      };

      const v2Dashboard = createV2Dashboard(elements, layout);

      const v1Result = ResponseTransformers.ensureV1Response(v2Dashboard);

      expect(v1Result.dashboard.panels).toBeDefined();
      const panels = v1Result.dashboard.panels || [];

      // Should have 2 row panels (the second one with hideHeader should still be a row panel)
      const rowPanels = panels.filter((p) => p.type === 'row') as RowPanel[];
      expect(rowPanels.length).toBe(2);

      // First row should have title "First Row" (expanded row)
      const firstRow = rowPanels[0];
      expect(firstRow.title).toBe('First Row');
      expect(firstRow.collapsed).toBe(false);
      // For expanded rows, panels should be at top level, not in row.panels array
      expect(firstRow.panels?.length).toBe(0);

      // Second row should be a row panel (not extracted as panels outside of row)
      // Even though it has hideHeader: true, it's not the first row, so it's treated as a regular row
      const secondRow = rowPanels[1];
      expect(secondRow.title).toBe('');
      expect(secondRow.collapsed).toBe(false);
      // For expanded rows, panels should be at top level, not in row.panels array
      expect(secondRow.panels?.length).toBe(0);

      // Panels should be at the top level for expanded rows
      const panelsOutsideRows = panels.filter((p) => p.type !== 'row');
      expect(panelsOutsideRows.length).toBe(2);
      expect(panelsOutsideRows.find((p) => p.id === 1)).toBeDefined();
      expect(panelsOutsideRows.find((p) => p.id === 2)).toBeDefined();
    });

    it('should handle collapsed rows correctly - panels should be in row.panels array', () => {
      // Create a v2 dashboard with a collapsed row
      const elements: DashboardV2Spec['elements'] = {
        'panel-1': {
          kind: 'Panel',
          spec: {
            id: 1,
            title: 'Panel in Collapsed Row',
            description: '',
            vizConfig: {
              kind: 'VizConfig',
              group: 'timeseries',
              version: '',
              spec: {
                fieldConfig: { defaults: {}, overrides: [] },
                options: {},
              },
            },
            data: {
              kind: 'QueryGroup',
              spec: {
                queries: [],
                transformations: [],
                queryOptions: {},
              },
            },
            links: [],
          },
        },
      };

      const layout: DashboardV2Spec['layout'] = {
        kind: 'RowsLayout',
        spec: {
          rows: [
            {
              kind: 'RowsLayoutRow',
              spec: {
                title: 'Collapsed Row',
                collapse: true, // Row is collapsed
                layout: {
                  kind: 'GridLayout',
                  spec: {
                    items: [
                      {
                        kind: 'GridLayoutItem',
                        spec: {
                          x: 0,
                          y: 0,
                          width: 12,
                          height: 8,
                          element: {
                            kind: 'ElementReference',
                            name: 'panel-1',
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      };

      const v2Dashboard = createV2Dashboard(elements, layout);

      const v1Result = ResponseTransformers.ensureV1Response(v2Dashboard);

      expect(v1Result.dashboard.panels).toBeDefined();
      const panels = v1Result.dashboard.panels || [];
      const rowPanels = panels.filter((p) => p.type === 'row') as RowPanel[];

      // Should have one row panel
      expect(rowPanels.length).toBe(1);
      const collapsedRow = rowPanels[0];
      expect(collapsedRow.title).toBe('Collapsed Row');
      expect(collapsedRow.collapsed).toBe(true);

      // For collapsed rows, panels should be in the row's panels array
      expect(collapsedRow.panels).toBeDefined();
      expect(collapsedRow.panels?.length).toBe(1);
      expect(collapsedRow.panels?.[0].id).toBe(1);
      expect(collapsedRow.panels?.[0].title).toBe('Panel in Collapsed Row');

      // Panels should NOT be at the top level for collapsed rows
      const panelsOutsideRows = panels.filter((p) => p.type !== 'row');
      expect(panelsOutsideRows.length).toBe(0);
    });

    it('should handle expanded rows correctly - panels should be at top level, not in row.panels array', () => {
      // Create a v2 dashboard with an expanded row
      const elements: DashboardV2Spec['elements'] = {
        'panel-1': {
          kind: 'Panel',
          spec: {
            id: 1,
            title: 'Panel in Expanded Row',
            description: '',
            vizConfig: {
              kind: 'VizConfig',
              group: 'timeseries',
              version: '',
              spec: {
                fieldConfig: { defaults: {}, overrides: [] },
                options: {},
              },
            },
            data: {
              kind: 'QueryGroup',
              spec: {
                queries: [],
                transformations: [],
                queryOptions: {},
              },
            },
            links: [],
          },
        },
      };

      const layout: DashboardV2Spec['layout'] = {
        kind: 'RowsLayout',
        spec: {
          rows: [
            {
              kind: 'RowsLayoutRow',
              spec: {
                title: 'Expanded Row',
                collapse: false, // Row is expanded
                layout: {
                  kind: 'GridLayout',
                  spec: {
                    items: [
                      {
                        kind: 'GridLayoutItem',
                        spec: {
                          x: 0,
                          y: 0,
                          width: 12,
                          height: 8,
                          element: {
                            kind: 'ElementReference',
                            name: 'panel-1',
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      };

      const v2Dashboard = createV2Dashboard(elements, layout);

      const v1Result = ResponseTransformers.ensureV1Response(v2Dashboard);

      expect(v1Result.dashboard.panels).toBeDefined();
      const panels = v1Result.dashboard.panels || [];
      const rowPanels = panels.filter((p) => p.type === 'row') as RowPanel[];

      // Should have one row panel
      expect(rowPanels.length).toBe(1);
      const expandedRow = rowPanels[0];
      expect(expandedRow.title).toBe('Expanded Row');
      expect(expandedRow.collapsed).toBe(false);

      // For expanded rows, panels should NOT be in the row's panels array
      // They should be at the top level after the row
      expect(expandedRow.panels).toBeDefined();
      expect(expandedRow.panels?.length).toBe(0); // Expanded rows have empty panels array

      // Panels should be at the top level for expanded rows
      const panelsOutsideRows = panels.filter((p) => p.type !== 'row');
      expect(panelsOutsideRows.length).toBe(1);
      expect(panelsOutsideRows[0].id).toBe(1);
      expect(panelsOutsideRows[0].title).toBe('Panel in Expanded Row');
    });

    it('should handle tabs nested inside a row - panels should be preserved in tab rows', () => {
      // Create a v2 dashboard with a row containing tabs with panels
      const elements: DashboardV2Spec['elements'] = {
        'panel-1': {
          kind: 'Panel',
          spec: {
            id: 1,
            title: 'Panel in Tab 1',
            description: '',
            vizConfig: {
              kind: 'VizConfig',
              group: 'timeseries',
              version: '',
              spec: {
                fieldConfig: { defaults: {}, overrides: [] },
                options: {},
              },
            },
            data: {
              kind: 'QueryGroup',
              spec: {
                queries: [],
                transformations: [],
                queryOptions: {},
              },
            },
            links: [],
          },
        },
        'panel-2': {
          kind: 'Panel',
          spec: {
            id: 2,
            title: 'Panel in Tab 2',
            description: '',
            vizConfig: {
              kind: 'VizConfig',
              group: 'timeseries',
              version: '',
              spec: {
                fieldConfig: { defaults: {}, overrides: [] },
                options: {},
              },
            },
            data: {
              kind: 'QueryGroup',
              spec: {
                queries: [],
                transformations: [],
                queryOptions: {},
              },
            },
            links: [],
          },
        },
      };

      const layout: DashboardV2Spec['layout'] = {
        kind: 'RowsLayout',
        spec: {
          rows: [
            {
              kind: 'RowsLayoutRow',
              spec: {
                title: 'Row with Tabs',
                collapse: false, // Expanded row
                layout: {
                  kind: 'TabsLayout',
                  spec: {
                    tabs: [
                      {
                        kind: 'TabsLayoutTab',
                        spec: {
                          title: 'Tab 1',
                          layout: {
                            kind: 'GridLayout',
                            spec: {
                              items: [
                                {
                                  kind: 'GridLayoutItem',
                                  spec: {
                                    x: 0,
                                    y: 0,
                                    width: 12,
                                    height: 8,
                                    element: {
                                      kind: 'ElementReference',
                                      name: 'panel-1',
                                    },
                                  },
                                },
                              ],
                            },
                          },
                        },
                      },
                      {
                        kind: 'TabsLayoutTab',
                        spec: {
                          title: 'Tab 2',
                          layout: {
                            kind: 'GridLayout',
                            spec: {
                              items: [
                                {
                                  kind: 'GridLayoutItem',
                                  spec: {
                                    x: 0,
                                    y: 0,
                                    width: 12,
                                    height: 8,
                                    element: {
                                      kind: 'ElementReference',
                                      name: 'panel-2',
                                    },
                                  },
                                },
                              ],
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      };

      const v2Dashboard = createV2Dashboard(elements, layout);

      const v1Result = ResponseTransformers.ensureV1Response(v2Dashboard);

      expect(v1Result.dashboard.panels).toBeDefined();
      const panels = v1Result.dashboard.panels || [];

      // Should have the parent row and two tab rows
      const rowPanels = panels.filter((p) => p.type === 'row') as RowPanel[];
      expect(rowPanels.length).toBe(3); // Parent row + 2 tab rows

      // Find the parent row
      const parentRow = rowPanels.find((r) => r.title === 'Row with Tabs');
      expect(parentRow).toBeDefined();
      expect(parentRow?.collapsed).toBe(false);
      // Parent row should have empty panels array (expanded)
      expect(parentRow?.panels?.length).toBe(0);

      // Find the tab rows
      const tab1Row = rowPanels.find((r) => r.title === 'Tab 1');
      const tab2Row = rowPanels.find((r) => r.title === 'Tab 2');

      expect(tab1Row).toBeDefined();
      expect(tab2Row).toBeDefined();

      // Tab rows should be expanded rows with empty panels array (tabs are converted to normal rows)
      expect(tab1Row?.collapsed).toBe(false);
      expect(tab1Row?.panels).toBeDefined();
      expect(tab1Row?.panels?.length).toBe(0);

      expect(tab2Row?.collapsed).toBe(false);
      expect(tab2Row?.panels).toBeDefined();
      expect(tab2Row?.panels?.length).toBe(0);

      // Panels from tabs should be at the top level
      const allPanels = panels.filter((p) => p.type !== 'row') as Panel[];
      const tab1Panel = allPanels.find((p) => p.id === 1);
      const tab2Panel = allPanels.find((p) => p.id === 2);

      expect(tab1Panel).toBeDefined();
      expect(tab1Panel?.title).toBe('Panel in Tab 1');

      expect(tab2Panel).toBeDefined();
      expect(tab2Panel?.title).toBe('Panel in Tab 2');
    });
  });
});
