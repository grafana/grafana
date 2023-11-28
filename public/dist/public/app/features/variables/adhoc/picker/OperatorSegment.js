import React from 'react';
import { Segment } from '@grafana/ui';
const options = ['=', '!=', '<', '>', '=~', '!~'].map((value) => ({
    label: value,
    value,
}));
export const OperatorSegment = ({ value, disabled, onChange }) => {
    return (React.createElement(Segment, { className: "query-segment-operator", value: value, disabled: disabled, options: options, onChange: onChange }));
};
//# sourceMappingURL=OperatorSegment.js.map