import React from 'react';
import { mount } from 'enzyme';
import { AsyncSelect } from '@grafana/ui';
import { Label } from '../Label';
import { AsyncSelectField } from './AsyncSelectField';

describe('AsyncSelectField', () => {
  it('should render', () => {
    const wrapper = mount(<AsyncSelectField label="label" name="name" onChange={jest.fn()} />);
    expect(wrapper.find(Label).exists()).toBeTruthy();
    expect(wrapper.find(AsyncSelect).exists()).toBeTruthy();
  });
});
