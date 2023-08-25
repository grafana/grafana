import { extractPluginIdVersionFromUrl, getPluginCdnResourceUrl, transformPluginSourceForCDN } from '../cdn/utils';

import type { SystemJSLoad } from './types';

/*
  Locate: Overrides the location of the plugin resource
  Plugins loaded via CDN fall into this plugin via the `plugin-cdn` keyword.
  Systemjs first resolves to an origin on the local filesystem
  (e.g. http://localhost/public/plugin-cdn/{pluginId}/{version}/public/plugins/{pluginId})
  we then split this url and prefix with the CDN base url giving us the correct asset location.
 */
export function locateFromCDN(load: SystemJSLoad) {
  const { address } = load;
  return getPluginCdnResourceUrl(address);
}

/*
  Translate: Returns the translated source from load.source;
 */
export function translateForCDN(load: SystemJSLoad) {
  const { id, version } = extractPluginIdVersionFromUrl(load.name);
  return transformPluginSourceForCDN({ pluginId: id, version, source: load.source });
}
