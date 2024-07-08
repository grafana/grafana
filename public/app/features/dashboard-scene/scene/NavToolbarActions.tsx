import { css } from '@emotion/css';
import React, { useEffect, useId, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, locationService } from '@grafana/runtime';
import {
  Badge,
  Button,
  ButtonGroup,
  Dropdown,
  Icon,
  Menu,
  ToolbarButton,
  ToolbarButtonRow,
  useStyles2,
} from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { NavToolbarSeparator } from 'app/core/components/AppChrome/NavToolbar/NavToolbarSeparator';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';
import { contextSrv } from 'app/core/core';
import { Trans, t } from 'app/core/internationalization';
import store from 'app/core/store';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';

import { PanelEditor, buildPanelEditScene } from '../panel-edit/PanelEditor';
import ShareButton from '../sharing/ShareButton/ShareButton';
import { ShareModal } from '../sharing/ShareModal';
import { DashboardInteractions } from '../utils/interactions';
import { DynamicDashNavButtonModel, dynamicDashNavActions } from '../utils/registerDynamicDashNavAction';

import { DashboardScene } from './DashboardScene';
import { GoToSnapshotOriginButton } from './GoToSnapshotOriginButton';
import { LibraryVizPanel } from './LibraryVizPanel';

interface Props {
  dashboard: DashboardScene;
}

export const NavToolbarActions = React.memo<Props>(({ dashboard }) => {
  const id = useId();

  const actions = <ToolbarActions dashboard={dashboard} key={id} />;
  return <AppChromeUpdate actions={actions} />;
});

NavToolbarActions.displayName = 'NavToolbarActions';

/**
 * This part is split into a separate component to help test this
 */
