import React from 'react';
import { LokiDatasource } from '../../datasource';
import { LokiQuery } from '../../types';
import { buildVisualQueryFromString } from '../parsing';
import { lokiQueryModeller } from '../LokiQueryModeller';
import { LokiQueryBuilder } from './LokiQueryBuilder';
import { QueryPreview } from './QueryPreview';
import { LokiVisualQuery } from '../types';

export interface Props {
  query: LokiQuery;
  datasource: LokiDatasource;
  onChange: (update: LokiQuery) => void;
  onRunQuery: () => void;
}

/**
 * This component is here just to contain the translation logic between string query and the visual query builder model.
 * @param props
 * @constructor
 */
export function LokiQueryBuilderContainer(props: Props) {
  const { query, onChange, onRunQuery, datasource } = props;

  const visQuery = buildVisualQueryFromString(query.expr || '').query;

  const onVisQueryChange = (newVisQuery: LokiVisualQuery) => {
    const rendered = lokiQueryModeller.renderQuery(newVisQuery);
    onChange({ ...query, expr: rendered });
  };

  return (
    <>
      <LokiQueryBuilder query={visQuery} datasource={datasource} onChange={onVisQueryChange} onRunQuery={onRunQuery} />
      <QueryPreview query={query.expr} />
    </>
  );
}
