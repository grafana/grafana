import React from 'react';

import { EditorField, EditorRow } from '@grafana/experimental';
import { AutoSizeInput, RadioButtonGroup } from '@grafana/ui';

import { QueryOptionGroup } from '../_importedDependencies/datasources/prometheus/QueryOptionGroup';
import { SearchTableType } from '../dataquery.gen';
import { DEFAULT_LIMIT, DEFAULT_SPSS } from '../datasource';
import { TempoQuery } from '../types';

interface Props {
  onChange: (value: TempoQuery) => void;
  query: Partial<TempoQuery> & TempoQuery;
}

/**
 * Parse a string value to integer. If the conversion fails, for example because we are prosessing an empty value for
 * a field, return a fallback (default) value.
 *
 * @param val the value to be parsed to an integer
 * @param fallback the fallback value
 * @returns the converted value or the fallback value if the conversion fails
 */
const parseIntWithFallback = (val: string, fallback: number) => {
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? fallback : parsed;
};

export const TempoQueryBuilderOptions = React.memo<Props>(({ onChange, query }) => {
  if (!query.hasOwnProperty('limit')) {
    query.limit = DEFAULT_LIMIT;
  }

  if (!query.hasOwnProperty('tableType')) {
    query.tableType = SearchTableType.Traces;
  }

  const onLimitChange = (e: React.FormEvent<HTMLInputElement>) => {
    onChange({ ...query, limit: parseIntWithFallback(e.currentTarget.value, DEFAULT_LIMIT) });
  };
  const onSpssChange = (e: React.FormEvent<HTMLInputElement>) => {
    onChange({ ...query, spss: parseIntWithFallback(e.currentTarget.value, DEFAULT_SPSS) });
  };
  const onTableTypeChange = (val: SearchTableType) => {
    onChange({ ...query, tableType: val });
  };

  const collapsedInfoList = [
    `Limit: ${query.limit || DEFAULT_LIMIT}`,
    `Spans Limit: ${query.spss || DEFAULT_SPSS}`,
    `Table Format: ${query.tableType === SearchTableType.Traces ? 'Traces' : 'Spans'}`,
  ];

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
          <EditorField label="Table Format" tooltip="How the query data should be displayed in the results table">
            <RadioButtonGroup
              options={[
                { label: 'Traces', value: SearchTableType.Traces },
                { label: 'Spans', value: SearchTableType.Spans },
              ]}
              value={query.tableType}
              onChange={onTableTypeChange}
            />
          </EditorField>
        </QueryOptionGroup>
      </EditorRow>
    </>
  );
});

TempoQueryBuilderOptions.displayName = 'TempoQueryBuilderOptions';
