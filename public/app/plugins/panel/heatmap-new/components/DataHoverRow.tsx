import React from 'react';
import { DataFrame } from '@grafana/data';

import { DataHoverView } from './DataHoverView';

type Props = {
  data: DataFrame;
  rowIndex: number;
};

export const DataHoverRow = ({ data, rowIndex }: Props) => {
  return <DataHoverView data={data} rowIndex={rowIndex} />;
};
