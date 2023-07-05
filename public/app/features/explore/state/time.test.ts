import { reducerTester } from 'test/core/redux/reducerTester';

import { dateTime } from '@grafana/data';
import { configureStore } from 'app/store/configureStore';
import { ExploreItemState } from 'app/types';

import { createDefaultInitialState } from './helpers';
import { changeRangeAction, timeReducer, updateTime } from './time';

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
  describe('When time is updated', () => {
    it('Time service is re-initialized and template service is updated with the new time range', async () => {
      const { dispatch } = configureStore(createDefaultInitialState().defaultInitialState as any);
      dispatch(updateTime({ exploreId: 'left' }));
      expect(mockTimeSrv.init).toBeCalled();
      expect(mockTemplateSrv.updateTimeRange).toBeCalledWith(MOCK_TIME_RANGE);
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
              exploreId: 'left',
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
