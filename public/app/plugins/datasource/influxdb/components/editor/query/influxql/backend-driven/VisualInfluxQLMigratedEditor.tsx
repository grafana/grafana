import React from 'react';

import InfluxDatasource from '../../../../../datasource';
import { InfluxQuery } from '../../../../../types';

type Props = {
  query: InfluxQuery;
  onChange: (query: InfluxQuery) => void;
  onRunQuery: () => void;
  datasource: InfluxDatasource;
};

export const VisualInfluxQLMigratedEditor = (props: Props) => {
  return <div>This is a visual editor :D </div>;
};
