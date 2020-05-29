import React, { FC, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { StoreState } from '../../../types';
import { getVariables } from '../state/selectors';
import { VariableModel } from '../../templating/types';
import { DashboardModel } from '../../dashboard/state';
import { createUsagesNetwork } from './utils';
import { Icon } from '@grafana/ui';
import { toVariableIdentifier, VariableIdentifier } from '../state/types';

interface OwnProps {
  onEditClick: (identifier: VariableIdentifier) => void;
  onRemoveVariable: (identifier: VariableIdentifier) => void;
}

interface ConnectedProps {}

interface DispatchProps {}

type Props = OwnProps & ConnectedProps & DispatchProps;

export const VariablesUnUsed: FC<Props> = ({ onEditClick, onRemoveVariable }) => {
  const variables: VariableModel[] = useSelector((state: StoreState) => getVariables(state));
  const dashboard: DashboardModel = useSelector((state: StoreState) => state.dashboard.getModel());
  const { unUsed } = useMemo(() => createUsagesNetwork(variables, dashboard), [variables, dashboard]);

  return (
    <div>
      {unUsed.length > 0 && (
        <div>
          <table className="filter-table filter-table--hover">
            <thead>
              <tr>
                <th>Variable</th>
                <th colSpan={5} />
              </tr>
            </thead>
            <tbody>
              {unUsed.map(variable => {
                return (
                  <tr key={variable.id}>
                    <td style={{ width: '1%' }}>
                      <span
                        onClick={() => onEditClick(toVariableIdentifier(variable))}
                        className="pointer template-variable"
                      >
                        {variable.name}
                      </span>
                    </td>
                    <td
                      style={{ maxWidth: '200px' }}
                      onClick={() => onEditClick(toVariableIdentifier(variable))}
                      className="pointer max-width"
                    />
                    <td style={{ width: '1%' }}></td>
                    <td style={{ width: '1%' }}></td>
                    <td style={{ width: '1%' }}></td>
                    <td style={{ width: '1%' }}>
                      <a
                        onClick={event => onRemoveVariable(toVariableIdentifier(variable))}
                        className="btn btn-danger btn-small"
                      >
                        <Icon name="times" style={{ marginBottom: 0 }} />
                        Delete
                      </a>
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
