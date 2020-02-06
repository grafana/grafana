import React from 'react';
import { mount } from 'enzyme';
import { DerivedFields } from './DerivedFields';
import { Button } from '@grafana/ui';
import { DerivedField } from './DerivedField';

describe('DerivedFields', () => {
  let originalGetSelection: typeof window.getSelection;
  beforeAll(() => {
    originalGetSelection = window.getSelection;
    window.getSelection = () => null;
  });

  afterAll(() => {
    window.getSelection = originalGetSelection;
  });

  it('renders correctly when no fields', () => {
    const wrapper = mount(<DerivedFields onChange={() => {}} />);
    expect(wrapper.find(Button).length).toBe(1);
    expect(wrapper.find(Button).contains('Add')).toBeTruthy();
    expect(wrapper.find(DerivedField).length).toBe(0);
  });

  it('renders correctly when there are fields', () => {
    const wrapper = mount(<DerivedFields value={testValue} onChange={() => {}} />);

    expect(wrapper.find(Button).filterWhere(button => button.contains('Add')).length).toBe(1);
    expect(wrapper.find(Button).filterWhere(button => button.contains('Show example log message')).length).toBe(1);
    expect(wrapper.find(DerivedField).length).toBe(2);
  });

  it('adds new field', () => {
    const onChangeMock = jest.fn();
    const wrapper = mount(<DerivedFields onChange={onChangeMock} />);
    const addButton = wrapper.find(Button).filterWhere(button => button.contains('Add'));
    addButton.simulate('click');
    expect(onChangeMock.mock.calls[0][0].length).toBe(1);
  });

  it('removes field', () => {
    const onChangeMock = jest.fn();
    const wrapper = mount(<DerivedFields value={testValue} onChange={onChangeMock} />);
    const removeButton = wrapper
      .find(DerivedField)
      .at(0)
      .find(Button);
    removeButton.simulate('click');
    const newValue = onChangeMock.mock.calls[0][0];
    expect(newValue.length).toBe(1);
    expect(newValue[0]).toMatchObject({
      matcherRegex: 'regex2',
      name: 'test2',
      url: 'localhost2',
    });
  });
});

const testValue = [
  {
    matcherRegex: 'regex1',
    name: 'test1',
    url: 'localhost1',
  },
  {
    matcherRegex: 'regex2',
    name: 'test2',
    url: 'localhost2',
  },
];
