import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { dateTimeFormatTimeAgo, GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

import { getLatestCompatibleVersion } from '../helpers';
import { Version } from '../types';

import { VersionInstallButton } from './VersionInstallButton';

interface Props {
  pluginId: string;
  versions?: Version[];
  installedVersion?: string;
  disableInstallation: boolean;
}

export const VersionList = ({ pluginId, versions = [], installedVersion, disableInstallation }: Props) => {
  const styles = useStyles2(getStyles);
  const latestCompatibleVersion = getLatestCompatibleVersion(versions);

  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    setIsInstalling(false);
  }, [installedVersion]);

  if (versions.length === 0) {
    return <p>No version history was found.</p>;
  }

  const onInstallClick = () => {
    setIsInstalling(true);
  };

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Version</th>
          <th></th>
          <th>Last updated</th>
          <th>Grafana Dependency</th>
        </tr>
      </thead>
      <tbody>
        {versions.map((version) => {
          let tooltip: string | undefined = undefined;
          const isInstalledVersion = installedVersion === version.version;
          const canInstall = version.angularDetected ? config.angularSupportEnabled : true;

          if (!canInstall) {
            tooltip = 'This plugin version is AngularJS type which is not supported';
          }

          if (!version.isCompatible) {
            tooltip = 'This plugin version is not compatible with the current Grafana version';
          }

          if (disableInstallation) {
            tooltip = `This plugin can't be managed through the Plugin Catalog`;
          }

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

              {/* Install button */}
              <td>
                <VersionInstallButton
                  pluginId={pluginId}
                  version={version}
                  latestCompatibleVersion={latestCompatibleVersion?.version}
                  installedVersion={installedVersion}
                  onConfirmInstallation={onInstallClick}
                  disabled={
                    isInstalledVersion ||
                    isInstalling ||
                    !canInstall ||
                    !version.isCompatible ||
                    !canInstall ||
                    disableInstallation
                  }
                  tooltip={tooltip}
                />
              </td>

              {/* Last updated */}
              <td className={isInstalledVersion ? styles.currentVersion : ''}>
                {dateTimeFormatTimeAgo(version.updatedAt || version.createdAt)}
              </td>
              {/* Dependency */}
              <td className={isInstalledVersion ? styles.currentVersion : ''}>{version.grafanaDependency || 'N/A'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    padding: theme.spacing(2, 4, 3),
  }),
  currentVersion: css({
    fontWeight: theme.typography.fontWeightBold,
  }),
  spinner: css({
    marginLeft: theme.spacing(1),
  }),
  table: css({
    tableLayout: 'fixed',
    width: '100%',
    'td, th': {
      padding: `${theme.spacing()} 0`,
    },
    th: {
      fontSize: theme.typography.h5.fontSize,
    },
    td: {
      wordBreak: 'break-word',
    },
    'tbody tr:nth-child(odd)': {
      background: theme.colors.emphasize(theme.colors.background.primary, 0.02),
    },
  }),
});
