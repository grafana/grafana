import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { ComponentProps } from 'react';

import { DataFrame, DataSourceApi, DataSourcePluginMeta, FieldType, toDataFrame } from '@grafana/data';
import {
  QueryBuilderOperation,
  QueryBuilderOperationParamDef,
} from 'app/plugins/datasource/prometheus/querybuilder/shared/types';

import { LokiDatasource } from '../../datasource';
import { LokiOperationId } from '../types';

import { UnwrapParamEditor } from './UnwrapParamEditor';

describe('UnwrapParamEditor', () => {
  it('shows value if value present', () => {
    const props = createProps({ value: 'unique' });
    render(<UnwrapParamEditor {...props} />);
    expect(screen.getByText('unique')).toBeInTheDocument();
  });

  it('shows no label options if no samples are returned', async () => {
    const props = createProps();
    render(<UnwrapParamEditor {...props} />);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    expect(screen.getByText('No labels found')).toBeInTheDocument();
  });

  it('shows no label options for non-metric query', async () => {
    const props = createProps({
      query: {
        labels: [{ op: '=', label: 'foo', value: 'bar' }],
        operations: [
          { id: LokiOperationId.Logfmt, params: [] },
          { id: LokiOperationId.Unwrap, params: ['', ''] },
        ],
      },
    });
    render(<UnwrapParamEditor {...props} />);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    expect(screen.getByText('No labels found')).toBeInTheDocument();
  });

  it('shows labels with unwrap-friendly values', async () => {
    const props = createProps({}, frames);
    render(<UnwrapParamEditor {...props} />);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    expect(await screen.findByText('status')).toBeInTheDocument();
    expect(await screen.findByText('duration')).toBeInTheDocument();
  });
});

const createProps = (
  propsOverrides?: Partial<ComponentProps<typeof UnwrapParamEditor>>,
  mockedSample?: DataFrame[]
) => {
  const propsDefault = {
    value: undefined,
    onChange: jest.fn(),
    onRunQuery: jest.fn(),
    index: 1,
    operationIndex: 1,
    query: {
      labels: [{ op: '=', label: 'foo', value: 'bar' }],
      operations: [
        { id: LokiOperationId.Logfmt, params: [] },
        { id: LokiOperationId.Unwrap, params: ['', ''] },
        { id: LokiOperationId.SumOverTime, params: ['5m'] },
        { id: '__sum_by', params: ['job'] },
      ],
    },
    paramDef: {} as QueryBuilderOperationParamDef,
    operation: {} as QueryBuilderOperation,
    datasource: new LokiDatasource(
      {
        id: 1,
        uid: '',
        type: 'loki',
        name: 'loki-test',
        access: 'proxy',
        url: '',
        jsonData: {},
        meta: {} as DataSourcePluginMeta,
        readOnly: false,
      },
      undefined,
      undefined
    ) as DataSourceApi,
  };
  const props = { ...propsDefault, ...propsOverrides };

  if (props.datasource instanceof LokiDatasource) {
    const resolvedValue = mockedSample ?? [];
    props.datasource.getDataSamples = jest.fn().mockResolvedValue(resolvedValue);
  }
  return props;
};

const frames = [
  toDataFrame({
    fields: [
      {
        name: 'labels',
        type: FieldType.other,
        values: [
          {
            compose_project: 'docker-compose',
            compose_service: 'app',
            container_name: 'docker-compose_app_1',
            duration: '2.807709ms',
            filename: '/var/log/docker/37c87fe98cbfa28327c1de10c4aff72c58154d8e4d129118ff2024692360b677/json.log',
            host: 'docker-desktop',
            instance: 'docker-compose_app_1',
            job: 'tns/app',
            level: 'info',
            msg: 'HTTP client success',
            namespace: 'tns',
            source: 'stdout',
            status: '200',
            traceID: '6a3d34c4225776f6',
            url: 'http://db',
          },
          {
            compose_project: 'docker-compose',
            compose_service: 'app',
            container_name: 'docker-compose_app_1',
            duration: '7.432542ms',
            filename: '/var/log/docker/37c87fe98cbfa28327c1de10c4aff72c58154d8e4d129118ff2024692360b677/json.log',
            host: 'docker-desktop',
            instance: 'docker-compose_app_1',
            job: 'tns/app',
            level: 'info',
            msg: 'HTTP client success',
            namespace: 'tns',
            source: 'stdout',
            status: '200',
            traceID: '18e99189831471f6',
            url: 'http://db',
          },
        ],
      },
    ],
  }),
];
