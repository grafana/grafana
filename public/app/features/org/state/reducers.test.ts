import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { OrganizationState, OrgRole } from '../../../types';
import { initialState, organizationReducer, userOrganizationsLoaded } from './reducers';

describe('organizationReducer', () => {
  describe('when userOrganizationsLoaded is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<OrganizationState>()
        .givenReducer(organizationReducer, {
          ...initialState,
          userOrgs: [],
        })
        .whenActionIsDispatched(userOrganizationsLoaded([{ orgId: 1, name: 'New org', role: OrgRole.Editor }]))
        .thenStateShouldEqual({
          userOrgs: [{ orgId: 1, name: 'New org', role: OrgRole.Editor }],
        });
    });
  });
});
