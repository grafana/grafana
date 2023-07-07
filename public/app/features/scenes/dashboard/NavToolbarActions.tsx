import React from 'react';

import { locationService } from '@grafana/runtime';
import { Button } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { NavToolbarSeparator } from 'app/core/components/AppChrome/NavToolbar/NavToolbarSeparator';
import { DashNavButton } from 'app/features/dashboard/components/DashNav/DashNavButton';

import { DashboardScene } from './DashboardScene';

interface Props {
  model: DashboardScene;
}

export const NavToolbarActions = React.memo<Props>(({ model }) => {
  const { actions = [], isEditing, isDirty, uid } = model.useState();
  const toolbarActions = (actions ?? []).map((action) => <action.Component key={action.state.key} model={action} />);

  if (uid) {
    toolbarActions.push(
      <DashNavButton
        key="button-scenes"
        tooltip={'View as dashboard'}
        icon="apps"
        onClick={() => locationService.push(`/d/${uid}`)}
      />
    );
  }

  toolbarActions.push(<NavToolbarSeparator leftActionsSeparator />);

  if (!isEditing) {
    // TODO check permissions
    toolbarActions.push(
      <Button
        onClick={model.onEnterEditMode}
        tooltip="Enter edit mode"
        key="edit"
        variant="primary"
        icon="pen"
        fill="text"
      >
        Edit
      </Button>
    );
  } else {
    // TODO check permissions
    toolbarActions.push(
      <Button onClick={model.onEnterEditMode} tooltip="Save as copy" fill="text" key="save-as">
        Save as
      </Button>
    );
    toolbarActions.push(
      <Button onClick={model.onDiscard} tooltip="Save changes" fill="text" key="discard" variant="destructive">
        Discard
      </Button>
    );
    toolbarActions.push(
      <Button onClick={model.onEnterEditMode} tooltip="Save changes" key="save" disabled={!isDirty}>
        Save
      </Button>
    );
  }

  return <AppChromeUpdate actions={toolbarActions} />;
});

NavToolbarActions.displayName = 'DashboardToolbar';
