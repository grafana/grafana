import { type Spec as DashboardV2Spec, type TabsLayoutTabKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { type PanelIdGenerator } from '../../utils/dashboardSceneGraph';

import { layoutDeserializerRegistry } from './layoutSerializerRegistry';
import { deserializeSectionVariables, serializeSectionVariables } from './sectionVariables';
import { getConditionalRendering } from './utils';

export function serializeTabsLayout(layoutManager: TabsLayoutManager, isSnapshot?: boolean): DashboardV2Spec['layout'] {
  return {
    kind: 'TabsLayout',
    spec: {
      tabs: layoutManager.state.tabs
        .filter((tab) => !tab.state.repeatSourceKey)
        .map((tab) => serializeTab(tab, isSnapshot)),
    },
  };
}

export function serializeTab(tab: TabItem, isSnapshot?: boolean): TabsLayoutTabKind {
  const layout = tab.state.layout.serialize(isSnapshot);
  // `name` is a v2beta1-only field (tab identifier used by rule targeting). Cast at this boundary;
  // Phase 2 moves the rules support to v3alpha0 where `name` becomes part of the schema.
  const tabKind: TabsLayoutTabKind = {
    kind: 'TabsLayoutTab',
    spec: {
      title: tab.state.title,
      layout: layout,
      ...(tab.state.repeatByVariable && {
        repeat: {
          mode: 'variable',
          value: tab.state.repeatByVariable,
        },
      }),
      ...(tab.state.name !== undefined && { name: tab.state.name }),
    } as TabsLayoutTabKind['spec'],
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
    name: (tab.spec as { name?: string }).name,
    title: tab.spec.title,
    $variables: deserializeSectionVariables(tab.spec.variables),
    layout: layoutDeserializerRegistry.get(layout.kind).deserialize(layout, elements, preload, panelIdGenerator),
    repeatByVariable: tab.spec.repeat?.value,
    conditionalRendering: getConditionalRendering(tab),
  });
}
