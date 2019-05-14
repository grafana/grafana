var _a;
import React from 'react';
import renderer from 'react-test-renderer';
import { shallow } from 'enzyme';
import { Input, EventsWithValidation } from './Input';
var TEST_ERROR_MESSAGE = 'Value must be empty or less than 3 chars';
var testBlurValidation = (_a = {},
    _a[EventsWithValidation.onBlur] = [
        {
            rule: function (value) {
                if (!value || value.length < 3) {
                    return true;
                }
                return false;
            },
            errorMessage: TEST_ERROR_MESSAGE,
        },
    ],
    _a);
describe('Input', function () {
    it('renders correctly', function () {
        var tree = renderer.create(React.createElement(Input, null)).toJSON();
        expect(tree).toMatchSnapshot();
    });
    it('should validate with error onBlur', function () {
        var wrapper = shallow(React.createElement(Input, { validationEvents: testBlurValidation }));
        var evt = {
            persist: jest.fn,
            target: {
                value: 'I can not be more than 2 chars',
            },
        };
        wrapper.find('input').simulate('blur', evt);
        expect(wrapper.state('error')).toBe(TEST_ERROR_MESSAGE);
    });
    it('should validate without error onBlur', function () {
        var wrapper = shallow(React.createElement(Input, { validationEvents: testBlurValidation }));
        var evt = {
            persist: jest.fn,
            target: {
                value: 'Hi',
            },
        };
        wrapper.find('input').simulate('blur', evt);
        expect(wrapper.state('error')).toBe(null);
    });
});
//# sourceMappingURL=Input.test.js.map