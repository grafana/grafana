import React from 'react';
import { QueryBuilderProps } from '../types';
import { QueryBuilderComponentSelector } from '../abstract';
import { GlobalTable, Inline, Join, Lookup, Query, Table, Union } from './';

export const DataSource = (props: QueryBuilderProps) => (
  <QueryBuilderComponentSelector
    {...props}
    label="Datasource"
    components={{
      GlobalTable: GlobalTable,
      Inline: Inline,
      Join: Join,
      Lookup: Lookup,
      Query: Query,
      Table: Table,
      Union: Union,
    }}
  />
);
