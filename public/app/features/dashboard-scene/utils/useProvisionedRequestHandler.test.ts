import { renderHook } from '@testing-library/react';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import {
  DeleteRepositoryFilesWithPathApiResponse,
  GetRepositoryFilesWithPathApiResponse,
  ResourceWrapper,
} from 'app/api/clients/provisioning/v0alpha1';
import { Resource } from 'app/features/apiserver/types';

import { DashboardScene } from '../scene/DashboardScene';

import { useProvisionedRequestHandler } from './useProvisionedRequestHandler';

// Mock dependencies
jest.mock('@grafana/runtime', () => ({
  getAppEvents: jest.fn(),
}));

jest.mock('@grafana/i18n', () => ({
  t: jest.fn((key: string, defaultValue: string) => defaultValue),
}));

const mockGetAppEvents = jest.mocked(getAppEvents);

describe('useProvisionedRequestHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when request has an error', () => {
    it('should call onError handler', () => {
      const { request, handlers, dashboard } = setup({
        requestOverrides: {
          isError: true,
          isSuccess: false,
          error: new Error('Test error'),
        },
      });

      renderHook(() =>
        useProvisionedRequestHandler({
          dashboard,
          request,
          handlers,
        })
      );

      expect(handlers.onError).toHaveBeenCalledWith(new Error('Test error'));
      expect(handlers.onBranchSuccess).not.toHaveBeenCalled();
      expect(handlers.onWriteSuccess).not.toHaveBeenCalled();
      expect(handlers.onNewDashboardSuccess).not.toHaveBeenCalled();
    });

    it('should call onError handler with repository type', () => {
      const { request, handlers, dashboard } = setup({
        requestOverrides: {
          isError: true,
          isSuccess: false,
          error: new Error('Test error'),
        },
      });

      renderHook(() =>
        useProvisionedRequestHandler({
          dashboard,
          request,
          repository: {
            type: 'github',
            name: 'test-repo',
            target: 'folder',
            title: 'Test Repository',
            workflows: [],
          },
          handlers,
        })
      );

      expect(handlers.onError).toHaveBeenCalledWith(new Error('Test error'), 'github');
    });
  });

  describe('when request is successful', () => {
    it('should set dashboard isDirty to false', () => {
      const { request, handlers, dashboard } = setup({
        requestOverrides: {
          isError: false,
          isSuccess: true,
          data: {
            ref: 'main',
            path: '/path/to/dashboard',
          },
        },
        workflowOverride: 'branch',
      });

      renderHook(() =>
        useProvisionedRequestHandler({
          dashboard,
          request,
          workflow: 'branch',
          handlers,
        })
      );

      expect(dashboard.setState).toHaveBeenCalledWith({ isDirty: false });
    });

    it('should publish success event', () => {
      const { request, handlers, dashboard, mockPublish } = setup({
        requestOverrides: {
          isError: false,
          isSuccess: true,
          data: {},
        },
      });

      renderHook(() =>
        useProvisionedRequestHandler({
          dashboard,
          request,
          handlers,
        })
      );

      expect(mockPublish).toHaveBeenCalledWith({
        type: AppEvents.alertSuccess.name,
        payload: ['Dashboard changes saved successfully'],
      });
    });

    describe('branch workflow', () => {
      it('should call onBranchSuccess when workflow is branch and data has ref and path', () => {
        const { request, handlers, dashboard } = setup({
          requestOverrides: {
            isError: false,
            isSuccess: true,
            data: {
              ref: 'feature-branch',
              path: '/path/to/dashboard.json',
              urls: { compareURL: 'http://example.com/edit' },
            },
          },
          workflowOverride: 'branch',
        });

        renderHook(() =>
          useProvisionedRequestHandler({
            dashboard,
            request,
            workflow: 'branch',
            handlers,
          })
        );

        expect(handlers.onBranchSuccess).toHaveBeenCalledWith({
          ref: 'feature-branch',
          path: '/path/to/dashboard.json',
          urls: { compareURL: 'http://example.com/edit' },
        });
        expect(handlers.onWriteSuccess).not.toHaveBeenCalled();
      });

      it('should not call onBranchSuccess when ref is missing', () => {
        const { request, handlers, dashboard } = setup({
          requestOverrides: {
            isError: false,
            isSuccess: true,
            data: {
              path: '/path/to/dashboard.json',
            },
          },
          workflowOverride: 'branch',
        });

        renderHook(() =>
          useProvisionedRequestHandler({
            dashboard,
            request,
            workflow: 'branch',
            handlers,
          })
        );

        expect(handlers.onBranchSuccess).not.toHaveBeenCalled();
        expect(handlers.onWriteSuccess).toHaveBeenCalled();
      });
    });

    describe('new dashboard flow', () => {
      it('should call onNewDashboardSuccess when isNew is true and resource.upsert exists', () => {
        const mockUpsertResource = {
          metadata: {
            name: 'test-dashboard',
            uid: 'test-uid',
            resourceVersion: '1',
            creationTimestamp: new Date().toISOString(),
          },
          spec: { title: 'Test Dashboard' } as Dashboard,
          apiVersion: 'v1',
          kind: 'Dashboard',
        };

        const mockResource = {
          metadata: {
            name: 'test-dashboard',
            uid: 'test-uid',
            resourceVersion: '1',
            creationTimestamp: new Date().toISOString(),
          },
          spec: { title: 'Test Dashboard' } as Dashboard,
          apiVersion: 'v1',
          kind: 'Dashboard',
          upsert: mockUpsertResource,
        } as Resource<Dashboard> & { upsert: Resource<Dashboard> };

        const { request, handlers, dashboard } = setup({
          requestOverrides: {
            isError: false,
            isSuccess: true,
            data: {
              repository: 'test-repo',
              resource: mockResource,
            } as unknown as ProvisionedRequestData,
          },
        });

        renderHook(() =>
          useProvisionedRequestHandler({
            dashboard,
            request,
            handlers,
            isNew: true,
          })
        );

        expect(handlers.onNewDashboardSuccess).toHaveBeenCalledWith(mockResource.upsert);
        expect(handlers.onWriteSuccess).not.toHaveBeenCalled();
      });

      it('should not call onNewDashboardSuccess when isNew is false', () => {
        const { request, handlers, dashboard } = setup({
          requestOverrides: {
            isError: false,
            isSuccess: true,
            data: {
              repository: 'test-repo',
              resource: {
                upsert: {
                  apiVersion: 'v1',
                  kind: 'Dashboard',
                  metadata: { name: 'test-dashboard' },
                  spec: { title: 'Test Dashboard' } as Dashboard,
                },
                metadata: { name: 'test-dashboard' },
                spec: { title: 'Test Dashboard' } as Dashboard,
                apiVersion: 'v1',
                kind: 'Dashboard',
              } as unknown as Resource<Dashboard>,
            } as unknown as ProvisionedRequestData,
          },
        });

        renderHook(() =>
          useProvisionedRequestHandler({
            dashboard,
            request,
            handlers,
            isNew: false,
          })
        );

        expect(handlers.onNewDashboardSuccess).not.toHaveBeenCalled();
        expect(handlers.onWriteSuccess).toHaveBeenCalled();
      });

      it('should not call onNewDashboardSuccess when resource.upsert is missing', () => {
        const { request, handlers, dashboard } = setup({
          requestOverrides: {
            isError: false,
            isSuccess: true,
            data: {
              resource: {},
            } as ResourceWrapper,
          },
        });

        renderHook(() =>
          useProvisionedRequestHandler({
            dashboard,
            request,
            handlers,
            isNew: true,
          })
        );

        expect(handlers.onNewDashboardSuccess).not.toHaveBeenCalled();
        expect(handlers.onWriteSuccess).toHaveBeenCalled();
      });
    });

    describe('write workflow', () => {
      it('should call onWriteSuccess as fallback', () => {
        const { request, handlers, dashboard } = setup({
          requestOverrides: {
            isError: false,
            isSuccess: true,
            data: {} as GetRepositoryFilesWithPathApiResponse,
          },
        });

        renderHook(() =>
          useProvisionedRequestHandler({
            dashboard,
            request,
            handlers,
          })
        );

        expect(handlers.onWriteSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('when request is neither error nor success', () => {
    it('should not call any handlers', () => {
      const { request, handlers, dashboard, mockPublish } = setup({
        requestOverrides: {
          isError: false,
          isSuccess: false,
          isLoading: true,
        },
      });

      renderHook(() =>
        useProvisionedRequestHandler({
          dashboard,
          request,
          handlers,
        })
      );

      expect(handlers.onError).not.toHaveBeenCalled();
      expect(handlers.onBranchSuccess).not.toHaveBeenCalled();
      expect(handlers.onWriteSuccess).not.toHaveBeenCalled();
      expect(handlers.onNewDashboardSuccess).not.toHaveBeenCalled();
      expect(dashboard.setState).not.toHaveBeenCalled();
      expect(mockPublish).not.toHaveBeenCalled();
    });
  });

  describe('when request success but no data', () => {
    it('should not call any handlers when data is undefined', () => {
      const { request, handlers, dashboard, mockPublish } = setup({
        requestOverrides: {
          isError: false,
          isSuccess: true,
          data: undefined,
        },
      });

      renderHook(() =>
        useProvisionedRequestHandler({
          dashboard,
          request,
          handlers,
        })
      );

      expect(handlers.onWriteSuccess).not.toHaveBeenCalled();
      expect(handlers.onBranchSuccess).not.toHaveBeenCalled();
      expect(dashboard.setState).not.toHaveBeenCalled();
      expect(mockPublish).not.toHaveBeenCalled();
    });
  });

  describe('optional handlers', () => {
    it('should not throw when optional handlers are not provided', () => {
      const { request, dashboard } = setup({
        requestOverrides: {
          isError: false,
          isSuccess: true,
        },
        handlersOverrides: {},
      });

      expect(() => {
        renderHook(() =>
          useProvisionedRequestHandler({
            dashboard,
            request,
            handlers: {},
          })
        );
      }).not.toThrow();
    });
  });
});

type ProvisionedRequestData = DeleteRepositoryFilesWithPathApiResponse | GetRepositoryFilesWithPathApiResponse;

function setup({
  requestOverrides = {},
  handlersOverrides = {},
  workflowOverride,
}: {
  requestOverrides?: Partial<{
    isError: boolean;
    isSuccess: boolean;
    isLoading?: boolean;
    error?: unknown;
    data?: Partial<ProvisionedRequestData>;
  }>;
  handlersOverrides?: Partial<{
    onBranchSuccess?: jest.Mock;
    onWriteSuccess?: jest.Mock;
    onNewDashboardSuccess?: jest.Mock;
    onError?: jest.Mock;
  }>;
  workflowOverride?: string;
} = {}) {
  const mockPublish = jest.fn();
  const mockSetState = jest.fn();

  mockGetAppEvents.mockReturnValue({
    publish: mockPublish,
  } as unknown as ReturnType<typeof getAppEvents>);

  const dashboard = {
    setState: mockSetState,
  } as unknown as DashboardScene;

  const request = {
    isError: false,
    isSuccess: false,
    isLoading: false,
    error: undefined,
    data: undefined,
    ...(requestOverrides as ResourceWrapper),
  };

  const handlers = {
    onError: jest.fn(),
    onBranchSuccess: jest.fn(),
    onWriteSuccess: jest.fn(),
    onNewDashboardSuccess: jest.fn(),
    ...handlersOverrides,
  };

  return {
    dashboard,
    request,
    handlers,
    mockPublish,
    mockSetState,
    workflow: workflowOverride,
  };
}
