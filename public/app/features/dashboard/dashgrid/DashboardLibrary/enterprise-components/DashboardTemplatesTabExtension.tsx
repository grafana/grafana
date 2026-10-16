import { type ComponentType, type MutableRefObject } from 'react';

export interface DashboardTemplatesTabProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Once-per-open guard owned by the parent modal. It lives in the parent because this
   * tab unmounts when the user switches to another tab — a local ref would reset and the
   * `loaded` event would re-fire when the user returns to this tab.
   */
  loadedFiredRef: MutableRefObject<boolean>;
}

let InternalDashboardTemplatesTab: ComponentType<DashboardTemplatesTabProps> | null = null;

export function registerDashboardTemplatesTab(component: ComponentType<DashboardTemplatesTabProps>) {
  InternalDashboardTemplatesTab = component;
}

export function getDashboardTemplatesTab(): ComponentType<DashboardTemplatesTabProps> | null {
  return InternalDashboardTemplatesTab;
}
