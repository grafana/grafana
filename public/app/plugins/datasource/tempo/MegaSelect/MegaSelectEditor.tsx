import { css } from '@emotion/css';
import { defaults } from 'lodash';
import React, { useCallback, useEffect } from 'react';

import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { EditorRow } from '@grafana/experimental';
import { Button, InlineField, InlineFieldRow, Select } from '@grafana/ui';

import { createErrorNotification } from '../../../../core/copy/appNotification';
import { notifyApp } from '../../../../core/reducers/appNotification';
import { AdHocFilter } from '../../../../features/variables/adhoc/picker/AdHocFilter';
import { AdHocVariableFilter } from '../../../../features/variables/types';
import { dispatch } from '../../../../store/store';
import { RawQuery } from '../../prometheus/querybuilder/shared/RawQuery';
import { generateQueryFromFilters } from '../SearchTraceQLEditor/utils';
import { TempoDatasource } from '../datasource';
import { traceqlGrammar } from '../traceql/traceql';
import { defaultQuery, MyDataSourceOptions, TempoQuery } from '../types';
import { megaToFilters } from '../utils';

import { SpanSelect } from './SpanSelect';

type Props = QueryEditorProps<TempoDatasource, TempoQuery, MyDataSourceOptions>;

export function MegaSelectEditor(props: Props) {
  const query = defaults(props.query, defaultQuery);
  const { datasource, onChange, onRunQuery } = props;

  const onViewChange = useCallback(
    (selValue: SelectableValue<string>) => {
      onChange({ ...query, view: selValue.value });
    },
    [onChange, query]
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

  return (
    <>
      <InlineFieldRow>
        <InlineField label="View" labelWidth={20}>
          <Select
            aria-label="View"
            onChange={onViewChange}
            value={query.view}
            options={['p99', 'p90', 'p50', 'errorRate'].map((value: string) => ({ label: value, value }))}
            width={12}
          />
        </InlineField>
        <InlineField label="HTTP Endpoint" labelWidth={20}>
          <SpanSelect {...props} />
        </InlineField>
        <InlineField label="Filters" labelWidth={14} grow>
          <AdHocFilter
            datasource={{ uid: datasource.uid }}
            filters={query.megaFilters || []}
            getTagKeysOptions={{}}
            addFilter={(filter: AdHocVariableFilter) => {
              onChange({
                ...query,
                megaFilters: [...(query.megaFilters || []), filter],
              });
            }}
            removeFilter={(index: number) => {
              const newFilters = [...(query.megaFilters || [])];
              newFilters.splice(index, 1);
              onChange({ ...query, megaFilters: newFilters });
            }}
            changeFilter={(index: number, filter: AdHocVariableFilter) => {
              const newFilters = [...(query.megaFilters || [])];
              newFilters.splice(index, 1, filter);
              onChange({ ...query, megaFilters: newFilters });
            }}
          />
        </InlineField>
      </InlineFieldRow>
      <EditorRow>
        <RawQuery
          className={css`
            flex-grow: 1;
          `}
          query={generateQueryFromFilters(megaToFilters(query.megaFilters, query.megaSpan))}
          lang={{ grammar: traceqlGrammar, name: 'traceql' }}
        />
        <Button
          onClick={() => {
            onChange({
              ...query,
              query: generateQueryFromFilters(megaToFilters(query.megaFilters, query.megaSpan)),
              queryType: 'traceql',
            });
            onRunQuery();
          }}
          size={'sm'}
        >
          Explore Traces
        </Button>
      </EditorRow>
    </>
  );
}
