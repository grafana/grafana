import { each, map } from 'lodash';

import { DataLinkBuiltInVars, MappingType, VariableHide } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { FieldConfigSource } from '@grafana/schema';
import { config } from 'app/core/config';
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN } from 'app/core/constants';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { DashboardModel } from '../state/DashboardModel';
import { PanelModel } from '../state/PanelModel';

import { DASHBOARD_SCHEMA_VERSION } from './DashboardMigrator';

jest.mock('app/core/services/context_srv', () => ({}));

const dataSources = {
  prom: mockDataSource({
    name: 'prom',
    uid: 'prom-uid',
    type: 'prometheus',
  }),
  prom2: mockDataSource({
    name: 'prom2',
    uid: 'prom2-uid',
    type: 'prometheus',
    isDefault: true,
  }),
  notDefault: mockDataSource({
    name: 'prom-not-default',
    uid: 'prom-not-default-uid',
    type: 'prometheus',
    isDefault: false,
  }),
  [MIXED_DATASOURCE_NAME]: mockDataSource({
    name: MIXED_DATASOURCE_NAME,
    type: 'mixed',
    uid: MIXED_DATASOURCE_NAME,
  }),
};

setupDataSources(...Object.values(dataSources));

describe('DashboardModel', () => {
  describe('when creating dashboard with old schema', () => {
    let model: DashboardModel;
    let graph: any;
    let table: any;
    const panelIdWithRepeatId = 500;

    config.panels = {
      stat: getPanelPlugin({ id: 'stat' }).meta,
      gauge: getPanelPlugin({ id: 'gauge' }).meta,
    };

    beforeEach(() => {
      model = new DashboardModel({
        services: {
          filter: { time: { from: 'now-1d', to: 'now' }, list: [{ name: 'server' }] },
        },
        pulldowns: [
          { type: 'filtering', enable: true },
          { type: 'annotations', enable: true, annotations: [{ name: 'old' }] },
        ],
        style: 'dark',
        panels: [
          {
            type: 'graph',
            // @ts-expect-error
            legend: { show: true },
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
            // @ts-expect-error
            legend: true,
            thresholds: '10,20,30',
            colors: ['#FF0000', 'green', 'orange'],
            aliasYAxis: { test: 2 },
            grid: { min: 1, max: 10 },
            targets: [{ refId: 'A' }, {}],
          },
          {
            type: 'singlestat',
            // @ts-expect-error
            thresholds: '10,20,30',
            colors: ['#FF0000', 'green', 'orange'],
            gauge: {
              show: true,
              thresholdMarkers: true,
              thresholdLabels: false,
            },
            grid: { min: 1, max: 10 },
          },
          {
            type: 'table',
            // @ts-expect-error
            legend: true,
            styles: [{ thresholds: ['10', '20', '30'] }, { thresholds: ['100', '200', '300'] }],
            targets: [{ refId: 'A' }, {}],
          },
          // Old left-over repeated panel
          {
            type: 'table',
            id: panelIdWithRepeatId,
            // @ts-expect-error
            repeatPanelId: 1,
          },
          // Collapsed row with left-over repeated panels
          {
            type: 'row',
            panels: [
              {
                id: 501,
                type: 'table',
                repeat: 'server',
              },
              // Old left-over repeated panel
              {
                id: 502,
                // @ts-expect-error
                repeatedPanelId: 501,
              },
            ],
          },
        ],
      });

      graph = model.panels[0];
      table = model.panels[3];
    });

    it('should have title', () => {
      expect(model.title).toBe('No Title');
    });

    it('should have panel id', () => {
      expect(graph.id).toBe(503);
    });

    it('should not have style', () => {
      expect(model.style).toBe(undefined);
    });

    it('should move time and filtering list', () => {
      expect(model.time.from).toBe('now-1d');
      expect(model.templating.list[0].name).toBe('server');
    });

    it('queries without refId should get it', () => {
      expect(graph.targets[1].refId).toBe('B');
    });

    it('update legend setting', () => {
      expect(graph.legend.show).toBe(true);
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

    it('table type should be deprecated', () => {
      expect(table.type).toBe('table');
    });

    it('dashboard schema version should be set to latest', () => {
      expect(model.schemaVersion).toBe(DASHBOARD_SCHEMA_VERSION);
    });

    it('Shoud ignore repeated panels', () => {
      expect(model.getPanelById(panelIdWithRepeatId)).toBe(null);
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
      // @ts-expect-error
      const dashboard = new DashboardModel(model);
      expect(dashboard.panels[0].maxPerRow).toBe(3);
    });
  });

  describe('when migrating panel links', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = new DashboardModel({
        panels: [
          {
            links: [
              // @ts-expect-error
              {
                url: 'http://mylink.com',
                keepTime: true,
                title: 'test',
              },
              {
                url: 'http://mylink.com?existingParam',
                // @ts-expect-error
                params: 'customParam',
                title: 'test',
              },
              // @ts-expect-error
              {
                url: 'http://mylink.com?existingParam',
                includeVars: true,
                title: 'test',
              },
              {
                // @ts-expect-error
                dashboard: 'my other dashboard',
                title: 'test',
              },
              {
                // @ts-expect-error
                dashUri: '',
                title: 'test',
              },
              {
                // @ts-expect-error
                type: 'dashboard',
                keepTime: true,
              },
            ],
          },
        ],
      });
    });

    it('should add keepTime as variable', () => {
      expect(model.panels[0].links?.[0].url).toBe(`http://mylink.com?$${DataLinkBuiltInVars.keepTime}`);
    });

    it('should add params to url', () => {
      expect(model.panels[0].links?.[1].url).toBe('http://mylink.com?existingParam&customParam');
    });

    it('should add includeVars to url', () => {
      expect(model.panels[0].links?.[2].url).toBe(
        `http://mylink.com?existingParam&$${DataLinkBuiltInVars.includeVars}`
      );
    });

    it('should slugify dashboard name', () => {
      expect(model.panels[0].links?.[3].url).toBe(`dashboard/db/my-other-dashboard`);
    });
  });

  describe('when migrating variables', () => {
    let model: DashboardModel;
    beforeEach(() => {
      model = new DashboardModel({
        panels: [
          // @ts-expect-error
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
          // @ts-expect-error
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
    let model: DashboardModel;
    beforeEach(() => {
      model = new DashboardModel({
        panels: [
          // @ts-expect-error
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
          // @ts-expect-error
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

  describe('when migrating variables with multi support', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = new DashboardModel({
        templating: {
          list: [
            // @ts-expect-error
            {
              multi: false,
              current: {
                value: ['value'],
                text: ['text'],
              },
            },
            // @ts-expect-error
            {
              multi: true,
              current: {
                value: ['value'],
                text: ['text'],
              },
            },
          ],
        },
      });
    });

    it('should have two variables after migration', () => {
      expect(model.templating.list.length).toBe(2);
    });

    it('should be migrated if being out of sync', () => {
      expect(model.templating.list[0].multi).toBe(false);
      expect(model.templating.list[0].current).toEqual({
        text: 'text',
        value: 'value',
      });
    });

    it('should not be migrated if being in sync', () => {
      expect(model.templating.list[1].multi).toBe(true);
      expect(model.templating.list[1].current).toEqual({
        text: ['text'],
        value: ['value'],
      });
    });
  });

  describe('when migrating variables with tags', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = new DashboardModel({
        templating: {
          list: [
            {
              type: 'query',
              // @ts-expect-error
              tags: ['Africa', 'America', 'Asia', 'Europe'],
              tagsQuery: 'select datacenter from x',
              tagValuesQuery: 'select value from x where datacenter = xyz',
              useTags: true,
            },
            {
              type: 'query',
              current: {
                // @ts-expect-error
                tags: [
                  {
                    selected: true,
                    text: 'America',
                    values: ['server-us-east', 'server-us-central', 'server-us-west'],
                    valuesText: 'server-us-east + server-us-central + server-us-west',
                  },
                  {
                    selected: true,
                    text: 'Europe',
                    values: ['server-eu-east', 'server-eu-west'],
                    valuesText: 'server-eu-east + server-eu-west',
                  },
                ],
                text: 'server-us-east + server-us-central + server-us-west + server-eu-east + server-eu-west',
                value: ['server-us-east', 'server-us-central', 'server-us-west', 'server-eu-east', 'server-eu-west'],
              },
              tags: ['Africa', 'America', 'Asia', 'Europe'],
              tagsQuery: 'select datacenter from x',
              tagValuesQuery: 'select value from x where datacenter = xyz',
              useTags: true,
            },
            {
              type: 'query',
              // @ts-expect-error
              tags: [
                { text: 'Africa', selected: false },
                { text: 'America', selected: true },
                { text: 'Asia', selected: false },
                { text: 'Europe', selected: false },
              ],
              tagsQuery: 'select datacenter from x',
              tagValuesQuery: 'select value from x where datacenter = xyz',
              useTags: true,
            },
          ],
        },
      });
    });

    it('should have three variables after migration', () => {
      expect(model.templating.list.length).toBe(3);
    });

    it('should have no tags', () => {
      expect(model.templating.list[0].tags).toBeUndefined();
      expect(model.templating.list[1].tags).toBeUndefined();
      expect(model.templating.list[2].tags).toBeUndefined();
    });

    it('should have no tagsQuery property', () => {
      expect(model.templating.list[0].tagsQuery).toBeUndefined();
      expect(model.templating.list[1].tagsQuery).toBeUndefined();
      expect(model.templating.list[2].tagsQuery).toBeUndefined();
    });

    it('should have no tagValuesQuery property', () => {
      expect(model.templating.list[0].tagValuesQuery).toBeUndefined();
      expect(model.templating.list[1].tagValuesQuery).toBeUndefined();
      expect(model.templating.list[2].tagValuesQuery).toBeUndefined();
    });

    it('should have no useTags property', () => {
      expect(model.templating.list[0].useTags).toBeUndefined();
      expect(model.templating.list[1].useTags).toBeUndefined();
      expect(model.templating.list[2].useTags).toBeUndefined();
    });
  });

  describe('when migrating to new Text Panel', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = new DashboardModel({
        panels: [
          {
            id: 2,
            type: 'text',
            title: 'Angular Text Panel',
            // @ts-expect-error
            content:
              '# Angular Text Panel\n# $constant\n\nFor markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)\n\n## $text\n\n',
            mode: 'markdown',
          },
          {
            id: 3,
            type: 'text2',
            title: 'React Text Panel from scratch',
            options: {
              mode: 'markdown',
              content:
                '# React Text Panel from scratch\n# $constant\n\nFor markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)\n\n## $text',
            },
          },
          {
            id: 4,
            type: 'text2',
            title: 'React Text Panel from Angular Panel',
            options: {
              mode: 'markdown',
              content:
                '# React Text Panel from Angular Panel\n# $constant\n\nFor markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)\n\n## $text',
              angular: {
                content:
                  '# React Text Panel from Angular Panel\n# $constant\n\nFor markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)\n\n## $text\n',
                mode: 'markdown',
                options: {},
              },
            },
          },
        ],
      });
    });

    it('should have 3 panels after migration', () => {
      expect(model.panels.length).toBe(3);
    });

    it('should not migrate panel with old Text Panel id', () => {
      const oldAngularPanel: any = model.panels[0];
      expect(oldAngularPanel.id).toEqual(2);
      expect(oldAngularPanel.type).toEqual('text');
      expect(oldAngularPanel.title).toEqual('Angular Text Panel');
      expect(oldAngularPanel.content).toEqual(
        '# Angular Text Panel\n# $constant\n\nFor markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)\n\n## $text\n\n'
      );
      expect(oldAngularPanel.mode).toEqual('markdown');
    });

    it('should migrate panels with new Text Panel id', () => {
      const reactPanel = model.panels[1];
      expect(reactPanel.id).toEqual(3);
      expect(reactPanel.type).toEqual('text');
      expect(reactPanel.title).toEqual('React Text Panel from scratch');
      expect(reactPanel.options.content).toEqual(
        '# React Text Panel from scratch\n# $constant\n\nFor markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)\n\n## $text'
      );
      expect(reactPanel.options.mode).toEqual('markdown');
    });

    it('should clean up old angular options for panels with new Text Panel id', () => {
      const reactPanel = model.panels[2];
      expect(reactPanel.id).toEqual(4);
      expect(reactPanel.type).toEqual('text');
      expect(reactPanel.title).toEqual('React Text Panel from Angular Panel');
      expect(reactPanel.options.content).toEqual(
        '# React Text Panel from Angular Panel\n# $constant\n\nFor markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)\n\n## $text'
      );
      expect(reactPanel.options.mode).toEqual('markdown');
      expect(reactPanel.options.angular).toBeUndefined();
    });
  });

  describe('when migrating constant variables so they are always hidden', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = new DashboardModel({
        editable: true,
        graphTooltip: 0,
        schemaVersion: 10,
        templating: {
          list: [
            {
              name: 'server1',
              type: 'query',
              hide: VariableHide.dontHide,
              datasource: null,
            },
            {
              name: 'server2',
              type: 'query',
              hide: VariableHide.hideLabel,
              datasource: null,
            },
            {
              name: 'server3',
              type: 'query',
              hide: VariableHide.hideVariable,
              datasource: null,
            },
            {
              name: 'server4',
              type: 'constant',
              hide: VariableHide.dontHide,
              query: 'default value',
              current: { selected: true, text: 'A', value: 'B' },
              options: [{ selected: true, text: 'A', value: 'B' }],
              datasource: null,
            },
            {
              name: 'server5',
              type: 'constant',
              hide: VariableHide.hideLabel,
              query: 'default value',
              current: { selected: true, text: 'A', value: 'B' },
              options: [{ selected: true, text: 'A', value: 'B' }],
              datasource: null,
            },
            {
              name: 'server6',
              type: 'constant',
              hide: VariableHide.hideVariable,
              query: 'default value',
              current: { selected: true, text: 'A', value: 'B' },
              options: [{ selected: true, text: 'A', value: 'B' }],
              datasource: null,
            },
          ],
        },
      });
    });

    it('should have six variables after migration', () => {
      expect(model.templating.list.length).toBe(6);
    });

    it('should not touch other variable types', () => {
      expect(model.templating.list[0].hide).toEqual(VariableHide.dontHide);
      expect(model.templating.list[1].hide).toEqual(VariableHide.hideLabel);
      expect(model.templating.list[2].hide).toEqual(VariableHide.hideVariable);
    });

    it('should migrate visible constant variables to textbox variables', () => {
      expect(model.templating.list[3]).toEqual({
        name: 'server4',
        type: 'textbox',
        hide: VariableHide.dontHide,
        query: 'default value',
        current: { selected: true, text: 'default value', value: 'default value' },
        options: [{ selected: true, text: 'default value', value: 'default value' }],
        datasource: null,
      });
      expect(model.templating.list[4]).toEqual({
        name: 'server5',
        type: 'textbox',
        hide: VariableHide.hideLabel,
        query: 'default value',
        current: { selected: true, text: 'default value', value: 'default value' },
        options: [{ selected: true, text: 'default value', value: 'default value' }],
        datasource: null,
      });
    });

    it('should change current and options for hidden constant variables', () => {
      expect(model.templating.list[5]).toEqual({
        name: 'server6',
        type: 'constant',
        hide: VariableHide.hideVariable,
        query: 'default value',
        current: { selected: true, text: 'default value', value: 'default value' },
        options: [{ selected: true, text: 'default value', value: 'default value' }],
        datasource: null,
      });
    });
  });

  describe('when migrating variable refresh to on dashboard load', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = new DashboardModel({
        editable: true,
        graphTooltip: 0,
        schemaVersion: 20,
        templating: {
          list: [
            {
              type: 'query',
              name: 'variable_with_never_refresh_with_options',
              options: [{ text: 'A', value: 'A' }],
              refresh: 0,
            },
            {
              type: 'query',
              name: 'variable_with_never_refresh_without_options',
              options: [],
              refresh: 0,
            },
            {
              type: 'query',
              name: 'variable_with_dashboard_refresh_with_options',
              options: [{ text: 'A', value: 'A' }],
              refresh: 1,
            },
            {
              type: 'query',
              name: 'variable_with_dashboard_refresh_without_options',
              options: [],
              refresh: 1,
            },
            {
              type: 'query',
              name: 'variable_with_timerange_refresh_with_options',
              options: [{ text: 'A', value: 'A' }],
              refresh: 2,
            },
            {
              type: 'query',
              name: 'variable_with_timerange_refresh_without_options',
              options: [],
              refresh: 2,
            },
            {
              type: 'query',
              name: 'variable_with_no_refresh_with_options',
              options: [{ text: 'A', value: 'A' }],
            },
            {
              type: 'query',
              name: 'variable_with_no_refresh_without_options',
              options: [],
            },
            {
              type: 'query',
              name: 'variable_with_unknown_refresh_with_options',
              options: [{ text: 'A', value: 'A' }],
              // @ts-expect-error
              refresh: 2001,
            },
            {
              type: 'query',
              name: 'variable_with_unknown_refresh_without_options',
              options: [],
              // @ts-expect-error
              refresh: 2001,
            },
            {
              type: 'custom',
              name: 'custom',
              options: [{ text: 'custom', value: 'custom' }],
            },
            {
              type: 'textbox',
              name: 'textbox',
              options: [{ text: 'Hello', value: 'World' }],
            },
            {
              type: 'datasource',
              name: 'datasource',
              options: [{ text: 'ds', value: 'ds' }], // fake example doesn't exist
            },
            {
              type: 'interval',
              name: 'interval',
              options: [{ text: '1m', value: '1m' }],
            },
          ],
        },
      });
    });

    it('should have 14 variables after migration', () => {
      expect(model.templating.list.length).toBe(14);
    });

    it('should not affect custom variable types', () => {
      const custom = model.templating.list[10];
      expect(custom.type).toEqual('custom');
      expect(custom.options).toEqual([{ text: 'custom', value: 'custom' }]);
    });

    it('should not affect textbox variable types', () => {
      const textbox = model.templating.list[11];
      expect(textbox.type).toEqual('textbox');
      expect(textbox.options).toEqual([{ text: 'Hello', value: 'World' }]);
    });

    it('should not affect datasource variable types', () => {
      const datasource = model.templating.list[12];
      expect(datasource.type).toEqual('datasource');
      expect(datasource.options).toEqual([{ text: 'ds', value: 'ds' }]);
    });

    it('should not affect interval variable types', () => {
      const interval = model.templating.list[13];
      expect(interval.type).toEqual('interval');
      expect(interval.options).toEqual([{ text: '1m', value: '1m' }]);
    });

    it('should removed options from all query variables', () => {
      const queryVariables = model.templating.list.filter((v) => v.type === 'query');
      expect(queryVariables).toHaveLength(10);
      const noOfOptions = queryVariables.reduce((all, variable) => all + variable.options.length, 0);
      expect(noOfOptions).toBe(0);
    });

    it('should set the refresh prop to on dashboard load for all query variables that have never or unknown', () => {
      expect(model.templating.list[0].refresh).toBe(1);
      expect(model.templating.list[1].refresh).toBe(1);
      expect(model.templating.list[2].refresh).toBe(1);
      expect(model.templating.list[3].refresh).toBe(1);
      expect(model.templating.list[4].refresh).toBe(2);
      expect(model.templating.list[5].refresh).toBe(2);
      expect(model.templating.list[6].refresh).toBe(1);
      expect(model.templating.list[7].refresh).toBe(1);
      expect(model.templating.list[8].refresh).toBe(1);
      expect(model.templating.list[9].refresh).toBe(1);
      expect(model.templating.list[10].refresh).toBeUndefined();
      expect(model.templating.list[11].refresh).toBeUndefined();
      expect(model.templating.list[12].refresh).toBeUndefined();
      expect(model.templating.list[13].refresh).toBeUndefined();
    });
  });

  describe('when migrating old value mapping model', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = new DashboardModel({
        panels: [
          {
            id: 1,
            type: 'timeseries',
            fieldConfig: {
              defaults: {
                thresholds: {
                  // @ts-expect-error
                  mode: 'absolute',
                  steps: [
                    {
                      color: 'green',
                      value: null,
                    },
                    {
                      color: 'red',
                      value: 80,
                    },
                  ],
                },
                mappings: [
                  {
                    id: 0,
                    text: '1',
                    // @ts-expect-error
                    type: 1,
                    value: 'up',
                  },
                  {
                    id: 1,
                    text: 'BAD',
                    // @ts-expect-error
                    type: 1,
                    value: 'down',
                  },
                  {
                    from: '0',
                    id: 2,
                    text: 'below 30',
                    to: '30',
                    // @ts-expect-error
                    type: 2,
                  },
                  {
                    from: '30',
                    id: 3,
                    text: '100',
                    to: '100',
                    // @ts-expect-error
                    type: 2,
                  },
                  {
                    // @ts-expect-error
                    type: 1,
                    value: 'null',
                    text: 'it is null',
                  },
                ],
              },
              overrides: [
                {
                  matcher: { id: 'byName', options: 'D-series' },
                  properties: [
                    {
                      id: 'mappings',
                      value: [
                        {
                          id: 0,
                          text: 'OverrideText',
                          type: 1,
                          value: 'up',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
      });
    });

    it('should migrate value mapping model', () => {
      expect(model.panels[0].fieldConfig.defaults.mappings).toEqual([
        {
          type: MappingType.ValueToText,
          options: {
            down: { text: 'BAD', color: undefined },
            up: { text: '1', color: 'green' },
          },
        },
        {
          type: MappingType.RangeToText,
          options: {
            from: 0,
            to: 30,
            result: { text: 'below 30' },
          },
        },
        {
          type: MappingType.RangeToText,
          options: {
            from: 30,
            to: 100,
            result: { text: '100', color: 'red' },
          },
        },
        {
          type: MappingType.SpecialValue,
          options: {
            match: 'null',
            result: { text: 'it is null', color: undefined },
          },
        },
      ]);

      expect(model.panels[0].fieldConfig.overrides).toEqual([
        {
          matcher: { id: 'byName', options: 'D-series' },
          properties: [
            {
              id: 'mappings',
              value: [
                {
                  type: MappingType.ValueToText,
                  options: {
                    up: { text: 'OverrideText' },
                  },
                },
              ],
            },
          ],
        },
      ]);
    });
  });

  describe('when migrating tooltipOptions to tooltip', () => {
    it('should rename options.tooltipOptions to options.tooltip', () => {
      const model = new DashboardModel({
        panels: [
          {
            type: 'timeseries',
            // @ts-expect-error
            legend: true,
            options: {
              tooltipOptions: { mode: 'multi' },
            },
          },
          {
            type: 'xychart',
            // @ts-expect-error
            legend: true,
            options: {
              tooltipOptions: { mode: 'single' },
            },
          },
        ],
      });
      expect(model.panels[0].options).toMatchInlineSnapshot(`
        {
          "tooltip": {
            "mode": "multi",
          },
        }
      `);
      expect(model.panels[1].options).toMatchInlineSnapshot(`
        {
          "tooltip": {
            "mode": "single",
          },
        }
      `);
    });
  });

  describe('when migrating singlestat value mappings', () => {
    it.skip('should migrate value mapping', () => {
      const model = new DashboardModel({
        panels: [
          {
            type: 'singlestat',
            // @ts-expect-error
            legend: true,
            thresholds: '10,20,30',
            colors: ['#FF0000', 'green', 'orange'],
            aliasYAxis: { test: 2 },
            grid: { min: 1, max: 10 },
            targets: [{ refId: 'A' }, {}],
            mappingType: 1,
            mappingTypes: [
              {
                name: 'value to text',
                value: 1,
              },
            ],
            valueMaps: [
              {
                op: '=',
                text: 'test',
                value: '20',
              },
              {
                op: '=',
                text: 'test1',
                value: '30',
              },
              {
                op: '=',
                text: '50',
                value: '40',
              },
            ],
          },
        ],
      });
      expect(model.panels[0].fieldConfig.defaults.mappings).toMatchInlineSnapshot(`
        [
          {
            "options": {
              "20": {
                "color": undefined,
                "text": "test",
              },
              "30": {
                "color": undefined,
                "text": "test1",
              },
              "40": {
                "color": "orange",
                "text": "50",
              },
            },
            "type": "value",
          },
        ]
      `);
    });

    it.skip('should migrate range mapping', () => {
      const model = new DashboardModel({
        panels: [
          {
            type: 'singlestat',
            // @ts-expect-error
            legend: true,
            thresholds: '10,20,30',
            colors: ['#FF0000', 'green', 'orange'],
            aliasYAxis: { test: 2 },
            grid: { min: 1, max: 10 },
            targets: [{ refId: 'A' }, {}],
            mappingType: 2,
            mappingTypes: [
              {
                name: 'range to text',
                value: 2,
              },
            ],
            rangeMaps: [
              {
                from: '20',
                to: '25',
                text: 'text1',
              },
              {
                from: '1',
                to: '5',
                text: 'text2',
              },
              {
                from: '5',
                to: '10',
                text: '50',
              },
            ],
          },
        ],
      });
      expect(model.panels[0].fieldConfig.defaults.mappings).toMatchInlineSnapshot(`
        [
          {
            "options": {
              "from": 20,
              "result": {
                "color": undefined,
                "text": "text1",
              },
              "to": 25,
            },
            "type": "range",
          },
          {
            "options": {
              "from": 1,
              "result": {
                "color": undefined,
                "text": "text2",
              },
              "to": 5,
            },
            "type": "range",
          },
          {
            "options": {
              "from": 5,
              "result": {
                "color": "orange",
                "text": "50",
              },
              "to": 10,
            },
            "type": "range",
          },
        ]
      `);
    });
  });

  describe('when migrating folded panel without fieldConfig.defaults', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = new DashboardModel({
        schemaVersion: 29,
        panels: [
          {
            id: 1,
            type: 'timeseries',
            // @ts-expect-error
            panels: [
              {
                id: 2,
                fieldConfig: {
                  overrides: [
                    {
                      matcher: { id: 'byName', options: 'D-series' },
                      properties: [
                        {
                          id: 'displayName',
                          value: 'foobar',
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        ],
      });
    });

    it('should ignore fieldConfig.defaults', () => {
      expect(model.panels[0].panels?.[0].fieldConfig.defaults).toEqual(undefined);
    });
  });

  describe('labelsToFields should be split into two transformers', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = new DashboardModel({
        schemaVersion: 29,
        panels: [
          {
            id: 1,
            type: 'timeseries',
            // @ts-expect-error
            transformations: [{ id: 'labelsToFields' }],
          },
        ],
      });
    });

    it('should create two transormatoins', () => {
      const xforms = model.panels[0].transformations;
      expect(xforms).toMatchInlineSnapshot(`
        [
          {
            "id": "labelsToFields",
          },
          {
            "id": "merge",
            "options": {},
          },
        ]
      `);
    });
  });

  describe('migrating legacy CloudWatch queries', () => {
    let model: DashboardModel;
    let panelTargets: any;

    beforeEach(() => {
      model = new DashboardModel({
        annotations: {
          list: [
            {
              // @ts-expect-error
              actionPrefix: '',
              alarmNamePrefix: '',
              alias: '',
              dimensions: {
                InstanceId: 'i-123',
              },
              enable: true,
              expression: '',
              iconColor: 'red',
              id: '',
              matchExact: true,
              metricName: 'CPUUtilization',
              name: 'test',
              namespace: 'AWS/EC2',
              period: '',
              prefixMatching: false,
              region: 'us-east-2',
              statistics: ['Minimum', 'Sum'],
            },
          ],
        },
        panels: [
          {
            gridPos: {
              h: 8,
              w: 12,
              x: 0,
              y: 0,
            },
            id: 4,
            options: {
              legend: {
                calcs: [],
                displayMode: 'list',
                placement: 'bottom',
              },
              tooltipOptions: {
                mode: 'single',
              },
            },
            targets: [
              {
                alias: '',
                dimensions: {
                  InstanceId: 'i-123',
                },
                expression: '',
                id: '',
                matchExact: true,
                metricName: 'CPUUtilization',
                namespace: 'AWS/EC2',
                period: '',
                refId: 'A',
                region: 'default',
                statistics: ['Average', 'Minimum', 'p12.21'],
              },
              {
                alias: '',
                dimensions: {
                  InstanceId: 'i-123',
                },
                expression: '',
                hide: false,
                id: '',
                matchExact: true,
                metricName: 'CPUUtilization',
                namespace: 'AWS/EC2',
                period: '',
                refId: 'B',
                region: 'us-east-2',
                statistics: ['Sum'],
              },
            ],
            title: 'Panel Title',
            type: 'timeseries',
          },
        ],
      });
      panelTargets = model.panels[0].targets;
    });

    it('multiple stats query should have been split into three', () => {
      expect(panelTargets.length).toBe(4);
    });

    it('new stats query should get the right statistic', () => {
      expect(panelTargets[0].statistic).toBe('Average');
      expect(panelTargets[1].statistic).toBe('Sum');
      expect(panelTargets[2].statistic).toBe('Minimum');
      expect(panelTargets[3].statistic).toBe('p12.21');
    });

    it('new stats queries should be put in the end of the array', () => {
      expect(panelTargets[0].refId).toBe('A');
      expect(panelTargets[1].refId).toBe('B');
      expect(panelTargets[2].refId).toBe('C');
      expect(panelTargets[3].refId).toBe('D');
    });

    describe('with nested panels', () => {
      let panel1Targets: any;
      let panel2Targets: any;
      let nestedModel: DashboardModel;

      beforeEach(() => {
        nestedModel = new DashboardModel({
          annotations: {
            list: [
              {
                // @ts-expect-error
                actionPrefix: '',
                alarmNamePrefix: '',
                alias: '',
                dimensions: {
                  InstanceId: 'i-123',
                },
                enable: true,
                expression: '',
                iconColor: 'red',
                id: '',
                matchExact: true,
                metricName: 'CPUUtilization',
                name: 'test',
                namespace: 'AWS/EC2',
                period: '',
                prefixMatching: false,
                region: 'us-east-2',
                statistics: ['Minimum', 'Sum'],
              },
            ],
          },
          panels: [
            {
              collapsed: false,
              gridPos: {
                h: 1,
                w: 24,
                x: 0,
                y: 89,
              },
              id: 96,
              title: 'DynamoDB',
              type: 'row',
              panels: [
                {
                  gridPos: {
                    h: 8,
                    w: 12,
                    x: 0,
                    y: 0,
                  },
                  id: 4,
                  options: {
                    legend: {
                      calcs: [],
                      displayMode: 'list',
                      placement: 'bottom',
                    },
                    tooltipOptions: {
                      mode: 'single',
                    },
                  },
                  targets: [
                    {
                      alias: '',
                      dimensions: {
                        InstanceId: 'i-123',
                      },
                      expression: '',
                      id: '',
                      matchExact: true,
                      metricName: 'CPUUtilization',
                      namespace: 'AWS/EC2',
                      period: '',
                      refId: 'C',
                      region: 'default',
                      statistics: ['Average', 'Minimum', 'p12.21'],
                    },
                    {
                      alias: '',
                      dimensions: {
                        InstanceId: 'i-123',
                      },
                      expression: '',
                      hide: false,
                      id: '',
                      matchExact: true,
                      metricName: 'CPUUtilization',
                      namespace: 'AWS/EC2',
                      period: '',
                      refId: 'B',
                      region: 'us-east-2',
                      statistics: ['Sum'],
                    },
                  ],
                  title: 'Panel Title',
                  type: 'timeseries',
                },
                {
                  gridPos: {
                    h: 8,
                    w: 12,
                    x: 0,
                    y: 0,
                  },
                  id: 4,
                  options: {
                    legend: {
                      calcs: [],
                      displayMode: 'list',
                      placement: 'bottom',
                    },
                    tooltipOptions: {
                      mode: 'single',
                    },
                  },
                  targets: [
                    {
                      alias: '',
                      dimensions: {
                        InstanceId: 'i-123',
                      },
                      expression: '',
                      id: '',
                      matchExact: true,
                      metricName: 'CPUUtilization',
                      namespace: 'AWS/EC2',
                      period: '',
                      refId: 'A',
                      region: 'default',
                      statistics: ['Average'],
                    },
                    {
                      alias: '',
                      dimensions: {
                        InstanceId: 'i-123',
                      },
                      expression: '',
                      hide: false,
                      id: '',
                      matchExact: true,
                      metricName: 'CPUUtilization',
                      namespace: 'AWS/EC2',
                      period: '',
                      refId: 'B',
                      region: 'us-east-2',
                      statistics: ['Sum', 'Min'],
                    },
                  ],
                  title: 'Panel Title',
                  type: 'timeseries',
                },
              ],
            },
          ],
        });
        panel1Targets = nestedModel.panels[0].panels?.[0].targets;
        panel2Targets = nestedModel.panels[0].panels?.[1].targets;
      });

      it('multiple stats query should have been split into one query per stat', () => {
        expect(panel1Targets.length).toBe(4);
        expect(panel2Targets.length).toBe(3);
      });

      it('new stats query should get the right statistic', () => {
        expect(panel1Targets[0].statistic).toBe('Average');
        expect(panel1Targets[1].statistic).toBe('Sum');
        expect(panel1Targets[2].statistic).toBe('Minimum');
        expect(panel1Targets[3].statistic).toBe('p12.21');

        expect(panel2Targets[0].statistic).toBe('Average');
        expect(panel2Targets[1].statistic).toBe('Sum');
        expect(panel2Targets[2].statistic).toBe('Min');
      });

      it('new stats queries should be put in the end of the array', () => {
        expect(panel1Targets[0].refId).toBe('C');
        expect(panel1Targets[1].refId).toBe('B');
        expect(panel1Targets[2].refId).toBe('A');
        expect(panel1Targets[3].refId).toBe('D');

        expect(panel2Targets[0].refId).toBe('A');
        expect(panel2Targets[1].refId).toBe('B');
        expect(panel2Targets[2].refId).toBe('C');
      });
    });
  });

  describe('when migrating datasource to refs', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = new DashboardModel({
        templating: {
          list: [
            {
              type: 'query',
              name: 'var',
              options: [{ text: 'A', value: 'A' }],
              refresh: 0,
              // @ts-expect-error
              datasource: 'prom',
            },
          ],
        },
        panels: [
          {
            id: 1,
            // @ts-expect-error
            datasource: 'prom',
          },
          {
            id: 2,
            // @ts-expect-error
            datasource: null,
          },
          {
            id: 3,
            // @ts-expect-error
            datasource: MIXED_DATASOURCE_NAME,
            targets: [
              {
                datasource: 'prom',
              },
              {
                datasource: 'default',
              },
              {
                datasource: null,
              },
            ],
          },
          {
            type: 'row',
            id: 5,
            panels: [
              {
                id: 6,
                // @ts-expect-error
                datasource: 'prom',
              },
            ],
          },
          // @ts-expect-error
          {
            id: 7,
            datasource: { type: 'prometheus', uid: 'prom-uid' },
          },
          // @ts-expect-error
          {
            id: 8,
            datasource: { type: 'prometheus' },
          },
        ],
      });
    });

    it('should not update variable datasource props to refs', () => {
      expect(model.templating.list[0].datasource).toEqual('prom');
    });

    it('should update panel datasource props to refs for named data source', () => {
      expect(model.panels[0].datasource).toEqual({ type: 'prometheus', uid: 'prom-uid' });
    });

    it('should update panel datasource props to refs for default data source', () => {
      expect(model.panels[1].datasource).toEqual({ type: 'prometheus', uid: 'prom2-uid' });
    });

    it('should update panel datasource props to refs for mixed data source', () => {
      expect(model.panels[2].datasource).toEqual({ type: 'mixed', uid: MIXED_DATASOURCE_NAME });
    });

    it('should update target datasource props to refs', () => {
      expect(model.panels[2].targets[0].datasource).toEqual({ type: 'prometheus', uid: 'prom-uid' });
      expect(model.panels[2].targets[1].datasource).toEqual({ type: 'prometheus', uid: 'prom2-uid' });
      expect(model.panels[2].targets[2].datasource).toEqual({ type: 'prometheus', uid: 'prom2-uid' });
    });

    it('should update datasources in panels collapsed rows', () => {
      expect(model.panels[3].panels?.[0].datasource).toEqual({ type: 'prometheus', uid: 'prom-uid' });
    });

    it("should not migrate datasource if it's already a ref", () => {
      expect(model.panels[4].datasource).toEqual({ type: 'prometheus', uid: 'prom-uid' });
    });

    it("should not migrate datasource if it's already a ref with only a type", () => {
      expect(model.panels[5].datasource).toEqual({ type: 'prometheus' });
    });
  });

  describe('when fixing query and panel data source refs out of sync due to default data source change', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = new DashboardModel({
        templating: {
          list: [],
        },
        panels: [
          {
            id: 2,
            // @ts-expect-error
            datasource: null,
            targets: [
              {
                datasource: 'prom-not-default',
              },
            ],
          },
        ],
      });
    });

    it('should use data source on query level as source of truth', () => {
      expect(model.panels[0].targets[0]?.datasource?.uid).toEqual('prom-not-default-uid');
      expect(model.panels[0].datasource?.uid).toEqual('prom-not-default-uid');
    });
  });

  describe('when migrating time series axis visibility', () => {
    test('preserves x axis visibility', () => {
      const model = new DashboardModel({
        schemaVersion: 25,
        panels: [
          {
            type: 'timeseries',
            fieldConfig: {
              defaults: {
                custom: {
                  axisPlacement: 'hidden',
                },
              },
              overrides: [],
            },
          },
        ],
      });

      expect(model.panels[0].fieldConfig.overrides).toMatchInlineSnapshot(`
        [
          {
            "matcher": {
              "id": "byType",
              "options": "time",
            },
            "properties": [
              {
                "id": "custom.axisPlacement",
                "value": "auto",
              },
            ],
          },
        ]
      `);
    });
  });

  describe('when migrating default (null) datasource', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = new DashboardModel({
        templating: {
          list: [
            {
              type: 'query',
              name: 'var',
              options: [{ text: 'A', value: 'A' }],
              refresh: 0,
              datasource: null,
            },
          ],
        },
        annotations: {
          list: [
            // @ts-expect-error
            {
              datasource: null,
            },
            {
              // @ts-expect-error
              datasource: 'prom',
            },
          ],
        },
        panels: [
          {
            id: 2,
            // @ts-expect-error
            datasource: null,
            targets: [
              {
                datasource: null,
              },
            ],
          },
          // @ts-expect-error
          {
            id: 3,
            targets: [
              {
                refId: 'A',
              },
            ],
          },
        ],
        schemaVersion: 35,
      });
    });

    it('should set data source to current default', () => {
      expect(model.templating.list[0].datasource).toEqual({ type: 'prometheus', uid: 'prom2-uid' });
    });

    it('should migrate annotation null query to default ds', () => {
      expect(model.annotations.list[1].datasource).toEqual({ type: 'prometheus', uid: 'prom2-uid' });
    });

    it('should migrate annotation query to refs', () => {
      expect(model.annotations.list[2].datasource).toEqual({ type: 'prometheus', uid: 'prom-uid' });
    });

    it('should update panel datasource props to refs for named data source', () => {
      expect(model.panels[0].datasource).toEqual({ type: 'prometheus', uid: 'prom2-uid' });
    });

    it('should update panel datasource props even when undefined', () => {
      expect(model.panels[1].datasource).toEqual({ type: 'prometheus', uid: 'prom2-uid' });
    });

    it('should update target datasource props to refs', () => {
      expect(model.panels[0].targets[0].datasource).toEqual({ type: 'prometheus', uid: 'prom2-uid' });
    });
  });

  describe('when migrating default (null) datasource with panel with expressions queries', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = new DashboardModel({
        panels: [
          // @ts-expect-error
          {
            id: 2,
            targets: [
              {
                refId: 'A',
              },
              {
                refId: 'B',
                datasource: '__expr__',
              },
            ],
          },
        ],
        schemaVersion: 30,
      });
    });

    it('should update panel datasource props to default datasource', () => {
      expect(model.panels[0].datasource).toEqual({ type: 'prometheus', uid: 'prom2-uid' });
    });

    it('should update target datasource props to default data source', () => {
      expect(model.panels[0].targets[0].datasource).toEqual({ type: 'prometheus', uid: 'prom2-uid' });
    });
  });
});

