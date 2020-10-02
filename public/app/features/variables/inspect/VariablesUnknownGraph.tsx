import React, { FC, useCallback, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { StoreState } from '../../../types';
import { getVariables } from '../state/selectors';
import { createUsagesNetwork, transformUsagesToNetwork, UsagesToNetwork } from './utils';
import { FeatureInfoBox, Icon, LinkButton } from '@grafana/ui';
import { FeatureState } from '@grafana/data';
import { NetWorkGraph } from './NetworkGraph';

interface OwnProps {}

interface ConnectedProps {}

interface DispatchProps {}

type Props = OwnProps & ConnectedProps & DispatchProps;

export const VariablesUnknownGraph: FC<Props> = props => {
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

  return (
    <div>
      <FeatureInfoBox title="Unknown" featureState={FeatureState.alpha}>
        Unknown shows variables that don't exist any longer.
      </FeatureInfoBox>

      {Object.keys(unknown).length > 0 && (
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
                            Show graph
                            <Icon name="angle-down" />
                          </LinkButton>
                        </>
                      )}
                      {showGraph && (
                        <>
                          <LinkButton size="sm" variant="secondary" onClick={() => onToggleGraph(network)}>
                            Hide graph
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
      )}
    </div>
  );
};
