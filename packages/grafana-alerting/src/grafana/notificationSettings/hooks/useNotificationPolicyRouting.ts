import { useResolvedRoutingTree } from '../../notificationPolicies/hooks/useResolvedRoutingTree';
import { isDefaultRoutingTreeName } from '../../notificationPolicies/routingTree.utils';

/** Everything a consumer needs to render the notification policy selection and decide whether it can be saved. It
 * requests the routing trees unconditionally: the package has no Alertmanager provider to gate on, so consumers
 * decide whether to render it for users without access. An unset `name` is the default policy. */
export function useNotificationPolicyRouting(name?: string) {
  const { tree, isResolving, isNotFound, isError } = useResolvedRoutingTree(name);

  // The default policy is not a reference to a tree, so a list without it does not make it missing.
  const isTreeMissing = isNotFound && !isDefaultRoutingTreeName(name);
  const status = getStatus({ isError, isResolving, isTreeMissing });

  return {
    /** `null` while the trees load, when they fail to load, or when the list has no default policy. */
    tree,
    /** `notFound` only for a named tree that no longer exists. `found` can come with a `null` tree: the default policy is
     * not a reference to a tree, so a list that lacks it still counts as found. */
    status,
    /** False for a named tree that no longer exists, and for the default policy named explicitly (`''`,
     * `user-defined`, `default`): the backend rejects both as a named policy, and the default policy is chosen by
     * leaving `name` unset. A tree that is still resolving or failed to load can't be judged. */
    isValid: status !== 'notFound' && (name === undefined || !isDefaultRoutingTreeName(name)),
  };
}

function getStatus({
  isError,
  isResolving,
  isTreeMissing,
}: {
  isError: boolean;
  isResolving: boolean;
  isTreeMissing: boolean;
}) {
  if (isError) {
    return 'error';
  }
  if (isResolving) {
    return 'resolving';
  }
  return isTreeMissing ? 'notFound' : 'found';
}
