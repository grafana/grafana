import React, { FC, useMemo } from 'react';
import { Provider } from 'react-redux';

import { reportInteraction } from '@grafana/runtime';
import { Button } from '@grafana/ui';

import { store } from '../../../store/store';
import { VariableModel } from '../types';

import { NetworkGraphModal } from './NetworkGraphModal';
import { createDependencyEdges, createDependencyNodes, filterNodesWithDependencies } from './utils';

interface OwnProps {
  variables: VariableModel[];
}

interface ConnectedProps {}

interface DispatchProps {}

type Props = OwnProps & ConnectedProps & DispatchProps;

export const UnProvidedVariablesDependenciesButton: FC<Props> = ({ variables }) => {
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

export const VariablesDependenciesButton: FC<Props> = (props) => (
  <Provider store={store}>
    <UnProvidedVariablesDependenciesButton {...props} />
  </Provider>
);
