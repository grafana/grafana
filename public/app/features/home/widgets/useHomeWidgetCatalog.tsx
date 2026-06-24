import { PluginExtensionPoints } from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';

import { HomeSection } from '../HomeSection';

import { getCoreWidgets } from './core/coreWidgets';
import { useIncidentsWidget, useInvestigationsWidget, useOnCallWidget } from './curated/curatedWidgets';
import { type HomeWidgetCatalogEntry } from './types';

export interface UseHomeWidgetCatalogResult {
  entries: HomeWidgetCatalogEntry[];
  isLoading: boolean;
}

/**
 * Merges the three widget sources into one catalog: core built-ins (availability-filtered),
 * core-authored curated widgets (each present only when its backing plugin is installed), and the
 * open `grafana/homepage/widget/v1` plugin extension point. Entries are fully resolved and translated.
 */
export function useHomeWidgetCatalog(): UseHomeWidgetCatalogResult {
  const core = getCoreWidgets()
    .filter((def) => def.isAvailable())
    .map((def): HomeWidgetCatalogEntry => {
      const { Component } = def;
      return {
        id: def.id,
        title: def.title,
        description: def.description,
        icon: def.icon,
        source: 'core',
        defaultSize: def.defaultSize,
        minSize: def.minSize,
        render: () => <Component />,
      };
    });

  const incidents = useIncidentsWidget();
  const oncall = useOnCallWidget();
  const investigations = useInvestigationsWidget();

  const { components, isLoading } = usePluginComponents({
    extensionPointId: PluginExtensionPoints.HomepageWidget,
  });

  const plugin = components.map(
    (Component): HomeWidgetCatalogEntry => ({
      // generateExtensionId(pluginId, extPointId, title) — stable across reloads for a given plugin + title.
      id: Component.meta.id,
      title: Component.meta.title,
      description: Component.meta.description,
      icon: 'plug',
      source: 'plugin',
      defaultSize: { w: 12, h: 8 },
      minSize: { w: 6, h: 4 },
      // Core owns the card; the plugin renders only its content.
      render: () => (
        <HomeSection>
          <Component />
        </HomeSection>
      ),
    })
  );

  const entries = [...core, incidents, oncall, investigations, ...plugin].filter(
    (entry): entry is HomeWidgetCatalogEntry => entry !== null
  );

  return { entries, isLoading };
}
