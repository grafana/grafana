import { createElement } from 'react';

import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { type RepositoryView, type ResourceWrapper } from 'app/api/clients/provisioning/v0alpha1';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { type Resource } from 'app/features/apiserver/types';
import { PAGE_SIZE } from 'app/features/browse-dashboards/api/constants';
import { refetchChildren } from 'app/features/browse-dashboards/state/actions';
import { type RepoType } from 'app/features/provisioning/Wizard/types';
import { type AppDispatch } from 'app/store/configureStore';
import { useDispatch } from 'app/types/store';

import { ensureFolderPathTrailingSlash } from '../components/utils/path';
import { getRepoFileUrl } from '../utils/git';

import { PushSuccessMessage } from './PushSuccessMessage';
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
    resource: Resource<T>,
    wrapper: ResourceWrapper
  ) => void;
  onWriteSuccess?: (resource: Resource<T>, wrapper: ResourceWrapper) => void;
  onError?: (error: unknown, info: ProvisionedOperationInfo) => void;
  onDismiss?: () => void;
}

interface ProvisionedHandlerOptions<T> {
  folderUID?: string; // this is used to refetch folder items
  workflow?: string;
  repository?: RepositoryView;
  resourceType?: ResourceType;
  selectedBranch?: string; // The branch selected by the user in the form
  successMessage?: string;
  handlers?: RequestHandlers<T>;
}

interface BranchContext {
  workflow?: string;
  ref?: string; // ref returned in the response data
  selectedBranch?: string;
  repository?: RepositoryView;
}

function resolveLastBranchToSave({ workflow, ref, selectedBranch, repository }: BranchContext): string | undefined {
  if (workflow === 'branch') {
    // For branch workflow, save the ref from the response
    return ref;
  }
  if (workflow === 'write') {
    // For write workflow, save the selectedBranch or fall back to repository branch
    return selectedBranch || repository?.branch;
  }
  return undefined;
}

function notifySaveSuccess(
  {
    workflow,
    ref,
    selectedBranch,
    repository,
    urls,
    successMessage,
  }: BranchContext & {
    urls?: Record<string, string>;
    successMessage?: string;
  },
  dispatch: AppDispatch
) {
  // Only show success alert for write workflow (not branch workflow,
  // which navigates to a preview page with its own PR banner)
  if (workflow === 'branch') {
    return;
  }

  const branch = ref || selectedBranch || repository?.branch;
  // Link to the configured path (e.g. /tree/main/dashboards) so users
  // land where their resources live, not the repo root.
  const repoFileUrl = repository?.path
    ? getRepoFileUrl({
        repoType: repository.type,
        url: repository.url,
        branch,
        filePath: ensureFolderPathTrailingSlash(repository.path),
      })
    : undefined;
  const linkUrl = repoFileUrl || urls?.repositoryURL || repository?.url;

  if (branch) {
    // Uses dispatch(notifyApp(...)) instead of getAppEvents().publish() because AlertPayload only accepts strings
    // and notifyApp supports a React component for rendering the branch name as a clickable link.
    const component = createElement(PushSuccessMessage, { branch, url: linkUrl });
    dispatch(notifyApp(createSuccessNotification('', '', undefined, component)));
  } else {
    const message = successMessage || t('provisioned-request.saved-success', 'Changes saved successfully');
    getAppEvents().publish({
      type: AppEvents.alertSuccess.name,
      payload: [message],
    });
  }
}

/**
 * Generic handler for the result of provisioned resource mutations, across any
 * resource type and repository provider.
 *
 * Call the returned functions from the submit path:
 *
 *   const { handleSuccess, handleError } = useProvisionedRequestHandler({ repository, workflow, handlers });
 *   try {
 *     const data = await mutation(args).unwrap();
 *     handleSuccess(data);
 *   } catch (error) {
 *     handleError(error);
 *   }
 *
 * Per-call `overrides` shallow-merge over the hook options, for values only
 * known at submit time (e.g. the branch entered in the form).
 */
export function useProvisionedRequestHandler<T>(options: ProvisionedHandlerOptions<T> = {}) {
  const dispatch = useDispatch();
  const { setLastBranch } = useLastBranch();

  const handleSuccess = (data: ResourceWrapper, overrides?: Partial<ProvisionedHandlerOptions<T>>) => {
    const { folderUID, workflow, repository, resourceType, selectedBranch, successMessage, handlers } = {
      ...options,
      ...overrides,
    };
    const info: ProvisionedOperationInfo = {
      repoType: repository?.type || 'git',
      resourceType,
      workflow,
    };

    const { ref, path, urls, resource } = data;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const resourceData = resource.upsert as Resource<T>;

    const lastBranch = resolveLastBranchToSave({ workflow, ref, selectedBranch, repository });
    if (lastBranch) {
      setLastBranch(repository?.name, lastBranch);
    }

    notifySaveSuccess({ workflow, ref, selectedBranch, repository, urls, successMessage }, dispatch);

    // Branch workflow
    if (workflow === 'branch' && handlers?.onBranchSuccess && ref && path) {
      handlers.onBranchSuccess({ ref, path, urls }, info, resourceData, data);
    }

    // Write workflow
    if (workflow === 'write' && handlers?.onWriteSuccess) {
      if (folderUID) {
        // refetch folder items after success if folderUID is passed in
        dispatch(refetchChildren({ parentUID: folderUID, pageSize: PAGE_SIZE }));
      }
      handlers.onWriteSuccess(resourceData, data);
    }

    handlers?.onDismiss?.();
  };

  const handleError = (error: unknown, overrides?: Partial<ProvisionedHandlerOptions<T>>) => {
    const { workflow, repository, resourceType, handlers } = { ...options, ...overrides };
    handlers?.onError?.(error, {
      repoType: repository?.type || 'git',
      resourceType,
      workflow,
    });
  };

  return { handleSuccess, handleError };
}

export type { ResourceType, ProvisionedOperationInfo, RequestHandlers };
