import React from 'react';
import { MetricSelect } from './MetricSelect';
import { PromVisualQuery } from '../types';
import { LabelFilters } from './LabelFilters';
import { Operations } from './Operations';
import EditorRows from 'app/plugins/datasource/cloudwatch/components/ui/EditorRows';
import EditorRow from 'app/plugins/datasource/cloudwatch/components/ui/EditorRow';
import { PrometheusDatasource } from '../../datasource';
import { NestedQueries } from './NestedQueries';

export interface Props {
  query: PromVisualQuery;
  datasource: PrometheusDatasource;
  onChange: (update: PromVisualQuery) => void;
  isNested?: boolean;
}

export const PromQueryBuilderInner = React.memo<Props>(({ datasource, query, onChange }) => {
  return (
    <EditorRows>
      <EditorRow>
        <MetricSelect query={query} onChange={onChange} />
      </EditorRow>
      <EditorRow>
        <LabelFilters query={query} datasource={datasource} onChange={onChange} />
      </EditorRow>
      <EditorRow>
        <Operations query={query} onChange={onChange} />
        {query.nestedQueries && query.nestedQueries.length > 0 && (
          <NestedQueries query={query} datasource={datasource} onChange={onChange} />
        )}
      </EditorRow>
    </EditorRows>
  );
});

PromQueryBuilderInner.displayName = 'PromQueryBuilderInner';
