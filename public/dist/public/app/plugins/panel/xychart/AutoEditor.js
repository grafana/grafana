import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { getFrameDisplayName, getFieldDisplayName, } from '@grafana/data';
import { Field, IconButton, Select, useStyles2 } from '@grafana/ui';
import { getXYDimensions, isGraphable } from './dims';
export const AutoEditor = ({ value, onChange, context }) => {
    var _a;
    const frameNames = useMemo(() => {
        var _a;
        if ((_a = context === null || context === void 0 ? void 0 : context.data) === null || _a === void 0 ? void 0 : _a.length) {
            return context.data.map((f, idx) => ({
                value: idx,
                label: getFrameDisplayName(f, idx),
            }));
        }
        return [{ value: 0, label: 'First result' }];
    }, [context.data]);
    const dims = useMemo(() => getXYDimensions(value, context.data), [context.data, value]);
    const info = useMemo(() => {
        var _a, _b;
        const first = {
            label: '?',
            value: undefined, // empty
        };
        const v = {
            numberFields: [first],
            yFields: [],
            xAxis: (value === null || value === void 0 ? void 0 : value.x)
                ? {
                    label: `${value.x} (Not found)`,
                    value: value.x, // empty
                }
                : first,
        };
        const frame = context.data ? context.data[(_a = value === null || value === void 0 ? void 0 : value.frame) !== null && _a !== void 0 ? _a : 0] : undefined;
        if (frame) {
            const xName = dims.x ? getFieldDisplayName(dims.x, dims.frame, context.data) : undefined;
            for (let field of frame.fields) {
                if (isGraphable(field)) {
                    const name = getFieldDisplayName(field, frame, context.data);
                    const sel = {
                        label: name,
                        value: name,
                    };
                    v.numberFields.push(sel);
                    if (first.label === '?') {
                        first.label = `${name} (First)`;
                    }
                    if ((value === null || value === void 0 ? void 0 : value.x) && name === value.x) {
                        v.xAxis = sel;
                    }
                    if (xName !== name) {
                        v.yFields.push({
                            label: name,
                            value: (_b = value === null || value === void 0 ? void 0 : value.exclude) === null || _b === void 0 ? void 0 : _b.includes(name),
                        });
                    }
                }
            }
        }
        return v;
    }, [dims, context.data, value]);
    const styles = useStyles2(getStyles);
    if (!context.data) {
        return React.createElement("div", null, "No data...");
    }
    return (React.createElement("div", null,
        React.createElement(Field, { label: 'Data' },
            React.createElement(Select, { options: frameNames, value: (_a = frameNames.find((v) => v.value === (value === null || value === void 0 ? void 0 : value.frame))) !== null && _a !== void 0 ? _a : frameNames[0], onChange: (v) => {
                    onChange(Object.assign(Object.assign({}, value), { frame: v.value }));
                } })),
        React.createElement(Field, { label: 'X Field' },
            React.createElement(Select, { options: info.numberFields, value: info.xAxis, onChange: (v) => {
                    onChange(Object.assign(Object.assign({}, value), { x: v.value }));
                } })),
        React.createElement(Field, { label: 'Y Fields' },
            React.createElement("div", null, info.yFields.map((v) => (React.createElement("div", { key: v.label, className: styles.row },
                React.createElement(IconButton, { name: v.value ? 'eye-slash' : 'eye', onClick: () => {
                        const exclude = (value === null || value === void 0 ? void 0 : value.exclude) ? [...value.exclude] : [];
                        let idx = exclude.indexOf(v.label);
                        if (idx < 0) {
                            exclude.push(v.label);
                        }
                        else {
                            exclude.splice(idx, 1);
                        }
                        onChange(Object.assign(Object.assign({}, value), { exclude }));
                    }, tooltip: v.value ? 'Disable' : 'Enable' }),
                v.label)))))));
};
const getStyles = (theme) => ({
    sorter: css `
    margin-top: 10px;
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    cursor: pointer;
  `,
    row: css `
    padding: ${theme.spacing(0.5, 1)};
    border-radius: ${theme.shape.radius.default};
    background: ${theme.colors.background.secondary};
    min-height: ${theme.spacing(4)};
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    margin-bottom: 3px;
    border: 1px solid ${theme.components.input.borderColor};
  `,
});
//# sourceMappingURL=AutoEditor.js.map