/**
 * ADD_TAB command
 *
 * Add a new tab to the dashboard layout. If the target parent is not a
 * TabsLayout, the existing content is nested inside the requested tab
 * (preserving the original layout structure) rather than being flattened.
 */

import { type z } from 'zod';

import { ConditionalRenderingGroup } from '../../conditional-rendering/group/ConditionalRenderingGroup';
import { dashboardEditActions } from '../../edit-pane/shared';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { isLayoutParent } from '../../scene/types/LayoutParent';

import { resolveLayoutPath, validateNesting } from './layoutPathResolver';
import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresNewDashboardLayouts, type MutationCommand } from './types';

const addTabPayloadSchema = payloads.addTab;

export type AddTabPayload = z.infer<typeof addTabPayloadSchema>;

export const addTabCommand: MutationCommand<AddTabPayload> = {
  name: 'ADD_TAB',
  description: payloads.addTab.description ?? '',

  payloadSchema: payloads.addTab,
  permission: requiresNewDashboardLayouts,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const { tab, parentPath, position } = payload;
      const resolved = resolveLayoutPath(scene.state.body, parentPath);
      const targetLayout = resolved.layoutManager;

      let tabsManager: TabsLayoutManager;
      let wasConverted = false;
      let newTabIndex: number;

      validateNesting(parentPath, 'tabs', targetLayout);

      if (targetLayout instanceof TabsLayoutManager) {
        tabsManager = targetLayout;
        const localTabsManager = tabsManager;

        const newTab = new TabItem({
          layout: DefaultGridLayoutManager.fromVizPanels([]),
          title: tab.spec.title,
          repeatByVariable: tab.spec.repeat?.value,
          conditionalRendering: tab.spec.conditionalRendering
            ? ConditionalRenderingGroup.deserialize(tab.spec.conditionalRendering)
            : undefined,
        });

        const tabsBefore = [...localTabsManager.state.tabs];
        const slugBefore = localTabsManager.state.currentTabSlug;
        const tabsAfter = [...tabsBefore];
        newTabIndex =
          position !== undefined && position >= 0 && position <= tabsAfter.length ? position : tabsAfter.length;
        tabsAfter.splice(newTabIndex, 0, newTab);

        dashboardEditActions.addElement({
          addedObject: newTab,
          source: localTabsManager,
          perform: () => localTabsManager.setState({ tabs: tabsAfter }),
          undo: () => localTabsManager.setState({ tabs: tabsBefore, currentTabSlug: slugBefore }),
        });
      } else {
        const layoutParent = targetLayout.parent;
        if (!layoutParent || !isLayoutParent(layoutParent)) {
          throw new Error('Cannot convert layout: parent is not a LayoutParent');
        }

        const previousLayoutClone = targetLayout.clone({});

        // Nest the existing layout inside the requested tab as-is,
        // preserving its structure (rows, grid, etc.).
        targetLayout.clearParent();
        const newTab = new TabItem({
          layout: targetLayout,
          title: tab.spec.title,
          repeatByVariable: tab.spec.repeat?.value,
          conditionalRendering: tab.spec.conditionalRendering
            ? ConditionalRenderingGroup.deserialize(tab.spec.conditionalRendering)
            : undefined,
        });

        tabsManager = new TabsLayoutManager({ tabs: [newTab] });
        newTabIndex = 0;
        const newTabsManager = tabsManager;

        dashboardEditActions.addElement({
          addedObject: newTab,
          source: scene,
          perform: () => layoutParent.switchLayout(newTabsManager),
          undo: () => layoutParent.switchLayout(previousLayoutClone),
        });
        wasConverted = true;
      }

      const newPath = parentPath === '/' ? `/tabs/${newTabIndex}` : `${parentPath}/tabs/${newTabIndex}`;

      const warnings: string[] = [];
      if (wasConverted) {
        warnings.push(
          'Root layout converted to TabsLayout. Previous paths are invalidated; call GET_LAYOUT to refresh.'
        );
      }

      return {
        success: true,
        data: { path: newPath, tab: { kind: 'TabsLayoutTab', spec: tab.spec } },
        changes: [{ path: newPath, previousValue: null, newValue: { title: tab.spec.title } }],
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        changes: [],
      };
    }
  },
};
