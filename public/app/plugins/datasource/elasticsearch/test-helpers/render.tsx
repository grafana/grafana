import { render } from '@testing-library/react';
import React, { ComponentProps, ReactNode } from 'react';

import { getDefaultTimeRange } from '@grafana/data';

import { ElasticsearchProvider } from '../components/QueryEditor/ElasticsearchQueryContext';
import { ElasticDatasource } from '../datasource';

const defaultProviderProps = {
  datasource: {} as ElasticDatasource,
  query: { refId: 'A' },
  onChange: () => void 0,
  onRunQuery: () => void 0,
  range: getDefaultTimeRange(),
};

export const renderWithESProvider = (
  ui: ReactNode,
  {
    providerProps: {
      datasource = defaultProviderProps.datasource,
      query = defaultProviderProps.query,
      onChange = defaultProviderProps.onChange,
      onRunQuery = defaultProviderProps.onRunQuery,
      range = defaultProviderProps.range,
    } = defaultProviderProps,
    ...renderOptions
  }: { providerProps?: Partial<Omit<ComponentProps<typeof ElasticsearchProvider>, 'children'>> } & Parameters<
    typeof render
  >[1] = { providerProps: defaultProviderProps }
) => {
  return render(
    <ElasticsearchProvider
      query={query}
      onChange={onChange}
      datasource={datasource}
      onRunQuery={onRunQuery}
      range={range}
    >
      {ui}
    </ElasticsearchProvider>,
    renderOptions
  );
};
