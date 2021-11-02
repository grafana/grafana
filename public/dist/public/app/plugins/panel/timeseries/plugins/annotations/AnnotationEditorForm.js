import { __assign, __awaiter, __generator, __makeTemplateObject, __read, __rest } from "tslib";
import React, { useRef } from 'react';
import { css, cx } from '@emotion/css';
import { Button, Field, Form, HorizontalGroup, InputControl, TextArea, usePanelContext, useStyles2 } from '@grafana/ui';
import useClickAway from 'react-use/lib/useClickAway';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { getAnnotationTags } from 'app/features/annotations/api';
export var AnnotationEditorForm = React.forwardRef(function (_a, ref) {
    var annotation = _a.annotation, onSave = _a.onSave, onDismiss = _a.onDismiss, timeFormatter = _a.timeFormatter, className = _a.className, otherProps = __rest(_a, ["annotation", "onSave", "onDismiss", "timeFormatter", "className"]);
    var styles = useStyles2(getStyles);
    var panelContext = usePanelContext();
    var clickAwayRef = useRef(null);
    useClickAway(clickAwayRef, function () {
        onDismiss();
    });
    var _b = __read(useAsyncFn(function (event) { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, panelContext.onAnnotationCreate(event)];
                case 1:
                    result = _a.sent();
                    if (onSave) {
                        onSave();
                    }
                    return [2 /*return*/, result];
            }
        });
    }); }), 2), createAnnotationState = _b[0], createAnnotation = _b[1];
    var _c = __read(useAsyncFn(function (event) { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, panelContext.onAnnotationUpdate(event)];
                case 1:
                    result = _a.sent();
                    if (onSave) {
                        onSave();
                    }
                    return [2 /*return*/, result];
            }
        });
    }); }), 2), updateAnnotationState = _c[0], updateAnnotation = _c[1];
    var isUpdatingAnnotation = annotation.id !== undefined;
    var isRegionAnnotation = annotation.time !== annotation.timeEnd;
    var operation = isUpdatingAnnotation ? updateAnnotation : createAnnotation;
    var stateIndicator = isUpdatingAnnotation ? updateAnnotationState : createAnnotationState;
    var ts = isRegionAnnotation
        ? timeFormatter(annotation.time) + " - " + timeFormatter(annotation.timeEnd)
        : timeFormatter(annotation.time);
    var onSubmit = function (_a) {
        var tags = _a.tags, description = _a.description;
        operation({
            id: annotation.id,
            tags: tags,
            description: description,
            from: Math.round(annotation.time),
            to: Math.round(annotation.timeEnd),
        });
    };
    var form = (React.createElement("div", __assign({ ref: ref, className: cx(styles.editor, className) }, otherProps),
        React.createElement("div", { className: styles.header },
            React.createElement(HorizontalGroup, { justify: 'space-between', align: 'center' },
                React.createElement("div", { className: styles.title }, "Add annotation"),
                React.createElement("div", { className: styles.ts }, ts))),
        React.createElement("div", { className: styles.editorForm },
            React.createElement(Form, { onSubmit: onSubmit, defaultValues: { description: annotation === null || annotation === void 0 ? void 0 : annotation.text, tags: (annotation === null || annotation === void 0 ? void 0 : annotation.tags) || [] } }, function (_a) {
                var _b;
                var register = _a.register, errors = _a.errors, control = _a.control;
                return (React.createElement(React.Fragment, null,
                    React.createElement(Field, { label: 'Description', invalid: !!errors.description, error: (_b = errors === null || errors === void 0 ? void 0 : errors.description) === null || _b === void 0 ? void 0 : _b.message },
                        React.createElement(TextArea, __assign({}, register('description', {
                            required: 'Annotation description is required',
                        })))),
                    React.createElement(Field, { label: 'Tags' },
                        React.createElement(InputControl, { control: control, name: "tags", render: function (_a) {
                                var _b = _a.field, ref = _b.ref, onChange = _b.onChange, field = __rest(_b, ["ref", "onChange"]);
                                return (React.createElement(TagFilter, { allowCustomValue: true, placeholder: "Add tags", onChange: onChange, tagOptions: getAnnotationTags, tags: field.value }));
                            } })),
                    React.createElement(HorizontalGroup, { justify: 'flex-end' },
                        React.createElement(Button, { size: 'sm', variant: "secondary", onClick: onDismiss, fill: "outline" }, "Cancel"),
                        React.createElement(Button, { size: 'sm', type: 'submit', disabled: stateIndicator === null || stateIndicator === void 0 ? void 0 : stateIndicator.loading }, (stateIndicator === null || stateIndicator === void 0 ? void 0 : stateIndicator.loading) ? 'Saving' : 'Save'))));
            }))));
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.backdrop }),
        React.createElement("div", { ref: clickAwayRef }, form)));
});
AnnotationEditorForm.displayName = 'AnnotationEditorForm';
var getStyles = function (theme) {
    return {
        backdrop: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: backdrop;\n      position: fixed;\n      top: 0;\n      left: 0;\n      width: 100vw;\n      height: 100vh;\n      overflow: hidden;\n      z-index: ", ";\n    "], ["\n      label: backdrop;\n      position: fixed;\n      top: 0;\n      left: 0;\n      width: 100vw;\n      height: 100vh;\n      overflow: hidden;\n      z-index: ", ";\n    "])), theme.zIndex.navbarFixed),
        editorContainer: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      position: absolute;\n      top: calc(100% + 10px);\n      transform: translate3d(-50%, 0, 0);\n    "], ["\n      position: absolute;\n      top: calc(100% + 10px);\n      transform: translate3d(-50%, 0, 0);\n    "]))),
        editor: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      background: ", ";\n      box-shadow: ", ";\n      z-index: ", ";\n      border: 1px solid ", ";\n      border-radius: ", ";\n      width: 460px;\n    "], ["\n      background: ", ";\n      box-shadow: ", ";\n      z-index: ", ";\n      border: 1px solid ", ";\n      border-radius: ", ";\n      width: 460px;\n    "])), theme.colors.background.primary, theme.shadows.z3, theme.zIndex.dropdown, theme.colors.border.weak, theme.shape.borderRadius()),
        editorForm: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      padding: ", ";\n    "], ["\n      padding: ", ";\n    "])), theme.spacing(1)),
        header: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      border-bottom: 1px solid ", ";\n      padding: ", ";\n    "], ["\n      border-bottom: 1px solid ", ";\n      padding: ", ";\n    "])), theme.colors.border.weak, theme.spacing(1.5, 1)),
        title: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      font-weight: ", ";\n    "], ["\n      font-weight: ", ";\n    "])), theme.typography.fontWeightMedium),
        ts: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      font-size: ", ";\n      color: ", ";\n    "], ["\n      font-size: ", ";\n      color: ", ";\n    "])), theme.typography.bodySmall.fontSize, theme.colors.text.secondary),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7;
//# sourceMappingURL=AnnotationEditorForm.js.map