import { useNavigate } from 'react-router-dom-v5-compat';

import { useDispatch } from 'app/types/store';

import { buildResourceBranchRedirectUrl, type ResourceBranchAction } from '../utils/redirect';
import { type ResourceKindInfo } from '../utils/resourceKinds';

/** Shape {@link SaveProvisionedResourceDrawer} forwards to `onBranchSuccess`. */
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
   * Write workflow: invalidate the kind's list cache and redirect so the committed change shows up
   * at the destination.
   */
  onWriteSuccess: () => void;
  /**
   * Branch (PR) workflow: redirects with the pull-request params so the destination surfaces the
   * PR banner (mirrors the dashboard flow).
   */
  onBranchSuccess: (data: BranchSuccessData) => void;
}

/**
 * Shared navigation/cache handlers for a provisioned resource's save and delete drawers.
 *
 * The redirect logic is identical across kinds — and across the save/delete variants of one kind —
 * differing only by the destination and the commit action. `redirectUrl` comes from the caller
 * rather than the kind: the page that owns the route knows it, the registry does not. The kind's
 * `invalidateListTags` (if any) is dispatched so the committed change shows up there.
 */
export function useProvisionedResourceDrawerHandlers(
  kind: ResourceKindInfo | undefined,
  redirectUrl: string,
  action: ResourceBranchAction
): ProvisionedResourceDrawerHandlers {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const invalidate = () => {
    const invalidateAction = kind?.invalidateListTags?.();
    if (invalidateAction) {
      dispatch(invalidateAction);
    }
  };

  const onWriteSuccess = () => {
    invalidate();
    navigate(redirectUrl);
  };

  const onBranchSuccess = ({ ref, urls, repoType, configuredBranch, repoUrl, prTitle }: BranchSuccessData) => {
    invalidate();
    navigate(
      buildResourceBranchRedirectUrl({
        baseUrl: redirectUrl,
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

  return { onWriteSuccess, onBranchSuccess };
}
