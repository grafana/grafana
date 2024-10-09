import { MutableDataFrame } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import * as api from 'app/features/dashboard/state/initDashboard';
import { ExplorePanelData } from 'app/types';

import { createEmptyQueryResponse } from '../../state/utils';

import { buildDashboardPanelFromExploreState } from './addToDashboard';

describe('buildDashboardPanelFromExploreState', () => {
  let spy: jest.SpyInstance;
  beforeAll(() => {
    spy = jest.spyOn(api, 'setDashboardToFetchFromLocalStorage');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('Correct datasource ref is used', () => {
    const result = buildDashboardPanelFromExploreState({
      queries: [],
      queryResponse: createEmptyQueryResponse(),
      datasource: { type: 'loki', uid: 'someUid' },
    });

    expect(result.datasource).toEqual({ type: 'loki', uid: 'someUid' });
  });

  it('All queries are correctly passed through', () => {
    const queries: DataQuery[] = [{ refId: 'A' }, { refId: 'B', hide: true }];

    const result = buildDashboardPanelFromExploreState({ queries, queryResponse: createEmptyQueryResponse() });

    expect(result.targets).toEqual(queries),
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
        const result = buildDashboardPanelFromExploreState({ queries, queryResponse });
        expect(result.type).toBe('table');
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

          const result = buildDashboardPanelFromExploreState({ queries, queryResponse });
          expect(result.type).toBe(expectedPanel);
        }
      );

      it('Sets visualization to plugin panel ID if there are custom panel frames', async () => {
        const queries = [{ refId: 'A' }];
        const queryResponse: ExplorePanelData = {
          ...createEmptyQueryResponse(),
          ['customFrames']: [
            new MutableDataFrame({
              refId: 'A',
              fields: [],
              meta: { preferredVisualisationPluginId: 'someCustomPluginId' },
            }),
          ],
        };

        const result = buildDashboardPanelFromExploreState({ queries, queryResponse });
        expect(result.type).toBe('someCustomPluginId'); 
      });
    });
  });
});
