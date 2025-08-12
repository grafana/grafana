import { useEffect } from 'react';

import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import {
  DeleteRepositoryFilesWithPathApiResponse,
  GetRepositoryFilesWithPathApiResponse,
  RepositoryView,
} from 'app/api/clients/provisioning/v0alpha1';
import { Resource } from 'app/features/apiserver/types';
import { PAGE_SIZE } from 'app/features/browse-dashboards/api/services';
import { refetchChildren } from 'app/features/browse-dashboards/state/actions';
import { RepoType } from 'app/features/provisioning/Wizard/types';
import { dispatch } from 'app/store/store';

type ResourceType = 'dashboard' | 'folder'; // Add more as needed, e.g., 'alert', etc.

// Information object that gets passed to all handlers
interface ProvisionedOperationInfo {
  repoType: RepoType;
  resourceType?: ResourceType;
  workflow?: string;
}

interface RequestHandlers<T> {
  onBranchSuccess?: (
    data: { ref: string; path: string; urls?: Record<string, string> },
    info: ProvisionedOperationInfo,
    resource: Resource<T>
  ) => void;
  onWriteSuccess?: (info: ProvisionedOperationInfo, resource: Resource<T>) => void;
  onError?: (error: unknown, info: ProvisionedOperationInfo) => void;
  onDismiss?: () => void;
}

interface ProvisionedRequest {
  isError: boolean;
  isSuccess: boolean;
  isLoading?: boolean;
  error?: unknown;
  data?: DeleteRepositoryFilesWithPathApiResponse | GetRepositoryFilesWithPathApiResponse;
}

// Resource-specific configuration for different resource types
interface ResourceConfig {
  defaultSuccessMessage: string;
  supportedWorkflows: string[];
}

interface Props<T> {
  request: ProvisionedRequest;
  folderUID?: string | undefined; // this is used to refetch folder items
  workflow?: string;
  handlers: RequestHandlers<T>;
  successMessage?: string;
  repository?: RepositoryView;
  resourceType?: ResourceType;
}

/**
 * Generic hook for handling provisioned resource operations across any resource type and repository provider.
 *
 * This hook is intentionally decoupled from specific components (like DashboardScene) to promote reusability.
 * Components are responsible for their own state management through specific workflow handlers.
 */
export function useProvisionedRequestHandler<T>({
  folderUID,
  request,
  workflow,
  handlers,
  successMessage,
  repository,
  resourceType,
}: Props<T>) {
  useEffect(() => {
    const repoType = repository?.type || 'git';
    const info: ProvisionedOperationInfo = {
      repoType,
      resourceType,
      workflow,
    };

    if (request.isError) {
      handlers.onError?.(request.error, info);
      return;
    }

    if (request.isSuccess && request.data) {
      const { ref, path, urls, resource } = request.data;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const resourceData = resource.upsert as Resource<T>;

      // Success message
      const message = successMessage || getContextualSuccessMessage(info);
      getAppEvents().publish({
        type: AppEvents.alertSuccess.name,
        payload: [message],
      });

      // Branch workflow
      if (workflow === 'branch' && handlers.onBranchSuccess && ref && path) {
        const branchData = { ref, path, urls };
        handlers.onBranchSuccess?.(branchData, info, resourceData);
      }

      // Write workflow
      if (workflow === 'write' && handlers.onWriteSuccess) {
        if (folderUID) {
          // refetch folder items after success if folderUID is passed in
          dispatch(refetchChildren({ parentUID: folderUID || repository?.name, pageSize: PAGE_SIZE }));
        }
        handlers.onWriteSuccess(info, resourceData);
      }

      handlers.onDismiss?.();
    }
  }, [request, workflow, handlers, successMessage, repository, resourceType, folderUID]);
}

function getContextualSuccessMessage(info: ProvisionedOperationInfo): string {
  const { resourceType } = info;

  switch (resourceType) {
    case 'dashboard':
      return t('provisioned-resource-request-handler-dashboard', 'Dashboard saved successfully');
    case 'folder':
      return t('provisioned-resource-request-handler-folder', 'Folder created successfully');
    default:
      return t('provisioned-resource-request-handler', 'Resource saved successfully');
  }
}

export type { ResourceType, ProvisionedOperationInfo, RequestHandlers, ResourceConfig };
