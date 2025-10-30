import { useEffect, useRef } from 'react';

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
import { useDispatch } from 'app/types/store';

import { useLastBranch } from './useLastBranch';

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
  onWriteSuccess?: (resource: Resource<T>) => void;
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
  selectedBranch?: string; // The branch selected by the user in the form
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
  selectedBranch,
}: Props<T>) {
  const dispatch = useDispatch();
  // useRef to ensure handlers are only called once per request
  const hasHandled = useRef(false);
  const { setLastBranch } = useLastBranch();

  useEffect(() => {
    const repoType = repository?.type || 'git';
    const info: ProvisionedOperationInfo = {
      repoType,
      resourceType,
      workflow,
    };

    if (request.isError) {
      hasHandled.current = true;
      handlers.onError?.(request.error, info);
      return;
    }

    if (request.isSuccess && request.data && !hasHandled.current) {
      hasHandled.current = true;
      const { ref, path, urls, resource } = request.data;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const resourceData = resource.upsert as Resource<T>;

      // Save the last used branch to local storage
      if (workflow === 'branch' && ref) {
        // For branch workflow, save the ref from the response
        setLastBranch(repository?.name, ref);
      } else if (workflow === 'write') {
        // For write workflow, save the selectedBranch or fall back to repository branch
        setLastBranch(repository?.name, selectedBranch || repository?.branch);
      }

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
        handlers.onWriteSuccess(resourceData);
      }

      handlers.onDismiss?.();
    }
  }, [
    request,
    workflow,
    handlers,
    successMessage,
    repository,
    resourceType,
    folderUID,
    dispatch,
    selectedBranch,
    setLastBranch,
  ]);
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
