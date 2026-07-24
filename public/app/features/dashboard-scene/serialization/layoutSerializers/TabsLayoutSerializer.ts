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

  // A repeated tab is "materialized" when it is a clone or has produced clones. When serializing a snapshot
  // of a materialized repeat we bake the interpolated title (matching the tab renderer) and strip the repeat
  // directive below. If the repeat hasn't been materialized, leave both untouched so it isn't silently dropped.
  const isMaterializedRepeat = Boolean(tab.state.repeatSourceKey) || Boolean(tab.state.repeatedTabs?.length);
  const title = isSnapshot && isMaterializedRepeat ? interpolateSectionTitle(tab, tab.state.title) : tab.state.title;

  const tabKind: TabsLayoutTabKind = {
    kind: 'TabsLayoutTab',
    spec: {
      title,
      layout: layout,
      // Once materialized into concrete tabs for a snapshot we must not emit the repeat directive (it would
      // make the viewer re-expand and collapse back to a single tab). Otherwise keep it.
      ...(tab.state.repeatByVariable &&
        !(isSnapshot && isMaterializedRepeat) && {
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
