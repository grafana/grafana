import React from 'react';
import { shallow } from 'enzyme';
import { MetricSelect, compareFn, buildOptions, getSelectedOption } from './MetricSelect';
import { Select } from '@grafana/ui';

describe('MetricSelect', () => {
  describe('When receive props', () => {
    it('should pass correct set of props to Select component', () => {
      const props: any = {
        placeholder: 'Select Reducer',
        className: 'width-15',
        options: [],
        variables: [],
      };
      const wrapper = shallow(<MetricSelect {...props} />);
      expect(wrapper.find(Select).props()).toMatchObject({
        className: 'width-15',
        isMulti: false,
        isClearable: false,
        backspaceRemovesValue: false,
        isSearchable: true,
        maxMenuHeight: 500,
        placeholder: 'Select Reducer',
      });
    });
    it('should pass callbacks correctly to the Select component', () => {
      const spyOnChange = jest.fn();
      const props: any = {
        onChange: spyOnChange,
        options: [],
        variables: [],
      };
      const wrapper = shallow(<MetricSelect {...props} />);
      wrapper
        .find(Select)
        .props()
        .onChange({ value: 'foo' });
      expect(
        wrapper
          .find(Select)
          .props()
          .noOptionsMessage()
      ).toEqual('No options found');
      expect(spyOnChange).toHaveBeenCalledWith('foo');
    });
    it('should compareFunc returns true if next and prev valus are same', () => {
      const prevProps: any = { value: 'foo' };
      const nextProps: any = { value: 'foo' };
      expect(compareFn(nextProps, prevProps)).toEqual(true);
    });
    it('should compareFunc returns true if prev and next build options are not equal', () => {
      const prevProps: any = { value: 'fooa', variables: [{ name: 'asd' }], options: [{ prop: 'val' }] };
      const nextProps: any = { value: 'foo', variables: [{ name: 'qwer' }], options: [{ prop: 'val' }] };
      expect(compareFn(nextProps, prevProps)).toEqual(true);
    });
  });
  describe('buildOptions', () => {
    it('should build options correctly', () => {
      const props: any = {
        variables: [{ name: 'foo' }, { name: 'bar' }],
        options: [{ bar: 'bar', baz: 'baz' }],
      };
      expect(buildOptions(props)).toEqual([
        {
          label: 'Template Variables',
          options: [
            { label: '$foo', value: '$foo' },
            { label: '$bar', value: '$bar' },
          ],
        },
        ...props.options,
      ]);
    });
    it('should return options when variables are empty', () => {
      const props: any = {
        variables: [],
        options: [{ bar: 'bar', baz: 'baz' }],
      };
      expect(buildOptions(props)).toEqual([{ bar: 'bar', baz: 'baz' }]);
    });
  });
  describe('getSelectedOption', () => {
    it('should return the option which value is matching the passed value', () => {
      const options = [{ value: 'baz' }, { value: 'foo' }, { value: 'bar' }];
      expect(getSelectedOption(options, 'foo')).toEqual(options[1]);
    });
  });
});
