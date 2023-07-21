import { config } from '@grafana/runtime';

import { PLUGIN_CDN_URL_KEY } from '../constants';
/*
  Given an "expected" address of `http://localhost/public/plugin-cdn/{pluginId}/{version}/public/plugins/{pluginId}`
  this function will return the plugin id and version.
 */
export function extractPluginIdVersionFromUrl(address: string) {
  const path = new URL(address).pathname;
  const match = path.split('/');
  return { id: match[3], version: match[4] };
}

/*
  Transforms plugin's source for CDNs loa.
  Plugins that require loading via a CDN need to have their asset paths translated to point to the configured CDN.
  e.g. public/plugins/my-plugin/data/ -> http://my-host.com/my-plugin/0.3.3/public/plugins/my-plugin/data/
 */
export function transformPluginSourceForCDN({
  pluginId,
  version,
  source,
}: {
  pluginId: string;
  version: string;
  source: string;
}): string {
  const baseAddress = `${config.pluginsCDNBaseURL}/${pluginId}/${version}`;
  // handle basic asset paths that include public/plugins
  let newSource = source;
  newSource = source.replace(/(\/?)(public\/plugins)/g, `${baseAddress}/$2`);
  // handle custom plugin css (light and dark themes)
  newSource = newSource.replace(/(["|'])(plugins\/.+?.css)(["|'])/g, `$1${baseAddress}/public/$2$3`);
  // handle external sourcemap links
  newSource = newSource.replace(
    /(\/\/#\ssourceMappingURL=)(.+)\.map/g,
    `$1${baseAddress}/public/plugins/${pluginId}/$2.map`
  );
  return newSource;
}

export function getPluginCdnResourceUrl(localPath: string): string {
  const pluginPath = localPath.split(`/public/${PLUGIN_CDN_URL_KEY}/`);
  return `${config.pluginsCDNBaseURL}/${pluginPath[1]}`;
}
