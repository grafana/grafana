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
import { RepoType } from 'app/features/provisioning/Wizard/types';

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

/**
 * Generic hook for handling provisioned resource operations across any resource type and repository provider.
 *
 * This hook is intentionally decoupled from specific components (like DashboardScene) to promote reusability.
 * Components are responsible for their own state management through specific workflow handlers.
 */
export function useProvisionedRequestHandler<T>({
  request,
  workflow,
  handlers,
  successMessage,
  repository,
  resourceType,
}: {
  request: ProvisionedRequest;
  workflow?: string;
  handlers: RequestHandlers<T>;
  successMessage?: string;
  repository?: RepositoryView;
  resourceType?: ResourceType;
}) {
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
        handlers.onWriteSuccess(info, resourceData);
      }

      handlers.onDismiss?.();
    }
  }, [request, workflow, handlers, successMessage, repository, resourceType]);
}

function getContextualSuccessMessage(info: ProvisionedOperationInfo): string {
  const { resourceType } = info;

  if (resourceType === 'dashboard') {
    return t('provisioned-resource-request-handler-dashboard', 'Dashboard saved successfully');
  } else if (resourceType === 'folder') {
    return t('provisioned-resource-request-handler-folder', 'Folder created successfully');
  }

  // Fallback for new resource types
  return t('provisioned-resource-request-handler', 'Resource saved successfully');
}

export type { ResourceType, ProvisionedOperationInfo, RequestHandlers, ResourceConfig };
