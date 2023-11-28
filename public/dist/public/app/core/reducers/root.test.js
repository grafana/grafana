import { reducerTester } from '../../../test/core/redux/reducerTester';
import { initialTeamsState, teamsLoaded } from '../../features/teams/state/reducers';
import { cleanUpAction } from '../actions/cleanUp';
import { createRootReducer } from './root';
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { config: {
        bootData: {
            navTree: [],
            user: {},
        },
    } })));
describe('rootReducer', () => {
    const rootReducer = createRootReducer();
    describe('when called with any action except cleanUpAction', () => {
        it('then it should not clean state', () => {
            const teams = [{ id: 1 }];
            const state = {
                teams: Object.assign({}, initialTeamsState),
            };
            reducerTester()
                .givenReducer(rootReducer, state)
                .whenActionIsDispatched(teamsLoaded({ teams: teams, page: 1, noTeams: false, perPage: 30, totalCount: 1 }))
                .thenStatePredicateShouldEqual((resultingState) => {
                expect(resultingState.teams).toEqual({
                    hasFetched: true,
                    noTeams: false,
                    perPage: 30,
                    totalPages: 1,
                    query: '',
                    page: 1,
                    teams,
                });
                return true;
            });
        });
    });
    describe('when called with cleanUpAction', () => {
        it('then it should clean state', () => {
            const teams = [{ id: 1 }];
            const state = {
                teams: {
                    hasFetched: true,
                    query: '',
                    page: 1,
                    noTeams: false,
                    totalPages: 1,
                    perPage: 30,
                    teams,
                },
            };
            reducerTester()
                .givenReducer(rootReducer, state, false, true)
                .whenActionIsDispatched(cleanUpAction({ cleanupAction: (storeState) => (storeState.teams = initialTeamsState) }))
                .thenStatePredicateShouldEqual((resultingState) => {
                expect(resultingState.teams).toEqual(Object.assign({}, initialTeamsState));
                return true;
            });
        });
    });
});
//# sourceMappingURL=root.test.js.map