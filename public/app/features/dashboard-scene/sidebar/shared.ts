import { useSessionStorage } from 'react-use';

import { type ElementSelectionContextItem } from '@grafana/ui';

import { getEditableElementFor } from '../actions/utils/getEditableElementFor';
import { type BulkActionElement, isBulkActionElement } from '../scene/types/BulkActionElement';
import { type EditableDashboardElement } from '../scene/types/EditableDashboardElement';

import { type DashboardSidebar } from './DashboardSidebar';
import { MultiSelectedObjectsEditableElement } from './MultiSelectedObjectsEditableElement';

export const SIDEBAR_COLLAPSED_KEY = 'grafana.dashboards.sidebar.isCollapsed';

export function useSidebarCollapsed() {
  return useSessionStorage(SIDEBAR_COLLAPSED_KEY, false);
}

export function getEditableElementForSelection(
  sidebar: DashboardSidebar,
  selected: ElementSelectionContextItem[]
): EditableDashboardElement | undefined {
  if (selected.length === 1) {
    const obj = sidebar.getSelectedObject(selected[0].id);
    if (obj) {
      return getEditableElementFor(obj);
    }
  }

  if (selected.length > 1) {
    const objects = selected.map((s) => sidebar.getSelectedObject(s.id));
    const elements: BulkActionElement[] = objects
      .map((obj) => getEditableElementFor(obj))
      .filter((e): e is BulkActionElement => Boolean(e) && isBulkActionElement(e!));

    if (elements.length === 0) {
      return undefined;
    }

    const first = elements[0];
    const allSameType = elements.every((e) => e.constructor.name === first.constructor.name);

    if (allSameType && first.createMultiSelectedElement) {
      return first.createMultiSelectedElement(elements);
    }

    return new MultiSelectedObjectsEditableElement(elements);
  }

  return undefined;
}
