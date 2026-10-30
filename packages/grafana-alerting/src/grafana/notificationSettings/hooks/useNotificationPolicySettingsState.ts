import { type Label } from '../../matchers/types';
import { useResolvedRoutingTree } from '../../notificationPolicies/hooks/useResolvedRoutingTree';
import { useRoutingTreePreview } from '../../notificationPolicies/hooks/useRoutingTreePreview';
import { isDefaultRoutingTreeName } from '../../notificationPolicies/routingTree.utils';
import { type PolicyRoutingSettings } from '../notificationSettingsValue';

interface NotificationPolicySettingsStateOptions {
  /** `null` means the default policy. */
  value: PolicyRoutingSettings | null;
  /** Label sets of the alert instances to preview routing for. Keep the reference stable between renders. */
  instances?: Label[][];
}

const NO_INSTANCES: Label[][] = [];

/** Everything a consumer needs to render the notification policy selection and decide whether it can be saved. It requests the routing trees unconditionally: the package has no Alertmanager provider to gate on, so
 * consumers decide whether to render it for users without access. */
export function useNotificationPolicySettingsState({
  value,
  instances = NO_INSTANCES,
}: NotificationPolicySettingsStateOptions) {
  const name = value?.routingTree;
  const { tree, isResolving, isNotFound, isError } = useResolvedRoutingTree(name);
  const preview = useRoutingTreePreview(name, instances);

  // The default policy is not a reference to a tree, so a list without it does not make it missing.
  const isTreeMissing = isNotFound && !isDefaultRoutingTreeName(name);
  const status = getStatus({ isError, isResolving, isTreeMissing });

  return {
    /** `null` while the trees load, when they fail to load, or when the list has no default policy. */
    tree,
    /** `notFound` only for a named tree that no longer exists. `found` can come with a `null` tree: the default policy is
     * not a reference to a tree, so a list that lacks it still counts as found. */
    status,
    /** False only for a named tree that no longer exists: the backend rejects it, while a tree that is still resolving
     * or failed to load can't be judged. */
    isValid: status !== 'notFound',
    /** Routes of the tree matching `instances`. `null` when there is nothing to preview or the tree isn't confirmed,
     * so an empty array always means nothing matched. */
    previewRoutes: instances.length > 0 && preview.status === 'found' ? preview.routes : null,
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
