// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/PromQueryBuilder.tsx
import { memo } from 'react';

import { PanelData } from '@grafana/data';

import { PrometheusDatasource } from '../../datasource';
import { PromVisualQuery } from '../types';

import { NestedQueryList } from './NestedQueryList';
import { QueryBuilderContent } from './QueryBuilderContent';

interface PromQueryBuilderProps {
  query: PromVisualQuery;
  datasource: PrometheusDatasource;
  onChange: (update: PromVisualQuery) => void;
  onRunQuery: () => void;
  data?: PanelData;
  showExplain: boolean;
}

export const PromQueryBuilder = memo<PromQueryBuilderProps>((props) => {
  const { query, datasource, onChange, onRunQuery, showExplain } = props;

  return (
    <>
      <QueryBuilderContent {...props} />
      {query.binaryQueries && query.binaryQueries.length > 0 && (
        <NestedQueryList
          query={query}
          datasource={datasource}
          onChange={onChange}
          onRunQuery={onRunQuery}
          showExplain={showExplain}
        />
      )}
    </>
  );
});

PromQueryBuilder.displayName = 'PromQueryBuilder';
