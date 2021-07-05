export enum DisplayProfileMode {
  hidden = 'hidden',
  readOnly = 'readOnly',
  default = 'default',
}

export interface DashboardDisplayProfile {
  dashNav: {
    timePicker: DisplayProfileMode;
    title: DisplayProfileMode;
    tvToggle: DisplayProfileMode;
    addPanelToggle: DisplayProfileMode;
    dashboardSettingsToggle: DisplayProfileMode;
    saveDashboardToggle: DisplayProfileMode;
    snapshotToggle: DisplayProfileMode;
    starToggle: DisplayProfileMode;
    sharePanelToggle: DisplayProfileMode;
    customButtons: DisplayProfileMode;
  };
  subMenu: DisplayProfileMode;
  sideMenu: DisplayProfileMode;
}
