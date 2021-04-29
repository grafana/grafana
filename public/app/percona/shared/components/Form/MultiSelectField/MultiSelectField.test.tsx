import React from 'react';
import { mount } from 'enzyme';
import { MultiSelect } from '@grafana/ui';
import { Label } from '../Label';
import { MultiSelectField } from './MultiSelectField';

describe('MultiSelectField', () => {
  it('should render', () => {
    const wrapper = mount(<MultiSelectField label="label" name="name" onChange={jest.fn()} />);
    expect(wrapper.find(Label).exists()).toBeTruthy();
    expect(wrapper.find(MultiSelect).exists()).toBeTruthy();
  });
});
