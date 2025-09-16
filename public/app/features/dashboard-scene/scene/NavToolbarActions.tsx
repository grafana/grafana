import { css } from '@emotion/css';
import { memo, ReactNode, useEffect, useState } from 'react';

import { GrafanaTheme2, store } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
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
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { getReadOnlyTooltipText } from 'app/features/provisioning/utils/repository';
import { useSelector } from 'app/types/store';

import { selectFolderRepository } from '../../provisioning/utils/selectors';
import { PanelEditor, buildPanelEditScene } from '../panel-edit/PanelEditor';
import ExportButton from '../sharing/ExportButton/ExportButton';
import ShareButton from '../sharing/ShareButton/ShareButton';
import { DashboardInteractions } from '../utils/interactions';
import { DynamicDashNavButtonModel, dynamicDashNavActions } from '../utils/registerDynamicDashNavAction';
import { isLibraryPanel } from '../utils/utils';

import { DashboardScene } from './DashboardScene';
import { GoToSnapshotOriginButton } from './GoToSnapshotOriginButton';
import ManagedDashboardNavBarBadge from './ManagedDashboardNavBarBadge';
import { LeftActions } from './new-toolbar/LeftActions';
import { RightActions } from './new-toolbar/RightActions';
import { PublicDashboardBadge } from './new-toolbar/actions/PublicDashboardBadge';

interface Props {
  dashboard: DashboardScene;
}

export const NavToolbarActions = memo<Props>(({ dashboard }) => {
  const hasNewToolbar = config.featureToggles.dashboardNewLayouts;

  return hasNewToolbar ? (
    <AppChromeUpdate
      breadcrumbActions={<LeftActions dashboard={dashboard} />}
      actions={<RightActions dashboard={dashboard} />}
    />
  ) : (
    <AppChromeUpdate actions={<ToolbarActions dashboard={dashboard} />} />
  );
});

NavToolbarActions.displayName = 'NavToolbarActions';

/**
 * This part is split into a separate component to help test this
 */
