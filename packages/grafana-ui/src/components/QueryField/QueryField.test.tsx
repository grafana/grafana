import { mount, shallow } from 'enzyme';
import React from 'react';
import { Editor } from 'slate-react';

import { createTheme } from '@grafana/data';

import { UnThemedQueryField } from './QueryField';

describe('<QueryField />', () => {
  it('should render with null initial value', () => {
    const wrapper = shallow(
      <UnThemedQueryField theme={createTheme()} query={null} onTypeahead={jest.fn()} portalOrigin="mock-origin" />
    );
    expect(wrapper.find('div').exists()).toBeTruthy();
  });

  it('should render with empty initial value', () => {
    const wrapper = shallow(
      <UnThemedQueryField theme={createTheme()} query="" onTypeahead={jest.fn()} portalOrigin="mock-origin" />
    );
    expect(wrapper.find('div').exists()).toBeTruthy();
  });

  it('should render with initial value', () => {
    const wrapper = shallow(
      <UnThemedQueryField theme={createTheme()} query="my query" onTypeahead={jest.fn()} portalOrigin="mock-origin" />
    );
    expect(wrapper.find('div').exists()).toBeTruthy();
  });

  it('should execute query on blur', () => {
    const onRun = jest.fn();
    const wrapper = mount(
      <UnThemedQueryField
        theme={createTheme()}
        query="my query"
        onTypeahead={jest.fn()}
        onRunQuery={onRun}
        portalOrigin="mock-origin"
      />
    );
    const field = wrapper.instance() as UnThemedQueryField;
    const ed = wrapper.find(Editor).instance() as Editor;
    expect(onRun.mock.calls.length).toBe(0);
    field.handleBlur(undefined, ed, () => {});
    expect(onRun.mock.calls.length).toBe(1);
  });

  it('should run onChange with clean text', () => {
    const onChange = jest.fn();
    const wrapper = shallow(
      <UnThemedQueryField
        theme={createTheme()}
        query={`my\r clean query `}
        onTypeahead={jest.fn()}
        onChange={onChange}
        portalOrigin="mock-origin"
      />
    );
    const field = wrapper.instance() as UnThemedQueryField;
    field.runOnChange();
    expect(onChange.mock.calls.length).toBe(1);
    expect(onChange.mock.calls[0][0]).toBe('my clean query ');
  });

  it('should run custom on blur, but not necessarily execute query', () => {
    const onBlur = jest.fn();
    const onRun = jest.fn();
    const wrapper = mount(
      <UnThemedQueryField
        theme={createTheme()}
        query="my query"
        onTypeahead={jest.fn()}
        onBlur={onBlur}
        onRunQuery={onRun}
        portalOrigin="mock-origin"
      />
    );
    const field = wrapper.instance() as UnThemedQueryField;
    const ed = wrapper.find(Editor).instance() as Editor;
    expect(onBlur.mock.calls.length).toBe(0);
    expect(onRun.mock.calls.length).toBe(0);
    field.handleBlur(undefined, ed, () => {});
    expect(onBlur.mock.calls.length).toBe(1);
    expect(onRun.mock.calls.length).toBe(0);
  });
  describe('syntaxLoaded', () => {
    it('should re-render the editor after syntax has fully loaded', () => {
      const wrapper: any = shallow(
        <UnThemedQueryField theme={createTheme()} query="my query" portalOrigin="mock-origin" />
      );
      const spyOnChange = jest.spyOn(wrapper.instance(), 'onChange').mockImplementation(jest.fn());
      wrapper.instance().editor = { insertText: () => ({ deleteBackward: () => ({ value: 'fooo' }) }) };
      wrapper.setProps({ syntaxLoaded: true });
      expect(spyOnChange).toHaveBeenCalledWith('fooo', true);
    });
    it('should not re-render the editor if syntax is already loaded', () => {
      const wrapper: any = shallow(
        <UnThemedQueryField theme={createTheme()} query="my query" portalOrigin="mock-origin" />
      );
      const spyOnChange = jest.spyOn(wrapper.instance(), 'onChange').mockImplementation(jest.fn());
      wrapper.setProps({ syntaxLoaded: true });
      wrapper.instance().editor = {};
      wrapper.setProps({ syntaxLoaded: true });
      expect(spyOnChange).not.toBeCalled();
    });
    it('should not re-render the editor if editor itself is not defined', () => {
      const wrapper: any = shallow(
        <UnThemedQueryField theme={createTheme()} query="my query" portalOrigin="mock-origin" />
      );
      const spyOnChange = jest.spyOn(wrapper.instance(), 'onChange').mockImplementation(jest.fn());
      wrapper.setProps({ syntaxLoaded: true });
      expect(wrapper.instance().editor).toBeFalsy();
      expect(spyOnChange).not.toBeCalled();
    });
    it('should not re-render the editor twice once syntax is fully loaded', () => {
      const wrapper: any = shallow(
        <UnThemedQueryField theme={createTheme()} query="my query" portalOrigin="mock-origin" />
      );
      const spyOnChange = jest.spyOn(wrapper.instance(), 'onChange').mockImplementation(jest.fn());
      wrapper.instance().editor = { insertText: () => ({ deleteBackward: () => ({ value: 'fooo' }) }) };
      wrapper.setProps({ syntaxLoaded: true });
      wrapper.setProps({ syntaxLoaded: true });
      expect(spyOnChange).toBeCalledTimes(1);
    });
  });
});
