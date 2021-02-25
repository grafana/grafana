import React, { FC, useMemo } from 'react';
import { Provider } from 'react-redux';
import { IconButton } from '@grafana/ui';
import { createUsagesNetwork, transformUsagesToNetwork } from './utils';
import { store } from '../../../store/store';
import { VariableModel } from '../types';
import { DashboardModel } from '../../dashboard/state';
import { NetworkGraphModal } from './NetworkGraphModal';

interface OwnProps {
  variable: VariableModel;
  variables: VariableModel[];
  dashboard: DashboardModel | null;
}

interface ConnectedProps {}

interface DispatchProps {}

type Props = OwnProps & ConnectedProps & DispatchProps;

export const UnProvidedVariablesUnknownGraphButton: FC<Props> = ({ variable, variables, dashboard }) => {
  const { id } = variable;
  const { unknown } = useMemo(() => createUsagesNetwork(variables, dashboard), [variables, dashboard]);
  const network = useMemo(() => transformUsagesToNetwork(unknown).find((n) => n.variable.id === id), [id, unknown]);
  const unknownExist = useMemo(() => Object.keys(unknown).length > 0, [unknown]);

  if (!unknownExist || !network) {
    return null;
  }

  const nodes = network.nodes.map((n) => {
    if (n.label.includes(`$${id}`)) {
      return { ...n, color: '#FB7E81' };
    }
    return n;
  });

  return (
    <NetworkGraphModal show={false} title={`Showing usages for: $${id}`} nodes={nodes} edges={network.edges}>
      {({ showModal }) => {
        return <IconButton onClick={() => showModal()} name="code-branch" title="Show usages" />;
      }}
    </NetworkGraphModal>
  );
};

export const VariablesUnknownButton: FC<Props> = (props) => (
  <Provider store={store}>
    <UnProvidedVariablesUnknownGraphButton {...props} />
  </Provider>
);
