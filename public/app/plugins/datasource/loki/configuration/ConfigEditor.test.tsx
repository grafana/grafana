import React from 'react';
import { mount } from 'enzyme';
import { ConfigEditor } from './ConfigEditor';
import { createDefaultConfigOptions } from '../mocks';
import { DataSourceHttpSettings } from '@grafana/ui';
import { DerivedFields } from './DerivedFields';

describe('ConfigEditor', () => {
  it('should render without error', () => {
    mount(<ConfigEditor onOptionsChange={() => {}} options={createDefaultConfigOptions()} />);
  });

  it('should render the right sections', () => {
    const wrapper = mount(<ConfigEditor onOptionsChange={() => {}} options={createDefaultConfigOptions()} />);
    expect(wrapper.find(DataSourceHttpSettings).length).toBe(1);
    expect(wrapper.find({ label: 'Maximum lines' }).length).toBe(1);
    expect(wrapper.find(DerivedFields).length).toBe(1);
  });

  it('should pass correct data to onChange', () => {
    const onChangeMock = jest.fn();
    const wrapper = mount(<ConfigEditor onOptionsChange={onChangeMock} options={createDefaultConfigOptions()} />);
    const inputWrapper = wrapper.find({ label: 'Maximum lines' }).find('input');
    (inputWrapper.getDOMNode() as any).value = 42;
    inputWrapper.simulate('change');
    expect(onChangeMock.mock.calls[0][0].jsonData.maxLines).toBe('42');
  });
});
