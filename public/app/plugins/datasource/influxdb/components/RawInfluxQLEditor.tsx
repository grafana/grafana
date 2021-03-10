import React, { FC, useState, useEffect } from 'react';
import { TextArea, InlineFormLabel, Input, Select, HorizontalGroup } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { ResultFormat, InfluxQuery } from '../types';

const RESULT_FORMATS: Array<SelectableValue<ResultFormat>> = [
  { label: 'Time series', value: 'time_series' },
  { label: 'Table', value: 'table' },
  { label: 'Logs', value: 'logs' },
];

const DEFAULT_RESULT_FORMAT: ResultFormat = 'time_series';

type Props = {
  query: InfluxQuery;
  onQueryChange: (query: InfluxQuery) => void;
  onRunQuery: () => void;
};

// we handle 3 fields: "query", "alias", "resultFormat"
// "resultFormat" changes are applied immediately
// "query" and "alias" changes only happen on onblur
export const RawInfluxQLEditor: FC<Props> = ({ query, onQueryChange, onRunQuery }) => {
  const [currentQuery, setCurrentQuery] = useState(query.query);
  const [currentAlias, setCurrentAlias] = useState(query.alias);

  useEffect(() => {
    // if the value changes from the outside, we accept it
    if (currentQuery !== query.query) {
      setCurrentQuery(query.query);
    }
  }, [query.query]);

  useEffect(() => {
    // if the value changes from the outside, we accept it
    if (currentAlias !== query.alias) {
      setCurrentAlias(query.alias);
    }
  }, [query.alias]);

  const applyDelayedChangesAndRunQuery = () => {
    onQueryChange({
      ...query,
      query: currentQuery,
      alias: currentAlias,
    });
    onRunQuery();
  };

  return (
    <div>
      <TextArea
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
        <InlineFormLabel>Format as</InlineFormLabel>
        <Select
          onChange={(e) => {
            onQueryChange({ ...query, resultFormat: e.value });
            onRunQuery();
          }}
          value={query.resultFormat ?? DEFAULT_RESULT_FORMAT}
          options={RESULT_FORMATS}
        />
        <InlineFormLabel>Alias by</InlineFormLabel>
        <Input
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
