import { type ComponentTypeWithExtensionMeta, PluginExtensionPoints } from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';

import { type HomepageTabExtensionProps } from '../DashboardTabs/types';
import { HomeSection } from '../HomeSection';

import { getCoreWidgets } from './core/coreWidgets';
import {
  useHostedLogsWidget,
  useHostedMetricsWidget,
  useIncidentsWidget,
  useKubernetesWidget,
  useOnCallWidget,
  useSlosWidget,
} from './curated/curatedWidgets';
import { type HomeWidgetCatalogEntry } from './types';

export interface UseHomeWidgetCatalogResult {
  entries: HomeWidgetCatalogEntry[];
  isLoading: boolean;
}

interface UseHomeWidgetCatalogOptions {
  assistantComponents?: Array<ComponentTypeWithExtensionMeta<{}>>;
  tabComponents?: Array<ComponentTypeWithExtensionMeta<HomepageTabExtensionProps>>;
}

/**
 * Merges the three widget sources into one catalog: core built-ins (availability-filtered),
 * core-authored curated widgets (each present only when its backing plugin is installed), and the
 * open `grafana/homepage/widget/v1` plugin extension point. Entries are fully resolved and translated.
 */
export function useHomeWidgetCatalog({
  assistantComponents,
  tabComponents,
}: UseHomeWidgetCatalogOptions = {}): UseHomeWidgetCatalogResult {
  const core = getCoreWidgets({ assistantComponents, tabComponents })
    .filter((def) => def.isAvailable())
    .map((def): HomeWidgetCatalogEntry => {
      return {
        id: def.id,
        title: def.title,
        description: def.description,
        icon: def.icon,
        source: 'core',
        defaultSize: def.defaultSize,
        minSize: def.minSize,
        render: def.render,
      };
    });

  const incidents = useIncidentsWidget();
  const oncall = useOnCallWidget();
  const kubernetes = useKubernetesWidget();
  const hostedMetrics = useHostedMetricsWidget();
  const hostedLogs = useHostedLogsWidget();
  const slos = useSlosWidget();

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

  const entries = [...core, incidents, oncall, kubernetes, hostedMetrics, hostedLogs, slos, ...plugin].filter(
    (entry): entry is HomeWidgetCatalogEntry => entry !== null
  );

  return { entries, isLoading };
}
