import React, { FC } from 'react';
import { css } from 'emotion';
import { Icon, Tooltip, useStyles } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { UsagesToNetwork } from './utils';
import { VariablesUnknownButton } from './VariablesUnknownButton';

interface Props {
  usages: UsagesToNetwork[];
}

export const VariablesUnknownTable: FC<Props> = ({ usages }) => {
  const style = useStyles(getStyles);
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
            {usages.map((usage) => {
              const { variable } = usage;
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
                    <VariablesUnknownButton id={variable.id} usages={usages} />
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
