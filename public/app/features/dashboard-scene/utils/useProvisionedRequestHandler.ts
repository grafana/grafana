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

// Context object that gets passed to all handlers
interface ProvisionedResourceContext {
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
    context: ProvisionedResourceContext
  ) => void;
  onWriteSuccess?: (context: ProvisionedResourceContext) => void;
  onNewResourceSuccess?: (resource: Resource, context: ProvisionedResourceContext) => void;
  onError?: (error: unknown, context: ProvisionedResourceContext) => void;

  // Special handlers for backward compatibility
  onNewDashboardSuccess?: (resource: Resource<Dashboard>) => void;
  onDismiss?: () => void;

  // Component-level state management (called before other handlers)
  onSuccess?: (context: ProvisionedResourceContext) => void;
}

interface ProvisionedRequest {
  isError: boolean;
  isSuccess: boolean;
  isLoading?: boolean;
  error?: unknown;
  data?: DeleteRepositoryFilesWithPathApiResponse | GetRepositoryFilesWithPathApiResponse;
}

// Provider-specific configuration
interface ProviderConfig {
  supportsRichAPI: boolean;
  urlPattern: string;
  defaultWorkflows: string[];
  branchPrefix?: string;
}

// Resource-specific configuration for different resource types
interface ResourceConfig {
  defaultSuccessMessage: string;
  navigationPattern: string;
  supportedWorkflows: string[];
  requiresRefresh?: boolean;
}

// Combined configuration for provider + resource combinations
interface ProvisionedResourceConfig {
  provider: ProviderConfig;
  resource: ResourceConfig;
}

const PROVIDER_CONFIGS: Record<RepoType, ProviderConfig> = {
  github: {
    supportsRichAPI: true,
    urlPattern: '/tree/{branch}',
    defaultWorkflows: ['branch', 'write'],
    branchPrefix: 'grafana',
  },
  gitlab: {
    supportsRichAPI: true,
    urlPattern: '/-/tree/{branch}',
    defaultWorkflows: ['branch', 'write'],
    branchPrefix: 'grafana',
  },
  bitbucket: {
    supportsRichAPI: true,
    urlPattern: '/src/{branch}',
    defaultWorkflows: ['branch', 'write'],
    branchPrefix: 'grafana',
  },
  git: {
    supportsRichAPI: false,
    urlPattern: '',
    defaultWorkflows: ['write'],
  },
  local: {
    supportsRichAPI: false,
    urlPattern: '',
    defaultWorkflows: ['write'],
  },
};

const RESOURCE_CONFIGS: Record<ResourceType, ResourceConfig> = {
  dashboard: {
    defaultSuccessMessage: 'Dashboard saved successfully',
    navigationPattern: '/dashboards/{uid}',
    supportedWorkflows: ['branch', 'write'],
  },
  folder: {
    defaultSuccessMessage: 'Folder created successfully',
    navigationPattern: '/dashboards/f/{uid}/',
    supportedWorkflows: ['branch', 'write'],
  },
  // Add more resource types as needed
};

