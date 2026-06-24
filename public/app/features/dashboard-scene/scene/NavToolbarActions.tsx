import { css } from '@emotion/css';
import { memo, type ReactNode, useEffect, useState } from 'react';

import { type GrafanaTheme2, store } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { config, locationService } from '@grafana/runtime';
import { Button, ButtonGroup, Dropdown, Icon, Menu, ToolbarButton, ToolbarButtonRow, useStyles2 } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { NavToolbarSeparator } from 'app/core/components/AppChrome/NavToolbar/NavToolbarSeparator';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';
import { contextSrv } from 'app/core/services/context_srv';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { trackDashboardSceneEditButtonClicked } from 'app/features/dashboard-scene/utils/tracking';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';
import { ReadOnlyBadge } from 'app/features/provisioning/components/ReadOnlyBadge';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { getReadOnlyTooltipText } from 'app/features/provisioning/utils/tooltip';
import { StarToolbarButton } from 'app/features/stars/StarToolbarButton';
import { useSelector } from 'app/types/store';

import { selectFolderRepository } from '../../provisioning/utils/selectors';
import { type PanelEditor, buildPanelEditScene } from '../panel-edit/PanelEditor';
import ExportButton from '../sharing/ExportButton/ExportButton';
import ShareButton from '../sharing/ShareButton/ShareButton';
import { DashboardInteractions } from '../utils/interactions';
import { type DynamicDashNavButtonModel, dynamicDashNavActions } from '../utils/registerDynamicDashNavAction';
import { isLibraryPanel } from '../utils/utils';

import { type DashboardScene } from './DashboardScene';
import { GoToSnapshotOriginButton } from './GoToSnapshotOriginButton';
import { ManagedDashboardNavBarBadge } from './ManagedDashboardNavBarBadge';
import { Actions } from './new-toolbar/Actions';
import { BreadcrumbActions } from './new-toolbar/BreadcrumbActions';
import { PublicDashboardBadge } from './new-toolbar/actions/PublicDashboardBadge';

interface Props {
  dashboard: DashboardScene;
}

