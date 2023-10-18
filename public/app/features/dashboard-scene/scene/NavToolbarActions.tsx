import React from 'react';

import { locationService } from '@grafana/runtime';
import { Button } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { NavToolbarSeparator } from 'app/core/components/AppChrome/NavToolbar/NavToolbarSeparator';
import { t } from 'app/core/internationalization';
import { DashNavButton } from 'app/features/dashboard/components/DashNav/DashNavButton';

import { ShareModal } from '../sharing/ShareModal';

import { DashboardScene } from './DashboardScene';

interface Props {
  dashboard: DashboardScene;
}

export const NavToolbarActions = React.memo<Props>(({ dashboard }) => {
  const { actions = [], isEditing, viewPanelKey, isDirty, uid, meta } = dashboard.useState();
  const toolbarActions = (actions ?? []).map((action) => <action.Component key={action.state.key} model={action} />);

  if (uid) {
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
  }

  toolbarActions.push(<NavToolbarSeparator leftActionsSeparator key="separator" />);

  if (viewPanelKey) {
    toolbarActions.push(
      <Button
        onClick={() => locationService.partial({ viewPanel: null })}
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
          onClick={dashboard.onEnterEditMode}
          tooltip="Enter edit mode"
          key="edit"
          variant="primary"
          icon="pen"
          fill="text"
        >
          Edit
        </Button>
      );
    }
  } else {
    if (dashboard.canEditDashboard()) {
      toolbarActions.push(
        <Button onClick={dashboard.onSave} tooltip="Save as copy" fill="text" key="save-as">
          Save as
        </Button>
      );
      toolbarActions.push(
        <Button onClick={dashboard.onDiscard} tooltip="Save changes" fill="text" key="discard" variant="destructive">
          Discard
        </Button>
      );
      toolbarActions.push(
        <Button onClick={dashboard.onSave} tooltip="Save changes" key="save" disabled={!isDirty}>
          Save
        </Button>
      );
    }
  }

  return <AppChromeUpdate actions={toolbarActions} />;
});

NavToolbarActions.displayName = 'NavToolbarActions';
