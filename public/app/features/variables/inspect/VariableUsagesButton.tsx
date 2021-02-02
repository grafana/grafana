import React, { FC, useMemo } from 'react';
import { Provider } from 'react-redux';
import { IconButton } from '@grafana/ui';

import { createUsagesNetwork, transformUsagesToNetwork } from './utils';
import { store } from '../../../store/store';
import { isAdHoc } from '../guard';
import { NetworkGraphModal } from './NetworkGraphModal';
import { VariableModel } from '../types';
import { DashboardModel } from '../../dashboard/state';

interface OwnProps {
  variables: VariableModel[];
  variable: VariableModel;
  dashboard: DashboardModel | null;
}

interface ConnectedProps {}

interface DispatchProps {}

type Props = OwnProps & ConnectedProps & DispatchProps;

export const UnProvidedVariableUsagesGraphButton: FC<Props> = ({ variables, variable, dashboard }) => {
  const { id } = variable;
  const { usages } = useMemo(() => createUsagesNetwork(variables, dashboard), [variables, dashboard]);
  const network = useMemo(() => transformUsagesToNetwork(usages).find((n) => n.variable.id === id), [usages, id]);
  const adhoc = useMemo(() => isAdHoc(variable), [variable]);

  if (usages.length === 0 || adhoc || !network) {
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

export const VariableUsagesButton: FC<Props> = (props) => (
  <Provider store={store}>
    <UnProvidedVariableUsagesGraphButton {...props} />
  </Provider>
);
