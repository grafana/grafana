import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { OrgRole } from '../../../types';
import { initialState, organizationLoaded, organizationReducer, userOrganizationsLoaded, setOrganizationName, } from './reducers';
describe('organizationReducer', () => {
    describe('when organizationLoaded is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(organizationReducer, Object.assign({}, initialState))
                .whenActionIsDispatched(organizationLoaded({ id: 1, name: 'An org' }))
                .thenStateShouldEqual({
                organization: { id: 1, name: 'An org' },
                userOrgs: [],
            });
        });
    });
    describe('when setOrganizationName is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(organizationReducer, Object.assign(Object.assign({}, initialState), { organization: { id: 1, name: 'An org' } }))
                .whenActionIsDispatched(setOrganizationName('New Name'))
                .thenStateShouldEqual({
                organization: { id: 1, name: 'New Name' },
                userOrgs: [],
            });
        });
    });
    describe('when userOrganizationsLoaded is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(organizationReducer, Object.assign(Object.assign({}, initialState), { organization: { id: 1, name: 'An org' }, userOrgs: [] }))
                .whenActionIsDispatched(userOrganizationsLoaded([{ orgId: 1, name: 'New org', role: OrgRole.Editor }]))
                .thenStateShouldEqual({
                organization: { id: 1, name: 'An org' },
                userOrgs: [{ orgId: 1, name: 'New org', role: OrgRole.Editor }],
            });
        });
    });
});
//# sourceMappingURL=reducers.test.js.map