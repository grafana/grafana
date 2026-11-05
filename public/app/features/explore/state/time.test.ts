import { reducerTester } from 'test/core/redux/reducerTester';

import { dateTime, LoadingState } from '@grafana/data';
import { RefreshPicker } from '@grafana/ui';
import { configureStore } from 'app/store/configureStore';
import { type ExploreItemState } from 'app/types/explore';

import { createDefaultInitialState } from './testHelpers';
import { changeRangeAction, changeRefreshInterval, timeReducer, updateTime } from './time';

const mockTimeSrv = {
  init: jest.fn(),
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
  describe('When time is updated', () => {
    it('Time service is re-initialized and template service is updated with the new time range', async () => {
      const state = createDefaultInitialState().defaultInitialState as any;
      const { dispatch } = configureStore(state);
      dispatch(updateTime({ exploreId: 'left' }));
      expect(mockTemplateSrv.updateTimeRange).toBeCalledWith(state.explore.panes.left.range);
      expect(mockTimeSrv.init).toBeCalled();
      expect(mockTemplateSrv.updateTimeRange).toBeCalledWith(state.explore.panes.left.range);
    });
  });

  describe('changing refresh interval', () => {
    it('drops streaming log frames when live mode stops', () => {
      reducerTester<ExploreItemState>()
        .givenReducer(timeReducer, {
          refreshInterval: RefreshPicker.liveOption.value,
          isLive: true,
          isPaused: false,
          querySubscription: undefined,
          queryResponse: {
            state: LoadingState.Streaming,
            series: [{ refId: 'A', meta: { preferredVisualisationType: 'logs' } }],
            logsFrames: [{ refId: 'A' }],
          },
          logsResult: { rows: [{ uid: '1' }], hasUniqueLabels: false },
        } as unknown as ExploreItemState)
        .whenActionIsDispatched(
          changeRefreshInterval({ exploreId: 'left', refreshInterval: RefreshPicker.offOption.value })
        )
        .thenStatePredicateShouldEqual(
          (resultingState) =>
            resultingState.isLive === false &&
            resultingState.queryResponse.state === LoadingState.Loading &&
            resultingState.queryResponse.series.length === 0 &&
            resultingState.queryResponse.logsFrames.length === 0 &&
            resultingState.logsResult?.rows.length === 0
        );
    });
  });

  describe('changing range', () => {
    describe('when changeRangeAction is dispatched', () => {
      it('then it should set correct state', () => {
        const expectedFrom = dateTime('2019-01-01');
        const expectedTo = dateTime('2019-01-02');

        reducerTester<ExploreItemState>()
          .givenReducer(timeReducer, {
            range: null,
            absoluteRange: null,
          } as unknown as ExploreItemState)
          .whenActionIsDispatched(
            changeRangeAction({
              exploreId: 'left',
              absoluteRange: { from: 1546297200000, to: 1546383600000 },
              range: { from: expectedFrom, to: expectedTo, raw: { from: 'now-1d', to: 'now' } },
            })
          )
          .thenStatePredicateShouldEqual((resultingState) => {
            return (
              resultingState.absoluteRange.from === 1546297200000 &&
              resultingState.absoluteRange.to === 1546383600000 &&
              resultingState.range.raw.from === 'now-1d' &&
              resultingState.range.raw.to === 'now' &&
              resultingState.range.from.valueOf() === expectedFrom.valueOf() &&
              resultingState.range.to.valueOf() === expectedTo.valueOf()
            );
          });
      });
    });
  });
});
