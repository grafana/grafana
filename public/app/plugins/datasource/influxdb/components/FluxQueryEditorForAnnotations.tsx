import React, { FC } from 'react';
import { InfluxQuery } from '../types';
import InfluxDatasource from '../datasource';
import { FluxQueryEditor } from './FluxQueryEditor';

// when used for annotations, the typescript types require the editor to have a datasource attribute,
// and to have an onChange attribute, not onQueryChange.
type Props = {
  query: InfluxQuery;
  onChange: (query: InfluxQuery) => void;
  onRunQuery: () => void;
  datasource: InfluxDatasource;
};

export const FluxQueryEditorForAnnotations: FC<Props> = ({ query, onChange, onRunQuery }) => (
  <FluxQueryEditor query={query} onQueryChange={onChange} onRunQuery={onRunQuery} />
);
