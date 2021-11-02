import { __assign, __makeTemplateObject, __rest } from "tslib";
import React, { useCallback } from 'react';
import { Button, Field, FieldArray, Input, InputControl, Label, TextArea, useStyles } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import { useFormContext } from 'react-hook-form';
import { AnnotationKeyInput } from './AnnotationKeyInput';
var AnnotationsField = function () {
    var styles = useStyles(getStyles);
    var _a = useFormContext(), control = _a.control, register = _a.register, watch = _a.watch, errors = _a.formState.errors;
    var annotations = watch('annotations');
    var existingKeys = useCallback(function (index) { return annotations.filter(function (_, idx) { return idx !== index; }).map(function (_a) {
        var key = _a.key;
        return key;
    }); }, [annotations]);
    return (React.createElement(React.Fragment, null,
        React.createElement(Label, null, "Summary and annotations"),
        React.createElement(FieldArray, { name: 'annotations', control: control }, function (_a) {
            var fields = _a.fields, append = _a.append, remove = _a.remove;
            return (React.createElement("div", { className: styles.flexColumn },
                fields.map(function (field, index) {
                    var _a;
                    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
                    var isUrl = (_c = (_b = annotations[index]) === null || _b === void 0 ? void 0 : _b.key) === null || _c === void 0 ? void 0 : _c.toLocaleLowerCase().endsWith('url');
                    var ValueInputComponent = isUrl ? Input : TextArea;
                    return (React.createElement("div", { key: field.id, className: styles.flexRow },
                        React.createElement(Field, { className: styles.field, invalid: !!((_f = (_e = (_d = errors.annotations) === null || _d === void 0 ? void 0 : _d[index]) === null || _e === void 0 ? void 0 : _e.key) === null || _f === void 0 ? void 0 : _f.message), error: (_j = (_h = (_g = errors.annotations) === null || _g === void 0 ? void 0 : _g[index]) === null || _h === void 0 ? void 0 : _h.key) === null || _j === void 0 ? void 0 : _j.message, "data-testid": "annotation-key-" + index },
                            React.createElement(InputControl, { name: "annotations[" + index + "].key", render: function (_a) {
                                    var _b = _a.field, ref = _b.ref, field = __rest(_b, ["ref"]);
                                    return (React.createElement(AnnotationKeyInput, __assign({}, field, { existingKeys: existingKeys(index), width: 18 })));
                                }, control: control, rules: { required: { value: !!((_k = annotations[index]) === null || _k === void 0 ? void 0 : _k.value), message: 'Required.' } } })),
                        React.createElement(Field, { className: cx(styles.flexRowItemMargin, styles.field), invalid: !!((_o = (_m = (_l = errors.annotations) === null || _l === void 0 ? void 0 : _l[index]) === null || _m === void 0 ? void 0 : _m.value) === null || _o === void 0 ? void 0 : _o.message), error: (_r = (_q = (_p = errors.annotations) === null || _p === void 0 ? void 0 : _p[index]) === null || _q === void 0 ? void 0 : _q.value) === null || _r === void 0 ? void 0 : _r.message },
                            React.createElement(ValueInputComponent, __assign({ "data-testid": "annotation-value-" + index, className: cx(styles.annotationValueInput, (_a = {}, _a[styles.textarea] = !isUrl, _a)) }, register("annotations[" + index + "].value"), { placeholder: isUrl ? 'https://' : "Text", defaultValue: field.value }))),
                        React.createElement(Button, { type: "button", className: styles.flexRowItemMargin, "aria-label": "delete annotation", icon: "trash-alt", variant: "secondary", onClick: function () { return remove(index); } })));
                }),
                React.createElement(Button, { className: styles.addAnnotationsButton, icon: "plus-circle", type: "button", variant: "secondary", onClick: function () {
                        append({ key: '', value: '' });
                    } }, "Add info")));
        })));
};
var getStyles = function (theme) { return ({
    annotationValueInput: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    width: 426px;\n  "], ["\n    width: 426px;\n  "]))),
    textarea: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    height: 76px;\n  "], ["\n    height: 76px;\n  "]))),
    addAnnotationsButton: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    flex-grow: 0;\n    align-self: flex-start;\n    margin-left: 148px;\n  "], ["\n    flex-grow: 0;\n    align-self: flex-start;\n    margin-left: 148px;\n  "]))),
    flexColumn: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: column;\n  "], ["\n    display: flex;\n    flex-direction: column;\n  "]))),
    field: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    margin-bottom: ", ";\n  "], ["\n    margin-bottom: ", ";\n  "])), theme.spacing.xs),
    flexRow: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: row;\n    justify-content: flex-start;\n  "], ["\n    display: flex;\n    flex-direction: row;\n    justify-content: flex-start;\n  "]))),
    flexRowItemMargin: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n    margin-left: ", ";\n  "], ["\n    margin-left: ", ";\n  "])), theme.spacing.xs),
}); };
export default AnnotationsField;
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7;
//# sourceMappingURL=AnnotationsField.js.map