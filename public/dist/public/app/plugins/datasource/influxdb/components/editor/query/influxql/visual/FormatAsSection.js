import { cx } from '@emotion/css';
import React from 'react';
import { Select } from '@grafana/ui';
import { RESULT_FORMATS } from '../../../constants';
import { unwrap } from '../utils/unwrap';
import { paddingRightClass } from './styles';
const className = cx('width-8', paddingRightClass);
export const FormatAsSection = ({ format, inputId, onChange }) => {
    return (React.createElement(Select, { inputId: inputId, className: className, onChange: (v) => {
            onChange(unwrap(v.value));
        }, value: format, options: RESULT_FORMATS }));
};
//# sourceMappingURL=FormatAsSection.js.map