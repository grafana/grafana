import { reducerTester } from 'test/core/redux/reducerTester';

import { dateTime, TimeZone } from '@grafana/data';
import { configureStore } from 'app/store/configureStore';
import { ExploreItemState } from 'app/types';

import { createDefaultInitialState } from './testHelpers';
import { changeRangeAction, timeReducer, updateTime } from './time';
import { getTimeZone } from 'app/features/profile/state/selectors';

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

jest.mock('app/features/profile/state/selectors', () => ({
  getTimeZone: jest.fn(),
  getFiscalYearStartMonth: jest.fn(() => 0),
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

describe('updateTime', () => {
  const mockDispatch = jest.fn();
  const mockGetState = jest.fn();
  const exploreId = 'left';

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetState.mockReturnValue({
      explore: {
        panes: {
          [exploreId]: {
            range: {
              raw: {
                from: dateTime('2023-01-01T00:00:00Z'),
                to: dateTime('2023-01-02T00:00:00Z'),
              },
            },
          },
        },
        user: {},
      },
    });
  });

  it('should convert absolute range to configured timezone', () => {
    (getTimeZone as jest.Mock).mockReturnValue('America/New_York');
    
    const absoluteRange = {
      from: dateTime('2023-01-01T00:00:00Z').valueOf(),
      to: dateTime('2023-01-02T00:00:00Z').valueOf(),
    };

    updateTime({ exploreId, absoluteRange })(mockDispatch, mockGetState);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          range: expect.objectContaining({
            from: expect.any(Object),
            to: expect.any(Object),
          }),
        }),
      })
    );
  });

  it('should handle browser timezone', () => {
    (getTimeZone as jest.Mock).mockReturnValue('browser');
    
    const absoluteRange = {
      from: dateTime('2023-01-01T00:00:00Z').valueOf(),
      to: dateTime('2023-01-02T00:00:00Z').valueOf(),
    };

    updateTime({ exploreId, absoluteRange })(mockDispatch, mockGetState);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          range: expect.objectContaining({
            from: expect.any(Object),
            to: expect.any(Object),
          }),
        }),
      })
    );
  });

  it('should handle UTC timezone', () => {
    (getTimeZone as jest.Mock).mockReturnValue('utc');
    
    const absoluteRange = {
      from: dateTime('2023-01-01T00:00:00Z').valueOf(),
      to: dateTime('2023-01-02T00:00:00Z').valueOf(),
    };

    updateTime({ exploreId, absoluteRange })(mockDispatch, mockGetState);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          range: expect.objectContaining({
            from: expect.any(Object),
            to: expect.any(Object),
          }),
        }),
      })
    );
  });
});
