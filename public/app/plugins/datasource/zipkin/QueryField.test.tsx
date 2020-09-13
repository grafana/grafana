import React from 'react';
import { QueryField, useLoadOptions, useServices } from './QueryField';
import { ZipkinDatasource, ZipkinQuery } from './datasource';
import { shallow } from 'enzyme';
import { ButtonCascader, CascaderOption } from '@grafana/ui';
import { renderHook, act } from '@testing-library/react-hooks';

describe('QueryField', () => {
  it('renders properly', () => {
    const ds = {} as ZipkinDatasource;
    const wrapper = shallow(
      <QueryField
        history={[]}
        datasource={ds}
        query={{ query: '1234' } as ZipkinQuery}
        onRunQuery={() => {}}
        onChange={() => {}}
      />
    );

    expect(wrapper.find(ButtonCascader).length).toBe(1);
    expect(wrapper.find('input').length).toBe(1);
    expect(wrapper.find('input').props().value).toBe('1234');
  });
});

describe('useServices', () => {
  it('returns services from datasource', async () => {
    const ds = {
      async metadataRequest(url: string, params?: Record<string, any>): Promise<any> {
        if (url === '/api/v2/services') {
          return Promise.resolve(['service1', 'service2']);
        }
      },
    } as ZipkinDatasource;

    const { result, waitForNextUpdate } = renderHook(() => useServices(ds));
    await waitForNextUpdate();
    expect(result.current.value).toEqual([
      { label: 'service1', value: 'service1', isLeaf: false },
      { label: 'service2', value: 'service2', isLeaf: false },
    ]);
  });
});

describe('useLoadOptions', () => {
  it('loads spans and traces', async () => {
    const ds = {
      async metadataRequest(url: string, params?: Record<string, any>): Promise<any> {
        if (url === '/api/v2/spans' && params?.serviceName === 'service1') {
          return Promise.resolve(['span1', 'span2']);
        }

        console.log({ url });
        if (url === '/api/v2/traces' && params?.serviceName === 'service1' && params?.spanName === 'span1') {
          return Promise.resolve([[{ name: 'trace1', duration: 10_000, traceId: 'traceId1' }]]);
        }
      },
    } as ZipkinDatasource;

    const { result, waitForNextUpdate } = renderHook(() => useLoadOptions(ds));
    expect(result.current.allOptions).toEqual({});

    act(() => {
      result.current.onLoadOptions([{ value: 'service1' } as CascaderOption]);
    });

    await waitForNextUpdate();

    expect(result.current.allOptions).toEqual({ service1: { span1: undefined, span2: undefined } });

    act(() => {
      result.current.onLoadOptions([{ value: 'service1' } as CascaderOption, { value: 'span1' } as CascaderOption]);
    });

    await waitForNextUpdate();

    expect(result.current.allOptions).toEqual({
      service1: { span1: { 'trace1 [10 ms]': 'traceId1' }, span2: undefined },
    });
  });
});
