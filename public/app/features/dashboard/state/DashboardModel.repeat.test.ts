import { compact, flattenDeep, map, uniq } from 'lodash';

import { DashboardPanelsChangedEvent } from 'app/types/events';

import { getDashboardModel } from '../../../../test/helpers/getDashboardModel';
import { DashboardModel } from '../state/DashboardModel';

jest.mock('app/core/services/context_srv', () => ({}));

describe('given dashboard with panel repeat', () => {
  let dashboard: DashboardModel;

  beforeEach(() => {
    const dashboardJSON = {
      panels: [
        { id: 1, type: 'row', gridPos: { x: 0, y: 0, h: 1, w: 24 } },
        { id: 2, repeat: 'apps', repeatDirection: 'h', gridPos: { x: 0, y: 1, h: 2, w: 8 } },
      ],
      templating: {
        list: [
          {
            name: 'apps',
            type: 'custom',
            current: {
              text: 'se1, se2, se3',
              value: ['se1', 'se2', 'se3'],
            },
            options: [
              { text: 'se1', value: 'se1', selected: true },
              { text: 'se2', value: 'se2', selected: true },
              { text: 'se3', value: 'se3', selected: true },
              { text: 'se4', value: 'se4', selected: false },
            ],
          },
        ],
      },
    };
    dashboard = getDashboardModel(dashboardJSON);
    dashboard.processRepeats();
  });

  it('should repeat panels when row is expanding', () => {
    expect(dashboard.panels.length).toBe(4);

    // toggle row
    dashboard.toggleRow(dashboard.panels[0]);
    expect(dashboard.panels.length).toBe(1);

    // change variable
    dashboard.templating.list[0].options[2].selected = false;
    dashboard.templating.list[0].current = {
      text: 'se1, se2',
      value: ['se1', 'se2'],
    };

    // toggle row back
    dashboard.toggleRow(dashboard.panels[0]);
    expect(dashboard.panels.length).toBe(3);
  });
});

describe('given dashboard with panel repeat in horizontal direction', () => {
  let dashboard: any;

  beforeEach(() => {
    const dashboardJSON = {
      panels: [
        {
          id: 2,
          repeat: 'apps',
          repeatDirection: 'h',
          gridPos: { x: 0, y: 0, h: 2, w: 24 },
        },
      ],
      templating: {
        list: [
          {
            name: 'apps',
            type: 'custom',
            current: {
              text: 'se1, se2, se3',
              value: ['se1', 'se2', 'se3'],
            },
            options: [
              { text: 'se1', value: 'se1', selected: true },
              { text: 'se2', value: 'se2', selected: true },
              { text: 'se3', value: 'se3', selected: true },
              { text: 'se4', value: 'se4', selected: false },
            ],
          },
        ],
      },
    };
    dashboard = getDashboardModel(dashboardJSON);
    dashboard.processRepeats();
  });

  it('should repeat panel 3 times', () => {
    expect(dashboard.panels.length).toBe(3);
  });

  it('should mark panel repeated', () => {
    expect(dashboard.panels[0].repeat).toBe('apps');
    expect(dashboard.panels[1].repeatPanelId).toBe(2);
  });

  it('should set scopedVars on panels', () => {
    expect(dashboard.panels[0].scopedVars.apps.value).toBe('se1');
    expect(dashboard.panels[1].scopedVars.apps.value).toBe('se2');
    expect(dashboard.panels[2].scopedVars.apps.value).toBe('se3');
  });

  it('should place on first row and adjust width so all fit', () => {
    expect(dashboard.panels[0].gridPos).toMatchObject({
      x: 0,
      y: 0,
      h: 2,
      w: 8,
    });
    expect(dashboard.panels[1].gridPos).toMatchObject({
      x: 8,
      y: 0,
      h: 2,
      w: 8,
    });
    expect(dashboard.panels[2].gridPos).toMatchObject({
      x: 16,
      y: 0,
      h: 2,
      w: 8,
    });
  });

  describe('After a second iteration', () => {
    beforeEach(() => {
      dashboard.panels[0].fill = 10;
      dashboard.processRepeats();
    });

    it('reused panel should copy properties from source', () => {
      expect(dashboard.panels[1].fill).toBe(10);
    });

    it('should have same panel count', () => {
      expect(dashboard.panels.length).toBe(3);
    });
  });

  describe('After a second iteration with different variable', () => {
    beforeEach(() => {
      dashboard.templating.list.push({
        name: 'server',
        current: { text: 'se1, se2, se3', value: ['se1'] },
        options: [{ text: 'se1', value: 'se1', selected: true }],
      });
      dashboard.panels[0].repeat = 'server';
      dashboard.processRepeats();
    });

    it('should remove scopedVars value for last variable', () => {
      expect(dashboard.panels[0].scopedVars.apps).toBe(undefined);
    });

    it('should have new variable value in scopedVars', () => {
      expect(dashboard.panels[0].scopedVars.server.value).toBe('se1');
    });
  });

  describe('After a second iteration and selected values reduced', () => {
    beforeEach(() => {
      dashboard.templating.list[0].options[1].selected = false;
      dashboard.processRepeats();
    });

    it('should clean up repeated panel', () => {
      expect(dashboard.panels.length).toBe(2);
    });
  });

  describe('After a second iteration and panel repeat is turned off', () => {
    beforeEach(() => {
      dashboard.panels[0].repeat = null;
      dashboard.processRepeats();
    });

    it('should clean up repeated panel', () => {
      expect(dashboard.panels.length).toBe(1);
    });

    it('should remove scoped vars from reused panel', () => {
      expect(dashboard.panels[0].scopedVars).toBe(undefined);
    });
  });
});

