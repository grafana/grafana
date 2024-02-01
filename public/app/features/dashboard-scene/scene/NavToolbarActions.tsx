import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Box, Button, Icon, ToolbarButton, useStyles2 } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { NavToolbarSeparator } from 'app/core/components/AppChrome/NavToolbar/NavToolbarSeparator';
import { t } from 'app/core/internationalization';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { ShareModal } from '../sharing/ShareModal';
import { DashboardInteractions } from '../utils/interactions';
import { dynamicDashNavActions } from '../utils/registerDynamicDashNavAction';

import { DashboardScene } from './DashboardScene';

interface Props {
  dashboard: DashboardScene;
}

export const NavToolbarActions = React.memo<Props>(({ dashboard }) => {
  const { actions = [], isEditing, viewPanelScene, uid, meta, editview } = dashboard.useState();
  const toolbarActions = (actions ?? []).map((action) => <action.Component key={action.state.key} model={action} />);
  const rightToolbarActions: JSX.Element[] = [];
  const _legacyDashboardModel = getDashboardSrv().getCurrent();
  const buttonWithExtraMargin = useStyles2(getStyles);

  toolbarActions.push(<NavToolbarSeparator leftActionsSeparator key="separator" />);

  if (uid && !editview) {
    if (meta.canStar) {
      let desc = meta.isStarred
        ? t('dashboard.toolbar.unmark-favorite', 'Unmark as favorite')
        : t('dashboard.toolbar.mark-favorite', 'Mark as favorite');

      toolbarActions.push(
        <ToolbarButton
          tooltip={desc}
          key="star-button"
          icon={
            <Icon name={meta.isStarred ? 'favorite' : 'star'} size="lg" type={meta.isStarred ? 'mono' : 'default'} />
          }
          onClick={() => {
            DashboardInteractions.toolbarFavoritesClick();
            dashboard.onStarDashboard();
          }}
        />
      );
    }

    toolbarActions.push(
      <ToolbarButton
        key="view-in-old-dashboard-button"
        tooltip={'Switch to old dashboard page'}
        icon="apps"
        onClick={() => locationService.push(`/d/${uid}`)}
      />
    );

    if (dynamicDashNavActions.left.length > 0) {
      dynamicDashNavActions.left.map((action, index) => {
        const Component = action.component;
        const element = <Component dashboard={_legacyDashboardModel} />;
        typeof action.index === 'number'
          ? toolbarActions.splice(action.index, 0, element)
          : toolbarActions.push(element);
      });
    }
  }

  if (dynamicDashNavActions.right.length > 0 && !editview) {
    dynamicDashNavActions.right.map((action, index) => {
      const Component = action.component;
      const element = <Component dashboard={_legacyDashboardModel} key={`button-custom-${index}`} />;
      typeof action.index === 'number'
        ? rightToolbarActions.splice(action.index, 0, element)
        : rightToolbarActions.push(element);
    });

    toolbarActions.push(...rightToolbarActions);
  }

  // Line between icon actions above and text actions below
  if (toolbarActions.length > 0) {
    toolbarActions.push(<NavToolbarSeparator key="dynamicActionsSeperator" />);
  }

  if (viewPanelScene) {
    toolbarActions.push(
      <Button
        onClick={() => {
          locationService.partial({ viewPanel: null });
        }}
        tooltip=""
        key="back"
        variant="secondary"
        size="sm"
        icon="arrow-left"
      >
        Back to dashboard
      </Button>
    );
  }

  if (editview) {
    toolbarActions.push(
      <Button
        onClick={() => {
          locationService.partial({ editview: null });
        }}
        tooltip=""
        key="back"
        variant="secondary"
        size="sm"
        icon="arrow-left"
      >
        Back to dashboard
      </Button>
    );
  }

  if (!isEditing && dashboard.canEditDashboard() && !viewPanelScene) {
    toolbarActions.push(
      <Button
        onClick={() => {
          dashboard.onEnterEditMode();
        }}
        tooltip="Enter edit mode"
        key="edit"
        className={buttonWithExtraMargin}
        variant="primary"
        //        fill="text"
        size="sm"
      >
        Edit
      </Button>
    );
  }

  if (isEditing && dashboard.canEditDashboard() && !viewPanelScene) {
    if (!editview) {
      toolbarActions.push(
        <Button
          onClick={() => {
            dashboard.onOpenSettings();
          }}
          tooltip="Dashboard settings"
          fill="text"
          size="sm"
          key="settings"
        >
          Settings
        </Button>
      );
    }

    if (!dashboard.state.meta.isNew) {
      toolbarActions.push(
        <Button
          onClick={() => {
            dashboard.openSaveDrawer({ saveAsCopy: true });
          }}
          size="sm"
          tooltip="Save as copy"
          fill="text"
          key="save-as"
        >
          Save as
        </Button>
      );
    }

    if (dashboard.canDiscard()) {
      toolbarActions.push(
        <Button onClick={dashboard.onDiscard} tooltip="Will discard all changes" fill="text" size="sm" key="discard">
          Switch to view mode
        </Button>
      );
    }

    toolbarActions.push(
      <Button
        onClick={() => {
          DashboardInteractions.toolbarSaveClick();
          dashboard.openSaveDrawer({});
        }}
        tooltip="Save changes"
        key="save"
        className={buttonWithExtraMargin}
        size="sm"
        //        variant={isDirty ? 'primary' : 'secondary'}
        variant={'primary'}
      >
        Save
      </Button>
    );
  }

  if (uid) {
    toolbarActions.push(
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
    );
  }

  return <AppChromeUpdate actions={toolbarActions} />;
});

NavToolbarActions.displayName = 'NavToolbarActions';

export function ButtonWithExtraSpacing({ children }: { children: React.ReactNode }) {
  return (
    <Box paddingLeft={0.5} paddingRight={0.5}>
      {children}
    </Box>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return css({ margin: theme.spacing(0, 0.5) });
}
