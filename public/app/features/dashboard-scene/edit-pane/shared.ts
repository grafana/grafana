import { useSessionStorage } from 'react-use';

export function useEditPaneCollapsed() {
  return useSessionStorage('grafana.dashboards.edit-pane.isCollapsed', false);
}
