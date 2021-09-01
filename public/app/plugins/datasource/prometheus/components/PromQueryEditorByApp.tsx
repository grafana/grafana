import React, { memo } from 'react';
import { CoreApp } from '@grafana/data';
import { PromQueryEditorProps } from './types';
import { PromQueryEditor } from './PromQueryEditor';
import { PromQueryEditorForAlerting } from './PromQueryEditorForAlerting';

export function PromQueryEditorByApp(props: PromQueryEditorProps) {
  const { app } = props;

  switch (app) {
    case CoreApp.CloudAlerting:
      return <PromQueryEditorForAlerting {...props} />;
    default:
      return <PromQueryEditor {...props} />;
  }
}

export default memo(PromQueryEditorByApp);
