import { type Spec as DashboardV2Spec, type TabsLayoutTabKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { type PanelIdGenerator } from '../../utils/dashboardSceneGraph';
import { interpolateSectionTitle } from '../../utils/utils';

import { layoutDeserializerRegistry } from './layoutSerializerRegistry';
import { deserializeSectionVariables, serializeSectionVariables } from './sectionVariables';
import { getConditionalRendering } from './utils';

export function serializeTabsLayout(layoutManager: TabsLayoutManager, isSnapshot?: boolean): DashboardV2Spec['layout'] {
  return {
    kind: 'TabsLayout',
    spec: {
      tabs: layoutManager.state.tabs
        .filter((tab) => !tab.state.repeatSourceKey)
        .flatMap((tab) => {
          // Snapshots cannot re-run the repeat on the viewer (there is no live datasource to query),
          // so materialize each repeated tab clone into a concrete tab with its own baked data.
          if (isSnapshot && tab.state.repeatedTabs?.length) {
            return [tab, ...tab.state.repeatedTabs].map((repeatedTab) => serializeTab(repeatedTab, isSnapshot));
          }
          return [serializeTab(tab, isSnapshot)];
        }),
    },
  };
}

export function serializeTab(tab: TabItem, isSnapshot?: boolean): TabsLayoutTabKind {
  const layout = tab.state.layout.serialize(isSnapshot);

  // A repeated tab's title typically references the repeat variable. The repeat's local variable value is
  // not persisted in the snapshot, so bake the interpolated title here (matching the tab renderer) —
  // otherwise every materialized tab would fall back to the global variable value (e.g. "All").
  const isRepeatTab = Boolean(tab.state.repeatByVariable || tab.state.repeatSourceKey);
  const title = isSnapshot && isRepeatTab ? interpolateSectionTitle(tab, tab.state.title) : tab.state.title;

  const tabKind: TabsLayoutTabKind = {
    kind: 'TabsLayoutTab',
    spec: {
      title,
      layout: layout,
      // In snapshot mode the repeat is already materialized into concrete tabs, so we must not emit the
      // repeat directive (it would make the viewer re-expand and collapse back to a single tab).
      ...(tab.state.repeatByVariable &&
        !isSnapshot && {
          repeat: {
            mode: 'variable',
            value: tab.state.repeatByVariable,
          },
        }),
    },
  };

  const sectionVariables = serializeSectionVariables(tab.state.$variables);
  if (sectionVariables) {
    tabKind.spec.variables = sectionVariables;
  }

  const conditionalRenderingRootGroup = tab.state.conditionalRendering?.serialize();
  // Only serialize the conditional rendering if it has items
  if (conditionalRenderingRootGroup?.spec.items.length) {
    tabKind.spec.conditionalRendering = conditionalRenderingRootGroup;
  }

  return tabKind;
}

export function deserializeTabsLayout(
  layout: DashboardV2Spec['layout'],
  elements: DashboardV2Spec['elements'],
  preload: boolean,
  panelIdGenerator?: PanelIdGenerator
): TabsLayoutManager {
  if (layout.kind !== 'TabsLayout') {
    throw new Error('Invalid layout kind');
  }

  const tabs = layout.spec.tabs.map((tab) => {
    return deserializeTab(tab, elements, preload, panelIdGenerator);
  });

  return new TabsLayoutManager({ tabs });
}

export function deserializeTab(
  tab: TabsLayoutTabKind,
  elements: DashboardV2Spec['elements'],
  preload: boolean,
  panelIdGenerator?: PanelIdGenerator
): TabItem {
  const layout = tab.spec.layout;

  return new TabItem({
    title: tab.spec.title,
    $variables: deserializeSectionVariables(tab.spec.variables),
    layout: layoutDeserializerRegistry.get(layout.kind).deserialize(layout, elements, preload, panelIdGenerator),
    repeatByVariable: tab.spec.repeat?.value,
    conditionalRendering: getConditionalRendering(tab),
  });
}
