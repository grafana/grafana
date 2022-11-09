import React from 'react';

import { PluginSignatureType } from '@grafana/data';

import { PageInfoItem } from '../../../../core/components/Page/types';
import { PluginDisabledBadge } from '../components/Badges';
import { GetStartedWithPlugin } from '../components/GetStartedWithPlugin';
import { InstallControls } from '../components/InstallControls';
import { PluginDetailsHeaderDependencies } from '../components/PluginDetailsHeaderDependencies';
import { PluginDetailsHeaderSignature } from '../components/PluginDetailsHeaderSignature';
import { getLatestCompatibleVersion } from '../helpers';
import { CatalogPlugin } from '../types';

type ReturnType = {
  actions?: React.ReactNode;
  info?: PageInfoItem[];
};

export const usePluginInfo = (plugin?: CatalogPlugin): ReturnType => {
  if (!plugin) {
    return {};
  }
  const latestCompatibleVersion = getLatestCompatibleVersion(plugin.details?.versions);
  const version = plugin.installedVersion || latestCompatibleVersion?.version;

  const actions = (
    <>
      <InstallControls plugin={plugin} latestCompatibleVersion={latestCompatibleVersion} />
      <GetStartedWithPlugin plugin={plugin} />
    </>
  );
  const info: PageInfoItem[] = [];

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

  return {
    actions,
    info,
  };
};
