import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { initialState, invitesReducer } from './reducers';
import { fetchInvitees } from './actions';
import { getMockInvitees } from 'app/features/users/__mocks__/userMocks';

describe('inviteesReducer', () => {
  describe('when fetchInvitees is dispatched', () => {
    it('then state should be correct', () => {
      const invitees = getMockInvitees(1);

      reducerTester<typeof initialState>()
        .givenReducer(invitesReducer, { ...initialState })
        .whenActionIsDispatched(fetchInvitees.fulfilled(invitees, ''))
        .thenStateShouldEqual({
          entities: {
            ...invitees.reduceRight<typeof initialState.entities>((prev, cur) => {
              prev[cur.code] = cur;
              return prev;
            }, {}),
          },
          ids: invitees.map((i) => i.code),
          status: 'succeeded',
        });
    });
  });
});
