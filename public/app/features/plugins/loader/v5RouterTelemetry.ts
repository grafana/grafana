import { getLogger } from '@grafana/runtime/unstable';

// Plugin bundles are served from `public/plugins/<id>/`, both locally and from the
// CDN. transformPluginSourceForCDN keeps that segment in CDN URLs, so one marker
// covers both. See public/app/features/plugins/cdn/utils.ts.
const PLUGIN_BUNDLE_PATH = /\/public\/plugins\/([^/]+)\//;

// One entry per plugin and export. A single latched flag would hide a second
// plugin that reaches the same export.
const reported = new Set<string>();

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

/**
 * Reports that a plugin used an export that react-router v6 removes.
 *
 * Faro does not collect a stack for a warning, so the caller cannot be
 * identified after the fact. The stack is captured here instead, in the frame
 * of the plugin that made the call.
 *
 * Reports once per plugin and export. When the plugin cannot be identified the
 * event still goes out, with the stack attached, because an unattributed signal
 * is more useful than none.
 */
export function reportV5Usage(exportName: string, stack: string | undefined = new Error().stack): void {
  const pluginId = getPluginIdFromStack(stack);
  const key = `${pluginId ?? stack}:${exportName}`;

  if (reported.has(key)) {
    return;
  }
  reported.add(key);

  getLogger('features.plugins').logWarning(
    'Plugin used a react-router-dom export that v6 removes',
    pluginId ? { pluginId, exportName } : { exportName, stack: stack ?? 'unavailable' }
  );
}
