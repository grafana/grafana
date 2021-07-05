import { DashboardDisplayProfile, DisplayProfileMode } from '../types';

export const playlistProfile: DashboardDisplayProfile = {
  dashNav: {
    timePicker: DisplayProfileMode.default,
    title: DisplayProfileMode.default,
    tvToggle: DisplayProfileMode.default,
    addPanelToggle: DisplayProfileMode.hidden,
    dashboardSettingsToggle: DisplayProfileMode.hidden,
    saveDashboardToggle: DisplayProfileMode.hidden,
    snapshotToggle: DisplayProfileMode.hidden,
    starToggle: DisplayProfileMode.hidden,
    sharePanelToggle: DisplayProfileMode.hidden,
  },
  sideMenu: DisplayProfileMode.hidden,
};
