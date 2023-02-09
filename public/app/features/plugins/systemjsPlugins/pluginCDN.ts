import { config } from '@grafana/runtime';

import type { SystemJSLoad } from './types';

export function extractPluginNameVersionFromUrl(address: string) {
  const path = new URL(address).pathname;
  const match = path.split('/');
  let version: string | null = null;
  let name: string | null = null;
  for (let i = 0; i < match.length; i++) {
    if (i > 1 && !match[i].match(/\d+\./)) {
      continue;
    }
    // version -> first part that contains digits and at least a dot
    name = match[i - 1];
    version = match[i];
    break;
  }
  return { name, version };
}

export function locateFromCDN(load: SystemJSLoad) {
  const { address } = load;
  // add the pathname (the part after the host) to the URL path when splitting or
  // it'll be repeated twice.
  let rootPath = new URL(config.pluginsCDNBaseURL).pathname;
  if (!rootPath.endsWith('/')) {
    rootPath = rootPath + '/';
  }
  const pluginPath = address.split('/public/plugin-cdn' + rootPath);
  return `${config.pluginsCDNBaseURL}/${pluginPath[1]}`;
}

export function translateForCDN(load: SystemJSLoad) {
  const { name, version } = extractPluginNameVersionFromUrl(load.name);
  const baseAddress = `${config.pluginsCDNBaseURL}/${name}/${version}`;

  load.source = load.source.replace(/(\/?)(public\/plugins)/g, `${baseAddress}/$2`);
  load.source = load.source.replace(/(["|'])(plugins\/.+.css)(["|'])/g, `$1${baseAddress}/public/$2$3`);
  load.source = load.source.replace(
    /(\/\/#\ssourceMappingURL=)(.+)\.map/g,
    `$1${baseAddress}/public/plugins/${name}/$2.map`
  );

  return load.source;
}
