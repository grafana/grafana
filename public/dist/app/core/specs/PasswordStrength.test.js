import React from 'react';
import { shallow } from 'enzyme';
import { PasswordStrength } from '../components/PasswordStrength';
describe('PasswordStrength', function () {
    it('should have class bad if length below 4', function () {
        var wrapper = shallow(React.createElement(PasswordStrength, { password: "asd" }));
        expect(wrapper.find('.password-strength-bad')).toHaveLength(1);
    });
    it('should have class ok if length below 8', function () {
        var wrapper = shallow(React.createElement(PasswordStrength, { password: "asdasd" }));
        expect(wrapper.find('.password-strength-ok')).toHaveLength(1);
    });
    it('should have class good if length above 8', function () {
        var wrapper = shallow(React.createElement(PasswordStrength, { password: "asdaasdda" }));
        expect(wrapper.find('.password-strength-good')).toHaveLength(1);
    });
});
//# sourceMappingURL=PasswordStrength.test.js.map