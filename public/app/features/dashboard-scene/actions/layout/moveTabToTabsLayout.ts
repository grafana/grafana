import { type TabItem } from '../../scene/layout-tabs/TabItem';
import { type TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { DashboardStateChangedEvent, ObjectsReorderedOnCanvasEvent } from '../../sidebar/events';
import { moveElement } from '../element/moveElement';

/**
 * Moves a tab into another tabs layout at the given position, where it becomes the open tab. Reorders
 * within one tabs layout go through `TabsLayoutManager.moveTab`.
 */
export function moveTabToTabsLayout({
  tab,
  source,
  destination,
  index,
}: {
  tab: TabItem;
  source: TabsLayoutManager;
  destination: TabsLayoutManager;
  /** Where among the destination's tabs to insert the tab, not counting repeated copies */
  index: number;
}) {
  const prevSourceTabs = [...source.state.tabs];
  const prevSourceSlug = source.state.currentTabSlug;
  const prevDestinationTabs = [...destination.state.tabs];
  const prevDestinationSlug = destination.state.currentTabSlug;

  moveElement({
    meta: { actionId: 'tab.move' },
    source,
    movedObject: tab,
    perform: () => {
      const sourceTabs = [...prevSourceTabs];
      const destTabs = [...prevDestinationTabs];

      const fromIndex = sourceTabs.findIndex((t) => t === tab);
      if (fromIndex < 0) {
        return;
      }

      sourceTabs.splice(fromIndex, 1);

      const clampedDestinationIndex = Math.max(0, Math.min(index, destTabs.length));
      destTabs.splice(clampedDestinationIndex, 0, tab);

      // If the moved tab was active in source, pick a sensible new active tab.
      let nextSourceSlug = prevSourceSlug;
      if (prevSourceSlug === tab.getSlug()) {
        const newIndex = fromIndex > 0 ? fromIndex - 1 : 0;
        nextSourceSlug = sourceTabs[newIndex]?.getSlug();
      }

      // Important: avoid briefly parenting the same SceneObject in two places.
      // Remove from source first, then clear parent, then add to destination.
      source.setState({ tabs: sourceTabs, currentTabSlug: nextSourceSlug });
      tab.clearParent();
      destination.setState({
        tabs: destTabs,
        currentTabSlug: tab.getSlug(),
      });

      // Make sure outline is refreshed in DashboardSidebar
      source.publishEvent(new ObjectsReorderedOnCanvasEvent(source), true);
      destination.publishEvent(new ObjectsReorderedOnCanvasEvent(destination), true);

      // Make sure repeated rows are refreshed - triggers performRowRepeats in RowItemRepeater
      source.publishEvent(new DashboardStateChangedEvent({ source }), true);
      destination.publishEvent(new DashboardStateChangedEvent({ source: destination }), true);
    },
    undo: () => {
      // Reverse order for the same parenting reason as in perform().
      destination.setState({ tabs: prevDestinationTabs, currentTabSlug: prevDestinationSlug });
      tab.clearParent();
      source.setState({ tabs: prevSourceTabs, currentTabSlug: prevSourceSlug });

      // Make sure outline is refreshed in DashboardSidebar
      source.publishEvent(new ObjectsReorderedOnCanvasEvent(source), true);
      destination.publishEvent(new ObjectsReorderedOnCanvasEvent(destination), true);

      // Make sure repeated rows are refreshed - triggers performRowRepeats in RowItemRepeater
      source.publishEvent(new DashboardStateChangedEvent({ source }), true);
      destination.publishEvent(new DashboardStateChangedEvent({ source: destination }), true);
    },
  });
}
