import React, { FC, MouseEvent, useCallback, useMemo, useState } from 'react';
import { Provider, useSelector } from 'react-redux';
import { IconButton, Modal } from '@grafana/ui';

import { StoreState } from '../../../types';
import { getVariables } from '../state/selectors';
import { createUsagesNetwork, transformUsagesToNetwork } from './utils';
import { NetWorkGraph } from './NetworkGraph';
import { store } from '../../../store/store';
import { VariableIdentifier } from '../state/types';

interface OwnProps {
  identifier: VariableIdentifier;
}

interface ConnectedProps {}

interface DispatchProps {}

type Props = OwnProps & ConnectedProps & DispatchProps;

export const UnProvidedVariablesUnknownGraphButton: FC<Props> = ({ identifier }) => {
  const [showModal, setShowModal] = useState(false);
  const variables = useSelector((state: StoreState) => getVariables(state));
  const dashboard = useSelector((state: StoreState) => state.dashboard.getModel());
  const { unknown } = useMemo(() => createUsagesNetwork(variables, dashboard), [variables, dashboard]);
  const network = useMemo(() => transformUsagesToNetwork(unknown).find(n => n.variable.id === identifier.id), [
    identifier,
    unknown,
  ]);
  const unknownExist = useMemo(() => Object.keys(unknown).length > 0, [unknown]);
  const onClick = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      setShowModal(true);
    },
    [setShowModal]
  );
  const onClose = useCallback(() => setShowModal(false), [setShowModal]);

  if (!unknownExist || !network) {
    return null;
  }

  const nodes = network.nodes.map(n => {
    if (n.label.includes(`$${identifier.id}`)) {
      return { ...n, color: '#FB7E81' };
    }
    return n;
  });

  return (
    <>
      <Modal
        isOpen={showModal}
        title={`Showing usages for: $${identifier.id}`}
        onClickBackdrop={onClose}
        onDismiss={onClose}
      >
        <NetWorkGraph nodes={nodes} edges={network.edges} direction="UD" width="100%" height="70vh" />
      </Modal>
      <IconButton onClick={onClick} name="code-branch" title="Show usages" />
    </>
  );
};

export const VariablesUnknownGraphButton: FC<Props> = props => (
  <Provider store={store}>
    <UnProvidedVariablesUnknownGraphButton {...props} />
  </Provider>
);
