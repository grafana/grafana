import React from 'react';
import { PromVisualQuery } from '../types';
import { EditorRows, EditorRow, EditorFieldGroup, EditorField } from '@grafana/experimental';
import { promQueryModeller } from '../PromQueryModeller';
import { OperationListExplained } from '../shared/OperationListExplained';

export interface Props {
  query: PromVisualQuery;
  nested?: boolean;
}

export const PromQueryBuilderExplained = React.memo<Props>(({ query, nested }) => {
  return (
    <EditorRows>
      <EditorRow>
        <EditorFieldGroup>
          <EditorField label="Fetch series matching metric name and label filters">
            <div>
              {query.metric} {promQueryModeller.renderLabels(query.labels)}
            </div>
          </EditorField>
        </EditorFieldGroup>
        <OperationListExplained<PromVisualQuery> queryModeller={promQueryModeller} query={query} />
      </EditorRow>
    </EditorRows>
  );
});

PromQueryBuilderExplained.displayName = 'PromQueryBuilderExplained';
