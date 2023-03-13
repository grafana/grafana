import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { stylesFactory, useTheme2 } from '@grafana/ui';

type Props = {
  name: string;
  traceIds: string[];
};

export const InspectStatsTraceIdsTable = ({ name, traceIds }: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  if (traceIds.length === 0) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <div className="section-heading">{name}</div>
      <table className="filter-table width-30">
        <tbody>
          {traceIds.map((traceId, index) => {
            return (
              <tr key={`${traceId}-${index}`}>
                <td>{traceId}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      padding-bottom: ${theme.spacing(2)};
    `,
    cell: css`
      text-align: right;
    `,
  };
});
