import React from 'react';
import { shallow } from 'enzyme';
import { QueryField } from './QueryField';
import { Editor } from 'slate';

describe('<QueryField />', () => {
  it('should render with null initial value', () => {
    const wrapper = shallow(<QueryField query={null} onTypeahead={jest.fn()} portalOrigin="mock-origin" />);
    expect(wrapper.find('div').exists()).toBeTruthy();
  });

  it('should render with empty initial value', () => {
    const wrapper = shallow(<QueryField query="" onTypeahead={jest.fn()} portalOrigin="mock-origin" />);
    expect(wrapper.find('div').exists()).toBeTruthy();
  });

  it('should render with initial value', () => {
    const wrapper = shallow(<QueryField query="my query" onTypeahead={jest.fn()} portalOrigin="mock-origin" />);
    expect(wrapper.find('div').exists()).toBeTruthy();
  });

  it('should execute query on blur', () => {
    const onRun = jest.fn();
    const wrapper = shallow(
      <QueryField query="my query" onTypeahead={jest.fn()} onRunQuery={onRun} portalOrigin="mock-origin" />
    );
    const field = wrapper.instance() as QueryField;
    expect(onRun.mock.calls.length).toBe(0);
    field.handleBlur(new Event('bogus'), new Editor({}), () => {});
    expect(onRun.mock.calls.length).toBe(1);
  });

  it('should run custom on blur, but not necessarily execute query', () => {
    const onBlur = jest.fn();
    const onRun = jest.fn();
    const wrapper = shallow(
      <QueryField
        query="my query"
        onTypeahead={jest.fn()}
        onBlur={onBlur}
        onRunQuery={onRun}
        portalOrigin="mock-origin"
      />
    );
    const field = wrapper.instance() as QueryField;
    expect(onBlur.mock.calls.length).toBe(0);
    expect(onRun.mock.calls.length).toBe(0);
    field.handleBlur(new Event('bogus'), new Editor({}), () => {});
    expect(onBlur.mock.calls.length).toBe(1);
    expect(onRun.mock.calls.length).toBe(0);
  });
});