describe('when generating the legend for a panel', () => {
  let model: DashboardModel;

  beforeEach(() => {
    model = new DashboardModel({
      panels: [
        // @ts-expect-error
        {
          id: 0,
          options: {
            legend: {
              displayMode: 'hidden',
              placement: 'bottom',
            },
            tooltipOptions: {
              mode: 'single',
            },
          },
        },
        // @ts-expect-error
        {
          id: 1,
          options: {
            legend: {
              displayMode: 'list',
              placement: 'right',
            },
            tooltipOptions: {
              mode: 'single',
            },
          },
        },
        // @ts-expect-error
        {
          id: 2,
          options: {
            legend: {
              displayMode: 'table',
              placement: 'bottom',
            },
            tooltipOptions: {
              mode: 'single',
            },
          },
        },
      ],
      schemaVersion: 30,
    });
  });

  it('should update displayMode = hidden to showLegend = false and displayMode = list', () => {
    expect(model.panels[0].options.legend).toEqual({ displayMode: 'list', showLegend: false, placement: 'bottom' });
  });

  it('should keep displayMode = list and update to showLegend = true', () => {
    expect(model.panels[1].options.legend).toEqual({ displayMode: 'list', showLegend: true, placement: 'right' });
  });

  it('should keep displayMode = table and update to showLegend = true', () => {
    expect(model.panels[2].options.legend).toEqual({ displayMode: 'table', showLegend: true, placement: 'bottom' });
  });

  it('should preserve the placement', () => {
    expect(model.panels[0].options.legend.placement).toEqual('bottom');
    expect(model.panels[1].options.legend.placement).toEqual('right');
    expect(model.panels[2].options.legend.placement).toEqual('bottom');
  });
});

