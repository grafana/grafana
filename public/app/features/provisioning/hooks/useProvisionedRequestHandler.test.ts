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

  describe('handleError', () => {
    it('should call onError handler with correct parameters', () => {
      const { handlers, mockPublish, render } = setup();

      const { result } = render({
        repository: githubRepository,
        resourceType: 'dashboard',
        handlers,
      });
      result.current.handleError(new Error('Test error'));

      expect(handlers.onError).toHaveBeenCalledWith(
        new Error('Test error'),
        expect.objectContaining({
          resourceType: 'dashboard',
          repoType: 'github',
        })
      );
      expect(handlers.onBranchSuccess).not.toHaveBeenCalled();
      expect(handlers.onWriteSuccess).not.toHaveBeenCalled();
      expect(mockPublish).not.toHaveBeenCalled();
    });
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

    it('should call onBranchSuccess for branch workflow', () => {
      const { handlers, mockPublish, render } = setup();
      const wrapper = createMockResourceWrapper({
        ref: 'feature-branch',
        path: '/path/to/dashboard.json',
        urls: { compareURL: 'http://example.com/edit' },
      });

      const { result } = render({ workflow: 'branch', resourceType: 'dashboard', handlers });
      result.current.handleSuccess(wrapper);

      expect(handlers.onBranchSuccess).toHaveBeenCalledWith(
        {
          ref: 'feature-branch',
          path: '/path/to/dashboard.json',
          urls: { compareURL: 'http://example.com/edit' },
        },
        expect.objectContaining({
          resourceType: 'dashboard',
          repoType: 'git',
          workflow: 'branch',
        }),
        expect.any(Object),
        wrapper
      );
      expect(handlers.onWriteSuccess).not.toHaveBeenCalled();
      // Branch workflow should not show success alert (PR banner handles it)
      expect(mockPublish).not.toHaveBeenCalledWith(expect.objectContaining({ type: AppEvents.alertSuccess.name }));
    });

    it('should show push success with branch link pointing to configured path', () => {
      const { handlers, render } = setup();

      const { result } = render({
        workflow: 'write',
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
        workflow: 'write',
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

    it('should call onWriteSuccess for write workflow', () => {
      const { handlers, render } = setup();
      const wrapper = createMockResourceWrapper();

      const { result } = render({ workflow: 'write', resourceType: 'dashboard', handlers });
      result.current.handleSuccess(wrapper);

      expect(handlers.onWriteSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'Dashboard', metadata: expect.objectContaining({ name: 'test-dashboard' }) }),
        wrapper
      );
      expect(handlers.onDismiss).toHaveBeenCalled();
    });

    it('should refetch folder children for write workflow when folderUID is provided', () => {
      const { handlers, render } = setup();

      const { result } = render({ workflow: 'write', folderUID: 'folder-1', handlers });
      result.current.handleSuccess(createMockResourceWrapper());

      // refetchChildren is a thunk; assert a function was dispatched alongside the notification
      expect(mockDispatch.mock.calls.some(([action]) => typeof action === 'function')).toBe(true);
    });
  });

  describe('overrides', () => {
    it('should merge per-call overrides over hook options', () => {
      const { handlers, render } = setup();
      const wrapper = createMockResourceWrapper({ ref: 'feature-branch', path: '/dashboard.json' });

      const { result } = render({ workflow: 'write', resourceType: 'dashboard', handlers });
      result.current.handleSuccess(wrapper, { workflow: 'branch' });

      expect(handlers.onBranchSuccess).toHaveBeenCalled();
      expect(handlers.onWriteSuccess).not.toHaveBeenCalled();
    });

    it('should allow overriding handlers per call', () => {
      const { handlers, render } = setup();
      const overrideError = jest.fn();

      const { result } = render({ handlers });
      result.current.handleError(new Error('boom'), { handlers: { onError: overrideError } });

      expect(overrideError).toHaveBeenCalledWith(new Error('boom'), expect.objectContaining({ repoType: 'git' }));
      expect(handlers.onError).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should not throw when no handlers are provided', () => {
      const { render } = setup();

      const { result } = render({});

      expect(() => {
        result.current.handleSuccess(createMockResourceWrapper());
        result.current.handleError(new Error('Test error'));
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
    onError: jest.fn(),
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
