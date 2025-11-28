import { thunkTester } from 'test/core/thunk/thunkTester';

import { config, getBackendSrv } from '@grafana/runtime';
import { iamAPIv0alpha1 } from 'app/api/clients/iam/v0alpha1';

import { loadTeamGroups, addTeamGroup, removeTeamGroup } from './actions';
import { teamGroupsLoaded } from './reducers';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
  config: {
    featureToggles: {
      kubernetesExternalGroupMapping: false,
    },
  },
}));

jest.mock('app/api/clients/iam/v0alpha1', () => ({
  iamAPIv0alpha1: {
    endpoints: {
      getTeamGroups: {
        initiate: jest.fn(),
      },
      createExternalGroupMapping: {
        initiate: jest.fn(),
      },
      deleteExternalGroupMapping: {
        initiate: jest.fn(),
      },
    },
  },
}));

const setup = () => {
  const initialState = {
    team: {
      team: {
        uid: 'team-uid',
      },
    },
  };
  return { initialState };
};

describe('Team actions', () => {
  const getMock = jest.fn();
  const postMock = jest.fn();
  const deleteMock = jest.fn();
  const backendSrvMock = {
    get: getMock,
    post: postMock,
    delete: deleteMock,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getBackendSrv as jest.Mock).mockReturnValue(backendSrvMock);
  });

  describe('loadTeamGroups', () => {
    it('should load groups from backend when feature toggle is disabled', async () => {
      config.featureToggles.kubernetesExternalGroupMapping = false;
      const { initialState } = setup();
      const mockResponse = [{ groupId: 'g1' }];
      getMock.mockResolvedValue(mockResponse);

      const dispatchedActions = await thunkTester(initialState).givenThunk(loadTeamGroups).whenThunkIsDispatched();

      expect(getMock).toHaveBeenCalledWith('/api/teams/team-uid/groups');
      expect(dispatchedActions[0].type).toEqual(teamGroupsLoaded.type);
      expect(dispatchedActions[0].payload).toEqual(mockResponse);
    });

    it('should load groups from IAM API when feature toggle is enabled', async () => {
      config.featureToggles.kubernetesExternalGroupMapping = true;
      const { initialState } = setup();
      const mockData = {
        items: [{ externalGroup: 'g1', name: 'mapping-1' }],
      };

      (iamAPIv0alpha1.endpoints.getTeamGroups.initiate as jest.Mock).mockReturnValue({
        type: 'mock/initiate',
        unwrap: jest.fn().mockResolvedValue(mockData),
      });

      const dispatchedActions = await thunkTester(initialState).givenThunk(loadTeamGroups).whenThunkIsDispatched();

      expect(iamAPIv0alpha1.endpoints.getTeamGroups.initiate).toHaveBeenCalledWith(
        { name: 'team-uid' },
        { forceRefetch: true }
      );

      const expectedGroups = [{ groupId: 'g1', teamId: 0, uid: 'mapping-1' }];
      const loadedAction = dispatchedActions.find((a) => a.type === teamGroupsLoaded.type);
      expect(loadedAction).toBeDefined();
      expect(loadedAction?.payload).toEqual(expectedGroups);
    });
  });

  describe('addTeamGroup', () => {
    it('should add group via backend when feature toggle is disabled', async () => {
      config.featureToggles.kubernetesExternalGroupMapping = false;
      const { initialState } = setup();
      postMock.mockResolvedValue({});
      getMock.mockResolvedValue([]);

      const dispatchedActions = await thunkTester(initialState)
        .givenThunk(addTeamGroup)
        .whenThunkIsDispatched('group-id');

      expect(postMock).toHaveBeenCalledWith('/api/teams/team-uid/groups', { groupId: 'group-id' });
      expect(dispatchedActions[0].type).toEqual(teamGroupsLoaded.type);
    });

    it('should add group via IAM API when feature toggle is enabled', async () => {
      config.featureToggles.kubernetesExternalGroupMapping = true;
      const { initialState } = setup();

      (iamAPIv0alpha1.endpoints.createExternalGroupMapping.initiate as jest.Mock).mockReturnValue({
        type: 'mock/initiate',
        unwrap: jest.fn().mockResolvedValue({}),
      });

      (iamAPIv0alpha1.endpoints.getTeamGroups.initiate as jest.Mock).mockReturnValue({
        type: 'mock/initiate',
        unwrap: jest.fn().mockResolvedValue({ items: [] }),
      });

      const dispatchedActions = await thunkTester(initialState)
        .givenThunk(addTeamGroup)
        .whenThunkIsDispatched('group-id');

      expect(iamAPIv0alpha1.endpoints.createExternalGroupMapping.initiate).toHaveBeenCalledWith(
        expect.objectContaining({
          externalGroupMapping: expect.objectContaining({
            spec: expect.objectContaining({
              externalGroupId: 'group-id',
              teamRef: { name: 'team-uid' },
            }),
          }),
        })
      );

      const loadedAction = dispatchedActions.find((a) => a.type === teamGroupsLoaded.type);
      expect(loadedAction).toBeDefined();
    });
  });

  describe('removeTeamGroup', () => {
    it('should remove group via backend when feature toggle is disabled', async () => {
      config.featureToggles.kubernetesExternalGroupMapping = false;
      const { initialState } = setup();
      deleteMock.mockResolvedValue({});
      getMock.mockResolvedValue([]);

      const dispatchedActions = await thunkTester(initialState)
        .givenThunk(removeTeamGroup)
        .whenThunkIsDispatched('group-id', 'mapping-uid');

      expect(deleteMock).toHaveBeenCalledWith('/api/teams/team-uid/groups?groupId=group-id');
      expect(dispatchedActions[0].type).toEqual(teamGroupsLoaded.type);
    });

    it('should remove group via IAM API when feature toggle is enabled', async () => {
      config.featureToggles.kubernetesExternalGroupMapping = true;
      const { initialState } = setup();

      (iamAPIv0alpha1.endpoints.deleteExternalGroupMapping.initiate as jest.Mock).mockReturnValue({
        type: 'mock/initiate',
        unwrap: jest.fn().mockResolvedValue({}),
      });

      (iamAPIv0alpha1.endpoints.getTeamGroups.initiate as jest.Mock).mockReturnValue({
        type: 'mock/initiate',
        unwrap: jest.fn().mockResolvedValue({ items: [] }),
      });

      const dispatchedActions = await thunkTester(initialState)
        .givenThunk(removeTeamGroup)
        .whenThunkIsDispatched('group-id', 'mapping-uid');

      expect(iamAPIv0alpha1.endpoints.deleteExternalGroupMapping.initiate).toHaveBeenCalledWith({
        name: 'mapping-uid',
      });

      const loadedAction = dispatchedActions.find((a) => a.type === teamGroupsLoaded.type);
      expect(loadedAction).toBeDefined();
    });
  });
});
