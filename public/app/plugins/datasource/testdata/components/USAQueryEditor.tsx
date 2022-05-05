import React from 'react';

import { SelectableValue } from '@grafana/data';
import { InlineFieldRow, InlineField, Select, MultiSelect, Input } from '@grafana/ui';

import { USAQuery } from '../types';

export interface Props {
  onChange: (value: USAQuery) => void;
  query: USAQuery;
}

export function USAQueryEditor({ query, onChange }: Props) {
  return (
    <>
      <InlineFieldRow>
        <InlineField labelWidth={14} label="Mode">
          <Select
            options={usaQueryModes}
            onChange={(v) => {
              onChange({ ...query, mode: v.value });
            }}
            width={32}
            value={usaQueryModes.find((ep) => ep.value === query.mode)}
          />
        </InlineField>
        <InlineField label="Period">
          <Input
            value={query.period}
            placeholder={'30m'}
            onChange={(v) => {
              onChange({ ...query, period: v.currentTarget.value });
            }}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField labelWidth={14} label="Fields">
          <MultiSelect
            options={fieldNames}
            onChange={(vals: SelectableValue[]) => {
              onChange({ ...query, fields: vals.map((v) => v.value) });
            }}
            width={32}
            placeholder="all"
            value={query.fields}
          />
        </InlineField>
        <InlineField label="States" grow>
          <MultiSelect
            options={stateNames}
            onChange={(vals: SelectableValue[]) => {
              onChange({ ...query, states: vals.map((v) => v.value) });
            }}
            placeholder="all"
            value={query.states}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  );
}

export const usaQueryModes = [
  'values-as-rows',
  'values-as-fields',
  'values-as-labeled-fields',
  'timeseries',
  'timeseries-wide',
].map((f) => ({ label: f, value: f }));

export const fieldNames = [
  'foo',
  'bar',
  'baz', // all short
].map((f) => ({ label: f, value: f }));

export const stateNames = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'DC',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
].map((f) => ({ label: f, value: f }));
