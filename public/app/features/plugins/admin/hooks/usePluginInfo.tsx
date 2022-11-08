import React from 'react';

import { PageInfoItem } from '../../../../core/components/Page/types';
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

  if (Boolean(plugin.downloads > 0)) {
    info.push({
      label: 'Downloads',
      value: new Intl.NumberFormat().format(plugin.downloads),
    });
  }

  info.push({
    label: 'Dependencies',
    value: <PluginDetailsHeaderDependencies plugin={plugin} latestCompatibleVersion={latestCompatibleVersion} />,
  });

  info.push({
    label: 'Signature',
    value: <PluginDetailsHeaderSignature plugin={plugin} />,
  });

  // return (
  //       {plugin.isDisabled && <PluginDisabledBadge error={plugin.error!} />}
  //     </div>
  //   </div>
  // );
  return {
    actions,
    info,
  };
};
