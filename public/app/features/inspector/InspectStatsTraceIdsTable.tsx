import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface Props {
  name: string;
  traceIds: string[];
}

export const InspectStatsTraceIdsTable = ({ name, traceIds }: Props) => {
  const styles = useStyles2(getStyles);

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

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    padding-bottom: ${theme.spacing(2)};
  `,
  cell: css`
    text-align: right;
  `,
});
