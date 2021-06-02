import React from 'react';
import { mount } from 'enzyme';
import { Form } from 'react-final-form';
import { dataQa } from '@percona/platform-core';
import { MultiCheckboxField } from './MultiCheckboxField';

const optionsStub = [
  { name: 'v1.0', label: '1.0', value: false },
  { name: 'v2.2', label: '2.2', value: true },
  { name: 'v4.2', label: '4.2', value: false },
  { name: 'v5.3.1', label: '5.3.1', value: false },
  { name: 'v7.0', label: '7.0', value: true },
];

describe('MultiCheckboxField', () => {
  it('renders correct options', () => {
    const wrapper = mount(
      <Form onSubmit={jest.fn()} render={() => <MultiCheckboxField name="test" initialOptions={optionsStub} />} />
    );

    const optionsWrapper = wrapper.find(dataQa('test-options'));

    expect(optionsWrapper.children().length).toBe(optionsStub.length);
    expect(optionsWrapper.find(dataQa('v1.0-option')).text().includes('1.0')).toBeTruthy();
    expect(optionsWrapper.find(dataQa('v5.3.1-option')).text().includes('5.3.1')).toBeTruthy();
  });
  it('renders recommended option', () => {
    const wrapper = mount(
      <Form
        onSubmit={jest.fn()}
        render={() => (
          <MultiCheckboxField
            name="test"
            initialOptions={optionsStub}
            recommendedOptions={[optionsStub[1]]}
            recommendedLabel="Recommended"
          />
        )}
      />
    );

    expect(wrapper.find(dataQa('v2.2-option')).text().includes('Recommended')).toBeTruthy();
  });
  it('submits correct values', () => {
    const onSubmit = jest.fn();
    const wrapper = mount(
      <Form
        onSubmit={onSubmit}
        render={({ handleSubmit }) => (
          <form onSubmit={handleSubmit}>
            <MultiCheckboxField name="test" initialOptions={optionsStub} />
          </form>
        )}
      />
    );

    wrapper.find('form').simulate('submit');

    expect(onSubmit).toHaveBeenCalledWith({ test: optionsStub }, expect.anything(), expect.anything());
  });
});
