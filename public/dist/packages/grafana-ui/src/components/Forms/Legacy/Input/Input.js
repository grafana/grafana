import { __assign, __awaiter, __extends, __generator, __rest } from "tslib";
import React, { PureComponent } from 'react';
import classNames from 'classnames';
import { validate, EventsWithValidation, hasValidationEvent } from '../../../../utils';
export var LegacyInputStatus;
(function (LegacyInputStatus) {
    LegacyInputStatus["Invalid"] = "invalid";
    LegacyInputStatus["Valid"] = "valid";
})(LegacyInputStatus || (LegacyInputStatus = {}));
var Input = /** @class */ (function (_super) {
    __extends(Input, _super);
    function Input() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            error: null,
        };
        _this.validatorAsync = function (validationRules) {
            return function (evt) {
                var errors = validate(evt.target.value, validationRules);
                _this.setState(function (prevState) {
                    return __assign(__assign({}, prevState), { error: errors ? errors[0] : null });
                });
            };
        };
        _this.populateEventPropsWithStatus = function (restProps, validationEvents) {
            var inputElementProps = __assign({}, restProps);
            if (!validationEvents) {
                return inputElementProps;
            }
            Object.keys(EventsWithValidation).forEach(function (eventName) {
                if (hasValidationEvent(eventName, validationEvents) || restProps[eventName]) {
                    inputElementProps[eventName] = function (evt) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
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
            return this.state.error ? LegacyInputStatus.Invalid : LegacyInputStatus.Valid;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Input.prototype, "isInvalid", {
        get: function () {
            return this.status === LegacyInputStatus.Invalid;
        },
        enumerable: false,
        configurable: true
    });
    Input.prototype.render = function () {
        var _a = this.props, validationEvents = _a.validationEvents, className = _a.className, hideErrorMessage = _a.hideErrorMessage, inputRef = _a.inputRef, restProps = __rest(_a, ["validationEvents", "className", "hideErrorMessage", "inputRef"]);
        var error = this.state.error;
        var inputClassName = classNames('gf-form-input', { invalid: this.isInvalid }, className);
        var inputElementProps = this.populateEventPropsWithStatus(restProps, validationEvents);
        return (React.createElement("div", { style: { flexGrow: 1 } },
            React.createElement("input", __assign({}, inputElementProps, { ref: inputRef, className: inputClassName })),
            error && !hideErrorMessage && React.createElement("span", null, error)));
    };
    Input.defaultProps = {
        className: '',
    };
    return Input;
}(PureComponent));
export { Input };
//# sourceMappingURL=Input.js.map