import React, { FC, useCallback, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
// @ts-ignore
import vis from 'visjs-network';

import { StoreState } from '../../../types';
import { getVariable, getVariables } from '../state/selectors';
import { VariableModel } from '../../templating/types';
import { createEdges, createNodes, toVisNetworkEdges, toVisNetworkNodes } from './utils';
import { toVariableIdentifier, VariableIdentifier } from '../state/types';

interface OwnProps {
  onEditClick: (identifier: VariableIdentifier) => void;
}

interface ConnectedProps {}

interface DispatchProps {}

type Props = OwnProps & ConnectedProps & DispatchProps;

export const VariablesDependencies: FC<Props> = ({ onEditClick }) => {
  const variables: VariableModel[] = useSelector((state: StoreState) => getVariables(state));
  const nodes = useMemo(() => createNodes(variables), [variables]);
  const edges = useMemo(() => createEdges(variables), [variables]);
  const onDoubleClick = useCallback(
    (params: { nodes: string[] }) => {
      onEditClick(toVariableIdentifier(getVariable(params.nodes[0])));
    },
    [variables]
  );
  let network: any = null;
  let ref: any = null;

  useEffect(() => {
    if (!ref) {
      return null;
    }

    const data = {
      nodes: toVisNetworkNodes(nodes),
      edges: toVisNetworkEdges(edges),
    };

    const options = {
      autoResize: true,
      layout: {
        improvedLayout: true,
        hierarchical: {
          enabled: true,
          direction: 'DU',
          sortMethod: 'directed',
        },
      },
      interaction: {
        dragNodes: false,
        dragView: false,
      },
    };

    network = new vis.Network(ref, data, options);
    network.on('doubleClick', onDoubleClick);

    return () => {
      // unsubscribe event handlers
      if (network) {
        network.off('doubleClick');
      }
    };
  }, []);

  return (
    <>
      <div ref={r => (ref = r)} style={{ width: '100%', height: '50vh' }} />
    </>
  );
};
