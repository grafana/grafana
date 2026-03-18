import { renderHook, act } from '@testing-library/react';
import { Location } from 'history';

import { locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import { appEvents } from 'app/core/app_events';
import { updateDashboardName } from 'app/core/reducers/navBarTree';
import { SaveDashboardResponseDTO } from 'app/types/dashboard';
import { DashboardSavedEvent } from 'app/types/events';

import { updateDashboardUidLastUsedDatasource } from '../../dashboard/utils/dashboard';
import { DashboardScene } from '../scene/DashboardScene';
import { DashboardInteractions } from '../utils/interactions';
import { trackDashboardSceneCreatedOrSaved } from '../utils/tracking';

import { useSaveDashboard } from './useSaveDashboard';

const saveDashboardMutationMock = jest.fn();
const notifyAppMock = { success: jest.fn(), error: jest.fn(), warning: jest.fn() };
const dispatchMock = jest.fn();

jest.mock('app/features/browse-dashboards/api/browseDashboardsAPI', () => ({
  ...jest.requireActual('app/features/browse-dashboards/api/browseDashboardsAPI'),
  useSaveDashboardMutation: () => [saveDashboardMutationMock],
}));

jest.mock('app/core/copy/appNotification', () => ({
  useAppNotification: () => notifyAppMock,
}));

jest.mock('app/types/store', () => ({
  ...jest.requireActual('app/types/store'),
  useDispatch: () => dispatchMock,
}));

jest.mock('app/core/app_events', () => ({
  appEvents: {
    subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
    publish: jest.fn(),
  },
}));

jest.mock('../../dashboard/utils/dashboard', () => ({
  updateDashboardUidLastUsedDatasource: jest.fn(),
}));

jest.mock('../utils/interactions', () => ({
  DashboardInteractions: {
    dashboardCopied: jest.fn(),
  },
}));

jest.mock('../utils/tracking', () => ({
  trackDashboardSceneCreatedOrSaved: jest.fn(),
}));

function buildSaveResult(overrides: Partial<SaveDashboardResponseDTO> = {}): SaveDashboardResponseDTO {
  return {
    slug: 'my-dashboard',
    status: 'success',
    uid: 'abc123',
    url: '/d/abc123',
    version: 2,
    ...overrides,
  };
}

function buildScene(overrides: Partial<{ title: string; meta: Record<string, unknown> }> = {}) {
  return {
    state: {
      title: overrides.title ?? 'My Dashboard',
      meta: { slug: 'my-dashboard', isStarred: false, ...(overrides.meta ?? {}) },
    },
    getSaveModel: jest.fn().mockReturnValue({ title: 'My Dashboard', uid: 'abc123' }),
    getSaveAsModel: jest.fn().mockReturnValue({ title: 'Copy of My Dashboard', uid: '' }),
    saveCompleted: jest.fn(),
    getTransformationCounts: jest.fn().mockReturnValue({}),
    getExpressionCounts: jest.fn().mockReturnValue({}),
  } as unknown as DashboardScene;
}

function buildDefaultOptions() {
  return {
    folderUid: 'folder-1',
    message: 'Updated layout',
    overwrite: false,
    k8s: undefined,
  };
}

function buildLocation(overrides: Partial<Location> = {}): Location {
  return {
    pathname: '/d/abc123',
    search: '',
    hash: '',
    state: undefined,
    key: 'default',
    ...overrides,
  };
}

describe('useSaveDashboard()', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.spyOn(locationService, 'getLocation').mockReturnValue(buildLocation());
    jest.spyOn(locationService, 'push').mockImplementation(() => {});
    jest.spyOn(locationUtil, 'stripBaseFromUrl').mockImplementation((url) => url);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('returns initial idle state', () => {
    const { result } = renderHook(() => useSaveDashboard());

    expect(result.current.state.loading).toBe(false);
    expect(result.current.state.error).toBeUndefined();
    expect(result.current.onSaveDashboard).toEqual(expect.any(Function));
  });

  describe('when saving a dashboard', () => {
    test('calls the save mutation with the scene save model and options', async () => {
      const scene = buildScene();
      const options = buildDefaultOptions();
      saveDashboardMutationMock.mockResolvedValue({ data: buildSaveResult() });

      const { result } = renderHook(() => useSaveDashboard());

      await act(() => result.current.onSaveDashboard(scene, options));

      expect(saveDashboardMutationMock).toHaveBeenCalledWith({
        dashboard: { title: 'My Dashboard', uid: 'abc123' },
        folderUid: 'folder-1',
        message: 'Updated layout',
        overwrite: false,
        showErrorAlert: false,
        k8s: undefined,
      });
    });

    test('calls scene.saveCompleted with the save model and result data', async () => {
      const scene = buildScene();
      const saveResult = buildSaveResult();
      saveDashboardMutationMock.mockResolvedValue({ data: saveResult });

      const { result } = renderHook(() => useSaveDashboard());

      await act(() => result.current.onSaveDashboard(scene, buildDefaultOptions()));

      expect(scene.saveCompleted).toHaveBeenCalledWith(
        { title: 'My Dashboard', uid: 'abc123' },
        expect.objectContaining({ uid: 'abc123', url: '/d/abc123' }),
        'folder-1'
      );
    });

    test('publishes a DashboardSavedEvent', async () => {
      const scene = buildScene();
      saveDashboardMutationMock.mockResolvedValue({ data: buildSaveResult() });

      const { result } = renderHook(() => useSaveDashboard());

      await act(() => result.current.onSaveDashboard(scene, buildDefaultOptions()));

      expect(appEvents.publish).toHaveBeenCalledWith(expect.any(DashboardSavedEvent));
    });

    test('shows a success notification', async () => {
      const scene = buildScene();
      saveDashboardMutationMock.mockResolvedValue({ data: buildSaveResult() });

      const { result } = renderHook(() => useSaveDashboard());

      await act(() => result.current.onSaveDashboard(scene, buildDefaultOptions()));

      expect(notifyAppMock.success).toHaveBeenCalledWith('Dashboard saved');
    });

    test('calls updateDashboardUidLastUsedDatasource with the result UID', async () => {
      const scene = buildScene();
      saveDashboardMutationMock.mockResolvedValue({ data: buildSaveResult({ uid: 'saved-uid' }) });

      const { result } = renderHook(() => useSaveDashboard());

      await act(() => result.current.onSaveDashboard(scene, buildDefaultOptions()));

      expect(updateDashboardUidLastUsedDatasource).toHaveBeenCalledWith('saved-uid');
    });

    test('navigates to the new URL when it differs from the current location', async () => {
      const scene = buildScene();
      saveDashboardMutationMock.mockResolvedValue({ data: buildSaveResult({ url: '/d/new-uid' }) });
      jest
        .spyOn(locationService, 'getLocation')
        .mockReturnValue(buildLocation({ pathname: '/d/old-uid', search: '?orgId=1' }));

      const { result } = renderHook(() => useSaveDashboard());

      await act(() => result.current.onSaveDashboard(scene, buildDefaultOptions()));
      jest.runAllTimers();

      expect(locationService.push).toHaveBeenCalledWith({ pathname: '/d/new-uid', search: '?orgId=1' });
    });

    test('does not navigate when the URL has not changed', async () => {
      const scene = buildScene();
      saveDashboardMutationMock.mockResolvedValue({ data: buildSaveResult({ url: '/d/abc123' }) });
      jest.spyOn(locationService, 'getLocation').mockReturnValue(buildLocation());

      const { result } = renderHook(() => useSaveDashboard());

      await act(() => result.current.onSaveDashboard(scene, buildDefaultOptions()));
      jest.runAllTimers();

      expect(locationService.push).not.toHaveBeenCalled();
    });

    test('dispatches updateDashboardName when the dashboard is starred', async () => {
      const scene = buildScene({ meta: { isStarred: true } });
      saveDashboardMutationMock.mockResolvedValue({ data: buildSaveResult({ uid: 'abc123', url: '/d/abc123' }) });

      const { result } = renderHook(() => useSaveDashboard());

      await act(() => result.current.onSaveDashboard(scene, buildDefaultOptions()));

      expect(dispatchMock).toHaveBeenCalledWith(
        updateDashboardName({ id: 'abc123', title: 'My Dashboard', url: '/d/abc123' })
      );
    });

    test('does not dispatch updateDashboardName when the dashboard is not starred', async () => {
      const scene = buildScene({ meta: { isStarred: false } });
      saveDashboardMutationMock.mockResolvedValue({ data: buildSaveResult() });

      const { result } = renderHook(() => useSaveDashboard());

      await act(() => result.current.onSaveDashboard(scene, buildDefaultOptions()));

      expect(dispatchMock).not.toHaveBeenCalled();
    });

    test('returns the original result data', async () => {
      const scene = buildScene();
      const saveResult = buildSaveResult();
      saveDashboardMutationMock.mockResolvedValue({ data: saveResult });

      const { result } = renderHook(() => useSaveDashboard());

      let returnValue: SaveDashboardResponseDTO | undefined;
      await act(async () => {
        returnValue = await result.current.onSaveDashboard(scene, buildDefaultOptions());
      });

      expect(returnValue).toEqual(saveResult);
    });
  });

  describe('when saving as a copy', () => {
    test('calls scene.getSaveAsModel instead of getSaveModel', async () => {
      const scene = buildScene();
      saveDashboardMutationMock.mockResolvedValue({ data: buildSaveResult() });

      const { result } = renderHook(() => useSaveDashboard(true));

      await act(() =>
        result.current.onSaveDashboard(scene, {
          ...buildDefaultOptions(),
          saveAsCopy: true,
          isNew: true,
          title: 'Copy title',
          description: 'Copy desc',
          copyTags: true,
        })
      );

      expect(scene.getSaveAsModel).toHaveBeenCalledWith({
        isNew: true,
        title: 'Copy title',
        description: 'Copy desc',
        copyTags: true,
      });
      expect(saveDashboardMutationMock).toHaveBeenCalledWith(
        expect.objectContaining({ dashboard: { title: 'Copy of My Dashboard', uid: '' } })
      );
    });

    test('tracks DashboardInteractions.dashboardCopied', async () => {
      const scene = buildScene();
      saveDashboardMutationMock.mockResolvedValue({ data: buildSaveResult({ url: '/d/copy-uid' }) });

      const { result } = renderHook(() => useSaveDashboard(true));

      await act(() => result.current.onSaveDashboard(scene, buildDefaultOptions()));

      expect(DashboardInteractions.dashboardCopied).toHaveBeenCalledWith({
        name: 'My Dashboard',
        url: '/d/copy-uid',
      });
      expect(trackDashboardSceneCreatedOrSaved).not.toHaveBeenCalled();
    });
  });

  describe('when not saving as a copy', () => {
    test('calls trackDashboardSceneCreatedOrSaved with correct arguments', async () => {
      const scene = buildScene();
      const transformationCounts = { sum: 1 };
      const expressionCounts = { math: 2 };
      (scene.getTransformationCounts as jest.Mock).mockReturnValue(transformationCounts);
      (scene.getExpressionCounts as jest.Mock).mockReturnValue(expressionCounts);
      saveDashboardMutationMock.mockResolvedValue({ data: buildSaveResult({ url: '/d/abc123' }) });

      const { result } = renderHook(() => useSaveDashboard(false));

      await act(() => result.current.onSaveDashboard(scene, { ...buildDefaultOptions(), isNew: true }));

      expect(trackDashboardSceneCreatedOrSaved).toHaveBeenCalledWith(true, scene, {
        name: 'My Dashboard',
        url: '/d/abc123',
        transformation_counts: transformationCounts,
        expression_counts: expressionCounts,
      });
      expect(DashboardInteractions.dashboardCopied).not.toHaveBeenCalled();
    });
  });

  describe('slug patching', () => {
    test('when result has no slug but scene has a slug, patches resultData.slug and resultData.url', async () => {
      const scene = buildScene({ meta: { slug: 'scene-slug' } });
      saveDashboardMutationMock.mockResolvedValue({
        data: buildSaveResult({ slug: '', url: '/d/abc123' }),
      });

      const { result } = renderHook(() => useSaveDashboard());

      await act(() => result.current.onSaveDashboard(scene, buildDefaultOptions()));

      expect(scene.saveCompleted).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ slug: 'scene-slug', url: '/d/abc123/scene-slug' }),
        expect.anything()
      );
    });

    test('when result already has a slug, does not patch', async () => {
      const scene = buildScene({ meta: { slug: 'scene-slug' } });
      saveDashboardMutationMock.mockResolvedValue({
        data: buildSaveResult({ slug: 'result-slug', url: '/d/abc123' }),
      });

      const { result } = renderHook(() => useSaveDashboard());

      await act(() => result.current.onSaveDashboard(scene, buildDefaultOptions()));

      expect(scene.saveCompleted).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ slug: 'result-slug', url: '/d/abc123' }),
        expect.anything()
      );
    });
  });

  describe('when rawDashboardJSON is provided', () => {
    test('uses rawDashboardJSON instead of scene.getSaveModel()', async () => {
      const scene = buildScene();
      const rawJSON = { title: 'Raw JSON Dashboard', uid: 'raw-uid' } as Dashboard;
      saveDashboardMutationMock.mockResolvedValue({ data: buildSaveResult() });

      const { result } = renderHook(() => useSaveDashboard());

      await act(() => result.current.onSaveDashboard(scene, { ...buildDefaultOptions(), rawDashboardJSON: rawJSON }));

      expect(scene.getSaveModel).not.toHaveBeenCalled();
      expect(saveDashboardMutationMock).toHaveBeenCalledWith(expect.objectContaining({ dashboard: rawJSON }));
    });
  });

  describe('when the save mutation returns an error', () => {
    test('throws the error so useAsyncFn captures it in state.error', async () => {
      const scene = buildScene();
      const saveError = { status: 412, data: { status: 'version-mismatch', message: 'conflict' } };
      saveDashboardMutationMock.mockResolvedValue({ error: saveError });

      const { result } = renderHook(() => useSaveDashboard());

      await act(() => result.current.onSaveDashboard(scene, buildDefaultOptions()));

      expect(result.current.state.error).toEqual(saveError);
      expect(scene.saveCompleted).not.toHaveBeenCalled();
      expect(notifyAppMock.success).not.toHaveBeenCalled();
    });
  });
});