describe('given dashboard with panel repeat in vertical direction', () => {
  let dashboard: any;

  beforeEach(() => {
    const dashboardJSON = {
      panels: [
        { id: 1, type: 'row', gridPos: { x: 0, y: 0, h: 1, w: 24 } },
        { id: 2, repeat: 'apps', repeatDirection: 'v', gridPos: { x: 5, y: 1, h: 2, w: 8 } },
        { id: 3, type: 'row', gridPos: { x: 0, y: 3, h: 1, w: 24 } },
      ],
      templating: {
        list: [
          {
            name: 'apps',
            type: 'custom',
            current: {
              text: 'se1, se2, se3',
              value: ['se1', 'se2', 'se3'],
            },
            options: [
              { text: 'se1', value: 'se1', selected: true },
              { text: 'se2', value: 'se2', selected: true },
              { text: 'se3', value: 'se3', selected: true },
              { text: 'se4', value: 'se4', selected: false },
            ],
          },
        ],
      },
    };
    dashboard = getDashboardModel(dashboardJSON);
    dashboard.processRepeats();
  });

  it('should place on items on top of each other and keep witdh', () => {
    expect(dashboard.panels[0].gridPos).toMatchObject({ x: 0, y: 0, h: 1, w: 24 }); // first row

    expect(dashboard.panels[1].gridPos).toMatchObject({ x: 5, y: 1, h: 2, w: 8 });
    expect(dashboard.panels[2].gridPos).toMatchObject({ x: 5, y: 3, h: 2, w: 8 });
    expect(dashboard.panels[3].gridPos).toMatchObject({ x: 5, y: 5, h: 2, w: 8 });

    expect(dashboard.panels[4].gridPos).toMatchObject({ x: 0, y: 7, h: 1, w: 24 }); // last row
  });
});

