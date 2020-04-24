import React from 'react';
import { JaegerQueryField } from './QueryField';
import { shallow } from 'enzyme';
import { JaegerDatasource, JaegerQuery } from './datasource';
import { ButtonCascader } from '@grafana/ui';

describe('JaegerQueryField', function() {
  it('shows empty value if no services returned', function() {
    const dsMock: JaegerDatasource = {
      metadataRequest(url: string) {
        if (url.indexOf('/services') > 0) {
          return Promise.resolve([]);
        }
        throw new Error(`Unexpected url: ${url}`);
      },
    } as any;

    const wrapper = shallow(
      <JaegerQueryField
        history={[]}
        datasource={dsMock}
        query={{ query: '1234' } as JaegerQuery}
        onRunQuery={() => {}}
        onChange={() => {}}
      />
    );
    expect(wrapper.find(ButtonCascader).props().options[0].label).toBe('No traces found');
  });
});
