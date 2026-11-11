import { renderHook } from '@testing-library/react';

import { AppEvents } from '@grafana/data';
import { setAppEvents } from '@grafana/runtime';
import { type Dashboard } from '@grafana/schema';
import { type RepositoryView, type ResourceWrapper } from 'app/api/clients/provisioning/v0alpha1';
import { type appEvents } from 'app/core/app_events';

import { useProvisionedRequestHandler, type RequestHandlers } from './useProvisionedRequestHandler';

const mockDispatch = jest.fn();
jest.mock('react-redux', () => {
  const actual = jest.requireActual('react-redux');
  return {
    ...actual,
    useDispatch: () => mockDispatch,
  };
});

jest.mock('app/features/browse-dashboards/api/services', () => ({
  PAGE_SIZE: 50,
}));

const githubRepository: RepositoryView = {
  type: 'github',
  name: 'test-repo',
  target: 'folder',
  title: 'Test Repository',
  workflows: [],
};

describe('useProvisionedRequestHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDispatch.mockClear();
  });

  describe('handleSuccess', () => {
    it('should publish success event and call onDismiss', () => {
      const { handlers, mockPublish, render } = setup();

      const { result } = render({ resourceType: 'dashboard', handlers });
      result.current.handleSuccess(createMockResourceWrapper());

      expect(mockPublish).toHaveBeenCalledWith({
        type: AppEvents.alertSuccess.name,
        payload: ['Changes saved successfully'],
      });
      expect(handlers.onDismiss).toHaveBeenCalled();
    });

    it('should call onBranchSuccess when the response carries a branch ref', () => {
      const { handlers, mockPublish, render } = setup();
      const wrapper = createMockResourceWrapper({
        ref: 'feature-branch',
        path: '/path/to/dashboard.json',
        urls: { compareURL: 'http://example.com/edit' },
      });

      const { result } = render({
        repository: { ...githubRepository, branch: 'main' },
        isNewBranch: true,
        resourceType: 'dashboard',
        handlers,
      });
      result.current.handleSuccess(wrapper);

      expect(handlers.onBranchSuccess).toHaveBeenCalledWith(
        {
          ref: 'feature-branch',
          path: '/path/to/dashboard.json',
          urls: { compareURL: 'http://example.com/edit' },
        },
        expect.objectContaining({
          resourceType: 'dashboard',
          repoType: 'github',
        }),
        expect.any(Object),
        wrapper
      );
      expect(handlers.onWriteSuccess).not.toHaveBeenCalled();
      // A new branch shows no toast of either kind; its destination page carries the PR banner.
      expect(mockPublish).not.toHaveBeenCalledWith(expect.objectContaining({ type: AppEvents.alertSuccess.name }));
      expect(mockDispatch.mock.calls.some(([action]) => action?.payload?.component)).toBe(false);
    });

    it('should call onBranchSuccess and toast when the commit landed on an existing branch', () => {
      const { handlers, render } = setup();
      const wrapper = createMockResourceWrapper({ ref: 'feature-branch', path: '/path/to/dashboard.json' });

      const { result } = render({
        repository: { ...githubRepository, branch: 'main' },
        isNewBranch: false,
        resourceType: 'dashboard',
        handlers,
      });
      result.current.handleSuccess(wrapper);

      expect(handlers.onBranchSuccess).toHaveBeenCalled();
      expect(handlers.onWriteSuccess).not.toHaveBeenCalled();
      const component = mockDispatch.mock.calls[0][0].payload.component;
      expect(component.props.branch).toBe('feature-branch');
    });

    it('should show push success with branch link pointing to configured path', () => {
      const { handlers, render } = setup();

      const { result } = render({
        resourceType: 'dashboard',
        repository: {
          ...githubRepository,
          branch: 'main',
          url: 'https://github.com/org/repo',
          path: 'dashboards',
        },
        handlers,
      });
      result.current.handleSuccess(
        createMockResourceWrapper({ urls: { repositoryURL: 'https://github.com/org/repo' } })
      );

      const component = mockDispatch.mock.calls[0][0].payload.component;
      expect(component.props).toEqual(
        expect.objectContaining({
          branch: 'main',
          url: 'https://github.com/org/repo/tree/main/dashboards',
        })
      );
    });

    it('should fall back to repositoryURL when no path is configured', () => {
      const { handlers, render } = setup();

      const { result } = render({
        resourceType: 'dashboard',
        repository: {
          ...githubRepository,
          branch: 'main',
          url: 'https://github.com/org/repo',
        },
        handlers,
      });
      result.current.handleSuccess(
        createMockResourceWrapper({ urls: { repositoryURL: 'https://github.com/org/repo' } })
      );

      const component = mockDispatch.mock.calls[0][0].payload.component;
      expect(component.props).toEqual(
        expect.objectContaining({
          branch: 'main',
          url: 'https://github.com/org/repo',
        })
      );
    });

    it('should call onWriteSuccess when the response carries no ref', () => {
      const { handlers, render } = setup();
      const wrapper = createMockResourceWrapper();

      const { result } = render({
        repository: { ...githubRepository, branch: 'main' },
        resourceType: 'dashboard',
        handlers,
      });
      result.current.handleSuccess(wrapper);

      expect(handlers.onWriteSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'Dashboard', metadata: expect.objectContaining({ name: 'test-dashboard' }) }),
        wrapper
      );
      expect(handlers.onDismiss).toHaveBeenCalled();
    });

    it('should refetch folder children after a direct write when folderUID is provided', () => {
      const { handlers, render } = setup();

      const { result } = render({
        repository: { ...githubRepository, branch: 'main' },
        folderUID: 'folder-1',
        handlers,
      });
      result.current.handleSuccess(createMockResourceWrapper());

      // refetchChildren is a thunk; assert a function was dispatched alongside the notification
      expect(mockDispatch.mock.calls.some(([action]) => typeof action === 'function')).toBe(true);
    });
  });

  describe('overrides', () => {
    it('should merge per-call overrides over hook options', () => {
      const { handlers, mockPublish, render } = setup();
      const wrapper = createMockResourceWrapper({ ref: 'feature-branch', path: '/dashboard.json' });

      const { result } = render({ resourceType: 'dashboard', isNewBranch: false, handlers });
      result.current.handleSuccess(wrapper, { isNewBranch: true });

      // The override wins: a new branch suppresses the toast the hook options would have shown.
      expect(mockPublish).not.toHaveBeenCalledWith(expect.objectContaining({ type: AppEvents.alertSuccess.name }));
      expect(mockDispatch.mock.calls.some(([action]) => action?.payload?.component)).toBe(false);
      expect(handlers.onBranchSuccess).toHaveBeenCalled();
    });

    it('should allow overriding handlers per call', () => {
      const { handlers, render } = setup();
      const overrideWrite = jest.fn();

      const { result } = render({ resourceType: 'dashboard', handlers });
      result.current.handleSuccess(createMockResourceWrapper(), { handlers: { onWriteSuccess: overrideWrite } });

      expect(overrideWrite).toHaveBeenCalled();
      expect(handlers.onWriteSuccess).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should not throw when no handlers are provided', () => {
      const { render } = setup();

      const { result } = render({});

      expect(() => {
        result.current.handleSuccess(createMockResourceWrapper());
      }).not.toThrow();
    });
  });
});

// Helper function to create a properly structured mock ResourceWrapper
function createMockResourceWrapper(overrides: Partial<ResourceWrapper> = {}): ResourceWrapper {
  return {
    repository: {
      name: 'test-repo',
      namespace: 'default',
      title: 'Test Repository',
      type: 'git',
    },
    resource: {
      type: {
        kind: 'Dashboard',
      },
      upsert: {
        apiVersion: 'v1',
        kind: 'Dashboard',
        metadata: { name: 'test-dashboard', uid: 'test-uid' },
        spec: { title: 'Test Dashboard' },
      },
    },
    ...overrides,
  };
}

function setup() {
  const mockPublish = jest.fn();

  setAppEvents({ publish: mockPublish } as unknown as typeof appEvents);

  const handlers: RequestHandlers<Dashboard> = {
    onBranchSuccess: jest.fn(),
    onWriteSuccess: jest.fn(),
    onDismiss: jest.fn(),
  };

  const render = (options: Parameters<typeof useProvisionedRequestHandler<Dashboard>>[0]) =>
    renderHook(() => useProvisionedRequestHandler<Dashboard>(options));

  return {
    handlers,
    mockPublish,
    render,
  };
}
