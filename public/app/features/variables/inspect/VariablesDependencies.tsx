import React, { FC, useCallback, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
// @ts-ignore
import vis from 'visjs-network';
import { FeatureInfoBox } from '@grafana/ui';
import { FeatureState } from '@grafana/data';

import { StoreState } from '../../../types';
import { getVariable, getVariables } from '../state/selectors';
import { VariableModel } from '../../templating/types';
import {
  createDependencyEdges,
  createDependencyNodes,
  filterNodesWithDependencies,
  toVisNetworkEdges,
  toVisNetworkNodes,
} from './utils';
import { toVariableIdentifier, VariableIdentifier } from '../state/types';

interface OwnProps {
  onEditClick: (identifier: VariableIdentifier) => void;
}

interface ConnectedProps {}

interface DispatchProps {}

type Props = OwnProps & ConnectedProps & DispatchProps;

export const VariablesDependencies: FC<Props> = ({ onEditClick }) => {
  let network: any = null;
  let ref: any = null;
  const variables: VariableModel[] = useSelector((state: StoreState) => getVariables(state));
  const nodes = useMemo(() => createDependencyNodes(variables), [variables]);
  const edges = useMemo(() => createDependencyEdges(variables), [variables]);
  const onDoubleClick = useCallback(
    (params: { nodes: string[] }) => {
      onEditClick(toVariableIdentifier(getVariable(params.nodes[0])));
    },
    [variables]
  );
  useEffect(() => {
    if (!ref) {
      return null;
    }

    const data = {
      nodes: toVisNetworkNodes(filterNodesWithDependencies(nodes, edges)),
      edges: toVisNetworkEdges(edges),
    };

    const options = {
      width: '100%',
      height: '100%',
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
      <FeatureInfoBox title="Dependencies" featureState={FeatureState.alpha}>
        Dependencies shows variables that depend on other variables as a Dependency Graph. <br /> Double click on a
        variable to edit it.
      </FeatureInfoBox>
      <div ref={r => (ref = r)} style={{ width: '100%', height: '50vh' }} />
    </>
  );
};
