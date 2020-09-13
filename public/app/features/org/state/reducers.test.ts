import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { OrganizationState } from '../../../types';
import { initialState, organizationLoaded, organizationReducer, setOrganizationName } from './reducers';

describe('organizationReducer', () => {
  describe('when organizationLoaded is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<OrganizationState>()
        .givenReducer(organizationReducer, { ...initialState })
        .whenActionIsDispatched(organizationLoaded({ id: 1, name: 'An org' }))
        .thenStateShouldEqual({
          organization: { id: 1, name: 'An org' },
        });
    });
  });

  describe('when setOrganizationName is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<OrganizationState>()
        .givenReducer(organizationReducer, { ...initialState, organization: { id: 1, name: 'An org' } })
        .whenActionIsDispatched(setOrganizationName('New Name'))
        .thenStateShouldEqual({
          organization: { id: 1, name: 'New Name' },
        });
    });
  });
});
