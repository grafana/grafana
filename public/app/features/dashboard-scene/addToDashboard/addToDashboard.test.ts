import { dateTime } from '@grafana/data';
import store from 'app/core/store';

import { addToDashboard } from './addToDashboard';

describe('addToDashboard', () => {
  let spy: jest.SpyInstance;

  beforeAll(() => {
    spy = jest.spyOn(store, 'setObject');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('Should save dashboard with new panel in local storage', () => {
    addToDashboard({
      panel: {
        type: 'table',
        gridPos: { x: 0, y: 0, w: 12, h: 12 },
        options: { showHeader: true },
      },
    });

    const panel = spy.mock.calls[0][1].dashboard.panels[0];
    expect(panel.type).toEqual('table');
    expect(panel.options).toEqual({ showHeader: true });
  });

  it('Correct time range is used', () => {
    addToDashboard({
      panel: { type: 'table' },
      timeRange: { from: dateTime(), to: dateTime(), raw: { from: 'now-5m', to: 'now' } },
    });

    const dashboard = spy.mock.calls[0][1].dashboard;
    expect(dashboard.time.from).toEqual('now-5m');
    expect(dashboard.time.to).toEqual('now');
  });
});
