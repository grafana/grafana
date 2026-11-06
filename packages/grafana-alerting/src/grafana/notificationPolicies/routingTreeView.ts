import { type RoutingTree } from '../api/notifications';

import { isDefaultRoutingTree } from './routingTree.utils';

/** The fields of a routing tree that components read; they never see the API type. */
export interface RoutingTreeView {
  name: string;
  isDefault: boolean;
  /** The timings the tree gives routes that don't set their own. */
  defaults: { groupWait?: string; groupInterval?: string; repeatInterval?: string };
}

export function toRoutingTreeView(tree: RoutingTree): RoutingTreeView {
  const { group_wait, group_interval, repeat_interval } = tree.spec.defaults;
  return {
    name: tree.metadata.name ?? '',
    isDefault: isDefaultRoutingTree(tree),
    defaults: { groupWait: group_wait, groupInterval: group_interval, repeatInterval: repeat_interval },
  };
}
