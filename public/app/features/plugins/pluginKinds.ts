import { type AppPluginConfig, type AppPluginKind, toIconName } from '@grafana/data';
import { DEFAULT_LANGUAGE } from '@grafana/i18n';
import { getI18nInstance, getResolvedLanguage } from '@grafana/i18n/internal';
import { kindLabel, type KindInfo } from '@grafana/runtime/unstable';
import { addKinds, findKind } from 'app/core/kinds/coreKinds';

import { addTranslationsToI18n } from './importer/addTranslationsToI18n';

// The fields a declared kind cannot do without: an unknown icon has a fallback, and `folderScoped` is a boolean
const REQUIRED: ReadonlyArray<keyof AppPluginKind> = ['group', 'kind', 'resource', 'route', 'label', 'labelPlural'];

// What the navigation draws for a link whose icon it does not have
const FALLBACK_ICON = 'link';

/**
 * Adds the kinds that app plugins declare in plugin.json to the kind registry, so Grafana names, draws and links
 * their objects before the plugins' modules load. A kind already in the registry keeps its row, and a module that
 * adds its kinds later replaces these: the module knows more about its kinds, such as titles in its links.
 * Resolves once the kinds of every app are in.
 */
export async function addDeclaredPluginKinds(apps: AppPluginConfig[]): Promise<void> {
  await Promise.all(apps.map(addKindsOf));
}

async function addKindsOf({ id, kinds = [], translations }: AppPluginConfig): Promise<void> {
  const declared = kinds.flatMap((kind) => toKindInfo(id, kind));
  if (declared.length === 0) {
    return;
  }
  // The kinds wait for their labels' translations, so no view draws a label that later changes language. The
  // plugin's module loads the translations again with the rest; a failed load is logged, and the labels stay English
  if (translations && kinds.some(({ labelKey, labelPluralKey }) => labelKey || labelPluralKey)) {
    await addTranslationsToI18n({
      resolvedLanguage: getResolvedLanguage(),
      fallbackLanguage: DEFAULT_LANGUAGE,
      pluginId: id,
      translations,
    });
  }
  // The plugin's module may have loaded in the meantime and added its own
  addKinds(declared.filter(({ group, kind }) => !findKind(group, kind)));
}

function toKindInfo(pluginId: string, declared: AppPluginKind): KindInfo[] {
  const { group, kind, resource, folderScoped, icon, route, label, labelPlural, labelKey, labelPluralKey } = declared;
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
      getLabel: kindLabel(() => translate(pluginId, labelKey, label)),
      getPluralLabel: kindLabel(() => translate(pluginId, labelPluralKey, labelPlural)),
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

// The plugin's translations are its own namespace, named by its id. A label they do not hold reads in English
function translate(pluginId: string, key: string | undefined, english: string): string {
  return key ? getI18nInstance().t(key, { ns: pluginId, defaultValue: english }) : english;
}

// A declared route only links into the plugin's own pages. Resolving it catches one that leaves them through `..`
function isOwnRoute(pluginId: string, route: string): boolean {
  const prefix = `/a/${pluginId}/`;
  return (
    route.startsWith(prefix) &&
    new URL(route.replaceAll('{name}', 'name'), 'http://grafana').pathname.startsWith(prefix)
  );
}
