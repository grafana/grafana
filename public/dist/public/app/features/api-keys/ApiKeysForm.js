var _a;
import { __read } from "tslib";
import React, { useEffect, useState } from 'react';
import { EventsWithValidation, LegacyForms, Button, Select, InlineField } from '@grafana/ui';
import { OrgRole } from '../../types';
import { rangeUtil } from '@grafana/data';
import { SlideDown } from '../../core/components/Animations/SlideDown';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';
var Input = LegacyForms.Input;
var ROLE_OPTIONS = Object.keys(OrgRole).map(function (role) { return ({
    label: role,
    value: role,
}); });
function isValidInterval(value) {
    if (!value) {
        return true;
    }
    try {
        rangeUtil.intervalToSeconds(value);
        return true;
    }
    catch (_a) { }
    return false;
}
var timeRangeValidationEvents = (_a = {},
    _a[EventsWithValidation.onBlur] = [
        {
            rule: isValidInterval,
            errorMessage: 'Not a valid duration',
        },
    ],
    _a);
var tooltipText = 'The API key life duration. For example, 1d if your key is going to last for one day. Supported units are: s,m,h,d,w,M,y';
export var ApiKeysForm = function (_a) {
    var show = _a.show, onClose = _a.onClose, onKeyAdded = _a.onKeyAdded;
    var _b = __read(useState(''), 2), name = _b[0], setName = _b[1];
    var _c = __read(useState(OrgRole.Viewer), 2), role = _c[0], setRole = _c[1];
    var _d = __read(useState(''), 2), secondsToLive = _d[0], setSecondsToLive = _d[1];
    useEffect(function () {
        setName('');
        setRole(OrgRole.Viewer);
        setSecondsToLive('');
    }, [show]);
    var onSubmit = function (event) {
        event.preventDefault();
        if (isValidInterval(secondsToLive)) {
            onKeyAdded({ name: name, role: role, secondsToLive: secondsToLive });
            onClose();
        }
    };
    var onNameChange = function (event) {
        setName(event.currentTarget.value);
    };
    var onRoleChange = function (role) {
        setRole(role.value);
    };
    var onSecondsToLiveChange = function (event) {
        setSecondsToLive(event.currentTarget.value);
    };
    return (React.createElement(SlideDown, { in: show },
        React.createElement("div", { className: "gf-form-inline cta-form" },
            React.createElement(CloseButton, { onClick: onClose }),
            React.createElement("form", { className: "gf-form-group", onSubmit: onSubmit },
                React.createElement("h5", null, "Add API Key"),
                React.createElement("div", { className: "gf-form-inline" },
                    React.createElement("div", { className: "gf-form max-width-21" },
                        React.createElement("span", { className: "gf-form-label" }, "Key name"),
                        React.createElement(Input, { type: "text", className: "gf-form-input", value: name, placeholder: "Name", onChange: onNameChange })),
                    React.createElement("div", { className: "gf-form" },
                        React.createElement(InlineField, { label: "Role" },
                            React.createElement(Select, { inputId: "role-select", value: role, onChange: onRoleChange, options: ROLE_OPTIONS, menuShouldPortal: true }))),
                    React.createElement("div", { className: "gf-form max-width-21" },
                        React.createElement(InlineField, { tooltip: tooltipText, label: "Time to live" },
                            React.createElement(Input, { id: "time-to-live-input", type: "text", placeholder: "1d", validationEvents: timeRangeValidationEvents, value: secondsToLive, onChange: onSecondsToLiveChange }))),
                    React.createElement("div", { className: "gf-form" },
                        React.createElement(Button, null, "Add")))))));
};
//# sourceMappingURL=ApiKeysForm.js.map