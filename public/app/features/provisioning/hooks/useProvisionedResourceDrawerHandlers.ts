import { useNavigate } from 'react-router-dom-v5-compat';

import { useDispatch } from 'app/types/store';

import { buildResourceBranchRedirectUrl, type ResourceBranchAction } from '../utils/redirect';
import { type ResourceKindInfo } from '../utils/resourceKinds';

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
 * variants of one kind — differing only by the kind's `listRoute` and the commit action, both read
 * from the {@link ResourceKindInfo}. The kind's `invalidateListTags` (if any) is dispatched so the
 * committed change shows up on its list page.
 */
export function useProvisionedResourceDrawerHandlers(kind: ResourceKindInfo): ProvisionedResourceDrawerHandlers {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const invalidate = () => {
    const action = kind.invalidateListTags?.();
    if (action) {
      dispatch(action);
    }
  };

  const goToList = () => {
    invalidate();
    navigate(kind.listRoute);
  };

  const makeOnBranchSuccess =
    (action: ResourceBranchAction) =>
    ({ ref, urls, repoType, configuredBranch, repoUrl, prTitle }: BranchSuccessData) => {
      invalidate();
      navigate(
        buildResourceBranchRedirectUrl({
          baseUrl: kind.listRoute,
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
