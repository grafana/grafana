import { defaults } from 'lodash';
import React from 'react';

import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';

import { TempoDatasource } from '../datasource';
import { defaultQuery, MyDataSourceOptions, TempoQuery } from '../types';

type Props = QueryEditorProps<TempoDatasource, TempoQuery, MyDataSourceOptions>;

export function GrubbleEditor(props: Props) {
  const query = defaults(props.query, defaultQuery);

  const onViewChange = (selValue: SelectableValue<string>) => {
    props.onChange({ ...query, view: selValue.value });
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField label="View" labelWidth={20}>
          <Select
            aria-label="View"
            onChange={onViewChange}
            value={query.view}
            options={['p99', 'p90', 'p50', 'errorRate'].map((value: string) => ({ label: value, value }))}
            width={16}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  );
}
