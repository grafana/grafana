import _ from 'lodash';
import { DashboardModel } from '../state/DashboardModel';
import { PanelModel } from '../state/PanelModel';
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN } from 'app/core/constants';
import { expect } from 'test/lib/common';
import { DataLinkBuiltInVars } from '@grafana/ui';

jest.mock('app/core/services/context_srv', () => ({}));

describe('DashboardModel', () => {
  describe('when creating dashboard with old schema', () => {
    let model: any;
    let graph: any;
    let singlestat: any;
    let table: any;

    beforeEach(() => {
      model = new DashboardModel({
        services: {
          filter: { time: { from: 'now-1d', to: 'now' }, list: [{}] },
        },
        pulldowns: [
          { type: 'filtering', enable: true },
          { type: 'annotations', enable: true, annotations: [{ name: 'old' }] },
        ],
        panels: [
          {
            type: 'graph',
            legend: true,
            aliasYAxis: { test: 2 },
            y_formats: ['kbyte', 'ms'],
            grid: {
              min: 1,
              max: 10,
              rightMin: 5,
              rightMax: 15,
              leftLogBase: 1,
              rightLogBase: 2,
              threshold1: 200,
              threshold2: 400,
              threshold1Color: 'yellow',
              threshold2Color: 'red',
            },
            leftYAxisLabel: 'left label',
            targets: [{ refId: 'A' }, {}],
          },
          {
            type: 'singlestat',
            legend: true,
            thresholds: '10,20,30',
            aliasYAxis: { test: 2 },
            grid: { min: 1, max: 10 },
            targets: [{ refId: 'A' }, {}],
          },
          {
            type: 'table',
            legend: true,
            styles: [{ thresholds: ['10', '20', '30'] }, { thresholds: ['100', '200', '300'] }],
            targets: [{ refId: 'A' }, {}],
          },
        ],
      });

      graph = model.panels[0];
      singlestat = model.panels[1];
      table = model.panels[2];
    });

    it('should have title', () => {
      expect(model.title).toBe('No Title');
    });

    it('should have panel id', () => {
      expect(graph.id).toBe(1);
    });

    it('should move time and filtering list', () => {
      expect(model.time.from).toBe('now-1d');
      expect(model.templating.list[0].allFormat).toBe('glob');
    });

    it('graphite panel should change name too graph', () => {
      expect(graph.type).toBe('graph');
    });

    it('single stat panel should have two thresholds', () => {
      expect(singlestat.thresholds).toBe('20,30');
    });

    it('queries without refId should get it', () => {
      expect(graph.targets[1].refId).toBe('B');
    });

    it('update legend setting', () => {
      expect(graph.legend.show).toBe(true);
    });

    it('move aliasYAxis to series override', () => {
      expect(graph.seriesOverrides[0].alias).toBe('test');
      expect(graph.seriesOverrides[0].yaxis).toBe(2);
    });

    it('should move pulldowns to new schema', () => {
      expect(model.annotations.list[1].name).toBe('old');
    });

    it('table panel should only have two thresholds values', () => {
      expect(table.styles[0].thresholds[0]).toBe('20');
      expect(table.styles[0].thresholds[1]).toBe('30');
      expect(table.styles[1].thresholds[0]).toBe('200');
      expect(table.styles[1].thresholds[1]).toBe('300');
    });

    it('graph grid to yaxes options', () => {
      expect(graph.yaxes[0].min).toBe(1);
      expect(graph.yaxes[0].max).toBe(10);
      expect(graph.yaxes[0].format).toBe('kbyte');
      expect(graph.yaxes[0].label).toBe('left label');
      expect(graph.yaxes[0].logBase).toBe(1);
      expect(graph.yaxes[1].min).toBe(5);
      expect(graph.yaxes[1].max).toBe(15);
      expect(graph.yaxes[1].format).toBe('ms');
      expect(graph.yaxes[1].logBase).toBe(2);

      expect(graph.grid.rightMax).toBe(undefined);
      expect(graph.grid.rightLogBase).toBe(undefined);
      expect(graph.y_formats).toBe(undefined);
    });

    it('dashboard schema version should be set to latest', () => {
      expect(model.schemaVersion).toBe(22);
    });

    it('graph thresholds should be migrated', () => {
      expect(graph.thresholds.length).toBe(2);
      expect(graph.thresholds[0].op).toBe('gt');
      expect(graph.thresholds[0].value).toBe(200);
      expect(graph.thresholds[0].fillColor).toBe('yellow');
      expect(graph.thresholds[1].value).toBe(400);
      expect(graph.thresholds[1].fillColor).toBe('red');
    });

    it('graph thresholds should be migrated onto specified thresholds', () => {
      model = new DashboardModel({
        panels: [
          {
            type: 'graph',
            y_formats: ['kbyte', 'ms'],
            grid: {
              threshold1: 200,
              threshold2: 400,
            },
            thresholds: [{ value: 100 }],
          },
        ],
      });
      graph = model.panels[0];
      expect(graph.thresholds.length).toBe(3);
      expect(graph.thresholds[0].value).toBe(100);
      expect(graph.thresholds[1].value).toBe(200);
      expect(graph.thresholds[2].value).toBe(400);
    });
  });

  describe('when migrating to the grid layout', () => {
    let model: any;

    beforeEach(() => {
      model = {
        rows: [],
      };
    });

    it('should create proper grid', () => {
      model.rows = [createRow({ collapse: false, height: 8 }, [[6], [6]])];
      const dashboard = new DashboardModel(model);
      const panelGridPos = getGridPositions(dashboard);
      const expectedGrid = [
        { x: 0, y: 0, w: 12, h: 8 },
        { x: 12, y: 0, w: 12, h: 8 },
      ];

      expect(panelGridPos).toEqual(expectedGrid);
    });

    it('should add special "row" panel if row is collapsed', () => {
      model.rows = [createRow({ collapse: true, height: 8 }, [[6], [6]]), createRow({ height: 8 }, [[12]])];
      const dashboard = new DashboardModel(model);
      const panelGridPos = getGridPositions(dashboard);
      const expectedGrid = [
        { x: 0, y: 0, w: 24, h: 8 }, // row
        { x: 0, y: 1, w: 24, h: 8 }, // row
        { x: 0, y: 2, w: 24, h: 8 },
      ];

      expect(panelGridPos).toEqual(expectedGrid);
    });

    it('should add special "row" panel if row has visible title', () => {
      model.rows = [
        createRow({ showTitle: true, title: 'Row', height: 8 }, [[6], [6]]),
        createRow({ height: 8 }, [[12]]),
      ];
      const dashboard = new DashboardModel(model);
      const panelGridPos = getGridPositions(dashboard);
      const expectedGrid = [
        { x: 0, y: 0, w: 24, h: 8 }, // row
        { x: 0, y: 1, w: 12, h: 8 },
        { x: 12, y: 1, w: 12, h: 8 },
        { x: 0, y: 9, w: 24, h: 8 }, // row
        { x: 0, y: 10, w: 24, h: 8 },
      ];

      expect(panelGridPos).toEqual(expectedGrid);
    });

    it('should not add "row" panel if row has not visible title or not collapsed', () => {
      model.rows = [
        createRow({ collapse: true, height: 8 }, [[12]]),
        createRow({ height: 8 }, [[12]]),
        createRow({ height: 8 }, [[12], [6], [6]]),
        createRow({ collapse: true, height: 8 }, [[12]]),
      ];
      const dashboard = new DashboardModel(model);
      const panelGridPos = getGridPositions(dashboard);
      const expectedGrid = [
        { x: 0, y: 0, w: 24, h: 8 }, // row
        { x: 0, y: 1, w: 24, h: 8 }, // row
        { x: 0, y: 2, w: 24, h: 8 },
        { x: 0, y: 10, w: 24, h: 8 }, // row
        { x: 0, y: 11, w: 24, h: 8 },
        { x: 0, y: 19, w: 12, h: 8 },
        { x: 12, y: 19, w: 12, h: 8 },
        { x: 0, y: 27, w: 24, h: 8 }, // row
      ];

      expect(panelGridPos).toEqual(expectedGrid);
    });

    it('should add all rows if even one collapsed or titled row is present', () => {
      model.rows = [createRow({ collapse: true, height: 8 }, [[6], [6]]), createRow({ height: 8 }, [[12]])];
      const dashboard = new DashboardModel(model);
      const panelGridPos = getGridPositions(dashboard);
      const expectedGrid = [
        { x: 0, y: 0, w: 24, h: 8 }, // row
        { x: 0, y: 1, w: 24, h: 8 }, // row
        { x: 0, y: 2, w: 24, h: 8 },
      ];

      expect(panelGridPos).toEqual(expectedGrid);
    });

    it('should properly place panels with fixed height', () => {
      model.rows = [
        createRow({ height: 6 }, [[6], [6, 3], [6, 3]]),
        createRow({ height: 6 }, [[4], [4], [4, 3], [4, 3]]),
      ];
      const dashboard = new DashboardModel(model);
      const panelGridPos = getGridPositions(dashboard);
      const expectedGrid = [
        { x: 0, y: 0, w: 12, h: 6 },
        { x: 12, y: 0, w: 12, h: 3 },
        { x: 12, y: 3, w: 12, h: 3 },
        { x: 0, y: 6, w: 8, h: 6 },
        { x: 8, y: 6, w: 8, h: 6 },
        { x: 16, y: 6, w: 8, h: 3 },
        { x: 16, y: 9, w: 8, h: 3 },
      ];

      expect(panelGridPos).toEqual(expectedGrid);
    });

    it('should place panel to the right side of panel having bigger height', () => {
      model.rows = [createRow({ height: 6 }, [[4], [2, 3], [4, 6], [2, 3], [2, 3]])];
      const dashboard = new DashboardModel(model);
      const panelGridPos = getGridPositions(dashboard);
      const expectedGrid = [
        { x: 0, y: 0, w: 8, h: 6 },
        { x: 8, y: 0, w: 4, h: 3 },
        { x: 12, y: 0, w: 8, h: 6 },
        { x: 20, y: 0, w: 4, h: 3 },
        { x: 20, y: 3, w: 4, h: 3 },
      ];

      expect(panelGridPos).toEqual(expectedGrid);
    });

    it('should fill current row if it possible', () => {
      model.rows = [createRow({ height: 9 }, [[4], [2, 3], [4, 6], [2, 3], [2, 3], [8, 3]])];
      const dashboard = new DashboardModel(model);
      const panelGridPos = getGridPositions(dashboard);
      const expectedGrid = [
        { x: 0, y: 0, w: 8, h: 9 },
        { x: 8, y: 0, w: 4, h: 3 },
        { x: 12, y: 0, w: 8, h: 6 },
        { x: 20, y: 0, w: 4, h: 3 },
        { x: 20, y: 3, w: 4, h: 3 },
        { x: 8, y: 6, w: 16, h: 3 },
      ];

      expect(panelGridPos).toEqual(expectedGrid);
    });

    it('should fill current row if it possible (2)', () => {
      model.rows = [createRow({ height: 8 }, [[4], [2, 3], [4, 6], [2, 3], [2, 3], [8, 3]])];
      const dashboard = new DashboardModel(model);
      const panelGridPos = getGridPositions(dashboard);
      const expectedGrid = [
        { x: 0, y: 0, w: 8, h: 8 },
        { x: 8, y: 0, w: 4, h: 3 },
        { x: 12, y: 0, w: 8, h: 6 },
        { x: 20, y: 0, w: 4, h: 3 },
        { x: 20, y: 3, w: 4, h: 3 },
        { x: 8, y: 6, w: 16, h: 3 },
      ];

      expect(panelGridPos).toEqual(expectedGrid);
    });

    it('should fill current row if panel height more than row height', () => {
      model.rows = [createRow({ height: 6 }, [[4], [2, 3], [4, 8], [2, 3], [2, 3]])];
      const dashboard = new DashboardModel(model);
      const panelGridPos = getGridPositions(dashboard);
      const expectedGrid = [
        { x: 0, y: 0, w: 8, h: 6 },
        { x: 8, y: 0, w: 4, h: 3 },
        { x: 12, y: 0, w: 8, h: 8 },
        { x: 20, y: 0, w: 4, h: 3 },
        { x: 20, y: 3, w: 4, h: 3 },
      ];

      expect(panelGridPos).toEqual(expectedGrid);
    });

    it('should wrap panels to multiple rows', () => {
      model.rows = [createRow({ height: 6 }, [[6], [6], [12], [6], [3], [3]])];
      const dashboard = new DashboardModel(model);
      const panelGridPos = getGridPositions(dashboard);
      const expectedGrid = [
        { x: 0, y: 0, w: 12, h: 6 },
        { x: 12, y: 0, w: 12, h: 6 },
        { x: 0, y: 6, w: 24, h: 6 },
        { x: 0, y: 12, w: 12, h: 6 },
        { x: 12, y: 12, w: 6, h: 6 },
        { x: 18, y: 12, w: 6, h: 6 },
      ];

      expect(panelGridPos).toEqual(expectedGrid);
    });

    it('should add repeated row if repeat set', () => {
      model.rows = [
        createRow({ showTitle: true, title: 'Row', height: 8, repeat: 'server' }, [[6]]),
        createRow({ height: 8 }, [[12]]),
      ];
      const dashboard = new DashboardModel(model);
      const panelGridPos = getGridPositions(dashboard);
      const expectedGrid = [
        { x: 0, y: 0, w: 24, h: 8 },
        { x: 0, y: 1, w: 12, h: 8 },
        { x: 0, y: 9, w: 24, h: 8 },
        { x: 0, y: 10, w: 24, h: 8 },
      ];

      expect(panelGridPos).toEqual(expectedGrid);
      expect(dashboard.panels[0].repeat).toBe('server');
      expect(dashboard.panels[1].repeat).toBeUndefined();
      expect(dashboard.panels[2].repeat).toBeUndefined();
      expect(dashboard.panels[3].repeat).toBeUndefined();
    });

    it('should ignore repeated row', () => {
      model.rows = [
        createRow({ showTitle: true, title: 'Row1', height: 8, repeat: 'server' }, [[6]]),
        createRow(
          {
            showTitle: true,
            title: 'Row2',
            height: 8,
            repeatIteration: 12313,
            repeatRowId: 1,
          },
          [[6]]
        ),
      ];

      const dashboard = new DashboardModel(model);
      expect(dashboard.panels[0].repeat).toBe('server');
      expect(dashboard.panels.length).toBe(2);
    });

    it('should assign id', () => {
      model.rows = [createRow({ collapse: true, height: 8 }, [[6], [6]])];
      model.rows[0].panels[0] = {};

      const dashboard = new DashboardModel(model);
      expect(dashboard.panels[0].id).toBe(1);
    });
  });

  describe('when migrating from minSpan to maxPerRow', () => {
    it('maxPerRow should be correct', () => {
      const model = {
        panels: [{ minSpan: 8 }],
      };
      const dashboard = new DashboardModel(model);
      expect(dashboard.panels[0].maxPerRow).toBe(3);
    });
  });

  describe('when migrating panel links', () => {
    let model: any;

    beforeEach(() => {
      model = new DashboardModel({
        panels: [
          {
            links: [
              {
                url: 'http://mylink.com',
                keepTime: true,
                title: 'test',
              },
              {
                url: 'http://mylink.com?existingParam',
                params: 'customParam',
                title: 'test',
              },
              {
                url: 'http://mylink.com?existingParam',
                includeVars: true,
                title: 'test',
              },
              {
                dashboard: 'my other dashboard',
                title: 'test',
              },
              {
                dashUri: '',
                title: 'test',
              },
              {
                type: 'dashboard',
                keepTime: true,
              },
            ],
          },
        ],
      });
    });

    it('should add keepTime as variable', () => {
      expect(model.panels[0].links[0].url).toBe(`http://mylink.com?$${DataLinkBuiltInVars.keepTime}`);
    });

    it('should add params to url', () => {
      expect(model.panels[0].links[1].url).toBe('http://mylink.com?existingParam&customParam');
    });

    it('should add includeVars to url', () => {
      expect(model.panels[0].links[2].url).toBe(`http://mylink.com?existingParam&$${DataLinkBuiltInVars.includeVars}`);
    });

    it('should slugify dashboard name', () => {
      expect(model.panels[0].links[3].url).toBe(`dashboard/db/my-other-dashboard`);
    });
  });

  describe('when migrating variables', () => {
    let model: any;
    beforeEach(() => {
      model = new DashboardModel({
        panels: [
          {
            //graph panel
            options: {
              dataLinks: [
                {
                  url: 'http://mylink.com?series=${__series_name}',
                },
                {
                  url: 'http://mylink.com?series=${__value_time}',
                },
              ],
            },
          },
          {
            //  panel with field options
            options: {
              fieldOptions: {
                defaults: {
                  links: [
                    {
                      url: 'http://mylink.com?series=${__series_name}',
                    },
                    {
                      url: 'http://mylink.com?series=${__value_time}',
                    },
                  ],
                  title: '$__cell_0 * $__field_name * $__series_name',
                },
              },
            },
          },
        ],
      });
    });

    describe('data links', () => {
      it('should replace __series_name variable with __series.name', () => {
        expect(model.panels[0].options.dataLinks[0].url).toBe('http://mylink.com?series=${__series.name}');
        expect(model.panels[1].options.fieldOptions.defaults.links[0].url).toBe(
          'http://mylink.com?series=${__series.name}'
        );
      });

      it('should replace __value_time variable with __value.time', () => {
        expect(model.panels[0].options.dataLinks[1].url).toBe('http://mylink.com?series=${__value.time}');
        expect(model.panels[1].options.fieldOptions.defaults.links[1].url).toBe(
          'http://mylink.com?series=${__value.time}'
        );
      });
    });

    describe('field display', () => {
      it('should replace __series_name and __field_name variables with new syntax', () => {
        expect(model.panels[1].options.fieldOptions.defaults.title).toBe(
          '$__cell_0 * ${__field.name} * ${__series.name}'
        );
      });
    });
  });

  describe('when migrating labels from DataFrame to Field', () => {
    let model: any;
    beforeEach(() => {
      model = new DashboardModel({
        panels: [
          {
            //graph panel
            options: {
              dataLinks: [
                {
                  url: 'http://mylink.com?series=${__series.labels}&${__series.labels.a}',
                },
              ],
            },
          },
          {
            //  panel with field options
            options: {
              fieldOptions: {
                defaults: {
                  links: [
                    {
                      url: 'http://mylink.com?series=${__series.labels}&${__series.labels.x}',
                    },
                  ],
                },
              },
            },
          },
        ],
      });
    });

    describe('data links', () => {
      it('should replace __series.label variable with __field.label', () => {
        expect(model.panels[0].options.dataLinks[0].url).toBe(
          'http://mylink.com?series=${__field.labels}&${__field.labels.a}'
        );
        expect(model.panels[1].options.fieldOptions.defaults.links[0].url).toBe(
          'http://mylink.com?series=${__field.labels}&${__field.labels.x}'
        );
      });
    });
  });
});

function createRow(options: any, panelDescriptions: any[]) {
  const PANEL_HEIGHT_STEP = GRID_CELL_HEIGHT + GRID_CELL_VMARGIN;
  const { collapse, showTitle, title, repeat, repeatIteration } = options;
  let { height } = options;
  height = height * PANEL_HEIGHT_STEP;
  const panels: any[] = [];
  _.each(panelDescriptions, panelDesc => {
    const panel = { span: panelDesc[0] };
    if (panelDesc.length > 1) {
      //@ts-ignore
      panel['height'] = panelDesc[1] * PANEL_HEIGHT_STEP;
    }
    panels.push(panel);
  });
  const row = {
    collapse,
    height,
    showTitle,
    title,
    panels,
    repeat,
    repeatIteration,
  };
  return row;
}

function getGridPositions(dashboard: DashboardModel) {
  return _.map(dashboard.panels, (panel: PanelModel) => {
    return panel.gridPos;
  });
}
