import { renderHook } from '@testing-library/react';

import { AppEvents } from '@grafana/data/types';
import { setAppEvents } from '@grafana/runtime';
import { type Dashboard } from '@grafana/schema';
import { type ResourceWrapper } from 'app/api/clients/provisioning/v0alpha1';
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

describe('useProvisionedRequestHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDispatch.mockClear();
  });

  describe('error handling', () => {
    it('should call onError handler with correct parameters', () => {
      const { request, handlers } = setup({
        requestOverrides: {
          isError: true,
          isSuccess: false,
          error: new Error('Test error'),
        },
      });

      renderHook(() =>
        useProvisionedRequestHandler({
          request,
          repository: {
            type: 'github',
            name: 'test-repo',
            target: 'folder',
            title: 'Test Repository',
            workflows: [],
          },
          resourceType: 'dashboard',
          handlers,
        })
      );

      expect(handlers.onError).toHaveBeenCalledWith(
        new Error('Test error'),
        expect.objectContaining({
          resourceType: 'dashboard',
          repoType: 'github',
        })
      );
      expect(handlers.onBranchSuccess).not.toHaveBeenCalled();
      expect(handlers.onWriteSuccess).not.toHaveBeenCalled();
    });
  });

  describe('success handling', () => {
    it('should publish success event and call onDismiss', () => {
      const { request, handlers, mockPublish } = setup({
        requestOverrides: {
          isError: false,
          isSuccess: true,
          data: createMockResourceWrapper(),
        },
      });

      renderHook(() =>
        useProvisionedRequestHandler({
          request,
          resourceType: 'dashboard',
          handlers,
        })
      );

      expect(mockPublish).toHaveBeenCalledWith({
        type: AppEvents.alertSuccess.name,
        payload: ['Changes saved successfully'],
      });
      expect(handlers.onDismiss).toHaveBeenCalled();
    });

    it('should call onBranchSuccess for branch workflow', () => {
      const { request, handlers, mockPublish } = setup({
        requestOverrides: {
          isError: false,
          isSuccess: true,
          data: createMockResourceWrapper({
            ref: 'feature-branch',
            path: '/path/to/dashboard.json',
            urls: { compareURL: 'http://example.com/edit' },
          }),
        },
      });

      renderHook(() =>
        useProvisionedRequestHandler({
          request,
          workflow: 'branch',
          resourceType: 'dashboard',
          handlers,
        })
      );

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
        expect.any(Object)
      );
      expect(handlers.onWriteSuccess).not.toHaveBeenCalled();
      // Branch workflow should not show success alert (PR banner handles it)
      expect(mockPublish).not.toHaveBeenCalledWith(expect.objectContaining({ type: AppEvents.alertSuccess.name }));
    });

    it('should show push success with branch link when repository info is available', () => {
      const { request, handlers } = setup({
        requestOverrides: {
          isError: false,
          isSuccess: true,
          data: createMockResourceWrapper({
            urls: { repositoryURL: 'https://github.com/org/repo' },
          }),
        },
      });

      renderHook(() =>
        useProvisionedRequestHandler({
          request,
          workflow: 'write',
          resourceType: 'dashboard',
          repository: {
            type: 'github',
            name: 'test-repo',
            target: 'folder',
            title: 'Test Repository',
            workflows: [],
            branch: 'main',
            url: 'https://github.com/org/repo',
          },
          handlers,
        })
      );

      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            component: expect.anything(),
          }),
        })
      );
    });

    it('should call onWriteSuccess for write workflow', () => {
      const { request, handlers } = setup({
        requestOverrides: {
          isError: false,
          isSuccess: true,
          data: createMockResourceWrapper(),
        },
      });

      renderHook(() =>
        useProvisionedRequestHandler({
          request,
          workflow: 'write',
          resourceType: 'dashboard',
          handlers,
        })
      );

      expect(handlers.onWriteSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'Dashboard', metadata: expect.objectContaining({ name: 'test-dashboard' }) })
      );
      expect(handlers.onDismiss).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should not call any handlers when request is loading', () => {
      const { request, handlers, mockPublish } = setup({
        requestOverrides: {
          isError: false,
          isSuccess: false,
          isLoading: true,
        },
      });

      renderHook(() =>
        useProvisionedRequestHandler({
          request,
          handlers,
        })
      );

      expect(handlers.onError).not.toHaveBeenCalled();
      expect(handlers.onBranchSuccess).not.toHaveBeenCalled();
      expect(handlers.onWriteSuccess).not.toHaveBeenCalled();
      expect(mockPublish).not.toHaveBeenCalled();
    });

    it('should not call handlers when success but no data', () => {
      const { request, handlers, mockPublish } = setup({
        requestOverrides: {
          isError: false,
          isSuccess: true,
          data: undefined,
        },
      });

      renderHook(() =>
        useProvisionedRequestHandler({
          request,
          handlers,
        })
      );

      expect(handlers.onWriteSuccess).not.toHaveBeenCalled();
      expect(handlers.onBranchSuccess).not.toHaveBeenCalled();
      expect(mockPublish).not.toHaveBeenCalled();
    });

    it('should not throw when optional handlers are not provided', () => {
      const { request } = setup({
        requestOverrides: { isError: false, isSuccess: true },
        handlersOverrides: {},
      });

      expect(() => {
        renderHook(() =>
          useProvisionedRequestHandler({
            request,
            handlers: {},
          })
        );
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

function setup({
  requestOverrides = {},
  handlersOverrides = {},
}: {
  requestOverrides?: Partial<{
    isError: boolean;
    isSuccess: boolean;
    isLoading?: boolean;
    error?: unknown;
    data?: ResourceWrapper;
  }>;
  handlersOverrides?: Partial<RequestHandlers<Dashboard>>;
} = {}) {
  const mockPublish = jest.fn();

  setAppEvents({ publish: mockPublish } as unknown as typeof appEvents);

  const request = {
    isError: false,
    isSuccess: false,
    isLoading: false,
    error: undefined,
    data: undefined,
    ...requestOverrides,
  };

  const handlers: RequestHandlers<Dashboard> = {
    onError: jest.fn(),
    onBranchSuccess: jest.fn(),
    onWriteSuccess: jest.fn(),
    onDismiss: jest.fn(),
    ...handlersOverrides,
  };

  return {
    request,
    handlers,
    mockPublish,
  };
}