export function ToolbarActions({ dashboard }: Props) {
  const { isEditing, viewPanelScene, isDirty, uid, meta, editview, editPanel, editable } = dashboard.useState();
  const { isPlaying } = playlistSrv.useState();
  const [isAddPanelMenuOpen, setIsAddPanelMenuOpen] = useState(false);

  const canSaveAs = contextSrv.hasEditPermissionInFolders;
  const toolbarActions: ToolbarAction[] = [];
  const styles = useStyles2(getStyles);
  const isEditingPanel = Boolean(editPanel);
  const isViewingPanel = Boolean(viewPanelScene);
  const isEditedPanelDirty = useVizManagerDirty(editPanel);
  const isEditingLibraryPanel = useEditingLibraryPanel(editPanel);
  const hasCopiedPanel = store.exists(LS_PANEL_COPY_KEY);
  // Means we are not in settings view, fullscreen panel or edit panel
  const isShowingDashboard = !editview && !isViewingPanel && !isEditingPanel;
  const isEditingAndShowingDashboard = isEditing && isShowingDashboard;

  if (!isEditingPanel) {
    // This adds the precence indicators in enterprise
    addDynamicActions(toolbarActions, dynamicDashNavActions.left, 'left-actions');
  }

  toolbarActions.push({
    group: 'icon-actions',
    condition: uid && Boolean(meta.canStar) && isShowingDashboard && !isEditing,
    render: () => {
      let desc = meta.isStarred
        ? t('dashboard.toolbar.unmark-favorite', 'Unmark as favorite')
        : t('dashboard.toolbar.mark-favorite', 'Mark as favorite');
      return (
        <ToolbarButton
          tooltip={desc}
          icon={
            <Icon name={meta.isStarred ? 'favorite' : 'star'} size="lg" type={meta.isStarred ? 'mono' : 'default'} />
          }
          key="star-dashboard-button"
          data-testid={selectors.components.NavToolbar.markAsFavorite}
          onClick={() => {
            DashboardInteractions.toolbarFavoritesClick();
            dashboard.onStarDashboard();
          }}
        />
      );
    },
  });

  if (meta.publicDashboardEnabled) {
    toolbarActions.push({
      group: 'icon-actions',
      condition: uid && Boolean(meta.canStar) && isShowingDashboard && !isEditing,
      render: () => {
        return (
          <Badge
            color="blue"
            text="Public"
            key="public-dashboard-button-badge"
            className={styles.publicBadge}
            data-testid={selectors.pages.Dashboard.DashNav.publicDashboardTag}
          />
        );
      },
    });
  }

  const isDevEnv = config.buildInfo.env === 'development';

  toolbarActions.push({
    group: 'icon-actions',
    condition: isDevEnv && uid && isShowingDashboard && !isEditing,
    render: () => (
      <ToolbarButton
        key="view-in-old-dashboard-button"
        tooltip={'Switch to old dashboard page'}
        icon="apps"
        onClick={() => {
          locationService.partial({ scenes: false });
        }}
      />
    ),
  });

  toolbarActions.push({
    group: 'icon-actions',
    condition: meta.isSnapshot && !isEditing,
    render: () => (
      <GoToSnapshotOriginButton
        key="go-to-snapshot-origin"
        originalURL={dashboard.getInitialSaveModel()?.snapshot?.originalUrl ?? ''}
      />
    ),
  });

  if (!isEditingPanel && !isEditing) {
    // This adds the alert rules button and the dashboard insights button
    addDynamicActions(toolbarActions, dynamicDashNavActions.right, 'icon-actions');
  }

  toolbarActions.push({
    group: 'add-panel',
    condition: isEditingAndShowingDashboard,
    render: () => (
      <Dropdown
        key="add-panel-dropdown"
        onVisibleChange={(isOpen) => {
          setIsAddPanelMenuOpen(isOpen);
          DashboardInteractions.toolbarAddClick();
        }}
        overlay={() => (
          <Menu>
            <Menu.Item
              key="add-visualization"
              testId={selectors.pages.AddDashboard.itemButton('Add new visualization menu item')}
              label={t('dashboard.add-menu.visualization', 'Visualization')}
              onClick={() => {
                const vizPanel = dashboard.onCreateNewPanel();
                DashboardInteractions.toolbarAddButtonClicked({ item: 'add_visualization' });
                dashboard.setState({ editPanel: buildPanelEditScene(vizPanel, true) });
              }}
            />
            <Menu.Item
              key="add-panel-lib"
              testId={selectors.pages.AddDashboard.itemButton('Add new panel from panel library menu item')}
              label={t('dashboard.add-menu.import', 'Import from library')}
              onClick={() => {
                dashboard.onShowAddLibraryPanelDrawer();
                DashboardInteractions.toolbarAddButtonClicked({ item: 'add_library_panel' });
              }}
            />
            <Menu.Item
              key="add-row"
              testId={selectors.pages.AddDashboard.itemButton('Add new row menu item')}
              label={t('dashboard.add-menu.row', 'Row')}
              onClick={() => {
                dashboard.onCreateNewRow();
                DashboardInteractions.toolbarAddButtonClicked({ item: 'add_row' });
              }}
            />
            <Menu.Item
              key="paste-panel"
              disabled={!hasCopiedPanel}
              testId={selectors.pages.AddDashboard.itemButton('Add new panel from clipboard menu item')}
              label={t('dashboard.add-menu.paste-panel', 'Paste panel')}
              onClick={() => {
                dashboard.pastePanel();
                DashboardInteractions.toolbarAddButtonClicked({ item: 'paste_panel' });
              }}
            />
          </Menu>
        )}
        placement="bottom"
        offset={[0, 6]}
      >
        <Button
          key="add-panel-button"
          variant="primary"
          size="sm"
          fill="outline"
          data-testid={selectors.components.PageToolbar.itemButton('Add button')}
        >
          <Trans i18nKey="dashboard.toolbar.add">Add</Trans>
          <Icon name={isAddPanelMenuOpen ? 'angle-up' : 'angle-down'} size="lg" />
        </Button>
      </Dropdown>
    ),
  });

  toolbarActions.push({
    group: 'playlist-actions',
    condition: isPlaying && isShowingDashboard && !isEditing,
    render: () => (
      <ToolbarButton
        key="play-list-prev"
        data-testid={selectors.pages.Dashboard.DashNav.playlistControls.prev}
        tooltip={t('dashboard.toolbar.playlist-previous', 'Go to previous dashboard')}
        icon="backward"
        onClick={() => playlistSrv.prev()}
      />
    ),
  });

  toolbarActions.push({
    group: 'playlist-actions',
    condition: isPlaying && isShowingDashboard && !isEditing,
    render: () => (
      <ToolbarButton
        key="play-list-stop"
        onClick={() => playlistSrv.stop()}
        data-testid={selectors.pages.Dashboard.DashNav.playlistControls.stop}
      >
        <Trans i18nKey="dashboard.toolbar.playlist-stop">Stop playlist</Trans>
      </ToolbarButton>
    ),
  });

  toolbarActions.push({
    group: 'playlist-actions',
    condition: isPlaying && isShowingDashboard && !isEditing,
    render: () => (
      <ToolbarButton
        key="play-list-next"
        data-testid={selectors.pages.Dashboard.DashNav.playlistControls.next}
        tooltip={t('dashboard.toolbar.playlist-next', 'Go to next dashboard')}
        icon="forward"
        onClick={() => playlistSrv.next()}
        narrow
      />
    ),
  });

  toolbarActions.push({
    group: 'back-button',
    condition: (isViewingPanel || isEditingPanel) && !isEditingLibraryPanel,
    render: () => (
      <Button
        onClick={() => {
          locationService.partial({ viewPanel: null, editPanel: null });
        }}
        tooltip=""
        key="back"
        variant="secondary"
        size="sm"
        icon="arrow-left"
        data-testid={selectors.components.NavToolbar.editDashboard.backToDashboardButton}
      >
        Back to dashboard
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'back-button',
    condition: Boolean(editview),
    render: () => (
      <Button
        onClick={() => {
          locationService.partial({ editview: null });
        }}
        tooltip=""
        key="back"
        fill="text"
        variant="secondary"
        size="sm"
        icon="arrow-left"
        data-testid={selectors.components.NavToolbar.editDashboard.backToDashboardButton}
      >
        Back to dashboard
      </Button>
    ),
  });

  const showShareButton = uid && !isEditing && !meta.isSnapshot && !isPlaying;
  toolbarActions.push({
    group: 'main-buttons',
    condition: !config.featureToggles.newDashboardSharingComponent && showShareButton,
    render: () => (
      <Button
        key="share-dashboard-button"
        tooltip={t('dashboard.toolbar.share', 'Share dashboard')}
        size="sm"
        className={styles.buttonWithExtraMargin}
        fill="outline"
        onClick={() => {
          DashboardInteractions.toolbarShareClick();
          dashboard.showModal(new ShareModal({ dashboardRef: dashboard.getRef() }));
        }}
        data-testid={selectors.components.NavToolbar.shareDashboard}
      >
        Share
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'main-buttons',
    condition: !isEditing && dashboard.canEditDashboard() && !isViewingPanel && !isPlaying && editable,
    render: () => (
      <Button
        onClick={() => {
          dashboard.onEnterEditMode();
        }}
        tooltip="Enter edit mode"
        key="edit"
        className={styles.buttonWithExtraMargin}
        variant={config.featureToggles.newDashboardSharingComponent ? 'secondary' : 'primary'}
        size="sm"
        data-testid={selectors.components.NavToolbar.editDashboard.editButton}
      >
        Edit
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'main-buttons',
    condition: !isEditing && dashboard.canEditDashboard() && !isViewingPanel && !isPlaying && !editable,
    render: () => (
      <Button
        onClick={() => {
          dashboard.onEnterEditMode();
          dashboard.setState({ editable: true, meta: { ...meta, canEdit: true } });
        }}
        tooltip="This dashboard was marked as read only"
        key="edit"
        className={styles.buttonWithExtraMargin}
        variant="secondary"
        size="sm"
        data-testid={selectors.components.NavToolbar.editDashboard.editButton}
      >
        Make editable
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'new-share-dashboard-button',
    condition: config.featureToggles.newDashboardSharingComponent && showShareButton,
    render: () => <ShareButton key="new-share-dashboard-button" dashboard={dashboard} />,
  });

  toolbarActions.push({
    group: 'settings',
    condition: isEditing && dashboard.canEditDashboard() && isShowingDashboard,
    render: () => (
      <Button
        onClick={() => {
          dashboard.onOpenSettings();
        }}
        tooltip="Dashboard settings"
        fill="text"
        size="sm"
        key="settings"
        variant="secondary"
        data-testid={selectors.components.NavToolbar.editDashboard.settingsButton}
      >
        Settings
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'main-buttons',
    condition: isEditing && !meta.isNew && isShowingDashboard,
    render: () => (
      <Button
        onClick={() => dashboard.exitEditMode({ skipConfirm: false })}
        tooltip="Exits edit mode and discards unsaved changes"
        size="sm"
        key="discard"
        fill="text"
        variant="primary"
        data-testid={selectors.components.NavToolbar.editDashboard.exitButton}
      >
        Exit edit
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'main-buttons',
    condition: isEditingPanel && !isEditingLibraryPanel && !editview && !isViewingPanel,
    render: () => (
      <Button
        onClick={editPanel?.onDiscard}
        tooltip={editPanel?.state.isNewPanel ? 'Discard panel' : 'Discard panel changes'}
        size="sm"
        disabled={!isEditedPanelDirty || !isDirty}
        key="discard"
        fill="outline"
        variant="destructive"
        data-testid={selectors.components.NavToolbar.editDashboard.discardChangesButton}
      >
        {editPanel?.state.isNewPanel ? 'Discard panel' : 'Discard panel changes'}
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'main-buttons',
    condition: isEditingPanel && isEditingLibraryPanel && !editview && !isViewingPanel,
    render: () => (
      <Button
        onClick={editPanel?.onDiscard}
        tooltip="Discard library panel changes"
        size="sm"
        key="discardLibraryPanel"
        fill="outline"
        variant="destructive"
        data-testid={selectors.components.NavToolbar.editDashboard.discardChangesButton}
      >
        Discard library panel changes
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'main-buttons',
    condition: isEditingPanel && isEditingLibraryPanel && !editview && !isViewingPanel,
    render: () => (
      <Button
        onClick={editPanel?.onUnlinkLibraryPanel}
        tooltip="Unlink library panel"
        size="sm"
        key="unlinkLibraryPanel"
        fill="outline"
        variant="secondary"
        data-testid={selectors.components.NavToolbar.editDashboard.unlinkLibraryPanelButton}
      >
        Unlink library panel
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'main-buttons',
    condition: isEditingPanel && isEditingLibraryPanel && !editview && !isViewingPanel,
    render: () => (
      <Button
        onClick={editPanel?.onSaveLibraryPanel}
        tooltip="Save library panel"
        size="sm"
        key="saveLibraryPanel"
        fill="outline"
        variant="primary"
        data-testid={selectors.components.NavToolbar.editDashboard.saveLibraryPanelButton}
      >
        Save library panel
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'main-buttons',
    condition: isEditing && !isEditingLibraryPanel && (meta.canSave || canSaveAs),
    render: () => {
      // if we  only can save
      if (meta.isNew) {
        return (
          <Button
            onClick={() => {
              DashboardInteractions.toolbarSaveClick();
              dashboard.openSaveDrawer({});
            }}
            className={styles.buttonWithExtraMargin}
            tooltip="Save changes"
            key="save"
            size="sm"
            variant={'primary'}
            data-testid={selectors.components.NavToolbar.editDashboard.saveButton}
          >
            Save dashboard
          </Button>
        );
      }

      // If we only can save as copy
      if (canSaveAs && !meta.canSave && !meta.canMakeEditable) {
        return (
          <Button
            onClick={() => {
              DashboardInteractions.toolbarSaveClick();
              dashboard.openSaveDrawer({ saveAsCopy: true });
            }}
            className={styles.buttonWithExtraMargin}
            tooltip="Save as copy"
            key="save"
            size="sm"
            variant={isDirty ? 'primary' : 'secondary'}
          >
            Save as copy
          </Button>
        );
      }

      // If we can do both save and save as copy we show a button group with dropdown menu
      const menu = (
        <Menu>
          <Menu.Item
            label="Save"
            icon="save"
            onClick={() => {
              DashboardInteractions.toolbarSaveClick();
              dashboard.openSaveDrawer({});
            }}
          />
          <Menu.Item
            label="Save as copy"
            icon="copy"
            onClick={() => {
              DashboardInteractions.toolbarSaveAsClick();
              dashboard.openSaveDrawer({ saveAsCopy: true });
            }}
          />
        </Menu>
      );

      return (
        <ButtonGroup className={styles.buttonWithExtraMargin} key="save">
          <Button
            onClick={() => {
              DashboardInteractions.toolbarSaveClick();
              dashboard.openSaveDrawer({});
            }}
            tooltip="Save changes"
            size="sm"
            data-testid={selectors.components.NavToolbar.editDashboard.saveButton}
            variant={isDirty ? 'primary' : 'secondary'}
          >
            Save dashboard
          </Button>
          <Dropdown overlay={menu}>
            <Button icon="angle-down" variant={isDirty ? 'primary' : 'secondary'} size="sm" />
          </Dropdown>
        </ButtonGroup>
      );
    },
  });

  const actionElements: React.ReactNode[] = [];
  let lastGroup = '';

  for (const action of toolbarActions) {
    if (!action.condition) {
      continue;
    }

    if (lastGroup && lastGroup !== action.group) {
      lastGroup && actionElements.push(<NavToolbarSeparator key={`${action.group}-separator`} />);
    }

    actionElements.push(action.render());
    lastGroup = action.group;
  }

  return <ToolbarButtonRow alignment="right">{actionElements}</ToolbarButtonRow>;
}

function addDynamicActions(
  toolbarActions: ToolbarAction[],
  registeredActions: DynamicDashNavButtonModel[],
  group: string
) {
  if (registeredActions.length > 0) {
    for (const action of registeredActions) {
      const props = { dashboard: getDashboardSrv().getCurrent()! };
      if (action.show(props)) {
        const Component = action.component;
        toolbarActions.push({
          group: group,
          condition: true,
          render: () => <Component {...props} key={toolbarActions.length} />,
        });
      }
    }
  }
}

function useEditingLibraryPanel(panelEditor?: PanelEditor) {
  const [isEditingLibraryPanel, setEditingLibraryPanel] = useState<Boolean>(false);

  useEffect(() => {
    if (panelEditor) {
      const unsub = panelEditor.state.vizManager.subscribeToState((vizManagerState) =>
        setEditingLibraryPanel(vizManagerState.sourcePanel.resolve().parent instanceof LibraryVizPanel)
      );
      return () => {
        unsub.unsubscribe();
      };
    }
    setEditingLibraryPanel(false);
    return;
  }, [panelEditor]);

  return isEditingLibraryPanel;
}

// This hook handles when panelEditor is not defined to avoid conditionally hook usage
function useVizManagerDirty(panelEditor?: PanelEditor) {
  const [isDirty, setIsDirty] = useState<Boolean>(false);

  useEffect(() => {
    if (panelEditor) {
      const unsub = panelEditor.state.vizManager.subscribeToState((vizManagerState) =>
        setIsDirty(vizManagerState.isDirty || false)
      );
      return () => {
        unsub.unsubscribe();
      };
    }
    setIsDirty(false);
    return;
  }, [panelEditor]);

  return isDirty;
}

interface ToolbarAction {
  group: string;
  condition?: boolean | string;
  render: () => React.ReactNode;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    buttonWithExtraMargin: css({
      margin: theme.spacing(0, 0.5),
    }),
    publicBadge: css({
      color: 'grey',
      backgroundColor: 'transparent',
      border: '1px solid',
    }),
  };
}
