import { MutableDataFrame } from '@grafana/data';
import { DataQuery, defaultDashboard } from '@grafana/schema';
import * as api from 'app/features/dashboard/state/initDashboard';

import { addToDashboard } from './addToDashboard';

describe('addToDashboard', () => {
  let spy: jest.SpyInstance;

  beforeAll(() => {
    spy = jest.spyOn(api, 'setDashboardToFetchFromLocalStorage');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('Should save dashboard with new panel in local storage', async () => {
    await addToDashboard({
      panel: {
        type: 'table',
        gridPos: { x: 0, y: 0, w: 12, h: 12 },
        options: { showHeader: true },
      },
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        dashboard: expect.objectContaining({
          time: expect.objectContaining({ from: 'now-10h', to: 'now' }),
        }),
      })
    );
  });

  // it('Correct time range is used', async () => {
  //   await setDashboardInLocalStorage({
  //     queries: [],
  //     queryResponse: createEmptyQueryResponse(),
  //     datasource: { type: 'loki', uid: 'someUid' },
  //     time: { from: 'now-10h', to: 'now' },
  //   });

  //   expect(spy).toHaveBeenCalledWith(
  //     expect.objectContaining({
  //       dashboard: expect.objectContaining({
  //         time: expect.objectContaining({ from: 'now-10h', to: 'now' }),
  //       }),
  //     })
  //   );
  // });
});
