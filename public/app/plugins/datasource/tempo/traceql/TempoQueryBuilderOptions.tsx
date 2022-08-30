import React from 'react';

import { AutoSizeInput, EditorField, EditorRow } from '@grafana/ui';
import { QueryOptionGroup } from 'app/plugins/datasource/prometheus/querybuilder/shared/QueryOptionGroup';

import { TempoQuery } from '../datasource';

interface Props {
  onLimitChange: (e: React.FormEvent<HTMLInputElement>) => void;
  query: Partial<TempoQuery> & TempoQuery;
}

export function TempoQueryBuilderOptions(props: Props) {
  return (
    <>
      <EditorRow>
        <QueryOptionGroup title="Options" collapsedInfo={[`Limit: ${props.query.limit || 10}`]}>
          <EditorField label="Limit" tooltip="Maximum number of traces to return.">
            <AutoSizeInput
              className="width-4"
              placeholder="auto"
              type="number"
              min={1}
              defaultValue={10}
              onCommitChange={props.onLimitChange}
              value={props.query.limit}
            />
          </EditorField>
        </QueryOptionGroup>
      </EditorRow>
    </>
  );
}
