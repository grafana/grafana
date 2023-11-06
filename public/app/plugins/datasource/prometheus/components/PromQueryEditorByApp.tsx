import React, { memo } from 'react';

import { CoreApp } from '@grafana/data';
import { importMe } from '@grafana/prometheus';

import { PromQueryEditorSelector } from '../querybuilder/components/PromQueryEditorSelector';

import { PromQueryEditorForAlerting } from './PromQueryEditorForAlerting';
import { PromQueryEditorProps } from './types';

export function PromQueryEditorByApp(props: PromQueryEditorProps) {
  const { app } = props;
  importMe();
  switch (app) {
    case CoreApp.CloudAlerting:
      return <PromQueryEditorForAlerting {...props} />;
    default:
      return <PromQueryEditorSelector {...props} />;
  }
}

export default memo(PromQueryEditorByApp);
