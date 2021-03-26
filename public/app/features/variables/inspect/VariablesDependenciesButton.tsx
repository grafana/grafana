import React, { FC, useMemo } from 'react';
import { Provider } from 'react-redux';
// @ts-ignore
import { Button } from '@grafana/ui';
import { createDependencyEdges, createDependencyNodes, filterNodesWithDependencies } from './utils';
import { store } from '../../../store/store';
import { VariableModel } from '../types';
import { NetworkGraphModal } from './NetworkGraphModal';

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
          <Button onClick={() => showModal()} icon="channel-add" variant="secondary">
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
