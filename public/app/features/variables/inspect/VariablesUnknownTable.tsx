import React, { FC, useMemo } from 'react';
import { Provider } from 'react-redux';
import { css } from 'emotion';
import { Icon, Tooltip, useStyles } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { createUsagesNetwork, transformUsagesToNetwork } from './utils';
import { store } from '../../../store/store';
import { VariablesUnknownButton } from './VariablesUnknownButton';
import { VariableModel } from '../types';
import { DashboardModel } from '../../dashboard/state';

interface OwnProps {
  variables: VariableModel[];
  dashboard: DashboardModel | null;
}

interface ConnectedProps {}

interface DispatchProps {}

type Props = OwnProps & ConnectedProps & DispatchProps;

export const UnProvidedVariablesUnknownTable: FC<Props> = ({ variables, dashboard }) => {
  const style = useStyles(getStyles);
  const { unknown } = useMemo(() => createUsagesNetwork(variables, dashboard), [variables, dashboard]);
  const networks = useMemo(() => transformUsagesToNetwork(unknown), [unknown]);
  const unknownExist = useMemo(() => Object.keys(unknown).length > 0, [unknown]);

  if (!unknownExist) {
    return null;
  }

  return (
    <div className={style.container}>
      <h5>
        Unknown Variables
        <Tooltip content="This table lists all variable references that no longer exist in this dashboard.">
          <Icon name="info-circle" className={style.infoIcon} />
        </Tooltip>
      </h5>

      <div>
        <table className="filter-table filter-table--hover">
          <thead>
            <tr>
              <th>Variable</th>
              <th colSpan={5} />
            </tr>
          </thead>
          <tbody>
            {networks.map((network) => {
              const { variable } = network;
              const { id, name } = variable;
              return (
                <tr key={id}>
                  <td className={style.firstColumn}>
                    <span>{name}</span>
                  </td>
                  <td className={style.defaultColumn} />
                  <td className={style.defaultColumn} />
                  <td className={style.defaultColumn} />
                  <td className={style.lastColumn}>
                    <VariablesUnknownButton variable={variable} variables={variables} dashboard={dashboard} />
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
  infoIcon: css`
    margin-left: ${theme.spacing.sm};
  `,
  defaultColumn: css`
    width: 1%;
  `,
  firstColumn: css`
    width: 1%;
    vertical-align: top;
    color: ${theme.colors.textStrong};
  `,
  lastColumn: css`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 100%;
    text-align: right;
  `,
});

export const VariablesUnknownTable: FC<Props> = (props) => (
  <Provider store={store}>
    <UnProvidedVariablesUnknownTable {...props} />
  </Provider>
);
