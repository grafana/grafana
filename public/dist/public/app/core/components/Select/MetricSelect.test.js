import { __assign } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { MetricSelect } from './MetricSelect';
import { LegacyForms } from '@grafana/ui';
import { expect } from '../../../../test/lib/common';
var Select = LegacyForms.Select;
describe('MetricSelect', function () {
    describe('When receive props', function () {
        it('should pass correct set of props to Select component', function () {
            var props = {
                placeholder: 'Select Reducer',
                className: 'width-15',
                options: [],
                variables: [],
            };
            var wrapper = shallow(React.createElement(MetricSelect, __assign({}, props)));
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
        it('should pass callbacks correctly to the Select component', function () {
            var spyOnChange = jest.fn();
            var props = {
                onChange: spyOnChange,
                options: [],
                variables: [],
            };
            var wrapper = shallow(React.createElement(MetricSelect, __assign({}, props)));
            var select = wrapper.find(Select);
            select.props().onChange({ value: 'foo' });
            expect(select.props().noOptionsMessage).toBeDefined();
            // @ts-ignore typescript doesn't understand that noOptionsMessage can't be undefined here
            var noOptionsMessage = select.props().noOptionsMessage();
            expect(noOptionsMessage).toEqual('No options found');
            expect(spyOnChange).toHaveBeenCalledWith('foo');
        });
    });
});
//# sourceMappingURL=MetricSelect.test.js.map