import { reportInteraction } from '@grafana/runtime';
import { InspectTab } from 'app/features/inspector/types';

let isScenesContextSet = false;

export const DashboardInteractions = {
  // Dashboard interactions:
  dashboardInitialized: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('init_dashboard_completed', { ...properties });
  },

  // Panel interactions:
  panelMenuShown: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('panelheader_menu', { ...properties, item: 'menu' });
  },
  panelMenuItemClicked: (
    item:
      | 'view'
      | 'edit'
      | 'share'
      | 'createLibraryPanel'
      | 'unlinkLibraryPanel'
      | 'duplicate'
      | 'copy'
      | 'remove'
      | 'explore'
      | 'toggleLegend'
      | 'create-alert'
  ) => {
    reportDashboardInteraction('panelheader_menu', { item });
  },
  panelMenuInspectClicked(tab: InspectTab) {
    reportDashboardInteraction('panelheader_menu', { item: 'inspect', tab });
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
  panelDescriptionShown: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('panelheader_description_displayed', properties);
  },

  // Sharing interactions:
  sharingTabChanged: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('sharing_category_clicked', properties);
  },
  shareLinkCopied: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('sharing_link_copy_clicked', properties);
  },
  embedSnippetCopy: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('sharing_embed_copy_clicked', properties);
  },
  publishSnapshotClicked: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('sharing_snapshot_publish_clicked', properties);
  },
  publishSnapshotLocalClicked: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('sharing_snapshot_local_clicked', properties);
  },
  exportDownloadJsonClicked: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('sharing_export_download_json_clicked', properties);
  },
  exportCopyJsonClicked: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('sharing_export_copy_json_clicked', properties);
  },
  exportSaveJsonClicked: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('sharing_export_save_json_clicked', properties);
  },
  exportViewJsonClicked: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('sharing_export_view_json_clicked', properties);
  },
  generatePublicDashboardUrlClicked: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('sharing_public_generate_url_clicked', properties);
  },
  revokePublicDashboardEmailClicked: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('sharing_public_email_revoke_clicked', properties);
  },
  resendPublicDashboardEmailClicked: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('sharing_public_email_resend_clicked', properties);
  },
  publicDashboardEmailInviteClicked: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('sharing_public_email_invite_clicked', properties);
  },
  publicDashboardShareTypeChange: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('sharing_public_can_view_clicked', properties);
  },
  publicDashboardTimeSelectionChanged: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('sharing_public_time_picker_clicked', properties);
  },
  publicDashboardAnnotationsSelectionChanged: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('sharing_public_annotations_clicked', properties);
  },
  publicDashboardUrlCopied: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('sharing_public_copy_url_clicked', properties);
  },
  publicDashboardPauseSharingClicked: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('sharing_public_pause_clicked', properties);
  },
  revokePublicDashboardClicked: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('sharing_public_revoke_clicked', properties);
  },

  // Empty dashboard state interactions:
  emptyDashboardButtonClicked: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('emptydashboard_clicked', properties);
  },

  // Toolbar interactions
  toolbarAddButtonClicked: (properties?: Record<string, unknown>) => {
    reportDashboardInteraction('toolbar_add_clicked', properties);
  },
  toolbarFavoritesClick: () => {
    reportDashboardInteraction('toolbar_actions_clicked', { item: 'favorites' });
  },
  toolbarSettingsClick: () => {
    reportDashboardInteraction('toolbar_actions_clicked', { item: 'settings' });
  },
  toolbarRefreshClick: () => {
    reportDashboardInteraction('toolbar_actions_clicked', { item: 'refresh' });
  },
  toolbarTimePickerClick: () => {
    reportDashboardInteraction('toolbar_actions_clicked', { item: 'time_picker' });
  },
  toolbarZoomClick: () => {
    reportDashboardInteraction('toolbar_actions_clicked', { item: 'zoom_out_time_range' });
  },

  toolbarShareClick: () => {
    reportDashboardInteraction('toolbar_actions_clicked', { item: 'share' });
  },
  toolbarSaveClick: () => {
    reportDashboardInteraction('toolbar_actions_clicked', { item: 'save' });
  },
  toolbarSaveAsClick: () => {
    reportDashboardInteraction('toolbar_actions_clicked', { item: 'save_as' });
  },
  toolbarAddClick: () => {
    reportDashboardInteraction('toolbar_actions_clicked', { item: 'add' });
  },

  setScenesContext: () => {
    isScenesContextSet = true;

    return () => {
      isScenesContextSet = false;
    };
  },
};

const reportDashboardInteraction: typeof reportInteraction = (name, properties) => {
  const meta = isScenesContextSet ? { scenesView: true } : {};

  if (properties) {
    reportInteraction(`dashboards_${name}`, { ...properties, ...meta });
  } else {
    reportInteraction(`dashboards_${name}`);
  }
};
