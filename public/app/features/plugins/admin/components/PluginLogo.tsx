import React from 'react';
import { isLocalPlugin } from '../guards';
import { LocalPlugin, Plugin } from '../types';

type PluginLogoProps = {
  plugin: Plugin | LocalPlugin | undefined;
  className?: string;
};

export function PluginLogo({ plugin, className }: PluginLogoProps): React.ReactElement | null {
  // @ts-ignore
  return <img src={getImageSrc(plugin)} className={className} loading="lazy" />;
}

function getImageSrc(plugin: Plugin | LocalPlugin | undefined): string {
  if (!plugin) {
    return 'https://grafana.com/api/plugins/404notfound/versions/none/logos/small';
  }

  if (isLocalPlugin(plugin)) {
    return plugin?.info?.logos?.small;
  }

  return `https://grafana.com/api/plugins/${plugin.slug}/versions/${plugin.version}/logos/small`;
}
