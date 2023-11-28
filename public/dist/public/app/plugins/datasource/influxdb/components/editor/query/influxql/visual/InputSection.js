import { cx } from '@emotion/css';
import React from 'react';
import { Input } from '@grafana/ui';
import { useShadowedState } from '../hooks/useShadowedState';
import { paddingRightClass } from './styles';
export const InputSection = ({ value, onChange, isWide, placeholder }) => {
    const [currentValue, setCurrentValue] = useShadowedState(value);
    const onBlur = () => {
        // we send empty-string as undefined
        const newValue = currentValue === '' ? undefined : currentValue;
        onChange(newValue);
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(Input, { placeholder: placeholder, className: cx((isWide !== null && isWide !== void 0 ? isWide : false) ? 'width-14' : 'width-8', paddingRightClass), type: "text", spellCheck: false, onBlur: onBlur, onChange: (e) => {
                setCurrentValue(e.currentTarget.value);
            }, value: currentValue !== null && currentValue !== void 0 ? currentValue : '' })));
};
//# sourceMappingURL=InputSection.js.map