import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { dateTimeFormatTimeAgo, GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
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
    return (
      <p>
        <Trans i18nKey="plugins.version-list.no-version-history-was-found">No version history was found.</Trans>
      </p>
    );
  }

  const onInstallClick = () => {
    setIsInstalling(true);
  };

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>
            <Trans i18nKey="plugins.version-list.version">Version</Trans>
          </th>
          <th></th>
          <th>
            <Trans i18nKey="plugins.version-list.latest-release-date">Latest release date</Trans>
          </th>
          <th>
            <Trans i18nKey="plugins.version-list.grafana-dependency">Grafana dependency</Trans>
          </th>
        </tr>
      </thead>
      <tbody>
        {versions.map((version) => {
          let tooltip: string | undefined = undefined;
          const isInstalledVersion = installedVersion === version.version;

          if (version.angularDetected) {
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
                <td className={styles.currentVersion}>
                  <Trans i18nKey="plugins.version-list.installed-version" values={{ versionNumber: version.version }}>
                    {'{{versionNumber}}'} (installed version)
                  </Trans>
                </td>
              ) : version.version === latestCompatibleVersion?.version ? (
                <td>
                  <Trans
                    i18nKey="plugins.version-list.latest-compatible-version"
                    values={{ versionNumber: version.version }}
                  >
                    {'{{versionNumber}}'} (latest compatible version)
                  </Trans>
                </td>
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
                    version.angularDetected ||
                    !version.isCompatible ||
                    disableInstallation
                  }
                  tooltip={tooltip}
                />
              </td>

              {/* Latest release date */}
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
  container: css({ padding: theme.spacing(2, 4, 3) }),
  currentVersion: css({ fontWeight: theme.typography.fontWeightBold }),
  spinner: css({ marginLeft: theme.spacing(1) }),
  table: css({
    tableLayout: 'fixed',
    width: '100%',
    'td, th': { padding: `${theme.spacing()} 0` },
    th: { fontSize: theme.typography.h5.fontSize },
    td: { wordBreak: 'break-word' },
    'tbody tr:nth-child(odd)': { background: theme.colors.emphasize(theme.colors.background.primary, 0.02) },

    // Display table as cards on narrow screens
    [theme.breakpoints.down('md')]: {
      tableLayout: 'auto',
      thead: { display: 'none' },
      tbody: { display: 'block' },
      'tbody tr': {
        display: 'block',
        marginBottom: theme.spacing(2),
        padding: theme.spacing(2),
        background: theme.colors.background.primary,
        border: `1px solid ${theme.colors.border.weak}`,
        borderRadius: theme.shape.radius.default,
        boxShadow: theme.shadows.z1,
      },
      'tbody td': {
        display: 'block',
        padding: `${theme.spacing(0.5)} 0`,
        borderBottom: `1px solid ${theme.colors.border.weak}`,
        textAlign: 'left',
        '&:last-child': { borderBottom: 'none' },
        '&:before': {
          content: 'attr(data-label)',
          display: 'inline-block',
          fontWeight: theme.typography.fontWeightMedium,
          color: theme.colors.text.secondary,
          fontSize: theme.typography.size.sm,
          marginRight: theme.spacing(1),
          minWidth: '120px',
        },
      },
      'tbody td:nth-child(1)': { '&:before': { content: '"Version:"' } },
      'tbody td:nth-child(2)': { '&:before': { content: '"Action:"' } },
      'tbody td:nth-child(3)': { '&:before': { content: '"Release date:"' } },
      'tbody td:nth-child(4)': { '&:before': { content: '"Dependency:"' } },
    },
  }),
});
