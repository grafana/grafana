import usePrevious from 'react-use/lib/usePrevious';

import { type Config } from './layout';
import { type NodeDatum } from './types';

export function useFocusPositionOnLayout(config: Config, nodes: NodeDatum[], focusedNodeId: string | undefined) {
  const prevLayoutGrid = usePrevious(config.gridLayout);
  let focusPosition;
  if (prevLayoutGrid === true && !config.gridLayout && focusedNodeId) {
    const node = nodes.find((n) => n.id === focusedNodeId);
    if (node) {
      focusPosition = {
        x: -node.x!,
        y: -node.y!,
      };
    }
  }

  return focusPosition;
}
