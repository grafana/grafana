import React from 'react';
import { shallow } from 'enzyme';
import { TermsQueryForm } from './TermsQueryForm';

const setup = (propOverrides?: object) => {
  const props = {
    onChange: () => {},
    query: {},
    fields: [{ value: 'field.a', label: 'field.a', description: 'number' }],
    ...propOverrides,
  };

  const wrapper = shallow(<TermsQueryForm {...props} />);
  const instance = wrapper.instance() as TermsQueryForm;

  return {
    wrapper,
    instance,
  };
};

describe('TermsQueryForm', () => {
  it('should render component', () => {
    const { wrapper } = setup();
    expect(wrapper).toMatchSnapshot();
  });

  it('when loading component should not trigger change event', () => {
    const props = {
      onChange: jest.fn(),
    };
    setup(props);
    expect(props.onChange.mock.calls.length).toBe(0);
  });

  it('when changing field should trigger change event', () => {
    const props = {
      onChange: jest.fn(),
    };
    const { instance } = setup(props);
    instance.onFieldChange('field.a');
    expect(props.onChange.mock.calls.length).toBe(1);
    expect(props.onChange.mock.calls[0][0].find).toBe('terms');
    expect(props.onChange.mock.calls[0][0].field).toBe('field.a');
    expect(props.onChange.mock.calls[0][1]).toBe('Terms(field.a)');
  });

  it('when changing query should trigger change event', () => {
    const props = {
      onChange: jest.fn(),
      query: { field: 'field.a' },
    };
    const { instance } = setup(props);
    instance.onQueryChange({
      target: {
        value: 'field.a:*',
      },
    } as any);
    instance.onQueryBlur();
    expect(props.onChange.mock.calls.length).toBe(1);
    expect(props.onChange.mock.calls[0][0]).toEqual({
      find: 'terms',
      field: 'field.a',
      query: 'field.a:*',
    });
    expect(props.onChange.mock.calls[0][1]).toBe('Terms(field.a)');
  });

  it('when changing size should trigger change event', () => {
    const props = {
      onChange: jest.fn(),
      query: { field: 'field.a' },
    };
    const { instance } = setup(props);
    instance.onSizeChange({
      target: {
        value: '1000',
      },
    } as any);
    instance.onSizeBlur();
    expect(props.onChange.mock.calls.length).toBe(1);
    expect(props.onChange.mock.calls[0][0]).toEqual({
      find: 'terms',
      field: 'field.a',
      size: 1000,
    });
    expect(props.onChange.mock.calls[0][1]).toBe('Terms(field.a)');
  });
});
