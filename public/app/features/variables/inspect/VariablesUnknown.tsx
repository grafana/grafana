import React, { FC, useMemo } from 'react';
import { Provider, useSelector } from 'react-redux';

import { StoreState } from '../../../types';
import { getVariables } from '../state/selectors';
import { createUsagesNetwork } from './utils';
import { store } from '../../../store/store';
import { useTheme } from '@grafana/ui';

interface OwnProps {}

interface ConnectedProps {}

interface DispatchProps {}

type Props = OwnProps & ConnectedProps & DispatchProps;

export const UnProvidedVariablesUnknown: FC<Props> = props => {
  const theme = useTheme();
  const variables = useSelector((state: StoreState) => getVariables(state));
  const dashboard = useSelector((state: StoreState) => state.dashboard.getModel());
  const { unknown } = useMemo(() => createUsagesNetwork(variables, dashboard), [variables, dashboard]);

  return (
    <div style={{ marginTop: theme.spacing.xl }}>
      <h3 className="dashboard-settings__header">Unknown Variables</h3>
      {Object.keys(unknown).length > 0 && (
        <div>
          <table className="filter-table filter-table--hover">
            <thead>
              <tr>
                <th>Variable</th>
                <th />
                <th>Usages</th>
                <th colSpan={2} />
              </tr>
            </thead>
            <tbody>
              {Object.keys(unknown).map(key => {
                return (
                  <tr key={key}>
                    <td style={{ width: '1%', verticalAlign: 'top' }}>
                      <span>{key}</span>
                    </td>
                    <td style={{ width: '1%' }} />
                    <td style={{ maxWidth: '200px' }}>{/*<JSONFormatter json={unknown[key]} open={0} />*/}</td>
                    <td style={{ width: '1%' }} />
                    <td style={{ width: '1%' }} />
                    <td style={{ width: '1%' }} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const VariablesUnknown: FC<Props> = props => (
  <Provider store={store}>
    <UnProvidedVariablesUnknown {...props} />
  </Provider>
);
