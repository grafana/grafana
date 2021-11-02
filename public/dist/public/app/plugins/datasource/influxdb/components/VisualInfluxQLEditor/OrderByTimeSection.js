import React from 'react';
import { cx } from '@emotion/css';
import { unwrap } from './unwrap';
import { Select } from '@grafana/ui';
import { paddingRightClass } from './styles';
var OPTIONS = [
    { label: 'ascending', value: 'ASC' },
    { label: 'descending', value: 'DESC' },
];
var className = cx('width-9', paddingRightClass);
export var OrderByTimeSection = function (_a) {
    var value = _a.value, onChange = _a.onChange;
    return (React.createElement(React.Fragment, null,
        React.createElement(Select, { className: className, onChange: function (v) {
                onChange(unwrap(v.value));
            }, value: value, options: OPTIONS })));
};
//# sourceMappingURL=OrderByTimeSection.js.map