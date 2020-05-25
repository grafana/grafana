import React from 'react';
import { shallow } from 'enzyme';
import { MetricSelect } from './MetricSelect';
import { LegacyForms } from '@grafana/ui';
const { Select } = LegacyForms;

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
  });
});
