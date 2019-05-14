import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import classNames from 'classnames';
import { validate, hasValidationEvent } from 'app/core/utils/validate';
export var InputStatus;
(function (InputStatus) {
    InputStatus["Invalid"] = "invalid";
    InputStatus["Valid"] = "valid";
})(InputStatus || (InputStatus = {}));
export var InputTypes;
(function (InputTypes) {
    InputTypes["Text"] = "text";
    InputTypes["Number"] = "number";
    InputTypes["Password"] = "password";
    InputTypes["Email"] = "email";
})(InputTypes || (InputTypes = {}));
export var EventsWithValidation;
(function (EventsWithValidation) {
    EventsWithValidation["onBlur"] = "onBlur";
    EventsWithValidation["onFocus"] = "onFocus";
    EventsWithValidation["onChange"] = "onChange";
})(EventsWithValidation || (EventsWithValidation = {}));
var Input = /** @class */ (function (_super) {
    tslib_1.__extends(Input, _super);
    function Input() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            error: null,
        };
        _this.validatorAsync = function (validationRules) {
            return function (evt) {
                var errors = validate(evt.target.value, validationRules);
                _this.setState(function (prevState) {
                    return tslib_1.__assign({}, prevState, { error: errors ? errors[0] : null });
                });
            };
        };
        _this.populateEventPropsWithStatus = function (restProps, validationEvents) {
            var inputElementProps = tslib_1.__assign({}, restProps);
            Object.keys(EventsWithValidation).forEach(function (eventName) {
                if (hasValidationEvent(eventName, validationEvents) || restProps[eventName]) {
                    inputElementProps[eventName] = function (evt) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                        return tslib_1.__generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    evt.persist(); // Needed for async. https://reactjs.org/docs/events.html#event-pooling
                                    if (!hasValidationEvent(eventName, validationEvents)) return [3 /*break*/, 2];
                                    return [4 /*yield*/, this.validatorAsync(validationEvents[eventName]).apply(this, [evt])];
                                case 1:
                                    _a.sent();
                                    _a.label = 2;
                                case 2:
                                    if (restProps[eventName]) {
                                        restProps[eventName].apply(null, [evt, this.status]);
                                    }
                                    return [2 /*return*/];
                            }
                        });
                    }); };
                }
            });
            return inputElementProps;
        };
        return _this;
    }
    Object.defineProperty(Input.prototype, "status", {
        get: function () {
            return this.state.error ? InputStatus.Invalid : InputStatus.Valid;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Input.prototype, "isInvalid", {
        get: function () {
            return this.status === InputStatus.Invalid;
        },
        enumerable: true,
        configurable: true
    });
    Input.prototype.render = function () {
        var _a = this.props, validationEvents = _a.validationEvents, className = _a.className, hideErrorMessage = _a.hideErrorMessage, restProps = tslib_1.__rest(_a, ["validationEvents", "className", "hideErrorMessage"]);
        var error = this.state.error;
        var inputClassName = classNames('gf-form-input', { invalid: this.isInvalid }, className);
        var inputElementProps = this.populateEventPropsWithStatus(restProps, validationEvents);
        return (React.createElement("div", { className: "our-custom-wrapper-class" },
            React.createElement("input", tslib_1.__assign({}, inputElementProps, { className: inputClassName })),
            error && !hideErrorMessage && React.createElement("span", null, error)));
    };
    Input.defaultProps = {
        className: '',
    };
    return Input;
}(PureComponent));
export { Input };
//# sourceMappingURL=Input.js.map