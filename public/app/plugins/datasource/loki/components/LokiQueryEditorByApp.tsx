import React, { memo } from 'react';

import { CoreApp } from '@grafana/data';
import { config } from '@grafana/runtime';

import { LokiQueryEditorSelector } from '../querybuilder/components/LokiQueryEditorSelector';

import { LokiExploreQueryEditor } from './LokiExploreQueryEditor';
import { LokiQueryEditor } from './LokiQueryEditor';
import { LokiQueryEditorForAlerting } from './LokiQueryEditorForAlerting';
import { LokiQueryEditorProps } from './types';

export function LokiQueryEditorByApp(props: LokiQueryEditorProps) {
  const { app } = props;

  switch (app) {
    case CoreApp.CloudAlerting:
      return <LokiQueryEditorForAlerting {...props} />;
    case CoreApp.Explore:
      if (config.featureToggles.lokiQueryBuilder) {
        return <LokiQueryEditorSelector {...props} />;
      }
      return <LokiExploreQueryEditor {...props} />;
    default:
      if (config.featureToggles.lokiQueryBuilder) {
        return <LokiQueryEditorSelector {...props} />;
      }
      return <LokiQueryEditor {...props} />;
  }
}

export default memo(LokiQueryEditorByApp);
