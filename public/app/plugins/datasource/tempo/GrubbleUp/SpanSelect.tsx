import { defaults } from 'lodash';
import React from 'react';

import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { TempoDatasource } from '../datasource';
import { defaultQuery, MyDataSourceOptions, TempoQuery } from '../types';

type Props = QueryEditorProps<TempoDatasource, TempoQuery, MyDataSourceOptions>;

export function SpanSelect(props: Props & { tags: string[] }) {
  const query = defaults(props.query, defaultQuery);
  const { tags } = props;

  const onSpanChange = (selValue: SelectableValue<string>) => {
    props.onChange({ ...query, grubbleUpSpan: selValue.value });
  };

  return (
    <Select
      aria-label="Span"
      onChange={onSpanChange}
      value={query.grubbleUpSpan}
      options={tags.map((value: string) => ({ label: value, value }))}
      width={20}
    />
  );
}
