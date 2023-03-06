import { of } from 'rxjs';

import { DataSourceApi, DataTopic, LoadingState, PanelData } from '@grafana/data';
import { getDashboardSrv, setDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { isSharedDashboardQuery, runSharedRequest } from './runSharedRequest';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('SharedQueryRunner', () => {
  let panelData: PanelData = {} as any;
  const origDashbaordSrv = getDashboardSrv();

  beforeEach(() => {
    setDashboardSrv({
      getCurrent: () => ({
        getPanelById: () => ({
          getQueryRunner: () => ({
            getData: () => of(panelData),
          }),
        }),
      }),
    } as any);
  });

  afterEach(() => {
    setDashboardSrv(origDashbaordSrv);
  });

  it('should identify shared queries', () => {
    expect(isSharedDashboardQuery('-- Dashboard --')).toBe(true);

    expect(isSharedDashboardQuery('')).toBe(false);
    expect(isSharedDashboardQuery(undefined as unknown as null)).toBe(false);
    expect(isSharedDashboardQuery(null)).toBe(false);

    const ds = {
      meta: {
        name: '-- Dashboard --',
      },
    } as DataSourceApi;
    expect(isSharedDashboardQuery(ds)).toBe(true);

    ds.meta!.name = 'something else';
    expect(isSharedDashboardQuery(ds)).toBe(false);
  });

  it('can filter annotation data', (done) => {
    // Get the data
    panelData = {
      state: LoadingState.Done,
      series: [{ refId: 'A', fields: [], length: 0 }],
      annotations: [{ refId: 'X', fields: [], length: 0 }],
      timeRange: panelData.timeRange,
    };

    runSharedRequest({ queries: [{ panelId: 1 }] } as any, {
      refId: 'Q',
    }).subscribe((v) => {
      expect(v).toBe(panelData);
      done();
    });
  });

  it('can move annotations to the series topic', (done) => {
    // Get the data
    panelData = {
      state: LoadingState.Done,
      series: [{ refId: 'A', fields: [], length: 0 }],
      annotations: [{ refId: 'X', fields: [], length: 0 }],
      timeRange: panelData.timeRange,
    };

    runSharedRequest({ queries: [{ panelId: 1 }] } as any, {
      refId: 'Q',
      topic: DataTopic.Annotations,
    }).subscribe((v) => {
      try {
        expect(v).toMatchInlineSnapshot(`
          {
            "annotations": undefined,
            "series": [
              {
                "fields": [],
                "length": 0,
                "refId": "X",
              },
            ],
            "state": "Done",
            "timeRange": undefined,
          }
        `);
        done();
      } catch (err) {
        done(err);
      }
    });
  });
});
