import React, { useMemo } from 'react';

import { reportInteraction } from '@grafana/runtime';
import { SceneVariable, SceneVariableState } from '@grafana/scenes';
import { Button } from '@grafana/ui';
import { NetworkGraphModal } from 'app/features/variables/inspect/NetworkGraphModal';

import { createDependencyEdges, createDependencyNodes, filterNodesWithDependencies } from './utils';

interface Props {
  variables: Array<SceneVariable<SceneVariableState>>;
}

export const VariablesDependenciesButton = ({ variables }: Props) => {
  const nodes = useMemo(() => createDependencyNodes(variables), [variables]);
  const edges = useMemo(() => createDependencyEdges(variables), [variables]);

  if (!edges.length) {
    return null;
  }

  return (
    <NetworkGraphModal
      show={false}
      title="Dependencies"
      nodes={filterNodesWithDependencies(nodes, edges)}
      edges={edges}
    >
      {({ showModal }) => {
        return (
          <Button
            onClick={() => {
              reportInteraction('Show variable dependencies');
              showModal();
            }}
            icon="channel-add"
            variant="secondary"
          >
            Show dependencies
          </Button>
        );
      }}
    </NetworkGraphModal>
  );
};
