import React, { FC, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
// @ts-ignore
import { FeatureInfoBox } from '@grafana/ui';
import { FeatureState } from '@grafana/data';

import { StoreState } from '../../../types';
import { getVariable, getVariables } from '../state/selectors';
import { createDependencyEdges, createDependencyNodes, filterNodesWithDependencies } from './utils';
import { toVariableIdentifier, VariableIdentifier } from '../state/types';
import { NetWorkGraph } from './NetworkGraph';

interface OwnProps {
  onEditClick: (identifier: VariableIdentifier) => void;
}

interface ConnectedProps {}

interface DispatchProps {}

type Props = OwnProps & ConnectedProps & DispatchProps;

export const VariablesDependencies: FC<Props> = ({ onEditClick }) => {
  const variables = useSelector((state: StoreState) => getVariables(state));
  const nodes = useMemo(() => createDependencyNodes(variables), [variables]);
  const edges = useMemo(() => createDependencyEdges(variables), [variables]);
  const onDoubleClick = useCallback(
    (id: string) => {
      onEditClick(toVariableIdentifier(getVariable(id)));
    },
    [variables]
  );

  return (
    <>
      <FeatureInfoBox title="Dependencies" featureState={FeatureState.alpha}>
        Dependencies shows variables that depend on other variables as a Dependency Graph. <br /> Double click on a
        variable to edit it.
      </FeatureInfoBox>
      <NetWorkGraph
        nodes={filterNodesWithDependencies(nodes, edges)}
        edges={edges}
        width="100%"
        height="50vh"
        onDoubleClick={onDoubleClick}
      />
    </>
  );
};