describe('given dashboard with row repeat and panel repeat in horizontal direction', () => {
  let dashboard: any, dashboardJSON: any;

  beforeEach(() => {
    dashboardJSON = {
      panels: [
        { id: 1, type: 'row', repeat: 'region', gridPos: { x: 0, y: 0, h: 1, w: 24 } },
        { id: 2, type: 'graph', repeat: 'app', gridPos: { x: 0, y: 1, h: 2, w: 6 } },
      ],
      templating: {
        list: [
          {
            name: 'region',
            type: 'custom',
            current: {
              text: 'reg1, reg2',
              value: ['reg1', 'reg2'],
            },
            options: [
              { text: 'reg1', value: 'reg1', selected: true },
              { text: 'reg2', value: 'reg2', selected: true },
            ],
          },
          {
            name: 'app',
            type: 'custom',
            current: {
              text: 'se1, se2, se3, se4, se5, se6',
              value: ['se1', 'se2', 'se3', 'se4', 'se5', 'se6'],
            },
            options: [
              { text: 'se1', value: 'se1', selected: true },
              { text: 'se2', value: 'se2', selected: true },
              { text: 'se3', value: 'se3', selected: true },
              { text: 'se4', value: 'se4', selected: true },
              { text: 'se5', value: 'se5', selected: true },
              { text: 'se6', value: 'se6', selected: true },
            ],
          },
        ],
      },
    };
    dashboard = getDashboardModel(dashboardJSON);
    dashboard.processRepeats(false);
  });

  it('should panels in self row', () => {
    const panelTypes = map(dashboard.panels, 'type');
    expect(panelTypes).toEqual([
      'row',
      'graph',
      'graph',
      'graph',
      'graph',
      'graph',
      'graph',
      'row',
      'graph',
      'graph',
      'graph',
      'graph',
      'graph',
      'graph',
    ]);
  });

  it('should be placed in their places', () => {
    expect(dashboard.panels[0].gridPos).toMatchObject({ x: 0, y: 0, h: 1, w: 24 }); // 1st row

    expect(dashboard.panels[1].gridPos).toMatchObject({ x: 0, y: 1, h: 2, w: 6 });
    expect(dashboard.panels[2].gridPos).toMatchObject({ x: 6, y: 1, h: 2, w: 6 });
    expect(dashboard.panels[3].gridPos).toMatchObject({ x: 12, y: 1, h: 2, w: 6 });
    expect(dashboard.panels[4].gridPos).toMatchObject({ x: 18, y: 1, h: 2, w: 6 });
    expect(dashboard.panels[5].gridPos).toMatchObject({ x: 0, y: 3, h: 2, w: 6 }); // next row
    expect(dashboard.panels[6].gridPos).toMatchObject({ x: 6, y: 3, h: 2, w: 6 });

    expect(dashboard.panels[7].gridPos).toMatchObject({ x: 0, y: 5, h: 1, w: 24 });

    expect(dashboard.panels[8].gridPos).toMatchObject({ x: 0, y: 6, h: 2, w: 6 }); // 2nd row
    expect(dashboard.panels[9].gridPos).toMatchObject({ x: 6, y: 6, h: 2, w: 6 });
    expect(dashboard.panels[10].gridPos).toMatchObject({ x: 12, y: 6, h: 2, w: 6 });
    expect(dashboard.panels[11].gridPos).toMatchObject({ x: 18, y: 6, h: 2, w: 6 }); // next row
    expect(dashboard.panels[12].gridPos).toMatchObject({ x: 0, y: 8, h: 2, w: 6 });
    expect(dashboard.panels[13].gridPos).toMatchObject({ x: 6, y: 8, h: 2, w: 6 });
  });
});

