import React from 'react';

import { EditorField, EditorRow } from '@grafana/experimental';
import { AutoSizeInput } from '@grafana/ui';
import { QueryOptionGroup } from 'app/plugins/datasource/prometheus/querybuilder/shared/QueryOptionGroup';

import { DEFAULT_LIMIT, DEFAULT_SPSS } from '../datasource';
import { TempoQuery } from '../types';

interface Props {
  onChange: (value: TempoQuery) => void;
  query: Partial<TempoQuery> & TempoQuery;
}

export const TempoQueryBuilderOptions = React.memo<Props>(({ onChange, query }) => {
  if (!query.hasOwnProperty('limit')) {
    query.limit = DEFAULT_LIMIT;
  }

  const onLimitChange = (e: React.FormEvent<HTMLInputElement>) => {
    onChange({ ...query, limit: parseInt(e.currentTarget.value, 10) });
  };
  const onSpssChange = (e: React.FormEvent<HTMLInputElement>) => {
    onChange({ ...query, spss: parseInt(e.currentTarget.value, 10) });
  };

  const collapsedInfoList = [`Limit: ${query.limit || DEFAULT_LIMIT}`, `Spans Limit: ${query.spss || DEFAULT_SPSS}`];

  return (
    <>
      <EditorRow>
        <QueryOptionGroup title="Options" collapsedInfo={collapsedInfoList}>
          <EditorField label="Limit" tooltip="Maximum number of traces to return.">
            <AutoSizeInput
              className="width-4"
              placeholder="auto"
              type="number"
              min={1}
              defaultValue={query.limit || DEFAULT_LIMIT}
              onCommitChange={onLimitChange}
              value={query.limit}
            />
          </EditorField>
          <EditorField label="Span Limit" tooltip="Maximum number of spans to return for each span set.">
            <AutoSizeInput
              className="width-4"
              placeholder="auto"
              type="number"
              min={1}
              defaultValue={query.spss || DEFAULT_SPSS}
              onCommitChange={onSpssChange}
              value={query.spss}
            />
          </EditorField>
        </QueryOptionGroup>
      </EditorRow>
    </>
  );
});

TempoQueryBuilderOptions.displayName = 'TempoQueryBuilderOptions';
