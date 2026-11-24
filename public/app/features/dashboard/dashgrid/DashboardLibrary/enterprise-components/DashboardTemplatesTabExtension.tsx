import { type ComponentType, type MutableRefObject } from 'react';

import { type TemplateSelectionProps } from '../types';

export interface DashboardTemplatesTabProps extends TemplateSelectionProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Once-per-open guard owned by the parent modal. It lives in the parent because this
   * tab unmounts when the user switches to another tab — a local ref would reset and the
   * `loaded` event would re-fire when the user returns to this tab.
   */
  loadedFiredRef: MutableRefObject<boolean>;
  /**
   * A `DashboardTemplatesSourceEntryPointMap` key for the surface the list is shown on. Defaults to the template
   * modal's `source` URL param.
   */
  entryPoint?: string;
}

let InternalDashboardTemplatesTab: ComponentType<DashboardTemplatesTabProps> | null = null;

export function registerDashboardTemplatesTab(component: ComponentType<DashboardTemplatesTabProps>) {
  InternalDashboardTemplatesTab = component;
}

export function getDashboardTemplatesTab(): ComponentType<DashboardTemplatesTabProps> | null {
  return InternalDashboardTemplatesTab;
}
