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
  describe('syntaxLoaded', () => {
    it('should re-render the editor after syntax has fully loaded', () => {
      const wrapper: any = shallow(<QueryField query="my query" portalOrigin="mock-origin" />);
      const spyOnChange = jest.spyOn(wrapper.instance(), 'onChange').mockImplementation(jest.fn());
      wrapper.instance().editor = { insertText: () => ({ deleteBackward: () => ({ value: 'fooo' }) }) };
      wrapper.setProps({ syntaxLoaded: true });
      expect(spyOnChange).toHaveBeenCalledWith('fooo', true);
    });
    it('should not re-render the editor if syntax is already loaded', () => {
      const wrapper: any = shallow(<QueryField query="my query" portalOrigin="mock-origin" />);
      const spyOnChange = jest.spyOn(wrapper.instance(), 'onChange').mockImplementation(jest.fn());
      wrapper.setProps({ syntaxLoaded: true });
      wrapper.instance().editor = {};
      wrapper.setProps({ syntaxLoaded: true });
      expect(spyOnChange).not.toBeCalled();
    });
    it('should not re-render the editor if editor itself is not defined', () => {
      const wrapper: any = shallow(<QueryField query="my query" portalOrigin="mock-origin" />);
      const spyOnChange = jest.spyOn(wrapper.instance(), 'onChange').mockImplementation(jest.fn());
      wrapper.setProps({ syntaxLoaded: true });
      expect(wrapper.instance().editor).toBeFalsy();
      expect(spyOnChange).not.toBeCalled();
    });
    it('should not re-render the editor twice once syntax is fully loaded', () => {
      const wrapper: any = shallow(<QueryField query="my query" portalOrigin="mock-origin" />);
      const spyOnChange = jest.spyOn(wrapper.instance(), 'onChange').mockImplementation(jest.fn());
      wrapper.instance().editor = { insertText: () => ({ deleteBackward: () => ({ value: 'fooo' }) }) };
      wrapper.setProps({ syntaxLoaded: true });
      wrapper.setProps({ syntaxLoaded: true });
      expect(spyOnChange).toBeCalledTimes(1);
    });
  });
});
