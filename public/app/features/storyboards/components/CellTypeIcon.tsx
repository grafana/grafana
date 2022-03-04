import React from 'react';
import { Icon } from '@grafana/ui';

interface Props {
  type: string;
}

export const CellTypeIcon = ({ type }: Props) => {
  switch (type) {
    case 'markdown':
      return <Icon name="list-ul" />;
    case 'python':
      return <Icon name="brackets-curly" />;
    case 'query':
      return <Icon name="database" />;
    case 'csv':
      return <Icon name="table" />;
    case 'timeseries-plot':
      return <Icon name="chart-line" />;
    default:
      return <Icon name="grafana" />;
  }
};