describe('when migrating table cell display mode to cell options', () => {
  let model: DashboardModel;

  beforeEach(() => {
    model = new DashboardModel({
      panels: [
        {
          id: 1,
          type: 'table',
          fieldConfig: {
            defaults: {
              custom: {
                align: 'auto',
                displayMode: 'color-background',
                inspect: false,
              },
            },
          } as unknown as FieldConfigSource, // missing overrides on purpose
        },
        {
          id: 2,
          type: 'table',
          fieldConfig: {
            defaults: {
              custom: {
                align: 'auto',
                displayMode: 'color-background-solid',
                inspect: false,
              },
            },
            overrides: [],
          },
        },
        {
          id: 3,
          type: 'table',
          fieldConfig: {
            defaults: {
              custom: {
                align: 'auto',
                displayMode: 'lcd-gauge',
                inspect: false,
              },
            },
            overrides: [],
          },
        },
        {
          id: 4,
          type: 'table',
          fieldConfig: {
            defaults: {
              custom: {
                align: 'auto',
                displayMode: 'gradient-gauge',
                inspect: false,
              },
            },
            overrides: [],
          },
        },
        {
          id: 5,
          type: 'table',
          fieldConfig: {
            defaults: {
              custom: {
                align: 'auto',
                displayMode: 'basic',
                inspect: false,
              },
            },
            overrides: [],
          },
        },
        {
          id: 6,
          type: 'table',
          fieldConfig: {
            defaults: {
              custom: {
                align: 'auto',
                displayMode: 'auto',
                inspect: false,
              },
            },
            overrides: [
              {
                matcher: {
                  id: 'byName',
                  options: 'value',
                },
                properties: [
                  {
                    id: 'custom.displayMode',
                    value: 'color-background',
                  },
                ],
              },
              {
                matcher: {
                  id: 'byName',
                  options: 'value2',
                },
                properties: [
                  {
                    id: 'custom.displayMode',
                    value: 'lcd-gauge',
                  },
                ],
              },
              {
                matcher: {
                  id: 'byName',
                  options: 'value3',
                },
                properties: [
                  {
                    id: 'custom.displayMode',
                    value: 'gradient-gauge',
                  },
                ],
              },
              {
                matcher: {
                  id: 'byName',
                  options: 'value4',
                },
                properties: [
                  {
                    id: 'custom.align',
                    value: 'left',
                  },
                  {
                    id: 'custom.displayMode',
                    value: 'gradient-gauge',
                  },
                ],
              },
            ],
          },
        },
        {
          id: 7,
          type: 'table',
          fieldConfig: {
            defaults: {
              custom: {
                align: 'auto',
                displayMode: 'auto',
                inspect: false,
              },
            },
            overrides: [],
          },
        },
      ],
      schemaVersion: 37,
    });
  });

  it('should migrate gradient color background option to the new option format', () => {
    const cellOptions = model.panels[0].fieldConfig.defaults.custom.cellOptions;
    expect(cellOptions).toEqual({ type: 'color-background', mode: 'gradient' });
  });

  it('should migrate solid color background option to the new option format', () => {
    const cellOptions = model.panels[1].fieldConfig.defaults.custom.cellOptions;
    expect(cellOptions).toEqual({ type: 'color-background', mode: 'basic' });
  });

  it('should migrate LCD gauge option to the new option format', () => {
    const cellOptions = model.panels[2].fieldConfig.defaults.custom.cellOptions;
    expect(cellOptions).toEqual({ type: 'gauge', mode: 'lcd' });
  });

  it('should migrate gradient gauge option to the new option format', () => {
    const cellOptions = model.panels[3].fieldConfig.defaults.custom.cellOptions;
    expect(cellOptions).toEqual({ type: 'gauge', mode: 'gradient' });
  });

  it('should migrate basic gauge option to the new option format', () => {
    const cellOptions = model.panels[4].fieldConfig.defaults.custom.cellOptions;
    expect(cellOptions).toEqual({ type: 'gauge', mode: 'basic' });
  });

  it('should migrate from display mode to cell options in field overrides', () => {
    const fieldConfig = model.panels[5].fieldConfig;

    expect(fieldConfig.overrides[0].properties[0]).toEqual({
      id: 'custom.cellOptions',
      value: { type: 'color-background', mode: 'gradient' },
    });

    expect(fieldConfig.overrides[1].properties[0]).toEqual({
      id: 'custom.cellOptions',
      value: { type: 'gauge', mode: 'lcd' },
    });

    expect(fieldConfig.overrides[2].properties[0]).toEqual({
      id: 'custom.cellOptions',
      value: { type: 'gauge', mode: 'gradient' },
    });
  });

  it('should migrate from display mode to cell options in field overrides with other overrides present', () => {
    const override = model.panels[5].fieldConfig.overrides[3];
    expect(override.properties[1]).toEqual({ id: 'custom.cellOptions', value: { type: 'gauge', mode: 'gradient' } });
  });

  it('should migrate cell display modes without options', () => {
    const fieldConfig = model.panels[6].fieldConfig;
    expect(fieldConfig.defaults.custom.cellOptions).toEqual({ type: 'auto' });
  });
});

