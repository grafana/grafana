import { DashboardDisplayProfile, DisplayProfileMode } from '../types';

export const kioskProfile: DashboardDisplayProfile = {
  dashNav: {
    timePicker: DisplayProfileMode.hidden,
    title: DisplayProfileMode.hidden,
    tvToggle: DisplayProfileMode.hidden,
    addPanelToggle: DisplayProfileMode.hidden,
    dashboardSettingsToggle: DisplayProfileMode.hidden,
    saveDashboardToggle: DisplayProfileMode.hidden,
    snapshotToggle: DisplayProfileMode.hidden,
    starToggle: DisplayProfileMode.hidden,
    sharePanelToggle: DisplayProfileMode.hidden,
    customButtons: DisplayProfileMode.hidden,
  },
  subMenu: DisplayProfileMode.hidden,
  sideMenu: DisplayProfileMode.hidden,
};
