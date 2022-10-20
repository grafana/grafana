import React, { memo } from 'react';

import { CoreApp } from '@grafana/data';

import { LokiQueryEditorSelector } from './LokiQueryEditor';
import { LokiQueryEditorForAlerting } from './LokiQueryEditorForAlerting';
import { LokiQueryEditorProps } from './types';

export function LokiQueryEditorByApp(props: LokiQueryEditorProps) {
  const { app } = props;

  switch (app) {
    case CoreApp.CloudAlerting:
      return <LokiQueryEditorForAlerting {...props} />;
    default:
      return <LokiQueryEditorSelector {...props} />;
  }
}

export default memo(LokiQueryEditorByApp);

export const testIds = {
  editor: 'loki-editor',
};
