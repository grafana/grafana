import React from 'react';
import { StatsPicker } from '@grafana/ui';
export const StatsPickerEditor = ({ value, onChange, item, id, }) => {
    var _a, _b;
    return (React.createElement(StatsPicker, { stats: value, onChange: onChange, allowMultiple: !!((_a = item.settings) === null || _a === void 0 ? void 0 : _a.allowMultiple), defaultStat: (_b = item.settings) === null || _b === void 0 ? void 0 : _b.defaultStat, inputId: id }));
};
//# sourceMappingURL=stats.js.map