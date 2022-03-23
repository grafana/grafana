import React, { FC } from 'react';
import { StandardEditorProps } from '@grafana/data';

import { XYChartOptions, ScatterFieldConfig } from './models.gen';

export const ExplicitEditor: FC<StandardEditorProps<ScatterFieldConfig[], any, XYChartOptions>> = ({
  value,
  onChange,
  context,
}) => {
  return <div>TODO: explicit scatter config</div>;
};
