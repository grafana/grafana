import React from 'react';
import { JaegerQueryField } from './QueryField';
import { shallow, mount } from 'enzyme';
import { JaegerDatasource, JaegerQuery } from './datasource';
import { ButtonCascader } from '@grafana/ui';

describe('JaegerQueryField', function() {
  it('shows empty value if no services returned', function() {
    const wrapper = shallow(
      <JaegerQueryField
        history={[]}
        datasource={makeDatasourceMock({})}
        query={{ query: '1234' } as JaegerQuery}
        onRunQuery={() => {}}
        onChange={() => {}}
      />
    );
    expect(wrapper.find(ButtonCascader).props().options[0].label).toBe('No traces found');
  });

  it('uses URL encoded service name in metadataRequest request', async function() {
    const wrapper = mount(
      <JaegerQueryField
        history={[]}
        datasource={makeDatasourceMock({
          'service/test': {
            op1: [
              {
                traceID: '12345',
                spans: [
                  {
                    spanID: 's2',
                    operationName: 'nonRootOp',
                    references: [{ refType: 'CHILD_OF', traceID: '12345', spanID: 's1' }],
                    duration: 10,
                  },
                  {
                    operationName: 'rootOp',
                    spanID: 's1',
                    references: [],
                    duration: 99,
                  },
                ],
              },
            ],
          },
        })}
        query={{ query: '1234' } as JaegerQuery}
        onRunQuery={() => {}}
        onChange={() => {}}
      />
    );

    // Simulating selection options. We need this as the function depends on the intermediate state of the component
    await wrapper.find(ButtonCascader)!.props().loadData!([{ value: 'service/test', label: 'service/test' }]);

    wrapper.update();
    expect(wrapper.find(ButtonCascader).props().options[0].label).toEqual('service/test');
    expect(wrapper.find(ButtonCascader).props().options[0].value).toEqual('service/test');
    expect(wrapper.find(ButtonCascader).props().options![0].children![1]).toEqual({
      isLeaf: false,
      label: 'op1',
      value: 'op1',
    });
  });

  it('shows root span as 3rd level in cascader', async function() {
    const wrapper = mount(
      <JaegerQueryField
        history={[]}
        datasource={makeDatasourceMock({
          service1: {
            op1: [
              {
                traceID: '12345',
                spans: [
                  {
                    spanID: 's2',
                    operationName: 'nonRootOp',
                    references: [{ refType: 'CHILD_OF', traceID: '12345', spanID: 's1' }],
                    duration: 10,
                  },
                  {
                    operationName: 'rootOp',
                    spanID: 's1',
                    references: [],
                    duration: 99,
                  },
                ],
              },
            ],
          },
        })}
        query={{ query: '1234' } as JaegerQuery}
        onRunQuery={() => {}}
        onChange={() => {}}
      />
    );

    // Simulating selection options. We need this as the function depends on the intermediate state of the component
    await wrapper.find(ButtonCascader)!.props().loadData!([{ value: 'service1', label: 'service1' }]);

    await wrapper.find(ButtonCascader)!.props().loadData!([
      { value: 'service1', label: 'service1' },
      { value: 'op1', label: 'op1' },
    ]);

    wrapper.update();
    expect(wrapper.find(ButtonCascader)!.props().options![0].children![1].children![0]).toEqual({
      label: 'rootOp [0.099 ms]',
      value: '12345',
    });
  });
});

function makeDatasourceMock(data: { [service: string]: { [operation: string]: any } }): JaegerDatasource {
  return {
    metadataRequest(url: string, params: Record<string, any>) {
      if (url.match(/\/services$/)) {
        return Promise.resolve(Object.keys(data));
      }
      let match = url.match(/\/services\/(.*)\/operations/);
      if (match) {
        const decodedService = decodeURIComponent(match[1]);
        expect(decodedService).toBe(Object.keys(data)[0]);
        return Promise.resolve(Object.keys(data[decodedService]));
      }

      if (url.match(/\/traces?/)) {
        return Promise.resolve(data[params.service][params.operation]);
      }
      throw new Error(`Unexpected url: ${url}`);
    },

    getTimeRange(): { start: number; end: number } {
      return { start: 1, end: 100 };
    },
  } as any;
}
