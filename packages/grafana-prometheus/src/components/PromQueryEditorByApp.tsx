import React, { memo } from 'react';

import { CoreApp } from '@grafana/data';

import { PromQueryEditorSelector } from '../querybuilder/components/PromQueryEditorSelector';

import { PromQueryEditorForAlerting } from './PromQueryEditorForAlerting';
import { PromQueryEditorProps } from './types';

function PromQueryEditorByAppBase(props: PromQueryEditorProps) {
  const { app } = props;

  switch (app) {
    case CoreApp.CloudAlerting:
      return <PromQueryEditorForAlerting {...props} />;
    default:
      return <PromQueryEditorSelector {...props} />;
  }
}

export const PromQueryEditorByApp = memo(PromQueryEditorByAppBase);
