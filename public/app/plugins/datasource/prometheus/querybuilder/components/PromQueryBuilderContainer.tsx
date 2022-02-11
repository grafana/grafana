import { CoreApp, DataFrame } from '@grafana/data';
import React from 'react';

import { PrometheusDatasource } from '../../datasource';
import { PromQuery } from '../../types';
import { buildVisualQueryFromString } from '../parsing';
import { promQueryModeller } from '../PromQueryModeller';
import { PromVisualQuery } from '../types';
import { PromQueryBuilder } from './PromQueryBuilder';
import { PromQueryBuilderOptions } from './PromQueryBuilderOptions';
import { QueryPreview } from './QueryPreview';

export interface Props {
  query: PromQuery;
  datasource: PrometheusDatasource;
  onChange: (update: PromQuery) => void;
  onRunQuery: () => void;
  app?: CoreApp;
  series?: DataFrame[];
}

/**
 * This component is here just to contain the translation logic between string query and the visual query builder model.
 * @param props
 * @constructor
 */
export function PromQueryBuilderContainer(props: Props) {
  const { query, onChange, onRunQuery, datasource, app, series } = props;

  const visQuery = buildVisualQueryFromString(query.expr || '').query;

  const onVisQueryChange = (newVisQuery: PromVisualQuery) => {
    const rendered = promQueryModeller.renderQuery(newVisQuery);
    onChange({ ...query, expr: rendered });
  };

  return (
    <>
      <PromQueryBuilder
        query={visQuery}
        datasource={datasource}
        onChange={onVisQueryChange}
        onRunQuery={onRunQuery}
        series={series}
      />
      {query.editorPreview && <QueryPreview query={query.expr} />}
      <PromQueryBuilderOptions query={query} app={app} onChange={onChange} onRunQuery={onRunQuery} />
    </>
  );
}
