import React, { useCallback } from 'react';
import { Button, useTheme2 } from '@grafana/ui';
import { DEFAULT_STYLE_RULE } from '../layers/data/geojsonLayer';
import { defaultStyleConfig } from '../style/types';
import { StyleRuleEditor } from './StyleRuleEditor';
export const GeomapStyleRulesEditor = ({ value, onChange, context, item }) => {
    const theme = useTheme2();
    const settings = item.settings;
    const onAddRule = useCallback(() => {
        const { palette } = theme.visualization;
        const color = {
            fixed: palette[Math.floor(Math.random() * palette.length)],
        };
        const newRule = [...value, Object.assign(Object.assign({}, DEFAULT_STYLE_RULE), { style: Object.assign(Object.assign({}, defaultStyleConfig), { color }) })];
        onChange(newRule);
    }, [onChange, value, theme.visualization]);
    const onRuleChange = useCallback((idx) => (style) => {
        const copyStyles = [...value];
        if (style) {
            copyStyles[idx] = style;
        }
        else {
            //assume undefined is only returned on delete
            copyStyles.splice(idx, 1);
        }
        onChange(copyStyles);
    }, [onChange, value]);
    const styleOptions = value &&
        value.map((style, idx) => {
            var _a;
            const itemSettings = {
                settings,
            };
            return (React.createElement(StyleRuleEditor, { value: style, onChange: onRuleChange(idx), context: context, item: itemSettings, key: `${idx}-${(_a = style.check) === null || _a === void 0 ? void 0 : _a.property}` }));
        });
    return (React.createElement(React.Fragment, null,
        styleOptions,
        React.createElement(Button, { size: "sm", icon: "plus", onClick: onAddRule, variant: "secondary", "aria-label": 'Add geomap style rule' }, 'Add style rule')));
};
//# sourceMappingURL=GeomapStyleRulesEditor.js.map