describe('given dashboard with row repeat', () => {
  let dashboard: any, dashboardJSON: any;

  beforeEach(() => {
    dashboardJSON = {
      panels: [
        {
          id: 1,
          type: 'row',
          gridPos: { x: 0, y: 0, h: 1, w: 24 },
          repeat: 'apps',
        },
        { id: 2, type: 'graph', gridPos: { x: 0, y: 1, h: 1, w: 6 } },
        { id: 3, type: 'graph', gridPos: { x: 6, y: 1, h: 1, w: 6 } },
        { id: 4, type: 'row', gridPos: { x: 0, y: 2, h: 1, w: 24 } },
        { id: 5, type: 'graph', gridPos: { x: 0, y: 3, h: 1, w: 12 } },
      ],
      templating: {
        list: [
          {
            name: 'apps',
            type: 'custom',
            current: {
              text: 'se1, se2',
              value: ['se1', 'se2'],
            },
            options: [
              { text: 'se1', value: 'se1', selected: true },
              { text: 'se2', value: 'se2', selected: true },
              { text: 'se3', value: 'se3', selected: false },
            ],
          },
        ],
      },
    };
    dashboard = getDashboardModel(dashboardJSON);
    dashboard.processRepeats();
  });

  it('should not repeat only row', () => {
    const panelTypes = map(dashboard.panels, 'type');
    expect(panelTypes).toEqual(['row', 'graph', 'graph', 'row', 'graph', 'graph', 'row', 'graph']);
  });

  it('should set scopedVars for each panel', () => {
    dashboardJSON.templating.list[0].options[2].selected = true;
    dashboard = getDashboardModel(dashboardJSON);
    dashboard.processRepeats();

    expect(dashboard.panels[1].scopedVars).toMatchObject({
      apps: { text: 'se1', value: 'se1' },
    });
    expect(dashboard.panels[4].scopedVars).toMatchObject({
      apps: { text: 'se2', value: 'se2' },
    });

    const scopedVars = compact(
      map(dashboard.panels, (panel) => {
        return panel.scopedVars ? panel.scopedVars.apps.value : null;
      })
    );

    expect(scopedVars).toEqual(['se1', 'se1', 'se1', 'se2', 'se2', 'se2', 'se3', 'se3', 'se3']);
  });

  it('should repeat only configured row', () => {
    expect(dashboard.panels[6].id).toBe(4);
    expect(dashboard.panels[7].id).toBe(5);
  });

  it('should repeat only row if it is collapsed', () => {
    dashboardJSON.panels = [
      {
        id: 1,
        type: 'row',
        collapsed: true,
        repeat: 'apps',
        gridPos: { x: 0, y: 0, h: 1, w: 24 },
        panels: [
          { id: 2, type: 'graph', gridPos: { x: 0, y: 1, h: 1, w: 6 } },
          { id: 3, type: 'graph', gridPos: { x: 6, y: 1, h: 1, w: 6 } },
        ],
      },
      { id: 4, type: 'row', gridPos: { x: 0, y: 1, h: 1, w: 24 } },
      { id: 5, type: 'graph', gridPos: { x: 0, y: 2, h: 1, w: 12 } },
    ];
    dashboard = getDashboardModel(dashboardJSON);
    dashboard.processRepeats();

    const panelTypes = map(dashboard.panels, 'type');
    expect(panelTypes).toEqual(['row', 'row', 'row', 'graph']);
    expect(dashboard.panels[0].panels).toHaveLength(2);
    expect(dashboard.panels[1].panels).toHaveLength(2);
  });

  it('should properly repeat multiple rows', () => {
    dashboardJSON.panels = [
      {
        id: 1,
        type: 'row',
        gridPos: { x: 0, y: 0, h: 1, w: 24 },
        repeat: 'apps',
      }, // repeat
      { id: 2, type: 'graph', gridPos: { x: 0, y: 1, h: 1, w: 6 } },
      { id: 3, type: 'graph', gridPos: { x: 6, y: 1, h: 1, w: 6 } },
      { id: 4, type: 'row', gridPos: { x: 0, y: 2, h: 1, w: 24 } }, // don't touch
      { id: 5, type: 'graph', gridPos: { x: 0, y: 3, h: 1, w: 12 } },
      {
        id: 6,
        type: 'row',
        gridPos: { x: 0, y: 4, h: 1, w: 24 },
        repeat: 'hosts',
      }, // repeat
      { id: 7, type: 'graph', gridPos: { x: 0, y: 5, h: 1, w: 6 } },
      { id: 8, type: 'graph', gridPos: { x: 6, y: 5, h: 1, w: 6 } },
    ];
    dashboardJSON.templating.list.push({
      name: 'hosts',
      type: 'custom',
      current: {
        text: 'backend01, backend02',
        value: ['backend01', 'backend02'],
      },
      options: [
        { text: 'backend01', value: 'backend01', selected: true },
        { text: 'backend02', value: 'backend02', selected: true },
        { text: 'backend03', value: 'backend03', selected: false },
      ],
    });
    dashboard = getDashboardModel(dashboardJSON);
    dashboard.processRepeats();

    const panelTypes = map(dashboard.panels, 'type');
    expect(panelTypes).toEqual([
      'row',
      'graph',
      'graph',
      'row',
      'graph',
      'graph',
      'row',
      'graph',
      'row',
      'graph',
      'graph',
      'row',
      'graph',
      'graph',
    ]);

    expect(dashboard.panels[0].scopedVars['apps'].value).toBe('se1');
    expect(dashboard.panels[1].scopedVars['apps'].value).toBe('se1');
    expect(dashboard.panels[3].scopedVars['apps'].value).toBe('se2');
    expect(dashboard.panels[4].scopedVars['apps'].value).toBe('se2');
    expect(dashboard.panels[8].scopedVars['hosts'].value).toBe('backend01');
    expect(dashboard.panels[9].scopedVars['hosts'].value).toBe('backend01');
    expect(dashboard.panels[11].scopedVars['hosts'].value).toBe('backend02');
    expect(dashboard.panels[12].scopedVars['hosts'].value).toBe('backend02');
  });

  it('should assign unique ids for repeated panels', () => {
    dashboardJSON.panels = [
      {
        id: 1,
        type: 'row',
        collapsed: true,
        repeat: 'apps',
        gridPos: { x: 0, y: 0, h: 1, w: 24 },
        panels: [
          { id: 2, type: 'graph', gridPos: { x: 0, y: 1, h: 1, w: 6 } },
          { id: 3, type: 'graph', gridPos: { x: 6, y: 1, h: 1, w: 6 } },
        ],
      },
      { id: 4, type: 'row', gridPos: { x: 0, y: 1, h: 1, w: 24 } },
      { id: 5, type: 'graph', gridPos: { x: 0, y: 2, h: 1, w: 12 } },
    ];
    dashboard = getDashboardModel(dashboardJSON);
    dashboard.processRepeats();

    const panelIds = flattenDeep(
      map(dashboard.panels, (panel) => {
        let ids = [];
        if (panel.panels && panel.panels.length) {
          ids = map(panel.panels, 'id');
        }
        ids.push(panel.id);
        return ids;
      })
    );
    expect(panelIds.length).toEqual(uniq(panelIds).length);
  });

  it('should place new panels in proper order', () => {
    dashboardJSON.panels = [
      { id: 1, type: 'row', gridPos: { x: 0, y: 0, h: 1, w: 24 }, repeat: 'apps' },
      { id: 2, type: 'graph', gridPos: { x: 0, y: 1, h: 3, w: 12 } },
      { id: 3, type: 'graph', gridPos: { x: 6, y: 1, h: 4, w: 12 } },
      { id: 4, type: 'graph', gridPos: { x: 0, y: 5, h: 2, w: 12 } },
    ];
    dashboard = getDashboardModel(dashboardJSON);
    dashboard.processRepeats();

    const panelTypes = map(dashboard.panels, 'type');
    expect(panelTypes).toEqual(['row', 'graph', 'graph', 'graph', 'row', 'graph', 'graph', 'graph']);
    const panelYPositions = map(dashboard.panels, (p) => p.gridPos.y);
    expect(panelYPositions).toEqual([0, 1, 1, 5, 7, 8, 8, 12]);
  });
});

