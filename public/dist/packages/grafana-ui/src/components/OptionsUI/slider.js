import React from 'react';
import { Slider } from '../Slider/Slider';
export var SliderValueEditor = function (_a) {
    var value = _a.value, onChange = _a.onChange, item = _a.item;
    var settings = item.settings;
    var initialValue = typeof value === 'number' ? value : typeof value === 'string' ? +value : 0;
    return (React.createElement(Slider, { value: initialValue, min: (settings === null || settings === void 0 ? void 0 : settings.min) || 0, max: (settings === null || settings === void 0 ? void 0 : settings.max) || 100, step: settings === null || settings === void 0 ? void 0 : settings.step, onChange: onChange, ariaLabelForHandle: settings === null || settings === void 0 ? void 0 : settings.ariaLabelForHandle }));
};
//# sourceMappingURL=slider.js.map