import React from 'react';
import { mount } from 'enzyme';
import { Select } from '@grafana/ui';
import { Label } from '../Label';
import { SelectField } from './SelectField';

describe('SelectField', () => {
  it('should render', () => {
    const wrapper = mount(<SelectField label="label" name="name" onChange={jest.fn()} />);
    expect(wrapper.find(Label).exists()).toBeTruthy();
    expect(wrapper.find(Select).exists()).toBeTruthy();
  });
});
