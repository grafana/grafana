import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Button, ButtonGroup, Dropdown, Icon, Menu, ToolbarButton, ToolbarButtonRow, useStyles2 } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { NavToolbarSeparator } from 'app/core/components/AppChrome/NavToolbar/NavToolbarSeparator';
import { contextSrv } from 'app/core/core';
import { t } from 'app/core/internationalization';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { ShareModal } from '../sharing/ShareModal';
import { DashboardInteractions } from '../utils/interactions';
import { dynamicDashNavActions } from '../utils/registerDynamicDashNavAction';

import { DashboardScene } from './DashboardScene';
import { GoToSnapshotOriginButton } from './GoToSnapshotOriginButton';

interface Props {
  dashboard: DashboardScene;
}

export const NavToolbarActions = React.memo<Props>(({ dashboard }) => {
  const actions = (
    <ToolbarButtonRow alignment="right">
      <ToolbarActions dashboard={dashboard} />
    </ToolbarButtonRow>
  );

  return <AppChromeUpdate actions={actions} />;
});

NavToolbarActions.displayName = 'NavToolbarActions';

/**
 * This part is split into a separate componet to help test this
 */
export function ToolbarActions({ dashboard }: Props) {
  const { isEditing, viewPanelScene, isDirty, uid, meta, editview, editPanel } = dashboard.useState();
  const canSaveAs = contextSrv.hasEditPermissionInFolders;
  const toolbarActions: ToolbarAction[] = [];
  const buttonWithExtraMargin = useStyles2(getStyles);
  const isEditingPanel = Boolean(editPanel);
  const isViewingPanel = Boolean(viewPanelScene);

  toolbarActions.push({
    group: 'icon-actions',
    condition: uid && !editview && Boolean(meta.canStar) && !isEditingPanel,
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
    condition: uid && !editview && !isEditingPanel,
    render: () => (
      <ToolbarButton
        key="view-in-old-dashboard-button"
        tooltip={'Switch to old dashboard page'}
        icon="apps"
        onClick={() => {
          if (meta.isSnapshot) {
            locationService.partial({ scenes: null });
          } else {
            locationService.push(`/d/${uid}`);
          }
        }}
      />
    ),
  });

  toolbarActions.push({
    group: 'icon-actions',
    condition: meta.isSnapshot && !isEditing,
    render: () => (
      <GoToSnapshotOriginButton originalURL={dashboard.getInitialSaveModel()?.snapshot?.originalUrl ?? ''} />
    ),
  });

  if (dynamicDashNavActions.left.length > 0 && !isEditingPanel) {
    dynamicDashNavActions.left.map((action, index) => {
      const props = { dashboard: getDashboardSrv().getCurrent()! };
      if (action.show(props)) {
        const Component = action.component;
        toolbarActions.push({
          group: 'icon-actions',
          condition: true,
          render: () => <Component {...props} />,
        });
      }
    });
  }

  toolbarActions.push({
    group: 'back-button',
    condition: isViewingPanel || isEditingPanel,
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
      >
        Back to dashboard
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'main-buttons',
    condition: uid && !isEditing && !meta.isSnapshot,
    render: () => (
      <Button
        key="share-dashboard-button"
        tooltip={t('dashboard.toolbar.share', 'Share dashboard')}
        size="sm"
        className={buttonWithExtraMargin}
        fill="outline"
        onClick={() => {
          DashboardInteractions.toolbarShareClick();
          dashboard.showModal(new ShareModal({ dashboardRef: dashboard.getRef() }));
        }}
      >
        Share
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'main-buttons',
    condition: !isEditing && dashboard.canEditDashboard() && !isViewingPanel && !isEditingPanel,
    render: () => (
      <Button
        onClick={() => {
          dashboard.onEnterEditMode();
        }}
        tooltip="Enter edit mode"
        key="edit"
        className={buttonWithExtraMargin}
        variant="primary"
        size="sm"
      >
        Edit
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'settings',
    condition: isEditing && dashboard.canEditDashboard() && !isViewingPanel && !isEditingPanel && !editview,
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
      >
        Settings
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'main-buttons',
    condition: isEditing && !editview && !meta.isNew && !isViewingPanel && !isEditingPanel,
    render: () => (
      <Button
        onClick={() => dashboard.exitEditMode({ skipConfirm: false })}
        tooltip="Exits edit mode and discards unsaved changes"
        size="sm"
        key="discard"
        fill="text"
        variant="primary"
      >
        Exit edit
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'main-buttons',
    condition: isEditingPanel && !editview && !meta.isNew && !isViewingPanel,
    render: () => (
      <Button
        onClick={editPanel?.onDiscard}
        tooltip="Discard panel changes"
        size="sm"
        key="discard"
        fill="outline"
        variant="destructive"
      >
        Discard panel changes
      </Button>
    ),
  });

  toolbarActions.push({
    group: 'main-buttons',
    condition: isEditing && (meta.canSave || canSaveAs),
    render: () => {
      // if we  only can save
      if (meta.isNew) {
        return (
          <Button
            onClick={() => {
              DashboardInteractions.toolbarSaveClick();
              dashboard.openSaveDrawer({});
            }}
            className={buttonWithExtraMargin}
            tooltip="Save changes"
            key="save"
            size="sm"
            variant={'primary'}
          >
            Save dashboard
          </Button>
        );
      }

      // If we only can save as copy
      if (canSaveAs && !meta.canSave) {
        return (
          <Button
            onClick={() => {
              DashboardInteractions.toolbarSaveClick();
              dashboard.openSaveDrawer({ saveAsCopy: true });
            }}
            className={buttonWithExtraMargin}
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
        <ButtonGroup className={buttonWithExtraMargin} key="save">
          <Button
            onClick={() => {
              DashboardInteractions.toolbarSaveClick();
              dashboard.openSaveDrawer({});
            }}
            tooltip="Save changes"
            size="sm"
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

  return actionElements;
}

interface ToolbarAction {
  group: string;
  condition?: boolean | string;
  render: () => React.ReactNode;
}

function getStyles(theme: GrafanaTheme2) {
  return css({ margin: theme.spacing(0, 0.5) });
}
