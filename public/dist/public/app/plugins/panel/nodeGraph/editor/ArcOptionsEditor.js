import { css } from '@emotion/css';
import React from 'react';
import { Button, ColorPicker, useStyles2 } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';
export const ArcOptionsEditor = ({ value, onChange, context }) => {
    const styles = useStyles2(getStyles);
    const addArc = () => {
        const newArc = { field: '', color: '' };
        onChange(value ? [...value, newArc] : [newArc]);
    };
    const removeArc = (idx) => {
        const copy = value === null || value === void 0 ? void 0 : value.slice();
        copy.splice(idx, 1);
        onChange(copy);
    };
    const updateField = (idx, field, newValue) => {
        var _a;
        let arcs = (_a = value === null || value === void 0 ? void 0 : value.slice()) !== null && _a !== void 0 ? _a : [];
        arcs[idx][field] = newValue;
        onChange(arcs);
    };
    return (React.createElement(React.Fragment, null, value === null || value === void 0 ? void 0 :
        value.map((arc, i) => {
            var _a;
            return (React.createElement("div", { className: styles.section, key: i },
                React.createElement(FieldNamePicker, { context: context, value: (_a = arc.field) !== null && _a !== void 0 ? _a : '', onChange: (val) => {
                        updateField(i, 'field', val);
                    }, item: {
                        settings: {
                            filter: (field) => field.name.includes('arc__'),
                        },
                        id: `arc-field-${i}`,
                        name: `arc-field-${i}`,
                        editor: () => null,
                    } }),
                React.createElement(ColorPicker, { color: arc.color || '#808080', onChange: (val) => {
                        updateField(i, 'color', val);
                    } }),
                React.createElement(Button, { size: "sm", icon: "minus", variant: "secondary", onClick: () => removeArc(i), title: "Remove arc" })));
        }),
        React.createElement(Button, { size: 'sm', icon: "plus", onClick: addArc, variant: "secondary" }, "Add arc")));
};
const getStyles = () => {
    return {
        section: css `
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0 8px;
      margin-bottom: 8px;
    `,
    };
};
//# sourceMappingURL=ArcOptionsEditor.js.map