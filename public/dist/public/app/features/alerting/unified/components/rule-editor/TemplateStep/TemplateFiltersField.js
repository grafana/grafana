import React, { useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { Button, Field, FieldArray, Input, useStyles2, Select, Label } from '@grafana/ui';
import { AlertRuleFilterType } from 'app/percona/shared/core';
import { Messages } from './TemplateStep.messages';
import { getStyles } from './TemplateStep.styles';
const TemplateFiltersField = () => {
    const styles = useStyles2(getStyles);
    const { register, control, formState: { errors }, } = useFormContext();
    const filterOptions = useMemo(() => Object.entries(AlertRuleFilterType).map(([, value]) => ({
        label: value,
        value: value,
    })), []);
    return (React.createElement(FieldArray, { name: "filters", control: control }, ({ fields, append, remove }) => (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.filtersLabelWrapper },
            React.createElement(Label, { description: Messages.tooltips.filters }, Messages.filter.header)),
        React.createElement(Button, { className: styles.filterButton, variant: "secondary", type: "button", onClick: () => append({}), "data-testid": "add-filter-button" }, Messages.filter.addButton),
        fields.map((name, index) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
            return (React.createElement("div", { key: name.id, className: styles.filterRowWrapper, "data-testid": "filter-fields-row" },
                React.createElement("div", { className: styles.filterFields },
                    React.createElement(Field, { error: (_c = (_b = (_a = errors.filters) === null || _a === void 0 ? void 0 : _a[index]) === null || _b === void 0 ? void 0 : _b.label) === null || _c === void 0 ? void 0 : _c.message, invalid: !!((_f = (_e = (_d = errors.filters) === null || _d === void 0 ? void 0 : _d[index]) === null || _e === void 0 ? void 0 : _e.label) === null || _f === void 0 ? void 0 : _f.message) },
                        React.createElement(Input, Object.assign({}, register(`filters[${index}].label`, {
                            required: { value: true, message: Messages.errors.filterLabel },
                        }), { placeholder: Messages.filter.fieldLabel })))),
                React.createElement("div", { className: styles.filterFields },
                    React.createElement(Field, { error: (_j = (_h = (_g = errors.filters) === null || _g === void 0 ? void 0 : _g[index]) === null || _h === void 0 ? void 0 : _h.type) === null || _j === void 0 ? void 0 : _j.message, invalid: !!((_m = (_l = (_k = errors.filters) === null || _k === void 0 ? void 0 : _k[index]) === null || _l === void 0 ? void 0 : _l.type) === null || _m === void 0 ? void 0 : _m.message) },
                        React.createElement(Controller, { name: `filters[${index}].type`, rules: { required: { value: true, message: Messages.errors.operatorRequired } }, render: ({ field: { onChange, value } }) => (React.createElement(Select, { onChange: (e) => onChange(e.value), value: value, options: filterOptions, placeholder: Messages.filter.fieldOperators })) }))),
                React.createElement("div", { className: styles.filterFields },
                    React.createElement(Field, { error: (_q = (_p = (_o = errors.filters) === null || _o === void 0 ? void 0 : _o[index]) === null || _p === void 0 ? void 0 : _p.regexp) === null || _q === void 0 ? void 0 : _q.message, invalid: !!((_t = (_s = (_r = errors.filters) === null || _r === void 0 ? void 0 : _r[index]) === null || _s === void 0 ? void 0 : _s.regexp) === null || _t === void 0 ? void 0 : _t.message) },
                        React.createElement(Input, Object.assign({}, register(`filters[${index}].regexp`, {
                            required: { value: true, message: Messages.errors.filterRegex },
                        }), { placeholder: Messages.filter.fieldRegex })))),
                React.createElement(Button, { "aria-label": "delete label", icon: "trash-alt", variant: "secondary", onClick: () => {
                        remove(index);
                    } })));
        })))));
};
export default TemplateFiltersField;
//# sourceMappingURL=TemplateFiltersField.js.map