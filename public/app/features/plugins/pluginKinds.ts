import { type AppPluginConfig, type AppPluginKind, isIconName } from '@grafana/data';
import { DEFAULT_LANGUAGE } from '@grafana/i18n';
import { getI18nInstance, getResolvedLanguage } from '@grafana/i18n/internal';
import { kindLabel, type KindInfo } from '@grafana/runtime/unstable';
import { addKinds, findKind } from 'app/core/kinds/coreKinds';

import { addTranslationsToI18n } from './importer/addTranslationsToI18n';

/**
 * Adds the kinds that app plugins declare in plugin.json to the kind registry, so Grafana names, draws and links
 * their objects before the plugins' modules load. A kind already in the registry keeps its row, and a module that
 * adds its kinds later replaces these: the module knows more about its kinds, such as titles in its links.
 */
export function addDeclaredPluginKinds(apps: AppPluginConfig[]) {
  const declared = apps.flatMap((app) => (app.kinds ?? []).flatMap((kind) => toKindInfo(app.id, kind)));
  addKinds(declared.filter(({ group, kind }) => !findKind(group, kind)));

  for (const { id, kinds = [], translations } of apps) {
    // Only the labels need the plugin's translations; its module loads them again with the rest. A label reads in
    // English until they have loaded, and a failed load is logged there
    if (translations && kinds.some(({ labelKey, labelPluralKey }) => labelKey || labelPluralKey)) {
      void addTranslationsToI18n({
        resolvedLanguage: getResolvedLanguage(),
        fallbackLanguage: DEFAULT_LANGUAGE,
        pluginId: id,
        translations,
      });
    }
  }
}

function toKindInfo(pluginId: string, declared: AppPluginKind): KindInfo[] {
  const { group, kind, resource, folderScoped, icon, route, label, labelPlural, labelKey, labelPluralKey } = declared;
  if (!group || !kind || !resource || !label || !labelPlural || !isIconName(icon) || !isOwnRoute(pluginId, route)) {
    console.warn(
      `[Plugins] ${pluginId} declares the kind ${group}/${kind} in plugin.json without a group, kind, resource, ` +
        `labels, a Grafana icon, or a route with {name} under /a/${pluginId}/. Grafana leaves it out.`
    );
    return [];
  }
  return [
    {
      group,
      kind,
      resource,
      folderScoped,
      icon,
      getLabel: kindLabel(() => translate(pluginId, labelKey, label)),
      getPluralLabel: kindLabel(() => translate(pluginId, labelPluralKey, labelPlural)),
      getRoute: (name) => route.replaceAll('{name}', encodeURIComponent(name)),
    },
  ];
}

// The plugin's translations are its own namespace, named by its id; until they load, the label is English
function translate(pluginId: string, key: string | undefined, english: string): string {
  return key ? getI18nInstance().t(key, { ns: pluginId, defaultValue: english }) : english;
}

// A declared route only links into the plugin's own pages. Resolving it catches one that leaves them through `..`
function isOwnRoute(pluginId: string, route: string): boolean {
  const prefix = `/a/${pluginId}/`;
  return (
    route.includes('{name}') &&
    route.startsWith(prefix) &&
    new URL(route.replaceAll('{name}', 'name'), 'http://grafana').pathname.startsWith(prefix)
  );
}
