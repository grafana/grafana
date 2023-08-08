import { defaults } from 'lodash';
import React, { useEffect, useState } from 'react';

import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { createErrorNotification } from '../../../../core/copy/appNotification';
import { notifyApp } from '../../../../core/reducers/appNotification';
import { dispatch } from '../../../../store/store';
import { TempoDatasource } from '../datasource';
import { defaultQuery, MyDataSourceOptions, TempoQuery } from '../types';

type Props = QueryEditorProps<TempoDatasource, TempoQuery, MyDataSourceOptions>;

export function SpanSelect(props: Props) {
  const query = defaults(props.query, defaultQuery);
  const [options, setOptions] = useState<SelectableValue[]>([]);
  const { datasource } = props;

  const onSpanChange = (selValue: SelectableValue<string>) => {
    props.onChange({ ...query, megaSpan: selValue.value });
  };

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const temp = await datasource.languageProvider.getOptionsV2('span.http.url');
        setOptions(temp);
      } catch (error) {
        if (error instanceof Error) {
          dispatch(notifyApp(createErrorNotification('Error', error)));
        }
      }
    };
    fetchOptions();
  }, [datasource]);

  return <Select aria-label="Span" onChange={onSpanChange} value={query.megaSpan} options={options} width={20} />;
}
