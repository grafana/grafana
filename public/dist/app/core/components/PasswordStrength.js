import * as tslib_1 from "tslib";
import React from 'react';
var PasswordStrength = /** @class */ (function (_super) {
    tslib_1.__extends(PasswordStrength, _super);
    function PasswordStrength(props) {
        return _super.call(this, props) || this;
    }
    PasswordStrength.prototype.render = function () {
        var password = this.props.password;
        var strengthText = 'strength: strong like a bull.';
        var strengthClass = 'password-strength-good';
        if (!password) {
            return null;
        }
        if (password.length <= 8) {
            strengthText = 'strength: you can do better.';
            strengthClass = 'password-strength-ok';
        }
        if (password.length < 4) {
            strengthText = 'strength: weak sauce.';
            strengthClass = 'password-strength-bad';
        }
        return (React.createElement("div", { className: "password-strength small " + strengthClass },
            React.createElement("em", null, strengthText)));
    };
    return PasswordStrength;
}(React.Component));
export { PasswordStrength };
//# sourceMappingURL=PasswordStrength.js.map