import { config, reportInteraction } from '@grafana/runtime';

let isScenesContextSet = false;

export const DashboardInteractions = {
  // Dashboard interactions:
  dashboardInitialized: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('init_dashboard_completed', { ...properties });
  },

  // grafana_dashboards_edit_button_clicked
  // when a user clicks the ‘edit’ or ‘make editable’ button in a dashboard view mode
  editButtonClicked: (properties: { outlineExpanded: boolean }) => {
    reportDashboardInteraction('edit_button_clicked', properties);
  },

  // grafana_dashboards_exit_edit_button_clicked
  // when a user clicks the ‘Exit edit’ or ‘Exit Edit mode’ button in a dashboard edit mode
  exitEditButtonClicked: () => {
    reportDashboardInteraction('exit_edit_button_clicked');
  },

  // grafana_dashboards_outline_clicked
  // when a user opens the outline view
  dashboardOutlineClicked: () => {
    reportDashboardInteraction('outline_clicked');
  },

  // grafana_dashboards_outline_item_clicked
  // when a user clicks on an element of the outline
  outlineItemClicked: (properties: { index: number; depth: number }) => {
    reportDashboardInteraction('outline_item_clicked', properties);
  },

  // dashboards_add_variable_button_clicked
  // when a user clicks on ‘Add Variable’ or ‘New Variable’
  addVariableButtonClicked: (properties: { source: 'edit_pane' | 'settings_pane' }) => {
    reportDashboardInteraction('add_variable_button_clicked', properties);
  },

  // Dashboard edit item actions
  // dashboards_edit_action_clicked: when user adds or removes an item in edit mode
  // props: { item: string } - item is one of: add_panel, group_row, group_tab, ungroup, paste_panel, remove_row, remove_tab
  trackAddPanelClick() {
    reportDashboardInteraction('edit_action_clicked', { item: 'add_panel' });
  },
  trackGroupRowClick() {
    reportDashboardInteraction('edit_action_clicked', { item: 'group_row' });
  },
  trackGroupTabClick() {
    reportDashboardInteraction('edit_action_clicked', { item: 'group_tab' });
  },
  trackUngroupClick() {
    reportDashboardInteraction('edit_action_clicked', { item: 'ungroup' });
  },
  trackPastePanelClick() {
    reportDashboardInteraction('edit_action_clicked', { item: 'paste_panel' });
  },
  trackRemoveRowClick() {
    reportDashboardInteraction('edit_action_clicked', { item: 'remove_row' });
  },
  trackRemoveTabClick() {
    reportDashboardInteraction('edit_action_clicked', { item: 'remove_tab' });
  },

  panelLinkClicked: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('panelheader_datalink_clicked', properties);
  },
  panelStatusMessageClicked: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('panelheader_statusmessage_clicked', properties);
  },
  panelCancelQueryClicked: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('panelheader_cancelquery_clicked', properties);
  },

  // Dashboard interactions from toolbar
  toolbarFavoritesClick: () => {
    reportDashboardInteraction('toolbar_actions_clicked', { item: 'favorites' });
  },
  toolbarSettingsClick: () => {
    reportDashboardInteraction('toolbar_actions_clicked', { item: 'settings' });
  },
  toolbarShareClick: () => {
    reportDashboardInteraction('toolbar_actions_clicked', { item: 'share' });
  },
  toolbarShareDropdownClick: () => {
    reportDashboardInteraction('toolbar_actions_clicked', { item: 'share_dropdown' });
  },
  toolbarAddClick: () => {
    reportDashboardInteraction('toolbar_actions_clicked', { item: 'add' });
  },

  // Sharing interactions:
  sharingCategoryClicked: (properties?: Record<string, unknown>) => {
    reportSharingInteraction('sharing_category_clicked', properties);
  },
  shareLinkCopied: (properties?: Record<string, unknown>) => {
    reportSharingInteraction('sharing_link_copy_clicked', properties);
  },
  embedSnippetCopy: (properties?: Record<string, unknown>) => {
    reportSharingInteraction('sharing_embed_copy_clicked', properties);
  },
  generatePanelImageClicked: (properties?: Record<string, unknown>) => {
    reportSharingInteraction('sharing_link_generate_image_clicked', properties);
  },
  downloadPanelImageClicked: (properties?: Record<string, unknown>) => {
    reportSharingInteraction('sharing_link_download_image_clicked', properties);
  },
  publishSnapshotClicked: (properties?: Record<string, unknown>) => {
    reportSharingInteraction('sharing_snapshot_publish_clicked', properties);
  },
  publishSnapshotLocalClicked: (properties?: Record<string, unknown>) => {
    reportSharingInteraction('sharing_snapshot_local_clicked', properties);
  },
  exportDownloadJsonClicked: (properties?: Record<string, unknown>) => {
    reportSharingInteraction('sharing_export_download_json_clicked', properties);
  },
  exportCopyJsonClicked: (properties?: Record<string, unknown>) => {
    reportSharingInteraction('sharing_export_copy_json_clicked', properties);
  },
  exportSaveJsonClicked: (properties?: Record<string, unknown>) => {
    reportSharingInteraction('sharing_export_save_json_clicked', properties);
  },
  exportViewJsonClicked: (properties?: Record<string, unknown>) => {
    reportSharingInteraction('sharing_export_view_json_clicked', properties);
  },
  generatePublicDashboardUrlClicked: (properties?: Record<string, unknown>) => {
    reportSharingInteraction('sharing_public_generate_url_clicked', properties);
  },
  revokePublicDashboardEmailClicked: (properties?: Record<string, unknown>) => {
    reportSharingInteraction('sharing_public_email_revoke_clicked', properties);
  },
  resendPublicDashboardEmailClicked: (properties?: Record<string, unknown>) => {
    reportSharingInteraction('sharing_public_email_resend_clicked', properties);
  },
  publicDashboardEmailInviteClicked: (properties?: Record<string, unknown>) => {
    reportSharingInteraction('sharing_public_email_invite_clicked', properties);
  },
  publicDashboardShareTypeChange: (properties?: Record<string, unknown>) => {
    reportSharingInteraction('sharing_public_can_view_clicked', properties);
  },
  publicDashboardTimeSelectionChanged: (properties?: Record<string, unknown>) => {
    reportSharingInteraction('sharing_public_time_picker_clicked', properties);
  },
  publicDashboardAnnotationsSelectionChanged: (properties?: Record<string, unknown>) => {
    reportSharingInteraction('sharing_public_annotations_clicked', properties);
  },
  publicDashboardUrlCopied: (properties?: Record<string, unknown>) => {
    reportSharingInteraction('sharing_public_copy_url_clicked', properties);
  },
  publicDashboardPauseSharingClicked: (properties?: Record<string, unknown>) => {
    reportSharingInteraction('sharing_public_pause_clicked', properties);
  },
  revokePublicDashboardClicked: (properties?: Record<string, unknown>) => {
    reportSharingInteraction('sharing_public_revoke_clicked', properties);
  },

  // Empty dashboard state interactions:
  emptyDashboardButtonClicked: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('emptydashboard_clicked', properties);
  },

  // Toolbar interactions
  toolbarAddButtonClicked: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('toolbar_add_clicked', properties);
  },
  setScenesContext: () => {
    isScenesContextSet = true;

    return () => {
      isScenesContextSet = false;
    };
  },

  // Dashboards versions interactions
  versionRestoreClicked: (properties: { version: number; index?: number; confirm: boolean; version_date?: Date }) => {
    reportDashboardInteraction('version_restore_clicked', properties);
  },
  showMoreVersionsClicked: () => {
    reportDashboardInteraction('show_more_versions_clicked');
  },

  // Image export interactions
  generateDashboardImageClicked: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('dashboard_image_generated', properties);
  },
  downloadDashboardImageClicked: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('dashboard_image_downloaded', properties);
  },
};

const reportDashboardInteraction: typeof reportInteraction = (name, properties) => {
  const meta = isScenesContextSet ? { scenesView: true } : {};
  const isDynamicDashboard = config.featureToggles?.dashboardNewLayouts ?? false;

  if (properties) {
    reportInteraction(`dashboards_${name}`, { ...properties, ...meta, isDynamicDashboard });
  } else {
    reportInteraction(`dashboards_${name}`, { isDynamicDashboard });
  }
};

const reportSharingInteraction: typeof reportInteraction = (name, properties) => {
  const meta = isScenesContextSet ? { scenesView: true } : {};

  if (properties) {
    reportInteraction(`dashboards_${name}`, { ...properties, ...meta });
  } else {
    reportInteraction(`dashboards_${name}`);
  }
};