export function ToolbarActions({ dashboard }: Props) {
  const { isEditing, viewPanel, isDirty, uid, meta, editview, editPanel, editable } = dashboard.useState();

  const { isPlaying } = playlistSrv.useState();
  const [isAddPanelMenuOpen, setIsAddPanelMenuOpen] = useState(false);

  const canSaveAs = contextSrv.hasEditPermissionInFolders;
  const toolbarActions: ToolbarAction[] = [];
  const styles = useStyles2(getStyles);
  const isEditingPanel = Boolean(editPanel);
  const isViewingPanel = Boolean(viewPanel);
  const isEditedPanelDirty = usePanelEditDirty(editPanel);

  const isEditingLibraryPanel = editPanel && isLibraryPanel(editPanel.state.panelRef.resolve());
  const isNew = !Boolean(uid || dashboard.isManaged());

  const hasCopiedPanel = store.exists(LS_PANEL_COPY_KEY);
  // Means we are not in settings view, fullscreen panel or edit panel
  const isShowingDashboard = !editview && !isViewingPanel && !isEditingPanel;
  const isEditingAndShowingDashboard = isEditing && isShowingDashboard;
  const folderRepo = useSelector((state) => selectFolderRepository()(state, meta.folderUid));
  const isManaged = Boolean(dashboard.isManagedRepository() || folderRepo);
  // Get the repository for the dashboard's folder
  const { isReadOnlyRepo, repoType } = useGetResourceRepositoryView({
    folderName: meta.folderUid,
  });

  if (!isEditingPanel) {
    // This adds the presence indicators in enterprise
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

  toolbarActions.push({
    group: 'icon-actions',
    condition: uid && Boolean(meta.canStar) && isShowingDashboard && !isEditing,
    render: () => {
      return <PublicDashboardBadge key="public-dashboard-badge" dashboard={dashboard} />;
    },
  });

  if (isReadOnlyRepo) {
    toolbarActions.push({
      group: 'icon-actions',
      condition: true,
      render: () => {
        return (
          <Badge
            color="darkgrey"
            text={t('dashboard.toolbar.read-only', 'Read only')}
            tooltip={getReadOnlyTooltipText({ isLocal: repoType === 'local' })}
          />
        );
      },
    });
  }

  if (dashboard.isManaged() && meta.canEdit) {
    toolbarActions.push({
      group: 'icon-actions',
      condition: true,
      render: () => {
        return <ManagedDashboardNavBarBadge meta={meta} key="managed-dashboard-badge" />;
      },
    });
  }

  toolbarActions.push({
    group: 'icon-actions',
    condition: meta.isSnapshot && !isEditing,
    render: () => (
      <GoToSnapshotOriginButton key="go-to-snapshot-origin" originalURL={dashboard.getSnapshotUrl() ?? ''} />
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
              disabled={dashboard.isManagedRepository()}
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
        <Trans i18nKey="dashboard.toolbar.back-to-dashboard">Back to dashboard</Trans>
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
        <Trans i18nKey="dashboard.toolbar.back-to-dashboard">Back to dashboard</Trans>
      </Button>
    ),
  });

  const showShareButton = uid && !isEditing && !meta.isSnapshot && !isPlaying;

  toolbarActions.push({
    group: 'main-buttons',
    condition: !isEditing && dashboard.canEditDashboard() && !isViewingPanel && !isPlaying && editable,
    render: () => (
      <Button
        onClick={() => {
          dashboard.onEnterEditMode();
        }}
        tooltip={
          isReadOnlyRepo
            ? getReadOnlyTooltipText({ isLocal: repoType === 'local' })
            : t('dashboard.toolbar.edit.tooltip', 'Enter edit mode')
        }
        key="edit"
        className={styles.buttonWithExtraMargin}
        variant={'secondary'}
        size="sm"
        data-testid={selectors.components.NavToolbar.editDashboard.editButton}
        disabled={isReadOnlyRepo}
      >
        <Trans i18nKey="dashboard.toolbar.edit.label">Edit</Trans>
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
        tooltip={t('dashboard.toolbar.enter-edit-mode.tooltip', 'This dashboard was marked as read only')}
        key="edit"
        className={styles.buttonWithExtraMargin}
        variant="secondary"
        size="sm"
        data-testid={selectors.components.NavToolbar.editDashboard.editButton}
      >
        <Trans i18nKey="dashboard.toolbar.enter-edit-mode.label">Make editable</Trans>
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'new-share-dashboard-buttons',
    condition: showShareButton,
    render: () => <ExportButton key="new-export-dashboard-button" dashboard={dashboard} />,
  });

  toolbarActions.push({
    group: 'new-share-dashboard-buttons',
    condition: showShareButton,
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
        tooltip={t('dashboard.toolbar.dashboard-settings.tooltip', 'Dashboard settings')}
        fill="text"
        size="sm"
        key="settings"
        variant="secondary"
        data-testid={selectors.components.NavToolbar.editDashboard.settingsButton}
      >
        <Trans i18nKey="dashboard.toolbar.dashboard-settings.label">Settings</Trans>
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'main-buttons',
    condition: isEditing && !isNew && isShowingDashboard,
    render: () => (
      <Button
        onClick={() => dashboard.exitEditMode({ skipConfirm: false })}
        tooltip={t('dashboard.toolbar.exit-edit-mode.tooltip', 'Exits edit mode and discards unsaved changes')}
        size="sm"
        key="discard"
        fill="text"
        variant="primary"
        data-testid={selectors.components.NavToolbar.editDashboard.exitButton}
      >
        <Trans i18nKey="dashboard.toolbar.exit-edit-mode.label">Exit edit</Trans>
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'main-buttons',
    condition: isEditingPanel && !isEditingLibraryPanel && !editview && !isViewingPanel,
    render: () => (
      <Button
        onClick={editPanel?.onDiscard}
        tooltip={
          editPanel?.state.isNewPanel
            ? t('dashboard.toolbar.discard-panel-new', 'Discard panel')
            : t('dashboard.toolbar.discard-panel', 'Discard panel changes')
        }
        size="sm"
        disabled={!isEditedPanelDirty}
        key="discard"
        fill="outline"
        variant="destructive"
        data-testid={selectors.components.NavToolbar.editDashboard.discardChangesButton}
      >
        {editPanel?.state.isNewPanel ? (
          <Trans i18nKey="dashboard.toolbar.discard-panel-new">Discard panel</Trans>
        ) : (
          <Trans i18nKey="dashboard.toolbar.discard-panel">Discard panel changes</Trans>
        )}
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'main-buttons',
    condition: isEditingPanel && isEditingLibraryPanel && !editview && !isViewingPanel,
    render: () => (
      <Button
        onClick={editPanel?.onDiscard}
        tooltip={t('dashboard.toolbar.discard-library-panel-changes', 'Discard library panel changes')}
        size="sm"
        key="discardLibraryPanel"
        fill="outline"
        variant="destructive"
        data-testid={selectors.components.NavToolbar.editDashboard.discardChangesButton}
      >
        <Trans i18nKey="dashboard.toolbar.discard-library-panel-changes">Discard library panel changes</Trans>
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'main-buttons',
    condition: isEditingPanel && isEditingLibraryPanel && !editview && !isViewingPanel,
    render: () => (
      <Button
        onClick={editPanel?.onUnlinkLibraryPanel}
        tooltip={t('dashboard.toolbar.unlink-library-panel', 'Unlink library panel')}
        size="sm"
        key="unlinkLibraryPanel"
        fill="outline"
        variant="secondary"
        data-testid={selectors.components.NavToolbar.editDashboard.unlinkLibraryPanelButton}
      >
        <Trans i18nKey="dashboard.toolbar.unlink-library-panel">Unlink library panel</Trans>
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'main-buttons',
    condition: isEditingPanel && isEditingLibraryPanel && !editview && !isViewingPanel,
    render: () => (
      <Button
        onClick={editPanel?.onSaveLibraryPanel}
        tooltip={t('dashboard.toolbar.save-library-panel', 'Save library panel')}
        size="sm"
        key="saveLibraryPanel"
        fill="outline"
        variant="primary"
        data-testid={selectors.components.NavToolbar.editDashboard.saveLibraryPanelButton}
      >
        <Trans i18nKey="dashboard.toolbar.save-library-panel">Save library panel</Trans>
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'main-buttons',
    condition: isEditing && !isEditingLibraryPanel && (meta.canSave || canSaveAs),
    render: () => {
      // if we  only can save
      if (isNew) {
        return (
          <Button
            onClick={() => {
              dashboard.openSaveDrawer({});
            }}
            className={styles.buttonWithExtraMargin}
            tooltip={t('dashboard.toolbar.save-dashboard.tooltip', 'Save changes')}
            key="save"
            size="sm"
            variant="primary"
            data-testid={selectors.components.NavToolbar.editDashboard.saveButton}
          >
            <Trans i18nKey="dashboard.toolbar.save-dashboard.label">Save dashboard</Trans>
          </Button>
        );
      }

      // If we only can save as copy
      if (canSaveAs && !meta.canSave && !meta.canMakeEditable && !isManaged) {
        return (
          <Button
            onClick={() => {
              dashboard.openSaveDrawer({ saveAsCopy: true });
            }}
            className={styles.buttonWithExtraMargin}
            tooltip={t('dashboard.toolbar.save-dashboard-copy.tooltip', 'Save as copy')}
            key="save"
            size="sm"
            variant={isDirty ? 'primary' : 'secondary'}
          >
            <Trans i18nKey="dashboard.toolbar.save-dashboard-copy.label">Save as copy</Trans>
          </Button>
        );
      }

      // If we can do both save and save as copy we show a button group with dropdown menu
      const menu = (
        <Menu>
          <Menu.Item
            label={t('dashboard.toolbar.save-dashboard-short', 'Save')}
            icon="save"
            onClick={() => {
              dashboard.openSaveDrawer({});
            }}
          />
          <Menu.Item
            label={t('dashboard.toolbar.save-dashboard-copy.label', 'Save as copy')}
            icon="copy"
            onClick={() => {
              dashboard.openSaveDrawer({ saveAsCopy: true });
            }}
          />
        </Menu>
      );

      return (
        <ButtonGroup className={styles.buttonWithExtraMargin} key="save">
          <Button
            onClick={() => {
              dashboard.openSaveDrawer({});
            }}
            tooltip={t('dashboard.toolbar.save-dashboard.tooltip', 'Save changes')}
            size="sm"
            data-testid={selectors.components.NavToolbar.editDashboard.saveButton}
            variant={isDirty ? 'primary' : 'secondary'}
          >
            <Trans i18nKey="dashboard.toolbar.save-dashboard.label">Save dashboard</Trans>
          </Button>
          <Dropdown overlay={menu}>
            <Button
              aria-label={t('dashboard.toolbar.more-save-options', 'More save options')}
              icon="angle-down"
              variant={isDirty ? 'primary' : 'secondary'}
              size="sm"
            />
          </Dropdown>
        </ButtonGroup>
      );
    },
  });

  return <ToolbarButtonRow alignment="right">{renderActionElements(toolbarActions)}</ToolbarButtonRow>;
}

function renderActionElements(toolbarActions: ToolbarAction[]) {
  const actionElements: ReactNode[] = [];
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

  return actionElements;
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

// This hook handles when panelEditor is not defined to avoid conditionally hook usage
function usePanelEditDirty(panelEditor?: PanelEditor) {
  const [isDirty, setIsDirty] = useState<Boolean | undefined>();

  useEffect(() => {
    if (panelEditor) {
      const unsub = panelEditor.subscribeToState((state) => {
        if (state.isDirty !== isDirty) {
          setIsDirty(state.isDirty);
        }
      });

      return () => unsub.unsubscribe();
    }
    return;
  }, [panelEditor, isDirty]);

  return isDirty;
}

interface ToolbarAction {
  group: string;
  condition?: boolean | string;
  render: () => ReactNode;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    hiddenElementsContainer: css({
      display: 'flex',
      padding: 0,
      gap: theme.spacing(1),
      whiteSpace: 'nowrap',
    }),
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
