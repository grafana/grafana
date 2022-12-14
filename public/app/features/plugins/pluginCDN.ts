// ⚠️ POC plugin CDN stuffs! ⚠️
export const cdnHost = 'https://plugin-cdn.storage.googleapis.com';

export function extractPluginDeets(address: string) {
  const path = new URL(address).pathname;
  const match = path.split('/');
  return { name: match[3], version: match[4] };
}

export function locateFromCDN(load: { address: string }): string {
  const { address } = load;
  // http://localhost:3000/public/plugin-cdn/pluginID/version/module
  const pluginPath = address.split('/public/plugin-cdn/');
  // https://plugin-cdn.storage.googleapis.com/pluginID/version/module
  return `${cdnHost}/${pluginPath[1]}`;
}

export function translateForCDN(load: any): any {
  const { name, version } = extractPluginDeets(load.name);
  const baseAddress = `${cdnHost}/${name}/${version}`;

  // @ts-ignore
  load.source = load.source.replace(/(\/?)(public\/plugins)/g, `${baseAddress}/$2`);
  load.source = load.source.replace(/(["|'])(plugins\/.+.css)(["|'])/g, `$1${baseAddress}/public/$2$3`);
  load.source = load.source.replace(
    /(\/\/#\ssourceMappingURL=)(.+)\.map/g,
    `$1${baseAddress}/public/plugins/${name}/$2.map`
  );

  return load.source;
}

// http://localhost:3000/%22https://plugin-cdn.storage.googleapis.com/grafana-worldmap-panel/0.3.3/plugins/grafana-worldmap-panel/css/worldmap.dark.css%22?_cache=1670855773342
