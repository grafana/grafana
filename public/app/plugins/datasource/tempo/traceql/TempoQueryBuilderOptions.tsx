import React from 'react';

import { AutoSizeInput, EditorField, EditorRow } from '@grafana/ui';
import { QueryOptionGroup } from 'app/plugins/datasource/prometheus/querybuilder/shared/QueryOptionGroup';

import { TempoQuery } from '../datasource';

interface Props {
  onChange: (value: TempoQuery) => void;
  query: Partial<TempoQuery> & TempoQuery;
}

export const TempoQueryBuilderOptions = React.memo<Props>(({ onChange, query }) => {
  const onLimitChange = (e: React.FormEvent<HTMLInputElement>) => {
    onChange({ ...query, limit: parseInt(e.currentTarget.value, 10) });
  };

  return (
    <>
      <EditorRow>
        <QueryOptionGroup title="Options" collapsedInfo={[`Limit: ${query.limit || 10}`]}>
          <EditorField label="Limit" tooltip="Maximum number of traces to return.">
            <AutoSizeInput
              className="width-4"
              placeholder="auto"
              type="number"
              min={1}
              defaultValue={10}
              onCommitChange={onLimitChange}
              value={query.limit}
            />
          </EditorField>
        </QueryOptionGroup>
      </EditorRow>
    </>
  );
});

TempoQueryBuilderOptions.displayName = 'TempoQueryBuilderOptions';
