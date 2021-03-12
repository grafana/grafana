import React, { FC } from 'react';
import { TextArea, InlineFormLabel, Input, Select, HorizontalGroup } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { ResultFormat, InfluxQuery } from '../types';
import { useShadowedState } from './useShadowedState';
import { useUniqueId } from './useUniqueId';

const RESULT_FORMATS: Array<SelectableValue<ResultFormat>> = [
  { label: 'Time series', value: 'time_series' },
  { label: 'Table', value: 'table' },
  { label: 'Logs', value: 'logs' },
];

const DEFAULT_RESULT_FORMAT: ResultFormat = 'time_series';

type Props = {
  query: InfluxQuery;
  onChange: (query: InfluxQuery) => void;
  onRunQuery: () => void;
};

// we handle 3 fields: "query", "alias", "resultFormat"
// "resultFormat" changes are applied immediately
// "query" and "alias" changes only happen on onblur
export const RawInfluxQLEditor: FC<Props> = ({ query, onChange, onRunQuery }) => {
  const [currentQuery, setCurrentQuery] = useShadowedState(query.query);
  const [currentAlias, setCurrentAlias] = useShadowedState(query.alias);
  const aliasElementId = useUniqueId();
  const selectElementId = useUniqueId();

  const applyDelayedChangesAndRunQuery = () => {
    onChange({
      ...query,
      query: currentQuery,
      alias: currentAlias,
    });
    onRunQuery();
  };

  return (
    <div>
      <TextArea
        aria-label="query"
        rows={3}
        spellCheck={false}
        placeholder="InfluxDB Query"
        onBlur={applyDelayedChangesAndRunQuery}
        onChange={(e) => {
          setCurrentQuery(e.currentTarget.value);
        }}
        value={currentQuery ?? ''}
      />
      <HorizontalGroup>
        <InlineFormLabel htmlFor={selectElementId}>Format as</InlineFormLabel>
        <Select
          inputId={selectElementId}
          onChange={(v) => {
            onChange({ ...query, resultFormat: v.value });
            onRunQuery();
          }}
          value={query.resultFormat ?? DEFAULT_RESULT_FORMAT}
          options={RESULT_FORMATS}
        />
        <InlineFormLabel htmlFor={aliasElementId}>Alias by</InlineFormLabel>
        <Input
          id={aliasElementId}
          type="text"
          spellCheck={false}
          placeholder="Naming pattern"
          onBlur={applyDelayedChangesAndRunQuery}
          onChange={(e) => {
            setCurrentAlias(e.currentTarget.value);
          }}
          value={currentAlias ?? ''}
        />
      </HorizontalGroup>
    </div>
  );
};
