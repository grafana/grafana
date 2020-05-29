import React, { FC, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { StoreState } from '../../../types';
import { getVariables } from '../state/selectors';
import { VariableModel } from '../../templating/types';
import { DashboardModel } from '../../dashboard/state';
import { createUsagesNetwork } from './utils';
import { FeatureInfoBox } from '@grafana/ui';
import { FeatureState } from '@grafana/data';

interface OwnProps {}

interface ConnectedProps {}

interface DispatchProps {}

type Props = OwnProps & ConnectedProps & DispatchProps;

export const VariablesUnknown: FC<Props> = props => {
  const variables: VariableModel[] = useSelector((state: StoreState) => getVariables(state));
  const dashboard: DashboardModel = useSelector((state: StoreState) => state.dashboard.getModel());
  const { unknown } = useMemo(() => createUsagesNetwork(variables, dashboard), [variables, dashboard]);

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
