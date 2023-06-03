import React from 'react';

import InfluxDatasource from '../../../../../datasource';
import { InfluxQuery } from '../../../../../types';

type Props = {
  query: InfluxQuery;
  onChange: (query: InfluxQuery) => void;
  onRunQuery: () => void;
  datasource: InfluxDatasource;
};

export const RawInfluxQLMigratedEditor = (props: Props) => {
  return <div>This is raw editor :) </div>;
};
