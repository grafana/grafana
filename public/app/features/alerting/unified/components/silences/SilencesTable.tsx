import React, { FC } from 'react';
import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '@grafana/ui';
import { css } from '@emotion/css';
import { Silence } from 'app/plugins/datasource/alertmanager/types';
import SilenceTableRow from './SilenceTableRow';

interface Props {
  silences: Silence[];
}

const SilencesTable: FC<Props> = ({ silences }) => {
  const styles = useStyles(getStyles);
  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <colgroup>
          <col className={styles.colExpand} />
          <col className={styles.colState} />
          <col className={styles.colMatchers} />
          <col />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th />
            <th>State</th>
            <th>Matchers</th>
            <th>Alerts</th>
            <th>Schedule</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {silences.map((silence, index) => {
            return (
              <SilenceTableRow
                key={silence.id}
                silence={silence}
                className={index % 2 === 0 ? styles.evenRow : undefined}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  wrapper: css`
    margin-top: ${theme.spacing.md};
    margin-left: 36px;
    width: auto;
    padding: ${theme.spacing.sm};
    background-color: ${theme.colors.bg2};
    border-radius: 3px;
    border: solid 1px ${theme.colors.border3};
  `,
  table: css`
    width: 100%;

    th {
      padding: ${theme.spacing.sm};
    }

    td + td {
      padding: 0 ${theme.spacing.sm};
    }

    tr {
      height: 38px;
    }
  `,
  evenRow: css`
    background-color: ${theme.colors.bodyBg};
  `,
  colExpand: css`
    width: 36px;
  `,
  colState: css`
    width: 110px;
  `,
  colMatchers: css`
    width: 600px;
  `,
});

export default SilencesTable;
