import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { CascaderOption } from '@grafana/ui';

import { ZipkinQueryField, useLoadOptions, useServices } from './QueryField';
import { ZipkinDatasource } from './datasource';
import { ZipkinQuery } from './types';

describe('QueryField', () => {
  it('renders properly', async () => {
    const ds = {} as ZipkinDatasource;

    render(
      <ZipkinQueryField
        history={[]}
        datasource={ds}
        query={{ query: '1234' } as ZipkinQuery}
        onRunQuery={() => {}}
        onChange={() => {}}
      />
    );

    expect(await screen.findByText(/1234/i)).toBeInTheDocument();
    expect(await screen.findByText(/Traces/i)).toBeInTheDocument();
  });
});

describe('useServices', () => {
  it('returns services from datasource', async () => {
    const ds = {
      async metadataRequest(url) {
        if (url === '/api/v2/services') {
          return Promise.resolve(['service1', 'service2']);
        }
        return undefined;
      },
    } as ZipkinDatasource;

    const { result } = renderHook(() => useServices(ds));
    await waitFor(() => {
      expect(result.current.value).toEqual([
        { label: 'service1', value: 'service1', isLeaf: false },
        { label: 'service2', value: 'service2', isLeaf: false },
      ]);
    });
  });
});

describe('useLoadOptions', () => {
  it('loads spans and traces', async () => {
    const ds = {
      async metadataRequest(url, params) {
        if (url === '/api/v2/spans' && params?.serviceName === 'service1') {
          return Promise.resolve(['span1', 'span2']);
        }

        if (url === '/api/v2/traces' && params?.serviceName === 'service1' && params?.spanName === 'span1') {
          return Promise.resolve([[{ name: 'trace1', duration: 10_000, traceId: 'traceId1' }]]);
        }
        return undefined;
      },
    } as ZipkinDatasource;

    const { result } = renderHook(() => useLoadOptions(ds));
    expect(result.current.allOptions).toEqual({});

    act(() => {
      result.current.onLoadOptions([{ value: 'service1' } as CascaderOption]);
    });

    await waitFor(() => {
      expect(result.current.allOptions).toEqual({ service1: { span1: undefined, span2: undefined } });
    });

    act(() => {
      result.current.onLoadOptions([{ value: 'service1' } as CascaderOption, { value: 'span1' } as CascaderOption]);
    });

    await waitFor(() => {
      expect(result.current.allOptions).toEqual({
        service1: { span1: { 'trace1 [10 ms]': 'traceId1' }, span2: undefined },
      });
    });
  });
});
