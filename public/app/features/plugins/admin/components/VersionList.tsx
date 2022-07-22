import { css } from '@emotion/css';
import React from 'react';

import { dateTimeFormatTimeAgo, GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { getLatestCompatibleVersion } from '../helpers';
import { Version } from '../types';

interface Props {
  versions?: Version[];
  installedVersion?: string;
}

export const VersionList = ({ versions = [], installedVersion }: Props) => {
  const styles = useStyles2(getStyles);
  const latestCompatibleVersion = getLatestCompatibleVersion(versions);

  if (versions.length === 0) {
    return <p>No version history was found.</p>;
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Version</th>
          <th>Last updated</th>
        </tr>
      </thead>
      <tbody>
        {versions.map((version) => {
          const isInstalledVersion = installedVersion === version.version;
          return (
            <tr key={version.version}>
              {/* Version number */}
              {isInstalledVersion ? (
                <td className={styles.currentVersion}>{version.version} (installed version)</td>
              ) : version.version === latestCompatibleVersion?.version ? (
                <td>{version.version} (latest compatible version)</td>
              ) : (
                <td>{version.version}</td>
              )}

              {/* Last updated */}
              <td className={isInstalledVersion ? styles.currentVersion : ''}>
                {dateTimeFormatTimeAgo(version.createdAt)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    padding: ${theme.spacing(2, 4, 3)};
  `,
  table: css`
    table-layout: fixed;
    width: 100%;
    td,
    th {
      padding: ${theme.spacing()} 0;
    }
    th {
      font-size: ${theme.typography.h5.fontSize};
    }
  `,
  currentVersion: css`
    font-weight: ${theme.typography.fontWeightBold};
  `,
});
