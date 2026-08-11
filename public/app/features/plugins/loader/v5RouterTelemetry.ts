// Plugin bundles are served from `public/plugins/<id>/`, both locally and from the
// CDN. transformPluginSourceForCDN keeps that segment in CDN URLs, so one marker
// covers both. See public/app/features/plugins/cdn/utils.ts.
const PLUGIN_BUNDLE_PATH = /\/public\/plugins\/([^/]+)\//;

/**
 * Reads the plugin id out of a captured stack.
 *
 * The shared dependency is a singleton, so a caller cannot be identified from
 * anything the loader holds. The wrapper captures its own stack instead, which
 * runs in the frame of the plugin that called it.
 *
 * Frame formats differ between browsers, so this matches on the bundle path
 * rather than on frame syntax. The first match is the nearest caller.
 */
export function getPluginIdFromStack(stack: string | undefined): string | undefined {
  if (!stack) {
    return undefined;
  }

  return stack.match(PLUGIN_BUNDLE_PATH)?.[1];
}
