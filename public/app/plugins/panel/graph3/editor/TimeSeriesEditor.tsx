import React, { FC } from 'react';
import { StandardEditorProps } from '@grafana/data';

import { GraphOptions } from '../types';

export const TimeSeriesEditor: FC<StandardEditorProps<string, any, GraphOptions>> = ({ value, onChange, context }) => {
  return <p>Use the "Field" and "Override" tabs to configure individual series behavior</p>;
};
