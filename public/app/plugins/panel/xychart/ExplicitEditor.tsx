import React, { FC } from 'react';
import { StandardEditorProps } from '@grafana/data';

import { XYChartOptions, ScatterSeries } from './models.gen';

export const ExplicitEditor: FC<StandardEditorProps<ScatterSeries[], any, XYChartOptions>> = ({
  value,
  onChange,
  context,
}) => {
  return <div>TODO: explicit scatter config</div>;
};
