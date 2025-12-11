import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { ToolbarButtonRow, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';

import { dynamicDashNavActions } from '../../utils/registerDynamicDashNavAction';
import { isLibraryPanel } from '../../utils/utils';
import { DashboardScene } from '../DashboardScene';

import { BackToDashboardButton } from './actions/BackToDashboardButton';
import { DiscardLibraryPanelButton } from './actions/DiscardLibraryPanelButton';
import { DiscardPanelButton } from './actions/DiscardPanelButton';
import { MakeDashboardEditableButton } from './actions/MakeDashboardEditableButton';
import { PlayListNextButton } from './actions/PlayListNextButton';
import { PlayListPreviousButton } from './actions/PlayListPreviousButton';
import { PlayListStopButton } from './actions/PlayListStopButton';
import { SaveDashboard } from './actions/SaveDashboard';
import { SaveLibraryPanelButton } from './actions/SaveLibraryPanelButton';
import { UnlinkLibraryPanelButton } from './actions/UnlinkLibraryPanelButton';
import { getDynamicActions, renderActionElements } from './utils';

export const RightActions = ({ dashboard }: { dashboard: DashboardScene }) => {
  const { editPanel, editable, editview, isEditing, meta, viewPanel } = dashboard.useState();
  const { isPlaying } = playlistSrv.useState();
  const styles = useStyles2(getStyles);

  const isEditable = Boolean(editable);
  const canSave = Boolean(meta.canSave);
  const isEditingDashboard = Boolean(isEditing);
  const hasEditView = Boolean(editview);
  const isEditingPanel = Boolean(editPanel);
  const isViewingPanel = Boolean(viewPanel);
  const isEditingLibraryPanel = isEditingPanel && isLibraryPanel(editPanel!.state.panelRef.resolve());
  const isShowingDashboard = !hasEditView && !isViewingPanel && !isEditingPanel;
  const canSaveInFolder = contextSrv.hasEditPermissionInFolders;
  const canEditDashboard = dashboard.canEditDashboard();

  const showPanelButtons = isEditingPanel && !hasEditView && !isViewingPanel;
  const showPlayButtons = isPlaying && isShowingDashboard && !isEditingDashboard;

  return (
    <ToolbarButtonRow alignment="right" className={styles.container}>
      {renderActionElements(
        [
          // This adds the presence indicators in enterprise
          // Leaving group empty here as these are sometimes not rendered leaving separators with blank space between them
          ...getDynamicActions(dynamicDashNavActions.right, '', !isEditingPanel && !isEditingDashboard),
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
            key: 'save-dashboard',
            component: SaveDashboard,
            group: 'panel',
            condition: isEditingDashboard && !isEditingLibraryPanel && (canSave || canSaveInFolder),
          },
          {
            key: 'make-dashboard-editable-button',
            component: MakeDashboardEditableButton,
            group: 'save-edit',
            condition: !isEditing && canEditDashboard && !isViewingPanel && !isEditable && !isPlaying,
          },
        ],
        dashboard
      )}
    </ToolbarButtonRow>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({ paddingLeft: theme.spacing(0.5) }),
});
