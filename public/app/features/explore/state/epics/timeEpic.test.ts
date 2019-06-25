import { dateTime, DefaultTimeZone } from '@grafana/ui';

import { epicTester } from 'test/core/redux/epicTester';
import { mockExploreState } from 'test/mocks/mockExploreState';
import { timeEpic } from './timeEpic';
import { updateTimeRangeAction, changeRangeAction } from '../actionTypes';
import { EpicDependencies } from 'app/store/configureStore';

const from = dateTime('2019-01-01 10:00:00.000Z');
const to = dateTime('2019-01-01 16:00:00.000Z');
const rawFrom = 'now-6h';
const rawTo = 'now';
const rangeMock = {
  from,
  to,
  raw: {
    from: rawFrom,
    to: rawTo,
  },
};

describe('timeEpic', () => {
  describe('when updateTimeRangeAction is dispatched', () => {
    describe('and no rawRange is supplied', () => {
      describe('and no absoluteRange is supplied', () => {
        it('then the correct actions are dispatched', () => {
          const { exploreId, state, range } = mockExploreState({ range: rangeMock });
          const absoluteRange = { from: range.from.valueOf(), to: range.to.valueOf() };
          const stateToTest = { ...state, user: { timeZone: 'browser', orgId: -1 } };
          const getTimeRange = jest.fn().mockReturnValue(rangeMock);
          const dependencies: Partial<EpicDependencies> = {
            getTimeRange,
          };

          epicTester(timeEpic, stateToTest, dependencies)
            .whenActionIsDispatched(updateTimeRangeAction({ exploreId }))
            .thenDependencyWasCalledTimes(1, 'getTimeSrv', 'init')
            .thenDependencyWasCalledTimes(1, 'getTimeRange')
            .thenDependencyWasCalledWith([DefaultTimeZone, rangeMock.raw], 'getTimeRange')
            .thenResultingActionsEqual(
              changeRangeAction({
                exploreId,
                range,
                absoluteRange,
              })
            );
        });
      });

      describe('and absoluteRange is supplied', () => {
        it('then the correct actions are dispatched', () => {
          const { exploreId, state, range } = mockExploreState({ range: rangeMock });
          const absoluteRange = { from: range.from.valueOf(), to: range.to.valueOf() };
          const stateToTest = { ...state, user: { timeZone: 'browser', orgId: -1 } };
          const getTimeRange = jest.fn().mockReturnValue(rangeMock);
          const dependencies: Partial<EpicDependencies> = {
            getTimeRange,
          };

          epicTester(timeEpic, stateToTest, dependencies)
            .whenActionIsDispatched(updateTimeRangeAction({ exploreId, absoluteRange }))
            .thenDependencyWasCalledTimes(1, 'getTimeSrv', 'init')
            .thenDependencyWasCalledTimes(1, 'getTimeRange')
            .thenDependencyWasCalledWith([DefaultTimeZone, { from: null, to: null }], 'getTimeRange')
            .thenDependencyWasCalledTimes(2, 'dateTime')
            .thenResultingActionsEqual(
              changeRangeAction({
                exploreId,
                range,
                absoluteRange,
              })
            );
        });
      });
    });

    describe('and rawRange is supplied', () => {
      describe('and no absoluteRange is supplied', () => {
        it('then the correct actions are dispatched', () => {
          const { exploreId, state, range } = mockExploreState({ range: rangeMock });
          const rawRange = { from: 'now-5m', to: 'now' };
          const absoluteRange = { from: range.from.valueOf(), to: range.to.valueOf() };
          const stateToTest = { ...state, user: { timeZone: 'browser', orgId: -1 } };
          const getTimeRange = jest.fn().mockReturnValue(rangeMock);
          const dependencies: Partial<EpicDependencies> = {
            getTimeRange,
          };

          epicTester(timeEpic, stateToTest, dependencies)
            .whenActionIsDispatched(updateTimeRangeAction({ exploreId, rawRange }))
            .thenDependencyWasCalledTimes(1, 'getTimeSrv', 'init')
            .thenDependencyWasCalledTimes(1, 'getTimeRange')
            .thenDependencyWasCalledWith([DefaultTimeZone, rawRange], 'getTimeRange')
            .thenResultingActionsEqual(
              changeRangeAction({
                exploreId,
                range,
                absoluteRange,
              })
            );
        });
      });
    });
  });
});
