import React, { FC, MouseEvent, useCallback, useMemo, useState } from 'react';
import { Provider, useSelector } from 'react-redux';
// @ts-ignore
import { Button, Modal } from '@grafana/ui';

import { StoreState } from '../../../types';
import { getVariables } from '../state/selectors';
import { createDependencyEdges, createDependencyNodes, filterNodesWithDependencies } from './utils';
import { NetWorkGraph } from './NetworkGraph';
import { store } from '../../../store/store';

interface OwnProps {}

interface ConnectedProps {}

interface DispatchProps {}

type Props = OwnProps & ConnectedProps & DispatchProps;

export const UnProvidedVariablesDependenciesButton: FC<Props> = () => {
  const [showModal, setShowModal] = useState(false);
  const variables = useSelector((state: StoreState) => getVariables(state));
  const nodes = useMemo(() => createDependencyNodes(variables), [variables]);
  const edges = useMemo(() => createDependencyEdges(variables), [variables]);
  const onClick = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      setShowModal(true);
    },
    [setShowModal]
  );
  const onClose = useCallback(() => setShowModal(false), [setShowModal]);

  return (
    <>
      <Modal isOpen={showModal} title="Dependency graph" onClickBackdrop={onClose} onDismiss={onClose}>
        <NetWorkGraph nodes={filterNodesWithDependencies(nodes, edges)} edges={edges} width="100%" height="70vh" />
      </Modal>
      <Button onClick={onClick} icon="channel-add" variant="link">
        Show dependency graph...
      </Button>
    </>
  );
};

export const VariablesDependenciesButton: FC<Props> = props => (
  <Provider store={store}>
    <UnProvidedVariablesDependenciesButton {...props} />
  </Provider>
);
