import { css } from '@emotion/css';
import { useEffect, useState, useMemo } from 'react';
import { major, compare, lte } from 'semver';

import { dateTimeFormatTimeAgo, type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useStyles2, Badge } from '@grafana/ui';

import { formatGrafanaDependency, getLatestCompatibleVersion, shouldDisablePluginInstall } from '../helpers';
import { type CatalogPlugin, PluginUpdateStrategy, type Version } from '../types';

import { VersionInstallButton } from './VersionInstallButton';

interface Props {
  plugin: CatalogPlugin;
}

export const VersionList = ({ plugin }: Props) => {
  const styles = useStyles2(getStyles);
  const pluginId = plugin.id;
  const versions = useMemo(() => plugin.details?.versions ?? [], [plugin.details?.versions]);
  const installedVersion = plugin.installedVersion;
  const disableInstallation = useMemo(() => shouldDisablePluginInstall(plugin), [plugin]);

  const latestCompatibleVersion = getLatestCompatibleVersion(versions);
  const latestMajorVersions = getLatestMajorVersions(versions);

  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    setIsInstalling(false);
  }, [installedVersion]);

  // Check if installed version is in the versions list
  const isInstalledVersionMissing = useMemo(() => {
    if (!installedVersion) {
      return false;
    }
    return !versions.some((v) => v.version === installedVersion);
  }, [versions, installedVersion]);

  if (versions.length === 0 && !isInstalledVersionMissing) {
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

              {/* Install button or status badge */}
              <td>
                {isInstalledVersion && version.status === 'deprecated' ? (
                  <Badge text={t('plugins.version-list.deprecated', 'Deprecated')} color="orange" />
                ) : (
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
                      disableInstallation ||
                      shouldDisableVersionInstallation({
                        version,
                        latestMajorVersions,
                        latestCompatibleVersion: latestCompatibleVersion?.version,
                        installedVersion,
                        updateStrategy: plugin.managed.strategy,
                      })
                    }
                    tooltip={tooltip}
                  />
                )}
              </td>

              {/* Latest release date */}
              <td className={isInstalledVersion ? styles.currentVersion : ''}>
                {dateTimeFormatTimeAgo(version.updatedAt || version.createdAt)}
              </td>
              {/* Dependency */}
              <td className={isInstalledVersion ? styles.currentVersion : ''}>
                {formatGrafanaDependency(version.grafanaDependency)}
              </td>
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
  badge: css({ marginLeft: theme.spacing(1) }),
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

interface ShouldDisableVersionInstallationArgs {
  version: Version;
  latestMajorVersions: Set<string>;
  latestCompatibleVersion: string | undefined;
  installedVersion: string | undefined;
  updateStrategy?: PluginUpdateStrategy;
}

function shouldDisableVersionInstallation({
  version,
  latestMajorVersions,
  latestCompatibleVersion,
  installedVersion,
  updateStrategy,
}: ShouldDisableVersionInstallationArgs) {
  if (!config.pluginAdminExternalManageEnabled) {
    return false;
  }

  if (updateStrategy === PluginUpdateStrategy.MajorAligned) {
    if (!installedVersion) {
      // When no version is installed, only the latest compatible version can be installed
      return version.version !== latestCompatibleVersion;
    }

    const lessThanInstalledVersion = lte(version.version, installedVersion);
    const isLatestMajorVersion = latestMajorVersions.has(version.version);

    // should disable the install when the version is lower than the current installed
    // or when the version is not among the latest major versions
    return lessThanInstalledVersion || !isLatestMajorVersion;
  }

  if (updateStrategy === PluginUpdateStrategy.Assigned) {
    return true;
  }

  return false;
}

/**
 * getLatestMajorVersions gets the latest versions for a given array of versions.
 * It will return a set of versions where each version is the latest version for its major version.
 * @param versions - array containing multiple versions with the same major and multiple major
 * @returns set of latest versions
 */
export function getLatestMajorVersions(versions: Version[]) {
  if (versions.length === 0) {
    return new Set<string>();
  }

  const latestVersions: string[] = [];
  const pureVersions = versions.map((v) => v.version);
  const sortedVersions = pureVersions.sort((a, b) => compare(a, b));

  let currentLatest = sortedVersions[0];
  let index = 1;

  do {
    while (index < sortedVersions.length && major(sortedVersions[index]) === major(currentLatest)) {
      currentLatest = sortedVersions[index];
      index++;
    }
    latestVersions.push(currentLatest);
    currentLatest = sortedVersions[index];
  } while (index < sortedVersions.length);

  return new Set(latestVersions);
}