export const NavToolbarActions = memo<Props>(({ dashboard }) => {
  const hasNewToolbar = config.featureToggles.dashboardNewLayouts;

  return hasNewToolbar ? (
    <AppChromeUpdate
      breadcrumbActions={<BreadcrumbActions dashboard={dashboard} />}
      actions={<Actions dashboard={dashboard} />}
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
  const {
    isEditing,
    viewPanel,
    isDirty,
    uid,
    meta,
    editview,
    editPanel,
    editable,
    title,
    meta: { isEmbedded, isSnapshot, canEdit, canMakeEditable, canStar, canSave, folderUid },
  } = dashboard.useState();
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
  const folderRepo = useSelector((state) => selectFolderRepository()(state, folderUid));
  const isManaged = Boolean(dashboard.isManagedRepository() || folderRepo);
  // Get the repository for the dashboard's folder
  const { isReadOnlyRepo, repoType } = useGetResourceRepositoryView({
    folderName: folderUid,
  });

  if (!isEditingPanel) {
    // This adds the presence indicators in enterprise
    addDynamicActions(toolbarActions, dynamicDashNavActions.left, 'left-actions');
  }

  toolbarActions.push({
    group: 'icon-actions',
    condition: uid && Boolean(canStar) && isShowingDashboard && !isEditing,
    render: () => {
      if (!uid) {
        return null;
      }
      return (
        <StarToolbarButton
          key="star-dashboard-button"
          group="dashboard.grafana.app"
          kind="Dashboard"
          title={title}
          id={uid}
        />
      );
    },
  });

  toolbarActions.push({
    group: 'icon-actions',
    condition: uid && Boolean(canStar) && isShowingDashboard && !isEditing,
    render: () => {
      return <PublicDashboardBadge key="public-dashboard-badge" dashboard={dashboard} />;
    },
  });

  if (isReadOnlyRepo) {
    toolbarActions.push({
      group: 'icon-actions',
      condition: true,
      render: () => {
        return <ReadOnlyBadge repoType={repoType} />;
      },
    });
  }

  if (dashboard.isManaged() && canEdit) {
    toolbarActions.push({
      group: 'icon-actions',
      condition: true,
      render: () => {
        return <ManagedDashboardNavBarBadge dashboard={dashboard} key="managed-dashboard-badge" />;
      },
    });
  }

  toolbarActions.push({
    group: 'icon-actions',
<<<<<<< HEAD
    condition: isDevEnv && uid && isShowingDashboard && !isEditing,
    render: () => (
      <ToolbarButton
        key="view-in-old-dashboard-button"
        tooltip={'Переключитесь на старую страницу дашборда'}
        icon="apps"
        onClick={() => {
          locationService.partial({ scenes: false });
        }}
      />
    ),
  });

  toolbarActions.push({
    group: 'icon-actions',
    condition: meta.isSnapshot && !meta.dashboardNotFound && !isEditing,
    render: () => (
      <GoToSnapshotOriginButton
        key="go-to-snapshot-origin"
        originalURL={dashboard.getInitialSaveModel()?.snapshot?.originalUrl ?? ''}
      />
    ),
=======
    condition: isSnapshot && !isEditing && !isEmbedded,
    render: () => <GoToSnapshotOriginButton key="go-to-snapshot-origin" originalURL={dashboard.getSnapshotUrl()} />,
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
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
<<<<<<< HEAD
        Вернуться к дашборду
=======
        <Trans i18nKey="dashboard.toolbar.back-to-dashboard">Back to dashboard</Trans>
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
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
<<<<<<< HEAD
        Вернуться к дашборду
=======
        <Trans i18nKey="dashboard.toolbar.back-to-dashboard">Back to dashboard</Trans>
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
      </Button>
    ),
  });

<<<<<<< HEAD
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
          locationService.partial({ shareView: shareDashboardType.link });
        }}
        data-testid={selectors.components.NavToolbar.shareDashboard}
      >
        Поделиться
      </Button>
    ),
  });
