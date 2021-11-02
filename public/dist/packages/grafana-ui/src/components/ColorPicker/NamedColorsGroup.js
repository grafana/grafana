import { __assign, __rest } from "tslib";
import React from 'react';
import { ColorSwatch, ColorSwatchVariant } from './ColorSwatch';
import { upperFirst } from 'lodash';
var NamedColorsGroup = function (_a) {
    var hue = _a.hue, selectedColor = _a.selectedColor, onColorSelect = _a.onColorSelect, otherProps = __rest(_a, ["hue", "selectedColor", "onColorSelect"]);
    var primaryShade = hue.shades.find(function (shade) { return shade.primary; });
    return (React.createElement("div", __assign({}, otherProps, { style: { display: 'flex', flexDirection: 'column' } }),
        primaryShade && (React.createElement(ColorSwatch, { key: primaryShade.name, isSelected: primaryShade.name === selectedColor, variant: ColorSwatchVariant.Large, color: primaryShade.color, label: upperFirst(hue.name), onClick: function () { return onColorSelect(primaryShade.name); } })),
        React.createElement("div", { style: {
                display: 'flex',
                marginTop: '8px',
            } }, hue.shades.map(function (shade) {
            return !shade.primary && (React.createElement("div", { key: shade.name, style: { marginRight: '4px' } },
                React.createElement(ColorSwatch, { key: shade.name, isSelected: shade.name === selectedColor, color: shade.color, onClick: function () { return onColorSelect(shade.name); } })));
        }))));
};
export default NamedColorsGroup;
//# sourceMappingURL=NamedColorsGroup.js.map