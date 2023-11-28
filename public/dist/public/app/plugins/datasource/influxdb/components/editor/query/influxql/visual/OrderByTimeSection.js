import { cx } from '@emotion/css';
import React from 'react';
import { Select } from '@grafana/ui';
import { unwrap } from '../utils/unwrap';
import { paddingRightClass } from './styles';
const OPTIONS = [
    { label: 'ascending', value: 'ASC' },
    { label: 'descending', value: 'DESC' },
];
const className = cx('width-9', paddingRightClass);
export const OrderByTimeSection = ({ value, onChange, inputId }) => {
    return (React.createElement(React.Fragment, null,
        React.createElement(Select, { inputId: inputId, className: className, onChange: (v) => {
                onChange(unwrap(v.value));
            }, value: value, options: OPTIONS })));
};
//# sourceMappingURL=OrderByTimeSection.js.map