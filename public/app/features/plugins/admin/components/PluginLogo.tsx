import React from 'react';
import { isLocalPlugin } from '../guards';
import { LocalPlugin, Plugin } from '../types';

type PluginLogoProps = {
  plugin: Plugin | LocalPlugin | undefined;
  className?: string;
};

export function PluginLogo({ plugin, className }: PluginLogoProps): React.ReactElement | null {
  return <img src={getImageSrc(plugin)} className={className} />;
}

function getImageSrc(plugin: Plugin | LocalPlugin | undefined): string {
  if (!plugin) {
    return 'https://grafana.com/api/plugins/404notfound/versions/none/logos/small';
  }

  if (isLocalPlugin(plugin)) {
    return plugin?.info?.logos?.large;
  }

  return `https://grafana.com/api/plugins/${plugin.slug}/versions/${plugin.version}/logos/small`;
}
