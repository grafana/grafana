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
import { type ResourceKindKey } from '../utils/resourceKinds';

import { PushSuccessMessage } from './PushSuccessMessage';
import { useLastBranch } from './useLastBranch';

type ResourceType = ResourceKindKey;

// Information object that gets passed to all handlers
interface ProvisionedOperationInfo {
  repoType: RepoType;
  resourceType?: ResourceType;
}

/**
 * `onBranchSuccess` runs when the commit landed on a branch other than the configured one (new or
 * existing); `onWriteSuccess` when it landed on the configured branch.
 */
interface RequestHandlers<T> {
  onBranchSuccess?: (
    data: { ref: string; path: string; urls?: Record<string, string> },
    info: ProvisionedOperationInfo,
    resource: Resource<T>,
    wrapper: ResourceWrapper
  ) => void;
  onWriteSuccess?: (resource: Resource<T>, wrapper: ResourceWrapper) => void;
  onDismiss?: () => void;
}

interface ProvisionedHandlerOptions<T> {
  folderUID?: string; // this is used to refetch folder items
  repository?: RepositoryView;
  resourceType?: ResourceType;
  /** The commit created the branch: the destination page shows the PR banner, so no toast. */
  isNewBranch?: boolean;
  successMessage?: string;
  handlers?: RequestHandlers<T>;
}

function notifySaveSuccess(
  {
    ref,
    repository,
    urls,
    successMessage,
  }: {
    ref?: string; // ref returned in the response data
    repository?: RepositoryView;
    urls?: Record<string, string>;
    successMessage?: string;
  },
  dispatch: AppDispatch
) {
  const branch = ref || repository?.branch;
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
 * Call the returned function from the submit path; handle failures in the caller's catch:
 *
 *   const { handleSuccess } = useProvisionedRequestHandler({ repository, isNewBranch, handlers });
 *   try {
 *     const data = await mutation(args).unwrap();
 *     handleSuccess(data);
 *   } catch (error) {
 *     showError(error);
 *   }
 *
 * Per-call `overrides` shallow-merge over the hook options, for values only
 * known at submit time (e.g. the folder a new resource was saved into).
 */
export function useProvisionedRequestHandler<T>(options: ProvisionedHandlerOptions<T> = {}) {
  const dispatch = useDispatch();
  const { setLastBranch } = useLastBranch();

  const handleSuccess = (data: ResourceWrapper, overrides?: Partial<ProvisionedHandlerOptions<T>>) => {
    const { folderUID, repository, resourceType, isNewBranch, successMessage, handlers } = {
      ...options,
      ...overrides,
    };
    const info: ProvisionedOperationInfo = { repoType: repository?.type || 'git', resourceType };

    const { ref, path, urls, resource } = data;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const resourceData = resource.upsert as Resource<T>;

    // The request only carries a ref for a branch commit, and the response echoes it; a direct
    // write comes back without one.
    const lastBranch = ref || repository?.branch;
    if (lastBranch) {
      setLastBranch(repository?.name, lastBranch);
    }

    // A new branch lands on a page with its own PR banner, so the toast would be noise.
    if (!isNewBranch) {
      notifySaveSuccess({ ref, repository, urls, successMessage }, dispatch);
    }

    if (ref && path && handlers?.onBranchSuccess) {
      handlers.onBranchSuccess({ ref, path, urls }, info, resourceData, data);
    }
    if (!ref && handlers?.onWriteSuccess) {
      if (folderUID) {
        dispatch(refetchChildren({ parentUID: folderUID, pageSize: PAGE_SIZE }));
      }
      handlers.onWriteSuccess(resourceData, data);
    }

    handlers?.onDismiss?.();
  };

  return { handleSuccess };
}

export type { ProvisionedOperationInfo, RequestHandlers };
