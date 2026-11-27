import { type AppPluginConfig, type AppPluginKind, toIconName } from '@grafana/data';
import { kindLabel, type KindInfo } from '@grafana/runtime/unstable';
import { addKinds, findKind } from 'app/core/kinds/coreKinds';

// The fields a declared kind cannot do without: an unknown icon and a missing label have fallbacks, and
// `folderScoped` is a boolean
const REQUIRED: ReadonlyArray<keyof AppPluginKind> = ['group', 'kind', 'resource', 'route'];

// What the navigation draws for a link whose icon it does not have
const FALLBACK_ICON = 'link';

/**
 * Adds the kinds that app plugins declare in plugin.json to the kind registry, so Grafana names, draws and links
 * their objects before the plugins' modules load. A kind already in the registry keeps its row, and a module that
 * adds its kinds later replaces these: the module knows more about its kinds, such as titles in its links.
 */
export function addDeclaredPluginKinds(apps: AppPluginConfig[]) {
  const declared = apps.flatMap((app) => (app.kinds ?? []).flatMap((kind) => toKindInfo(app.id, kind)));
  addKinds(declared.filter(({ group, kind }) => !findKind(group, kind)));
}

function toKindInfo(pluginId: string, declared: AppPluginKind): KindInfo[] {
  const { group, kind, resource, folderScoped, icon, route, label, labelPlural } = declared;
  const warn = (problem: string) =>
    console.warn(`[Plugins] ${pluginId} declares the kind ${group}/${kind} in plugin.json ${problem}`);

  const problem = findProblem(pluginId, declared);
  if (problem) {
    warn(`${problem}. Grafana leaves it out.`);
    return [];
  }
  // A plugin built for a newer Grafana may name an icon this one lacks: no reason to hide its objects
  const knownIcon = toIconName(icon);
  if (!knownIcon) {
    warn(`with the icon "${icon}", which Grafana does not have. Grafana draws "${FALLBACK_ICON}" instead.`);
  }
  return [
    {
      group,
      kind,
      resource,
      folderScoped,
      icon: knownIcon ?? FALLBACK_ICON,
      // plugin.json holds English only, so a kind without labels reads as its API names. The registry translates
      // the kinds Grafana has labels for
      getLabel: kindLabel(() => label || kind.toLowerCase()),
      getPluralLabel: kindLabel(() => labelPlural || resource),
      getRoute: (name) => route.replaceAll('{name}', encodeURIComponent(name)),
    },
  ];
}

// Why Grafana leaves a declared kind out, worded to end the sentence the warning starts
function findProblem(pluginId: string, declared: AppPluginKind): string | undefined {
  const missing = REQUIRED.filter((field) => !declared[field]);
  if (missing.length > 0) {
    return `without ${missing.join(', ')}`;
  }
  if (!declared.route.includes('{name}')) {
    return 'with a route that has no {name}';
  }
  if (!isOwnRoute(pluginId, declared.route)) {
    return `with a route outside /a/${pluginId}/`;
  }
  return undefined;
}

// A declared route only links into the plugin's own pages. Resolving it catches one that leaves them through `..`
function isOwnRoute(pluginId: string, route: string): boolean {
  const prefix = `/a/${pluginId}/`;
  return (
    route.startsWith(prefix) &&
    new URL(route.replaceAll('{name}', 'name'), 'http://grafana').pathname.startsWith(prefix)
  );
}
