import React from 'react';
import { LokiVisualQuery } from '../types';
import { EditorField, EditorFieldGroup } from '@grafana/experimental';
import { Input } from '@grafana/ui';

export interface Props {
  query: LokiVisualQuery;
  onChange: (update: LokiVisualQuery) => void;
  onRunQuery: () => void;
}

export const LokiSearchInput = React.memo<Props>(({ query, onChange, onRunQuery }) => {
  return (
    <EditorFieldGroup>
      <EditorField label="Search">
        <Input
          placeholder="Search your logs"
          width={70}
          defaultValue={query.search}
          onBlur={(evt) => {
            onChange({ ...query, search: evt.currentTarget.value });
          }}
          onKeyDown={(evt) => {
            if (evt.key === 'Enter') {
              onChange({ ...query, search: evt.currentTarget.value });
              onRunQuery();
            }
          }}
        />
      </EditorField>
    </EditorFieldGroup>
  );
});

LokiSearchInput.displayName = 'LokiSearchInput';
