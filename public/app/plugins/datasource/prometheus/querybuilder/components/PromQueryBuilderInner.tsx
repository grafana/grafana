import React from 'react';
import { MetricSelect } from './MetricSelect';
import { PromVisualQuery } from '../types';
import { LabelFilters } from './LabelFilters';
import { OperationList } from './OperationList';
import EditorRows from 'app/plugins/datasource/cloudwatch/components/ui/EditorRows';
import EditorRow from 'app/plugins/datasource/cloudwatch/components/ui/EditorRow';
import { PrometheusDatasource } from '../../datasource';
import { BinaryQueryList } from './BinaryQueryList';

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
        <OperationList query={query} onChange={onChange} />
        {query.binaryQueries && query.binaryQueries.length > 0 && (
          <BinaryQueryList query={query} datasource={datasource} onChange={onChange} />
        )}
      </EditorRow>
    </EditorRows>
  );
});

PromQueryBuilderInner.displayName = 'PromQueryBuilderInner';
