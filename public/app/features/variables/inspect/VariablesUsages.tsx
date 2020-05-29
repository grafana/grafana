import React, { FC, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { StoreState } from '../../../types';
import { getVariables } from '../state/selectors';
import { VariableModel } from '../../templating/types';
import { DashboardModel } from '../../dashboard/state';
import { createUsagesNetwork } from './utils';
import { FeatureInfoBox, JSONFormatter } from '@grafana/ui';
import { toVariableIdentifier, VariableIdentifier } from '../state/types';
import { FeatureState } from '@grafana/data';

interface OwnProps {
  onEditClick: (identifier: VariableIdentifier) => void;
  onRemoveVariable: (identifier: VariableIdentifier) => void;
}

interface ConnectedProps {}

interface DispatchProps {}

type Props = OwnProps & ConnectedProps & DispatchProps;

export const VariablesUsages: FC<Props> = ({ onEditClick, onRemoveVariable }) => {
  const variables: VariableModel[] = useSelector((state: StoreState) => getVariables(state));
  const dashboard: DashboardModel = useSelector((state: StoreState) => state.dashboard.getModel());
  const { usages } = useMemo(() => createUsagesNetwork(variables, dashboard), [variables, dashboard]);

  return (
    <div>
      <FeatureInfoBox title="Usages" featureState={FeatureState.alpha}>
        Usages shows where a variable is used.
      </FeatureInfoBox>

      {usages.length > 0 && (
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
              {usages.map(usage => {
                return (
                  <tr key={usage.variable.id}>
                    <td style={{ width: '1%', verticalAlign: 'top' }}>
                      <span
                        onClick={() => onEditClick(toVariableIdentifier(usage.variable))}
                        className="pointer template-variable"
                      >
                        {usage.variable.name}
                      </span>
                    </td>
                    <td style={{ width: '1%' }} />
                    <td style={{ maxWidth: '200px' }} className="pointer max-width">
                      <JSONFormatter json={usage.tree} open={0} />
                    </td>
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
