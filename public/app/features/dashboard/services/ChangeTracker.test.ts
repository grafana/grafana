import { ChangeTracker } from './ChangeTracker';
import { DashboardModel } from '../state/DashboardModel';
import { PanelModel } from '../state/PanelModel';

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    user: { orgId: 1 },
  },
}));

describe('ChangeTracker', () => {
  let tracker: ChangeTracker;
  let dash: any;
  let original: any;

  beforeEach(() => {
    dash = new DashboardModel({
      refresh: false,
      panels: [
        {
          id: 1,
          type: 'graph',
          gridPos: { x: 0, y: 0, w: 24, h: 6 },
          legend: { sortDesc: false },
        },
        {
          id: 2,
          type: 'row',
          gridPos: { x: 0, y: 6, w: 24, h: 2 },
          collapsed: true,
          panels: [
            { id: 3, type: 'graph', gridPos: { x: 0, y: 6, w: 12, h: 2 } },
            { id: 4, type: 'graph', gridPos: { x: 12, y: 6, w: 12, h: 2 } },
          ],
        },
        { id: 5, type: 'row', gridPos: { x: 0, y: 6, w: 1, h: 1 } },
      ],
    });

    tracker = new ChangeTracker();
    original = dash.getSaveModelClone();
  });

  it('No changes should not have changes', () => {
    expect(tracker.hasChanges(dash, original)).toBe(false);
  });

  it('Simple change should be registered', () => {
    dash.title = 'google';
    expect(tracker.hasChanges(dash, original)).toBe(true);
  });

  it('Should ignore a lot of changes', () => {
    dash.time = { from: '1h' };
    dash.refresh = true;
    dash.schemaVersion = 10;
    expect(tracker.hasChanges(dash, original)).toBe(false);
  });

  it('Should ignore .iteration changes', () => {
    dash.iteration = new Date().getTime() + 1;
    expect(tracker.hasChanges(dash, original)).toBe(false);
  });

  it('Should ignore row collapse change', () => {
    dash.toggleRow(dash.panels[1]);
    expect(tracker.hasChanges(dash, original)).toBe(false);
  });

  it('Should ignore panel legend changes', () => {
    dash.panels[0].legend.sortDesc = true;
    dash.panels[0].legend.sort = 'avg';
    expect(tracker.hasChanges(dash, original)).toBe(false);
  });

  it('Should ignore panel repeats', () => {
    dash.panels.push(new PanelModel({ repeatPanelId: 10 }));
    expect(tracker.hasChanges(dash, original)).toBe(false);
  });
});
