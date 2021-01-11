import React, { FC } from 'react';
import { PanelData } from '@grafana/data';
import { Table } from '@grafana/ui';

interface Props {
  data: PanelData;
  width: number;
  height: number;
}

export const PreviewQueryTab: FC<Props> = ({ data, height, width }) => (
  <Table data={data.series[0]} height={height} width={width} />
);
