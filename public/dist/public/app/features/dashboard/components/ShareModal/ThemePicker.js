import React from 'react';
import { RadioButtonGroup, Field } from '@grafana/ui';
import { t } from 'app/core/internationalization';
export const ThemePicker = ({ selectedTheme = 'current', onChange }) => {
    const themeOptions = [
        {
            label: t('share-modal.theme-picker.current', `Current`),
            value: 'current',
        },
        {
            label: t('share-modal.theme-picker.dark', `Dark`),
            value: 'dark',
        },
        {
            label: t('share-modal.theme-picker.light', `Light`),
            value: 'light',
        },
    ];
    return (React.createElement(Field, { label: t('share-modal.theme-picker.field-name', `Theme`) },
        React.createElement(RadioButtonGroup, { options: themeOptions, value: selectedTheme, onChange: onChange })));
};
//# sourceMappingURL=ThemePicker.js.map