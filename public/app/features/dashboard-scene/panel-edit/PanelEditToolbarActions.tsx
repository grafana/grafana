import React from 'react';

import { Button } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { NavToolbarSeparator } from 'app/core/components/AppChrome/NavToolbar/NavToolbarSeparator';

import { PanelEditor } from './PanelEditor';

interface Props {
  editor: PanelEditor;
}

export const NavToolbarActions = React.memo<Props>(({ editor }) => {
  //const { isDirty } = editor.useState();

  const toolbarActions: React.ReactNode[] = [];

  toolbarActions.push(<NavToolbarSeparator leftActionsSeparator key="separator" />);

  toolbarActions.push(
    <Button
      onClick={editor.onDiscard}
      tooltip=""
      key="panel-edit-discard"
      variant="destructive"
      fill="outline"
      size="sm"
    >
      Discard
    </Button>
  );

  toolbarActions.push(
    <Button onClick={editor.onApply} tooltip="" key="panel-edit-apply" variant="primary" size="sm">
      Apply
    </Button>
  );

  return <AppChromeUpdate actions={toolbarActions} />;
});

NavToolbarActions.displayName = 'NavToolbarActions';
