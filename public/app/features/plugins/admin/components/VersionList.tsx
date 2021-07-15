import React from 'react';
import { css } from '@emotion/css';

import { dateTimeFormatTimeAgo, GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { Version } from '../types';

interface Props {
  versions: Version[];
}

export const VersionList = ({ versions }: Props) => {
  const styles = useStyles2(getStyles);

  if (versions.length === 0) {
    return <div className={styles.container}>No version history was found.</div>;
  }

  return (
    <div className={styles.container}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Version</th>
            <th>Last updated</th>
          </tr>
        </thead>
        <tbody>
          {versions.map((version) => {
            return (
              <tr key={version.version}>
                <td>{version.version}</td>
                <td>{dateTimeFormatTimeAgo(version.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    padding: ${theme.spacing(2, 4, 3)};
  `,
  table: css`
    width: 100%;
    td,
    th {
      padding: ${theme.spacing()} 0;
    }
    th {
      font-size: ${theme.typography.h5.fontSize};
    }
  `,
});
