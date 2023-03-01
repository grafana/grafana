import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, PluginSignatureType } from '@grafana/data';

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
  const version = plugin.installedVersion || latestCompatibleVersion?.version;

  if (Boolean(version)) {
    info.push({
      label: 'Version',
      value: version,
    });
  }

  if (Boolean(plugin.orgName)) {
    info.push({
      label: 'From',
      value: plugin.orgName,
    });
  }

  const showDownloads =
    !plugin.signatureType ||
    plugin.signatureType === PluginSignatureType.community ||
    plugin.signatureType === PluginSignatureType.commercial;
  if (showDownloads && Boolean(plugin.downloads > 0)) {
    info.push({
      label: 'Downloads',
      value: new Intl.NumberFormat().format(plugin.downloads),
    });
  }

  const pluginDependencies = plugin.details?.pluginDependencies;
  const grafanaDependency = plugin.isInstalled
    ? plugin.details?.grafanaDependency
    : latestCompatibleVersion?.grafanaDependency || plugin.details?.grafanaDependency;
  const hasNoDependencyInfo = !grafanaDependency && (!pluginDependencies || !pluginDependencies.length);

  if (!hasNoDependencyInfo) {
    info.push({
      label: 'Dependencies',
      value: <PluginDetailsHeaderDependencies plugin={plugin} latestCompatibleVersion={latestCompatibleVersion} />,
    });
  }

  if (plugin.isDisabled) {
    info.push({
      label: 'Status',
      value: <PluginDisabledBadge error={plugin.error!} />,
    });
  }

  info.push({
    label: 'Signature',
    value: <PluginDetailsHeaderSignature plugin={plugin} />,
  });

  return info;
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    subtitle: css`
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing(1)};
    `,
  };
};
