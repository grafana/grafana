import { __assign, __rest } from "tslib";
import React from 'react';
import { escapeStringForRegex, unEscapeStringFromRegex } from '@grafana/data';
import { Button, Icon, Input } from '..';
import { useCombinedRefs } from '../../utils/useCombinedRefs';
export var FilterInput = React.forwardRef(function (_a, ref) {
    var value = _a.value, width = _a.width, onChange = _a.onChange, restProps = __rest(_a, ["value", "width", "onChange"]);
    var innerRef = React.useRef(null);
    var combinedRef = useCombinedRefs(ref, innerRef);
    var suffix = value !== '' ? (React.createElement(Button, { icon: "times", fill: "text", size: "sm", onClick: function (e) {
            var _a;
            (_a = innerRef.current) === null || _a === void 0 ? void 0 : _a.focus();
            onChange('');
            e.stopPropagation();
        } }, "Clear")) : null;
    return (React.createElement(Input, __assign({ prefix: React.createElement(Icon, { name: "search" }), suffix: suffix, width: width, type: "text", value: value ? unEscapeStringFromRegex(value) : '', onChange: function (event) { return onChange(escapeStringForRegex(event.currentTarget.value)); } }, restProps, { ref: combinedRef })));
});
FilterInput.displayName = 'FilterInput';
//# sourceMappingURL=FilterInput.js.map