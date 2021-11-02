import { Select } from '@grafana/ui';
import { cx } from '@emotion/css';
import React from 'react';
import { unwrap } from './unwrap';
import { RESULT_FORMATS } from '../constants';
import { paddingRightClass } from './styles';
var className = cx('width-8', paddingRightClass);
export var FormatAsSection = function (_a) {
    var format = _a.format, onChange = _a.onChange;
    return (React.createElement(Select, { className: className, onChange: function (v) {
            onChange(unwrap(v.value));
        }, value: format, options: RESULT_FORMATS }));
};
//# sourceMappingURL=FormatAsSection.js.map