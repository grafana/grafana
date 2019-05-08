import React from 'react';
import { shallow } from 'enzyme';
import { FieldsQueryForm } from './FieldsQueryForm';
import { FieldTypes } from '../types';

const setup = (propOverrides?: object) => {
  const props = {
    onChange: () => {},
    query: {},
    ...propOverrides,
  };

  const wrapper = shallow(<FieldsQueryForm {...props} />);
  const instance = wrapper.instance() as FieldsQueryForm;

  return {
    wrapper,
    instance,
  };
};

describe('FieldsQueryForm', () => {
  it('should render component', () => {
    const { wrapper } = setup();
    expect(wrapper).toMatchSnapshot();
  });

  it('when loading component with type should not trigger change event', () => {
    const props = {
      onChange: jest.fn(),
      query: { type: 'keyword' },
    };
    setup(props);
    expect(props.onChange.mock.calls.length).toBe(0);
  });

  it('when loading component without type should trigger change event', () => {
    const props = {
      onChange: jest.fn(),
    };
    setup(props);
    expect(props.onChange.mock.calls.length).toBe(1);
    expect(props.onChange.mock.calls[0][0].find).toBe('fields');
    expect(props.onChange.mock.calls[0][1]).toBe('Fields(Any)');
  });

  it('when changing type should trigger change event', () => {
    const props = {
      onChange: jest.fn(),
    };
    const { instance } = setup(props);
    props.onChange.mockReset();
    instance.onFieldTypeChange(FieldTypes.Keyword);
    expect(props.onChange.mock.calls.length).toBe(1);
    expect(props.onChange.mock.calls[0][0].find).toBe('fields');
    expect(props.onChange.mock.calls[0][0].type).toBe(FieldTypes.Keyword);
    expect(props.onChange.mock.calls[0][1]).toBe('Fields(Keyword)');
  });

  it('when changing type to template variable should trigger change event', () => {
    const props = {
      onChange: jest.fn(),
    };
    const { instance } = setup(props);
    props.onChange.mockReset();
    instance.onFieldTypeChange('$var');
    expect(props.onChange.mock.calls.length).toBe(1);
    expect(props.onChange.mock.calls[0][0].find).toBe('fields');
    expect(props.onChange.mock.calls[0][0].type).toBe('$var');
    expect(props.onChange.mock.calls[0][1]).toBe('Fields($var)');
  });
});
