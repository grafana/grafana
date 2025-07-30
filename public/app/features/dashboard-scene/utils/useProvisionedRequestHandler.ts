import { useEffect } from 'react';

import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import {
  DeleteRepositoryFilesWithPathApiResponse,
  GetRepositoryFilesWithPathApiResponse,
  RepositoryView,
} from 'app/api/clients/provisioning/v0alpha1';
import { Resource } from 'app/features/apiserver/types';
import { RepoType } from 'app/features/provisioning/Wizard/types';

// Resource type definitions for scalability
type ResourceType = 'dashboard' | 'folder'; // Add more as needed, e.g., 'alert', etc.

// Information object that gets passed to all handlers
interface ProvisionedOperationInfo {
  repoType: RepoType;
  resourceType: ResourceType;
  isNew?: boolean;
  workflow?: string;
}

// Clean, decoupled handlers interface
interface RequestHandlers {
  // Modern contextual handlers
  onBranchSuccess?: (
    data: { ref: string; path: string; urls?: Record<string, string> },
    info: ProvisionedOperationInfo
  ) => void;
  onWriteSuccess?: (info: ProvisionedOperationInfo) => void;
  onNewResourceSuccess?: (resource: Resource, info: ProvisionedOperationInfo) => void;
  onError?: (error: unknown, info: ProvisionedOperationInfo) => void;

  // Special handlers for backward compatibility
  onNewDashboardSuccess?: (resource: Resource<Dashboard>) => void;
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
 *
 * @example
 * // Dashboard component handles its own state
 * useProvisionedRequestHandler({
 *   request,
 *   resourceType: 'dashboard',
 *   handlers: {
 *     onWriteSuccess: (info) => {
 *       dashboard.setState({ isDirty: false });
 *       navigate('/dashboards');
 *     },
 *   }
 * });
 *
 * @example
 * // Folder component doesn't need dashboard state
 * useProvisionedRequestHandler({
 *   request,
 *   resourceType: 'folder',
 *   handlers: {
 *     onNewResourceSuccess: (resource) => navigate(`/folders/${resource.metadata.name}`),
 *   }
 * });
 */
export function useProvisionedRequestHandler({
  request,
  workflow,
  handlers,
  isNew,
  successMessage,
  repository,
  resourceType = 'dashboard', // Default to dashboard for backward compatibility
}: {
  request: ProvisionedRequest;
  workflow?: string;
  handlers: RequestHandlers;
  isNew?: boolean;
  successMessage?: string;
  repository?: RepositoryView;
  resourceType?: ResourceType;
}) {
  useEffect(() => {
    const repoType = repository?.type || 'git';
    const info: ProvisionedOperationInfo = {
      repoType,
      resourceType,
      isNew,
      workflow,
    };

    if (request.isError) {
      handlers.onError?.(request.error, info);
      return;
    }

    if (request.isSuccess && request.data) {
      // Call onDismiss if provided (typically for modals/forms)
      handlers.onDismiss?.();

      const { ref, path, urls, resource } = request.data;

      // Branch workflow
      if (workflow === 'branch' && ref && path) {
        const branchData = { ref, path, urls };
        handlers.onBranchSuccess?.(branchData, info);
        return;
      }

      // Success message (configurable or resource-specific)
      const message = successMessage || getContextualSuccessMessage(info);
      getAppEvents().publish({
        type: AppEvents.alertSuccess.name,
        payload: [message],
      });

      // Handle new resource creation (orthogonal to workflow type)
      if (isNew && resource?.upsert && handlers.onNewResourceSuccess) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const resourceData = resource.upsert as Resource;
        handlers.onNewResourceSuccess(resourceData, info);
      }

      // Handle write workflow (can happen for both new and existing resources)
      if (workflow === 'write' && handlers.onWriteSuccess) {
        console.log('hook ------- onWriteSuccess', info);
        handlers.onWriteSuccess(info);
      }

      // Legacy dashboard handler for backward compatibility
      if (isNew && resource?.upsert && handlers.onNewDashboardSuccess && resourceType === 'dashboard') {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        handlers.onNewDashboardSuccess(resource.upsert as Resource<Dashboard>);
      }
    }
  }, [request, workflow, handlers, isNew, successMessage, repository, resourceType]);
}

// Helper function to get contextual success messages
function getContextualSuccessMessage(info: ProvisionedOperationInfo): string {
  const { resourceType } = info;

  // Use proper i18n with fallback messages
  if (resourceType === 'dashboard') {
    return t('provisioned-resource-request-handler-dashboard', 'Dashboard saved successfully');
  } else if (resourceType === 'folder') {
    return t('provisioned-resource-request-handler-folder', 'Folder created successfully');
  }

  // Fallback for new resource types
  return t('provisioned-resource-request-handler', 'Resource saved successfully');
}

// Type exports for external use
export type {
  ResourceType,
  ProvisionedOperationInfo,
  RequestHandlers,
  ResourceConfig,
};
