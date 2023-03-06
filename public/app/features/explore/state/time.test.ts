import { reducerTester } from 'test/core/redux/reducerTester';

import { dateTime, LoadingState } from '@grafana/data';
import { configureStore } from 'app/store/configureStore';
import { ExploreId, ExploreItemState } from 'app/types/explore';

import { silenceConsoleOutput } from '../../../../test/core/utils/silenceConsoleOutput';

import { createDefaultInitialState } from './helpers';
import { changeRangeAction, changeRefreshIntervalAction, timeReducer, updateTime } from './time';
import { makeExplorePaneState } from './utils';

const MOCK_TIME_RANGE = {};

const mockTimeSrv = {
  init: jest.fn(),
  timeRange: jest.fn().mockReturnValue(MOCK_TIME_RANGE),
};
jest.mock('app/features/dashboard/services/TimeSrv', () => ({
  ...jest.requireActual('app/features/dashboard/services/TimeSrv'),
  getTimeSrv: () => mockTimeSrv,
}));

const mockTemplateSrv = {
  updateTimeRange: jest.fn(),
};
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => mockTemplateSrv,
}));

describe('Explore item reducer', () => {
  silenceConsoleOutput();

  describe('When time is updated', () => {
    it('Time service is re-initialized and template service is updated with the new time range', async () => {
      const { dispatch } = configureStore({
        ...(createDefaultInitialState() as any),
      });
      await dispatch(updateTime({ exploreId: ExploreId.left }));
      expect(mockTimeSrv.init).toBeCalled();
      expect(mockTemplateSrv.updateTimeRange).toBeCalledWith(MOCK_TIME_RANGE);
    });
  });

  describe('changing refresh intervals', () => {
    it("should result in 'streaming' state, when live-tailing is active", () => {
      const initialState = makeExplorePaneState();
      const expectedState = {
        ...initialState,
        refreshInterval: 'LIVE',
        isLive: true,
        loading: true,
        logsResult: {
          hasUniqueLabels: false,
          rows: [],
        },
        queryResponse: {
          ...initialState.queryResponse,
          state: LoadingState.Streaming,
        },
      };
      reducerTester<ExploreItemState>()
        .givenReducer(timeReducer, initialState)
        .whenActionIsDispatched(changeRefreshIntervalAction({ exploreId: ExploreId.left, refreshInterval: 'LIVE' }))
        .thenStateShouldEqual(expectedState);
    });

    it("should result in 'done' state, when live-tailing is stopped", () => {
      const initialState = makeExplorePaneState();
      const expectedState = {
        ...initialState,
        refreshInterval: '',
        logsResult: {
          hasUniqueLabels: false,
          rows: [],
        },
        queryResponse: {
          ...initialState.queryResponse,
          state: LoadingState.Done,
        },
      };
      reducerTester<ExploreItemState>()
        .givenReducer(timeReducer, initialState)
        .whenActionIsDispatched(changeRefreshIntervalAction({ exploreId: ExploreId.left, refreshInterval: '' }))
        .thenStateShouldEqual(expectedState);
    });
  });

  describe('changing range', () => {
    describe('when changeRangeAction is dispatched', () => {
      it('then it should set correct state', () => {
        reducerTester<ExploreItemState>()
          .givenReducer(timeReducer, {
            range: null,
            absoluteRange: null,
          } as unknown as ExploreItemState)
          .whenActionIsDispatched(
            changeRangeAction({
              exploreId: ExploreId.left,
              absoluteRange: { from: 1546297200000, to: 1546383600000 },
              range: { from: dateTime('2019-01-01'), to: dateTime('2019-01-02'), raw: { from: 'now-1d', to: 'now' } },
            })
          )
          .thenStateShouldEqual({
            absoluteRange: { from: 1546297200000, to: 1546383600000 },
            range: { from: dateTime('2019-01-01'), to: dateTime('2019-01-02'), raw: { from: 'now-1d', to: 'now' } },
          } as unknown as ExploreItemState);
      });
    });
  });
});
