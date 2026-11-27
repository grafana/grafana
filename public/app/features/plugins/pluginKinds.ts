import { type AppPluginConfig, type AppPluginKind, type IconName, toIconName } from '@grafana/data';
import { kindLabel, type KindInfo } from '@grafana/runtime/unstable';
import { addKinds, findKind } from 'app/core/kinds/coreKinds';
import {
  discoveryResources,
  getAPIGroupDiscoveryList,
  type GroupDiscoveryResource,
} from 'app/features/apiserver/discovery';

// The fields a declared kind cannot do without: an unknown icon and a missing label have fallbacks
const REQUIRED: ReadonlyArray<keyof AppPluginKind> = ['group', 'kind', 'route'];

// What the navigation draws for a link whose icon it does not have
const FALLBACK_ICON = 'link';

// A declared kind that Grafana has checked, with an icon it can draw
interface DeclaredKind extends AppPluginKind {
  icon: IconName;
}

/**
 * Adds the kinds that app plugins declare in plugin.json to the kind registry, so Grafana names, draws and links
 * their objects before the plugins' modules load. plugin.json says which kind it is and how it looks. API discovery
 * says how the server serves it, so a kind the server does not serve is left out. A kind already in the registry
 * keeps its row, and a module that adds its kinds later replaces these: the module knows more about its kinds,
 * such as titles in its links. Resolves once the kinds are in, and never rejects.
 */
export async function addDeclaredPluginKinds(apps: AppPluginConfig[]): Promise<void> {
  const declared = apps.flatMap(({ id, kinds = [] }) => kinds.flatMap((kind) => toDeclaredKind(id, kind)));
  // Discovery costs a request, which only an instance with declared kinds has a use for
  if (declared.length === 0) {
    return;
  }
  const served = await getServedResources();
  const kinds = declared.flatMap((kind) => toKindInfo(kind, served));
  // A plugin's module may have loaded during discovery and added its own
  addKinds(kinds.filter(({ group, kind }) => !findKind(group, kind)));
}

function toDeclaredKind(pluginId: string, declared: AppPluginKind): DeclaredKind[] {
  const { group, kind, icon } = declared;
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
  return [{ ...declared, icon: knownIcon ?? FALLBACK_ICON }];
}

// What the server serves. When it cannot be asked, the declared kinds are left to their plugins' modules to add
async function getServedResources(): Promise<GroupDiscoveryResource[]> {
  try {
    // Without an alert: the user did not ask for this, and cannot act on its failure
    return discoveryResources(await getAPIGroupDiscoveryList({ showErrorAlert: false }));
  } catch (error) {
    console.warn('[Plugins] API discovery failed, so Grafana leaves out the kinds that plugins declare', error);
    return [];
  }
}

// A kind the server does not serve gets no row: nothing could list or open its objects
function toKindInfo(declared: DeclaredKind, served: GroupDiscoveryResource[]): KindInfo[] {
  const { group, kind, icon, route, folderScoped, label, labelPlural } = declared;
  const api = served.find(({ responseKind }) => responseKind.group === group && responseKind.kind === kind);
  if (!api) {
    return [];
  }
  return [
    {
      group,
      kind,
      resource: api.resource,
      // The app manifest's rule: a namespaced kind lives in folders unless it opts out, a cluster-scoped one never
      folderScoped: api.scope === 'Namespaced' && folderScoped !== false,
      icon,
      // plugin.json holds English only, so a kind without labels reads as its API names. The registry translates
      // the kinds Grafana has labels for
      getLabel: kindLabel(() => label || kind.toLowerCase()),
      getPluralLabel: kindLabel(() => labelPlural || api.resource),
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