describe('given dashboard with row and panel repeat', () => {
  let dashboard: DashboardModel, dashboardJSON: any;

  beforeEach(() => {
    dashboardJSON = {
      panels: [
        {
          id: 1,
          type: 'row',
          repeat: 'region',
          gridPos: { x: 0, y: 0, h: 1, w: 24 },
        },
        { id: 2, type: 'graph', repeat: 'app', gridPos: { x: 0, y: 1, h: 1, w: 6 } },
      ],
      templating: {
        list: [
          {
            name: 'region',
            type: 'custom',
            current: {
              text: 'reg1, reg2',
              value: ['reg1', 'reg2'],
            },
            options: [
              { text: 'reg1', value: 'reg1', selected: true },
              { text: 'reg2', value: 'reg2', selected: true },
              { text: 'reg3', value: 'reg3', selected: false },
            ],
          },
          {
            name: 'app',
            type: 'custom',
            current: {
              text: 'se1, se2',
              value: ['se1', 'se2'],
            },
            options: [
              { text: 'se1', value: 'se1', selected: true },
              { text: 'se2', value: 'se2', selected: true },
              { text: 'se3', value: 'se3', selected: false },
            ],
          },
        ],
      },
    };
    dashboard = getDashboardModel(dashboardJSON);
    dashboard.processRepeats();
  });

  it('should repeat row and panels for each row', () => {
    const panelTypes = map(dashboard.panels, 'type');
    expect(panelTypes).toEqual(['row', 'graph', 'graph', 'row', 'graph', 'graph']);
  });

  it('Row repeat should create new panel keys every repeat cycle', () => {
    // This is the first repeated panel inside the second repeated row
    // Since we create a new panel model every time (and new panel events bus) we need to create a new key here to trigger a re-mount & re-subscribe
    const key1 = dashboard.panels[3].key;
    dashboard.processRepeats();
    expect(key1).not.toEqual(dashboard.panels[3].key);
  });

  it('should clean up old repeated panels', () => {
    dashboardJSON.panels = [
      {
        id: 1,
        type: 'row',
        repeat: 'region',
        gridPos: { x: 0, y: 0, h: 1, w: 24 },
      },
      { id: 2, type: 'graph', repeat: 'app', gridPos: { x: 0, y: 1, h: 1, w: 6 } },
      { id: 3, type: 'graph', repeatPanelId: 2, repeatIteration: 101, gridPos: { x: 7, y: 1, h: 1, w: 6 } },
      {
        id: 11,
        type: 'row',
        repeatPanelId: 1,
        repeatIteration: 101,
        gridPos: { x: 0, y: 2, h: 1, w: 24 },
      },
      { id: 12, type: 'graph', repeatPanelId: 2, repeatIteration: 101, gridPos: { x: 0, y: 3, h: 1, w: 6 } },
    ];

    let panelChangedEvents: DashboardPanelsChangedEvent[] = [];
    dashboard = getDashboardModel(dashboardJSON);
    dashboard.events.subscribe(DashboardPanelsChangedEvent, (evt) => panelChangedEvents.push(evt));
    dashboard.processRepeats();

    const panelTypes = map(dashboard.panels, 'type');
    expect(panelTypes).toEqual(['row', 'graph', 'graph', 'row', 'graph', 'graph']);
    // Make sure only a single DashboardPanelsChangedEvent event is emitted when processing repeats
    expect(panelChangedEvents.length).toBe(1);
  });

  it('should set scopedVars for each row', () => {
    dashboard = getDashboardModel(dashboardJSON);
    dashboard.processRepeats();

    expect(dashboard.panels[0].scopedVars).toMatchObject({
      region: { text: 'reg1', value: 'reg1' },
    });
    expect(dashboard.panels[3].scopedVars).toMatchObject({
      region: { text: 'reg2', value: 'reg2' },
    });
  });

  it('should set panel-repeat variable for each panel', () => {
    dashboard = getDashboardModel(dashboardJSON);
    dashboard.processRepeats();

    expect(dashboard.panels[1].scopedVars).toMatchObject({
      app: { text: 'se1', value: 'se1' },
    });
    expect(dashboard.panels[2].scopedVars).toMatchObject({
      app: { text: 'se2', value: 'se2' },
    });

    expect(dashboard.panels[4].scopedVars).toMatchObject({
      app: { text: 'se1', value: 'se1' },
    });
    expect(dashboard.panels[5].scopedVars).toMatchObject({
      app: { text: 'se2', value: 'se2' },
    });
  });

  it('should set row-repeat variable for each panel', () => {
    dashboard = getDashboardModel(dashboardJSON);
    dashboard.processRepeats();

    expect(dashboard.panels[1].scopedVars).toMatchObject({
      region: { text: 'reg1', value: 'reg1' },
    });
    expect(dashboard.panels[2].scopedVars).toMatchObject({
      region: { text: 'reg1', value: 'reg1' },
    });

    expect(dashboard.panels[4].scopedVars).toMatchObject({
      region: { text: 'reg2', value: 'reg2' },
    });
    expect(dashboard.panels[5].scopedVars).toMatchObject({
      region: { text: 'reg2', value: 'reg2' },
    });
  });

  it('should repeat panels when row is expanding', () => {
    dashboard = getDashboardModel(dashboardJSON);
    dashboard.processRepeats();

    expect(dashboard.panels.length).toBe(6);

    // toggle row
    dashboard.toggleRow(dashboard.panels[0]);
    dashboard.toggleRow(dashboard.panels[1]);
    expect(dashboard.panels.length).toBe(2);

    // change variable
    dashboard.templating.list[1].current.value = ['se1', 'se2', 'se3'];

    // toggle row back
    dashboard.toggleRow(dashboard.panels[1]);
    expect(dashboard.panels.length).toBe(4);
  });
});

