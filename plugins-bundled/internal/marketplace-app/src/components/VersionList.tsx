import React from 'react';
import { css } from 'emotion';

import { dateTimeFormatTimeAgo } from '@grafana/data';
import { useTheme } from '@grafana/ui';
import { Version } from '../types';

interface Props {
  versions: Version[];
}

export const VersionList = ({ versions }: Props) => {
  const theme = useTheme();

  return (
    <table
      className={css`
        width: 100%;
        td,
        th {
          padding: ${theme.spacing.sm} 0;
        }
      `}
    >
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
  );
};
