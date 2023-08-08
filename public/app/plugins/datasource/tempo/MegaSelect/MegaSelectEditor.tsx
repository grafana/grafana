import { defaults } from 'lodash';
import React, { useCallback, useEffect } from 'react';

import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';

import { createErrorNotification } from '../../../../core/copy/appNotification';
import { notifyApp } from '../../../../core/reducers/appNotification';
import { dispatch } from '../../../../store/store';
import { TempoDatasource } from '../datasource';
import { defaultQuery, MyDataSourceOptions, TempoQuery } from '../types';

import { SpanSelect } from './SpanSelect';

type Props = QueryEditorProps<TempoDatasource, TempoQuery, MyDataSourceOptions>;

export function MegaSelectEditor(props: Props) {
  const query = defaults(props.query, defaultQuery);
  const { datasource } = props;

  const onViewChange = useCallback(
    (selValue: SelectableValue<string>) => {
      props.onChange({ ...query, view: selValue.value });
    },
    [props, query]
  );

  useEffect(() => {
    const fetchTags = async () => {
      try {
        await datasource.languageProvider.start();
      } catch (error) {
        if (error instanceof Error) {
          dispatch(notifyApp(createErrorNotification('Error', error)));
        }
      }
    };
    fetchTags();
  }, [datasource]);

  useEffect(() => {
    if (!query.view) {
      onViewChange({ value: 'p99' });
    }
  }, [onViewChange, query]);

  const getTags = () => {
    return datasource.languageProvider.getTraceqlAutocompleteTags();
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
            width={20}
          />
        </InlineField>
        <InlineField label="Span" labelWidth={20}>
          <SpanSelect {...props} tags={getTags()} />
        </InlineField>
      </InlineFieldRow>
    </>
  );
}
