import React, { FC, useCallback, useMemo, useState } from 'react';
import { Provider, useSelector } from 'react-redux';
import { css } from 'emotion';
import { Icon, LinkButton, useStyles } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';

import { StoreState } from '../../../types';
import { getVariables } from '../state/selectors';
import { createUsagesNetwork, transformUsagesToNetwork, UsagesToNetwork } from './utils';
import { NetWorkGraph } from './NetworkGraph';
import { store } from '../../../store/store';

interface OwnProps {}

interface ConnectedProps {}

interface DispatchProps {}

type Props = OwnProps & ConnectedProps & DispatchProps;

export const UnProvidedVariablesUnknownGraph: FC<Props> = props => {
  const style = useStyles(getStyles);
  const variables = useSelector((state: StoreState) => getVariables(state));
  const dashboard = useSelector((state: StoreState) => state.dashboard.getModel());
  const { unknown } = useMemo(() => createUsagesNetwork(variables, dashboard), [variables, dashboard]);
  const [networks, setNetWorks] = useState(transformUsagesToNetwork(unknown));
  const onToggleGraph = useCallback(
    (network: UsagesToNetwork) => {
      setNetWorks(
        networks.map(net => {
          if (net !== network) {
            return net;
          }

          return { ...net, showGraph: !network.showGraph };
        })
      );
    },
    [networks, setNetWorks]
  );
  const unknownExist = useMemo(() => Object.keys(unknown).length > 0, [unknown]);

  if (!unknownExist) {
    return null;
  }

  return (
    <div className={style.container}>
      <h5>Unknown Variables</h5>
      <div>
        <table className="filter-table filter-table--hover">
          <thead>
            <tr>
              <th>Variable</th>
              <th colSpan={5} />
            </tr>
          </thead>
          <tbody>
            {networks.map(network => {
              const { variable, nodes, edges, showGraph } = network;
              const { id, name } = variable;
              return (
                <tr key={id}>
                  <td style={{ width: '1%', verticalAlign: 'top' }}>
                    <span className="pointer template-variable">{name}</span>
                  </td>
                  <td style={{ width: '1%' }} />
                  <td style={{ width: '1%' }} />
                  <td style={{ width: '1%' }} />
                  <td
                    style={{ width: '100%', textAlign: 'right' }}
                    className="pointer max-width"
                    onClick={() => onToggleGraph(network)}
                  >
                    {!showGraph && (
                      <>
                        <LinkButton size="sm" variant="secondary" onClick={() => onToggleGraph(network)}>
                          Show usages
                          <Icon name="angle-down" />
                        </LinkButton>
                      </>
                    )}
                    {showGraph && (
                      <>
                        <LinkButton size="sm" variant="secondary" onClick={() => onToggleGraph(network)}>
                          Hide usages
                          <Icon name="angle-up" />
                        </LinkButton>
                        <NetWorkGraph nodes={nodes} edges={edges} direction="RL" width="100%" height="400px" />
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  container: css`
    margin-top: ${theme.spacing.xl};
    padding-top: ${theme.spacing.xl};
    border-top: 1px solid ${theme.colors.panelBorder};
  `,
});

export const VariablesUnknownGraph: FC<Props> = props => (
  <Provider store={store}>
    <UnProvidedVariablesUnknownGraph {...props} />
  </Provider>
);
