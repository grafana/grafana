import React from 'react';
import { mount, shallow } from 'enzyme';
import { LogsConfig } from './LogsConfig';
import { createDefaultConfigOptions } from './mocks';
import { FormField } from '@grafana/ui';

describe('ElasticDetails', () => {
  it('should render without error', () => {
    mount(<LogsConfig onChange={() => {}} value={createDefaultConfigOptions().jsonData} />);
  });

  it('should render fields', () => {
    const wrapper = shallow(<LogsConfig onChange={() => {}} value={createDefaultConfigOptions().jsonData} />);
    expect(wrapper.find(FormField).length).toBe(2);
  });

  it('should pass correct data to onChange', () => {
    const onChangeMock = jest.fn();
    const wrapper = mount(<LogsConfig onChange={onChangeMock} value={createDefaultConfigOptions().jsonData} />);
    const inputEl = wrapper
      .find(FormField)
      .at(0)
      .find('input');
    (inputEl.getDOMNode() as any).value = 'test_field';
    inputEl.simulate('change');
    expect(onChangeMock.mock.calls[0][0].logMessageField).toBe('test_field');
  });
});
