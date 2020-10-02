import React, { FC, MouseEvent, useCallback, useMemo, useState } from 'react';
import { Provider, useSelector } from 'react-redux';

import { StoreState } from '../../../types';
import { getVariable, getVariables } from '../state/selectors';
import { createUsagesNetwork, transformUsagesToNetwork } from './utils';
import { VariableIdentifier } from '../state/types';
import { NetWorkGraph } from './NetworkGraph';
import { store } from '../../../store/store';
import { isAdHoc } from '../guard';
import { IconButton, Modal } from '@grafana/ui';

interface OwnProps {
  identifier: VariableIdentifier;
}

interface ConnectedProps {}

interface DispatchProps {}

type Props = OwnProps & ConnectedProps & DispatchProps;

export const UnProvidedVariableUsagesGraphButton: FC<Props> = ({ identifier }) => {
  const [showModal, setShowModal] = useState(false);
  const variables = useSelector((state: StoreState) => getVariables(state));
  const variable = useSelector((state: StoreState) => getVariable(identifier.id, state));
  const dashboard = useSelector((state: StoreState) => state.dashboard.getModel());
  const { usages } = useMemo(() => createUsagesNetwork(variables, dashboard), [variables, dashboard]);
  const network = useMemo(() => transformUsagesToNetwork(usages).find(n => n.variable.id === identifier.id), [
    usages,
    identifier,
  ]);
  const adhoc = useMemo(() => isAdHoc(variable), [variable]);
  const onClick = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      setShowModal(true);
    },
    [setShowModal]
  );
  const onClose = useCallback(() => setShowModal(false), [setShowModal]);

  if (usages.length === 0 || adhoc || !network) {
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
        icon="info-circle"
        iconTooltip="The graph can be moved, zoomed in and zoomed out."
        onClickBackdrop={onClose}
        onDismiss={onClose}
      >
        <NetWorkGraph nodes={nodes} edges={network.edges} direction="UD" />
      </Modal>
      <IconButton onClick={onClick} name="code-branch" title="Show usages" />
    </>
  );
};

export const VariableUsagesButton: FC<Props> = props => (
  <Provider store={store}>
    <UnProvidedVariableUsagesGraphButton {...props} />
  </Provider>
);