// fix for https://github.com/grafana/grafana/issues/38805
describe('given dashboard with row and repeats on same row', () => {
  it('should set correct gridPos when row is expanding', () => {
    const ROW1 = 1;
    const GAUGE1 = 2;
    const REPEAT1 = 3;
    const GAUGE2 = 4;
    const REPEAT2 = 5;
    const GAUGE3 = 6;
    const dashboardJSON = {
      panels: [
        {
          collapsed: true,
          datasource: null,
          gridPos: { h: 1, w: 24, x: 0, y: 0 },
          id: ROW1,
          panels: [
            { gridPos: { h: 5, w: 4, x: 0, y: 1 }, id: GAUGE1, type: 'gauge' },
            {
              gridPos: { h: 5, w: 4, x: 4, y: 1 },
              id: REPEAT1,
              repeat: 'abc',
              repeatDirection: 'v',
              type: 'gauge',
            },
            { gridPos: { h: 5, w: 4, x: 8, y: 1 }, id: GAUGE2, type: 'gauge' },
            {
              gridPos: { h: 5, w: 4, x: 12, y: 1 },
              id: REPEAT2,
              repeat: 'abc',
              repeatDirection: 'v',
              type: 'gauge',
            },
            { gridPos: { h: 5, w: 4, x: 16, y: 1 }, id: GAUGE3, type: 'gauge' },
          ],
          title: 'Row title',
          type: 'row',
        },
      ],
      templating: {
        list: [
          {
            allValue: null,
            current: { selected: true, text: ['All'], value: ['$__all'] },
            includeAll: true,
            name: 'abc',
            options: [
              { selected: true, text: 'All', value: '$__all' },
              { selected: false, text: 'a', value: 'a' },
              { selected: false, text: 'b', value: 'b' },
              { selected: false, text: 'c', value: 'c' },
              { selected: false, text: 'd', value: 'd' },
              { selected: false, text: 'e', value: 'e' },
              { selected: false, text: 'f', value: 'f' },
              { selected: false, text: 'g', value: 'g' },
            ],
            type: 'custom',
          },
        ],
      },
    };
    const dashboard = getDashboardModel(dashboardJSON);

    // toggle row
    dashboard.toggleRow(dashboard.panels[0]);

    // correct number of panels
    expect(dashboard.panels.length).toBe(18);

    // check row
    const rowPanel = dashboard.panels.find((p) => p.id === ROW1);
    expect(rowPanel?.gridPos).toEqual({ x: 0, y: 0, w: 24, h: 1 });

    // check the gridPos of all the top level panels that are next to each other
    const firstGauge = dashboard.panels.find((p) => p.id === GAUGE1);
    const secondGauge = dashboard.panels.find((p) => p.id === GAUGE2);
    const thirdGauge = dashboard.panels.find((p) => p.id === GAUGE3);
    const firstVerticalRepeatingGauge = dashboard.panels.find((p) => p.id === REPEAT1);
    const secondVerticalRepeatingGauge = dashboard.panels.find((p) => p.id === REPEAT2);
    expect(firstGauge?.gridPos).toEqual({ x: 0, y: 1, w: 4, h: 5 });
    expect(secondGauge?.gridPos).toEqual({ x: 8, y: 1, w: 4, h: 5 });
    expect(thirdGauge?.gridPos).toEqual({ x: 16, y: 1, w: 4, h: 5 });
    expect(firstVerticalRepeatingGauge?.gridPos).toEqual({ x: 4, y: 1, w: 4, h: 5 });
    expect(secondVerticalRepeatingGauge?.gridPos).toEqual({ x: 12, y: 1, w: 4, h: 5 });

    // check the gridPos of all first vertical repeats children
    const { x, h, w } = firstVerticalRepeatingGauge!.gridPos;
    expect(dashboard.panels[6].gridPos).toEqual({ x, y: 6, w, h });
    expect(dashboard.panels[8].gridPos).toEqual({ x, y: 11, w, h });
    expect(dashboard.panels[10].gridPos).toEqual({ x, y: 16, w, h });
    expect(dashboard.panels[12].gridPos).toEqual({ x, y: 21, w, h });
    expect(dashboard.panels[14].gridPos).toEqual({ x, y: 26, w, h });
    expect(dashboard.panels[16].gridPos).toEqual({ x, y: 31, w, h });

    // check the gridPos of all second vertical repeats children
    const { x: x2, h: h2, w: w2 } = secondVerticalRepeatingGauge!.gridPos;
    expect(dashboard.panels[7].gridPos).toEqual({ x: x2, y: 6, w: w2, h: h2 });
    expect(dashboard.panels[9].gridPos).toEqual({ x: x2, y: 11, w: w2, h: h2 });
    expect(dashboard.panels[11].gridPos).toEqual({ x: x2, y: 16, w: w2, h: h2 });
    expect(dashboard.panels[13].gridPos).toEqual({ x: x2, y: 21, w: w2, h: h2 });
    expect(dashboard.panels[15].gridPos).toEqual({ x: x2, y: 26, w: w2, h: h2 });
    expect(dashboard.panels[17].gridPos).toEqual({ x: x2, y: 31, w: w2, h: h2 });
  });
});
