import { css } from '@emotion/css';
import React from 'react';
import { SegmentInput, useStyles2, InlineLabel, Icon } from '@grafana/ui';
export const TagMappingInput = ({ values, onChange, id }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.wrapper }, values.length ? (values.map((value, idx) => (React.createElement("div", { className: styles.pair, key: idx },
        React.createElement(SegmentInput, { id: `${id}-key-${idx}`, placeholder: 'Tag name', value: value.key, onChange: (e) => {
                onChange(values.map((v, i) => {
                    if (i === idx) {
                        return Object.assign(Object.assign({}, v), { key: String(e) });
                    }
                    return v;
                }));
            } }),
        React.createElement(InlineLabel, { "aria-label": "equals", className: styles.operator }, "as"),
        React.createElement(SegmentInput, { id: `${id}-value-${idx}`, placeholder: 'New name (optional)', value: value.value || '', onChange: (e) => {
                onChange(values.map((v, i) => {
                    if (i === idx) {
                        return Object.assign(Object.assign({}, v), { value: String(e) });
                    }
                    return v;
                }));
            } }),
        React.createElement("button", { onClick: () => onChange([...values.slice(0, idx), ...values.slice(idx + 1)]), className: "gf-form-label query-part", "aria-label": "Remove tag", type: "button" },
            React.createElement(Icon, { name: "times" })),
        idx === values.length - 1 ? (React.createElement("button", { onClick: () => onChange([...values, { key: '', value: '' }]), className: "gf-form-label query-part", "aria-label": "Add tag", type: "button" },
            React.createElement(Icon, { name: "plus" }))) : null)))) : (React.createElement("button", { onClick: () => onChange([...values, { key: '', value: '' }]), className: "gf-form-label query-part", "aria-label": "Add tag", type: "button" },
        React.createElement(Icon, { name: "plus" })))));
};
const getStyles = (theme) => ({
    wrapper: css `
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(0.5)} 0;
  `,
    pair: css `
    display: flex;
    justify-content: start;
    align-items: center;
  `,
    operator: css `
    color: ${theme.v1.palette.orange};
    width: auto;
  `,
});
//# sourceMappingURL=TagMappingInput.js.map