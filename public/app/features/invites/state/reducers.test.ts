import { keyBy } from 'lodash';

import { getMockInvitees } from 'app/features/users/__mocks__/userMocks';

import { reducerTester } from '../../../../test/core/redux/reducerTester';

import { fetchInvitees, revokeInvite } from './actions';
import { initialState, invitesReducer } from './reducers';

describe('inviteesReducer', () => {
  describe('when fetchInvitees is dispatched', () => {
    it('then state should be correct', () => {
      const invitees = getMockInvitees(1);
      reducerTester<typeof initialState>()
        .givenReducer(invitesReducer, { ...initialState })
        .whenActionIsDispatched(fetchInvitees.fulfilled(invitees, ''))
        .thenStateShouldEqual({
          entities: keyBy(invitees, 'code'),
          ids: invitees.map((i) => i.code),
          status: 'succeeded',
        });
    });
  });

  describe('when revokeInvite is dispatched', () => {
    it('then state should be correct', () => {
      const invitees = getMockInvitees(1);

      const fakeInitialState: typeof initialState = {
        entities: keyBy(invitees, 'code'),
        ids: invitees.map((i) => i.code),
        status: 'succeeded',
      };

      reducerTester<typeof initialState>()
        .givenReducer(invitesReducer, fakeInitialState)
        .whenActionIsDispatched(revokeInvite.fulfilled(invitees[0].code, '', ''))
        .thenStateShouldEqual({
          entities: {
            [invitees[1].code]: invitees[1],
          },
          ids: [invitees[1].code],
          status: 'succeeded',
        });
    });
  });
});
