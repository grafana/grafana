/*
  Transforms CDN hosted plugin source code.
  Plugins that require loading via a CDN need to have their asset paths translated to point to the configured CDN.
  e.g. public/plugins/my-plugin/data/ -> http://my-host.com/my-plugin/0.3.3/public/plugins/my-plugin/data/
 */
export function transformPluginSourceForCDN({
  url,
  source,
  transformSourceMapURL = false,
  transformAssets = true,
}: {
  url: string;
  source: string;
  transformSourceMapURL?: boolean;
  transformAssets?: boolean;
}): string {
  const splitUrl = url.split('/public/plugins/');
  const baseAddress = splitUrl[0];
  const pluginId = splitUrl[1].split('/')[0];

  // handle basic asset paths that include public/plugins
  let newSource = source;
  if (transformAssets) {
    newSource = newSource.replace(/(\/?)(public\/plugins)/g, `${baseAddress}/$2`);
    newSource = newSource.replace(/(["|'])(plugins\/.+?.css)(["|'])/g, `$1${baseAddress}/public/$2$3`);
  }

  if (transformSourceMapURL) {
    newSource = newSource.replace(
      /(\/\/#\ssourceMappingURL=)(.+)\.map/g,
      `$1${baseAddress}/public/plugins/${pluginId}/$2.map`
    );
  }

  return newSource;
}