=======
  const showShareButton = uid && !isEditing && !isSnapshot && !isPlaying && !isEmbedded;
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc

  toolbarActions.push({
    group: 'main-buttons',
    condition: !isEditing && dashboard.canEditDashboard() && !isViewingPanel && !isPlaying && editable,
    render: () => (
      <Button
        onClick={() => {
          trackDashboardSceneEditButtonClicked(dashboard.state.uid);
          dashboard.onEnterEditMode();
        }}
<<<<<<< HEAD
        tooltip="Войти в режим редактирования"
=======
        tooltip={
          isReadOnlyRepo
            ? getReadOnlyTooltipText({ isLocal: repoType === 'local' })
            : t('dashboard.toolbar.edit.tooltip', 'Enter edit mode')
        }
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
        key="edit"
        className={styles.buttonWithExtraMargin}
        variant={'secondary'}
        size="sm"
        data-testid={selectors.components.NavToolbar.editDashboard.editButton}
        disabled={isReadOnlyRepo}
      >
<<<<<<< HEAD
        Редактировать
=======
        <Trans i18nKey="dashboard.toolbar.edit.label">Edit</Trans>
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'main-buttons',
    condition: !isEditing && dashboard.canEditDashboard() && !isViewingPanel && !isPlaying && !editable,
    render: () => (
      <Button
        onClick={() => {
          trackDashboardSceneEditButtonClicked(dashboard.state.uid);
          dashboard.onEnterEditMode();
          dashboard.setState({ meta: { ...meta, canEdit: true, canSave: true } });
        }}
<<<<<<< HEAD
        tooltip="Этот дашборд был помечен как доступный только для чтения"
=======
        tooltip={t('dashboard.toolbar.enter-edit-mode.tooltip', 'This dashboard was marked as read only')}
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
        key="edit"
        className={styles.buttonWithExtraMargin}
        variant="secondary"
        size="sm"
        data-testid={selectors.components.NavToolbar.editDashboard.editButton}
      >
<<<<<<< HEAD
        Сделать редактируемым
=======
        <Trans i18nKey="dashboard.toolbar.enter-edit-mode.label">Make editable</Trans>
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
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
<<<<<<< HEAD
        tooltip="Настройки дашборда"
=======
        tooltip={t('dashboard.toolbar.dashboard-settings.tooltip', 'Dashboard settings')}
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
        fill="text"
        size="sm"
        key="settings"
        variant="secondary"
        data-testid={selectors.components.NavToolbar.editDashboard.settingsButton}
      >
<<<<<<< HEAD
        Настройки
=======
        <Trans i18nKey="dashboard.toolbar.dashboard-settings.label">Settings</Trans>
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'main-buttons',
    condition: isEditing && !isNew && isShowingDashboard,
    render: () => (
      <Button
<<<<<<< HEAD
        onClick={() => dashboard.exitEditMode({ skipConfirm: false })}
        tooltip="Выйти из режима редактирования и сбросить несохраненные изменения"
=======
        onClick={() => {
          DashboardInteractions.exitEditButtonClicked();
          dashboard.exitEditMode({ skipConfirm: false });
        }}
        tooltip={t('dashboard.toolbar.exit-edit-mode.tooltip', 'Exits edit mode and discards unsaved changes')}
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
        size="sm"
        key="discard"
        fill="text"
        variant="primary"
        data-testid={selectors.components.NavToolbar.editDashboard.exitButton}
      >
<<<<<<< HEAD
        Выйти из режима редактирования
=======
        <Trans i18nKey="dashboard.toolbar.exit-edit-mode.label">Exit edit</Trans>
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'main-buttons',
    condition: isEditingPanel && !isEditingLibraryPanel && !editview && !isViewingPanel,
    render: () => (
      <Button
        onClick={editPanel?.onDiscard}
<<<<<<< HEAD
        tooltip={editPanel?.state.isNewPanel ? 'Удалить панель' : 'Отменить изменения панели'}
=======
        tooltip={
          editPanel?.state.isNewPanel
            ? t('dashboard.toolbar.discard-panel-new', 'Discard panel')
            : t('dashboard.toolbar.discard-panel', 'Discard panel changes')
        }
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
        size="sm"
        disabled={!isEditedPanelDirty}
        key="discard"
        fill="outline"
        variant="destructive"
        data-testid={selectors.components.NavToolbar.editDashboard.discardChangesButton}
      >
<<<<<<< HEAD
        {editPanel?.state.isNewPanel ? 'Удалить панель' : 'Отменить изменения панели'}
=======
        {editPanel?.state.isNewPanel ? (
          <Trans i18nKey="dashboard.toolbar.discard-panel-new">Discard panel</Trans>
        ) : (
          <Trans i18nKey="dashboard.toolbar.discard-panel">Discard panel changes</Trans>
        )}
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'main-buttons',
    condition: isEditingPanel && isEditingLibraryPanel && !editview && !isViewingPanel,
    render: () => (
      <Button
        onClick={editPanel?.onDiscard}
<<<<<<< HEAD
        tooltip="Отменить изменения в панели библиотеки"
=======
        tooltip={t('dashboard.toolbar.discard-library-panel-changes', 'Discard library panel changes')}
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
        size="sm"
        key="discardLibraryPanel"
        fill="outline"
        variant="destructive"
        data-testid={selectors.components.NavToolbar.editDashboard.discardChangesButton}
      >
<<<<<<< HEAD
        Отменить изменения в панели библиотеки
=======
        <Trans i18nKey="dashboard.toolbar.discard-library-panel-changes">Discard library panel changes</Trans>
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'main-buttons',
    condition: isEditingPanel && isEditingLibraryPanel && !editview && !isViewingPanel,
    render: () => (
      <Button
        onClick={editPanel?.onUnlinkLibraryPanel}
<<<<<<< HEAD
        tooltip="Отсоединить панель библиотеки ссылок"
=======
        tooltip={t('dashboard.toolbar.unlink-library-panel', 'Unlink library panel')}
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
        size="sm"
        key="unlinkLibraryPanel"
        fill="outline"
        variant="secondary"
        data-testid={selectors.components.NavToolbar.editDashboard.unlinkLibraryPanelButton}
      >
<<<<<<< HEAD
        Отсоединить панель библиотеки ссылок
=======
        <Trans i18nKey="dashboard.toolbar.unlink-library-panel">Unlink library panel</Trans>
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'main-buttons',
    condition: isEditingPanel && isEditingLibraryPanel && !editview && !isViewingPanel,
    render: () => (
      <Button
        onClick={editPanel?.onSaveLibraryPanel}
<<<<<<< HEAD
        tooltip="Панель сохранения библиотеки"
=======
        tooltip={t('dashboard.toolbar.save-library-panel', 'Save library panel')}
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
        size="sm"
        key="saveLibraryPanel"
        fill="outline"
        variant="primary"
        data-testid={selectors.components.NavToolbar.editDashboard.saveLibraryPanelButton}
      >
<<<<<<< HEAD
        Панель сохранения библиотеки
=======
        <Trans i18nKey="dashboard.toolbar.save-library-panel">Save library panel</Trans>
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'main-buttons',
    condition: isEditing && !isEditingLibraryPanel && (canSave || canSaveAs),
    render: () => {
      // if we  only can save
      if (isNew) {
        return (
          <Button
            onClick={() => {
              dashboard.openSaveDrawer({});
            }}
            className={styles.buttonWithExtraMargin}
<<<<<<< HEAD
            tooltip="Сохрранить изменения"
=======
            tooltip={t('dashboard.toolbar.save-dashboard.tooltip', 'Save changes')}
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
            key="save"
            size="sm"
            variant="primary"
            data-testid={selectors.components.NavToolbar.editDashboard.saveButton}
          >
<<<<<<< HEAD
            Сохранить дашборд
=======
            <Trans i18nKey="dashboard.toolbar.save-dashboard.label">Save dashboard</Trans>
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
          </Button>
        );
      }

      // If we only can save as copy
      if (canSaveAs && !canSave && !canMakeEditable && !isManaged) {
        return (
          <Button
            onClick={() => {
              dashboard.openSaveDrawer({ saveAsCopy: true });
            }}
            className={styles.buttonWithExtraMargin}
<<<<<<< HEAD
            tooltip="Сохранить как копию"
=======
            tooltip={t('dashboard.toolbar.save-dashboard-copy.tooltip', 'Save as copy')}
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
            key="save"
            size="sm"
            variant={isDirty ? 'primary' : 'secondary'}
          >
<<<<<<< HEAD
            Сохранить как копию
=======
            <Trans i18nKey="dashboard.toolbar.save-dashboard-copy.label">Save as copy</Trans>
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
          </Button>
        );
      }

      // If we can do both save and save as copy we show a button group with dropdown menu
      const menu = (
        <Menu>
          <Menu.Item
<<<<<<< HEAD
            label="Сохранить"
=======
            label={t('dashboard.toolbar.save-dashboard-short', 'Save')}
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
            icon="save"
            onClick={() => {
              dashboard.openSaveDrawer({});
            }}
          />
          <Menu.Item
<<<<<<< HEAD
            label="Сохранить как копию"
=======
            label={t('dashboard.toolbar.save-dashboard-copy.label', 'Save as copy')}
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
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
<<<<<<< HEAD
            tooltip="Сохранить изменения"
=======
            tooltip={t('dashboard.toolbar.save-dashboard.tooltip', 'Save changes')}
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
            size="sm"
            data-testid={selectors.components.NavToolbar.editDashboard.saveButton}
            variant={isDirty ? 'primary' : 'secondary'}
          >
<<<<<<< HEAD
            Сохранить изменения
          </Button>
          <Dropdown overlay={menu}>
            <Button
              aria-label="Дополнительные параметры сохранения"
=======
            <Trans i18nKey="dashboard.toolbar.save-dashboard.label">Save dashboard</Trans>
          </Button>
          <Dropdown overlay={menu}>
            <Button
              aria-label={t('dashboard.toolbar.more-save-options', 'More save options')}
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
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
