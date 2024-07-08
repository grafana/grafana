import { useMemo } from 'react';

import { TypedVariableModel } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Button } from '@grafana/ui';

import { NetworkGraphModal } from './NetworkGraphModal';
import { createDependencyEdges, createDependencyNodes, filterNodesWithDependencies } from './utils';

interface Props {
  variables: TypedVariableModel[];
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
