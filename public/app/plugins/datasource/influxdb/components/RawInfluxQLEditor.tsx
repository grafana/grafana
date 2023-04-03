import React from 'react';

import { TextArea, InlineFormLabel, Input, Select, HorizontalGroup } from '@grafana/ui';

import { InfluxQuery } from '../types';

import { RESULT_FORMATS, DEFAULT_RESULT_FORMAT } from './constants';
import { useShadowedState } from './useShadowedState';
import { useUniqueId } from './useUniqueId';

type Props = {
  query: InfluxQuery;
  onChange: (query: InfluxQuery) => void;
  onRunQuery: () => void;
};

// we handle 3 fields: "query", "alias", "resultFormat"
// "resultFormat" changes are applied immediately
// "query" and "alias" changes only happen on onblur
export const RawInfluxQLEditor = ({ query, onChange, onRunQuery }: Props): JSX.Element => {
  const [currentQuery, setCurrentQuery] = useShadowedState(query.expr);
  const [currentAlias, setCurrentAlias] = useShadowedState(query.alias);
  const aliasElementId = useUniqueId();
  const selectElementId = useUniqueId();

  const resultFormat = query.resultFormat ?? DEFAULT_RESULT_FORMAT;

  const applyDelayedChangesAndRunQuery = () => {
    onChange({
      ...query,
      expr: currentQuery,
      alias: currentAlias,
      resultFormat,
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
          value={resultFormat}
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