/**
 * Generic hook for handling provisioned resource operations across any resource type and repository provider.
 *
 * This hook is intentionally decoupled from specific components (like DashboardScene) to promote reusability.
 * Components are responsible for their own state management through the onSuccess handler.
 *
 * @example
 * // Dashboard component handles its own state
 * useProvisionedRequestHandler({
 *   request,
 *   resourceType: 'dashboard',
 *   handlers: {
 *     onSuccess: () => dashboard.setState({ isDirty: false }),
 *     onWriteSuccess: () => navigate('/dashboards'),
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
    const context: ProvisionedResourceContext = {
      repoType,
      resourceType,
      isNew,
      workflow,
    };

    if (request.isError) {
      handlers.onError?.(request.error, context);
      return;
    }

    if (request.isSuccess && request.data) {
      // Call component-level state management first
      handlers.onSuccess?.(context);

      // Call onDismiss if provided (typically for modals/forms)
      handlers.onDismiss?.();

      const { ref, path, urls, resource } = request.data;

      // Branch workflow
      if (workflow === 'branch' && ref && path) {
        const branchData = { ref, path, urls };
        handlers.onBranchSuccess?.(branchData, context);
        return;
      }

      // Success message (configurable, resource-specific, or provider-specific)
      const message = successMessage || getContextualSuccessMessage(context);
      getAppEvents().publish({
        type: AppEvents.alertSuccess.name,
        payload: [message],
      });

      // New dashboard flow (legacy handler for backward compatibility)
      // if (isNew && resource?.upsert && handlers.onNewDashboardSuccess && resourceType === 'dashboard') {
      //   // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      //   handlers.onNewDashboardSuccess(resource.upsert as Resource<Dashboard>);
      //   return;
      // }

      // New resource flow
      if (isNew && resource?.upsert && handlers.onNewResourceSuccess) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const resourceData = resource.upsert as Resource;
        handlers.onNewResourceSuccess(resourceData, context);
        return;
      }

      // Write workflow
      handlers.onWriteSuccess?.(context);
    }
  }, [request, workflow, handlers, isNew, successMessage, repository, resourceType]);
}

// Helper function to get combined configuration for provider + resource
function getProvisionedResourceConfig(repoType: RepoType, resourceType: ResourceType): ProvisionedResourceConfig {
  return {
    provider: PROVIDER_CONFIGS[repoType],
    resource: RESOURCE_CONFIGS[resourceType],
  };
}

// Helper function to get contextual success messages
function getContextualSuccessMessage(context: ProvisionedResourceContext): string {
  const { repoType, resourceType, isNew } = context;
  const action = isNew ? 'created' : 'saved';
  const resourceConfig = RESOURCE_CONFIGS[resourceType];

  // Provider-specific messages with resource context
  switch (repoType) {
    case 'github':
      return t(
        `provisioned-request-handler.${resourceType}-github-success`,
        `${resourceConfig.defaultSuccessMessage} via GitHub`
      );
    case 'gitlab':
      return t(
        `provisioned-request-handler.${resourceType}-gitlab-success`,
        `${resourceConfig.defaultSuccessMessage} via GitLab`
      );
    case 'bitbucket':
      return t(
        `provisioned-request-handler.${resourceType}-bitbucket-success`,
        `${resourceConfig.defaultSuccessMessage} via Bitbucket`
      );
    case 'git':
      return t(
        `provisioned-request-handler.${resourceType}-git-success`,
        `${resourceConfig.defaultSuccessMessage} via Git`
      );
    case 'local':
      return t(`provisioned-request-handler.${resourceType}-local-success`, resourceConfig.defaultSuccessMessage);
    default:
      return resourceConfig.defaultSuccessMessage;
  }
}

// Export utility functions for external use
export function getProviderConfig(repoType: RepoType): ProviderConfig {
  return PROVIDER_CONFIGS[repoType];
}

export function getResourceConfig(resourceType: ResourceType): ResourceConfig {
  return RESOURCE_CONFIGS[resourceType];
}

export function getCombinedConfig(repoType: RepoType, resourceType: ResourceType): ProvisionedResourceConfig {
  return getProvisionedResourceConfig(repoType, resourceType);
}

export function supportsRichAPI(repoType: RepoType): boolean {
  return PROVIDER_CONFIGS[repoType]?.supportsRichAPI || false;
}

export function getSupportedWorkflows(repoType: RepoType, resourceType: ResourceType): string[] {
  const providerWorkflows = PROVIDER_CONFIGS[repoType].defaultWorkflows;
  const resourceWorkflows = RESOURCE_CONFIGS[resourceType].supportedWorkflows;

  // Return intersection of supported workflows
  return providerWorkflows.filter((workflow) => resourceWorkflows.includes(workflow));
}

// Type exports for external use
export type {
  ResourceType,
  ProvisionedResourceContext,
  RequestHandlers,
  ProviderConfig,
  ResourceConfig,
  ProvisionedResourceConfig,
};
