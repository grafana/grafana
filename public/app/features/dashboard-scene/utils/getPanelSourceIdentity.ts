import { type VizPanel } from '@grafana/scenes';

import { isRepeatCloneOrChildOf } from './clone';
import { djb2Hash } from './djb2Hash';

/**
 * Repeat clones (and panels inside repeated rows) cannot use their key, which they share with or derive
 * from the original panel, so they are identified by a hash of their path in the scene graph instead.
 * Returns undefined for a panel that is not a repeat clone or a child of one.
 */
export function getRepeatClonePathHash(panel: VizPanel): number | undefined {
  return isRepeatCloneOrChildOf(panel) ? djb2Hash(panel.getPathId()) : undefined;
}

/**
 * Identifies the panel instance that wrote a BI selection filter, so its own queries can skip it.
 */
export function getPanelSourceIdentity(panel: VizPanel): string {
  const cloneHash = getRepeatClonePathHash(panel);
  if (cloneHash !== undefined) {
    return `clone-${cloneHash}`;
  }

  // SceneObjectBase assigns a key to every object, so this is always set in practice.
  return panel.state.key ?? '';
}
