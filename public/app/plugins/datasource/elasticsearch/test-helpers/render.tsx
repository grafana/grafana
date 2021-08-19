import React, { ComponentProps, ReactNode } from 'react';
import { render } from '@testing-library/react';
import { getDefaultTimeRange } from '@grafana/data';
import { ElasticDatasource } from '../datasource';
import { ElasticsearchProvider } from '../components/QueryEditor/ElasticsearchQueryContext';

export const renderWithESProvider = (
  ui: ReactNode,
  {
    providerProps: {
      datasource = {} as ElasticDatasource,
      query = { refId: 'A' },
      onChange = () => void 0,
      onRunQuery = () => void 0,
      range = getDefaultTimeRange(),
    } = {},
    ...renderOptions
  }: { providerProps?: Partial<Omit<ComponentProps<typeof ElasticsearchProvider>, 'children'>> } & Parameters<
    typeof render
  >[1]
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
