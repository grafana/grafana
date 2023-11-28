import React from 'react';
import { InlineFieldRow, InlineField } from '@grafana/ui';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';
export const CoordinatesMapViewEditor = ({ labelWidth, value, onChange }) => {
    const onLatitudeChange = (latitude) => {
        onChange(Object.assign(Object.assign({}, value), { lat: latitude }));
    };
    const onLongitudeChange = (longitude) => {
        onChange(Object.assign(Object.assign({}, value), { lon: longitude }));
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Latitude", labelWidth: labelWidth, grow: true },
                React.createElement(NumberInput, { value: value.lat, min: -90, max: 90, step: 0.001, onChange: onLatitudeChange }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Longitude", labelWidth: labelWidth, grow: true },
                React.createElement(NumberInput, { value: value.lon, min: -180, max: 180, step: 0.001, onChange: onLongitudeChange })))));
};
//# sourceMappingURL=CoordinatesMapViewEditor.js.map