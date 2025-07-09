import { OrgRole } from '@grafana/data';

import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { getMockTeam } from '../../teams/mocks/teamMocks';

import {
  initialUserState,
  orgsLoaded,
  sessionsLoaded,
  setUpdating,
  teamsLoaded,
  updateTimeZone,
  updateWeekStart,
  userLoaded,
  userReducer,
  userSessionRevoked,
  UserState,
} from './reducers';

describe('userReducer', () => {
  let dateNow: jest.SpyInstance;

  beforeAll(() => {
    dateNow = jest.spyOn(Date, 'now').mockImplementation(() => 1609470000000); // 2021-01-01 04:00:00
  });

  afterAll(() => {
    dateNow.mockRestore();
  });

  describe('when updateTimeZone is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<UserState>()
        .givenReducer(userReducer, { ...initialUserState })
        .whenActionIsDispatched(updateTimeZone({ timeZone: 'xyz' }))
        .thenStateShouldEqual({ ...initialUserState, timeZone: 'xyz' });
    });
  });

  describe('when updateWeekStart is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<UserState>()
        .givenReducer(userReducer, { ...initialUserState })
        .whenActionIsDispatched(updateWeekStart({ weekStart: 'xyz' }))
        .thenStateShouldEqual({ ...initialUserState, weekStart: 'xyz' });
    });
  });

  describe('when setUpdating is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<UserState>()
        .givenReducer(userReducer, { ...initialUserState, isUpdating: false })
        .whenActionIsDispatched(setUpdating({ updating: true }))
        .thenStateShouldEqual({ ...initialUserState, isUpdating: true });
    });
  });

  describe('when userLoaded is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<UserState>()
        .givenReducer(userReducer, { ...initialUserState, user: null })
        .whenActionIsDispatched(
          userLoaded({
            user: {
              id: 2021,
              uid: 'aaaaaa',
              email: 'test@test.com',
              isDisabled: true,
              login: 'test',
              name: 'Test Account',
              isGrafanaAdmin: false,
            },
          })
        )
        .thenStateShouldEqual({
          ...initialUserState,
          user: {
            id: 2021,
            uid: 'aaaaaa',
            email: 'test@test.com',
            isDisabled: true,
            login: 'test',
            name: 'Test Account',
            isGrafanaAdmin: false,
          },
        });
    });
  });

  describe('when teamsLoaded is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<UserState>()
        .givenReducer(userReducer, { ...initialUserState, teamsAreLoading: true })
        .whenActionIsDispatched(
          teamsLoaded({
            teams: [getMockTeam(1, 'aaaaaa')],
          })
        )
        .thenStateShouldEqual({
          ...initialUserState,
          teamsAreLoading: false,
          teams: [getMockTeam(1, 'aaaaaa')],
        });
    });
  });

  describe('when orgsLoaded is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<UserState>()
        .givenReducer(userReducer, { ...initialUserState, orgsAreLoading: true })
        .whenActionIsDispatched(
          orgsLoaded({
            orgs: [{ orgId: 1, name: 'Main', role: OrgRole.Viewer }],
          })
        )
        .thenStateShouldEqual({
          ...initialUserState,
          orgsAreLoading: false,
          orgs: [{ orgId: 1, name: 'Main', role: OrgRole.Viewer }],
        });
    });
  });

  describe('when sessionsLoaded is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<UserState>()
        .givenReducer(userReducer, { ...initialUserState, sessionsAreLoading: true })
        .whenActionIsDispatched(
          sessionsLoaded({
            sessions: [
              {
                id: 1,
                browser: 'Chrome',
                browserVersion: '90',
                osVersion: '95',
                clientIp: '192.168.1.1',
                createdAt: '2021-01-01 04:00:00',
                device: 'Computer',
                os: 'Windows',
                isActive: false,
                seenAt: '1996-01-01 04:00:00',
              },
            ],
          })
        )
        .thenStateShouldEqual({
          ...initialUserState,
          sessionsAreLoading: false,
          sessions: [
            {
              id: 1,
              browser: 'Chrome',
              browserVersion: '90',
              osVersion: '95',
              clientIp: '192.168.1.1',
              createdAt: '2021-01-01 04:00:00',
              device: 'Computer',
              os: 'Windows',
              isActive: false,
              seenAt: '25 years ago',
            },
          ],
        });
    });
  });

  describe('when userSessionRevoked is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<UserState>()
        .givenReducer(userReducer, {
          ...initialUserState,
          sessions: [
            {
              id: 1,
              browser: 'Chrome',
              browserVersion: '90',
              osVersion: '95',
              clientIp: '192.168.1.1',
              createdAt: '2021-01-01',
              device: 'Computer',
              os: 'Windows',
              isActive: false,
              seenAt: '1996-01-01',
            },
          ],
        })
        .whenActionIsDispatched(userSessionRevoked({ tokenId: 1 }))
        .thenStateShouldEqual({
          ...initialUserState,
          sessions: [],
        });
    });
  });
});
