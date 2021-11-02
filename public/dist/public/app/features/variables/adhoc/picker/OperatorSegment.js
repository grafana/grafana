import React from 'react';
import { Segment } from '@grafana/ui';
var options = ['=', '!=', '<', '>', '=~', '!~'].map(function (value) { return ({
    label: value,
    value: value,
}); });
export var OperatorSegment = function (_a) {
    var value = _a.value, onChange = _a.onChange;
    return React.createElement(Segment, { className: "query-segment-operator", value: value, options: options, onChange: onChange });
};
//# sourceMappingURL=OperatorSegment.js.map