import { Spec as DashboardV2Spec, TabsLayoutTabKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabItemRepeaterBehavior } from '../../scene/layout-tabs/TabItemRepeaterBehavior';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { isClonedKey } from '../../utils/clone';

import { layoutDeserializerRegistry } from './layoutSerializerRegistry';
import { getConditionalRendering } from './utils';

export function serializeTabsLayout(layoutManager: TabsLayoutManager): DashboardV2Spec['layout'] {
  return {
    kind: 'TabsLayout',
    spec: {
      tabs: layoutManager.state.tabs.filter((tab) => !isClonedKey(tab.state.key!)).map(serializeTab),
    },
  };
}

export function serializeTab(tab: TabItem): TabsLayoutTabKind {
  const layout = tab.state.layout.serialize();
  const tabKind: TabsLayoutTabKind = {
    kind: 'TabsLayoutTab',
    spec: {
      title: tab.state.title,
      layout: layout,
    },
  };

  const conditionalRenderingRootGroup = tab.state.conditionalRendering?.serialize();
  // Only serialize the conditional rendering if it has items
  if (conditionalRenderingRootGroup?.spec.items.length) {
    tabKind.spec.conditionalRendering = conditionalRenderingRootGroup;
  }

  if (tab.state.$behaviors) {
    for (const behavior of tab.state.$behaviors) {
      if (behavior instanceof TabItemRepeaterBehavior) {
        if (tabKind.spec.repeat) {
          throw new Error('Multiple repeaters are not supported');
        }
        tabKind.spec.repeat = { value: behavior.state.variableName, mode: 'variable' };
      }
    }
  }

  return tabKind;
}

export function deserializeTabsLayout(
  layout: DashboardV2Spec['layout'],
  elements: DashboardV2Spec['elements'],
  preload: boolean,
  panelIdGenerator?: () => number
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
  panelIdGenerator?: () => number
): TabItem {
  const layout = tab.spec.layout;
  const $behaviors = !tab.spec.repeat
    ? undefined
    : [new TabItemRepeaterBehavior({ variableName: tab.spec.repeat.value })];

  return new TabItem({
    title: tab.spec.title,
    layout: layoutDeserializerRegistry.get(layout.kind).deserialize(layout, elements, preload, panelIdGenerator),
    $behaviors,
    conditionalRendering: getConditionalRendering(tab),
  });
}
