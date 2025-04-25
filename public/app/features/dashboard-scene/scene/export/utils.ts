import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';

/**
 * Removes a panel reference from a layout.
 *
 * @param layout - The layout to remove the panel reference from.
 * @param elementName - The name of the element to remove the panel reference from. This is the key of the element in
 * the elements object.
 */
export function removePanelRefFromLayout(layout: DashboardV2Spec['layout'], elementName: string) {
  switch (layout.kind) {
    case 'GridLayout': {
      const items = layout.spec.items || [];
      layout.spec.items = items.filter((item) => {
        if (item.kind === 'GridLayoutItem') {
          return item.spec.element.name !== elementName;
        } else if (item.kind === 'GridLayoutRow') {
          item.spec.elements = item.spec.elements.filter((el) => el.spec.element.name !== elementName);
          // Keep the row if it still has elements left
          return item.spec.elements.length > 0;
        }
        return true;
      });
      break;
    }

    case 'AutoGridLayout': {
      const items = layout.spec.items || [];
      layout.spec.items = items.filter((i) => i.kind === 'AutoGridLayoutItem' && i.spec.element.name !== elementName);
      break;
    }

    case 'RowsLayout': {
      // Each row has a nested layout, which we must process recursively
      const rows = layout.spec.rows || [];
      layout.spec.rows = rows.filter((row) => {
        removePanelRefFromLayout(row.spec.layout, elementName);
        return !isLayoutEmpty(row.spec.layout);
      });
      break;
    }

    case 'TabsLayout': {
      // Each tab also has a nested layout, so we process it recursively
      const tabs = layout.spec.tabs || [];
      layout.spec.tabs = tabs.filter((tab) => {
        removePanelRefFromLayout(tab.spec.layout, elementName);
        return !isLayoutEmpty(tab.spec.layout);
      });
      break;
    }
  }
}

function isLayoutEmpty(layout: DashboardV2Spec['layout']) {
  if (!layout || !layout.spec) {
    return true;
  }

  switch (layout.kind) {
    case 'GridLayout': {
      const items = layout.spec.items || [];
      return (
        items.length === 0 ||
        items.every((item) => {
          if (item.kind === 'GridLayoutItem') {
            return false;
          } else if (item.kind === 'GridLayoutRow') {
            return item.spec.elements.length === 0;
          }
          return false;
        })
      );
    }

    case 'AutoGridLayout': {
      const items = layout.spec.items || [];
      return items.length === 0;
    }

    case 'RowsLayout': {
      const rows = layout.spec.rows || [];
      return rows.length === 0;
    }

    case 'TabsLayout': {
      const tabs = layout.spec.tabs || [];
      return tabs.length === 0;
    }

    default:
      return true;
  }
}
