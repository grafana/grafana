import { cdnHost } from './constants';
import type { SystemJSLoad } from './types';

export function extractPluginNameVersionFromUrl(address: string) {
  const path = new URL(address).pathname;
  const match = path.split('/');
  return { name: match[3], version: match[4] };
}

export function locateFromCDN(load: SystemJSLoad) {
  const { address } = load;
  const pluginPath = address.split('/public/plugin-cdn/');
  return `${cdnHost}/${pluginPath[1]}`;
}

export function translateForCDN(load: SystemJSLoad) {
  const { name, version } = extractPluginNameVersionFromUrl(load.name);
  const baseAddress = `${cdnHost}/${name}/${version}`;

  load.source = load.source.replace(/(\/?)(public\/plugins)/g, `${baseAddress}/$2`);
  load.source = load.source.replace(/(["|'])(plugins\/.+.css)(["|'])/g, `$1${baseAddress}/public/$2$3`);
  load.source = load.source.replace(
    /(\/\/#\ssourceMappingURL=)(.+)\.map/g,
    `$1${baseAddress}/public/plugins/${name}/$2.map`
  );

  return load.source;
}
