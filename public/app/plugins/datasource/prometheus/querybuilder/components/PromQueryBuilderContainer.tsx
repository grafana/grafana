import { PanelData } from '@grafana/data';
import React, { useEffect, useState } from 'react';

import { PrometheusDatasource } from '../../datasource';
import { PromQuery } from '../../types';
import { buildVisualQueryFromString } from '../parsing';
import { promQueryModeller } from '../PromQueryModeller';
import { PromVisualQuery } from '../types';
import { PromQueryBuilder } from './PromQueryBuilder';
import { QueryPreview } from './QueryPreview';

export interface Props {
  query: PromQuery;
  datasource: PrometheusDatasource;
  onChange: (update: PromQuery) => void;
  onRunQuery: () => void;
  data?: PanelData;
}

export interface State {
  visQuery?: PromVisualQuery;
  expr: string;
}

/**
 * This component is here just to contain the translation logic between string query and the visual query builder model.
 */
export function PromQueryBuilderContainer(props: Props) {
  const { query, onChange, onRunQuery, datasource, data } = props;
  const [state, setState] = useState<State>({ expr: query.expr });

  // Only rebuild visual query if expr changes from outside
  useEffect(() => {
    if (!state.visQuery || state.expr !== query.expr) {
      const result = buildVisualQueryFromString(query.expr || '');
      setState({ visQuery: result.query, expr: query.expr });
    }
  }, [query.expr, state.visQuery, state.expr]);

  const onVisQueryChange = (newVisQuery: PromVisualQuery) => {
    const rendered = promQueryModeller.renderQuery(newVisQuery);
    onChange({ ...query, expr: rendered });
    setState({ visQuery: newVisQuery, expr: rendered });
  };

  if (!state.visQuery) {
    return null;
  }

  return (
    <>
      <PromQueryBuilder
        query={state.visQuery}
        datasource={datasource}
        onChange={onVisQueryChange}
        onRunQuery={onRunQuery}
        data={data}
      />
      {query.editorPreview && <QueryPreview query={query.expr} />}
    </>
  );
}
