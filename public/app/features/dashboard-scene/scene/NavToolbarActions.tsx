import React from 'react';

import { locationService } from '@grafana/runtime';
import { Button } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { NavToolbarSeparator } from 'app/core/components/AppChrome/NavToolbar/NavToolbarSeparator';
import { t } from 'app/core/internationalization';
import { DashNavButton } from 'app/features/dashboard/components/DashNav/DashNavButton';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { ShareModal } from '../sharing/ShareModal';
import { DashboardInteractions } from '../utils/interactions';
import { dynamicDashNavActions } from '../utils/registerDynamicDashNavAction';

import { DashboardScene } from './DashboardScene';

interface Props {
  dashboard: DashboardScene;
}

export const NavToolbarActions = React.memo<Props>(({ dashboard }) => {
  const { actions = [], isEditing, viewPanelScene, isDirty, uid, meta, editview } = dashboard.useState();
  const toolbarActions = (actions ?? []).map((action) => <action.Component key={action.state.key} model={action} />);
  const rightToolbarActions: JSX.Element[] = [];
  const _legacyDashboardModel = getDashboardSrv().getCurrent();

  if (uid && !editview) {
    if (meta.canStar) {
      let desc = meta.isStarred
        ? t('dashboard.toolbar.unmark-favorite', 'Unmark as favorite')
        : t('dashboard.toolbar.mark-favorite', 'Mark as favorite');

      toolbarActions.push(
        <DashNavButton
          key="star-dashboard-button"
          tooltip={desc}
          icon={meta.isStarred ? 'favorite' : 'star'}
          iconType={meta.isStarred ? 'mono' : 'default'}
          iconSize="lg"
          onClick={() => {
            DashboardInteractions.toolbarFavoritesClick();
            dashboard.onStarDashboard();
          }}
        />
      );
    }
    toolbarActions.push(
      <DashNavButton
        key="share-dashboard-button"
        tooltip={t('dashboard.toolbar.share', 'Share dashboard')}
        icon="share-alt"
        iconSize="lg"
        onClick={() => {
          DashboardInteractions.toolbarShareClick();
          dashboard.showModal(new ShareModal({ dashboardRef: dashboard.getRef() }));
        }}
      />
    );

    toolbarActions.push(
      <DashNavButton
        key="view-in-old-dashboard-button"
        tooltip={'View as dashboard'}
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

  toolbarActions.push(<NavToolbarSeparator leftActionsSeparator key="separator" />);

  if (dynamicDashNavActions.right.length > 0) {
    dynamicDashNavActions.right.map((action, index) => {
      const Component = action.component;
      const element = <Component dashboard={_legacyDashboardModel} key={`button-custom-${index}`} />;
      typeof action.index === 'number'
        ? rightToolbarActions.splice(action.index, 0, element)
        : rightToolbarActions.push(element);
    });

    toolbarActions.push(...rightToolbarActions);
  }

  if (viewPanelScene) {
    toolbarActions.push(
      <Button
        onClick={() => {
          locationService.partial({ viewPanel: null });
        }}
        tooltip=""
        key="back"
        variant="primary"
        fill="text"
      >
        Back to dashboard
      </Button>
    );

    return <AppChromeUpdate actions={toolbarActions} />;
  }

  if (!isEditing) {
    if (dashboard.canEditDashboard()) {
      toolbarActions.push(
        <Button
          onClick={() => {
            dashboard.onEnterEditMode();
          }}
          tooltip="Enter edit mode"
          key="edit"
          variant="primary"
          icon="pen"
          fill="text"
          size="sm"
        >
          Edit
        </Button>
      );
    }
  } else {
    if (dashboard.canEditDashboard()) {
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
      toolbarActions.push(
        <Button
          onClick={() => {
            dashboard.onDiscard();
          }}
          tooltip="Discard changes"
          fill="text"
          size="sm"
          key="discard"
          variant="destructive"
        >
          Discard
        </Button>
      );
      toolbarActions.push(
        <Button
          onClick={() => {
            DashboardInteractions.toolbarSaveClick();
            dashboard.openSaveDrawer({});
          }}
          tooltip="Save changes"
          key="save"
          size="sm"
          variant={isDirty ? 'primary' : 'secondary'}
        >
          Save
        </Button>
      );
    }
  }

  return <AppChromeUpdate actions={toolbarActions} />;
});

NavToolbarActions.displayName = 'NavToolbarActions';
