import { useSessionStorage } from 'react-use';

// Kept separate from ./shared so the panel editor can use the collapse state
// without pulling getEditableElementForSelection (and with it every editable
// element class) into the initial bundle.
export const SIDEBAR_COLLAPSED_KEY = 'grafana.dashboards.sidebar.isCollapsed';

export function useSidebarCollapsed() {
  return useSessionStorage(SIDEBAR_COLLAPSED_KEY, false);
}
