import { __awaiter, __rest } from "tslib";
import { css, cx } from '@emotion/css';
import React, { useRef } from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import useClickAway from 'react-use/lib/useClickAway';
import { Button, Field, Form, HorizontalGroup, InputControl, TextArea, usePanelContext, useStyles2 } from '@grafana/ui';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { getAnnotationTags } from 'app/features/annotations/api';
export const AnnotationEditorForm = React.forwardRef((_a, ref) => {
    var { annotation, onSave, onDismiss, timeFormatter, className } = _a, otherProps = __rest(_a, ["annotation", "onSave", "onDismiss", "timeFormatter", "className"]);
    const styles = useStyles2(getStyles);
    const panelContext = usePanelContext();
    const clickAwayRef = useRef(null);
    useClickAway(clickAwayRef, () => {
        onDismiss();
    });
    const [createAnnotationState, createAnnotation] = useAsyncFn((event) => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield panelContext.onAnnotationCreate(event);
        if (onSave) {
            onSave();
        }
        return result;
    }));
    const [updateAnnotationState, updateAnnotation] = useAsyncFn((event) => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield panelContext.onAnnotationUpdate(event);
        if (onSave) {
            onSave();
        }
        return result;
    }));
    const isUpdatingAnnotation = annotation.id !== undefined;
    const isRegionAnnotation = annotation.time !== annotation.timeEnd;
    const operation = isUpdatingAnnotation ? updateAnnotation : createAnnotation;
    const stateIndicator = isUpdatingAnnotation ? updateAnnotationState : createAnnotationState;
    const ts = isRegionAnnotation
        ? `${timeFormatter(annotation.time)} - ${timeFormatter(annotation.timeEnd)}`
        : timeFormatter(annotation.time);
    const onSubmit = ({ tags, description }) => {
        operation({
            id: annotation.id,
            tags,
            description,
            from: Math.round(annotation.time),
            to: Math.round(annotation.timeEnd),
        });
    };
    const form = (React.createElement("div", Object.assign({ ref: ref, className: cx(styles.editor, className) }, otherProps),
        React.createElement("div", { className: styles.header },
            React.createElement(HorizontalGroup, { justify: 'space-between', align: 'center' },
                React.createElement("div", { className: styles.title }, "Add annotation"),
                React.createElement("div", { className: styles.ts }, ts))),
        React.createElement("div", { className: styles.editorForm },
            React.createElement(Form, { onSubmit: onSubmit, defaultValues: { description: annotation === null || annotation === void 0 ? void 0 : annotation.text, tags: (annotation === null || annotation === void 0 ? void 0 : annotation.tags) || [] } }, ({ register, errors, control }) => {
                var _a;
                return (React.createElement(React.Fragment, null,
                    React.createElement(Field, { label: 'Description', invalid: !!errors.description, error: (_a = errors === null || errors === void 0 ? void 0 : errors.description) === null || _a === void 0 ? void 0 : _a.message },
                        React.createElement(TextArea, Object.assign({}, register('description', {
                            required: 'Annotation description is required',
                        })))),
                    React.createElement(Field, { label: 'Tags' },
                        React.createElement(InputControl, { control: control, name: "tags", render: (_a) => {
                                var _b = _a.field, { ref, onChange } = _b, field = __rest(_b, ["ref", "onChange"]);
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
const getStyles = (theme) => {
    return {
        backdrop: css `
      label: backdrop;
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      z-index: ${theme.zIndex.navbarFixed};
    `,
        editorContainer: css `
      position: absolute;
      top: calc(100% + 10px);
      transform: translate3d(-50%, 0, 0);
    `,
        editor: css `
      background: ${theme.colors.background.primary};
      box-shadow: ${theme.shadows.z3};
      z-index: ${theme.zIndex.dropdown};
      border: 1px solid ${theme.colors.border.weak};
      border-radius: ${theme.shape.radius.default};
      width: 460px;
    `,
        editorForm: css `
      padding: ${theme.spacing(1)};
    `,
        header: css `
      border-bottom: 1px solid ${theme.colors.border.weak};
      padding: ${theme.spacing(1.5, 1)};
    `,
        title: css `
      font-weight: ${theme.typography.fontWeightMedium};
    `,
        ts: css `
      font-size: ${theme.typography.bodySmall.fontSize};
      color: ${theme.colors.text.secondary};
    `,
    };
};
//# sourceMappingURL=AnnotationEditorForm.js.map