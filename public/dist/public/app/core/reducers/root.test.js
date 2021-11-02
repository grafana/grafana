import { __assign } from "tslib";
import { createRootReducer, recursiveCleanState } from './root';
import { describe, expect } from '../../../test/lib/common';
import { reducerTester } from '../../../test/core/redux/reducerTester';
import { cleanUpAction } from '../actions/cleanUp';
import { initialTeamsState, teamsLoaded } from '../../features/teams/state/reducers';
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { config: {
        bootData: {
            navTree: [],
            user: {},
        },
    } })); });
describe('recursiveCleanState', function () {
    describe('when called with an existing state selector', function () {
        it('then it should clear that state slice in state', function () {
            var state = {
                teams: { teams: [{ id: 1 }, { id: 2 }] },
            };
            // Choosing a deeper state selector here just to test recursive behaviour
            // This should be same state slice that matches the state slice of a reducer like state.teams
            var stateSelector = state.teams.teams[0];
            recursiveCleanState(state, stateSelector);
            expect(state.teams.teams[0]).not.toBeDefined();
            expect(state.teams.teams[1]).toBeDefined();
        });
    });
    describe('when called with a non existing state selector', function () {
        it('then it should not clear that state slice in state', function () {
            var state = {
                teams: { teams: [{ id: 1 }, { id: 2 }] },
            };
            // Choosing a deeper state selector here just to test recursive behaviour
            // This should be same state slice that matches the state slice of a reducer like state.teams
            var stateSelector = state.teams.teams[2];
            recursiveCleanState(state, stateSelector);
            expect(state.teams.teams[0]).toBeDefined();
            expect(state.teams.teams[1]).toBeDefined();
        });
    });
});
describe('rootReducer', function () {
    var rootReducer = createRootReducer();
    describe('when called with any action except cleanUpAction', function () {
        it('then it should not clean state', function () {
            var teams = [{ id: 1 }];
            var state = {
                teams: __assign({}, initialTeamsState),
            };
            reducerTester()
                .givenReducer(rootReducer, state)
                .whenActionIsDispatched(teamsLoaded(teams))
                .thenStatePredicateShouldEqual(function (resultingState) {
                expect(resultingState.teams).toEqual({
                    hasFetched: true,
                    searchQuery: '',
                    teams: teams,
                });
                return true;
            });
        });
    });
    describe('when called with cleanUpAction', function () {
        it('then it should clean state', function () {
            var teams = [{ id: 1 }];
            var state = {
                teams: {
                    hasFetched: true,
                    searchQuery: '',
                    teams: teams,
                },
            };
            reducerTester()
                .givenReducer(rootReducer, state, false, true)
                .whenActionIsDispatched(cleanUpAction({ stateSelector: function (storeState) { return storeState.teams; } }))
                .thenStatePredicateShouldEqual(function (resultingState) {
                expect(resultingState.teams).toEqual(__assign({}, initialTeamsState));
                return true;
            });
        });
    });
});
//# sourceMappingURL=root.test.js.map