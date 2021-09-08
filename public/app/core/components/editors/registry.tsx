import { DashboardPicker, DashboardPickerOptions } from './DashboardPicker';
import { getStandardOptionEditors } from '@grafana/ui';
import { StandardEditorsRegistryItem } from '@grafana/data';

/**
 * Returns collection of standard option editors definitions
 */
export const getAllOptionEditors = () => {
  const dashboardPicker: StandardEditorsRegistryItem<string, DashboardPickerOptions> = {
    id: 'dashboard-uid',
    name: 'Dashboard',
    description: 'Select dashboard',
    editor: DashboardPicker as any,
  };
  return [...getStandardOptionEditors(), dashboardPicker];
};
