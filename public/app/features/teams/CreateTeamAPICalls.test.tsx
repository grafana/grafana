import { act, renderHook, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import useMountedState from 'react-use/lib/useMountedState';
import { getWrapper } from 'test/test-utils';

import { AppEvents } from '@grafana/data';
import { getAppEvents, setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';

import { useCreateTeamOrchestrate } from './CreateTeamAPICalls';

setBackendSrv(backendSrv);

jest.mock('react-use/lib/useMountedState', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: jest.fn(),
}));

const server = setupMockServer();
const mockUseMountedState = jest.mocked(useMountedState);
const mockGetAppEvents = jest.mocked(getAppEvents);

// Must not match any name in MOCK_TEAMS fixture (which contains 'Test Team')
const formModel = { name: 'My New Team', email: 'test@example.com' };

// PUT /api/access-control/teams/:teamId/roles has no default handler in setupMockServer,
// so tests that exercise role creation must register one.
const setTeamRolesSuccessHandler = http.put('/api/access-control/teams/:teamId/roles', () =>
  HttpResponse.json({ message: 'Roles updated' })
);

describe('useCreateTeamOrchestrate', () => {
  const mockPublish = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMountedState.mockReturnValue(() => true);
    mockGetAppEvents.mockReturnValue({ publish: mockPublish } as never);

    contextSrv.fetchUserPermissions = jest.fn().mockResolvedValue(undefined);
    contextSrv.licensedAccessControlEnabled = () => false;
    contextSrv.hasPermission = () => true;
  });

  it('returns undefined statuses before trigger is called', () => {
    const { result } = renderHook(() => useCreateTeamOrchestrate([], false), { wrapper: getWrapper({}) });

    expect(result.current.teamCreationStatus).toBeUndefined();
    expect(result.current.folderCreationStatus).toBeUndefined();
    expect(result.current.rolesCreationStatus).toBeUndefined();
  });

  describe('team creation', () => {
    it('sets loading before the API responds', async () => {
      server.use(http.post('/api/teams', async () => delay('infinite')));

      const { result, unmount } = renderHook(() => useCreateTeamOrchestrate([], false), {
        wrapper: getWrapper({}),
      });

      act(() => {
        result.current.trigger(formModel);
      });

      // Loading is set synchronously before the first await inside the trigger
      expect(result.current.teamCreationStatus).toEqual({ state: 'loading' });
      unmount();
    });

    it('reports success with the team uid returned by the API', async () => {
      // Default handler returns { teamId: 10, uid: 'aethyfifmhwcgd' }
      const { result } = renderHook(() => useCreateTeamOrchestrate([], false), { wrapper: getWrapper({}) });

      await act(async () => {
        await result.current.trigger(formModel);
      });

      expect(result.current.teamCreationStatus).toEqual({ state: 'success', data: 'aethyfifmhwcgd' });
    });

    it('reports error when the API returns an error response', async () => {
      server.use(
        http.post('/api/teams', () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 }))
      );

      const { result } = renderHook(() => useCreateTeamOrchestrate([], false), { wrapper: getWrapper({}) });

      await act(async () => {
        await result.current.trigger(formModel);
      });

      expect(result.current.teamCreationStatus?.state).toBe('error');
    });

    it('does not trigger roles or folder creation when team creation fails', async () => {
      server.use(
        http.post('/api/teams', () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 }))
      );

      // Roles and folder endpoints have no handler here — MSW would throw if they were called
      const { result } = renderHook(() => useCreateTeamOrchestrate([{ uid: 'role-1' } as never], true), {
        wrapper: getWrapper({}),
      });

      await act(async () => {
        await result.current.trigger(formModel);
      });

      expect(result.current.rolesCreationStatus).toBeUndefined();
      expect(result.current.folderCreationStatus).toBeUndefined();
    });
  });

  describe('roles creation', () => {
    beforeEach(() => {
      contextSrv.licensedAccessControlEnabled = () => true;
      server.use(setTeamRolesSuccessHandler);
    });

    it('sets loading before the roles API responds', async () => {
      server.use(http.put('/api/access-control/teams/:teamId/roles', async () => delay('infinite')));

      const { result, unmount } = renderHook(() => useCreateTeamOrchestrate([{ uid: 'role-1' } as never], false), {
        wrapper: getWrapper({}),
      });

      act(() => {
        result.current.trigger(formModel);
      });

      await waitFor(() => {
        // Team has resolved (default handler responds immediately), roles request is in-flight
        expect(result.current.teamCreationStatus).toEqual({ state: 'success', data: 'aethyfifmhwcgd' });
        expect(result.current.rolesCreationStatus).toEqual({ state: 'loading' });
      });

      unmount();
    });

    it('reports success when roles are created', async () => {
      const { result } = renderHook(() => useCreateTeamOrchestrate([{ uid: 'role-1' } as never], false), {
        wrapper: getWrapper({}),
      });

      await act(async () => {
        await result.current.trigger(formModel);
      });

      expect(result.current.rolesCreationStatus).toEqual({ state: 'success' });
    });

    it('reports error when the roles API returns an error response', async () => {
      server.use(
        http.put('/api/access-control/teams/:teamId/roles', () =>
          HttpResponse.json({ message: 'Forbidden' }, { status: 403 })
        )
      );

      const { result } = renderHook(() => useCreateTeamOrchestrate([{ uid: 'role-1' } as never], false), {
        wrapper: getWrapper({}),
      });

      await act(async () => {
        await result.current.trigger(formModel);
      });

      expect(result.current.rolesCreationStatus?.state).toBe('error');
    });

    it('skips roles when pendingRoles is empty', async () => {
      // Roles endpoint has no handler here — MSW would throw if it were called
      const { result } = renderHook(() => useCreateTeamOrchestrate([], false), { wrapper: getWrapper({}) });

      await act(async () => {
        await result.current.trigger(formModel);
      });

      expect(result.current.rolesCreationStatus).toBeUndefined();
    });

    it('skips roles when RBAC is not licensed', async () => {
      contextSrv.licensedAccessControlEnabled = () => false;

      const { result } = renderHook(() => useCreateTeamOrchestrate([{ uid: 'role-1' } as never], false), {
        wrapper: getWrapper({}),
      });

      await act(async () => {
        await result.current.trigger(formModel);
      });

      expect(result.current.rolesCreationStatus).toBeUndefined();
    });

    it('skips roles when the user lacks role permissions', async () => {
      contextSrv.hasPermission = () => false;

      const { result } = renderHook(() => useCreateTeamOrchestrate([{ uid: 'role-1' } as never], false), {
        wrapper: getWrapper({}),
      });

      await act(async () => {
        await result.current.trigger(formModel);
      });

      expect(result.current.rolesCreationStatus).toBeUndefined();
    });

    it('sends the correct team id and role uids to the roles API', async () => {
      let capturedRequest: { teamId: string; body: unknown } | undefined;

      server.use(
        http.put<{ teamId: string }>('/api/access-control/teams/:teamId/roles', async ({ params, request }) => {
          capturedRequest = { teamId: params.teamId, body: await request.json() };
          return HttpResponse.json({ message: 'Roles updated' });
        })
      );

      const roles = [{ uid: 'role-1' }, { uid: 'role-2' }] as never[];
      const { result } = renderHook(() => useCreateTeamOrchestrate(roles, false), { wrapper: getWrapper({}) });

      await act(async () => {
        await result.current.trigger(formModel);
      });

      // Default createTeam handler returns teamId: 10
      expect(capturedRequest?.teamId).toBe('10');
      expect(capturedRequest?.body).toEqual({ roleUids: ['role-1', 'role-2'] });
    });
  });

  describe('folder creation', () => {
    it('sets loading before the folder API responds', async () => {
      server.use(http.post('/api/folders', async () => delay('infinite')));

      const { result, unmount } = renderHook(() => useCreateTeamOrchestrate([], true), {
        wrapper: getWrapper({}),
      });

      act(() => {
        result.current.trigger(formModel);
      });

      await waitFor(() => {
        // Team has resolved (default handler responds immediately), folder request is in-flight
        expect(result.current.teamCreationStatus).toEqual({ state: 'success', data: 'aethyfifmhwcgd' });
        expect(result.current.folderCreationStatus).toEqual({ state: 'loading' });
      });

      unmount();
    });

    it('reports success with the folder url returned by the API', async () => {
      const { result } = renderHook(() => useCreateTeamOrchestrate([], true), { wrapper: getWrapper({}) });

      await act(async () => {
        await result.current.trigger(formModel);
      });

      expect(result.current.folderCreationStatus?.state).toBe('success');
      expect(typeof result.current.folderCreationStatus?.data).toBe('string');
    });

    it('reports error when the folder API returns a response with no url', async () => {
      // The hook checks `folderError || !folderData?.url` — a response with no url triggers the error branch.
      // Note: the legacy folder mutation throws on HTTP error responses rather than returning { error },
      // so we simulate error conditions via a missing url in an otherwise successful response.
      server.use(http.post('/api/folders', () => HttpResponse.json({})));

      const { result } = renderHook(() => useCreateTeamOrchestrate([], true), { wrapper: getWrapper({}) });

      await act(async () => {
        await result.current.trigger(formModel);
      });

      expect(result.current.folderCreationStatus?.state).toBe('error');
    });

    it('skips folder creation when autocreateTeamFolder is false', async () => {
      // Folder endpoint has no handler here — MSW would throw if it were called
      const { result } = renderHook(() => useCreateTeamOrchestrate([], false), { wrapper: getWrapper({}) });

      await act(async () => {
        await result.current.trigger(formModel);
      });

      expect(result.current.folderCreationStatus).toBeUndefined();
    });

    it('sends the team name as the folder title to the folders API', async () => {
      let capturedTitle: string | undefined;

      server.use(
        http.post('/api/folders', async ({ request }) => {
          const body = (await request.json()) as { title: string };
          capturedTitle = body.title;
          return HttpResponse.json({ uid: 'new-folder', url: '/dashboards/f/new-folder/test-team' });
        })
      );

      const { result } = renderHook(() => useCreateTeamOrchestrate([], true), { wrapper: getWrapper({}) });

      await act(async () => {
        await result.current.trigger(formModel);
      });

      expect(capturedTitle).toBe(formModel.name);
    });
  });

  describe('combinations of all three API calls', () => {
    beforeEach(() => {
      contextSrv.licensedAccessControlEnabled = () => true;
      server.use(setTeamRolesSuccessHandler);
    });

    it('reports success for team, roles, and folder when all succeed', async () => {
      const { result } = renderHook(() => useCreateTeamOrchestrate([{ uid: 'role-1' } as never], true), {
        wrapper: getWrapper({}),
      });

      await act(async () => {
        await result.current.trigger(formModel);
      });

      expect(result.current.teamCreationStatus).toEqual({ state: 'success', data: 'aethyfifmhwcgd' });
      expect(result.current.rolesCreationStatus).toEqual({ state: 'success' });
      expect(result.current.folderCreationStatus?.state).toBe('success');
    });

    it('still creates folder even when roles creation fails', async () => {
      server.use(
        http.put('/api/access-control/teams/:teamId/roles', () =>
          HttpResponse.json({ message: 'Forbidden' }, { status: 403 })
        )
      );

      const { result } = renderHook(() => useCreateTeamOrchestrate([{ uid: 'role-1' } as never], true), {
        wrapper: getWrapper({}),
      });

      await act(async () => {
        await result.current.trigger(formModel);
      });

      expect(result.current.rolesCreationStatus?.state).toBe('error');
      expect(result.current.folderCreationStatus?.state).toBe('success');
    });

    it('skips both roles and folder when team creation fails', async () => {
      server.use(
        http.post('/api/teams', () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 }))
      );

      const { result } = renderHook(() => useCreateTeamOrchestrate([{ uid: 'role-1' } as never], true), {
        wrapper: getWrapper({}),
      });

      await act(async () => {
        await result.current.trigger(formModel);
      });

      expect(result.current.teamCreationStatus?.state).toBe('error');
      expect(result.current.rolesCreationStatus).toBeUndefined();
      expect(result.current.folderCreationStatus).toBeUndefined();
    });
  });

  describe('when component unmounts during creation', () => {
    beforeEach(() => {
      mockUseMountedState.mockReturnValue(() => false);
    });

    it('shows a success toast for team creation instead of setting state', async () => {
      const { result } = renderHook(() => useCreateTeamOrchestrate([], false), { wrapper: getWrapper({}) });

      await act(async () => {
        await result.current.trigger(formModel);
      });

      expect(result.current.teamCreationStatus).toBeUndefined();
      expect(mockPublish).toHaveBeenCalledWith(expect.objectContaining({ type: AppEvents.alertSuccess.name }));
    });

    it('shows an error toast for team creation failure instead of setting state', async () => {
      server.use(
        http.post('/api/teams', () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 }))
      );

      const { result } = renderHook(() => useCreateTeamOrchestrate([], false), { wrapper: getWrapper({}) });

      await act(async () => {
        await result.current.trigger(formModel);
      });

      expect(result.current.teamCreationStatus).toBeUndefined();
      expect(mockPublish).toHaveBeenCalledWith(expect.objectContaining({ type: AppEvents.alertError.name }));
    });

    it('shows a success toast for folder creation instead of setting state', async () => {
      const { result } = renderHook(() => useCreateTeamOrchestrate([], true), { wrapper: getWrapper({}) });

      await act(async () => {
        await result.current.trigger(formModel);
      });

      expect(result.current.folderCreationStatus).toBeUndefined();
      expect(mockPublish).toHaveBeenCalledWith(expect.objectContaining({ type: AppEvents.alertSuccess.name }));
    });

    it('shows an error toast for folder creation failure instead of setting state', async () => {
      server.use(http.post('/api/folders', () => HttpResponse.json({})));

      const { result } = renderHook(() => useCreateTeamOrchestrate([], true), { wrapper: getWrapper({}) });

      await act(async () => {
        await result.current.trigger(formModel);
      });

      expect(result.current.folderCreationStatus).toBeUndefined();
      expect(mockPublish).toHaveBeenCalledWith(expect.objectContaining({ type: AppEvents.alertError.name }));
    });
  });
});
