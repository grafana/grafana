import { config } from '@grafana/runtime';

import type { SystemJSLoad } from './types';

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
  Locate: Overrides the location of the plugin resource
  Plugins loaded via CDN fall into this plugin via the `plugin-cdn` keyword.
  Systemjs first resolves to an origin on the local filesystem
  (e.g. http://localhost/public/plugin-cdn/{pluginId}/{version}/public/plugins/{pluginId})
  we then split this url and prefix with the CDN base url giving us the correct asset location.
 */
export function locateFromCDN(load: SystemJSLoad) {
  const { address } = load;
  const pluginPath = address.split('/public/plugin-cdn/');
  return `${config.pluginsCDNBaseURL}/${pluginPath[1]}`;
}

/*
  Translate: Returns the translated source from load.source, can also set load.metadata.sourceMap for full source maps support.
  Plugins that require loading via a CDN need to have their asset paths translated to point to the configured CDN.
  e.g. public/plugins/my-plugin/data/ -> http://my-host.com/my-plugin/0.3.3/public/plugins/my-plugin/data/
 */
export function translateForCDN(load: SystemJSLoad) {
  const { id, version } = extractPluginIdVersionFromUrl(load.name);
  const baseAddress = `${config.pluginsCDNBaseURL}/${id}/${version}`;
  // handle basic asset paths that include public/plugins
  load.source = load.source.replace(/(\/?)(public\/plugins)/g, `${baseAddress}/$2`);
  // handle custom plugin css (light and dark themes)
  load.source = load.source.replace(/(["|'])(plugins\/.+?.css)(["|'])/g, `$1${baseAddress}/public/$2$3`);
  // handle external sourcemap links
  load.source = load.source.replace(
    /(\/\/#\ssourceMappingURL=)(.+)\.map/g,
    `$1${baseAddress}/public/plugins/${id}/$2.map`
  );

  return load.source;
}