describe('when migrating variable refresh to on dashboard load', () => {
  let model: DashboardModel;

  beforeEach(() => {
    model = new DashboardModel({
      //@ts-ignore
      refresh: false,
    });
  });

  it('should migrate to empty string', () => {
    expect(model.refresh).toBe('');
  });
});

describe('when migrating time_options in timepicker', () => {
  let model: DashboardModel;

  it('should remove the property', () => {
    model = new DashboardModel({
      timepicker: {
        //@ts-expect-error
        time_options: ['5m', '15m', '1h', '6h', '12h', '24h', '2d', '7d', '30d'],
      },
    });

    expect(model.timepicker).not.toHaveProperty('time_options');
  });

  it('should not throw with empty timepicker', () => {
    //@ts-expect-error
    model = new DashboardModel({});

    expect(model.timepicker).not.toHaveProperty('time_options');
  });
});

describe('when migrating table panels at schema version 24', () => {
  let model: DashboardModel;

  afterEach(() => {
    model = new DashboardModel({
      panels: [],
      schemaVersion: 23,
    });
  });

  it('should migrate Angular table to table and set autoMigrateFrom', () => {
    model = new DashboardModel({
      panels: [
        {
          id: 1,
          type: 'table',
          // @ts-expect-error
          legend: true,
          styles: [{ thresholds: ['10', '20', '30'] }, { thresholds: ['100', '200', '300'] }],
          targets: [{ refId: 'A' }, {}],
        },
      ],
      schemaVersion: 23,
    });

    // Verify the panel was migrated to table, yes this is intentional
    // when autoMigrateOldPanels is enabled, we should migrate to table
    // and add the autoMigrateFrom property
    expect(model.panels[0].type).toBe('table');
    // Verify autoMigrateFrom was set
    expect(model.panels[0].autoMigrateFrom).toBe('table-old');
  });

  it('should not migrate Angular table without styles', () => {
    model = new DashboardModel({
      panels: [
        {
          id: 1,
          type: 'table',
          // No styles property
        },
      ],
      schemaVersion: 23,
    });

    // Verify the panel was not migrated
    expect(model.panels[0].type).toBe('table');
    expect(model.panels[0].autoMigrateFrom).toBeUndefined();
  });

  it('should not migrate React table (table2)', () => {
    model = new DashboardModel({
      panels: [
        {
          id: 1,
          type: 'table2',
        },
      ],
      schemaVersion: 23,
    });

    // Verify the panel was not migrated
    expect(model.panels[0].type).toBe('table2');
    expect(model.panels[0].autoMigrateFrom).toBeUndefined();
  });
});

function createRow(options: any, panelDescriptions: any[]) {
  const PANEL_HEIGHT_STEP = GRID_CELL_HEIGHT + GRID_CELL_VMARGIN;
  const { collapse, showTitle, title, repeat, repeatIteration } = options;
  let { height } = options;
  height = height * PANEL_HEIGHT_STEP;
  const panels: any[] = [];
  each(panelDescriptions, (panelDesc) => {
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
  return map(dashboard.panels, (panel: PanelModel) => {
    return panel.gridPos;
  });
}
