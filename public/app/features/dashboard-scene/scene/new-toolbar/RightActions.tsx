import { css } from '@emotion/css';

import { ToolbarButtonRow, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';

import { isLibraryPanel } from '../../utils/utils';
import { DashboardScene } from '../DashboardScene';

import { BackToDashboardButton } from './actions/BackToDashboardButton';
import { DashboardSettingsButton } from './actions/DashboardSettingsButton';
import { DiscardLibraryPanelButton } from './actions/DiscardLibraryPanelButton';
import { DiscardPanelButton } from './actions/DiscardPanelButton';
import { EditDashboardSwitch } from './actions/EditDashboardSwitch';
import { EditSchemaV2Button } from './actions/EditSchemaV2Button';
import { ExportDashboardButton } from './actions/ExportDashboardButton';
import { MakeDashboardEditableButton } from './actions/MakeDashboardEditableButton';
import { PlayListNextButton } from './actions/PlayListNextButton';
import { PlayListPreviousButton } from './actions/PlayListPreviousButton';
import { PlayListStopButton } from './actions/PlayListStopButton';
import { SaveDashboard } from './actions/SaveDashboard';
import { SaveLibraryPanelButton } from './actions/SaveLibraryPanelButton';
import { ShareDashboardButton } from './actions/ShareDashboardButton';
import { UnlinkLibraryPanelButton } from './actions/UnlinkLibraryPanelButton';
import { renderActionElements } from './utils';

export const RightActions = ({ dashboard }: { dashboard: DashboardScene }) => {
  const styles = useStyles2(getStyles);
  const { editPanel, editable, editview, isEditing, uid, meta, viewPanelScene } = dashboard.useState();
  const { isPlaying } = playlistSrv.useState();

  const isEditable = Boolean(editable);
  const canSave = Boolean(meta.canSave);
  const hasUid = Boolean(uid);
  const isEditingDashboard = Boolean(isEditing);
  const hasEditView = Boolean(editview);
  const isEditingPanel = Boolean(editPanel);
  const isViewingPanel = Boolean(viewPanelScene);
  const isEditingLibraryPanel = isEditingPanel && isLibraryPanel(editPanel!.state.panelRef.resolve());
  const isShowingDashboard = !hasEditView && !isViewingPanel && !isEditingPanel;
  const isEditingAndShowingDashboard = isEditingDashboard && isShowingDashboard;
  const isSnapshot = Boolean(meta.isSnapshot);
  const canSaveInFolder = contextSrv.hasEditPermissionInFolders;

  const showPanelButtons = isEditingPanel && !hasEditView && !isViewingPanel;
  const showPlayButtons = isPlaying && isShowingDashboard && !isEditingDashboard;
  const showShareButton = hasUid && !isSnapshot && !isPlaying;

  return (
    <ToolbarButtonRow alignment="right" className={styles.container}>
      {renderActionElements(
        [
          {
            key: 'play-list-previous-button',
            component: PlayListPreviousButton,
            group: 'playlist',
            condition: showPlayButtons,
          },
          {
            key: 'play-list-stop-button',
            component: PlayListStopButton,
            group: 'playlist',
            condition: showPlayButtons,
          },
          {
            key: 'play-list-next-button',
            component: PlayListNextButton,
            group: 'playlist',
            condition: showPlayButtons,
          },
          {
            key: 'back-to-dashboard-button',
            component: BackToDashboardButton,
            group: 'panel',
            condition: hasEditView || ((isViewingPanel || isEditingPanel) && !isEditingLibraryPanel),
          },
          {
            key: 'discard-panel-button',
            component: DiscardPanelButton,
            group: 'panel',
            condition: showPanelButtons && !isEditingLibraryPanel,
          },
          {
            key: 'discard-library-panel-button',
            component: DiscardLibraryPanelButton,
            group: 'panel',
            condition: showPanelButtons && isEditingLibraryPanel,
          },
          {
            key: 'unlink-library-panel-button',
            component: UnlinkLibraryPanelButton,
            group: 'panel',
            condition: showPanelButtons && isEditingLibraryPanel,
          },
          {
            key: 'save-library-panel-button',
            component: SaveLibraryPanelButton,
            group: 'panel',
            condition: showPanelButtons && isEditingLibraryPanel,
          },
          {
            key: 'edit-schema-v2-button',
            component: EditSchemaV2Button,
            group: 'dashboard',
            condition: isEditingAndShowingDashboard && hasUid,
          },
          {
            key: 'dashboard-settings',
            component: DashboardSettingsButton,
            group: 'dashboard',
            condition: isEditingAndShowingDashboard && dashboard.canEditDashboard(),
          },
          {
            key: 'save-dashboard',
            component: SaveDashboard,
            group: 'save-edit',
            condition: isEditingDashboard && !isEditingLibraryPanel && (canSave || canSaveInFolder),
          },
          {
            key: 'make-dashboard-editable-button',
            component: MakeDashboardEditableButton,
            group: 'save-edit',
            condition: !isEditing && dashboard.canEditDashboard() && !isViewingPanel && !isEditable,
          },
          {
            key: 'edit-dashboard-switch',
            component: EditDashboardSwitch,
            group: 'save-edit',
            condition: dashboard.canEditDashboard() && !isEditingLibraryPanel && !isViewingPanel && isEditable,
          },
          {
            key: 'new-export-dashboard-button',
            component: ExportDashboardButton,
            group: 'export-share',
            condition: showShareButton,
          },
          {
            key: 'new-share-dashboard-button',
            component: ShareDashboardButton,
            group: 'export-share',
            condition: showShareButton,
          },
        ],
        dashboard
      )}
    </ToolbarButtonRow>
  );
};

const getStyles = () => ({
  container: css({
    flex: 1,
  }),
});
