import { render, screen } from '@testing-library/react';
import React from 'react';

import { DataSourceInstanceSettings, DataSourcePluginMeta } from '@grafana/data';

import { LokiDatasource } from '../../datasource';
import { LokiVisualQueryBinary } from '../types';

import { NestedQuery, Props as NestedQueryProps } from './NestedQuery';

const createMockProps = (): NestedQueryProps => {
  const nestedQuery: LokiVisualQueryBinary = {
    operator: '/',
    query: {
      labels: [],
      operations: [],
    },
  };

  const datasource = new LokiDatasource(
    {
      url: '',
      jsonData: {},
      meta: {} as DataSourcePluginMeta,
    } as DataSourceInstanceSettings,
    undefined,
    undefined
  );

  const props: NestedQueryProps = {
    nestedQuery: nestedQuery,
    index: 0,
    datasource: datasource,
    onChange: jest.fn(),
    onRemove: jest.fn(),
    onRunQuery: jest.fn(),
    showExplain: false,
  };

  return props;
};

describe('Operator Selector', () => {
  it('renders the operator label', () => {
    const props = createMockProps();
    render(<NestedQuery {...props} />);
    expect(screen.getByText('Operator')).toBeInTheDocument();
  });

  // it('renders the operator current value', () => {
  //   const props = createMockProps();
  //   render(<NestedQuery {...props} />);
  //   expect(screen.getByText('/')).toBeInTheDocument();
  // });
});
