import React from 'react';
import { StatsPicker } from '../StatsPicker/StatsPicker';
export var StatsPickerEditor = function (_a) {
    var _b, _c;
    var value = _a.value, onChange = _a.onChange, item = _a.item, id = _a.id;
    return (React.createElement(StatsPicker, { stats: value, onChange: onChange, allowMultiple: !!((_b = item.settings) === null || _b === void 0 ? void 0 : _b.allowMultiple), defaultStat: (_c = item.settings) === null || _c === void 0 ? void 0 : _c.defaultStat, inputId: id }));
};
//# sourceMappingURL=stats.js.map