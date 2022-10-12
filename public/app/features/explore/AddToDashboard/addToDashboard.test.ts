import { DataQuery, MutableDataFrame } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv';
import * as api from 'app/features/dashboard/state/initDashboard';
import { ExplorePanelData } from 'app/types';

import { createEmptyQueryResponse } from '../state/utils';

import { setDashboardInLocalStorage } from './addToDashboard';

describe('addPanelToDashboard', () => {
  let spy: jest.SpyInstance;
  beforeAll(() => {
    spy = jest.spyOn(api, 'setDashboardToFetchFromLocalStorage');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('Correct datasource ref is used', async () => {
    await setDashboardInLocalStorage({
      queries: [],
      queryResponse: createEmptyQueryResponse(),
      datasource: { type: 'loki', uid: 'someUid' },
    });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        dashboard: expect.objectContaining({
          panels: expect.arrayContaining([expect.objectContaining({ datasource: { type: 'loki', uid: 'someUid' } })]),
        }),
      })
    );
  });

  it('All queries are correctly passed through', async () => {
    const queries: DataQuery[] = [{ refId: 'A' }, { refId: 'B', hide: true }];

    await setDashboardInLocalStorage({
      queries,
      queryResponse: createEmptyQueryResponse(),
    });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        dashboard: expect.objectContaining({
          panels: expect.arrayContaining([expect.objectContaining({ targets: expect.arrayContaining(queries) })]),
        }),
      })
    );
  });

  it('Previous panels should not be removed', async () => {
    const queries: DataQuery[] = [{ refId: 'A' }];
    const existingPanel = { prop: 'this should be kept' };
    jest.spyOn(backendSrv, 'getDashboardByUid').mockResolvedValue({
      dashboard: {
        templating: { list: [] },
        title: 'Previous panels should not be removed',
        uid: 'someUid',
        panels: [existingPanel],
      },
      meta: {},
    });

    await setDashboardInLocalStorage({
      queries,
      queryResponse: createEmptyQueryResponse(),
      dashboardUid: 'someUid',
      datasource: { type: '' },
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        dashboard: expect.objectContaining({
          panels: expect.arrayContaining([
            expect.objectContaining({ targets: expect.arrayContaining(queries) }),
            existingPanel,
          ]),
        }),
      })
    );
  });

  describe('Setting visualization type', () => {
    describe('Defaults to table', () => {
      const cases: Array<[string, DataQuery[], ExplorePanelData]> = [
        ['If response is empty', [{ refId: 'A' }], createEmptyQueryResponse()],
        ['If no query is active', [{ refId: 'A', hide: true }], createEmptyQueryResponse()],
        [
          'If no query is active, even when there is a response from a previous execution',
          [{ refId: 'A', hide: true }],
          { ...createEmptyQueryResponse(), logsFrames: [new MutableDataFrame({ refId: 'A', fields: [] })] },
        ],
      ];

      it.each(cases)('%s', async (_, queries, queryResponse) => {
        await setDashboardInLocalStorage({ queries, queryResponse });
        expect(spy).toHaveBeenCalledWith(
          expect.objectContaining({
            dashboard: expect.objectContaining({
              panels: expect.arrayContaining([expect.objectContaining({ type: 'table' })]),
            }),
          })
        );
      });
    });

    describe('Correctly set visualization based on response', () => {
      type TestArgs = {
        framesType: string;
        expectedPanel: string;
      };
      it.each`
        framesType            | expectedPanel
        ${'logsFrames'}       | ${'logs'}
        ${'graphFrames'}      | ${'timeseries'}
        ${'nodeGraphFrames'}  | ${'nodeGraph'}
        ${'flameGraphFrames'} | ${'flamegraph'}
        ${'traceFrames'}      | ${'traces'}
      `(
        'Sets visualization to $expectedPanel if there are $frameType frames',
        async ({ framesType, expectedPanel }: TestArgs) => {
          const queries = [{ refId: 'A' }];
          const queryResponse: ExplorePanelData = {
            ...createEmptyQueryResponse(),
            [framesType]: [new MutableDataFrame({ refId: 'A', fields: [] })],
          };

          await setDashboardInLocalStorage({ queries, queryResponse });
          expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({
              dashboard: expect.objectContaining({
                panels: expect.arrayContaining([expect.objectContaining({ type: expectedPanel })]),
              }),
            })
          );
        }
      );
    });
  });
});
