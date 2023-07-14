import React from 'react';

import { EditorField, EditorRow } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { AutoSizeInput, Switch } from '@grafana/ui';
import { QueryOptionGroup } from 'app/plugins/datasource/prometheus/querybuilder/shared/QueryOptionGroup';

import { DEFAULT_LIMIT } from '../datasource';
import { TempoQuery } from '../types';

interface Props {
  onChange: (value: TempoQuery) => void;
  query: Partial<TempoQuery> & TempoQuery;
}

export const TempoQueryBuilderOptions = React.memo<Props>(({ onChange, query }) => {
  if (!query.hasOwnProperty('limit')) {
    query.limit = DEFAULT_LIMIT;
  }

  if (!query.hasOwnProperty('streaming')) {
    query.streaming = true;
  }

  const onLimitChange = (e: React.FormEvent<HTMLInputElement>) => {
    onChange({ ...query, limit: parseInt(e.currentTarget.value, 10) });
  };

  const onStreamingChange = (e: React.FormEvent<HTMLInputElement>) => {
    onChange({ ...query, streaming: e.currentTarget.checked });
  };

  const collapsedInfoList = [`Limit: ${query.limit || DEFAULT_LIMIT}`];
  if (!config.featureToggles.disableTraceQLStreaming) {
    collapsedInfoList.push(`Streaming: ${query.streaming ? 'Yes' : 'No'}`);
  }

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
          {!config.featureToggles.disableTraceQLStreaming && (
            <EditorField label="Stream response" tooltip="Stream the query response to receive partial results sooner">
              <Switch value={query.streaming || false} onChange={onStreamingChange} />
            </EditorField>
          )}
        </QueryOptionGroup>
      </EditorRow>
    </>
  );
});

TempoQueryBuilderOptions.displayName = 'TempoQueryBuilderOptions';
