import React from 'react';
import { PanelProps } from '@grafana/ui';
import { Options } from './types';

interface LogsPanelProps extends PanelProps<Options> {}

export const LogsPanel: React.FunctionComponent<LogsPanelProps> = ({ data }) => {
  if (!data) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  return (
    <div className="panel-empty">
      <p>Yes Data found in response!</p>
    </div>
  );
};
