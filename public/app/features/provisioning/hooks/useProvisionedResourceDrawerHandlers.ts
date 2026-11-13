import { type UnknownAction } from '@reduxjs/toolkit';
import { useNavigate } from 'react-router-dom-v5-compat';

import { playlistAPIv1 } from 'app/api/clients/playlist/v1';
import { useDispatch } from 'app/types/store';

import { buildResourceBranchRedirectUrl, type ResourceBranchAction } from '../utils/redirect';
import { type ResourceKindInfo, type ResourceKindKey } from '../utils/resourceKinds';

/**
 * Actions invalidating a kind's list-view cache, dispatched after a successful commit so the change
 * shows up when navigating back to the list. Only kinds whose pages drive
 * {@link SaveProvisionedResourceDrawer} need one — dashboards and folders use their own forms.
 */
const listCacheInvalidations: Partial<Record<ResourceKindKey, () => UnknownAction>> = {
  playlist: () => playlistAPIv1.util.invalidateTags(['Playlist']),
};

/** Shape forwarded by {@link SaveProvisionedResourceDrawer}'s `onBranchSuccess` callback. */
interface BranchSuccessData {
  ref: string;
  urls?: Record<string, string>;
  repoType?: string;
  /** Repository's configured (default) branch, for the PR banner's branch display. */
  configuredBranch?: string;
  /** Repository base URL, for the PR banner's branch links. */
  repoUrl?: string;
  /** Rendered pull-request title, forwarded as the `pr_title` query param for the PR banner. */
  prTitle?: string;
}

export interface ProvisionedResourceDrawerHandlers {
  /**
   * Write workflow: invalidate the kind's list cache and navigate to its collection page so the
   * committed change shows up there.
   */
  goToList: () => void;
  /**
   * Branch (PR) workflow: builds the `onBranchSuccess` handler for the given commit action. It
   * navigates to the kind's collection page with the pull-request params so the page surfaces the
   * PR banner (mirrors the dashboard flow). `create`/`update`/`delete` differ only by this action.
   */
  makeOnBranchSuccess: (action: ResourceBranchAction) => (data: BranchSuccessData) => void;
}

/**
 * Shared navigation/cache handlers for a provisioned resource's save and delete drawers.
 *
 * The redirect and list-navigation logic is identical across kinds — and across the save/delete
 * variants of one kind — differing only by the kind's collection route and the commit action, both
 * read from the {@link ResourceKindInfo}.
 */
export function useProvisionedResourceDrawerHandlers(kind: ResourceKindInfo): ProvisionedResourceDrawerHandlers {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const invalidate = () => {
    const action = listCacheInvalidations[kind.key]?.();
    if (action) {
      dispatch(action);
    }
  };

  const goToList = () => {
    invalidate();
    navigate(kind.routes.list);
  };

  const makeOnBranchSuccess =
    (action: ResourceBranchAction) =>
    ({ ref, urls, repoType, configuredBranch, repoUrl, prTitle }: BranchSuccessData) => {
      invalidate();
      navigate(
        buildResourceBranchRedirectUrl({
          baseUrl: kind.routes.list,
          paramName: 'new_pull_request_url',
          paramValue: urls?.newPullRequestURL,
          repoType,
          action,
          prTitle,
          ref,
          configuredBranch,
          repoUrl: urls?.repositoryURL ?? repoUrl,
        })
      );
    };

  return { goToList, makeOnBranchSuccess };
}
