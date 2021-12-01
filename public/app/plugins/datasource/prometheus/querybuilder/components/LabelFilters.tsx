import { InlineLabel } from '@grafana/ui';
import React from 'react';
import { PromVisualQuery } from '../types';

export interface Props {
  query: PromVisualQuery;
}

export function LabelFilters({ query }: Props) {
  let segments: React.ReactNode[] = [];

  for (const label of query.labels) {
    if (segments.length > 0) {
      segments.push(
        <InlineLabel width="auto" className="query-keyword">
          AND
        </InlineLabel>
      );
    }

    segments.push(<InlineLabel width="auto">{label.label}</InlineLabel>);
    segments.push(
      <InlineLabel width="auto" className="query-segment-operator">
        {label.op}
      </InlineLabel>
    );
    segments.push(<InlineLabel width="auto">{label.value}</InlineLabel>);
  }

  return <>{segments}</>;
}
