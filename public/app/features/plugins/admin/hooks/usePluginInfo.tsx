import { css } from '@emotion/css';

import { GrafanaTheme2, PluginSignatureType } from '@grafana/data';
import { t } from 'app/core/internationalization';

import { PageInfoItem } from '../../../../core/components/Page/types';
import { PluginDisabledBadge } from '../components/Badges';
import { PluginDetailsHeaderDependencies } from '../components/PluginDetailsHeaderDependencies';
import { PluginDetailsHeaderSignature } from '../components/PluginDetailsHeaderSignature';
import { getLatestCompatibleVersion } from '../helpers';
import { CatalogPlugin } from '../types';

export const usePluginInfo = (plugin?: CatalogPlugin): PageInfoItem[] => {
  const info: PageInfoItem[] = [];

  if (!plugin) {
    return info;
  }

  // Populate info
  const latestCompatibleVersion = getLatestCompatibleVersion(plugin.details?.versions);
  const useLatestCompatibleInfo = !plugin.isInstalled;

  const installedVersion = plugin.installedVersion;
  const latestVersion = plugin.latestVersion;

  if (installedVersion || latestVersion) {
    const managedVersionText = 'Managed by Grafana';

    const addInfo = (label: string, value: string | undefined) => {
      if (value) {
        info.push({
          label:
            label === 'installedVersion'
              ? t('plugins.details.labels.installedVersion', 'Installed Version')
              : t('plugins.details.labels.latestVersion', 'Latest Version'),
          value,
        });
      }
    };

    if (plugin.isInstalled) {
      const installedVersionValue = plugin.isManaged ? managedVersionText : installedVersion;
      addInfo('installedVersion', installedVersionValue);
    }

    let latestVersionValue;
    if (plugin.isManaged) {
      latestVersionValue = managedVersionText;
    } else if (plugin.isPreinstalled?.withVersion) {
      latestVersionValue = `${latestVersion} (preinstalled)`;
    } else {
      latestVersionValue = latestVersion;
    }

    addInfo('latestVersion', latestVersionValue);
  }

  if (Boolean(plugin.orgName)) {
    info.push({
      label: t('plugins.details.labels.from', 'From'),
      value: plugin.orgName,
    });
  }

  const showDownloads =
    !plugin.signatureType ||
    plugin.signatureType === PluginSignatureType.community ||
    plugin.signatureType === PluginSignatureType.commercial;
  if (showDownloads && Boolean(plugin.downloads > 0)) {
    info.push({
      label: t('plugins.details.labels.downloads', 'Downloads'),
      value: new Intl.NumberFormat().format(plugin.downloads),
    });
  }

  const pluginDependencies = plugin.details?.pluginDependencies;
  let grafanaDependency = plugin.details?.grafanaDependency;
  if (useLatestCompatibleInfo && latestCompatibleVersion?.grafanaDependency) {
    grafanaDependency = latestCompatibleVersion?.grafanaDependency;
  }
  const hasNoDependencyInfo = !grafanaDependency && (!pluginDependencies || !pluginDependencies.length);

  if (!hasNoDependencyInfo) {
    info.push({
      label: t('plugins.details.labels.dependencies', 'Dependencies'),
      value: <PluginDetailsHeaderDependencies plugin={plugin} grafanaDependency={grafanaDependency} />,
    });
  }

  if (plugin.isDisabled) {
    info.push({
      label: t('plugins.details.labels.status', 'Status'),
      value: <PluginDisabledBadge error={plugin.error!} />,
    });
  }

  info.push({
    label: t('plugins.details.labels.signature', 'Signature'),
    value: <PluginDetailsHeaderSignature plugin={plugin} />,
  });

  return info;
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    subtitle: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
  };
};
