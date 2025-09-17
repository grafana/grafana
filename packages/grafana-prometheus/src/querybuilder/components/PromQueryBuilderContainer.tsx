// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/PromQueryBuilderContainer.tsx
import { useEffect, useState } from 'react';

import { PanelData } from '@grafana/data';

import { PrometheusDatasource } from '../../datasource';
import { PromQuery } from '../../types';
import { buildVisualQueryFromString } from '../parsing';
import { promQueryModeller } from '../shared/modeller_instance';
import { PromVisualQuery } from '../types';

import { PromQueryBuilder } from './PromQueryBuilder';
import { QueryPreview } from './QueryPreview';

interface PromQueryBuilderContainerProps {
  query: PromQuery;
  datasource: PrometheusDatasource;
  onChange: (update: PromQuery) => void;
  onRunQuery: () => void;
  data?: PanelData;
  showExplain: boolean;
}

interface RenderedQuery {
  visQuery?: PromVisualQuery;
  expr: string;
}

/**
 * This component is here just to contain the translation logic between string query and the visual query builder model.
 */
export function PromQueryBuilderContainer(props: PromQueryBuilderContainerProps) {
  const { query, onChange, onRunQuery, datasource, data, showExplain } = props;
  const [rendered, setRendered] = useState<RenderedQuery>({ expr: query.expr });

  useEffect(() => {
    // Only rebuild visual query if expr changes from outside
    if (!rendered.visQuery || rendered.expr !== query.expr) {
      const parseResult = buildVisualQueryFromString(query.expr ?? '');

      setRendered({ expr: query.expr, visQuery: parseResult.query });
    }
  }, [query, rendered]);

  const onVisQueryChange = (visQuery: PromVisualQuery) => {
    const expr = promQueryModeller.renderQuery(visQuery);
    setRendered({ expr, visQuery });
    onChange({ ...props.query, expr });
  };

  if (!rendered.visQuery) {
    return null;
  }

  return (
    <>
      <PromQueryBuilder
        data={data}
        datasource={datasource}
        showExplain={showExplain}
        query={rendered.visQuery}
        onRunQuery={onRunQuery}
        onChange={onVisQueryChange}
      />
      <QueryPreview query={query.expr} />
    </>
  );
}
