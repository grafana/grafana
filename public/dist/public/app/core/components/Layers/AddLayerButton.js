import React from 'react';
import { ValuePicker } from '@grafana/ui';
export const AddLayerButton = ({ onChange, options, label }) => {
    return (React.createElement(ValuePicker, { icon: "plus", label: label, variant: "secondary", options: options, onChange: onChange, isFullWidth: true }));
};
//# sourceMappingURL=AddLayerButton.js.map