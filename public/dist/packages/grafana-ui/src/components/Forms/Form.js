import { __assign, __makeTemplateObject, __rest } from "tslib";
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { css } from '@emotion/css';
export function Form(_a) {
    var defaultValues = _a.defaultValues, onSubmit = _a.onSubmit, _b = _a.validateOnMount, validateOnMount = _b === void 0 ? false : _b, validateFieldsOnMount = _a.validateFieldsOnMount, children = _a.children, _c = _a.validateOn, validateOn = _c === void 0 ? 'onSubmit' : _c, _d = _a.maxWidth, maxWidth = _d === void 0 ? 600 : _d, htmlProps = __rest(_a, ["defaultValues", "onSubmit", "validateOnMount", "validateFieldsOnMount", "children", "validateOn", "maxWidth"]);
    var _e = useForm({
        mode: validateOn,
        defaultValues: defaultValues,
    }), handleSubmit = _e.handleSubmit, trigger = _e.trigger, formState = _e.formState, rest = __rest(_e, ["handleSubmit", "trigger", "formState"]);
    useEffect(function () {
        if (validateOnMount) {
            //@ts-expect-error
            trigger(validateFieldsOnMount);
        }
    }, [trigger, validateFieldsOnMount, validateOnMount]);
    return (React.createElement("form", __assign({ className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n        max-width: ", ";\n        width: 100%;\n      "], ["\n        max-width: ", ";\n        width: 100%;\n      "])), maxWidth !== 'none' ? maxWidth + 'px' : maxWidth), onSubmit: handleSubmit(onSubmit) }, htmlProps), children(__assign({ errors: formState.errors, formState: formState }, rest))));
}
var templateObject_1;
//# sourceMappingURL=Form.js.map